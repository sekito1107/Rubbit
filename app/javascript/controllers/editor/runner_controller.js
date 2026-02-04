import { Controller } from "@hotwired/stimulus"

const WASM_API_URL = "https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser.umd.js"
const RUBY_WASM_URL = "https://cdn.jsdelivr.net/npm/@ruby/3.3-wasm-wasi@2.8.1/dist/ruby+stdlib.wasm"

export default class extends Controller {
  static targets = ["output"]
  
  async connect() {
    this.editor = null
    this.vm = null
    
    // Listen for editor initialization
    document.addEventListener("editor--main:initialized", (e) => {
      this.editor = e.detail.editor
    })
    
    // Initialize Ruby VM in the background
    this.initializeVM()
  }

  async initializeVM() {
    try {
      this.updateOutput("// Ruby WASM initializing...")
      
      // Load Ruby WASM API script (UMD version)
      await this.loadScript(WASM_API_URL)
      
      // Get DefaultRubyVM from the global object
      const { DefaultRubyVM } = window["ruby-wasm-wasi"]
      
      // Fetch and compile WASM module
      const response = await fetch(RUBY_WASM_URL)
      const module = await WebAssembly.compileStreaming(response)
      
      // Initialize VM
      const { vm } = await DefaultRubyVM(module)
      this.vm = vm
      
      this.updateOutput("// Ruby WASM ready! Click Run to execute code.")
    } catch (error) {
      console.error("Failed to initialize Ruby VM:", error)
      this.updateOutput(`// Error: ${error.message}`)
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      const script = document.createElement("script")
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  async run() {
    if (!this.vm) {
      this.updateOutput("// Ruby VM is not ready yet. Please wait...")
      return
    }

    if (!this.editor) {
      this.updateOutput("// Editor not available.")
      return
    }

    const code = this.editor.getValue()
    
    try {
      // Capture stdout using StringIO
      const wrappedCode = `
require 'stringio'
$stdout = StringIO.new
begin
${code}
rescue => e
  puts "Error: \#{e.class}: \#{e.message}"
end
$stdout.string
`
      
      const result = this.vm.eval(wrappedCode)
      const output = result.toString()
      
      if (output.trim()) {
        this.updateOutput(output)
      } else {
        this.updateOutput("// (no output)")
      }
    } catch (error) {
      this.updateOutput(`Error: ${error.message}`)
    }
  }

  updateOutput(text) {
    if (this.hasOutputTarget) {
      this.outputTarget.innerHTML = text.split("\n").map(line => 
        `<div>${this.escapeHtml(line)}</div>`
      ).join("")
    }
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
