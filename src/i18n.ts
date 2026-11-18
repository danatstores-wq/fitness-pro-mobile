export type Language = "en" | "ar" | "fr";

export const translations: Record<Language, Record<string, string>> = {
  en: {
    bodyMeasurements: "BODY MEASUREMENTS", measurementHint: "Enter measurements in centimetres. Body-fat estimate uses the US Navy circumference method when the required measurements are available.", waistCm: "Waist (cm)", hipCm: "Hip (cm)", neckCm: "Neck (cm)", bodyFatInput: "Measured body fat (%) — optional", muscleMassInput: "Measured muscle mass (kg) — optional", bodyMetrics: "BODY & HEALTH METRICS", idealWeight: "Ideal weight (midpoint estimate)", bodyFat: "Estimated body fat", leanMass: "Lean body mass", muscleMass: "Muscle mass (measured)", waistHeight: "Waist-to-height ratio", waistHip: "Waist-to-hip ratio", waterNeeds: "Estimated daily water needs", metabolicAge: "Metabolic age (estimate)", years: "years", metabolicAgeHint: "Estimated by comparing two different BMR prediction equations; this is a rough educational indicator, not a biological-age test.", notAvailable: "Not available for these inputs", metricsDisclaimer: "Estimates are educational, not medical measurements. Muscle mass requires a suitable body-composition measurement. Water needs vary with climate, activity and health; follow clinician advice if you have fluid restrictions.",
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
    bodyMeasurements: "قياسات الجسم", measurementHint: "أدخل القياسات بالسنتيمتر. يُقدّر دهون الجسم بطريقة البحرية الأمريكية عند توفر القياسات اللازمة.", waistCm: "محيط الخصر (سم)", hipCm: "محيط الورك (سم)", neckCm: "محيط الرقبة (سم)", bodyFatInput: "نسبة الدهون المقاسة (%) — اختياري", muscleMassInput: "كتلة العضلات المقاسة (كغ) — اختياري", bodyMetrics: "مؤشرات الجسم والصحة", idealWeight: "الوزن المثالي (تقدير متوسط)", bodyFat: "دهون الجسم المقدّرة", leanMass: "الكتلة الخالية من الدهون", muscleMass: "كتلة العضلات (مقاسة)", waistHeight: "نسبة الخصر إلى الطول", waistHip: "نسبة الخصر إلى الورك", waterNeeds: "الاحتياج اليومي التقديري للماء", metabolicAge: "العمر الأيضي (تقديري)", years: "سنة", metabolicAgeHint: "يُقدّر بمقارنة معادلتين مختلفتين للتنبؤ بمعدل الأيض؛ وهو مؤشر تثقيفي تقريبي وليس اختباراً للعمر البيولوجي.", notAvailable: "غير متاح لهذه البيانات", metricsDisclaimer: "هذه تقديرات تثقيفية وليست قياسات طبية. تتطلب كتلة العضلات قياساً مناسباً لتركيب الجسم. تختلف احتياجات الماء حسب المناخ والنشاط والحالة الصحية؛ اتبع نصيحة الطبيب عند وجود قيود على السوائل.",
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
    bodyMeasurements: "MESURES CORPORELLES", measurementHint: "Saisissez les mesures en centimètres. L’estimation du taux de graisse utilise la méthode de la marine américaine lorsque les mesures nécessaires sont disponibles.", waistCm: "Tour de taille (cm)", hipCm: "Tour de hanches (cm)", neckCm: "Tour de cou (cm)", bodyFatInput: "Taux de graisse mesuré (%) — facultatif", muscleMassInput: "Masse musculaire mesurée (kg) — facultatif", bodyMetrics: "INDICATEURS CORPORELS ET SANTÉ", idealWeight: "Poids idéal (estimation médiane)", bodyFat: "Graisse corporelle estimée", leanMass: "Masse maigre", muscleMass: "Masse musculaire (mesurée)", waistHeight: "Rapport taille/hauteur", waistHip: "Rapport taille/hanches", waterNeeds: "Besoin quotidien estimé en eau", metabolicAge: "Âge métabolique (estimation)", years: "ans", metabolicAgeHint: "Estimation obtenue en comparant deux équations différentes de prédiction du métabolisme ; indicateur éducatif approximatif, et non test de l’âge biologique.", notAvailable: "Indisponible avec ces données", metricsDisclaimer: "Estimations éducatives, non médicales. La masse musculaire nécessite une mesure adaptée de la composition corporelle. Les besoins en eau varient selon le climat, l’activité et la santé ; suivez l’avis médical en cas de restriction hydrique.",
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
