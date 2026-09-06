package com.leafmash.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(DeepLinkPlugin::class.java)
        registerPlugin(BatteryOptimizationPlugin::class.java)
        super.onCreate(savedInstanceState)
        capturePendingDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = extractUrl(intent) ?: return
        val escaped = escapeForJs(url)
        bridge?.triggerJSEvent("leafmashNotificationTap", "window", "\"$escaped\"")
    }

    private fun capturePendingDeepLink(intent: Intent?) {
        pendingDeepLink = extractUrl(intent)
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

        @Synchronized
        fun consumePendingDeepLink(): String? {
            val url = pendingDeepLink
            pendingDeepLink = null
            return url
        }
    }
}
