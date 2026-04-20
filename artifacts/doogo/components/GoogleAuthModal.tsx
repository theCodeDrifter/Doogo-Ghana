import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewNavigation } from "react-native-webview";

import { INJECTED_META } from "@/utils/injectedJS";
import { isTrustedUrl } from "@/utils/urlUtils";

interface GoogleAuthModalProps {
  visible: boolean;
  authUrl: string;
  /** Called as soon as Google redirects back to doogo.shop — session is now in the shared cookie store */
  onAuthComplete: (doogoUrl: string) => void;
  /** Called when the user manually closes the modal */
  onDismiss: () => void;
}

export function GoogleAuthModal({
  visible,
  authUrl,
  onAuthComplete,
  onDismiss,
}: GoogleAuthModalProps) {
  const insets = useSafeAreaInsets();
  const authWebViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const handled = useRef(false);

  const onModalShow = useCallback(() => {
    handled.current = false;
    setIsLoading(true);
    setHasError(false);
  }, []);

  const completeIfDoogo = useCallback(
    (url: string) => {
      if (handled.current) return false;
      if (!isTrustedUrl(url)) return false;
      handled.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Tiny tick so the cookie write has finished before we hand off
      setTimeout(() => onAuthComplete(url), 80);
      return true;
    },
    [onAuthComplete]
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (!navState.loading) setIsLoading(false);
      completeIfDoogo(navState.url);
    },
    [completeIfDoogo]
  );

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      if (request.url.startsWith("about:") || request.url.startsWith("blob:")) return true;
      // Google → OAuth → doogo.shop. Block the WebView from actually loading
      // the doogo URL — we want it to render in the MAIN WebView with the new session.
      if (isTrustedUrl(request.url)) {
        completeIfDoogo(request.url);
        return false;
      }
      return true;
    },
    [completeIfDoogo]
  );

  const handleLoadStart = useCallback(() => setIsLoading(true), []);
  const handleLoadEnd = useCallback(() => setIsLoading(false), []);
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);
  const handleHttpError = useCallback(() => setIsLoading(false), []);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={onModalShow}
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === "android" ? insets.top + 8 : 12 }]}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContent}>
            <View style={styles.secureRow}>
              <Feather name="lock" size={12} color="#5a7a72" />
              <Text style={styles.secureText}>Secure Sign In</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Sign in with Google
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={20} color="#0d1f1a" />
          </TouchableOpacity>
        </View>

        <View style={styles.webViewContainer}>
          {isLoading && !hasError && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#1a3a32" />
              <Text style={styles.loadingText}>Loading sign in…</Text>
            </View>
          )}

          {hasError ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color="#ef4444" />
              <Text style={styles.errorTitle}>Sign In Unavailable</Text>
              <Text style={styles.errorSubtitle}>
                Could not load the sign-in page. Please try again.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setHasError(false);
                  setIsLoading(true);
                  authWebViewRef.current?.reload();
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              ref={authWebViewRef}
              source={{ uri: authUrl }}
              style={styles.webView}
              onNavigationStateChange={handleNavigationStateChange}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              onError={handleError}
              onHttpError={handleHttpError}
              injectedJavaScript={INJECTED_META}
              injectedJavaScriptBeforeContentLoaded={INJECTED_META}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              cacheEnabled={false}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              scrollEnabled={true}
              showsHorizontalScrollIndicator={false}
              mixedContentMode="compatibility"
              allowsFullscreenVideo={false}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
              startInLoadingState={false}
              renderLoading={() => <View />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c8ece5",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#c8ece5", marginBottom: 12,
  },
  headerContent: { alignItems: "center", marginBottom: 2 },
  secureRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  secureText: { fontSize: 11, color: "#5a7a72", fontWeight: "500" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0d1f1a" },
  closeButton: {
    position: "absolute", right: 16, bottom: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#e6fffa",
    alignItems: "center", justifyContent: "center",
  },
  webViewContainer: { flex: 1 },
  webView: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#e6fffa",
    alignItems: "center", justifyContent: "center",
    gap: 12, zIndex: 10,
  },
  loadingText: { fontSize: 14, color: "#5a7a72", fontWeight: "500" },
  errorContainer: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, gap: 12, backgroundColor: "#e6fffa",
  },
  errorTitle: { fontSize: 20, fontWeight: "700", color: "#0d1f1a" },
  errorSubtitle: { fontSize: 14, color: "#5a7a72", textAlign: "center", lineHeight: 22 },
  retryButton: {
    marginTop: 8, backgroundColor: "#1a3a32",
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24,
  },
  retryText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
});
