/**
 * EDITH SEO probe — runs in the page context alongside content/main.js.
 *
 * Captures three classes of signals that are *only* observable at runtime:
 *   1. Core Web Vitals via PerformanceObserver (LCP, CLS, INP)
 *   2. DOM snapshot of the rendered head (title, canonical, lang, headings)
 *   3. Console errors during page load (hydration mismatches, broken hooks)
 *
 * Posts to /api/probe/seo via the background worker. Read-only; never
 * mutates the page or fires requests on its behalf.
 */

(function () {
  if (window.__edithSeoRan) return;
  window.__edithSeoRan = true;

  /* ============ Core Web Vitals ============ */
  const cwv = { lcp: null, cls: 0, inp: null, lcpElement: null };

  // Per-element CLS aggregation. selector -> { shift, count, tag }
  const clsBySelector = new Map();
  // Long tasks (>50ms blocking the main thread) — top contributor to INP
  const longTasks = [];

  /** Build a stable-ish CSS selector for a node (id > class chain > tag). */
  function selectorOf(node) {
    if (!node || node.nodeType !== 1) return "(unknown)";
    if (node.id) return `#${node.id}`;
    const cls = (node.className && typeof node.className === "string"
      ? node.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".")
      : "");
    const tag = node.tagName.toLowerCase();
    return cls ? `${tag}.${cls}` : tag;
  }

  // LCP — largest-contentful-paint
  try {
    const lcpObs = new PerformanceObserver((entries) => {
      const last = entries.getEntries().at(-1);
      if (!last) return;
      cwv.lcp = Math.round(last.startTime);
      const el = last.element;
      if (el && el.outerHTML) {
        cwv.lcpElement = el.outerHTML.slice(0, 500);
      }
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* no-op */
  }

  // CLS — layout-shift (sum unexpected shifts + per-source attribution)
  try {
    const clsObs = new PerformanceObserver((entries) => {
      for (const e of entries.getEntries()) {
        if (e.hadRecentInput) continue;
        cwv.cls += e.value;
        // Modern Chrome populates entry.sources[] with shifted nodes.
        const sources = e.sources || [];
        for (const s of sources) {
          const node = s.node;
          if (!node) continue;
          const sel = selectorOf(node);
          const prev = clsBySelector.get(sel) || {
            shift: 0,
            count: 0,
            tag: node.tagName ? node.tagName.toLowerCase() : "?",
          };
          prev.shift += e.value;
          prev.count += 1;
          clsBySelector.set(sel, prev);
        }
      }
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
  } catch {
    /* no-op */
  }

  // INP — event timing, max interaction
  try {
    const evObs = new PerformanceObserver((entries) => {
      for (const e of entries.getEntries()) {
        const dur = Math.round(e.duration ?? 0);
        if (dur > (cwv.inp ?? 0)) cwv.inp = dur;
      }
    });
    evObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {
    /* no-op */
  }

  // Long tasks — anything >50ms blocking main thread
  try {
    const ltObs = new PerformanceObserver((entries) => {
      for (const e of entries.getEntries()) {
        const attrs = e.attribution || [];
        const a0 = attrs[0] || {};
        longTasks.push({
          startTime: Math.round(e.startTime),
          duration: Math.round(e.duration),
          containerType: a0.containerType || null,
          containerName: a0.containerName || null,
          containerSrc: a0.containerSrc || null,
        });
        if (longTasks.length > 40) longTasks.shift();
      }
    });
    ltObs.observe({ type: "longtask", buffered: true });
  } catch {
    /* no-op — longtask not supported in some Safari builds */
  }

  /* ============ Console error capture ============ */
  const consoleErrors = [];
  const origErr = console.error;
  console.error = function (...args) {
    try {
      const msg = args
        .map((a) => (typeof a === "string" ? a : safeStringify(a)))
        .join(" ")
        .slice(0, 400);
      consoleErrors.push({ msg, t: Date.now() });
    } catch {
      /* ignore */
    }
    return origErr.apply(this, args);
  };
  function safeStringify(v) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  window.addEventListener("error", (e) => {
    consoleErrors.push({
      msg: (e.message || "uncaught error").slice(0, 400),
      source: e.filename,
      line: e.lineno,
      t: Date.now(),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    consoleErrors.push({
      msg: `unhandled promise: ${String(e.reason).slice(0, 380)}`,
      t: Date.now(),
    });
  });

  /* ============ DOM snapshot ============ */
  function domSnapshot() {
    const get = (sel, attr) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return attr ? el.getAttribute(attr) : el.textContent;
    };
    const getAll = (sel) => Array.from(document.querySelectorAll(sel));

    const headings = ["h1", "h2", "h3"].flatMap((tag) =>
      getAll(tag).map((el) => ({
        tag,
        text: (el.textContent || "").trim().slice(0, 120),
      })),
    );

    const jsonLdTypes = [];
    for (const s of getAll('script[type="application/ld+json"]')) {
      try {
        const j = JSON.parse(s.textContent || "{}");
        const walk = (o) => {
          if (Array.isArray(o)) o.forEach(walk);
          else if (o && typeof o === "object") {
            const t = o["@type"];
            if (typeof t === "string") jsonLdTypes.push(t);
            else if (Array.isArray(t))
              t.forEach((x) => typeof x === "string" && jsonLdTypes.push(x));
          }
        };
        walk(j);
      } catch {
        jsonLdTypes.push("__invalid__");
      }
    }

    const imagesNoAlt = getAll("img").filter(
      (img) => !img.hasAttribute("alt"),
    ).length;
    const imagesNoDims = getAll("img").filter(
      (img) =>
        !img.hasAttribute("width") &&
        !img.hasAttribute("height") &&
        getComputedStyle(img).aspectRatio === "auto",
    ).length;

    return {
      title: document.title || null,
      description: get('meta[name="description"]', "content"),
      canonical: get('link[rel="canonical"]', "href"),
      lang: document.documentElement.getAttribute("lang"),
      metaRobots: get('meta[name="robots"]', "content"),
      ogTitle: get('meta[property="og:title"]', "content"),
      ogDescription: get('meta[property="og:description"]', "content"),
      ogImage: get('meta[property="og:image"]', "content"),
      twitterCard: get('meta[name="twitter:card"]', "content"),
      hreflangs: getAll('link[rel="alternate"][hreflang]').map((el) => ({
        hreflang: el.getAttribute("hreflang"),
        href: el.getAttribute("href"),
      })),
      h1Count: getAll("h1").length,
      headings: headings.slice(0, 50),
      jsonLdTypes,
      imagesNoAlt,
      imagesNoDims,
      hasMain: !!document.querySelector("main"),
      wordCount: (document.body?.textContent || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
    };
  }

  /* ============ Resource timing audit ============ */
  function resourceAudit() {
    let entries = [];
    try {
      entries = performance.getEntriesByType("resource");
    } catch {
      return null;
    }
    if (!entries.length) return null;

    const here = location.origin;
    const byDomain = new Map(); // host -> { count, bytes, totalDuration }
    const failed = [];
    const renderBlocking = [];
    const enriched = entries.map((e) => {
      let host = here;
      try {
        host = new URL(e.name).host;
      } catch {
        /* relative */
      }
      const transfer = e.transferSize ?? 0;
      const decoded = e.decodedBodySize ?? 0;
      const ttl = byDomain.get(host) || {
        count: 0,
        bytes: 0,
        totalDuration: 0,
      };
      ttl.count += 1;
      ttl.bytes += transfer;
      ttl.totalDuration += e.duration;
      byDomain.set(host, ttl);

      // Empty 2xx response often == blocked or CORS. Skip 0-byte zero-duration
      // (preload-only) entries.
      if (transfer === 0 && decoded === 0 && e.duration > 100) {
        failed.push({
          url: e.name.slice(0, 200),
          duration: Math.round(e.duration),
          initiatorType: e.initiatorType,
        });
      }
      // renderBlockingStatus is a newer attribute; only Chrome sets it.
      const blocking =
        e.renderBlockingStatus === "blocking" ||
        ((e.initiatorType === "script" || e.initiatorType === "css" ||
          e.initiatorType === "link") &&
          e.startTime < 1000 &&
          e.duration > 100);
      if (blocking) {
        renderBlocking.push({
          url: e.name.slice(0, 200),
          initiatorType: e.initiatorType,
          duration: Math.round(e.duration),
          transfer,
          startTime: Math.round(e.startTime),
        });
      }
      return {
        url: e.name,
        host,
        initiatorType: e.initiatorType,
        transferSize: transfer,
        decodedBodySize: decoded,
        duration: Math.round(e.duration),
        startTime: Math.round(e.startTime),
        renderBlockingStatus: e.renderBlockingStatus ?? null,
      };
    });

    // Largest 10 by transferSize
    const top = [...enriched]
      .sort((a, b) => b.transferSize - a.transferSize)
      .slice(0, 10)
      .map((r) => ({
        url: r.url.slice(0, 220),
        host: r.host,
        initiatorType: r.initiatorType,
        transferSize: r.transferSize,
        duration: r.duration,
      }));

    // Per-domain summary (top 8 by bytes), useful for "third-party drag"
    const thirdParty = Array.from(byDomain.entries())
      .filter(([host]) => host !== here)
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .slice(0, 8)
      .map(([host, v]) => ({
        host,
        count: v.count,
        bytes: v.bytes,
        avgMs: Math.round(v.totalDuration / Math.max(v.count, 1)),
      }));

    const total = enriched.reduce(
      (s, r) => s + (r.transferSize || 0),
      0,
    );
    const totalThirdParty = thirdParty.reduce((s, d) => s + d.bytes, 0);

    return {
      totalResources: enriched.length,
      totalTransferBytes: total,
      totalThirdPartyBytes: totalThirdParty,
      thirdParty,
      top10ByBytes: top,
      renderBlocking: renderBlocking.slice(0, 10),
      failed: failed.slice(0, 10),
    };
  }

  /* ============ CLS source rollup ============ */
  function clsSourcesSummary() {
    if (clsBySelector.size === 0) return [];
    return Array.from(clsBySelector.entries())
      .map(([selector, v]) => ({
        selector,
        tag: v.tag,
        shift: Math.round(v.shift * 10000) / 10000,
        count: v.count,
      }))
      .sort((a, b) => b.shift - a.shift)
      .slice(0, 10);
  }

  /* ============ Long-task rollup ============ */
  function longTasksSummary() {
    if (longTasks.length === 0) return null;
    const total = longTasks.reduce((s, t) => s + t.duration, 0);
    const topByDuration = [...longTasks]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 8);
    // Aggregate by containerSrc (which script blocked the most)
    const byScript = new Map();
    for (const t of longTasks) {
      const key = t.containerSrc || `(${t.containerType || "inline"})`;
      const prev = byScript.get(key) || { duration: 0, count: 0 };
      prev.duration += t.duration;
      prev.count += 1;
      byScript.set(key, prev);
    }
    const offenders = Array.from(byScript.entries())
      .map(([src, v]) => ({ src: src.slice(0, 200), ...v }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    return {
      count: longTasks.length,
      totalBlockingMs: total,
      worst: topByDuration,
      offenders,
    };
  }

  /* ============ Flush ============ */
  function flush() {
    const payload = {
      type: "edith:seo-probe",
      url: location.href,
      origin: location.origin,
      capturedAt: Date.now(),
      cwv: { ...cwv, cls: Math.round(cwv.cls * 10000) / 10000 },
      clsSources: clsSourcesSummary(),
      longTasks: longTasksSummary(),
      resources: resourceAudit(),
      dom: domSnapshot(),
      consoleErrors: consoleErrors.slice(-50),
    };
    try {
      chrome.runtime.sendMessage(payload, () => undefined);
    } catch {
      /* extension context invalidated */
    }
  }

  // Flush at 4s (catches initial paint + first interactions) and at unload.
  setTimeout(flush, 4_000);
  window.addEventListener("beforeunload", flush);
  window.addEventListener("pagehide", flush);
})();
