import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Language } from "../i18n";
import {
  addFoodToMeal, createFood, FoodRecord, getDailyMealFoods, MealFoodRecord,
  nutritionForQuantity, removeMealFood, searchFoods
} from "./database";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
const GOLD = "#D7B66D", GREEN = "#53C58A", PANEL = "#151920", MUTED = "#9299A5";
const words: Record<Language, Record<string, string>> = {
  en: { title:"Food diary", calories:"Calories", protein:"Protein", carbs:"Carbs", fats:"Fats", breakfast:"Breakfast", lunch:"Lunch", dinner:"Dinner", snacks:"Snacks", add:"Add food", search:"Search saved foods", empty:"No foods logged for this meal yet.", create:"Create food", name:"Food name", kcal:"Calories / 100 g", protein100:"Protein / 100 g", carbs100:"Carbs / 100 g", fat100:"Fat / 100 g", fiber100:"Fiber / 100 g (optional)", grams:"Quantity in grams", save:"Save food", addMeal:"Add to meal", cancel:"Cancel", noResults:"No saved foods found. Create a food using its nutrition label.", unknown:"—", remove:"Remove", entered:"Nutrition values are per 100 g. Leave unknown values blank." },
  ar: { title:"المفكرة الغذائية", calories:"السعرات", protein:"البروتين", carbs:"الكربوهيدرات", fats:"الدهون", breakfast:"الفطور", lunch:"الغداء", dinner:"العشاء", snacks:"وجبات خفيفة", add:"إضافة طعام", search:"ابحث في الأطعمة المحفوظة", empty:"لا توجد أطعمة مسجلة لهذه الوجبة بعد.", create:"إنشاء طعام", name:"اسم الطعام", kcal:"السعرات / ١٠٠ غ", protein100:"البروتين / ١٠٠ غ", carbs100:"الكربوهيدرات / ١٠٠ غ", fat100:"الدهون / ١٠٠ غ", fiber100:"الألياف / ١٠٠ غ (اختياري)", grams:"الكمية بالغرام", save:"حفظ الطعام", addMeal:"إضافة إلى الوجبة", cancel:"إلغاء", noResults:"لم يتم العثور على أطعمة محفوظة. أنشئ طعاماً باستخدام ملصق القيم الغذائية.", unknown:"—", remove:"حذف", entered:"القيم لكل ١٠٠ غ. اترك القيم غير المعروفة فارغة." },
  fr: { title:"Journal alimentaire", calories:"Calories", protein:"Protéines", carbs:"Glucides", fats:"Lipides", breakfast:"Petit-déjeuner", lunch:"Déjeuner", dinner:"Dîner", snacks:"Collations", add:"Ajouter", search:"Rechercher les aliments enregistrés", empty:"Aucun aliment enregistré pour ce repas.", create:"Créer un aliment", name:"Nom de l'aliment", kcal:"Calories / 100 g", protein100:"Protéines / 100 g", carbs100:"Glucides / 100 g", fat100:"Lipides / 100 g", fiber100:"Fibres / 100 g (facultatif)", grams:"Quantité en grammes", save:"Enregistrer", addMeal:"Ajouter au repas", cancel:"Annuler", noResults:"Aucun aliment enregistré. Créez-en un à partir de son étiquette nutritionnelle.", unknown:"—", remove:"Supprimer", entered:"Valeurs pour 100 g. Laissez vides les valeurs inconnues." }
};
const mealTypes: MealType[] = ["breakfast","lunch","dinner","snacks"];
const parseOptional = (v: string) => v.trim() === "" ? null : Number(v.replace(",", "."));
const sumKnown = (values: (number | null)[]) => values.every(v => v === null) ? null : values.reduce<number>((s,v) => s + (v ?? 0), 0);

export default function FoodDiary({ language }: { language: Language }) {
  const t = words[language], rtl = language === "ar";
  const [foods, setFoods] = useState<MealFoodRecord[]>([]);
  const [query, setQuery] = useState("");
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
  const load = useCallback(async () => setFoods(await getDailyMealFoods()), []);
  useEffect(() => { load().catch(e => console.warn("Food diary load failed", e)); }, [load]);
  useEffect(() => {
    let live = true;
    searchFoods(query).then(items => { if (live) setResults(items); }).catch(e => console.warn("Food search failed", e));
    return () => { live = false; };
  }, [query]);
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
    catch (e) { Alert.alert("Error", String(e)); } finally { setBusy(false); }
  };
  const saveNewFood = async () => {
    const nums = [calories, protein, carbs, fat, fiber].map(parseOptional);
    if (!name.trim() || nums.some(n => n !== null && (!Number.isFinite(n) || n < 0))) { Alert.alert("Check the food name and nutrition values."); return; }
    try {
      setBusy(true);
      const id = await createFood({ name, calories: nums[0], protein_g: nums[1], carbs_g: nums[2], fat_g: nums[3], fiber_g: nums[4] });
      const food: FoodRecord = { id, name: name.trim(), calories: nums[0], protein_g: nums[1], carbs_g: nums[2], fat_g: nums[3], fiber_g: nums[4], data_quality: "user_entered" };
      setSelected(food); setModal(false); setName(""); setCalories(""); setProtein(""); setCarbs(""); setFat(""); setFiber("");
    } catch (e) { Alert.alert("Error", String(e)); } finally { setBusy(false); }
  };
  const addRow = async (item: MealFoodRecord) => {
    try { await removeMealFood(item.meal_item_id); await load(); }
    catch (e) { Alert.alert("Error", String(e)); }
  };
  const textAlign = rtl ? "right" as const : "left" as const;
  const field = (label: string, value: string, set: (v:string)=>void, numeric=false) => <View style={s.field}><Text style={[s.label,{textAlign}]}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType={numeric ? "decimal-pad" : "default"} placeholder="—" placeholderTextColor={MUTED} style={[s.input,{textAlign}]} /></View>;
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={[s.title,{textAlign}]}>{t.title}</Text>
    <View style={s.card}>
      <Text style={[s.label,{textAlign}]}>{t.calories}</Text><Text style={s.calorie}>{fmt(totals.calories)} kcal</Text>
      <View style={s.macros}><Text style={s.macro}>{t.protein}: {fmt(totals.protein)} g</Text><Text style={s.macro}>{t.carbs}: {fmt(totals.carbs)} g</Text><Text style={s.macro}>{t.fats}: {fmt(totals.fat)} g</Text></View>
    </View>
    <TextInput value={query} onChangeText={setQuery} placeholder={t.search} placeholderTextColor={MUTED} style={[s.input,{textAlign,marginBottom:10}]} />
    <View style={s.meals}>{mealTypes.map(m=><Pressable key={m} onPress={()=>setMeal(m)} style={[s.mealTab,meal===m&&s.mealActive]}><Text style={[s.mealText,meal===m&&{color:GOLD}]}>{t[m]}</Text></Pressable>)}</View>
    {selected ? <View style={s.card}>
      <Text style={s.cardTitle}>{selected.name}</Text>
      {field(t.grams,quantity,setQuantity,true)}
      <Pressable onPress={addSelected} disabled={busy} style={s.button}><Text style={s.buttonText}>{t.addMeal}</Text></Pressable>
      <Pressable onPress={()=>setSelected(null)} style={s.cancel}><Text style={s.muted}>{t.cancel}</Text></Pressable>
    </View> : <View style={s.card}>
      {results.map(item=><Pressable key={item.id} onPress={()=>setSelected(item)} style={s.result}><View style={{flex:1}}><Text style={s.foodName}>{item.name}</Text><Text style={s.muted}>{item.calories===null?t.unknown:Math.round(item.calories)+" kcal"} / 100 g</Text></View><Text style={s.plus}>＋</Text></Pressable>)}
      {results.length===0&&<Text style={[s.muted,{textAlign}]}>{t.noResults}</Text>}
      <Pressable onPress={()=>setModal(true)} style={s.outline}><Text style={s.outlineText}>＋ {t.create}</Text></Pressable>
    </View>}
    {mealTypes.map(m=><View key={m} style={s.card}>
      <Text style={[s.cardTitle,{textAlign}]}>{t[m]}</Text>
      {foods.filter(f=>f.meal_type===m).length===0 ? <Text style={[s.muted,{textAlign}]}>{t.empty}</Text> :
        foods.filter(f=>f.meal_type===m).map(item=><View key={item.meal_item_id} style={s.logged}><View style={{flex:1}}><Text style={s.foodName}>{item.name}</Text><Text style={s.muted}>{item.quantity_g} g · {fmt(nutritionForQuantity(item,item.quantity_g).calories)} kcal</Text></View><Pressable onPress={()=>addRow(item)}><Text style={s.remove}>×</Text></Pressable></View>)}
    </View>)}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={()=>setModal(false)}>
      <View style={s.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalWrap}><View style={s.modal}>
        <Text style={s.cardTitle}>{t.create}</Text><Text style={s.muted}>{t.entered}</Text>
        {field(t.name,name,setName)}{field(t.kcal,calories,setCalories,true)}{field(t.protein100,protein,setProtein,true)}{field(t.carbs100,carbs,setCarbs,true)}{field(t.fat100,fat,setFat,true)}{field(t.fiber100,fiber,setFiber,true)}
        <Pressable onPress={saveNewFood} disabled={busy} style={s.button}><Text style={s.buttonText}>{t.save}</Text></Pressable>
        <Pressable onPress={()=>setModal(false)} style={s.cancel}><Text style={s.muted}>{t.cancel}</Text></Pressable>
      </View></ScrollView></View>
    </Modal>
  </ScrollView>;
}
const s=StyleSheet.create({
 content:{padding:20,paddingBottom:32,gap:12},title:{color:"#FFF",fontSize:25,fontWeight:"900",marginBottom:4},
 card:{backgroundColor:PANEL,borderRadius:18,borderWidth:1,borderColor:"#252A33",padding:16,marginBottom:2},
 label:{color:"#D7DBE2",fontSize:13,fontWeight:"700"},calorie:{color:GOLD,fontSize:32,fontWeight:"900",marginVertical:5},
 macros:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8},macro:{color:GREEN,fontSize:12,fontWeight:"700"},
 input:{color:"#FFF",backgroundColor:"#0E1117",borderWidth:1,borderColor:"#303641",borderRadius:11,paddingHorizontal:13,paddingVertical:11,fontSize:14},
 meals:{flexDirection:"row",gap:7,flexWrap:"wrap"},mealTab:{paddingVertical:10,paddingHorizontal:12,borderRadius:10,backgroundColor:PANEL,borderWidth:1,borderColor:"#303641"},mealActive:{borderColor:GOLD,backgroundColor:"#30291D"},mealText:{color:"#C4CAD3",fontSize:12,fontWeight:"700"},
 result:{flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#292E37"},foodName:{color:"#FFF",fontSize:14,fontWeight:"700"},muted:{color:MUTED,fontSize:12,lineHeight:18},plus:{color:GOLD,fontSize:22,paddingHorizontal:8},
 outline:{borderWidth:1,borderColor:GOLD,borderRadius:11,padding:12,alignItems:"center",marginTop:14},outlineText:{color:GOLD,fontWeight:"800"},
 cardTitle:{color:"#FFF",fontSize:16,fontWeight:"800",marginBottom:9},logged:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderTopWidth:1,borderTopColor:"#292E37"},remove:{color:"#F08A8A",fontSize:23,paddingHorizontal:10},
 field:{marginTop:9},button:{backgroundColor:GOLD,borderRadius:11,padding:14,alignItems:"center",marginTop:13},buttonText:{color:"#111318",fontWeight:"900"},cancel:{alignItems:"center",padding:12},
 overlay:{flex:1,backgroundColor:"#000B",justifyContent:"center",padding:16},modalWrap:{flexGrow:1,justifyContent:"center"},modal:{backgroundColor:PANEL,borderRadius:18,padding:18,borderWidth:1,borderColor:"#45403A"}
});
