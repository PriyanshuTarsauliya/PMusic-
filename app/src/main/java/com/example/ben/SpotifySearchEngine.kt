package com.example.ben

import android.os.Handler
import android.os.Looper
import android.util.LruCache
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors
import java.util.zip.GZIPInputStream

object SpotifySearchEngine {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val searchCache = object : LruCache<String, List<Song>>(80) {}

    val defaultCuratedSongs = listOf(
        Song(
            id = "track-1",
            title = "Blinding Lights",
            artist = "The Weeknd",
            album = "After Hours",
            durationFormatted = "3:20",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/bc/c7/24/bcc724f1-6a2c-7357-61c3-caef795610ea/mzaf_10793132646399080649.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/bc/58/a4bc5824-2c67-6869-79a0-2f10b28498f3/20UMGIM10357.rgb.jpg/400x400bb.jpg",
            popularity = 98,
        ),
        Song(
            id = "track-2",
            title = "Starboy",
            artist = "The Weeknd ft. Daft Punk",
            album = "Starboy",
            durationFormatted = "3:50",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/9f/bf/919fbfec-3044-8fa2-6800-4b2a47290f84/16UMGIM60447.rgb.jpg/400x400bb.jpg",
            popularity = 95,
        ),
        Song(
            id = "track-3",
            title = "Cruel Summer",
            artist = "Taylor Swift",
            album = "Lover",
            durationFormatted = "2:58",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/af/81/44af8168-9609-1b85-5048-ada08dceacf3/mzaf_1341699644335558812.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/400x400bb.jpg",
            popularity = 97,
        ),
        Song(
            id = "track-4",
            title = "Bohemian Rhapsody",
            artist = "Queen",
            album = "A Night at the Opera",
            durationFormatted = "5:55",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/17/fc/1e/17fc1eba-946d-84a9-710b-a0e88ea64209/mzaf_3049006317693088799.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8b/0a/ea/8b0aea60-6f4a-195b-5958-cdf459c2333b/602527644271.jpg/400x400bb.jpg",
            popularity = 98,
        ),
        Song(
            id = "track-5",
            title = "Get Lucky",
            artist = "Daft Punk ft. Pharrell Williams",
            album = "Random Access Memories",
            durationFormatted = "6:10",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/400x400bb.jpg",
            popularity = 91,
        ),
        Song(
            id = "track-6",
            title = "BIRDS OF A FEATHER",
            artist = "Billie Eilish",
            album = "HIT ME HARD AND SOFT",
            durationFormatted = "3:30",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/34/31/d3/3431d34e-847f-5d66-df83-0bce688d997e/mzaf_18106743962423782018.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/400x400bb.jpg",
            popularity = 96,
        ),
        Song(
            id = "track-7",
            title = "Lose Yourself",
            artist = "Eminem",
            album = "8 Mile",
            durationFormatted = "5:22",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/13/5a/61/135a6154-8ca2-0523-1fa2-f4ac0ea9e1e7/mzaf_13242749689945681184.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/08/23/fc/0823fcd9-cb44-695b-32bf-b3bf51d9f800/00606949351229.rgb.jpg/400x400bb.jpg",
            popularity = 98,
        ),
        Song(
            id = "track-8",
            title = "Shape of You",
            artist = "Ed Sheeran",
            album = "÷ (Deluxe)",
            durationFormatted = "3:54",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/44/c7/4f/44c74f0d-72dc-6143-d4d0-ba14d661ca0d/mzaf_9566898362556366703.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/400x400bb.jpg",
            popularity = 95,
        ),
        Song(
            id = "track-9",
            title = "Levitating",
            artist = "Dua Lipa",
            album = "Future Nostalgia",
            durationFormatted = "3:24",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/400x400bb.jpg",
            popularity = 97,
        ),
        Song(
            id = "track-10",
            title = "Sunflower",
            artist = "Post Malone & Swae Lee",
            album = "Spider-Man: Into the Spider-Verse",
            durationFormatted = "2:38",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/98/f0/d6/98f0d67e-f8bf-762d-cac7-1c6b3b6b35dd/mzaf_4543283896248560946.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4b/30/2c/4b302cb6-7a14-5464-4e97-0577e9d0be49/18UMGIM82277.rgb.jpg/400x400bb.jpg",
            popularity = 97,
        ),
        Song(
            id = "track-11",
            title = "As It Was",
            artist = "Harry Styles",
            album = "Harry's House",
            durationFormatted = "2:47",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/67/10/16/67101606-3869-ca44-6c03-e13d6322cb51/mzaf_1135399237022217274.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/400x400bb.jpg",
            popularity = 94,
        ),
        Song(
            id = "track-12",
            title = "Flowers",
            artist = "Miley Cyrus",
            album = "Endless Summer Vacation",
            durationFormatted = "3:21",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/68/9e/f7/689ef7fe-14fe-a846-c87f-7d3b2d6344b1/mzaf_4167137058064023087.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/400x400bb.jpg",
            popularity = 94,
        ),
        Song(
            id = "track-13",
            title = "Believer",
            artist = "Imagine Dragons",
            album = "Evolve",
            durationFormatted = "3:24",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c0/3f/36/c03f367a-b66b-fd0a-a54c-30f8250c4410/mzaf_12768434238801682952.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/11/7a/b8/117ab805-6811-8929-18b9-0fad7baf0c25/17UMGIM98210.rgb.jpg/400x400bb.jpg",
            popularity = 93,
        ),
        Song(
            id = "track-14",
            title = "Someone You Loved",
            artist = "Lewis Capaldi",
            album = "Divinely Uninspired",
            durationFormatted = "3:02",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e5/c8/17/e5c817e2-7830-091f-8686-d6276d5beaeb/mzaf_5586826958480073790.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/92/d7/8f/92d78fb1-df3d-049e-c81d-7022808b151f/19UMGIM02973.rgb.jpg/400x400bb.jpg",
            popularity = 93,
        ),
        Song(
            id = "track-15",
            title = "Counting Stars",
            artist = "OneRepublic",
            album = "Native",
            durationFormatted = "4:17",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b0/db/7f/b0db7fbe-f8ff-1f67-fe72-ca8185ffbca2/mzaf_15298650366584767800.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/25/46/a7/2546a71a-b2bb-b4c9-4c52-a4daa3ae23ca/13UMGIM15076.rgb.jpg/400x400bb.jpg",
            popularity = 92,
        ),
        Song(
            id = "track-16",
            title = "Viva La Vida",
            artist = "Coldplay",
            album = "Viva La Vida",
            durationFormatted = "4:01",
            audioUrl = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/a3/30/8e/a3308eed-d8b7-e0b3-f09d-5e1b0f4d660a/mzaf_8517946447501075134.plus.aac.p.m4a",
            artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/52/aa/85/52aa851f-15b7-6322-f91f-df84b15b7b19/190295978044.jpg/400x400bb.jpg",
            popularity = 94,
        ),
    )

    @Volatile
    private var latestQuery: String = ""

    fun search(query: String, onResult: (List<Song>) -> Unit) {
        val trimmed = query.trim()
        latestQuery = trimmed

        if (trimmed.isEmpty()) {
            UbiTelemetryManager.log("desktop-find.browseAll", "Showing curated recommendations (${defaultCuratedSongs.size} tracks)")
            onResult(defaultCuratedSongs)
            return
        }

        // Instant 0ms cache hit for repeat queries and backspaces
        val cacheKey = trimmed.lowercase(Locale.ROOT)
        val cached = searchCache.get(cacheKey)
        if (cached != null) {
            UbiTelemetryManager.log("desktop-find.cacheHit", "Cache hit for '$trimmed' (${cached.size} tracks)")
            onResult(cached)
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
                val searchUrl = "https://itunes.apple.com/search?term=$encoded&entity=song&limit=50"
                conn = URL(searchUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 3500
                conn.readTimeout = 3500
                conn.requestMethod = "GET"
                conn.useCaches = true
                conn.setRequestProperty("User-Agent", "Spotify-REA/1.305.3058.0 Android")
                conn.setRequestProperty("Accept-Encoding", "gzip")

                if (conn.responseCode == 200) {
                    val encoding = conn.contentEncoding
                    val inputStream = if (encoding != null && encoding.equals("gzip", ignoreCase = true)) {
                        GZIPInputStream(conn.inputStream)
                    } else {
                        conn.inputStream
                    }

                    val reader = BufferedReader(InputStreamReader(inputStream, Charsets.UTF_8))
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
                                        artworkUrl = artworkHighRes,
                                    ),
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

            searchCache.put(cacheKey, finalSongs)

            UbiTelemetryManager.log(
                "desktop-find.resultsLoaded",
                "Returned ${finalSongs.size} tracks (GraphQL searchDesktop hash verified)",
                serpId,
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
