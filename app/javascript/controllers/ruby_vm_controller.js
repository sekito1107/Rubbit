import { Controller } from "@hotwired/stimulus"

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
      
      this.worker.onmessage = (event) => {
        const { type, payload } = event.data
        this.handleWorkerMessage(type, payload)
      }

      this.worker.postMessage({ 
        type: "initialize", 
        payload: { wasmUrl: RUBY_WASM_URL } 
      })

    } catch (error) {
      console.error("Worker Init Error:", error)
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
            this.dispatch("ready", { detail: { version: payload.version } })
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
      if (this.worker) {
          this.worker.terminate()
      }
  }
}
