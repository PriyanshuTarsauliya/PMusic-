package com.example.ben

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Manages liked songs and library persistence across Android local storage and the
 * remote Spotify backend database (/api/user/library).
 * Enables seamless cross-platform sharing of user likes between Web and Android clients.
 */
object UserLibraryManager {
    private const val PREFS_NAME = "pmusic_user_library"
    private const val KEY_LIKED_TRACKS = "saved_liked_tracks_json"
    private val executor = Executors.newSingleThreadExecutor()
    private fun postToMain(action: () -> Unit) {
        try {
            Handler(Looper.getMainLooper()).post(action)
        } catch (_: Exception) {
            action.invoke()
        }
    }

    private var prefs: SharedPreferences? = null
    private val likedSongs = mutableListOf<Song>()
    private val likedTrackIds = mutableSetOf<String>()
    private val listeners = mutableListOf<() -> Unit>()

    fun init(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            loadFromPrefs()
        }
    }

    fun addListener(listener: () -> Unit) {
        if (!listeners.contains(listener)) listeners.add(listener)
    }

    fun removeListener(listener: () -> Unit) {
        listeners.remove(listener)
    }

    private fun notifyChanged() {
        postToMain {
            listeners.forEach { it.invoke() }
        }
    }

    fun isLiked(songId: String): Boolean = likedTrackIds.contains(songId)

    fun getLikedSongs(): List<Song> {
        return likedSongs.toList()
    }

    fun getLikedCount(): Int = likedTrackIds.size

    fun toggleLike(song: Song, authToken: String, onComplete: (() -> Unit)? = null) {
        val newLikedState = !song.isLiked
        song.isLiked = newLikedState

        // Synchronize in-memory flag across default curated catalog
        SpotifySearchEngine.defaultCuratedSongs.find { it.id == song.id }?.isLiked = newLikedState

        if (newLikedState) {
            likedTrackIds.add(song.id)
            if (likedSongs.none { it.id == song.id }) {
                likedSongs.add(0, song.copy(isLiked = true))
            }
        } else {
            likedTrackIds.remove(song.id)
            likedSongs.removeAll { it.id == song.id }
        }

        saveToPrefs()
        notifyChanged()
        onComplete?.invoke()

        // Push update to server account database
        syncSaveToBackend(authToken)
    }

    fun syncFromBackend(authToken: String, onComplete: ((List<Song>) -> Unit)? = null) {
        if (authToken.isBlank()) {
            postToMain { onComplete?.invoke(getLikedSongs()) }
            return
        }

        executor.execute {
            try {
                val url = URL("http://10.0.2.2:3456/api/user/library")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 3000
                    readTimeout = 3000
                    setRequestProperty("Authorization", "Bearer $authToken")
                }

                if (conn.responseCode == 200) {
                    val res = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(res)
                    val arr = json.optJSONArray("tracks")
                    if (arr != null) {
                        val remoteSongs = mutableListOf<Song>()
                        for (i in 0 until arr.length()) {
                            val obj = arr.optJSONObject(i) ?: continue
                            val s = parseSongFromJson(obj)
                            remoteSongs.add(s)
                        }

                        // Merge server tracks with local favorites
                        val merged = mutableMapOf<String, Song>()
                        remoteSongs.forEach { merged[it.id] = it }
                        likedSongs.forEach { merged[it.id] = it }

                        likedSongs.clear()
                        likedSongs.addAll(merged.values)
                        likedTrackIds.clear()
                        likedTrackIds.addAll(likedSongs.map { it.id })

                        // Sync isLiked state with defaultCuratedSongs
                        SpotifySearchEngine.defaultCuratedSongs.forEach { cur ->
                            cur.isLiked = likedTrackIds.contains(cur.id)
                        }

                        saveToPrefs()
                        notifyChanged()

                        // If local has more tracks than server, push full merged library up
                        if (likedSongs.size > remoteSongs.size) {
                            syncSaveToBackend(authToken)
                        }
                    }
                }
                conn.disconnect()
            } catch (_: Exception) {}

            postToMain {
                onComplete?.invoke(getLikedSongs())
            }
        }
    }

    fun syncSaveToBackend(authToken: String) {
        if (authToken.isBlank()) return

        executor.execute {
            try {
                val url = URL("http://10.0.2.2:3456/api/user/library")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3000
                    readTimeout = 3000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $authToken")
                }

                val arr = JSONArray()
                likedSongs.forEach { song ->
                    val sObj = JSONObject().apply {
                        put("id", song.id)
                        put("name", song.title)
                        put("title", song.title)
                        put("artist", song.artist)
                        put("album", song.album)
                        put("durationFormatted", song.durationFormatted)
                        put("duration", song.getDurationMs() / 1000)
                        put("artwork", song.artworkUrl ?: "")
                        put("artworkUrl", song.artworkUrl ?: "")
                        put("previewUrl", song.audioUrl)
                        put("audioUrl", song.audioUrl)
                        put("youtubeId", song.youtubeId ?: "")
                    }
                    arr.put(sObj)
                }

                val payload = JSONObject().apply {
                    put("tracks", arr)
                }

                conn.outputStream.use { os ->
                    os.write(payload.toString().toByteArray(Charsets.UTF_8))
                }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun loadFromPrefs() {
        val jsonStr = prefs?.getString(KEY_LIKED_TRACKS, null)
        likedSongs.clear()
        likedTrackIds.clear()

        if (!jsonStr.isNullOrBlank()) {
            try {
                val arr = JSONArray(jsonStr)
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val s = parseSongFromJson(obj)
                    likedSongs.add(s)
                    likedTrackIds.add(s.id)
                }
            } catch (_: Exception) {}
        }

        // Apply isLiked status to default catalog
        SpotifySearchEngine.defaultCuratedSongs.forEach { cur ->
            cur.isLiked = likedTrackIds.contains(cur.id)
        }
    }

    private fun saveToPrefs() {
        val arr = JSONArray()
        likedSongs.forEach { s ->
            val obj = JSONObject().apply {
                put("id", s.id)
                put("title", s.title)
                put("artist", s.artist)
                put("album", s.album)
                put("durationFormatted", s.durationFormatted)
                put("audioUrl", s.audioUrl)
                put("artworkUrl", s.artworkUrl ?: "")
                put("isLiked", true)
                put("popularity", s.popularity)
                put("youtubeId", s.youtubeId ?: "")
                put("durationMs", s.durationMs)
            }
            arr.put(obj)
        }
        prefs?.edit()?.putString(KEY_LIKED_TRACKS, arr.toString())?.apply()
    }

    fun parseSongFromJson(obj: JSONObject): Song {
        val id = obj.optString("id", "t-" + System.currentTimeMillis())
        val title = if (obj.has("title")) obj.optString("title") else obj.optString("name", "Unknown Title")
        val artist = obj.optString("artist", "Unknown Artist")
        val album = obj.optString("album", "Single")
        val durationFormatted = obj.optString("durationFormatted", "3:20")
        val audioUrl = if (obj.has("audioUrl")) obj.optString("audioUrl") else obj.optString("previewUrl", "")
        val rawArtwork = if (obj.has("artworkUrl")) obj.optString("artworkUrl") else obj.optString("artwork", "")
        val artworkUrl = rawArtwork.takeIf { it.isNotBlank() }
        val youtubeId = obj.optString("youtubeId", "").takeIf { it.isNotBlank() }
        val popularity = obj.optInt("popularity", 90)
        val durationMs = obj.optLong("durationMs", 0L)

        return Song(
            id = id,
            title = title,
            artist = artist,
            album = album,
            durationFormatted = durationFormatted,
            audioUrl = audioUrl,
            artworkUrl = artworkUrl,
            isLiked = true,
            popularity = popularity,
            youtubeId = youtubeId,
            durationMs = durationMs
        )
    }

    fun importFromLogin(userJson: JSONObject, authToken: String) {
        val tracksArr = userJson.optJSONArray("library")
        if (tracksArr != null) {
            for (i in 0 until tracksArr.length()) {
                val obj = tracksArr.optJSONObject(i) ?: continue
                val s = parseSongFromJson(obj)
                if (likedSongs.none { it.id == s.id }) {
                    likedSongs.add(s)
                }
                likedTrackIds.add(s.id)
            }
        }
        val likedArr = userJson.optJSONArray("likedTracks")
        if (likedArr != null) {
            for (i in 0 until likedArr.length()) {
                val tid = likedArr.optString(i)
                if (tid.isNotBlank()) likedTrackIds.add(tid)
            }
        }
        SpotifySearchEngine.defaultCuratedSongs.forEach { cur ->
            cur.isLiked = likedTrackIds.contains(cur.id)
        }
        saveToPrefs()
        notifyChanged()
    }
}
