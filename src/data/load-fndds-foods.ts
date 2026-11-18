import { gunzipSync, strFromU8 } from "fflate";
import type { ImportedFoodRecord } from "../storage/database";
import { USDA_FNDDS_FOODS_GZIP_BASE64 } from "./usda-fndds-foods";

let cataloguePromise: Promise<ImportedFoodRecord[]> | null = null;

export function loadFnddsFoods(): Promise<ImportedFoodRecord[]> {
  if (!cataloguePromise) {
    cataloguePromise = Promise.resolve().then(() => {
      const binary = globalThis.atob(USDA_FNDDS_FOODS_GZIP_BASE64);
      const compressed = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        compressed[index] = binary.charCodeAt(index);
      }
      const json = strFromU8(gunzipSync(compressed));
      return JSON.parse(json) as ImportedFoodRecord[];
    });
  }
  return cataloguePromise;
}
