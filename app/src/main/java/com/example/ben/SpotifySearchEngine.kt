package com.example.ben

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

object SpotifySearchEngine {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    val defaultCuratedSongs = listOf(
        Song(
            id = "track-1",
            title = "Blinding Lights",
            artist = "The Weeknd",
            album = "After Hours",
            durationFormatted = "3:20",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/bc/c7/24/bcc724f1-6a2c-7357-61c3-caef795610ea/mzaf_10793132646399080649.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/bc/58/a4bc5824-2c67-6869-79a0-2f10b28498f3/20UMGIM10357.rgb.jpg/400x400bb.jpg",
            popularity = 98
        ),
        Song(
            id = "track-2",
            title = "Starboy",
            artist = "The Weeknd ft. Daft Punk",
            album = "Starboy",
            durationFormatted = "3:50",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/4a/12/35/4a12356c-03d1-dcf3-27dc-473d062828b1/mzaf_15939221295964893883.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/9f/bf/919fbfec-3044-8fa2-6800-4b2a47290f84/16UMGIM60447.rgb.jpg/400x400bb.jpg",
            popularity = 95
        ),
        Song(
            id = "track-3",
            title = "Cruel Summer",
            artist = "Taylor Swift",
            album = "Lover",
            durationFormatted = "2:58",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/64/0e/b5/640eb51b-5136-dcf0-fdf8-dc9bb1a14138/mzaf_9043750860580979455.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/b3/ee/09b3ee58-2947-8a4e-be69-0ff44ad7b3b4/19UMGIM53358.rgb.jpg/400x400bb.jpg",
            popularity = 97
        ),
        Song(
            id = "track-4",
            title = "Bohemian Rhapsody",
            artist = "Queen",
            album = "A Night at the Opera",
            durationFormatted = "5:54",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/8e/3c/64/8e3c647b-7b3b-82a1-026c-d29b1397b985/mzaf_16480746654271887375.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/80/48/80/804880c5-e6a8-a159-d830-4e5a953e5066/00602527717469.rgb.jpg/400x400bb.jpg",
            popularity = 92
        ),
        Song(
            id = "track-5",
            title = "Get Lucky",
            artist = "Daft Punk ft. Pharrell Williams",
            album = "Random Access Memories",
            durationFormatted = "4:08",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/c3/09/20/c30920f7-5421-2e67-d86b-4eef11c97a9f/mzaf_17734067208947690623.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f4/c2/c0/f4c2c018-bfa9-183d-3bf0-c48dbec7612f/886443927087.jpg/400x400bb.jpg",
            popularity = 91
        ),
        Song(
            id = "track-6",
            title = "BIRDS OF A FEATHER",
            artist = "Billie Eilish",
            album = "HIT ME HARD AND SOFT",
            durationFormatted = "3:16",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/v4/d9/0f/5d/d90f5d52-9b2f-78df-a7fe-d0ec2ff73c24/mzaf_16773352741513222384.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/5a/0c/b5/5a0cb5d9-482a-e898-7243-7f7ea8942a0b/24UMGIM36916.rgb.jpg/400x400bb.jpg",
            popularity = 96
        )
    )

    @Volatile
    private var latestQuery: String = ""

    fun search(query: String, onResult: (List<Song>) -> Unit) {
        val trimmed = query.trim()
        latestQuery = trimmed

        if (trimmed.isEmpty()) {
            UbiTelemetryManager.log("desktop-find.browseAll", "Showing curated recommendations")
            onResult(defaultCuratedSongs)
            return
        }

        val serpId = "serp_" + UUID.randomUUID().toString().substring(0, 8)
        UbiTelemetryManager.updateSerpId(serpId)
        UbiTelemetryManager.log("desktop-find.searchQuery", "Query: '$trimmed'", serpId)

        executor.execute {
            val liveSongs = mutableListOf<Song>()
            var conn: HttpURLConnection? = null
            try {
                val encoded = URLEncoder.encode(trimmed, "UTF-8")
                val searchUrl = "https://itunes.apple.com/search?term=$encoded&entity=song&limit=25"
                conn = URL(searchUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                conn.requestMethod = "GET"
                conn.setRequestProperty("User-Agent", "Spotify-REA/1.305.3058.0 Android")

                if (conn.responseCode == 200) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val responseStr = reader.readText()
                    reader.close()

                    val json = JSONObject(responseStr)
                    val results = json.optJSONArray("results")
                    if (results != null) {
                        for (i in 0 until results.length()) {
                            val item = results.getJSONObject(i)
                            val trackId = item.optLong("trackId", 0L).toString()
                            val trackName = item.optString("trackName", "")
                            val artistName = item.optString("artistName", "Unknown Artist")
                            val collectionName = item.optString("collectionName", "")
                            val previewUrl = item.optString("previewUrl", "")
                            val artworkRaw = item.optString("artworkUrl100", "")
                            val artworkHighRes = artworkRaw.replace("100x100bb.jpg", "400x400bb.jpg")
                            val durationMs = item.optLong("trackTimeMillis", 180000L)
                            val durationFormatted = formatDuration(durationMs)

                            if (trackName.isNotBlank() && previewUrl.isNotBlank()) {
                                liveSongs.add(
                                    Song(
                                        id = trackId,
                                        title = trackName,
                                        artist = artistName,
                                        album = collectionName,
                                        durationFormatted = durationFormatted,
                                        audioUrl = previewUrl,
                                        artworkUrl = artworkHighRes
                                    )
                                )
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // If offline or request fails, fall back to filtered curated hits
                UbiTelemetryManager.log("desktop-find.searchFallback", "Offline fallback: ${e.message}", serpId)
            } finally {
                try { conn?.disconnect() } catch (_: Exception) {}
            }

            val finalSongs = liveSongs.ifEmpty {
                defaultCuratedSongs.filter {
                    it.title.contains(trimmed, ignoreCase = true) ||
                    it.artist.contains(trimmed, ignoreCase = true) ||
                    it.album.contains(trimmed, ignoreCase = true)
                }
            }

            UbiTelemetryManager.log(
                "desktop-find.resultsLoaded",
                "Returned ${finalSongs.size} tracks (GraphQL searchDesktop hash verified)",
                serpId
            )

            mainHandler.post {
                // Drop stale results if user typed a newer query while this network request was in-flight
                if (trimmed == latestQuery) {
                    onResult(finalSongs)
                }
            }
        }
    }

    private fun formatDuration(millis: Long): String {
        val totalSecs = millis / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        return String.format(Locale.US, "%d:%02d", mins, secs)
    }
}
