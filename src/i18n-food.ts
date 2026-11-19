import type { Language } from "./i18n";

const foodWords: Record<string, [string, string]> = {
  "chicken":[ "دجاج", "poulet" ], "turkey":[ "ديك رومي", "dinde" ], "duck":[ "بط", "canard" ],
  "beef":[ "لحم بقري", "bœuf" ], "pork":[ "لحم خنزير", "porc" ], "lamb":[ "لحم ضأن", "agneau" ],
  "meat":[ "لحم", "viande" ], "fish":[ "سمك", "poisson" ], "salmon":[ "سلمون", "saumon" ],
  "tuna":[ "تونة", "thon" ], "shrimp":[ "روبيان", "crevette" ], "crab":[ "سلطعون", "crabe" ],
  "egg":[ "بيض", "œuf" ], "eggs":[ "بيض", "œufs" ], "milk":[ "حليب", "lait" ],
  "cheese":[ "جبن", "fromage" ], "yogurt":[ "لبن", "yaourt" ], "butter":[ "زبدة", "beurre" ],
  "rice":[ "أرز", "riz" ], "pasta":[ "معكرونة", "pâtes" ], "bread":[ "خبز", "pain" ],
  "oat":[ "شوفان", "avoine" ], "oats":[ "شوفان", "flocons d’avoine" ], "wheat":[ "قمح", "blé" ],
  "flour":[ "دقيق", "farine" ], "potato":[ "بطاطا", "pomme de terre" ], "tomato":[ "طماطم", "tomate" ],
  "onion":[ "بصل", "oignon" ], "garlic":[ "ثوم", "ail" ], "carrot":[ "جزر", "carotte" ],
  "broccoli":[ "بروكلي", "brocoli" ], "spinach":[ "سبانخ", "épinards" ], "lettuce":[ "خس", "laitue" ],
  "cucumber":[ "خيار", "concombre" ], "pepper":[ "فلفل", "poivron" ], "corn":[ "ذرة", "maïs" ],
  "peas":[ "بازلاء", "petits pois" ], "beans":[ "فاصولياء", "haricots" ], "lentils":[ "عدس", "lentilles" ],
  "chickpeas":[ "حمص", "pois chiches" ], "apple":[ "تفاح", "pomme" ], "banana":[ "موز", "banane" ],
  "orange":[ "برتقال", "orange" ], "grape":[ "عنب", "raisin" ], "strawberry":[ "فراولة", "fraise" ],
  "blueberry":[ "توت أزرق", "myrtille" ], "watermelon":[ "بطيخ", "pastèque" ], "lemon":[ "ليمون", "citron" ],
  "peach":[ "خوخ", "pêche" ], "pear":[ "كمثرى", "poire" ], "mango":[ "مانجو", "mangue" ],
  "avocado":[ "أفوكادو", "avocat" ], "almond":[ "لوز", "amande" ], "walnut":[ "جوز", "noix" ],
  "peanut":[ "فول سوداني", "cacahuète" ], "cashew":[ "كاجو", "noix de cajou" ],
  "sunflower":[ "عباد الشمس", "tournesol" ], "oil":[ "زيت", "huile" ], "olive":[ "زيتون", "olive" ],
  "sugar":[ "سكر", "sucre" ], "honey":[ "عسل", "miel" ], "salt":[ "ملح", "sel" ],
  "raw":[ "نيّئ", "cru" ], "cooked":[ "مطبوخ", "cuit" ], "boiled":[ "مسلوق", "bouilli" ],
  "baked":[ "مخبوز", "cuit au four" ], "roasted":[ "مشوي", "rôti" ], "grilled":[ "مشوي", "grillé" ],
  "fried":[ "مقلي", "frit" ], "fresh":[ "طازج", "frais" ], "frozen":[ "مجمّد", "surgelé" ],
  "canned":[ "معلّب", "en conserve" ], "dried":[ "مجفف", "séché" ], "with":[ "مع", "avec" ],
  "without":[ "بدون", "sans" ], "skin":[ "جلد", "peau" ], "boneless":[ "منزوع العظم", "désossé" ],
  "skinless":[ "منزوع الجلد", "sans peau" ], "whole":[ "كامل", "entier" ], "sliced":[ "شرائح", "en tranches" ],
  "juice":[ "عصير", "jus" ], "sauce":[ "صلصة", "sauce" ], "soup":[ "حساء", "soupe" ],
  "salad":[ "سلطة", "salade" ], "plain":[ "سادة", "nature" ], "lowfat":[ "قليل الدسم", "allégé" ],
  "low-fat":[ "قليل الدسم", "à faible teneur en matières grasses" ], "nonfat":[ "خالي الدسم", "sans matières grasses" ],
  "unsweetened":[ "غير محلى", "sans sucre ajouté" ], "sweetened":[ "محلى", "sucré" ],
  "product":[ "منتج", "produit" ], "food":[ "طعام", "aliment" ]
};

const phrases = Object.keys(foodWords).sort((a,b)=>b.length-a.length);
export function localizeFoodName(name: string, language: Language): string {
  if (language === "en") return name;
  let output = name;
  for (const word of phrases) {
    const [ar, fr] = foodWords[word];
    const replacement = language === "ar" ? ar : fr;
    output = output.replace(new RegExp("\\b" + word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\b", "gi"), replacement);
  }
  return output.replace(/,\s*/g, " · ").replace(/\s+/g, " ").trim();
}

export function localizeNutrientName(name: string, language: Language): string {
  if (language === "en") return name;
  const base = name.split(",")[0].trim().replace(/\s*\([^)]*\)/g, "").toLowerCase();
  const nutrients: Record<string, [string,string]> = {
    "energy":["الطاقة","Énergie"], "protein":["البروتين","Protéines"], "carbohydrates":["الكربوهيدرات","Glucides"],
    "total fat":["إجمالي الدهون","Lipides totaux"], "fat":["الدهون","Lipides"], "fiber":["الألياف","Fibres"],
    "total dietary fiber":["الألياف الغذائية","Fibres alimentaires"], "total sugars":["السكريات","Sucres"],
    "sugars":["السكريات","Sucres"], "saturated fat":["الدهون المشبعة","Graisses saturées"],
    "trans fat":["الدهون المتحولة","Acides gras trans"], "cholesterol":["الكوليسترول","Cholestérol"],
    "water":["الماء","Eau"], "calcium":["الكالسيوم","Calcium"], "iron":["الحديد","Fer"],
    "magnesium":["المغنيسيوم","Magnésium"], "phosphorus":["الفوسفور","Phosphore"],
    "potassium":["البوتاسيوم","Potassium"], "sodium":["الصوديوم","Sodium"], "zinc":["الزنك","Zinc"],
    "copper":["النحاس","Cuivre"], "manganese":["المنغنيز","Manganèse"], "selenium":["السيلينيوم","Sélénium"],
    "iodine":["اليود","Iode"], "choline":["الكولين","Choline"], "thiamin":["الثيامين","Thiamine"],
    "riboflavin":["الريبوفلافين","Riboflavine"], "niacin":["النياسين","Niacine"],
    "pantothenic acid":["حمض البانتوثينيك","Acide pantothénique"], "folate":["الفولات","Folates"],
    "vitamin a":["فيتامين أ","Vitamine A"], "vitamin c":["فيتامين ج","Vitamine C"],
    "vitamin d":["فيتامين د","Vitamine D"], "vitamin e":["فيتامين هـ","Vitamine E"],
    "vitamin k":["فيتامين ك","Vitamine K"], "vitamin b-6":["فيتامين ب6","Vitamine B6"],
    "vitamin b-12":["فيتامين ب12","Vitamine B12"], "vitamin b-1":["فيتامين ب1","Vitamine B1"],
    "vitamin b-2":["فيتامين ب2","Vitamine B2"], "vitamin b-3":["فيتامين ب3","Vitamine B3"]
  };
  const match = nutrients[base] ?? nutrients[base.replace(/^total /,"")];
  return match ? match[language === "ar" ? 0 : 1] : name;
}

export function normalizeFoodSearch(query: string, language: Language): string {
  const value = query.trim().toLocaleLowerCase();
  if (!value || language === "en") return query;
  for (const [english, translations] of Object.entries(foodWords)) {
    if (translations[language === "ar" ? 0 : 1].toLocaleLowerCase() === value) return english;
  }
  return query;
}
