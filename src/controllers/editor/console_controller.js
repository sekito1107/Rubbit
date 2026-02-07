import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["output"]
  
  connect() {
    this.editor = null
    
    // エディタの初期化を監視する
    this.boundHandleEditorInit = this.handleEditorInit.bind(this)
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
    
    // Ruby VMイベントを監視する（同じ要素、または同じコンテナ上にあるため）
    // または、要素自体にイベントリスナーを追加することも可能
    this.element.addEventListener("ruby-vm:output", this.handleRubyOutput.bind(this))
    this.element.addEventListener("ruby-vm:ready", this.handleRubyReady.bind(this))
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  handleEditorInit(event) {
    this.editor = event.detail.editor
  }

  handleRubyOutput(event) {
    this.appendOutput(event.detail.text)
  }
  
  handleRubyReady(event) {
    // ヘッダーのバージョン表示を更新するためにグローバルにブロードキャストする
    window.dispatchEvent(new CustomEvent("ruby-vm:version-loaded", { 
      detail: { version: event.detail.version } 
    }))
  }

  run() {
    const vmController = this.application.getControllerForElementAndIdentifier(this.element, "ruby-vm")
    
    if (!vmController) {
      this.appendOutput("// Error: Ruby VM Controller not found.")
      return
    }

    if (!this.editor) {
      this.appendOutput("// Error: Editor not ready.")
      return
    }

    const code = this.editor.getValue()
    vmController.run(code)
  }

  clear() {
    if (this.hasOutputTarget) {
      this.outputTarget.innerHTML = ""
    }
  }

  appendOutput(text) {
    if (!this.hasOutputTarget) return
    
    if (text.trim() === "") {
        text = "// (no output)"
    }

    // 初期化中メッセージが出ている場合は上書きする
    const lastLine = this.outputTarget.lastElementChild
    if (lastLine && 
        lastLine.textContent.includes("// Ruby WASM initializing...") && 
        text.includes("// Ruby WASM ready!")) {
      lastLine.innerHTML = this.escapeHtml(text)
      return
    }

    this.outputTarget.innerHTML += text.split("\n").map(line => 
      `<div>${this.escapeHtml(line)}</div>`
    ).join("")
    
    // 自動で最下部へスクロールする
    this.outputTarget.lastElementChild?.scrollIntoView({ behavior: "smooth" })
  }

  escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}
