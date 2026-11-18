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
const microAliases: Record<string, { aliases: string[]; unit: string }> = {
  "Vitamin A": { aliases: ["Vitamin A, RAE"], unit: "µg RAE" },
  "Vitamin C": { aliases: ["Vitamin C, total ascorbic acid"], unit: "mg" },
  "Vitamin D": { aliases: ["Vitamin D (D2 + D3)"], unit: "µg" },
  "Vitamin E": { aliases: ["Vitamin E (alpha-tocopherol)"], unit: "mg" },
  "Vitamin K": { aliases: ["Vitamin K (phylloquinone)"], unit: "µg" },
  "Thiamin (B1)": { aliases: ["Thiamin"], unit: "mg" },
  "Riboflavin (B2)": { aliases: ["Riboflavin"], unit: "mg" },
  "Niacin (B3)": { aliases: ["Niacin"], unit: "mg" },
  "Pantothenic acid (B5)": { aliases: ["Pantothenic acid"], unit: "mg" },
  "Vitamin B6": { aliases: ["Vitamin B-6"], unit: "mg" },
  "Biotin (B7)": { aliases: ["Biotin"], unit: "µg" },
  "Folate (B9)": { aliases: ["Folate, total"], unit: "µg" },
  "Vitamin B12": { aliases: ["Vitamin B-12"], unit: "µg" },
  Calcium: { aliases: ["Calcium, Ca"], unit: "mg" },
  Iron: { aliases: ["Iron, Fe"], unit: "mg" },
  Magnesium: { aliases: ["Magnesium, Mg"], unit: "mg" },
  Phosphorus: { aliases: ["Phosphorus, P"], unit: "mg" },
  Potassium: { aliases: ["Potassium, K"], unit: "mg" },
  Sodium: { aliases: ["Sodium, Na"], unit: "mg" },
  Zinc: { aliases: ["Zinc, Zn"], unit: "mg" },
  Copper: { aliases: ["Copper, Cu"], unit: "mg" },
  Manganese: { aliases: ["Manganese, Mn"], unit: "mg" },
  Selenium: { aliases: ["Selenium, Se"], unit: "µg" },
  Choline: { aliases: ["Choline, total"], unit: "mg" }
};
const amountFor = (food: FdcFood, aliases: string[], unit?: string): number | null => {
  const match = (food.foodNutrients ?? []).find(row =>
    aliases.includes(row.nutrient?.name ?? "") &&
    (!unit || (row.nutrient?.unitName ?? "").toLowerCase() === unit.toLowerCase())
  );
  return typeof match?.amount === "number" && Number.isFinite(match.amount) ? match.amount : null;
};
const output: OutputFood[] = foods
  .filter(food => food.fdcId && food.description?.trim())
  .map(food => {
    const get = (key: string) => {
      const aliases = macroAliases[key];
      if (key === "calories") return amountFor(food, aliases, "kcal");
      const unit = key === "cholesterol_mg" ? "mg" : "g";
      return amountFor(food, aliases, unit);
    };
    const nutrients = Object.entries(microAliases).flatMap(([name, config]) => {
      const amount = amountFor(food, config.aliases, config.unit);
      return amount === null ? [] : [{ name, unit: config.unit, amount }];
    });
    const servings = (food.foodPortions ?? []).flatMap(portion => {
      const grams = portion.gramWeight;
      if (!grams || !Number.isFinite(grams) || grams <= 0) return [];
      const label = [portion.amount, portion.modifier, portion.portionDescription].filter(Boolean).join(" ").trim() || "USDA portion";
      return [{ label, grams }];
    });
    return {
      name: food.description.trim(), sourceId: String(food.fdcId),
      category: food.foodCategory?.description || "Other",
      calories: get("calories"), protein_g: get("protein_g"), carbs_g: get("carbs_g"),
      fat_g: get("fat_g"), fiber_g: get("fiber_g"), total_sugars_g: get("total_sugars_g"),
      starch_g: get("starch_g"), cholesterol_mg: get("cholesterol_mg"),
      saturated_fat_g: get("saturated_fat_g"), trans_fat_g: get("trans_fat_g"),
      monounsaturated_fat_g: get("monounsaturated_fat_g"), polyunsaturated_fat_g: get("polyunsaturated_fat_g"),
      water_g: get("water_g"), nutrients, servings
    };
  });
const outPath = path.resolve("src/data/usda-foundation-foods.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output));
console.log(`Prepared ${output.length} USDA Foundation Foods records at ${outPath}`);
console.log("Nutrient gaps remain null/absent; no values were fabricated.");
