package com.example.ben

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

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
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val handler = Handler(Looper.getMainLooper())
    private val leaseExecutor = Executors.newSingleThreadExecutor()
    private val deviceId: String = "android_" + UUID.randomUUID().toString().take(8)
    private val deviceName: String = "Android Client"
    var onStreamDisplaced: ((deviceName: String) -> Unit)? = null
    var authToken: String? = null

    private val leaseHeartbeatRunnable = object : Runnable {
        override fun run() {
            if (isPlaying) {
                heartbeatStreamLease()
                handler.postDelayed(this, 15000)
            }
        }
    }

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

    var playbackSpeed: Float = 1.0f
        private set

    fun cyclePlaybackSpeed(): Float {
        val speeds = floatArrayOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        val cur = playbackSpeed
        var curIdx = speeds.indexOfFirst { kotlin.math.abs(it - cur) < 0.05f }
        if (curIdx < 0) curIdx = 2
        val nextIdx = (curIdx + 1) % speeds.size
        val newSpeed = speeds[nextIdx]
        setPlaybackSpeed(newSpeed)
        return newSpeed
    }

    fun setPlaybackSpeed(speed: Float) {
        playbackSpeed = speed
        if (activeEngine == Engine.MEDIA_PLAYER) {
            applySpeedToMediaPlayer(speed)
        } else if (activeEngine == Engine.YOUTUBE) {
            applySpeedToYouTube(speed)
        }
        listeners.forEach { it.onPlaybackSpeedChanged(speed) }
    }

    private fun applySpeedToYouTube(speed: Float) {
        webView?.post {
            webView?.evaluateJavascript(
                "if (typeof setPlaybackSpeed === 'function') { setPlaybackSpeed($speed); } else if (window.player && typeof window.player.setPlaybackRate === 'function') { window.player.setPlaybackRate($speed); }",
                null
            )
        }
    }

    private fun applySpeedToMediaPlayer(speed: Float) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            try {
                val mp = mediaPlayer ?: return
                val wasPlaying = mp.isPlaying
                val params = mp.playbackParams
                params.speed = speed
                // Lock pitch to 1.0f to prevent pitch-shifting (chipmunk at high speed / deep monster at slow speed)
                params.pitch = 1.0f
                params.audioFallbackMode = android.media.PlaybackParams.AUDIO_FALLBACK_MODE_DEFAULT
                mp.playbackParams = params
                if (!wasPlaying && mp.isPlaying) {
                    mp.pause()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set media player speed: ${e.message}")
            }
        }
    }

    fun resume() {
        if (!isPlaying) togglePlayPause()
    }

    fun updateMediaNotification() {
        val ctx = webView?.context?.applicationContext ?: return
        if (currentSong != null) {
            MediaPlaybackService.updateNotification(ctx, currentSong, isPlaying)
        }
    }

    private fun ensureAudioFocus(context: Context) {
        if (audioManager == null) {
            audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        }
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                val attr = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attr)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener { focus ->
                        when (focus) {
                            AudioManager.AUDIOFOCUS_LOSS,
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                                if (isPlaying) pause()
                            }
                            AudioManager.AUDIOFOCUS_GAIN -> {
                                if (!isPlaying && currentSong != null) resume()
                            }
                        }
                    }
                    .build()
            }
            audioFocusRequest?.let { am.requestAudioFocus(it) }
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(
                { focus ->
                    when (focus) {
                        AudioManager.AUDIOFOCUS_LOSS,
                        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                            if (isPlaying) pause()
                        }
                        AudioManager.AUDIOFOCUS_GAIN -> {
                            if (!isPlaying && currentSong != null) resume()
                        }
                    }
                },
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            )
        }
    }

    private fun abandonAudioFocus() {
        val am = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            am.abandonAudioFocus(null)
        }
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
        fun onPlaybackSpeedChanged(speed: Float) {}
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
    private var mediaPlayerProgressMs: Double = 0.0
    private var mediaPlayerLastTickTime: Long = 0L

    private val progressRunnable = object : Runnable {
        override fun run() {
            if (activeEngine == Engine.MEDIA_PLAYER && isPlaying) {
                val song = currentSong
                if (song != null) {
                    val now = System.currentTimeMillis()
                    if (mediaPlayerLastTickTime > 0) {
                        val delta = (now - mediaPlayerLastTickTime) * playbackSpeed
                        mediaPlayerProgressMs += delta
                    }
                    mediaPlayerLastTickTime = now

                    val totalDuration = song.getDurationMs()
                    val currentPos = mediaPlayerProgressMs.toInt()
                    if (currentPos >= totalDuration) {
                        Log.d(TAG, "MediaPlayer reached full song duration: ${totalDuration}ms. Auto-advancing...")
                        playNext()
                        return
                    }
                    listeners.forEach { it.onProgressUpdate(currentPos, totalDuration) }
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
                val cleanPending = pending.replace(Regex("[^a-zA-Z0-9_-]"), "")
                handler.post {
                    webView?.evaluateJavascript("loadAndPlay('$cleanPending');", null)
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
                updateMediaNotification()
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
        view.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        view.resumeTimers()
        view.settings.apply {
            javaScriptEnabled = true
            mediaPlaybackRequiresUserGesture = false
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
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
                var currentPlaybackRate = 1.0;

                function enforceSpeed() {
                  if (!player || typeof player.setPlaybackRate !== 'function') return;
                  var target = currentPlaybackRate || 1.0;
                  try {
                    player.setPlaybackRate(target);
                  } catch(e) {}
                }

                function setPlaybackSpeed(rate) {
                  var numRate = parseFloat(rate);
                  if (isNaN(numRate)) numRate = 1.0;
                  currentPlaybackRate = numRate;
                  enforceSpeed();
                }
                window.setPlaybackSpeed = setPlaybackSpeed;

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
                      modestbranding: 1,
                      iv_load_policy: 3,
                      enablejsapi: 1,
                      origin: 'https://www.youtube-nocookie.com'
                    },
                    events: {
                      onReady: function(e) {
                        isReady = true;
                        window.player = player;
                        window.ytPlayer = player;
                        try {
                          if (typeof player.setPlaybackQuality === 'function') {
                            player.setPlaybackQuality('hd720');
                          }
                        } catch(qErr) {}
                        enforceSpeed();
                        AndroidBridge.onPlayerReady();
                        if (pendingVideoId) {
                          loadAndPlay(pendingVideoId);
                          pendingVideoId = null;
                        }
                      },
                      onStateChange: function(e) {
                        if (e.data === 1) {
                          enforceSpeed();
                          try {
                            if (typeof player.setPlaybackQuality === 'function') {
                              player.setPlaybackQuality('hd720');
                            }
                          } catch(qErr) {}
                        }
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
                  }, 150);
                }

                function loadAndPlay(vId) {
                  if (!isReady || !player || typeof player.loadVideoById !== 'function') {
                    pendingVideoId = vId;
                    return;
                  }
                  try {
                    player.loadVideoById({
                      videoId: vId,
                      suggestedQuality: 'hd720'
                    });
                    player.playVideo();
                    if (typeof player.setPlaybackQuality === 'function') {
                      player.setPlaybackQuality('hd720');
                    }
                  } catch(e) {
                    player.loadVideoById(vId);
                    player.playVideo();
                  }
                  setTimeout(function() {
                    enforceSpeed();
                  }, 80);
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
        val ctx = webView?.context?.applicationContext
        if (ctx != null) {
            ensureAudioFocus(ctx)
            MediaPlaybackService.startService(ctx, song, true)
        }

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
        claimStreamLease()
        stopMediaPlayer()
        activeEngine = Engine.YOUTUBE
        isPlaying = true
        listeners.forEach {
            it.onSongChanged(song)
            it.onPlaybackStateChanged(true)
        }

        val cleanVideoId = videoId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        if (!isYtReady) {
            pendingVideoId = cleanVideoId
        }

        webView?.post {
            webView?.evaluateJavascript("loadAndPlay('$cleanVideoId');", null)
            if (playbackSpeed != 1.0f) {
                applySpeedToYouTube(playbackSpeed)
            }
        }
    }

    private fun playViaMediaPlayer(song: Song) {
        claimStreamLease()
        if (song.audioUrl.isBlank()) {
            Log.w(TAG, "Cannot play song with blank audioUrl: ${song.title}")
            isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(false) }
                updateMediaNotification()
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
                    mediaPlayerProgressMs = 0.0
                    mediaPlayerLastTickTime = System.currentTimeMillis()
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && playbackSpeed != 1.0f) {
                        applySpeedToMediaPlayer(playbackSpeed)
                    }
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
                updateMediaNotification()
                    true
                }
                prepareAsync()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing song: ${e.message}")
            isPlaying = false
            listeners.forEach { it.onPlaybackStateChanged(false) }
                updateMediaNotification()
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

    fun pause() {
        if (isPlaying) {
            togglePlayPause()
        }
    }

    fun addToQueue(song: Song) {
        queue.add(song)
        listeners.forEach {
            it.onSongChanged(currentSong ?: song)
        }
    }

    fun playNextInQueue(song: Song) {
        if (queue.isEmpty()) {
            queue.add(song)
            playSong(song)
            return
        }
        val insertIndex = queueIndex + 1
        if (insertIndex <= queue.size) {
            queue.add(insertIndex, song)
        } else {
            queue.add(song)
        }
    }

    fun clearQueue() {
        queue.clear()
        queueIndex = 0
    }

    private fun claimStreamLease() {
        val token = authToken
        if (token.isNullOrBlank()) return
        leaseExecutor.execute {
            try {
                val url = URL("http://10.0.2.2:3456/api/v1/stream/lease/claim")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 2500
                    readTimeout = 2500
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $token")
                }
                val payload = JSONObject().apply {
                    put("deviceId", deviceId)
                    put("deviceName", deviceName)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                val code = conn.responseCode
                if (code == 409) {
                    val res = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    val json = JSONObject(res)
                    val playingOn = json.optString("playingOn", "another device")
                    handler.post {
                        pause()
                        onStreamDisplaced?.invoke(playingOn)
                    }
                }
                conn.disconnect()
            } catch (_: Exception) {}
        }
        handler.removeCallbacks(leaseHeartbeatRunnable)
        handler.postDelayed(leaseHeartbeatRunnable, 15000)
    }

    private fun heartbeatStreamLease() {
        val token = authToken
        if (token.isNullOrBlank()) return
        leaseExecutor.execute {
            try {
                val url = URL("http://10.0.2.2:3456/api/v1/stream/lease/heartbeat")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 2500
                    readTimeout = 2500
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $token")
                }
                val payload = JSONObject().apply {
                    put("deviceId", deviceId)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                val code = conn.responseCode
                if (code == 409) {
                    val res = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    val json = JSONObject(res)
                    val playingOn = json.optString("playingOn", "another device")
                    handler.post {
                        pause()
                        onStreamDisplaced?.invoke(playingOn)
                    }
                }
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun releaseStreamLease() {
        handler.removeCallbacks(leaseHeartbeatRunnable)
        val token = authToken
        if (token.isNullOrBlank()) return
        leaseExecutor.execute {
            try {
                val url = URL("http://10.0.2.2:3456/api/v1/stream/lease/release")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 2000
                    readTimeout = 2000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $token")
                }
                val payload = JSONObject().apply {
                    put("deviceId", deviceId)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
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
                updateMediaNotification()
                webView?.post {
                    webView?.evaluateJavascript("pauseVideo();", null)
                }
            } else {
                isPlaying = true
                listeners.forEach { it.onPlaybackStateChanged(true) }
                updateMediaNotification()
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
                    mediaPlayerLastTickTime = 0L
                    listeners.forEach { it.onPlaybackStateChanged(false) }
                    updateMediaNotification()
                } else {
                    mediaPlayerLastTickTime = System.currentTimeMillis()
                    mp.start()
                    isPlaying = true
                    handler.post(progressRunnable)
                    listeners.forEach { it.onPlaybackStateChanged(true) }
                    updateMediaNotification()
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
            mediaPlayerProgressMs = positionMs.toDouble()
            mediaPlayerLastTickTime = System.currentTimeMillis()
            mediaPlayer?.seekTo(positionMs % 30000)
        }
    }

    fun getAudioSessionId(): Int? {
        return mediaPlayer?.audioSessionId
    }

    fun release() {
        abandonAudioFocus()
        val ctx = webView?.context?.applicationContext
        if (ctx != null) {
            MediaPlaybackService.stopService(ctx)
        }
        stopMediaPlayer()
        stopYouTube()
        webView = null
        isPlaying = false
    }
}
