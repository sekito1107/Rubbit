namespace :rurema do
  desc "メソッド名とクラスの対応表JSONを生成する"
  task build: :environment do
    require "json"

    # 対象とする主要なクラス・モジュール
    # 必要に応じて追加してください
    target_classes = [
      BasicObject, Object, Kernel,
      Module, Class,
      String, Integer, Float, Numeric, Symbol,
      Array, Hash, Enumerable,
      Time, Date, DateTime,
      Regexp, Range,
      File, Dir, IO,
      Thread, Fiber,
      Math, JSON, YAML
    ].uniq

    # インデックスデータの格納用ハッシュ
    # { "method_name" => ["Class#method", "Module#method", ...] }
    index = Hash.new { |h, k| h[k] = [] }

    target_classes.each do |klass|
      class_name = klass.name
      next unless class_name # 無名クラスはスキップ

      # インスタンスメソッド
      klass.instance_methods(false).each do |method|
        index[method.to_s] << "#{class_name}##{method}"
      end

      # クラスメソッド（特異メソッド）
      klass.singleton_methods(false).each do |method|
        index[method.to_s] << "#{class_name}.#{method}"
      end
    end

    # 出力先ディレクトリの作成
    output_dir = Rails.public_path.join("data")
    FileUtils.mkdir_p(output_dir)

    # JSON ファイルへの書き出し
    output_path = output_dir.join("rurema_index.json")
    File.write(output_path, JSON.pretty_generate(index))

    puts "るりまインデックスを生成しました: #{output_path}"
    puts "総メソッド数: #{index.size}"
  end
end
