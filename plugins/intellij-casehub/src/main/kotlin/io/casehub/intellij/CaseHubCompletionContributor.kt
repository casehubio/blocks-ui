package io.casehub.intellij

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionResultSet

class CaseHubCompletionContributor : CompletionContributor() {

    private val casehubExtensions = setOf(
        ".page.yaml", ".case.yaml", ".swf.yaml", ".htn.yaml", ".org.yaml"
    )

    override fun fillCompletionVariants(parameters: CompletionParameters, result: CompletionResultSet) {
        val fileName = parameters.originalFile.virtualFile?.name ?: return
        if (casehubExtensions.any { fileName.endsWith(it) }) {
            result.stopHere()
        }
    }
}
