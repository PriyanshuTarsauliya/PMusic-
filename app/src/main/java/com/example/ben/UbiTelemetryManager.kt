package com.example.ben

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object UbiTelemetryManager {

    data class TelemetryEvent(
        val timestamp: String,
        val action: String,
        val details: String,
        val serpId: String? = null
    )

    const val PERSISTED_QUERY_HASH = "eef7cc54888d91bdd6802623477873caa3948ae173a0c34fd86827b267e94c03"
    const val OPERATION_NAME = "searchDesktop"
    const val TARGET_CONTAINER = "SpotifyMusic_1.305.3058.0_x64 (CEF)"
    const val BUNDLE_SPEC = "Apps/xpui.spa -> xpui-routes-search.js"
    const val DEVELOPER_CREDIT = "⚡ Developed by Ben 10"

    var currentSerpId: String = "serp_android_init"
        private set

    private val events = mutableListOf<TelemetryEvent>()
    private val listeners = mutableListOf<() -> Unit>()
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    init {
        log("initAppSession", "Spotify reverse-engineered Android client booted")
        log("specRegistered", "desktop-find.browseAll loaded (CEF xpui-routes-search.js)")
    }

    fun updateSerpId(newId: String) {
        currentSerpId = newId
    }

    fun log(action: String, details: String, serpId: String? = currentSerpId) {
        val event = TelemetryEvent(
            timestamp = timeFormat.format(Date()),
            action = action,
            details = details,
            serpId = serpId
        )
        synchronized(events) {
            events.add(0, event)
            if (events.size > 60) {
                events.removeAt(events.size - 1)
            }
        }
        notifyListeners()
    }

    fun getEvents(): List<TelemetryEvent> {
        return synchronized(events) { events.toList() }
    }

    fun addListener(listener: () -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: () -> Unit) {
        listeners.remove(listener)
    }

    private fun notifyListeners() {
        listeners.forEach {
            try {
                it.invoke()
            } catch (_: Exception) {}
        }
    }
}
