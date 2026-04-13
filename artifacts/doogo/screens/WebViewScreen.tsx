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
import {
  initPageCache,
  urlToCacheKey,
  cacheKeyToUrl,
} from "@/services/pageCache";
import {
  INJECTED_BEFORE_CONTENT_JS,
  INJECTED_GOOGLE_OAUTH_INTERCEPTOR,
} from "@/utils/injectedJS";
import { isPrecachePath, isTrustedUrl } from "@/utils/urlUtils";

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

// Source type for the WebView
type WVSource = { uri: string } | { html: string; baseUrl: string };

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();

  // ── Source state: switches between { uri } (live) and { html } (cached) ──
  const [webViewSource, setWebViewSource] = useState<WVSource>({ uri: HOME_URL });

  // In-memory cache map, populated from disk by initPageCache
  const cacheMap = useRef<Map<string, string>>(new Map());
  // Prevent switching to cached source more than once for initial load
  const initialSourceSet = useRef(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveLoad, setIsLiveLoad] = useState(false); // drives skeleton shimmer
  const [canGoBack, setCanGoBack] = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");

  // Guards
  const oauthInProgress = useRef(false);
  const paymentInProgress = useRef(false);

  // ─── Initialise cache on mount ────────────────────────────────────────────
  useEffect(() => {
    initPageCache((key, freshHtml) => {
      // Background refresh arrived — update in-memory map
      cacheMap.current.set(key, freshHtml);
    }).then((diskCache) => {
      cacheMap.current = diskCache;

      // If home page was cached on disk, serve it instantly instead of the live URI
      const homeHtml = diskCache.get("home");
      if (homeHtml && !initialSourceSet.current) {
        initialSourceSet.current = true;
        setWebViewSource({ html: homeHtml, baseUrl: "https://doogo.shop/" });
      }
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
        { dismissButtonStyle: "cancel", preferEphemeralSession: false, showInRecents: false, createTask: false }
      );
      if (result.type === "success") {
        const target =
          result.url?.startsWith("https://doogo.shop") ? result.url : MY_ACCOUNT_URL;
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
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const { url } = request;

      if (url === "about:blank" || url.startsWith("blob:") || url.startsWith("data:")) {
        return true;
      }

      // 1. Hubtel payment → payment sheet
      if (isPaymentUrl(url)) {
        openPaymentModal(url);
        return false;
      }

      // 2. Google OAuth → system auth browser
      if (isGoogleAuthUrl(url)) {
        startGoogleAuth(url);
        return false;
      }

      // 3. Critical page cached → serve from disk instantly
      const key = urlToCacheKey(url);
      if (key !== null && cacheMap.current.has(key)) {
        const html = cacheMap.current.get(key)!;
        const baseUrl = cacheKeyToUrl(key);
        setIsLiveLoad(false);
        setIsLoading(false);
        setIsInitialLoad(false);
        setWebViewSource({ html, baseUrl });
        return false; // block WebView navigation; source prop handles it
      }

      // 4. External URL → device browser
      if (!isTrustedUrl(url)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      // 5. Live doogo.shop page → allow, show skeleton + loading bar
      setIsLiveLoad(true);
      return true;
    },
    [openPaymentModal, startGoogleAuth]
  );

  // ─── WebView lifecycle ────────────────────────────────────────────────────
  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (!navState.loading) setIsLoading(false);
  }, []);

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
        if (data.type === "GOOGLE_OAUTH" && data.url) startGoogleAuth(data.url);
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Splash shown only on very first load before any content is ready */}
      {isInitialLoad && <SplashLoading />}

      <View style={[styles.webViewContainer, isInitialLoad && styles.hidden]}>
        {/* iOS-style loading bar — shown for every page load */}
        <LoadingBar loading={isLoading} />

        {/* Skeleton shimmer — only for live (non-cached) loads */}
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
          // CSS + viewport injected BEFORE any content renders — zero flash
          injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_CONTENT_JS}
          // OAuth interceptor runs post-DOM (needs click listeners)
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

      {/* Hubtel payment sheet */}
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
    backgroundColor: "#ffffff",
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  hidden: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
});
