import { Controller } from "@hotwired/stimulus"
import { RuremaInteractor } from "interactors/rurema_interactor"
import { ResolutionInteractor } from "interactors/resolution_interactor"

export default class extends Controller {
  static targets = [ "contextualList", "contextualLoader", "cardTemplate", "linkTemplate" ]

  async connect() {
    this.rurema = new RuremaInteractor()
    await this.rurema.loadIndex()

    this.editor = null
    this.resolution = null
    this.debounceTimer = null
    this.CONTEXT_DEBOUNCE_MS = 300

    this.boundHandleEditorInit = (e) => {
      this.editor = e.detail.editor
      this.setupListeners()
    }
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)

    // 解析完了を監視
    this.boundHandleAnalysisFinished = () => this.updateContextualList()
    window.addEventListener("rubpad:lsp-analysis-finished", this.boundHandleAnalysisFinished)

    if (window.monacoEditor) {
      this.editor = window.monacoEditor
      this.setupListeners()
      this.updateContextualList()
    }
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
    window.removeEventListener("rubpad:lsp-analysis-finished", this.boundHandleAnalysisFinished)
  }

  initInteractors() {
    if (window.rubpadLSPInteractor) {
        this.resolution = new ResolutionInteractor(window.rubpadLSPInteractor)
    }
  }

  setupListeners() {
    if (!this.editor) return
    this.editor.onDidChangeCursorPosition(() => this.updateContextualList())
    if (window.rubpadLSPInteractor) this.initInteractors()
  }

  updateContextualList() {
    if (!this.editor) return
    this.toggleContextLoader(true)

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      await this.performContextualUpdate()
      this.toggleContextLoader(false)
    }, this.CONTEXT_DEBOUNCE_MS)
  }

  async performContextualUpdate() {
    if (!this.hasContextualListTarget || !this.editor) return

    if (!window.rubpadLSPInteractor || !window.__rubyLSPInitialAnalysisFinished) {
        this.contextualListTarget.innerHTML = `
            <div class="text-xs text-slate-500 dark:text-slate-600 text-center py-4">
               <span class="animate-pulse">Waiting for analysis engine...</span>
            </div>
        `
        return
    }

    if (!this.resolution) this.initInteractors()
    if (!this.resolution) return

    const position = this.editor.getPosition()
    if (!position) return

    // ResolutionInteractor にリトライとフォールバック（ドット除去など）を委譲
    const type = await this.resolution.resolveWithFallback(this.editor, position)

    this.contextualListTarget.innerHTML = ""

    if (!type || type === "Object") {
      this.contextualListTarget.innerHTML = `
        <div class="text-xs text-slate-400 dark:text-slate-600 text-center py-2 italic bg-slate-100/50 dark:bg-white/[0.02] rounded">
          No context detected
        </div>
      `
      return
    }

    const methods = this.rurema.getMethodsWithInfo(type)

    if (methods.length === 0) {
      this.contextualListTarget.innerHTML = `
        <div class="text-xs text-slate-400 dark:text-slate-600 text-center py-2 italic">
          No methods for ${type}
        </div>
      `
      return
    }

    this.renderContextualUI(type, methods)
  }

  renderContextualUI(type, methods) {
    // アコーディオン構築
    const container = document.createElement("details")
    container.className = "group"
    container.open = false

    const summary = document.createElement("summary")
    summary.className = "flex items-center cursor-pointer p-2 list-none select-none text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
    summary.innerHTML = `
      <svg class="w-3 h-3 mr-2 transform group-open:rotate-90 transition-transform text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span>${type}</span>
      <span class="ml-auto text-[10px] text-slate-400 font-normal">${methods.length} methods</span>
    `
    container.appendChild(summary)

    // 検索ボックス
    const searchContainer = document.createElement("div")
    searchContainer.className = "px-2 py-1 border-b border-slate-200 dark:border-white/10"

    const searchInput = document.createElement("input")
    searchInput.type = "text"
    searchInput.placeholder = "Filter methods..."
    searchInput.className = "w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 placeholder-slate-400"

    // 検索イベント
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase()
      const cards = listContainer.querySelectorAll('[data-role="method-card"]')
      cards.forEach(card => {
        const methodName = card.getAttribute("data-method-name").toLowerCase()
        card.style.display = methodName.includes(query) ? "" : "none"
      })
    })

    searchContainer.appendChild(searchInput)

    const listContainer = document.createElement("div")
    listContainer.className = "pl-2 pt-2 space-y-1"

    methods.forEach(item => {
      const card = this.createContextualMethodCard(item)
      card.setAttribute("data-role", "method-card")
      card.setAttribute("data-method-name", `.${item.methodName}`)
      listContainer.appendChild(card)
    })

    container.appendChild(searchContainer)
    container.appendChild(listContainer)
    this.contextualListTarget.appendChild(container)
  }

  toggleContextLoader(show) {
    if (!this.hasContextualLoaderTarget) return
    this.contextualLoaderTarget.style.opacity = show ? "1" : "0"
  }

  createContextualMethodCard(item) {
    const cardNode = this.cardTemplateTarget.content.cloneNode(true)
    const container = cardNode.querySelector("div")

    cardNode.querySelector('[data-role="methodName"]').textContent = `.${item.methodName}`
    const detailsContainer = cardNode.querySelector('[data-role="linksDetails"]')

    item.links.forEach(linkInfo => {
        const linkNode = this.createLinkFromInfo(linkInfo)
        detailsContainer.appendChild(linkNode)
    })

    return container
  }

  createLinkFromInfo(info) {
    const node = this.linkTemplateTarget.content.cloneNode(true)
    const anchor = node.querySelector("a")
    anchor.href = info.url
    node.querySelector('[data-role="className"]').textContent = info.className
    node.querySelector('[data-role="separatorMethod"]').textContent = info.separator + info.methodName
    return node
  }
}
