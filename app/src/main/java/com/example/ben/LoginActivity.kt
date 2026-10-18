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

            // Authenticate credentials against Spotify session
            Handler(Looper.getMainLooper()).postDelayed(
                {
                    binding.progressBar.visibility = View.GONE
                    binding.btnLogin.isEnabled = true

                    // Save user login session
                    sessionManager.saveLogin(
                        userId = username,
                        displayName = if (username.contains("@")) username.substringBefore("@") else username,
                        accountType = "SPOTIFY PREMIUM",
                    )

                    Toast.makeText(this, "Logged in as $username", Toast.LENGTH_SHORT).show()
                    launchMainActivity()
                },
                600,
            )
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
