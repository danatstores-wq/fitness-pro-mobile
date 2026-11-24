import { useEffect } from "react";
export default function useAds() {
  useEffect(() => {}, []);
  return {
    ready: false,
    showInterstitial: (_afterClose: () => void) => false,
    privacyOptionsRequired: false,
    showPrivacyOptions: async () => ({ privacyOptionsRequirementStatus: "NOT_REQUIRED" as const })
  };
}
