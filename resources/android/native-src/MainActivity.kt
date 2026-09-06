package com.leafmash.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(DeepLinkPlugin::class.java)
        super.onCreate(savedInstanceState)
        // Cold start: just remember the URL. Don't push a JS event yet —
        // the WebView hasn't loaded index.html at this point, so the event
        // would be dispatched into a not-yet-existent page and lost (this
        // was the "notification opens the app but lands on Wall" bug).
        // push.js pulls this via the LeafMashDeepLink plugin once its own
        // listeners are ready.
        capturePendingDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Warm resume: the app (and its JS listeners) is already loaded, so
        // pushing the event live here is safe.
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

