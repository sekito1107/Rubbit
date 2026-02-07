import { DefaultRubyVM } from "https://cdn.jsdelivr.net/npm/@ruby/wasm-wasi@2.8.1/dist/browser/+esm"

let vm = null

self.onmessage = async (event) => {
  const { type, payload } = event.data

  switch (type) {
    case "initialize":
      await initializeVM(payload.wasmUrl)
      break
    case "run":
      if (!vm) {
        postMessage({ type: "output", payload: { text: "// Error: Ruby VM is not ready yet." } })
        return
      }
      runCode(payload.code)
      break
    case "lsp":
       if (!vm) return
       // Ruby側の server.add_msg(json_string) メソッドを呼び出す
       // code 引数は LSPClient から渡された JSON 文字列
         // vm.call は存在しないため、グローバル変数を介してデータを渡す
         try {
           self._tmpLspMsg = payload.code
         vm.eval(`$server.add_msg(JS.global[:_tmpLspMsg].to_s)`)
         self._tmpLspMsg = null
       } catch (e) {
         console.error("LSP Error:", e)
       }
       break
  }
}

async function initializeVM(wasmUrl) {
    try {
      postMessage({ type: "output", payload: { text: "// Ruby WASM initializing..." } })
      
      const response = await fetch(wasmUrl)
    
    if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.statusText}`)
    }

    const module = await WebAssembly.compileStreaming(response)
    const result = await DefaultRubyVM(module)
    vm = result.vm

    // bootstrap.rb (Polyfills & LSP Server) をロードする
    const bootstrapResponse = await fetch("/js/bootstrap.rb")
    const bootstrapCode = await bootstrapResponse.text()

    // VFSに書き込んで読み込む
    // vm.fs (JS API) が利用できない場合があるため、Rubyの標準ライブラリを使用してファイルを作成する
    // ディレクトリを作成
    vm.eval(`Dir.mkdir("/src") unless Dir.exist?("/src")`)
    
    // bootstrap.rb の内容を書き込む
    // JSの文字列をRubyの文字列リテラルとして安全に渡すため、JSON.stringifyを使用する
    // これにより、エスケープシーケンスなどが正しく処理される
    vm.eval(`File.write("/src/bootstrap.rb", ${JSON.stringify(bootstrapCode)})`)
    
    // LSPからのレスポンスをMain Threadに転送する関数
    self.sendLspResponse = (jsonString) => {
      postMessage({ type: "lsp", payload: jsonString })
    }

    // ブートストラップスクリプトを評価する
    // これにより Server クラスが定義され、インスタンスが作成される
    // インスタンスをグローバル変数 $server にキャプチャする（または最後の式として保持する）
    vm.eval(`
      require "js"
      require_relative "/src/bootstrap"
      $server = Server.new
      # JS側の sendLspResponse 関数を渡す
      # JS.global[:sendLspResponse] は JS::Object (Function) を返す
      $server.start(JS.global[:sendLspResponse]) 
    `)
    
    // vm.call から $server にアクセスできるようにする
    // 単純にトップレベルでメソッドを定義する
    vm.eval(`
      def server
        $server
      end
    `)
    
    postMessage({ type: "output", payload: { text: "// Ruby WASM ready!" } })
    postMessage({ type: "ready", payload: { version: vm.eval("RUBY_VERSION").toString() } })
  } catch (error) {
    console.error("Worker Init Error:", error)
    postMessage({ type: "error", payload: { message: error.message } })
    postMessage({ type: "output", payload: { text: `// Error: ${error.message}` } })
  }
}

function runCode(code) {
    try {
        // 標準出力をキャプチャするためにコードをラップする
        // $server.run_code を使用して、Measure Value と同じBindingで実行する
        const wrappedCode = `
          require 'stringio'
          $stdout = StringIO.new
          begin
            $server.run_code(${JSON.stringify(code)})
          rescue => e
            puts "Error: #{e.class}: #{e.message}"
            puts e.backtrace.join("\n")
          end
          $stdout.string
        `
        
        const result = vm.eval(wrappedCode)
        postMessage({ type: "output", payload: { text: result.toString() } })
      } catch (error) {
        console.error("Ruby execution error:", error)
        postMessage({ type: "output", payload: { text: `Error: ${error.toString()}` } })
      }
}
