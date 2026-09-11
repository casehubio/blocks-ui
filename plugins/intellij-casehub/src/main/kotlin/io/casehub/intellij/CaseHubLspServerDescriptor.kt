package io.casehub.intellij

import com.intellij.openapi.project.Project
import com.redhat.devtools.lsp4ij.client.LanguageClientImpl
import com.redhat.devtools.lsp4ij.server.ProcessStreamConnectionProvider
import com.redhat.devtools.lsp4ij.server.StreamConnectionProvider
import com.redhat.devtools.lsp4ij.LanguageServerFactory

class CaseHubLspServerDescriptor : LanguageServerFactory {
    override fun createConnectionProvider(project: Project): StreamConnectionProvider {
        val serverPath = findServerPath(project)
        return ProcessStreamConnectionProvider(listOf("node", serverPath))
    }

    override fun createLanguageClient(project: Project): LanguageClientImpl {
        return LanguageClientImpl(project)
    }

    private fun findServerPath(project: Project): String {
        val basePath = project.basePath ?: throw IllegalStateException("No project base path")
        return "$basePath/node_modules/@casehubio/lsp-schemas/dist/server-node.js"
    }
}
