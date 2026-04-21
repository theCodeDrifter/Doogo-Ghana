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
  /* Off-canvas panels must float above everything (tab bar is hidden natively when open) */
  .etheme-elementor-off-canvas__main,
  .etheme-elementor-off-canvas,
  .etheme-elementor-off-canvas__overlay { z-index: 2147483646 !important; }
  /* Reserve space at the bottom so content isn't hidden under the native tab bar (~92pt + safe-area) */
  body { padding-bottom: 110px !important; background-color: #f3f8f7 !important; }
  html { background-color: #f3f8f7 !important; }
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
 * Triggers the cart icon in the site's header (top-right area).
 * Mirrors what the original website's navbar cart button does —
 * opens the cart modal/popup without navigating away.
 */
export const TRIGGER_CART_HEADER_JS = `
(function() {
  // Exact off-canvas toggle button for the cart widget
  var btn = document.querySelector('.elementor-widget-theme-etheme_cart .etheme-elementor-off-canvas__toggle_button');
  if (btn) { btn.click(); return; }
  // Fallback: the toggle wrapper div
  var wrapper = document.querySelector('.elementor-widget-theme-etheme_cart .etheme-elementor-off-canvas__toggle');
  if (wrapper) { wrapper.click(); return; }
})();
true;
`;

/**
 * Triggers the wishlist/favorites icon in the site's header (top-right area).
 * Opens the wishlist panel/page without full navigation where possible.
 */
export const TRIGGER_WISHLIST_HEADER_JS = `
(function() {
  // Exact off-canvas toggle button for the wishlist widget
  var btn = document.querySelector('.elementor-widget-theme-etheme_wishlist .etheme-elementor-off-canvas__toggle_button');
  if (btn) { btn.click(); return; }
  // Fallback: the toggle wrapper div
  var wrapper = document.querySelector('.elementor-widget-theme-etheme_wishlist .etheme-elementor-off-canvas__toggle');
  if (wrapper) { wrapper.click(); return; }
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

/**
 * Watches every `.etheme-elementor-off-canvas__main` panel and reports its
 * open/closed state to React Native via OFFCANVAS messages, so the native
 * tab bar can be hidden while a panel is open (giving the panel an
 * unobstructed full-screen overlay).
 */
export const INJECTED_OFFCANVAS_WATCHER = `
(function() {
  if (window.__doogoOffCanvasWatcherInstalled) return;
  window.__doogoOffCanvasWatcherInstalled = true;

  function isPanelOpen(el) {
    if (!el) return false;
    // Class-based open markers (Etheme variants)
    var cls = el.className || '';
    if (typeof cls === 'string' && (
      cls.indexOf('--opened') !== -1 ||
      cls.indexOf('is-open') !== -1 ||
      cls.indexOf('opened') !== -1 ||
      cls.indexOf('active') !== -1
    )) return true;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'false') return true;
    // Computed-style fallback — visible & not transformed off-screen
    try {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '0') < 0.05) {
        return false;
      }
      var t = cs.transform || '';
      if (t.indexOf('matrix') !== -1) {
        var m = t.match(/-?\\d+\\.?\\d*/g);
        if (m) {
          var tx = parseFloat(m[4] || '0');
          var ty = parseFloat(m[5] || '0');
          if (Math.abs(tx) > 50 || Math.abs(ty) > 50) return false;
        }
      }
      return cs.visibility === 'visible';
    } catch (e) { return false; }
  }

  function anyOpen() {
    var nodes = document.querySelectorAll('.etheme-elementor-off-canvas__main, .etheme-elementor-off-canvas');
    for (var i = 0; i < nodes.length; i++) {
      if (isPanelOpen(nodes[i])) return true;
    }
    // Body class fallback (Etheme typically locks scroll via body class)
    if (document.body && document.body.className && (
      document.body.className.indexOf('etheme-off-canvas-opened') !== -1 ||
      document.body.className.indexOf('off-canvas-opened') !== -1 ||
      document.body.className.indexOf('etheme-elementor-off-canvas-opened') !== -1
    )) return true;
    return false;
  }

  var lastState = false;
  function check() {
    var open = anyOpen();
    if (open !== lastState) {
      lastState = open;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'OFFCANVAS', open: open })
      );
    }
  }

  var mo = new MutationObserver(check);
  mo.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    childList: true,
    attributeFilter: ['class', 'style', 'aria-hidden']
  });
  // Safety net for edge cases (animations, late JS)
  setInterval(check, 400);
  check();
})();
true;
`;

/** Legacy alias kept for any remaining imports */
export const INJECTED_META = INJECTED_BEFORE_CONTENT_JS;
export const INJECTED_CSS = INJECTED_GOOGLE_OAUTH_INTERCEPTOR;
