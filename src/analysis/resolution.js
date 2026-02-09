/**
 * LSP クライアントを直接使用し、シンボルや位置に基づいた型解決を行う
 */
export class Resolution {
  constructor(lspManager) {
    this.lsp = lspManager
  }

  /**
   * 指定された位置の型を特定し、クラス名を返す
   */
  async resolveAtPosition(line, col, options = {}) {
    try {
      // 0. コメント内チェック
      const model = this.lsp.model
      if (model) {
        const lineContent = model.getLineContent(line)
        const commentIdx = lineContent.indexOf('#')
        // 簡易的な判定: '#' 以降で、かつそれが現在の列より前にある場合はコメント内とみなす
        if (commentIdx !== -1 && commentIdx < col - 1) {
          return null
        }
      }

      // 1. 現在位置を試行
      let type = await this.lsp.getTypeAtPosition(line, col)
      
      // 2. フォールバック: 1文字戻って試行 (単語の末尾にカーソルがある場合への対応: names|)
      if (!type && col > 1) {
        type = await this.lsp.getTypeAtPosition(line, col - 1)
      }
      
      // 3. フォールバック: さらに1文字戻って試行 (ドットの直後にカーソルがある場合への対応: names.| )
      if (!type && col > 2) {
        type = await this.lsp.getTypeAtPosition(line, col - 2)
      }

      // 4. フォールバック: 1文字進めて試行 (ドットの直後などの微調整)
      if (!type) {
        type = await this.lsp.getTypeAtPosition(line, col + 1)
      }
      
      return type
    } catch (e) {
      console.warn("[Resolution] Type resolution failed:", e)
    }
    return null
  }

  /**
   * メソッド名に対応する定義位置での解決を試みる
   * Scanner から渡される col は既に識別子の開始位置であるため、そのまま使用する
   */
  async resolveMethodAt(line, col, options = {}) {
    return this.resolveAtPosition(line, col, options)
  }

  /**
   * 一時的なコンテンツで型解決を試みる
   */
  async probe(content, line, col, syncManager) {
    try {
      return await this.lsp.probeTypeWithTemporaryContent(content, line, col)
    } catch (e) {
      console.warn("[Resolution] Probe failed:", e)
    }
    return null
  }
}
