package com.example.ben

import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.content.ContextCompat
import com.example.ben.databinding.DialogProfileBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class ProfileBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogProfileBinding? = null
    private val binding get() = _binding!!
    private lateinit var sessionManager: SpotifySessionManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        sessionManager = SpotifySessionManager(requireContext())

        binding.btnCloseProfile.setOnClickListener {
            dismiss()
        }

        renderLocalProfile()
        fetchBackendProfile()

        // Edit Display Name Action
        binding.btnProfileEditName.setOnClickListener {
            showEditNameDialog()
        }

        // Force Sync Cloud Library
        binding.btnProfileSyncCloud.setOnClickListener {
            val token = sessionManager.getAuthToken()
            if (token.isBlank()) {
                Toast.makeText(requireContext(), "No active cloud token found", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            Toast.makeText(requireContext(), "Syncing with Spotify backend...", Toast.LENGTH_SHORT).show()
            UserLibraryManager.syncFromBackend(token) {
                PlaylistManager.syncFromBackend {
                    mainHandler.post {
                        renderLocalProfile()
                        Toast.makeText(requireContext(), "Cloud database sync completed!", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        // Logout Action
        binding.btnProfileLogout.setOnClickListener {
            dismiss()
            (activity as? MainActivity)?.performLogout()
        }
    }

    private fun renderLocalProfile() {
        val displayName = sessionManager.getDisplayName()
        val userId = sessionManager.getUserId()
        val initial = if (displayName.isNotBlank()) displayName.first().uppercase() else "U"

        binding.tvProfileModalDisplayName.text = displayName
        binding.tvProfileModalUsername.text = if (userId.startsWith("@")) userId else "@$userId"
        binding.tvProfileModalInitial.text = initial
        binding.tvProfileModalAccountType.text = sessionManager.getAccountType()

        val likedCount = UserLibraryManager.getLikedSongs().size
        val playlistsCount = PlaylistManager.getPlaylists().size
        binding.tvProfileLikedCount.text = "$likedCount tracks"
        binding.tvProfilePlaylistsCount.text = "$playlistsCount playlists"
    }

    private fun fetchBackendProfile() {
        val token = sessionManager.getAuthToken()
        if (token.isBlank()) return

        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/profile"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 3000
                    readTimeout = 3000
                    setRequestProperty("Authorization", "Bearer $token")
                }
                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(response)
                    val profile = json.optJSONObject("profile")
                    if (profile != null) {
                        val backendName = profile.optString("displayName", "")
                        val backendAvatar = profile.optString("avatar", "")
                        val likedSongsCount = profile.optInt("likedSongsCount", -1)
                        val playlistsCount = profile.optInt("playlistsCount", -1)

                        if (backendName.isNotBlank()) {
                            sessionManager.saveProfile(backendName, backendAvatar)
                        }

                        mainHandler.post {
                            if (_binding != null) {
                                if (backendName.isNotBlank()) {
                                    binding.tvProfileModalDisplayName.text = backendName
                                    binding.tvProfileModalInitial.text = backendName.first().uppercase()
                                    (activity as? MainActivity)?.updateUserProfileUI()
                                }
                                if (likedSongsCount >= 0) {
                                    binding.tvProfileLikedCount.text = "$likedSongsCount tracks"
                                }
                                if (playlistsCount >= 0) {
                                    binding.tvProfilePlaylistsCount.text = "$playlistsCount playlists"
                                }
                            }
                        }
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {
                // Offline fallback - local profile is already displayed
            }
        }
    }

    private fun showEditNameDialog() {
        val context = requireContext()
        val currentName = sessionManager.getDisplayName()

        val layout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 24, 48, 24)
        }

        val etName = EditText(context).apply {
            hint = "Enter display name"
            setHintTextColor(ContextCompat.getColor(context, R.color.spotify_subdued))
            setTextColor(ContextCompat.getColor(context, R.color.spotify_white))
            setText(currentName)
            setSelection(currentName.length)
        }
        layout.addView(etName)

        AlertDialog.Builder(context, R.style.SpotifyAlertDialogTheme)
            .setTitle("Edit Display Name")
            .setView(layout)
            .setPositiveButton("Save") { _, _ ->
                val newName = etName.text.toString().trim()
                if (newName.isNotBlank()) {
                    sessionManager.saveProfile(newName)
                    renderLocalProfile()
                    (activity as? MainActivity)?.updateUserProfileUI()
                    updateBackendProfile(newName)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateBackendProfile(newName: String) {
        val token = sessionManager.getAuthToken()
        if (token.isBlank()) return

        executor.execute {
            try {
                val url = URL(BackendConfig.getUrl("/api/user/profile"))
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3000
                    readTimeout = 3000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $token")
                }
                val payload = JSONObject().apply {
                    put("displayName", newName)
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {
                // Background sync failure handled gracefully
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "ProfileBottomSheet"
        fun newInstance() = ProfileBottomSheet()
    }
}
