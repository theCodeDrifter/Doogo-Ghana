import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

function ShimmerBlock({ style }: { style?: object }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return <Animated.View style={[styles.block, { opacity }, style]} />;
}

export function SkeletonShimmer() {
  return (
    <View style={styles.container}>
      <ShimmerBlock style={styles.header} />
      <ShimmerBlock style={styles.banner} />
      <View style={styles.row}>
        <ShimmerBlock style={styles.card} />
        <ShimmerBlock style={styles.card} />
      </View>
      <View style={styles.row}>
        <ShimmerBlock style={styles.card} />
        <ShimmerBlock style={styles.card} />
      </View>
      <ShimmerBlock style={styles.strip} />
      <ShimmerBlock style={styles.strip} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e6fffa",
    padding: 16,
    gap: 12,
  },
  block: {
    backgroundColor: "#b0ddd5",
    borderRadius: 8,
  },
  header: {
    height: 52,
    borderRadius: 8,
    marginBottom: 4,
  },
  banner: {
    height: 180,
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    flex: 1,
    height: 160,
    borderRadius: 12,
  },
  strip: {
    height: 48,
    borderRadius: 8,
  },
});
