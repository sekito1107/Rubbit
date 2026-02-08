import { Controller } from "@hotwired/stimulus"
import { RuremaInteractor } from "interactors/rurema_interactor"
import { ResolutionInteractor } from "interactors/resolution_interactor"

export default class extends Controller {
  static targets = [ "globalList", "cardTemplate", "linkTemplate", "searchTemplate" ]

  async connect() {
    this.rurema = new RuremaInteractor()
    await this.rurema.loadIndex()

    this.editor = null 
    this.resolution = null

    // エディタの初期化を監視
    this.boundHandleEditorInit = (e) => {
      this.editor = e.detail.editor
      this.setupListeners()
    }
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)

    // LSPの準備完了を監視
    this.boundHandleLSPReady = () => {
      this.initInteractors()
      this.updateGlobalList()
    }
    window.addEventListener("rubpad:lsp-ready", this.boundHandleLSPReady)

    // 真の解析完了を監視
    this.boundHandleAnalysisFinished = () => {
      this.updateGlobalList()
    }
    window.addEventListener("rubpad:lsp-analysis-finished", this.boundHandleAnalysisFinished)
    
    if (window.monacoEditor) {
      this.editor = window.monacoEditor
      this.setupListeners()
      if (window.rubpadLSPInteractor) this.initInteractors()
    }
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
    window.removeEventListener("rubpad:lsp-ready", this.boundHandleLSPReady)
    window.removeEventListener("rubpad:lsp-analysis-finished", this.boundHandleAnalysisFinished)
  }

  initInteractors() {
    if (window.rubpadLSPInteractor) {
        this.resolution = new ResolutionInteractor(window.rubpadLSPInteractor)
    }
  }

  setupListeners() {
    if (!this.editor) return
    this.editor.onDidChangeModelContent(() => this.updateGlobalList())
    this.updateGlobalList()
  }

  // ==========================================
  // Global List Logic (Regex based + Async Resolve)
  // ==========================================
  updateGlobalList() {
    if (!this.hasGlobalListTarget || !this.editor) return

    // LSP準備待ち、および初回の解析（didOpen）完了待ちの表示
    if (!window.rubpadLSPInteractor || !window.__rubyLSPInitialAnalysisFinished) {
      this.globalListTarget.innerHTML = `
        <div class="text-xs text-slate-500 dark:text-slate-600 text-center py-4">
          <span class="inline-block animate-pulse">Initializing Ruby analysis engine...</span>
          <div class="mt-1 opacity-50 text-[10px]">Analyzing RBS standard library and initial code</div>
        </div>
      `
      return
    }

    const code = this.editor.getValue()
    const foundMethods = this.extractMethodsWithPosition(code)

    if (foundMethods.length === 0) {
      this.globalListTarget.innerHTML = `
        <div class="text-xs text-slate-500 dark:text-slate-600 text-center py-4">No methods detected</div>
      `
      return
    }

    this.globalListTarget.innerHTML = ""

    foundMethods.forEach(item => {
      const card = this.cardTemplateTarget.content.cloneNode(true).querySelector("div")
      card.querySelector('[data-role="methodName"]').textContent = item.name
      
      this.setCardLoading(card)
      this.globalListTarget.appendChild(card)
      this.resolveMethod(item, card)
    })
  }

  extractMethodsWithPosition(code) {
    const methods = []
    const seen = new Set()
    const lines = code.split("\n")

    lines.forEach((lineText, lineIndex) => {
      const lineMethodRegex = /(?:\.|&:[ ]*)([a-zA-Z_][a-zA-Z0-9_]*[!?]?)/g
      let match
      while ((match = lineMethodRegex.exec(lineText)) !== null) {
        const methodName = match[1]
        if (!seen.has(methodName)) {
             seen.add(methodName)
             methods.push({
               name: methodName,
               line: lineIndex + 1,
               col: match.index + 1,
               fullMatch: match[0]
             })
        }
      }
    })
    return methods
  }

  async resolveMethod(item, card) {
    if (!this.resolution) this.initInteractors()
    if (!this.resolution) return

    const offset = item.fullMatch.indexOf(item.name)
    const probeCol = item.col + offset

    const className = await this.resolution.resolveAtPosition(item.line, probeCol)

    if (className) {
      const info = this.rurema.resolve(className, item.name)
      if (info) {
        this.updateCardWithInfo(card, info)
        return
      }
    }
    
    this.setCardUnknown(card, item.name)
  }

  setCardLoading(card) {
    const linksContainer = card.querySelector('[data-role="linksDetails"]')
    linksContainer.innerHTML = `
      <div class="flex items-center space-x-1 opacity-40 animate-pulse" data-role="loading-indicator">
        <div class="w-2 h-2 bg-slate-400 rounded-full"></div>
        <span class="text-[9px]">Analyzing...</span>
      </div>
    `
  }

  setCardUnknown(card, methodName) {
    const detailsContainer = card.querySelector('[data-role="linksDetails"]')
    detailsContainer.innerHTML = ""

    const icon = card.querySelector('[data-role="icon"]')
    icon.textContent = "?"
    icon.classList.remove("text-blue-600", "dark:text-blue-400")
    icon.classList.add("text-slate-400", "dark:text-slate-500")

    const searchNode = this.searchTemplateTarget.content.cloneNode(true)
    searchNode.querySelector("a").href = this.rurema.generateSearchUrl(methodName)
    detailsContainer.appendChild(searchNode)
  }

  updateCardWithInfo(card, info) {
    const detailsContainer = card.querySelector('[data-role="linksDetails"]')
    const icon = card.querySelector('[data-role="icon"]')

    detailsContainer.innerHTML = ""
    icon.textContent = "<>"
    icon.classList.remove("text-slate-400", "dark:text-slate-500")
    icon.classList.add("text-blue-600", "dark:text-blue-400")

    const linkNode = this.linkTemplateTarget.content.cloneNode(true)
    linkNode.querySelector("a").href = info.url
    linkNode.querySelector('[data-role="className"]').textContent = info.className
    linkNode.querySelector('[data-role="separatorMethod"]').textContent = info.separator + info.methodName
    detailsContainer.appendChild(linkNode)
  }
}
