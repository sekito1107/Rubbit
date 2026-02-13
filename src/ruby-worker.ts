import { DefaultRubyVM } from "@ruby/wasm-wasi/dist/browser";

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
      if (!vm) {
        postMessage({ type: "output", payload: { text: "// Error: Ruby VM is not ready yet." } });
        return;
      }
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

    try {
      postMessage({ type: "progress", payload: { percent: 30, message: "Compiling Ruby WASM..." } });
      const module = await WebAssembly.compile(buffer);
      
      const result = await DefaultRubyVM(module);
      vm = result.vm;

      // RBS標準ライブラリの取得と配置
      try {
        const rbsResponse = await fetch('/rbs/ruby-stdlib.rbs');
        if (rbsResponse.ok) {
          const rbsBuffer = await rbsResponse.arrayBuffer();
          const bytes = new Uint8Array(rbsBuffer);
          const CHUNK_SIZE = 64 * 1024; // 64KB 単位で分割

          vm.eval(`Dir.mkdir('/workspace') unless Dir.exist?('/workspace')`);

          for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunk = bytes.slice(i, i + CHUNK_SIZE);
            const hexChunk = Array.from(chunk)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');

            const mode = (i === 0) ? 'wb' : 'ab';
            vm.eval(`File.open('/workspace/stdlib.rbs', '${mode}') { |f| f.write(['${hexChunk}'].pack('H*')) }`);
          }
        }
      } catch (e) {
      }

    } catch (e: any) {
      throw e;
    }

    // bootstrap.rb (Polyfills & LSP Server) をロードする
    postMessage({ type: "progress", payload: { percent: 50, message: "Loading Bootstrap..." } });
    
    // Note: bootstrap.rb は public/js に置かれている想定
    const bootstrapUrl = new URL("/ruby/bootstrap.rb", self.location.origin);
    const bootstrapResponse = await fetch(bootstrapUrl);
    const bootstrapCode = await bootstrapResponse.text();

    // VFSに書き込んで読み込む
    vm.eval(`Dir.mkdir("/src") unless Dir.exist?("/src")`);
    
    // bootstrap.rb の内容を書き込む (Base64経由)
    const bootstrapB64 = btoa(unescape(encodeURIComponent(bootstrapCode)));
    vm.eval(`File.write("/src/bootstrap.rb", "${bootstrapB64}".unpack1("m"))`);
    
    // LSPからのレスポンスをMain Threadに転送する関数
    (self as any).sendLspResponse = (jsonString: string) => {
      postMessage({ type: "lsp", payload: jsonString });
    };

    // ブートストラップスクリプトを評価する
    vm.eval(`
      require "js"
      require_relative "/src/bootstrap"
      $server = Server.new
      $server.start(JS.global[:sendLspResponse]) 
    `);
    
    vm.eval(`
      def server
        $server
      end
    `);

    postMessage({ type: "ready", payload: { version: vm.eval("RUBY_VERSION").toString() } });
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
