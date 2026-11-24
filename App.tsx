import React, { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { addWeightMeasurement, getWeightMeasurements, updateWeightMeasurement, clearWeightMeasurements, getDailyMealFoods, nutritionForQuantity, loadProfile, saveProfile as saveProfileToDatabase, ensureFoundationFoodsImported, ensureFnddsFoodsImported, getProfilePhotoDataUri, saveProfilePhotoDataUri, deleteProfilePhoto } from "./src/storage/database";
import type { ImportedFoodRecord, FoodRecord } from "./src/storage/database";
import {
  StatusBar, StyleSheet, Text, View, ScrollView, Image, ImageBackground,
  Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Language, translations, rtl } from "./src/i18n";
import FoodDiary from "./src/storage/FoodDiary";
import BarcodeScanner from "./src/storage/BarcodeScanner";
import { readTodaySteps, requestAndReadTodaySteps } from "./src/storage/healthSteps";
import ReminderSettings from "./src/storage/ReminderSettings";
import { USDA_FOUNDATION_FOODS } from "./src/data/usda-foundation-foods";
import { loadFnddsFoods } from "./src/data/load-fndds-foods";
import { addActivityLog, deleteActivityLog, deleteActivityLogsForDay, getActivityLogs, getChallengeCheckins, toggleChallengeCheckin } from "./src/storage/database";
import AuthGateModal from "./src/components/AuthGateModal";
import { firebaseAuthConfigured, observeAuthState, registerWithEmail, resendVerificationEmail, refreshEmailVerification, sendPasswordReset, signInWithEmail, signOutUser } from "./src/firebase/auth";
import AdBanner from "./src/ads/AdBanner";
import useAds from "./src/ads/useAds";

type Tab = "dashboard" | "diary" | "progress" | "weight" | "activity" | "goals" | "challenges" | "profile" | "contact";
type Profile = {
  name: string; age: string; sex: "male" | "female"; height: string; weight: string;
  targetWeight: string; activity: "sedentary" | "light" | "moderate" | "active" | "veryActive"; ibwFormula: "devine" | "robinson";
  objective: "lose" | "maintain" | "gain";
  waist: string; hip: string; neck: string; bodyFat: string; muscleMass: string;
};

const GOLD = "#FFC928";
const GREEN = "#1686E8";
const BG = "#F2F8FF";
const PANEL = "#FFFFFF";
const MUTED = "#53677D";
const IVORY = "#17324D";
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

function FitnessProApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [showWelcome, setShowWelcome] = useState(true);
  const [authUser, setAuthUser] = useState<{ uid: string; email: string | null; emailVerified: boolean } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const { ready: adsReady, showInterstitial } = useAds();

  useEffect(() => {
    try {
      const unsubscribe = observeAuthState(user => {
        setAuthUser(user ? { uid: user.uid, email: user.email, emailVerified: user.emailVerified } : null);
        setAuthReady(true);
      });
      return unsubscribe;
    } catch (error) {
      console.warn("Firebase Authentication is not ready", error);
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000);
    return () => clearTimeout(timer);
  }, []);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [stepsEnabled, setStepsEnabled] = useState(false);
  const [scannedFood, setScannedFood] = useState<FoodRecord | null>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [webStorageReady, setWebStorageReady] = useState(Platform.OS !== "web");
  const [weightLog, setWeightLog] = useState<{ id: number; recorded_at: string; weight_kg: number }[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [editingWeightId, setEditingWeightId] = useState<number | null>(null);
  const [editingWeightValue, setEditingWeightValue] = useState("");
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
        const [storedProfile, measurements, storedPhoto] = await Promise.all([loadProfile(), getWeightMeasurements(), getProfilePhotoDataUri()]);
        setProfilePhotoUri(storedPhoto);
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
  const chooseProfilePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.72,
        base64: true, exif: false
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      const asset = result.assets[0];
      const mime = asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
      const dataUri = `data:${mime};base64,${asset.base64}`;
      await saveProfilePhotoDataUri(dataUri);
      setProfilePhotoUri(dataUri);
    } catch (error) {
      console.warn("Could not save profile photo locally", error);
      Alert.alert(language === "ar" ? "تعذر حفظ الصورة" : language === "fr" ? "Impossible d’enregistrer la photo" : "Could not save photo");
    }
  };
  const removeProfilePhoto = async () => {
    try { await deleteProfilePhoto(); setProfilePhotoUri(null); }
    catch (error) { console.warn("Could not remove local profile photo", error); }
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
      setWeightLog(await getWeightMeasurements());
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
  const saveWeightEdit = async (id: number) => {
    const value = Number(editingWeightValue);
    if (!Number.isFinite(value) || value <= 0) { Alert.alert(language==="ar"?"أدخل وزناً صحيحاً":language==="fr"?"Saisissez un poids valide":"Enter a valid weight"); return; }
    try { await updateWeightMeasurement(id,value); setWeightLog(await getWeightMeasurements()); setEditingWeightId(null); setEditingWeightValue(""); }
    catch(error) { Alert.alert(t.saveFailed,String(error)); }
  };
  const resetWeightHistory = () => Alert.alert(
    language==="ar"?"إعادة ضبط سجل الوزن":language==="fr"?"Réinitialiser l’historique du poids":"Reset weight history",
    language==="ar"?"سيتم حذف جميع قياسات الوزن المسجلة. سيبقى الوزن المحفوظ في الملف الشخصي كما هو. هل تريد المتابعة؟":language==="fr"?"Toutes les mesures enregistrées seront supprimées. Le poids du profil sera conservé. Continuer ?":"This will delete all recorded weight entries. Your Profile weight will remain unchanged. Continue?",
    [{text:language==="ar"?"إلغاء":language==="fr"?"Annuler":"Cancel",style:"cancel"},{text:language==="ar"?"إعادة ضبط":language==="fr"?"Réinitialiser":"Reset",style:"destructive",onPress:async()=>{try{await clearWeightMeasurements();setWeightLog([]);setEditingWeightId(null);setEditingWeightValue("");}catch(error){Alert.alert(t.saveFailed,String(error));}}}]
  );

  const requestFeature = (action: () => void) => {
    if (!authReady) {
      Alert.alert("Please wait", "Fitness Pro is checking your account. Try again in a moment.");
      return;
    }
    if (!authUser || !authUser.emailVerified) { setAuthPromptVisible(true); return; }
    action();
  };
  const openFeatureWithAd = (action: () => void) => {
    if (Platform.OS !== "web" && showInterstitial(action)) return;
    action();
  };
  const navigateToTab = (nextTab: Tab) => requestFeature(() => {
    if (nextTab === "diary") openFeatureWithAd(() => setTab(nextTab));
    else setTab(nextTab);
  });
  const confirmSignOut = () => setSignOutConfirmVisible(true);
  const performSignOut = async () => {
    if (signOutBusy) return;
    setSignOutBusy(true);
    try {
      await signOutUser();
      setSignOutConfirmVisible(false);
      setAuthPromptVisible(false);
      setTab("dashboard");
    } catch (error) {
      console.warn("Could not sign out", error);
      if (Platform.OS === "web") {
        setSignOutConfirmVisible(false);
        window.alert(language === "ar" ? "تعذر تسجيل الخروج. حاول مرة أخرى." : language === "fr" ? "Échec de la déconnexion. Réessayez." : "Sign out failed. Please try again.");
      } else {
        Alert.alert("Sign out failed", "Please try again.");
      }
    } finally {
      setSignOutBusy(false);
    }
  };

  if (showWelcome) {
    return (
      <SafeAreaView style={styles.splashContainer}>        <View style={styles.splashFrame}>          <StatusBar barStyle="light-content" />
          <Image
            source={require("./assets/images/welcome.jpg")}
            style={styles.splashImage}
            resizeMode="cover"
            accessibilityLabel="FITNESS PRO welcome"
          />
          <View style={styles.splashShade} />
          <View style={styles.splashContent}>
            <Text style={styles.splashEyebrow}>DANAT WELLNESS</Text>
            <Text style={styles.splashTitle}>FITNESS PRO</Text>
            <View style={styles.splashAccent} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.appFrame}>
      <Image source={require("./assets/images/background.jpg")} style={styles.appBackgroundImage} resizeMode="cover" />
      {!["dashboard", "diary", "progress", "profile", "contact", "activity", "goals", "challenges"].includes(tab) && <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require("./assets/images/danat-logo.png")} style={styles.logoImage} resizeMode="contain" accessibilityLabel="Danat logo" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandEyebrow, direction]}>DANAT / WELLNESS</Text>
            <Text style={[styles.brandName, direction]}>FITNESS PRO</Text>
          </View>
          {!["activity", "goals", "challenges"].includes(tab) && <View style={styles.languageSelector}><LanguageChoices language={language} onChange={setLanguage} /></View>}
        </View>
      </View>}

      <View style={{ flex: 1 }}>
        {tab === "dashboard" && <View style={styles.dashboardScreenBackground}><ScrollView contentContainerStyle={styles.dashboardContent}>
  <View style={styles.dashboardHero}>

    <View style={styles.dashboardBrandRow}>
      <Image source={require("./assets/images/danat-logo.png")} style={styles.dashboardBrandLogo} resizeMode="contain" />
      <View style={{flex:1}}>
        <Text style={styles.dashboardBrandTitle}>FITNESS <Text style={styles.dashboardBrandAccent}>PRO</Text></Text>
        <Text style={styles.dashboardBrandSubtitle}>BY DANAT</Text>
      </View>
      <Pressable onPress={()=>setShowLanguageMenu(value=>!value)} style={styles.dashboardSettings} accessibilityRole="button" accessibilityLabel="Change language"><Ionicons name="settings-outline" size={24} color="#FFFFFF"/></Pressable>
      {authUser && <Pressable onPress={confirmSignOut} style={styles.dashboardSettings} accessibilityRole="button" accessibilityLabel="Sign out"><Ionicons name="log-out-outline" size={22} color="#FFD400"/></Pressable>}
    </View>
    {showLanguageMenu && <View style={styles.dashboardLanguageMenu}><LanguageChoices language={language} onChange={code=>{setLanguage(code);setShowLanguageMenu(false);}} /></View>}
    <View style={styles.dashboardHeroMessage}>
      <Text style={[styles.dashboardSlogan,direction]}>{language==="ar"?"كن أقوى كل يوم":language==="fr"?"Plus fort chaque jour":"Be Stronger"}</Text>
      <Text style={[styles.dashboardSloganAccent,direction]}>{language==="ar"?"كل يوم":language==="fr"?"Chaque jour":"Every Day"}</Text>
    </View>
    <Pressable onPress={()=>setTab("profile")} style={[styles.dashboardGreetingRow,isRTL && styles.rowReverse]}>
      <View style={styles.dashboardGreetingAvatar}>
        {profilePhotoUri ? <Image source={{uri:profilePhotoUri}} style={styles.dashboardGreetingAvatarImage}/> : <Ionicons name="person" size={29} color="#FFFFFF"/>}
      </View>
      <View style={{flex:1}}>
        <Text style={[styles.dashboardGreetingHi,direction]}>{language==="ar"?"مرحباً":language==="fr"?"Bonjour":"Hi,"}</Text>
        <Text style={[styles.dashboardGreetingName,direction]} numberOfLines={1}>{profile.name.trim() || (language==="ar"?"صديقي":language==="fr"?"Ami":"there")}</Text>
      </View>
      <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={19} color="#FFFFFF"/>
    </Pressable>
  </View>
  {!hydrated ? <View style={styles.dashboardLoading}><Text style={styles.dashboardLoadingText}>{t.loadingDashboard}</Text></View> : <>
    <View style={[styles.calorieHero,styles.dashboardCalories]}>
      <View style={styles.dashboardFlame}><Image source={require("./assets/images/flame.png")} style={styles.dashboardFlameImage} resizeMode="contain"/></View>
      <View style={styles.dashboardCalorieBlock}>
        <Text style={styles.dashboardCalorieValue}>{dailyIntake.calories===null?"0":Math.round(dailyIntake.calories).toLocaleString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US")}</Text>
        <Text style={styles.dashboardCalorieLabel}>{t.calories}</Text>
      </View>
      <View style={styles.dashboardCalorieDivider}/>
      <View style={styles.dashboardGoalBlock}>
        <Text style={styles.dashboardGoalLabel}>{t.dailyGoal}</Text>
        <Text style={styles.dashboardGoalValue}>{metrics?metrics.calories.toLocaleString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US"):"2,000"}</Text>
        <Text style={styles.dashboardGoalPercent}>{Math.min(100,Math.round(((dailyIntake.calories||0)/(metrics?.calories||2000))*100))}%</Text>
      </View>
      <View style={styles.dashboardGoalRing}><Text style={styles.dashboardGoalRingText}>{Math.max(0,Math.round((metrics?.calories||2000)-(dailyIntake.calories||0))).toLocaleString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US")}</Text><Text style={styles.dashboardGoalRingCaption}>{t.remaining}</Text></View>
    </View>
    <View style={styles.dashboardTiles}>
      {([
        ["scanner.png",language==="ar"?"مسح الطعام":language==="fr"?"Scanner":"Scanner","scanner"],
        ["food-diary.png",language==="ar"?"سجل الطعام":language==="fr"?"Journal alimentaire":"Food Diary","diary"],
        ["progress.png",t.progress,"progress"],
        ["activity.png",language==="ar"?"النشاط":language==="fr"?"Activité":"Activity","activity"],
        ["goals.png",language==="ar"?"الأهداف":language==="fr"?"Objectifs":"Goals","goals"],
        ["challenges.png",language==="ar"?"التحديات":language==="fr"?"Défis":"Challenges","challenges"]
      ] as [string,string,Tab|"scanner"][]).map(([asset,label,target])=><Pressable key={asset} onPress={()=>requestFeature(()=>target==="scanner"||target==="diary"?openFeatureWithAd(()=>target==="scanner"?setScannerVisible(true):setTab("diary")):setTab(target))} style={styles.dashboardTile}>
        <Image source={asset==="scanner.png"?require("./assets/images/scanner.png"):asset==="food-diary.png"?require("./assets/images/food-diary.png"):asset==="progress.png"?require("./assets/images/progress.png"):asset==="activity.png"?require("./assets/images/activity.png"):asset==="goals.png"?require("./assets/images/goals.png"):require("./assets/images/challenges.png")} style={styles.dashboardTileIcon} resizeMode="stretch"/>
        <Text style={styles.dashboardTileLabel}>{label}</Text>
      </Pressable>)}
    </View>
    <View style={styles.dashboardNutrition}>
      <View style={styles.dashboardNutritionHeading}><Text style={styles.dashboardNutritionTitle}>{language==="ar"?"تغذيتك اليوم":language==="fr"?"Nutrition du jour":"Today's Nutrition"}</Text><Pressable onPress={()=>navigateToTab("diary")}><Text style={styles.dashboardNutritionLink}>{language==="ar"?"عرض التفاصيل":language==="fr"?"Voir détails":"View Details"} ›</Text></Pressable></View>
      <View style={styles.dashboardNutritionBar}><View style={[styles.dashboardNutritionSegment,{flex:Math.max(0,dailyIntake.carbs||0)*4,backgroundColor:"#16B85A"}]}/><View style={[styles.dashboardNutritionSegment,{flex:Math.max(0,dailyIntake.protein||0)*4,backgroundColor:"#168CF0"}]}/><View style={[styles.dashboardNutritionSegment,{flex:Math.max(0,dailyIntake.fats||0)*9,backgroundColor:"#FF941F"}]}/></View>
      <View style={styles.dashboardNutritionLabels}>
        <View><Text style={styles.dashboardNutritionPercent}>{Math.round((dailyIntake.carbs||0)*4/Math.max(1,(dailyIntake.carbs||0)*4+(dailyIntake.protein||0)*4+(dailyIntake.fats||0)*9)*100)}%</Text><Text style={styles.dashboardNutritionMacro}>{t.carbs}</Text></View>
        <View><Text style={styles.dashboardNutritionPercent}>{Math.round((dailyIntake.protein||0)*4/Math.max(1,(dailyIntake.carbs||0)*4+(dailyIntake.protein||0)*4+(dailyIntake.fats||0)*9)*100)}%</Text><Text style={styles.dashboardNutritionMacro}>{t.protein}</Text></View>
        <View><Text style={styles.dashboardNutritionPercent}>{Math.round((dailyIntake.fats||0)*9/Math.max(1,(dailyIntake.carbs||0)*4+(dailyIntake.protein||0)*4+(dailyIntake.fats||0)*9)*100)}%</Text><Text style={styles.dashboardNutritionMacro}>{t.fats}</Text></View>
      </View>
    </View>
  </>}
</ScrollView></View>}{tab === "diary" && (!hydrated
          ? <ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.cardTitle}>{t.preparingFoods}</Text><Text style={styles.muted}>{t.preparingFoodsHint}</Text></Card></ScrollView>
          : storageError
            ? <ScrollView contentContainerStyle={styles.content}><Card><Text style={styles.cardTitle}>{t.foodUnavailable}</Text><Text style={styles.muted}>{storageError}</Text></Card></ScrollView>
            : <FoodDiary language={language} targetCalories={metrics?.calories ?? 2000} targetProtein={metrics?.protein} targetCarbs={metrics?.carbs} targetFat={metrics?.fats} scannedFood={scannedFood} onScannedFoodHandled={()=>setScannedFood(null)} />)}

        {(tab === "progress" || tab === "weight") && <ScrollView contentContainerStyle={styles.content}>
  <View style={[styles.dashboardIntro,{backgroundColor:"transparent"}]}><View style={styles.todayPill}><View style={styles.liveDot}/><Text style={styles.todayPillText}>DANAT / WELLNESS</Text></View><Text style={[styles.pageTitle,direction,{color:"#FFFFFF"}]}>{t.progress}</Text><Text style={[styles.introNote,{color:"#FFFFFF"}]}>{language==="ar"?"تابع وزنك الحالي والوزن المستهدف وسجل قياساتك.":language==="fr"?"Suivez votre poids actuel, votre objectif et vos mesures.":"Track your current weight, target weight and recorded measurements."}</Text></View>
  <View style={styles.statRow}><View style={[styles.card,{flex:1}]}><Text style={styles.statValue}>{(weightLog[0]?.weight_kg ?? profile.weight) || "—"}</Text><Text style={styles.muted}>{t.currentWeight} ({t.kg})</Text></View><View style={[styles.card,{flex:1}]}><Text style={styles.statValue}>{profile.targetWeight || "—"}</Text><Text style={styles.muted}>{t.targetWeight} ({t.kg})</Text></View></View>
  <Card>
    <Text style={styles.cardTitle}>{language==="ar"?"متتبع الوزن الحالي":language==="fr"?"Suivi du poids":"Current Weight Tracker"}</Text>
    <Text style={styles.muted}>{weightLog.length} {language==="ar"?"قياساً مسجلاً":language==="fr"?"mesures enregistrées":"weight entries recorded"}</Text>
    {weightLog.length>0 ? <>
      <View style={styles.chartBars}>{[...weightLog].slice(0,12).reverse().map((entry,index,arr)=>{const vals=arr.map(x=>x.weight_kg),min=Math.min(...vals),max=Math.max(...vals),height=max===min?48:Math.max(16,24+((entry.weight_kg-min)/(max-min))*66);return <View key={entry.id} style={styles.chartColumn}><Text style={styles.chartValue}>{entry.weight_kg}</Text><View style={[styles.chartBar,{height,backgroundColor:"#1686E8"}]}/><Text style={styles.chartDate}>{new Date(entry.recorded_at).toLocaleDateString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US",{day:"numeric",month:"short"})}</Text></View>;})}</View>
      {weightLog.map(entry=><View key={entry.id} style={{paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#D8E5F1",gap:8}}>
        <View style={styles.spaceBetween}><Text style={styles.muted}>{new Date(entry.recorded_at).toLocaleDateString(language==="fr"?"fr-FR":language==="ar"?"ar":"en-US",{day:"numeric",month:"short",year:"numeric"})}</Text>
        {editingWeightId===entry.id ? <View style={{flexDirection:"row",alignItems:"center",gap:7}}><TextInput value={editingWeightValue} onChangeText={setEditingWeightValue} keyboardType="decimal-pad" style={[styles.input,{width:82,paddingVertical:7}]} /><Text style={styles.muted}>{t.kg}</Text><Pressable onPress={()=>saveWeightEdit(entry.id)} style={{backgroundColor:GREEN,paddingHorizontal:12,paddingVertical:9,borderRadius:9}}><Text style={{color:"#FFFFFF",fontWeight:"800"}}>{language==="ar"?"حفظ":language==="fr"?"Enregistrer":"Save"}</Text></Pressable><Pressable onPress={()=>setEditingWeightId(null)}><Text style={styles.muted}>{language==="ar"?"إلغاء":language==="fr"?"Annuler":"Cancel"}</Text></Pressable></View>
        : <View style={{flexDirection:"row",alignItems:"center",gap:12}}><Text style={styles.valueText}>{entry.weight_kg} {t.kg}</Text><Pressable onPress={()=>{setEditingWeightId(entry.id);setEditingWeightValue(String(entry.weight_kg));}} style={{backgroundColor:GREEN,paddingHorizontal:12,paddingVertical:8,borderRadius:9}}><Text style={{color:"#FFFFFF",fontWeight:"800"}}>{language==="ar"?"تعديل":language==="fr"?"Modifier":"Edit"}</Text></Pressable></View>}
        </View>
      </View>)}
    </> : <Text style={styles.muted}>{language==="ar"?"لا توجد قياسات بعد. أضف وزنك أدناه.":language==="fr"?"Aucune mesure pour le moment. Ajoutez votre poids ci-dessous.":"No measurements yet. Add your weight below."}</Text>}
    <Text style={[styles.cardTitle,{marginTop:14}]}>{t.logWeight}</Text>
    <TextInput value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" placeholder={t.weight} placeholderTextColor={MUTED} style={[styles.input,direction]}/>
    <Pressable onPress={addWeight} style={{backgroundColor:GREEN,padding:14,borderRadius:11,alignItems:"center"}}><Text style={{color:"#FFFFFF",fontWeight:"900"}}>{t.logWeight}</Text></Pressable>
    <Pressable onPress={resetWeightHistory} style={{backgroundColor:GREEN,padding:13,borderRadius:11,alignItems:"center",marginTop:5}}><Text style={{color:"#FFFFFF",fontWeight:"900"}}>{language==="ar"?"إعادة ضبط سجل الوزن":language==="fr"?"Réinitialiser l’historique":"Reset Weight History"}</Text></Pressable>
    <Text style={styles.muted}>{language==="ar"?"إعادة الضبط تحذف سجل القياسات فقط ولا تغيّر الوزن في الملف الشخصي.":language==="fr"?"La réinitialisation efface uniquement l’historique, pas le poids du profil.":"Reset clears measurement history only; your Profile weight is kept."}</Text>
  </Card>
</ScrollView>}
{tab === "activity" && <ActivityTracker language={language} weightKg={Number(profile.weight) || 0} stepsEnabled={stepsEnabled} setStepsEnabled={setStepsEnabled}/>}
{tab === "challenges" && <ChallengeTracker language={language}/>}
{tab === "goals" && <ScrollView contentContainerStyle={styles.content}>
  <View style={[styles.dashboardIntro,{backgroundColor:"transparent"}]}><View style={styles.todayPill}><View style={styles.liveDot}/><Text style={styles.todayPillText}>DANAT / WELLNESS</Text></View><Text style={[styles.pageTitle,{color:"#FFFFFF"}]}>{language==="ar"?"أهدافك":language==="fr"?"Vos objectifs":"Your Goals"}</Text><Text style={[styles.introNote,{color:"#FFFFFF"}]}>{language==="ar"?"حدد أهدافك الشخصية واحفظها في ملفك.":language==="fr"?"Définissez et enregistrez vos objectifs.":"Set and save your personal fitness targets."}</Text></View>
  <Card><Text style={styles.cardTitle}>{language==="ar"?"الهدف الرئيسي":"PRIMARY TARGET"}</Text><Field label={t.targetWeight+" ("+t.kg+")"} value={profile.targetWeight} onChangeText={v=>change("targetWeight",v)} keyboardType="decimal-pad"/><Text style={styles.fieldLabel}>{language==="ar"?"هدف اللياقة":"Fitness objective"}</Text><View style={styles.choiceWrap}><Choice title={language==="ar"?"خسارة الوزن":"Lose weight"} active={profile.objective==="lose"} onPress={()=>change("objective","lose")}/><Choice title={language==="ar"?"الحفاظ":"Maintain"} active={profile.objective==="maintain"} onPress={()=>change("objective","maintain")}/><Choice title={language==="ar"?"زيادة الوزن":"Gain weight"} active={profile.objective==="gain"} onPress={()=>change("objective","gain")}/></View><Text style={styles.fieldLabel}>{language==="ar"?"مستوى النشاط":"Activity level"}</Text><View style={styles.choiceWrap}>{(["sedentary","light","moderate","active","veryActive"] as Profile["activity"][]).map((level,i)=><Choice key={level} title={(language==="ar"?["قليل الحركة","خفيف","متوسط","نشط","نشط جداً"]:["Sedentary","Light","Moderate","Active","Very active"])[i]} active={profile.activity===level} onPress={()=>change("activity",level)}/>)}</View><Text style={styles.muted}>{language==="ar"?"تُستخدم هذه الإعدادات لحساب السعرات والماكروز اليومية المقترحة.":"These settings calculate your estimated daily calories and macros."}</Text><GoldButton title={language==="ar"?"حفظ الأهداف":"Save Goals"} onPress={saveProfile}/></Card>
  {metrics&&<Card><Text style={styles.cardTitle}>ESTIMATED DAILY TARGETS</Text><MetricLine label={t.calories} value={metrics.calories+" kcal"}/><MetricLine label={t.protein} value={metrics.protein+" g"}/><MetricLine label={t.carbs} value={metrics.carbs+" g"}/><MetricLine label={t.fats} value={metrics.fats+" g"}/></Card>}
</ScrollView>}
{tab === "contact" && <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: "center" }]}>
  <View style={styles.contactWelcome}>
    <View style={styles.contactIconCircle}><Ionicons name="mail" size={38} color={GREEN} /></View>
    <Text style={styles.contactEyebrow}>DANAT WELLNESS</Text>
    <Text style={[styles.contactTitle, direction]}>{language === "ar" ? "اتصل بنا" : language === "fr" ? "Contactez-nous" : "Contact us"}</Text>
    <Text style={[styles.contactDescription, direction]}>{language === "ar" ? "يسعدنا سماع رأيك. لأي استفسار أو مساعدة، يمكنك التواصل معنا عبر البريد الإلكتروني:" : language === "fr" ? "Nous serons ravis de vous aider. Pour toute question ou assistance, contactez-nous par e-mail :" : "We’re happy to hear from you. For questions or support, please reach us by email:"}</Text>
    <View style={styles.contactEmailBox}>
      <Ionicons name="mail-outline" size={21} color={GREEN} />
      <Text selectable style={styles.contactEmail}>IT@danat-gulf.com</Text>
    </View>
  </View>
</ScrollView>}
{tab === "profile" && <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.pageTitle, direction, { color: "#FFFFFF" }]}>{t.profile}</Text>
            <Card>
              <Text style={styles.cardTitle}>{language === "ar" ? "حسابك" : language === "fr" ? "VOTRE COMPTE" : "YOUR ACCOUNT"}</Text>
              {authUser ? <>
                <Text style={styles.muted}>{language === "ar" ? "تم تسجيل الدخول" : language === "fr" ? "Connecté en tant que" : "Signed in as"}: {authUser.email || authUser.uid}</Text>
                <GoldButton title={language === "ar" ? "تسجيل الخروج" : language === "fr" ? "Se déconnecter" : "Sign out"} onPress={confirmSignOut} />
              </> : <>
                <Text style={styles.muted}>{language === "ar" ? "سجّل الدخول أو أنشئ حساباً لفتح جميع ميزات Fitness Pro." : language === "fr" ? "Connectez-vous ou créez un compte pour accéder à toutes les fonctions de Fitness Pro." : "Log in or create an account to unlock all Fitness Pro features."}</Text>
                <GoldButton title={language === "ar" ? "تسجيل الدخول / إنشاء حساب" : language === "fr" ? "Connexion / Créer un compte" : "Log in / Create account"} onPress={() => setAuthPromptVisible(true)} />
              </>}
            </Card>
            <Card>
              <Text style={styles.fieldLabel}>{language === "ar" ? "اللغة" : language === "fr" ? "Langue" : "Language"}</Text>
              <View style={[styles.languageSelector,{marginBottom:18}]}><LanguageChoices language={language} onChange={setLanguage} /></View>
              <View style={styles.profilePhotoSection}>
                <View style={styles.profilePhotoPreview}>{profilePhotoUri ? <Image source={{ uri: profilePhotoUri }} style={styles.profilePhotoImage} /> : <Text style={styles.profilePhotoPlaceholder}>👤</Text>}</View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={styles.fieldLabel}>{language === "ar" ? "الصورة الشخصية" : language === "fr" ? "Photo de profil" : "Profile photo"}</Text>
                  <Pressable onPress={chooseProfilePhoto} style={styles.photoButton}><Text style={styles.photoButtonText}>{profilePhotoUri ? (language === "ar" ? "تغيير الصورة" : language === "fr" ? "Changer la photo" : "Change photo") : (language === "ar" ? "إضافة صورة" : language === "fr" ? "Ajouter une photo" : "Add photo")}</Text></Pressable>
                  {profilePhotoUri ? <Pressable onPress={removeProfilePhoto}><Text style={styles.removePhotoText}>{language === "ar" ? "إزالة الصورة" : language === "fr" ? "Supprimer la photo" : "Remove photo"}</Text></Pressable> : null}
                  <Text style={styles.muted}>{language === "ar" ? "تُحفظ الصورة على هذا الجهاز فقط ولا تُرفع إلى Firebase." : language === "fr" ? "La photo reste sur cet appareil et n’est pas envoyée à Firebase." : "Stored on this device only. It is never uploaded to Firebase."}</Text>
                </View>
              </View>
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
      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onFound={food => { setScannedFood(food); setScannerVisible(false); setTab("diary"); }}
        language={language}
      />

      <Modal visible={signOutConfirmVisible} transparent animationType="fade" onRequestClose={() => setSignOutConfirmVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(2,12,27,0.78)", justifyContent: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 380, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#FFC928", padding: 22, gap: 16 }}>
            <Text style={{ color: "#102A46", fontSize: 21, fontWeight: "900", textAlign: isRTL ? "right" : "left" }}>{language === "ar" ? "تسجيل الخروج" : language === "fr" ? "Se déconnecter" : "Sign out"}</Text>
            <Text style={{ color: "#52677E", fontSize: 15, lineHeight: 22, textAlign: isRTL ? "right" : "left" }}>{language === "ar" ? "هل تريد تسجيل الخروج من حسابك؟" : language === "fr" ? "Voulez-vous vous déconnecter de votre compte ?" : "Are you sure you want to sign out of your account?"}</Text>
            <Pressable disabled={signOutBusy} onPress={() => void performSignOut()} style={{ minHeight: 48, borderRadius: 12, backgroundColor: "#FFC928", alignItems: "center", justifyContent: "center", opacity: signOutBusy ? 0.6 : 1 }}>
              <Text style={{ color: "#09213D", fontWeight: "900" }}>{signOutBusy ? (language === "ar" ? "جارٍ تسجيل الخروج..." : language === "fr" ? "Déconnexion..." : "Signing out...") : (language === "ar" ? "تأكيد تسجيل الخروج" : language === "fr" ? "Confirmer" : "Confirm sign out")}</Text>
            </Pressable>
            <Pressable disabled={signOutBusy} onPress={() => setSignOutConfirmVisible(false)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#52677E", fontWeight: "800" }}>{language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <AuthGateModal
        visible={authPromptVisible}
        language={language}
        busy={authBusy}
        configured={firebaseAuthConfigured}
        verificationRequired={Boolean(authUser && !authUser.emailVerified)}
        verificationEmail={authUser?.email ?? null}
        onClose={() => setAuthPromptVisible(false)}
        onRegister={async (email, password, remember, policyAccepted) => {
          setAuthBusy(true);
          try { return await registerWithEmail(email, password, remember, policyAccepted); }
          finally { setAuthBusy(false); }
        }}
        onLogin={async (email, password, remember) => {
          setAuthBusy(true);
          try { const credential = await signInWithEmail(email, password, remember); return credential.user.emailVerified; }
          finally { setAuthBusy(false); }
        }}
        onResendVerification={async () => {
          setAuthBusy(true);
          try { await resendVerificationEmail(); }
          finally { setAuthBusy(false); }
        }}
        onCheckVerification={async () => {
          setAuthBusy(true);
          try {
            const verified = await refreshEmailVerification();
            if (verified) setAuthUser(current => current ? { ...current, emailVerified: true } : current);
            return verified;
          } finally { setAuthBusy(false); }
        }}
        onReset={async email => {
          setAuthBusy(true);
          try { await sendPasswordReset(email); }
          finally { setAuthBusy(false); }
        }}
      />
      <AdBanner enabled={adsReady} />
      <View style={[styles.tabBar, isRTL && styles.rowReverse]}>
        {([
          ["dashboard", "home", "home-outline", t.dashboard],
          ["diary", "book", "book-outline", t.diary],
          ["progress", "stats-chart", "stats-chart-outline", t.progress],
          ["profile", "person-circle", "person-circle-outline", t.profile]
        ] as [Tab, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap, string][]).map(([key, activeIcon, inactiveIcon, label]) =>
          <Pressable key={key} onPress={() => key === "profile" ? setTab("profile") : navigateToTab(key)} style={styles.tabItem} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: tab === key }}>
            <Ionicons name={tab === key ? activeIcon : inactiveIcon} size={23} color={tab === key ? GREEN : "#6F89A8"} />
            <Text style={[styles.tabLabel, tab === key && styles.activeTab]} numberOfLines={1}>{label}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => navigateToTab("contact")} style={styles.tabItem} accessibilityRole="button" accessibilityLabel={language === "ar" ? "اتصل بنا" : language === "fr" ? "Contactez-nous" : "Contact us"} accessibilityState={{ selected: tab === "contact" }}>
          <Ionicons name={tab === "contact" ? "mail" : "mail-outline"} size={23} color={tab === "contact" ? GREEN : "#6F89A8"} />
          <Text style={[styles.tabLabel, tab === "contact" && styles.activeTab]} numberOfLines={1}>{language === "ar" ? "اتصل بنا" : language === "fr" ? "Contactez-nous" : "Contact us"}</Text>
        </Pressable>
      </View>
      </View>
    </SafeAreaView>  );
}

function ActivityTracker({language,weightKg,stepsEnabled,setStepsEnabled}:{language:Language;weightKg:number;stepsEnabled:boolean;setStepsEnabled:(enabled:boolean)=>void}) {
 const ar=language==="ar",fr=language==="fr";
 const [logs,setLogs]=useState<Awaited<ReturnType<typeof getActivityLogs>>>([]);
 const [kind,setKind]=useState("Walking"),[duration,setDuration]=useState("");
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [steps,setSteps]=useState<number|null>(null),[stepsLoading,setStepsLoading]=useState(false),[stepsMessage,setStepsMessage]=useState("");
 const names=ar?["المشي","الجري","ركوب الدراجة","تمارين القوة","السباحة","اليوغا","نشاط آخر"]:fr?["Marche","Course","Vélo","Musculation","Natation","Yoga","Autre"]:["Walking","Running","Cycling","Strength training","Swimming","Yoga","Other"];
 const kinds=["Walking","Running","Cycling","Strength training","Swimming","Yoga","Other"];
 const metValues:Record<string,number>={Walking:3.5,Running:8,Cycling:6.8,"Strength training":5,Swimming:6,Yoga:2.5,Other:4};
 const mins=Number(duration);
 const estimatedCalories=weightKg>0&&Number.isFinite(mins)&&mins>0
   ? Math.round((metValues[kind]*3.5*weightKg/200)*mins) : null;
 const refresh=async()=>{setLogs(await getActivityLogs());setLoading(false);};
 const refreshSteps=async()=>{
  setStepsLoading(true);setStepsMessage("");
  try{
   const result=await readTodaySteps();
   if(!result.available){setSteps(null);setStepsMessage(ar?"عداد الخطوات التلقائي متاح في التطبيق المثبّت فقط، وليس في Safari.":fr?"Le comptage automatique est disponible dans l’application installée, pas dans Safari.":"Automatic step counting is available in the installed app, not Safari.");}
   else setSteps(result.steps);
  }catch(error){setStepsMessage(ar?"تعذر قراءة عدد الخطوات. تحقق من أذونات الصحة.":fr?"Impossible de lire les pas. Vérifiez les autorisations santé.":"Could not read steps. Check the health permissions.");}
  finally{setStepsLoading(false);}
 };
 const connectSteps=async()=>{
  setStepsLoading(true);setStepsMessage("");
  try{
   const result=await requestAndReadTodaySteps();
   if(!result.available){setStepsMessage(ar?"افتح التطبيق المثبّت لاستخدام Apple Health أو Health Connect.":fr?"Ouvrez l’application installée pour utiliser Apple Health ou Health Connect.":"Open the installed app to use Apple Health or Health Connect.");}
   else{setStepsEnabled(true);setSteps(result.steps);}
  }catch(error){setStepsMessage(ar?"لم يتم منح إذن قراءة الخطوات. يمكنك السماح به من إعدادات الصحة.":fr?"L’accès aux pas n’a pas été accordé. Autorisez-le dans les réglages santé.":"Step access was not granted. You can allow it in your health settings.");}
  finally{setStepsLoading(false);}
 };
 useEffect(()=>{if(stepsEnabled)void refreshSteps();},[stepsEnabled]);
 const dayKey=(value:string)=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
 const grouped=logs.reduce<Record<string,typeof logs>>((acc,item)=>{const key=dayKey(item.logged_at);(acc[key]??=[]).push(item);return acc;},{});
 const dayBounds=(key:string)=>{const [y,m,d]=key.split("-").map(Number);const start=new Date(y,m-1,d);const end=new Date(y,m-1,d+1);return {start:start.toISOString(),end:end.toISOString()};};
 const confirmDelete=(title:string,message:string,onConfirm:()=>Promise<void>)=>{
  if(Platform.OS==="web"){if(typeof window!=="undefined"&&window.confirm(title+"\\n\\n"+message))void onConfirm();return;}
  Alert.alert(title,message,[{text:ar?"إلغاء":fr?"Annuler":"Cancel",style:"cancel"},{text:ar?"حذف":fr?"Supprimer":"Delete",style:"destructive",onPress:()=>{void onConfirm();}}]);
 };
 const askDeleteOne=(id:number)=>confirmDelete(ar?"حذف النشاط؟":fr?"Supprimer l’activité ?":"Delete activity?",ar?"سيتم حذف هذا النشاط فقط.":fr?"Seule cette activité sera supprimée.":"Only this activity will be deleted.",async()=>{await deleteActivityLog(id);await refresh();});
 const askDeleteDay=(key:string)=>confirmDelete(ar?"حذف نشاطات اليوم؟":fr?"Supprimer toute la journée ?":"Delete the full day?",ar?"سيتم حذف جميع أنشطة هذا اليوم.":fr?"Toutes les activités de cette journée seront supprimées.":"All activities recorded on this day will be deleted.",async()=>{const b=dayBounds(key);await deleteActivityLogsForDay(b.start,b.end);await refresh();});
 useEffect(()=>{refresh().catch(()=>setLoading(false));},[]);
 const save=async()=>{
   if(!Number.isFinite(mins)||mins<=0){Alert.alert(ar?"أدخل مدة صحيحة":fr?"Saisissez une durée valide":"Enter a valid duration");return;}
   if(weightKg<=0){Alert.alert(ar?"أضف وزنك أولاً في الملف الشخصي":fr?"Ajoutez d’abord votre poids dans le profil":"Add your current weight in Profile first");return;}
   if(estimatedCalories===null)return;
   try{setSaving(true);await addActivityLog(kind,Math.round(mins),estimatedCalories);setDuration("");await refresh();}
   catch{Alert.alert(ar?"تعذر حفظ النشاط":fr?"Impossible d’enregistrer l’activité":"Could not save activity");}
   finally{setSaving(false);}
 };
 return <ScrollView contentContainerStyle={styles.content}>
  <View style={[styles.dashboardIntro,{backgroundColor:"transparent"}]}>
   <View style={styles.todayPill}><View style={styles.liveDot}/><Text style={styles.todayPillText}>DANAT / WELLNESS</Text></View>
   <Text style={[styles.pageTitle,{color:"#FFFFFF"}]}>{ar?"النشاط اليومي":fr?"Activité quotidienne":"Daily Activity"}</Text>
   <Text style={[styles.introNote,{color:"#FFFFFF"}]}>{ar?"اختر نشاطك وأدخل مدته فقط. سيحسب التطبيق السعرات المحروقة تلقائياً.":fr?"Choisissez une activité et sa durée. L’application estime automatiquement les calories brûlées.":"Choose your activity and enter its duration. The app estimates calories burned automatically."}</Text>
  </View>
  <Card>
   <Text style={styles.cardTitle}>{ar?"الخطوات اليومية التلقائية":fr?"PAS QUOTIDIENS AUTOMATIQUES":"AUTOMATIC DAILY STEPS"}</Text>
   <Text style={styles.muted}>{ar?"اقرأ إجمالي خطوات اليوم من Apple Health أو Health Connect. تبقى بيانات الخطوات منفصلة عن سجل التمارين اليدوي.":fr?"Lisez le total des pas du jour depuis Apple Health ou Health Connect. Ces données restent séparées des activités saisies manuellement.":"Read today's step total from Apple Health or Health Connect. Step data stays separate from manually logged workouts."}</Text>
   {stepsEnabled?(
    <View style={{backgroundColor:"#EAF4FF",borderRadius:14,padding:16,marginTop:12}}>
     <Text style={{color:"#23466C",fontSize:13,fontWeight:"800"}}>{ar?"خطوات اليوم":fr?"PAS AUJOURD’HUI":"STEPS TODAY"}</Text>
     <Text style={{color:"#0875D1",fontSize:34,fontWeight:"900",marginTop:4}}>{steps===null?"—":steps.toLocaleString(language==="ar"?"ar":language==="fr"?"fr-FR":"en-US")}</Text>
     <Pressable onPress={()=>void refreshSteps()} disabled={stepsLoading} style={{alignSelf:"flex-start",marginTop:8,paddingVertical:8,paddingHorizontal:12,backgroundColor:"#D7EAFE",borderRadius:9}}>
      <Text style={{color:"#174A7B",fontWeight:"800"}}>{stepsLoading?(ar?"جارٍ التحديث…":fr?"Actualisation…":"Refreshing…"):(ar?"تحديث الخطوات":fr?"Actualiser les pas":"Refresh steps")}</Text>
     </Pressable>
    </View>
   ):(
    <View style={{marginTop:12}}>
     <GoldButton title={stepsLoading?(ar?"جارٍ الاتصال…":fr?"Connexion…":"Connecting…"):(ar?"ربط الصحة وقراءة الخطوات":fr?"Connecter Santé et lire les pas":"Connect Health & Read Steps")} onPress={()=>void connectSteps()}/>
     {Platform.OS==="web"&&<Text style={[styles.muted,{marginTop:8}]}>{ar?"يتطلب ذلك إصدار التطبيق المثبّت؛ لا يستطيع Safari الوصول إلى Apple Health مباشرة.":fr?"La version installée est nécessaire ; Safari ne peut pas accéder directement à Apple Health.":"The installed app is required; Safari cannot access Apple Health directly."}</Text>}
    </View>
   )}
   {!!stepsMessage&&<Text style={{color:"#9A5A00",fontSize:12,marginTop:10}}>{stepsMessage}</Text>}
  </Card>
  <Card>
   <Text style={styles.cardTitle}>{ar?"تسجيل نشاط":fr?"Enregistrer une activité":"LOG AN ACTIVITY"}</Text>
   <Text style={styles.fieldLabel}>{ar?"نوع النشاط":fr?"Type d’activité":"Activity type"}</Text>
   <View style={styles.choiceWrap}>{names.map((n,i)=><Choice key={kinds[i]} title={n} active={kind===kinds[i]} onPress={()=>setKind(kinds[i])}/>)}</View>
   <Field label={ar?"المدة (بالدقائق)":fr?"Durée (minutes)":"Duration (minutes)"} value={duration} onChangeText={setDuration} keyboardType="number-pad"/>
   <View style={{backgroundColor:"#EAF4FF",borderRadius:14,padding:16,marginTop:10,marginBottom:14}}>
    <Text style={{color:"#23466C",fontSize:13,fontWeight:"700"}}>{ar?"السعرات المحروقة المقدّرة":fr?"Calories brûlées estimées":"ESTIMATED CALORIES BURNED"}</Text>
    <Text style={{color:"#0875D1",fontSize:30,fontWeight:"900",marginTop:4}}>{estimatedCalories===null?"—":estimatedCalories+" kcal"}</Text>
    <Text style={{color:"#526B85",fontSize:12,marginTop:3}}>{ar?"تقدير يعتمد على وزنك ونوع النشاط ومدته.":fr?"Estimation basée sur votre poids, l’activité et sa durée.":"Estimate based on your saved weight, activity type and duration."}</Text>
    {weightKg<=0&&<Text style={{color:"#9A5A00",fontSize:12,marginTop:6}}>{ar?"أدخل وزنك في الملف الشخصي لتفعيل الحساب.":fr?"Ajoutez votre poids dans le profil pour activer le calcul.":"Add your weight in Profile to enable the calculation."}</Text>}
   </View>
   <GoldButton title={saving?(ar?"جارٍ الحفظ…":fr?"Enregistrement…":"Saving…"):(ar?"حفظ النشاط":fr?"Enregistrer l’activité":"Save Activity")} onPress={save}/>
  </Card>
  <Card>
   <Text style={styles.cardTitle}>{ar?"إجمالي السعرات اليومية وسجل النشاط":fr?"Total quotidien et historique":"DAILY CALORIES & ACTIVITY HISTORY"}</Text>
   {loading?<Text style={styles.muted}>…</Text>:logs.length===0?<Text style={styles.muted}>{ar?"لا يوجد نشاط مسجل بعد.":fr?"Aucune activité enregistrée.":"No activities recorded yet."}</Text>:Object.entries(grouped).map(([day,items])=>{
    const total=items.reduce((sum,x)=>sum+(Number(x.calories_burned)||0),0);
    const dateLabel=new Date(day+"T12:00:00").toLocaleDateString(language==="ar"?"ar":language==="fr"?"fr":"en",{weekday:"long",year:"numeric",month:"short",day:"numeric"});
    return <View key={day} style={{paddingTop:12,paddingBottom:8,borderBottomWidth:1,borderBottomColor:"#D8E5F1"}}>
     <View style={[styles.spaceBetween,{alignItems:"center",marginBottom:8}]}>
      <View style={{flex:1}}><Text style={styles.valueText}>{dateLabel}</Text><Text style={{color:"#0875D1",fontSize:18,fontWeight:"900",marginTop:3}}>{Math.round(total)} kcal {ar?"إجمالي اليوم":fr?"total du jour":"daily total"}</Text></View>
      <Pressable onPress={()=>askDeleteDay(day)} style={{backgroundColor:"#FDECEC",paddingHorizontal:10,paddingVertical:8,borderRadius:9}}><Text style={{color:"#B42318",fontSize:11,fontWeight:"800"}}>{ar?"حذف اليوم":fr?"Effacer la journée":"Delete day"}</Text></Pressable>
     </View>
     {items.map(x=><View key={x.id} style={[styles.spaceBetween,{paddingVertical:8,borderTopWidth:1,borderTopColor:"#E5EDF5",alignItems:"center"}]}>
      <View style={{flex:1}}><Text style={styles.valueText}>{names[kinds.indexOf(x.activity)]||x.activity}</Text><Text style={styles.muted}>{x.duration_minutes} {ar?"دقيقة":fr?"min":"min"} · {new Date(x.logged_at).toLocaleTimeString(language==="ar"?"ar":language==="fr"?"fr":"en",{hour:"2-digit",minute:"2-digit"})}</Text></View>
      <Text style={styles.valueText}>{x.calories_burned===null?"—":Math.round(x.calories_burned)+" kcal"}</Text>
      <Pressable onPress={()=>askDeleteOne(x.id)} style={{marginLeft:10,padding:7}}><Ionicons name="trash-outline" size={19} color="#B42318"/></Pressable>
     </View>)}
    </View>;
   })}
  </Card>
 </ScrollView>;
}
function ChallengeTracker({language}:{language:Language}) {
 const ar=language==="ar",fr=language==="fr",now=new Date();
 const year=now.getFullYear(),month=now.getMonth(),monthPrefix=`${year}-${String(month+1).padStart(2,"0")}-`;
 const today=[year,String(month+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
 const monthDays=new Date(year,month+1,0).getDate();
 const firstWeekday=new Date(year,month,1).getDay();
 const locale=ar?"ar":fr?"fr-FR":"en-US";
 const monthLabel=now.toLocaleDateString(locale,{month:"long",year:"numeric"});
 const weekdayLabels=Array.from({length:7},(_,i)=>new Date(2023,0,1+i).toLocaleDateString(locale,{weekday:"short"}));
 const [checks,setChecks]=useState<{challenge_id:string;completed_day:string}[]>([]),[loading,setLoading]=useState(true);
 const challenges=[
  {id:"walk7",title:ar?"تحدي المشي 7 أيام":fr?"Défi marche 7 jours":"7-Day Walking Challenge",desc:ar?"سجّل المشي كل يوم لمدة أسبوع.":fr?"Cochez chaque jour de marche.":"Check in each day you complete a walk.",goal:7},
  {id:"fitness30",title:ar?"تحدي اللياقة 30 يوماً":fr?"Défi fitness 30 jours":"30-Day Fitness Challenge",desc:ar?"أكمل نشاطاً بدنياً كل يوم.":fr?"Faites une activité chaque jour.":"Check the box for each day you complete your activity.",goal:monthDays},
  {id:"water7",title:ar?"تحدي شرب الماء":fr?"Défi hydratation":"Water Habit Challenge",desc:ar?"سجّل الأيام التي تحقق فيها هدف الماء.":fr?"Cochez les jours où vous atteignez votre objectif d’eau.":"Check in when you meet your daily water goal.",goal:7},
  {id:"streak5",title:ar?"سلسلة التمارين":fr?"Régularité sportive":"Workout Consistency",desc:ar?"حافظ على الاستمرارية وسجّل أيام التمرين.":fr?"Cochez vos jours d’entraînement.":"Build consistency by checking in on workout days.",goal:5}
 ];
 const refresh=async()=>{setChecks(await getChallengeCheckins());setLoading(false);};
 useEffect(()=>{refresh().catch(()=>setLoading(false));},[]);
 const toggle=async(id:string,date:string)=>{await toggleChallengeCheckin(id,date);await refresh();};
 const makeDateKey=(day:number)=>`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
 return <ScrollView contentContainerStyle={styles.content}>
  <View style={[styles.dashboardIntro,{backgroundColor:"transparent"}]}>
   <View style={styles.todayPill}><View style={styles.liveDot}/><Text style={styles.todayPillText}>DANAT / WELLNESS</Text></View>
   <Text style={[styles.pageTitle,{color:"#FFFFFF"}]}>{ar?"التحديات":fr?"Défis":"Challenges"}</Text>
   <Text style={[styles.introNote,{color:"#FFFFFF"}]}>{ar?"ابنِ عادات صحية وسجّل إنجازك اليومي.":fr?"Créez de bonnes habitudes et suivez vos progrès.":"Build healthy habits and manually track your daily check-ins."}</Text>
  </View>
  {loading?<Card><Text style={styles.muted}>…</Text></Card>:challenges.map(c=>{
   const currentMonthChecks=checks.filter(x=>x.challenge_id===c.id&&x.completed_day.startsWith(monthPrefix));
   const count=c.id==="fitness30"?currentMonthChecks.length:checks.filter(x=>x.challenge_id===c.id).length;
   const doneToday=checks.some(x=>x.challenge_id===c.id&&x.completed_day===today);
   const days=Array.from({length:7},(_,i)=>{
    const d=new Date(now);d.setDate(d.getDate()-(6-i));
    return {key:[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"),label:d.toLocaleDateString(locale,{weekday:"short"})};
   });
   return <Card key={c.id}>
    {c.id==="fitness30"?<>
     <View style={styles.sectionHeading}>
      <Text style={styles.cardTitle}>{c.title}</Text>
      <Text style={styles.sectionMeta}>{count}/{monthDays}</Text>
     </View>
     <Text style={styles.muted}>{monthLabel} · {c.desc}</Text>
     <View style={[styles.progressTrack,{marginTop:12,marginBottom:15}]}>
      <View style={[styles.progressFill,{width:Math.min(100,count/monthDays*100)+"%"}]}/>
     </View>
     <View style={styles.calendarWeekRow}>
      {weekdayLabels.map((label,i)=><Text key={i} style={styles.calendarWeekday}>{label}</Text>)}
     </View>
     <View style={styles.calendarGrid}>
      {Array.from({length:firstWeekday},(_,i)=><View key={"blank-"+i} style={styles.calendarBlank}/>)}
      {Array.from({length:monthDays},(_,i)=>{
       const day=i+1,key=makeDateKey(day),checked=checks.some(x=>x.challenge_id===c.id&&x.completed_day===key),isToday=key===today;
       return <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{checked}} accessibilityLabel={`${monthLabel} ${day}`}
        onPress={()=>void toggle(c.id,key)} style={[styles.calendarDay,checked&&styles.calendarDayChecked,isToday&&styles.calendarDayToday]}>
        <Text style={[styles.calendarDayNumber,checked&&styles.calendarDayNumberChecked]}>{day}</Text>
        <Ionicons name={checked?"checkbox":"square-outline"} size={17} color={checked?"#FFFFFF":"#7890A8"}/>
       </Pressable>;
      })}
     </View>
     <Text style={[styles.muted,{marginTop:12}]}>{ar?`أكملت ${count} من ${monthDays} يوماً هذا الشهر`:fr?`${count} jour(s) sur ${monthDays} ce mois-ci`:`${count} of ${monthDays} days completed this month`}</Text>
    </>:<>
     <View style={styles.sectionHeading}><Text style={styles.cardTitle}>{c.title}</Text><Text style={styles.sectionMeta}>{count}/{c.goal}</Text></View>
     <Text style={styles.muted}>{c.desc}</Text>
     <View style={styles.progressTrack}><View style={[styles.progressFill,{width:Math.min(100,count/c.goal*100)+"%"}]}/></View>
     <Text style={[styles.fieldLabel,{marginTop:14,marginBottom:8}]}>{ar?"إحصائيات آخر 7 أيام":fr?"Statistiques des 7 derniers jours":"Last 7 Days Statistics"}</Text>
     <View style={{flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",paddingHorizontal:4,paddingTop:6}}>
      {days.map(day=>{
       const checked=checks.some(x=>x.challenge_id===c.id&&x.completed_day===day.key);
       return <View key={day.key} style={{flex:1,alignItems:"center",gap:5}}>
        <Text style={{fontSize:10,fontWeight:"800",color:checked?"#1686E8":"#7C91A8"}}>{checked?"1":"0"}</Text>
        <View style={{height:54,width:18,justifyContent:"flex-end",alignItems:"center",backgroundColor:"#EAF3FC",borderRadius:6,overflow:"hidden"}}>
         <View style={{width:"100%",height:checked?46:5,backgroundColor:checked?"#1686E8":"#C8D8E8",borderRadius:5}}/>
        </View>
        <Text style={{fontSize:9,color:"#53677D",fontWeight:"700"}}>{day.label}</Text>
       </View>;
      })}
     </View>
     <GoldButton title={doneToday?(ar?"إلغاء تسجيل اليوم":fr?"Annuler le pointage du jour":"Undo today’s check-in"):(ar?"سجّل إنجاز اليوم":fr?"Valider aujourd’hui":"Check in today")} onPress={()=>void toggle(c.id,today)}/>
    </>}
   </Card>;
  })}
 </ScrollView>;
}

function LanguageChoices({language,onChange}:{language:Language;onChange:(code:Language)=>void}) {
 const options:[Language,string,string][]=[
  ["en","🇬🇧","English"],["ar","ع","العربية"],["fr","🇫🇷","Français"]
 ];
 return <View style={styles.languageSelector}>{options.map(([code,icon,label])=>
  <Pressable key={code} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:language===code}}
   onPress={()=>onChange(code)} style={[styles.languageButton,language===code&&styles.languageButtonActive]}>
   <Text style={[styles.languageIconText,code==="ar"&&styles.arabicLanguageIcon]}>{icon}</Text>
   <Text style={[styles.languageText,language!==code&&styles.languageTextInactive]}>{code.toUpperCase()}</Text>
  </Pressable>
 )}</View>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <View style={[styles.card, { flex: 1 }]}><Text style={styles.statIcon}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>;
}
function MetricLine({ label, value }: { label: string; value: string }) { return <View style={styles.spaceBetween}><Text style={styles.muted}>{label}</Text><Text style={styles.valueText}>{value}</Text></View>; }
function Macro({label,value,consumed,color}:{label:string;value:number;consumed:number|null;color:string}){const pct=Math.min(100,Math.max(0,(consumed??0)/Math.max(1,value)*100));return <View style={{paddingVertical:8}}><View style={styles.macroRow}><Text style={styles.muted}>{label}</Text><Text style={{color:"#17324D",fontWeight:"800"}}>{consumed===null?"0":Math.round(consumed)} / {value} g</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill,{backgroundColor:color,width:pct+"%"}]}/></View></View>;}
function GoldButton({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.goldButton}><Text style={styles.goldButtonText}>{title}</Text></Pressable>;
}
function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; keyboardType?: "number-pad" | "decimal-pad" }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={label} placeholderTextColor={MUTED} style={styles.input} /></View>;
}
function Choice({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && { color: "#FFFFFF" }]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: "#06162B", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  splashFrame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#071A33", overflow: "hidden", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#244A73" },
  splashImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  splashShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255, 255, 255, 0.24)" },
  splashContent: { width: "88%", maxWidth: 430, paddingHorizontal: 22, paddingVertical: 30, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 34, marginBottom: "auto", backgroundColor: "rgba(255, 255, 255, 0.88)", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.95)", shadowColor: "#08264A", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  splashEyebrow: { color: "#1686E8", fontSize: 11, fontWeight: "800", letterSpacing: 4, marginBottom: 12 },
  splashTitle: { color: "#17324D", fontSize: 34, fontWeight: "900", letterSpacing: 3, textAlign: "center" },
  splashAccent: { width: 58, height: 4, borderRadius: 4, backgroundColor: "#1686E8", marginTop: 20, marginBottom: 28 },
  splashWelcome: { color: "#17324D", fontSize: 19, fontWeight: "800", textAlign: "center", marginBottom: 13 },
  splashArabic: { color: "#17324D", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 13, writingDirection: "rtl" },
  splashFrench: { color: "#17324D", fontSize: 18, fontWeight: "700", textAlign: "center" },
  splashFooter: { position: "absolute", bottom: 28, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255, 255, 255, 0.88)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  splashFooterDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFC928" },
  splashFooterText: { color: "#17324D", fontSize: 9, fontWeight: "800", letterSpacing: 2.2 },
  safe: { flex: 1, backgroundColor: "#EAF3FC", alignItems: "center" },
  appFrame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: BG, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#D5E4F2" },
  header: { paddingHorizontal: 23, paddingTop: 13, paddingBottom: 16, backgroundColor: "rgba(255,255,255,0.94)", borderBottomWidth: 1, borderBottomColor: "#D5E4F2" },
  brand: { flexDirection: "row", alignItems: "center", gap: 13 },
  rowReverse: { flexDirection: "row-reverse" },
  logoImage: { width: 46, height: 46 },
  brandEyebrow: { color: GREEN, fontWeight: "700", fontSize: 9, letterSpacing: 3.1 },
  brandName: { color: "#10294A", fontWeight: "800", fontSize: 15, letterSpacing: 2.1, marginTop: 4 },
  languageSelector: { flexDirection: "row", alignItems: "center", gap: 7 },
  languageButton: { width: 45, height: 47, borderWidth: 1, borderColor: "#B8CDE0", backgroundColor: "#F5F9FD", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 1 },
  languageButtonActive: { backgroundColor: "#FFF2BD", borderColor: GOLD, borderWidth: 2 },
  languageIconText: { color: "#17324D", fontSize: 18, lineHeight: 22, fontWeight: "900" },
  arabicLanguageIcon: { fontSize: 20, lineHeight: 22 },
  languageText: { color: "#08264A", fontSize: 9, fontWeight: "900" },
  languageTextInactive: { color: "#244A73" },
  calendarWeekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  calendarWeekday: { width: "13%", textAlign: "center", color: "#53677D", fontSize: 10, fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 4 },
  calendarBlank: { width: "13%", minHeight: 48 },
  calendarDay: { width: "13%", minHeight: 48, borderRadius: 9, backgroundColor: "#F1F6FB", borderWidth: 1, borderColor: "#D8E5F1", alignItems: "center", justifyContent: "center", gap: 1 },
  calendarDayChecked: { backgroundColor: "#1686E8", borderColor: "#1686E8" },
  calendarDayToday: { borderColor: GOLD, borderWidth: 2 },
  calendarDayNumber: { color: "#17324D", fontSize: 12, fontWeight: "800" },
  calendarDayNumberChecked: { color: "#FFFFFF" },
  dashboardContent: { paddingBottom: 18, backgroundColor: "transparent", gap: 0 },
  dashboardScreenBackground: { flex: 1, position: "relative", overflow: "hidden", backgroundColor: "transparent" },
  appBackgroundImage: { ...StyleSheet.absoluteFill, width: "100%", height: "100%", opacity: 1 },
  dashboardGreetingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 25, paddingHorizontal: 2, zIndex: 1 },
  dashboardGreetingAvatar: { width: 58, height: 58, borderRadius: 29, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,35,78,0.78)", borderWidth: 2, borderColor: "#FFD400" },
  dashboardGreetingAvatarImage: { width: "100%", height: "100%" },
  dashboardGreetingHi: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  dashboardGreetingName: { color: "#FFD400", fontSize: 21, fontWeight: "900", marginTop: 1 },

  dashboardHero: { minHeight: 300, paddingHorizontal: 20, paddingTop: 17, paddingBottom: 20, justifyContent: "flex-start", overflow: "hidden", backgroundColor: "transparent" },
  dashboardBackgroundImage: { resizeMode: "cover", opacity: 1 },
  dashboardHeroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "transparent" },
  dashboardBrandRow: { flexDirection: "row", alignItems: "center", gap: 10, zIndex: 1 },
  dashboardBrandLogo: { width: 56, height: 56 },
  dashboardBrandTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", fontStyle: "italic", letterSpacing: -0.5 },
  dashboardBrandAccent: { color: "#FFD400" },
  dashboardBrandSubtitle: { color: "#FFFFFF", fontSize: 11, letterSpacing: 2.4, marginTop: 1 },
  dashboardSettings: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  dashboardLanguageMenu: { alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8, padding: 8, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", zIndex: 5 },
  dashboardHeroMessage: { marginTop: 49, maxWidth: "55%", zIndex: 1 },
  dashboardSlogan: { color: "#FFFFFF", fontSize: 29, lineHeight: 34, fontWeight: "900", fontStyle: "italic" },
  dashboardSloganAccent: { color: "#FFD400", fontSize: 30, lineHeight: 36, fontWeight: "900", fontStyle: "italic" },
  dashboardCalories: { marginHorizontal: 17, marginTop: 14, marginBottom: 17, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, minHeight: 84, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.76)", borderWidth: 1, borderColor: "rgba(255,255,255,0.94)", shadowColor: "#08264A", shadowOpacity: 0.44, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12, gap: 9 },
  dashboardFlame: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dashboardFlameImage: { width: 44, height: 44 },
  dashboardCalorieBlock: { flex: 1, minWidth: 65 },
  dashboardCalorieValue: { color: "#071D35", fontSize: 28, fontWeight: "900", textShadowColor: "rgba(255,255,255,0.85)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  dashboardCalorieLabel: { color: "#17324D", fontSize: 12, fontWeight: "800", textShadowColor: "rgba(255,255,255,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  dashboardCalorieDivider: { width: 1, height: 48, backgroundColor: "rgba(23,50,77,0.28)" },
  dashboardGoalBlock: { flex: 1, minWidth: 62, paddingLeft: 7 },
  dashboardGoalLabel: { color: "#17324D", fontSize: 11, fontWeight: "800", textShadowColor: "rgba(255,255,255,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  dashboardGoalValue: { color: "#071D35", fontSize: 22, fontWeight: "900", textShadowColor: "rgba(255,255,255,0.85)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  dashboardGoalPercent: { color: "#00549C", fontSize: 16, fontWeight: "900", textShadowColor: "rgba(255,255,255,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  dashboardGoalRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 6, borderColor: "#1686E8", borderLeftColor: "#BBDCF8", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.96)" },
  dashboardGoalRingText: { color: "#071D35", fontSize: 11, fontWeight: "900" },
  dashboardGoalRingCaption: { color: "#263F58", fontSize: 7, fontWeight: "800", textAlign: "center" },
  dashboardTiles: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 17, gap: 10, justifyContent: "space-between", marginBottom: 17 },
  dashboardTile: { width: "30%", minHeight: 122, borderRadius: 17, alignItems: "stretch", justifyContent: "flex-end", padding: 0, overflow: "hidden", position: "relative", backgroundColor: "transparent", borderWidth: 0, shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: {width:0,height:2}, elevation: 3 },
  dashboardTileIcon: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  dashboardTileLabel: { width: "100%", color: "#FFFFFF", fontSize: 13, lineHeight: 16, fontWeight: "900", textAlign: "center", backgroundColor: "rgba(3,20,42,0.78)", paddingHorizontal: 3, paddingVertical: 7 },
  dashboardNutrition: { marginHorizontal: 14, borderRadius: 18, paddingHorizontal: 17, paddingTop: 15, paddingBottom: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D7E7F8" },
  dashboardNutritionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  dashboardNutritionTitle: { color: "#09254C", fontSize: 17, fontWeight: "900" },
  dashboardNutritionLink: { color: "#1265B4", fontSize: 11, fontWeight: "700" },
  dashboardNutritionBar: { height: 12, borderRadius: 8, overflow: "hidden", flexDirection: "row", backgroundColor: "#DDE5EF", gap: 0 },
  dashboardNutritionSegment: { height: 12 },
  dashboardNutritionLabels: { flexDirection: "row", justifyContent: "space-around", paddingTop: 9 },
  dashboardNutritionPercent: { color: "#0B2345", fontSize: 15, fontWeight: "900", textAlign: "center" },
  dashboardNutritionMacro: { color: "#0B2345", fontSize: 11, textAlign: "center" },
  dashboardLoading: { margin: 18, padding: 20, backgroundColor: "#FFFFFF", borderRadius: 14 },
  dashboardLoadingText: { color: "#09254C", textAlign: "center" },
  content: { paddingHorizontal: 22, paddingTop: 25, paddingBottom: 34, gap: 15 },
  dashboardIntro: { minHeight: 150, padding: 18, justifyContent: "flex-start", borderRadius: 22, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E5F1", gap: 7 },
  dashboardHeroImage: { borderRadius: 22, opacity: 0.96 },
  dashboardHeroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(3, 18, 40, 0.34)" },
  todayPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1686E8", borderWidth: 1, borderColor: "#1686E8" },
  todayPillText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  sectionTitle: { color: "#17324D", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  calorieDashboard: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 18 },
  calorieRing: { width: 142, height: 142, borderRadius: 71, borderWidth: 9, borderColor: "#1686E8", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#FFC928", shadowOpacity: 0.13, shadowRadius: 14, elevation: 3 },
  calorieRingInner: { width: 122, height: 122, borderRadius: 61, backgroundColor: "#F2F8FF", alignItems: "center", justifyContent: "center" },
  ringCaption: { color: "#53677D", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  ringValue: { color: "#17324D", fontSize: 25, fontWeight: "900", marginTop: 4 },
  ringUnit: { color: GREEN, fontSize: 8, fontWeight: "900", letterSpacing: 2, marginTop: 2 },
  calorieSummary: { flex: 1, minWidth: 0 },
  remainingPanel: { borderLeftWidth: 2, borderLeftColor: "#FFC928", paddingLeft: 10, marginTop: 14 },
  remainingValue: { color: GREEN, fontSize: 24, fontWeight: "900" },
  remainingLabel: { color: MUTED, fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  macroTile: { width: "48%", flexGrow: 1, minWidth: 130, backgroundColor: PANEL, borderRadius: 15, borderWidth: 1, borderColor: "#D8E5F1", padding: 14, minHeight: 91 },
  macroTileLabel: { color: MUTED, fontSize: 11, fontWeight: "700", marginBottom: 8 },
  macroTileValue: { color: "#17324D", fontSize: 19, fontWeight: "900" },
  macroTileUnit: { color: MUTED, fontSize: 10, fontWeight: "600" },
  macroTileHint: { color: GREEN, fontSize: 9, fontWeight: "800", marginTop: 5 },
  miniTrack: { height: 4, backgroundColor: "#D8E5F1", borderRadius: 8, marginTop: 9, overflow: "hidden" },
  miniFill: { height: 4, borderRadius: 8 },
  openDiaryArrow: { color: "#071A33", fontSize: 25, fontWeight: "900", position: "absolute", right: 18, top: 7 },
  dashboardFootnote: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 3, paddingTop: 2 },
  dashboardFootnoteText: { color: "#A8B8CC", fontSize: 8, fontWeight: "800", letterSpacing: 1 },

  greeting: { color: "#FFFFFF", fontSize: 29, lineHeight: 36, fontWeight: "700", letterSpacing: -0.8, marginTop: 8 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  greetingAvatar: { width: 54, height: 54, borderRadius: 27, overflow: "hidden", backgroundColor: "#153B66", borderWidth: 2, borderColor: "#FFC928", alignItems: "center", justifyContent: "center" },
  greetingAvatarImage: { width: "100%", height: "100%" },
  avatarFallback: { fontSize: 25 },
  profilePhotoSection: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 18 },
  profilePhotoPreview: { width: 88, height: 88, borderRadius: 44, overflow: "hidden", backgroundColor: "#EAF3FC", borderWidth: 2, borderColor: "#FFC928", alignItems: "center", justifyContent: "center" },
  profilePhotoImage: { width: "100%", height: "100%" },
  profilePhotoPlaceholder: { fontSize: 38 },
  photoButton: { alignSelf: "flex-start", backgroundColor: "#1D6FE8", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, minHeight: 42, justifyContent: "center" },
  photoButtonText: { color: "#FFFFFF", fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
  removePhotoText: { color: "#FF7777", fontSize: 11, fontWeight: "700" },
  introNote: { color: "#40566D", fontSize: 13, marginTop: 7, letterSpacing: 0.2 },
  eyebrow: { color: GREEN, fontSize: 9, letterSpacing: 2.6, fontWeight: "800", marginBottom: 3 },
  pageTitle: { color: "#17324D", fontSize: 29, fontWeight: "800", letterSpacing: -0.7, marginBottom: 4 },
  card: { backgroundColor: PANEL, borderRadius: 18, borderWidth: 1, borderColor: "#D8E5F1", padding: 19, marginBottom: 2, shadowColor: "#31516F", shadowOpacity: 0.07, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardTitle: { color: "#17324D", fontSize: 13, fontWeight: "900", letterSpacing: 1.1, marginBottom: 7 },
  muted: { color: "#53677D", fontSize: 12, lineHeight: 19 },
  calorieHero: { backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "#D8E5F1", padding: 21, marginBottom: 2 },
  heroTopline: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroLabel: { color: "#53677D", fontSize: 9, fontWeight: "800", letterSpacing: 2.2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  heroNumberRow: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  calorieNumber: { color: IVORY, fontSize: 43, fontWeight: "700", letterSpacing: -1.7, marginVertical: 3 },
  heroSubline: { color: GREEN, fontSize: 9, fontWeight: "800", letterSpacing: 1.7 },
  calorieBadge: { minWidth: 77, minHeight: 77, borderRadius: 39, borderWidth: 1, borderColor: GOLD, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  badgeValue: { color: IVORY, fontSize: 17, fontWeight: "800" },
  badgeCaption: { color: MUTED, fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  progressTrack: { height: 5, backgroundColor: "#D8E5F1", borderRadius: 10, marginTop: 20, marginBottom: 11, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: GREEN, borderRadius: 10 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  sectionMeta: { color: GREEN, fontSize: 8, fontWeight: "800", letterSpacing: 1.3 },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  greenText: { color: GREEN, fontSize: 11, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 11 },
  statIcon: { color: GOLD, fontSize: 18, marginBottom: 10 },
  statValue: { color: "#17324D", fontSize: 23, fontWeight: "700", letterSpacing: -0.5, marginBottom: 4 },
  macroRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#D8E5F1" },
  mealCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: PANEL, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#D8E5F1" },
  mealIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#EAF3FC", alignItems: "center", justifyContent: "center" },
  addIcon: { color: GOLD, fontSize: 24, fontWeight: "700" },
  weightList: { gap: 9, marginTop: 8 },
  progressHero: { backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "#D8E5F1", padding: 20 },
  progressWeight: { color: IVORY, fontSize: 36, fontWeight: "900", marginVertical: 8 },
  progressTrendMark: { color: "#FFC928", fontSize: 28, fontWeight: "900" },
  targetWeightPill: { alignSelf: "flex-start", backgroundColor: "#EAF3FC", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  targetWeightText: { color: GREEN, fontSize: 10, fontWeight: "800" },
  chartBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", minHeight: 145, paddingTop: 12, paddingBottom: 6, gap: 5 },
  chartColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", minWidth: 0 },
  chartValue: { color: "#17324D", fontSize: 9, fontWeight: "800", marginBottom: 5 },
  chartBar: { width: "58%", minWidth: 9, borderRadius: 7 },
  chartDate: { color: MUTED, fontSize: 8, marginTop: 6 },

  valueText: { color: "#173F61", fontWeight: "900" },
  input: { color: "#17324D", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C9D9E8", borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, marginTop: 7, fontSize: 15 },
  field: { marginBottom: 13 },
  fieldLabel: { color: "#243B53", fontWeight: "800", fontSize: 13, marginBottom: 3, marginTop: 6 },
  optionRow: { flexDirection: "row", gap: 9, marginBottom: 12 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  choice: { borderWidth: 1, borderColor: "#C9D9E8", backgroundColor: "#F3F8FD", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  choiceActive: { borderColor: "#1686E8", backgroundColor: "#1686E8" },
  choiceText: { color: "#344B62", fontSize: 12, fontWeight: "800" },
  openDiaryButton: { backgroundColor: "#1686E8", borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", marginTop: 5, borderWidth: 1, borderColor: "#1686E8", shadowColor: "#1686E8", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  openDiaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14, letterSpacing: 0.4 },
  goldButton: { backgroundColor: "#1686E8", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14, borderWidth: 1, borderColor: "#1686E8" },
  goldButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  contactWelcome: { backgroundColor: "rgba(255,255,255,0.24)", borderRadius: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.72)", padding: 28, alignItems: "center", shadowColor: "#000000", shadowOpacity: 0.48, shadowRadius: 27, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  contactIconCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#EAF3FC", borderWidth: 1, borderColor: "#D8E5F1", alignItems: "center", justifyContent: "center", marginBottom: 22 },
  contactEyebrow: { color: "#075A9E", fontSize: 11, fontWeight: "900", letterSpacing: 3, marginBottom: 9, textShadowColor: "rgba(255,255,255,0.95)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  contactTitle: { color: "#061A2D", fontSize: 31, lineHeight: 38, fontWeight: "900", textAlign: "center", marginBottom: 14, textShadowColor: "rgba(255,255,255,0.98)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  contactDescription: { color: "#102A43", fontSize: 15, lineHeight: 25, fontWeight: "700", textAlign: "center", marginBottom: 24, textShadowColor: "rgba(255,255,255,0.98)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  contactEmailBox: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F2F8FF", borderRadius: 14, borderWidth: 1, borderColor: "#D8E5F1", paddingHorizontal: 12, paddingVertical: 16 },
  contactEmail: { color: "#064B80", fontSize: 17, fontWeight: "900", textShadowColor: "rgba(255,255,255,0.98)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  tabBar: { flexDirection: "row", backgroundColor: "#102A4C", borderTopWidth: 1, borderTopColor: "#24466D", paddingTop: 12, paddingBottom: 8 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 },
  tabIcon: { color: "#6F89A8", fontSize: 21, fontWeight: "500" },
  tabLabel: { color: "#D5E2F1", fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },
  activeTab: { color: GREEN }
});

export default function App() {
  return (
    <SafeAreaProvider>
      <FitnessProApp />
    </SafeAreaProvider>
  );
}
