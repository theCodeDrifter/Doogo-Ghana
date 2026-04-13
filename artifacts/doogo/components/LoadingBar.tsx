import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface LoadingBarProps {
  loading: boolean;
}

const BAR_COLOR = "#1a3a32";

/**
 * iOS Safari-style thin progress bar.
 * Fills smoothly from 0 → ~85% while loading, then snaps to 100% and fades out.
 */
export function LoadingBar({ loading }: LoadingBarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const fillAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loading) {
      // Show immediately, reset to 0, then animate to ~85%
      fillAnimation.current?.stop();
      opacity.setValue(1);
      progress.setValue(0);

      fillAnimation.current = Animated.sequence([
        // Fast initial burst — feels snappy
        Animated.timing(progress, {
          toValue: 0.35,
          duration: 220,
          useNativeDriver: false,
        }),
        // Medium climb
        Animated.timing(progress, {
          toValue: 0.65,
          duration: 600,
          useNativeDriver: false,
        }),
        // Slow crawl — waiting for server
        Animated.timing(progress, {
          toValue: 0.85,
          duration: 1200,
          useNativeDriver: false,
        }),
        // Hold at 85% — looks like we're waiting for response
        Animated.timing(progress, {
          toValue: 0.85,
          duration: 99999,
          useNativeDriver: false,
        }),
      ]);
      fillAnimation.current.start();
    } else {
      // Complete: jump to 100% then fade
      fillAnimation.current?.stop();
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 180,
          useNativeDriver: false,
        }),
        Animated.delay(120),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: false,
        }),
      ]).start(() => {
        progress.setValue(0);
      });
    }
  }, [loading, opacity, progress]);

  const widthInterpolated = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.bar,
          {
            width: widthInterpolated,
            opacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    zIndex: 999,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: BAR_COLOR,
    // Subtle glow on the leading edge
    shadowColor: BAR_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
