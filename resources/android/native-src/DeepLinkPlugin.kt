package com.leafmash.app

import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "LeafMashDeepLink")
class DeepLinkPlugin : Plugin() {
    @PluginMethod
    fun getPending(call: PluginCall) {
        val ret = JSObject()
        ret.put("url", MainActivity.consumePendingDeepLink())
        call.resolve(ret)
    }

    @PluginMethod
    fun clearDmNotification(call: PluginCall) {
        val conversationId = call.getString("conversationId")
        if (conversationId == null) {
            call.reject("conversationId is required")
            return
        }
        DmConversationStore.clear(context, conversationId)
        NotificationManagerCompat.from(context).cancel(conversationId.hashCode())
        call.resolve()
    }

    @PluginMethod
    fun setActiveConversation(call: PluginCall) {
        val conversationId = call.getString("conversationId")
        if (conversationId == null) {
            call.reject("conversationId is required")
            return
        }
        MainActivity.setActiveConversationId(conversationId)
        call.resolve()
    }

    @PluginMethod
    fun clearActiveConversation(call: PluginCall) {
        MainActivity.setActiveConversationId(null)
        call.resolve()
    }
}
