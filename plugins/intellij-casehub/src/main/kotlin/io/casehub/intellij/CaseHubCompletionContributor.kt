package io.casehub.intellij

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionResultSet

class CaseHubCompletionContributor : CompletionContributor() {

    override fun fillCompletionVariants(parameters: CompletionParameters, result: CompletionResultSet) {
        result.runRemainingContributors(parameters) { completionResult ->
            val element = completionResult.lookupElement
            if (element.psiElement == null) {
                result.passResult(completionResult)
            }
        }
    }
}
