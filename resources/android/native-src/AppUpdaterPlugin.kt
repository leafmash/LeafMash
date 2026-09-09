package com.leafmash.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

@CapacitorPlugin(name = "AppUpdater")
class AppUpdaterPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.Main)

    @PluginMethod
    fun downloadAndInstall(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("Missing url")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            try {
                activity.startActivity(intent)
            } catch (e: Exception) {
                // ignore, the reject below still tells the caller what happened
            }
            call.reject("install-permission-required")
            return
        }
        scope.launch {
            try {
                val file = downloadApk(url)
                installApk(file)
                call.resolve()
            } catch (e: Exception) {
                call.reject("download-failed", e)
            }
        }
    }

    private suspend fun downloadApk(url: String): File = withContext(Dispatchers.IO) {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        val outFile = File(dir, "leafmash-update.apk")
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.connect()
        if (connection.responseCode !in 200..299) {
            connection.disconnect()
            throw IllegalStateException("Unexpected response code ${connection.responseCode}")
        }
        val total = connection.contentLength
        var downloaded = 0L
        var lastPercent = -1
        connection.inputStream.use { input ->
            FileOutputStream(outFile).use { output ->
                val buffer = ByteArray(8192)
                while (true) {
                    val read = input.read(buffer)
                    if (read == -1) break
                    output.write(buffer, 0, read)
                    downloaded += read
                    if (total > 0) {
                        val percent = ((downloaded * 100) / total).toInt()
                        if (percent != lastPercent) {
                            lastPercent = percent
                            withContext(Dispatchers.Main) {
                                val data = JSObject()
                                data.put("percent", percent)
                                notifyListeners("downloadProgress", data)
                            }
                        }
                    }
                }
            }
        }
        connection.disconnect()
        outFile
    }

    private fun installApk(file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }
}
