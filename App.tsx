import React, { useEffect, useMemo, useState } from "react";
import { addWeightMeasurement, getWeightMeasurements, getDailyMealFoods, nutritionForQuantity, loadProfile, saveProfile as saveProfileToDatabase, ensureFoundationFoodsImported, ensureFnddsFoodsImported } from "./src/storage/database";
import type { ImportedFoodRecord } from "./src/storage/database";
import {
  SafeAreaView, StatusBar, StyleSheet, Text, View, ScrollView, Image,
  Pressable, TextInput, KeyboardAvoidingView, Platform, Alert
} from "react-native";
import { Language, translations, rtl } from "./src/i18n";
import FoodDiary from "./src/storage/FoodDiary";
import ReminderSettings from "./src/storage/ReminderSettings";
import { USDA_FOUNDATION_FOODS } from "./src/data/usda-foundation-foods";
import { loadFnddsFoods } from "./src/data/load-fndds-foods";

type Tab = "dashboard" | "diary" | "progress" | "profile";
type Profile = {
  name: string; age: string; sex: "male" | "female"; height: string; weight: string;
  targetWeight: string; activity: "sedentary" | "light" | "moderate" | "active" | "veryActive"; ibwFormula: "devine" | "robinson";
  objective: "lose" | "maintain" | "gain";
  waist: string; hip: string; neck: string; bodyFat: string; muscleMass: string;
};

const GOLD = "#D7B45A";
const GREEN = "#4FA66B";
const BG = "#090D0B";
const PANEL = "#141A16";
const MUTED = "#A7B0A7";
const IVORY = "#F2F0E8";
const initialProfile: Profile = {
  name: '', age: "", sex: "male", height: "", weight: "", targetWeight: "",
  activity: "moderate", objective: "maintain", ibwFormula: "devine", waist: "", hip: "", neck: "", bodyFat: "", muscleMass: ""
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
  const inchesOverFiveFeet = Math.max(0, height / 2.54 - 60);
  const ideal = profile.ibwFormula === "robinson"
    ? (profile.sex === "male" ? 52 : 49) + inchesOverFiveFeet * (profile.sex === "male" ? 1.9 : 1.7)
    : (profile.sex === "male" ? 50 : 45.5) + inchesOverFiveFeet * 2.3;
  const waterMl = Math.round(weight * ({ sedentary: 30, light: 32, moderate: 35, active: 40, veryActive: 45 } as const)[profile.activity]);
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
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000);
    return () => clearTimeout(timer);
  }, []);
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
        // Make the app usable as soon as the smaller verified Foundation
        // catalogue is ready. The much larger FNDDS catalogue is imported in
        // the background so it cannot block profile saving or food browsing.
        await ensureFoundationFoodsImported(USDA_FOUNDATION_FOODS as unknown as ImportedFoodRecord[]);
        const [storedProfile, measurements] = await Promise.all([loadProfile(), getWeightMeasurements()]);
        if (!active) return;
        if (storedProfile) {
          setProfile({
            name: storedProfile.name ?? '', age: storedProfile.age > 0 ? String(storedProfile.age) : "", sex: storedProfile.sex,
            height: storedProfile.height_cm > 0 ? String(storedProfile.height_cm) : "",
            weight: storedProfile.current_weight_kg > 0 ? String(storedProfile.current_weight_kg) : "",
            targetWeight: storedProfile.target_weight_kg > 0 ? String(storedProfile.target_weight_kg) : "",
            activity: storedProfile.activity_level as Profile["activity"],
            objective: storedProfile.fitness_objective as Profile["objective"],
            ibwFormula: storedProfile.formula_setting === "robinson" ? "robinson" : "devine",
             waist: storedProfile.waist_cm == null ? "" : String(storedProfile.waist_cm), hip: storedProfile.hip_cm == null ? "" : String(storedProfile.hip_cm),
            neck: storedProfile.neck_cm == null ? "" : String(storedProfile.neck_cm), bodyFat: storedProfile.body_fat_percent == null ? "" : String(storedProfile.body_fat_percent),
            muscleMass: storedProfile.muscle_mass_kg == null ? "" : String(storedProfile.muscle_mass_kg)
          });
          setSaved(true);
        }
        setWeightLog(measurements);
        setHydrated(true);
        ensureFnddsFoodsImported(loadFnddsFoods).then(result => {
          console.info("Additional USDA FNDDS foods imported", result.imported);
        }).catch(error => {
          console.warn("Additional USDA FNDDS catalogue import failed; Foundation foods remain available", error);
        });
      } catch (error) {
        console.warn("Could not load local fitness data", error);
        setStorageError(error instanceof Error ? error.message : String(error));
        Alert.alert(t.storageTitle, t.storageMessage + " " + (error instanceof Error ? error.message : String(error)));
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
      Alert.alert(t.waitTitle, t.waitMessage);
      return;
    }
    if (storageError) {
      Alert.alert(t.storageUnavailable, storageError);
      return;
    }
    const numericFields = [profile.age, profile.height, profile.weight, profile.targetWeight, profile.waist, profile.hip, profile.neck, profile.bodyFat, profile.muscleMass];
    if (!profile.name.trim() && !numericFields.some(value => value.trim() !== "")) {
      Alert.alert(t.nothingTitle, t.nothingMessage);
      return;
    }
    const valid = (!profile.age || (Number(profile.age) >= 13 && Number(profile.age) <= 110)) &&
      (!profile.height || (Number(profile.height) >= 80 && Number(profile.height) <= 250)) &&
      (!profile.weight || Number(profile.weight) > 0) &&
      (!profile.targetWeight || Number(profile.targetWeight) > 0) &&
      [profile.waist, profile.hip, profile.neck, profile.bodyFat, profile.muscleMass].every(value => !value || Number(value) > 0);
    if (!valid) {
      Alert.alert(t.invalid);
      return;
    }
    try {
      await saveProfileToDatabase({
        name: profile.name.trim(), age: Number(profile.age) || 0, sex: profile.sex,
        height_cm: Number(profile.height) || 0, current_weight_kg: Number(profile.weight) || 0,
        target_weight_kg: Number(profile.targetWeight) || 0,
        activity_level: profile.activity, fitness_objective: profile.objective, formula_setting: profile.ibwFormula,
        waist_cm: Number(profile.waist) || null, hip_cm: Number(profile.hip) || null, neck_cm: Number(profile.neck) || null,
        body_fat_percent: Number(profile.bodyFat) || null, muscle_mass_kg: Number(profile.muscleMass) || null
      });
      if (Number(profile.weight) > 0) {
        const existingMeasurements = await getWeightMeasurements();
        if (existingMeasurements.length === 0) await addWeightMeasurement(Number(profile.weight));
        setWeightLog(await getWeightMeasurements());
      }
      setSaved(true);
      Alert.alert(t.saved);
    } catch (error) {
      console.warn("Could not save profile", error);
      Alert.alert(t.saveFailed, t.profileSaveFailed);
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
        Alert.alert(t.saveFailed, t.weightSaveFailed);
      }
    }
  };

  if (showWelcome) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <StatusBar barStyle="light-content" />
        <Image
          source={require("./assets/images/welcome.jpg")}
          style={styles.splashImage}
          resizeMode="cover"
          accessibilityLabel="FITNESS PRO welcome"
        />
        <View style={styles.splashShade} />
        <View style={styles.splashContent}>
          <Text style={styles.splashEyebrow}>DANAT / WELLNESS</Text>
          <Text style={styles.splashTitle}>FITNESS PRO</Text>
          <View style={styles.splashAccent} />
          <Text style={styles.splashWelcome}>Welcome to FITNESS PRO</Text>
          <Text style={styles.splashArabic}>مرحباً بك في FITNESS PRO</Text>
          <Text style={styles.splashFrench}>Bienvenue sur FITNESS PRO</Text>
        </View>
        <View style={styles.splashFooter}>
          <View style={styles.splashFooterDot} />
          <Text style={styles.splashFooterText}>YOUR HEALTH. YOUR JOURNEY.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appFrame}>
      <View style={styles.header}>
        <View style={[styles.brand, isRTL && styles.rowReverse]}>
          <Image source={require("./assets/images/danat-logo.png")} style={styles.logoImage} resizeMode="contain" accessibilityLabel="Danat logo" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandEyebrow, direction]}>DANAT / WELLNESS</Text>
            <Text style={[styles.brandName, direction]}>FITNESS PRO</Text>
          </View>
          <View style={styles.languageSelector}>{(["en", "ar", "fr"] as Language[]).map(code => <Pressable key={code} accessibilityRole="button" accessibilityLabel={code === "en" ? "English" : code === "ar" ? "العربية" : "Français"} onPress={() => setLanguage(code)} style={[styles.languageButton, language === code && styles.languageButtonActive]}><Text style={[styles.languageText, language !== code && styles.languageTextInactive]}>{code.toUpperCase()}</Text></Pressable>)}</View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "dashboard" && <ScrollView contentContainerStyle={styles.content}>
<View style={styles.dashboardIntro}>
  <View style={styles.todayPill}><View style={styles.liveDot}/><Text style={styles.todayPillText}>{t.today}</Text></View>
  <Text style={[styles.greeting,direction]}>{profile.name.trim() ? (language === 'ar' ? `مرحباً، ${profile.name.trim()}` : language === 'fr' ? `Bonjour, ${profile.name.trim()}` : `Hi, ${profile.name.trim()}`) : t.greeting}</Text>
  <Text style={[styles.introNote,direction]}>{t.dashboardSub}</Text>
</View>
{!hydrated ? <Card><Text style={styles.muted}>{t.loadingDashboard}</Text></Card> : <>
  <View style={styles.calorieHero}>
    <View style={styles.heroTopline}><Text style={styles.heroLabel}>{t.calories.toUpperCase()}</Text><Text style={styles.sectionMeta}>{t.dailyTarget.toUpperCase()}</Text></View>
    <View style={styles.calorieDashboard}>
      <View style={styles.calorieRing}>
        <View style={styles.calorieRingInner}>
          <Text style={styles.ringCaption}>{t.consumed.toUpperCase()}</Text>
          <Text style={styles.ringValue}>{dailyIntake.calories===null?"0":Math.round(dailyIntake.calories).toLocaleString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US")}</Text>
          <Text style={styles.ringUnit}>KCAL</Text>
        </View>
      </View>
      <View style={styles.calorieSummary}>
        <Text style={styles.calorieNumber}>{metrics ? metrics.calories.toLocaleString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US") : "2,000"}</Text>
        <Text style={styles.heroSubline}>{t.dailyGoal.toUpperCase()}</Text>
        <View style={styles.remainingPanel}>
          <Text style={styles.remainingValue}>{dailyIntake.calories===null?"—":Math.max(0,Math.round((metrics?.calories||2000)-dailyIntake.calories)).toLocaleString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US")}</Text>
          <Text style={styles.remainingLabel}>{t.remaining.toUpperCase()}</Text>
        </View>
      </View>
    </View>
    <View style={styles.progressTrack}><View style={[styles.progressFill,{width:(Math.min(100,((dailyIntake.calories||0)/(metrics?.calories||2000))*100))+"%"}]}/></View>
    <View style={styles.spaceBetween}><Text style={styles.muted}>{t.dailyGoal}: {metrics?.calories||2000} kcal</Text><Text style={styles.greenText}>{Math.min(100,Math.round(((dailyIntake.calories||0)/(metrics?.calories||2000))*100))}%</Text></View>
  </View>
  <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t.macroBalance}</Text><Text style={styles.sectionMeta}>{t.dailyGoals}</Text></View>
  <View style={styles.macroGrid}>
    <View style={styles.macroTile}><Text style={styles.macroTileLabel}>{t.protein}</Text><Text style={styles.macroTileValue}>{dailyIntake.protein===null?"0":Math.round(dailyIntake.protein)}<Text style={styles.macroTileUnit}> / {metrics?.protein||125} g</Text></Text><View style={styles.miniTrack}><View style={[styles.miniFill,{width:Math.min(100,((dailyIntake.protein||0)/(metrics?.protein||125))*100)+"%",backgroundColor:GOLD}]}/></View></View>
    <View style={styles.macroTile}><Text style={styles.macroTileLabel}>{t.carbs}</Text><Text style={styles.macroTileValue}>{dailyIntake.carbs===null?"0":Math.round(dailyIntake.carbs)}<Text style={styles.macroTileUnit}> / {metrics?.carbs||225} g</Text></Text><View style={styles.miniTrack}><View style={[styles.miniFill,{width:Math.min(100,((dailyIntake.carbs||0)/(metrics?.carbs||225))*100)+"%",backgroundColor:GREEN}]}/></View></View>
    <View style={styles.macroTile}><Text style={styles.macroTileLabel}>{t.fats}</Text><Text style={styles.macroTileValue}>{dailyIntake.fats===null?"0":Math.round(dailyIntake.fats)}<Text style={styles.macroTileUnit}> / {metrics?.fats||62} g</Text></Text><View style={styles.miniTrack}><View style={[styles.miniFill,{width:Math.min(100,((dailyIntake.fats||0)/(metrics?.fats||62))*100)+"%",backgroundColor:"#91B56B"}]}/></View></View>
    <View style={styles.macroTile}><Text style={styles.macroTileLabel}>{t.currentWeight}</Text><Text style={styles.macroTileValue}>{profile.weight||"—"}<Text style={styles.macroTileUnit}> {profile.weight?t.kg:""}</Text></Text><Text style={styles.macroTileHint}>{t.progress}</Text></View>
  </View>
  {!metrics && <Text style={[styles.muted,{textAlign:isRTL?"right":"left"}]}>{t.optionalProfileNote}</Text>}
  <Pressable accessibilityRole="button" onPress={()=>setTab("diary")} style={styles.openDiaryButton}><Text style={styles.openDiaryButtonText}>{t.openFoodDiary}</Text><Text style={styles.openDiaryArrow}>›</Text></Pressable>
  <View style={styles.dashboardFootnote}><Text style={styles.dashboardFootnoteText}>{t.mealsLogged}: {dailyIntake.calories!==null && dailyIntake.calories>0 ? "✓" : "0"}</Text><Text style={styles.dashboardFootnoteText}>DANAT WELLNESS</Text></View>
</>}</ScrollView>}{tab === "diary" && (!hydrated
          ? <ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.cardTitle}>{t.preparingFoods}</Text><Text style={styles.muted}>{t.preparingFoodsHint}</Text></Card></ScrollView>
          : storageError
            ? <ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.cardTitle}>{t.foodUnavailable}</Text><Text style={styles.muted}>{storageError}</Text></Card></ScrollView>
            : <FoodDiary language={language} targetCalories={metrics?.calories ?? 2000} />)}

        {tab === "progress" && <ScrollView contentContainerStyle={styles.content}>
  <View style={styles.dashboardIntro}><View style={styles.todayPill}><View style={styles.liveDot}/><Text style={styles.todayPillText}>DANAT / WELLNESS</Text></View><Text style={[styles.pageTitle,direction]}>{t.progress}</Text><Text style={[styles.introNote,direction]}>{t.weightTrend}</Text></View>
  <View style={styles.progressHero}>
    <Text style={styles.heroLabel}>{t.currentWeight.toUpperCase()}</Text>
    <View style={styles.spaceBetween}><Text style={styles.progressWeight}>{weightLog.length ? weightLog[weightLog.length-1].weight_kg+" "+t.kg : (profile.weight ? profile.weight+" "+t.kg : "—")}</Text><Text style={styles.progressTrendMark}>↗</Text></View>
    <Text style={styles.muted}>{weightLog.length ? new Date(weightLog[weightLog.length-1].recorded_at).toLocaleDateString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US") : t.emptyProgress}</Text>
    {profile.targetWeight ? <View style={styles.targetWeightPill}><Text style={styles.targetWeightText}>{t.targetWeight}: {profile.targetWeight} {t.kg}</Text></View> : null}
  </View>
  <Card>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t.weightTrend}</Text><Text style={styles.sectionMeta}>{weightLog.length} {t.logWeight.toUpperCase()}</Text></View>
    {weightLog.length ? <>
      <View style={styles.chartBars}>{weightLog.slice(-12).map((entry,index,arr)=>{const values=arr.map(x=>x.weight_kg);const min=Math.min(...values),max=Math.max(...values);const height=max===min?48:Math.max(16,24+((entry.weight_kg-min)/(max-min))*66);return <View key={entry.id} style={styles.chartColumn}><Text style={styles.chartValue}>{entry.weight_kg}</Text><View style={[styles.chartBar,{height,backgroundColor:index===arr.length-1?"#EFFF00":"#4FA66B"}]}/><Text style={styles.chartDate}>{new Date(entry.recorded_at).toLocaleDateString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US",{day:"numeric",month:"short"})}</Text></View>;})}</View>
      <View style={styles.weightList}>{weightLog.slice(-5).reverse().map(entry=><View key={entry.id} style={styles.spaceBetween}><Text style={styles.muted}>{new Date(entry.recorded_at).toLocaleDateString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US")}</Text><Text style={styles.valueText}>{entry.weight_kg} {t.kg}</Text></View>)}</View>
    </> : <Text style={styles.muted}>{t.emptyProgress}</Text>}
  </Card>
  <Card><Text style={styles.cardTitle}>{t.logWeight}</Text><TextInput value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" placeholder={t.weight} placeholderTextColor={MUTED} style={[styles.input,direction]}/><GoldButton title={t.logWeight} onPress={addWeight}/></Card>
</ScrollView>}
{tab === "profile" && <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.pageTitle, direction]}>{t.profile}</Text>
            <Card>
              <Field label={language==='ar'?'الاسم':language==='fr'?'Prénom':'Your name'} value={profile.name} onChangeText={v => change('name', v)} />
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
              <Text style={styles.fieldLabel}>{language==="ar"?"معادلة الوزن المثالي":language==="fr"?"Formule du poids idéal":"Ideal weight formula"}</Text>
               <View style={styles.optionRow}>
                 <Choice title="Devine" active={profile.ibwFormula==="devine"} onPress={()=>change("ibwFormula","devine")} />
                 <Choice title="Robinson" active={profile.ibwFormula==="robinson"} onPress={()=>change("ibwFormula","robinson")} />
               </View>
               <Text style={styles.muted}>{language==="ar"?"يُحسب الوزن المثالي وفق الجنس والطول. هذه تقديرات وليست هدفاً طبياً إلزامياً.":language==="fr"?"Estimation selon la taille et le sexe ; ce n’est pas un objectif médical obligatoire.":"Estimated from height and sex; this is a reference, not a mandatory medical target."}</Text>
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
            <ReminderSettings language={language} />
            {metrics && <Card><Text style={styles.cardTitle}>{t.bodyMetrics}</Text>
              <MetricLine label={t.idealWeight} value={metrics.ideal.toFixed(1) + " kg"} />
               <MetricLine label={language==="ar"?"معادلة الوزن المثالي":language==="fr"?"Formule du poids idéal":"IBW formula"} value={profile.ibwFormula==="devine"?"Devine":"Robinson"} /><MetricLine label={t.healthyRange} value={metrics.min.toFixed(1) + "–" + metrics.max.toFixed(1) + " kg"} />
              <MetricLine label={t.bodyFat} value={metrics.bodyFat === null ? "—" : metrics.bodyFat.toFixed(1) + "%"} /><MetricLine label={t.leanMass} value={metrics.leanMass === null ? "—" : metrics.leanMass.toFixed(1) + " kg"} />
              <MetricLine label={t.muscleMass} value={metrics.muscleMass === null ? "—" : metrics.muscleMass.toFixed(1) + " kg"} /><MetricLine label={t.waistHeight} value={metrics.waistHeight === null ? "—" : metrics.waistHeight.toFixed(2)} />
              <MetricLine label={t.waistHip} value={metrics.waistHip === null ? "—" : metrics.waistHip.toFixed(2)} /><MetricLine label={t.waterNeeds} value={(metrics.waterMl / 1000).toFixed(2) + " L / day"} />
               <Text style={styles.muted}>{language==="ar"?"تقدير مبدئي يتغير حسب مستوى النشاط؛ احتياجات السوائل تختلف باختلاف الطقس والصحة والتعرق.":language==="fr"?"Estimation ajustée à l’activité ; les besoins varient aussi selon le climat, la santé et la transpiration.":"Activity-adjusted estimate. Actual fluid needs also vary with climate, health and sweating."}</Text>
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
function Macro({label,value,consumed,color}:{label:string;value:number;consumed:number|null;color:string}){const pct=Math.min(100,Math.max(0,(consumed??0)/Math.max(1,value)*100));return <View style={{paddingVertical:8}}><View style={styles.macroRow}><Text style={styles.muted}>{label}</Text><Text style={{color:"#E8E8DC",fontWeight:"800"}}>{consumed===null?"0":Math.round(consumed)} / {value} g</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{backgroundColor:color,width:pct+"%"}]}/></View></View>;}
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
  splashContainer: { flex: 1, backgroundColor: "#090D0B", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  splashImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  splashShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 10, 7, 0.62)" },
  splashContent: { width: "100%", maxWidth: 480, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", flex: 1 },
  splashEyebrow: { color: "#EFFF00", fontSize: 11, fontWeight: "800", letterSpacing: 4, marginBottom: 12 },
  splashTitle: { color: "#F2F0E8", fontSize: 34, fontWeight: "900", letterSpacing: 3, textAlign: "center" },
  splashAccent: { width: 58, height: 4, borderRadius: 4, backgroundColor: "#EFFF00", marginTop: 20, marginBottom: 28 },
  splashWelcome: { color: "#F2F0E8", fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: 13 },
  splashArabic: { color: "#F2F0E8", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 13, writingDirection: "rtl" },
  splashFrench: { color: "#F2F0E8", fontSize: 18, fontWeight: "700", textAlign: "center" },
  splashFooter: { position: "absolute", bottom: 28, flexDirection: "row", alignItems: "center", gap: 9 },
  splashFooterDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EFFF00" },
  splashFooterText: { color: "#F2F0E8", fontSize: 9, fontWeight: "800", letterSpacing: 2.2 },
  safe: { flex: 1, backgroundColor: "#050806", alignItems: "center" },
  appFrame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: BG, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#202820" },
  header: { paddingHorizontal: 23, paddingTop: 13, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#343B32" },
  brand: { flexDirection: "row", alignItems: "center", gap: 13 },
  rowReverse: { flexDirection: "row-reverse" },
  logoImage: { width: 46, height: 46 },
  brandEyebrow: { color: GOLD, fontWeight: "700", fontSize: 9, letterSpacing: 3.1 },
  brandName: { color: IVORY, fontWeight: "800", fontSize: 15, letterSpacing: 2.1, marginTop: 4 },
  languageSelector: { flexDirection: "row", alignItems: "center", gap: 5 },
  languageButton: { borderWidth: 1, borderColor: "#485347", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8, minWidth: 35, alignItems: "center" },
  languageButtonActive: { backgroundColor: "#263A2B", borderColor: GOLD },
  languageText: { color: GOLD, fontSize: 11, fontWeight: "900" },
  languageTextInactive: { color: MUTED },
  content: { paddingHorizontal: 22, paddingTop: 25, paddingBottom: 34, gap: 15 },
  dashboardIntro: { paddingTop: 3, paddingBottom: 7 },
  todayPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: "#18231B", borderWidth: 1, borderColor: "#344B37" },
  todayPillText: { color: "#C4D2C1", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  sectionTitle: { color: IVORY, fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  calorieDashboard: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 18 },
  calorieRing: { width: 142, height: 142, borderRadius: 71, borderWidth: 9, borderColor: "#EFFF00", backgroundColor: "#18231B", alignItems: "center", justifyContent: "center", shadowColor: "#EFFF00", shadowOpacity: 0.13, shadowRadius: 14, elevation: 3 },
  calorieRingInner: { width: 122, height: 122, borderRadius: 61, backgroundColor: "#101712", alignItems: "center", justifyContent: "center" },
  ringCaption: { color: MUTED, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  ringValue: { color: IVORY, fontSize: 25, fontWeight: "900", marginTop: 4 },
  ringUnit: { color: GOLD, fontSize: 8, fontWeight: "900", letterSpacing: 2, marginTop: 2 },
  calorieSummary: { flex: 1, minWidth: 0 },
  remainingPanel: { borderLeftWidth: 2, borderLeftColor: "#EFFF00", paddingLeft: 10, marginTop: 14 },
  remainingValue: { color: "#EFFF00", fontSize: 24, fontWeight: "900" },
  remainingLabel: { color: MUTED, fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  macroTile: { width: "48%", flexGrow: 1, minWidth: 130, backgroundColor: PANEL, borderRadius: 15, borderWidth: 1, borderColor: "#303A31", padding: 14, minHeight: 91 },
  macroTileLabel: { color: MUTED, fontSize: 11, fontWeight: "700", marginBottom: 8 },
  macroTileValue: { color: IVORY, fontSize: 19, fontWeight: "900" },
  macroTileUnit: { color: MUTED, fontSize: 10, fontWeight: "600" },
  macroTileHint: { color: GREEN, fontSize: 9, fontWeight: "800", marginTop: 5 },
  miniTrack: { height: 4, backgroundColor: "#303A31", borderRadius: 8, marginTop: 9, overflow: "hidden" },
  miniFill: { height: 4, borderRadius: 8 },
  openDiaryArrow: { color: "#090D0B", fontSize: 25, fontWeight: "900", position: "absolute", right: 18, top: 7 },
  dashboardFootnote: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 3, paddingTop: 2 },
  dashboardFootnoteText: { color: "#778278", fontSize: 8, fontWeight: "800", letterSpacing: 1 },

  greeting: { color: IVORY, fontSize: 29, lineHeight: 36, fontWeight: "700", letterSpacing: -0.8, marginTop: 8 },
  introNote: { color: MUTED, fontSize: 13, marginTop: 7, letterSpacing: 0.2 },
  eyebrow: { color: GOLD, fontSize: 9, letterSpacing: 2.6, fontWeight: "800", marginBottom: 3 },
  pageTitle: { color: IVORY, fontSize: 29, fontWeight: "700", letterSpacing: -0.7, marginBottom: 4 },
  card: { backgroundColor: PANEL, borderRadius: 18, borderWidth: 1, borderColor: "#343B32", padding: 19, marginBottom: 2 },
  cardTitle: { color: IVORY, fontSize: 13, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 19 },
  calorieHero: { backgroundColor: "#18231B", borderRadius: 22, borderWidth: 1, borderColor: "#485347", padding: 21, marginBottom: 2 },
  heroTopline: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroLabel: { color: "#A7B0A7", fontSize: 9, fontWeight: "800", letterSpacing: 2.2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  heroNumberRow: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  calorieNumber: { color: IVORY, fontSize: 43, fontWeight: "700", letterSpacing: -1.7, marginVertical: 3 },
  heroSubline: { color: GOLD, fontSize: 9, fontWeight: "800", letterSpacing: 1.7 },
  calorieBadge: { minWidth: 77, minHeight: 77, borderRadius: 39, borderWidth: 1, borderColor: GOLD, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  badgeValue: { color: IVORY, fontSize: 17, fontWeight: "800" },
  badgeCaption: { color: MUTED, fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  progressTrack: { height: 5, backgroundColor: "#303A31", borderRadius: 10, marginTop: 20, marginBottom: 11, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: GREEN, borderRadius: 10 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  sectionMeta: { color: GOLD, fontSize: 8, fontWeight: "800", letterSpacing: 1.3 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  greenText: { color: GREEN, fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 11 },
  statIcon: { color: GOLD, fontSize: 18, marginBottom: 10 },
  statValue: { color: IVORY, fontSize: 23, fontWeight: "700", letterSpacing: -0.5, marginBottom: 4 },
  macroRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#303A31" },
  mealCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: PANEL, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#343B32" },
  mealIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#202920", alignItems: "center", justifyContent: "center" },
  addIcon: { color: GOLD, fontSize: 24, fontWeight: "700" },
  weightList: { gap: 9, marginTop: 8 },
  progressHero: { backgroundColor: "#18231B", borderRadius: 22, borderWidth: 1, borderColor: "#344B37", padding: 20 },
  progressWeight: { color: IVORY, fontSize: 36, fontWeight: "900", marginVertical: 8 },
  progressTrendMark: { color: "#EFFF00", fontSize: 28, fontWeight: "900" },
  targetWeightPill: { alignSelf: "flex-start", backgroundColor: "#263A2B", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  targetWeightText: { color: "#EFFF00", fontSize: 10, fontWeight: "800" },
  chartBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", minHeight: 145, paddingTop: 12, paddingBottom: 6, gap: 5 },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", minWidth: 0 },
  chartValue: { color: "#E8E8DC", fontSize: 9, fontWeight: "800", marginBottom: 5 },
  chartBar: { width: "58%", minWidth: 9, borderRadius: 7 },
  chartDate: { color: MUTED, fontSize: 8, marginTop: 6 },

  valueText: { color: GOLD, fontWeight: "800" },
  input: { color: "#F2F0E8", backgroundColor: "#101712", borderWidth: 1, borderColor: "#485347", borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, marginTop: 7, fontSize: 15 },
  field: { marginBottom: 13 },
  fieldLabel: { color: "#E8E8DC", fontWeight: "700", fontSize: 13, marginBottom: 3, marginTop: 6 },
  optionRow: { flexDirection: "row", gap: 9, marginBottom: 12 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  choice: { borderWidth: 1, borderColor: "#303A31", backgroundColor: "#141A16", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  choiceActive: { borderColor: GOLD, backgroundColor: "#263A2B" },
  choiceText: { color: "#C2C8BB", fontSize: 12, fontWeight: "700" },
  openDiaryButton: { backgroundColor: "#EFFF00", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 5, borderWidth: 1, borderColor: "#F7FF78", shadowColor: "#EFFF00", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  openDiaryButtonText: { color: "#090D0B", fontWeight: "900", fontSize: 14, letterSpacing: 0.4 },
  goldButton: { backgroundColor: "#EFFF00", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  goldButtonText: { color: "#090D0B", fontWeight: "900", fontSize: 14 },
  tabBar: { flexDirection: "row", backgroundColor: "#141A16", borderTopWidth: 1, borderTopColor: "#343B32", paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 23 : 13 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 },
  tabIcon: { color: "#899487", fontSize: 21, fontWeight: "500" },
  tabLabel: { color: "#A7B0A7", fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },
  activeTab: { color: GOLD }
});
