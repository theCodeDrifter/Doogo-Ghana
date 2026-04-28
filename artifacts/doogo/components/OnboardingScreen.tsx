import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AUTO_DISMISS_MS = 30_000;
const SCREEN_WIDTH = Dimensions.get("window").width;
const LOGO_WIDTH = Math.min(SCREEN_WIDTH * 0.5, 280);

type Category = { icon: keyof typeof Feather.glyphMap; label: string };
const CATEGORIES: Category[] = [
  { icon: "home", label: "Appliances" },
  { icon: "tool", label: "Kitchen Tools" },
  { icon: "sun", label: "Lighting" },
  { icon: "zap", label: "Electricals & Power" },
  { icon: "package", label: "Furniture & Décor" },
];

interface Props {
  onFinish: () => void;
}

export function OnboardingScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(40)).current;
  const finished = useRef(false);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  // Auto-dismiss after 10s
  useEffect(() => {
    const t = setTimeout(() => triggerFinish(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerFinish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(exit, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    }).start(() => onFinish());
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerFinish();
  };

  return (
    <Animated.View style={[styles.root, { opacity: exit }]}>
      <LinearGradient
        colors={["#000000", "#0b1d1a", "#102a25"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle decorative orbs */}
      <View pointerEvents="none" style={styles.orbWrap}>
        <View style={[styles.orb, styles.orbA]} />
        <View style={[styles.orb, styles.orbB]} />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fade,
            transform: [{ translateY: slide }],
            paddingTop: insets.top + 72,
            paddingBottom: insets.bottom + 28,
          },
        ]}
      >
        {/* Logo */}
        <View style={styles.logoBlock}>
          <Image
            source={require("@/assets/images/doogo-white-logo.png")}
            style={{ width: LOGO_WIDTH, height: LOGO_WIDTH * 0.38 }}
            resizeMode="contain"
          />
        </View>

        {/* Headline */}
        <View style={styles.copyBlock}>
          <Text style={styles.eyebrow}>WELCOME TO DOOGO</Text>
          <Text style={styles.headline}>
            Everything for your{"\n"}
            <Text style={styles.headlineAccent}>home</Text>,
            <Text style={styles.headlineItalic}> in one place.</Text>
          </Text>
          <Text style={styles.subhead}>
            Premium appliances, statement furniture and tools — sourced,
            curated and delivered to your doorstep across Ghana.
          </Text>
        </View>

        {/* Category chips */}
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <View key={c.label} style={styles.chip}>
              <Feather name={c.icon} size={14} color="#e9f5f1" />
              <Text style={styles.chipText}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {/* Footer mini value props */}
        <View style={styles.valueRow}>
          <View style={styles.valueItem}>
            <Feather name="truck" size={14} color="#9ec9bf" />
            <Text style={styles.valueText}>Nationwide delivery</Text>
          </View>
          <View style={styles.dot} />
          <View style={styles.valueItem}>
            <Feather name="shield" size={14} color="#9ec9bf" />
            <Text style={styles.valueText}>Authentic brands</Text>
          </View>
        </View>

        {/* CTA — cream pill with embedded dark-teal arrow square */}
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.cta,
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start shopping"
        >
          <Text style={styles.ctaText}>Start Shopping</Text>
          <View style={styles.ctaArrowBox}>
            <Feather name="arrow-right" size={18} color="#ffffff" />
          </View>
        </Pressable>

        <Text style={styles.skipHint}>Tap to continue · Auto-starts shortly</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  orbWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbA: {
    width: 340,
    height: 340,
    top: -120,
    right: -120,
    backgroundColor: "rgba(247, 197, 56, 0.10)",
  },
  orbB: {
    width: 420,
    height: 420,
    bottom: -200,
    left: -160,
    backgroundColor: "rgba(26, 90, 80, 0.35)",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  logoBlock: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 36,
  },
  copyBlock: {
    marginBottom: 26,
  },
  eyebrow: {
    color: "#beebe5",
    fontSize: 11,
    fontFamily: "Geist_600SemiBold",
    letterSpacing: 2.4,
    marginBottom: 14,
  },
  headline: {
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 34,
    fontFamily: "Geist_500Medium",
    letterSpacing: -0.8,
  },
  headlineAccent: {
    color: "#beebe5",
    fontFamily: "Geist_500Medium",
  },
  headlineItalic: {
    fontFamily: "InstrumentSerif_400Regular_Italic",
    color: "#ffffff",
    fontSize: 38,
    letterSpacing: -0.5,
  },
  subhead: {
    color: "rgba(233, 245, 241, 0.72)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    fontFamily: "Geist_400Regular",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  chipText: {
    color: "#e9f5f1",
    fontSize: 12,
    fontFamily: "Geist_500Medium",
    letterSpacing: 0.2,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 18,
  },
  valueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  valueText: {
    color: "#9ec9bf",
    fontSize: 12,
    fontFamily: "Geist_500Medium",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#3d524d",
  },
  cta: {
    backgroundColor: "#f5f1e8",
    paddingVertical: 8,
    paddingLeft: 22,
    paddingRight: 8,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaText: {
    color: "#1a3a32",
    fontSize: 16,
    fontFamily: "Geist_600SemiBold",
    letterSpacing: 0.1,
  },
  ctaArrowBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1a3a32",
    alignItems: "center",
    justifyContent: "center",
  },
  skipHint: {
    textAlign: "center",
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    marginTop: 14,
    fontFamily: "Geist_400Regular",
  },
});
