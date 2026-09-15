package io.casehub.intellij

import com.intellij.lang.Language
import org.jetbrains.yaml.YAMLLanguage

class CaseHubYamlLanguage private constructor() : Language(YAMLLanguage.INSTANCE, "CaseHubYAML") {
    companion object {
        @JvmField
        val INSTANCE = CaseHubYamlLanguage()
    }
}
