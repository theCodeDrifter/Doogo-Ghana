import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "@doogo:onboarding_seen_v5";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_KEY);
    return v === "1";
  } catch {
    return true;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
  } catch {}
}
