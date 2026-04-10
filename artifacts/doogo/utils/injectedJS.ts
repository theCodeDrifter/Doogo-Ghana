export const INJECTED_CSS = `
(function() {
  var style = document.createElement('style');
  style.id = 'doogo-app-overrides';
  style.innerHTML = \`
    /* Show the mobile app header */
    .elementor-element-58ced7a {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    /* Hide the default desktop header */
    .elementor-element-8d79317 {
      display: none !important;
    }
    /* Hide the hero/banner section */
    .elementor-element-a6cfc58 {
      display: none !important;
    }
    /* Hide the breadcrumb section */
    .elementor-element-5abdb2 {
      display: none !important;
    }
    /* Hide the footer */
    .elementor-element-3271f048 {
      display: none !important;
    }
    /* Disable horizontal overflow */
    body, html {
      overflow-x: hidden !important;
      max-width: 100vw !important;
    }
    /* Disable user zoom */
    * {
      touch-action: pan-x pan-y !important;
    }
  \`;
  var existing = document.getElementById('doogo-app-overrides');
  if (existing) existing.remove();
  document.head.appendChild(style);

  // Re-apply on DOM changes (for dynamic content)
  var observer = new MutationObserver(function() {
    if (!document.getElementById('doogo-app-overrides')) {
      document.head.appendChild(style.cloneNode(true));
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Signal ready for caching
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_LOADED', url: window.location.href }));
})();
true;
`;

export const INJECTED_META = `
(function() {
  var meta = document.querySelector('meta[name=viewport]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
})();
true;
`;
