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
 * Manages custom user playlists, local cache, and bidirectional sync with
 * the backend server (/api/user/playlists).
 * Shares custom playlists seamlessly between Web and Android sessions.
 */
object PlaylistManager {
    private const val PREFS_NAME = "pmusic_playlists"
    private const val KEY_PLAYLISTS = "user_playlists_json"
    private val executor = Executors.newSingleThreadExecutor()
    private fun postToMain(action: () -> Unit) {
        try {
            Handler(Looper.getMainLooper()).post(action)
        } catch (_: Exception) {
            action.invoke()
        }
    }

    private var prefs: SharedPreferences? = null
    private val playlists = mutableListOf<Playlist>()
    private val listeners = mutableListOf<() -> Unit>()

    fun init(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            loadFromPrefs()
            syncFromBackend()
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

    fun getPlaylists(): List<Playlist> {
        return playlists.toList()
    }

    fun getPlaylist(id: String): Playlist? {
        return playlists.find { it.id == id }
    }

    fun createPlaylist(title: String, description: String = "Created by you", initialTrack: Song? = null): Playlist {
        val id = "pl-" + System.currentTimeMillis() + "-" + (1000..9999).random()
        val pl = Playlist(
            id = id,
            title = title.ifBlank { "My Playlist #${playlists.size + 1}" },
            description = description.ifBlank { "Created by you" },
            artworkUrl = initialTrack?.artworkUrl ?: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
            curator = "You",
            tracks = if (initialTrack != null) mutableListOf(initialTrack) else mutableListOf()
        )
        playlists.add(0, pl)
        saveToPrefs()
        notifyChanged()
        syncCreateWithBackend(pl)
        return pl
    }

    fun addSongToPlaylist(playlistId: String, song: Song): Boolean {
        val pl = playlists.find { it.id == playlistId } ?: return false
        if (pl.tracks.any { it.id == song.id }) return false
        pl.tracks.add(song)
        if (pl.artworkUrl.contains("unsplash") && !song.artworkUrl.isNullOrBlank()) {
            pl.artworkUrl = song.artworkUrl
        }
        saveToPrefs()
        notifyChanged()
        syncAddTrackWithBackend(playlistId, song)
        return true
    }

    fun removeSongFromPlaylist(playlistId: String, songId: String): Boolean {
        val pl = playlists.find { it.id == playlistId } ?: return false
        val removed = pl.tracks.removeAll { it.id == songId }
        if (removed) {
            saveToPrefs()
            notifyChanged()
            syncRemoveTrackWithBackend(playlistId, songId)
        }
        return removed
    }

    fun deletePlaylist(playlistId: String): Boolean {
        val removed = playlists.removeAll { it.id == playlistId }
        if (removed) {
            saveToPrefs()
            notifyChanged()
            syncDeleteWithBackend(playlistId)
        }
        return removed
    }

    private fun loadFromPrefs() {
        val jsonStr = prefs?.getString(KEY_PLAYLISTS, null)
        playlists.clear()
        if (!jsonStr.isNullOrBlank()) {
            try {
                val arr = JSONArray(jsonStr)
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    playlists.add(Playlist.fromJson(obj))
                }
            } catch (_: Exception) {}
        }

        // Seed with a sample playlist if empty
        if (playlists.isEmpty()) {
            val sample = Playlist(
                id = "pl-favorites",
                title = "My Daily Favorites",
                description = "Handpicked tracks for daily listening",
                artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/bc/58/a4bc5824-2c67-6869-79a0-2f10b28498f3/20UMGIM10357.rgb.jpg/400x400bb.jpg",
                curator = "You",
                tracks = SpotifySearchEngine.defaultCuratedSongs.take(4).toMutableList()
            )
            playlists.add(sample)
            saveToPrefs()
        }
    }

    private fun saveToPrefs() {
        val arr = JSONArray()
        playlists.forEach { arr.put(it.toJson()) }
        prefs?.edit()?.putString(KEY_PLAYLISTS, arr.toString())?.apply()
    }

    fun syncFromBackend(onComplete: (() -> Unit)? = null) {
        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/playlists"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 3000
                    readTimeout = 3000
                }

                if (conn.responseCode == 200) {
                    val res = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(res)
                    val arr = json.optJSONArray("playlists")
                    if (arr != null) {
                        var updated = false
                        for (i in 0 until arr.length()) {
                            val pObj = arr.optJSONObject(i) ?: continue
                            val remotePl = Playlist.fromJson(pObj)

                            val existing = playlists.find { it.id == remotePl.id || it.title.equals(remotePl.title, true) }
                            if (existing == null) {
                                playlists.add(remotePl)
                                updated = true
                            } else {
                                // Merge remote tracks into existing playlist
                                remotePl.tracks.forEach { rTrack ->
                                    if (existing.tracks.none { it.id == rTrack.id }) {
                                        existing.tracks.add(rTrack)
                                        updated = true
                                    }
                                }
                            }
                        }

                        if (updated) {
                            saveToPrefs()
                            notifyChanged()
                        }
                    }
                }
                conn.disconnect()
            } catch (_: Exception) {}

            postToMain {
                onComplete?.invoke()
            }
        }
    }

    private fun syncCreateWithBackend(pl: Playlist) {
        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/playlists"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3000
                    readTimeout = 3000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }

                val tracksArr = JSONArray()
                pl.tracks.forEach { s ->
                    val tObj = JSONObject().apply {
                        put("id", s.id)
                        put("name", s.title)
                        put("title", s.title)
                        put("artist", s.artist)
                        put("album", s.album)
                        put("artwork", s.artworkUrl ?: "")
                        put("artworkUrl", s.artworkUrl ?: "")
                        put("previewUrl", s.audioUrl)
                        put("audioUrl", s.audioUrl)
                        put("durationFormatted", s.durationFormatted)
                        put("youtubeId", s.youtubeId ?: "")
                    }
                    tracksArr.put(tObj)
                }

                val payload = JSONObject().apply {
                    put("action", "create")
                    put("id", pl.id)
                    put("title", pl.title)
                    put("description", pl.description)
                    put("artwork", pl.artworkUrl)
                    put("curator", pl.curator)
                    put("tracks", tracksArr)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun syncAddTrackWithBackend(playlistId: String, song: Song) {
        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/playlists"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3000
                    readTimeout = 3000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val trackObj = JSONObject().apply {
                    put("id", song.id)
                    put("name", song.title)
                    put("title", song.title)
                    put("artist", song.artist)
                    put("album", song.album)
                    put("artwork", song.artworkUrl ?: "")
                    put("artworkUrl", song.artworkUrl ?: "")
                    put("previewUrl", song.audioUrl)
                    put("audioUrl", song.audioUrl)
                    put("durationFormatted", song.durationFormatted)
                    put("youtubeId", song.youtubeId ?: "")
                }
                val payload = JSONObject().apply {
                    put("action", "addTrack")
                    put("playlistId", playlistId)
                    put("track", trackObj)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun syncRemoveTrackWithBackend(playlistId: String, songId: String) {
        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/playlists"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3000
                    readTimeout = 3000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("action", "removeTrack")
                    put("playlistId", playlistId)
                    put("trackId", songId)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray()) }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }

    private fun syncDeleteWithBackend(playlistId: String) {
        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/playlists/") + playlistId)
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "DELETE"
                    connectTimeout = 3000
                    readTimeout = 3000
                }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }
}
