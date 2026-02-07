import { Controller } from "@hotwired/stimulus"
import * as monaco from 'monaco-editor'

// Import Monaco workers directly for Vite
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

window.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  }
}

export default class extends Controller {
  static targets = ["container"]

  async connect() {
    this.boundHandleSettingsUpdate = this.handleSettingsUpdate.bind(this)
    window.addEventListener("settings:updated", this.boundHandleSettingsUpdate)

    try {
      await this.loadEditor()
      this.initEditor()
    } catch (error) {
      this.containerTarget.innerText = "Failed to load editor."
      console.error(error)
    }
  }

  disconnect() {
    window.removeEventListener("settings:updated", this.boundHandleSettingsUpdate)

    if (this.editor) {
      this.editor.dispose()
    }
    if (this.observer) {
      this.observer.disconnect()
    }
  }

  async loadEditor() {
    // Monaco is now imported as a module, so we don't need to load scripts manually.
    return Promise.resolve()
  }

  initEditor() {
    const savedSettings = JSON.parse(localStorage.getItem("rubpad_settings") || "{}")

    this.editor = monaco.editor.create(this.containerTarget, {
      value: [
        "# Welcome to RubPad!",
        "# Type code here and see Rurema links appear on the right.",
        "",
        "names = ['Ruby', 'Python', 'JavaScript']",
        "",
        "names.select { |n| n.include?('u') }",
        "  .map(&:upcase)",
        "  .each do |n|",
        "    puts \"Hello, #{n}!\"",
        "  end",
        "",
        "# Try typing .split or .size below:",
        ""
      ].join("\n"),
      language: "ruby",
      theme: this.currentTheme,
      automaticLayout: true,
      minimap: savedSettings.minimap || { enabled: false },
      fontSize: parseInt(savedSettings.fontSize || 14),
      tabSize: parseInt(savedSettings.tabSize || 2),
      wordWrap: savedSettings.wordWrap || 'off',
      autoClosingBrackets: savedSettings.autoClosingBrackets || 'always',
      mouseWheelZoom: savedSettings.mouseWheelZoom || false,
      renderWhitespace: savedSettings.renderWhitespace || 'none',
      scrollBeyondLastLine: false,
      renderLineHighlight: "all",
      fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace"
    })

    // Expose for other controllers that might connect after initialization
    window.monacoEditor = this.editor

    this.observer = new MutationObserver(() => {
      this.updateTheme()
    })
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    })

    // Dispatch initialized event for other controllers
    this.element.dispatchEvent(new CustomEvent("editor--main:initialized", {
      detail: { editor: this.editor },
      bubbles: true 
    }))
  }

  updateTheme() {
    if (this.editor) {
      monaco.editor.setTheme(this.currentTheme)
    }
  }

  get currentTheme() {
    const isDark = document.documentElement.classList.contains("dark")
    return isDark ? "vs-dark" : "vs"
  }

  handleSettingsUpdate(event) {
    if (!this.editor) return
    const s = event.detail.settings
    
    this.editor.updateOptions({
      fontSize: parseInt(s.fontSize),
      tabSize: parseInt(s.tabSize),
      wordWrap: s.wordWrap,
      autoClosingBrackets: s.autoClosingBrackets,
      minimap: s.minimap,
      mouseWheelZoom: s.mouseWheelZoom,
      renderWhitespace: s.renderWhitespace
    })
  }
}
