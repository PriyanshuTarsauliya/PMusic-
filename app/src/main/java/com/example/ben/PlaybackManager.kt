package com.example.ben

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView

object PlaybackManager {
    private const val TAG = "PlaybackManager"

    enum class Engine {
        NONE, YOUTUBE, MEDIA_PLAYER
    }

    private var activeEngine: Engine = Engine.NONE
    private var mediaPlayer: MediaPlayer? = null
    @SuppressLint("StaticFieldLeak")
    private var webView: WebView? = null
    private var isYtReady: Boolean = false
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

    // Progress runnable for MediaPlayer fallback
    private val progressRunnable = object : Runnable {
        override fun run() {
            if (activeEngine == Engine.MEDIA_PLAYER) {
                mediaPlayer?.let { mp ->
                    if (mp.isPlaying) {
                        val current = mp.currentPosition
                        val duration = mp.duration
                        listeners.forEach { it.onProgressUpdate(current, duration) }
                    }
                }
            }
            if (isPlaying) {
                handler.postDelayed(this, 100)
            }
        }
    }

    class AndroidBridge {
        @JavascriptInterface
        fun onPlayerReady() {
            Log.d(TAG, "YouTube Player Ready on Android")
            isYtReady = true
        }

        @JavascriptInterface
        fun onStateChange(state: Int) {
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            handler.post {
                when (state) {
                    1 -> {
                        activeEngine = Engine.YOUTUBE
                        isPlaying = true
                        currentSong?.let { song ->
                            listeners.forEach {
                                it.onSongChanged(song)
                                it.onPlaybackStateChanged(true)
                            }
                        }
                    }
                    2 -> {
                        if (activeEngine == Engine.YOUTUBE) {
                            isPlaying = false
                            listeners.forEach { it.onPlaybackStateChanged(false) }
                        }
                    }
                    0 -> {
                        if (activeEngine == Engine.YOUTUBE) {
                            Log.d(TAG, "Full song ended, advancing to next track...")
                            playNext()
                        }
                    }
                }
            }
        }

        @JavascriptInterface
        fun onProgressUpdate(currentMs: Int, durationMs: Int) {
            if (activeEngine == Engine.YOUTUBE && isPlaying) {
                handler.post {
                    listeners.forEach { it.onProgressUpdate(currentMs, durationMs) }
                }
            }
        }

        @JavascriptInterface
        fun onError(code: Int) {
            Log.w(TAG, "YouTube player error code=$code, falling back to MediaPlayer")
            handler.post {
                currentSong?.let { song ->
                    playViaMediaPlayer(song)
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun attachWebView(view: WebView) {
        this.webView = view
        view.settings.apply {
            javaScriptEnabled = true
            mediaPlaybackRequiresUserGesture = false
            domStorageEnabled = true
            allowFileAccess = true
        }
        view.webChromeClient = WebChromeClient()
        view.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        val html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>html,body{margin:0;padding:0;background:#000;}</style>
            </head>
            <body>
              <div id="player"></div>
              <script src="https://www.youtube.com/iframe_api"></script>
              <script>
                var player;
                function onYouTubeIframeAPIReady() {
                  player = new YT.Player('player', {
                    height: '100%',
                    width: '100%',
                    playerVars: {
                      autoplay: 1,
                      controls: 0,
                      playsinline: 1,
                      rel: 0,
                      fs: 0,
                      origin: 'https://www.youtube.com'
                    },
                    events: {
                      onReady: function(e) { AndroidBridge.onPlayerReady(); },
                      onStateChange: function(e) { AndroidBridge.onStateChange(e.data); },
                      onError: function(e) { AndroidBridge.onError(e.data); }
                    }
                  });
                  setInterval(function() {
                    if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
                      var cur = player.getCurrentTime();
                      var dur = player.getDuration();
                      if (dur > 0) {
                        AndroidBridge.onProgressUpdate(Math.round(cur * 1000), Math.round(dur * 1000));
                      }
                    }
                  }, 100);
                }
              </script>
            </body>
            </html>
        """.trimIndent()

        view.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "UTF-8", null)
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
        listeners.forEach { it.onSongChanged(song) }

        // 1. If song already has youtubeId, play complete 100% full song via YouTube
        val yId = song.youtubeId
        if (!yId.isNullOrBlank()) {
            playViaYouTube(yId, song)
            return
        }

        // 2. Otherwise resolve YouTube full song ID in background
        SpotifySearchEngine.resolveYouTubeId(song.artist, song.title) { resolvedId ->
            if (!resolvedId.isNullOrBlank()) {
                song.youtubeId = resolvedId
                if (currentSong?.id == song.id) {
                    playViaYouTube(resolvedId, song)
                    return@resolveYouTubeId
                }
            }

            // Fallback to media player if no full song resolution available
            if (currentSong?.id == song.id) {
                playViaMediaPlayer(song)
            }
        }
    }

    private fun playViaYouTube(videoId: String, song: Song) {
        stopMediaPlayer()
        activeEngine = Engine.YOUTUBE
        isPlaying = true
        listeners.forEach {
            it.onSongChanged(song)
            it.onPlaybackStateChanged(true)
        }

        webView?.post {
            webView?.evaluateJavascript(
                "if (player && typeof player.loadVideoById === 'function') { player.loadVideoById('$videoId'); player.playVideo(); }",
                null
            )
        }
    }

    private fun playViaMediaPlayer(song: Song) {
        if (song.audioUrl.isBlank()) {
            Log.w(TAG, "Cannot play song with blank audioUrl: ${song.title}")
            isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(false) }
            return
        }

        stopYouTube()
        activeEngine = Engine.MEDIA_PLAYER

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
                        it.onPlaybackStateChanged(true)
                    }
                    handler.post(progressRunnable)
                }
                setOnCompletionListener {
                    playNext()
                }
                setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "MediaPlayer error what=$what extra=$extra on ${song.title}")
                    this@PlaybackManager.isPlaying = false
                    handler.removeCallbacks(progressRunnable)
                    listeners.forEach { it.onPlaybackStateChanged(false) }
                    true
                }
                prepareAsync()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing song: ${e.message}")
            isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(false) }
        }
    }

    private fun stopMediaPlayer() {
        handler.removeCallbacks(progressRunnable)
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (_: Exception) {}
        mediaPlayer = null
    }

    private fun stopYouTube() {
        webView?.post {
            webView?.evaluateJavascript("if (player && typeof player.stopVideo === 'function') { player.stopVideo(); }", null)
        }
    }

    fun togglePlayPause() {
        if (currentSong == null) {
            val songToPlay = queue.getOrNull(queueIndex)
                ?: SpotifySearchEngine.defaultCuratedSongs.firstOrNull()
            if (songToPlay != null) {
                if (queue.isEmpty()) {
                    queue.addAll(SpotifySearchEngine.defaultCuratedSongs)
                }
                playSong(songToPlay)
            }
            return
        }

        if (activeEngine == Engine.YOUTUBE) {
            if (isPlaying) {
                isPlaying = false
                listeners.forEach { it.onPlaybackStateChanged(false) }
                webView?.post {
                    webView?.evaluateJavascript("if (player && typeof player.pauseVideo === 'function') { player.pauseVideo(); }", null)
                }
            } else {
                isPlaying = true
                listeners.forEach { it.onPlaybackStateChanged(true) }
                webView?.post {
                    webView?.evaluateJavascript("if (player && typeof player.playVideo === 'function') { player.playVideo(); }", null)
                }
            }
            return
        }

        // Fallback for MediaPlayer
        val mp = mediaPlayer
        if (mp != null) {
            try {
                if (mp.isPlaying) {
                    mp.pause()
                    isPlaying = false
                    listeners.forEach { it.onPlaybackStateChanged(false) }
                } else {
                    mp.start()
                    isPlaying = true
                    handler.post(progressRunnable)
                    listeners.forEach { it.onPlaybackStateChanged(true) }
                }
            } catch (e: Exception) {
                currentSong?.let { playSong(it) }
            }
        } else {
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
        if (activeEngine == Engine.YOUTUBE) {
            val sec = positionMs / 1000f
            webView?.post {
                webView?.evaluateJavascript("if (player && typeof player.seekTo === 'function') { player.seekTo($sec, true); }", null)
            }
        } else {
            mediaPlayer?.seekTo(positionMs)
        }
    }

    fun release() {
        stopMediaPlayer()
        stopYouTube()
        webView = null
        isPlaying = false
    }
}
