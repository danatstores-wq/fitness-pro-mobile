import React, { useEffect, useMemo, useState } from "react";
import { addWeightMeasurement, getWeightMeasurements, loadProfile, saveProfile as saveProfileToDatabase, ensureFoundationFoodsImported, ensureFnddsFoodsImported } from "./src/storage/database";
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
};

const GOLD = "#D7B66D";
const GREEN = "#53C58A";
const BG = "#090B0F";
const PANEL = "#151920";
const MUTED = "#9299A5";
const initialProfile: Profile = {
  age: "", sex: "male", height: "", weight: "", targetWeight: "",
  activity: "moderate", objective: "maintain"
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
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, carbs, fats, bmi, min, max };
}

export default function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [weightLog, setWeightLog] = useState<{ id: number; recorded_at: string; weight_kg: number }[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const t = translations[language];
  const isRTL = rtl(language);
  const metrics = useMemo(() => calculate(profile), [profile]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await ensureFoundationFoodsImported(USDA_FOUNDATION_FOODS as unknown as ImportedFoodRecord[]);
        await ensureFnddsFoodsImported(await loadFnddsFoods());
        const [storedProfile, measurements] = await Promise.all([loadProfile(), getWeightMeasurements()]);
        if (!active) return;
        if (storedProfile) {
          setProfile({
            age: String(storedProfile.age), sex: storedProfile.sex,
            height: String(storedProfile.height_cm),
            weight: String(storedProfile.current_weight_kg),
            targetWeight: String(storedProfile.target_weight_kg),
            activity: storedProfile.activity_level as Profile["activity"],
            objective: storedProfile.fitness_objective as Profile["objective"]
          });
          setSaved(true);
        }
        setWeightLog(measurements);
      } catch (error) {
        console.warn("Could not load local fitness data", error);
        Alert.alert("Storage error", "Your local database could not be opened. Please restart the app.");
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, []);
  const direction = { writingDirection: isRTL ? "rtl" as const : "ltr" as const, textAlign: isRTL ? "right" as const : "left" as const };

  const change = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile(old => ({ ...old, [key]: value }));
    setSaved(false);
  };
  const saveProfile = async () => {
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
        activity_level: profile.activity, fitness_objective: profile.objective
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
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <View style={styles.header}>
        <View style={[styles.brand, isRTL && styles.rowReverse]}>
          <View style={styles.logo}><Text style={styles.logoMark}>D</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandEyebrow, direction]}>DANAT</Text>
            <Text style={[styles.brandName, direction]}>FITNESS PRO</Text>
          </View>
          <Pressable style={styles.languageButton} onPress={() => setLanguage(language === "en" ? "ar" : language === "ar" ? "fr" : "en")}>
            <Text style={styles.languageText}>{language.toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "dashboard" && <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.greeting, direction]}>{t.greeting}</Text>
          <Text style={[styles.eyebrow, direction]}>{t.today}</Text>
          {!hydrated ? <Card><Text style={styles.muted}>Loading your saved fitness data…</Text></Card> : !metrics ? <Card>
            <Text style={styles.cardTitle}>{t.startProfile}</Text>
            <Text style={styles.muted}>{t.profileHint}</Text>
            <GoldButton title={t.profile} onPress={() => setTab("profile")} />
          </Card> : <>
            <View style={styles.statRow}>
              <StatCard label={t.currentWeight} value={profile.weight + " " + t.kg} icon="⚖" />
              <StatCard label={t.bmi} value={metrics.bmi.toFixed(1)} icon="◈" />
            </View>
            <Card>
              <Text style={styles.muted}>{t.calories}</Text>
              <Text style={styles.calorieNumber}>{metrics.calories.toLocaleString(language === "fr" ? "fr-FR" : language === "ar" ? "ar" : "en-US")}</Text>
              <Text style={styles.muted}>{t.tdee}: {metrics.tdee} kcal</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: "0%" }]} /></View>
              <View style={styles.spaceBetween}><Text style={styles.muted}>{t.consumed}: 0</Text><Text style={styles.greenText}> {metrics.calories} {t.remaining}</Text></View>
            </Card>
            <Card>
              <Text style={styles.cardTitle}>{t.today} · MACROS</Text>
              <Macro label={t.protein} value={metrics.protein} color={GOLD} />
              <Macro label={t.carbs} value={metrics.carbs} color="#68A9E8" />
              <Macro label={t.fats} value={metrics.fats} color={GREEN} />
            </Card>
            <View style={styles.statRow}>
              <StatCard label={t.targetWeight} value={profile.targetWeight + " " + t.kg} icon="◎" />
              <StatCard label={t.healthyRange} value={metrics.min.toFixed(1) + "–" + metrics.max.toFixed(1)} icon="✦" />
            </View>
          </>}
        </ScrollView>}

        {tab === "diary" && <FoodDiary language={language} />}

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
              <Text style={styles.muted}>{t.bmr}: {metrics.bmr} kcal</Text>
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
function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={styles.macroRow}><Text style={styles.muted}>{label}</Text><Text style={{ color, fontWeight: "800" }}>{value} g</Text></View>;
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
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#20242C" },
  brand: { flexDirection: "row", alignItems: "center", gap: 11 },
  rowReverse: { flexDirection: "row-reverse" },
  logo: { width: 43, height: 43, borderRadius: 13, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  logoMark: { color: BG, fontWeight: "900", fontSize: 27 },
  brandEyebrow: { color: GOLD, fontWeight: "800", fontSize: 10, letterSpacing: 4 },
  brandName: { color: "#FFFFFF", fontWeight: "900", fontSize: 17, letterSpacing: 1.2, marginTop: 2 },
  languageButton: { borderWidth: 1, borderColor: "#4B412D", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  languageText: { color: GOLD, fontSize: 12, fontWeight: "800" },
  content: { padding: 20, paddingBottom: 30, gap: 14 },
  greeting: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 5 },
  eyebrow: { color: GOLD, fontSize: 10, letterSpacing: 2.2, fontWeight: "800", marginBottom: 5 },
  pageTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginBottom: 4 },
  card: { backgroundColor: PANEL, borderRadius: 19, borderWidth: 1, borderColor: "#252A33", padding: 18, marginBottom: 2 },
  cardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 7 },
  muted: { color: MUTED, fontSize: 13, lineHeight: 19 },
  calorieNumber: { color: GOLD, fontSize: 35, fontWeight: "900", marginVertical: 5 },
  progressTrack: { height: 8, backgroundColor: "#2A3039", borderRadius: 10, marginTop: 18, marginBottom: 10, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: GREEN, borderRadius: 10 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  greenText: { color: GREEN, fontSize: 12, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 12 },
  statIcon: { color: GOLD, fontSize: 20, marginBottom: 7 },
  statValue: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 3 },
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
  tabBar: { flexDirection: "row", backgroundColor: "#12161D", borderTopWidth: 1, borderTopColor: "#252A33", paddingTop: 9, paddingBottom: Platform.OS === "ios" ? 20 : 10 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabIcon: { color: "#7E8794", fontSize: 22, fontWeight: "700" },
  tabLabel: { color: "#7E8794", fontSize: 10, fontWeight: "600" },
  activeTab: { color: GOLD }
});
