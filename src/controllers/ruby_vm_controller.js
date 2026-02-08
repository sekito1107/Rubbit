import { Controller } from "@hotwired/stimulus"
import { LSPClient } from "utils/lsp_client"
import { LSPInteractor } from "interactors/lsp_interactor"
import { RuremaInteractor } from "interactors/rurema_interactor"
import { AnalysisCoordinator } from "interactors/analysis_coordinator"

const RUBY_WASM_URL = "/js/rubpad.wasm"
// Rails 8 / Importmap: Workerのパス解決が必要
// moduleタイプのWorkerがサポートされていると仮定し、必要に応じてclassicスクリプトとして読み込む
// ただ、Worker内でimportを使用しているため、type: "module" が必須
// Asset Pipelineの問題を回避するため、Workerファイル自体は public/js から読み込む
const WORKER_URL = "/js/ruby_worker.js" 

// Ruby VMのライフサイクルと実行を管理する (Worker版)
export default class extends Controller {
  async connect() {
    this.worker = null
    this.lspClient = null
    this.editor = null
    this.interactor = null
    this.rurema = null
    this.analysis = null

    // エディタの初期化イベントを監視
    this.boundHandleEditorInitialized = this.handleEditorInitialized.bind(this)
    window.addEventListener("editor--main:initialized", this.boundHandleEditorInitialized)
    
    // 既にエディタが初期化済みの場合は即座にハンドリング
    if (window.monacoEditor) {
      this.handleEditorInitialized({ detail: { editor: window.monacoEditor } })
    }

    // まだ準備ができていない場合、バックグラウンドでVMを初期化する
    if (!window.__rubyVMInitializing && !window.__rubyVMReady) {
      window.__rubyVMInitializing = true
      this.initializeWorker()
    } else {
        // 必要ならここで再接続機能を追加できる（Workerインスタンスをグローバルに保持する場合など）
        // 現状はシングルページ利用またはリロードを前提とする
    }
  }

  initializeWorker() {
    try {
      // type: "module" は、Worker内で 'import' を使用するために重要
      this.worker = new Worker(WORKER_URL, { type: "module" })
      
      // WorkerをラップしたLSPクライアントを初期化
      this.lspClient = new LSPClient(this.worker)
      
      this.worker.addEventListener("message", (event) => {
        const { type, payload } = event.data
        this.handleWorkerMessage(type, payload)
      })

      this.worker.postMessage({ 
        type: "initialize", 
        payload: { wasmUrl: RUBY_WASM_URL } 
      })

    } catch (error) {
      this.dispatchOutput(`// Error starting worker: ${error.message}`)
    }
  }

  handleWorkerMessage(type, payload) {
    switch (type) {
        case "output":
            this.dispatchOutput(payload.text)
            break
        case "ready":
            window.__rubyVMReady = true
            delete window.__rubyVMInitializing
            this.dispatch("version-loaded", { detail: { version: payload.version } })
            
            // LSPの自動検証を開始
            this.verifyLSP()
            break
        case "error":
            this.dispatchOutput(`// VM Error: ${payload.message}`)
            break
    }
  }

  // コードを実行するAPI
  run(code) {
    if (!this.worker) {
      this.dispatchOutput("// Ruby VM Worker is not initialized.")
      return
    }
    
    this.worker.postMessage({ type: "run", payload: { code } })
  }

  dispatchOutput(text) {
    // リスナー（ConsoleControllerなど）に通知する
    this.dispatch("output", { detail: { text } })
  }
  
  disconnect() {
    window.removeEventListener("editor--main:initialized", this.boundHandleEditorInitialized)
    if (this.worker) {
      this.worker.terminate()
    }
  }

  handleEditorInitialized(event) {
    this.editor = event.detail.editor
    this.tryActivateInteractor()
  }

  async tryActivateInteractor() {
    // VMが準備完了(ready)し、かつエディタも初期化されている場合のみアクティブ化する
    if (this.lspClient && this.editor && !this.interactor && window.__rubyVMReady) {
      this.interactor = new LSPInteractor(this.lspClient, this.editor)
      this.interactor.activate()

      // 解析コーディネーターの初期化
      this.rurema = new RuremaInteractor()
      await this.rurema.loadIndex()
      
      this.analysis = new AnalysisCoordinator(this.editor, this.interactor, this.rurema)
      this.analysis.start()
      window.rubpadAnalysisCoordinator = this.analysis
      
      // LSPの準備完了を他のコントローラーに通知
      window.dispatchEvent(new CustomEvent("rubpad:lsp-ready"))
    }
  }

  async verifyLSP() {
    try {
      // 初期解析完了フラグ
      window.__rubyLSPInitialAnalysisFinished = false

      // Diagnostics 通知を監視して、最初の解析完了を検知する
      this.lspClient.onNotification("textDocument/publishDiagnostics", (params) => {
        if (!window.__rubyLSPInitialAnalysisFinished) {
          window.__rubyLSPInitialAnalysisFinished = true
          window.dispatchEvent(new CustomEvent("rubpad:lsp-analysis-finished"))
        }
      })

      // TypeProf に 'initialize' リクエストを送信
      const result = await this.lspClient.sendRequest("initialize", {
        processId: null,
        rootUri: "inmemory:///workspace/",
        capabilities: {
          textDocument: {
            publishDiagnostics: {}
          }
        },
        workspaceFolders: [{ uri: "inmemory:///workspace/", name: "workspace" }]
      })
      
      this.tryActivateInteractor()
    } catch (e) {
      // failed silently
    }
  }
}
