import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import mobileAds, { AdsConsent, AdEventType, InterstitialAd, TestIds } from "react-native-google-mobile-ads";

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true";
const interstitialId = useTestAds ? TestIds.INTERSTITIAL : Platform.OS === "ios"
  ? "ca-app-pub-1622329571366129/9865814828"
  : "ca-app-pub-1622329571366129/1541562708";

export default function useAds() {
  const [ready, setReady] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    let removeLoaded = () => {};
    let removeClosed = () => {};
    let removeError = () => {};

    const start = async () => {
      try {
        const consent = await AdsConsent.gatherConsent();
        if (!active || !consent.canRequestAds) return;
        await mobileAds().initialize();
        if (!active) return;
        setReady(true);

        const ad = InterstitialAd.createForAdRequest(interstitialId);
        adRef.current = ad;
        removeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => { loadedRef.current = true; });
        removeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          loadedRef.current = false;
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          action?.();
          ad.load();
        });
        removeError = ad.addAdEventListener(AdEventType.ERROR, error => {
          loadedRef.current = false;
          console.warn("AdMob interstitial failed", error);
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          action?.();
        });
        ad.load();
      } catch (error) {
        console.warn("AdMob consent or initialization failed; ads remain disabled", error);
      }
    };

    void start();
    return () => {
      active = false;
      removeLoaded();
      removeClosed();
      removeError();
      adRef.current = null;
      pendingActionRef.current = null;
    };
  }, []);

  const showInterstitial = (afterClose: () => void): boolean => {
    const ad = adRef.current;
    if (!ready || !loadedRef.current || !ad) return false;
    loadedRef.current = false;
    pendingActionRef.current = afterClose;
    ad.show().catch(error => {
      console.warn("Could not show AdMob interstitial", error);
      loadedRef.current = false;
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action?.();
    });
    return true;
  };

  return { ready, showInterstitial };
}
