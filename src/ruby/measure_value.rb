require 'stringio'

module MeasureValue
  class CapturedValue
    def self.inspect_and_add(vals, v)
      inspected = v.inspect rescue "???"
      val_to_save = (v.is_a?(Numeric) || v.is_a?(Symbol) || v.nil? || v.is_a?(TrueClass) || v.is_a?(FalseClass)) ? v : (v.dup rescue v)
      vals << [val_to_save, inspected]
    end

    def self.format_all(vals)
      return nil if vals.empty?
      results = vals.map { |v| v[1] }
      # 初期化直後のnil/空配列ノイズを除去
      if results.size > 1 && results.first.strip =~ /\A(nil|\[\s*\])\z/
        results.shift
      end
      results.join(", ")
    end
  end

  def self.sanitize_expression(expr)
    require 'ripper'
    sexp = Ripper.sexp(expr)
    return expr unless sexp && sexp[0] == :program
    body = sexp[1][0]
    return expr unless body.is_a?(Array)
    extracted = analyze_lhs(body, expr)
    extracted || expr
  rescue
    expr
  end

  def self.analyze_lhs(body, original_expr)
    case body[0]
    when :if_mod, :unless_mod
      # 後置 if/unless の場合は式の方（body[2]）を再帰的に解析して副作用を抑える
      return analyze_lhs(body[2], original_expr)
    when :assign, :massign, :opassign
      match = original_expr.match(/\A(.*?)(?:\+|-|\*|\/|%|\*\*|&|\||\^|<<|>>|&&|\|\|)?=/)
      if match
        lhs = match[1].strip
        return (body[0] == :massign) ? "[#{lhs}]" : lhs
      end
    when :binary
      return extract_node_name(body[1]) if body[2] == :<<
    when :method_add_arg, :call
      call_node = (body[0] == :method_add_arg) ? body[1] : body
      if call_node[0] == :call || call_node[0] == :method_add_arg
        method_name_node = call_node[3] || (call_node[0] == :method_add_arg ? call_node[1][3] : nil)
        method_name = method_name_node ? method_name_node[1] : nil
        destructive = ["push", "concat", "insert", "delete", "update", "replace", "clear", "shift", "unshift"]
        if method_name && (method_name.end_with?("!") || destructive.include?(method_name))
          return extract_node_name(call_node[1])
        end
      end
    end
    nil
  end

  def self.extract_node_name(node)
    return nil unless node.is_a?(Array)
    case node[0]
    when :vcall, :var_ref
      return node[1][1]
    when :@ident
      return node[1]
    end
    nil
  end

  # 対象行コードのASTを解析し、「内側のブロック（スキップすべきb_call/b_return）の数」を返す
  def self.count_inner_blocks(code_line)
    require 'ripper'
    sexp = Ripper.sexp(code_line.to_s)
    if sexp.nil?
      sexp = Ripper.sexp(code_line.to_s + "\nend")
    end
    return 0 unless sexp && sexp[1]
    walk_for_inner_blocks(sexp[1], true)
  rescue
    0
  end

  def self.walk_for_inner_blocks(nodes, is_root = false)
    return 0 unless nodes.is_a?(Array)
    nodes.sum do |node|
      next 0 unless node.is_a?(Array)
      if node[0] == :method_add_block
        if is_root
          walk_for_inner_blocks(node[1..])
        else
          1 + walk_for_inner_blocks(node[1..])
        end
      elsif node[0].is_a?(Symbol)
        walk_for_inner_blocks(node[1..], false)
      else
        0
      end
    end
  end

  def self.run(expression, target_line, user_binding, stdin_str = "", code_str = nil)
    final_result = ""
    begin
      expression = sanitize_expression(expression)
      old_verbose, $VERBOSE = $VERBOSE, nil

      vals = []
      pending_origin_depth = nil
      pending_triggered_by_b_call = false
      last_binding = nil
      method_depth = 0
      just_captured = false

      # 対象行コードを取得してAST解析
      target_line_code = (code_str || "").lines[target_line - 1]&.strip || ""
      # その行に含まれる「内側ブロック」の数 = スキップすべき b_return の数
      skip_b_returns = count_inner_blocks(target_line_code)
      # 現在のイテレーション内でスキップ済みの b_return 数
      b_return_count_in_iter = 0

      capture_and_report = proc do |binding|
        next if binding.nil?
        begin
          val = binding.eval(expression)
          CapturedValue.inspect_and_add(vals, val)
        rescue
        end
      end

      tp = TracePoint.new(:line, :call, :return, :b_call, :b_return, :end) do |tp|
        next if tp.path == "/src/measure_value.rb"

        case tp.event
        when :call, :b_call; method_depth += 1
        when :return, :b_return, :end; method_depth -= 1 if method_depth > 0
        end

        if tp.event == :line && tp.lineno == target_line
          if pending_origin_depth.nil?
            pending_origin_depth = method_depth
            pending_triggered_by_b_call = false
            b_return_count_in_iter = 0
          end
          # ブロック内変数も拾えるよう、target_line上であれば最新の binding を保持
          last_binding = tp.binding if method_depth >= pending_origin_depth
          just_captured = false
        end

        if pending_origin_depth
          # ループ（b_call開始）の場合、リセット判定のための深さ閾値を調整
          depth_threshold = pending_triggered_by_b_call ? (pending_origin_depth - 1) : pending_origin_depth
          
          if tp.event == :line && tp.lineno != target_line && method_depth <= depth_threshold
            # 対象行とそのブロックを完全に抜けた際の最終キャプチャとリセット
            unless just_captured
              capture_and_report.call(last_binding)
              just_captured = true
            end
            pending_origin_depth = nil
            b_return_count_in_iter = 0
          elsif tp.event == :b_call && tp.lineno == target_line && skip_b_returns == 0
            # ループ開始行の場合、pendingを内部深度に更新しループモードをオン
            if pending_origin_depth.nil? || method_depth > pending_origin_depth
              pending_origin_depth = method_depth
              pending_triggered_by_b_call = true
              last_binding = tp.binding
              just_captured = false
              b_return_count_in_iter = 0
            elsif method_depth == pending_origin_depth && pending_triggered_by_b_call
              # 2回目以降のイテレーション開始時（:line がスキップされた場合用）
              last_binding = tp.binding
              just_captured = false
            end
          elsif tp.event == :b_return && tp.path == "(eval)"
            if skip_b_returns == 0
              if method_depth <= pending_origin_depth
                # ループの1反復終了（または単一ブロック評価終了）
                unless just_captured
                  capture_and_report.call(last_binding)
                  just_captured = true
                end
                # ループなら pending を維持。単一式ならリセット
                pending_origin_depth = nil unless pending_triggered_by_b_call
                b_return_count_in_iter = 0
              end
            elsif b_return_count_in_iter < skip_b_returns
              b_return_count_in_iter += 1
            elsif method_depth < pending_origin_depth
              # スキップ対象ブロックを全て伴う式全体の評価完了
              unless just_captured
                capture_and_report.call(last_binding)
                just_captured = true
              end
              pending_origin_depth = nil
              b_return_count_in_iter = 0
            end
          end
        end
      end

      # 実行環境のセットアップ
      old_stdin, old_stdout = $stdin, $stdout
      $stdin = StringIO.new(stdin_str.to_s)
      $stdout = StringIO.new

      measure_binding = TOPLEVEL_BINDING.eval("binding")
      actual_code = (code_str || "nil") + "\n# end"

      begin
        tp.enable do
          measure_binding.eval(actual_code, "(eval)")
        end
      rescue RuboxStopExecution
      rescue => e
        $stderr.puts "[MEASURE ERROR] #{e.message}"
      ensure
        tp.disable if tp
        capture_and_report.call(last_binding) if pending_origin_depth && !just_captured
        $stdin, $stdout = old_stdin, old_stdout
      end

      formatted = CapturedValue.format_all(vals)
      final_result = formatted || ""
    rescue => e
      final_result = "ERROR: #{e.message}"
    ensure
      $VERBOSE = old_verbose rescue nil
    end
    final_result
  end
end
