import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const [,, inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: node scripts/import-usda-foundation.mjs <USDA-JSON-or-ZIP> [output.ts]");
  process.exit(1);
}
const inputPath = path.resolve(inputArg);
const tempDir = path.resolve("data/usda-extracted");
fs.mkdirSync(tempDir, { recursive: true });

function findJson(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findJson(full);
      if (found) return found;
    } else if (entry.name.toLowerCase().endsWith(".json")) return full;
  }
  return null;
}
let jsonPath = inputPath;
if (inputPath.toLowerCase().endsWith(".zip")) {
  const { execFileSync } = await import("node:child_process");
  execFileSync("unzip", ["-o", inputPath, "-d", tempDir], { stdio: "inherit" });
  jsonPath = findJson(tempDir);
}
if (!jsonPath || !fs.existsSync(jsonPath)) throw new Error("Could not find a JSON file in the supplied USDA archive.");
const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const isSurvey = Boolean(parsed?.SurveyFoods || parsed?.surveyFoods);
const foods = Array.isArray(parsed) ? parsed :
  (parsed?.SurveyFoods ?? parsed?.surveyFoods ?? parsed?.FoundationFoods ?? parsed?.foundationFoods ?? []);
if (!foods.length) throw new Error("No FoundationFoods or SurveyFoods records were found.");

const macroAliases = {
  calories: ["Energy"],
  protein_g: ["Protein"],
  carbs_g: ["Carbohydrate, by difference", "Carbohydrate"],
  fat_g: ["Total lipid (fat)", "Total fat"],
  fiber_g: ["Fiber, total dietary", "Total dietary fiber"],
  total_sugars_g: ["Total Sugars", "Sugars, total including NLEA", "Sugars, total"],
  starch_g: ["Starch"],
  cholesterol_mg: ["Cholesterol"],
  saturated_fat_g: ["Fatty acids, total saturated", "Saturated fat"],
  trans_fat_g: ["Fatty acids, total trans", "Trans fat"],
  monounsaturated_fat_g: ["Fatty acids, total monounsaturated", "Monounsaturated fat"],
  polyunsaturated_fat_g: ["Fatty acids, total polyunsaturated", "Polyunsaturated fat"],
  water_g: ["Water"]
};
const microKeywords = ["vitamin","folate","thiamin","riboflavin","niacin","pantothenic","biotin",
  "calcium","iron","magnesium","phosphorus","potassium","sodium","zinc","copper","manganese",
  "selenium","iodine","choline","fluoride"];
function nutrientName(item) { return item?.nutrient?.name ?? item?.name ?? item?.nutrientName ?? ""; }
function nutrientUnit(item) { return item?.nutrient?.unitName ?? item?.unitName ?? item?.unit ?? ""; }
function nutrientAmount(item) {
  const value = item?.amount ?? item?.value ?? null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function findAmount(nutrients, aliases) {
  for (const alias of aliases) {
    const match = nutrients.find(item => nutrientName(item).toLowerCase() === alias.toLowerCase());
    if (match) return nutrientAmount(match);
  }
  return null;
}
function categoryFor(food) {
  const category = food?.wweiaFoodCategory?.wweiaFoodCategoryDescription
    ?? food?.wweiaFoodCategory?.description
    ?? food?.foodCategory?.description
    ?? food?.wweiaFoodCategory;
  return typeof category === "string" && category.trim() ? category.trim() : "Other";
}
function toFood(food) {
  const sourceId = String(food.fdcId ?? food.foodCode ?? food.food_code ?? "");
  if (!sourceId || !food.description) return null;
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const macros = {};
  for (const [key, aliases] of Object.entries(macroAliases)) {
    let value = findAmount(nutrients, aliases);
    if (key === "calories" && value !== null) {
      const item = nutrients.find(entry => aliases.some(alias => nutrientName(entry).toLowerCase() === alias.toLowerCase()));
      if (nutrientUnit(item).toLowerCase() === "kj") value /= 4.184;
    }
    macros[key] = value;
  }
  const detailed = [];
  const seen = new Set();
  for (const item of nutrients) {
    const name = nutrientName(item);
    const amount = nutrientAmount(item);
    const unit = nutrientUnit(item);
    if (!name || amount === null) continue;
    if (isSurvey || microKeywords.some(keyword => name.toLowerCase().includes(keyword))) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      detailed.push({ name, unit: unit || "unknown", amount });
    }
  }
  const servings = [];
  const servingSeen = new Set();
  for (const portion of (food.foodPortions ?? food.foodPortion ?? [])) {
    const grams = portion.gramWeight ?? portion.portionWeight ?? portion.gram_weight;
    const label = String(portion.portionDescription ?? "").trim();
    if (!(typeof grams === "number" && Number.isFinite(grams) && grams > 0) ||
        !label || label.toLowerCase() === "quantity not specified") continue;
    const key = label + "|" + grams;
    if (!servingSeen.has(key)) {
      servings.push({ label, grams });
      servingSeen.add(key);
    }
  }
  return {
    name: food.description, sourceId, category: categoryFor(food),
    ...macros, nutrients: detailed, servings
  };
}
const records = foods.map(toFood).filter(Boolean);
if (!records.length) throw new Error("The USDA file was recognized, but no usable food records were produced.");
const outputPath = path.resolve(outputArg ?? (isSurvey ? "src/data/usda-fndds-foods.ts" : "src/data/usda-foundation-foods.ts"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (isSurvey) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(records)), { level: 9, mtime: 0 });
  const base64 = compressed.toString("base64");
  fs.writeFileSync(outputPath,
    "// Generated from USDA FoodData Central FNDDS 2021-2023 (release 2024-10-31). Gzip-compressed JSON payload.\n" +
    "export const USDA_FNDDS_FOODS_GZIP_BASE64 =\n" +
    JSON.stringify(base64) + ";\n");
} else {
  fs.writeFileSync(outputPath,
    "// Generated from USDA FoodData Central Foundation Foods JSON. Do not edit manually.\n" +
    "export const USDA_FOUNDATION_FOODS = " + JSON.stringify(records) + " as const;\n");
}
console.log("USDA records: " + records.length);
console.log("Records with nutrient details: " + records.filter(food => food.nutrients.length > 0).length);
console.log("Records with serving weights: " + records.filter(food => food.servings.length > 0).length);
console.log("Detailed nutrient values: " + records.reduce((sum, food) => sum + food.nutrients.length, 0));
console.log("Output: " + outputPath);
