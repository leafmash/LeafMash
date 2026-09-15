import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminApp, verifyCaller, requirePost, sendError, ApiError, enforceRateLimit } from "../_lib/adminApp.js";
import { requiredText } from "../_lib/validators.js";

const MESSAGE_TEXT_LIMIT = 1000;
const MIN_MS_BETWEEN_MESSAGES = 1500;

function truncate(text = "", max = 120) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

async function notifyEveryoneElse(db, uid, { messageId, text, senderName, senderPhotoURL }) {
  const usersSnap = await db.collection("users").get();
  const pairs = [];
  await Promise.all(usersSnap.docs.map(async (userDoc) => {
    if (userDoc.id === uid) return;
    const tokensSnap = await db.collection("users").doc(userDoc.id).collection("fcmTokens").get();
    tokensSnap.forEach((t) => {
      if (!t.data().revoked) pairs.push({ uid: userDoc.id, token: t.id });
    });
  }));
  if (!pairs.length) return;

  const messaging = getMessaging(getAdminApp());
  const data = {
    type: "classChat",
    title: `${senderName || "Someone"} sent a message in Department Chat`,
    body: truncate(text) || "Tap to view.",
    url: "/#message",
    messageId: String(messageId),
    senderUid: uid,
    senderName: senderName || "",
    senderPhotoURL: senderPhotoURL || "",
    sentAtMs: String(Date.now())
  };

  for (let i = 0; i < pairs.length; i += 500) {
    const chunk = pairs.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk.map((p) => p.token),
      data,
      android: { priority: "high" },
      webpush: { fcmOptions: { link: data.url } }
    });
    await Promise.all(res.responses.map((r, idx) => {
      if (r.success) return null;
      const code = r.error?.code || "";
      if (!code.includes("registration-token-not-registered") && !code.includes("invalid-argument")) return null;
      const { uid: targetUid, token } = chunk[idx];
      return db.collection("users").doc(targetUid).collection("fcmTokens").doc(token).delete().catch(() => null);
    }));
  }
}

export async function sendClassChatMessage(req, res) {
  try {
    requirePost(req, res);
    const decoded = await verifyCaller(req);
    const uid = decoded.uid;

    const db = getFirestore(getAdminApp());
    await enforceRateLimit(db, uid, "send-classchat-message", MIN_MS_BETWEEN_MESSAGES);

    const body = req.body || {};
    const text = requiredText(body.text, "Message", MESSAGE_TEXT_LIMIT);

    const meSnap = await db.collection("users").doc(uid).get();
    if (!meSnap.exists) throw new ApiError(409, "Your profile isn't set up yet — please finish onboarding first.");

    const senderName = meSnap.get("name") || "";
    const senderPhotoURL = meSnap.get("photoURL") || "";

    const msgRef = await db.collection("classChat").add({
      authorUid: uid,
      authorName: senderName || meSnap.get("email") || "",
      text,
      createdAt: FieldValue.serverTimestamp()
    });

    await notifyEveryoneElse(db, uid, { messageId: msgRef.id, text, senderName, senderPhotoURL }).catch(() => null);

    return res.status(200).json({ messageId: msgRef.id, senderName });
  } catch (err) {
    return sendError(res, err);
  }
}
