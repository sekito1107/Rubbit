/**
 * 正規表現ベースの高速なコード走査を担当する
 */
export class Scanner {
  /**
   * 指定された行範囲をスキャンし、メソッド出現箇所を抽出する
   * @param {monaco.editor.ITextModel} model 
   * @param {number[]} lineIndices 
   * @returns {Map<number, Array>}
   */
  scanLines(model, lineIndices) {
    const results = new Map()
    
    // 定義済みの重要なメソッド名のパターン
    // .member や member() や member do ... を捕捉
    const methodPattern = /(?:\.)([a-z_][a-zA-Z0-9_]*[!?]?)|([a-z_][a-zA-Z0-9_]*[!?]?)\s*[({]|([a-z_][a-zA-Z0-9_]*[!?]?)\s+do\b/g

    lineIndices.forEach(idx => {
      // コメントを除去しつつインデックスを維持するため、空白で置換する
      const lineContent = model.getLineContent(idx + 1).replace(/#.*$/, m => " ".repeat(m.length))
      const matches = []
      let match

      // 簡易的な正規表現マッチング
      while ((match = methodPattern.exec(lineContent)) !== null) {
        const name = match[1] || match[2] || match[3]
        if (name && !this._isBlacklisted(name)) {
          matches.push({
            name: name,
            line: idx + 1,
            col: match.index + 2 // 1-indexed and skip prefix dot if exists
          })
        }
      }
      results.set(idx, matches)
    })
    return results
  }

  _isBlacklisted(name) {
    return ["if", "def", "class", "module", "end", "do", "yield", "begin", "rescue", "ensure", "elsif", "else"].includes(name)
  }
}
