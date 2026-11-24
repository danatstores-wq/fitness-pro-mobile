import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import type { Language } from "../i18n";
import { Ionicons } from "@expo/vector-icons";

type Mode = "choice" | "register" | "login" | "reset" | "verify";
type Props = {
  visible: boolean;
  language: Language;
  busy: boolean;
  configured: boolean;
  onClose: () => void;
  onRegister: (email: string, password: string, remember: boolean, policyAccepted: boolean) => Promise<boolean>;
  onLogin: (email: string, password: string, remember: boolean) => Promise<boolean>;
  verificationRequired: boolean;
  verificationEmail: string | null;
  onResendVerification: () => Promise<void>;
  onCheckVerification: () => Promise<boolean>;
  onReset: (email: string) => Promise<void>;
};

const copy = {
  en: {
    verificationTitle: "Verify your email", verificationBody: "We sent a verification link to", resend: "Resend verification email", checkVerified: "I have verified — check again", verificationSent: "Verification email sent. Check your inbox and spam folder.", verificationFailed: "Your account was created, but Firebase could not send the verification email. Tap Resend verification email and check the error if it fails again.", notVerified: "Your email is not verified yet. Open the link in the email, then check again.",
    title: "Create your free account", subtitle: "Register or log in to unlock Fitness Pro.",
    register: "Create account", login: "Log in", email: "Email address", password: "Password",
    confirm: "Confirm password", remember: "Remember me on this device", forgot: "Forgot password?",
    create: "Create account", submit: "Log in", reset: "Send reset email", back: "Back",
    close: "Not now", have: "Already have an account?", noAccount: "New to Fitness Pro?",
    config: "Account sign-in is not configured in this build. Add the Firebase API key to the GitHub Actions secret and rebuild.",
    mismatch: "Passwords do not match.", short: "Password must be at least 6 characters.",
    invalid: "Enter a valid email address and password.", resetDone: "Password reset email sent if this address is registered.",
    policyIntro: "I have read and agree to the", policyLink: "Terms of Use and Health Disclaimer", policyRequired: "You must open and accept the Terms of Use and Health Disclaimer to create an account.",
    working: "Please wait…"
  },
  fr: {
    verificationTitle: "Vérifiez votre e-mail", verificationBody: "Nous avons envoyé un lien de vérification à", resend: "Renvoyer l’e-mail de vérification", checkVerified: "J’ai vérifié — vérifier à nouveau", verificationSent: "E-mail de vérification envoyé. Vérifiez votre boîte de réception et les courriers indésirables.", verificationFailed: "Votre compte a été créé, mais Firebase n’a pas pu envoyer l’e-mail. Appuyez sur Renvoyer l’e-mail de vérification.", notVerified: "Votre adresse n’est pas encore vérifiée. Ouvrez le lien reçu, puis réessayez.",
    title: "Créez votre compte gratuit", subtitle: "Inscrivez-vous ou connectez-vous pour débloquer Fitness Pro.",
    register: "Créer un compte", login: "Se connecter", email: "Adresse e-mail", password: "Mot de passe",
    confirm: "Confirmer le mot de passe", remember: "Se souvenir de moi sur cet appareil", forgot: "Mot de passe oublié ?",
    create: "Créer un compte", submit: "Se connecter", reset: "Envoyer l’e-mail de réinitialisation", back: "Retour",
    close: "Pas maintenant", have: "Vous avez déjà un compte ?", noAccount: "Nouveau sur Fitness Pro ?",
    config: "La connexion n’est pas configurée dans cette version. Ajoutez la clé API Firebase aux secrets GitHub Actions et reconstruisez l’application.",
    mismatch: "Les mots de passe ne correspondent pas.", short: "Le mot de passe doit contenir au moins 6 caractères.",
    invalid: "Saisissez une adresse e-mail et un mot de passe valides.", resetDone: "E-mail de réinitialisation envoyé si cette adresse est enregistrée.",
    policyIntro: "J’ai lu et j’accepte les", policyLink: "Conditions d’utilisation et avertissement santé", policyRequired: "Vous devez consulter et accepter les conditions d’utilisation et l’avertissement santé pour créer un compte.",
    working: "Veuillez patienter…"
  },
  ar: {
    verificationTitle: "تحقق من بريدك الإلكتروني", verificationBody: "أرسلنا رابط التحقق إلى", resend: "إعادة إرسال رسالة التحقق", checkVerified: "تحققت من بريدي — تحقق مرة أخرى", verificationSent: "تم إرسال رسالة التحقق. افحص صندوق الوارد والرسائل غير المرغوب فيها.", verificationFailed: "تم إنشاء حسابك، لكن Firebase لم يتمكن من إرسال رسالة التحقق. اضغط على إعادة إرسال رسالة التحقق.", notVerified: "لم يتم التحقق من بريدك بعد. افتح الرابط في الرسالة ثم أعد المحاولة.",
    title: "أنشئ حسابك المجاني", subtitle: "سجّل أو ادخل إلى حسابك لفتح جميع ميزات Fitness Pro.",
    register: "إنشاء حساب", login: "تسجيل الدخول", email: "البريد الإلكتروني", password: "كلمة المرور",
    confirm: "تأكيد كلمة المرور", remember: "تذكرني على هذا الجهاز", forgot: "نسيت كلمة المرور؟",
    create: "إنشاء حساب", submit: "تسجيل الدخول", reset: "إرسال رابط إعادة التعيين", back: "رجوع",
    close: "ليس الآن", have: "لديك حساب بالفعل؟", noAccount: "مستخدم جديد؟",
    config: "تسجيل الدخول غير مهيأ في هذا الإصدار. أضف مفتاح Firebase إلى أسرار GitHub Actions ثم أعد البناء.",
    mismatch: "كلمتا المرور غير متطابقتين.", short: "يجب ألا تقل كلمة المرور عن 6 أحرف.",
    invalid: "أدخل بريداً إلكترونياً وكلمة مرور صالحين.", resetDone: "تم إرسال رسالة إعادة التعيين إذا كان البريد مسجلاً.",
    policyIntro: "لقد قرأت وأوافق على", policyLink: "شروط الاستخدام وإخلاء مسؤولية الصحة", policyRequired: "يجب فتح شروط الاستخدام وإخلاء مسؤولية الصحة والموافقة عليهما لإنشاء حساب.",
    working: "يرجى الانتظار…"
  }
};

export default function AuthGateModal({ visible, language, busy, configured, verificationRequired, verificationEmail, onClose, onRegister, onLogin, onResendVerification, onCheckVerification, onReset }: Props) {
  const [mode, setMode] = useState<Mode>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const t = copy[language];

  useEffect(() => {
    if (visible) { setMode(verificationRequired ? "verify" : "choice"); setMessage(""); setPassword(""); setConfirm(""); setPolicyAccepted(false); if (verificationEmail) setEmail(verificationEmail); }
  }, [visible]);

  const submit = async () => {
    setMessage("");
    if (!configured) { setMessage(t.config); return; }
    if (!email.trim() || !email.includes("@")) { setMessage(t.invalid); return; }
    if (mode === "register" && !policyAccepted) { setMessage(t.policyRequired); return; }
    if (mode === "reset") {
      try { await onReset(email.trim()); setMessage(t.resetDone); }
      catch (error) { setMessage(authError(error)); }
      return;
    }
    if (password.length < 6) { setMessage(t.short); return; }
    if (mode === "register" && password !== confirm) { setMessage(t.mismatch); return; }
    try {
      if (mode === "register") { const sent = await onRegister(email.trim(), password, remember, policyAccepted); setMode("verify"); setPassword(""); setConfirm(""); setMessage(sent ? t.verificationSent : t.verificationFailed); }
      else { const verified = await onLogin(email.trim(), password, remember); if (verified) onClose(); else { setMode("verify"); setPassword(""); setMessage(t.notVerified); } }
    } catch (error) { setMessage(authError(error)); }
  };

  const rtl = language === "ar";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.keyboard}>
          <View style={s.panel}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
              <Text style={s.eyebrow}>DANAT / WELLNESS</Text>
              <Text style={[s.title, rtl && s.rtl]}>{mode === "verify" ? t.verificationTitle : mode === "choice" ? t.title : mode === "register" ? t.register : mode === "login" ? t.login : t.forgot}</Text>
              {mode === "verify" ? <>
                <Text style={[s.subtitle, rtl && s.rtl]}>{t.verificationBody} {email || "your email"}.</Text>
                <Pressable disabled={busy} style={[s.primary, busy && s.disabled]} onPress={async () => { setMessage(""); try { if (await onCheckVerification()) onClose(); else setMessage(t.notVerified); } catch (error) { setMessage(authError(error)); } }}>
                  {busy ? <ActivityIndicator color="#09213D"/> : <Text style={s.primaryText}>{t.checkVerified}</Text>}
                </Pressable>
                <Pressable disabled={busy} style={s.secondary} onPress={async () => { setMessage(""); try { await onResendVerification(); setMessage(t.verificationSent); } catch (error) { setMessage(authError(error)); } }}><Text style={s.secondaryText}>{t.resend}</Text></Pressable>
                {message ? <Text style={s.message}>{message}</Text> : null}
              </> : mode === "choice" ? <>
                <Text style={[s.subtitle, rtl && s.rtl]}>{t.subtitle}</Text>
                <Pressable style={s.primary} onPress={() => { setPolicyAccepted(false); setMode("register"); }}><Text style={s.primaryText}>{t.register}</Text></Pressable>
                <Pressable style={s.secondary} onPress={() => setMode("login")}><Text style={s.secondaryText}>{t.login}</Text></Pressable>
              </> : <>
                <TextInput value={email} onChangeText={setEmail} placeholder={t.email} placeholderTextColor="#8B9AAF" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={[s.input, rtl && s.rtl]} editable={!busy}/>
                {mode !== "reset" && <View style={s.passwordRow}>
                  <TextInput value={password} onChangeText={setPassword} placeholder={t.password} placeholderTextColor="#8B9AAF" secureTextEntry={!showPassword} autoComplete={mode === "register" ? "new-password" : "current-password"} style={[s.input, s.passwordInput]} editable={!busy}/>
                  <Pressable onPress={() => setShowPassword(value => !value)} disabled={busy} style={s.passwordToggle} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#52677E"/>
                  </Pressable>
                </View>}
                {mode === "register" && <>
                  <View style={s.passwordRow}>
                    <TextInput value={confirm} onChangeText={setConfirm} placeholder={t.confirm} placeholderTextColor="#8B9AAF" secureTextEntry={!showPassword} style={[s.input, s.passwordInput]} editable={!busy}/>
                    <Pressable onPress={() => setShowPassword(value => !value)} disabled={busy} style={s.passwordToggle} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#52677E"/>
                    </Pressable>
                  </View>
                  <View style={[s.policyRow, rtl && s.policyRowRtl]}>
                    <Pressable onPress={() => setPolicyAccepted(value => !value)} disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: policyAccepted }} style={[s.policyCheckbox, policyAccepted && s.policyCheckboxOn]}>
                      {policyAccepted ? <Text style={s.policyCheckmark}>✓</Text> : null}
                    </Pressable>
                    <Text style={[s.policyText, rtl && s.rtl]}>{t.policyIntro} <Text accessibilityRole="link" onPress={() => { void Linking.openURL(POLICY_URL).catch(() => setMessage("Could not open the policy. Please try again.")); }} style={s.policyLink}>{t.policyLink}</Text>.</Text>
                  </View>
                </>}
                {(mode === "login" || mode === "register") && <Pressable onPress={() => setRemember(v => !v)} style={s.rememberRow}>
                  <View style={[s.checkbox, remember && s.checkboxOn]}>{remember ? <Text style={s.checkmark}>✓</Text> : null}</View>
                  <Text style={s.rememberText}>{t.remember}</Text>
                </Pressable>}
                {mode === "login" && <Pressable onPress={() => { setMode("reset"); setMessage(""); }}><Text style={s.link}>{t.forgot}</Text></Pressable>}
                <Pressable disabled={busy} style={[s.primary, busy && s.disabled]} onPress={() => void submit()}>
                  {busy ? <ActivityIndicator color="#09213D"/> : <Text style={s.primaryText}>{mode === "register" ? t.create : mode === "login" ? t.submit : t.reset}</Text>}
                </Pressable>
                {message ? <Text style={s.message}>{message}</Text> : null}
                <Pressable onPress={() => { setMode("choice"); setMessage(""); }}><Text style={s.link}>{t.back}</Text></Pressable>
              </>}
              {mode === "choice" && !configured ? <Text style={s.message}>{t.config}</Text> : null}
              <Pressable style={s.close} onPress={onClose}><Text style={s.closeText}>{t.close}</Text></Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const POLICY_URL = "https://github.com/danatstores-wq/fitness-pro-mobile/blob/main/docs/TERMS_OF_USE_AND_HEALTH_DISCLAIMER.md";

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,12,27,0.78)", justifyContent: "center", padding: 20 },
  keyboard: { width: "100%", maxWidth: 440, alignSelf: "center" },
  panel: { backgroundColor: "#F7FAFE", borderRadius: 24, borderWidth: 1, borderColor: "#E5B92C", overflow: "hidden", maxHeight: "90%" },
  content: { padding: 24, gap: 13 },
  eyebrow: { color: "#1686E8", fontSize: 10, fontWeight: "900", letterSpacing: 2.5, textAlign: "center" },
  title: { color: "#0B2544", fontSize: 24, lineHeight: 31, fontWeight: "900", textAlign: "center" },
  subtitle: { color: "#52677E", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 8 },
  input: { color: "#102A46", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD8E6", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  passwordRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD8E6", borderRadius: 12 },
  passwordInput: { flex: 1, borderWidth: 0, backgroundColor: "transparent" },
  passwordToggle: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  rtl: { writingDirection: "rtl", textAlign: "right" },
  primary: { minHeight: 48, borderRadius: 12, backgroundColor: "#FFC928", alignItems: "center", justifyContent: "center", padding: 13, marginTop: 4 },
  primaryText: { color: "#09213D", fontWeight: "900", fontSize: 15 },
  secondary: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: "#163B63", alignItems: "center", justifyContent: "center", padding: 13 },
  secondaryText: { color: "#163B63", fontWeight: "900", fontSize: 15 },
  policyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 5 },
  policyRowRtl: { flexDirection: "row-reverse" },
  policyCheckbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: "#60758B", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", marginTop: 1 },
  policyCheckboxOn: { backgroundColor: "#1686E8", borderColor: "#1686E8" },
  policyCheckmark: { color: "#FFFFFF", fontWeight: "900" },
  policyText: { flex: 1, color: "#29445F", fontSize: 12, lineHeight: 19 },
  policyLink: { color: "#1267B2", fontWeight: "900", textDecorationLine: "underline" },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 3 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: "#60758B", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  checkboxOn: { backgroundColor: "#1686E8", borderColor: "#1686E8" },
  checkmark: { color: "#FFFFFF", fontWeight: "900" },
  rememberText: { color: "#29445F", fontSize: 13, fontWeight: "700" },
  link: { color: "#1267B2", textAlign: "center", fontWeight: "800", padding: 7 },
  message: { color: "#A12D25", fontSize: 12, lineHeight: 18, textAlign: "center" },
  close: { paddingVertical: 8, alignItems: "center" },
  closeText: { color: "#6C7D90", fontWeight: "700" },
  disabled: { opacity: 0.6 }
});

function authError(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "This email is already registered. Please log in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Choose a stronger password (at least 6 characters).",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication.",
    "auth/configuration-not-found": "Firebase Authentication is not configured for this project.",
    "auth/unauthorized-domain": "Firebase blocked this website domain. Add danatstores-wq.github.io to Firebase Console → Authentication → Settings → Authorized domains, then resend.",
    "auth/too-many-requests": "Firebase temporarily blocked email requests due to too many attempts. Wait a while, then try Resend verification email.",
    "auth/network-request-failed": "The verification request could not reach Firebase. Check your internet connection and try again.",
    "auth/invalid-continue-uri": "Firebase rejected the verification link configuration. Check the Authentication email template settings in Firebase Console.",
    "auth/missing-continue-uri": "Firebase requires a valid verification link configuration. Check the Authentication email template settings.",
    "auth/user-disabled": "This Firebase account has been disabled. Contact the app administrator."
  };
  return messages[code] ?? (code ? "Firebase error (" + code + "). Please try again or contact support." : "Could not complete the request. Please check your details and try again.");
}
