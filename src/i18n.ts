export type Language = "en" | "ar" | "fr";

export const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", diary: "Food diary", progress: "Progress", profile: "Profile",
    greeting: "Your health. Your progress.", today: "TODAY'S OVERVIEW",
    calories: "Daily calories", consumed: "Consumed", remaining: "Remaining",
    protein: "Protein", carbs: "Carbs", fats: "Fats", currentWeight: "Current weight",
    targetWeight: "Target weight", bmi: "BMI", startProfile: "Complete your profile",
    profileHint: "Add your details to calculate your personal daily targets.",
    meals: "Today's meals", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks",
    addFood: "Add food", noMeals: "Your meals will appear here as you add foods.",
    weightTrend: "Weight progress", latestWeight: "Latest weight", logWeight: "Log weight",
    age: "Age", sex: "Sex", male: "Male", female: "Female", height: "Height (cm)",
    weight: "Weight (kg)", goalWeight: "Goal weight (kg)", activity: "Activity level",
    objective: "Goal", lose: "Lose weight", maintain: "Maintain", gain: "Gain weight",
    sedentary: "Sedentary", light: "Light", moderate: "Moderate", active: "Active", veryActive: "Very active",
    save: "Save profile", saved: "Profile updated", language: "Language",
    healthyRange: "Healthy weight range", bmr: "BMR", tdee: "Daily energy need",
    caloriesLeft: "calories left", settings: "Settings", emptyProgress: "Start logging your weight to see your progress.",
    invalid: "Please enter valid profile details.", grams: "g", kg: "kg"
  },
  ar: {
    dashboard: "الرئيسية", diary: "المفكرة الغذائية", progress: "التقدم", profile: "الملف الشخصي",
    greeting: "صحتك. إنجازك.", today: "ملخص اليوم",
    calories: "السعرات اليومية", consumed: "المستهلك", remaining: "المتبقي",
    protein: "البروتين", carbs: "الكربوهيدرات", fats: "الدهون", currentWeight: "الوزن الحالي",
    targetWeight: "الوزن المستهدف", bmi: "مؤشر كتلة الجسم", startProfile: "أكمل ملفك الشخصي",
    profileHint: "أدخل بياناتك لحساب أهدافك اليومية.",
    meals: "وجبات اليوم", breakfast: "الفطور", lunch: "الغداء", dinner: "العشاء", snacks: "وجبات خفيفة",
    addFood: "إضافة طعام", noMeals: "ستظهر وجباتك هنا عند إضافة الأطعمة.",
    weightTrend: "تقدم الوزن", latestWeight: "آخر وزن", logWeight: "تسجيل الوزن",
    age: "العمر", sex: "الجنس", male: "ذكر", female: "أنثى", height: "الطول (سم)",
    weight: "الوزن (كغ)", goalWeight: "الوزن المستهدف (كغ)", activity: "مستوى النشاط",
    objective: "الهدف", lose: "خسارة الوزن", maintain: "المحافظة على الوزن", gain: "زيادة الوزن",
    sedentary: "قليل الحركة", light: "نشاط خفيف", moderate: "نشاط متوسط", active: "نشط", veryActive: "نشاط عالٍ",
    save: "حفظ الملف", saved: "تم تحديث الملف الشخصي", language: "اللغة",
    healthyRange: "نطاق الوزن الصحي", bmr: "معدل الأيض الأساسي", tdee: "احتياج الطاقة اليومي",
    caloriesLeft: "سعرة متبقية", settings: "الإعدادات", emptyProgress: "ابدأ بتسجيل وزنك لمتابعة تقدمك.",
    invalid: "يرجى إدخال بيانات صحيحة.", grams: "غ", kg: "كغ"
  },
  fr: {
    dashboard: "Accueil", diary: "Journal alimentaire", progress: "Progrès", profile: "Profil",
    greeting: "Votre santé. Vos progrès.", today: "APERÇU DU JOUR",
    calories: "Calories quotidiennes", consumed: "Consommées", remaining: "Restantes",
    protein: "Protéines", carbs: "Glucides", fats: "Lipides", currentWeight: "Poids actuel",
    targetWeight: "Poids cible", bmi: "IMC", startProfile: "Complétez votre profil",
    profileHint: "Ajoutez vos informations pour calculer vos objectifs quotidiens.",
    meals: "Repas du jour", breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", snacks: "Collations",
    addFood: "Ajouter un aliment", noMeals: "Vos repas apparaîtront ici lorsque vous ajouterez des aliments.",
    weightTrend: "Évolution du poids", latestWeight: "Dernier poids", logWeight: "Enregistrer le poids",
    age: "Âge", sex: "Sexe", male: "Homme", female: "Femme", height: "Taille (cm)",
    weight: "Poids (kg)", goalWeight: "Poids cible (kg)", activity: "Niveau d'activité",
    objective: "Objectif", lose: "Perdre du poids", maintain: "Maintenir", gain: "Prendre du poids",
    sedentary: "Sédentaire", light: "Léger", moderate: "Modéré", active: "Actif", veryActive: "Très actif",
    save: "Enregistrer le profil", saved: "Profil mis à jour", language: "Langue",
    healthyRange: "Fourchette de poids santé", bmr: "Métabolisme de base", tdee: "Besoin énergétique quotidien",
    caloriesLeft: "calories restantes", settings: "Paramètres", emptyProgress: "Enregistrez votre poids pour suivre vos progrès.",
    invalid: "Veuillez saisir des informations valides.", grams: "g", kg: "kg"
  }
};

export const rtl = (language: Language) => language === "ar";
