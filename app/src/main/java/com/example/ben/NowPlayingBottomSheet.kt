package com.example.ben

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SeekBar
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
            binding.tvLyricsContent.maxLines = if (isLyricsExpanded) 100 else 8
            binding.btnLyricsExpand.text = if (isLyricsExpanded) "LESS" else "MORE"
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
        updateLyrics(song)
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
    }

    override fun onPlaybackModeChanged(isShuffle: Boolean, repeatMode: PlaybackManager.RepeatMode) {
        if (_binding == null) return
        updateShuffleUi(isShuffle)
        updateRepeatUi(repeatMode)
    }

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

    private fun updateLyrics(song: Song) {
        val lyrics = when {
            song.title.contains("Blinding Lights", true) -> {
                "Yeah\nI've been tryna call\nI've been on my own for long enough\nMaybe you can show me how to love, maybe\n\nI'm going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby\n\nI look around and Sin City's cold and empty\nNo one's around to judge me\nI can't see clearly when you're gone\n\nI said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch"
            }
            song.title.contains("Starboy", true) -> {
                "I'm tryna put you in the worst mood, ah\nP1 cleaner than your church shoes, ah\nMilli point two just to hurt you, ah\nAll red Lamb' just to tease you, ah\n\nNone of these toys on lease too, ah\nMade your whole year in a week too, yah\nMain bitch out your league too, ah\nSide bitch out of your league too, ah\n\nLook what you've done\nI'm a motherfuckin' starboy"
            }
            song.title.contains("Bad Guy", true) -> {
                "White shirt now red, my bloody nose\nSleepin', you're on your tippy toes\nCreepin' around like no one knows\nThink you're so criminal\n\nBruises on both my knees for you\nDon't say thank you or please\nI do what I want when I'm wanting to\nMy soul? So cynical\n\nSo you're a tough guy\nLike it really rough guy\nJust can't get enough guy\nChest always so puffed guy\n\nI'm that bad type\nMake your mama sad type\nMake your girlfriend mad tight\nMight seduce your dad type\nI'm the bad guy, duh"
            }
            song.title.contains("Levitating", true) -> {
                "If you wanna run away with me, I know a galaxy\nAnd I can take you for a ride\nI had a premonition that we fell into a rhythm\nWhere the music don't stop for life\n\nGlitter in the sky, glitter in my eyes\nShining just the way I like\nIf you're feeling like you need a little bit of company\nYou met me at the perfect time\n\nYou want me, I want you, baby\nMy sugarboo, I'm levitating"
            }
            else -> {
                "♪ Instrumental Intro ♪\n\n[Verse 1]\nListening to ${song.title} by ${song.artist}\nFrom the album ${song.album}\nExperience pure high-fidelity sound on PMusic\n\n[Chorus]\nTurn the volume up\nFeel every beat and harmony\nSpotify REA audio engine active\n\n[Outro]\n♪ Melodic outro fading ♪"
            }
        }
        binding.tvLyricsContent.text = lyrics
    }

    private fun formatTime(ms: Int): String {
        val totalSec = ms / 1000
        val min = totalSec / 60
        val sec = totalSec % 60
        return String.format("%d:%02d", min, sec)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        PlaybackManager.removeListener(this)
        _binding = null
    }

    companion object {
        const val TAG = "NowPlayingBottomSheet"
        fun newInstance() = NowPlayingBottomSheet()
    }
}
