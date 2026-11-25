import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true";
const unitId = useTestAds ? TestIds.BANNER : Platform.OS === "ios"
  ? "ca-app-pub-1622329571366129/6602317693"
  : "ca-app-pub-1622329571366129/1653243347";
const INITIAL_RETRY_DELAY_MS = 30 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

export default function AdBanner({ enabled }: { enabled: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (!enabled && retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [enabled]);

  const handleLoadFailure = (error: unknown) => {
    console.warn("AdMob banner failed to load; retrying with backoff", error);
    if (!enabled || retryTimerRef.current) return;
    const delay = retryDelayRef.current;
    retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY_MS);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setAttempt(current => current + 1);
    }, delay);
  };

  if (!enabled) return null;

  return <View style={styles.container}>
    <BannerAd
      key={attempt}
      unitId={unitId}
      size={BannerAdSize.BANNER}
      onAdLoaded={() => { retryDelayRef.current = INITIAL_RETRY_DELAY_MS; }}
      onAdFailedToLoad={handleLoadFailure}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", minHeight: 0, backgroundColor: "#102A4C" }
});
