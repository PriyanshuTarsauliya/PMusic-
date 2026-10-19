package com.example.ben

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

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
    private var pendingVideoId: String? = null
    private val handler = Handler(Looper.getMainLooper())

    private var mediaPlayerStartTimeMs: Long = 0L
    private var mediaPlayerSeekOffsetMs: Long = 0L

    var currentSong: Song? = null
        private set

    var isPlaying: Boolean = false
        private set

    var queue: MutableList<Song> = mutableListOf()
        private set

    private var queueIndex: Int = 0

    enum class RepeatMode {
        OFF, ALL, ONE
    }

    var isShuffleEnabled: Boolean = false
        private set

    var repeatMode: RepeatMode = RepeatMode.OFF
        private set

    fun toggleShuffle(): Boolean {
        isShuffleEnabled = !isShuffleEnabled
        notifyPlaybackModes()
        return isShuffleEnabled
    }

    fun toggleRepeat(): RepeatMode {
        repeatMode = when (repeatMode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        notifyPlaybackModes()
        return repeatMode
    }

    private fun notifyPlaybackModes() {
        listeners.forEach {
            it.onPlaybackModeChanged(isShuffleEnabled, repeatMode)
        }
    }

    interface PlaybackListener {
        fun onSongChanged(song: Song)
        fun onPlaybackStateChanged(isPlaying: Boolean)
        fun onProgressUpdate(currentPositionMs: Int, totalDurationMs: Int)
        fun onPlaybackModeChanged(isShuffle: Boolean, repeatMode: RepeatMode) {}
    }

    private val listeners = mutableListOf<PlaybackListener>()

    fun addListener(listener: PlaybackListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
            currentSong?.let {
                listener.onSongChanged(it)
                listener.onPlaybackStateChanged(isPlaying)
            }
            listener.onPlaybackModeChanged(isShuffleEnabled, repeatMode)
        }
    }

    fun removeListener(listener: PlaybackListener) {
        listeners.remove(listener)
    }

    // Progress runnable for MediaPlayer fallback (tracks 100% full song duration)
    private val progressRunnable = object : Runnable {
        override fun run() {
            if (activeEngine == Engine.MEDIA_PLAYER && isPlaying) {
                val song = currentSong
                if (song != null) {
                    val totalDuration = song.getDurationMs()
                    val elapsed = (System.currentTimeMillis() - mediaPlayerStartTimeMs) + mediaPlayerSeekOffsetMs
                    if (elapsed >= totalDuration) {
                        Log.d(TAG, "MediaPlayer reached full song duration: ${totalDuration}ms. Auto-advancing...")
                        playNext()
                        return
                    }
                    listeners.forEach { it.onProgressUpdate(elapsed.toInt(), totalDuration) }
                }
            }
            if (isPlaying) {
                handler.postDelayed(this, 150)
            }
        }
    }

    class AndroidBridge {
        @JavascriptInterface
        fun onPlayerReady() {
            Log.d(TAG, "YouTube Player Ready on Android")
            isYtReady = true
            val pending = pendingVideoId
            if (!pending.isNullOrBlank()) {
                pendingVideoId = null
                handler.post {
                    webView?.evaluateJavascript("loadAndPlay('$pending');", null)
                }
            }
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
                            Log.d(TAG, "Full YouTube song completed, auto-advancing to next track...")
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
                    val song = currentSong
                    val actualTotal = if (durationMs > 30000) durationMs else (song?.getDurationMs() ?: durationMs)
                    listeners.forEach { it.onProgressUpdate(currentMs, actualTotal) }
                }
            }
        }

        @JavascriptInterface
        fun onError(code: Int) {
            Log.w(TAG, "YouTube player error code=$code, falling back to seamless audio engine")
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
            loadWithOverviewMode = true
            useWideViewPort = true
            // Modern Chrome User-Agent prevents YouTube error 150 on mobile webview
            userAgentString = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        }
        view.webChromeClient = WebChromeClient()
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = false
        }
        view.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        val html = """
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
              <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                html, body { width:100%; height:100%; background:#000; overflow:hidden; }
                #player { width:100%; height:100%; }
              </style>
            </head>
            <body>
              <div id="player"></div>
              <script>
                var tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api";
                var firstScript = document.getElementsByTagName('script')[0];
                firstScript.parentNode.insertBefore(tag, firstScript);

                var player = null;
                var isReady = false;
                var pendingVideoId = null;

                function onYouTubeIframeAPIReady() {
                  player = new YT.Player('player', {
                    height: '100%',
                    width: '100%',
                    videoId: 'fHI8X4OXluQ',
                    playerVars: {
                      autoplay: 0,
                      controls: 0,
                      playsinline: 1,
                      rel: 0,
                      fs: 0,
                      origin: 'https://www.youtube-nocookie.com'
                    },
                    events: {
                      onReady: function(e) {
                        isReady = true;
                        AndroidBridge.onPlayerReady();
                        if (pendingVideoId) {
                          loadAndPlay(pendingVideoId);
                          pendingVideoId = null;
                        }
                      },
                      onStateChange: function(e) {
                        AndroidBridge.onStateChange(e.data);
                      },
                      onError: function(e) {
                        AndroidBridge.onError(e.data);
                      }
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
                  }, 200);
                }

                function loadAndPlay(vId) {
                  if (!isReady || !player || typeof player.loadVideoById !== 'function') {
                    pendingVideoId = vId;
                    return;
                  }
                  player.loadVideoById(vId);
                  player.playVideo();
                }

                function pauseVideo() {
                  if (player && typeof player.pauseVideo === 'function') {
                    player.pauseVideo();
                  }
                }

                function playVideo() {
                  if (player && typeof player.playVideo === 'function') {
                    player.playVideo();
                  }
                }

                function stopVideo() {
                  if (player && typeof player.stopVideo === 'function') {
                    player.stopVideo();
                  }
                }

                function seekTo(sec) {
                  if (player && typeof player.seekTo === 'function') {
                    player.seekTo(sec, true);
                  }
                }
              </script>
            </body>
            </html>
        """.trimIndent()

        view.loadDataWithBaseURL("https://www.youtube-nocookie.com", html, "text/html", "UTF-8", null)
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

        // 2. Play immediate audio fallback while resolving YouTube full song ID in background
        if (song.audioUrl.isNotBlank()) {
            playViaMediaPlayer(song)
        }

        // 3. Resolve YouTube full song ID in background
        SpotifySearchEngine.resolveYouTubeId(song.artist, song.title) { resolvedId ->
            if (!resolvedId.isNullOrBlank()) {
                song.youtubeId = resolvedId
                if (currentSong?.id == song.id) {
                    playViaYouTube(resolvedId, song)
                }
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

        if (!isYtReady) {
            pendingVideoId = videoId
        }

        webView?.post {
            webView?.evaluateJavascript("loadAndPlay('$videoId');", null)
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
                isLooping = true // Keep looping audio until complete song duration is finished
                setOnPreparedListener { mp ->
                    mediaPlayerStartTimeMs = System.currentTimeMillis()
                    mediaPlayerSeekOffsetMs = 0L
                    mp.start()
                    this@PlaybackManager.isPlaying = true
                    listeners.forEach {
                        it.onSongChanged(song)
                        it.onPlaybackStateChanged(true)
                    }
                    handler.post(progressRunnable)
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
            webView?.evaluateJavascript("stopVideo();", null)
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
                    webView?.evaluateJavascript("pauseVideo();", null)
                }
            } else {
                isPlaying = true
                listeners.forEach { it.onPlaybackStateChanged(true) }
                webView?.post {
                    webView?.evaluateJavascript("playVideo();", null)
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
                    mediaPlayerSeekOffsetMs += (System.currentTimeMillis() - mediaPlayerStartTimeMs)
                    listeners.forEach { it.onPlaybackStateChanged(false) }
                } else {
                    mediaPlayerStartTimeMs = System.currentTimeMillis()
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

        if (repeatMode == RepeatMode.ONE && currentSong != null) {
            seekTo(0)
            playSong(currentSong!!)
            return
        }

        if (isShuffleEnabled && queue.size > 1) {
            var nextIndex = queueIndex
            while (nextIndex == queueIndex) {
                nextIndex = (0 until queue.size).random()
            }
            queueIndex = nextIndex
        } else {
            queueIndex = (queueIndex + 1) % queue.size
        }
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
                webView?.evaluateJavascript("seekTo($sec);", null)
            }
        } else {
            mediaPlayerSeekOffsetMs = positionMs.toLong()
            mediaPlayerStartTimeMs = System.currentTimeMillis()
            mediaPlayer?.seekTo(positionMs % 30000)
        }
    }

    fun release() {
        stopMediaPlayer()
        stopYouTube()
        webView = null
        isPlaying = false
    }
}
