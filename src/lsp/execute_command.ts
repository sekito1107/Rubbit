import * as monaco from "monaco-editor";
import type { LSPClient } from "./client";
import type { ProvideInlayHints } from "./inlay_hints";

// LSP 固有のコマンド (measureValue 等) をエディタ上で実行する
export class ExecuteCommand {
  private client: LSPClient;
  private editor: monaco.editor.ICodeEditor;
  private inlayHints: ProvideInlayHints;

  constructor(client: LSPClient, inlayHints: any, editor: monaco.editor.ICodeEditor) {
    this.client = client;
    this.inlayHints = inlayHints; // InlayHints インスタンス
    this.editor = editor;
  }

  // コマンドの登録を開始する
  start(): void {
    monaco.editor.registerCommand("typeprof.measureValue", async (_accessor, ...args) => {
      const params = args[0] as { line: number; expression: string; character: number; code?: string; stdin?: string } | undefined;
      if (!params) return;

      // 明示的にコードが渡されていない場合はエディタから取得
      if (!params.code && this.editor) {
        params.code = this.editor.getModel()?.getValue();
      }

      const result = await this.client.sendRequest("workspace/executeCommand", {
        command: "typeprof.measureValue",
        arguments: [params],
      });

      if (result !== undefined) {
        const line = params.line + 1; // 0-indexed から 1-indexed に変換
        if (this.inlayHints) {
          // インレイヒントを更新して表示
          this.inlayHints.update(line, result as string);
        }
      }
    });
  }
}
