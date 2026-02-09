import * as monaco from 'monaco-editor'

/**
 * LSP 固有のコマンド (measureValue 等) をエディタ上で実行する
 */
export class ExecuteCommand {
  constructor(client, inlayHints) {
    this.client = client
    this.inlayHints = inlayHints // ProvideInlayHints インスタンス
  }

  /**
   * コマンドの登録を開始する
   */
  start() {
    monaco.editor.registerCommand("typeprof.measureValue", async (accessor, ...args) => {
      try {
        let params = args[0]
        if (!params) return

        const result = await this.client.sendRequest("workspace/executeCommand", { 
          command: "typeprof.measureValue", 
          arguments: [params] 
        })

        if (result !== undefined) {
          const line = params.line
          if (line && this.inlayHints) {
            // インレイヒントを更新して表示
            this.inlayHints.update(line, result)
          } else {
            alert(`Measured Value: ${result}`)
          }
        }
      } catch (e) {
        console.error("[ExecuteCommand] Command 'typeprof.measureValue' failed:", e)
      }
    })
  }
}
