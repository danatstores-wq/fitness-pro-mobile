import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { createFood, FoodRecord } from "./database";

type Props={visible:boolean;onClose:()=>void;onFound:(food:FoodRecord)=>void;language:"en"|"ar"|"fr"};
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:"#080A08",justifyContent:"center",padding:18},title:{color:"#F2F0E9",fontSize:20,fontWeight:"900",textAlign:"center",marginBottom:12},camera:{height:390,borderRadius:18,overflow:"hidden"},muted:{color:"#B0B4AA",fontSize:13,textAlign:"center",marginVertical:12},button:{backgroundColor:"#D7B66D",borderRadius:11,padding:13,alignItems:"center",marginTop:12},buttonText:{color:"#171813",fontWeight:"900"},close:{padding:12,alignItems:"center"},loading:{color:"#D7B66D",textAlign:"center",marginTop:12}});
export default function BarcodeScanner({visible,onClose,onFound,language}:Props){
 const [permission,requestPermission]=useCameraPermissions();
 const [loading,setLoading]=useState(false);
 const scanned=useRef(false);
 const ar=language==="ar",fr=language==="fr";
 const title=ar?"امسح الباركود":fr?"Scanner le code-barres":"Scan product barcode";
 const instruction=ar?"وجّه الكاميرا إلى الرمز الشريطي على العبوة.":fr?"Pointez la caméra vers le code-barres du produit.":"Point the camera at the barcode on the package.";
 const close=ar?"إغلاق":fr?"Fermer":"Close";
 const lookup=async(result:BarcodeScanningResult)=>{
  if(scanned.current||loading)return;
  scanned.current=true;setLoading(true);
  try{
   const barcode=result.data.trim();
   const response=await fetch("https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(barcode)+".json",{headers:{"User-Agent":"FitnessProByDanat/1.0 (nutrition barcode lookup)"}});
   if(!response.ok)throw new Error("Product database request failed.");
   const payload=await response.json();
   const p=payload?.product;
   if(payload?.status!==1||!p)throw new Error(ar?"لم يتم العثور على المنتج.":fr?"Produit introuvable.":"Product not found in the Open Food Facts database.");
   const n=p.nutriments??{};
   const val=(...keys:string[])=>{for(const key of keys){const v=n[key];if(typeof v==="number"&&Number.isFinite(v)&&v>=0)return v;}return null;};
   const productName=String(p.product_name||p.product_name_en||"Packaged food").trim();
   const brand=String(p.brands||"").split(",")[0].trim();
   const displayName=brand?productName+" · "+brand:productName;
   const nutrients=[
    ["Vitamin A","vitamin-a_100g","µg"],["Vitamin C","vitamin-c_100g","mg"],["Vitamin D","vitamin-d_100g","µg"],["Vitamin E","vitamin-e_100g","mg"],["Vitamin K","vitamin-k_100g","µg"],
    ["Thiamin (B1)","vitamin-b1_100g","mg"],["Riboflavin (B2)","vitamin-b2_100g","mg"],["Niacin (B3)","vitamin-b3_100g","mg"],["Vitamin B6","vitamin-b6_100g","mg"],["Folate (B9)","vitamin-b9_100g","µg"],["Vitamin B12","vitamin-b12_100g","µg"],
    ["Calcium","calcium_100g","mg"],["Iron","iron_100g","mg"],["Magnesium","magnesium_100g","mg"],["Phosphorus","phosphorus_100g","mg"],["Potassium","potassium_100g","mg"],["Sodium","sodium_100g","mg"],["Zinc","zinc_100g","mg"]
   ].map(([name,key,unit])=>({name,unit,amount:val(key)}));
   const kcal=val("energy-kcal_100g")??(val("energy_100g")===null?null:val("energy_100g")!/4.184);
   const id=await createFood({name:displayName,calories:kcal,protein_g:val("proteins_100g"),carbs_g:val("carbohydrates_100g"),fat_g:val("fat_100g"),fiber_g:val("fiber_100g"),total_sugars_g:val("sugars_100g"),saturated_fat_g:val("saturated-fat_100g"),cholesterol_mg:val("cholesterol_100g")===null?null:val("cholesterol_100g")!*1000,source:"open_food_facts",sourceId:barcode,dataQuality:"third_party",nutrients});
   const food:FoodRecord={id,name:displayName,calories:kcal,protein_g:val("proteins_100g"),carbs_g:val("carbohydrates_100g"),fat_g:val("fat_100g"),fiber_g:val("fiber_100g"),sugar_g:val("sugars_100g"),saturated_fat_g:val("saturated-fat_100g"),trans_fat_g:null,monounsaturated_fat_g:null,polyunsaturated_fat_g:null,starch_g:null,cholesterol_mg:null,water_g:val("water_100g"),data_quality:"third_party"};
   onFound(food);onClose();
  }catch(e){Alert.alert(title,String(e));scanned.current=false;}
  finally{setLoading(false);}
 };
 return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
  <View style={styles.overlay}><Text style={styles.title}>{title}</Text><Text style={styles.muted}>{instruction}</Text>
   {!permission?<ActivityIndicator/>:!permission.granted?<><Text style={styles.muted}>{ar?"يلزم السماح باستخدام الكاميرا لمسح المنتجات.":fr?"L’autorisation de la caméra est nécessaire.":"Camera permission is needed to scan products."}</Text><Pressable style={styles.button} onPress={requestPermission}><Text style={styles.buttonText}>{ar?"السماح بالكاميرا":fr?"Autoriser la caméra":"Allow camera"}</Text></Pressable></>:<CameraView style={styles.camera} facing="back" barcodeScannerSettings={{barcodeTypes:["ean13","ean8","upc_a","upc_e","code128","code39","itf14"]}} onBarcodeScanned={lookup}/>}
   {loading&&<Text style={styles.loading}>{ar?"جارٍ البحث عن المنتج…":fr?"Recherche du produit…":"Looking up product…"}</Text>}
   <Pressable style={styles.close} onPress={onClose}><Text style={styles.muted}>{close}</Text></Pressable>
  </View>
 </Modal>;
}
