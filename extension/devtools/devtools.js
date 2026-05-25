/**
 * EDITH DevTools bootstrap.
 *
 * Runs when DevTools opens on a tab. Registers the "EDITH" panel that sits
 * next to Console / Network / Application. The panel itself lives in
 * devtools/panel.html.
 *
 * Per Chrome's DevTools API, panel paths are resolved relative to the
 * extension root — not relative to this file.
 */
chrome.devtools.panels.create(
  "EDITH",
  "icons/128.png",
  "devtools/panel.html",
  (panel) => {
    // Optional lifecycle hooks. We don't currently need any.
    panel.onShown.addListener(() => {
      /* panel became visible */
    });
    panel.onHidden.addListener(() => {
      /* panel hidden */
    });
  },
);
