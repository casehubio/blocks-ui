package io.casehub.intellij

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.openapi.diagnostic.Logger

class CaseHubCompletionContributor : CompletionContributor() {

    private val log = Logger.getInstance(CaseHubCompletionContributor::class.java)

    private val casehubExtensions = setOf(
        ".page.yaml", ".case.yaml", ".swf.yaml", ".htn.yaml", ".org.yaml"
    )

    private fun isCaseHubFile(fileName: String): Boolean =
        casehubExtensions.any { fileName.endsWith(it) }

    override fun fillCompletionVariants(parameters: CompletionParameters, result: CompletionResultSet) {
        val fileName = parameters.originalFile.virtualFile?.name ?: return
        if (!isCaseHubFile(fileName)) return

        log.info("CASEHUB-COMPLETION: intercepting for $fileName")

        var totalItems = 0
        var passedItems = 0
        var filteredItems = 0

        result.runRemainingContributors(parameters) { completionResult ->
            totalItems++
            val element = completionResult.lookupElement
            val psi = element.psiElement

            if (psi == null) {
                passedItems++
                result.passResult(completionResult)
            } else {
                filteredItems++
            }
        }

        log.info("CASEHUB-COMPLETION: total=$totalItems passed=$passedItems filtered=$filteredItems")
    }
}
