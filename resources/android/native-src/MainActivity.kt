package com.leafmash.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.PermissionRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebChromeClient

class MainActivity : BridgeActivity() {

    private var pendingMicPermissionRequest: PermissionRequest? = null

    private val micPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val request = pendingMicPermissionRequest
        pendingMicPermissionRequest = null
        if (request == null) return@registerForActivityResult
        runOnUiThread {
            if (granted) request.grant(request.resources) else request.deny()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(DeepLinkPlugin::class.java)
        registerPlugin(BatteryOptimizationPlugin::class.java)
        registerPlugin(AppUpdaterPlugin::class.java)
        super.onCreate(savedInstanceState)
        capturePendingDeepLink(intent)
        setupMicPermissionHandling()
    }

    private fun setupMicPermissionHandling() {
        val activeBridge = bridge ?: return
        val webView = activeBridge.webView ?: return
        webView.webChromeClient = object : BridgeWebChromeClient(activeBridge) {
            override fun onPermissionRequest(request: PermissionRequest) {
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    handleAudioCaptureRequest(request)
                } else {
                    super.onPermissionRequest(request)
                }
            }
        }
    }

    private fun handleAudioCaptureRequest(request: PermissionRequest) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            runOnUiThread { request.grant(request.resources) }
            return
        }
        pendingMicPermissionRequest = request
        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
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
