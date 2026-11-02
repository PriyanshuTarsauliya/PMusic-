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

object PlaylistManager {
    private const val PREFS_NAME = "pmusic_playlists"
    private const val KEY_PLAYLISTS = "user_playlists_json"
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var prefs: SharedPreferences? = null
    private val playlists = mutableListOf<Playlist>()
    private val listeners = mutableListOf<() -> Unit>()

    fun init(context: Context) {
        if (prefs != null) return
        prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadFromPrefs()
    }

    fun addListener(listener: () -> Unit) {
        if (!listeners.contains(listener)) listeners.add(listener)
    }

    fun removeListener(listener: () -> Unit) {
        listeners.remove(listener)
    }

    private fun notifyChanged() {
        mainHandler.post {
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

    private fun syncCreateWithBackend(pl: Playlist) {
        executor.execute {
            try {
                val url = URL("http://10.0.2.2:3456/api/user/playlists")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 2000
                    readTimeout = 2000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("action", "create")
                    put("title", pl.title)
                    put("description", pl.description)
                    put("artwork", pl.artworkUrl)
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
                val url = URL("http://10.0.2.2:3456/api/user/playlists")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 2000
                    readTimeout = 2000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val trackObj = JSONObject().apply {
                    put("id", song.id)
                    put("name", song.title)
                    put("artist", song.artist)
                    put("album", song.album)
                    put("artwork", song.artworkUrl ?: "")
                    put("durationFormatted", song.durationFormatted)
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
                val url = URL("http://10.0.2.2:3456/api/user/playlists")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 2000
                    readTimeout = 2000
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
                val url = URL("http://10.0.2.2:3456/api/user/playlists/" + playlistId)
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "DELETE"
                    connectTimeout = 2000
                    readTimeout = 2000
                }
                conn.responseCode
                conn.disconnect()
            } catch (_: Exception) {}
        }
    }
}

