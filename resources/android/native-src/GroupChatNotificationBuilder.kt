package com.leafmash.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput

object GroupChatNotificationBuilder {

    const val CHANNEL_ID = "leafmash_classchat_channel_v1"
    const val CONVERSATION_TITLE = "Department Chat"

    suspend fun buildAndShow(context: Context, url: String) {
        val notificationId = GroupChatConversationStore.CONVERSATION_ID.hashCode()
        ensureChannel(context)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(DmReplyMessagingService.resolveIcon(context))
            .setStyle(buildMessagingStyle(context))
            .setAutoCancel(true)
            .setContentIntent(buildOpenPendingIntent(context, notificationId, url))
            .setDeleteIntent(buildDeletePendingIntent(context, notificationId))
            .addAction(buildReplyAction(context, notificationId))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setNumber(GroupChatConversationStore.getUnreadCount(context))
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(CHANNEL_ID, "Department chat", NotificationManager.IMPORTANCE_HIGH)
        val soundUri = Uri.parse("android.resource://${context.packageName}/raw/leafmash_message")
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        channel.setSound(soundUri, audioAttributes)
        manager.createNotificationChannel(channel)
    }

    private fun buildReplyAction(context: Context, notificationId: Int): NotificationCompat.Action {
        val remoteInput = RemoteInput.Builder(GroupChatReplyReceiver.KEY_REPLY_TEXT)
            .setLabel("Reply")
            .build()

        val replyIntent = Intent(context, GroupChatReplyReceiver::class.java).apply {
            putExtra(GroupChatReplyReceiver.EXTRA_NOTIFICATION_ID, notificationId)
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

    private fun buildOpenPendingIntent(context: Context, notificationId: Int, url: String): PendingIntent {
        val openIntent = Intent(context, MainActivity::class.java).apply {
            putExtra("leafmash_url", url)
            putExtra("leafmash_conversation_id", GroupChatConversationStore.CONVERSATION_ID)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            notificationId,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun buildDeletePendingIntent(context: Context, notificationId: Int): PendingIntent {
        val deleteIntent = Intent(context, GroupChatNotificationDismissReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            notificationId,
            deleteIntent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private suspend fun buildMessagingStyle(context: Context): NotificationCompat.MessagingStyle {
        val mePerson = Person.Builder().setName("You").setKey("leafmash_me").setIcon(DmReplyMessagingService.blankIcon()).build()
        val style = NotificationCompat.MessagingStyle(mePerson)
            .setConversationTitle(CONVERSATION_TITLE)
            .setGroupConversation(true)

        val messages = GroupChatConversationStore.getMessages(context)
        val unreadCount = GroupChatConversationStore.getUnreadCount(context)
        val historicCount = (messages.size - unreadCount).coerceAtLeast(0)
        val personCache = mutableMapOf<String, Person>()

        suspend fun personFor(senderUid: String, senderName: String): Person {
            personCache[senderUid]?.let { return it }
            val photoUrl = GroupChatConversationStore.getSenderPhotoUrl(context, senderUid)
            val icon = DmAvatarLoader.load(photoUrl)
            val builder = Person.Builder().setName(senderName).setKey(senderUid).setImportant(true)
            icon?.let { builder.setIcon(it) }
            val person = builder.build()
            personCache[senderUid] = person
            return person
        }

        messages.forEachIndexed { index, message ->
            val person = if (message.fromMe) null else personFor(message.senderUid, message.senderName)
            if (index < historicCount) {
                style.addHistoricMessage(NotificationCompat.MessagingStyle.Message(message.text, message.timestamp, person))
            } else {
                style.addMessage(message.text, message.timestamp, person)
            }
        }
        return style
    }
}
