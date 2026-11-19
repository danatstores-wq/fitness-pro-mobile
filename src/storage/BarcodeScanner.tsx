import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { createFood, FoodRecord, getFoodBySourceId } from "./database";

type Props = { visible: boolean; onClose: () => void; onFound: (food: FoodRecord) => void; language: "en" | "ar" | "fr" };
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#F7F9F5", justifyContent: "center", padding: 18 },
  title: { color: "#1C281E", fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  camera: { height: 390, borderRadius: 18, overflow: "hidden" },
  muted: { color: "#667366", fontSize: 13, textAlign: "center", marginVertical: 12 },
  button: { backgroundColor: "#D8F500", borderRadius: 11, padding: 13, alignItems: "center", marginTop: 12 },
  buttonText: { color: "#FFFFFF", fontWeight: "900" },
  close: { padding: 12, alignItems: "center" },
  loading: { color: "#D8F500", textAlign: "center", marginTop: 12 }
});
type NutrimentMap = Record<string, unknown>;
export default function BarcodeScanner({ visible, onClose, onFound, language }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const scanned = useRef(false);
  useEffect(() => { if (visible) scanned.current = false; }, [visible]);
  const ar = language === "ar", fr = language === "fr";
  const title = ar ? "امسح الباركود" : fr ? "Scanner le code-barres" : "Scan product barcode";
  const instruction = ar ? "وجّه الكاميرا إلى الرمز الشريطي على العبوة." : fr ? "Pointez la caméra vers le code-barres du produit." : "Point the camera at the barcode on the package.";
  const close = ar ? "إغلاق" : fr ? "Fermer" : "Close";

  const lookup = async (result: BarcodeScanningResult) => {
    if (scanned.current || loading) return;
    const barcode = result.data.trim();
    if (!barcode) return;
    scanned.current = true;
    setLoading(true);
    try {
      const cached = await getFoodBySourceId("open_food_facts", barcode);
      if (cached) { onFound(cached); onClose(); return; }

      // API v3 is the current Open Food Facts product-read API.
      const response = await fetch(
        "https://world.openfoodfacts.org/api/v3/product/" + encodeURIComponent(barcode) + ".json",
        { headers: { "User-Agent": "FitnessProByDanat/1.0 (nutrition barcode lookup)" } }
      );
      if (response.status === 404) throw new Error(ar ? "لم يتم العثور على هذا المنتج في قاعدة البيانات." : fr ? "Ce produit est introuvable dans la base de données." : "This barcode was not found in the product database.");
      if (!response.ok) throw new Error(ar ? "تعذّر الاتصال بقاعدة بيانات المنتجات. حاول مجدداً." : fr ? "Impossible de contacter la base de produits. Réessayez." : "Could not contact the product database. Please try again.");
      const payload = await response.json();
      const p = payload?.product;
      const statusOk = payload?.status === 1 || payload?.status === "success" || payload?.status === "success_with_errors";
      if (!p || !statusOk) throw new Error(ar ? "لم يتم العثور على هذا المنتج. يمكنك تجربة منتج آخر." : fr ? "Produit introuvable. Essayez un autre produit." : "Product not found. Please try another product.");

      const n: NutrimentMap = p.nutriments ?? {};
      const val = (...keys: string[]): number | null => {
        for (const key of keys) {
          const value = n[key];
          if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
        }
        return null;
      };
      const productName = String(p.product_name || p.product_name_en || p.generic_name || "Packaged food").trim();
      const brand = String(p.brands || "").split(",")[0].trim();
      const displayName = brand ? productName + " · " + brand : productName;
      const sugars = val("sugars_100g");
      const saturated = val("saturated-fat_100g");
      const trans = val("trans-fat_100g");
      const mono = val("monounsaturated-fat_100g");
      const poly = val("polyunsaturated-fat_100g");
      const starch = val("starch_100g");
      const cholesterol = val("cholesterol_100g");
      const water = val("water_100g");
      const energyKcal = val("energy-kcal_100g");
      const energyKj = val("energy_100g");
      const calories = energyKcal ?? (energyKj === null ? null : energyKj / 4.184);
      const protein = val("proteins_100g");
      const carbs = val("carbohydrates_100g");
      const fat = val("fat_100g");
      const fiber = val("fiber_100g");

      const micronutrientFields: [string, string, string][] = [
        ["Vitamin A", "vitamin-a_100g", "µg"], ["Vitamin C", "vitamin-c_100g", "mg"],
        ["Vitamin D", "vitamin-d_100g", "µg"], ["Vitamin E", "vitamin-e_100g", "mg"],
        ["Vitamin K", "vitamin-k_100g", "µg"], ["Thiamin (B1)", "vitamin-b1_100g", "mg"],
        ["Riboflavin (B2)", "vitamin-b2_100g", "mg"], ["Niacin (B3)", "vitamin-b3_100g", "mg"],
        ["Vitamin B6", "vitamin-b6_100g", "mg"], ["Folate (B9)", "vitamin-b9_100g", "µg"],
        ["Vitamin B12", "vitamin-b12_100g", "µg"], ["Calcium", "calcium_100g", "mg"],
        ["Iron", "iron_100g", "mg"], ["Magnesium", "magnesium_100g", "mg"],
        ["Phosphorus", "phosphorus_100g", "mg"], ["Potassium", "potassium_100g", "mg"],
        ["Sodium", "sodium_100g", "mg"], ["Zinc", "zinc_100g", "mg"]
      ];
      const nutrients = micronutrientFields
        .map(([name, key, unit]) => ({ name, unit, amount: val(key) }))
        .filter(item => item.amount !== null);

      // Do not invent missing label values: absent nutrients remain NULL in SQLite.
      const id = await createFood({
        name: displayName, calories, protein_g: protein, carbs_g: carbs, fat_g: fat, fiber_g: fiber,
        total_sugars_g: sugars, saturated_fat_g: saturated, trans_fat_g: trans,
        monounsaturated_fat_g: mono, polyunsaturated_fat_g: poly, starch_g: starch,
        cholesterol_mg: cholesterol === null ? null : cholesterol * 1000,
        water_g: water, source: "open_food_facts", sourceId: barcode,
        dataQuality: "third_party", nutrients
      });
      const food: FoodRecord = {
        id, name: displayName, calories, protein_g: protein, carbs_g: carbs, fat_g: fat,
        fiber_g: fiber, sugar_g: sugars, saturated_fat_g: saturated, trans_fat_g: trans,
        monounsaturated_fat_g: mono, polyunsaturated_fat_g: poly, starch_g: starch,
        cholesterol_mg: cholesterol === null ? null : cholesterol * 1000,
        water_g: water, data_quality: "third_party"
      };
      onFound(food);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(title, message);
      scanned.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>{instruction}</Text>
        <Text style={styles.muted}>
          {ar ? "المعلومات من قاعدة Open Food Facts وقد تختلف حسب المنتج." : fr ? "Données Open Food Facts : la couverture et les valeurs disponibles varient selon le produit." : "Nutrition data comes from Open Food Facts. Product coverage and label completeness vary."}
        </Text>
        {!permission ? <ActivityIndicator /> : !permission.granted ? (
          <>
            <Text style={styles.muted}>{ar ? "يلزم السماح باستخدام الكاميرا لمسح المنتجات." : fr ? "L’autorisation de la caméra est nécessaire." : "Camera permission is needed to scan products."}</Text>
            <Pressable style={styles.button} onPress={requestPermission}><Text style={styles.buttonText}>{ar ? "السماح بالكاميرا" : fr ? "Autoriser la caméra" : "Allow camera"}</Text></Pressable>
          </>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"] }}
            onBarcodeScanned={loading ? undefined : lookup}
          />
        )}
        {loading && <Text style={styles.loading}>{ar ? "جارٍ البحث عن المنتج…" : fr ? "Recherche du produit…" : "Looking up product…"}</Text>}
        <Pressable style={styles.close} onPress={onClose}><Text style={styles.muted}>{close}</Text></Pressable>
      </View>
    </Modal>
  );
}
