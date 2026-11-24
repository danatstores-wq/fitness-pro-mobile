import { useEffect } from "react";

// Platform bundlers select useAds.native.ts or useAds.web.ts.
// Keep the fallback return shape aligned for TypeScript and non-native tooling.
export default function useAds() {
  useEffect(() => {}, []);
  return {
    ready: false,
    showInterstitial: (_afterClose: () => void) => false,
    privacyOptionsRequired: false,
    showPrivacyOptions: async () => ({ privacyOptionsRequirementStatus: "NOT_REQUIRED" as const })
  };
}
