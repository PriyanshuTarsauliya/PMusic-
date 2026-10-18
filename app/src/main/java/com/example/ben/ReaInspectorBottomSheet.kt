package com.example.ben

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.example.ben.databinding.DialogReaInspectorBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class ReaInspectorBottomSheet : BottomSheetDialogFragment() {

    private var _binding: DialogReaInspectorBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogReaInspectorBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnCloseInspector.setOnClickListener {
            dismiss()
        }

        updateContent()
    }

    private fun updateContent() {
        val queryInfo = buildString {
            append("operation: ").append(UbiTelemetryManager.OPERATION_NAME).append("\n")
            append("persistedQueryHash: ").append(UbiTelemetryManager.PERSISTED_QUERY_HASH).append("\n")
            append("active serpId: ").append(UbiTelemetryManager.currentSerpId)
        }
        binding.tvInspectorQueryInfo.text = queryInfo

        val events = UbiTelemetryManager.getEvents()
        val logText = if (events.isEmpty()) {
            "No telemetry events recorded yet."
        } else {
            events.take(15).joinToString("\n") { e ->
                "[${e.timestamp}] ${e.action}: ${e.details}"
            }
        }
        binding.tvInspectorTelemetryLog.text = logText
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "ReaInspectorBottomSheet"
        fun newInstance() = ReaInspectorBottomSheet()
    }
}
