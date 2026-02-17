import { Resolution } from "./resolution"

export class Resolver {
  private rurima: any
  public resolution: Resolution

  constructor(lspManager: any, rurima: any) {
    this.rurima = rurima
    this.resolution = new Resolution(lspManager)
  }

  async resolve(methodName: string, line: number, col: number): Promise<{
    status: 'resolved' | 'unknown'
    className?: string
    url?: string
    separator?: string
  }> {
    // 1.LSPを使用してクラス名を特定
    let className = await this.resolution.resolveMethodAt(line, col)
    
    // 2.フォールバック: レシーバ（ドットの直前）を解決
    if (!className && col > 1) {
      className = await this.resolution.resolveAtPosition(line, col - 1)
    }

    if (className) {
      // 3.情報を取得
      const info = await this.rurima.resolve(className, methodName)
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
  }
}
