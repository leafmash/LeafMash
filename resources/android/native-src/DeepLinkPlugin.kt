package com.leafmash.app

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
}
