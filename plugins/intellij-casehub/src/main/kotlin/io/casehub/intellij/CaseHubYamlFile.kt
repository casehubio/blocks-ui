package io.casehub.intellij

import com.intellij.psi.FileViewProvider
import org.jetbrains.yaml.psi.impl.YAMLFileImpl

class CaseHubYamlFile(viewProvider: FileViewProvider) : YAMLFileImpl(viewProvider) {

    override fun getFileType() = CaseHubYamlFileType.INSTANCE
}
