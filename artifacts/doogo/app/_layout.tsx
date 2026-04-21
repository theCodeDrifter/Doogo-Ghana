import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from "@expo-google-fonts/geist";
import {
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Text, TextInput, View } from "react-native";
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
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Apply Geist as the default font for every <Text> / <TextInput>
      const defaultStyle = { fontFamily: "Geist_400Regular" };
      const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
      TextAny.defaultProps = TextAny.defaultProps || {};
      TextAny.defaultProps.style = [defaultStyle, TextAny.defaultProps.style];
      const InputAny = TextInput as unknown as {
        defaultProps?: { style?: unknown };
      };
      InputAny.defaultProps = InputAny.defaultProps || {};
      InputAny.defaultProps.style = [defaultStyle, InputAny.defaultProps.style];

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
