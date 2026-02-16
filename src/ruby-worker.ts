import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser";
import bootstrapCode from "./ruby/bootstrap.rb?raw";
import envCode from "./ruby/env.rb?raw";
import workspaceCode from "./ruby/workspace.rb?raw";
import measureValueCode from "./ruby/measure_value.rb?raw";
import serverCode from "./ruby/server.rb?raw";

let vm: any = null;

/**
 * Worker メッセージハンドラ
 */
self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case "initialize":
      await initializeVM(payload.wasmUrl);
      break;
    case "run":
      if (!vm) return;
      runCode(payload.code);
      break;
    case "lsp":
      if (!vm) return;
      try {
        (self as any)._tmpLspMsg = payload.code;
        vm.eval(`$server.add_msg(JS.global[:_tmpLspMsg].to_s)`);
        (self as any)._tmpLspMsg = null;
      } catch (e: any) {
        postMessage({ type: "output", payload: { text: `// LSP Error: ${e.message}` } });
      }
      break;
  }
};

/**
 * Ruby VM の初期化
 */
async function initializeVM(wasmUrl: string) {
  try {
    postMessage({ type: "progress", payload: { percent: 10, message: "Starting Ruby Worker..." } });

    const fullUrl = new URL(wasmUrl, self.location.origin);
    const response = await fetch(fullUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText} (URL: ${fullUrl})`);
    }

    const buffer = await response.arrayBuffer();

    postMessage({ type: "progress", payload: { percent: 30, message: "Compiling Ruby WASM..." } });
    const module = await WebAssembly.compile(buffer);
    
    const result = await DefaultRubyVM(module);
    vm = result.vm;


    // bootstrap.rb (Polyfills & LSP Server) をロードする
    postMessage({ type: "progress", payload: { percent: 45, message: "Initializing VM..." } });
    
    // 1. VFSのディレクトリ作成
    vm.eval("require 'js'");
    vm.eval("begin; Dir.mkdir('/src'); rescue; end");
    vm.eval("begin; Dir.mkdir('/workspace'); rescue; end");

    // 2. RBS標準ライブラリのロード (bootstrap前に書き込む)
    postMessage({ type: "progress", payload: { percent: 55, message: "Loading RBS Stdlib..." } });
    const rbsUrl = new URL("/rbs/ruby-stdlib.rbs", self.location.origin);
    const rbsResponse = await fetch(rbsUrl);
    if (rbsResponse.ok) {
        const rbsText = await rbsResponse.text();
        try {
            vm.eval(`File.write("/workspace/stdlib.rbs", "")`);
            const chunkSize = 50 * 1024;
            for (let i = 0; i < rbsText.length; i += chunkSize) {
                const chunk = rbsText.substring(i, i + chunkSize);
                const b64 = btoa(unescape(encodeURIComponent(chunk)));
                vm.eval(`File.open("/workspace/stdlib.rbs", "ab") { |f| f.write("${b64}".unpack1("m")) }`);
            }
            // postMessage({ type: "output", payload: { text: `// RBS loaded: ${rbsText.length} bytes` } });
        } catch (e: any) {
            postMessage({ type: "output", payload: { text: `// RBS load failed: ${e.message}` } });
        }
    }

    // 3. スクリプトファイルの書き込み
    const writeRubyFile = (path: string, code: string) => {
      try {
        const b64 = btoa(unescape(encodeURIComponent(code)));
        vm.eval(`File.write("${path}", "${b64}".unpack1("m"))`);
      } catch (e: any) {
        postMessage({ type: "output", payload: { text: `// writeRubyFile Failed (${path}): ${e.message}` } });
        throw e;
      }
    };

    writeRubyFile("/src/bootstrap.rb", bootstrapCode);
    writeRubyFile("/src/env.rb", envCode);
    writeRubyFile("/src/workspace.rb", workspaceCode);
    writeRubyFile("/src/measure_value.rb", measureValueCode);
    writeRubyFile("/src/server.rb", serverCode);

    // 4. ブートストラップスクリプトを評価する
    postMessage({ type: "progress", payload: { percent: 85, message: "Starting LSP Server..." } });
    (self as any).sendLspResponse = (jsonString: string) => {
      postMessage({ type: "lsp", payload: jsonString });
    };

    vm.eval(`
      require "js"
      require_relative "/src/bootstrap"
    `);
    
    vm.eval(`
      def server
        $server
      end
    `);

    postMessage({ type: "ready", payload: { version: vm.eval("RUBY_VERSION").toString() } });
    postMessage({ type: "progress", payload: { percent: 100, message: "Ready!" } });
  } catch (error: any) {
    postMessage({ type: "error", payload: { message: error.message } });
    postMessage({ type: "output", payload: { text: `// Error: ${error.message}` } });
  }
}

/**
 * コードを実行する
 */
function runCode(code: string) {
  try {
    (self as any)._tmpCode = code;
    const wrappedCode = `
      require 'stringio'
      $stdout = StringIO.new
      begin
        $server.run_code(JS.global[:_tmpCode].to_s)
      rescue => e
        puts "Error: #{e.class}: #{e.message}"
        puts e.backtrace.join("\\n")
      end
      $stdout.string
    `;
    
    const result = vm.eval(wrappedCode);
    (self as any)._tmpCode = null;
    postMessage({ type: "output", payload: { text: result.toString() } });
  } catch (error: any) {
    (self as any)._tmpCode = null;
    postMessage({ type: "output", payload: { text: `Error: ${error.toString()}` } });
  }
}
