import fs from "node:fs";
import path from "node:path";

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
    } else if (entry.name.toLowerCase().endsWith(".json")) {
      return full;
    }
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
const foods = Array.isArray(parsed)
  ? parsed
  : (parsed?.SurveyFoods ?? parsed?.surveyFoods ?? parsed?.FoundationFoods ?? parsed?.foundationFoods ?? []);
if (!foods.length) throw new Error("No FoundationFoods or SurveyFoods records were found. Make sure you downloaded a FoodData Central JSON archive.");

const macroAliases = {
  calories: ["Energy", "Energy (Atwater General Factors)", "Energy (Atwater Specific Factors)"],
  protein_g: ["Protein"],
  carbs_g: ["Carbohydrate, by difference", "Carbohydrate"],
  fat_g: ["Total lipid (fat)", "Total fat"],
  fiber_g: ["Fiber, total dietary", "Total dietary fiber"],
  total_sugars_g: ["Sugars, total including NLEA", "Sugars, total"],
  starch_g: ["Starch"],
  cholesterol_mg: ["Cholesterol"],
  saturated_fat_g: ["Fatty acids, total saturated", "Saturated fat"],
  trans_fat_g: ["Fatty acids, total trans", "Trans fat"],
  monounsaturated_fat_g: ["Fatty acids, total monounsaturated", "Monounsaturated fat"],
  polyunsaturated_fat_g: ["Fatty acids, total polyunsaturated", "Polyunsaturated fat"],
  water_g: ["Water"]
};
const microKeywords = [
  "vitamin", "folate", "thiamin", "riboflavin", "niacin", "pantothenic", "biotin",
  "calcium", "iron", "magnesium", "phosphorus", "potassium", "sodium", "zinc",
  "copper", "manganese", "selenium", "iodine", "choline", "fluoride"
];

function nutrientName(item) {
  return item?.nutrient?.name ?? item?.name ?? item?.nutrientName ?? "";
}
function nutrientUnit(item) {
  return item?.nutrient?.unitName ?? item?.unitName ?? item?.unit ?? "";
}
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
  return food?.foodCategory?.description
    ?? food?.wweiaFoodCategory?.description
    ?? food?.wweiaFoodCategory
    ?? "Other";
}
function toFood(food) {
  const sourceId = String(food.fdcId ?? food.foodCode ?? food.food_code ?? "");
  if (!sourceId || !food.description) return null;
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const macros = {};
  for (const [key, aliases] of Object.entries(macroAliases)) {
    let value = findAmount(nutrients, aliases);
    if (key === "calories" && value !== null) {
      const energyItem = nutrients.find(item => macroAliases.calories.some(alias => nutrientName(item).toLowerCase() === alias.toLowerCase()));
      const unit = nutrientUnit(energyItem).toLowerCase();
      if (unit === "kj") value = value / 4.184;
    }
    macros[key] = value;
  }
  const micros = [];
  const seen = new Set();
  for (const item of nutrients) {
    const name = nutrientName(item);
    const unit = nutrientUnit(item);
    const amount = nutrientAmount(item);
    if (!name || amount === null || !microKeywords.some(keyword => name.toLowerCase().includes(keyword))) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    micros.push({ name, unit: unit || "unknown", amount });
  }
  const servings = [];
  for (const portion of (food.foodPortions ?? food.foodPortion ?? [])) {
    const grams = portion.gramWeight ?? portion.portionWeight ?? portion.gram_weight;
    if (!(typeof grams === "number" && Number.isFinite(grams) && grams > 0)) continue;
    const label = [portion.amount, portion.modifier, portion.portionDescription].filter(Boolean).join(" ").trim()
      || portion.portionDescription || "1 serving";
    if (!servings.some(serving => serving.label === label && serving.grams === grams)) servings.push({ label, grams });
  }
  return {
    name: food.description,
    sourceId,
    category: categoryFor(food),
    ...macros,
    nutrients: micros,
    servings
  };
}

const records = foods.map(toFood).filter(Boolean);
if (!records.length) throw new Error("The USDA file was recognized, but no usable food records were produced.");
const outputPath = path.resolve(outputArg ?? (isSurvey ? "src/data/usda-fndds-foods.ts" : "src/data/usda-foundation-foods.ts"));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const exportName = isSurvey ? "USDA_FNDDS_FOODS" : "USDA_FOUNDATION_FOODS";
fs.writeFileSync(outputPath, `// Generated from USDA FoodData Central ${isSurvey ? "FNDDS" : "Foundation Foods"} JSON. Do not edit manually.
export const ${exportName} = ${JSON.stringify(records)} as const;
`);
console.log(`Imported ${records.length} USDA food records into ${outputPath}`);
console.log(`Records with nutrient details: ${records.filter(food => food.nutrients.length > 0).length}`);
console.log(`Records with serving weights: ${records.filter(food => food.servings.length > 0).length}`);
