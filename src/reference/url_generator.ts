// 公式リファレンス特有の URL エンコードと生成を行うユーティリティ
export class URLGenerator {
  static readonly BASE_URL = "https://docs.ruby-lang.org/ja/latest/method"
  static readonly SEARCH_URL = "https://rurema.clear-code.com/query:"

  // メソッド名を公式リファレンスの形式にエンコードする
  static encodeMethodName(name: string): string {
    return name
      .replace(/=/g, "=3d")
      .replace(/\[/g, "=5b").replace(/\]/g, "=5d")
      .replace(/\+/g, "=2b").replace(/-/g, "=2d")
      .replace(/\*/g, "=2a").replace(/\//g, "=2f")
      .replace(/%/g, "=25").replace(/</g, "=3c")
      .replace(/>/g, "=3e")
      .replace(/!/g, "=21").replace(/\?/g, "=3f")
      .replace(/~/g, "=7e").replace(/\^/g, "=5e")
      .replace(/&/g, "=26").replace(/\|/g, "=7c")
      .replace(/`/g, "=60")
  }

  // シグネチャから公式リファレンスのURL情報を生成する
  // signature: "Class#method" or "Class.method"
  static generateUrlInfo(signature: string): {
    url: string
    className: string
    methodName: string
    separator: string
    displayName: string
  } {
    const isInstanceMethod = signature.includes("#")
    const separator = isInstanceMethod ? "#" : "."
    const [className, methodName] = signature.split(separator)

    const methodType = isInstanceMethod ? "i" : "s"
    const encodedMethod = this.encodeMethodName(methodName)
    const url = `${this.BASE_URL}/${className}/${methodType}/${encodedMethod}.html`

    return {
      url,
      className,
      methodName,
      separator,
      displayName: separator + methodName
    }
  }

  // 検索用URLを生成する
  static generateSearchUrl(query: string): string {
    return `${this.SEARCH_URL}${encodeURIComponent(query)}/`
  }
}
