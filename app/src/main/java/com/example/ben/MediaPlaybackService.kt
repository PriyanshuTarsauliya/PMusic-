package com.example.ben

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Foreground Service for continuous lock-screen audio playback and
 * persistent system media notification controls (Play/Pause/Skip/Artwork).
 */
class MediaPlaybackService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        const val CHANNEL_ID = "pmusic_playback_channel"
        const val CHANNEL_NAME = "PMusic Audio Playback"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.example.ben.action.START"
        const val ACTION_UPDATE = "com.example.ben.action.UPDATE"
        const val ACTION_PLAY = "com.example.ben.action.PLAY"
        const val ACTION_PAUSE = "com.example.ben.action.PAUSE"
        const val ACTION_TOGGLE = "com.example.ben.action.TOGGLE"
        const val ACTION_NEXT = "com.example.ben.action.NEXT"
        const val ACTION_PREV = "com.example.ben.action.PREV"
        const val ACTION_STOP = "com.example.ben.action.STOP"

        fun startService(context: Context, song: Song?, isPlaying: Boolean) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_START
                putExtra("title", song?.title ?: "No Song Playing")
                putExtra("artist", song?.artist ?: "PMusic")
                putExtra("album", song?.album ?: "")
                putExtra("isPlaying", isPlaying)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun updateNotification(context: Context, song: Song?, isPlaying: Boolean) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_UPDATE
                putExtra("title", song?.title ?: "No Song Playing")
                putExtra("artist", song?.artist ?: "PMusic")
                putExtra("album", song?.album ?: "")
                putExtra("isPlaying", isPlaying)
            }
            context.startService(intent)
        }

        fun stopService(context: Context) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // Acquire WakeLock so CPU keeps running when phone locks
        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
        wakeLock = powerManager?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PMusic::MediaPlaybackWakeLock")?.apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_START -> {
                val title = intent.getStringExtra("title") ?: "PMusic"
                val artist = intent.getStringExtra("artist") ?: "Streaming"
                val album = intent.getStringExtra("album") ?: ""
                val isPlaying = intent.getBooleanExtra("isPlaying", true)

                wakeLock?.acquire(24 * 60 * 60 * 1000L) // 24hr safeguard
                val notification = buildNotification(title, artist, album, isPlaying)
                startForeground(NOTIFICATION_ID, notification)
            }

            ACTION_UPDATE -> {
                val title = intent.getStringExtra("title") ?: "PMusic"
                val artist = intent.getStringExtra("artist") ?: "Streaming"
                val album = intent.getStringExtra("album") ?: ""
                val isPlaying = intent.getBooleanExtra("isPlaying", false)

                if (isPlaying) {
                    if (wakeLock?.isHeld != true) wakeLock?.acquire(24 * 60 * 60 * 1000L)
                } else {
                    if (wakeLock?.isHeld == true) wakeLock?.release()
                }

                val notification = buildNotification(title, artist, album, isPlaying)
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                manager?.notify(NOTIFICATION_ID, notification)
            }

            ACTION_TOGGLE -> {
                PlaybackManager.togglePlayPause()
            }

            ACTION_PLAY -> {
                PlaybackManager.resume()
            }

            ACTION_PAUSE -> {
                PlaybackManager.pause()
            }

            ACTION_NEXT -> {
                PlaybackManager.playNext()
            }

            ACTION_PREV -> {
                PlaybackManager.playPrevious()
            }

            ACTION_STOP -> {
                if (wakeLock?.isHeld == true) wakeLock?.release()
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            }
        }

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows now-playing track information and controls on lock screen"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(
        title: String,
        artist: String,
        album: String,
        isPlaying: Boolean
    ): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Previous Action
        val prevIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_PREV }
        val prevPending = PendingIntent.getService(this, 1, prevIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        // Play/Pause Action
        val toggleIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_TOGGLE }
        val togglePending = PendingIntent.getService(this, 2, toggleIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        // Next Action
        val nextIntent = Intent(this, MediaPlaybackService::class.java).apply { action = ACTION_NEXT }
        val nextPending = PendingIntent.getService(this, 3, nextIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        val playPauseIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
        val playPauseTitle = if (isPlaying) "Pause" else "Play"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_play)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(if (album.isNotBlank()) album else "PMusic")
            .setContentIntent(contentPendingIntent)
            .setOngoing(isPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_skip_previous, "Previous", prevPending)
            .addAction(playPauseIcon, playPauseTitle, togglePending)
            .addAction(R.drawable.ic_skip_next, "Next", nextPending)
            .build()
    }

    override fun onDestroy() {
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

