import { SymbolView, SymbolViewProps } from "expo-symbols";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export type TabKey = "home" | "shop" | "wishlist" | "cart" | "account";

type TabDef = {
  key: TabKey;
  label: string;
  sfSymbol: SymbolViewProps["name"];
  ionicon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabDef[] = [
  { key: "home",     label: "Home",     sfSymbol: "house.fill",                    ionicon: "home" },
  { key: "shop",     label: "Shop",     sfSymbol: "bag.fill",                      ionicon: "bag" },
  { key: "wishlist", label: "Wishlist", sfSymbol: "heart.fill",                    ionicon: "heart" },
  { key: "cart",     label: "Cart",     sfSymbol: "cart.fill",                     ionicon: "cart" },
  { key: "account",  label: "Account",  sfSymbol: "person.crop.circle.fill",       ionicon: "person-circle" },
];

const ACCENT = "#1a3a32";
const INACTIVE = "rgba(60, 60, 67, 0.6)";

type Props = {
  active: TabKey | null;
  onTabPress: (key: TabKey) => void;
};

export function LiquidGlassTabBar({ active, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  const useLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

  const handlePress = useCallback(
    (key: TabKey) => {
      Haptics.selectionAsync();
      onTabPress(key);
    },
    [onTabPress]
  );

  const content = (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const tint = isActive ? ACCENT : INACTIVE;
        return (
          <Pressable
            key={tab.key}
            onPress={() => handlePress(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            {Platform.OS === "ios" ? (
              <SymbolView
                name={tab.sfSymbol}
                size={26}
                tintColor={tint}
                weight="semibold"
                resizeMode="scaleAspectFit"
              />
            ) : (
              <Ionicons name={tab.ionicon} size={26} color={tint} />
            )}
            <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {useLiquidGlass ? (
        <GlassView style={styles.glass} glassEffectStyle="regular" isInteractive={false}>
          {content}
        </GlassView>
      ) : Platform.OS === "ios" ? (
        <BlurView intensity={80} tint="light" style={styles.glass}>
          <View style={styles.fallbackOverlay} />
          {content}
        </BlurView>
      ) : (
        <View style={[styles.glass, styles.androidSolid]}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    paddingHorizontal: 0,
  },
  glass: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  fallbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  androidSolid: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 2,
  },
  tabPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.96 }],
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
