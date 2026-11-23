import * as SQLite from "expo-sqlite";

export type StoredProfile = {
  name?: string;
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
  waist_cm?: number | null; hip_cm?: number | null; neck_cm?: number | null; body_fat_percent?: number | null; muscle_mass_kg?: number | null;
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
          name TEXT NOT NULL DEFAULT '',
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
          unit_system TEXT NOT NULL DEFAULT 'metric', waist_cm REAL, hip_cm REAL, neck_cm REAL, body_fat_percent REAL, muscle_mass_kg REAL
        );
        CREATE TABLE IF NOT EXISTS local_profile_photo (id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1), data_uri TEXT NOT NULL, updated_at TEXT NOT NULL);
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
        CREATE TABLE IF NOT EXISTS custom_meals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS custom_meal_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          custom_meal_id INTEGER NOT NULL REFERENCES custom_meals(id) ON DELETE CASCADE,
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
        CREATE TABLE IF NOT EXISTS saved_meal_planner_plan (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          plan_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reminder_settings (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          breakfast_enabled INTEGER NOT NULL DEFAULT 1, breakfast_time TEXT NOT NULL DEFAULT '08:00',
          lunch_enabled INTEGER NOT NULL DEFAULT 1, lunch_time TEXT NOT NULL DEFAULT '13:00',
          dinner_enabled INTEGER NOT NULL DEFAULT 1, dinner_time TEXT NOT NULL DEFAULT '19:00',
          snacks_enabled INTEGER NOT NULL DEFAULT 0, snacks_time TEXT NOT NULL DEFAULT '16:00',
          water_enabled INTEGER NOT NULL DEFAULT 1, water_interval_minutes INTEGER NOT NULL DEFAULT 120,
          water_start_time TEXT NOT NULL DEFAULT '08:00', water_end_time TEXT NOT NULL DEFAULT '22:00'
        );
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          logged_at TEXT NOT NULL,
          activity TEXT NOT NULL,
          duration_minutes INTEGER,
          calories_burned REAL,
          notes TEXT
        );
        CREATE TABLE IF NOT EXISTS challenge_checkins (
          challenge_id TEXT NOT NULL,
          completed_day TEXT NOT NULL,
          PRIMARY KEY (challenge_id, completed_day)
        );
        CREATE INDEX IF NOT EXISTS idx_measurements_date ON measurements(recorded_at);
        CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(eaten_at);
        CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_food_servings_unique ON food_servings(food_id, label, grams);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_source_id ON foods(source, source_id) WHERE source_id IS NOT NULL;
      `);

      // Additive migrations preserve data already stored on users' devices.
      const profileColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(user_profile)");
      const profileNames = new Set(profileColumns.map(column => column.name));
      const profileAdditions: Record<string, string> = {
        name: "TEXT NOT NULL DEFAULT ''",
        formula_setting: "TEXT NOT NULL DEFAULT 'mifflin_st_jeor'",
        language: "TEXT NOT NULL DEFAULT 'en'",
        unit_system: "TEXT NOT NULL DEFAULT 'metric'", waist_cm: "REAL", hip_cm: "REAL", neck_cm: "REAL", body_fat_percent: "REAL", muscle_mass_kg: "REAL"
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

      const optionalFoodColumnNames = new Set(foodColumns.map(column => column.name));
      const optionalColumns: Record<string, string> = {
        total_sugars_g: "REAL", starch_g: "REAL", cholesterol_mg: "REAL",
        trans_fat_g: "REAL", monounsaturated_fat_g: "REAL",
        polyunsaturated_fat_g: "REAL", water_g: "REAL",
        ingredients_text: "TEXT", allergens_text: "TEXT", traces_text: "TEXT", additives_text: "TEXT"
      };
      for (const [column, type] of Object.entries(optionalColumns)) {
        if (!optionalFoodColumnNames.has(column)) await db.execAsync(`ALTER TABLE foods ADD COLUMN ${column} ${type}`);
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
  return db.getFirstAsync<StoredProfile>("SELECT name, age, sex, height_cm, current_weight_kg, target_weight_kg, activity_level, fitness_objective, formula_setting, language, unit_system, waist_cm, hip_cm, neck_cm, body_fat_percent, muscle_mass_kg FROM user_profile WHERE id = 1");
}

export async function saveProfile(profile: StoredProfile) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO user_profile
      (id, name, age, sex, height_cm, current_weight_kg, target_weight_kg, activity_level, fitness_objective, updated_at, formula_setting, language, unit_system, waist_cm, hip_cm, neck_cm, body_fat_percent, muscle_mass_kg)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, age=excluded.age, sex=excluded.sex, height_cm=excluded.height_cm,
      current_weight_kg=excluded.current_weight_kg, target_weight_kg=excluded.target_weight_kg,
      activity_level=excluded.activity_level, fitness_objective=excluded.fitness_objective,
      updated_at=excluded.updated_at, formula_setting=excluded.formula_setting,
      language=excluded.language, unit_system=excluded.unit_system,
      waist_cm=excluded.waist_cm, hip_cm=excluded.hip_cm, neck_cm=excluded.neck_cm,
      body_fat_percent=excluded.body_fat_percent, muscle_mass_kg=excluded.muscle_mass_kg`,
    profile.name ?? '', profile.age, profile.sex, profile.height_cm, profile.current_weight_kg,
    profile.target_weight_kg, profile.activity_level, profile.fitness_objective,
    new Date().toISOString(), profile.formula_setting ?? "mifflin_st_jeor",
    profile.language ?? "en", profile.unit_system ?? "metric",
    profile.waist_cm ?? null, profile.hip_cm ?? null, profile.neck_cm ?? null,
    profile.body_fat_percent ?? null, profile.muscle_mass_kg ?? null
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

export async function updateWeightMeasurement(id: number, weightKg: number): Promise<void> {
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error("Weight must be greater than zero.");
  const db = await database();
  await db.runAsync(
    "UPDATE measurements SET weight_kg = ?, value = ? WHERE id = ? AND measurement_type = 'weight'",
    weightKg, weightKg, id
  );
}

export async function clearWeightMeasurements(): Promise<void> {
  const db = await database();
  await db.runAsync("DELETE FROM measurements WHERE measurement_type = 'weight'");
}


export type ActivityLog = { id: number; logged_at: string; activity: string; duration_minutes: number | null; calories_burned: number | null; notes: string | null };

export async function addActivityLog(activity: string, durationMinutes: number, caloriesBurned: number | null, notes = ""): Promise<void> {
  const db = await database();
  await db.runAsync("INSERT INTO activity_logs (logged_at, activity, duration_minutes, calories_burned, notes) VALUES (?, ?, ?, ?, ?)", new Date().toISOString(), activity, durationMinutes, caloriesBurned, notes);
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const db = await database();
  return db.getAllAsync<ActivityLog>("SELECT id, logged_at, activity, duration_minutes, calories_burned, notes FROM activity_logs ORDER BY logged_at DESC LIMIT 100");
}

export async function deleteActivityLog(id: number): Promise<void> {
  const db = await database();
  await db.runAsync("DELETE FROM activity_logs WHERE id = ?", id);
}

export async function deleteActivityLogsForDay(startIso: string, endIso: string): Promise<void> {
  const db = await database();
  await db.runAsync("DELETE FROM activity_logs WHERE logged_at >= ? AND logged_at < ?", startIso, endIso);
}

export async function getChallengeCheckins(): Promise<{ challenge_id: string; completed_day: string }[]> {
  const db = await database();
  return db.getAllAsync("SELECT challenge_id, completed_day FROM challenge_checkins ORDER BY completed_day DESC");
}

export async function toggleChallengeCheckin(challengeId: string, day: string): Promise<void> {
  const db = await database();
  const existing = await db.getFirstAsync<{ challenge_id: string }>("SELECT challenge_id FROM challenge_checkins WHERE challenge_id = ? AND completed_day = ?", challengeId, day);
  if (existing) await db.runAsync("DELETE FROM challenge_checkins WHERE challenge_id = ? AND completed_day = ?", challengeId, day);
  else await db.runAsync("INSERT INTO challenge_checkins (challenge_id, completed_day) VALUES (?, ?)", challengeId, day);
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
  source?: string | null;
  ingredients_text?: string | null;
  allergens_text?: string | null;
  traces_text?: string | null;
  additives_text?: string | null;
};

export type MealFoodRecord = FoodRecord & {
  meal_item_id: number;
  quantity_g: number;
  meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
};

export async function searchFoods(searchText: string, categoryPattern?: string): Promise<FoodRecord[]> {
  const db = await database();
  const term = `%${searchText.trim()}%`;
  const patterns = categoryPattern?.split("|") ?? [];
  const categoryClause = patterns.length ? ` AND (${patterns.flatMap(() => ["fc.name LIKE ? COLLATE NOCASE", "f.name LIKE ? COLLATE NOCASE"]).join(" OR ")})` : "";
  return db.getAllAsync<FoodRecord>(
    `SELECT f.id, f.name, f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, COALESCE(f.total_sugars_g, f.sugar_g) AS sugar_g, f.saturated_fat_g, f.trans_fat_g, f.monounsaturated_fat_g, f.polyunsaturated_fat_g, f.starch_g, f.cholesterol_mg, f.water_g, f.data_quality
     FROM foods f LEFT JOIN food_categories fc ON fc.id = f.category_id
     WHERE f.name LIKE ? COLLATE NOCASE${categoryClause} ORDER BY f.name LIMIT 100`,
    ...(patterns.length ? [term, ...patterns.flatMap(pattern => [`%${pattern}%`, `%${pattern}%`])] : [term])
  );
}


export type NutrientFoodResult = FoodRecord & { nutrient_amount: number; nutrient_unit: string };

// Rank foods by verified nutrient values per 100 g. Missing values are excluded.
export async function searchFoodsByNutrient(nutrient: string, direction: "high" | "low" = "high"): Promise<NutrientFoodResult[]> {
  const db = await database();
  const columns: Record<string, { column: string; unit: string }> = {
    Calories: { column: "calories", unit: "kcal" }, Protein: { column: "protein_g", unit: "g" },
    Carbohydrates: { column: "carbs_g", unit: "g" }, Fat: { column: "fat_g", unit: "g" },
    Fiber: { column: "fiber_g", unit: "g" }, Sugars: { column: "COALESCE(f.total_sugars_g, f.sugar_g)", unit: "g" },
    "Saturated fat": { column: "saturated_fat_g", unit: "g" }, "Trans fat": { column: "trans_fat_g", unit: "g" },
    "Monounsaturated fat": { column: "monounsaturated_fat_g", unit: "g" }, "Polyunsaturated fat": { column: "polyunsaturated_fat_g", unit: "g" },
    Starch: { column: "starch_g", unit: "g" }, Cholesterol: { column: "cholesterol_mg", unit: "mg" }, Water: { column: "water_g", unit: "g" }
  };
  // USDA stores many micronutrients under scientific/form-specific names, not just the short display label.
  const aliases: Record<string, string[]> = {
    "Vitamin A":["Vitamin A","Vitamin A, RAE","Retinol"],
    "Vitamin C":["Vitamin C","Vitamin C, total ascorbic acid"],
    "Vitamin D":["Vitamin D","Vitamin D (D2 + D3)","Vitamin D2","Vitamin D3"],
    "Vitamin E":["Vitamin E","Vitamin E (alpha-tocopherol)"],
    "Vitamin K":["Vitamin K","Vitamin K (phylloquinone)"],
    "Thiamin (B1)":["Thiamin (B1)","Thiamin","Thiamine"],
    "Riboflavin (B2)":["Riboflavin (B2)","Riboflavin"],
    "Niacin (B3)":["Niacin (B3)","Niacin"],
    "Pantothenic acid (B5)":["Pantothenic acid (B5)","Pantothenic acid"],
    "Vitamin B6":["Vitamin B6","Vitamin B-6"],
    "Biotin (B7)":["Biotin (B7)","Biotin"],
    "Folate (B9)":["Folate (B9)","Folate, total","Folate, DFE"],
    "Vitamin B12":["Vitamin B12","Vitamin B-12","Cobalamin"],
    Calcium:["Calcium","Calcium, Ca"], Iron:["Iron","Iron, Fe"],
    Magnesium:["Magnesium","Magnesium, Mg"], Phosphorus:["Phosphorus","Phosphorus, P"],
    Potassium:["Potassium","Potassium, K"], Sodium:["Sodium","Sodium, Na"],
    Zinc:["Zinc","Zinc, Zn"], Copper:["Copper","Copper, Cu"],
    Manganese:["Manganese","Manganese, Mn"], Selenium:["Selenium","Selenium, Se"],
    Iodine:["Iodine","Iodine, I"], Choline:["Choline","Choline, total"]
  };
  const column = columns[nutrient];
  const nutrientAliases = aliases[nutrient] ?? [nutrient];
  const unitDefaults: Record<string,string> = {
    "Vitamin A":"µg RAE","Vitamin C":"mg","Vitamin D":"µg","Vitamin E":"mg","Vitamin K":"µg",
    "Thiamin (B1)":"mg","Riboflavin (B2)":"mg","Niacin (B3)":"mg","Pantothenic acid (B5)":"mg",
    "Vitamin B6":"mg","Biotin (B7)":"µg","Folate (B9)":"µg","Vitamin B12":"µg",
    Calcium:"mg",Iron:"mg",Magnesium:"mg",Phosphorus:"mg",Potassium:"mg",Sodium:"mg",
    Zinc:"mg",Copper:"mg",Manganese:"mg",Selenium:"µg",Iodine:"µg",Choline:"mg"
  };
  const unit = column?.unit ?? (await db.getFirstAsync<{unit:string}>(
    "SELECT unit FROM nutrients WHERE lower(name) IN (" + nutrientAliases.map(()=>"?").join(",") + ") LIMIT 1",
    ...nutrientAliases.map(value=>value.toLowerCase())
  ))?.unit ?? unitDefaults[nutrient] ?? "mg";
  let expression: string;
  let args: string[];
  if (column) {
    expression = column.column.includes("(") ? column.column : "f." + column.column;
    args = [];
  } else {
    // COALESCE tries the preferred canonical nutrient first, then its USDA aliases.
    expression = "COALESCE(" + nutrientAliases.map(()=>"(SELECT fn.amount FROM food_nutrients fn JOIN nutrients n ON n.id=fn.nutrient_id WHERE fn.food_id=f.id AND lower(n.name)=lower(?) LIMIT 1)").join(",") + ")";
    args = nutrientAliases;
  }
  const sql = "SELECT f.id, f.name, f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, COALESCE(f.total_sugars_g, f.sugar_g) AS sugar_g, f.saturated_fat_g, f.trans_fat_g, f.monounsaturated_fat_g, f.polyunsaturated_fat_g, f.starch_g, f.cholesterol_mg, f.water_g, f.data_quality, " + expression + " AS nutrient_amount, ? AS nutrient_unit FROM foods f WHERE " + expression + " IS NOT NULL ORDER BY nutrient_amount " + (direction === "high" ? "DESC" : "ASC") + ", f.name COLLATE NOCASE LIMIT 50";
  return column
    ? db.getAllAsync<NutrientFoodResult>(sql, unit)
    : db.getAllAsync<NutrientFoodResult>(sql, ...args, unit, ...args);
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
  ingredients_text?: string | null;
  allergens_text?: string | null;
  traces_text?: string | null;
  additives_text?: string | null;
  nutrients?: { name: string; unit: string; amount: number | null }[];
  source?: string; sourceId?: string; dataQuality?: string;
}) {
  const db = await database();
  const name = food.name.trim();
  if (!name) throw new Error("Food name is required");
  const values = [food.calories, food.protein_g, food.carbs_g, food.fat_g, food.fiber_g ?? null];
  if (values.some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
    throw new Error("Nutrition values must be non-negative numbers or unknown");
  }
  const result = await db.runAsync(
    `INSERT INTO foods (name, calories, protein_g, carbs_g, fat_g, fiber_g, total_sugars_g, starch_g, cholesterol_mg, saturated_fat_g, trans_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g, water_g, source, source_id, data_quality, ingredients_text, allergens_text, traces_text, additives_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    name, ...values, food.total_sugars_g ?? null, food.starch_g ?? null, food.cholesterol_mg ?? null,
    food.saturated_fat_g ?? null, food.trans_fat_g ?? null, food.monounsaturated_fat_g ?? null,
    food.polyunsaturated_fat_g ?? null, food.water_g ?? null, food.source ?? 'user_entry', food.sourceId ?? null, food.dataQuality ?? 'user_entered',
    food.ingredients_text ?? null, food.allergens_text ?? null, food.traces_text ?? null, food.additives_text ?? null
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

export async function refreshScannedFood(food: Parameters<typeof createFood>[0]): Promise<number> {
  const db = await database();
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM foods WHERE source = ? AND source_id = ? LIMIT 1",
    food.source ?? "open_food_facts", food.sourceId ?? ""
  );
  if (!existing) return createFood(food);
  await db.runAsync(
    `UPDATE foods SET name=?, calories=?, protein_g=?, carbs_g=?, fat_g=?, fiber_g=?,
      total_sugars_g=?, starch_g=?, cholesterol_mg=?, saturated_fat_g=?, trans_fat_g=?,
      monounsaturated_fat_g=?, polyunsaturated_fat_g=?, water_g=?, data_quality=?,
      ingredients_text=?, allergens_text=?, traces_text=?, additives_text=?
      WHERE id=?`,
    food.name.trim(), food.calories, food.protein_g, food.carbs_g, food.fat_g, food.fiber_g ?? null,
    food.total_sugars_g ?? null, food.starch_g ?? null, food.cholesterol_mg ?? null,
    food.saturated_fat_g ?? null, food.trans_fat_g ?? null, food.monounsaturated_fat_g ?? null,
    food.polyunsaturated_fat_g ?? null, food.water_g ?? null, food.dataQuality ?? "third_party",
    food.ingredients_text ?? null, food.allergens_text ?? null, food.traces_text ?? null,
    food.additives_text ?? null, existing.id
  );
  await db.runAsync("DELETE FROM food_nutrients WHERE food_id = ?", existing.id);
  for (const nutrient of food.nutrients ?? []) {
    if (nutrient.amount === null) continue;
    await db.runAsync("INSERT OR IGNORE INTO nutrients (name, unit) VALUES (?, ?)", nutrient.name, nutrient.unit);
    await db.runAsync(
      "INSERT OR REPLACE INTO food_nutrients (food_id, nutrient_id, amount) SELECT ?, id, ? FROM nutrients WHERE name = ?",
      existing.id, nutrient.amount, nutrient.name
    );
  }
  return existing.id;
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

export async function addFoodPlanToDiary(
  items: { foodId: number; mealType: "breakfast" | "lunch" | "dinner" | "snacks"; quantityGrams: number }[],
  date = new Date()
) {
  if (!items.length) throw new Error("The meal plan is empty.");
  if (items.some(item => !Number.isInteger(item.foodId) || item.foodId <= 0 ||
    !["breakfast", "lunch", "dinner", "snacks"].includes(item.mealType) ||
    !Number.isFinite(item.quantityGrams) || item.quantityGrams <= 0)) {
    throw new Error("The meal plan contains an invalid food or quantity.");
  }
  const db = await database();
  const day = date.toISOString().slice(0, 10);
  const timestamp = date.toISOString();
  await db.withTransactionAsync(async () => {
    const mealIds = new Map<string, number>();
    for (const item of items) {
      let mealId = mealIds.get(item.mealType);
      if (!mealId) {
        const existing = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM meals WHERE eaten_at LIKE ? AND meal_type = ? ORDER BY id LIMIT 1",
          `${day}%`, item.mealType
        );
        if (existing) mealId = existing.id;
        else {
          const created = await db.runAsync(
            "INSERT INTO meals (eaten_at, meal_type) VALUES (?, ?)",
            timestamp, item.mealType
          );
          mealId = created.lastInsertRowId;
        }
        mealIds.set(item.mealType, mealId);
      }
      const food = await db.getFirstAsync<{ id: number }>("SELECT id FROM foods WHERE id = ?", item.foodId);
      if (!food) throw new Error("A food in this plan is no longer available. Generate the plan again.");
      await db.runAsync(
        "INSERT INTO meal_items (meal_id, food_id, quantity_g) VALUES (?, ?, ?)",
        mealId, item.foodId, item.quantityGrams
      );
    }
  });
}


export type CustomMealSummary = { id: number; name: string; ingredient_count: number };
export type CustomMealItem = { food_id: number; name: string; quantity_g: number; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };

export async function saveCustomMeal(name: string, items: { foodId: number; quantityGrams: number }[]) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Enter a meal name.");
  if (!items.length) throw new Error("Add at least one ingredient.");
  if (items.some(item => !Number.isFinite(item.quantityGrams) || item.quantityGrams <= 0)) throw new Error("Ingredient quantities must be greater than zero.");
  const db = await database();
  return db.withTransactionAsync(async () => {
    const result = await db.runAsync("INSERT INTO custom_meals (name, created_at) VALUES (?, ?)", cleanName, new Date().toISOString());
    const mealId = result.lastInsertRowId;
    for (const item of items) {
      await db.runAsync("INSERT INTO custom_meal_items (custom_meal_id, food_id, quantity_g) VALUES (?, ?, ?)", mealId, item.foodId, item.quantityGrams);
    }
  });
}

export async function getCustomMeals(): Promise<CustomMealSummary[]> {
  const db = await database();
  return db.getAllAsync<CustomMealSummary>(
    "SELECT m.id, m.name, COUNT(i.id) AS ingredient_count FROM custom_meals m LEFT JOIN custom_meal_items i ON i.custom_meal_id=m.id GROUP BY m.id ORDER BY m.name COLLATE NOCASE"
  );
}

export async function getCustomMealItems(mealId: number): Promise<CustomMealItem[]> {
  const db = await database();
  return db.getAllAsync<CustomMealItem>(
    `SELECT f.id AS food_id, f.name, i.quantity_g, f.calories, f.protein_g, f.carbs_g, f.fat_g
     FROM custom_meal_items i JOIN foods f ON f.id=i.food_id WHERE i.custom_meal_id=? ORDER BY i.id`, mealId
  );
}

export async function addCustomMealToDiary(mealId: number, mealType: "breakfast" | "lunch" | "dinner" | "snacks") {
  const items = await getCustomMealItems(mealId);
  if (!items.length) throw new Error("This saved meal has no ingredients.");
  for (const item of items) await addFoodToMeal(item.food_id, mealType, item.quantity_g);
}

export async function deleteCustomMeal(mealId: number) {
  const db = await database();
  await db.runAsync("DELETE FROM custom_meals WHERE id=?", mealId);
}

export async function getFoodBySourceId(source: string, sourceId: string): Promise<FoodRecord | null> {
  const db = await database();
  return (await db.getFirstAsync<FoodRecord>(
    `SELECT id, name, calories, protein_g, carbs_g, fat_g, fiber_g,
      COALESCE(total_sugars_g, sugar_g) AS sugar_g, saturated_fat_g,
      trans_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g,
      starch_g, cholesterol_mg, water_g, data_quality, source,
      ingredients_text, allergens_text, traces_text, additives_text
     FROM foods WHERE source = ? AND source_id = ? LIMIT 1`,
    source, sourceId
  )) ?? null;
}

export async function getMealPlannerFoods(): Promise<FoodRecord[]> {
  const db = await database();
  return db.getAllAsync<FoodRecord>(
    `SELECT id, name, calories, protein_g, carbs_g, fat_g, fiber_g,
      COALESCE(total_sugars_g, sugar_g) AS sugar_g, saturated_fat_g,
      trans_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g,
      starch_g, cholesterol_mg, water_g, data_quality
     FROM foods
     WHERE calories IS NOT NULL AND calories > 0
       AND protein_g IS NOT NULL AND carbs_g IS NOT NULL AND fat_g IS NOT NULL
     ORDER BY RANDOM() LIMIT 500`
  );
}

export async function saveMealPlannerPlan(planJson: string): Promise<void> {
  const db = await database();
  await db.runAsync(
    "INSERT INTO saved_meal_planner_plan (id, plan_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET plan_json = excluded.plan_json, updated_at = excluded.updated_at",
    planJson,
    new Date().toISOString()
  );
}

export async function getSavedMealPlannerPlan(): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ plan_json: string }>(
    "SELECT plan_json FROM saved_meal_planner_plan WHERE id = 1"
  );
  return row?.plan_json ?? null;
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
     FROM food_nutrients fn
     JOIN nutrients n ON n.id = fn.nutrient_id
     WHERE fn.food_id = ? AND fn.amount IS NOT NULL
     ORDER BY n.name`,
    foodId
  );
}

export async function getCustomFoodNutrients(foodId: number): Promise<FoodNutrientDetail[]> {
  return getFoodNutrients(foodId);
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
  if (!records.length) return 0;
  const chunk = <T,>(items: T[], size: number) => {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
    return batches;
  };
  let imported = 0;
  await db.withTransactionAsync(async () => {
    const categories = [...new Set(records.map(food => food.category).filter((value): value is string => Boolean(value)))];
    for (const category of categories) {
      await db.runAsync("INSERT OR IGNORE INTO food_categories (name) VALUES (?)", category);
    }
    const categoryRows = await db.getAllAsync<{ id: number; name: string }>("SELECT id, name FROM food_categories");
    const categoryIds = new Map(categoryRows.map(row => [row.name, row.id]));

    // Batch food upserts to avoid hundreds of thousands of individual bridge calls.
    for (const batch of chunk(records, 40)) {
      const tuple = "(" + Array(18).fill("?").join(",") + ")";
      const sql = `INSERT INTO foods
        (name, source, source_id, calories, protein_g, carbs_g, fat_g, fiber_g,
         total_sugars_g, starch_g, cholesterol_mg, saturated_fat_g, trans_fat_g,
         monounsaturated_fat_g, polyunsaturated_fat_g, water_g, data_quality, category_id)
        VALUES ${batch.map(() => tuple).join(",")}
        ON CONFLICT(source, source_id) WHERE source_id IS NOT NULL DO UPDATE SET
         name=excluded.name, calories=excluded.calories, protein_g=excluded.protein_g,
         carbs_g=excluded.carbs_g, fat_g=excluded.fat_g, fiber_g=excluded.fiber_g,
         total_sugars_g=excluded.total_sugars_g, starch_g=excluded.starch_g,
         cholesterol_mg=excluded.cholesterol_mg, saturated_fat_g=excluded.saturated_fat_g,
         trans_fat_g=excluded.trans_fat_g, monounsaturated_fat_g=excluded.monounsaturated_fat_g,
         polyunsaturated_fat_g=excluded.polyunsaturated_fat_g, water_g=excluded.water_g,
         data_quality='verified_source', category_id=excluded.category_id`;
      const params: (string | number | null)[] = [];
      for (const food of batch) {
        params.push(
          food.name, "USDA FoodData Central", food.sourceId, food.calories, food.protein_g,
          food.carbs_g, food.fat_g, food.fiber_g, food.total_sugars_g ?? null,
          food.starch_g ?? null, food.cholesterol_mg ?? null, food.saturated_fat_g ?? null,
          food.trans_fat_g ?? null, food.monounsaturated_fat_g ?? null,
          food.polyunsaturated_fat_g ?? null, food.water_g ?? null, "verified_source",
          food.category ? categoryIds.get(food.category) ?? null : null
        );
      }
      await db.runAsync(sql, ...params);
    }

    const foodIds = new Map<string, number>();
    for (const ids of chunk(records.map(food => food.sourceId), 400)) {
      const placeholders = ids.map(() => "?").join(",");
      const rows = await db.getAllAsync<{ id: number; source_id: string }>(
        `SELECT id, source_id FROM foods WHERE source = 'USDA FoodData Central' AND source_id IN (${placeholders})`,
        ...ids
      );
      for (const row of rows) foodIds.set(row.source_id, row.id);
    }

    const nutrientDefinitions = new Map<string, string>();
    for (const food of records) {
      for (const nutrient of food.nutrients) {
        if (!nutrientDefinitions.has(nutrient.name)) nutrientDefinitions.set(nutrient.name, nutrient.unit || "unknown");
      }
    }
    for (const [name, unit] of nutrientDefinitions) {
      await db.runAsync("INSERT OR IGNORE INTO nutrients (name, unit) VALUES (?, ?)", name, unit);
    }
    const nutrientRows = await db.getAllAsync<{ id: number; name: string }>("SELECT id, name FROM nutrients");
    const nutrientIds = new Map(nutrientRows.map(row => [row.name, row.id]));

    // Store the complete USDA nutrient profile (including vitamins, minerals and fatty-acid detail).
    let nutrientBatch: (number | string)[] = [];
    const flushNutrients = async () => {
      if (!nutrientBatch.length) return;
      const rowCount = nutrientBatch.length / 3;
      const values = Array(rowCount).fill("(?,?,?)").join(",");
      await db.runAsync(
        `INSERT OR REPLACE INTO food_nutrients (food_id, nutrient_id, amount) VALUES ${values}`,
        ...nutrientBatch
      );
      nutrientBatch = [];
    };
    for (const food of records) {
      const foodId = foodIds.get(food.sourceId);
      if (!foodId) continue;
      for (const nutrient of food.nutrients) {
        const nutrientId = nutrientIds.get(nutrient.name);
        if (nutrientId === undefined || nutrient.amount === null) continue;
        nutrientBatch.push(foodId, nutrientId, nutrient.amount);
        if (nutrientBatch.length >= 750) await flushNutrients();
      }
    }
    await flushNutrients();

    // Serving weights are also inserted in batches; a unique index prevents duplicates on re-import.
    const servingBatch: (number | string)[][] = [];
    const flushServings = async () => {
      if (!servingBatch.length) return;
      const values = servingBatch.map(() => "(?,?,?)").join(",");
      const params = servingBatch.flat();
      await db.runAsync(
        `INSERT OR IGNORE INTO food_servings (food_id, label, grams) VALUES ${values}`,
        ...params
      );
      servingBatch.length = 0;
    };
    for (const food of records) {
      const foodId = foodIds.get(food.sourceId);
      if (!foodId) continue;
      for (const serving of food.servings ?? []) {
        servingBatch.push([foodId, serving.label, serving.grams]);
        if (servingBatch.length >= 250) await flushServings();
      }
    }
    await flushServings();
    imported = records.length;
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

export type ReminderPreferences = {
  breakfast_enabled: boolean; breakfast_time: string;
  lunch_enabled: boolean; lunch_time: string;
  dinner_enabled: boolean; dinner_time: string;
  snacks_enabled: boolean; snacks_time: string;
  water_enabled: boolean; water_interval_minutes: number;
  water_start_time: string; water_end_time: string;
};

const DEFAULT_REMINDERS: ReminderPreferences = {
  breakfast_enabled: true, breakfast_time: "08:00",
  lunch_enabled: true, lunch_time: "13:00",
  dinner_enabled: true, dinner_time: "19:00",
  snacks_enabled: false, snacks_time: "16:00",
  water_enabled: true, water_interval_minutes: 120,
  water_start_time: "08:00", water_end_time: "22:00"
};

export async function getReminderPreferences(): Promise<ReminderPreferences> {
  const db = await database();
  const row = await db.getFirstAsync<any>("SELECT * FROM reminder_settings WHERE id = 1");
  if (!row) return { ...DEFAULT_REMINDERS };
  return {
    breakfast_enabled: !!row.breakfast_enabled, breakfast_time: row.breakfast_time,
    lunch_enabled: !!row.lunch_enabled, lunch_time: row.lunch_time,
    dinner_enabled: !!row.dinner_enabled, dinner_time: row.dinner_time,
    snacks_enabled: !!row.snacks_enabled, snacks_time: row.snacks_time,
    water_enabled: !!row.water_enabled, water_interval_minutes: row.water_interval_minutes,
    water_start_time: row.water_start_time, water_end_time: row.water_end_time
  };
}

export async function saveReminderPreferences(p: ReminderPreferences): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO reminder_settings
      (id, breakfast_enabled, breakfast_time, lunch_enabled, lunch_time, dinner_enabled, dinner_time,
       snacks_enabled, snacks_time, water_enabled, water_interval_minutes, water_start_time, water_end_time)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       breakfast_enabled=excluded.breakfast_enabled, breakfast_time=excluded.breakfast_time,
       lunch_enabled=excluded.lunch_enabled, lunch_time=excluded.lunch_time,
       dinner_enabled=excluded.dinner_enabled, dinner_time=excluded.dinner_time,
       snacks_enabled=excluded.snacks_enabled, snacks_time=excluded.snacks_time,
       water_enabled=excluded.water_enabled, water_interval_minutes=excluded.water_interval_minutes,
       water_start_time=excluded.water_start_time, water_end_time=excluded.water_end_time`,
    p.breakfast_enabled ? 1 : 0, p.breakfast_time, p.lunch_enabled ? 1 : 0, p.lunch_time,
    p.dinner_enabled ? 1 : 0, p.dinner_time, p.snacks_enabled ? 1 : 0, p.snacks_time, p.water_enabled ? 1 : 0,
    p.water_interval_minutes, p.water_start_time, p.water_end_time
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


export async function ensureFoodCatalogueImported(
  seedKey: string,
  source: ImportedFoodRecord[] | (() => Promise<ImportedFoodRecord[]>)
) {
  const db = await database();
  const existing = await db.getFirstAsync<{ imported_count: number }>(
    "SELECT imported_count FROM seed_imports WHERE seed_key = ?", seedKey
  );
  if (existing) return { imported: existing.imported_count, skipped: true };
  const records = typeof source === "function" ? await source() : source;
  if (!records.length) return { imported: 0, skipped: true };
  const imported = await importFoodCatalogue(records);
  await db.runAsync(
    "INSERT OR REPLACE INTO seed_imports (seed_key, imported_count, imported_at) VALUES (?, ?, ?)",
    seedKey, imported, new Date().toISOString()
  );
  return { imported, skipped: false };
}

export async function ensureFoundationFoodsImported(records: ImportedFoodRecord[]) {
  return ensureFoodCatalogueImported("usda_foundation_foods_2026_11_vitamins_v2", records);
}

export async function ensureFnddsFoodsImported(source: ImportedFoodRecord[] | (() => Promise<ImportedFoodRecord[]>)) {
  return ensureFoodCatalogueImported("usda_fndds_2021_2023_v2_micronutrients", source);
}


// Profile photos are deliberately stored only in this device-local SQLite database.
export async function getProfilePhotoDataUri(): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ data_uri: string }>("SELECT data_uri FROM local_profile_photo WHERE id = 1");
  return row?.data_uri ?? null;
}

export async function saveProfilePhotoDataUri(dataUri: string): Promise<void> {
  if (!dataUri.startsWith("data:image/")) throw new Error("A valid image is required.");
  const db = await database();
  await db.runAsync("INSERT INTO local_profile_photo (id, data_uri, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data_uri=excluded.data_uri, updated_at=excluded.updated_at", dataUri, new Date().toISOString());
}

export async function deleteProfilePhoto(): Promise<void> {
  const db = await database();
  await db.runAsync("DELETE FROM local_profile_photo WHERE id = 1");
}
