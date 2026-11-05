package com.example.ben

import java.io.IOException

object BackendConfig {
    const val LOCAL_BASE_URL = "http://10.0.2.2:3456"
    const val CLOUD_BASE_URL = "https://pmusic-60iq.onrender.com"

    @Volatile
    var activeBaseUrl: String = LOCAL_BASE_URL

    /**
     * Resolves the full URL for a given relative endpoint path.
     */
    fun getUrl(endpointPath: String): String {
        val path = if (endpointPath.startsWith("/")) endpointPath else "/$endpointPath"
        return "$activeBaseUrl$path"
    }

    /**
     * Executes an HTTP network action with automatic failover between local emulator URL and
     * live cloud Render URL. If local fails with IOException, it switches to cloud and retries.
     */
    fun <T> executeWithFailover(
        endpointPath: String,
        action: (fullUrl: String) -> T
    ): T {
        val path = if (endpointPath.startsWith("/")) endpointPath else "/$endpointPath"
        val primary = activeBaseUrl
        val secondary = if (primary == LOCAL_BASE_URL) CLOUD_BASE_URL else LOCAL_BASE_URL

        return try {
            action("$primary$path")
        } catch (e: IOException) {
            try {
                activeBaseUrl = secondary
                action("$secondary$path")
            } catch (fallbackEx: Exception) {
                throw fallbackEx
            }
        }
    }
}
