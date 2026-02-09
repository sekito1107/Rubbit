import { SyncDocument } from "./sync_document"
import { HandleDiagnostics } from "./handle_diagnostics"
import { ProvideHover } from "./provide_hover"
import { ProvideInlayHints } from "./provide_inlay_hints"
import { ExecuteCommand } from "./execute_command"
import { ResolveType } from "./resolve_type"
import { BootLSP } from "./boot_lsp"

/**
 * LSP ドメインの機能を統括し、外部へのインターフェースを提供する Manager
 */
export class LSPManager {
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    
    // 内部コンポーネントの初期化
    this.boot = new BootLSP(client)
    this.sync = new SyncDocument(client, editor)
    this.diagnostics = new HandleDiagnostics(client, editor)
    this.hover = new ProvideHover(client)
    this.inlayHints = new ProvideInlayHints(editor)
    this.commands = new ExecuteCommand(client, this.inlayHints)
    this.resolver = new ResolveType(client)
  }

  /**
   * LSP サーバ自体の初期化（Handshake）を行う
   */
  async initialize() {
    return this.boot.execute()
  }

  /**
   * エディタ連携機能（同期、診断、プロバイダ）を有効化する
   */
  activate() {
    this.sync.start()
    this.diagnostics.start()
    this.hover.start()
    this.inlayHints.start()
    this.commands.start()
    
    // Inlay Hints を初期状態で有効化
    this.editor.updateOptions({ inlayHints: { enabled: "on" } })
  }

  /**
   * 外部向けの型解決 Facade API
   */
  async getTypeAtPosition(line, col) {
    this.flushDocumentSync()
    return this.resolver.at(line, col)
  }

  /**
   * 一時的なコンテンツで型解決を試みる Facade API
   */
  async probeTypeWithTemporaryContent(content, line, col) {
    return this.resolver.probe(content, line, col, this.sync)
  }

  /**
   * 強制的にドキュメントを同期する
   */
  flushDocumentSync() {
    this.sync.flush()
  }

  /**
   * 測定値をリセットする
   */
  clearMeasuredValues() {
    this.inlayHints.clear()
  }

  /**
   * エディタのモデルを取得 (互換性維持)
   */
  get model() {
    return this.editor.getModel()
  }
}
