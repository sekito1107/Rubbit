/**
 * 解析結果（メソッドリストとその状態）を中央管理し、変更を通知する Store
 */
export class AnalysisStore {
  constructor() {
    this.methods = new Map() // { methodName: { name, line, col, status, ... } }
    this.firstScanDone = false
  }

  /**
   * メソッドの状態を更新または追加する
   */
  set(name, state) {
    this.methods.set(name, state)
  }

  /**
   * 全てのメソッドデータを取得する
   */
  getAll() {
    return Array.from(this.methods.values())
  }

  /**
   * 単一のメソッドデータを取得する
   */
  get(name) {
    return this.methods.get(name)
  }

  /**
   * 指定されたリストに含まれないメソッドを削除する
   */
  keepOnly(currentNames) {
    let changed = false
    for (const name of this.methods.keys()) {
      if (!currentNames.has(name)) {
        this.methods.delete(name)
        changed = true
      }
    }
    return changed
  }
  
  setFirstScanDone(done) {
    this.firstScanDone = done
  }

  /**
   * 状態が更新されたことをシステム全体に通知する
   */
  notify() {
    const event = new CustomEvent("rubpad:analysis-updated", {
      detail: { 
        methods: this.getAll(),
        firstScanDone: this.firstScanDone
      }
    })
    window.dispatchEvent(event)
  }
}
