/**
 * EDITH content script. Runs on every page (incl. localhost) at document_idle.
 *
 * All checks are READ-ONLY — we never mutate the page or fire requests on
 * its behalf. (The active probe pack lives server-side at /repos/[id]/probes.)
 *
 * Network observer is injected via chrome.scripting.executeScript from the
 * background (world: 'MAIN') so it bypasses page CSP — the inline-script
 * approach broke on sites with strict script-src directives.
 */

(function () {
  if (window.__edithRan) return;
  window.__edithRan = true;

  const findings = [];
  const tools = new Set();

  const add = (f) => {
    if (findings.some((x) => x.checkId === f.checkId && x.title === f.title))
      return;
    findings.push({
      ...f,
      url: location.href,
      origin: location.origin,
      detectedAt: Date.now(),
    });
  };

  /* ============ A. Secrets in HTML + same-origin scripts ============ */
  const PATTERNS = [
    { name: "Stripe live secret key", re: /\bsk_live_[0-9A-Za-z]{24,}\b/, rotate: "https://dashboard.stripe.com/apikeys" },
    { name: "Stripe restricted live key", re: /\brk_live_[0-9A-Za-z]{24,}\b/, rotate: "https://dashboard.stripe.com/apikeys" },
    { name: "Razorpay live key", re: /\brzp_live_[0-9A-Za-z]{14,}\b/, rotate: "https://dashboard.razorpay.com/app/keys" },
    { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/, rotate: "IAM → Security credentials" },
    { name: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/, rotate: "https://platform.openai.com/api-keys" },
    { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/, rotate: "https://console.anthropic.com/settings/keys" },
    { name: "GitHub PAT", re: /\bghp_[A-Za-z0-9]{36}\b/, rotate: "Settings → Developer settings → PATs" },
    { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, rotate: "https://api.slack.com/apps" },
    { name: "Supabase service-role JWT", re: /\beyJ[A-Za-z0-9+/_-]{30,}\.eyJ[A-Za-z0-9+/_-]{30,}\.[A-Za-z0-9+/_-]{30,}\b/, rotate: "Supabase Dashboard → Settings → API → Reset service_role secret" },
  ];

  const redact = (s) => (s.length <= 8 ? "[redacted]" : s.slice(0, 4) + "…" + s.slice(-4));

  const scanText = (text, sourceLabel) => {
    if (!text || text.length < 16) return;
    for (const p of PATTERNS) {
      const m = text.match(p.re);
      if (!m) continue;
      if (p.name.includes("Supabase")) {
        try {
          const mid = m[0].split(".")[1];
          const json = atob(mid.replace(/-/g, "+").replace(/_/g, "/"));
          if (!/service_role/.test(json)) continue;
        } catch {
          continue;
        }
      }
      add({
        checkId: "ext/leaked-secret",
        severity: "critical",
        dimension: "security",
        title: `${p.name} exposed in ${sourceLabel}`,
        description: `EDITH found what looks like a live ${p.name} (${redact(m[0])}) inside the page's ${sourceLabel}. Anyone viewing the page's source can read it. Rotate immediately: ${p.rotate}.`,
      });
    }
  };

  try {
    for (const s of document.scripts) {
      const text = s.textContent || "";
      if (text.length > 0 && text.length < 500_000)
        scanText(text, `inline script (${text.length}b)`);
    }
  } catch { /* extreme DOM lockdown — skip */ }

  // Same-origin script fetch + scan.
  (async () => {
    try {
      const sameOrigin = Array.from(document.scripts)
        .filter((s) => s.src && s.src.startsWith(location.origin))
        .slice(0, 20);
      for (const s of sameOrigin) {
        try {
          const res = await fetch(s.src, { credentials: "omit" });
          if (!res.ok) continue;
          const text = await res.text();
          if (text.length > 2_000_000) continue;
          scanText(text, `script: ${s.src.split("/").pop()}`);
        } catch { /* per-file skip */ }
      }
    } catch { /* */ }
    flush();
  })();

  /* ============ B. NEXT_PUBLIC_ that look sensitive ============ */
  let html = "";
  try { html = document.documentElement.outerHTML; } catch { html = ""; }
  const seenPublic = new Set();
  const npublic = html.match(/\bNEXT_PUBLIC_[A-Z_]+/g) || [];
  for (const v of npublic) {
    if (seenPublic.has(v)) continue;
    seenPublic.add(v);
    if (/SECRET|PASSWORD|PRIVATE|SERVICE_ROLE/i.test(v)) {
      add({
        checkId: "ext/next-public-sensitive",
        severity: "high",
        dimension: "security",
        title: `${v} appears in the client bundle`,
        description: `Variable names starting with NEXT_PUBLIC_ are bundled into the browser. ${v} sounds sensitive — anyone can read its value via DevTools. Move it to a server-only env var without the NEXT_PUBLIC_ prefix.`,
      });
    }
  }

  /* ============ C. Cookies (JS-readable subset) ============ */
  try {
    const cookieStr = document.cookie || "";
    if (cookieStr) {
      for (const ck of cookieStr.split(";")) {
        const name = ck.split("=")[0].trim();
        if (/session|auth|token|sid/i.test(name)) {
          add({
            checkId: "ext/cookie-readable-from-js",
            severity: "high",
            dimension: "security",
            title: `Session cookie '${name}' is readable from JavaScript`,
            description: `This cookie is visible to document.cookie, meaning HttpOnly is OFF. Any XSS in your app can steal it. Set HttpOnly=true on cookies that carry session/auth/token.`,
          });
        }
      }
    }
  } catch { /* */ }

  /* ============ D. localStorage ============ */
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || "";
      if (/token|secret|key|password|jwt/i.test(key) || /^eyJ[A-Za-z0-9_-]+\.eyJ/.test(value)) {
        add({
          checkId: "ext/localstorage-secret",
          severity: "high",
          dimension: "data_safety",
          title: `localStorage["${key}"] looks like a secret`,
          description: `localStorage is readable by any script on this origin (including XSS-injected ones). Move auth tokens to HttpOnly cookies, or to sessionStorage behind a strict CSP.`,
        });
      }
    }
  } catch { /* */ }

  /* ============ E. target=_blank without rel=noopener ============ */
  try {
    const blanks = document.querySelectorAll('a[target="_blank"]');
    let unsafeBlanks = 0;
    for (const a of blanks) {
      const rel = (a.getAttribute("rel") || "").toLowerCase();
      if (!rel.includes("noopener") && !rel.includes("noreferrer")) unsafeBlanks++;
    }
    if (unsafeBlanks > 0) {
      add({
        checkId: "ext/target-blank-no-noopener",
        severity: "low",
        dimension: "security",
        title: `${unsafeBlanks} link(s) open new tab without rel="noopener"`,
        description: `Pages opened via target="_blank" can call window.opener.location='...' on the originating page. Add rel="noopener noreferrer" to every external link.`,
      });
    }
  } catch { /* */ }

  /* ============ F. Forms posting to another origin ============ */
  try {
    const forms = document.querySelectorAll("form[action]");
    for (const f of forms) {
      const action = f.getAttribute("action") || "";
      try {
        const u = new URL(action, location.href);
        if (u.origin !== location.origin && action) {
          add({
            checkId: "ext/form-cross-origin",
            severity: "high",
            dimension: "security",
            title: `Form posts to a different origin: ${u.origin}`,
            description: `A form on ${location.origin} is configured to submit to ${u.origin}. If intentional (Stripe Checkout etc.) ignore — otherwise it's a phishing target.`,
          });
          break;
        }
      } catch { /* */ }
    }
  } catch { /* */ }

  /* ============ G. Mixed content ============ */
  try {
    if (location.protocol === "https:") {
      const all = document.querySelectorAll("[src], [href]");
      const insecure = [];
      for (const el of all) {
        const url = el.getAttribute("src") || el.getAttribute("href") || "";
        if (url.startsWith("http://")) insecure.push(url);
      }
      if (insecure.length > 0) {
        add({
          checkId: "ext/mixed-content",
          severity: "medium",
          dimension: "security",
          title: `${insecure.length} insecure (http://) resource(s) on this https page`,
          description: `Browsers may block these or warn the user. Examples: ${insecure.slice(0, 3).join(", ")}.`,
        });
      }
    }
  } catch { /* */ }

  /* ============ H. Source maps reachable ============ */
  (async () => {
    try {
      const scripts = Array.from(document.scripts)
        .map((s) => s.src)
        .filter((s) => s && s.startsWith(location.origin) && s.endsWith(".js"))
        .slice(0, 3);
      for (const src of scripts) {
        try {
          const res = await fetch(src + ".map", { method: "HEAD", credentials: "omit" });
          if (res.ok) {
            add({
              checkId: "ext/source-map-public",
              severity: "low",
              dimension: "security",
              title: "Source map publicly accessible",
              description: `${src}.map returns 200. This exposes your unminified source + inline comments/TODOs. Disable productionBrowserSourceMaps or gate maps behind auth.`,
            });
            break;
          }
        } catch { /* */ }
      }
    } catch { /* */ }
    flush();
  })();

  /* ============ I. CSP meta ============ */
  try {
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (cspMeta) {
      const v = cspMeta.getAttribute("content") || "";
      if (/unsafe-inline/.test(v) && /script-src/.test(v)) {
        add({
          checkId: "ext/csp-unsafe-inline",
          severity: "medium",
          dimension: "security",
          title: "CSP allows unsafe-inline scripts",
          description: "Your Content-Security-Policy permits 'unsafe-inline' for script-src, defeating its main purpose. Use nonces or hashes instead.",
        });
      }
    }
  } catch { /* */ }

  /* ============ J. Runtime error observer ============ */
  let errCount = 0;
  try {
    const origErr = console.error;
    console.error = function () {
      errCount++;
      return origErr.apply(this, arguments);
    };
    window.addEventListener("error", () => errCount++);
    window.addEventListener("unhandledrejection", () => errCount++);
  } catch { /* */ }
  setTimeout(() => {
    if (errCount >= 3) {
      add({
        checkId: "ext/runtime-errors",
        severity: "medium",
        dimension: "reliability",
        title: `${errCount} runtime errors fired in the first 4 seconds`,
        description: "The page emitted multiple errors on load. AI-generated code often has unhandled rejection paths that pass type-checking but throw at runtime. Open DevTools → Console.",
      });
      flush();
    }
  }, 4000);

  /* ============ K. AI tool + framework fingerprinting ============ */
  try {
    const bodyClass = (document.body && document.body.className) || "";
    const allScripts = Array.from(document.scripts)
      .map((s) => s.src + " " + (s.textContent || "").slice(0, 200))
      .join(" ");
    const meta = Array.from(document.querySelectorAll("meta"))
      .map((m) => (m.getAttribute("name") || "") + "=" + (m.getAttribute("content") || ""))
      .join(" ");
    const everything = html.slice(0, 50_000) + " " + bodyClass + " " + meta;
    if (document.querySelector("#__next") || /\/_next\//.test(allScripts) || /next-route-announcer/.test(html)) tools.add("Next.js");
    if (document.querySelector("[data-reactroot]") || /__REACT_DEVTOOLS/.test(allScripts) || (document.querySelector("#root") && /react/i.test(allScripts))) tools.add("React");
    if (/_nuxt|nuxt-link/.test(html)) tools.add("Nuxt");
    if (document.querySelector("[data-sveltekit]")) tools.add("SvelteKit");
    if (/vite\/client/.test(allScripts)) tools.add("Vite");
    if (/supabase\.co/.test(allScripts) || /sb-[a-z]+-auth-token/.test((document.cookie || "") + everything)) tools.add("Supabase");
    if (/js\.stripe\.com/.test(allScripts)) tools.add("Stripe");
    if (/checkout\.razorpay\.com/.test(allScripts)) tools.add("Razorpay");
    if (/clerk\.(?:com|dev)/.test(allScripts) || /__clerk_/.test(document.cookie || "")) tools.add("Clerk");
    if (/firebaseio\.com|firestore\.googleapis/.test(allScripts)) tools.add("Firebase");
    if (/posthog\.com/.test(allScripts)) tools.add("PostHog");
    if (/vercel-insights|_vercel/.test(allScripts + " " + (document.cookie || ""))) tools.add("Vercel");
    if (/v0\.dev|v0-tools/.test(everything)) tools.add("v0");
    if (/lovable\.dev/.test(everything)) tools.add("Lovable");
    if (/bolt\.new/.test(everything)) tools.add("Bolt");
  } catch { /* */ }

  /* ============ L. Network observer (via background, MAIN world) ============ */
  // The background uses chrome.scripting.executeScript({world:'MAIN'}) to
  // inject a fetch monkey-patch into the page's main world. This bypasses
  // page CSP entirely — extension-privileged injection is not subject to
  // the page's script-src directive.
  //
  // The injected patch dispatches CustomEvent('edith:netcall') on window;
  // we listen here in the isolated content-script world.
  const networkResults = [];
  try {
    window.addEventListener("edith:netcall", (e) => {
      if (e && e.detail) networkResults.push(e.detail);
    });
    chrome.runtime.sendMessage({ type: "edith:install-netobserver" }, () => {
      void chrome.runtime.lastError; // silently ignore restricted pages
    });
  } catch { /* extension messaging unavailable */ }

  setTimeout(() => {
    const responses = networkResults.filter((r) => r.kind === "response");
    const errors = responses.filter((r) => r.status >= 400);
    if (errors.length >= 3) {
      add({
        checkId: "ext/error-rate",
        severity: "medium",
        dimension: "reliability",
        title: `${errors.length} API requests failed (4xx/5xx) on this page`,
        description: `EDITH watched ${responses.length} network calls and saw ${errors.length} non-2xx responses. Open DevTools → Network and filter for failed requests. AI-generated handlers often return 500 on edge cases the happy path didn't account for.`,
      });
    }
    const piiRegexes = [
      /"email"\s*:/i,
      /"phone"\s*:/i,
      /"phoneNumber"\s*:/i,
      /"address"\s*:/i,
      /"ssn"\s*:/i,
      /"creditCard"\s*:/i,
      /"dob"\s*:/i,
    ];
    for (const r of responses) {
      if (!r.sample) continue;
      const hits = piiRegexes.filter((re) => re.test(r.sample)).length;
      if (hits >= 2) {
        let pathStr = r.url;
        try { pathStr = new URL(r.url).pathname; } catch { /* */ }
        add({
          checkId: "ext/pii-in-response",
          severity: "medium",
          dimension: "data_safety",
          title: `API response from ${pathStr} contains PII fields`,
          description: `${pathStr} returned JSON with ${hits}+ PII-looking fields (email/phone/address etc.). Audit whether the client actually needs every field — over-fetching is the #1 way PII leaks into logs, analytics, or LLM context.`,
        });
        break;
      }
    }
    flush();
  }, 5000);

  /* ============ flush ============ */
  let lastFlushedCount = -1;
  function flush() {
    if (findings.length === lastFlushedCount && tools.size === 0) return;
    lastFlushedCount = findings.length;
    try {
      chrome.runtime.sendMessage({
        type: "edith:scan-result",
        origin: location.origin,
        url: location.href,
        title: document.title,
        findings,
        tools: Array.from(tools),
        scannedAt: Date.now(),
      });
    } catch {
      /* extension context invalidated */
    }
  }
  flush();
})();
