package com.example.ben

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SeekBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.example.ben.databinding.DialogNowPlayingBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class NowPlayingBottomSheet : BottomSheetDialogFragment(), PlaybackManager.PlaybackListener {

    private var _binding: DialogNowPlayingBinding? = null
    private val binding get() = _binding!!
    private var isTrackingSeekBar = false
    private var isLyricsExpanded = false

    private val handler = Handler(Looper.getMainLooper())

    // Synced Lyrics Data Structures
    data class LyricLine(val timeMs: Int, val text: String)
    private var parsedLyricLines: List<LyricLine> = emptyList()
    private var currentActiveLyricIndex: Int = -1
    private var plainLyricsFallback: String? = null
    private var lyricsSongId: String? = null

    // Sleep Timer Engine
    private var sleepTimerEndsAt: Long = 0L
    private var sleepTimerMode: String? = null // "end" or minutes
    private var sleepTimerRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.SpotifyBottomSheetDialogTheme)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogNowPlayingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.let { d ->
            val bottomSheet = (d as? BottomSheetDialog)?.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
            bottomSheet?.let { sheet ->
                val behavior = BottomSheetBehavior.from(sheet)
                behavior.state = BottomSheetBehavior.STATE_EXPANDED
                behavior.skipCollapsed = true
            }
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnCollapseNowPlaying.setOnClickListener {
            dismiss()
        }

        binding.btnNowPlayingPlayPause.setOnClickListener {
            PlaybackManager.togglePlayPause()
        }

        binding.btnNowPlayingNext.setOnClickListener {
            PlaybackManager.playNext()
        }

        binding.btnNowPlayingPrev.setOnClickListener {
            PlaybackManager.playPrevious()
        }

        binding.btnNowPlayingShuffle.setOnClickListener {
            val isShuffle = PlaybackManager.toggleShuffle()
            updateShuffleUi(isShuffle)
        }

        binding.btnNowPlayingRepeat.setOnClickListener {
            val mode = PlaybackManager.toggleRepeat()
            updateRepeatUi(mode)
        }

        binding.btnNowPlayingLike.setOnClickListener {
            val current = PlaybackManager.currentSong
            if (current != null) {
                current.isLiked = !current.isLiked
                updateLikeUi(current.isLiked)
            }
        }

        binding.btnNowPlayingQueue.setOnClickListener {
            showQueueDialog()
        }

        // Equalizer Dialog
        binding.btnNowPlayingEqualizer.setOnClickListener {
            EqualizerBottomSheet.newInstance().show(parentFragmentManager, EqualizerBottomSheet.TAG)
        }

        // Sleep Timer
        binding.btnNowPlayingMore.setOnClickListener {
            showSleepTimerDialog()
        }
        updateSleepTimerUi()

        binding.btnNowPlayingSpeed.setOnClickListener {
            val newSpeed = PlaybackManager.cyclePlaybackSpeed()
            updateSpeedUi(newSpeed)
            Toast.makeText(requireContext(), "Speed: ${newSpeed}x", Toast.LENGTH_SHORT).show()
        }
        binding.btnNowPlayingSpeed.setOnLongClickListener {
            showPlaybackSpeedDialog()
            true
        }
        updateSpeedUi(PlaybackManager.playbackSpeed)

        binding.nowPlayingSeekBar.setOnSeekBarChangeListener(
            object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        binding.tvNowPlayingElapsed.text = formatTime(progress)
                    }
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
            }
        )

        binding.btnLyricsExpand.setOnClickListener {
            isLyricsExpanded = !isLyricsExpanded
            binding.tvLyricsContent.maxLines = if (isLyricsExpanded) 300 else 8
            binding.btnLyricsExpand.text = if (isLyricsExpanded) "LESS" else "MORE"
            if (parsedLyricLines.isNotEmpty() && currentActiveLyricIndex >= 0) {
                renderSyncedLyrics(currentActiveLyricIndex)
            }
        }

        PlaybackManager.currentSong?.let { onSongChanged(it) }
        onPlaybackStateChanged(PlaybackManager.isPlaying)
        updateShuffleUi(PlaybackManager.isShuffleEnabled)
        updateRepeatUi(PlaybackManager.repeatMode)

        PlaybackManager.addListener(this)
    }

    override fun onSongChanged(song: Song) {
        if (_binding == null) return
        binding.tvNowPlayingTitle.text = song.title
        binding.tvNowPlayingArtist.text = song.artist
        binding.tvNowPlayingContextTitle.text = song.album.ifBlank { "PMusic Master Collection" }
        binding.tvNowPlayingDuration.text = song.durationFormatted
        binding.nowPlayingSeekBar.max = song.getDurationMs()

        ImageLoader.load(song.artworkUrl, binding.imgNowPlayingArt)
        updateLikeUi(song.isLiked)

        // Check if sleep timer was set to "end of track"
        if (sleepTimerMode == "end") {
            sleepTimerMode = null
            PlaybackManager.pause()
            updateSleepTimerUi()
            Toast.makeText(requireContext(), "Sleep timer finished: Playback paused at end of song.", Toast.LENGTH_LONG).show()
            return
        }

        loadLyricsForSong(song)
    }

    override fun onPlaybackStateChanged(isPlaying: Boolean) {
        if (_binding == null) return
        val iconRes = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
        binding.btnNowPlayingPlayPause.setImageResource(iconRes)
    }

    override fun onProgressUpdate(currentPositionMs: Int, totalDurationMs: Int) {
        if (_binding == null || isTrackingSeekBar) return
        binding.nowPlayingSeekBar.max = totalDurationMs
        binding.nowPlayingSeekBar.progress = currentPositionMs
        binding.tvNowPlayingElapsed.text = formatTime(currentPositionMs)
        binding.tvNowPlayingDuration.text = formatTime(totalDurationMs)

        // Update real-time synced lyrics line
        if (parsedLyricLines.isNotEmpty()) {
            var activeIdx = -1
            for (i in parsedLyricLines.indices) {
                if (currentPositionMs >= parsedLyricLines[i].timeMs) {
                    activeIdx = i
                } else {
                    break
                }
            }
            if (activeIdx != currentActiveLyricIndex && activeIdx >= 0) {
                currentActiveLyricIndex = activeIdx
                renderSyncedLyrics(activeIdx)
            }
        }
    }

    override fun onPlaybackModeChanged(isShuffle: Boolean, repeatMode: PlaybackManager.RepeatMode) {
        if (_binding == null) return
        updateShuffleUi(isShuffle)
        updateRepeatUi(repeatMode)
    }

    override fun onPlaybackSpeedChanged(speed: Float) {
        if (_binding == null) return
        updateSpeedUi(speed)
    }

    // =========================================================================
    // REAL-TIME SYNCHRONIZED & PLAIN LYRICS ENGINE
    // =========================================================================

    private fun loadLyricsForSong(song: Song) {
        lyricsSongId = song.id
        parsedLyricLines = emptyList()
        currentActiveLyricIndex = -1
        plainLyricsFallback = null

        binding.tvLyricsContent.text = "Loading real-time lyrics for \"${song.title}\"..."

        SpotifySearchEngine.fetchLyrics(song.title, song.artist) { syncedLyrics, plainLyrics ->
            if (_binding == null || lyricsSongId != song.id) return@fetchLyrics

            if (!syncedLyrics.isNullOrBlank()) {
                val lines = parseLrc(syncedLyrics)
                if (lines.isNotEmpty()) {
                    parsedLyricLines = lines
                    plainLyricsFallback = plainLyrics
                    renderSyncedLyrics(0)
                    return@fetchLyrics
                }
            }

            if (!plainLyrics.isNullOrBlank()) {
                binding.tvLyricsContent.text = plainLyrics
                return@fetchLyrics
            }

            // Fallback lyrics when lyrics are instrumental or unavailable
            binding.tvLyricsContent.text = "♪ Instrumental / Lyrics Unavailable ♪\n\nEnjoy \"${song.title}\" by ${song.artist}\nFrom the album \"${song.album}\"\nHigh-Definition Stereo Sound on PMusic."
        }
    }

    private fun parseLrc(lrcText: String): List<LyricLine> {
        val result = mutableListOf<LyricLine>()
        val lrcRegex = Regex("""\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)""")

        lrcText.lines().forEach { line ->
            val match = lrcRegex.matchEntire(line.trim())
            if (match != null) {
                val min = match.groupValues[1].toIntOrNull() ?: 0
                val sec = match.groupValues[2].toIntOrNull() ?: 0
                val msPart = match.groupValues[3]
                val millis = (min * 60 + sec) * 1000 + (msPart.padEnd(3, '0').take(3).toIntOrNull() ?: 0)
                val text = match.groupValues[4].trim()
                if (text.isNotBlank()) {
                    result.add(LyricLine(millis, text))
                }
            }
        }
        return result
    }

    private fun renderSyncedLyrics(activeIndex: Int) {
        if (_binding == null || parsedLyricLines.isEmpty()) return

        val ssb = SpannableStringBuilder()
        val greenColor = ContextCompat.getColor(requireContext(), R.color.spotify_green)
        val whiteColor = ContextCompat.getColor(requireContext(), R.color.spotify_white)
        val subduedColor = ContextCompat.getColor(requireContext(), R.color.spotify_subdued)

        // Show window of lines around the active index if not expanded
        val displayLines = if (isLyricsExpanded) {
            parsedLyricLines
        } else {
            val start = maxOf(0, activeIndex - 2)
            val end = minOf(parsedLyricLines.size, activeIndex + 6)
            parsedLyricLines.subList(start, end)
        }

        displayLines.forEach { line ->
            val isCurrent = (line == parsedLyricLines.getOrNull(activeIndex))
            val lineStart = ssb.length
            val prefix = if (isCurrent) "▶ " else "   "
            ssb.append(prefix).append(line.text).append("\n\n")
            val lineEnd = ssb.length - 1

            if (isCurrent) {
                ssb.setSpan(ForegroundColorSpan(greenColor), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                ssb.setSpan(StyleSpan(android.graphics.Typeface.BOLD), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            } else {
                ssb.setSpan(ForegroundColorSpan(if (line.timeMs < (parsedLyricLines.getOrNull(activeIndex)?.timeMs ?: 0)) subduedColor else whiteColor), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }

        binding.tvLyricsContent.text = ssb
    }

    private fun updateSpeedUi(speed: Float) {
        if (_binding == null) return
        val isNormal = kotlin.math.abs(speed - 1.0f) < 0.05f
        binding.btnNowPlayingSpeed.text = if (isNormal) "1.0x" else "${speed}x"
        if (isNormal) {
            binding.btnNowPlayingSpeed.setTextColor(ContextCompat.getColor(requireContext(), R.color.spotify_subdued))
            binding.btnNowPlayingSpeed.setBackgroundResource(R.drawable.bg_speed_pill)
        } else {
            binding.btnNowPlayingSpeed.setTextColor(ContextCompat.getColor(requireContext(), R.color.black))
            binding.btnNowPlayingSpeed.setBackgroundResource(R.drawable.bg_spotify_button_speed_active)
        }
    }

    private fun showPlaybackSpeedDialog() {
        val speeds = arrayOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        val labels = arrayOf("0.5x  (Slower)", "0.75x", "1.0x  (Normal)", "1.25x", "1.5x", "2.0x  (Faster)")
        val currentSpeed = PlaybackManager.playbackSpeed
        val selectedIdx = speeds.indexOfFirst { kotlin.math.abs(it - currentSpeed) < 0.05f }.coerceAtLeast(2)

        com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext(), R.style.SpotifyAlertDialogTheme)
            .setTitle("Playback Speed")
            .setSingleChoiceItems(labels, selectedIdx) { dialog, which ->
                val newSpeed = speeds[which]
                PlaybackManager.setPlaybackSpeed(newSpeed)
                updateSpeedUi(newSpeed)
                Toast.makeText(requireContext(), "Speed set to ${newSpeed}x", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // =========================================================================
    // QUEUE VIEWER & MANAGER
    // =========================================================================

    private fun showQueueDialog() {
        val queue = PlaybackManager.queue
        val current = PlaybackManager.currentSong

        if (queue.isEmpty() && current == null) {
            Toast.makeText(requireContext(), "Playback queue is empty", Toast.LENGTH_SHORT).show()
            return
        }

        val items = mutableListOf<String>()
        if (current != null) {
            items.add("▶ Now Playing: ${current.title} - ${current.artist}")
        }
        queue.forEachIndexed { index, song ->
            val prefix = if (song.id == current?.id) "• [Playing] " else "${index + 1}. "
            items.add("$prefix${song.title} - ${song.artist}")
        }

        com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext(), R.style.SpotifyAlertDialogTheme)
            .setTitle("Play Queue (${queue.size} songs)")
            .setItems(items.toTypedArray()) { _, which ->
                val queueTargetIdx = if (current != null) which - 1 else which
                if (queueTargetIdx in queue.indices) {
                    PlaybackManager.playSong(queue[queueTargetIdx])
                    Toast.makeText(requireContext(), "Playing ${queue[queueTargetIdx].title}", Toast.LENGTH_SHORT).show()
                }
            }
            .setPositiveButton("Clear Queue") { _, _ ->
                PlaybackManager.clearQueue()
                Toast.makeText(requireContext(), "Queue cleared", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Close", null)
            .show()
    }

    // =========================================================================
    // SLEEP TIMER ENGINE
    // =========================================================================

    private fun showSleepTimerDialog() {
        val options = arrayOf(
            "Turn off timer",
            "5 minutes",
            "15 minutes",
            "30 minutes",
            "45 minutes",
            "1 hour",
            "End of this song"
        )

        com.google.android.material.dialog.MaterialAlertDialogBuilder(requireContext(), R.style.SpotifyAlertDialogTheme)
            .setTitle("Sleep Timer")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> cancelSleepTimer()
                    1 -> setSleepTimer(5)
                    2 -> setSleepTimer(15)
                    3 -> setSleepTimer(30)
                    4 -> setSleepTimer(45)
                    5 -> setSleepTimer(60)
                    6 -> setSleepTimerEnd()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun setSleepTimer(minutes: Int) {
        cancelSleepTimerRunnable()
        sleepTimerMode = minutes.toString()
        val durationMs = minutes * 60 * 1000L
        sleepTimerEndsAt = System.currentTimeMillis() + durationMs

        sleepTimerRunnable = Runnable {
            if (_binding != null) {
                PlaybackManager.pause()
                updateSleepTimerUi()
                Toast.makeText(requireContext(), "Sleep timer finished: Audio playback paused.", Toast.LENGTH_LONG).show()
            }
        }
        handler.postDelayed(sleepTimerRunnable!!, durationMs)

        updateSleepTimerUi()
        Toast.makeText(requireContext(), "Sleep timer set: Audio will pause in $minutes minutes", Toast.LENGTH_SHORT).show()
    }

    private fun setSleepTimerEnd() {
        cancelSleepTimerRunnable()
        sleepTimerMode = "end"
        updateSleepTimerUi()
        Toast.makeText(requireContext(), "Sleep timer set: Audio will pause at the end of this song", Toast.LENGTH_SHORT).show()
    }

    private fun cancelSleepTimer() {
        cancelSleepTimerRunnable()
        sleepTimerMode = null
        sleepTimerEndsAt = 0L
        updateSleepTimerUi()
        Toast.makeText(requireContext(), "Sleep timer turned off", Toast.LENGTH_SHORT).show()
    }

    private fun cancelSleepTimerRunnable() {
        sleepTimerRunnable?.let { handler.removeCallbacks(it) }
        sleepTimerRunnable = null
    }

    private fun updateSleepTimerUi() {
        if (_binding == null) return
        val isActive = sleepTimerMode != null
        val color = if (isActive) {
            ContextCompat.getColor(requireContext(), R.color.spotify_green)
        } else {
            ContextCompat.getColor(requireContext(), R.color.spotify_white)
        }
        binding.btnNowPlayingMore.setColorFilter(color)
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    private fun updateShuffleUi(isShuffle: Boolean) {
        val color = if (isShuffle) {
            ContextCompat.getColor(requireContext(), R.color.spotify_green)
        } else {
            ContextCompat.getColor(requireContext(), R.color.spotify_subdued)
        }
        binding.btnNowPlayingShuffle.setColorFilter(color)
    }

    private fun updateRepeatUi(mode: PlaybackManager.RepeatMode) {
        when (mode) {
            PlaybackManager.RepeatMode.OFF -> {
                binding.btnNowPlayingRepeat.setImageResource(R.drawable.ic_repeat)
                binding.btnNowPlayingRepeat.setColorFilter(
                    ContextCompat.getColor(requireContext(), R.color.spotify_subdued)
                )
            }
            PlaybackManager.RepeatMode.ALL -> {
                binding.btnNowPlayingRepeat.setImageResource(R.drawable.ic_repeat)
                binding.btnNowPlayingRepeat.setColorFilter(
                    ContextCompat.getColor(requireContext(), R.color.spotify_green)
                )
            }
            PlaybackManager.RepeatMode.ONE -> {
                binding.btnNowPlayingRepeat.setImageResource(R.drawable.ic_repeat_one)
                binding.btnNowPlayingRepeat.setColorFilter(
                    ContextCompat.getColor(requireContext(), R.color.spotify_green)
                )
            }
        }
    }

    private fun updateLikeUi(isLiked: Boolean) {
        val color = if (isLiked) {
            ContextCompat.getColor(requireContext(), R.color.spotify_green)
        } else {
            ContextCompat.getColor(requireContext(), R.color.spotify_white)
        }
        binding.btnNowPlayingLike.setColorFilter(color)
    }

    private fun formatTime(ms: Int): String {
        val totalSec = ms / 1000
        val min = totalSec / 60
        val sec = totalSec % 60
        return String.format("%d:%02d", min, sec)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        cancelSleepTimerRunnable()
        PlaybackManager.removeListener(this)
        _binding = null
    }

    companion object {
        const val TAG = "NowPlayingBottomSheet"
        fun newInstance() = NowPlayingBottomSheet()
    }
}
