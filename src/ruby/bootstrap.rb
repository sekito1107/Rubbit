require "js"
require "rubygems"

# 自前ファイルを相対パスで読み込む（環境パッチを最優先）
require_relative "env"

# 外部ライブラリ
require "typeprof"
require "typeprof/lsp"

# 自前ファイル
require_relative "workspace"
require_relative "measure_value"
require_relative "server"

# TypeProfコアの初期化
rbs_path = "/rbs/ruby-stdlib.rbs"
if File.exist?(rbs_path)
  puts "[Bootstrap] Found RBS: #{rbs_path} (#{File.size(rbs_path)} bytes)"
  rbs_list = [rbs_path]
else
  puts "[Bootstrap] RBS NOT FOUND: #{rbs_path}"
  rbs_list = []
end

begin
  core = TypeProf::Core::Service.new(rbs_files: rbs_list)
rescue => e
  puts "[Bootstrap] TypeProf Initialization Error: #{e.class}: #{e.message}"
  puts e.backtrace
  core = TypeProf::Core::Service.new(rbs_files: []) # Fallback
end

# ウォームアップ
begin
  iseq_klass = defined?(TypeProf::Core::ISeq) ? TypeProf::Core::ISeq : (defined?(TypeProf::ISeq) ? TypeProf::ISeq : nil)
  if iseq_klass
    iseq_klass.compile("Array.new; 'str'.upcase; {a: 1}.keys").each { |iseq| core.add_iseq(iseq) }
  end
rescue
end

$server = Server.new(core)
$server.start
