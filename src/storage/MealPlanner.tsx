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
export default function MealPlanner({language,targetCalories,targetProtein,targetCarbs,targetFat,onAdded}:{language:Language;targetCalories:number;targetProtein?:number;targetCarbs?:number;targetFat?:number;onAdded?:()=>void}) {
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
  // Meal-specific food roles prevent unsuitable combinations (for example, chicken at breakfast).
  const meat=/beef|pork|chicken|turkey|lamb|meat|fish|salmon|tuna|shrimp|prawn|sausage|bacon|ham|seafood/i;
  const poultryFish=/chicken|turkey|beef|pork|lamb|fish|salmon|tuna|shrimp|prawn|seafood|sausage|bacon|ham/i;
  const dairyEgg=/egg|yogurt|milk|cheese|cottage|kefir|skyr/i;
  const grain=/oat|bread|rice|pasta|cereal|quinoa|couscous|bulgur|toast|pancake/i;
  const fruit=/apple|banana|orange|berry|fruit|grape|melon|pear|peach|mango|pineapple/i;
  const vegetable=/vegetable|broccoli|spinach|carrot|tomato|cucumber|pepper|mushroom|onion|lettuce|zucchini|cabbage|cauliflower/i;
  const starch=/potato|sweet potato|corn|rice|pasta|bread|oat|quinoa|couscous|bulgur|grain/i;
  const plantProtein=/bean|lentil|chickpea|tofu|soy|nut|seed|pea/i;
  let pool=foods.filter(f=>f.calories!==null&&f.calories>0&&f.protein_g!==null&&f.carbs_g!==null&&f.fat_g!==null);
  if(preference==="vegetarian")pool=pool.filter(f=>!meat.test(f.name));
  if(preference==="high")pool=pool.filter(f=>(f.protein_g??0)>=5);
  if(pool.length<6){Alert.alert(w.empty);return;}
  const pick=(items:FoodRecord[],used:Set<number>,day:number,slot:number,role:number)=>{
   const available=items.filter(f=>!used.has(f.id));
   const list=(available.length?available:items).slice().sort((a,b)=>{
    const score=(f:FoodRecord)=>role===0?(f.protein_g??0)*2+(f.fiber_g??0)*.3:role===1?(f.carbs_g??0)*1.2+(f.fiber_g??0)*.4:role===2?(f.fiber_g??0)*2+(f.calories??0)*.02:(f.protein_g??0)+(f.fiber_g??0);
    return score(b)-score(a);
   });
   if(!list.length)return null;
   return list[(day*3+slot*5+role*7)%Math.min(list.length,Math.max(1,Math.min(8,list.length)))];
  };
  const built:PlanDay[]=[];
  const mealRoles:Record<Meal,{groups:RegExp[];base:number[]}> = {
   breakfast:{groups:[new RegExp(dairyEgg.source+"|"+plantProtein.source,"i"),grain,fruit],base:[130,45,100]},
   lunch:{groups:[new RegExp(meat.source+"|"+dairyEgg.source+"|"+plantProtein.source,"i"),starch,vegetable],base:[130,150,120]},
   dinner:{groups:[new RegExp(meat.source+"|"+dairyEgg.source+"|"+plantProtein.source,"i"),starch,vegetable],base:[120,110,150]},
   snacks:{groups:[new RegExp(dairyEgg.source+"|"+fruit.source+"|"+plantProtein.source,"i"),new RegExp(fruit.source+"|"+plantProtein.source+"|"+dairyEgg.source,"i")],base:[100,60]}
  };
  const mealTargetMacros={protein:targetProtein??targetCalories*.20/4,carbs:targetCarbs??targetCalories*.50/4,fat:targetFat??targetCalories*.30/9};
  for(let day=0;day<7;day++){
   const used=new Set<number>();const items:PlanItem[]=[];
   for(let slot=0;slot<meals.length;slot++){
    const meal=meals[slot],target=targetCalories*shares[meal],definition=mealRoles[meal];
    const selected: {food:FoodRecord;base:number}[]=[];
    definition.groups.forEach((pattern,role)=>{
     // Breakfast explicitly excludes meat and seafood even when the user selects "all foods".
     let candidates=pool.filter(f=>pattern.test(f.name)&&(meal!=="breakfast"||!poultryFish.test(f.name)));
     if(meal==="snacks")candidates=candidates.filter(f=>!poultryFish.test(f.name));
     const food=pick(candidates,used,day,slot,role);
     if(food&&!selected.some(item=>item.food.id===food.id)){selected.push({food,base:definition.base[role]??80});used.add(food.id);}
    });
    // If the catalogue lacks a role, use another food suitable for that meal type, never force meat into breakfast/snacks.
    if(selected.length<2){
     const fallback=pool.filter(f=>!used.has(f.id)&&(meal!=="breakfast"&&!((meal==="snacks")?poultryFish.test(f.name):false))&&(meal!=="breakfast"||!poultryFish.test(f.name)));
     const extra=pick(fallback,used,day,slot,3);
     if(extra){selected.push({food:extra,base:80});used.add(extra.id);}
    }
    if(!selected.length)continue;
    const baseCalories=selected.reduce((sum,item)=>sum+(item.food.calories??0)*item.base/100,0);
    // Scale portions toward the meal's calorie share while keeping practical serving limits.
    const scale=baseCalories>0?Math.max(.55,Math.min(1.65,target/baseCalories)):1;
    selected.forEach(item=>{
     const grams=Math.max(meal==="snacks"?25:35,Math.min(meal==="snacks"?180:300,Math.round(item.base*scale)));
     items.push({meal,food:item.food,grams});
    });
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
