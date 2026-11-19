import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Language } from "../i18n";
import { localizeFoodName, localizeNutrientName } from "../i18n-food";
import { addFoodPlanToDiary, FoodRecord, FoodNutrientDetail, getFoodNutrients, getMealPlannerFoods, nutritionForQuantity } from "./database";

type Meal = "breakfast" | "lunch" | "dinner" | "snacks";
type PlanItem = { meal: Meal; food: FoodRecord; grams: number };
type PlanDay = { date: Date; items: PlanItem[] };
type NutrientTotal = { name: string; unit: string; amount: number };
const meals: Meal[] = ["breakfast", "lunch", "dinner", "snacks"];
const shares: Record<Meal, number> = { breakfast: .25, lunch: .35, dinner: .30, snacks: .10 };
const styles = StyleSheet.create({
 wrap:{gap:12,paddingBottom:28},card:{backgroundColor:"#FFFFFF",borderColor:"#DDE6D9",borderWidth:1,borderRadius:16,padding:14,gap:9},
 title:{color:"#1C281E",fontSize:20,fontWeight:"900"},muted:{color:"#667366",fontSize:12,lineHeight:18},
 gold:{color:"#368A4B",fontWeight:"800"},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
 chip:{borderWidth:1,borderColor:"#667366",borderRadius:10,paddingVertical:9,paddingHorizontal:12},active:{borderColor:"#368A4B",backgroundColor:"#E6F0E4"},
 button:{backgroundColor:"#263A2C",padding:13,borderRadius:11,alignItems:"center",borderWidth:1,borderColor:"#263A2C"},buttonText:{color:"#FFFFFF",fontWeight:"900"},
 day:{color:"#1C281E",fontSize:14,fontWeight:"800"},food:{color:"#1C281E",fontSize:13,fontWeight:"700"},line:{borderTopWidth:1,borderColor:"#E3EADF",paddingTop:8,gap:4},
 nutrientGrid:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:5},nutrient:{width:"48%",flexGrow:1,backgroundColor:"#F4F7F1",borderRadius:10,padding:9},nutrientName:{color:"#667366",fontSize:10,fontWeight:"700"},nutrientValue:{color:"#1C281E",fontSize:14,fontWeight:"900",marginTop:3},
 section:{color:"#1C281E",fontSize:14,fontWeight:"900",marginTop:7}
});
export default function MealPlanner({language,targetCalories,onAdded}:{language:Language;targetCalories:number;onAdded?:()=>void}) {
 const ar=language==="ar", fr=language==="fr";
 const w=ar?{title:"مخطط الوجبات",subtitle:"أنشئ خطة يومية أو أسبوعية وفق هدف السعرات.",all:"كل الأطعمة",veg:"نباتي",high:"غني بالبروتين",generate:"إنشاء خطة",loading:"جارٍ إعداد الخطة…",today:"خطة اليوم",week:"الخطة الأسبوعية",add:"إضافة خطة اليوم إلى المفكرة",added:"تمت إضافة جميع وجبات اليوم إلى المفكرة.",breakfast:"الفطور",lunch:"الغداء",dinner:"العشاء",snacks:"وجبات خفيفة",empty:"لا توجد أطعمة كافية في قاعدة البيانات. أضف أو استورد الأطعمة أولاً.",error:"تعذر إضافة الخطة.",calories:"السعرات",protein:"البروتين",carbs:"الكربوهيدرات",fat:"الدهون",fiber:"الألياف",sugar:"السكريات",satFat:"الدهون المشبعة",cholesterol:"الكوليسترول",water:"الماء",nutrition:"إجمالي القيم الغذائية لخطة اليوم",micros:"الفيتامينات والمعادن والعناصر الأخرى",unknown:"لا تتوفر بيانات غذائية إضافية لهذه الأطعمة."}
 :fr?{title:"Planificateur de repas",subtitle:"Créez un plan quotidien ou hebdomadaire selon votre objectif calorique.",all:"Tous les aliments",veg:"Végétarien",high:"Riche en protéines",generate:"Générer le plan",loading:"Création du plan…",today:"Plan du jour",week:"Plan de la semaine",add:"Ajouter le plan du jour au journal",added:"Tous les repas du jour ont été ajoutés au journal.",breakfast:"Petit-déjeuner",lunch:"Déjeuner",dinner:"Dîner",snacks:"Collations",empty:"Pas assez d’aliments dans la base. Importez ou ajoutez des aliments.",error:"Impossible d’ajouter le plan.",calories:"Calories",protein:"Protéines",carbs:"Glucides",fat:"Lipides",fiber:"Fibres",sugar:"Sucres",satFat:"Graisses saturées",cholesterol:"Cholestérol",water:"Eau",nutrition:"Valeurs nutritionnelles totales du jour",micros:"Vitamines, minéraux et autres nutriments",unknown:"Aucune autre donnée nutritionnelle disponible pour ces aliments."}
 :{title:"Automatic meal planner",subtitle:"Build daily and weekly meal plans around your calorie target.",all:"All foods",veg:"Vegetarian",high:"High protein",generate:"Generate plan",loading:"Building your plan…",today:"Today's plan",week:"Weekly plan",add:"Add today's plan to diary",added:"All of today's meals were added to your diary.",breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",snacks:"Snacks",empty:"Not enough foods in the catalogue. Import or add foods first.",error:"Could not add the plan.",calories:"Calories",protein:"Protein",carbs:"Carbohydrates",fat:"Fat",fiber:"Fiber",sugar:"Sugars",satFat:"Saturated fat",cholesterol:"Cholesterol",water:"Water",nutrition:"Today's plan — nutrition totals",micros:"Vitamins, minerals and other nutrients",unknown:"No additional nutrition data is available for these foods."};
 const [foods,setFoods]=useState<FoodRecord[]>([]);
 const [preference,setPreference]=useState<"all"|"vegetarian"|"high">("all");
 const [plan,setPlan]=useState<PlanDay[]>([]);
 const [busy,setBusy]=useState(false);
 const [added,setAdded]=useState(false);
 const [planMicros,setPlanMicros]=useState<NutrientTotal[]>([]);
 const fmtDate=(d:Date)=>d.toLocaleDateString(ar?"ar":fr?"fr-FR":"en-US",{weekday:"short",month:"short",day:"numeric"});
 useEffect(()=>{getMealPlannerFoods().then(setFoods).catch(e=>console.warn("Planner catalogue unavailable",e));},[]);
 useEffect(()=>{
  let live=true;
  const today=plan[0];
  if(!today){setPlanMicros([]);return()=>{live=false;};}
  Promise.all(today.items.map(async item=>({grams:item.grams,rows:await getFoodNutrients(item.food.id)})))
   .then(results=>{
    if(!live)return;
    const totals=new Map<string,NutrientTotal>();
    for(const result of results)for(const row of result.rows){
     if(row.amount===null)continue;
     const key=row.name+"|"+row.unit;
     const prior=totals.get(key);
     totals.set(key,{name:row.name,unit:row.unit,amount:(prior?.amount??0)+row.amount*result.grams/100});
    }
    setPlanMicros([...totals.values()].sort((a,b)=>a.name.localeCompare(b.name)));
   }).catch(error=>{console.warn("Could not calculate plan micronutrients",error);if(live)setPlanMicros([]);});
  return()=>{live=false;};
 },[plan]);
 const generate=()=>{
  const plant=/apple|banana|orange|berry|fruit|vegetable|broccoli|spinach|carrot|potato|tomato|rice|oat|bread|pasta|bean|lentil|chickpea|nut|seed|tofu|yogurt|milk|egg|cheese|avocado|corn|cucumber|pepper|mushroom|onion/i;
  const meat=/beef|pork|chicken|turkey|lamb|meat|fish|salmon|tuna|shrimp|prawn|sausage|bacon|ham|seafood/i;
  let pool=foods.filter(f=>f.calories!==null&&f.calories>20&&f.protein_g!==null&&f.carbs_g!==null&&f.fat_g!==null);
  if(preference==="vegetarian")pool=pool.filter(f=>plant.test(f.name)&&!meat.test(f.name));
  if(preference==="high")pool=pool.filter(f=>(f.protein_g??0)>=8);
  if(pool.length<4){Alert.alert(w.empty);return;}
  const built:PlanDay[]=[];
  for(let day=0;day<7;day++){
   const used=new Set<number>();const items:PlanItem[]=[];
   for(const meal of meals){
    const target=targetCalories*shares[meal];
    const candidates=pool.filter(f=>!used.has(f.id)).sort((a,b)=>Math.abs((a.calories??0)-target/1.6)-Math.abs((b.calories??0)-target/1.6)).slice(0,12);
    const chosen=candidates[Math.floor(Math.random()*candidates.length)]??pool[Math.floor(Math.random()*pool.length)];
    used.add(chosen.id);
    const grams=Math.max(40,Math.min(350,Math.round(target/(chosen.calories??100)*100)));
    items.push({meal,food:chosen,grams});
   }
   const date=new Date();date.setDate(date.getDate()+day);built.push({date,items});
  }
  setAdded(false);setPlan(built);
 };
 const today=plan[0];
 const sum=(key:"calories"|"protein_g"|"carbs_g"|"fat_g"|"fiber_g")=>today?.items.reduce((total,item)=>total+(nutritionForQuantity(item.food,item.grams)[key]??0),0)??0;
 const extraRows=useMemo(()=>{
  if(!today)return[];
  const fields:[keyof FoodRecord,string,string][]=[
   ["sugar_g",w.sugar,"g"],["saturated_fat_g",w.satFat,"g"],["trans_fat_g",ar?"الدهون المتحولة":fr?"Trans":"Trans fat","g"],
   ["monounsaturated_fat_g",ar?"الدهون الأحادية غير المشبعة":fr?"Mono-insaturés":"Monounsaturated fat","g"],
   ["polyunsaturated_fat_g",ar?"الدهون المتعددة غير المشبعة":fr?"Polyinsaturés":"Polyunsaturated fat","g"],
   ["starch_g",ar?"النشا":fr?"Amidon":"Starch","g"],["cholesterol_mg",w.cholesterol,"mg"],["water_g",w.water,"g"]
  ];
  return fields.map(([key,label,unit])=>({label,unit,amount:today.items.reduce((total,item)=>total+((item.food[key] as number|null)??0)*item.grams/100,0),known:today.items.some(item=>item.food[key]!==null)})).filter(row=>row.known);
 },[today,language]);
 const mealName=(m:Meal)=>w[m];
 const addToday=async()=>{
  if(!today||busy||added)return;
  try{
   setBusy(true);
   await addFoodPlanToDiary(today.items.map(item=>({foodId:item.food.id,mealType:item.meal,quantityGrams:item.grams})),new Date());
   setAdded(true);
   Alert.alert(w.added);
   onAdded?.();
  }catch(e){Alert.alert(w.error,String(e));}
  finally{setBusy(false);}
 };
 return <ScrollView contentContainerStyle={styles.wrap}>
  <View style={styles.card}><Text style={styles.title}>{w.title}</Text><Text style={styles.muted}>{w.subtitle}</Text><Text style={styles.gold}>{Math.round(targetCalories)} kcal / day</Text>
   <View style={styles.row}>{(["all","vegetarian","high"] as const).map(p=><Pressable key={p} onPress={()=>setPreference(p)} style={[styles.chip,preference===p&&styles.active]}><Text style={[styles.muted,preference===p&&styles.gold]}>{p==="all"?w.all:p==="vegetarian"?w.veg:w.high}</Text></Pressable>)}</View>
   <Pressable style={styles.button} onPress={generate}><Text style={styles.buttonText}>{w.generate}</Text></Pressable>
  </View>
  {plan.length>0&&today&&<><View style={styles.card}><Text style={styles.title}>{w.today} · {fmtDate(today.date)}</Text>
   {today.items.map((item,i)=><View key={i} style={styles.line}><View style={styles.row}><Text style={styles.gold}>{mealName(item.meal)}</Text><Text style={styles.muted}>{item.grams} g</Text></View><Text style={styles.food}>{localizeFoodName(item.food.name,language)}</Text><Text style={styles.muted}>{Math.round(nutritionForQuantity(item.food,item.grams).calories??0)} kcal</Text></View>)}
   <Text style={styles.section}>{w.nutrition}</Text>
   <View style={styles.nutrientGrid}>
    {[[w.calories,sum("calories"),"kcal"],[w.protein,sum("protein_g"),"g"],[w.carbs,sum("carbs_g"),"g"],[w.fat,sum("fat_g"),"g"],[w.fiber,sum("fiber_g"),"g"]].map(([label,value,unit])=><View key={String(label)} style={styles.nutrient}><Text style={styles.nutrientName}>{label}</Text><Text style={styles.nutrientValue}>{Number(value).toFixed(1)} {unit}</Text></View>)}
    {extraRows.map(row=><View key={row.label} style={styles.nutrient}><Text style={styles.nutrientName}>{row.label}</Text><Text style={styles.nutrientValue}>{row.amount.toFixed(2)} {row.unit}</Text></View>)}
   </View>
   <Text style={styles.section}>{w.micros}</Text>
   {planMicros.length===0?<Text style={styles.muted}>{w.unknown}</Text>:<View style={styles.nutrientGrid}>{planMicros.map(row=><View key={row.name+"|"+row.unit} style={styles.nutrient}><Text style={styles.nutrientName}>{localizeNutrientName(row.name,language)}</Text><Text style={styles.nutrientValue}>{Number(row.amount.toFixed(3))} {row.unit}</Text></View>)}</View>}
   <Pressable disabled={busy||added} style={[styles.button,(busy||added)&&{opacity:.55}]} onPress={addToday}><Text style={styles.buttonText}>{added?(ar?"تمت الإضافة ✓":fr?"Ajouté ✓":"Added ✓"):busy?w.loading:w.add}</Text></Pressable>
  </View>
  <View style={styles.card}><Text style={styles.title}>{w.week}</Text>{plan.map((d,i)=><View key={i} style={styles.line}><Text style={styles.day}>{fmtDate(d.date)}</Text>{d.items.map((item,j)=><Text key={j} style={styles.muted}>• {mealName(item.meal)}: {localizeFoodName(item.food.name,language)} ({item.grams} g)</Text>)}</View>)}</View></>}
 </ScrollView>;
}
