# EDITH — Vibe Audit (Chrome / Edge / Brave extension)

A browser extension that scans whatever page you have open — including `localhost` — for the bugs that vibe-coded apps ship with.

## What it catches

| Severity | Check | Where |
|---|---|---|
| 🔴 Critical | Live Stripe / Razorpay / OpenAI / Anthropic / AWS / GitHub / Slack keys in the bundle | Page HTML + same-origin scripts |
| 🟠 High | `NEXT_PUBLIC_*SECRET*` or `*PRIVATE*` vars leaked to client | Bundle |
| 🟠 High | Session cookies readable from JS (HttpOnly off) | `document.cookie` |
| 🟠 High | Session cookies missing `Secure` flag on HTTPS | `chrome.cookies` |
| 🟠 High | `localStorage` holding what looks like a token / secret / JWT | Storage scan |
| 🟠 High | Form `action` posts to a different origin | DOM |
| 🟠 High | Content-Security-Policy header missing | Response headers |
| 🟡 Medium | CSP allows `unsafe-inline` / `unsafe-eval` | Response headers |
| 🟡 Medium | No clickjacking protection (`X-Frame-Options` or `frame-ancestors`) | Response headers |
| 🟡 Medium | HSTS missing on HTTPS | Response headers |
| 🟡 Medium | Mixed content (http resource on https page) | DOM |
| 🟡 Medium | Cookies with weak `SameSite` | `chrome.cookies` |
| 🟡 Medium | 3+ runtime errors during first 4 seconds | Console + window error events |
| ⚪ Low | `target="_blank"` links missing `rel="noopener"` | DOM |
| ⚪ Low | Source maps publicly reachable in production | HEAD request to `.map` |
| ⚪ Low | `X-Content-Type-Options: nosniff` missing | Response headers |

## How it works

- **Content script** (`content/main.js`) runs on every page at `document_idle`, walks the DOM and same-origin scripts, fires findings to the background.
- **Background service worker** (`background/worker.js`) inspects response headers via `chrome.webRequest`, fetches cookies via `chrome.cookies`, tracks per-tab findings, and updates the toolbar badge with the critical+high count.
- **Popup** (`popup/`) shows the current tab's findings, lets you re-run the scan, and optionally connects to your EDITH account.
- **DevTools panel** (`devtools/`) — open Chrome DevTools and switch to the **EDITH** tab to get a live, full-fidelity feed of every network request and every console message on the page, each annotated inline with EDITH findings. See below.
- All checks are **read-only**. The extension never mutates the page or fires requests on its own. (The active probe pack lives server-side at `/repos/[id]/probes`.)

## DevTools panel (live audit)

The popup is an at-a-glance summary. The DevTools panel is the deep-inspection surface:

| Source | What it shows |
|---|---|
| `chrome.devtools.network.onRequestFinished` | Every request the tab makes — method, status, size, time, headers, response body. EDITH annotates each row with findings (cookie flags, mixed content, slow / oversized, PII / secrets in body, 4xx/5xx). |
| `chrome.devtools.inspectedWindow.eval` | Patches `console.log/info/warn/error` and `window.onerror` + `unhandledrejection` in the inspected page, then drains the buffer ~400ms. PII fingerprinting runs against every captured line. |
| `chrome.runtime` bridge to background | Pulls the popup-side findings (DOM scan, header scan, cookie scan) so the panel can show a single unified score and finding list. |

To use it: open DevTools (`F12` / `Cmd+Opt+I`) → click the **EDITH** tab.

Three sub-tabs inside the panel:
- **Summary** — live score, stats (requests, console errors, findings), and deduped finding list with severity + check IDs.
- **Network** — every request as it happens, click a row for headers + response body + EDITH inline findings + a one-click "Copy fix prompt".
- **Console** — full log feed with PII detection on each line.

Capture starts the moment DevTools opens. The panel does **not** call back to the EDITH backend — analysis is fully local. The unified findings shown in the Summary tab include whatever the background worker has already synced through the popup pipeline.

## Loading the extension (Chrome / Edge / Brave)

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Toggle **Developer mode** in the top-right.
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin EDITH to the toolbar (puzzle-piece icon → pin).
5. Open any site (try your own `localhost:3000`). The icon shows a badge with the issue count; click for details.

## Connecting to your EDITH account (optional)

The extension works fully standalone. If you want findings to land in your EDITH dashboard:

1. In the EDITH dashboard, go to **Integrations → MCP** and create an API token.
2. Click **Connect to your EDITH account →** in the extension popup.
3. Paste the token + your EDITH base URL (`http://localhost:3000/api/mcp` for local dev).
4. Save.

## Built with intent

- No external dependencies. Three JS files. ~600 lines total.
- Manifest V3, minimum Chrome 111.
- Permissions are scoped: `cookies` only fires for the active tab's hostname; `webRequest` is read-only (`responseHeaders`).
- Findings live in `chrome.storage.local` only — never sent anywhere unless you explicitly connect a token.
