package com.leafmash.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(DeepLinkPlugin::class.java)
        registerPlugin(BatteryOptimizationPlugin::class.java)
        registerPlugin(AppUpdaterPlugin::class.java)
        super.onCreate(savedInstanceState)
        capturePendingDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        clearConversationHistory(intent)
        val url = extractUrl(intent) ?: return
        val escaped = escapeForJs(url)
        bridge?.triggerJSEvent("leafmashNotificationTap", "window", "\"$escaped\"")
    }

    override fun onPause() {
        super.onPause()
        activeConversationId = null
    }

    private fun capturePendingDeepLink(intent: Intent?) {
        clearConversationHistory(intent)
        pendingDeepLink = extractUrl(intent)
    }

    private fun clearConversationHistory(intent: Intent?) {
        val conversationId = intent?.getStringExtra("leafmash_conversation_id") ?: return
        intent.removeExtra("leafmash_conversation_id")
        DmConversationStore.clear(applicationContext, conversationId)
    }

    private fun extractUrl(intent: Intent?): String? {
        val url = intent?.getStringExtra("leafmash_url") ?: return null
        intent.removeExtra("leafmash_url")
        return url
    }

    private fun escapeForJs(url: String) = url.replace("\\", "\\\\").replace("\"", "\\\"")

    companion object {
        @Volatile
        private var pendingDeepLink: String? = null

        @Volatile
        private var activeConversationId: String? = null

        @Synchronized
        fun consumePendingDeepLink(): String? {
            val url = pendingDeepLink
            pendingDeepLink = null
            return url
        }

        @Synchronized
        fun setActiveConversationId(conversationId: String?) {
            activeConversationId = conversationId
        }

        @Synchronized
        fun getActiveConversationId(): String? = activeConversationId
    }
}
