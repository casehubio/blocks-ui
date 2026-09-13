package io.casehub.intellij

import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiParser
import com.intellij.lexer.Lexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet
import org.jetbrains.yaml.YAMLParserDefinition
import org.jetbrains.yaml.psi.impl.YAMLFileImpl

class CaseHubYamlParserDefinition : ParserDefinition {

    private val delegate = YAMLParserDefinition()
    private val fileElementType = IFileElementType(CaseHubYamlLanguage.INSTANCE)

    override fun createLexer(project: Project?): Lexer = delegate.createLexer(project)

    override fun createParser(project: Project?): PsiParser = delegate.createParser(project)

    override fun getFileNodeType(): IFileElementType = fileElementType

    override fun getCommentTokens(): TokenSet = delegate.commentTokens

    override fun getStringLiteralElements(): TokenSet = delegate.stringLiteralElements

    override fun createElement(node: ASTNode?): PsiElement = delegate.createElement(node)

    override fun createFile(viewProvider: FileViewProvider): PsiFile = YAMLFileImpl(viewProvider)
}
