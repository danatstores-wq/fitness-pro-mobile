import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import mobileAds, { AdsConsent, AdEventType, InterstitialAd, TestIds } from "react-native-google-mobile-ads";

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true";
const interstitialId = useTestAds ? TestIds.INTERSTITIAL : Platform.OS === "ios"
  ? "ca-app-pub-1622329571366129/9865814828"
  : "ca-app-pub-1622329571366129/1541562708";

export default function useAds() {
  const [ready, setReady] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let removeLoaded = () => {};
    let removeClosed = () => {};
    let removeError = () => {};
    let timer: ReturnType<typeof setInterval> | undefined;

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
          ad.load();
        });
        removeError = ad.addAdEventListener(AdEventType.ERROR, error => {
          loadedRef.current = false;
          console.warn("AdMob interstitial failed", error);
        });
        ad.load();

        // Show no more than one full-screen advert every three minutes of foreground app use.
        timer = setInterval(() => {
          if (AppState.currentState === "active" && loadedRef.current && adRef.current) {
            loadedRef.current = false;
            adRef.current.show().catch(error => console.warn("Could not show interstitial", error));
          }
        }, 180000);
      } catch (error) {
        console.warn("AdMob consent or initialization failed; ads remain disabled", error);
      }
    };

    void start();
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      removeLoaded();
      removeClosed();
      removeError();
      adRef.current = null;
    };
  }, []);

  return ready;
}
