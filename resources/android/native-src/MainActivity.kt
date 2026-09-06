package com.leafmash.app

import android.content.Intent
import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val url = intent?.getStringExtra("leafmash_url") ?: return
        intent.removeExtra("leafmash_url")
        val escaped = url.replace("\\", "\\\\").replace("\"", "\\\"")
        bridge?.triggerJSEvent("leafmashNotificationTap", "window", "\"$escaped\"")
    }
}
