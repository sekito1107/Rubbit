import { Controller } from "@hotwired/stimulus"

const WASM_API_URL = "https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm"
const RUBY_WASM_URL = "/js/rubpad.wasm"

// Ruby VMのライフサイクルと実行を管理する
export default class extends Controller {
  async connect() {
    this.vm = null
    
    // まだ準備ができていない場合、バックグラウンドでVMを初期化する
    if (!window.__rubyVM && !window.__rubyVMInitializing) {
      window.__rubyVMInitializing = true
      await this.initializeVM()
      delete window.__rubyVMInitializing
    } else if (window.__rubyVM) {
    }
  }

  async initializeVM() {
    try {
      this.dispatchOutput("// Ruby WASM initializing...")
      
      const { DefaultRubyVM } = await import(WASM_API_URL)
      const response = await fetch(RUBY_WASM_URL)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText}`)
      }

      const module = await WebAssembly.compileStreaming(response)
      const { vm } = await DefaultRubyVM(module)
      
      this.vm = vm
      window.__rubyVM = vm
      
      this.dispatchOutput("// Ruby WASM ready!")
      this.dispatch("ready", { detail: { version: this.getRubyVersion() } })

    } catch (error) {
      console.error("Ruby VM Init Error:", error)
      this.dispatchOutput(`// Error: ${error.message}`)
    }
  }

  getRubyVersion() {
    if (!this.vm) return "Unknown"
    return `Ruby ${this.vm.eval("RUBY_VERSION").toString()}`
  }

  // API to run code
  run(code) {
    if (!this.vm) {
      this.dispatchOutput("// Ruby VM is not ready yet.")
      return
    }

    try {
      // 標準出力をキャプチャするためにコードをラップする
      const wrappedCode = [
        "require 'stringio'",
        "$stdout = StringIO.new",
        "begin",
        code,
        "rescue => e",
        '  puts "Error: #{e.class}: #{e.message}"',
        "end",
        "$stdout.string"
      ].join("\n")
      
      const result = this.vm.eval(wrappedCode)
      this.dispatchOutput(result.toString())
    } catch (error) {
      this.dispatchOutput(`Error: ${error.message}`)
    }
  }

  dispatchOutput(text) {
    // リスナー（ConsoleControllerなど）に通知する
    this.dispatch("output", { detail: { text } })
  }
}
