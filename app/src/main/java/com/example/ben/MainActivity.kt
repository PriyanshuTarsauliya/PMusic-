package com.example.ben

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognizerIntent
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
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

    private val voiceSearchLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val spokenText = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (!spokenText.isNullOrBlank()) {
                binding.etSearch.setText(spokenText)
                binding.etSearch.setSelection(spokenText.length)
                performLiveSearch(spokenText)
                Toast.makeText(this, "Searching: $spokenText", Toast.LENGTH_SHORT).show()
            }
        }
    }

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

        PlaybackManager.attachWebView(binding.webViewPlayer)
        PlaylistManager.init(this)
        UserLibraryManager.init(this)
        UserLibraryManager.syncFromBackend(sessionManager.getAuthToken()) {
            runOnUiThread {
                updateLikedSongsCount()
                @Suppress("NotifyDataSetChanged")
                songAdapter.notifyDataSetChanged()
                if (::homeSongAdapter.isInitialized) {
                    @Suppress("NotifyDataSetChanged")
                    homeSongAdapter.notifyDataSetChanged()
                }
            }
        }
        UserLibraryManager.addListener {
            runOnUiThread {
                updateLikedSongsCount()
                @Suppress("NotifyDataSetChanged")
                songAdapter.notifyDataSetChanged()
                if (::homeSongAdapter.isInitialized) {
                    @Suppress("NotifyDataSetChanged")
                    homeSongAdapter.notifyDataSetChanged()
                }
            }
        }
        PlaybackManager.authToken = sessionManager.getAuthToken()
        PlaybackManager.onStreamDisplaced = { playingOn ->
            Toast.makeText(this, "Audio paused: playback active on $playingOn", Toast.LENGTH_LONG).show()
        }

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

        // Preload top curated album art into fast memory cache on background thread
        ImageLoader.preload(SpotifySearchEngine.defaultCuratedSongs.take(8).map { it.artworkUrl })
    }

    fun updateUserProfileUI() {
        val displayName = sessionManager.getDisplayName()
        val initial = if (displayName.isNotBlank()) displayName.first().uppercase() else "U"
        binding.tvUserAvatarInitial.text = initial
        binding.tvLibraryUserAvatarInitial.text = initial
        binding.tvUserGreeting.text = getString(R.string.user_greeting, displayName)
    }

    fun performLogout() {
        sessionManager.logout()
        PlaybackManager.release()
        UbiTelemetryManager.log("hitLogout", "User logged out")
        Toast.makeText(this, "Logged out of Spotify", Toast.LENGTH_SHORT).show()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    private fun setupUserHeader() {
        val displayName = sessionManager.getDisplayName()
        val accountType = sessionManager.getAccountType()

        binding.tvUserGreeting.text = getString(R.string.user_greeting, displayName)
        binding.tvAccountBadge.text = accountType
        updateUserProfileUI()

        // Profile Avatar Click -> Opens Profile Bottom Sheet
        binding.btnUserProfile.setOnClickListener {
            UbiTelemetryManager.log("hitProfileOpen", "User opened Spotify Profile sheet from Home")
            ProfileBottomSheet.newInstance().show(supportFragmentManager, ProfileBottomSheet.TAG)
        }

        // Library Tab Profile Avatar Click -> Opens Profile Bottom Sheet
        binding.btnLibraryUserProfile.setOnClickListener {
            UbiTelemetryManager.log("hitProfileOpen", "User opened Spotify Profile sheet from Library")
            ProfileBottomSheet.newInstance().show(supportFragmentManager, ProfileBottomSheet.TAG)
        }

        // Synchronize latest profile in background from backend
        syncProfileFromBackend()

        // Open Feedback & Excel Exporter Dialog
        binding.btnFeedback.setOnClickListener {
            UbiTelemetryManager.log("hitFeedbackOpen", "User opened feedback dialog")
            showFeedbackDialog()
        }

        // Open REA Evidence & Telemetry Inspector
        binding.btnReaInspector.setOnClickListener {
            UbiTelemetryManager.log("hitInspectorOpen", "User opened Spotify REA Architecture Inspector")
            ReaInspectorBottomSheet.newInstance().show(supportFragmentManager, ReaInspectorBottomSheet.TAG)
        }

        binding.btnLogout.setOnClickListener {
            performLogout()
        }
    }

    private fun syncProfileFromBackend() {
        val token = sessionManager.getAuthToken()
        if (token.isBlank()) return

        java.util.concurrent.Executors.newSingleThreadExecutor().execute {
            try {
                val url = java.net.URL(BackendConfig.getUrl("/api/user/profile"))
                val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 3000
                    readTimeout = 3000
                    setRequestProperty("Authorization", "Bearer $token")
                }
                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = org.json.JSONObject(response)
                    val profile = json.optJSONObject("profile")
                    if (profile != null) {
                        val backendName = profile.optString("displayName", "")
                        val backendAvatar = profile.optString("avatar", "")
                        if (backendName.isNotBlank()) {
                            sessionManager.saveProfile(backendName, backendAvatar)
                            runOnUiThread { updateUserProfileUI() }
                        }
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {
                // Offline fallback
            }
        }
    }

    private fun showFeedbackDialog() {
        val context = this
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 24, 48, 24)
        }

        val tvName = TextView(context).apply {
            text = "Your Name:"
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            textSize = 14f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        val etName = EditText(context).apply {
            hint = "e.g. Priyanshu"
            setHintTextColor(ContextCompat.getColor(context, R.color.spotify_subdued))
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            setText(sessionManager.getDisplayName())
        }

        val tvDetail = TextView(context).apply {
            text = "Feedback Details:"
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            textSize = 14f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 24, 0, 0)
        }
        val etDetail = EditText(context).apply {
            hint = "Write your feedback, feature ideas, or song requests..."
            setHintTextColor(ContextCompat.getColor(context, R.color.spotify_subdued))
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            minLines = 3
        }

        layout.addView(tvName)
        layout.addView(etName)
        layout.addView(tvDetail)
        layout.addView(etDetail)

        val dialog = androidx.appcompat.app.AlertDialog.Builder(context)
            .setTitle("📝 Feedback & Excel Exporter")
            .setMessage("Your feedback will be recorded and exported directly to an Excel sheet.")
            .setView(layout)
            .setPositiveButton("Submit & Save Excel") { _, _ ->
                val name = etName.text.toString().trim()
                val detail = etDetail.text.toString().trim()

                if (name.isEmpty() || detail.isEmpty()) {
                    Toast.makeText(context, "Please enter both name and feedback details.", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val now = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
                val feedbackId = "FB-" + System.currentTimeMillis().toString(36).uppercase()

                // Export to Excel-compatible CSV file with UTF-8 BOM
                try {
                    val downloadsDir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
                        ?: context.filesDir
                    val excelFile = java.io.File(downloadsDir, "PMusic_Feedback_Report.csv")
                    val isNewFile = !excelFile.exists()

                    java.io.FileOutputStream(excelFile, true).bufferedWriter(Charsets.UTF_8).use { writer ->
                        if (isNewFile) {
                            writer.write("\uFEFF\"Feedback ID\",\"Date & Time\",\"Name\",\"Details\",\"Platform\"\n")
                        }
                        val safeName = name.replace("\"", "\"\"")
                        val safeDetail = detail.replace("\"", "\"\"")
                        writer.write("\"$feedbackId\",\"$now\",\"$safeName\",\"$safeDetail\",\"Android App\"\n")
                    }

                    UbiTelemetryManager.log("hitFeedbackSubmitted", "$name: $detail")
                    Toast.makeText(
                        context,
                        "Feedback recorded & exported to Excel sheet!\nSaved in: ${excelFile.name}",
                        Toast.LENGTH_LONG
                    ).show()
                } catch (e: Exception) {
                    Toast.makeText(context, "Feedback recorded. (Excel note: ${e.message})", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .create()

        dialog.show()
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
            if (curated.size > 2) ImageLoader.load(curated[2].artworkUrl, binding.imgTileRomanticSongs)
            if (curated.size > 1) ImageLoader.load(curated[1].artworkUrl, binding.imgTileDailyMix)
            if (curated.size > 5) ImageLoader.load(curated[5].artworkUrl, binding.imgTileDiscoverWeekly)
            if (curated.size > 4) ImageLoader.load(curated[4].artworkUrl, binding.imgTilePopHits)
            if (curated.size > 13) ImageLoader.load(curated[13].artworkUrl, binding.imgTileChillVibes)
            if (curated.size > 3) ImageLoader.load(curated[3].artworkUrl, binding.imgTileRockClassics)
        }

        // Spotify 8-Tile Quick Access actions
        binding.tileLikedSongs.setOnClickListener {
            val liked = UserLibraryManager.getLikedSongs()
            val toPlay = if (liked.isNotEmpty()) liked else SpotifySearchEngine.defaultCuratedSongs
            PlaybackManager.setQueueAndPlay(toPlay, 0)
            Toast.makeText(this, if (liked.isNotEmpty()) "Playing Liked Songs (${liked.size})" else "Playing Liked Songs", Toast.LENGTH_SHORT).show()
        }
        binding.tileTopHits.setOnClickListener {
            val topHits = curated.sortedByDescending { it.popularity }
            PlaybackManager.setQueueAndPlay(topHits, 0)
            Toast.makeText(this, "Playing Today's Top Hits", Toast.LENGTH_SHORT).show()
        }
        binding.tileRomanticSongs.setOnClickListener {
            val romantic = getRomanticSongs(curated)
            PlaybackManager.setQueueAndPlay(romantic, 0)
            Toast.makeText(this, "Playing Romantic Songs", Toast.LENGTH_SHORT).show()
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
            val popTracks = curated.filter { it.popularity >= 93 }
            PlaybackManager.setQueueAndPlay(if (popTracks.isNotEmpty()) popTracks else curated, 0)
            Toast.makeText(this, "Playing Pop Upbeat", Toast.LENGTH_SHORT).show()
        }
        binding.tileChillVibes.setOnClickListener {
            val chill = curated.filter { it.title.contains("feather", true) || it.title.contains("someone", true) || it.title.contains("viva", true) || it.popularity < 95 }
            PlaybackManager.setQueueAndPlay(if (chill.isNotEmpty()) chill else curated, 0)
            Toast.makeText(this, "Playing Chill Vibes", Toast.LENGTH_SHORT).show()
        }
        binding.tileRockClassics.setOnClickListener {
            val classics = curated.filter { it.album.contains("Night", true) || it.title.contains("Bohemian", true) || it.artist.contains("Queen", true) || it.artist.contains("Dragons", true) }
            PlaybackManager.setQueueAndPlay(if (classics.isNotEmpty()) classics else curated, 0)
            Toast.makeText(this, "Playing Release Radar", Toast.LENGTH_SHORT).show()
        }

        // Home Category Filter Chips
        val homeChips = listOf(binding.chipHomeAll, binding.chipHomeTopSongs, binding.chipHomeRomantic, binding.chipHomePop, binding.chipHomeChill)
        homeChips.forEach { chip ->
            chip.setOnClickListener { selected ->
                homeChips.forEach { c ->
                    if (c == selected) {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button)
                        c.setTextColor(ContextCompat.getColor(this, R.color.black))
                    } else {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button_outlined)
                        c.setTextColor(ContextCompat.getColor(this, R.color.spotify_white))
                    }
                }
                when (selected.id) {
                    R.id.chipHomeTopSongs -> {
                        val top = curated.sortedByDescending { it.popularity }
                        homeSongAdapter.updateSongs(top)
                        Toast.makeText(this, "Showing Top Songs", Toast.LENGTH_SHORT).show()
                    }
                    R.id.chipHomeRomantic -> {
                        val romantic = getRomanticSongs(curated)
                        homeSongAdapter.updateSongs(romantic)
                        Toast.makeText(this, "Showing Romantic Songs", Toast.LENGTH_SHORT).show()
                    }
                    R.id.chipHomePop -> {
                        val pop = curated.filter { it.popularity >= 93 }
                        homeSongAdapter.updateSongs(pop)
                        Toast.makeText(this, "Showing Pop Hits", Toast.LENGTH_SHORT).show()
                    }
                    R.id.chipHomeChill -> {
                        val chill = curated.filter { it.title.contains("feather", true) || it.title.contains("someone", true) || it.title.contains("viva", true) || it.popularity < 95 }
                        homeSongAdapter.updateSongs(chill)
                        Toast.makeText(this, "Showing Chill Tracks", Toast.LENGTH_SHORT).show()
                    }
                    else -> {
                        homeSongAdapter.updateSongs(curated)
                    }
                }
            }
        }

        // Recently Played Carousel Cards (Dynamic listening history)
        renderRecentCarousel()

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
                UserLibraryManager.toggleLike(song, sessionManager.getAuthToken()) {
                    UbiTelemetryManager.log("hitLike", "${song.title} (${if (song.isLiked) "Added" else "Removed"})")
                    Toast.makeText(this, if (song.isLiked) "Added to Liked Songs" else "Removed from Liked Songs", Toast.LENGTH_SHORT).show()
                    updateLikedSongsCount()
                    @Suppress("NotifyDataSetChanged")
                    songAdapter.notifyDataSetChanged()
                    @Suppress("NotifyDataSetChanged")
                    homeSongAdapter.notifyDataSetChanged()
                }
            },
            onMoreClick = { song ->
                showTrackOptionsDialog(song)
            }
        )

        binding.rvHomeSongs.apply {
            setHasFixedSize(true)
            setItemViewCacheSize(25)
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
        renderRecentSearches()

        binding.etSearch.doOnTextChanged { text, _, _, _ ->
            val query = text?.toString()?.trim().orEmpty()
            binding.btnClearSearch.visibility = if (query.isNotEmpty()) View.VISIBLE else View.GONE
            if (query.isEmpty()) {
                renderRecentSearches()
            } else {
                binding.layoutRecentSearches.visibility = View.GONE
            }

            searchRunnable?.let { searchHandler.removeCallbacks(it) }
            searchRunnable = Runnable {
                performLiveSearch(query)
            }
            searchHandler.postDelayed(searchRunnable!!, 300)
        }

        binding.btnClearSearch.setOnClickListener {
            binding.etSearch.text.clear()
            renderRecentSearches()
        }

        binding.btnClearRecentSearches.setOnClickListener {
            clearRecentSearches()
        }

        binding.btnSearchMic.setOnClickListener {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "hi-IN")
                putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
                putExtra(RecognizerIntent.EXTRA_SUPPORTED_LANGUAGES, arrayListOf("hi-IN", "en-IN", "en-US"))
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak now in Hindi or English (बोलिए)...")
            }
            try {
                voiceSearchLauncher.launch(intent)
            } catch (e: ActivityNotFoundException) {
                Toast.makeText(this, "Voice recognition is not supported on this device", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun performLiveSearch(query: String) {
        val trimmed = query.trim()
        if (trimmed.isNotEmpty()) {
            saveRecentSearch(trimmed)
        }

        binding.searchProgressBar.visibility = View.VISIBLE

        SpotifySearchEngine.search(trimmed) { results ->
            binding.searchProgressBar.visibility = View.GONE
            currentFilteredSongs = results
            applyCategoryFilter()
        }
    }

    private fun setupCategoryChips() {
        val chips = listOf(
            binding.chipAll,
            binding.chipYouTube,
            binding.chipHindi,
            binding.chipTopSongs,
            binding.chipRomantic,
            binding.chipSongs,
            binding.chipArtists,
            binding.chipPlaylists,
            binding.chipPop,
            binding.chipRock
        )
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

                if (activeCategory.contains("YouTube", true) && binding.etSearch.text.isNullOrBlank()) {
                    binding.etSearch.setText("Trending Music Hits")
                } else if (activeCategory.contains("Hindi", true) && binding.etSearch.text.isNullOrBlank()) {
                    binding.etSearch.setText("Bollywood Hindi Hits")
                }

                applyCategoryFilter()
            }
        }
    }

    private fun applyCategoryFilter() {
        val filtered = when {
            activeCategory.contains("YouTube", true) -> {
                val yts = currentFilteredSongs.filter { it.youtubeId != null || it.id.startsWith("yt-") }
                if (yts.isNotEmpty()) yts else currentFilteredSongs
            }
            activeCategory.contains("Hindi", true) -> {
                val hindiList = currentFilteredSongs.filter { s ->
                    val combined = "${s.title} ${s.artist} ${s.album}"
                    combined.any { it in '\u0900'..'\u097F' } ||
                    combined.contains("hindi", true) ||
                    combined.contains("bollywood", true) ||
                    combined.contains("arijit", true) ||
                    combined.contains("shreya", true) ||
                    combined.contains("atif", true) ||
                    combined.contains("jubin", true) ||
                    combined.contains("badshah", true) ||
                    combined.contains("sonu", true) ||
                    combined.contains("kishore", true)
                }
                if (hindiList.isNotEmpty()) hindiList else currentFilteredSongs
            }
            activeCategory.contains("Top Songs", true) -> currentFilteredSongs.sortedByDescending { it.popularity }
            activeCategory.contains("Romantic", true) -> getRomanticSongs(currentFilteredSongs)
            activeCategory.contains("Pop", true) -> currentFilteredSongs.filter { it.popularity >= 93 || it.artist.contains("Dua", true) || it.artist.contains("Taylor", true) }
            activeCategory.contains("Rock", true) -> currentFilteredSongs.filter { it.album.contains("Opera", true) || it.title.contains("Bohemian", true) || it.artist.contains("Queen", true) || it.artist.contains("Dragons", true) || it.artist.contains("Coldplay", true) }
            activeCategory.equals("Artists", true) -> currentFilteredSongs.distinctBy { it.artist }
            activeCategory.equals("Playlists", true) -> currentFilteredSongs.sortedBy { it.album }
            else -> currentFilteredSongs
        }
        displayedSongs = filtered
        songAdapter.updateSongs(filtered)
        setupTopResult()
    }

    private fun getRomanticSongs(source: List<Song>): List<Song> {
        val romantic = source.filter { s ->
            s.title.contains("summer", true) ||
            s.title.contains("love", true) ||
            s.title.contains("feather", true) ||
            s.title.contains("someone", true) ||
            s.title.contains("shape", true) ||
            s.title.contains("flowers", true) ||
            s.title.contains("as it was", true) ||
            s.title.contains("starboy", true) ||
            s.artist.contains("swift", true) ||
            s.artist.contains("sheeran", true) ||
            s.artist.contains("capaldi", true) ||
            s.album.contains("lover", true)
        }
        return if (romantic.isNotEmpty()) romantic else source
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
                UserLibraryManager.toggleLike(song, sessionManager.getAuthToken()) {
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
            },
            onMoreClick = { song ->
                showTrackOptionsDialog(song)
            }
        )

        binding.rvSongs.apply {
            setHasFixedSize(true)
            setItemViewCacheSize(25)
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
        PlaylistManager.addListener {
            renderCustomPlaylists()
        }
        renderCustomPlaylists()

        val curated = SpotifySearchEngine.defaultCuratedSongs
        if (curated.isNotEmpty()) {
            ImageLoader.load(curated[0].artworkUrl, binding.imgLibRow1)
            if (curated.size > 1) ImageLoader.load(curated[1].artworkUrl, binding.imgLibRow2)
            if (curated.isNotEmpty()) ImageLoader.load(curated[0].artworkUrl, binding.imgLibRow3)
            if (curated.size > 5) ImageLoader.load(curated[5].artworkUrl, binding.imgLibRow4)
        }

        binding.btnLibraryAdd.setOnClickListener {
            showCreatePlaylistDialog()
        }

        binding.btnLibraryImport.setOnClickListener {
            ChatImportBottomSheet.newInstance().show(supportFragmentManager, ChatImportBottomSheet.TAG)
        }

        binding.btnLibrarySearch.setOnClickListener {
            binding.bottomNavigation.selectedItemId = R.id.nav_search
        }

        // Library filter chips
        val libChips = listOf(binding.chipLibPlaylists, binding.chipLibArtists, binding.chipLibAlbums, binding.chipLibDownloaded)
        libChips.forEach { chip ->
            chip.setOnClickListener { selected ->
                var selectedCategory = "All"
                libChips.forEach { c ->
                    if (c == selected) {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button)
                        c.setTextColor(ContextCompat.getColor(this, R.color.black))
                        selectedCategory = (selected as? Button)?.text?.toString() ?: "All"
                    } else {
                        c.background = ContextCompat.getDrawable(this, R.drawable.bg_spotify_button_outlined)
                        c.setTextColor(ContextCompat.getColor(this, R.color.spotify_white))
                    }
                }
                applyLibraryFilter(selectedCategory)
            }
        }

        // Play Liked Songs
        val playLikedAction = View.OnClickListener {
            val liked = UserLibraryManager.getLikedSongs()
            val toPlay = if (liked.isNotEmpty()) liked else SpotifySearchEngine.defaultCuratedSongs
            if (PlaybackManager.currentSong != null && toPlay.any { it.id == PlaybackManager.currentSong?.id }) {
                PlaybackManager.togglePlayPause()
            } else {
                PlaybackManager.setQueueAndPlay(toPlay, 0)
                Toast.makeText(this, if (liked.isNotEmpty()) "Playing Liked Songs (${liked.size})" else "Playing Liked Songs", Toast.LENGTH_SHORT).show()
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

    private fun renderCustomPlaylists() {
        binding.layoutCustomPlaylists.removeAllViews()
        val playlists = PlaylistManager.getPlaylists()

        if (playlists.isEmpty()) {
            binding.tvCustomPlaylistsHeader.visibility = View.GONE
            binding.layoutCustomPlaylists.visibility = View.GONE
            return
        }

        binding.tvCustomPlaylistsHeader.visibility = View.VISIBLE
        binding.layoutCustomPlaylists.visibility = View.VISIBLE

        val context = this
        playlists.forEach { pl ->
            val row = LinearLayout(context).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    (68 * resources.displayMetrics.density).toInt()
                )
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                val padH = (16 * resources.displayMetrics.density).toInt()
                setPadding(padH, 0, padH, 0)
                isClickable = true
                isFocusable = true
                setBackgroundResource(android.R.drawable.list_selector_background)
            }

            val card = androidx.cardview.widget.CardView(context).apply {
                val size = (48 * resources.displayMetrics.density).toInt()
                layoutParams = LinearLayout.LayoutParams(size, size)
                radius = 6 * resources.displayMetrics.density
                cardElevation = 0f
            }

            val img = ImageView(context).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                scaleType = ImageView.ScaleType.CENTER_CROP
            }
            ImageLoader.load(pl.artworkUrl, img)
            card.addView(img)
            row.addView(card)

            val textLayout = LinearLayout(context).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = (14 * resources.displayMetrics.density).toInt()
                }
                orientation = LinearLayout.VERTICAL
            }

            val tvTitle = TextView(context).apply {
                text = pl.title
                setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
                textSize = 15f
                setTypeface(null, android.graphics.Typeface.BOLD)
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            }

            val tvSub = TextView(context).apply {
                text = "Playlist • ${pl.curator} • ${pl.tracks.size} ${if (pl.tracks.size == 1) "song" else "songs"}"
                setTextColor(ContextCompat.getColor(context, R.color.spotify_subdued))
                textSize = 12f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            }

            textLayout.addView(tvTitle)
            textLayout.addView(tvSub)
            row.addView(textLayout)

            row.setOnClickListener {
                showPlaylistDetailDialog(pl)
            }

            binding.layoutCustomPlaylists.addView(row)
        }
    }

    private fun showPlaylistDetailDialog(playlist: Playlist) {
        val context = this
        val trackNames = if (playlist.tracks.isEmpty()) {
            arrayOf("No songs yet. Tap 3-dots on any song to add it here!")
        } else {
            playlist.tracks.map { "${it.title} - ${it.artist}" }.toTypedArray()
        }

        val dialog = androidx.appcompat.app.AlertDialog.Builder(context, androidx.appcompat.R.style.Theme_AppCompat_Dialog_Alert)
            .setTitle(playlist.title)
            .setMessage("${playlist.description} (${playlist.tracks.size} songs)")
            .setItems(trackNames) { _, which ->
                if (playlist.tracks.isNotEmpty() && which in playlist.tracks.indices) {
                    PlaybackManager.setQueueAndPlay(playlist.tracks, which)
                    Toast.makeText(context, "Playing ${playlist.tracks[which].title}", Toast.LENGTH_SHORT).show()
                }
            }
            .setPositiveButton(if (playlist.tracks.isNotEmpty()) "▶ Play All" else "Close") { _, _ ->
                if (playlist.tracks.isNotEmpty()) {
                    PlaybackManager.setQueueAndPlay(playlist.tracks, 0)
                    Toast.makeText(context, "Playing playlist ${playlist.title}", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Delete Playlist") { _, _ ->
                PlaylistManager.deletePlaylist(playlist.id)
                Toast.makeText(context, "Deleted ${playlist.title}", Toast.LENGTH_SHORT).show()
            }
            .create()

        dialog.show()
    }

    private fun applyLibraryFilter(category: String) {
        when (category) {
            "Playlists" -> {
                binding.cardLikedSongs.visibility = View.VISIBLE
                binding.rowLibTopHits.visibility = View.VISIBLE
                binding.rowLibDailyMix.visibility = View.VISIBLE
                binding.layoutCustomPlaylists.visibility = View.VISIBLE
                binding.tvCustomPlaylistsHeader.visibility = View.VISIBLE
                binding.rowLibArtistWeeknd.visibility = View.GONE
                binding.rowLibArtistBillie.visibility = View.GONE
            }
            "Artists" -> {
                binding.cardLikedSongs.visibility = View.GONE
                binding.rowLibTopHits.visibility = View.GONE
                binding.rowLibDailyMix.visibility = View.GONE
                binding.layoutCustomPlaylists.visibility = View.GONE
                binding.tvCustomPlaylistsHeader.visibility = View.GONE
                binding.rowLibArtistWeeknd.visibility = View.VISIBLE
                binding.rowLibArtistBillie.visibility = View.VISIBLE
            }
            "Albums" -> {
                binding.cardLikedSongs.visibility = View.GONE
                binding.rowLibTopHits.visibility = View.VISIBLE
                binding.rowLibDailyMix.visibility = View.VISIBLE
                binding.layoutCustomPlaylists.visibility = View.GONE
                binding.tvCustomPlaylistsHeader.visibility = View.GONE
                binding.rowLibArtistWeeknd.visibility = View.GONE
                binding.rowLibArtistBillie.visibility = View.GONE
            }
            "Downloaded" -> {
                binding.cardLikedSongs.visibility = View.VISIBLE
                binding.rowLibTopHits.visibility = View.VISIBLE
                binding.rowLibDailyMix.visibility = View.GONE
                binding.layoutCustomPlaylists.visibility = View.VISIBLE
                binding.tvCustomPlaylistsHeader.visibility = View.VISIBLE
                binding.rowLibArtistWeeknd.visibility = View.GONE
                binding.rowLibArtistBillie.visibility = View.GONE
            }
            else -> {
                binding.cardLikedSongs.visibility = View.VISIBLE
                binding.rowLibTopHits.visibility = View.VISIBLE
                binding.rowLibDailyMix.visibility = View.VISIBLE
                binding.layoutCustomPlaylists.visibility = View.VISIBLE
                binding.tvCustomPlaylistsHeader.visibility = View.VISIBLE
                binding.rowLibArtistWeeknd.visibility = View.VISIBLE
                binding.rowLibArtistBillie.visibility = View.VISIBLE
            }
        }
    }

    private fun showTrackOptionsDialog(song: Song) {
        val context = this
        val likeLabel = if (song.isLiked) "Remove from Liked Songs" else "Save to your Liked Songs"
        val options = arrayOf(
            "Add to Playlist",
            "Add to Queue",
            "Play Next",
            "Equalizer & Audio FX",
            likeLabel
        )

        androidx.appcompat.app.AlertDialog.Builder(context, androidx.appcompat.R.style.Theme_AppCompat_Dialog_Alert)
            .setTitle("${song.title}\n${song.artist}")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> showAddToPlaylistDialog(song)
                    1 -> {
                        PlaybackManager.addToQueue(song)
                        Toast.makeText(context, "Added \"${song.title}\" to queue", Toast.LENGTH_SHORT).show()
                    }
                    2 -> {
                        PlaybackManager.playNextInQueue(song)
                        Toast.makeText(context, "\"${song.title}\" will play next", Toast.LENGTH_SHORT).show()
                    }
                    3 -> {
                        EqualizerBottomSheet.newInstance().show(supportFragmentManager, EqualizerBottomSheet.TAG)
                    }
                    4 -> {
                        UserLibraryManager.toggleLike(song, sessionManager.getAuthToken()) {
                            Toast.makeText(context, if (song.isLiked) "Saved to Liked Songs" else "Removed from Liked Songs", Toast.LENGTH_SHORT).show()
                            updateLikedSongsCount()
                            @Suppress("NotifyDataSetChanged")
                            songAdapter.notifyDataSetChanged()
                            if (::homeSongAdapter.isInitialized) {
                                @Suppress("NotifyDataSetChanged")
                                homeSongAdapter.notifyDataSetChanged()
                            }
                        }
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showAddToPlaylistDialog(song: Song) {
        val context = this
        val playlists = PlaylistManager.getPlaylists()
        val items = mutableListOf("+ Create New Playlist")
        items.addAll(playlists.map { "${it.title} (${it.tracks.size} songs)" })

        androidx.appcompat.app.AlertDialog.Builder(context, androidx.appcompat.R.style.Theme_AppCompat_Dialog_Alert)
            .setTitle("Add to Playlist")
            .setItems(items.toTypedArray()) { _, which ->
                if (which == 0) {
                    showCreatePlaylistDialog(initialSong = song)
                } else {
                    val pl = playlists[which - 1]
                    val added = PlaylistManager.addSongToPlaylist(pl.id, song)
                    if (added) {
                        Toast.makeText(context, "Added \"${song.title}\" to ${pl.title}", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "\"${song.title}\" is already in ${pl.title}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showCreatePlaylistDialog(initialSong: Song? = null) {
        val context = this
        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 24, 48, 24)
        }

        val tvTitle = TextView(context).apply {
            text = "Give your playlist a name"
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            textSize = 16f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, 16)
        }

        val etName = EditText(context).apply {
            hint = "My Playlist #${PlaylistManager.getPlaylists().size + 1}"
            setHintTextColor(ContextCompat.getColor(context, R.color.spotify_subdued))
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            background = ContextCompat.getDrawable(context, R.drawable.bg_edittext)
            setPadding(24, 20, 24, 20)
        }

        layout.addView(tvTitle)
        layout.addView(etName)

        val dialog = androidx.appcompat.app.AlertDialog.Builder(context, androidx.appcompat.R.style.Theme_AppCompat_Dialog_Alert)
            .setTitle("New Playlist")
            .setView(layout)
            .setPositiveButton("Create") { _, _ ->
                val name = etName.text.toString().trim().ifBlank { "My Playlist #${PlaylistManager.getPlaylists().size + 1}" }
                val newPl = PlaylistManager.createPlaylist(name, "Created by you", initialSong)
                Toast.makeText(context, "Playlist \"${newPl.title}\" created!", Toast.LENGTH_SHORT).show()
                UbiTelemetryManager.log("hitCreatePlaylistSuccess", newPl.title)
            }
            .setNegativeButton("Cancel", null)
            .create()

        dialog.show()
    }

    private fun updateLikedSongsCount() {
        val count = UserLibraryManager.getLikedCount()
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
            binding.tvPlayerDuration.text = "• 0:00 / ${initialSong.durationFormatted}"
            binding.playerSeekBar.max = initialSong.getDurationMs()
            binding.playerSeekBar.progress = 0
            ImageLoader.load(initialSong.artworkUrl, binding.imgPlayerThumb)
        }

        // Tap bottom player bar to expand full Now Playing screen
        binding.bottomPlayerBar.setOnClickListener {
            NowPlayingBottomSheet.newInstance().show(supportFragmentManager, NowPlayingBottomSheet.TAG)
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

        binding.btnPlayerSpeed.setOnClickListener {
            val nextSpeed = PlaybackManager.cyclePlaybackSpeed()
            updatePlayerSpeedUi(nextSpeed)
            Toast.makeText(this, "Speed: ${nextSpeed}x", Toast.LENGTH_SHORT).show()
        }

        binding.btnPlayerSpeed.setOnLongClickListener {
            showPlaybackSpeedDialog()
            true
        }
        updatePlayerSpeedUi(PlaybackManager.playbackSpeed)

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
    // RECENT SEARCHES & LISTENING HISTORY PERSISTENCE
    // ==========================================================
    private fun getRecentSearches(): List<String> {
        val raw = getSharedPreferences("pmusic_search_prefs", Context.MODE_PRIVATE)
            .getString("recent_queries", "[]") ?: "[]"
        val list = mutableListOf<String>()
        try {
            val jsonArr = org.json.JSONArray(raw)
            for (i in 0 until jsonArr.length()) {
                val str = jsonArr.optString(i, "")
                if (str.isNotBlank()) list.add(str)
            }
        } catch (_: Exception) {}
        return list
    }

    private fun saveRecentSearch(query: String) {
        val trimmed = query.trim()
        if (trimmed.isBlank()) return
        val current = getRecentSearches().toMutableList()
        current.remove(trimmed)
        current.add(0, trimmed)
        val capped = current.take(10)
        val jsonArr = org.json.JSONArray(capped)
        getSharedPreferences("pmusic_search_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("recent_queries", jsonArr.toString())
            .apply()
    }

    private fun clearRecentSearches() {
        getSharedPreferences("pmusic_search_prefs", Context.MODE_PRIVATE)
            .edit()
            .remove("recent_queries")
            .apply()
        renderRecentSearches()
        Toast.makeText(this, "Recent searches cleared", Toast.LENGTH_SHORT).show()
    }

    private fun renderRecentSearches() {
        val searches = getRecentSearches()
        if (binding.etSearch.text.isNullOrBlank() && searches.isNotEmpty()) {
            binding.layoutRecentSearches.visibility = View.VISIBLE
            binding.containerRecentSearchChips.removeAllViews()

            val context = this
            searches.forEach { q ->
                val chip = Button(context).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        (36 * resources.displayMetrics.density).toInt()
                    ).apply {
                        marginEnd = (8 * resources.displayMetrics.density).toInt()
                    }
                    background = ContextCompat.getDrawable(context, R.drawable.bg_spotify_button_outlined)
                    setPadding(
                        (14 * resources.displayMetrics.density).toInt(),
                        0,
                        (14 * resources.displayMetrics.density).toInt(),
                        0
                    )
                    text = "🔍 $q"
                    setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
                    textSize = 12f
                    isAllCaps = false
                    backgroundTintList = null

                    setOnClickListener {
                        binding.etSearch.setText(q)
                        binding.etSearch.setSelection(q.length)
                        performLiveSearch(q)
                    }
                }
                binding.containerRecentSearchChips.addView(chip)
            }
        } else {
            binding.layoutRecentSearches.visibility = View.GONE
        }
    }

    private fun getRecentlyPlayed(): List<Song> {
        val raw = getSharedPreferences("pmusic_history_prefs", Context.MODE_PRIVATE)
            .getString("recently_played_songs", "[]") ?: "[]"
        val list = mutableListOf<Song>()
        try {
            val jsonArr = org.json.JSONArray(raw)
            for (i in 0 until jsonArr.length()) {
                val obj = jsonArr.optJSONObject(i) ?: continue
                val s = Song(
                    id = obj.optString("id", ""),
                    title = obj.optString("title", ""),
                    artist = obj.optString("artist", "Unknown Artist"),
                    album = obj.optString("album", "Single"),
                    durationFormatted = obj.optString("durationFormatted", "3:30"),
                    audioUrl = obj.optString("audioUrl", ""),
                    artworkUrl = obj.optString("artworkUrl", ""),
                    isLiked = obj.optBoolean("isLiked", false),
                    youtubeId = obj.optString("youtubeId", "").takeIf { it.isNotBlank() },
                    durationMs = obj.optLong("durationMs", 180000L),
                    popularity = obj.optInt("popularity", 90)
                )
                if (s.title.isNotBlank()) list.add(s)
            }
        } catch (_: Exception) {}
        return if (list.isNotEmpty()) list else SpotifySearchEngine.defaultCuratedSongs
    }

    private fun saveRecentlyPlayed(song: Song) {
        val list = getRecentlyPlayed().filter { it.title != song.title }.toMutableList()
        list.add(0, song)
        val capped = list.take(10)
        val jsonArr = org.json.JSONArray()
        capped.forEach { s ->
            val obj = org.json.JSONObject().apply {
                put("id", s.id)
                put("title", s.title)
                put("artist", s.artist)
                put("album", s.album)
                put("durationFormatted", s.durationFormatted)
                put("audioUrl", s.audioUrl)
                put("artworkUrl", s.artworkUrl)
                put("isLiked", s.isLiked)
                put("youtubeId", s.youtubeId ?: "")
                put("durationMs", s.getDurationMs())
                put("popularity", s.popularity)
            }
            jsonArr.put(obj)
        }
        getSharedPreferences("pmusic_history_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("recently_played_songs", jsonArr.toString())
            .apply()
        runOnUiThread {
            renderRecentCarousel()
        }
    }

    private fun renderRecentCarousel() {
        val recent = getRecentlyPlayed()
        if (recent.isNotEmpty()) {
            binding.tvRecentTitle1.text = recent[0].title
            binding.tvRecentArtist1.text = recent[0].artist
            ImageLoader.load(recent[0].artworkUrl, binding.imgRecent1)
            binding.cardRecent1.setOnClickListener { PlaybackManager.setQueueAndPlay(recent, 0) }
        }
        if (recent.size > 1) {
            binding.tvRecentTitle2.text = recent[1].title
            binding.tvRecentArtist2.text = recent[1].artist
            ImageLoader.load(recent[1].artworkUrl, binding.imgRecent2)
            binding.cardRecent2.setOnClickListener { PlaybackManager.setQueueAndPlay(recent, 1) }
        }
        if (recent.size > 2) {
            binding.tvRecentTitle3.text = recent[2].title
            binding.tvRecentArtist3.text = recent[2].artist
            ImageLoader.load(recent[2].artworkUrl, binding.imgRecent3)
            binding.cardRecent3.setOnClickListener { PlaybackManager.setQueueAndPlay(recent, 2) }
        }
        if (recent.size > 3) {
            binding.tvRecentTitle4.text = recent[3].title
            binding.tvRecentArtist4.text = recent[3].artist
            ImageLoader.load(recent[3].artworkUrl, binding.imgRecent4)
            binding.cardRecent4.setOnClickListener { PlaybackManager.setQueueAndPlay(recent, 3) }
        }
    }

    // ==========================================================
    // PlaybackListener Callbacks
    // ==========================================================
    override fun onSongChanged(song: Song) {
        binding.tvPlayerTitle.text = song.title
        binding.tvPlayerArtist.text = song.artist
        binding.tvPlayerDuration.text = "• 0:00 / ${song.durationFormatted}"
        binding.playerSeekBar.max = song.getDurationMs()
        binding.playerSeekBar.progress = 0
        ImageLoader.load(song.artworkUrl, binding.imgPlayerThumb)
        @Suppress("NotifyDataSetChanged")
        songAdapter.notifyDataSetChanged()
        if (::homeSongAdapter.isInitialized) {
            @Suppress("NotifyDataSetChanged")
            homeSongAdapter.notifyDataSetChanged()
        }
        UbiTelemetryManager.log("hitTrackPlayback", "${song.title} by ${song.artist}")
        saveRecentlyPlayed(song)
    }

    override fun onPlaybackStateChanged(isPlaying: Boolean) {
        binding.btnPlayerPlayPause.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
        binding.btnTopResultPlay.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
        binding.btnPlayLikedSongs.setImageResource(if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play)
    }

    private fun formatProgressTime(millis: Int): String {
        val totalSeconds = (millis / 1000).coerceAtLeast(0)
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return String.format(java.util.Locale.US, "%d:%02d", minutes, seconds)
    }

    override fun onProgressUpdate(currentPositionMs: Int, totalDurationMs: Int) {
        val song = PlaybackManager.currentSong
        val fullDuration = if (totalDurationMs > 30000) totalDurationMs else (song?.getDurationMs() ?: totalDurationMs)
        val curStr = formatProgressTime(currentPositionMs)
        val durStr = song?.durationFormatted ?: formatProgressTime(fullDuration)

        binding.tvPlayerDuration.text = "• $curStr / $durStr"

        if (!isTrackingSeekBar && fullDuration > 0) {
            binding.playerSeekBar.max = fullDuration
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                binding.playerSeekBar.setProgress(currentPositionMs.coerceIn(0, fullDuration), true)
            } else {
                binding.playerSeekBar.progress = currentPositionMs.coerceIn(0, fullDuration)
            }
        }
    }

    override fun onPlaybackSpeedChanged(speed: Float) {
        updatePlayerSpeedUi(speed)
    }

    private fun updatePlayerSpeedUi(speed: Float) {
        val isNormal = kotlin.math.abs(speed - 1.0f) < 0.05f
        binding.btnPlayerSpeed.text = if (isNormal) "1.0x" else "${speed}x"
        if (isNormal) {
            binding.btnPlayerSpeed.setTextColor(ContextCompat.getColor(this, R.color.spotify_subdued))
            binding.btnPlayerSpeed.setBackgroundResource(R.drawable.bg_speed_pill)
        } else {
            binding.btnPlayerSpeed.setTextColor(ContextCompat.getColor(this, R.color.black))
            binding.btnPlayerSpeed.setBackgroundResource(R.drawable.bg_spotify_button_speed_active)
        }
    }

    private fun showPlaybackSpeedDialog() {
        val speeds = arrayOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        val labels = arrayOf("0.5x  (Slower)", "0.75x", "1.0x  (Normal)", "1.25x", "1.5x", "2.0x  (Faster)")
        val currentSpeed = PlaybackManager.playbackSpeed
        val selectedIdx = speeds.indexOfFirst { kotlin.math.abs(it - currentSpeed) < 0.05f }.coerceAtLeast(2)

        com.google.android.material.dialog.MaterialAlertDialogBuilder(this, R.style.SpotifyAlertDialogTheme)
            .setTitle("Playback Speed")
            .setSingleChoiceItems(labels, selectedIdx) { dialog, which ->
                val newSpeed = speeds[which]
                PlaybackManager.setPlaybackSpeed(newSpeed)
                updatePlayerSpeedUi(newSpeed)
                Toast.makeText(this, "Speed set to ${newSpeed}x", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onDestroy() {
        super.onDestroy()
        searchRunnable?.let { searchHandler.removeCallbacks(it) }
        PlaybackManager.removeListener(this)
    }
}
