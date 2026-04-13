import React from "react";
import { StyleSheet, View } from "react-native";

import { WebViewScreen } from "@/screens/WebViewScreen";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <WebViewScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
