package io.casehub.intellij

import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.fileTypes.PlainTextLanguage
import javax.swing.Icon

class CaseHubYamlFileType : LanguageFileType(PlainTextLanguage.INSTANCE) {
    override fun getName(): String = "CaseHub YAML"
    override fun getDescription(): String = "CaseHub YAML format"
    override fun getDefaultExtension(): String = "page.yaml"
    override fun getIcon(): Icon? = null

    companion object {
        @JvmField
        val INSTANCE = CaseHubYamlFileType()

        val CONVENTION_EXTENSIONS = setOf(
            "page.yaml", "dash.yaml", "case.yaml",
            "swf.yaml", "htn.yaml", "org.yaml"
        )
    }
}
