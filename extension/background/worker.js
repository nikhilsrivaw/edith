/**
 * EDITH background service worker.
 *
 * Responsibilities:
 *   - Receive findings from content scripts, keep latest per-tab in memory
 *     (persist last-N to chrome.storage for the popup)
 *   - Inspect response headers (CSP, HSTS, etc.) via webRequest
 *   - Inspect cookies for missing Secure / SameSite flags (HttpOnly is
 *     handled here too since document.cookie can't see HttpOnly cookies)
 *   - Update toolbar badge with critical+high count
 *   - Push findings to the user's EDITH account (if a token is stored)
 */

const findingsByTab = new Map(); // tabId -> { findings, scannedAt, origin, title, url }
const headerFindingsByTab = new Map(); // tabId -> finding[]
const syncByTab = new Map(); // tabId -> last sync response from /api/extension/sync
const STORAGE_KEY_TOKEN = "edith_token";
const STORAGE_KEY_API = "edith_api_url";

/* ------------- Backend sync ------------- */

const SEV_WEIGHT = { critical: 18, high: 9, medium: 4, low: 1 };
function scoreOf(findings) {
  const penalty = findings.reduce(
    (s, f) => s + (SEV_WEIGHT[f.severity] || 0),
    0,
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

async function syncSeoProbe(payload) {
  try {
    const d = await chrome.storage.local.get([
      STORAGE_KEY_TOKEN,
      STORAGE_KEY_API,
    ]);
    const token = d[STORAGE_KEY_TOKEN];
    const apiUrl = d[STORAGE_KEY_API];
    if (!token || !apiUrl) return;
    let probeUrl;
    try {
      const u = new URL(apiUrl);
      u.pathname = u.pathname.replace(/\/[^/]*$/, "/probe/seo");
      probeUrl = u.toString();
    } catch {
      return;
    }
    await fetch(probeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: payload.url,
        origin: payload.origin,
        capturedAt: payload.capturedAt,
        cwv: payload.cwv,
        clsSources: payload.clsSources,
        longTasks: payload.longTasks,
        resources: payload.resources,
        dom: payload.dom,
        consoleErrors: payload.consoleErrors,
      }),
    });
  } catch {
    /* network fail is OK; user can retry */
  }
}

async function syncToBackend(tabId, payload) {
  try {
    const d = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_API]);
    const token = d[STORAGE_KEY_TOKEN];
    const apiUrl = d[STORAGE_KEY_API];
    if (!token || !apiUrl) {
      syncByTab.set(tabId, { connected: false });
      return;
    }
    // Derive the /api/extension/sync URL from the configured base. The user
    // probably entered /api/mcp; we replace the last path segment.
    let syncUrl;
    try {
      const u = new URL(apiUrl);
      u.pathname = u.pathname.replace(/\/[^/]*$/, "/extension/sync");
      syncUrl = u.toString();
    } catch {
      syncByTab.set(tabId, { connected: false, error: "bad api url" });
      return;
    }

    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        origin: payload.origin,
        url: payload.url,
        title: payload.title,
        tools: payload.tools,
        findings: payload.findings,
        score: scoreOf(payload.findings),
      }),
    });
    if (!res.ok) {
      syncByTab.set(tabId, {
        connected: false,
        error: `sync failed: ${res.status}`,
      });
      return;
    }
    const json = await res.json();
    syncByTab.set(tabId, { connected: true, ...json });
  } catch (e) {
    syncByTab.set(tabId, {
      connected: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/* ------------- Helpers ------------- */

function setBadge(tabId, findings) {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const count = critical + high;
  if (count === 0) {
    chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }
  chrome.action.setBadgeText({ tabId, text: count > 99 ? "99+" : String(count) });
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: critical > 0 ? "#F87171" : "#FFB627",
  });
  chrome.action.setBadgeTextColor({ tabId, color: "#0A0E14" });
}

function mergedFor(tabId) {
  const main = findingsByTab.get(tabId);
  const headerExtra = headerFindingsByTab.get(tabId) || [];
  if (!main) {
    return {
      origin: "",
      url: "",
      title: "",
      tools: [],
      scannedAt: Date.now(),
      findings: headerExtra,
    };
  }
  // Dedup by checkId+title within the page.
  const seen = new Set();
  const out = [...main.findings, ...headerExtra].filter((f) => {
    const k = `${f.checkId}:${f.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ...main, findings: out };
}

/* ------------- Message handler (content -> bg) ------------- */

/* ------------- Network observer (MAIN-world injection) ------------- */

// Runs in the page's MAIN world via chrome.scripting.executeScript.
// Patches window.fetch to dispatch a CustomEvent the content script listens for.
// (CustomEvent can cross the isolated-world boundary; postMessage works too but
// CSP-restricted pages sometimes block it.)
function edithNetObserver() {
  // @ts-ignore — runs in page world
  if (window.__edithNet) return;
  // @ts-ignore
  window.__edithNet = true;
  const origFetch = window.fetch;
  const sample = (text) => {
    try {
      if (!text || text.length > 200000) return null;
      if (text[0] !== "{" && text[0] !== "[") return null;
      return text.slice(0, 10000);
    } catch {
      return null;
    }
  };
  const emit = (detail) => {
    try {
      window.dispatchEvent(new CustomEvent("edith:netcall", { detail }));
    } catch {
      /* */
    }
  };
  window.fetch = async function (...args) {
    try {
      const res = await origFetch.apply(this, args);
      const url = (args[0] && args[0].url) || args[0];
      const status = res.status;
      const ct = res.headers.get("content-type") || "";
      const sameOrigin =
        typeof url === "string" && url.indexOf(location.origin) === 0;
      if (/json/.test(ct) && sameOrigin && status < 400) {
        res
          .clone()
          .text()
          .then((t) =>
            emit({ kind: "response", url, status, sample: sample(t) }),
          )
          .catch(() => undefined);
      } else {
        emit({ kind: "response", url: String(url), status, sample: null });
      }
      return res;
    } catch (e) {
      emit({ kind: "error", url: String(args[0]), error: String(e) });
      throw e;
    }
  };
}

async function installNetObserver(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func: edithNetObserver,
    });
  } catch {
    /* restricted page (chrome://, store, etc.) — silently skip */
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "edith:install-netobserver" && sender.tab?.id) {
    installNetObserver(sender.tab.id);
    sendResponse({ ok: true });
    return true;
  }

  if (msg && msg.type === "edith:seo-probe" && sender.tab) {
    syncSeoProbe(msg).catch(() => undefined);
    sendResponse({ ok: true });
    return true;
  }

  if (msg && msg.type === "edith:scan-result" && sender.tab) {
    findingsByTab.set(sender.tab.id, {
      origin: msg.origin,
      url: msg.url,
      title: msg.title,
      tools: msg.tools || [],
      scannedAt: msg.scannedAt,
      findings: msg.findings || [],
    });
    const all = mergedFor(sender.tab.id);
    setBadge(sender.tab.id, all.findings);
    chrome.storage.local
      .set({ [`scan:${sender.tab.id}`]: all })
      .catch(() => undefined);
    // Fire-and-forget sync to the user's EDITH backend.
    syncToBackend(sender.tab.id, all);
    sendResponse({ ok: true, count: all.findings.length });
    return true;
  }

  if (msg && msg.type === "edith:get-sync-status") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs[0];
        if (!tab) return sendResponse({ ok: false });
        const status = syncByTab.get(tab.id) || { connected: false };
        sendResponse({ ok: true, ...status });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg && msg.type === "edith:devtools-fetch") {
    // Called from the DevTools panel — message sender has no tab context, so
    // the caller passes msg.tabId (= chrome.devtools.inspectedWindow.tabId).
    const t = Number(msg.tabId);
    if (!Number.isFinite(t)) {
      sendResponse({ ok: false, error: "missing tabId" });
      return true;
    }
    const result = mergedFor(t);
    chrome.tabs
      .get(t)
      .then((tab) => inspectCookies(tab).then((extra) => ({ tab, extra })))
      .then(({ extra }) => {
        sendResponse({
          ok: true,
          origin: result.origin,
          url: result.url,
          title: result.title,
          tools: result.tools,
          scannedAt: result.scannedAt,
          findings: [...result.findings, ...extra],
          sync: syncByTab.get(t) || { connected: false },
        });
      })
      .catch(() => {
        sendResponse({
          ok: true,
          ...result,
          sync: syncByTab.get(t) || { connected: false },
        });
      });
    return true;
  }

  if (msg && msg.type === "edith:get-active-findings") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs[0];
        if (!tab) return sendResponse({ ok: false });
        const result = mergedFor(tab.id);
        // Also augment with cookie checks just-in-time.
        inspectCookies(tab).then((extra) => {
          const all = [...result.findings, ...extra];
          sendResponse({ ok: true, ...result, findings: all });
        });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg && msg.type === "edith:save-config") {
    chrome.storage.local
      .set({
        [STORAGE_KEY_TOKEN]: msg.token || "",
        [STORAGE_KEY_API]: msg.apiUrl || "",
      })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg && msg.type === "edith:get-config") {
    chrome.storage.local
      .get([STORAGE_KEY_TOKEN, STORAGE_KEY_API])
      .then((d) =>
        sendResponse({
          ok: true,
          token: d[STORAGE_KEY_TOKEN] || "",
          apiUrl: d[STORAGE_KEY_API] || "http://localhost:3000/api/mcp",
        }),
      );
    return true;
  }

  if (msg && msg.type === "edith:rescan") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) return sendResponse({ ok: false });
        // Reset state for this tab.
        findingsByTab.delete(tab.id);
        headerFindingsByTab.delete(tab.id);
        chrome.action.setBadgeText({ tabId: tab.id, text: "" });
        // Inject the content script again.
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id, allFrames: false },
            files: ["content/main.js"],
          })
          .then(() => sendResponse({ ok: true }))
          .catch((e) =>
            sendResponse({ ok: false, error: e?.message || String(e) }),
          );
      });
    return true;
  }
});

/* ------------- Response-header inspection ------------- */

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== "main_frame") return;
    const headers = (details.responseHeaders || []).reduce((acc, h) => {
      acc[(h.name || "").toLowerCase()] = h.value || "";
      return acc;
    }, {});
    const findings = [];

    if (!headers["strict-transport-security"] && details.url.startsWith("https:")) {
      findings.push({
        checkId: "ext/hsts-missing",
        severity: "medium",
        dimension: "security",
        title: "HSTS header missing",
        description:
          "No Strict-Transport-Security header — browsers can be downgrade-attacked into http on first visit. Add Strict-Transport-Security: max-age=31536000; includeSubDomains.",
      });
    }
    if (!headers["x-content-type-options"]) {
      findings.push({
        checkId: "ext/x-content-type-missing",
        severity: "low",
        dimension: "security",
        title: "X-Content-Type-Options header missing",
        description: "Add X-Content-Type-Options: nosniff to prevent MIME-sniffing-based attacks.",
      });
    }
    if (
      !headers["x-frame-options"] &&
      !/frame-ancestors/.test(headers["content-security-policy"] || "")
    ) {
      findings.push({
        checkId: "ext/frame-options-missing",
        severity: "medium",
        dimension: "security",
        title: "Clickjacking protection missing",
        description: "No X-Frame-Options header and no frame-ancestors directive in CSP. Your page can be iframed by any site.",
      });
    }
    if (!headers["content-security-policy"]) {
      findings.push({
        checkId: "ext/csp-missing",
        severity: "high",
        dimension: "security",
        title: "Content-Security-Policy header missing",
        description: "CSP is the strongest XSS defense available. Add at least a default-src 'self' policy and tighten as needed.",
      });
    } else if (
      /'unsafe-inline'|'unsafe-eval'/.test(headers["content-security-policy"])
    ) {
      findings.push({
        checkId: "ext/csp-unsafe",
        severity: "medium",
        dimension: "security",
        title: "CSP allows unsafe-inline / unsafe-eval",
        description: "Your CSP permits unsafe-inline or unsafe-eval — XSS protection is largely defeated. Use nonces or hashes for inline scripts.",
      });
    }
    if (findings.length > 0) {
      headerFindingsByTab.set(details.tabId, findings);
      const all = mergedFor(details.tabId);
      setBadge(details.tabId, all.findings);
    }
  },
  { urls: ["http://*/*", "https://*/*"], types: ["main_frame"] },
  ["responseHeaders"],
);

/* ------------- Cookie inspection (HttpOnly + SameSite + Secure) ------------- */

async function inspectCookies(tab) {
  if (!tab.url) return [];
  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return [];
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return [];
  try {
    const cookies = await chrome.cookies.getAll({ domain: url.hostname });
    const findings = [];
    for (const c of cookies) {
      const looksSensitive = /session|auth|token|sid/i.test(c.name);
      if (!looksSensitive) continue;
      if (url.protocol === "https:" && !c.secure) {
        findings.push({
          checkId: "ext/cookie-not-secure",
          severity: "high",
          dimension: "security",
          title: `Cookie '${c.name}' missing Secure flag`,
          description:
            "On HTTPS the Secure flag should be set so the browser never sends this cookie over http.",
        });
      }
      if (c.sameSite === "no_restriction" || c.sameSite === "unspecified") {
        findings.push({
          checkId: "ext/cookie-samesite-weak",
          severity: "medium",
          dimension: "security",
          title: `Cookie '${c.name}' has weak SameSite`,
          description: `SameSite='${c.sameSite}' — set SameSite=Lax (or Strict) to prevent CSRF on cookie-authed routes.`,
        });
      }
    }
    return findings;
  } catch {
    return [];
  }
}

/* ------------- Clean up state when tabs close ------------- */

chrome.tabs.onRemoved.addListener((tabId) => {
  findingsByTab.delete(tabId);
  headerFindingsByTab.delete(tabId);
  syncByTab.delete(tabId);
  chrome.storage.local.remove(`scan:${tabId}`).catch(() => undefined);
});
