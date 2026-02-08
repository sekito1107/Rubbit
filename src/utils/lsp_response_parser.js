/**
 * LSP (TypeProf) のレスポンスをパースして情報を抽出するユーティリティクラス
 */
export class LSPResponseParser {
  /**
   * Hover レスポンスから Ruby のクラス名を抽出する
   * @param {string} markdownContent 
   * @returns {string|null}
   */
  static parseClassNameFromHover(markdownContent) {
    if (!markdownContent) return null

    // 0. コンテンツをトリム（先頭の改行による正規表現の失敗を防ぐ）
    const content = markdownContent.trim()

    let typeName = null

    // 1. Markdownコードブロック内のクラス名抽出
    // 例: ```ruby\nString#include?\n```
    const codeBlockMatch = content.match(/```ruby\n([A-Z][a-zA-Z0-9_:]*)(?:[#.][^\n]*)?\n```/)
    if (codeBlockMatch) {
      typeName = codeBlockMatch[1]
    } else {
      // 2. 生のシグネチャ文字列からの抽出
      // "#" または "." までを型名（レシーバ）として取得する
      // タプル型 [String, String]#... にも対応
      const signatureMatch = content.match(/^([^#.\n]+)[#.]/)
      if (signatureMatch) {
        typeName = signatureMatch[1]
      } else {
        // 3. メソッド名を含まない単純な型名 (例: "String", "Array[Integer]", "[Integer, String]")
        const typeMatch = content.match(/^([A-Z][a-zA-Z0-9_:]*(?:\[.*\])?)$/)
        const tupleMatch = content.match(/^(\[.*\])$/)
        const symbolLiteralMatch = content.match(/^:([a-zA-Z0-9_!?]+)$/)

        if (typeMatch) {
          typeName = typeMatch[1]
        } else if (tupleMatch) {
          typeName = tupleMatch[1]
        } else if (symbolLiteralMatch) {
          return "Symbol" // :upcase -> Symbol とみなす
        }
      }
    }

    return typeName ? this.normalizeTypeName(typeName) : null
  }

  /**
   * 型名を正規化する (ジェネリクス除去、名前空間処理、特殊型マップ)
   * @param {string} typeName 
   * @returns {string|null}
   */
  static normalizeTypeName(typeName) {
    let name = typeName.trim()

    // 1. 名前空間 (::) の除去 (最後のパーツを取得)
    const parts = name.split("::")
    const lastPart = parts[parts.length - 1]

    // 2. ジェネリクス ([...]) または タプル ([...]) の処理
    if (lastPart.startsWith("[")) {
      // タプル型 "[String, String]" -> Array とみなす
      return "Array"
    }

    name = lastPart
    const bracketIdx = name.indexOf("[")
    if (bracketIdx !== -1) {
      // ジェネリクス除去 "Array[Integer]" -> Array
      name = name.substring(0, bracketIdx)
    }

    // 3. 特殊な型名のマップ
    const typeMap = {
      "untyped": null,
      "nil": "NilClass",
      "true": "TrueClass",
      "false": "FalseClass",
      "void": null
    }
    
    return typeMap[name] !== undefined ? typeMap[name] : name
  }

  /**
   * ホバー内容からデバッグ情報等を抽出する (将来的な拡張用)
   */
  static extractMetadata(markdownContent) {
    // 必要に応じて実装
    return {}
  }
}
