import fs from "node:fs";
import { gunzipSync } from "node:zlib";

const foundationText = fs.readFileSync("src/data/usda-foundation-foods.ts", "utf8");
const foundationStart = foundationText.indexOf("=");
const foundationEnd = foundationText.lastIndexOf(" as const;");
const foundation = JSON.parse(foundationText.slice(foundationStart + 1, foundationEnd).trim());

const fnddsText = fs.readFileSync("src/data/usda-fndds-foods.ts", "utf8");
const encoded = fnddsText.match(/=\s*"([A-Za-z0-9+/=]+)"/)?.[1];
if (!encoded) throw new Error("Could not read the generated USDA FNDDS catalogue.");
const fndds = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));

const dictionaryText = fs.readFileSync("src/i18n-food.ts", "utf8");
const dictionaryBlock = dictionaryText.match(/const foodWords:\s*Record<string,\s*\[string,\s*string\]>\s*=\s*\{([\s\S]*?)\n\};/)?.[1];
if (!dictionaryBlock) throw new Error("Could not read food-name translation dictionary.");
const dictionary = [];
for (const match of dictionaryBlock.matchAll(/"((?:\\.|[^"])*)"\s*:\s*\[\s*"((?:\\.|[^"])*)"\s*,\s*"((?:\\.|[^"])*)"\s*\]/g)) {
  dictionary.push([JSON.parse('"'+match[1]+'"'), JSON.parse('"'+match[2]+'"'), JSON.parse('"'+match[3]+'"')]);
}
dictionary.sort((a,b) => b[0].length - a[0].length);
function translate(name, language) {
  let result = name;
  for (const [english, arabic, french] of dictionary) {
    const replacement = language === "ar" ? arabic : french;
    if (!replacement) continue;
    const escaped = [...english].map(ch => ".*+?^${}()|[]\\\\".includes(ch) ? "\\" + ch : ch).join("");
    result = result.replace(new RegExp("\\b" + escaped + "\\b", "gi"), replacement);
  }
  return result.replace(/,\s*/g, " · ").replace(/\s+/g, " ").trim();
}
function csv(value) { return '"' + String(value ?? "").replace(/"/g, '""') + '"'; }

const unique = new Map();
for (const food of [...foundation, ...fndds]) {
  const english = String(food.name ?? "").trim();
  if (!english) continue;
  const key = english.toLocaleLowerCase("en");
  if (!unique.has(key)) unique.set(key, english);
}
const hasArabic = /[\u0600-\u06FF]/;
const hasLatin = /[A-Za-z]/;
const rows = [...unique.values()].sort((a,b) => a.localeCompare(b, "en")).map(english => {
  const arabic = translate(english, "ar");
  const french = translate(english, "fr");
  const arabicStatus = !hasArabic.test(arabic) ? "Needs translation" : hasLatin.test(arabic) ? "Partially translated" : "Translated — please verify";
  const frenchStatus = french.trim().toLowerCase() === english.trim().toLowerCase() ? "Needs translation" : "Draft — please verify";
  return [english, arabic, arabicStatus, "", french, frenchStatus, ""];
});
const header = ["English food name", "Arabic (current translation)", "Arabic translation status", "Your corrected Arabic translation", "French (current translation)", "French translation status", "Your corrected French translation"];
fs.mkdirSync("docs", { recursive: true });
// Excel on Windows often needs a UTF-8 BOM to recognize Arabic correctly in CSV files.
const csvContent = [header, ...rows].map(row => row.map(csv).join(",")).join("\r\n") + "\r\n";
fs.writeFileSync("docs/food-name-review.csv", "\uFEFF" + csvContent, "utf8");
console.log("Foundation foods: " + foundation.length);
console.log("FNDDS foods: " + fndds.length);
console.log("Unique food names in review file: " + rows.length);
console.log("Review file: docs/food-name-review.csv");
