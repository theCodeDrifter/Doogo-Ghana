import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { OnboardingScreen } from "@/components/OnboardingScreen";
import { WebViewScreen } from "@/screens/WebViewScreen";
import { hasSeenOnboarding, markOnboardingSeen } from "@/services/onboarding";

type Phase = "checking" | "onboarding" | "app";

export default function HomeScreen() {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      setPhase(seen ? "app" : "onboarding");
    });
  }, []);

  const handleOnboardingFinish = () => {
    markOnboardingSeen().catch(() => {});
    setPhase("app");
  };

  return (
    <View style={styles.container}>
      {/* Always mount the main app underneath so the fade reveals it instantly */}
      {phase !== "onboarding" && <WebViewScreen />}
      {phase === "onboarding" && (
        <OnboardingScreen onFinish={handleOnboardingFinish} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
