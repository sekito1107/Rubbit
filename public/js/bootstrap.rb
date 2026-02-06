# "io/console" と "socket" の読み込みをスキップする
# (これらは ruby.wasm 上の TypeProf では使用されないため)
$LOADED_FEATURES << "io/console.so" << "socket.so"

# File.readable? は bjorn3/browser_wasi_shim では動作しないため代用
def File.readable?(...) = File.file?(...)

# ワークスペースのセットアップ
Dir.mkdir("/workspace")
File.write("/workspace/typeprof.conf.json", <<JSON)
{
  "typeprof_version": "experimental",
  "rbs_dir": ".",
  "analysis_unit_dirs": ["."],
}
JSON

# 初期化エラーを防ぐためのプレースホルダーファイル
File.write("/workspace/test.rb", "")
File.write("/workspace/test.rbs", "")

require "typeprof"

class Server
  def initialize
    @read_msg = nil
    @error = nil
  end

  def setup
    @core = TypeProf::Core::Service.new({})
    nil
  end

  def start(post_message)
    @post_message = post_message
    @fiber = Fiber.new do
      # TypeProf LSPサーバーを開始
      # self を reader と writer の両方として渡す
      TypeProf::LSP::Server.new(@core, self, self, url_schema: "inmemory:", publish_all_diagnostics: true).run
    end
    @fiber.resume
  end

  def add_msg(msg)
    @read_msg = JSON.parse(msg.to_s, symbolize_names: true)
    @fiber.resume
    if @error
      error, @error = @error, nil
      raise error
    end
  end

  def read
    while true
      # メッセージが届くまで実行をJSに戻す（Yield）
      Fiber.yield until @read_msg
      
      begin
        yield @read_msg
      rescue => e
        @error = e
      ensure
        @read_msg = nil
      end
    end
  end

  def write(**json)
    json = JSON.generate(json.merge(jsonrpc: "2.0"))
    @post_message.apply(json)
  end
end

Server.new
