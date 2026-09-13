package io.casehub.intellij

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.psi.FileViewProvider

class CaseHubYamlFile(viewProvider: FileViewProvider) :
    PsiFileBase(viewProvider, CaseHubYamlLanguage.INSTANCE) {

    override fun getFileType() = CaseHubYamlFileType.INSTANCE
}
