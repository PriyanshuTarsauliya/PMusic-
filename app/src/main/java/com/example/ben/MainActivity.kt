package com.example.ben

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.SeekBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.widget.doOnTextChanged
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.ben.databinding.ActivityMainBinding
import java.util.Calendar

class MainActivity : AppCompatActivity(), PlaybackManager.PlaybackListener {

    private lateinit var binding: ActivityMainBinding
    private lateinit var sessionManager: SpotifySessionManager
    private lateinit var songAdapter: SongAdapter
    private lateinit var homeSongAdapter: SongAdapter

    private var currentFilteredSongs = SpotifySearchEngine.defaultCuratedSongs.toList()
    private var displayedSongs = SpotifySearchEngine.defaultCuratedSongs.toList()
    private val searchHandler = Handler(Looper.getMainLooper())
    private var searchRunnable: Runnable? = null
    private var activeCategory: String = "All"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessionManager = SpotifySessionManager(this)

        if (!sessionManager.isLoggedIn()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUserHeader()
        setupBottomNavigation()
        setupHomeView()
        setupSearch()
        setupCategoryChips()
        setupSongList()
        setupTopResult()
        setupLibraryView()
        setupBottomPlayer()

        PlaybackManager.addListener(this)
        UbiTelemetryManager.log("desktop-find.browseMounted", "Curated recommendations ready")
    }

    private fun setupUserHeader() {
        val displayName = sessionManager.getDisplayName()
        val accountType = sessionManager.getAccountType()

        binding.tvUserGreeting.text = getString(R.string.user_greeting, displayName)
        binding.tvAccountBadge.text = accountType

        // Open REA Evidence & Telemetry Inspector
        binding.btnReaInspector.setOnClickListener {
            UbiTelemetryManager.log("hitInspectorOpen", "User opened Spotify REA Architecture Inspector")
            ReaInspectorBottomSheet.newInstance().show(supportFragmentManager, ReaInspectorBottomSheet.TAG)
        }

        binding.btnLogout.setOnClickListener {
            sessionManager.logout()
            PlaybackManager.release()
            UbiTelemetryManager.log("hitLogout", "User logged out")
            Toast.makeText(this, "Logged out of Spotify", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    // ==========================================================
    // BOTTOM NAVIGATION SETUP (Home, Search, Your Library)
    // ==========================================================
    private fun setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> {
                    showHomeTab()
                    true
                }
                R.id.nav_search -> {
                    showSearchTab()
                    true
                }
                R.id.nav_library -> {
                    showLibraryTab()
                    true
                }
                else -> false
            }
        }
    }

    fun showHomeTab() {
        binding.containerHome.visibility = View.VISIBLE
        binding.containerSearch.visibility = View.GONE
        binding.containerLibrary.visibility = View.GONE
        UbiTelemetryManager.log("navTabSelected", "Tab: Home")
    }

    fun showSearchTab() {
        binding.containerHome.visibility = View.GONE
        binding.containerSearch.visibility = View.VISIBLE
        binding.containerLibrary.visibility = View.GONE
        UbiTelemetryManager.log("navTabSelected", "Tab: Search")
    }

    fun showLibraryTab() {
        binding.containerHome.visibility = View.GONE
        binding.containerSearch.visibility = View.GONE
        binding.containerLibrary.visibility = View.VISIBLE
        updateLikedSongsCount()
        UbiTelemetryManager.log("navTabSelected", "Tab: Your Library")
    }

    // ==========================================================
    // TAB 1: HOME VIEW
    // ==========================================================
    private fun setupHomeView() {
        // Dynamic time-of-day greeting
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val greeting = when (hour) {
            in 4..11 -> "Good morning"
            in 12..17 -> "Good afternoon"
            else -> "Good evening"
        }
        binding.tvHomeWelcome.text = greeting

        val curated = SpotifySearchEngine.defaultCuratedSongs
        if (curated.isNotEmpty()) {
            ImageLoader.load(curated[0].artworkUrl, binding.imgTileTopHits)
            if (curated.size > 1) ImageLoader.load(curated[1].artworkUrl, binding.imgTileDailyMix)
            if (curated.size > 5) ImageLoader.load(curated[5].artworkUrl, binding.imgTileDiscoverWeekly)
            if (curated.size > 2) ImageLoader.load(curated[2].artworkUrl, binding.imgTilePopHits)
            if (curated.size > 3) ImageLoader.load(curated[3].artworkUrl, binding.imgTileRockClassics)
        }

        // Spotify 6-Tile Quick Access actions
        binding.tileLikedSongs.setOnClickListener {
            val liked = SpotifySearchEngine.defaultCuratedSongs.filter { it.isLiked }
            val toPlay = if (liked.isNotEmpty()) liked else SpotifySearchEngine.defaultCuratedSongs
            PlaybackManager.setQueueAndPlay(toPlay, 0)
            Toast.makeText(this, "Playing Liked Songs", Toast.LENGTH_SHORT).show()
        }
        binding.tileTopHits.setOnClickListener {
            PlaybackManager.setQueueAndPlay(curated, 0)
            Toast.makeText(this, "Playing Today's Top Hits", Toast.LENGTH_SHORT).show()
        }
        binding.tileDailyMix.setOnClickListener {
            val dailyMix = curated.reversed()
            PlaybackManager.setQueueAndPlay(dailyMix, 0)
            Toast.makeText(this, "Playing Daily Mix 1", Toast.LENGTH_SHORT).show()
        }
        binding.tileDiscoverWeekly.setOnClickListener {
            val discover = curated.shuffled()
            PlaybackManager.setQueueAndPlay(discover, 0)
            Toast.makeText(this, "Playing Discover Weekly", Toast.LENGTH_SHORT).show()
        }
        binding.tilePopHits.setOnClickListener {
            val popTracks = curated.filter { it.popularity > 90 }
            PlaybackManager.setQueueAndPlay(if (popTracks.isNotEmpty()) popTracks else curated, 0)
            Toast.makeText(this, "Playing Chill Vibes", Toast.LENGTH_SHORT).show()
        }
        binding.tileRockClassics.setOnClickListener {
            val classics = curated.filter { it.album.contains("Night", true) || it.title.contains("Bohemian", true) }
            PlaybackManager.setQueueAndPlay(if (classics.isNotEmpty()) classics else curated, 0)
            Toast.makeText(this, "Playing Release Radar", Toast.LENGTH_SHORT).show()
        }

        // Recently Played Carousel Cards
        if (curated.isNotEmpty()) {
            binding.tvRecentTitle1.text = curated[0].title
            binding.tvRecentArtist1.text = curated[0].artist
            ImageLoader.load(curated[0].artworkUrl, binding.imgRecent1)
            binding.cardRecent1.setOnClickListener { PlaybackManager.setQueueAndPlay(curated, 0) }
        }
        if (curated.size > 1) {
            binding.tvRecentTitle2.text = curated[1].title
            binding.tvRecentArtist2.text = curated[1].artist
            ImageLoader.load(curated[1].artworkUrl, binding.imgRecent2)
            binding.cardRecent2.setOnClickListener { PlaybackManager.setQueueAndPlay(curated, 1) }
        }
        if (curated.size > 2) {
            binding.tvRecentTitle3.text = curated[2].title
            binding.tvRecentArtist3.text = curated[2].artist
            ImageLoader.load(curated[2].artworkUrl, binding.imgRecent3)
            binding.cardRecent3.setOnClickListener { PlaybackManager.setQueueAndPlay(curated, 2) }
        }
        if (curated.size > 5) {
            binding.tvRecentTitle4.text = curated[5].title
            binding.tvRecentArtist4.text = curated[5].artist
            ImageLoader.load(curated[5].artworkUrl, binding.imgRecent4)
            binding.cardRecent4.setOnClickListener { PlaybackManager.setQueueAndPlay(curated, 5) }
        }

        // Home song recommendations list
        homeSongAdapter = SongAdapter(
            songs = curated,
            onSongClick = { song, position ->
                if (PlaybackManager.currentSong?.id == song.id) {
                    PlaybackManager.togglePlayPause()
                } else {
                    PlaybackManager.setQueueAndPlay(curated, position)
                }
            },
            onLikeClick = { song ->
                UbiTelemetryManager.log("hitLike", "${song.title} (${if (song.isLiked) "Added" else "Removed"})")
                Toast.makeText(this, if (song.isLiked) "Added to Liked Songs" else "Removed from Liked Songs", Toast.LENGTH_SHORT).show()
                updateLikedSongsCount()
                @Suppress("NotifyDataSetChanged")
                songAdapter.notifyDataSetChanged()
                @Suppress("NotifyDataSetChanged")
                homeSongAdapter.notifyDataSetChanged()
            }
        )

        binding.rvHomeSongs.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = homeSongAdapter
        }

        binding.btnHomePlayAll.setOnClickListener {
            if (PlaybackManager.currentSong != null && curated.any { it.id == PlaybackManager.currentSong?.id }) {
                PlaybackManager.togglePlayPause()
            } else {
                PlaybackManager.setQueueAndPlay(curated, 0)
                Toast.makeText(this, "Playing all recommended songs", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ==========================================================
    // TAB 2: SEARCH VIEW
    // ==========================================================
    private fun setupSearch() {
        binding.etSearch.doOnTextChanged { text, _, _, _ ->
            val query = text?.toString()?.trim().orEmpty()
            binding.btnClearSearch.visibility = if (query.isNotEmpty()) View.VISIBLE else View.GONE

            searchRunnable?.let { searchHandler.removeCallbacks(it) }
            searchRunnable = Runnable {
                performLiveSearch(query)
            }
            searchHandler.postDelayed(searchRunnable!!, 300)
        }

        binding.btnClearSearch.setOnClickListener {
            binding.etSearch.text.clear()
        }
    }

    private fun performLiveSearch(query: String) {
        binding.searchProgressBar.visibility = View.VISIBLE

        SpotifySearchEngine.search(query) { results ->
            binding.searchProgressBar.visibility = View.GONE
            currentFilteredSongs = results
            applyCategoryFilter()
        }
    }

    private fun setupCategoryChips() {
        val chips = listOf(binding.chipAll, binding.chipSongs, binding.chipArtists, binding.chipPlaylists)
        chips.forEach { chip ->
            chip.setOnClickListener { selected ->
                chips.forEach { c ->
                    if (c == selected) {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button)
                        c.setTextColor(ContextCompat.getColor(this, R.color.black))
                    } else {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button_outlined)
                        c.setTextColor(ContextCompat.getColor(this, R.color.spotify_white))
                    }
                }
                activeCategory = (selected as? Button)?.text?.toString() ?: "All"
                UbiTelemetryManager.log("categoryFilterSelected", "Category: $activeCategory")
                applyCategoryFilter()
            }
        }
    }

    private fun applyCategoryFilter() {
        val filtered = when (activeCategory) {
            "Artists" -> currentFilteredSongs.distinctBy { it.artist }
            "Playlists" -> currentFilteredSongs.sortedBy { it.album }
            "Songs" -> currentFilteredSongs
            else -> currentFilteredSongs
        }
        displayedSongs = filtered
        songAdapter.updateSongs(filtered)

        if (activeCategory == "Songs") {
            binding.cardTopResult.visibility = View.GONE
        } else {
            setupTopResult()
        }
    }

    private fun setupTopResult() {
        val top = displayedSongs.firstOrNull()
        if (top == null) {
            binding.cardTopResult.visibility = View.GONE
            return
        }
        binding.cardTopResult.visibility = View.VISIBLE
        binding.tvTopResultTitle.text = top.title
        binding.tvTopResultArtist.text = top.artist
        ImageLoader.load(top.artworkUrl, binding.imgTopResult)

        binding.btnTopResultPlay.setOnClickListener {
            if (PlaybackManager.currentSong?.id == top.id) {
                PlaybackManager.togglePlayPause()
            } else {
                PlaybackManager.setQueueAndPlay(displayedSongs, 0)
            }
        }

        binding.cardTopResult.setOnClickListener {
            if (PlaybackManager.currentSong?.id == top.id) {
                PlaybackManager.togglePlayPause()
            } else {
                PlaybackManager.setQueueAndPlay(displayedSongs, 0)
            }
        }
    }

    private fun setupSongList() {
        songAdapter = SongAdapter(
            songs = displayedSongs,
            onSongClick = { song, position ->
                if (PlaybackManager.currentSong?.id == song.id) {
                    PlaybackManager.togglePlayPause()
                } else {
                    PlaybackManager.setQueueAndPlay(displayedSongs, position)
                }
            },
            onLikeClick = { song ->
                UbiTelemetryManager.log("hitLike", "${song.title} (${if (song.isLiked) "Added" else "Removed"})")
                Toast.makeText(this, if (song.isLiked) "Added to Liked Songs" else "Removed from Liked Songs", Toast.LENGTH_SHORT).show()
                updateLikedSongsCount()
                @Suppress("NotifyDataSetChanged")
                songAdapter.notifyDataSetChanged()
                if (::homeSongAdapter.isInitialized) {
                    @Suppress("NotifyDataSetChanged")
                    homeSongAdapter.notifyDataSetChanged()
                }
            }
        )

        binding.rvSongs.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = songAdapter
        }

        // PLAY ALL continuous queue button
        binding.btnPlayAll.setOnClickListener {
            if (displayedSongs.isNotEmpty()) {
                PlaybackManager.setQueueAndPlay(displayedSongs, 0)
                UbiTelemetryManager.log("hitPlayAll", "Queue continuous autoplay: ${displayedSongs.size} tracks")
                Toast.makeText(this, "Playing all songs...", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ==========================================================
    // TAB 3: YOUR LIBRARY VIEW
    // ==========================================================
    private fun setupLibraryView() {
        updateLikedSongsCount()

        val curated = SpotifySearchEngine.defaultCuratedSongs
        if (curated.isNotEmpty()) {
            ImageLoader.load(curated[0].artworkUrl, binding.imgLibRow1)
            if (curated.size > 1) ImageLoader.load(curated[1].artworkUrl, binding.imgLibRow2)
            if (curated.isNotEmpty()) ImageLoader.load(curated[0].artworkUrl, binding.imgLibRow3)
            if (curated.size > 5) ImageLoader.load(curated[5].artworkUrl, binding.imgLibRow4)
        }

        binding.btnLibraryAdd.setOnClickListener {
            Toast.makeText(this, "Create Playlist: Feature coming soon", Toast.LENGTH_SHORT).show()
            UbiTelemetryManager.log("hitCreatePlaylist", "User tapped create playlist")
        }

        binding.btnLibrarySearch.setOnClickListener {
            binding.bottomNavigation.selectedItemId = R.id.nav_search
        }

        // Library filter chips
        val libChips = listOf(binding.chipLibPlaylists, binding.chipLibArtists, binding.chipLibAlbums, binding.chipLibDownloaded)
        libChips.forEach { chip ->
            chip.setOnClickListener { selected ->
                libChips.forEach { c ->
                    if (c == selected) {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button)
                        c.setTextColor(ContextCompat.getColor(this, R.color.black))
                    } else {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button_outlined)
                        c.setTextColor(ContextCompat.getColor(this, R.color.spotify_white))
                    }
                }
            }
        }

        // Play Liked Songs
        val playLikedAction = View.OnClickListener {
            val liked = SpotifySearchEngine.defaultCuratedSongs.filter { it.isLiked }
            val toPlay = if (liked.isNotEmpty()) liked else SpotifySearchEngine.defaultCuratedSongs
            if (PlaybackManager.currentSong != null && toPlay.any { it.id == PlaybackManager.currentSong?.id }) {
                PlaybackManager.togglePlayPause()
            } else {
                PlaybackManager.setQueueAndPlay(toPlay, 0)
                Toast.makeText(this, "Playing Liked Songs", Toast.LENGTH_SHORT).show()
            }
        }
        binding.cardLikedSongs.setOnClickListener(playLikedAction)
        binding.btnPlayLikedSongs.setOnClickListener(playLikedAction)

        // Library collection rows
        binding.rowLibTopHits.setOnClickListener {
            PlaybackManager.setQueueAndPlay(curated, 0)
            Toast.makeText(this, "Playing Today's Top Hits", Toast.LENGTH_SHORT).show()
        }
        binding.rowLibDailyMix.setOnClickListener {
            PlaybackManager.setQueueAndPlay(curated.reversed(), 0)
            Toast.makeText(this, "Playing Daily Mix 1", Toast.LENGTH_SHORT).show()
        }
        binding.rowLibArtistWeeknd.setOnClickListener {
            val weekndTracks = curated.filter { it.artist.contains("Weeknd", true) }
            PlaybackManager.setQueueAndPlay(if (weekndTracks.isNotEmpty()) weekndTracks else curated, 0)
            Toast.makeText(this, "Playing The Weeknd", Toast.LENGTH_SHORT).show()
        }
        binding.rowLibArtistBillie.setOnClickListener {
            val billieTracks = curated.filter { it.artist.contains("Billie", true) }
            PlaybackManager.setQueueAndPlay(if (billieTracks.isNotEmpty()) billieTracks else curated, 0)
            Toast.makeText(this, "Playing Billie Eilish", Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateLikedSongsCount() {
        val count = SpotifySearchEngine.defaultCuratedSongs.count { it.isLiked }
        binding.tvLikedSongsCount.text = "Playlist • $count ${if (count == 1) "song" else "songs"}"
    }

    // ==========================================================
    // PERSISTENT BOTTOM AUDIO PLAYER BAR
    // ==========================================================
    private var isTrackingSeekBar = false

    private fun setupBottomPlayer() {
        // Initialize bottom player with first curated track metadata if no song has played yet
        val initialSong = PlaybackManager.currentSong ?: SpotifySearchEngine.defaultCuratedSongs.firstOrNull()
        if (initialSong != null) {
            binding.tvPlayerTitle.text = initialSong.title
            binding.tvPlayerArtist.text = initialSong.artist
            ImageLoader.load(initialSong.artworkUrl, binding.imgPlayerThumb)
        }

        binding.btnPlayerPlayPause.setOnClickListener {
            PlaybackManager.togglePlayPause()
        }

        binding.btnPlayerNext.setOnClickListener {
            PlaybackManager.playNext()
        }

        binding.btnPlayerPrev.setOnClickListener {
            PlaybackManager.playPrevious()
        }

        binding.playerSeekBar.setOnSeekBarChangeListener(
            object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    // Update visual state smoothly while dragging without spamming MediaPlayer.seekTo
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) {
                    isTrackingSeekBar = true
                }

                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    seekBar?.let {
                        PlaybackManager.seekTo(it.progress)
                    }
                    isTrackingSeekBar = false
                }
            },
        )
    }

    // ==========================================================
    // PlaybackListener Callbacks
    // ==========================================================
    override fun onSongChanged(song: Song) {
        binding.tvPlayerTitle.text = song.title
        binding.tvPlayerArtist.text = song.artist
        ImageLoader.load(song.artworkUrl, binding.imgPlayerThumb)
        @Suppress("NotifyDataSetChanged")
        songAdapter.notifyDataSetChanged()
        if (::homeSongAdapter.isInitialized) {
            @Suppress("NotifyDataSetChanged")
            homeSongAdapter.notifyDataSetChanged()
        }
        UbiTelemetryManager.log("hitTrackPlayback", "${song.title} by ${song.artist}")
    }

    override fun onPlaybackStateChanged(isPlaying: Boolean) {
        binding.btnPlayerPlayPause.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
        binding.btnTopResultPlay.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
        binding.btnPlayLikedSongs.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
    }

    override fun onProgressUpdate(currentPositionMs: Int, totalDurationMs: Int) {
        if (!isTrackingSeekBar) {
            binding.playerSeekBar.max = totalDurationMs
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                binding.playerSeekBar.setProgress(currentPositionMs, true)
            } else {
                binding.playerSeekBar.progress = currentPositionMs
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        searchRunnable?.let { searchHandler.removeCallbacks(it) }
        PlaybackManager.removeListener(this)
    }
}
