import fs from "node:fs";
import path from "node:path";

type FdcNutrient = { nutrient?: { name?: string; unitName?: string }; amount?: number | null };
type FdcPortion = { gramWeight?: number; portionDescription?: string; modifier?: string; amount?: number };
type FdcFood = {
  fdcId: number;
  description: string;
  foodCategory?: { description?: string };
  foodNutrients?: FdcNutrient[];
  foodPortions?: FdcPortion[];
};
type OutputFood = {
  name: string; sourceId: string; category: string;
  calories: number | null; protein_g: number | null; carbs_g: number | null;
  fat_g: number | null; fiber_g: number | null; total_sugars_g: number | null;
  starch_g: number | null; cholesterol_mg: number | null; saturated_fat_g: number | null;
  trans_fat_g: number | null; monounsaturated_fat_g: number | null;
  polyunsaturated_fat_g: number | null; water_g: number | null;
  nutrients: { name: string; unit: string; amount: number }[];
  servings: { label: string; grams: number }[];
};

const [,, inputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: npm run import:usda -- ./data/FoodData_Central_foundation_food_json_YYYY-MM-DD.zip");
  process.exit(1);
}
const inputPath = path.resolve(inputArg);
const tempDir = path.resolve("data/usda-extracted");
fs.mkdirSync(tempDir, { recursive: true });
const isZip = inputPath.toLowerCase().endsWith(".zip");
if (isZip) {
  const { execFileSync } = await import("node:child_process");
  execFileSync("unzip", ["-o", inputPath, "-d", tempDir], { stdio: "inherit" });
}
const jsonPath = isZip
  ? findJson(tempDir)
  : inputPath;
function findJson(dir: string): string {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { const found = findJson(full); if (found) return found; }
    else if (entry.name.toLowerCase().endsWith(".json")) return full;
  }
  throw new Error("No JSON file found in the USDA archive.");
}
const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const foods: FdcFood[] = Array.isArray(parsed) ? parsed : parsed.FoundationFoods ?? parsed.foundationFoods ?? [];
if (!foods.length) throw new Error("The selected file does not contain Foundation Foods records.");

const macroAliases: Record<string, string[]> = {
  calories: ["Energy"], protein_g: ["Protein"], carbs_g: ["Carbohydrate, by difference"],
  fat_g: ["Total lipid (fat)"], fiber_g: ["Fiber, total dietary"],
  total_sugars_g: ["Sugars, total including NLEA", "Sugars, total"],
  starch_g: ["Starch"], cholesterol_mg: ["Cholesterol"],
  saturated_fat_g: ["Fatty acids, total saturated"], trans_fat_g: ["Fatty acids, total trans"],
  monounsaturated_fat_g: ["Fatty acids, total monounsaturated"],
  polyunsaturated_fat_g: ["Fatty acids, total polyunsaturated"], water_g: ["Water"]
};
const microKeywords = ["vitamin", "folate", "thiamin", "riboflavin", "niacin", "pantothenic", "biotin", "calcium", "iron,", "magnesium", "phosphorus", "potassium", "sodium", "zinc", "copper", "manganese", "selenium", "iodine", "choline"];

