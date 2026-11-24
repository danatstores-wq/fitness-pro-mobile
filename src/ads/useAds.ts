import { useEffect } from "react";

// Platform bundlers select useAds.native.ts or useAds.web.ts.
export default function useAds() {
  useEffect(() => {}, []);
  return { ready: false, showInterstitial: (_afterClose: () => void) => false };
}
