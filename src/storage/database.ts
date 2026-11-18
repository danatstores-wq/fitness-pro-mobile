import * as SQLite from "expo-sqlite";

export type StoredProfile = {
  age: number;
  sex: "male" | "female";
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  activity_level: string;
  fitness_objective: string;
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
          updated_at TEXT NOT NULL
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
          data_quality TEXT NOT NULL DEFAULT 'unknown'
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
          weight_kg REAL NOT NULL CHECK (weight_kg > 0)
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
          duration_minutes INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_measurements_date ON measurements(recorded_at);
        CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(eaten_at);
        CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
      `);
      return db;
    })();
  }
  return databasePromise;
}

export async function loadProfile(): Promise<StoredProfile | null> {
  const db = await database();
  return db.getFirstAsync<StoredProfile>("SELECT age, sex, height_cm, current_weight_kg, target_weight_kg, activity_level, fitness_objective FROM user_profile WHERE id = 1");
}

export async function saveProfile(profile: StoredProfile) {
  const db = await database();
  await db.runAsync(
    `INSERT INTO user_profile
      (id, age, sex, height_cm, current_weight_kg, target_weight_kg, activity_level, fitness_objective, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      age=excluded.age, sex=excluded.sex, height_cm=excluded.height_cm,
      current_weight_kg=excluded.current_weight_kg, target_weight_kg=excluded.target_weight_kg,
      activity_level=excluded.activity_level, fitness_objective=excluded.fitness_objective,
      updated_at=excluded.updated_at`,
    profile.age, profile.sex, profile.height_cm, profile.current_weight_kg,
    profile.target_weight_kg, profile.activity_level, profile.fitness_objective,
    new Date().toISOString()
  );
}

export async function addWeightMeasurement(weightKg: number) {
  const db = await database();
  await db.runAsync("INSERT INTO measurements (recorded_at, weight_kg) VALUES (?, ?)", new Date().toISOString(), weightKg);
}

export async function getWeightMeasurements(): Promise<{ id: number; recorded_at: string; weight_kg: number }[]> {
  const db = await database();
  return db.getAllAsync("SELECT id, recorded_at, weight_kg FROM measurements ORDER BY recorded_at DESC LIMIT 100");
}

export async function getDatabaseStatus() {
  const db = await database();
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}
