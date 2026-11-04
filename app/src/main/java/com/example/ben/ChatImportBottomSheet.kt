package com.example.ben

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.widget.doOnTextChanged
import com.example.ben.databinding.DialogChatImporterBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import java.util.concurrent.Executors

class ChatImportBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogChatImporterBinding? = null
    private val binding get() = _binding!!
    private val executor = Executors.newSingleThreadExecutor()
    private val importedSongs = mutableListOf<Song>()

    companion object {
        const val TAG = "ChatImportBottomSheet"
        fun newInstance() = ChatImportBottomSheet()

        /**
         * Extracts song query candidates from various text formats.
         */
        fun extractSongQueries(rawText: String): List<String> {
            val text = rawText.trim()
            if (text.isBlank()) return emptyList()

            // 1. Line-by-line parsing
            val lines = text.lines()
                .map { line ->
                    // Strip leading numbers: "1. ", "2) ", "3 - ", "• ", "- "
                    line.replace(Regex("""^\s*(?:\d+\s*[\.\)\-:]|[\*\-•])\s*"""), "").trim()
                }
                .filter { it.length >= 2 && !it.startsWith("//") && !it.startsWith("#") }

            if (lines.size > 1) {
                return lines
            }

            // 2. Chat prompt: "add X, Y, and Z to my library"
            var cleanText = text
            val addMatch = Regex("""(?i)(?:add|play|import|save)\s+(.+?)(?:\s+to\s+(?:my\s+)?(?:library|playlist))?$""").find(text)
            if (addMatch != null) {
                cleanText = addMatch.groupValues[1].trim()
            }

            // 3. Comma / "and" separated, handling Oxford comma ", and"
            val splitItems = cleanText.split(Regex(""",\s*(?:and\s+)?|\s+and\s+"""))
                .map { it.trim().trim('"', '\'') }
                .filter { it.length >= 2 }

            return if (splitItems.isNotEmpty()) splitItems else listOf(cleanText)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.SpotifyBottomSheetDialogTheme)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogChatImporterBinding.inflate(inflater, container, false)
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

        binding.btnDismissChatImport.setOnClickListener { dismiss() }

        // Live counter update
        binding.etChatSongInput.doOnTextChanged { text, _, _, _ ->
            val queries = extractSongQueries(text?.toString().orEmpty())
            binding.tvChatSongCounter.text = "${queries.size} ${if (queries.size == 1) "song" else "songs"} detected"
        }

        // Sample formatting chips
        binding.chipSampleNumbered.setOnClickListener {
            binding.etChatSongInput.setText(
                "1. Starboy - The Weeknd\n2. Yellow - Coldplay\n3. Levitating - Dua Lipa\n4. Believer - Imagine Dragons"
            )
        }

        binding.chipSampleLines.setOnClickListener {
            binding.etChatSongInput.setText(
                "Blinding Lights\nCruel Summer\nShape of You\nAs It Was"
            )
        }

        binding.chipSampleComma.setOnClickListener {
            binding.etChatSongInput.setText(
                "Starboy, Bohemian Rhapsody, Flowers, Stay With Me, Bad Guy"
            )
        }

        binding.chipSampleChat.setOnClickListener {
            binding.etChatSongInput.setText(
                "Hey PMusic, please add Starboy, Yellow, and Levitating to my library"
            )
        }

        binding.btnChatClear.setOnClickListener {
            binding.etChatSongInput.text?.clear()
            binding.layoutChatResults.visibility = View.GONE
            importedSongs.clear()
        }

        // Submit and resolve songs
        binding.btnChatSubmit.setOnClickListener {
            val rawInput = binding.etChatSongInput.text?.toString().orEmpty()
            val queries = extractSongQueries(rawInput)

            if (queries.isEmpty()) {
                Toast.makeText(requireContext(), "Please enter at least one song name.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            binding.chatImportProgress.visibility = View.VISIBLE
            binding.btnChatSubmit.isEnabled = false
            importedSongs.clear()

            executor.execute {
                val resolvedList = mutableListOf<Song>()
                queries.forEach { query ->
                    val results = SpotifySearchEngine.searchImmediate(query)
                    if (results.isNotEmpty()) {
                        val best = results.first()
                        best.isLiked = true
                        resolvedList.add(best)
                    } else {
                        // Fallback song model
                        val placeholder = Song(
                            id = "imp_" + System.currentTimeMillis().toString(36) + "_" + (0..999).random(),
                            title = query.substringBefore(" - ").trim(),
                            artist = if (query.contains(" - ")) query.substringAfter(" - ").trim() else "Curated Artist",
                            album = "Imported Track",
                            durationFormatted = "3:30",
                            audioUrl = "",
                            isLiked = true
                        )
                        resolvedList.add(placeholder)
                    }
                }

                // Add to custom playlist "Imported via Chat"
                val plName = "Imported via Chat"
                var targetPl = PlaylistManager.getPlaylists().find { it.title.equals(plName, true) }
                if (targetPl == null) {
                    targetPl = PlaylistManager.createPlaylist(plName, "Batch imported with Chat Assistant")
                }
                resolvedList.forEach { s ->
                    PlaylistManager.addSongToPlaylist(targetPl.id, s)
                }

                activity?.runOnUiThread {
                    if (_binding == null) return@runOnUiThread
                    binding.chatImportProgress.visibility = View.GONE
                    binding.btnChatSubmit.isEnabled = true

                    importedSongs.clear()
                    importedSongs.addAll(resolvedList)

                    binding.layoutChatResults.visibility = View.VISIBLE
                    binding.tvChatStatusMessage.text = "Saved ${resolvedList.size} songs to library & playlist!"
                    binding.tvChatImportedList.text = resolvedList.joinToString("\n") { "• ${it.title} - ${it.artist}" }

                    UbiTelemetryManager.log("chatImportCompleted", "Imported ${resolvedList.size} songs")
                    Toast.makeText(requireContext(), "Imported ${resolvedList.size} songs!", Toast.LENGTH_SHORT).show()
                }
            }
        }

        binding.btnPlayImportedSongs.setOnClickListener {
            if (importedSongs.isNotEmpty()) {
                PlaybackManager.setQueueAndPlay(importedSongs, 0)
                Toast.makeText(requireContext(), "Playing ${importedSongs.size} imported songs!", Toast.LENGTH_SHORT).show()
                dismiss()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
