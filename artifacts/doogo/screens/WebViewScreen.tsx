import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, {
  WebViewMessageEvent,
  WebViewNavigation,
  WebViewErrorEvent,
} from "react-native-webview";

import { OfflineScreen } from "@/components/OfflineScreen";
import { SkeletonShimmer } from "@/components/SkeletonShimmer";
import { SplashLoading } from "@/components/SplashLoading";
import { useNetwork } from "@/hooks/useNetwork";
import {
  INJECTED_CSS,
  INJECTED_GOOGLE_OAUTH_INTERCEPTOR,
  INJECTED_META,
} from "@/utils/injectedJS";
import { isPrecachePath, isTrustedUrl } from "@/utils/urlUtils";

const HOME_URL = "https://doogo.shop";
const MY_ACCOUNT_URL = "https://doogo.shop/my-account/";
const GOOGLE_AUTH_DOMAINS = ["accounts.google.com", "google.com/o/oauth2"];

/** Returns true if a URL is a Google OAuth URL that must leave the WebView */
function isGoogleAuthUrl(url: string): boolean {
  return GOOGLE_AUTH_DOMAINS.some((d) => url.includes(d));
}

const COMBINED_INJECTED_JS =
  INJECTED_META + "\n" + INJECTED_CSS + "\n" + INJECTED_GOOGLE_OAUTH_INTERCEPTOR;

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isPrecache, setIsPrecache] = useState(true);

  // Track ongoing OAuth to avoid duplicate sessions
  const oauthInProgress = useRef(false);

  const reload = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const handleRetry = useCallback(() => {
    reload();
  }, [reload]);

  // ─── Android hardware back ────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [canGoBack]);

  // ─── Google OAuth via system browser ─────────────────────────────────────
  const startGoogleAuth = useCallback(async (googleUrl: string) => {
    if (oauthInProgress.current) return;
    oauthInProgress.current = true;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      /**
       * openAuthSessionAsync:
       *  - iOS  → ASWebAuthenticationSession (shares Safari cookies → WKWebView via sharedCookiesEnabled)
       *  - Android → Chrome Custom Tab (shares WebView cookie store)
       * redirectUrl prefix: as soon as auth redirects back to doogo.shop the session closes instantly.
       */
      const result = await WebBrowser.openAuthSessionAsync(
        googleUrl,
        "https://doogo.shop",
        {
          // Close the browser the moment doogo.shop redirect is detected
          dismissButtonStyle: "cancel",
          // Keep the persistent Safari/Chrome session so cookies carry over
          preferEphemeralSession: false,
          showInRecents: false,
          createTask: false,
        }
      );

      if (result.type === "success") {
        /**
         * The session completed and returned a doogo.shop URL (the OAuth callback).
         * Due to sharedCookiesEnabled (iOS) / shared cookie store (Android), the
         * session cookie is already available to the WebView.
         * Navigate directly to /my-account so the WebView reloads fresh.
         */
        const targetUrl =
          result.url && result.url.startsWith("https://doogo.shop")
            ? result.url
            : MY_ACCOUNT_URL;

        webViewRef.current?.injectJavaScript(
          `window.location.replace('${targetUrl.replace(/'/g, "\\'")}'); true;`
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // For 'cancel' or 'dismiss' we do nothing — user closed the sheet intentionally
    } catch {
      // Silent fail — OAuth window closed or network error
    } finally {
      oauthInProgress.current = false;
    }
  }, []);

  // ─── WebView event handlers ───────────────────────────────────────────────
  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
      setIsPrecache(isPrecachePath(navState.url));
      if (!navState.loading) setIsLoading(false);
    },
    []
  );

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    if (isInitialLoad) setIsInitialLoad(false);
  }, [isInitialLoad]);

  /**
   * Navigation gatekeeper:
   *  1. Google OAuth URLs → intercept, open system browser, block WebView
   *  2. Trusted doogo.shop URLs → allow
   *  3. Everything else → open in device browser, block WebView
   */
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType?: string }) => {
      const { url } = request;

      if (url === "about:blank" || url.startsWith("blob:")) return true;

      // Intercept Google OAuth navigation (fired by server-side redirect)
      if (isGoogleAuthUrl(url)) {
        startGoogleAuth(url);
        return false;
      }

      if (!isTrustedUrl(url)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      return true;
    },
    [startGoogleAuth]
  );

  /**
   * Messages from injected JS:
   *  - GOOGLE_OAUTH : Google auth URL intercepted by the JS click listener (popup path)
   *  - PAGE_LOADED  : page signals it's ready (used for future caching hooks)
   */
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "GOOGLE_OAUTH" && data.url) {
          startGoogleAuth(data.url);
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [startGoogleAuth]
  );

  const handleError = useCallback((_event: WebViewErrorEvent) => {
    setIsLoading(false);
  }, []);

  const handleHttpError = useCallback(() => {
    setIsLoading(false);
  }, []);

  // ─── Offline guard ────────────────────────────────────────────────────────
  if (!isConnected) {
    return <OfflineScreen onRetry={handleRetry} />;
  }

  const showSkeleton = !isInitialLoad && isLoading && !isPrecache;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isInitialLoad && <SplashLoading />}

      <View style={[styles.webViewContainer, isInitialLoad && styles.hidden]}>
        {showSkeleton && (
          <View style={StyleSheet.absoluteFill}>
            <SkeletonShimmer />
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: HOME_URL }}
          style={styles.webView}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={handleHttpError}
          injectedJavaScript={COMBINED_INJECTED_JS}
          injectedJavaScriptBeforeContentLoaded={INJECTED_META}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          cacheEnabled={true}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          pullToRefreshEnabled={true}
          scrollEnabled={true}
          bounces={Platform.OS === "ios"}
          showsHorizontalScrollIndicator={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          allowsFullscreenVideo={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="compatibility"
          setSupportMultipleWindows={false}
          // Standard mobile user agent — avoids Google's WebView block
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          startInLoadingState={false}
          renderLoading={() => <View />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d5f7f0",
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  hidden: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
});
