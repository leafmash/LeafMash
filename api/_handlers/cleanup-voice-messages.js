import crypto from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAdminApp } from "../_lib/adminApp.js";

const VOICE_RETENTION_DAYS = 30;
const CLOUD_NAME = "xreqa1wz";

function extractRawPublicId(url) {
  const m = /\/raw\/upload\/(?:v\d+\/)?(.+)$/.exec(url || "");
  return m ? m[1] : null;
}

async function destroyRawAsset(publicId) {
  if (!publicId || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + process.env.CLOUDINARY_API_SECRET).digest("hex");
  const form = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: process.env.CLOUDINARY_API_KEY,
    signature
  });
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/destroy`, { method: "POST", body: form }).catch(() => null);
}

async function purgeQuery(query) {
  const snap = await query.get();
  let deleted = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!data.audioUrl) continue;
    await destroyRawAsset(extractRawPublicId(data.audioUrl));
    await docSnap.ref.delete();
    deleted++;
  }
  return deleted;
}

export async function cleanupVoiceMessages(req, res) {
  if (!process.env.CRON_SECRET) {
    console.error("cleanup-voice-messages: CRON_SECRET is not set — refusing request.");
    return res.status(500).json({ error: "Server misconfiguration." });
  }
  const authHeader = req.headers.authorization || "";
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  try {
    const db = getFirestore(getAdminApp());
    const cutoff = Timestamp.fromMillis(Date.now() - VOICE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let deleted = await purgeQuery(db.collection("classChat").where("createdAt", "<", cutoff));

    const convsSnap = await db.collection("conversations").get();
    for (const convDoc of convsSnap.docs) {
      deleted += await purgeQuery(
        convDoc.ref.collection("messages").where("createdAt", "<", cutoff)
      );
    }

    return res.status(200).json({ ok: true, deleted });
  } catch (err) {
    console.error("cleanup-voice-messages error:", err);
    return res.status(500).json({ error: err.message || "Failed to clean up voice messages." });
  }
}
