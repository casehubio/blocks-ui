package io.casehub.intellij

import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.fileTypes.FileTypeRegistry.FileTypeDetector
import com.intellij.openapi.vfs.VirtualFile

class CaseHubYamlFileDetector : FileTypeDetector {
    override fun detect(file: VirtualFile, firstBytes: ByteArray, firstCharsIfText: CharSequence?): FileType? {
        val name = file.name
        if (CaseHubYamlFileType.CONVENTION_EXTENSIONS.any { name.endsWith(".$it") }) {
            return CaseHubYamlFileType.INSTANCE
        }
        if (!name.endsWith(".yaml") && !name.endsWith(".yml")) return null
        val text = firstCharsIfText?.toString() ?: return null
        if (text.contains("organization:") ||
            text.contains("\ndo:") || text.startsWith("do:") ||
            (text.contains("dsl:") && text.contains("spec:")) ||
            text.contains("pages:") || text.contains("datasets:")) {
            return CaseHubYamlFileType.INSTANCE
        }
        return null
    }
}
