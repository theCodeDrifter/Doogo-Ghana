import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

interface LoadingBarProps {
  loading: boolean;
}

const RING_SIZE = 36;
const RING_THICKNESS = 3;
const RING_COLOR = "#1a3a32";

/**
 * Centered sharp-ring spinner.
 * Shows while loading=true, fades out when done.
 */
export function LoadingBar({ loading }: LoadingBarProps) {
  const rotation = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loading) {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      // Continuous rotation
      rotation.setValue(0);
      spinAnim.current = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 700,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinAnim.current.start();
    } else {
      // Fade out, then stop spin
      spinAnim.current?.stop();
      Animated.timing(opacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, opacity, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.ring,
          {
            opacity,
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_THICKNESS,
    // One gap = the "open" arc; the other three sides form the visible arc
    borderTopColor: "transparent",
    borderRightColor: RING_COLOR,
    borderBottomColor: RING_COLOR,
    borderLeftColor: RING_COLOR,
  },
});
