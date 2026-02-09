import { LSPResponseParser } from "./parser"

/**
 * LSP に対して型情報の解決を要求する
 */
export class ResolveType {
  constructor(client) {
    this.client = client
  }

  /**
   * 指定位置の型情報を取得する
   */
  async at(lineNumber, column) {
    try {
      if (!this.client) return null

      const response = await this.client.sendRequest("textDocument/hover", {
        textDocument: { uri: "inmemory:///workspace/main.rb" },
        position: { line: lineNumber - 1, character: column - 1 }
      })

      if (!response || !response.contents) return null

      let markdownContent = response.contents
      if (typeof markdownContent === "object" && markdownContent.value) {
        markdownContent = markdownContent.value
      }

      return LSPResponseParser.parseClassNameFromHover(markdownContent)
    } catch (e) {
      return null
    }
  }

  /**
   * 一時的なコンテンツを使用してプローブ（調査）を行う
   */
  async probe(tempContent, lineNumber, column, synchronizer) {
    if (!this.client || !synchronizer) return null
    
    // 1. 一時コンテンツを送信
    await synchronizer.sendTemporaryContent(tempContent)
    
    // 2. 型解決
    const type = await this.at(lineNumber, column)
    
    // 3. 元の状態に戻す
    await synchronizer.restoreOriginalContent()
    
    return type
  }
}
