import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  HomeIcon,
  ShopIcon,
  WishlistIcon,
  CartIcon,
  AccountIcon,
} from "@/components/NavIcons";

export type TabKey = "home" | "shop" | "wishlist" | "cart" | "account";

type TabDef = {
  key: TabKey;
  label: string;
};

const TABS: TabDef[] = [
  { key: "home",     label: "Home"     },
  { key: "shop",     label: "Shop"     },
  { key: "wishlist", label: "Wishlist" },
  { key: "cart",     label: "Cart"     },
  { key: "account",  label: "Account"  },
];

const ACTIVE_COLOR  = "#1a3a32";
const INACTIVE_COLOR = "rgba(60, 60, 67, 0.55)";

function TabIcon({
  tabKey,
  isActive,
}: {
  tabKey: TabKey;
  isActive: boolean;
}) {
  const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
  const size = 26;

  switch (tabKey) {
    case "home":
      return <HomeIcon color={color} size={size} />;
    case "shop":
      return <ShopIcon color={color} size={size} />;
    case "wishlist":
      return <WishlistIcon color={color} size={size} />;
    case "cart":
      return <CartIcon color={color} size={size} />;
    case "account":
      return <AccountIcon color={color} size={size} />;
  }
}

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
        const tint = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
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
            <TabIcon tabKey={tab.key} isActive={isActive} />
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
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  androidSolid: {
    backgroundColor: "rgba(255,255,255,0.93)",
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
    transform: [{ scale: 0.93 }],
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
