/**
 * エディタ設定等の LocalStorage への保存と復元を担当する
 */
export class Settings {
  static STORAGE_KEY = "rubpad_settings"

  constructor() {
    this.data = this._load()
  }

  /**
   * 全ての設定を取得
   */
  getAll() {
    return this.data
  }

  /**
   * 特定のキーの設定を更新
   */
  update(key, value) {
    this.data[key] = value
    this._save()
  }

  _load() {
    try {
      const stored = localStorage.getItem(Settings.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (e) {
      console.warn("[Settings] Failed to load settings:", e)
      return {}
    }
  }

  _save() {
    localStorage.setItem(Settings.STORAGE_KEY, JSON.stringify(this.data))
  }
}
