/**
 * LSP を使用して型を解決し、ドメイン固有のフォールバックロジックを提供する Interactor
 */
export class ResolutionInteractor {
  /**
   * @param {LSPInteractor} lspInteractor 
   */
  constructor(lspInteractor) {
    this.lspInteractor = lspInteractor
  }

  /**
   * 指定された位置の型を解決する（リトライ付き）
   * @param {number} line 
   * @param {number} col 
   * @param {Object} options { maxRetries: number, initialDelay: number, retryDelay: number }
   * @returns {Promise<string|null>}
   */
  async resolveAtPosition(line, col, options = {}) {
    const { maxRetries = 3, initialDelay = 100, retryDelay = 2000 } = options

    // 初回待機（初期化直後の混雑回避用）
    if (initialDelay > 0) {
      await new Promise(r => setTimeout(r, initialDelay))
    }

    for (let i = 0; i <= maxRetries; i++) {
       const type = await this.lspInteractor.getTypeAtPosition(line, col)
       if (type) return type

       // 解析待ちのリトライ
       if (i < maxRetries) {
         const delay = i === 0 ? retryDelay : retryDelay * 2
         await new Promise(r => setTimeout(r, delay))
       }
    }

    return null
  }

  /**
   * コンテキストに基づいたフォールバック解析を行う
   * (例: ドットの直後にカーソルがある場合、ドットを除去してレシーバの型を推測する)
   * @param {Object} editor Monaco editor instance
   * @param {Object} position { lineNumber, column }
   * @returns {Promise<string|null>}
   */
  async resolveWithFallback(editor, position) {
    const lineContent = editor.getModel().getLineContent(position.lineNumber)
    const charBefore = lineContent[position.column - 2]

    // 1. 通常の解析を試行
    let type = await this.resolveAtPosition(position.lineNumber, position.column, { maxRetries: 0 })
    if (type) return type

    // 2. ドット除去によるリトライ (".|" -> "|")
    if (charBefore === ".") {
        const tempLine = lineContent.substring(0, position.column - 2) + " " + lineContent.substring(position.column - 1)
        const fullContent = editor.getModel().getValue().split("\n")
        fullContent[position.lineNumber - 1] = tempLine
        
        type = await this.lspInteractor.probeTypeWithTemporaryContent(
            fullContent.join("\n"), 
            position.lineNumber, 
            position.column - 2
        )
        if (type) return type
    }
    
    // 3. &: 記法の処理 ("&:|meth")
    if (charBefore === ":" && lineContent[position.column - 3] === "&") {
        type = await this.lspInteractor.getTypeAtPosition(position.lineNumber, position.column - 2)
        if (type) return type
    }

    return null
  }
}
