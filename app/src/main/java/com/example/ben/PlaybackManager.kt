package com.example.ben

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.util.Log

object PlaybackManager {
    private const val TAG = "PlaybackManager"
    private var mediaPlayer: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())

    var currentSong: Song? = null
        private set

    var isPlaying: Boolean = false
        private set

    var queue: MutableList<Song> = mutableListOf()
        private set

    private var queueIndex: Int = 0

    interface PlaybackListener {
        fun onSongChanged(song: Song)
        fun onPlaybackStateChanged(isPlaying: Boolean)
        fun onProgressUpdate(currentPositionMs: Int, totalDurationMs: Int)
    }

    private val listeners = mutableListOf<PlaybackListener>()

    fun addListener(listener: PlaybackListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
            currentSong?.let {
                listener.onSongChanged(it)
                listener.onPlaybackStateChanged(isPlaying)
            }
        }
    }

    fun removeListener(listener: PlaybackListener) {
        listeners.remove(listener)
    }

    private val progressRunnable = object : Runnable {
        override fun run() {
            mediaPlayer?.let { mp ->
                if (mp.isPlaying) {
                    val current = mp.currentPosition
                    val duration = mp.duration
                    listeners.forEach { it.onProgressUpdate(current, duration) }
                }
            }
            if (isPlaying) {
                handler.postDelayed(this, 50)
            }
        }
    }

    fun setQueueAndPlay(songs: List<Song>, startIndex: Int = 0) {
        queue.clear()
        queue.addAll(songs)
        if (queue.isNotEmpty() && (startIndex in queue.indices)) {
            queueIndex = startIndex
            playSong(queue[queueIndex])
        }
    }

    fun playSong(song: Song) {
        currentSong = song
        if (song.audioUrl.isBlank()) {
            Log.w(TAG, "Cannot play song with blank audioUrl: ${song.title}")
            isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(isPlaying = false) }
            return
        }

        try {
            handler.removeCallbacks(progressRunnable)
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build(),
                )
                setDataSource(song.audioUrl)
                setOnPreparedListener { mp ->
                    mp.start()
                    this@PlaybackManager.isPlaying = true
                    listeners.forEach {
                        it.onSongChanged(song)
                        it.onPlaybackStateChanged(isPlaying = true)
                    }
                    handler.post(progressRunnable)
                }
                setOnCompletionListener {
                    // Continuous autoplay: next song automatically plays!
                    playNext()
                }
                setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "MediaPlayer error what=$what extra=$extra on ${song.title}")
                    this@PlaybackManager.isPlaying = false
                    handler.removeCallbacks(progressRunnable)
                    listeners.forEach { it.onPlaybackStateChanged(isPlaying = false) }
                    true // Return true to indicate error was safely handled
                }
                prepareAsync()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing song: ${e.message}")
            isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(isPlaying = false) }
        }
    }

    fun togglePlayPause() {
        val mp = mediaPlayer
        if (mp == null) {
            val songToPlay = currentSong
                ?: queue.getOrNull(queueIndex)
                ?: SpotifySearchEngine.defaultCuratedSongs.firstOrNull()
            if (songToPlay != null) {
                if (queue.isEmpty()) {
                    queue.addAll(SpotifySearchEngine.defaultCuratedSongs)
                }
                playSong(songToPlay)
            }
            return
        }

        try {
            if (mp.isPlaying) {
                mp.pause()
                isPlaying = false
                listeners.forEach { it.onPlaybackStateChanged(isPlaying = false) }
            } else {
                mp.start()
                isPlaying = true
                handler.post(progressRunnable)
                listeners.forEach { it.onPlaybackStateChanged(isPlaying = true) }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in togglePlayPause: ${e.message}, recovering...")
            // Recover from illegal state by playing afresh
            currentSong?.let { playSong(it) }
        }
    }

    fun playNext() {
        if (queue.isEmpty()) {
            queue.addAll(SpotifySearchEngine.defaultCuratedSongs)
        }
        if (queue.isEmpty()) return
        queueIndex = (queueIndex + 1) % queue.size
        playSong(queue[queueIndex])
    }

    fun playPrevious() {
        if (queue.isEmpty()) {
            queue.addAll(SpotifySearchEngine.defaultCuratedSongs)
        }
        if (queue.isEmpty()) return
        queueIndex = ((queueIndex - 1) + queue.size) % queue.size
        playSong(queue[queueIndex])
    }

    fun seekTo(positionMs: Int) {
        mediaPlayer?.seekTo(positionMs)
    }

    fun release() {
        handler.removeCallbacks(progressRunnable)
        mediaPlayer?.release()
        mediaPlayer = null
        isPlaying = false
    }
}
