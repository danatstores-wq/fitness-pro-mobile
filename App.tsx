import React from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>DANAT</Text>
        <Text style={styles.title}>FITNESS PRO</Text>
        <View style={styles.accent} />
        <Text style={styles.subtitle}>Your training journey starts here.</Text>
        <Text style={styles.note}>The app foundation is ready. Fitness features will be added next.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#090B10" },
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 28 },
  eyebrow: { color: "#B8C0CC", fontSize: 13, fontWeight: "700", letterSpacing: 5, marginBottom: 10 },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", letterSpacing: 1.5 },
  accent: { width: 54, height: 4, borderRadius: 4, backgroundColor: "#C6A45C", marginTop: 20, marginBottom: 22 },
  subtitle: { color: "#E8EAF0", fontSize: 17, fontWeight: "600", textAlign: "center" },
  note: { color: "#8B93A1", fontSize: 13, textAlign: "center", marginTop: 12, lineHeight: 20 }
});
