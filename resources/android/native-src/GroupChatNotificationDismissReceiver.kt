package com.leafmash.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class GroupChatNotificationDismissReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (GroupChatConversationStore.getUnreadCount(appContext) == 0) {
                    GroupChatConversationStore.clear(appContext)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
