require 'stringio'

module MeasureValue
  class CapturedValue
    def self.inspect_and_add(vals, v)
      inspected = v.inspect rescue "???"
      # 重複排除
      return if !vals.empty? && vals.last[1] == inspected
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
      results.uniq.join(", ")
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

  def self.run(expression, target_line, user_binding, stdin_str = "", code_str = nil)
    final_result = ""
    begin
      expression = sanitize_expression(expression)
      old_verbose, $VERBOSE = $VERBOSE, nil
      
      vals = []
      target_triggered = false
      target_line_depth = 0
      last_line_binding = nil
      method_depth = 0

      capture_and_report = proc do |binding|
        next if binding.nil?
        begin
          val = binding.eval(expression)
          CapturedValue.inspect_and_add(vals, val)
        rescue
          # キャプチャ失敗は無視
        end
      end

      tp = TracePoint.new(:line, :call, :return, :b_call, :b_return, :end) do |tp|
        next if tp.path == "/src/measure_value.rb"
        
        case tp.event
        when :call, :b_call; method_depth += 1
        when :return, :b_return, :end; method_depth -= 1 if method_depth > 0
        end

        if tp.event == :line && tp.lineno == target_line
          # 再入時に前回分を確定 (同じか浅い深度の場合)
          if target_triggered && method_depth <= target_line_depth
            capture_and_report.call(last_line_binding)
            target_triggered = false
          end
          
          # ターゲット捕捉（新規、または1行内でのより深い呼び出しを優先）
          if !target_triggered || method_depth >= target_line_depth
            target_triggered = true
            target_line_depth = method_depth
            last_line_binding = tp.binding
          end
        elsif target_triggered
          # 離脱の検知
          is_inter_line_departure = (tp.event == :line && tp.lineno != target_line && method_depth <= target_line_depth)
          is_scope_departure = (method_depth < target_line_depth)
          
          if is_inter_line_departure
            capture_and_report.call(last_line_binding)
            target_triggered = false # 完全に別の行へ移った
          elsif is_scope_departure
            # 内部スコープから戻った（例: 1行内ブロックの終了）
            # ここまでの結果を記録しつつ、ターゲット行自体の続きに備えて triggered は維持し、深度を下げる
            capture_and_report.call(last_line_binding)
            target_line_depth = method_depth
            last_line_binding = tp.binding
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
      rescue
        # 実行時エラーもキャプチャ結果の一部として許容
      ensure
        tp.disable if tp
        capture_and_report.call(last_line_binding) if target_triggered
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
