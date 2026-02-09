/**
 * エディタの変更イベントを監視し、スキャンが必要な範囲やキャッシュの整合性を管理する
 */
export class Tracker {
  constructor() {
    this.dirtyLines = new Set()
  }

  /**
   * エディタの変更イベントから、再スキャンが必要な行を特定する
   * @param {monaco.editor.IModelContentChangedEvent} event 
   * @param {Array} lineMethods 
   */
  processChangeEvent(event, lineMethods) {
    event.changes.forEach(change => {
      const startLine = change.range.startLineNumber - 1
      const endLine = change.range.endLineNumber - 1
      const newLineCount = change.text.split("\n").length
      const oldLineCount = (endLine - startLine) + 1

      // 1. 行が追加/削除された場合、キャッシュをずらす
      if (newLineCount !== oldLineCount) {
        const diff = newLineCount - oldLineCount
        if (diff > 0) {
          // 行追加: 後ろをずらす
          lineMethods.splice(startLine + 1, 0, ...new Array(diff).fill(null))
        } else {
          // 行削除: 削除
          lineMethods.splice(startLine + 1, Math.abs(diff))
        }
      }

      // 2. 変更された行とその周辺を Dirty マーク
      for (let i = startLine; i < startLine + newLineCount; i++) {
        this.dirtyLines.add(i)
      }
    })
  }

  getDirtyLines() {
    return this.dirtyLines
  }

  clearDirtyLines() {
    this.dirtyLines.clear()
  }

  markAllDirty(lineCount) {
    this.dirtyLines.clear()
    for (let i = 0; i < lineCount; i++) {
      this.dirtyLines.add(i)
    }
  }
}
