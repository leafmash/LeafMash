package com.leafmash.app

import android.view.WindowManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ScreenGuard")
class ScreenGuardPlugin : Plugin() {

    @PluginMethod
    fun enable(call: PluginCall) {
        activity.runOnUiThread {
            activity.window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        }
        call.resolve()
    }

    @PluginMethod
    fun disable(call: PluginCall) {
        activity.runOnUiThread {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
        call.resolve()
    }
}
