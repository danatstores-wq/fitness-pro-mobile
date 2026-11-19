import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Language } from "../i18n";
import MealPlanner from "./MealPlanner";
import BarcodeScanner from "./BarcodeScanner";
import {
  addFoodToMeal, createFood, FoodRecord, getDailyMealFoods, MealFoodRecord,
  nutritionForQuantity, removeMealFood, searchFoods, getFoodNutrients, getFoodServings, getDailyNutrientTotals, FoodNutrientDetail
} from "./database";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
const GOLD = "#D7B45A", GREEN = "#4FA66B", PANEL = "#141A16", MUTED = "#A7B0A7";
const words: Record<Language, Record<string, string>> = {
  en: { title:"Food diary", calories:"Calories", protein:"Protein", carbs:"Carbs", fats:"Fats", breakfast:"Breakfast", lunch:"Lunch", dinner:"Dinner", snacks:"Snacks", add:"Add food", search:"Search saved foods", empty:"No foods logged for this meal yet.", create:"Create food", name:"Food name", kcal:"Calories / 100 g", protein100:"Protein / 100 g", carbs100:"Carbs / 100 g", fat100:"Fat / 100 g", fiber100:"Fiber / 100 g (optional)", grams:"Quantity in grams", save:"Save food", addMeal:"Add to meal", cancel:"Cancel", noResults:"No saved foods found. Create a food using its nutrition label.", unknown:"—", remove:"Remove", entered:"Nutrition values are per 100 g. Leave unknown values blank.", category:"BROWSE BY CATEGORY", nutrition100:"Nutrition per 100 g", vitamins100:"Vitamins and minerals per 100 g", dailyMicros:"Daily vitamins and minerals", noDailyMicros:"No recorded vitamin or mineral values for today yet.", chooseCategory:"Choose a category above to browse foods.", chooseCategoryHint:"Choose a category to browse foods.", planner:"Meal planner", scanner:"Scan barcode", backDiary:"← Back to food diary", checkFood:"Check the food name and nutrition values.", error:"Error", vitaminsForm:"Vitamins and minerals (per 100 g)" },
  ar: { title:"المفكرة الغذائية", calories:"السعرات", protein:"البروتين", carbs:"الكربوهيدرات", fats:"الدهون", breakfast:"الفطور", lunch:"الغداء", dinner:"العشاء", snacks:"وجبات خفيفة", add:"إضافة طعام", search:"ابحث في الأطعمة المحفوظة", empty:"لا توجد أطعمة مسجلة لهذه الوجبة بعد.", create:"إنشاء طعام", name:"اسم الطعام", kcal:"السعرات / ١٠٠ غ", protein100:"البروتين / ١٠٠ غ", carbs100:"الكربوهيدرات / ١٠٠ غ", fat100:"الدهون / ١٠٠ غ", fiber100:"الألياف / ١٠٠ غ (اختياري)", grams:"الكمية بالغرام", save:"حفظ الطعام", addMeal:"إضافة إلى الوجبة", cancel:"إلغاء", noResults:"لم يتم العثور على أطعمة محفوظة. أنشئ طعاماً باستخدام ملصق القيم الغذائية.", unknown:"—", remove:"حذف", entered:"القيم لكل ١٠٠ غ. اترك القيم غير المعروفة فارغة.", category:"تصفح حسب الفئة", nutrition100:"القيم الغذائية لكل ١٠٠ غ", vitamins100:"الفيتامينات والمعادن لكل ١٠٠ غ", dailyMicros:"الفيتامينات والمعادن اليومية", noDailyMicros:"لا توجد قيم مسجلة للفيتامينات أو المعادن اليوم بعد.", chooseCategory:"اختر فئة لعرض الأطعمة.", chooseCategoryHint:"اختر فئة لتصفح الأطعمة.", planner:"مخطط الوجبات", scanner:"مسح الباركود", backDiary:"العودة إلى المفكرة", checkFood:"تحقق من اسم الطعام والقيم الغذائية.", error:"خطأ", vitaminsForm:"الفيتامينات والمعادن (لكل ١٠٠ غ)" },
  fr: { title:"Journal alimentaire", calories:"Calories", protein:"Protéines", carbs:"Glucides", fats:"Lipides", breakfast:"Petit-déjeuner", lunch:"Déjeuner", dinner:"Dîner", snacks:"Collations", add:"Ajouter", search:"Rechercher les aliments enregistrés", empty:"Aucun aliment enregistré pour ce repas.", create:"Créer un aliment", name:"Nom de l'aliment", kcal:"Calories / 100 g", protein100:"Protéines / 100 g", carbs100:"Glucides / 100 g", fat100:"Lipides / 100 g", fiber100:"Fibres / 100 g (facultatif)", grams:"Quantité en grammes", save:"Enregistrer", addMeal:"Ajouter au repas", cancel:"Annuler", noResults:"Aucun aliment enregistré. Créez-en un à partir de son étiquette nutritionnelle.", unknown:"—", remove:"Supprimer", entered:"Valeurs pour 100 g. Laissez vides les valeurs inconnues.", category:"PARCOURIR PAR CATÉGORIE", nutrition100:"Valeurs nutritionnelles pour 100 g", vitamins100:"Vitamines et minéraux pour 100 g", dailyMicros:"Vitamines et minéraux du jour", noDailyMicros:"Aucune valeur de vitamine ou de minéral enregistrée aujourd’hui.", chooseCategory:"Choisissez une catégorie pour afficher les aliments.", chooseCategoryHint:"Choisissez une catégorie pour parcourir les aliments.", planner:"Planificateur de repas", scanner:"Scanner le code-barres", backDiary:"← Retour au journal", checkFood:"Vérifiez le nom de l’aliment et ses valeurs nutritionnelles.", error:"Erreur", vitaminsForm:"Vitamines et minéraux (pour 100 g)" }
};
const mealTypes: MealType[] = ["breakfast","lunch","dinner","snacks"];
const foodCategories = [
  { id:"meat", en:"Meat & poultry", ar:"اللحوم والدواجن", fr:"Viandes", pattern:"Meat|Poultry|Sausage|Beef|Pork|Lamb|Veal|Game|Chicken|Turkey|Duck" },
  { id:"fish", en:"Fish & seafood", ar:"الأسماك والمأكولات البحرية", fr:"Poissons", pattern:"Fish|Finfish|Seafood|Shellfish|Crustacean|Mollusk" },
  { id:"vegetables", en:"Vegetables", ar:"الخضروات", fr:"Légumes", pattern:"%Vegetable%" },
  { id:"fruits", en:"Fruits", ar:"الفواكه", fr:"Fruits", pattern:"%Fruit%" },
  { id:"dairy", en:"Dairy & eggs", ar:"الألبان والبيض", fr:"Produits laitiers", pattern:"Dairy|Egg" },
  { id:"grains", en:"Grains & cereals", ar:"الحبوب", fr:"Céréales", pattern:"Cereal|Grain|Pasta|Rice" },
  { id:"legumes", en:"Beans, nuts & seeds", ar:"البقوليات والمكسرات والبذور", fr:"Légumineuses", pattern:"Legume|Nut|Seed|Bean" },
  { id:"other", en:"Other foods", ar:"أطعمة أخرى", fr:"Autres aliments", pattern:"%" }
];
const parseOptional = (v: string) => v.trim() === "" ? null : Number(v.replace(",", "."));
const nutrientUnit = (name: string) => /Vitamin A|Vitamin D|Vitamin K|Biotin|Folate|Vitamin B12|Selenium|Iodine/.test(name) ? "µg" : "mg";
const sumKnown = (values: (number | null)[]) => values.every(v => v === null) ? null : values.reduce<number>((s,v) => s + (v ?? 0), 0);

export default function FoodDiary({ language, targetCalories = 2000 }: { language: Language; targetCalories?: number }) {
  const t = words[language], rtl = language === "ar";
  const [foods, setFoods] = useState<MealFoodRecord[]>([]);
  const [plannerMode, setPlannerMode] = useState(false);
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
  const load = useCallback(async () => setFoods(await getDailyMealFoods()), []);
  useEffect(() => { load().catch(e => console.warn("Food diary load failed", e)); }, [load]);
  useEffect(() => { getDailyNutrientTotals().then(setDailyMicros).catch(e => console.warn("Daily nutrient totals unavailable", e)); }, [foods]);
  useEffect(() => {
    let live = true;
    if (!selectedCategory && !query.trim()) { setResults([]); return () => { live = false; }; }
    searchFoods(query, selectedCategory?.pattern).then(items => {
      if (!live) return;
      const filtered = selectedCategory?.id === "other"
        ? items.filter(item => true)
        : items;
      setResults(filtered);
    }).catch(e => console.warn("Food search failed", e));
    return () => { live = false; };
  }, [query, selectedCategory]);
  useEffect(() => {
    let live = true;
    if (selected) {
      getFoodNutrients(selected.id).then(items => { if (live) setMicros(items); }).catch(e => console.warn("Nutrient details unavailable", e));
      getFoodServings(selected.id).then(items => { if (live) setServings(items); }).catch(e => console.warn("Food servings unavailable", e));
    } else { setMicros([]); setServings([]); }
    return () => { live = false; };
  }, [selected]);
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
  if (plannerMode) return <ScrollView contentContainerStyle={s.content}>
    <Pressable onPress={()=>setPlannerMode(false)} style={s.outline}><Text style={s.outlineText}>{t.backDiary}</Text></Pressable>
    <MealPlanner language={language} targetCalories={targetCalories > 0 ? targetCalories : 2000} />
  </ScrollView>;
  const field = (label: string, value: string, set: (v:string)=>void, numeric=false) => <View style={s.field}><Text style={[s.label,{textAlign}]}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType={numeric ? "decimal-pad" : "default"} placeholder="—" placeholderTextColor={MUTED} style={[s.input,{textAlign}]} /></View>;
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={[s.title,{textAlign}]}>{t.title}</Text>
    <View style={s.meals}>
      <Pressable onPress={()=>setPlannerMode(true)} style={s.mealTab}><Text style={s.mealText}>{t.planner}</Text></Pressable>
      <Pressable onPress={()=>setScannerVisible(true)} style={s.mealTab}><Text style={s.mealText}>{t.scanner}</Text></Pressable>
    </View>
    <BarcodeScanner visible={scannerVisible} onClose={()=>setScannerVisible(false)} onFound={food=>{setSelected(food);setSelectedCategory(null);setQuery("");setQuantity("100");}} language={language} />
    <View style={s.card}>
      <Text style={[s.label,{textAlign}]}>{t.calories}</Text><Text style={s.calorie}>{fmt(totals.calories)} kcal</Text>
      <View style={s.macros}><Text style={s.macro}>{t.protein}: {fmt(totals.protein)} g</Text><Text style={s.macro}>{t.carbs}: {fmt(totals.carbs)} g</Text><Text style={s.macro}>{t.fats}: {fmt(totals.fat)} g</Text></View>
    </View>
    <Text style={[s.sectionTitle,{marginTop:4}]}>{t.category}</Text>
    <View style={s.categoryGrid}>{foodCategories.map(category=><Pressable key={category.id} onPress={()=>{setSelectedCategory(category);setQuery("");setSelected(null);}} style={[s.categoryCard,selectedCategory?.id===category.id&&s.categorySelected]}><Text style={[s.categoryText,selectedCategory?.id===category.id&&{color:GOLD}]}>{category[language]}</Text></Pressable>)}</View>
    <TextInput value={query} onChangeText={setQuery} placeholder={t.search} placeholderTextColor={MUTED} style={[s.input,{textAlign,marginBottom:10}]} />
    <View style={s.meals}>{mealTypes.map(m=><Pressable key={m} onPress={()=>setMeal(m)} style={[s.mealTab,meal===m&&s.mealActive]}><Text style={[s.mealText,meal===m&&{color:GOLD}]}>{t[m]}</Text></Pressable>)}</View>
    {selected ? <View style={s.card}>
      <Text style={s.cardTitle}>{selected.name}</Text>
      <Text style={s.sectionTitle}>{t.nutrition100}</Text>
      {[
        ["Energy", selected.calories, "kcal"], ["Protein", selected.protein_g, "g"],
        ["Carbohydrates", selected.carbs_g, "g"], ["Total fat", selected.fat_g, "g"],
        ["Fiber", selected.fiber_g, "g"], ["Total sugars", selected.sugar_g, "g"],
        ["Saturated fat", selected.saturated_fat_g, "g"], ["Trans fat", selected.trans_fat_g, "g"], ["Monounsaturated fat", selected.monounsaturated_fat_g, "g"], ["Polyunsaturated fat", selected.polyunsaturated_fat_g, "g"], ["Starch", selected.starch_g, "g"], ["Cholesterol", selected.cholesterol_mg, "mg"], ["Water", selected.water_g, "g"]
      ].map(([label, amount, unit]) => <View key={String(label)} style={s.nutrientRow}><Text style={s.muted}>{label}</Text><Text style={s.nutrientValue}>{amount === null ? "—" : amount} {unit}</Text></View>)}
      <Text style={s.sectionTitle}>{t.vitamins100}</Text>
      {micros.map(n => <View key={n.name} style={s.nutrientRow}><Text style={s.muted}>{n.name}</Text><Text style={s.nutrientValue}>{n.amount === null ? "—" : n.amount + " " + n.unit}</Text></View>)}
      {field(t.grams,quantity,setQuantity,true)}
      {servings.length > 0 && <View style={s.meals}>{servings.map(serving => <Pressable key={serving.id} onPress={() => setQuantity(String(serving.grams))} style={s.mealTab}><Text style={s.mealText}>{serving.label} · {serving.grams} g</Text></Pressable>)}</View>}
      <Pressable onPress={addSelected} disabled={busy} style={s.button}><Text style={s.buttonText}>{t.addMeal}</Text></Pressable>
      <Pressable onPress={()=>setSelected(null)} style={s.cancel}><Text style={s.muted}>{t.cancel}</Text></Pressable>
    </View> : <View style={s.card}>
      {!selectedCategory && !query.trim() && <Text style={s.muted}>{t.chooseCategoryHint}</Text>}
      {results.map(item=><Pressable key={item.id} onPress={()=>setSelected(item)} style={s.result}><View style={{flex:1}}><Text style={s.foodName}>{item.name}</Text><Text style={s.muted}>{item.calories===null?t.unknown:Math.round(item.calories)+" kcal"} / 100 g</Text></View><Text style={s.plus}>＋</Text></Pressable>)}
      {results.length===0&&<Text style={[s.muted,{textAlign}]}>{t.noResults}</Text>}
      <Pressable onPress={()=>setModal(true)} style={s.outline}><Text style={s.outlineText}>＋ {t.create}</Text></Pressable>
    </View>}
    <View style={s.card}><Text style={s.cardTitle}>{t.dailyMicros}</Text>{dailyMicros.length === 0 ? <Text style={s.muted}>{t.noDailyMicros}</Text> : dailyMicros.map(n=><View key={n.name} style={s.nutrientRow}><Text style={s.muted}>{n.name}</Text><Text style={s.nutrientValue}>{n.amount === null ? "—" : Number(n.amount.toFixed(2)) + " " + n.unit}</Text></View>)}</View>
    {mealTypes.map(m=><View key={m} style={s.card}>
      <Text style={[s.cardTitle,{textAlign}]}>{t[m]}</Text>
      {foods.filter(f=>f.meal_type===m).length===0 ? <Text style={[s.muted,{textAlign}]}>{t.empty}</Text> :
        foods.filter(f=>f.meal_type===m).map(item=><View key={item.meal_item_id} style={s.logged}><View style={{flex:1}}><Text style={s.foodName}>{item.name}</Text><Text style={s.muted}>{item.quantity_g} g · {fmt(nutritionForQuantity(item,item.quantity_g).calories)} kcal</Text></View><Pressable onPress={()=>addRow(item)}><Text style={s.remove}>×</Text></Pressable></View>)}
    </View>)}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={()=>setModal(false)}>
      <View style={s.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalWrap}><View style={s.modal}>
        <Text style={s.cardTitle}>{t.create}</Text><Text style={s.muted}>{t.entered}</Text>
        {field(t.name,name,setName)}{field(t.kcal,calories,setCalories,true)}{field(t.protein100,protein,setProtein,true)}{field(t.carbs100,carbs,setCarbs,true)}{field(t.fat100,fat,setFat,true)}{field(t.fiber100,fiber,setFiber,true)}
        <Text style={s.sectionTitle}>{t.vitaminsForm}</Text>
        {["Vitamin A","Vitamin C","Vitamin D","Vitamin E","Vitamin K","Thiamin (B1)","Riboflavin (B2)","Niacin (B3)","Pantothenic acid (B5)","Vitamin B6","Biotin (B7)","Folate (B9)","Vitamin B12","Calcium","Iron","Magnesium","Phosphorus","Potassium","Sodium","Zinc","Copper","Manganese","Selenium","Iodine","Choline"].map(n => field(n,microInputs[n] ?? "",v=>setMicroInputs(old=>({...old,[n]:v})),true))}
        <Pressable onPress={saveNewFood} disabled={busy} style={s.button}><Text style={s.buttonText}>{t.save}</Text></Pressable>
        <Pressable onPress={()=>setModal(false)} style={s.cancel}><Text style={s.muted}>{t.cancel}</Text></Pressable>
      </View></ScrollView></View>
    </Modal>
  </ScrollView>;
}
const s=StyleSheet.create({
 content:{padding:20,paddingBottom:32,gap:12},categoryGrid:{flexDirection:"row",flexWrap:"wrap",gap:9},categoryCard:{width:"48%",minHeight:76,justifyContent:"center",backgroundColor:"#18231B",borderWidth:1,borderColor:"#485347",borderRadius:14,padding:12},categorySelected:{borderColor:GOLD,backgroundColor:"#283A2D"},categoryText:{color:"#E8E8DC",fontSize:12,fontWeight:"800"},title:{color:"#F2F0E8",fontSize:25,fontWeight:"900",marginBottom:4},
 card:{backgroundColor:PANEL,borderRadius:18,borderWidth:1,borderColor:"#343B32",padding:16,marginBottom:2},
 label:{color:"#E8E8DC",fontSize:13,fontWeight:"700"},calorie:{color:GOLD,fontSize:32,fontWeight:"900",marginVertical:5},
 macros:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8},macro:{color:GREEN,fontSize:12,fontWeight:"700"},
 input:{color:"#F2F0E8",backgroundColor:"#101712",borderWidth:1,borderColor:"#485347",borderRadius:11,paddingHorizontal:13,paddingVertical:11,fontSize:14},
 meals:{flexDirection:"row",gap:7,flexWrap:"wrap"},mealTab:{paddingVertical:10,paddingHorizontal:12,borderRadius:10,backgroundColor:PANEL,borderWidth:1,borderColor:"#485347"},mealActive:{borderColor:GOLD,backgroundColor:"#283A2D"},mealText:{color:"#A7B0A7",fontSize:12,fontWeight:"700"},
 result:{flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#303A31"},foodName:{color:"#F2F0E8",fontSize:14,fontWeight:"700"},muted:{color:MUTED,fontSize:12,lineHeight:18},plus:{color:GOLD,fontSize:22,paddingHorizontal:8},
 outline:{borderWidth:1,borderColor:GOLD,borderRadius:11,padding:12,alignItems:"center",marginTop:14},outlineText:{color:GOLD,fontWeight:"800"},
 cardTitle:{color:"#F2F0E8",fontSize:16,fontWeight:"800",marginBottom:9},sectionTitle:{color:GOLD,fontSize:13,fontWeight:"800",marginTop:12,marginBottom:6},nutrientRow:{flexDirection:"row",justifyContent:"space-between",gap:12,paddingVertical:7,borderBottomWidth:1,borderBottomColor:"#303A31"},nutrientValue:{color:"#F2F0E8",fontSize:12,fontWeight:"700",textAlign:"right"},logged:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderTopWidth:1,borderTopColor:"#303A31"},remove:{color:"#D47777",fontSize:23,paddingHorizontal:10},
 field:{marginTop:9},button:{backgroundColor:GOLD,borderRadius:11,padding:14,alignItems:"center",marginTop:13},buttonText:{color:"#F2F0E8",fontWeight:"900"},cancel:{alignItems:"center",padding:12},
 overlay:{flex:1,backgroundColor:"#F2F0E8CC",justifyContent:"center",padding:16},modalWrap:{flexGrow:1,justifyContent:"center"},modal:{backgroundColor:PANEL,borderRadius:18,padding:18,borderWidth:1,borderColor:"#485347"}
});
