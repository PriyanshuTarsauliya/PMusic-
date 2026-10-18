package com.example.ben

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.net.toUri
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import com.example.ben.databinding.ActivitySpotifyWebAuthBinding

class SpotifyWebAuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySpotifyWebAuthBinding
    private lateinit var sessionManager: SpotifySessionManager

    companion object {
        const val SPOTIFY_LOGIN_URL = "https://accounts.spotify.com/en/login"
        const val SPOTIFY_REDIRECT_URI = "com.example.ben://callback"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySpotifyWebAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionManager = SpotifySessionManager(this)

        binding.btnCloseWebAuth.setOnClickListener {
            finish()
        }

        // Handle hardware / gesture back button to navigate WebView back
        onBackPressedDispatcher.addCallback(this) {
            if (binding.spotifyWebView.canGoBack()) {
                binding.spotifyWebView.goBack()
            } else {
                finish()
            }
        }

        // Enable cookies & JS for authentic Spotify accounts login
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)

        binding.spotifyWebView.apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    binding.webLoadingProgress.visibility = View.VISIBLE
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    binding.webLoadingProgress.visibility = View.GONE
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false
                    
                    // If redirected back to app or user account dashboard after login
                    if (url.startsWith(SPOTIFY_REDIRECT_URI) || url.contains("accounts.spotify.com/status") || url.contains("/overview")) {
                        handleLoginSuccess(url)
                        return true
                    }
                    return false
                }
            }

            loadUrl(SPOTIFY_LOGIN_URL)
        }
    }

    private fun handleLoginSuccess(url: String) {
        val uri = url.toUri()
        val token = uri.getQueryParameter("access_token") ?: uri.fragment?.substringAfter("access_token=")?.substringBefore("&") ?: "spotify_web_token_active"
        
        // Save user session
        sessionManager.saveLogin(
            userId = "spotify_user",
            displayName = "Spotify User",
            accountType = "SPOTIFY PREMIUM",
            token = token,
        )

        Toast.makeText(this, "Logged in to Spotify successfully!", Toast.LENGTH_SHORT).show()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }
}
