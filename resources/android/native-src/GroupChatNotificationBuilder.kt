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
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

object GroupChatNotificationBuilder {

    const val CHANNEL_ID = "leafmash_classchat_channel_v1"
    const val CONVERSATION_TITLE = "Department Chat"

    suspend fun buildAndShow(context: Context, url: String) {
        val notificationId = GroupChatConversationStore.CONVERSATION_ID.hashCode()
        ensureChannel(context)

        val (style, latestSenderPerson, latestSenderIcon) = buildMessagingStyle(context)
        if (latestSenderPerson != null) {
            ensureConversationShortcut(context, latestSenderIcon, latestSenderPerson, url)
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(DmReplyMessagingService.resolveIcon(context))
            .setStyle(style)
            .setAutoCancel(true)
            .setContentIntent(buildOpenPendingIntent(context, notificationId, url))
            .setDeleteIntent(buildDeletePendingIntent(context, notificationId))
            .addAction(buildReplyAction(context, notificationId))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setNumber(GroupChatConversationStore.getUnreadCount(context))
            .setShortcutId(GroupChatConversationStore.CONVERSATION_ID)
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

    private fun ensureConversationShortcut(context: Context, icon: IconCompat?, person: Person, url: String) {
        val shortcutIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            putExtra("leafmash_url", url)
            putExtra("leafmash_conversation_id", GroupChatConversationStore.CONVERSATION_ID)
        }
        val shortcutBuilder = ShortcutInfoCompat.Builder(context, GroupChatConversationStore.CONVERSATION_ID)
            .setShortLabel(CONVERSATION_TITLE)
            .setLongLived(true)
            .setPerson(person)
            .setIntent(shortcutIntent)
            .setCategories(setOf("android.shortcut.conversation"))
        icon?.let { shortcutBuilder.setIcon(it) }
        ShortcutManagerCompat.pushDynamicShortcut(context, shortcutBuilder.build())
    }

    private suspend fun buildMessagingStyle(context: Context): Triple<NotificationCompat.MessagingStyle, Person?, IconCompat?> {
        val mePerson = Person.Builder().setName("You").setKey("leafmash_me").setIcon(DmReplyMessagingService.blankIcon()).build()
        val style = NotificationCompat.MessagingStyle(mePerson)
            .setConversationTitle(CONVERSATION_TITLE)
            .setGroupConversation(true)

        val messages = GroupChatConversationStore.getMessages(context)
        val unreadCount = GroupChatConversationStore.getUnreadCount(context)
        val historicCount = (messages.size - unreadCount).coerceAtLeast(0)
        val personCache = mutableMapOf<String, Person>()
        val iconCache = mutableMapOf<String, IconCompat?>()
        var latestSenderUid: String? = null

        suspend fun personFor(senderUid: String, senderName: String): Person {
            personCache[senderUid]?.let { return it }
            val photoUrl = GroupChatConversationStore.getSenderPhotoUrl(context, senderUid)
            val icon = DmAvatarLoader.load(photoUrl)
            iconCache[senderUid] = icon
            val builder = Person.Builder().setName(senderName).setKey(senderUid).setImportant(true)
            icon?.let { builder.setIcon(it) }
            val person = builder.build()
            personCache[senderUid] = person
            return person
        }

        messages.forEachIndexed { index, message ->
            val person = if (message.fromMe) null else personFor(message.senderUid, message.senderName)
            if (!message.fromMe) latestSenderUid = message.senderUid
            if (index < historicCount) {
                style.addHistoricMessage(NotificationCompat.MessagingStyle.Message(message.text, message.timestamp, person))
            } else {
                style.addMessage(message.text, message.timestamp, person)
            }
        }

        val representativePerson = latestSenderUid?.let { personCache[it] }
        val representativeIcon = latestSenderUid?.let { iconCache[it] }
        return Triple(style, representativePerson, representativeIcon)
    }
}
