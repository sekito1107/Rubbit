import { RuremaSearcher } from "utils/rurema_searcher"
import { RuremaUtils } from "utils/rurema_utils"

/**
 * るりま検索とURL生成に関する責務を持つ Interactor
 * RuremaSearcher と RuremaUtils をラップし、コントローラーにドメイン固有の操作を提供する
 */
export class RuremaInteractor {
  constructor() {
    this.searcher = new RuremaSearcher()
    this._indexLoaded = false
  }

  /**
   * インデックスをロードする
   */
  async loadIndex() {
    if (this._indexLoaded) return
    await this.searcher.loadIndex()
    this._indexLoaded = true
  }

  /**
   * 指定されたクラス名とメソッド名に合致するるりま情報を解決する
   * @param {string} className 
   * @param {string} methodName 
   * @returns {Object|null} { signature, url, className, methodName, separator }
   */
  resolve(className, methodName) {
    const candidates = this.searcher.findMethod(methodName)
    if (!candidates) return null

    // className#methodName または className.methodName に完全一致するものを探す
    const match = candidates.find(c => c.startsWith(`${className}#`) || c.startsWith(`${className}.`))
    if (!match) return null

    return {
      signature: match,
      ...RuremaUtils.generateUrlInfo(match)
    }
  }

  /**
   * 指定されたクラスのすべてのメソッドを取得し、それぞれのるりま情報（URLなど）を付与する
   * @param {string} className 
   * @returns {Array<Object>}
   */
  getMethodsWithInfo(className) {
    const methods = this.searcher.findMethodsByClass(className)
    return methods.map(item => ({
      ...item,
      // 各候補シグネチャに対するURL情報を付与
      links: item.candidates.map(cand => ({
        signature: cand,
        ...RuremaUtils.generateUrlInfo(cand)
      }))
    }))
  }

  /**
   * 検索URLを生成する
   */
  generateSearchUrl(method) {
    return RuremaUtils.generateSearchUrl(method)
  }
}
