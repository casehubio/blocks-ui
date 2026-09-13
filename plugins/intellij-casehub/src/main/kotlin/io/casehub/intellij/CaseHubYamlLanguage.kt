package io.casehub.intellij

import com.intellij.lang.Language

class CaseHubYamlLanguage private constructor() : Language("CaseHubYAML", "application/x-yaml") {
    companion object {
        @JvmField
        val INSTANCE = CaseHubYamlLanguage()
    }
}
