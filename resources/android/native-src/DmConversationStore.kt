package com.leafmash.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class DmMessage(val text: String, val fromMe: Boolean, val senderName: String, val timestamp: Long)

object DmConversationStore {

    private const val PREFS_NAME = "leafmash_dm_conversations"
    private const val MAX_MESSAGES = 30

    fun addMessage(context: Context, conversationId: String, text: String, fromMe: Boolean, senderName: String, timestamp: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val array = JSONArray(prefs.getString(conversationId, null) ?: "[]")
        array.put(JSONObject().apply {
            put("text", text)
            put("fromMe", fromMe)
            put("senderName", senderName)
            put("timestamp", timestamp)
        })
        val start = maxOf(0, array.length() - MAX_MESSAGES)
        val trimmed = JSONArray()
        for (i in start until array.length()) trimmed.put(array.getJSONObject(i))
        prefs.edit().putString(conversationId, trimmed.toString()).apply()
    }

    fun getMessages(context: Context, conversationId: String): List<DmMessage> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val array = JSONArray(prefs.getString(conversationId, null) ?: "[]")
        val messages = mutableListOf<DmMessage>()
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            messages.add(
                DmMessage(
                    text = obj.getString("text"),
                    fromMe = obj.getBoolean("fromMe"),
                    senderName = obj.optString("senderName", ""),
                    timestamp = obj.getLong("timestamp")
                )
            )
        }
        return messages
    }

    fun setSenderPhotoUrl(context: Context, conversationId: String, url: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString("$conversationId:photo", url).apply()
    }

    fun getSenderPhotoUrl(context: Context, conversationId: String): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("$conversationId:photo", "") ?: ""
    }

    fun setConversationTitle(context: Context, conversationId: String, title: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString("$conversationId:title", title).apply()
    }

    fun getConversationTitle(context: Context, conversationId: String): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("$conversationId:title", "") ?: ""
    }

    fun incrementUnread(context: Context, conversationId: String): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val next = prefs.getInt("$conversationId:unread", 0) + 1
        prefs.edit().putInt("$conversationId:unread", next).apply()
        return next
    }

    fun getUnreadCount(context: Context, conversationId: String): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt("$conversationId:unread", 0)
    }

    fun resetUnread(context: Context, conversationId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove("$conversationId:unread").apply()
    }

    fun clear(context: Context, conversationId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(conversationId)
            .remove("$conversationId:photo")
            .remove("$conversationId:title")
            .remove("$conversationId:unread")
            .apply()
    }
}
