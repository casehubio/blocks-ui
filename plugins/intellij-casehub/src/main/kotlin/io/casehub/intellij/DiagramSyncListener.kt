package io.casehub.intellij

import com.intellij.openapi.Disposable
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class DiagramSyncListener(
    private val panel: CaseHubDiagramPanel,
    private val format: String,
) : DocumentListener, Disposable {

    @Volatile
    var suppressEcho = false

    private val executor = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "diagram-sync").apply { isDaemon = true }
    }
    private var pendingTask: ScheduledFuture<*>? = null
    private val debounceMs = 150L
    var paused = false

    override fun documentChanged(event: DocumentEvent) {
        if (suppressEcho || paused) return
        scheduleYamlPush(event.document)
    }

    private fun scheduleYamlPush(document: Document) {
        pendingTask?.cancel(false)
        pendingTask = executor.schedule({
            val yaml = document.text
            panel.pushYaml(yaml, format)
        }, debounceMs, TimeUnit.MILLISECONDS)
    }

    override fun dispose() {
        pendingTask?.cancel(false)
        executor.shutdownNow()
    }
}
