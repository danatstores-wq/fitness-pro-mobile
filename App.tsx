import React, { useEffect, useMemo, useState } from "react";
import { addWeightMeasurement, getWeightMeasurements, getDailyMealFoods, nutritionForQuantity, loadProfile, saveProfile as saveProfileToDatabase, ensureFoundationFoodsImported, ensureFnddsFoodsImported } from "./src/storage/database";
import type { ImportedFoodRecord } from "./src/storage/database";
import {
  SafeAreaView, StatusBar, StyleSheet, Text, View, ScrollView,
  Pressable, TextInput, KeyboardAvoidingView, Platform, Alert
} from "react-native";
import { Language, translations, rtl } from "./src/i18n";
import FoodDiary from "./src/storage/FoodDiary";
import { USDA_FOUNDATION_FOODS } from "./src/data/usda-foundation-foods";
import { loadFnddsFoods } from "./src/data/load-fndds-foods";

type Tab = "dashboard" | "diary" | "progress" | "profile";
type Profile = {
  age: string; sex: "male" | "female"; height: string; weight: string;
  targetWeight: string; activity: "sedentary" | "light" | "moderate" | "active" | "veryActive";
  objective: "lose" | "maintain" | "gain";
  waist: string; hip: string; neck: string; bodyFat: string; muscleMass: string;
};

const GOLD = "#C5A46D";
const GREEN = "#9BC6A5";
const BG = "#101110";
const PANEL = "#191C19";
const MUTED = "#9A9D96";
const IVORY = "#F2F0E9";
const initialProfile: Profile = {
  age: "", sex: "male", height: "", weight: "", targetWeight: "",
  activity: "moderate", objective: "maintain", waist: "", hip: "", neck: "", bodyFat: "", muscleMass: ""
};
const activityFactor: Record<Profile["activity"], number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9
};

function calculate(profile: Profile) {
  const age = Number(profile.age), height = Number(profile.height), weight = Number(profile.weight);
  if (!age || !height || !weight) return null;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (profile.sex === "male" ? 5 : -161);
  const tdee = bmr * activityFactor[profile.activity];
  const calories = Math.round(tdee + (profile.objective === "lose" ? -400 : profile.objective === "gain" ? 250 : 0));
  const protein = Math.round(weight * (profile.objective === "gain" ? 1.8 : 1.6));
  const fats = Math.round((calories * 0.28) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));
  const bmi = weight / Math.pow(height / 100, 2);
  const min = 18.5 * Math.pow(height / 100, 2), max = 24.9 * Math.pow(height / 100, 2);
  const waist = Number(profile.waist), hip = Number(profile.hip), neck = Number(profile.neck);
  const validWaist = waist > 0, validHip = hip > 0, validNeck = neck > 0;
  const inches = (cm: number) => cm / 2.54;
  let bodyFat: number | null = Number(profile.bodyFat) > 0 && Number(profile.bodyFat) < 75 ? Number(profile.bodyFat) : null;
  if (bodyFat === null && validWaist && validNeck && profile.sex === "male" && waist > neck) bodyFat = 86.010 * Math.log10(inches(waist - neck)) - 70.041 * Math.log10(inches(height)) + 36.76;
  else if (bodyFat === null && validWaist && validHip && validNeck && profile.sex === "female" && waist + hip > neck) bodyFat = 163.205 * Math.log10(inches(waist + hip - neck)) - 97.684 * Math.log10(inches(height)) - 78.387;
  if (bodyFat !== null && (!Number.isFinite(bodyFat) || bodyFat < 2 || bodyFat > 70)) bodyFat = null;
  const leanMass = bodyFat === null ? null : weight * (1 - bodyFat / 100);
  const waistHeight = validWaist ? waist / height : null;
  const waistHip = validWaist && validHip ? waist / hip : null;
  const waterMl = Math.round(weight * 35), ideal = (min + max) / 2;
  // Educational age-equivalent: compare the Mifflin-St Jeor estimate with
  // the independent revised Harris-Benedict reference equation, then solve
  // for the age that would produce the same BMR. This is not a clinical measure.
  const metabolicAgeRaw = profile.sex === "male"
    ? (88.362 + 13.397 * weight + 4.799 * height - bmr) / 5.677
    : (447.593 + 9.247 * weight + 3.098 * height - bmr) / 4.330;
  const metabolicAge = age >= 18 && age <= 90 && Number.isFinite(metabolicAgeRaw) && metabolicAgeRaw >= 18 && metabolicAgeRaw <= 90
    ? Math.round(metabolicAgeRaw) : null;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fats, bmi, min, max, ideal, bodyFat, leanMass, waistHeight, waistHip, waterMl, metabolicAge, muscleMass: Number(profile.muscleMass) > 0 ? Number(profile.muscleMass) : null };
}

export default function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [webStorageReady, setWebStorageReady] = useState(Platform.OS !== "web");
  const [weightLog, setWeightLog] = useState<{ id: number; recorded_at: string; weight_kg: number }[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [dailyIntake, setDailyIntake] = useState<{ calories: number | null; protein: number | null; carbs: number | null; fats: number | null }>({ calories: null, protein: null, carbs: null, fats: null });
  const t = translations[language];
  const isRTL = rtl(language);
  const metrics = useMemo(() => calculate(profile), [profile]);

  // GitHub Pages cannot set COOP/COEP response headers itself. Register a
  // same-origin service worker and wait for its isolated document reload
  // before opening expo-sqlite's WebAssembly database.
  useEffect(() => {
    if (Platform.OS !== "web") { setWebStorageReady(true); return; }
    const browser = globalThis as any;
    const nav = browser.navigator;
    if (browser.crossOriginIsolated) {
      browser.sessionStorage?.removeItem("fitness-pro-coi-reload");
      setWebStorageReady(true);
      return;
    }
    if (!nav?.serviceWorker) { setWebStorageReady(true); return; }
    const reloadKey = "fitness-pro-coi-reload";
    if (browser.sessionStorage?.getItem(reloadKey) === "1") {
      console.error("The browser did not enable cross-origin isolation after service worker activation.");
      setWebStorageReady(true);
      return;
    }
    let reloading = false;
    const reloadWhenControlled = () => {
      if (reloading || !nav.serviceWorker.controller) return;
      reloading = true;
      browser.sessionStorage?.setItem(reloadKey, "1");
      browser.location.reload();
    };
    nav.serviceWorker.addEventListener("controllerchange", reloadWhenControlled);
    nav.serviceWorker.register(new URL("sw.js", browser.document.baseURI), {
      scope: new URL("./", browser.document.baseURI).pathname
    }).then(() => {
      if (nav.serviceWorker.controller) reloadWhenControlled();
    }).catch((error: unknown) => {
      console.error("Could not enable isolated web storage", error);
      setWebStorageReady(true);
    });
    return () => nav.serviceWorker.removeEventListener("controllerchange", reloadWhenControlled);
  }, []);

  useEffect(() => {
    if (!webStorageReady) return;
    let active = true;
    (async () => {
      try {
        await ensureFoundationFoodsImported(USDA_FOUNDATION_FOODS as unknown as ImportedFoodRecord[]);
        await ensureFnddsFoodsImported(loadFnddsFoods);
        const [storedProfile, measurements] = await Promise.all([loadProfile(), getWeightMeasurements()]);
        if (!active) return;
        if (storedProfile) {
          setProfile({
            age: String(storedProfile.age), sex: storedProfile.sex,
            height: String(storedProfile.height_cm),
            weight: String(storedProfile.current_weight_kg),
            targetWeight: String(storedProfile.target_weight_kg),
            activity: storedProfile.activity_level as Profile["activity"],
            objective: storedProfile.fitness_objective as Profile["objective"],
            waist: storedProfile.waist_cm == null ? "" : String(storedProfile.waist_cm), hip: storedProfile.hip_cm == null ? "" : String(storedProfile.hip_cm),
            neck: storedProfile.neck_cm == null ? "" : String(storedProfile.neck_cm), bodyFat: storedProfile.body_fat_percent == null ? "" : String(storedProfile.body_fat_percent),
            muscleMass: storedProfile.muscle_mass_kg == null ? "" : String(storedProfile.muscle_mass_kg)
          });
          setSaved(true);
        }
        setWeightLog(measurements);
      } catch (error) {
        console.warn("Could not load local fitness data", error);
        setStorageError(error instanceof Error ? error.message : String(error));
        Alert.alert("Storage error", "Your local database could not be opened. " + (error instanceof Error ? error.message : String(error)));
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, [webStorageReady]);
  useEffect(() => {
    if (tab !== "dashboard") return;
    let active = true;
    getDailyMealFoods().then(items => {
      const sumKnown = (values: (number | null)[]) => values.every(value => value === null)
        ? null
        : values.reduce<number>((total, value) => total + (value ?? 0), 0);
      const totals = items.map(item => nutritionForQuantity(item, item.quantity_g));
      if (active) setDailyIntake({
        calories: sumKnown(totals.map(value => value.calories)),
        protein: sumKnown(totals.map(value => value.protein_g)),
        carbs: sumKnown(totals.map(value => value.carbs_g)),
        fats: sumKnown(totals.map(value => value.fat_g))
      });
    }).catch(error => console.warn("Could not refresh dashboard nutrition", error));
    return () => { active = false; };
  }, [tab]);
  const direction = { writingDirection: isRTL ? "rtl" as const : "ltr" as const, textAlign: isRTL ? "right" as const : "left" as const };

  const change = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile(old => ({ ...old, [key]: value }));
    setSaved(false);
  };
  const saveProfile = async () => {
    if (!hydrated) {
      Alert.alert("Please wait", "The food catalogue and local database are still being prepared.");
      return;
    }
    if (storageError) {
      Alert.alert("Storage unavailable", storageError);
      return;
    }
    if (!metrics || Number(profile.age) < 13 || Number(profile.age) > 110 ||
        Number(profile.height) < 80 || Number(profile.height) > 250 ||
        Number(profile.weight) <= 0 || Number(profile.targetWeight) <= 0) {
      Alert.alert(t.invalid);
      return;
    }
    try {
      await saveProfileToDatabase({
        age: Number(profile.age), sex: profile.sex,
        height_cm: Number(profile.height), current_weight_kg: Number(profile.weight),
        target_weight_kg: Number(profile.targetWeight),
        activity_level: profile.activity, fitness_objective: profile.objective,
        waist_cm: Number(profile.waist) || null, hip_cm: Number(profile.hip) || null, neck_cm: Number(profile.neck) || null,
        body_fat_percent: Number(profile.bodyFat) || null, muscle_mass_kg: Number(profile.muscleMass) || null
      });
      const existingMeasurements = await getWeightMeasurements();
      if (existingMeasurements.length === 0) await addWeightMeasurement(Number(profile.weight));
      setWeightLog(await getWeightMeasurements());
      setSaved(true);
      Alert.alert(t.saved);
    } catch (error) {
      console.warn("Could not save profile", error);
      Alert.alert("Save failed", "Your profile could not be saved locally. Please try again.");
    }
  };
  const addWeight = async () => {
    const value = Number(weightInput);
    if (value > 0 && Number.isFinite(value)) {
      try {
        await addWeightMeasurement(value);
        setWeightLog(await getWeightMeasurements());
        setWeightInput("");
      } catch (error) {
        console.warn("Could not save weight", error);
        Alert.alert("Save failed", "The weight entry could not be saved.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={[styles.brand, isRTL && styles.rowReverse]}>
          <View style={styles.logo}><Text style={styles.logoMark}>d.</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandEyebrow, direction]}>DANAT / WELLNESS</Text>
            <Text style={[styles.brandName, direction]}>FITNESS PRO</Text>
          </View>
          <Pressable style={styles.languageButton} onPress={() => setLanguage(language === "en" ? "ar" : language === "ar" ? "fr" : "en")}>
            <Text style={styles.languageText}>{language.toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "dashboard" && <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.dashboardIntro}>
            <Text style={[styles.eyebrow, direction]}>{t.today}</Text>
            <Text style={[styles.greeting, direction]}>{t.greeting}</Text>
            <Text style={[styles.introNote, direction]}>A little better, every day.</Text>
          </View>
          {!hydrated ? <Card><Text style={styles.muted}>Loading your saved fitness data…</Text></Card> : !metrics ? <Card>
            <Text style={styles.cardTitle}>{t.startProfile}</Text>
            <Text style={styles.muted}>{t.profileHint}</Text>
            <GoldButton title={t.profile} onPress={() => setTab("profile")} />
          </Card> : <>
            <View style={styles.statRow}>
              <StatCard label={t.currentWeight} value={profile.weight + " " + t.kg} icon="↗" />
              <StatCard label={t.bmi} value={metrics.bmi.toFixed(1)} icon="◌" />
            </View>
            <View style={styles.calorieHero}>
              <View style={styles.heroTopline}>
                <Text style={styles.heroLabel}>{t.calories.toUpperCase()}</Text>
                <View style={styles.liveDot} />
              </View>
              <View style={styles.heroNumberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calorieNumber}>{metrics.calories.toLocaleString(language === "fr" ? "fr-FR" : language === "ar" ? "ar" : "en-US")}</Text>
                  <Text style={styles.heroSubline}>KCAL  /  DAILY TARGET</Text>
                </View>
                <View style={styles.calorieBadge}>
                  <Text style={styles.badgeValue}>{dailyIntake.calories === null ? "—" : Math.round(dailyIntake.calories)}</Text>
                  <Text style={styles.badgeCaption}>EATEN</Text>
                </View>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${dailyIntake.calories === null ? 0 : Math.min(100, (dailyIntake.calories / metrics.calories) * 100)}%` }]} /></View>
              <View style={styles.spaceBetween}><Text style={styles.muted}>{t.tdee}: {metrics.tdee} kcal</Text><Text style={styles.greenText}>{dailyIntake.calories === null ? "—" : Math.round(metrics.calories - dailyIntake.calories)} {t.remaining}</Text></View>
            </View>
            <Card>
              <View style={styles.sectionHeading}>
                <Text style={styles.cardTitle}>MACRO BALANCE</Text>
                <Text style={styles.sectionMeta}>DAILY GOALS</Text>
              </View>
              <Macro label={t.protein} value={metrics.protein} consumed={dailyIntake.protein} color={GOLD} />
              <Macro label={t.carbs} value={metrics.carbs} consumed={dailyIntake.carbs} color="#B8B7A9" />
              <Macro label={t.fats} value={metrics.fats} consumed={dailyIntake.fats} color={GREEN} />
            </Card>
            <View style={styles.statRow}>
              <StatCard label={t.targetWeight} value={profile.targetWeight + " " + t.kg} icon="◎" />
              <StatCard label={t.healthyRange} value={metrics.min.toFixed(1) + "–" + metrics.max.toFixed(1)} icon="✦" />
            </View>
          </>}
        </ScrollView>}

        {tab === "diary" && (!hydrated
          ? <ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.cardTitle}>Preparing your food catalogue</Text><Text style={styles.muted}>Please wait while the verified food database is installed. Food search and categories will become available when this finishes.</Text></Card></ScrollView>
          : storageError
            ? <ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.cardTitle}>Food database unavailable</Text><Text style={styles.muted}>{storageError}</Text></Card></ScrollView>
            : <FoodDiary language={language} targetCalories={metrics?.calories ?? 2000} />)}

        {tab === "progress" && <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.pageTitle, direction]}>{t.progress}</Text>
          <Card>
            <Text style={styles.cardTitle}>{t.weightTrend}</Text>
            {weightLog.length ? <View style={styles.weightList}>{weightLog.map((entry) => <View key={entry.id} style={styles.spaceBetween}><Text style={styles.muted}>{new Date(entry.recorded_at).toLocaleDateString(language === "fr" ? "fr-FR" : language === "ar" ? "ar" : "en-US")}</Text><Text style={styles.valueText}>{entry.weight_kg} {t.kg}</Text></View>)}</View> : <Text style={styles.muted}>{t.emptyProgress}</Text>}
          </Card>
          <Card>
            <Text style={styles.cardTitle}>{t.logWeight}</Text>
            <TextInput value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" placeholder={t.weight} placeholderTextColor={MUTED} style={[styles.input, direction]} />
            <GoldButton title={t.logWeight} onPress={addWeight} />
          </Card>
        </ScrollView>}

        {tab === "profile" && <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.pageTitle, direction]}>{t.profile}</Text>
            <Card>
              <Field label={t.age} value={profile.age} onChangeText={v => change("age", v)} keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>{t.sex}</Text>
              <View style={styles.optionRow}>
                <Choice title={t.male} active={profile.sex === "male"} onPress={() => change("sex", "male")} />
                <Choice title={t.female} active={profile.sex === "female"} onPress={() => change("sex", "female")} />
              </View>
              <Field label={t.height} value={profile.height} onChangeText={v => change("height", v)} keyboardType="decimal-pad" />
              <Field label={t.weight} value={profile.weight} onChangeText={v => change("weight", v)} keyboardType="decimal-pad" />
              <Field label={t.goalWeight} value={profile.targetWeight} onChangeText={v => change("targetWeight", v)} keyboardType="decimal-pad" />
              <Text style={styles.fieldLabel}>{t.bodyMeasurements}</Text><Text style={styles.muted}>{t.measurementHint}</Text>
              <Field label={t.waistCm} value={profile.waist} onChangeText={v => change("waist", v)} keyboardType="decimal-pad" />
              <Field label={t.hipCm} value={profile.hip} onChangeText={v => change("hip", v)} keyboardType="decimal-pad" />
              <Field label={t.neckCm} value={profile.neck} onChangeText={v => change("neck", v)} keyboardType="decimal-pad" />
              <Field label={t.bodyFatInput} value={profile.bodyFat} onChangeText={v => change("bodyFat", v)} keyboardType="decimal-pad" />
              <Field label={t.muscleMassInput} value={profile.muscleMass} onChangeText={v => change("muscleMass", v)} keyboardType="decimal-pad" />
              <Text style={styles.fieldLabel}>{t.activity}</Text>
              <View style={styles.choiceWrap}>
                {(["sedentary", "light", "moderate", "active", "veryActive"] as const).map(v => <Choice key={v} title={t[v]} active={profile.activity === v} onPress={() => change("activity", v)} />)}
              </View>
              <Text style={styles.fieldLabel}>{t.objective}</Text>
              <View style={styles.choiceWrap}>
                {(["lose", "maintain", "gain"] as const).map(v => <Choice key={v} title={t[v]} active={profile.objective === v} onPress={() => change("objective", v)} />)}
              </View>
              <GoldButton title={t.save} onPress={saveProfile} />
              {saved && <Text style={styles.greenText}>{t.saved}</Text>}
            </Card>
            {metrics && <Card>
              <Text style={styles.cardTitle}>{t.tdee}</Text>
              <Text style={styles.calorieNumber}>{metrics.calories} kcal</Text>
              <Text style={styles.muted}>{t.bmr}: {metrics.bmr} kcal</Text><Text style={styles.muted}>{t.tdee}: {metrics.tdee} kcal</Text><Text style={styles.muted}>{t.protein}: {metrics.protein} g / day</Text>
            </Card>}
            {metrics && <Card><Text style={styles.cardTitle}>{t.bodyMetrics}</Text>
              <MetricLine label={t.idealWeight} value={metrics.ideal.toFixed(1) + " kg"} /><MetricLine label={t.healthyRange} value={metrics.min.toFixed(1) + "–" + metrics.max.toFixed(1) + " kg"} />
              <MetricLine label={t.bodyFat} value={metrics.bodyFat === null ? "—" : metrics.bodyFat.toFixed(1) + "%"} /><MetricLine label={t.leanMass} value={metrics.leanMass === null ? "—" : metrics.leanMass.toFixed(1) + " kg"} />
              <MetricLine label={t.muscleMass} value={metrics.muscleMass === null ? "—" : metrics.muscleMass.toFixed(1) + " kg"} /><MetricLine label={t.waistHeight} value={metrics.waistHeight === null ? "—" : metrics.waistHeight.toFixed(2)} />
              <MetricLine label={t.waistHip} value={metrics.waistHip === null ? "—" : metrics.waistHip.toFixed(2)} /><MetricLine label={t.waterNeeds} value={(metrics.waterMl / 1000).toFixed(2) + " L / day"} />
              <MetricLine label={t.metabolicAge} value={metrics.metabolicAge === null ? t.notAvailable : metrics.metabolicAge + " " + t.years} /><Text style={styles.muted}>{t.metabolicAgeHint}</Text><Text style={styles.muted}>{t.metricsDisclaimer}</Text>
            </Card>}
          </ScrollView>
        </KeyboardAvoidingView>}
      </View>

      <View style={[styles.tabBar, isRTL && styles.rowReverse]}>
        {([
          ["dashboard", "⌂", t.dashboard], ["diary", "◫", t.diary],
          ["progress", "↗", t.progress], ["profile", "◉", t.profile]
        ] as [Tab, string, string][]).map(([key, icon, label]) =>
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tabItem}>
            <Text style={[styles.tabIcon, tab === key && styles.activeTab]}>{icon}</Text>
            <Text style={[styles.tabLabel, tab === key && styles.activeTab]}>{label}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <View style={[styles.card, { flex: 1 }]}><Text style={styles.statIcon}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}
function MetricLine({ label, value }: { label: string; value: string }) { return <View style={styles.spaceBetween}><Text style={styles.muted}>{label}</Text><Text style={styles.valueText}>{value}</Text></View>; }
function Macro({ label, value, consumed, color }: { label: string; value: number; consumed: number | null; color: string }) {
  return <View style={styles.macroRow}><Text style={styles.muted}>{label}</Text><Text style={{ color, fontWeight: "800" }}>{consumed === null ? "—" : Math.round(consumed)} / {value} g</Text></View>;
}
function GoldButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.goldButton}><Text style={styles.goldButtonText}>{title}</Text></Pressable>;
}
function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; keyboardType?: "number-pad" | "decimal-pad" }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={label} placeholderTextColor={MUTED} style={styles.input} /></View>;
}
function Choice({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && { color: GOLD }]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 23, paddingTop: 13, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#292B27" },
  brand: { flexDirection: "row", alignItems: "center", gap: 13 },
  rowReverse: { flexDirection: "row-reverse" },
  logo: { width: 42, height: 42, borderRadius: 21, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  logoMark: { color: BG, fontWeight: "900", fontSize: 25, letterSpacing: -2 },
  brandEyebrow: { color: GOLD, fontWeight: "700", fontSize: 9, letterSpacing: 3.1 },
  brandName: { color: IVORY, fontWeight: "800", fontSize: 15, letterSpacing: 2.1, marginTop: 4 },
  languageButton: { borderWidth: 1, borderColor: "#4B412D", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  languageText: { color: GOLD, fontSize: 12, fontWeight: "800" },
  content: { paddingHorizontal: 22, paddingTop: 25, paddingBottom: 34, gap: 15 },
  dashboardIntro: { paddingTop: 3, paddingBottom: 7 },
  greeting: { color: IVORY, fontSize: 29, lineHeight: 36, fontWeight: "700", letterSpacing: -0.8, marginTop: 8 },
  introNote: { color: MUTED, fontSize: 13, marginTop: 7, letterSpacing: 0.2 },
  eyebrow: { color: GOLD, fontSize: 9, letterSpacing: 2.6, fontWeight: "800", marginBottom: 3 },
  pageTitle: { color: IVORY, fontSize: 29, fontWeight: "700", letterSpacing: -0.7, marginBottom: 4 },
  card: { backgroundColor: PANEL, borderRadius: 18, borderWidth: 1, borderColor: "#2A2D28", padding: 19, marginBottom: 2 },
  cardTitle: { color: IVORY, fontSize: 13, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 19 },
  calorieHero: { backgroundColor: "#20241F", borderRadius: 22, borderWidth: 1, borderColor: "#393A2F", padding: 21, marginBottom: 2 },
  heroTopline: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroLabel: { color: "#C9C4B6", fontSize: 9, fontWeight: "800", letterSpacing: 2.2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  heroNumberRow: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  calorieNumber: { color: IVORY, fontSize: 43, fontWeight: "700", letterSpacing: -1.7, marginVertical: 3 },
  heroSubline: { color: GOLD, fontSize: 9, fontWeight: "800", letterSpacing: 1.7 },
  calorieBadge: { minWidth: 77, minHeight: 77, borderRadius: 39, borderWidth: 1, borderColor: "#777052", alignItems: "center", justifyContent: "center", marginLeft: 10 },
  badgeValue: { color: IVORY, fontSize: 17, fontWeight: "800" },
  badgeCaption: { color: MUTED, fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  progressTrack: { height: 5, backgroundColor: "#3A3D35", borderRadius: 10, marginTop: 20, marginBottom: 11, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: GREEN, borderRadius: 10 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  sectionMeta: { color: GOLD, fontSize: 8, fontWeight: "800", letterSpacing: 1.3 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  greenText: { color: GREEN, fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 11 },
  statIcon: { color: GOLD, fontSize: 18, marginBottom: 10 },
  statValue: { color: IVORY, fontSize: 23, fontWeight: "700", letterSpacing: -0.5, marginBottom: 4 },
  macroRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#292E37" },
  mealCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: PANEL, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#252A33" },
  mealIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#242830", alignItems: "center", justifyContent: "center" },
  addIcon: { color: GOLD, fontSize: 24, fontWeight: "700" },
  weightList: { gap: 9, marginTop: 8 },
  valueText: { color: GOLD, fontWeight: "800" },
  input: { color: "#FFFFFF", backgroundColor: "#0E1117", borderWidth: 1, borderColor: "#303641", borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, marginTop: 7, fontSize: 15 },
  field: { marginBottom: 13 },
  fieldLabel: { color: "#D7DBE2", fontWeight: "700", fontSize: 13, marginBottom: 3, marginTop: 6 },
  optionRow: { flexDirection: "row", gap: 9, marginBottom: 12 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  choice: { borderWidth: 1, borderColor: "#343B47", backgroundColor: "#10141A", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  choiceActive: { borderColor: GOLD, backgroundColor: "#30291D" },
  choiceText: { color: "#C4CAD3", fontSize: 12, fontWeight: "700" },
  goldButton: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  goldButtonText: { color: "#111318", fontWeight: "900", fontSize: 14 },
  tabBar: { flexDirection: "row", backgroundColor: "#171A17", borderTopWidth: 1, borderTopColor: "#2A2D28", paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 23 : 13 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 },
  tabIcon: { color: "#777D74", fontSize: 21, fontWeight: "500" },
  tabLabel: { color: "#858A81", fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },
  activeTab: { color: GOLD }
});
