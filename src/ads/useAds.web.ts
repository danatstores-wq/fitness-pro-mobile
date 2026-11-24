import { useEffect } from "react";
export default function useAds() {
  useEffect(() => {}, []);
  return { ready: false, showInterstitial: (_afterClose: () => void) => false };
}
