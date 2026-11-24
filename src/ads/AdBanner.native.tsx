import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true";
const unitId = useTestAds ? TestIds.BANNER : Platform.OS === "ios"
  ? "ca-app-pub-1622329571366129/6602317693"
  : "ca-app-pub-1622329571366129/1653243347";

export default function AdBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <View style={styles.container}>
    <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdFailedToLoad={error => console.warn("AdMob banner failed to load", error)}/>
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", minHeight: 0, backgroundColor: "#102A4C" }
});
