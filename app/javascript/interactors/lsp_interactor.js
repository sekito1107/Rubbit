/**
 * LSP Interactor
 * Monaco Editor と LSP Client の仲介を行うクラス
 */
export class LSPInteractor {
  /**
   * @param {LSPClient} client - LSPクライアントインスタンス
   * @param {monaco.editor.IStandaloneCodeEditor} editor - Monaco Editorインスタンス
   */
  constructor(client, editor) {
    this.client = client
    this.editor = editor
    this.monaco = window.monaco
    this.model = editor.getModel()
    this.debounceTimer = null
    this.DEBOUNCE_WAIT = 500
    // Key: lineNumber (1-based), Value: measured string
    this.measuredValues = new Map()
    this.inlayHintsEmitter = new this.monaco.Emitter()
  }

  /**
   * Interactorを起動し、イベントリスナーとプロバイダを登録する
   */
  activate() {
    this.registerProviders()
    this.startDiagnostics()
    
    // 初期状態を通知 (didOpen)
    // TypeProfは didOpen されたファイルのみを解析対象とする可能性があるため必須
    const content = this.model.getValue()
    const version = this.model.getVersionId()
    
    this.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: "inmemory:///workspace/main.rb",
        languageId: "ruby",
        version: version,
        text: content
      }
    })

    this.syncDocument()
    
    // Inlay Hintsを強制的に有効化
    this.editor.updateOptions({ inlayHints: { enabled: "on" } })
  }

  /**
   * Monacoの各種プロバイダを登録する
   */
  registerProviders() {
    // Inlay Hints Provider (Measure Value の結果表示用)
    this.monaco.languages.registerInlayHintsProvider("ruby", {
      onDidChangeInlayHints: this.inlayHintsEmitter.event,
      provideInlayHints: (model, range, token) => {
        const hints = []
        
        // 計測された値をInlay Hintとして表示
        for (const [line, value] of this.measuredValues.entries()) {
          const lineNum = Number(line)

          // 範囲外ならスキップ (range.endLineNumber は inclusive)
          if (lineNum < range.startLineNumber || lineNum > range.endLineNumber) continue
          
          // 行の末尾に表示
          const maxCol = model.getLineMaxColumn(lineNum)
          
          hints.push({
            kind: this.monaco.languages.InlayHintKind.Type,
            position: { lineNumber: lineNum, column: maxCol },
            label: ` # => ${value}`,
            paddingLeft: true
          })
        }
        
        return {
          hints: hints,
          dispose: () => {}
        }
      }
    })

    // ホバープロバイダ (型情報 + Measure Value リンク)
    this.monaco.languages.registerHoverProvider("ruby", {
      provideHover: async (model, position) => {
        try {
          const response = await this.client.sendRequest("textDocument/hover", {
            textDocument: { uri: "inmemory:///workspace/main.rb" },
            position: {
              line: position.lineNumber - 1, // 0-based
              character: position.column - 1
            }
          })

          if (!response || !response.contents) return null
          
          // TypeProfからのレスポンス(Markdown)を取得
          let markdownContent = response.contents
          if (typeof markdownContent === "object" && markdownContent.value) {
            markdownContent = markdownContent.value
          }

          // カーソル位置の単語（変数名など）を取得
          const wordInfo = model.getWordAtPosition(position)
          const expression = wordInfo ? wordInfo.word : ""

          // Measure Value リンクを追加
          // 単語が取得できた場合のみリンクを生成
          let additionalContents = []
          if (expression) {
            const measureCmd = `command:typeprof.measureValue?${encodeURIComponent(JSON.stringify({
              expression: expression,
              line: position.lineNumber, // 1-based line number
              character: position.column // 1-based column
            }))}`
            additionalContents.push({ value: `[Evaluate: ${expression}](${measureCmd})` })
          }

          return {
            range: new this.monaco.Range(
              position.lineNumber, position.column,
              position.lineNumber, position.column
            ),
            contents: [
              { value: markdownContent, isTrusted: true },
              ...additionalContents.map(c => ({ value: c.value, isTrusted: true }))
            ]
          }
        } catch (e) {
          console.error("[LSP] Hover error:", e)
          return null
        }
      }
    })

    // Measure Value コマンドの登録
    // Markdownリンク "command:typeprof.measureValue?ARGS" から呼び出される
    this.monaco.editor.registerCommand("typeprof.measureValue", (accessor, ...args) => {
      try {
        let params = args[0]
        if (!params) return

        this.client.sendRequest("workspace/executeCommand", {
            command: "typeprof.measureValue",
            arguments: [params]
        }).then(result => {
             const line = params.line
             if (line) {
               this.measuredValues.set(line, result)
               
               // Inlay Hints を更新
               this.inlayHintsEmitter.fire()
               
               // イベント発火で更新されない場合のための強制リフレッシュ (Toggle)
               // Monaco EditorはInlay Hintsの更新を即座に反映しない場合があるため、
               // オプションをトグルすることで再描画を強制する
               this.editor.updateOptions({ inlayHints: { enabled: "off" } })
               setTimeout(() => {
                 this.editor.updateOptions({ inlayHints: { enabled: "on" } })
               }, 50)
             } else {
               alert(`Value: ${result}`)
             }
        })

      } catch (e) {
        console.error("[LSP] Measure Value failed:", e)
      }
    })
  }

  /**
   * 診断通知(diagnostics)の監視を開始する
   */
  startDiagnostics() {
    this.client.onNotification("textDocument/publishDiagnostics", (params) => {
      // params: { uri: string, diagnostics: Diagnostic[] }
      const markers = params.diagnostics.map(diag => {
        return {
          severity: this.mapSeverity(diag.severity),
          startLineNumber: diag.range.start.line + 1,
          startColumn: diag.range.start.character + 1,
          endLineNumber: diag.range.end.line + 1,
          endColumn: diag.range.end.character + 1,
          message: diag.message,
          source: "TypeProf"
        }
      })

      this.monaco.editor.setModelMarkers(this.model, "lsp", markers)
    })

    // カスタム構文チェック通知の受信
    this.client.onNotification("rubpad/syntaxCheck", (params) => {
      // params: { valid: boolean, diagnostics?: Diagnostic[] }
      if (params.valid) {
        this.monaco.editor.setModelMarkers(this.model, "ruby-syntax", [])
      } else {
        const markers = params.diagnostics.map(diag => {
          return {
            severity: this.monaco.MarkerSeverity.Error,
            startLineNumber: diag.range.start.line + 1,
            startColumn: diag.range.start.character + 1,
            endLineNumber: diag.range.end.line + 1,
            endColumn: diag.range.end.character + 1, // 999 扱いで行末まで
            message: diag.message,
            source: "RubySyntax"
          }
        })
        this.monaco.editor.setModelMarkers(this.model, "ruby-syntax", markers)
      }
    })
  }

  /**
   * ドキュメントの同期を開始する (Debounce付き)
   */
  syncDocument() {
    this.editor.onDidChangeModelContent((event) => {
      // 入力があるたびにタイマーをリセット
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer)
      }

      // 入力が止まってから一定時間後に実行
      this.debounceTimer = setTimeout(() => {
        const content = this.model.getValue()
        const version = this.model.getVersionId()

        // 内容が変わったら計測値をクリア
        this.measuredValues.clear()
        this.inlayHintsEmitter.fire()

        // textDocument/didChange を送信
        this.client.sendNotification("textDocument/didChange", {
          textDocument: {
            uri: "inmemory:///workspace/main.rb",
            version: version
          },
          contentChanges: [{ text: content }]
        })
      }, this.DEBOUNCE_WAIT)
    })
  }

  /**
   * LSPのSeverityをMonacoのMarkerSeverityに変換
   */
  mapSeverity(lspSeverity) {
    switch (lspSeverity) {
      case 1: return this.monaco.MarkerSeverity.Error
      case 2: return this.monaco.MarkerSeverity.Warning
      case 3: return this.monaco.MarkerSeverity.Info
      case 4: return this.monaco.MarkerSeverity.Hint
      default: return this.monaco.MarkerSeverity.Info
    }
  }
}
