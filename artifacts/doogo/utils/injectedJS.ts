/**
 * Raw CSS string — used in two places:
 *  1. Injected directly into cached HTML <head> before saving to disk (zero flash, no JS needed)
 *  2. Referenced by INJECTED_BEFORE_CONTENT_JS for live page injection before first render
 */
export const CSS_OVERRIDES = `
  .elementor-element-58ced7a { display: block !important; visibility: visible !important; opacity: 1 !important; }
  .elementor-element-8d79317 { display: none !important; }
  .elementor-element-a6cfc58 { display: none !important; }
  .elementor-element-5abdb2 { display: none !important; }
  .elementor-element-3271f048 { display: none !important; }
  /* Hide the original mobile bottom panel — replaced by native iOS liquid glass tab bar */
  .et-mobile-panel-wrapper,
  .et-fixed-mobile-panel,
  #et-mobile-panel,
  .et_pb_mobile_menu,
  .et-mobile-bar { display: none !important; visibility: hidden !important; }
  /* Reserve space at the bottom so content isn't hidden under the native tab bar (~92pt + safe-area) */
  body { padding-bottom: 110px !important; }
  body, html { overflow-x: hidden !important; max-width: 100vw !important; }
  * { touch-action: pan-x pan-y !important; }
`;

/**
 * Runs via injectedJavaScriptBeforeContentLoaded — fires at document start,
 * BEFORE the browser renders any pixels. Injects CSS + viewport meta instantly.
 * This eliminates any flash of unstyled/un-overridden content on live pages.
 */
export const INJECTED_BEFORE_CONTENT_JS = `
(function() {
  var cssText = ${JSON.stringify(CSS_OVERRIDES)};

  var style = document.createElement('style');
  style.id = 'doogo-app-overrides';
  style.innerHTML = cssText;

  var meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  function injectNow() {
    if (!document.head) return false;
    if (!document.getElementById('doogo-app-overrides')) {
      document.head.insertBefore(style, document.head.firstChild);
    }
    if (!document.querySelector('meta[name=viewport]')) {
      document.head.insertBefore(meta, document.head.firstChild);
    }
    return true;
  }

  if (!injectNow()) {
    var headWatcher = new MutationObserver(function() {
      if (injectNow()) headWatcher.disconnect();
    });
    headWatcher.observe(document.documentElement, { childList: true });
  }

  // Persistent guard — re-injects if doogo.shop's JS removes the style
  var persistGuard = new MutationObserver(function() {
    if (document.head && !document.getElementById('doogo-app-overrides')) {
      document.head.insertBefore(style.cloneNode(true), document.head.firstChild);
    }
  });
  persistGuard.observe(document.documentElement, { childList: true, subtree: true });
})();
true;
`;

/**
 * Runs via injectedJavaScript (post-DOM-ready).
 * Intercepts Google OAuth button clicks and window.open popup calls,
 * posting a GOOGLE_OAUTH message to React Native.
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

  document.addEventListener('click', function(e) {
    var el = e.target;
    for (var i = 0; i < 5 && el; i++) {
      var href = el.getAttribute && el.getAttribute('href');
      var isGoogleLink = href && (
        href.indexOf('accounts.google.com') !== -1 ||
        href.indexOf('google.com/o/oauth2') !== -1 ||
        href.indexOf('loginSocial=google') !== -1 ||
        href.indexOf('provider=google') !== -1 ||
        href.indexOf('google-login') !== -1
      );
      if (isGoogleLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
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

/**
 * Builds a JS snippet that triggers the website's existing cart modal/popup.
 * The original Divi/Elementor mobile navbar's cart icon opens a modal rather
 * than navigating to /cart/. This tries the most common cart-toggle selectors
 * and falls back to navigating to the cart page if none are found.
 */
export const TRIGGER_CART_MODAL_JS = `
(function() {
  var selectors = [
    '.et-cart-info',
    '.et-cart-info-container a',
    '.et_pb_menu__cart-button',
    '.elementor-menu-cart__toggle',
    '.elementor-menu-cart__toggle a',
    '.menu-cart-toggle',
    '.cart-contents',
    'a.cart-customlocation',
    'a[href*="?wc-ajax=get_refreshed_fragments"]',
    'a[href$="/cart/"]'
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el) {
      try { el.click(); return; } catch (e) {}
    }
  }
  // Fallback — open the cart page directly
  window.location.href = 'https://doogo.shop/cart/';
})();
true;
`;

/**
 * Builds a JS snippet that navigates the WebView to a target URL while
 * preserving the native back-forward stack. Used by the liquid-glass tab bar.
 */
export function buildNavigateJS(url: string): string {
  return `window.location.href = ${JSON.stringify(url)}; true;`;
}

/** Legacy alias kept for any remaining imports */
export const INJECTED_META = INJECTED_BEFORE_CONTENT_JS;
export const INJECTED_CSS = INJECTED_GOOGLE_OAUTH_INTERCEPTOR;
