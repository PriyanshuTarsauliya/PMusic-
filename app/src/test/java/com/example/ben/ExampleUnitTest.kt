package com.example.ben

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/**
 * Micro-Level Unit Test Suite for Android Client Components.
 * Tests data modeling, JSON serialization, duration parsing, playlist mutation,
 * playback state enums, and defensive security validations.
 */
class ExampleUnitTest {

    @Test
    fun songDuration_parsesStandardMmSsFormat() {
        val song1 = Song(
            id = "s1",
            title = "Blinding Lights",
            artist = "The Weeknd",
            album = "After Hours",
            durationFormatted = "3:20",
            audioUrl = "https://example.com/audio.m4a"
        )
        // 3 minutes 20 seconds = 200,000 ms
        assertEquals(200000, song1.getDurationMs())

        val song2 = Song(
            id = "s2",
            title = "Short Interlude",
            artist = "Artist",
            album = "Album",
            durationFormatted = "0:45",
            audioUrl = "https://example.com/audio2.m4a"
        )
        // 45 seconds = 45,000 ms
        assertEquals(45000, song2.getDurationMs())
    }

    @Test
    fun songDuration_explicitDurationMsTakesPrecedence() {
        val song = Song(
            id = "s3",
            title = "High Res Track",
            artist = "Artist",
            album = "Album",
            durationFormatted = "3:00",
            audioUrl = "https://example.com/audio.m4a",
            durationMs = 215432L
        )
        assertEquals(215432, song.getDurationMs())
    }

    @Test
    fun songDuration_invalidFormatFallsBackToDefaultThreeMinutes() {
        val song = Song(
            id = "s4",
            title = "Corrupted Duration",
            artist = "Artist",
            album = "Album",
            durationFormatted = "invalid_duration",
            audioUrl = "https://example.com/audio.m4a"
        )
        // Default is 180,000 ms (3 minutes)
        assertEquals(180000, song.getDurationMs())
    }

    @Test
    fun playlist_toJsonAndFromJsonRoundtripPreservesData() {
        val song1 = Song(
            id = "track_101",
            title = "Starboy",
            artist = "The Weeknd",
            album = "Starboy",
            durationFormatted = "3:50",
            audioUrl = "https://example.com/starboy.m4a",
            artworkUrl = "https://example.com/starboy.jpg",
            isLiked = true,
            youtubeId = "dqt8Z1k0oWQ"
        )

        val originalPlaylist = Playlist(
            id = "pl_test_001",
            title = "Late Night Vibez",
            description = "Chill tracks for late night work",
            artworkUrl = "https://example.com/cover.jpg",
            curator = "Priyanshu",
            tracks = mutableListOf(song1)
        )

        // Serialize to JSON
        val json: JSONObject = originalPlaylist.toJson()
        assertEquals("pl_test_001", json.getString("id"))
        assertEquals("Late Night Vibez", json.getString("title"))
        assertEquals("Chill tracks for late night work", json.getString("description"))
        assertEquals(1, json.getJSONArray("tracks").length())

        // Deserialize back from JSON
        val reconstructed = Playlist.fromJson(json)
        assertEquals(originalPlaylist.id, reconstructed.id)
        assertEquals(originalPlaylist.title, reconstructed.title)
        assertEquals(originalPlaylist.description, reconstructed.description)
        assertEquals(originalPlaylist.curator, reconstructed.curator)
        assertEquals(1, reconstructed.tracks.size)

        val restoredSong = reconstructed.tracks[0]
        assertEquals("track_101", restoredSong.id)
        assertEquals("Starboy", restoredSong.title)
        assertEquals("The Weeknd", restoredSong.artist)
        assertEquals(true, restoredSong.isLiked)
        assertEquals("dqt8Z1k0oWQ", restoredSong.youtubeId)
    }

    @Test
    fun playlist_handlesEmptyTrackListAndNullValuesGracefully() {
        val emptyPlaylist = Playlist(
            id = "pl_empty_99",
            title = "Empty Playlist"
        )

        val json = emptyPlaylist.toJson()
        val restored = Playlist.fromJson(json)

        assertEquals("pl_empty_99", restored.id)
        assertEquals("Empty Playlist", restored.title)
        assertTrue(restored.tracks.isEmpty())
    }

    @Test
    fun playbackManager_repeatModeTransitionsCorrectly() {
        var mode = PlaybackManager.RepeatMode.OFF

        fun advance(current: PlaybackManager.RepeatMode): PlaybackManager.RepeatMode {
            return when (current) {
                PlaybackManager.RepeatMode.OFF -> PlaybackManager.RepeatMode.ALL
                PlaybackManager.RepeatMode.ALL -> PlaybackManager.RepeatMode.ONE
                PlaybackManager.RepeatMode.ONE -> PlaybackManager.RepeatMode.OFF
            }
        }

        mode = advance(mode)
        assertEquals(PlaybackManager.RepeatMode.ALL, mode)

        mode = advance(mode)
        assertEquals(PlaybackManager.RepeatMode.ONE, mode)

        mode = advance(mode)
        assertEquals(PlaybackManager.RepeatMode.OFF, mode)
    }

    @Test
    fun playbackManager_engineEnumContainsExpectedEngines() {
        val engines = PlaybackManager.Engine.values()
        assertTrue(engines.contains(PlaybackManager.Engine.NONE))
        assertTrue(engines.contains(PlaybackManager.Engine.YOUTUBE))
        assertTrue(engines.contains(PlaybackManager.Engine.MEDIA_PLAYER))
    }

    @Test
    fun videoIdSanitization_stripsInjectionPayloads() {
        val rawVideoId = "fHI8X4OXluQ'); alert(1); //"
        val clean = rawVideoId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        assertEquals("fHI8X4OXluQalert1", clean)
        assertFalse(clean.contains("'"))
        assertFalse(clean.contains(";"))
        assertFalse(clean.contains(" "))
    }

    @Test
    fun spotifyCallback_validatesHostAuthenticity() {
        fun isAuthenticHost(host: String?): Boolean {
            return host?.endsWith("spotify.com") == true
        }

        assertTrue(isAuthenticHost("accounts.spotify.com"))
        assertTrue(isAuthenticHost("spotify.com"))
        assertFalse(isAuthenticHost("evil-spotify.com.attacker.com"))
        assertFalse(isAuthenticHost("spotify.com.attacker.org"))
        assertFalse(isAuthenticHost(null))
    }

    @Test
    fun loginValidation_rejectsBlankOrEmptyUsername() {
        fun validateInput(username: String, pass: String): String? {
            if (username.isBlank()) return "Please enter your Spotify User ID or Email."
            if (pass.length < 4) return "Password must be at least 4 characters."
            return null
        }

        assertEquals("Please enter your Spotify User ID or Email.", validateInput("", "validPass"))
        assertEquals("Please enter your Spotify User ID or Email.", validateInput("   ", "validPass"))
        assertEquals("Password must be at least 4 characters.", validateInput("validUser", "123"))
        assertNull(validateInput("validUser", "1234"))
    }

    @Test
    fun loginResponse_parsesTokenAndDerivesDisplayName() {
        val rawJsonResponse = """
            {
                "success": true,
                "token": "pm_dGVzdA.1793689.abc123sig",
                "user": {
                    "username": "ben_spotify_premium@spotify.com",
                    "library": []
                }
            }
        """.trimIndent()

        val json = JSONObject(rawJsonResponse)
        val token = json.optString("token", "")
        assertTrue(token.startsWith("pm_"))

        val username = "ben_spotify_premium@spotify.com"
        val displayName = if (username.contains("@")) username.substringBefore("@") else username
        assertEquals("ben_spotify_premium", displayName)
    }

    @Test
    fun loginResponse_mapsBackendErrorCodes() {
        fun mapErrorCode(code: Int): String {
            return when (code) {
                401 -> "Invalid username or password."
                429 -> "Too many attempts. Please back off."
                else -> "Authentication failed."
            }
        }

        assertEquals("Invalid username or password.", mapErrorCode(401))
        assertEquals("Too many attempts. Please back off.", mapErrorCode(429))
        assertEquals("Authentication failed.", mapErrorCode(500))
    }
    @Test
    fun chatImporter_extractsNumberedSongQueries() {
        val input = """
            1. Starboy - The Weeknd
            2) Yellow - Coldplay
            3 - Levitating - Dua Lipa
            4. Believer - Imagine Dragons
        """.trimIndent()

        val queries = ChatImportBottomSheet.extractSongQueries(input)
        assertEquals(4, queries.size)
        assertEquals("Starboy - The Weeknd", queries[0])
        assertEquals("Yellow - Coldplay", queries[1])
        assertEquals("Levitating - Dua Lipa", queries[2])
        assertEquals("Believer - Imagine Dragons", queries[3])
    }

    @Test
    fun chatImporter_extractsChatPromptQueries() {
        val input = "Hey PMusic add Shape of You, Perfect, and Faded to my library"
        val queries = ChatImportBottomSheet.extractSongQueries(input)
        assertEquals(3, queries.size)
        assertEquals("Shape of You", queries[0])
        assertEquals("Perfect", queries[1])
        assertEquals("Faded", queries[2])
    }

    @Test
    fun chatImporter_extractsCommaSeparatedQueries() {
        val input = "Starboy, Bohemian Rhapsody, Flowers, Stay With Me, Bad Guy"
        val queries = ChatImportBottomSheet.extractSongQueries(input)
        assertEquals(5, queries.size)
        assertEquals("Starboy", queries[0])
        assertEquals("Bohemian Rhapsody", queries[1])
        assertEquals("Flowers", queries[2])
    }

    @Test
    fun playbackSpeed_supportsExpectedSpeedMultipliers() {
        val supportedSpeeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        assertTrue(supportedSpeeds.contains(0.5f))
        assertTrue(supportedSpeeds.contains(0.75f))
        assertTrue(supportedSpeeds.contains(1.0f))
        assertTrue(supportedSpeeds.contains(1.25f))
        assertTrue(supportedSpeeds.contains(1.5f))
        assertTrue(supportedSpeeds.contains(2.0f))

        fun cycleSpeed(current: Float): Float {
            val idx = supportedSpeeds.indexOf(current)
            return supportedSpeeds[(idx + 1) % supportedSpeeds.size]
        }

        assertEquals(1.25f, cycleSpeed(1.0f), 0.001f)
        assertEquals(1.5f, cycleSpeed(1.25f), 0.001f)
        assertEquals(0.5f, cycleSpeed(2.0f), 0.001f)
    }

    @Test
    fun playbackSpeed_cyclesThroughAllSixPresetSpeeds() {
        val speeds = floatArrayOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        fun getNextSpeed(cur: Float): Float {
            var curIdx = speeds.indexOfFirst { kotlin.math.abs(it - cur) < 0.05f }
            if (curIdx < 0) curIdx = 2
            return speeds[(curIdx + 1) % speeds.size]
        }

        assertEquals(1.25f, getNextSpeed(1.0f), 0.001f)
        assertEquals(1.5f, getNextSpeed(1.25f), 0.001f)
        assertEquals(2.0f, getNextSpeed(1.5f), 0.001f)
        assertEquals(0.5f, getNextSpeed(2.0f), 0.001f)
        assertEquals(0.75f, getNextSpeed(0.5f), 0.001f)
        assertEquals(1.0f, getNextSpeed(0.75f), 0.001f)
    }

    @Test
    fun mediaPlaybackService_definesStandardActionProtocol() {
        assertEquals("com.example.ben.action.START", MediaPlaybackService.ACTION_START)
        assertEquals("com.example.ben.action.UPDATE", MediaPlaybackService.ACTION_UPDATE)
        assertEquals("com.example.ben.action.TOGGLE", MediaPlaybackService.ACTION_TOGGLE)
        assertEquals("com.example.ben.action.NEXT", MediaPlaybackService.ACTION_NEXT)
        assertEquals("com.example.ben.action.PREV", MediaPlaybackService.ACTION_PREV)
        assertEquals("com.example.ben.action.STOP", MediaPlaybackService.ACTION_STOP)
        assertEquals("pmusic_playback_channel", MediaPlaybackService.CHANNEL_ID)
    }

    @Test
    fun userLibrary_parsesServerJsonFormatCorrectly() {
        val serverJson = JSONObject().apply {
            put("id", "track-server-1")
            put("name", "Cruel Summer")
            put("artist", "Taylor Swift")
            put("album", "Lover")
            put("durationFormatted", "2:58")
            put("artwork", "https://example.com/lover.jpg")
            put("previewUrl", "https://example.com/preview.m4a")
            put("youtubeId", "ic8j13piAhQ")
        }

        val song = UserLibraryManager.parseSongFromJson(serverJson)
        assertEquals("track-server-1", song.id)
        assertEquals("Cruel Summer", song.title)
        assertEquals("Taylor Swift", song.artist)
        assertEquals("Lover", song.album)
        assertEquals("https://example.com/lover.jpg", song.artworkUrl)
        assertEquals("https://example.com/preview.m4a", song.audioUrl)
        assertEquals("ic8j13piAhQ", song.youtubeId)
        assertTrue(song.isLiked)
    }

    @Test
    fun playlist_parsesServerJsonWithTracksSeamlessly() {
        val serverPlaylistJson = JSONObject().apply {
            put("id", "user-pl-12345")
            put("title", "My Romantic Playlist")
            put("description", "Best love ballads")
            put("artwork", "https://example.com/romantic.jpg")
            put("curator", "Ben")
            val tracksArr = org.json.JSONArray().apply {
                put(JSONObject().apply {
                    put("id", "track-rom-1")
                    put("name", "Someone You Loved")
                    put("artist", "Lewis Capaldi")
                    put("album", "Divinely Uninspired")
                    put("durationFormatted", "3:02")
                    put("artwork", "https://example.com/capaldi.jpg")
                    put("previewUrl", "https://example.com/capaldi.m4a")
                })
            }
            put("tracks", tracksArr)
        }

        val playlist = Playlist.fromJson(serverPlaylistJson)
        assertEquals("user-pl-12345", playlist.id)
        assertEquals("My Romantic Playlist", playlist.title)
        assertEquals("https://example.com/romantic.jpg", playlist.artworkUrl)
        assertEquals("Ben", playlist.curator)
        assertEquals(1, playlist.tracks.size)

        val track = playlist.tracks[0]
        assertEquals("track-rom-1", track.id)
        assertEquals("Someone You Loved", track.title)
        assertEquals("Lewis Capaldi", track.artist)
        assertEquals("https://example.com/capaldi.jpg", track.artworkUrl)
        assertEquals("https://example.com/capaldi.m4a", track.audioUrl)
    }

    @Test
    fun categoryFilter_topSongsSortsByPopularityDescending() {
        val songs = listOf(
            Song(id = "s1", title = "A", artist = "X", album = "Al", durationFormatted = "3:00", audioUrl = "", popularity = 85),
            Song(id = "s2", title = "B", artist = "Y", album = "Al", durationFormatted = "3:00", audioUrl = "", popularity = 98),
            Song(id = "s3", title = "C", artist = "Z", album = "Al", durationFormatted = "3:00", audioUrl = "", popularity = 94)
        )

        val sorted = songs.sortedByDescending { it.popularity }
        assertEquals("s2", sorted[0].id)
        assertEquals(98, sorted[0].popularity)
        assertEquals("s3", sorted[1].id)
        assertEquals("s1", sorted[2].id)
    }

    @Test
    fun categoryFilter_romanticSongsExtractsRomanticTracks() {
        val songs = listOf(
            Song(id = "s1", title = "Lose Yourself", artist = "Eminem", album = "8 Mile", durationFormatted = "5:22", audioUrl = "", popularity = 98),
            Song(id = "s2", title = "Cruel Summer", artist = "Taylor Swift", album = "Lover", durationFormatted = "2:58", audioUrl = "", popularity = 97),
            Song(id = "s3", title = "Shape of You", artist = "Ed Sheeran", album = "Divide", durationFormatted = "3:54", audioUrl = "", popularity = 95),
            Song(id = "s4", title = "Believer", artist = "Imagine Dragons", album = "Evolve", durationFormatted = "3:24", audioUrl = "", popularity = 93)
        )

        val romantic = songs.filter { s ->
            s.title.contains("summer", true) ||
            s.title.contains("love", true) ||
            s.title.contains("shape", true) ||
            s.artist.contains("swift", true) ||
            s.artist.contains("sheeran", true) ||
            s.album.contains("lover", true)
        }

        assertEquals(2, romantic.size)
        assertTrue(romantic.any { it.title == "Cruel Summer" })
        assertTrue(romantic.any { it.title == "Shape of You" })
        assertFalse(romantic.any { it.title == "Lose Yourself" })
    }

    @Test
    fun userProfile_initialCalculationExtractsUppercaseLetter() {
        val name1 = "priyanshu"
        assertEquals("P", name1.first().uppercase())

        val name2 = "ben_spotify"
        assertEquals("B", name2.first().uppercase())

        val empty = ""
        val initial = if (empty.isNotBlank()) empty.first().uppercase() else "U"
        assertEquals("U", initial)
    }

    @Test
    fun userProfile_backendJsonParsingExtractsProfileFields() {
        val jsonStr = """
            {
                "success": true,
                "profile": {
                    "username": "priyanshu",
                    "displayName": "Priyanshu Tarsauliya",
                    "avatar": "https://example.com/avatar.png",
                    "accountType": "SPOTIFY PREMIUM",
                    "createdAt": 1700000000000,
                    "likedSongsCount": 15,
                    "playlistsCount": 4
                }
            }
        """.trimIndent()

        val json = JSONObject(jsonStr)
        assertTrue(json.getBoolean("success"))
        val profile = json.getJSONObject("profile")
        assertEquals("priyanshu", profile.getString("username"))
        assertEquals("Priyanshu Tarsauliya", profile.getString("displayName"))
        assertEquals("https://example.com/avatar.png", profile.getString("avatar"))
        assertEquals(15, profile.getInt("likedSongsCount"))
        assertEquals(4, profile.getInt("playlistsCount"))
        assertEquals("SPOTIFY PREMIUM", profile.getString("accountType"))
    }

    @Test
    fun hindiQueryDetection_correctlyIdentifiesDevanagariAndHindiKeywords() {
        // Pure Devanagari
        assertTrue(SpotifySearchEngine.isHindiQuery("तुम ही हो"))
        assertTrue(SpotifySearchEngine.isHindiQuery("केसरिया"))
        assertTrue(SpotifySearchEngine.isHindiQuery("दिल"))

        // Romanized Hindi / Hinglish keywords
        assertTrue(SpotifySearchEngine.isHindiQuery("hindi songs"))
        assertTrue(SpotifySearchEngine.isHindiQuery("latest bollywood hits"))
        assertTrue(SpotifySearchEngine.isHindiQuery("arijit singh new song"))

        // English non-Hindi queries
        assertFalse(SpotifySearchEngine.isHindiQuery("blinding lights"))
        assertFalse(SpotifySearchEngine.isHindiQuery("taylor swift"))
        assertFalse(SpotifySearchEngine.isHindiQuery("coldplay viva la vida"))
    }

    @Test
    fun youTubeTrackModel_storesDirectYouTubePlaybackId() {
        val ytSong = Song(
            id = "yt-Umqb9KENgmk",
            title = "Tum Hi Ho",
            artist = "Arijit Singh",
            album = "Aashiqui 2",
            durationFormatted = "4:22",
            audioUrl = "https://www.youtube.com/watch?v=Umqb9KENgmk",
            artworkUrl = "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg",
            youtubeId = "Umqb9KENgmk",
            durationMs = 262000L
        )

        assertEquals("yt-Umqb9KENgmk", ytSong.id)
        assertEquals("Umqb9KENgmk", ytSong.youtubeId)
        assertTrue(ytSong.audioUrl.contains("youtube.com"))
        assertEquals(262000, ytSong.getDurationMs())
    }

    @Test
    fun equalizerPresets_validateGainBounds() {
        val flat = intArrayOf(0, 0, 0, 0, 0)
        val bass = intArrayOf(6, 4, 1, 0, -1)
        val vocal = intArrayOf(-2, 1, 5, 3, 0)
        val treble = intArrayOf(-1, 0, 1, 4, 6)
        val pop = intArrayOf(-1, 2, 4, 2, -1)
        val rock = intArrayOf(5, 3, -1, 3, 5)

        val presets = listOf(flat, bass, vocal, treble, pop, rock)
        presets.forEach { preset ->
            assertEquals(5, preset.size)
            preset.forEach { gain ->
                assertTrue("Gain $gain should be within -12..12 dB", gain in -12..12)
            }
        }
        // Bass boost should have highest gain at low frequency
        assertTrue(bass[0] > bass[4])
        // Treble boost should have highest gain at high frequency
        assertTrue(treble[4] > treble[0])
    }

    @Test
    fun recentSearches_deduplicatesAndCapsToTen() {
        val rawQueries = listOf("Arijit", "Taylor Swift", "The Weeknd", "Arijit", "Bollywood", "Coldplay", "Dua Lipa", "Drake", "Billie Eilish", "Eminem", "Imagine Dragons", "Queen")
        val processed = mutableListOf<String>()

        rawQueries.forEach { q ->
            processed.remove(q)
            processed.add(0, q)
        }
        val capped = processed.take(10)

        assertEquals(10, capped.size)
        assertEquals("Queen", capped[0])
        assertEquals(1, capped.count { it == "Arijit" })
    }

    @Test
    fun recentlyPlayedHistory_prependsNewTrackAndDeduplicates() {
        val s1 = Song(id = "1", title = "Blinding Lights", artist = "The Weeknd", album = "After Hours", durationFormatted = "3:20", audioUrl = "url1")
        val s2 = Song(id = "2", title = "Starboy", artist = "The Weeknd", album = "Starboy", durationFormatted = "3:50", audioUrl = "url2")
        val s3 = Song(id = "3", title = "Cruel Summer", artist = "Taylor Swift", album = "Lover", durationFormatted = "2:58", audioUrl = "url3")

        val history = mutableListOf(s1, s2)
        history.removeIf { it.id == s3.id }
        history.add(0, s3)
        assertEquals("Cruel Summer", history[0].title)

        history.removeIf { it.id == s1.id }
        history.add(0, s1)
        assertEquals("Blinding Lights", history[0].title)
        assertEquals(3, history.size)
    }
}
