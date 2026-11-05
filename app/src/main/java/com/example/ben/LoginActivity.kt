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

            // Authenticate credentials against backend with failover and auto-registration
            java.util.concurrent.Executors.newSingleThreadExecutor().execute {
                var token = ""
                var success = false
                var errorMsg = ""
                var isNewAccount = false
                var serverUserObj: org.json.JSONObject? = null

                try {
                    BackendConfig.executeWithFailover("/api/auth/login") { targetLoginUrl ->
                        val url = java.net.URL(targetLoginUrl)
                        val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                            requestMethod = "POST"
                            connectTimeout = 3000
                            readTimeout = 3000
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
                            serverUserObj = json.optJSONObject("user")
                            success = true
                        } else if (code == 401) {
                            val errBody = try {
                                conn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                            } catch (_: Exception) { "" }
                            val errJson = try { org.json.JSONObject(errBody) } catch (_: Exception) { null }
                            val errCode = errJson?.optString("code", "") ?: ""

                            if (errCode == "USER_NOT_FOUND" || errBody.contains("USER_NOT_FOUND") || errBody.contains("Account not found")) {
                                // User does not exist yet. Seamlessly register user account!
                                conn.disconnect()
                                val regUrl = java.net.URL(BackendConfig.getUrl("/api/auth/register"))
                                val regConn = (regUrl.openConnection() as java.net.HttpURLConnection).apply {
                                    requestMethod = "POST"
                                    connectTimeout = 3000
                                    readTimeout = 3000
                                    doOutput = true
                                    setRequestProperty("Content-Type", "application/json")
                                }
                                val regPayload = org.json.JSONObject().apply {
                                    put("username", username)
                                    put("password", password)
                                }
                                regConn.outputStream.use { os ->
                                    os.write(regPayload.toString().toByteArray(Charsets.UTF_8))
                                }
                                val regCode = regConn.responseCode
                                if (regCode == 200) {
                                    val regText = regConn.inputStream.bufferedReader().use { it.readText() }
                                    val regJson = org.json.JSONObject(regText)
                                    token = regJson.optString("token", "")
                                    serverUserObj = regJson.optJSONObject("user")
                                    isNewAccount = true
                                    success = true
                                } else {
                                    val regErrBody = try {
                                        regConn.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                                    } catch (_: Exception) { "" }
                                    val regErrJson = try { org.json.JSONObject(regErrBody) } catch (_: Exception) { null }
                                    errorMsg = regErrJson?.optString("error", "Registration failed.") ?: "Registration failed."
                                }
                                regConn.disconnect()
                                return@executeWithFailover
                            } else if (errCode == "INVALID_PASSWORD") {
                                errorMsg = "Incorrect password. Please try again."
                            } else {
                                errorMsg = errJson?.optString("error", "Invalid username or password.") ?: "Invalid username or password."
                            }
                        } else if (code == 429) {
                            errorMsg = "Too many attempts. Please back off."
                        } else {
                            errorMsg = "Authentication failed (HTTP $code)."
                        }
                        conn.disconnect()
                    }
                } catch (e: Exception) {
                    errorMsg = "Unable to connect to authentication server. Please check your network connection."
                    success = false
                }

                if (success) {
                    val userObj = serverUserObj
                    if (userObj != null) {
                        UserLibraryManager.init(this@LoginActivity)
                        UserLibraryManager.importFromLogin(userObj, token)
                    }
                    PlaylistManager.init(this@LoginActivity)
                    PlaylistManager.syncFromBackend()
                }

                runOnUiThread {
                    binding.progressBar.visibility = View.GONE
                    binding.btnLogin.isEnabled = true

                    if (success) {
                        val dName = serverUserObj?.optString("displayName", "")
                        val resolvedName = if (!dName.isNullOrBlank()) dName else if (username.contains("@")) username.substringBefore("@") else username
                        val avatar = serverUserObj?.optString("avatar", "") ?: ""
                        sessionManager.saveLogin(
                            userId = username,
                            displayName = resolvedName,
                            accountType = "SPOTIFY PREMIUM",
                            token = token,
                            avatar = avatar
                        )
                        val welcomeMsg = if (isNewAccount) "Account created! Welcome, $resolvedName" else "Logged in as $resolvedName"
                        Toast.makeText(this, welcomeMsg, Toast.LENGTH_SHORT).show()
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
