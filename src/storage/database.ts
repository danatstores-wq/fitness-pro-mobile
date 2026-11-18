import * as SQLite from "expo-sqlite";

export type StoredProfile = {
  age: number;
  sex: "male" | "female";
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  activity_level: string;
  fitness_objective: string;
  formula_setting?: string;
  language?: string;
  unit_system?: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync("fitness_pro_danat.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS user_profile (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          age INTEGER NOT NULL,
          sex TEXT NOT NULL,
          height_cm REAL NOT NULL,
          current_weight_kg REAL NOT NULL,
          target_weight_kg REAL NOT NULL,
          activity_level TEXT NOT NULL,
          fitness_objective TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          formula_setting TEXT NOT NULL DEFAULT 'mifflin_st_jeor',
          language TEXT NOT NULL DEFAULT 'en',
          unit_system TEXT NOT NULL DEFAULT 'metric'
        );
        CREATE TABLE IF NOT EXISTS seed_imports (
          seed_key TEXT PRIMARY KEY NOT NULL,
          imported_count INTEGER NOT NULL,
          imported_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS food_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS foods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          source TEXT,
          source_id TEXT,
          calories REAL,
          protein_g REAL,
          carbs_g REAL,
          fat_g REAL,
          fiber_g REAL,
          sugar_g REAL,
          saturated_fat_g REAL,
          data_quality TEXT NOT NULL DEFAULT 'unknown',
          total_sugars_g REAL,
          starch_g REAL,
          cholesterol_mg REAL,
          trans_fat_g REAL,
          monounsaturated_fat_g REAL,
          polyunsaturated_fat_g REAL,
          water_g REAL,
          category_id INTEGER REFERENCES food_categories(id)
        );
        CREATE TABLE IF NOT EXISTS nutrients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          unit TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS food_nutrients (
          food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
          nutrient_id INTEGER NOT NULL REFERENCES nutrients(id) ON DELETE CASCADE,
          amount REAL,
          PRIMARY KEY (food_id, nutrient_id)
        );
        CREATE TABLE IF NOT EXISTS food_servings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          food_id INTEGER NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          grams REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eaten_at TEXT NOT NULL,
          meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snacks'))
        );
        CREATE TABLE IF NOT EXISTS meal_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
          food_id INTEGER NOT NULL REFERENCES foods(id),
          quantity_g REAL NOT NULL CHECK (quantity_g > 0)
        );
        CREATE TABLE IF NOT EXISTS measurements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recorded_at TEXT NOT NULL,
          weight_kg REAL NOT NULL CHECK (weight_kg > 0),
          measurement_type TEXT NOT NULL DEFAULT 'weight',
          value REAL,
          unit TEXT NOT NULL DEFAULT 'kg'
        );
        CREATE TABLE IF NOT EXISTS body_measurements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recorded_at TEXT NOT NULL,
          measurement_type TEXT NOT NULL,
          value REAL NOT NULL CHECK (value > 0),
          unit TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS translations (
          language TEXT NOT NULL,
          translation_key TEXT NOT NULL,
          translation_value TEXT NOT NULL,
          PRIMARY KEY(language, translation_key)
        );
        CREATE TABLE IF NOT EXISTS daily_goals (
          day TEXT PRIMARY KEY NOT NULL,
          calories REAL,
          protein_g REAL,
          carbs_g REAL,
          fat_g REAL
        );
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          logged_at TEXT NOT NULL,
          activity TEXT NOT NULL,
          duration_minutes INTEGER,
          calories_burned REAL,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_measurements_date ON measurements(recorded_at);
        CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(eaten_at);
        CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_source_id ON foods(source, source_id) WHERE source_id IS NOT NULL;
      `);

      // Additive migrations preserve data already stored on users' devices.
      const profileColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(user_profile)");
      const profileNames = new Set(profileColumns.map(column => column.name));
      const profileAdditions: Record<string, string> = {
        formula_setting: "TEXT NOT NULL DEFAULT 'mifflin_st_jeor'",
        language: "TEXT NOT NULL DEFAULT 'en'",
        unit_system: "TEXT NOT NULL DEFAULT 'metric'"
      };
      for (const [column, type] of Object.entries(profileAdditions)) {
        if (!profileNames.has(column)) await db.execAsync("ALTER TABLE user_profile ADD COLUMN " + column + " " + type);
      }
      const foodColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(foods)");
      const existingColumns = new Set(foodColumns.map(column => column.name));
      if (!existingColumns.has("category_id")) await db.execAsync("ALTER TABLE foods ADD COLUMN category_id INTEGER REFERENCES food_categories(id)");
      const measurementColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(measurements)");
      const measurementNames = new Set(measurementColumns.map(column => column.name));
      if (!measurementNames.has("measurement_type")) await db.execAsync("ALTER TABLE measurements ADD COLUMN measurement_type TEXT NOT NULL DEFAULT 'weight'");
      if (!measurementNames.has("value")) await db.execAsync("ALTER TABLE measurements ADD COLUMN value REAL");
      if (!measurementNames.has("unit")) await db.execAsync("ALTER TABLE measurements ADD COLUMN unit TEXT NOT NULL DEFAULT 'kg'");
      await db.runAsync("UPDATE measurements SET value = weight_kg WHERE value IS NULL");
      const activityColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(activity_logs)");
      const activityNames = new Set(activityColumns.map(column => column.name));
      if (!activityNames.has("calories_burned")) await db.execAsync("ALTER TABLE activity_logs ADD COLUMN calories_burned REAL");
      if (!activityNames.has("notes")) await db.execAsync("ALTER TABLE activity_logs ADD COLUMN notes TEXT");
      const categories = ["Fruits","Vegetables","Grains and cereals","Meat and poultry","Fish and seafood","Dairy and eggs","Legumes and nuts","Oils and fats","Beverages","Prepared foods","Snacks","Other"];
      for (const category of categories) await db.runAsync("INSERT OR IGNORE INTO food_categories (name) VALUES (?)", category);

      const existingColumns = new Set(foodColumns.map(column => column.name));
      const optionalColumns: Record<string, string> = {
        total_sugars_g: "REAL", starch_g: "REAL", cholesterol_mg: "REAL",
        trans_fat_g: "REAL", monounsaturated_fat_g: "REAL",
        polyunsaturated_fat_g: "REAL", water_g: "REAL"
      };
      for (const [column, type] of Object.entries(optionalColumns)) {
        if (!existingColumns.has(column)) await db.execAsync(`ALTER TABLE foods ADD COLUMN ${column} ${type}`);
      }
      await db.execAsync("PRAGMA user_version = 3");
      const nutrientDefinitions: [string, string][] = [
        ["Vitamin A","µg RAE"],["Vitamin C","mg"],["Vitamin D","µg"],["Vitamin E","mg"],["Vitamin K","µg"],
        ["Thiamin (B1)","mg"],["Riboflavin (B2)","mg"],["Niacin (B3)","mg"],["Pantothenic acid (B5)","mg"],
        ["Vitamin B6","mg"],["Biotin (B7)","µg"],["Folate (B9)","µg"],["Vitamin B12","µg"],
        ["Calcium","mg"],["Iron","mg"],["Magnesium","mg"],["Phosphorus","mg"],["Potassium","mg"],
        ["Sodium","mg"],["Zinc","mg"],["Copper","mg"],["Manganese","mg"],["Selenium","µg"],
        ["Iodine","µg"],["Choline","mg"],["Fluoride","mg"]
      ];
      for (const [name, unit] of nutrientDefinitions) {
        await db.runAsync("INSERT OR IGNORE INTO nutrients (name, unit) VALUES (?, ?)", name, unit);
      }
      return db;
    })();
  }
  return databasePromise;
}

export async function loadProfile(): Promise<StoredProfile | null> {
  const db = await database();
  return db.getFirstAsync<StoredProfile>("SELECT age, sex, height_cm, current_weight_kg, target_weight_kg, activity_level, fitness_objective, formula_setting, language, unit_system FROM user_profile WHERE id = 1");
}

export async function saveProfile(profile: StoredProfile) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO user_profile
      (id, age, sex, height_cm, current_weight_kg, target_weight_kg, activity_level, fitness_objective, updated_at, formula_setting, language, unit_system)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      age=excluded.age, sex=excluded.sex, height_cm=excluded.height_cm,
      current_weight_kg=excluded.current_weight_kg, target_weight_kg=excluded.target_weight_kg,
      activity_level=excluded.activity_level, fitness_objective=excluded.fitness_objective,
      updated_at=excluded.updated_at, formula_setting=excluded.formula_setting,
      language=excluded.language, unit_system=excluded.unit_system`,
    profile.age, profile.sex, profile.height_cm, profile.current_weight_kg,
    profile.target_weight_kg, profile.activity_level, profile.fitness_objective,
    new Date().toISOString(), profile.formula_setting ?? "mifflin_st_jeor",
    profile.language ?? "en", profile.unit_system ?? "metric"
  );
}

export async function addWeightMeasurement(weightKg: number) {
  const db = await database();
  await db.runAsync("INSERT INTO measurements (recorded_at, weight_kg, measurement_type, value, unit) VALUES (?, ?, 'weight', ?, 'kg')", new Date().toISOString(), weightKg, weightKg);
}

export async function getWeightMeasurements(): Promise<{ id: number; recorded_at: string; weight_kg: number }[]> {
  const db = await database();
  return db.getAllAsync("SELECT id, recorded_at, weight_kg FROM measurements WHERE measurement_type = 'weight' ORDER BY recorded_at DESC LIMIT 100");
}

export async function getDatabaseStatus() {
  const db = await database();
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}


export type FoodRecord = {
  id: number;
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  monounsaturated_fat_g: number | null;
  polyunsaturated_fat_g: number | null;
  starch_g: number | null;
  cholesterol_mg: number | null;
  water_g: number | null;
  data_quality: string;
};

export type MealFoodRecord = FoodRecord & {
  meal_item_id: number;
  quantity_g: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
};

export async function searchFoods(searchText: string): Promise<FoodRecord[]> {
  const db = await database();
  const term = `%${searchText.trim()}%`;
  return db.getAllAsync<FoodRecord>(
    `SELECT id, name, calories, protein_g, carbs_g, fat_g, fiber_g, COALESCE(total_sugars_g, sugar_g) AS sugar_g, saturated_fat_g, trans_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g, starch_g, cholesterol_mg, water_g, data_quality
     FROM foods WHERE name LIKE ? COLLATE NOCASE ORDER BY name LIMIT 50`,
    term
  );
}

export async function createFood(food: {
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  total_sugars_g?: number | null;
  starch_g?: number | null;
  cholesterol_mg?: number | null;
  saturated_fat_g?: number | null;
  trans_fat_g?: number | null;
  monounsaturated_fat_g?: number | null;
  polyunsaturated_fat_g?: number | null;
  water_g?: number | null;
  nutrients?: { name: string; unit: string; amount: number | null }[];
}) {
  const db = await database();
  const name = food.name.trim();
  if (!name) throw new Error("Food name is required");
  const values = [food.calories, food.protein_g, food.carbs_g, food.fat_g, food.fiber_g ?? null];
  if (values.some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
    throw new Error("Nutrition values must be non-negative numbers or unknown");
  }
  const result = await db.runAsync(
    `INSERT INTO foods (name, calories, protein_g, carbs_g, fat_g, fiber_g, total_sugars_g, starch_g, cholesterol_mg, saturated_fat_g, trans_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g, water_g, source, data_quality)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user_entry', 'user_entered')`,
    name, ...values, food.total_sugars_g ?? null, food.starch_g ?? null, food.cholesterol_mg ?? null,
    food.saturated_fat_g ?? null, food.trans_fat_g ?? null, food.monounsaturated_fat_g ?? null,
    food.polyunsaturated_fat_g ?? null, food.water_g ?? null
  );
  const foodId = result.lastInsertRowId;
  for (const nutrient of food.nutrients ?? []) {
    if (nutrient.amount === null) continue;
    if (!Number.isFinite(nutrient.amount) || nutrient.amount < 0) throw new Error("Nutrient amounts must be non-negative or unknown");
    await db.runAsync("INSERT OR IGNORE INTO nutrients (name, unit) VALUES (?, ?)", nutrient.name, nutrient.unit);
    await db.runAsync(
      "INSERT OR REPLACE INTO food_nutrients (food_id, nutrient_id, amount) SELECT ?, id, ? FROM nutrients WHERE name = ?",
      foodId, nutrient.amount, nutrient.name
    );
  }
  return foodId;
}

export async function addFoodToMeal(
  foodId: number,
  mealType: "breakfast" | "lunch" | "dinner" | "snacks",
  quantityGrams: number,
  date = new Date()
) {
  if (!Number.isFinite(quantityGrams) || quantityGrams <= 0) throw new Error("Quantity must be greater than zero");
  const db = await database();
  const day = date.toISOString().slice(0, 10);
  await db.withTransactionAsync(async () => {
    let meal = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM meals WHERE eaten_at LIKE ? AND meal_type = ? ORDER BY id LIMIT 1",
      `${day}%`, mealType
    );
    if (!meal) {
      const created = await db.runAsync(
        "INSERT INTO meals (eaten_at, meal_type) VALUES (?, ?)",
        date.toISOString(), mealType
      );
      meal = { id: created.lastInsertRowId };
    }
    await db.runAsync(
      "INSERT INTO meal_items (meal_id, food_id, quantity_g) VALUES (?, ?, ?)",
      meal.id, foodId, quantityGrams
    );
  });
}

export async function getDailyMealFoods(date = new Date()): Promise<MealFoodRecord[]> {
  const db = await database();
  const day = date.toISOString().slice(0, 10);
  return db.getAllAsync<MealFoodRecord>(
    `SELECT mi.id AS meal_item_id, mi.quantity_g, m.meal_type,
      f.id, f.name, f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, COALESCE(f.total_sugars_g, f.sugar_g) AS sugar_g, f.saturated_fat_g, f.trans_fat_g, f.monounsaturated_fat_g, f.polyunsaturated_fat_g, f.starch_g, f.cholesterol_mg, f.water_g, f.data_quality
     FROM meal_items mi
     JOIN meals m ON m.id = mi.meal_id
     JOIN foods f ON f.id = mi.food_id
     WHERE m.eaten_at LIKE ?
     ORDER BY m.id, mi.id`,
    `${day}%`
  );
}

export async function removeMealFood(mealItemId: number) {
  const db = await database();
  await db.runAsync("DELETE FROM meal_items WHERE id = ?", mealItemId);
}

export function nutritionForQuantity(food: FoodRecord, quantityGrams: number) {
  const factor = quantityGrams / 100;
  return {
    calories: food.calories === null ? null : food.calories * factor,
    protein_g: food.protein_g === null ? null : food.protein_g * factor,
    carbs_g: food.carbs_g === null ? null : food.carbs_g * factor,
    fat_g: food.fat_g === null ? null : food.fat_g * factor,
    fiber_g: food.fiber_g === null ? null : food.fiber_g * factor
  };
}


export type FoodNutrientDetail = { name: string; unit: string; amount: number | null };

export async function getFoodNutrients(foodId: number): Promise<FoodNutrientDetail[]> {
  const db = await database();
  return db.getAllAsync<FoodNutrientDetail>(
    `SELECT n.name, n.unit, fn.amount
     FROM nutrients n LEFT JOIN food_nutrients fn
       ON fn.nutrient_id = n.id AND fn.food_id = ?
     ORDER BY n.id`,
    foodId
  );
}


export type ImportedFoodRecord = {
  name: string;
  sourceId: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  total_sugars_g?: number | null;
  starch_g?: number | null;
  cholesterol_mg?: number | null;
  saturated_fat_g?: number | null;
  trans_fat_g?: number | null;
  monounsaturated_fat_g?: number | null;
  polyunsaturated_fat_g?: number | null;
  water_g?: number | null;
  nutrients: { name: string; unit: string; amount: number | null }[];
  category?: string;
  servings?: { label: string; grams: number }[];
};

export async function importFoodCatalogue(records: ImportedFoodRecord[]) {
  const db = await database();
  let imported = 0;
  await db.withTransactionAsync(async () => {
    for (const food of records) {
      const result = await db.runAsync(
        `INSERT INTO foods
          (name, source, source_id, calories, protein_g, carbs_g, fat_g, fiber_g,
           total_sugars_g, starch_g, cholesterol_mg, saturated_fat_g, trans_fat_g,
           monounsaturated_fat_g, polyunsaturated_fat_g, water_g, data_quality)
         VALUES (?, 'USDA FoodData Central', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified_source')
         ON CONFLICT(source, source_id) DO UPDATE SET
           name=excluded.name, calories=excluded.calories, protein_g=excluded.protein_g,
           carbs_g=excluded.carbs_g, fat_g=excluded.fat_g, fiber_g=excluded.fiber_g,
           total_sugars_g=excluded.total_sugars_g, starch_g=excluded.starch_g,
           cholesterol_mg=excluded.cholesterol_mg, saturated_fat_g=excluded.saturated_fat_g,
           trans_fat_g=excluded.trans_fat_g, monounsaturated_fat_g=excluded.monounsaturated_fat_g,
           polyunsaturated_fat_g=excluded.polyunsaturated_fat_g, water_g=excluded.water_g,
           data_quality='verified_source'`,
        food.name, food.sourceId, food.calories, food.protein_g, food.carbs_g, food.fat_g,
        food.fiber_g, food.total_sugars_g ?? null, food.starch_g ?? null,
        food.cholesterol_mg ?? null, food.saturated_fat_g ?? null, food.trans_fat_g ?? null,
        food.monounsaturated_fat_g ?? null, food.polyunsaturated_fat_g ?? null, food.water_g ?? null
      );
      if (food.category) {
        await db.runAsync("INSERT OR IGNORE INTO food_categories (name) VALUES (?)", food.category);
        await db.runAsync("UPDATE foods SET category_id = (SELECT id FROM food_categories WHERE name = ?) WHERE source = 'USDA FoodData Central' AND source_id = ?", food.category, food.sourceId);
      }
      const stored = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM foods WHERE source = 'USDA FoodData Central' AND source_id = ?",
        food.sourceId
      );
      if (!stored) continue;
      for (const serving of food.servings ?? []) {
        await db.runAsync("INSERT INTO food_servings (food_id, label, grams) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM food_servings WHERE food_id = ? AND label = ? AND grams = ?)", stored.id, serving.label, serving.grams, stored.id, serving.label, serving.grams);
      }
      for (const nutrient of food.nutrients) {
        await db.runAsync("INSERT OR IGNORE INTO nutrients (name, unit) VALUES (?, ?)", nutrient.name, nutrient.unit);
        if (nutrient.amount === null) continue;
        await db.runAsync(
          "INSERT OR REPLACE INTO food_nutrients (food_id, nutrient_id, amount) SELECT ?, id, ? FROM nutrients WHERE name = ?",
          stored.id, nutrient.amount, nutrient.name
        );
      }
      imported += 1;
    }
  });
  return imported;
}


export async function getDailyNutrientTotals(date = new Date()) {
  const db = await database();
  const day = date.toISOString().slice(0, 10);
  return db.getAllAsync<{ name: string; unit: string; amount: number }>(
    `SELECT n.name, n.unit, SUM(fn.amount * mi.quantity_g / 100.0) AS amount
     FROM meal_items mi
     JOIN meals m ON m.id = mi.meal_id
     JOIN food_nutrients fn ON fn.food_id = mi.food_id
     JOIN nutrients n ON n.id = fn.nutrient_id
     WHERE m.eaten_at LIKE ?
     GROUP BY n.id, n.name, n.unit
     ORDER BY n.name`,
    `${day}%`
  );
}

export async function getFoodServings(foodId: number) {
  const db = await database();
  return db.getAllAsync<{ id: number; label: string; grams: number }>(
    "SELECT id, label, grams FROM food_servings WHERE food_id = ? ORDER BY grams", foodId
  );
}

export async function saveFoodServing(foodId: number, label: string, grams: number) {
  if (!label.trim() || !Number.isFinite(grams) || grams <= 0) throw new Error("Enter a serving name and a positive gram amount.");
  const db = await database();
  await db.runAsync("INSERT INTO food_servings (food_id, label, grams) VALUES (?, ?, ?)", foodId, label.trim(), grams);
}

export async function getFoodCategories() {
  const db = await database();
  return db.getAllAsync<{ id: number; name: string }>("SELECT id, name FROM food_categories ORDER BY name");
}

export async function logActivity(activity: string, durationMinutes: number, caloriesBurned: number | null, notes?: string) {
  if (!activity.trim() || !Number.isFinite(durationMinutes) || durationMinutes < 0) throw new Error("Enter a valid activity and duration.");
  if (caloriesBurned !== null && (!Number.isFinite(caloriesBurned) || caloriesBurned < 0)) throw new Error("Calories burned must be non-negative or unknown.");
  const db = await database();
  await db.runAsync("INSERT INTO activity_logs (logged_at, activity, duration_minutes, calories_burned, notes) VALUES (?, ?, ?, ?, ?)",
    new Date().toISOString(), activity.trim(), durationMinutes, caloriesBurned, notes ?? null);
}


export async function addBodyMeasurement(type: string, value: number, unit: string) {
  if (!type.trim() || !unit.trim() || !Number.isFinite(value) || value <= 0) {
    throw new Error("Enter a measurement type, unit and positive value.");
  }
  const db = await database();
  await db.runAsync(
    "INSERT INTO body_measurements (recorded_at, measurement_type, value, unit) VALUES (?, ?, ?, ?)",
    new Date().toISOString(), type.trim().toLowerCase(), value, unit.trim()
  );
}

export async function getBodyMeasurements() {
  const db = await database();
  return db.getAllAsync<{ id: number; recorded_at: string; measurement_type: string; value: number; unit: string }>(
    "SELECT id, recorded_at, measurement_type, value, unit FROM body_measurements ORDER BY recorded_at DESC LIMIT 200"
  );
}


export async function ensureFoundationFoodsImported(records: ImportedFoodRecord[]) {
  if (!records.length) return { imported: 0, skipped: true };
  const db = await database();
  const key = "usda_foundation_foods_2026_10";
  const existing = await db.getFirstAsync<{ imported_count: number }>(
    "SELECT imported_count FROM seed_imports WHERE seed_key = ?", key
  );
  if (existing) return { imported: existing.imported_count, skipped: true };
  const imported = await importFoodCatalogue(records);
  await db.runAsync(
    "INSERT OR REPLACE INTO seed_imports (seed_key, imported_count, imported_at) VALUES (?, ?, ?)",
    key, imported, new Date().toISOString()
  );
  return { imported, skipped: false };
}
