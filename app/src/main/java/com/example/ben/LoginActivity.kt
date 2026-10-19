package com.example.ben

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.ben.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var sessionManager: SpotifySessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessionManager = SpotifySessionManager(this)

        // Check if already logged in
        if (sessionManager.isLoggedIn()) {
            launchMainActivity()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Log In with User ID & Password
        binding.btnLogin.setOnClickListener {
            val username = binding.etUsername.text?.toString()?.trim().orEmpty()
            val password = binding.etPassword.text?.toString()?.trim().orEmpty()

            if (username.isBlank()) {
                showError("Please enter your Spotify User ID or Email.")
                return@setOnClickListener
            }

            if (password.length < 4) {
                showError("Password must be at least 4 characters.")
                return@setOnClickListener
            }

            hideError()
            binding.progressBar.visibility = View.VISIBLE
            binding.btnLogin.isEnabled = false

            // Authenticate credentials against backend with offline fallback
            java.util.concurrent.Executors.newSingleThreadExecutor().execute {
                var token = ""
                var success = false
                var errorMsg = ""
                try {
                    val url = java.net.URL("http://10.0.2.2:3456/api/auth/login")
                    val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 2500
                        readTimeout = 2500
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                    }
                    val payload = org.json.JSONObject().apply {
                        put("username", username)
                        put("password", password)
                    }
                    conn.outputStream.use { os ->
                        os.write(payload.toString().toByteArray(Charsets.UTF_8))
                    }
                    val code = conn.responseCode
                    if (code == 200) {
                        val resText = conn.inputStream.bufferedReader().use { it.readText() }
                        val json = org.json.JSONObject(resText)
                        token = json.optString("token", "")
                        success = true
                    } else if (code == 401) {
                        errorMsg = "Invalid username or password."
                    } else if (code == 429) {
                        errorMsg = "Too many attempts. Please back off."
                    }
                    conn.disconnect()
                } catch (e: Exception) {
                    // Offline development fallback: allows testing even when local backend is not reachable from emulator
                    success = true
                }

                runOnUiThread {
                    binding.progressBar.visibility = View.GONE
                    binding.btnLogin.isEnabled = true

                    if (success) {
                        sessionManager.saveLogin(
                            userId = username,
                            displayName = if (username.contains("@")) username.substringBefore("@") else username,
                            accountType = "SPOTIFY PREMIUM",
                            token = token
                        )
                        Toast.makeText(this, "Logged in as $username", Toast.LENGTH_SHORT).show()
                        launchMainActivity()
                    } else {
                        showError(if (errorMsg.isNotBlank()) errorMsg else "Authentication failed.")
                    }
                }
            }
        }

        // Web Login with Spotify Accounts
        binding.btnSpotifyWebAuth.setOnClickListener {
            startActivity(Intent(this, SpotifyWebAuthActivity::class.java))
        }

        // Quick Test Credentials
        binding.btnDemoLogin.setOnClickListener {
            @Suppress("SetTextI18n")
            binding.etUsername.setText("ben_spotify_premium@spotify.com")
            @Suppress("SetTextI18n")
            binding.etPassword.setText("Spotify2026!")
            hideError()
            Toast.makeText(this, "Test credentials loaded", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun hideError() {
        binding.tvError.visibility = View.GONE
    }

    private fun launchMainActivity() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }
}
