import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Language } from "../i18n";
import { localizeFoodName, localizeNutrientName, normalizeFoodSearch } from "../i18n-food";
import MealPlanner from "./MealPlanner";
import CustomMealBuilder from "./CustomMealBuilder";
import BarcodeScanner from "./BarcodeScanner";
import {
  addFoodToMeal, createFood, FoodRecord, getDailyMealFoods, MealFoodRecord,
  nutritionForQuantity, removeMealFood, searchFoods, getFoodNutrients, getFoodServings, getDailyNutrientTotals, FoodNutrientDetail, searchFoodsByNutrient, NutrientFoodResult
} from "./database";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
const GOLD = "#FFC928", GREEN = "#1686E8", PANEL = "#10294A", MUTED = "#A8B8CC";
const words: Record<Language, Record<string, string>> = {
  en: { title:"Food diary", calories:"Calories", protein:"Protein", carbs:"Carbs", fats:"Fats", breakfast:"Breakfast", lunch:"Lunch", dinner:"Dinner", snacks:"Snacks", add:"Add food", search:"Search saved foods", nutrientSearch:"Find foods by nutrient", highest:"Highest first", lowest:"Lowest first", nutrientHint:"Choose a nutrient to rank foods by its amount per 100 g.", noNutrientResults:"No foods have a recorded value for this nutrient.", selectNutrient:"Select nutrient", empty:"No foods logged for this meal yet.", create:"Create custom food", customFoodHint:"This form is for foods missing from the catalog. To log chicken or another common food, search its name above and select a result to see its nutrition details.", name:"Food name", kcal:"Calories / 100 g", protein100:"Protein / 100 g", carbs100:"Carbs / 100 g", fat100:"Fat / 100 g", fiber100:"Fiber / 100 g (optional)", grams:"Quantity in grams", save:"Save food", addMeal:"Add to meal", cancel:"Cancel", noResults:"No saved foods found. Create a food using its nutrition label.", unknown:"—", remove:"Remove", entered:"Nutrition values are per 100 g. Leave unknown values blank.", category:"BROWSE BY CATEGORY", nutrition100:"Nutrition per 100 g", vitamins100:"Vitamins and minerals per 100 g", dailyMicros:"Daily vitamins and minerals", noDailyMicros:"No recorded vitamin or mineral values for today yet.", chooseCategory:"Choose a category above to browse foods.", chooseCategoryHint:"Choose a category to browse foods.", planner:"Meal planner", scanner:"Scan barcode", backDiary:"← Back to food diary", checkFood:"Check the food name and nutrition values.", error:"Error", vitaminsForm:"Vitamins and minerals (per 100 g)" },
  ar: { title:"المفكرة الغذائية", calories:"السعرات", protein:"البروتين", carbs:"الكربوهيدرات", fats:"الدهون", breakfast:"الفطور", lunch:"الغداء", dinner:"العشاء", snacks:"وجبات خفيفة", add:"إضافة طعام", search:"ابحث في الأطعمة المحفوظة", nutrientSearch:"ابحث حسب العنصر الغذائي", highest:"الأعلى أولاً", lowest:"الأقل أولاً", nutrientHint:"اختر عنصراً غذائياً لترتيب الأطعمة حسب كميته في كل ١٠٠ غرام.", noNutrientResults:"لا توجد أطعمة بقيمة مسجلة لهذا العنصر.", selectNutrient:"اختر العنصر الغذائي", empty:"لا توجد أطعمة مسجلة لهذه الوجبة بعد.", create:"إنشاء طعام مخصص", customFoodHint:"هذا النموذج لإضافة الأطعمة غير الموجودة في قاعدة البيانات. لتسجيل الدجاج أو أي طعام شائع، ابحث عن اسمه أعلاه واختر النتيجة لعرض تفاصيله الغذائية.", name:"اسم الطعام", kcal:"السعرات / ١٠٠ غ", protein100:"البروتين / ١٠٠ غ", carbs100:"الكربوهيدرات / ١٠٠ غ", fat100:"الدهون / ١٠٠ غ", fiber100:"الألياف / ١٠٠ غ (اختياري)", grams:"الكمية بالغرام", save:"حفظ الطعام", addMeal:"إضافة إلى الوجبة", cancel:"إلغاء", noResults:"لم يتم العثور على أطعمة محفوظة. أنشئ طعاماً باستخدام ملصق القيم الغذائية.", unknown:"—", remove:"حذف", entered:"القيم لكل ١٠٠ غ. اترك القيم غير المعروفة فارغة.", category:"تصفح حسب الفئة", nutrition100:"القيم الغذائية لكل ١٠٠ غ", vitamins100:"الفيتامينات والمعادن لكل ١٠٠ غ", dailyMicros:"الفيتامينات والمعادن اليومية", noDailyMicros:"لا توجد قيم مسجلة للفيتامينات أو المعادن اليوم بعد.", chooseCategory:"اختر فئة لعرض الأطعمة.", chooseCategoryHint:"اختر فئة لتصفح الأطعمة.", planner:"مخطط الوجبات", scanner:"مسح الباركود", backDiary:"العودة إلى المفكرة", checkFood:"تحقق من اسم الطعام والقيم الغذائية.", error:"خطأ", vitaminsForm:"الفيتامينات والمعادن (لكل ١٠٠ غ)" },
  fr: { title:"Journal alimentaire", calories:"Calories", protein:"Protéines", carbs:"Glucides", fats:"Lipides", breakfast:"Petit-déjeuner", lunch:"Déjeuner", dinner:"Dîner", snacks:"Collations", add:"Ajouter", search:"Rechercher les aliments enregistrés", nutrientSearch:"Rechercher par nutriment", highest:"Plus élevé d’abord", lowest:"Plus faible d’abord", nutrientHint:"Choisissez un nutriment pour classer les aliments selon sa quantité pour 100 g.", noNutrientResults:"Aucun aliment ne possède de valeur enregistrée pour ce nutriment.", selectNutrient:"Choisir un nutriment", empty:"Aucun aliment enregistré pour ce repas.", create:"Créer un aliment personnalisé", customFoodHint:"Ce formulaire sert aux aliments absents du catalogue. Pour le poulet ou un aliment courant, recherchez son nom ci-dessus et sélectionnez un résultat pour voir ses valeurs nutritionnelles.", name:"Nom de l'aliment", kcal:"Calories / 100 g", protein100:"Protéines / 100 g", carbs100:"Glucides / 100 g", fat100:"Lipides / 100 g", fiber100:"Fibres / 100 g (facultatif)", grams:"Quantité en grammes", save:"Enregistrer", addMeal:"Ajouter au repas", cancel:"Annuler", noResults:"Aucun aliment enregistré. Créez-en un à partir de son étiquette nutritionnelle.", unknown:"—", remove:"Supprimer", entered:"Valeurs pour 100 g. Laissez vides les valeurs inconnues.", category:"PARCOURIR PAR CATÉGORIE", nutrition100:"Valeurs nutritionnelles pour 100 g", vitamins100:"Vitamines et minéraux pour 100 g", dailyMicros:"Vitamines et minéraux du jour", noDailyMicros:"Aucune valeur de vitamine ou de minéral enregistrée aujourd’hui.", chooseCategory:"Choisissez une catégorie pour afficher les aliments.", chooseCategoryHint:"Choisissez une catégorie pour parcourir les aliments.", planner:"Planificateur de repas", scanner:"Scanner le code-barres", backDiary:"← Retour au journal", checkFood:"Vérifiez le nom de l’aliment et ses valeurs nutritionnelles.", error:"Erreur", vitaminsForm:"Vitamines et minéraux (pour 100 g)" }
};

const nutrientNames: Record<Language, Record<string,string>> = {
 en: {},
 ar: {"Energy":"الطاقة","Protein":"البروتين","Carbohydrates":"الكربوهيدرات","Total fat":"إجمالي الدهون","Fiber":"الألياف","Total sugars":"السكريات","Saturated fat":"الدهون المشبعة","Trans fat":"الدهون المتحولة","Monounsaturated fat":"الدهون الأحادية غير المشبعة","Polyunsaturated fat":"الدهون المتعددة غير المشبعة","Starch":"النشا","Cholesterol":"الكوليسترول","Water":"الماء","Vitamin A":"فيتامين أ","Vitamin C":"فيتامين ج","Vitamin D":"فيتامين د","Vitamin E":"فيتامين هـ","Vitamin K":"فيتامين ك","Thiamin (B1)":"الثيامين (ب1)","Riboflavin (B2)":"الريبوفلافين (ب2)","Niacin (B3)":"النياسين (ب3)","Pantothenic acid (B5)":"حمض البانتوثينيك (ب5)","Vitamin B6":"فيتامين ب6","Biotin (B7)":"البيوتين (ب7)","Folate (B9)":"الفولات (ب9)","Vitamin B12":"فيتامين ب12","Calcium":"الكالسيوم","Iron":"الحديد","Magnesium":"المغنيسيوم","Phosphorus":"الفوسفور","Potassium":"البوتاسيوم","Sodium":"الصوديوم","Zinc":"الزنك","Copper":"النحاس","Manganese":"المنغنيز","Selenium":"السيلينيوم","Iodine":"اليود","Choline":"الكولين"},
 fr: {"Energy":"Énergie","Protein":"Protéines","Carbohydrates":"Glucides","Total fat":"Lipides totaux","Fiber":"Fibres","Total sugars":"Sucres totaux","Saturated fat":"Graisses saturées","Trans fat":"Acides gras trans","Monounsaturated fat":"Graisses mono-insaturées","Polyunsaturated fat":"Graisses polyinsaturées","Starch":"Amidon","Cholesterol":"Cholestérol","Water":"Eau","Vitamin A":"Vitamine A","Vitamin C":"Vitamine C","Vitamin D":"Vitamine D","Vitamin E":"Vitamine E","Vitamin K":"Vitamine K","Thiamin (B1)":"Thiamine (B1)","Riboflavin (B2)":"Riboflavine (B2)","Niacin (B3)":"Niacine (B3)","Pantothenic acid (B5)":"Acide pantothénique (B5)","Vitamin B6":"Vitamine B6","Biotin (B7)":"Biotine (B7)","Folate (B9)":"Folates (B9)","Vitamin B12":"Vitamine B12","Calcium":"Calcium","Iron":"Fer","Magnesium":"Magnésium","Phosphorus":"Phosphore","Potassium":"Potassium","Sodium":"Sodium","Zinc":"Zinc","Copper":"Cuivre","Manganese":"Manganèse","Selenium":"Sélénium","Iodine":"Iode","Choline":"Choline"}
};

const vitaminMineralCatalog = [
  { name:"Vitamin A", unit:"µg", aliases:["Vitamin A","Vitamin A, RAE","Retinol"] },
  { name:"Vitamin C", unit:"mg", aliases:["Vitamin C","Vitamin C, total ascorbic acid"] },
  { name:"Vitamin D", unit:"µg", aliases:["Vitamin D","Vitamin D (D2 + D3)","Vitamin D2","Vitamin D3"] },
  { name:"Vitamin E", unit:"mg", aliases:["Vitamin E","Vitamin E (alpha-tocopherol)"] },
  { name:"Vitamin K", unit:"µg", aliases:["Vitamin K","Vitamin K (phylloquinone)"] },
  { name:"Thiamin (B1)", unit:"mg", aliases:["Thiamin (B1)","Thiamin","Thiamine"] },
  { name:"Riboflavin (B2)", unit:"mg", aliases:["Riboflavin (B2)","Riboflavin"] },
  { name:"Niacin (B3)", unit:"mg", aliases:["Niacin (B3)","Niacin"] },
  { name:"Pantothenic acid (B5)", unit:"mg", aliases:["Pantothenic acid (B5)","Pantothenic acid"] },
  { name:"Vitamin B6", unit:"mg", aliases:["Vitamin B6","Vitamin B-6"] },
  { name:"Biotin (B7)", unit:"µg", aliases:["Biotin (B7)","Biotin"] },
  { name:"Folate (B9)", unit:"µg", aliases:["Folate (B9)","Folate, total","Folate, DFE"] },
  { name:"Vitamin B12", unit:"µg", aliases:["Vitamin B12","Vitamin B-12","Cobalamin"] },
  { name:"Calcium", unit:"mg", aliases:["Calcium","Calcium, Ca"] },
  { name:"Iron", unit:"mg", aliases:["Iron","Iron, Fe"] },
  { name:"Magnesium", unit:"mg", aliases:["Magnesium","Magnesium, Mg"] },
  { name:"Phosphorus", unit:"mg", aliases:["Phosphorus","Phosphorus, P"] },
  { name:"Potassium", unit:"mg", aliases:["Potassium","Potassium, K"] },
  { name:"Sodium", unit:"mg", aliases:["Sodium","Sodium, Na"] },
  { name:"Zinc", unit:"mg", aliases:["Zinc","Zinc, Zn"] },
  { name:"Copper", unit:"mg", aliases:["Copper","Copper, Cu"] },
  { name:"Manganese", unit:"mg", aliases:["Manganese","Manganese, Mn"] },
  { name:"Selenium", unit:"µg", aliases:["Selenium","Selenium, Se"] },
  { name:"Iodine", unit:"µg", aliases:["Iodine","Iodine, I"] },
  { name:"Choline", unit:"mg", aliases:["Choline","Choline, total"] }
] as const;
const findNutrient = (rows: FoodNutrientDetail[], aliases: readonly string[]) =>
  aliases.map(alias => rows.find(row => row.name.toLowerCase() === alias.toLowerCase())).find(Boolean) ?? null;

const nutrientSearchOptions = ["Calories","Protein","Carbohydrates","Fat","Fiber","Sugars","Saturated fat","Trans fat","Monounsaturated fat","Polyunsaturated fat","Starch","Cholesterol","Water", ...vitaminMineralCatalog.map(item => item.aliases[0])];
const mealTypes: MealType[] = ["breakfast","lunch","dinner","snacks"];
const foodCategories = [
  { id:"meat", en:"Meat & poultry", ar:"اللحوم والدواجن", fr:"Viandes", pattern:"Meat|Poultry|Sausage|Beef|Pork|Lamb|Veal|Game|Chicken|Turkey|Duck" },
  { id:"fish", en:"Fish & seafood", ar:"الأسماك والمأكولات البحرية", fr:"Poissons", pattern:"Fish|Finfish|Seafood|Shellfish|Crustacean|Mollusk" },
  { id:"vegetables", en:"Vegetables", ar:"الخضروات", fr:"Légumes", pattern:"%Vegetable%" },
  { id:"fruits", en:"Fruits", ar:"الفواكه", fr:"Fruits", pattern:"%Fruit%" },
  { id:"dairy", en:"Dairy & eggs", ar:"الألبان والبيض", fr:"Produits laitiers", pattern:"Dairy|Egg" },
  { id:"grains", en:"Grains & cereals", ar:"الحبوب", fr:"Céréales", pattern:"Cereal|Grain|Pasta|Rice|Noodle|Quinoa|Couscous|Bulgur" },
  { id:"legumes", en:"Beans, nuts & seeds", ar:"البقوليات والمكسرات والبذور", fr:"Légumineuses", pattern:"Legume|Nut|Seed|Bean" },
  { id:"other", en:"Other foods", ar:"أطعمة أخرى", fr:"Autres aliments", pattern:"%" }
];
const categoryImages = {
  meat: require("../../assets/images/food-categories/meat.png"),
  fish: require("../../assets/images/food-categories/fish.png"),
  vegetables: require("../../assets/images/food-categories/vegetables.png"),
  fruits: require("../../assets/images/food-categories/fruits.png"),
  dairy: require("../../assets/images/food-categories/dairy.png"),
  grains: require("../../assets/images/food-categories/grains.png"),
  legumes: require("../../assets/images/food-categories/legumes.png"),
  other: require("../../assets/images/food-categories/other.png")
} as const;
const parseOptional = (v: string) => v.trim() === "" ? null : Number(v.replace(",", "."));
const nutrientUnit = (name: string) => /Vitamin A|Vitamin D|Vitamin K|Biotin|Folate|Vitamin B12|Selenium|Iodine/.test(name) ? "µg" : "mg";
const sumKnown = (values: (number | null)[]) => values.every(v => v === null) ? null : values.reduce<number>((s,v) => s + (v ?? 0), 0);

export default function FoodDiary({ language, targetCalories = 2000, targetProtein, targetCarbs, targetFat }: { language: Language; targetCalories?: number; targetProtein?: number; targetCarbs?: number; targetFat?: number }) {
  const t = words[language], rtl = language === "ar";
  const nutrientLabel = (name: string) => nutrientNames[language][name] ?? localizeNutrientName(name, language);
  const [foods, setFoods] = useState<MealFoodRecord[]>([]);
  const [plannerMode, setPlannerMode] = useState(false);
  const [customMealMode, setCustomMealMode] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<typeof foodCategories[number] | null>(null);
  const [results, setResults] = useState<FoodRecord[]>([]);
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<FoodRecord | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [busy, setBusy] = useState(false);
  const [micros, setMicros] = useState<FoodNutrientDetail[]>([]);
  const [servings, setServings] = useState<{ id: number; label: string; grams: number }[]>([]);
  const [dailyMicros, setDailyMicros] = useState<FoodNutrientDetail[]>([]);
  const [microInputs, setMicroInputs] = useState<Record<string,string>>({});
  const [showNutrientSearch, setShowNutrientSearch] = useState(false);
  const [nutrientChoice, setNutrientChoice] = useState("Protein");
  const [showNutrientOptions, setShowNutrientOptions] = useState(false);
  const [nutrientDirection, setNutrientDirection] = useState<"high"|"low">("high");
  const [rankedFoods, setRankedFoods] = useState<NutrientFoodResult[]>([]);
  const [rankedLoading, setRankedLoading] = useState(false);
  const load = useCallback(async () => setFoods(await getDailyMealFoods()), []);
  useEffect(() => { load().catch(e => console.warn("Food diary load failed", e)); }, [load]);
  useEffect(() => { getDailyNutrientTotals().then(setDailyMicros).catch(e => console.warn("Daily nutrient totals unavailable", e)); }, [foods]);
  useEffect(() => {
    let live = true;
    if (!selectedCategory && !query.trim()) { setResults([]); return () => { live = false; }; }
    searchFoods(normalizeFoodSearch(query, language), selectedCategory?.pattern).then(items => {
      if (!live) return;
      const filtered = selectedCategory?.id === "other"
        ? items.filter(item => true)
        : items;
      setResults(filtered);
    }).catch(e => console.warn("Food search failed", e));
    return () => { live = false; };
  }, [query, selectedCategory, language]);
  useEffect(() => {
    let live = true;
    if (selected) {
      getFoodNutrients(selected.id).then(items => { if (live) setMicros(items); }).catch(e => console.warn("Nutrient details unavailable", e));
      getFoodServings(selected.id).then(items => { if (live) setServings(items); }).catch(e => console.warn("Food servings unavailable", e));
    } else { setMicros([]); setServings([]); }
    return () => { live = false; };
  }, [selected]);
  useEffect(() => {
    let live = true;
    if (!showNutrientSearch) { setRankedFoods([]); return () => { live = false; }; }
    setRankedLoading(true);
    searchFoodsByNutrient(nutrientChoice, nutrientDirection).then(rows => {
      if (live) setRankedFoods(rows);
    }).catch(error => console.warn("Nutrient food search failed", error)).finally(() => {
      if (live) setRankedLoading(false);
    });
    return () => { live = false; };
  }, [showNutrientSearch, nutrientChoice, nutrientDirection]);
  const totals = useMemo(() => ({
    calories: sumKnown(foods.map(f => nutritionForQuantity(f, f.quantity_g).calories)),
    protein: sumKnown(foods.map(f => nutritionForQuantity(f, f.quantity_g).protein_g)),
    carbs: sumKnown(foods.map(f => nutritionForQuantity(f, f.quantity_g).carbs_g)),
    fat: sumKnown(foods.map(f => nutritionForQuantity(f, f.quantity_g).fat_g))
  }), [foods]);
  const fmt = (n: number | null) => n === null ? t.unknown : Math.round(n).toString();
  const addSelected = async () => {
    const grams = Number(quantity.replace(",", "."));
    if (!selected || !Number.isFinite(grams) || grams <= 0) { Alert.alert(t.grams); return; }
    try { setBusy(true); await addFoodToMeal(selected.id, meal, grams); setSelected(null); setQuery(""); setQuantity("100"); await load(); }
    catch (e) { Alert.alert(t.error, String(e)); } finally { setBusy(false); }
  };
  const saveNewFood = async () => {
    const nums = [calories, protein, carbs, fat, fiber].map(parseOptional);
    if (!name.trim() || nums.some(n => n !== null && (!Number.isFinite(n) || n < 0))) { Alert.alert(t.checkFood); return; }
    try {
      setBusy(true);
      const nutrients = Object.entries(microInputs).map(([nutrientName, value]) => ({ name: nutrientName, unit: nutrientUnit(nutrientName), amount: parseOptional(value) }));
      const id = await createFood({ name, calories: nums[0], protein_g: nums[1], carbs_g: nums[2], fat_g: nums[3], fiber_g: nums[4], nutrients });
      const food: FoodRecord = { id, name: name.trim(), calories: nums[0], protein_g: nums[1], carbs_g: nums[2], fat_g: nums[3], fiber_g: nums[4], sugar_g: null, saturated_fat_g: null, trans_fat_g: null, monounsaturated_fat_g: null, polyunsaturated_fat_g: null, starch_g: null, cholesterol_mg: null, water_g: null, data_quality: "user_entered" };
      setSelected(food); setModal(false); setName(""); setCalories(""); setProtein(""); setCarbs(""); setFat(""); setFiber(""); setMicroInputs({});
    } catch (e) { Alert.alert("Error", String(e)); } finally { setBusy(false); }
  };
  const addRow = async (item: MealFoodRecord) => {
    try { await removeMealFood(item.meal_item_id); await load(); }
    catch (e) { Alert.alert("Error", String(e)); }
  };
  const textAlign = rtl ? "right" as const : "left" as const;
  if (customMealMode) return <CustomMealBuilder language={language} mealType={meal} onBack={()=>setCustomMealMode(false)} onAdded={()=>{setCustomMealMode(false);load().catch(e=>console.warn("Food diary refresh failed",e));}} />;
  if (plannerMode) return <ScrollView contentContainerStyle={s.content}>
    <Pressable onPress={()=>setPlannerMode(false)} style={s.outline}><Text style={s.outlineText}>{t.backDiary}</Text></Pressable>
    <MealPlanner language={language} targetCalories={targetCalories > 0 ? targetCalories : 2000} targetProtein={targetProtein} targetCarbs={targetCarbs} targetFat={targetFat} onAdded={() => { setPlannerMode(false); load().catch(e => console.warn("Food diary refresh failed after adding plan", e)); }} />
  </ScrollView>;
  const field = (label: string, value: string, set: (v:string)=>void, numeric=false) => <View style={s.field}><Text style={[s.label,{textAlign}]}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType={numeric ? "decimal-pad" : "default"} placeholder="—" placeholderTextColor={MUTED} style={[s.input,{textAlign}]} /></View>;
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={[s.title,{textAlign}]}>{t.title}</Text>
    <View style={s.meals}>
      <Pressable onPress={()=>setPlannerMode(true)} style={s.mealTab}><Text style={s.mealText}>{t.planner}</Text></Pressable>
       <Pressable onPress={()=>setCustomMealMode(true)} style={s.mealTab}><Text style={s.mealText}>{language==="ar"?"وجبة مخصصة":language==="fr"?"Repas personnalisé":"Custom meal"}</Text></Pressable>
      <Pressable onPress={()=>setScannerVisible(true)} style={s.mealTab}><Text style={s.mealText}>{t.scanner}</Text></Pressable>
    </View>
    <BarcodeScanner visible={scannerVisible} onClose={()=>setScannerVisible(false)} onFound={food=>{setSelected(food);setSelectedCategory(null);setQuery("");setQuantity("100");}} language={language} />
    <View style={s.card}>
      <Text style={[s.label,{textAlign}]}>{t.calories}</Text><Text style={s.calorie}>{fmt(totals.calories)} kcal</Text>
      <View style={s.macros}><Text style={s.macro}>{t.protein}: {fmt(totals.protein)} g</Text><Text style={s.macro}>{t.carbs}: {fmt(totals.carbs)} g</Text><Text style={s.macro}>{t.fats}: {fmt(totals.fat)} g</Text></View>
    </View>
    <Text style={[s.sectionTitle,{marginTop:4}]}>{t.category}</Text>
    <View style={s.categoryGrid}>{foodCategories.map(category=><Pressable key={category.id} onPress={()=>{setSelectedCategory(category);setQuery("");setSelected(null);}} style={[s.categoryCard,selectedCategory?.id===category.id&&s.categorySelected]}>
      <Image source={categoryImages[category.id as keyof typeof categoryImages]} style={s.categoryImage} resizeMode="cover" />
      <View style={s.categoryImageShade} />
      <View style={s.categoryNamePlate}><Text numberOfLines={2} style={[s.categoryText,selectedCategory?.id===category.id&&{color:GREEN}]}>{category[language]}</Text></View>
    </Pressable>)}</View>
    <TextInput value={query} onChangeText={setQuery} placeholder={t.search} placeholderTextColor={MUTED} style={[s.input,{textAlign,marginBottom:10}]} />
    <Pressable onPress={()=>{setShowNutrientSearch(value=>!value);setSelected(null);}} style={s.nutrientSearchButton}>
      <Text style={s.nutrientSearchButtonText}>{showNutrientSearch ? "− " : "⌕ "}{t.nutrientSearch}</Text>
    </Pressable>
    {showNutrientSearch && <View style={s.card}>
      <Text style={[s.muted,{textAlign}]}>{t.nutrientHint}</Text>
      <Pressable onPress={()=>setShowNutrientOptions(value=>!value)} style={[s.input,s.nutrientDropdown,{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}]}>
        <Text style={{color:"#F5F8FC",fontSize:14,fontWeight:"700"}}>{nutrientLabel(nutrientChoice)}</Text>
        <Text style={{color:GREEN,fontSize:16,fontWeight:"900"}}>{showNutrientOptions?"▴":"▾"}</Text>
      </Pressable>
      {showNutrientOptions && <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={s.nutrientDropdownList}>
        {nutrientSearchOptions.map(option=><Pressable key={option} onPress={()=>{setNutrientChoice(option);setShowNutrientOptions(false);}} style={[s.nutrientDropdownOption,nutrientChoice===option&&s.nutrientDropdownOptionActive]}>
          <Text style={[s.nutrientDropdownOptionText,nutrientChoice===option&&s.nutrientDropdownOptionTextActive]}>{nutrientLabel(option)}</Text>
        </Pressable>)}
      </ScrollView>}
      <View style={s.meals}>
        <Pressable onPress={()=>setNutrientDirection("high")} style={[s.mealTab,nutrientDirection==="high"&&s.mealActive]}><Text style={[s.mealText,nutrientDirection==="high"&&{color:"#FFFFFF"}]}>{t.highest}</Text></Pressable>
        <Pressable onPress={()=>setNutrientDirection("low")} style={[s.mealTab,nutrientDirection==="low"&&s.mealActive]}><Text style={[s.mealText,nutrientDirection==="low"&&{color:"#FFFFFF"}]}>{t.lowest}</Text></Pressable>
      </View>
      {rankedLoading ? <Text style={s.muted}>…</Text> : rankedFoods.length===0 ? <Text style={[s.muted,{textAlign}]}>{t.noNutrientResults}</Text> : rankedFoods.map((item,index)=><Pressable key={item.id} onPress={()=>{setSelected(item);setQuery("");setSelectedCategory(null);setQuantity("100");}} style={s.rankedResult}>
        <View style={s.rankBadge}><Text style={s.rankText}>{index+1}</Text></View>
        <View style={{flex:1}}><Text style={s.foodName}>{localizeFoodName(item.name,language)}</Text><Text style={s.muted}>{nutrientLabel(nutrientChoice)} · {item.nutrient_amount.toFixed(2)} {item.nutrient_unit} / 100 g</Text></View>
      </Pressable>)}
    </View>}
    <View style={s.meals}>{mealTypes.map(m=><Pressable key={m} onPress={()=>setMeal(m)} style={[s.mealTab,meal===m&&s.mealActive]}><Text style={[s.mealText,meal===m&&{color:"#FFFFFF"}]}>{t[m]}</Text></Pressable>)}</View>
    {selected ? <View style={s.card}>
      <Text style={s.cardTitle}>{localizeFoodName(selected.name, language)}</Text>
      <Text style={s.sectionTitle}>{t.nutrition100}</Text>
      {[
        ["Energy", selected.calories, "kcal"], ["Protein", selected.protein_g, "g"],
        ["Carbohydrates", selected.carbs_g, "g"], ["Total fat", selected.fat_g, "g"],
        ["Fiber", selected.fiber_g, "g"], ["Total sugars", selected.sugar_g, "g"],
        ["Saturated fat", selected.saturated_fat_g, "g"], ["Trans fat", selected.trans_fat_g, "g"], ["Monounsaturated fat", selected.monounsaturated_fat_g, "g"], ["Polyunsaturated fat", selected.polyunsaturated_fat_g, "g"], ["Starch", selected.starch_g, "g"], ["Cholesterol", selected.cholesterol_mg, "mg"], ["Water", selected.water_g, "g"]
      ].map(([label, amount, unit]) => <View key={String(label)} style={s.nutrientRow}><Text style={s.muted}>{nutrientLabel(String(label))}</Text><Text style={s.nutrientValue}>{amount === null ? "—" : amount} {unit}</Text></View>)}
      <Text style={s.sectionTitle}>{t.vitamins100}</Text>
      {vitaminMineralCatalog.map(item => { const n=findNutrient(micros,item.aliases); return <View key={item.name} style={s.nutrientRow}><Text style={s.muted}>{nutrientLabel(item.name)}</Text><Text style={s.nutrientValue}>{n?.amount == null ? "—" : Number(n.amount.toFixed(3)) + " " + (n.unit || item.unit)}</Text></View>; })}
      {field(t.grams,quantity,setQuantity,true)}
      {servings.length > 0 && <View style={s.meals}>{servings.map(serving => <Pressable key={serving.id} onPress={() => setQuantity(String(serving.grams))} style={s.mealTab}><Text style={s.mealText}>{serving.label} · {serving.grams} g</Text></Pressable>)}</View>}
      <Pressable onPress={addSelected} disabled={busy} style={s.button}><Text style={s.buttonText}>{t.addMeal}</Text></Pressable>
      <Pressable onPress={()=>setSelected(null)} style={s.cancel}><Text style={s.muted}>{t.cancel}</Text></Pressable>
    </View> : <View style={s.card}>
      {!selectedCategory && !query.trim() && <Text style={s.muted}>{t.chooseCategoryHint}</Text>}
      {results.map(item=><Pressable key={item.id} onPress={()=>setSelected(item)} style={s.result}><View style={{flex:1}}><Text style={s.foodName}>{localizeFoodName(item.name, language)}</Text><Text style={s.muted}>{item.calories===null?t.unknown:Math.round(item.calories)+" kcal"} / 100 g</Text></View><Text style={s.plus}>＋</Text></Pressable>)}
      {results.length===0&&<Text style={[s.muted,{textAlign}]}>{t.noResults}</Text>}
      <Pressable onPress={()=>setCustomMealMode(true)} style={s.outline}><Text style={s.outlineText}>＋ {t.create}</Text></Pressable>
    </View>}
    <View style={s.card}><Text style={s.cardTitle}>{t.dailyMicros}</Text>{vitaminMineralCatalog.map(item=>{const n=findNutrient(dailyMicros,item.aliases);const amount=n?.amount??(foods.length===0?0:null);return <View key={item.name} style={s.nutrientRow}><Text style={s.muted}>{nutrientLabel(item.name)}</Text><Text style={s.nutrientValue}>{amount===null?"—":Number(amount.toFixed(2))+" "+(n?.unit||item.unit)}</Text></View>;})}</View>
    {mealTypes.map(m=><View key={m} style={s.card}>
      <Text style={[s.cardTitle,{textAlign}]}>{t[m]}</Text>
      {foods.filter(f=>f.meal_type===m).length===0 ? <Text style={[s.muted,{textAlign}]}>{t.empty}</Text> :
        foods.filter(f=>f.meal_type===m).map(item=><View key={item.meal_item_id} style={s.logged}><View style={{flex:1}}><Text style={s.foodName}>{localizeFoodName(item.name, language)}</Text><Text style={s.muted}>{item.quantity_g} g · {fmt(nutritionForQuantity(item,item.quantity_g).calories)} kcal</Text></View><Pressable onPress={()=>addRow(item)}><Text style={s.remove}>×</Text></Pressable></View>)}
    </View>)}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={()=>setModal(false)}>
      <View style={s.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalWrap}><View style={s.modal}>
        <Text style={s.cardTitle}>{t.create}</Text><Text style={s.muted}>{t.customFoodHint}</Text><Text style={s.muted}>{t.entered}</Text>
        {field(t.name,name,setName)}{field(t.kcal,calories,setCalories,true)}{field(t.protein100,protein,setProtein,true)}{field(t.carbs100,carbs,setCarbs,true)}{field(t.fat100,fat,setFat,true)}{field(t.fiber100,fiber,setFiber,true)}
        <Text style={s.sectionTitle}>{t.vitaminsForm}</Text>
        {["Vitamin A","Vitamin C","Vitamin D","Vitamin E","Vitamin K","Thiamin (B1)","Riboflavin (B2)","Niacin (B3)","Pantothenic acid (B5)","Vitamin B6","Biotin (B7)","Folate (B9)","Vitamin B12","Calcium","Iron","Magnesium","Phosphorus","Potassium","Sodium","Zinc","Copper","Manganese","Selenium","Iodine","Choline"].map(n => field(nutrientLabel(n),microInputs[n] ?? "",v=>setMicroInputs(old=>({...old,[n]:v})),true))}
        <Pressable onPress={saveNewFood} disabled={busy} style={s.button}><Text style={s.buttonText}>{t.save}</Text></Pressable>
        <Pressable onPress={()=>setModal(false)} style={s.cancel}><Text style={s.muted}>{t.cancel}</Text></Pressable>
      </View></ScrollView></View>
    </Modal>
  </ScrollView>;
}
const s=StyleSheet.create({
 content:{padding:20,paddingBottom:32,gap:12},categoryGrid:{flexDirection:"row",flexWrap:"wrap",gap:9},categoryCard:{width:"48%",minHeight:112,justifyContent:"flex-end",alignItems:"stretch",backgroundColor:"#12345B",borderWidth:1,borderColor:"#244A73",borderRadius:16,overflow:"hidden",padding:0},categorySelected:{borderColor:GOLD,borderWidth:2,shadowColor:GOLD,shadowOpacity:0.22,shadowRadius:8,elevation:3},categoryImage:{...StyleSheet.absoluteFill,width:"100%",height:"100%"},categoryImageShade:{...StyleSheet.absoluteFill,backgroundColor:"rgba(4,8,5,0.34)"},categoryNamePlate:{width:"100%",minHeight:46,justifyContent:"center",paddingHorizontal:10,paddingVertical:8,backgroundColor:"rgba(255,255,255,0.97)",borderTopWidth:1,borderTopColor:"#D8E2EF"},categoryText:{color:"#08264A",fontSize:13,fontWeight:"900",textAlign:"center"},title:{color:"#F5F8FC",fontSize:28,fontWeight:"900",marginBottom:7,letterSpacing:-0.5},
 card:{backgroundColor:"#FFFFFF",borderRadius:18,borderWidth:1,borderColor:"#D8E2EF",padding:16,marginBottom:2},
 label:{color:"#08264A",fontSize:13,fontWeight:"700"},calorie:{color:"#08264A",fontSize:34,fontWeight:"900",marginVertical:7},
 macros:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8},macro:{color:"#08264A",fontSize:12,fontWeight:"700"},
 input:{color:"#08264A",backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#C8D5E5",borderRadius:11,paddingHorizontal:13,paddingVertical:11,fontSize:14},
 meals:{flexDirection:"row",gap:7,flexWrap:"wrap"},mealTab:{paddingVertical:10,paddingHorizontal:12,borderRadius:10,backgroundColor:"#08264A",borderWidth:1,borderColor:"#08264A"},mealActive:{borderColor:"#08264A",backgroundColor:"#08264A"},mealText:{color:"#FFFFFF",fontSize:12,fontWeight:"800"},
 nutrientSearchButton:{backgroundColor:"#08264A",borderRadius:12,padding:13,alignItems:"center",borderWidth:1,borderColor:"#1686E8"},
 nutrientSearchButtonText:{color:"#FFFFFF",fontSize:13,fontWeight:"900"},
 nutrientDropdown:{marginTop:10,marginBottom:8,backgroundColor:"#08264A",borderColor:"#08264A"},nutrientDropdownList:{maxHeight:230,borderWidth:1,borderColor:"#D8E2EF",borderRadius:11,backgroundColor:"#FFFFFF",marginBottom:12},nutrientDropdownOption:{paddingHorizontal:13,paddingVertical:11,borderBottomWidth:1,borderBottomColor:"#E4EAF2"},nutrientDropdownOptionActive:{backgroundColor:"#EAF1F9"},nutrientDropdownOptionText:{color:"#08264A",fontSize:13,fontWeight:"600"},nutrientDropdownOptionTextActive:{color:"#08264A",fontWeight:"900"},
 rankedResult:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#E4EAF2"},
 rankBadge:{width:27,height:27,borderRadius:14,backgroundColor:"#EAF1F9",alignItems:"center",justifyContent:"center"},
 rankText:{color:"#08264A",fontSize:11,fontWeight:"900"},
 result:{flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#E4EAF2"},foodName:{color:"#08264A",fontSize:14,fontWeight:"700"},muted:{color:"#52657D",fontSize:12,lineHeight:18},plus:{color:"#08264A",fontSize:22,paddingHorizontal:8},
 outline:{borderWidth:1,borderColor:"#08264A",backgroundColor:"#08264A",borderRadius:11,padding:12,alignItems:"center",marginTop:14},outlineText:{color:"#FFFFFF",fontWeight:"800"},
 cardTitle:{color:"#08264A",fontSize:16,fontWeight:"800",marginBottom:9},sectionTitle:{color:"#08264A",fontSize:13,fontWeight:"900",marginTop:12,marginBottom:6},nutrientRow:{flexDirection:"row",justifyContent:"space-between",gap:12,paddingVertical:7,borderBottomWidth:1,borderBottomColor:"#E4EAF2"},nutrientValue:{color:"#08264A",fontSize:12,fontWeight:"700",textAlign:"right"},logged:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderTopWidth:1,borderTopColor:"#E4EAF2"},remove:{color:"#FF7777",fontSize:23,paddingHorizontal:10},
 field:{marginTop:9},button:{backgroundColor:"#08264A",borderRadius:13,padding:15,alignItems:"center",marginTop:13,borderWidth:1,borderColor:"#08264A",shadowColor:"#08264A",shadowOpacity:0.16,shadowRadius:7,elevation:3},buttonText:{color:"#FFFFFF",fontWeight:"900",letterSpacing:0.3},cancel:{alignItems:"center",padding:12},
 overlay:{flex:1,backgroundColor:"#06162BE8",justifyContent:"center",alignItems:"center",padding:16},modalWrap:{flexGrow:1,width:"100%",maxWidth:480,alignSelf:"center",justifyContent:"center",paddingVertical:20},modal:{width:"100%",backgroundColor:"#FFFFFF",borderRadius:18,padding:18,borderWidth:1,borderColor:"#D8E2EF"}
});
