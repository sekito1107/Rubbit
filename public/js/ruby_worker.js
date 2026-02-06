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
        
        const result = vm.eval(wrappedCode)
        postMessage({ type: "output", payload: { text: result.toString() } })
      } catch (error) {
        console.error("Ruby execution error:", error)
        postMessage({ type: "output", payload: { text: `Error: ${error.toString()}` } })
      }
}
