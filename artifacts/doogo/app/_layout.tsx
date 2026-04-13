import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SplashLoading } from "@/components/SplashLoading";
import { registerForPushNotifications } from "@/services/notifications";

// Prevent native splash from hiding until we're ready —
// wrapped in try/catch because Expo Go doesn't always support this
try {
  SplashScreen.preventAutoHideAsync();
} catch {}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  // Show branded splash while fonts are loading — never show a raw white screen
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1 }}>
        <SplashLoading />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="dark" backgroundColor="transparent" translucent />
          <RootLayoutNav />
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
