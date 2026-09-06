package com.leafmash.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DmReplyReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val replyText = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(KEY_REPLY_TEXT)?.toString()?.trim()
        val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID)
        val targetUid = intent.getStringExtra(EXTRA_TARGET_UID)
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        if (replyText.isNullOrEmpty() || conversationId == null || targetUid == null) return

        val pendingResult = goAsync()
        val appContext = context.applicationContext

        CoroutineScope(Dispatchers.IO).launch {
            try {
                handleReply(appContext, conversationId, targetUid, notificationId, replyText)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun handleReply(context: Context, conversationId: String, targetUid: String, notificationId: Int, replyText: String) {
        DmConversationStore.addMessage(
            context,
            conversationId,
            replyText,
            fromMe = true,
            senderName = "You",
            timestamp = System.currentTimeMillis()
        )

        DmReplyMessagingService.ensureChannel(context)

        val conversationTitle = DmConversationStore.getMessages(context, conversationId)
            .lastOrNull { !it.fromMe }?.senderName ?: "LeafMash"

        val notification = NotificationCompat.Builder(context, DmReplyMessagingService.DM_CHANNEL_ID)
            .setSmallIcon(DmReplyMessagingService.resolveIcon(context))
            .setStyle(DmReplyMessagingService.buildMessagingStyle(context, conversationId, conversationTitle, targetUid))
            .setAutoCancel(true)
            .setContentIntent(DmReplyMessagingService.buildOpenPendingIntent(context, notificationId, conversationId, "/#dm-thread?id=$targetUid"))
            .addAction(DmReplyMessagingService.buildReplyAction(context, conversationId, targetUid, notificationId))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setShortcutId(conversationId)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)

        DmConversationStore.clear(context, conversationId)

        enqueueSendWorker(context, targetUid, notificationId, replyText)
    }

    private fun enqueueSendWorker(context: Context, targetUid: String, notificationId: Int, replyText: String) {
        val inputData = Data.Builder()
            .putString(DmReplyWorker.KEY_TEXT, replyText)
            .putString(DmReplyWorker.KEY_TARGET_UID, targetUid)
            .putInt(DmReplyWorker.KEY_NOTIFICATION_ID, notificationId)
            .build()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val workRequest = OneTimeWorkRequestBuilder<DmReplyWorker>()
            .setInputData(inputData)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(workRequest)
    }

    companion object {
        const val KEY_REPLY_TEXT = "leafmash_dm_reply_text"
        const val EXTRA_CONVERSATION_ID = "leafmash_conversation_id"
        const val EXTRA_TARGET_UID = "leafmash_target_uid"
        const val EXTRA_NOTIFICATION_ID = "leafmash_notification_id"
    }
}
