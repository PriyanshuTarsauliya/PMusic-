package com.example.ben

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

class SpotifySessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "spotify_user_session"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_DISPLAY_NAME = "display_name"
        private const val KEY_ACCOUNT_TYPE = "account_type"
        private const val KEY_AUTH_TOKEN = "auth_token"
    }

    fun saveLogin(userId: String, displayName: String, accountType: String = "SPOTIFY PREMIUM", token: String = "") {
        prefs.edit {
            putBoolean(KEY_IS_LOGGED_IN, true)
            putString(KEY_USER_ID, userId)
            putString(KEY_DISPLAY_NAME, displayName)
            putString(KEY_ACCOUNT_TYPE, accountType)
            putString(KEY_AUTH_TOKEN, token)
        }
    }

    fun isLoggedIn(): Boolean = prefs.getBoolean(KEY_IS_LOGGED_IN, false)

    fun getUserId(): String = prefs.getString(KEY_USER_ID, "user@spotify.com") ?: "user@spotify.com"

    fun getDisplayName(): String {
        val name = prefs.getString(KEY_DISPLAY_NAME, null)
        if (!name.isNullOrBlank()) return name
        val userId = getUserId()
        return if (userId.contains("@")) {
            userId.substringBefore("@").replaceFirstChar { it.uppercase() }
        } else {
            userId.replaceFirstChar { it.uppercase() }
        }
    }

    fun getAccountType(): String = prefs.getString(KEY_ACCOUNT_TYPE, "SPOTIFY PREMIUM") ?: "SPOTIFY PREMIUM"

    fun logout() {
        prefs.edit { clear() }
    }
}
