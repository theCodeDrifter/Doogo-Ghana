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

interface PaymentModalProps {
  visible: boolean;
  paymentUrl: string;
  /** Called when payment is complete/canceled and Hubtel redirects back to doogo.shop */
  onReturnToShop: (doogoUrl: string) => void;
  /** Called when the user manually closes the modal */
  onDismiss: () => void;
}

export function PaymentModal({
  visible,
  paymentUrl,
  onReturnToShop,
  onDismiss,
}: PaymentModalProps) {
  const insets = useSafeAreaInsets();
  const paymentWebViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const handled = useRef(false);

  // Reset state whenever the modal opens with a new URL
  const onModalShow = useCallback(() => {
    handled.current = false;
    setIsLoading(true);
    setHasError(false);
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (!navState.loading) setIsLoading(false);

      // As soon as Hubtel redirects back to doogo.shop, close the modal
      // and hand the destination URL to the main WebView
      if (isTrustedUrl(navState.url) && !handled.current) {
        handled.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Small tick to allow the state to settle before closing
        setTimeout(() => onReturnToShop(navState.url), 80);
      }
    },
    [onReturnToShop]
  );

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback((_event: unknown) => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleHttpError = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      // Allow Hubtel and any of its sub-domains / redirects
      if (request.url.startsWith("about:") || request.url.startsWith("blob:")) return true;

      // If it's a doogo.shop URL, let the navigation state handler detect it
      // and close the modal — but block WebView from actually loading it
      if (isTrustedUrl(request.url)) {
        if (!handled.current) {
          handled.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => onReturnToShop(request.url), 80);
        }
        return false;
      }

      return true;
    },
    [onReturnToShop]
  );

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
        {/* ── Header bar ── */}
        <View style={[styles.header, { paddingTop: Platform.OS === "android" ? insets.top + 8 : 12 }]}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContent}>
            <View style={styles.secureRow}>
              <Feather name="lock" size={12} color="#5a7a72" />
              <Text style={styles.secureText}>Secure Payment</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Hubtel Checkout
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

        {/* ── Payment WebView ── */}
        <View style={styles.webViewContainer}>
          {isLoading && !hasError && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#1a3a32" />
              <Text style={styles.loadingText}>Loading payment…</Text>
            </View>
          )}

          {hasError ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color="#ef4444" />
              <Text style={styles.errorTitle}>Payment Unavailable</Text>
              <Text style={styles.errorSubtitle}>
                Could not load the payment page. Please try again.
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setHasError(false);
                  setIsLoading(true);
                  paymentWebViewRef.current?.reload();
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              ref={paymentWebViewRef}
              source={{ uri: paymentUrl }}
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
  container: {
    flex: 1,
    backgroundColor: "#f3f8f7",
  },
  header: {
    backgroundColor: "#f3f8f7",
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
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#c8ece5",
    marginBottom: 12,
  },
  headerContent: {
    alignItems: "center",
    marginBottom: 2,
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  secureText: {
    fontSize: 11,
    color: "#5a7a72",
    fontWeight: "500",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0d1f1a",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f8f7",
    alignItems: "center",
    justifyContent: "center",
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f3f8f7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#5a7a72",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
    backgroundColor: "#f3f8f7",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0d1f1a",
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#5a7a72",
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: "#1a3a32",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
});
