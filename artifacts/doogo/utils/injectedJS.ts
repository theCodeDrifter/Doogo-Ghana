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

/**
 * Interceptor injected on every page load.
 * - Overrides window.open so Google popup-OAuth is caught before it opens
 * - Intercepts click events on any Google-auth-related anchor/button
 * Both paths post a GOOGLE_OAUTH message to React Native which then
 * handles the auth via the system browser (ASWebAuthenticationSession / Custom Tabs).
 */
export const INJECTED_GOOGLE_OAUTH_INTERCEPTOR = `
(function() {
  if (window.__doogoGoogleInterceptInstalled) return;
  window.__doogoGoogleInterceptInstalled = true;

  function postGoogleAuth(url) {
    if (!url) return;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'GOOGLE_OAUTH', url: url })
    );
  }

  // Override window.open to catch popup-style OAuth attempts
  var _originalOpen = window.open;
  window.open = function(url, target, features) {
    if (url && (
      url.indexOf('accounts.google.com') !== -1 ||
      url.indexOf('google.com/o/oauth2') !== -1
    )) {
      postGoogleAuth(url);
      return { closed: false, close: function() {} };
    }
    return _originalOpen ? _originalOpen.call(window, url, target, features) : null;
  };

  // Intercept clicks on Google-auth anchors/buttons (capture phase)
  document.addEventListener('click', function(e) {
    var el = e.target;
    // Walk up to find an anchor
    for (var i = 0; i < 5 && el; i++) {
      var href = el.getAttribute && el.getAttribute('href');
      var isGoogleLink = href && (
        href.indexOf('accounts.google.com') !== -1 ||
        href.indexOf('google.com/o/oauth2') !== -1 ||
        (href.indexOf('loginSocial=google') !== -1) ||
        (href.indexOf('provider=google') !== -1) ||
        (href.indexOf('google-login') !== -1)
      );
      if (isGoogleLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Resolve relative URLs
        var resolved = href.startsWith('http') ? href : window.location.origin + (href.startsWith('/') ? '' : '/') + href;
        postGoogleAuth(resolved);
        return;
      }
      el = el.parentElement;
    }
  }, true);

})();
true;
`;
