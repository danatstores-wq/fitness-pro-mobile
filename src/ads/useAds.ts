import { useEffect } from "react";

// Platform bundlers select useAds.native.ts or useAds.web.ts.
// This fallback keeps plain TypeScript module resolution satisfied.
export default function useAds() {
  useEffect(() => {}, []);
  return false;
}
