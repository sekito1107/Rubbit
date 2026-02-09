import { Resolution } from "./resolution"

/**
 * 特定のメソッドシンボルに対して、LSP での型解決と Rurima 情報を紐づける
 */
export class Resolver {
  constructor(lspManager, rurima) {
    this.rurima = rurima
    this.resolution = new Resolution(lspManager)
  }

  /**
   * 指定されたメソッドの型を解決し、Rurima 情報を取得して返す
   */
  async resolve(methodName, line, col) {
    try {
      // 1. LSP を使用してクラス名を特定
      let className = await this.resolution.resolveMethodAt(line, col, { 
        methodName: methodName,
        skipSync: true 
      })
      
      // 2. フォールバック: レシーバ（ドットの直前）を解決
      if (!className && col > 1) {
        className = await this.resolution.resolveAtPosition(line, col - 1, { skipSync: true, maxRetries: 1 })
      }

      if (className) {
        // 3. Rurima インデックスから情報を取得
        const info = this.rurima.resolve(className, methodName)
        if (info) {
          return {
            status: 'resolved',
            className: info.className,
            url: info.url,
            separator: info.separator
          }
        }
      }
      return { status: 'unknown' }
    } catch (e) {
      console.error(`[Resolver] Failed to resolve ${methodName}:`, e)
      return { status: 'unknown' }
    }
  }
}
