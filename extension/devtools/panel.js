/**
 * EDITH DevTools panel.
 *
 * Sits next to Console / Network / Application as a peer DevTools tab.
 * Captures live runtime data and overlays EDITH's verdict on each event.
 *
 * Capture sources:
 *   - chrome.devtools.network.onRequestFinished  — full request/response, status, timing, body
 *   - chrome.devtools.inspectedWindow.eval        — installs a console patch in the page,
 *                                                   then polls a drain buffer for new entries
 *   - chrome.runtime sendMessage to background    — pulls existing findings + repo binding
 *
 * Analysis layered on top:
 *   - PII fingerprinting in response bodies and console output
 *   - Slow / oversized response detection
 *   - Cookie set without HttpOnly / Secure / SameSite via Set-Cookie header parsing
 *   - Mixed content (HTTP fetch from HTTPS page)
 *   - Error / 4xx / 5xx response rate
 *
 * Nothing here calls back to EDITH's backend — that pipeline already runs from
 * background/worker.js. This panel is a local lens; it just surfaces what's
 * happening so the user can act on it. The background's findings are shown
 * read-only at the top.
 */

/* eslint-disable no-undef */

const tabId = chrome.devtools.inspectedWindow.tabId;

/* ================================================================
 * State
 * ============================================================== */

const state = {
  origin: "",
  requests: [], // { id, method, url, status, mime, ms, kb, findings: [], headers, requestBody, responseSample }
  console: [], // { ts, level, msg }
  bgFindings: [], // findings collected by background (DOM/header/cookie/network/page scanners)
  bgConnected: false,
  bgRepo: null,
};

const SEV_WEIGHT = { critical: 18, high: 9, medium: 4, low: 1 };
function score() {
  const all = liveFindings().concat(state.bgFindings);
  const penalty = all.reduce((s, f) => s + (SEV_WEIGHT[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

/* ================================================================
 * Helpers
 * ============================================================== */

function $(id) {
  return document.getElementById(id);
}
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    e.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}
function fmtBytes(n) {
  if (n == null || n === 0) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtMs(n) {
  if (n == null) return "—";
  if (n < 1000) return Math.round(n) + " ms";
  return (n / 1000).toFixed(2) + " s";
}
function fmtTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}
function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* ================================================================
 * EDITH live analysis
 * ============================================================== */

// Returns findings derived purely from live capture (in addition to bg findings).
function liveFindings() {
  const out = [];
  for (const r of state.requests) {
    for (const f of r.findings) {
      out.push({ ...f, where: `${r.method} ${r.url}` });
    }
  }
  for (const c of state.console) {
    if (c.piiSignals && c.piiSignals.length > 0) {
      out.push({
        severity: "high",
        checkId: "ext-devtools/pii-in-console",
        title: `Console logged PII (${c.piiSignals.join(", ")})`,
        description:
          "PII appearing in console output can leak via screenshots, support tools, or third-party error trackers. Strip identifying fields before logging.",
        where: c.msg.slice(0, 60),
      });
    }
    if (c.level === "error") {
      out.push({
        severity: "medium",
        checkId: "ext-devtools/runtime-error",
        title: `Runtime error: ${truncate(c.msg, 80)}`,
        description:
          "Uncaught error in the page. AI-generated code often misses null/undefined checks — ensure an ErrorBoundary catches this.",
        where: "console",
      });
    }
  }
  return out;
}

// PII fingerprint — same heuristic family as the rest of EDITH.
const PII_PATTERNS = [
  { name: "email", rx: /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/ },
  { name: "phone", rx: /(?:^|\D)(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/ },
  { name: "ssn", rx: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "aadhaar", rx: /\b\d{4}\s\d{4}\s\d{4}\b/ },
  { name: "creditcard", rx: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/ },
  { name: "jwt", rx: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
];

function detectPii(text) {
  if (!text) return [];
  const hits = [];
  for (const p of PII_PATTERNS) {
    if (p.rx.test(text)) hits.push(p.name);
  }
  return hits;
}

// Analyse a finished network request: returns the EDITH finding list for it.
function analyseRequest(entry) {
  const findings = [];
  const req = entry.request || {};
  const res = entry.response || {};
  const url = req.url || "";
  const status = res.status || 0;
  const ms = entry.time || 0;
  const sz = res.bodySize || 0;
  const mime = res._headers?.["content-type"] || res.content?.mimeType || "";

  // Mixed content: HTTP request from HTTPS page.
  if (
    state.origin.startsWith("https:") &&
    url.startsWith("http:")
  ) {
    findings.push({
      severity: "high",
      checkId: "ext-devtools/mixed-content",
      title: "HTTP request from HTTPS page",
      description:
        "Browsers block or downgrade these silently. Move the endpoint to HTTPS or proxy it.",
    });
  }

  // 5xx — server error.
  if (status >= 500) {
    findings.push({
      severity: "high",
      checkId: "ext-devtools/5xx",
      title: `Server returned ${status}`,
      description:
        "Server-side failure. AI-built apps often surface 500s as silent UX dead-ends — check error surfacing in the UI.",
    });
  } else if (status >= 400) {
    findings.push({
      severity: "low",
      checkId: "ext-devtools/4xx",
      title: `Client error ${status}`,
      description:
        "Could be expected (404 lookup) or could be a missing auth/validation case. Verify it's handled in the UI.",
    });
  }

  // Slow request.
  if (ms > 3000) {
    findings.push({
      severity: "medium",
      checkId: "ext-devtools/slow-request",
      title: `Slow response: ${fmtMs(ms)}`,
      description:
        "Anything over 3s feels broken to users. Add a loading skeleton, optimise the query, or move work behind a cache.",
    });
  }

  // Huge response.
  if (sz > 2 * 1024 * 1024) {
    findings.push({
      severity: "medium",
      checkId: "ext-devtools/large-response",
      title: `Large response: ${fmtBytes(sz)}`,
      description:
        "Over 2 MB — likely an unoptimised image or a full table dump. Consider next/image, pagination, or server-side filtering.",
    });
  }

  // Set-Cookie inspection.
  const setCookieHeaders = (res.headers || []).filter(
    (h) => h.name && h.name.toLowerCase() === "set-cookie",
  );
  for (const h of setCookieHeaders) {
    const cookie = h.value || "";
    const nameMatch = cookie.match(/^([^=;\s]+)\s*=/);
    const cookieName = nameMatch ? nameMatch[1] : "cookie";
    const looksSensitive = /session|auth|token|sid|jwt/i.test(cookieName);
    if (looksSensitive) {
      if (!/HttpOnly/i.test(cookie)) {
        findings.push({
          severity: "critical",
          checkId: "ext-devtools/cookie-no-httponly",
          title: `Cookie '${cookieName}' missing HttpOnly`,
          description:
            "Without HttpOnly, any XSS can steal this cookie. For session cookies this means full account takeover.",
        });
      }
      if (!/Secure/i.test(cookie) && state.origin.startsWith("https:")) {
        findings.push({
          severity: "high",
          checkId: "ext-devtools/cookie-no-secure",
          title: `Cookie '${cookieName}' missing Secure`,
          description:
            "Without Secure, the browser may send this cookie over plain HTTP — sniffable on hostile networks.",
        });
      }
      if (!/SameSite/i.test(cookie)) {
        findings.push({
          severity: "medium",
          checkId: "ext-devtools/cookie-no-samesite",
          title: `Cookie '${cookieName}' missing SameSite`,
          description:
            "Without SameSite, CSRF protections rely entirely on your server. Set SameSite=Lax for sessions.",
        });
      }
    }
  }

  // PII in response body (only when we have a sample).
  if (entry.__responseText) {
    const pii = detectPii(entry.__responseText.slice(0, 50000));
    if (pii.length > 0) {
      findings.push({
        severity: "high",
        checkId: "ext-devtools/pii-in-response",
        title: `Response contains PII (${pii.join(", ")})`,
        description:
          "GDPR / data-safety implication. Confirm the user is authorised to see these fields, and that none of them leak to logs.",
      });
    }
  }

  // Hardcoded API key in response (rare but happens — eg. /api/config dump).
  if (entry.__responseText) {
    const looksLikeKey = /(api[_-]?key|secret)[\"':\s]+[A-Za-z0-9_-]{20,}/i.test(
      entry.__responseText,
    );
    if (looksLikeKey) {
      findings.push({
        severity: "critical",
        checkId: "ext-devtools/secret-in-response",
        title: "Response body looks like it contains a secret",
        description:
          "API endpoint is returning what appears to be a key or token. Verify nothing privileged leaks via this route.",
      });
    }
  }

  // GET with non-trivial body — points to misuse of GET.
  if (req.method === "GET" && req.bodySize > 0) {
    findings.push({
      severity: "low",
      checkId: "ext-devtools/get-with-body",
      title: "GET request with a body",
      description:
        "Servers don't have to read GET bodies and proxies often drop them. If this is data submission, use POST.",
    });
  }

  return findings;
}

/* ================================================================
 * Network capture
 * ============================================================== */

chrome.devtools.network.onRequestFinished.addListener((entry) => {
  // Skip data: and blob:.
  const url = entry.request?.url || "";
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("chrome-extension:")
  )
    return;

  // Try to grab response body — async per Chrome API.
  entry.getContent((body, encoding) => {
    if (body && encoding !== "base64") entry.__responseText = body;

    const id = state.requests.length;
    const mime =
      (entry.response?.content?.mimeType ||
        (entry.response?.headers || []).find(
          (h) => h.name?.toLowerCase() === "content-type",
        )?.value ||
        "")
        .split(";")[0]
        .trim();
    const findings = analyseRequest(entry);

    state.requests.push({
      id,
      method: entry.request?.method || "?",
      url,
      status: entry.response?.status || 0,
      mime,
      ms: entry.time || 0,
      kb: entry.response?.bodySize || 0,
      findings,
      headers: entry.response?.headers || [],
      requestHeaders: entry.request?.headers || [],
      responseSample: entry.__responseText
        ? entry.__responseText.slice(0, 4000)
        : null,
    });

    renderNetwork();
    renderSummary();
    renderCounts();
  });
});

chrome.devtools.network.onNavigated.addListener((url) => {
  state.origin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  })();
  state.requests = [];
  state.console = [];
  $("origin-pill").textContent = state.origin || "—";
  renderAll();
  installConsolePatch();
});

/* ================================================================
 * Console capture
 * ============================================================== */

const CONSOLE_PATCH = `
(function(){
  if (window.__edithDevtoolsPatched) return "already";
  window.__edithDevtoolsPatched = true;
  window.__edithDevtoolsLog = [];
  var orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  function capture(level, args){
    try {
      var msg = Array.prototype.map.call(args, function(a){
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch(e){ return String(a); }
      }).join(" ");
      window.__edithDevtoolsLog.push({ ts: Date.now(), level: level, msg: msg });
      if (window.__edithDevtoolsLog.length > 500)
        window.__edithDevtoolsLog.splice(0, window.__edithDevtoolsLog.length - 500);
    } catch(e){}
  }
  ["log","info","warn","error"].forEach(function(level){
    console[level] = function(){ capture(level, arguments); return orig[level].apply(console, arguments); };
  });
  window.addEventListener("error", function(ev){
    capture("error", [(ev && ev.message) || "Uncaught error"]);
  });
  window.addEventListener("unhandledrejection", function(ev){
    capture("error", ["Unhandled rejection: " + ((ev && ev.reason && ev.reason.message) || String(ev && ev.reason))]);
  });
  return "patched";
})();
`;

function installConsolePatch() {
  chrome.devtools.inspectedWindow.eval(CONSOLE_PATCH, (_result, exc) => {
    if (exc && exc.isException) {
      // Page CSP or sandboxed iframe blocked the eval — silently continue.
    }
  });
}

function pollConsole() {
  chrome.devtools.inspectedWindow.eval(
    "(function(){ var x = window.__edithDevtoolsLog || []; window.__edithDevtoolsLog = []; return x; })()",
    (drained, exc) => {
      if (exc && exc.isException) return;
      if (!Array.isArray(drained) || drained.length === 0) return;
      let changed = false;
      for (const entry of drained) {
        if (!entry || !entry.msg) continue;
        const piiSignals = detectPii(entry.msg);
        state.console.push({
          ts: entry.ts || Date.now(),
          level: entry.level || "log",
          msg: entry.msg,
          piiSignals,
        });
        changed = true;
      }
      if (state.console.length > 1000)
        state.console.splice(0, state.console.length - 1000);
      if (changed) {
        renderConsole();
        renderSummary();
        renderCounts();
      }
    },
  );
}

setInterval(pollConsole, 400);
installConsolePatch();

/* ================================================================
 * Background bridge — pull findings the bg worker already gathered
 * ============================================================== */

function refreshBg() {
  chrome.runtime.sendMessage(
    { type: "edith:devtools-fetch", tabId },
    (res) => {
      if (!res || !res.ok) return;
      state.bgFindings = res.findings || [];
      state.bgConnected = !!res.sync?.connected;
      state.bgRepo = res.sync?.match?.repoName || null;
      state.origin = res.origin || state.origin;
      $("origin-pill").textContent =
        (state.bgRepo ? state.bgRepo + " · " : "") +
        (state.origin || "—");
      renderSummary();
    },
  );
}
setInterval(refreshBg, 4000);
refreshBg();

/* ================================================================
 * Rendering
 * ============================================================== */

function renderAll() {
  renderCounts();
  renderSummary();
  renderNetwork();
  renderConsole();
}

function renderCounts() {
  const liveCount = liveFindings().length + state.bgFindings.length;
  const errCount = state.console.filter((c) => c.level === "error").length;
  $("count-network").textContent = state.requests.length;
  $("count-console").textContent = state.console.length;
  $("count-summary").textContent = liveCount;
  $("count-summary").className =
    "count " + (liveCount > 0 ? "has" : "");
  $("count-console").className =
    "count " + (errCount > 0 ? "bad" : "");
  $("count-network").className =
    "count " +
    (state.requests.some((r) => r.findings.length > 0) ? "has" : "");
}

/** Aggregate SEO-relevant signals from captured network requests. */
function seoNetInsights() {
  const reqs = state.requests;
  let totalBytes = 0;
  let renderBlocking = 0;
  let uncompressed = 0;
  let cacheMisses = 0;
  for (const r of reqs) {
    const hdrs = (r.headers || []).reduce((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});
    const bytes = Number(r.kb) || 0;
    totalBytes += bytes;
    const ct = (hdrs["content-type"] || r.mime || "").toLowerCase();
    const isScript = /javascript|ecmascript/.test(ct);
    const isCss = /text\/css/.test(ct);
    if ((isScript || isCss) && bytes > 0) {
      // Approximation: scripts/CSS without async/defer/lazyOnload land in <head>
      // and tend to block. We can't read the document; flag any non-trivial
      // script/css under 1.5s after navStart as a potential blocker.
      if (r.ms && r.ms > 100 && r.ms < 1500) renderBlocking++;
    }
    if (
      bytes > 1024 &&
      /^(text|application|image\/svg)/.test(ct) &&
      !hdrs["content-encoding"]
    )
      uncompressed++;
    if (
      r.status >= 200 &&
      r.status < 400 &&
      bytes > 0 &&
      !hdrs["cache-control"] &&
      !/^document/.test(ct)
    )
      cacheMisses++;
  }
  return {
    count: reqs.length,
    totalBytes,
    renderBlocking,
    uncompressed,
    cacheMisses,
  };
}

function fmtBytesPanel(n) {
  if (!n) return "—";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function renderSeoInsights() {
  const s = seoNetInsights();
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("seo-bytes", fmtBytesPanel(s.totalBytes));
  set("seo-bytes-sub", `across ${s.count} resource${s.count === 1 ? "" : "s"}`);
  set("seo-blocking", String(s.renderBlocking));
  set("seo-uncompressed", String(s.uncompressed));
  set("seo-cache", String(s.cacheMisses));
  // tone class for the heaviest one
  const blockEl = document.getElementById("seo-blocking");
  if (blockEl)
    blockEl.className =
      "value " + (s.renderBlocking > 3 ? "danger" : s.renderBlocking > 0 ? "warn" : "good");
  const cacheEl = document.getElementById("seo-cache");
  if (cacheEl)
    cacheEl.className =
      "value " + (s.cacheMisses > 5 ? "warn" : "good");
  const compEl = document.getElementById("seo-uncompressed");
  if (compEl)
    compEl.className =
      "value " + (s.uncompressed > 2 ? "warn" : "good");
  const byteEl = document.getElementById("seo-bytes");
  if (byteEl)
    byteEl.className =
      "value " + (s.totalBytes > 4 * 1024 * 1024 ? "danger" : s.totalBytes > 2 * 1024 * 1024 ? "warn" : "good");
}

function renderSummary() {
  renderSeoInsights();
  const s = score();
  const tone = s >= 75 ? "good" : s >= 50 ? "warn" : "danger";
  $("score-pill").textContent = s + "/100";
  $("score-pill").className =
    "pill score " + (tone === "good" ? "good" : tone === "danger" ? "bad" : "");
  $("stat-score").textContent = s;
  $("stat-score").className = "value " + tone;

  $("stat-req").textContent = state.requests.length;
  const errs = state.requests.filter((r) => r.status >= 400).length;
  $("stat-req-sub").textContent = errs + " errors";

  const errCount = state.console.filter((c) => c.level === "error").length;
  const warnCount = state.console.filter((c) => c.level === "warn").length;
  $("stat-err").textContent = errCount;
  $("stat-err").className =
    "value " + (errCount > 0 ? "danger" : "good");
  $("stat-warn-sub").textContent = warnCount + " warnings";

  const all = liveFindings().concat(state.bgFindings);
  $("stat-find").textContent = all.length;
  $("stat-find").className =
    "value " + (all.length > 0 ? "warn" : "good");
  $("stat-find-sub").textContent = state.bgConnected
    ? state.bgRepo
      ? `Repo: ${state.bgRepo}`
      : "Connected — no repo"
    : "Not connected to EDITH";

  // List
  const list = $("findings-list");
  list.innerHTML = "";
  if (all.length === 0) {
    list.append(
      el(
        "div",
        { class: "empty-card" },
        el(
          "div",
          { style: "font-size: 11px;" },
          "No findings yet — interact with the page to start auditing.",
        ),
      ),
    );
    return;
  }
  // Sort by severity.
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  all.sort(
    (a, b) =>
      (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9),
  );
  // Dedup by checkId+title.
  const seen = new Set();
  for (const f of all) {
    const k = (f.checkId || "?") + ":" + (f.title || "?");
    if (seen.has(k)) continue;
    seen.add(k);

    const item = el(
      "div",
      { class: "item " + (f.severity || "high") },
      el(
        "div",
        { class: "title-row" },
        el("span", { class: "sev " + (f.severity || "high") }, f.severity || "high"),
        el("span", { class: "title" }, f.title || "Issue"),
        el("span", { class: "check-id" }, f.checkId || ""),
      ),
      el("div", { class: "desc" }, f.description || ""),
      f.where
        ? el(
            "div",
            { class: "desc", style: "margin-top:4px; font-family: var(--mono); font-size: 10px; color: var(--text-muted);" },
            "↳ " + f.where,
          )
        : null,
    );
    list.append(item);
  }
}

function renderNetwork() {
  const root = $("net-list");
  if (state.requests.length === 0) {
    root.innerHTML =
      '<div class="empty"><h3>No requests captured yet</h3><div class="hint">Reload the page or interact with it to populate the feed</div></div>';
    return;
  }
  root.innerHTML = "";
  // Most recent first.
  const items = state.requests.slice().reverse();
  for (const r of items) {
    const row = el(
      "div",
      { class: "row", "data-id": String(r.id) },
      el("span", { class: "method" }, r.method),
      el(
        "span",
        {
          class:
            "status s" +
            (r.status >= 500 ? "5" : r.status >= 400 ? "4" : r.status >= 300 ? "3" : "2") +
            "xx",
        },
        r.status ? String(r.status) : "—",
      ),
      el("span", { class: "url", title: r.url }, shortUrl(r.url)),
      el("span", { class: "size" }, fmtBytes(r.kb)),
      el("span", { class: "time" }, fmtMs(r.ms)),
      r.findings.length > 0
        ? el(
            "div",
            { class: "findings" },
            ...r.findings.map((f) =>
              el(
                "span",
                {
                  class:
                    "finding " +
                    (f.severity === "critical" || f.severity === "high"
                      ? "danger"
                      : f.severity === "medium"
                        ? ""
                        : "info"),
                },
                f.title,
              ),
            ),
          )
        : null,
    );
    row.addEventListener("click", () => toggleDetail(r.id));
    const detail = el("div", {
      class: "detail",
      id: "detail-" + r.id,
      html: detailHtml(r),
    });
    root.append(row, detail);
  }
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return (u.origin === state.origin ? "" : u.origin) + u.pathname + u.search;
  } catch {
    return url;
  }
}

function detailHtml(r) {
  const reqHdr = (r.requestHeaders || [])
    .map(
      (h) =>
        `<div class="kv"><span class="k">${escapeHtml(h.name)}</span><span class="v">${escapeHtml(h.value)}</span></div>`,
    )
    .join("");
  const resHdr = (r.headers || [])
    .map(
      (h) =>
        `<div class="kv"><span class="k">${escapeHtml(h.name)}</span><span class="v">${escapeHtml(h.value)}</span></div>`,
    )
    .join("");
  const sample = r.responseSample
    ? `<h4>Response sample</h4><pre>${escapeHtml(r.responseSample)}</pre>`
    : "";
  const findings = r.findings.length
    ? `<h4>EDITH findings</h4>` +
      r.findings
        .map(
          (f) =>
            `<div class="fix-prompt"><strong>${escapeHtml(f.title)}</strong><br>${escapeHtml(f.description)}<br><span style="font-family:var(--mono);font-size:10px;color:var(--text-muted);">${escapeHtml(f.checkId)}</span></div>`,
        )
        .join("") +
      `<button class="copy-btn" data-id="${r.id}">Copy fix prompt</button>`
    : "";

  return `
    <h4>Request headers</h4>${reqHdr || '<div class="kv"><span class="v">(none)</span></div>'}
    <h4>Response headers</h4>${resHdr || '<div class="kv"><span class="v">(none)</span></div>'}
    ${sample}
    ${findings}
  `;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toggleDetail(id) {
  const d = document.getElementById("detail-" + id);
  if (!d) return;
  d.classList.toggle("open");
  // Wire up copy buttons inside.
  d.querySelectorAll(".copy-btn[data-id]").forEach((btn) => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const r = state.requests.find((x) => x.id === Number(btn.dataset.id));
      if (!r) return;
      const text = buildFixPrompt(r);
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied";
        btn.classList.add("ok");
        setTimeout(() => {
          btn.textContent = "Copy fix prompt";
          btn.classList.remove("ok");
        }, 1600);
      });
    };
  });
}

function buildFixPrompt(r) {
  const lines = [
    `# EDITH live finding for ${r.method} ${r.url}`,
    `Status: ${r.status}  ·  ${fmtMs(r.ms)}  ·  ${fmtBytes(r.kb)}`,
    "",
    "## Issues",
    ...r.findings.map((f) => `- [${f.severity}] ${f.title} (${f.checkId})\n  ${f.description}`),
    "",
    "## Ask",
    "Please look at the route that serves this request and fix the issues above. Keep the public contract of the response stable.",
  ];
  return lines.join("\n");
}

function renderConsole() {
  const root = $("con-list");
  if (state.console.length === 0) {
    root.innerHTML =
      '<div class="empty"><h3>Console silence</h3><div class="hint">Console output captured live · errors and warnings surface here</div></div>';
    return;
  }
  root.innerHTML = "";
  const items = state.console.slice().reverse();
  for (const c of items) {
    const row = el(
      "div",
      { class: "console-row" },
      el("span", { class: "time" }, fmtTime(c.ts)),
      el("span", { class: "lvl " + (c.level || "log") }, c.level || "log"),
      el(
        "span",
        { class: "msg" },
        truncate(c.msg, 800),
        ...(c.piiSignals && c.piiSignals.length > 0
          ? [el("span", { class: "pii" }, "PII: " + c.piiSignals.join(", "))]
          : []),
      ),
    );
    root.append(row);
  }
}

/* ================================================================
 * Tab switching
 * ============================================================== */

document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((x) => x.classList.remove("active"));
    document
      .querySelectorAll(".pane")
      .forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const id = "pane-" + t.dataset.tab;
    const pane = document.getElementById(id);
    if (pane) pane.classList.add("active");
  });
});

$("clear-btn").addEventListener("click", () => {
  state.requests = [];
  state.console = [];
  renderAll();
});

$("rescan-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "edith:rescan" }, () => {
    setTimeout(refreshBg, 1500);
  });
});

/* ================================================================
 * Init
 * ============================================================== */

chrome.devtools.inspectedWindow.eval("location.href", (url) => {
  if (typeof url === "string") {
    try {
      state.origin = new URL(url).origin;
      $("origin-pill").textContent = state.origin;
    } catch {
      /* */
    }
  }
});

renderAll();
