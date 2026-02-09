/**
 * エディタの内容をファイルとしてダウンロード（エクスポート）する
 */
export class Exporter {
  constructor(editor) {
    this.editor = editor
  }

  /**
   * 現在のコンテンツを .rb ファイルとして保存する
   * @param {string} filename 
   */
  export(filename = "main.rb") {
    const code = this.editor.getValue()
    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
