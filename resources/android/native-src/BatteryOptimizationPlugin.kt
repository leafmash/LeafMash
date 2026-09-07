package com.leafmash.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Locale

@CapacitorPlugin(name = "BatteryOptimization")
class BatteryOptimizationPlugin : Plugin() {

    @PluginMethod
    fun isIgnoringBatteryOptimizations(call: PluginCall) {
        val result = JSObject()
        result.put("ignoring", isIgnoring())
        call.resolve(result)
    }

    @PluginMethod
    fun requestExemption(call: PluginCall) {
        if (isIgnoring()) {
            call.resolve()
            return
        }
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
        }
        try {
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            openBatterySettings(call)
        }
    }

    @PluginMethod
    fun openBatterySettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        try {
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Couldn't open battery settings")
        }
    }

    private fun isIgnoring(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    @PluginMethod
    fun hasAutostartSettings(call: PluginCall) {
        val result = JSObject()
        result.put("available", oemAutostartIntents().isNotEmpty())
        call.resolve(result)
    }

    @PluginMethod
    fun openAutostartSettings(call: PluginCall) {
        val intents = oemAutostartIntents() + fallbackAppDetailsIntent()
        for (intent in intents) {
            try {
                activity.startActivity(intent)
                call.resolve()
                return
            } catch (e: Exception) {
                continue
            }
        }
        call.reject("Couldn't open autostart settings")
    }

    private fun fallbackAppDetailsIntent(): Intent {
        return Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    private fun componentIntent(pkg: String, cls: String): Intent {
        return Intent().apply {
            component = ComponentName(pkg, cls)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    private fun oemAutostartIntents(): List<Intent> {
        val manufacturer = Build.MANUFACTURER.lowercase(Locale.ROOT)
        return when {
            manufacturer.contains("xiaomi") -> listOf(
                componentIntent("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
            )
            manufacturer.contains("vivo") -> listOf(
                componentIntent("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
                componentIntent("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
                componentIntent("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            )
            manufacturer.contains("oppo") -> listOf(
                componentIntent("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                componentIntent("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
                componentIntent("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
            )
            manufacturer.contains("realme") -> listOf(
                componentIntent("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                componentIntent("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
            )
            manufacturer.contains("infinix") || manufacturer.contains("tecno") || manufacturer.contains("itel") -> listOf(
                componentIntent("com.transsion.phonemanager", "com.itel.autobootmanager.activity.AutoBootMgrActivity"),
                componentIntent("com.transsion.phonemanager", "com.transsion.phonemanager.module.appmanager.autostart.AutoStartActivity"),
                componentIntent("com.transsion.phonemanager", "com.transsion.phonemanager.ui.main.MainActivity")
            )
            else -> emptyList()
        }
    }
}
