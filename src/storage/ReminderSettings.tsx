import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, Switch, Text, TextInput, View } from "react-native";
import { Language } from "../i18n";
import { getReminderPreferences, ReminderPreferences, saveReminderPreferences } from "./database";

const defaults: ReminderPreferences = {
  breakfast_enabled: true, breakfast_time: "08:00",
  lunch_enabled: true, lunch_time: "13:00",
  dinner_enabled: true, dinner_time: "19:00",
  snacks_enabled: false, snacks_time: "16:00",
  water_enabled: true, water_interval_minutes: 120,
  water_start_time: "08:00", water_end_time: "22:00"
};
const copy = {
  en: {title:"MEAL & WATER REMINDERS",sub:"Choose when Fitness Pro should remind you. Notifications use your phone's local time.",breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",snacks:"Snack",water:"Drink water",every:"Repeat every (minutes)",from:"Start",to:"End",save:"Save reminders",saved:"Reminder schedule saved.",permission:"Allow notifications in your phone settings to receive reminders.",web:"On the website, reminders can only appear while this page remains open. Install the mobile app for reliable background reminders.",invalid:"Check the times (HH:MM) and choose a water interval from 30 to 240 minutes.",error:"Could not save reminders."},
  ar: {title:"تذكيرات الوجبات والماء",sub:"اختر الأوقات التي يذكّرك فيها التطبيق. تستخدم الإشعارات التوقيت المحلي لهاتفك.",breakfast:"الفطور",lunch:"الغداء",dinner:"العشاء",snacks:"وجبة خفيفة",water:"شرب الماء",every:"التكرار كل (دقيقة)",from:"من",to:"إلى",save:"حفظ التذكيرات",saved:"تم حفظ جدول التذكيرات.",permission:"اسمح بالإشعارات من إعدادات الهاتف لاستلام التذكيرات.",web:"على الموقع، تظهر التذكيرات فقط عندما تبقى الصفحة مفتوحة. ثبّت تطبيق الهاتف للحصول على تذكيرات موثوقة في الخلفية.",invalid:"تحقق من الوقت بصيغة HH:MM واختر فاصلاً للماء بين 30 و240 دقيقة.",error:"تعذر حفظ التذكيرات."},
  fr: {title:"RAPPELS DES REPAS ET DE L’EAU",sub:"Choisissez quand Fitness Pro doit vous rappeler. Les notifications suivent l’heure locale du téléphone.",breakfast:"Petit-déjeuner",lunch:"Déjeuner",dinner:"Dîner",snacks:"Collation",water:"Boire de l’eau",every:"Répéter toutes les (minutes)",from:"Début",to:"Fin",save:"Enregistrer les rappels",saved:"Programme de rappels enregistré.",permission:"Autorisez les notifications dans les réglages du téléphone.",web:"Sur le site, les rappels ne fonctionnent que si cette page reste ouverte. Installez l’application mobile pour les rappels en arrière-plan.",invalid:"Vérifiez le format HH:MM et choisissez un intervalle d’eau de 30 à 240 minutes.",error:"Impossible d’enregistrer les rappels."}
};
const validTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
const timeAt=(m:number)=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const GOLD="#D8F500", PANEL="#FFFFFF", MUTED="#667366";

export default function ReminderSettings({language}:{language:Language}) {
  const t=copy[language];
  const [p,setP]=useState<ReminderPreferences>(defaults);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [webNotificationsReady,setWebNotificationsReady]=useState(false);
  const [webSchedule,setWebSchedule]=useState<ReminderPreferences|null>(null);
  useEffect(()=>{getReminderPreferences().then(value=>{setP(value);setWebSchedule(value);setLoaded(true);}).catch(()=>setLoaded(true));},[]);
  useEffect(()=>{
    if(Platform.OS!=="web"||!loaded)return;
    const browser=globalThis as any;
    if("Notification" in browser && browser.Notification.permission==="granted")setWebNotificationsReady(true);
  },[loaded]);
  useEffect(()=>{
    if(Platform.OS!=="web"||!webNotificationsReady||!webSchedule)return;
    const browser=globalThis as any;
    const send=(key:string,time:string,title:string,body:string)=>{
      if(!time||!validTime(time))return;
      const now=new Date();
      if(now.getHours()!==Number(time.slice(0,2))||now.getMinutes()!==Number(time.slice(3,5)))return;
      const stamp=now.getFullYear()+"-"+now.getMonth()+"-"+now.getDate()+"-"+key;
      const storageKey="fitness-pro-reminder-fired-"+stamp;
      if(browser.localStorage?.getItem(storageKey))return;
      new browser.Notification(title,{body,tag:"fitness-pro-"+key});
      browser.localStorage?.setItem(storageKey,"1");
    };
    const tick=()=>{
      const title=language==="ar"?"دانات فتنس برو":"Fitness Pro by Danat";
      if(webSchedule.breakfast_enabled)send("breakfast",webSchedule.breakfast_time,title,language==="ar"?"حان وقت الفطور. سجّل وجبتك.":language==="fr"?"C’est l’heure du petit-déjeuner. Enregistrez votre repas.":"Breakfast time. Log your meal.");
      if(webSchedule.lunch_enabled)send("lunch",webSchedule.lunch_time,title,language==="ar"?"حان وقت الغداء. سجّل وجبتك.":language==="fr"?"C’est l’heure du déjeuner. Enregistrez votre repas.":"Lunch time. Log your meal.");
      if(webSchedule.dinner_enabled)send("dinner",webSchedule.dinner_time,title,language==="ar"?"حان وقت العشاء. سجّل وجبتك.":language==="fr"?"C’est l’heure du dîner. Enregistrez votre repas.":"Dinner time. Log your meal.");
      if(webSchedule.snacks_enabled)send("snacks",webSchedule.snacks_time,title,language==="ar"?"حان وقت وجبة خفيفة.":language==="fr"?"C’est l’heure de la collation.":"Snack time.");
      if(webSchedule.water_enabled&&validTime(webSchedule.water_start_time)&&validTime(webSchedule.water_end_time)){
        for(let m=minutes(webSchedule.water_start_time);m<=minutes(webSchedule.water_end_time);m+=webSchedule.water_interval_minutes){
          send("water-"+m,timeAt(m),title,language==="ar"?"حان وقت شرب الماء. حافظ على ترطيب جسمك.":language==="fr"?"Pensez à boire de l’eau et à rester hydraté.":"Time to drink water. Stay hydrated.");
        }
      }
    };
    tick();
    const timer=browser.setInterval(tick,15000);
    return()=>browser.clearInterval(timer);
  },[webSchedule,webNotificationsReady,language]);
  const update=(key:keyof ReminderPreferences,value:boolean|string|number)=>setP(old=>({...old,[key]:value} as ReminderPreferences));
  const save=async()=>{
    if(!loaded||busy)return;
    if(!validTime(p.breakfast_time)||!validTime(p.lunch_time)||!validTime(p.dinner_time)||!validTime(p.snacks_time)||!validTime(p.water_start_time)||!validTime(p.water_end_time)||p.water_interval_minutes<30||p.water_interval_minutes>240||!Number.isInteger(p.water_interval_minutes)||minutes(p.water_end_time)<=minutes(p.water_start_time)){
      Alert.alert(t.error,t.invalid);return;
    }
    try{
      setBusy(true);
      await saveReminderPreferences(p);
      setWebSchedule(p);
      if(Platform.OS==="web"){
        const browser=globalThis as any;
        if(p.breakfast_enabled||p.lunch_enabled||p.dinner_enabled||p.snacks_enabled||p.water_enabled){
          if("Notification" in browser && browser.Notification.permission==="default") await browser.Notification.requestPermission();
          if("Notification" in browser && browser.Notification.permission==="granted") setWebNotificationsReady(true);
        }
      }else{
        const Notifications=await import("expo-notifications");
        Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
        if(Platform.OS==="android") await Notifications.setNotificationChannelAsync("reminders",{name:"Meal and water reminders",importance:Notifications.AndroidImportance.HIGH,sound:"default",enableVibrate:true});
        const existing=await Notifications.getAllScheduledNotificationsAsync();
        for(const item of existing){if((item.content.data as any)?.reminderGroup==="fitness-pro-reminders") await Notifications.cancelScheduledNotificationAsync(item.identifier);}
        const anyEnabled=p.breakfast_enabled||p.lunch_enabled||p.dinner_enabled||p.snacks_enabled||p.water_enabled;
        if(!anyEnabled){Alert.alert(t.saved);return;}
        let permission=await Notifications.getPermissionsAsync();
        if(permission.status!=="granted") permission=await Notifications.requestPermissionsAsync();
        if(permission.status!=="granted") {Alert.alert(t.permission);return;}
        const schedule=async(id:string,time:string,title:string,body:string)=>{
          const [hour,minute]=time.split(":").map(Number);
          await Notifications.scheduleNotificationAsync({identifier:"fitness-pro-"+id,content:{title,body,sound:"default",data:{reminderGroup:"fitness-pro-reminders"}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour,minute,channelId:"reminders"}});
        };
        const title=language==="ar"?"دانات فتنس برو":"Fitness Pro by Danat";
        if(p.breakfast_enabled)await schedule("breakfast",p.breakfast_time,title,language==="ar"?"حان وقت الفطور. سجّل وجبتك.":language==="fr"?"C’est l’heure du petit-déjeuner. Enregistrez votre repas.":"Breakfast time. Log your meal.");
        if(p.lunch_enabled)await schedule("lunch",p.lunch_time,title,language==="ar"?"حان وقت الغداء. سجّل وجبتك.":language==="fr"?"C’est l’heure du déjeuner. Enregistrez votre repas.":"Lunch time. Log your meal.");
        if(p.dinner_enabled)await schedule("dinner",p.dinner_time,title,language==="ar"?"حان وقت العشاء. سجّل وجبتك.":language==="fr"?"C’est l’heure du dîner. Enregistrez votre repas.":"Dinner time. Log your meal.");
        if(p.snacks_enabled)await schedule("snacks",p.snacks_time,title,language==="ar"?"حان وقت وجبة خفيفة.":language==="fr"?"C’est l’heure de la collation.":"Snack time.");
        if(p.water_enabled){
          for(let m=minutes(p.water_start_time);m<=minutes(p.water_end_time);m+=p.water_interval_minutes){
            await schedule("water-"+m,timeAt(m),title,language==="ar"?"حان وقت شرب الماء. حافظ على ترطيب جسمك.":language==="fr"?"Pensez à boire de l’eau et à rester hydraté.":"Time to drink water. Stay hydrated.");
          }
        }
      }
      Alert.alert(t.saved);
    }catch(error){Alert.alert(t.error,String(error));}
    finally{setBusy(false);}
  };
  const line=(label:string,enabled:boolean,onToggle:(v:boolean)=>void,time:string,onTime:(v:string)=>void)=><View style={{flexDirection:"row",alignItems:"center",gap:9,marginTop:12}}><Switch value={enabled} onValueChange={onToggle} trackColor={{false:"#DDE6D9",true:"#368A4B"}} thumbColor={enabled?GOLD:"#D0D0D0"}/><Text style={{color:"#1C281E",fontWeight:"700",flex:1}}>{label}</Text><TextInput value={time} onChangeText={onTime} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="HH:MM" placeholderTextColor={MUTED} style={{width:82,color:"#1C281E",backgroundColor:"#F4F7F1",borderColor:"#DDE6D9",borderWidth:1,borderRadius:9,padding:9,textAlign:"center"}}/></View>;
  return <View style={{backgroundColor:PANEL,borderColor:"#DDE6D9",borderWidth:1,borderRadius:18,padding:16,marginBottom:12}}>
    <Text style={{color:GOLD,fontSize:12,fontWeight:"900",letterSpacing:1.2}}>{t.title}</Text><Text style={{color:MUTED,fontSize:12,lineHeight:18,marginTop:7}}>{t.sub}</Text>
    {line(t.breakfast,p.breakfast_enabled,v=>update("breakfast_enabled",v),p.breakfast_time,v=>update("breakfast_time",v))}
    {line(t.lunch,p.lunch_enabled,v=>update("lunch_enabled",v),p.lunch_time,v=>update("lunch_time",v))}
    {line(t.dinner,p.dinner_enabled,v=>update("dinner_enabled",v),p.dinner_time,v=>update("dinner_time",v))}
    {line(t.snacks,p.snacks_enabled,v=>update("snacks_enabled",v),p.snacks_time,v=>update("snacks_time",v))}
    <View style={{borderTopWidth:1,borderColor:"#E3EADF",marginTop:16,paddingTop:12}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:9}}><Switch value={p.water_enabled} onValueChange={v=>update("water_enabled",v)} trackColor={{false:"#DDE6D9",true:"#368A4B"}} thumbColor={p.water_enabled?GOLD:"#D0D0D0"}/><Text style={{color:"#1C281E",fontWeight:"800",flex:1}}>{t.water}</Text></View>
      <Text style={{color:MUTED,fontSize:11,marginTop:12}}>{t.every}</Text><TextInput value={String(p.water_interval_minutes)} onChangeText={v=>update("water_interval_minutes",Number(v.replace(/[^0-9]/g,""))||0)} keyboardType="number-pad" style={{color:"#1C281E",backgroundColor:"#F4F7F1",borderWidth:1,borderColor:"#DDE6D9",borderRadius:9,padding:10,marginTop:5}}/>
      <View style={{flexDirection:"row",gap:12,marginTop:8}}>
        <View style={{flex:1}}><Text style={{color:MUTED,fontSize:11}}>{t.from}</Text><TextInput value={p.water_start_time} onChangeText={v=>update("water_start_time",v)} maxLength={5} placeholder="08:00" placeholderTextColor={MUTED} style={{color:"#1C281E",backgroundColor:"#F4F7F1",borderWidth:1,borderColor:"#DDE6D9",borderRadius:9,padding:10,marginTop:5}}/></View>
        <View style={{flex:1}}><Text style={{color:MUTED,fontSize:11}}>{t.to}</Text><TextInput value={p.water_end_time} onChangeText={v=>update("water_end_time",v)} maxLength={5} placeholder="22:00" placeholderTextColor={MUTED} style={{color:"#1C281E",backgroundColor:"#F4F7F1",borderWidth:1,borderColor:"#DDE6D9",borderRadius:9,padding:10,marginTop:5}}/></View>
      </View>
    </View>
    {Platform.OS==="web"&&<Text style={{color:MUTED,fontSize:11,lineHeight:17,marginTop:12}}>{t.web}</Text>}
    <Pressable onPress={save} disabled={busy||!loaded} style={{backgroundColor:GOLD,borderRadius:11,padding:13,alignItems:"center",marginTop:16,opacity:busy||!loaded?0.55:1}}><Text style={{color:"#F7F9F5",fontWeight:"900"}}>{busy?"…":t.save}</Text></Pressable>
  </View>;
}
