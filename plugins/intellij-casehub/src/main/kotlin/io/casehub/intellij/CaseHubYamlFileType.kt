package io.casehub.intellij

import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

class CaseHubYamlFileType private constructor() : LanguageFileType(CaseHubYamlLanguage.INSTANCE) {

    override fun getName(): String = "CaseHub YAML"

    override fun getDescription(): String = "CaseHub YAML definition"

    override fun getDefaultExtension(): String = "page.yaml"

    override fun getIcon(): Icon? = null

    companion object {
        @JvmField
        val INSTANCE = CaseHubYamlFileType()
    }
}
