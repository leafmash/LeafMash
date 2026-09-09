import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const versionCode = Number(process.env.NEW_VERSION_CODE);
const apkUrl = process.env.NEW_APK_URL;
const changelog = process.env.NEW_CHANGELOG || "";
const forceUpdate = process.env.FORCE_UPDATE === "true";

if (!versionCode || !apkUrl) {
  console.error("Missing NEW_VERSION_CODE or NEW_APK_URL");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ref = db.collection("config").doc("appVersion");
const existing = await ref.get();
const currentMin = existing.exists ? existing.data().minVersionCode || 0 : 0;

await ref.set({
  apkUrl,
  changelog,
  minVersionCode: forceUpdate ? versionCode : currentMin
}, { merge: true });

console.log(`appVersion updated: apkUrl=${apkUrl} forceUpdate=${forceUpdate} minVersionCode=${forceUpdate ? versionCode : currentMin}`);
