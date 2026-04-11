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
import { PaymentModal } from "@/components/PaymentModal";
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

// Google OAuth — intercepted, opened via ASWebAuthenticationSession / Custom Tab
const GOOGLE_AUTH_DOMAINS = ["accounts.google.com", "google.com/o/oauth2"];

// Hubtel payment gateway — intercepted, opened in inline payment sheet
const PAYMENT_DOMAIN = "pay.hubtel.com";

function isGoogleAuthUrl(url: string): boolean {
  return GOOGLE_AUTH_DOMAINS.some((d) => url.includes(d));
}

function isPaymentUrl(url: string): boolean {
  return url.includes(PAYMENT_DOMAIN);
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

  // ── Payment modal state ────────────────────────────────────────────────────
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");

  // Guards against duplicate sessions
  const oauthInProgress = useRef(false);
  const paymentInProgress = useRef(false);

  const reload = useCallback(() => webViewRef.current?.reload(), []);
  const handleRetry = useCallback(() => reload(), [reload]);

  // ─── Android hardware back ────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      // If payment modal is open, close it
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
    return () => backHandler.remove();
  }, [canGoBack, paymentModalVisible]);

  // ─── Google OAuth via system browser ─────────────────────────────────────
  const startGoogleAuth = useCallback(async (googleUrl: string) => {
    if (oauthInProgress.current) return;
    oauthInProgress.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await WebBrowser.openAuthSessionAsync(
        googleUrl,
        "https://doogo.shop",
        { dismissButtonStyle: "cancel", preferEphemeralSession: false, showInRecents: false, createTask: false }
      );
      if (result.type === "success") {
        const targetUrl =
          result.url && result.url.startsWith("https://doogo.shop")
            ? result.url
            : MY_ACCOUNT_URL;
        webViewRef.current?.injectJavaScript(
          `window.location.replace('${targetUrl.replace(/'/g, "\\'")}'); true;`
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Silent
    } finally {
      oauthInProgress.current = false;
    }
  }, []);

  // ─── Hubtel payment sheet ─────────────────────────────────────────────────
  const openPaymentModal = useCallback((url: string) => {
    if (paymentInProgress.current) return;
    paymentInProgress.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaymentUrl(url);
    setPaymentModalVisible(true);
  }, []);

  /**
   * Called by PaymentModal when Hubtel redirects back to doogo.shop.
   * 1. Close the modal instantly
   * 2. Navigate the main WebView to the returned doogo.shop URL
   */
  const handlePaymentReturn = useCallback((doogoUrl: string) => {
    setPaymentModalVisible(false);
    paymentInProgress.current = false;
    // Small delay ensures modal animation starts closing before WebView navigates
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

  // ─── Main WebView event handlers ──────────────────────────────────────────
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setIsPrecache(isPrecachePath(navState.url));
    if (!navState.loading) setIsLoading(false);
  }, []);

  const handleLoadStart = useCallback(() => setIsLoading(true), []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    if (isInitialLoad) setIsInitialLoad(false);
  }, [isInitialLoad]);

  /**
   * Navigation gatekeeper (fires for every URL the main WebView would load):
   *  1. Hubtel payment URLs  → intercept → open inline payment sheet
   *  2. Google OAuth URLs    → intercept → open system auth browser
   *  3. Trusted doogo.shop   → allow
   *  4. Everything else      → open in device browser
   */
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const { url } = request;

      if (url === "about:blank" || url.startsWith("blob:")) return true;

      // ── Hubtel payment redirect ──────────────────────────────────────────
      if (isPaymentUrl(url)) {
        openPaymentModal(url);
        return false;
      }

      // ── Google OAuth redirect ────────────────────────────────────────────
      if (isGoogleAuthUrl(url)) {
        startGoogleAuth(url);
        return false;
      }

      // ── Trusted domain ───────────────────────────────────────────────────
      if (!isTrustedUrl(url)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      return true;
    },
    [openPaymentModal, startGoogleAuth]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "GOOGLE_OAUTH" && data.url) startGoogleAuth(data.url);
      } catch {
        // Ignore non-JSON messages
      }
    },
    [startGoogleAuth]
  );

  const handleError = useCallback((_event: WebViewErrorEvent) => setIsLoading(false), []);
  const handleHttpError = useCallback(() => setIsLoading(false), []);

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
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          startInLoadingState={false}
          renderLoading={() => <View />}
        />
      </View>

      {/* ── Hubtel payment sheet ─────────────────────────────────────────── */}
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
