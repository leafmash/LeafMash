package com.leafmash.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
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

class GroupChatReplyReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val replyText = RemoteInput.getResultsFromIntent(intent)
            ?.getCharSequence(KEY_REPLY_TEXT)?.toString()?.trim()
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0)
        if (replyText.isNullOrEmpty()) return

        val pendingResult = goAsync()
        val appContext = context.applicationContext

        CoroutineScope(Dispatchers.IO).launch {
            try {
                handleReply(appContext, notificationId, replyText)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun handleReply(context: Context, notificationId: Int, replyText: String) {
        GroupChatConversationStore.addMessage(
            context,
            replyText,
            fromMe = true,
            senderUid = "leafmash_me",
            senderName = "You",
            timestamp = System.currentTimeMillis()
        )
        GroupChatConversationStore.resetUnread(context)
        NotificationManagerCompat.from(context).cancel(notificationId)

        enqueueSendWorker(context, notificationId, replyText)
    }

    private fun enqueueSendWorker(context: Context, notificationId: Int, replyText: String) {
        val inputData = Data.Builder()
            .putString(GroupChatReplyWorker.KEY_TEXT, replyText)
            .putInt(GroupChatReplyWorker.KEY_NOTIFICATION_ID, notificationId)
            .build()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val workRequest = OneTimeWorkRequestBuilder<GroupChatReplyWorker>()
            .setInputData(inputData)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(workRequest)
    }

    companion object {
        const val KEY_REPLY_TEXT = "leafmash_classchat_reply_text"
        const val EXTRA_NOTIFICATION_ID = "leafmash_notification_id"
    }
}
