import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import mobileAds, { AdsConsent, AdEventType, InterstitialAd, TestIds } from "react-native-google-mobile-ads";

const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true";
const interstitialId = useTestAds ? TestIds.INTERSTITIAL : Platform.OS === "ios"
  ? "ca-app-pub-1622329571366129/9865814828"
  : "ca-app-pub-1622329571366129/1541562708";
const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;
const LAST_INTERSTITIAL_SHOWN_KEY = "@fitness_pro/last_interstitial_shown_at";
const INITIAL_RETRY_DELAY_MS = 30 * 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

export default function useAds() {
  const [ready, setReady] = useState(false);
  const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const lastInterstitialShownAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    let initializationStarted = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = INITIAL_RETRY_DELAY_MS;
    let removeLoaded = () => {};
    let removeOpened = () => {};
    let removeClosed = () => {};
    let removeError = () => {};

    const scheduleReload = () => {
      if (!active || retryTimer) return;
      const delay = retryDelayMs;
      retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!active || !adRef.current) return;
        try {
          adRef.current.load();
        } catch (error) {
          console.warn("Could not retry AdMob interstitial", error);
          scheduleReload();
        }
      }, delay);
    };

    const loadAd = () => {
      if (!active || !adRef.current) return;
      try {
        adRef.current.load();
      } catch (error) {
        console.warn("Could not load AdMob interstitial", error);
        scheduleReload();
      }
    };

    const initializeAdsIfAllowed = async () => {
      if (!active || initializationStarted) return;
      try {
        // Read the latest UMP status. This also lets us use a valid consent
        // decision cached from the previous session if the refresh is offline.
        const consentInfo = await AdsConsent.getConsentInfo();
        if (!active) return;
        setPrivacyOptionsRequired(consentInfo.privacyOptionsRequirementStatus === "REQUIRED");
        if (!consentInfo.canRequestAds || initializationStarted) return;
        initializationStarted = true;

        await mobileAds().initialize();
        if (!active) return;

        try {
          const storedTimestamp = await AsyncStorage.getItem(LAST_INTERSTITIAL_SHOWN_KEY);
          const parsedTimestamp = storedTimestamp ? Number(storedTimestamp) : 0;
          if (Number.isFinite(parsedTimestamp) && parsedTimestamp > 0) {
            lastInterstitialShownAtRef.current = parsedTimestamp;
          }
        } catch (storageError) {
          console.warn("Could not restore interstitial cooldown; using an in-memory limit", storageError);
        }
        if (!active) return;
        setReady(true);

        const ad = InterstitialAd.createForAdRequest(interstitialId);
        adRef.current = ad;
        removeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
          loadedRef.current = true;
          retryDelayMs = INITIAL_RETRY_DELAY_MS;
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
        });
        removeOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
          const shownAt = Date.now();
          lastInterstitialShownAtRef.current = shownAt;
          void AsyncStorage.setItem(LAST_INTERSTITIAL_SHOWN_KEY, String(shownAt)).catch(error => {
            console.warn("Could not save interstitial cooldown", error);
          });
        });
        removeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
          loadedRef.current = false;
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          action?.();
          retryDelayMs = INITIAL_RETRY_DELAY_MS;
          loadAd();
        });
        removeError = ad.addAdEventListener(AdEventType.ERROR, error => {
          loadedRef.current = false;
          console.warn("AdMob interstitial failed; retrying with backoff", error);
          const action = pendingActionRef.current;
          pendingActionRef.current = null;
          action?.();
          scheduleReload();
        });
        loadAd();
      } catch (error) {
        initializationStarted = false;
        console.warn("AdMob initialization failed; ads remain disabled until consent/SDK initialization succeeds", error);
      }
    };

    // Try the previous session's consent immediately, then refresh consent.
    // If the refresh fails, the cached decision can still allow ad requests.
    void initializeAdsIfAllowed();
    void AdsConsent.gatherConsent()
      .then(() => initializeAdsIfAllowed())
      .catch(error => {
        console.warn("AdMob consent refresh failed; checking the previous consent decision", error);
        void initializeAdsIfAllowed();
      });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      removeLoaded();
      removeOpened();
      removeClosed();
      removeError();
      adRef.current = null;
      loadedRef.current = false;
      pendingActionRef.current = null;
    };
  }, []);

  const showPrivacyOptions = async () => {
    const consentInfo = await AdsConsent.showPrivacyOptionsForm();
    setPrivacyOptionsRequired(consentInfo.privacyOptionsRequirementStatus === "REQUIRED");
    return consentInfo;
  };

  const showInterstitial = (afterClose: () => void): boolean => {
    const ad = adRef.current;
    const cooldownRemaining = INTERSTITIAL_COOLDOWN_MS - (Date.now() - lastInterstitialShownAtRef.current);
    if (!ready || !loadedRef.current || !ad || cooldownRemaining > 0) return false;
    loadedRef.current = false;
    pendingActionRef.current = afterClose;
    ad.show().catch(error => {
      console.warn("Could not show AdMob interstitial", error);
      loadedRef.current = false;
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      action?.();
      // A failed show can leave the current ad unusable; request a fresh one.
      try {
        ad.load();
      } catch (loadError) {
        console.warn("Could not reload AdMob interstitial after show failure", loadError);
      }
    });
    return true;
  };

  return { ready, showInterstitial, privacyOptionsRequired, showPrivacyOptions };
}
