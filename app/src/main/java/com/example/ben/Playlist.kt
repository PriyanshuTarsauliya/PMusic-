package com.example.ben

import org.json.JSONArray
import org.json.JSONObject

data class Playlist(
    val id: String,
    var title: String,
    var description: String = "Created by you",
    var artworkUrl: String = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
    var curator: String = "You",
    val tracks: MutableList<Song> = mutableListOf()
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("title", title)
        json.put("description", description)
        json.put("artworkUrl", artworkUrl)
        json.put("curator", curator)
        val arr = JSONArray()
        tracks.forEach { song ->
            val sJson = JSONObject().apply {
                put("id", song.id)
                put("title", song.title)
                put("artist", song.artist)
                put("album", song.album)
                put("durationFormatted", song.durationFormatted)
                put("audioUrl", song.audioUrl)
                put("artworkUrl", song.artworkUrl ?: "")
                put("isLiked", song.isLiked)
                put("popularity", song.popularity)
                put("youtubeId", song.youtubeId ?: "")
                put("durationMs", song.durationMs)
            }
            arr.put(sJson)
        }
        json.put("tracks", arr)
        return json
    }

    companion object {
        fun fromJson(json: JSONObject): Playlist {
            val id = json.optString("id", "pl-" + System.currentTimeMillis())
            val title = json.optString("title", "My Playlist")
            val description = json.optString("description", "Created by you")
            val artworkUrl = json.optString("artworkUrl", "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80")
            val curator = json.optString("curator", "You")
            val tracks = mutableListOf<Song>()
            val arr = json.optJSONArray("tracks")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val sJson = arr.optJSONObject(i) ?: continue
                    tracks.add(
                        Song(
                            id = sJson.optString("id", "t-$i"),
                            title = sJson.optString("title", "Unknown Title"),
                            artist = sJson.optString("artist", "Unknown Artist"),
                            album = sJson.optString("album", "Unknown Album"),
                            durationFormatted = sJson.optString("durationFormatted", "3:00"),
                            audioUrl = sJson.optString("audioUrl", ""),
                            artworkUrl = sJson.optString("artworkUrl", "").takeIf { it.isNotBlank() },
                            isLiked = sJson.optBoolean("isLiked", false),
                            popularity = sJson.optInt("popularity", 80),
                            youtubeId = sJson.optString("youtubeId", "").takeIf { it.isNotBlank() },
                            durationMs = sJson.optLong("durationMs", 0L)
                        )
                    )
                }
            }
            return Playlist(id, title, description, artworkUrl, curator, tracks)
        }
    }
}
