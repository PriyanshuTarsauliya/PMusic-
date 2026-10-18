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
    var youtubeId: String? = null
)
