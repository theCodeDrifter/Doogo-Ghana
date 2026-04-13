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
} from "react-native-webview";

import { LoadingBar } from "@/components/LoadingBar";
import { OfflineScreen } from "@/components/OfflineScreen";
import { PaymentModal } from "@/components/PaymentModal";
import { SkeletonShimmer } from "@/components/SkeletonShimmer";
import { SplashLoading } from "@/components/SplashLoading";
import { useNetwork } from "@/hooks/useNetwork";
import { initPageCache } from "@/services/pageCache";
import {
  INJECTED_BEFORE_CONTENT_JS,
  INJECTED_GOOGLE_OAUTH_INTERCEPTOR,
} from "@/utils/injectedJS";
import { isTrustedUrl } from "@/utils/urlUtils";

const HOME_URL = "https://doogo.shop/";
const MY_ACCOUNT_URL = "https://doogo.shop/my-account/";

const GOOGLE_AUTH_DOMAINS = ["accounts.google.com", "google.com/o/oauth2"];
const PAYMENT_DOMAIN = "pay.hubtel.com";

function isGoogleAuthUrl(url: string) {
  return GOOGLE_AUTH_DOMAINS.some((d) => url.includes(d));
}
function isPaymentUrl(url: string) {
  return url.includes(PAYMENT_DOMAIN);
}

// Source is always a URI — keeps native navigation stack intact.
// The only exception is the very first load when we have a cached homepage.
type WVSource = { uri: string } | { html: string; baseUrl: string };

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();

  // Start with live URI; switch to cached HTML only on first mount if available
  const [webViewSource, setWebViewSource] = useState<WVSource>({ uri: HOME_URL });

  // Track if we already set the initial cached source so we don't set it again
  const initialSourceSet = useRef(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveLoad, setIsLiveLoad] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");

  const oauthInProgress = useRef(false);
  const paymentInProgress = useRef(false);

  // ─── Warm the page cache (AsyncStorage) ──────────────────────────────────
  // If home page HTML is already stored, serve it instantly as initial source.
  // All navigation after that goes through { uri } — never switches back to { html }.
  useEffect(() => {
    initPageCache((_key, _html) => {
      // Background refresh done — cache is updated for next session
    })
      .then((storedCache) => {
        const homeHtml = storedCache.get("home");
        if (homeHtml && !initialSourceSet.current) {
          initialSourceSet.current = true;
          setWebViewSource({ html: homeHtml, baseUrl: "https://doogo.shop/" });
        }
      })
      .catch(() => {
        // Cache unavailable — app loads normally from network
      });
  }, []);

  // ─── Android hardware back ────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (paymentModalVisible) {
        setPaymentModalVisible(false);
        paymentInProgress.current = false;
        return true;
      }
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, paymentModalVisible]);

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  const startGoogleAuth = useCallback(async (googleUrl: string) => {
    if (oauthInProgress.current) return;
    oauthInProgress.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await WebBrowser.openAuthSessionAsync(
        googleUrl,
        "https://doogo.shop",
        {
          dismissButtonStyle: "cancel",
          preferEphemeralSession: false,
          showInRecents: false,
          createTask: false,
        }
      );
      if (result.type === "success") {
        const target =
          result.url?.startsWith("https://doogo.shop")
            ? result.url
            : MY_ACCOUNT_URL;
        webViewRef.current?.injectJavaScript(
          `window.location.replace('${target.replace(/'/g, "\\'")}'); true;`
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
    } finally {
      oauthInProgress.current = false;
    }
  }, []);

  // ─── Hubtel payment ───────────────────────────────────────────────────────
  const openPaymentModal = useCallback((url: string) => {
    if (paymentInProgress.current) return;
    paymentInProgress.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaymentUrl(url);
    setPaymentModalVisible(true);
  }, []);

  const handlePaymentReturn = useCallback((doogoUrl: string) => {
    setPaymentModalVisible(false);
    paymentInProgress.current = false;
    setTimeout(() => {
      webViewRef.current?.injectJavaScript(
        `window.location.replace('${doogoUrl.replace(/'/g, "\\'")}'); true;`
      );
    }, 150);
  }, []);

  const handlePaymentDismiss = useCallback(() => {
    setPaymentModalVisible(false);
    paymentInProgress.current = false;
  }, []);

  // ─── Navigation gatekeeper ────────────────────────────────────────────────
  // IMPORTANT: we NEVER switch webViewSource to { html } here.
  // Doing so breaks WooCommerce JS navigation and the native back stack.
  // The initial { html } source (home page cache) is handled by the useEffect above.
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const { url } = request;

      // Always allow blank / blob / data URLs (WebView internals)
      if (
        url === "about:blank" ||
        url.startsWith("blob:") ||
        url.startsWith("data:")
      ) {
        return true;
      }

      // Hubtel payment → open in secure payment sheet, block WebView nav
      if (isPaymentUrl(url)) {
        openPaymentModal(url);
        return false;
      }

      // Google OAuth → open system auth browser, block WebView nav
      if (isGoogleAuthUrl(url)) {
        startGoogleAuth(url);
        return false;
      }

      // External (non-doogo) links → open in device browser
      if (!isTrustedUrl(url)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      // Trusted doogo.shop URL → let WebView navigate natively (back stack preserved)
      setIsLiveLoad(true);
      return true;
    },
    [openPaymentModal, startGoogleAuth]
  );

  // ─── WebView lifecycle ────────────────────────────────────────────────────
  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
    },
    []
  );

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    setIsLiveLoad(false);
    setIsInitialLoad(false);
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "GOOGLE_OAUTH" && data.url)
          startGoogleAuth(data.url);
      } catch {}
    },
    [startGoogleAuth]
  );

  const handleError = useCallback((_event: unknown) => {
    setIsLoading(false);
    setIsLiveLoad(false);
    setIsInitialLoad(false);
  }, []);

  const handleHttpError = useCallback(() => {
    setIsLoading(false);
    setIsLiveLoad(false);
  }, []);

  // ─── Offline ──────────────────────────────────────────────────────────────
  if (!isConnected) {
    return <OfflineScreen onRetry={() => webViewRef.current?.reload()} />;
  }

  const showSkeleton = isLiveLoad && isLoading;

  return (
    <View style={styles.container}>
      {/* WebView always rendered at full size with status bar padding */}
      <View style={[styles.webViewContainer, { paddingTop: insets.top }]}>
        <LoadingBar loading={isLoading} />

        {showSkeleton && (
          <View style={StyleSheet.absoluteFill}>
            <SkeletonShimmer />
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={webViewSource}
          style={styles.webView}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={handleHttpError}
          // CSS + viewport injected before any pixel renders (zero flash)
          injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_CONTENT_JS}
          // Google OAuth interceptor — post DOM (needs click listeners)
          injectedJavaScript={INJECTED_GOOGLE_OAUTH_INTERCEPTOR}
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
          mixedContentMode="compatibility"
          setSupportMultipleWindows={false}
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          startInLoadingState={false}
          renderLoading={() => <View />}
        />
      </View>

      {/*
       * Splash covers the ENTIRE screen (absoluteFill) until WebView fires onLoadEnd.
       * pointerEvents="none" so it never blocks touches if it lingers.
       */}
      {isInitialLoad && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SplashLoading />
        </View>
      )}

      <PaymentModal
        visible={paymentModalVisible}
        paymentUrl={paymentUrl}
        onReturnToShop={handlePaymentReturn}
        onDismiss={handlePaymentDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Mint matches splash — no white gap ever shows through the absoluteFill overlay
    backgroundColor: "#d5f7f0",
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
