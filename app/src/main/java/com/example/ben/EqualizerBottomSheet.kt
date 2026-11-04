package com.example.ben

import android.content.Context
import android.content.SharedPreferences
import android.media.audiofx.Equalizer
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import com.example.ben.databinding.DialogEqualizerBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class EqualizerBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogEqualizerBinding? = null
    private val binding get() = _binding!!

    private lateinit var prefs: SharedPreferences
    private var nativeEqualizer: Equalizer? = null

    // 5 Bands: 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz. Gains from -12 to +12 dB
    private val bandGains = intArrayOf(0, 0, 0, 0, 0)
    private var isEnabled = true
    private var currentPreset = "Flat"

    companion object {
        const val TAG = "EqualizerBottomSheet"
        fun newInstance(): EqualizerBottomSheet = EqualizerBottomSheet()

        private val PRESETS = mapOf(
            "Flat" to intArrayOf(0, 0, 0, 0, 0),
            "Bass Boost" to intArrayOf(6, 4, 1, 0, -1),
            "Vocal Boost" to intArrayOf(-2, 1, 5, 3, 0),
            "Treble Boost" to intArrayOf(-1, 0, 1, 4, 6),
            "Pop" to intArrayOf(-1, 2, 4, 2, -1),
            "Rock" to intArrayOf(5, 3, -1, 3, 5)
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogEqualizerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        prefs = requireContext().getSharedPreferences("pmusic_equalizer_prefs", Context.MODE_PRIVATE)

        loadSavedSettings()
        setupNativeEqualizer()
        setupViews()
        updateUi()
    }

    private fun loadSavedSettings() {
        isEnabled = prefs.getBoolean("eq_enabled", true)
        currentPreset = prefs.getString("eq_preset", "Flat") ?: "Flat"
        for (i in 0 until 5) {
            bandGains[i] = prefs.getInt("eq_band_$i", 0)
        }
    }

    private fun saveSettings() {
        prefs.edit().apply {
            putBoolean("eq_enabled", isEnabled)
            putString("eq_preset", currentPreset)
            for (i in 0 until 5) {
                putInt("eq_band_$i", bandGains[i])
            }
            apply()
        }
        applyToAudioEngine()
    }

    private fun setupNativeEqualizer() {
        try {
            val audioSession = PlaybackManager.getAudioSessionId()
            if (audioSession != null && audioSession > 0) {
                nativeEqualizer = Equalizer(0, audioSession).apply {
                    enabled = isEnabled
                }
            }
        } catch (_: Exception) {
            // Equalizer may not be supported on some emulators without audio hardware
        }
    }

    private fun applyToAudioEngine() {
        try {
            nativeEqualizer?.let { eq ->
                eq.enabled = isEnabled
                if (isEnabled) {
                    val numBands = eq.numberOfBands.toInt().coerceAtMost(5)
                    val minLevel = eq.bandLevelRange[0]
                    val maxLevel = eq.bandLevelRange[1]
                    for (i in 0 until numBands) {
                        val level = ((bandGains[i] / 12f) * maxLevel).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt())
                        eq.setBandLevel(i.toShort(), level.toShort())
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun setupViews() {
        binding.btnCloseEqualizer.setOnClickListener {
            dismiss()
        }

        binding.switchEqualizer.isChecked = isEnabled
        binding.switchEqualizer.setOnCheckedChangeListener { _, checked ->
            isEnabled = checked
            saveSettings()
            updateUi()
            Toast.makeText(requireContext(), if (checked) "Equalizer Enabled" else "Equalizer Disabled", Toast.LENGTH_SHORT).show()
        }

        // Preset buttons
        val presetButtons = listOf(
            binding.btnEqFlat to "Flat",
            binding.btnEqBass to "Bass Boost",
            binding.btnEqVocal to "Vocal Boost",
            binding.btnEqTreble to "Treble Boost",
            binding.btnEqPop to "Pop",
            binding.btnEqRock to "Rock"
        )

        presetButtons.forEach { (btn, name) ->
            btn.setOnClickListener {
                applyPreset(name)
            }
        }

        // SeekBars: 0 to 24 (progress 12 = 0 dB)
        val seekBars = listOf(
            binding.seekBand60 to 0,
            binding.seekBand230 to 1,
            binding.seekBand910 to 2,
            binding.seekBand3600 to 3,
            binding.seekBand14000 to 4
        )

        seekBars.forEach { (seekBar, bandIndex) ->
            seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        val gain = progress - 12
                        bandGains[bandIndex] = gain
                        currentPreset = "Custom"
                        saveSettings()
                        updateBandValueText(bandIndex, gain)
                        highlightPresetButton("Custom")
                    }
                }

                override fun onStartTrackingTouch(sb: SeekBar?) {}
                override fun onStopTrackingTouch(sb: SeekBar?) {}
            })
        }

        binding.btnResetEqualizer.setOnClickListener {
            applyPreset("Flat")
            Toast.makeText(requireContext(), "Equalizer reset to Flat", Toast.LENGTH_SHORT).show()
        }
    }

    private fun applyPreset(presetName: String) {
        currentPreset = presetName
        val presetGains = PRESETS[presetName] ?: intArrayOf(0, 0, 0, 0, 0)
        for (i in 0 until 5) {
            bandGains[i] = presetGains[i]
        }
        saveSettings()
        updateUi()
    }

    private fun updateUi() {
        val alpha = if (isEnabled) 1.0f else 0.4f
        binding.layoutEqPresets.alpha = alpha
        binding.seekBand60.isEnabled = isEnabled
        binding.seekBand230.isEnabled = isEnabled
        binding.seekBand910.isEnabled = isEnabled
        binding.seekBand3600.isEnabled = isEnabled
        binding.seekBand14000.isEnabled = isEnabled

        binding.seekBand60.progress = bandGains[0] + 12
        binding.seekBand230.progress = bandGains[1] + 12
        binding.seekBand910.progress = bandGains[2] + 12
        binding.seekBand3600.progress = bandGains[3] + 12
        binding.seekBand14000.progress = bandGains[4] + 12

        updateBandValueText(0, bandGains[0])
        updateBandValueText(1, bandGains[1])
        updateBandValueText(2, bandGains[2])
        updateBandValueText(3, bandGains[3])
        updateBandValueText(4, bandGains[4])

        highlightPresetButton(currentPreset)
    }

    private fun updateBandValueText(bandIndex: Int, gain: Int) {
        val sign = if (gain > 0) "+" else ""
        val text = "$sign$gain dB"
        when (bandIndex) {
            0 -> binding.tvBand60Val.text = text
            1 -> binding.tvBand230Val.text = text
            2 -> binding.tvBand910Val.text = text
            3 -> binding.tvBand3600Val.text = text
            4 -> binding.tvBand14000Val.text = text
        }
    }

    private fun highlightPresetButton(activeName: String) {
        val context = requireContext()
        val buttons = mapOf(
            "Flat" to binding.btnEqFlat,
            "Bass Boost" to binding.btnEqBass,
            "Vocal Boost" to binding.btnEqVocal,
            "Treble Boost" to binding.btnEqTreble,
            "Pop" to binding.btnEqPop,
            "Rock" to binding.btnEqRock
        )

        buttons.forEach { (name, btn) ->
            if (name == activeName) {
                btn.background = ContextCompat.getDrawable(context, R.drawable.bg_spotify_button)
                btn.setTextColor(ContextCompat.getColor(context, R.color.black))
            } else {
                btn.background = ContextCompat.getDrawable(context, R.drawable.bg_spotify_button_outlined)
                btn.setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        try {
            nativeEqualizer?.release()
            nativeEqualizer = null
        } catch (_: Exception) {}
        _binding = null
    }
}

