package com.example.ben

data class Song(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationFormatted: String,
    val audioUrl: String,
    val artworkUrl: String? = null,
    var isLiked: Boolean = false,
    val isExplicit: Boolean = false,
    val popularity: Int = 85,
    var youtubeId: String? = null,
    val durationMs: Long = 0L,
) {
    fun getDurationMs(): Int {
        if (durationMs > 0L) return durationMs.toInt()
        val parts = durationFormatted.split(":")
        if (parts.size == 2) {
            val min = parts[0].trim().toIntOrNull() ?: 0
            val sec = parts[1].trim().toIntOrNull() ?: 0
            return (min * 60 + sec) * 1000
        }
        return 180000 // default 3 minutes
    }
}
