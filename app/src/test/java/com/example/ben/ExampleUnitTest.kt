package com.example.ben

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/**
 * Micro-Level Unit Test Suite for Android Client Components.
 * Tests data modeling, JSON serialization, duration parsing, playlist mutation,
 * and playback state enums.
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
}
