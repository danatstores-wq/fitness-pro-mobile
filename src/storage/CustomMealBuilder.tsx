import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Language } from "../i18n";
import { localizeFoodName, normalizeFoodSearch } from "../i18n-food";
import { addCustomMealToDiary, CustomMealSummary, FoodNutrientDetail, FoodRecord, getCustomFoodNutrients, getCustomMeals, nutritionForQuantity, saveCustomMeal, searchFoods } from "./database";

type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
type Ingredient = { food: FoodRecord; grams: string; nutrients: FoodNutrientDetail[] };
const styles = StyleSheet.create({
 wrap:{gap:12,paddingBottom:28},card:{backgroundColor:"#FFFFFF",borderColor:"#DDE6D9",borderWidth:1,borderRadius:16,padding:14,gap:10},
 title:{color:"#1C281E",fontSize:20,fontWeight:"900"},muted:{color:"#667366",fontSize:12,lineHeight:18},
 input:{backgroundColor:"#F7F9F5",borderColor:"#DDE6D9",borderWidth:1,borderRadius:10,padding:11,color:"#1C281E"},
 row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
 button:{backgroundColor:"#D8F500",padding:13,borderRadius:11,alignItems:"center"},buttonText:{color:"#10150F",fontWeight:"900"},
 outline:{borderWidth:1,borderColor:"#758274",padding:11,borderRadius:10,alignItems:"center"},
 outlineText:{color:"#D8F500",fontWeight:"800"},food:{color:"#1C281E",fontSize:13,fontWeight:"700",flex:1},
 line:{borderTopWidth:1,borderColor:"#E3EADF",paddingTop:9,gap:5},chip:{padding:9,borderRadius:9,backgroundColor:"#E7EEE3"}
});
export default function CustomMealBuilder({language,mealType,onBack,onAdded}:{language:Language;mealType:MealType;onBack:()=>void;onAdded:()=>void}) {
 const ar=language==="ar", fr=language==="fr";
 const w=ar
 ? {title:"إنشاء طعام مخصص",search:"ابحث عن مكوّن (مثل الدجاج)",name:"اسم الوصفة",grams:"كمية المكوّن بالغرام",add:"إضافة مكوّن",save:"حفظ الوصفة",saved:"الوصفات المحفوظة",use:"إضافة إلى المفكرة",back:"العودة",empty:"ابحث عن كل مكوّن وأضفه. ستُجلب قيمه الغذائية من قاعدة البيانات.",noSaved:"لا توجد وصفات محفوظة بعد.",ingredient:"مكوّن",ok:"تم حفظ الوصفة.",error:"تعذر حفظ الوصفة.",added:"تمت إضافة الوصفة إلى المفكرة.",remove:"حذف",total:"وزن الوصفة",per100:"القيم المحسوبة لكل ١٠٠ غ",calories:"السعرات",protein:"البروتين",carbs:"الكربوهيدرات",fat:"الدهون",fiber:"الألياف",nutrients:"الفيتامينات والمعادن"}
 : fr
 ? {title:"Créer un aliment personnalisé",search:"Rechercher un ingrédient (ex. poulet)",name:"Nom de la recette",grams:"Quantité de l’ingrédient en grammes",add:"Ajouter l’ingrédient",save:"Enregistrer la recette",saved:"Recettes enregistrées",use:"Ajouter au journal",back:"Retour",empty:"Recherchez et ajoutez chaque ingrédient. Ses valeurs nutritionnelles seront récupérées dans la base.",noSaved:"Aucune recette enregistrée.",ingredient:"ingrédient(s)",ok:"Recette enregistrée.",error:"Impossible d’enregistrer la recette.",added:"Recette ajoutée au journal.",remove:"Retirer",total:"Poids total",per100:"Valeurs calculées pour 100 g",calories:"Calories",protein:"Protéines",carbs:"Glucides",fat:"Lipides",fiber:"Fibres",nutrients:"Vitamines et minéraux"}
 : {title:"Create custom food",search:"Search for an ingredient (e.g. chicken)",name:"Recipe name",grams:"Ingredient quantity in grams",add:"Add ingredient",save:"Save recipe",saved:"Saved recipes",use:"Add to food diary",back:"Back",empty:"Search for each ingredient and add it. Nutrition details are fetched from the food database.",noSaved:"No saved recipes yet.",ingredient:"ingredient(s)",ok:"Recipe saved.",error:"Could not save recipe.",added:"Recipe added to your diary.",remove:"Remove",total:"Total recipe weight",per100:"Calculated nutrition per 100 g",calories:"Calories",protein:"Protein",carbs:"Carbohydrates",fat:"Fat",fiber:"Fiber",nutrients:"Vitamins and minerals"};
 const [query,setQuery]=useState("");
 const [results,setResults]=useState<FoodRecord[]>([]);
 const [name,setName]=useState("");
 const [grams,setGrams]=useState("100");
 const [items,setItems]=useState<Ingredient[]>([]);
 const [saved,setSaved]=useState<CustomMealSummary[]>([]);
 const [busy,setBusy]=useState(false);
 const [loadingFood,setLoadingFood]=useState(false);
 useEffect(()=>{getCustomMeals().then(setSaved).catch(e=>console.warn("Custom meals unavailable",e));},[]);
 useEffect(()=>{
  let active=true;
  if(!query.trim()){setResults([]);return ()=>{active=false;};}
  searchFoods(normalizeFoodSearch(query,language)).then(rows=>{if(active)setResults(rows);}).catch(e=>console.warn("Custom meal search failed",e));
  return ()=>{active=false;};
 },[query,language]);
 const totals=useMemo(()=>items.reduce((sum,item)=>{
  const n=nutritionForQuantity(item.food,Number(item.grams)||0);
  return {calories:sum.calories+(n.calories??0),protein:sum.protein+(n.protein_g??0),carbs:sum.carbs+(n.carbs_g??0),fat:sum.fat+(n.fat_g??0)};
 },{calories:0,protein:0,carbs:0,fat:0}),[items]);
 const addIngredient=async(food:FoodRecord)=>{
  const amount=Number(grams.replace(",",".")); if(!Number.isFinite(amount)||amount<=0){Alert.alert(w.grams);return;}
  try { setLoadingFood(true); const nutrients=await getCustomFoodNutrients(food.id); setItems(old=>[...old,{food,grams:String(amount),nutrients}]);setQuery("");setResults([]); }
  catch(e){Alert.alert(w.error,String(e));} finally {setLoadingFood(false);}
 };
 const save=async()=>{
  if(!name.trim()||!items.length){Alert.alert(w.title,w.empty);return;}
  try{setBusy(true);await saveCustomMeal(name,items.map(i=>({foodId:i.food.id,quantityGrams:Number(i.grams)})));setName("");setItems([]);setSaved(await getCustomMeals());Alert.alert(w.ok);}
  catch(e){Alert.alert(w.error,String(e));}finally{setBusy(false);}
 };
 const useMeal=async(id:number)=>{
  try{setBusy(true);await addCustomMealToDiary(id,mealType);onAdded();Alert.alert(w.added);}
  catch(e){Alert.alert(w.error,String(e));}finally{setBusy(false);}
 };
 return <ScrollView contentContainerStyle={styles.wrap}>
  <Pressable style={styles.outline} onPress={onBack}><Text style={styles.outlineText}>{w.back}</Text></Pressable>
  <View style={styles.card}>
   <Text style={styles.title}>{w.title}</Text><Text style={styles.muted}>{w.empty}</Text>
   <TextInput value={name} onChangeText={setName} placeholder={w.name} placeholderTextColor="#758274" style={styles.input}/>
   <TextInput value={query} onChangeText={setQuery} placeholder={w.search} placeholderTextColor="#758274" style={styles.input}/>
   <TextInput value={grams} onChangeText={setGrams} keyboardType="decimal-pad" placeholder={w.grams} placeholderTextColor="#758274" style={styles.input}/>
   {results.map(food=><Pressable key={food.id} onPress={()=>addIngredient(food)} disabled={loadingFood} style={styles.line}><View style={styles.row}><Text style={styles.food}>{localizeFoodName(food.name,language)}</Text><Text style={styles.outlineText}>＋</Text></View><Text style={styles.muted}>{food.calories==null?"—":Math.round(food.calories)+" kcal"} / 100 g</Text></Pressable>)}
   {items.length===0?<Text style={styles.muted}>{w.empty}</Text>:items.map((item,index)=><View key={index} style={styles.line}><View style={styles.row}><Text style={styles.food}>{localizeFoodName(item.food.name,language)}</Text><Text style={styles.muted}>{item.grams} g</Text><Pressable onPress={()=>setItems(old=>old.filter((_,i)=>i!==index))}><Text style={styles.outlineText}>×</Text></Pressable></View></View>)}
   {items.length>0&&<Text style={styles.muted}>{Math.round(totals.calories)} kcal · {totals.protein.toFixed(1)} g protein · {totals.carbs.toFixed(1)} g carbs · {totals.fat.toFixed(1)} g fat</Text>}
   <Pressable disabled={busy||!items.length||!name.trim()} style={styles.button} onPress={save}><Text style={styles.buttonText}>{w.save}</Text></Pressable>
  </View>
  <View style={styles.card}><Text style={styles.title}>{w.saved}</Text>
   {saved.length===0?<Text style={styles.muted}>{w.noSaved}</Text>:saved.map(meal=><View key={meal.id} style={styles.line}><View style={styles.row}><View style={{flex:1}}><Text style={styles.food}>{meal.name}</Text><Text style={styles.muted}>{meal.ingredient_count} {w.ingredient}</Text></View><Pressable disabled={busy} style={styles.chip} onPress={()=>useMeal(meal.id)}><Text style={styles.outlineText}>{w.use}</Text></Pressable></View></View>)}
  </View>
 </ScrollView>;
}
