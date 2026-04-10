import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
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
import { INJECTED_CSS, INJECTED_META } from "@/utils/injectedJS";
import { isPrecachePath, isTrustedUrl } from "@/utils/urlUtils";

const HOME_URL = "https://doogo.shop";

const COMBINED_INJECTED_JS = INJECTED_META + "\n" + INJECTED_CSS;

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isPrecache, setIsPrecache] = useState(true);

  const reload = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const handleRetry = useCallback(() => {
    reload();
  }, [reload]);

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

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    const currentIsPrecache = isPrecachePath(navState.url);
    setIsPrecache(currentIsPrecache);
    if (!navState.loading) {
      setIsLoading(false);
    }
  }, []);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string; navigationType?: string }) => {
      const { url } = request;
      if (url === "about:blank" || url.startsWith("blob:")) return true;

      if (!isTrustedUrl(url)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      return true;
    },
    []
  );

  const handleMessage = useCallback((_event: WebViewMessageEvent) => {
  }, []);

  const handleError = useCallback((_event: WebViewErrorEvent) => {
    setIsLoading(false);
  }, []);

  const handleHttpError = useCallback(() => {
    setIsLoading(false);
  }, []);

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
          userAgent={`Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 DoogoApp/1.0`}
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
