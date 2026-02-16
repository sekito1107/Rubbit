#!/bin/sh
set -e

# wasm-build ディレクトリに移動
cd "$(dirname "$0")"

# 環境変数の設定とgemをローカルにインストール
export PATH="$HOME/.local/share/gem/ruby/3.1.0/bin:$PATH"
bundle config set --local path 'vendor/bundle'
RB_SYS_STABLE_API_COMPILED_FALLBACK=true bundle install

# gem を含めて WASM モジュールをビルド
# -o rubbit.wasm で出力ファイル名を指定
bundle exec rbwasm build -o rubbit.wasm --ruby-version 4.0

# 標準ライブラリの RBS バンドルを生成
echo "Generating RBS bundle..."
cd ..
bash scripts/bundle_rbs.sh
cd wasm-build

# アーティファクトを public ディレクトリに配置
echo "Deploying artifacts..."
mkdir -p ../public/ruby
mv rubbit.wasm ../public/ruby/

echo "Build complete: public/ruby/rubbit.wasm and public/rbs/ruby-stdlib.rbs are updated."
