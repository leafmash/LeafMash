package com.leafmash.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import PLUGIN_MESSAGING_SERVICE_IMPORT

class DmReplyMessagingService : MessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        val data = remoteMessage.data
        if (data["type"] != "dm") return
        val context = applicationContext
        serviceScope.launch { showReplyNotification(context, data) }
    }

    private suspend fun showReplyNotification(context: Context, data: Map<String, String>) {
        val conversationId = data["conversationId"] ?: return
        val senderUid = data["senderUid"] ?: return
        val senderName = data["senderName"]?.takeIf { it.isNotBlank() } ?: (data["title"] ?: "LeafMash")
        val senderPhotoURL = data["senderPhotoURL"] ?: ""
        val notificationId = conversationId.hashCode()

        DmConversationStore.addMessage(
            context,
            conversationId,
            data["body"] ?: "",
            fromMe = false,
            senderName = senderName,
            timestamp = System.currentTimeMillis()
        )
        if (senderPhotoURL.isNotBlank()) {
            DmConversationStore.setSenderPhotoUrl(context, conversationId, senderPhotoURL)
        }
        val unreadCount = DmConversationStore.incrementUnread(context, conversationId)

        ensureChannel(context)

        val notification = NotificationCompat.Builder(context, DM_CHANNEL_ID)
            .setSmallIcon(resolveIcon(context))
            .setStyle(buildMessagingStyle(context, conversationId, senderName, senderUid))
            .setAutoCancel(true)
            .setContentIntent(buildOpenPendingIntent(context, notificationId, conversationId, data["url"] ?: "/#message"))
            .setDeleteIntent(buildDeletePendingIntent(context, notificationId, conversationId))
            .addAction(buildReplyAction(context, conversationId, senderUid, notificationId))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setNumber(unreadCount)
            .setShortcutId(conversationId)
            .build()

        val manager = NotificationManagerCompat.from(context)
        manager.cancel(notificationId)
        manager.notify(notificationId, notification)
    }

    companion object {
        const val DM_CHANNEL_ID = "leafmash_dm_channel"

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            if (manager.getNotificationChannel(DM_CHANNEL_ID) != null) return
            val channel = NotificationChannel(DM_CHANNEL_ID, "Direct messages", NotificationManager.IMPORTANCE_HIGH)
            manager.createNotificationChannel(channel)
        }

        fun resolveIcon(context: Context): Int {
            val iconRes = context.resources.getIdentifier("ic_stat_notify", "drawable", context.packageName)
            return if (iconRes != 0) iconRes else android.R.drawable.ic_dialog_email
        }

        fun blankIcon(): IconCompat {
            val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
            bitmap.eraseColor(Color.TRANSPARENT)
            return IconCompat.createWithBitmap(bitmap)
        }

        fun buildReplyAction(context: Context, conversationId: String, targetUid: String, notificationId: Int): NotificationCompat.Action {
            val remoteInput = RemoteInput.Builder(DmReplyReceiver.KEY_REPLY_TEXT)
                .setLabel("Reply")
                .build()

            val replyIntent = Intent(context, DmReplyReceiver::class.java).apply {
                putExtra(DmReplyReceiver.EXTRA_CONVERSATION_ID, conversationId)
                putExtra(DmReplyReceiver.EXTRA_TARGET_UID, targetUid)
                putExtra(DmReplyReceiver.EXTRA_NOTIFICATION_ID, notificationId)
            }
            val replyPendingIntent = PendingIntent.getBroadcast(
                context,
                notificationId,
                replyIntent,
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            return NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send,
                "Reply",
                replyPendingIntent
            ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()
        }

        fun buildOpenPendingIntent(context: Context, notificationId: Int, conversationId: String, url: String): PendingIntent {
            val openIntent = Intent(context, MainActivity::class.java).apply {
                putExtra("leafmash_url", url)
                putExtra("leafmash_conversation_id", conversationId)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(
                context,
                notificationId,
                openIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        fun buildDeletePendingIntent(context: Context, notificationId: Int, conversationId: String): PendingIntent {
            val deleteIntent = Intent(context, DmNotificationDismissReceiver::class.java).apply {
                putExtra(DmNotificationDismissReceiver.EXTRA_CONVERSATION_ID, conversationId)
            }
            return PendingIntent.getBroadcast(
                context,
                notificationId,
                deleteIntent,
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        suspend fun buildMessagingStyle(context: Context, conversationId: String, conversationTitle: String, otherUid: String): NotificationCompat.MessagingStyle {
            val mePerson = Person.Builder().setName("You").setKey("leafmash_me").setIcon(blankIcon()).build()
            val style = NotificationCompat.MessagingStyle(mePerson)
                .setConversationTitle(conversationTitle)
                .setGroupConversation(false)

            val photoUrl = DmConversationStore.getSenderPhotoUrl(context, conversationId)
            val otherIcon = DmAvatarLoader.load(photoUrl)
            val otherPersonBuilder = Person.Builder().setName(conversationTitle).setKey(otherUid).setImportant(true)
            otherIcon?.let { otherPersonBuilder.setIcon(it) }
            val otherPerson = otherPersonBuilder.build()

            ensureConversationShortcut(context, conversationId, conversationTitle, otherIcon, otherPerson, otherUid)

            DmConversationStore.getMessages(context, conversationId).forEach { message ->
                val person = if (message.fromMe) null else otherPerson
                style.addMessage(message.text, message.timestamp, person)
            }
            return style
        }

        fun ensureConversationShortcut(
            context: Context,
            conversationId: String,
            title: String,
            icon: IconCompat?,
            person: Person,
            otherUid: String
        ) {
            val shortcutIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_VIEW
                putExtra("leafmash_url", "/#dm-thread?id=$otherUid")
                putExtra("leafmash_conversation_id", conversationId)
            }
            val shortcutBuilder = ShortcutInfoCompat.Builder(context, conversationId)
                .setShortLabel(title)
                .setLongLived(true)
                .setPerson(person)
                .setIntent(shortcutIntent)
                .setCategories(setOf("android.shortcut.conversation"))
            icon?.let { shortcutBuilder.setIcon(it) }
            ShortcutManagerCompat.pushDynamicShortcut(context, shortcutBuilder.build())
        }
    }
}
