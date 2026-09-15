package com.leafmash.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class GroupChatMessage(
    val text: String,
    val fromMe: Boolean,
    val senderUid: String,
    val senderName: String,
    val timestamp: Long
)

object GroupChatConversationStore {

    const val CONVERSATION_ID = "classChat"

    private const val PREFS_NAME = "leafmash_classchat"
    private const val MESSAGES_KEY = "messages"
    private const val PHOTOS_KEY = "senderPhotos"
    private const val UNREAD_KEY = "unread"
    private const val MAX_MESSAGES = 30

    fun addMessage(context: Context, text: String, fromMe: Boolean, senderUid: String, senderName: String, timestamp: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val array = JSONArray(prefs.getString(MESSAGES_KEY, null) ?: "[]")
        array.put(JSONObject().apply {
            put("text", text)
            put("fromMe", fromMe)
            put("senderUid", senderUid)
            put("senderName", senderName)
            put("timestamp", timestamp)
        })
        val start = maxOf(0, array.length() - MAX_MESSAGES)
        val trimmed = JSONArray()
        for (i in start until array.length()) trimmed.put(array.getJSONObject(i))
        prefs.edit().putString(MESSAGES_KEY, trimmed.toString()).apply()
    }

    fun getMessages(context: Context): List<GroupChatMessage> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val array = JSONArray(prefs.getString(MESSAGES_KEY, null) ?: "[]")
        val messages = mutableListOf<GroupChatMessage>()
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            messages.add(
                GroupChatMessage(
                    text = obj.getString("text"),
                    fromMe = obj.getBoolean("fromMe"),
                    senderUid = obj.optString("senderUid", ""),
                    senderName = obj.optString("senderName", ""),
                    timestamp = obj.getLong("timestamp")
                )
            )
        }
        return messages
    }

    fun setSenderPhotoUrl(context: Context, senderUid: String, url: String) {
        if (senderUid.isBlank() || url.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val photos = JSONObject(prefs.getString(PHOTOS_KEY, null) ?: "{}")
        photos.put(senderUid, url)
        prefs.edit().putString(PHOTOS_KEY, photos.toString()).apply()
    }

    fun getSenderPhotoUrl(context: Context, senderUid: String): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val photos = JSONObject(prefs.getString(PHOTOS_KEY, null) ?: "{}")
        return photos.optString(senderUid, "")
    }

    fun incrementUnread(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val next = prefs.getInt(UNREAD_KEY, 0) + 1
        prefs.edit().putInt(UNREAD_KEY, next).apply()
        return next
    }

    fun getUnreadCount(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(UNREAD_KEY, 0)
    }

    fun resetUnread(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(UNREAD_KEY).apply()
    }

    fun clear(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(MESSAGES_KEY).remove(PHOTOS_KEY).remove(UNREAD_KEY).apply()
    }
}
