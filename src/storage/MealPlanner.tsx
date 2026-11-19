import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Language } from "../i18n";
import { localizeFoodName } from "../i18n-food";
import { addFoodToMeal, FoodRecord, getMealPlannerFoods, nutritionForQuantity } from "./database";

type Meal = "breakfast" | "lunch" | "dinner" | "snacks";
type PlanItem = { meal: Meal; food: FoodRecord; grams: number };
type PlanDay = { date: Date; items: PlanItem[] };
const meals: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];
const shares: Record<Meal, number> = { breakfast: .25, lunch: .35, dinner: .30, snacks: .10 };
const styles = StyleSheet.create({
 wrap:{gap:12,paddingBottom:28},card:{backgroundColor:"#FFFFFF",borderColor:"#DDE6D9",borderWidth:1,borderRadius:16,padding:14,gap:9},
 title:{color:"#1C281E",fontSize:20,fontWeight:"900"},muted:{color:"#667366",fontSize:12,lineHeight:18},
 gold:{color:"#D8F500",fontWeight:"800"},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
 chip:{borderWidth:1,borderColor:"#667366",borderRadius:10,paddingVertical:9,paddingHorizontal:12},active:{borderColor:"#D8F500",backgroundColor:"#EEF4E9"},
 button:{backgroundColor:"#D8F500",padding:13,borderRadius:11,alignItems:"center"},buttonText:{color:"#FFFFFF",fontWeight:"900"},
 day:{color:"#1C281E",fontSize:14,fontWeight:"800"},food:{color:"#1C281E",fontSize:13,fontWeight:"700"},line:{borderTopWidth:1,borderColor:"#E3EADF",paddingTop:8,gap:4}
});
export default function MealPlanner({language,targetCalories}:{language:Language;targetCalories:number}) {
 const ar=language==="ar", fr=language==="fr";
 const w=ar?{title:"مخطط الوجبات",subtitle:"أنشئ خطة يومية أو أسبوعية وفق هدف السعرات.",all:"كل الأطعمة",veg:"نباتي",high:"غني بالبروتين",generate:"إنشاء خطة",loading:"جارٍ إعداد الخطة…",today:"خطة اليوم",week:"الخطة الأسبوعية",add:"إضافة خطة اليوم إلى المفكرة",breakfast:"الفطور",lunch:"الغداء",dinner:"العشاء",snacks:"وجبات خفيفة",empty:"لا توجد أطعمة كافية في قاعدة البيانات. أضف أو استورد الأطعمة أولاً.",added:"تمت إضافة خطة اليوم إلى المفكرة.",error:"تعذر إنشاء الخطة."}:fr?{title:"Planificateur de repas",subtitle:"Créez un plan quotidien ou hebdomadaire selon votre objectif calorique.",all:"Tous les aliments",veg:"Végétarien",high:"Riche en protéines",generate:"Générer le plan",loading:"Création du plan…",today:"Plan du jour",week:"Plan de la semaine",add:"Ajouter le plan du jour au journal",breakfast:"Petit-déjeuner",lunch:"Déjeuner",dinner:"Dîner",snacks:"Collations",empty:"Pas assez d’aliments dans la base. Importez ou ajoutez des aliments.",added:"Le plan du jour a été ajouté au journal.",error:"Impossible de créer le plan."}:{title:"Automatic meal planner",subtitle:"Build daily and weekly meal plans around your calorie target.",all:"All foods",veg:"Vegetarian",high:"High protein",generate:"Generate plan",loading:"Building your plan…",today:"Today's plan",week:"Weekly plan",add:"Add today's plan to diary",breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",snacks:"Snacks",empty:"Not enough foods in the catalogue. Import or add foods first.",added:"Today's plan was added to your diary.",error:"Could not generate a plan."};
 const [foods,setFoods]=useState<FoodRecord[]>([]);
 const [preference,setPreference]=useState<"all"|"vegetarian"|"high">("all");
 const [plan,setPlan]=useState<PlanDay[]>([]);
 const [busy,setBusy]=useState(false);
 const fmtDate=(d:Date)=>d.toLocaleDateString(ar?"ar":fr?"fr-FR":"en-US",{weekday:"short",month:"short",day:"numeric"});
 useEffect(()=>{getMealPlannerFoods().then(setFoods).catch(e=>console.warn("Planner catalogue unavailable",e));},[]);
 const generate=()=>{
  const plant=/apple|banana|orange|berry|fruit|vegetable|broccoli|spinach|carrot|potato|tomato|rice|oat|bread|pasta|bean|lentil|chickpea|nut|seed|tofu|yogurt|milk|egg|cheese|avocado|corn|cucumber|pepper|mushroom|onion/i;
  const meat=/beef|pork|chicken|turkey|lamb|meat|fish|salmon|tuna|shrimp|prawn|sausage|bacon|ham|seafood/i;
  let pool=foods.filter(f=>f.calories!==null&&f.calories>20&&f.protein_g!==null&&f.carbs_g!==null&&f.fat_g!==null);
  if(preference==="vegetarian") pool=pool.filter(f=>plant.test(f.name)&&!meat.test(f.name));
  if(preference==="high") pool=pool.filter(f=>(f.protein_g??0)>=8);
  if(pool.length<4){Alert.alert(w.empty);return;}
  const built:PlanDay[]=[];
  for(let day=0;day<7;day++){
   const used=new Set<number>(); const items:PlanItem[]=[];
   for(const meal of meals){
    const target=targetCalories*shares[meal];
    const candidates=pool.filter(f=>!used.has(f.id)).sort((a,b)=>{
      const pa=(a.protein_g??0)*4+(a.carbs_g??0)*4+(a.fat_g??0)*9;
      const pb=(b.protein_g??0)*4+(b.carbs_g??0)*4+(b.fat_g??0)*9;
      return Math.abs((a.calories??0)-target/1.6)-Math.abs((b.calories??0)-target/1.6);
    }).slice(0,12);
    const chosen=candidates[Math.floor(Math.random()*candidates.length)]??pool[Math.floor(Math.random()*pool.length)];
    used.add(chosen.id);
    const grams=Math.max(40,Math.min(350,Math.round(target/(chosen.calories??100)*100)));
    items.push({meal,food:chosen,grams});
   }
   const date=new Date();date.setDate(date.getDate()+day);built.push({date,items});
  }
  setPlan(built);
 };
 const today=plan[0];
 const addToday=async()=>{
  if(!today)return;
  try{setBusy(true);for(const item of today.items)await addFoodToMeal(item.food.id,item.meal,item.grams);Alert.alert(w.added);}
  catch(e){Alert.alert(w.error,String(e));}finally{setBusy(false);}
 };
 const mealName=(m:Meal)=>w[m];
 return <ScrollView contentContainerStyle={styles.wrap}>
  <View style={styles.card}><Text style={styles.title}>{w.title}</Text><Text style={styles.muted}>{w.subtitle}</Text><Text style={styles.gold}>{Math.round(targetCalories)} kcal / day</Text>
   <View style={styles.row}>{(["all","vegetarian","high"] as const).map(p=><Pressable key={p} onPress={()=>setPreference(p)} style={[styles.chip,preference===p&&styles.active]}><Text style={[styles.muted,preference===p&&styles.gold]}>{p==="all"?w.all:p==="vegetarian"?w.veg:w.high}</Text></Pressable>)}</View>
   <Pressable style={styles.button} onPress={generate}><Text style={styles.buttonText}>{w.generate}</Text></Pressable>
  </View>
  {plan.length>0&&<><View style={styles.card}><Text style={styles.title}>{w.today} · {fmtDate(today.date)}</Text>{today.items.map((item,i)=><View key={i} style={styles.line}><View style={styles.row}><Text style={styles.gold}>{mealName(item.meal)}</Text><Text style={styles.muted}>{item.grams} g</Text></View><Text style={styles.food}>{localizeFoodName(item.food.name, language)}</Text><Text style={styles.muted}>{Math.round(nutritionForQuantity(item.food,item.grams).calories??0)} kcal · {Math.round(nutritionForQuantity(item.food,item.grams).protein_g??0)} g protein</Text></View>)}<Pressable disabled={busy} style={styles.button} onPress={addToday}><Text style={styles.buttonText}>{busy?w.loading:w.add}</Text></Pressable></View>
   <View style={styles.card}><Text style={styles.title}>{w.week}</Text>{plan.map((d,i)=><View key={i} style={styles.line}><Text style={styles.day}>{fmtDate(d.date)}</Text>{d.items.map((item,j)=><Text key={j} style={styles.muted}>• {mealName(item.meal)}: {localizeFoodName(item.food.name, language)} ({item.grams} g)</Text>)}</View>)}</View></>}
 </ScrollView>;
}
