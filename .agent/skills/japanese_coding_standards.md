---
name: japanese_coding_standards
description: コードコメントは日本語、UIメッセージは英語を徹底するためのスキル。
---

# 日本語コーディング規約 & UIルール

このスキルは、コードコメントと言語表示に関する厳格なルールを定義します。
すべてのコード修正において、以下のルールを遵守してください。

## 1. コメント (Comments)
- **すべての** コードコメントは **日本語** で記述してください。
- 対象箇所:
  - ファイルヘッダー
  - クラス/メソッドのドキュメント
  - インラインコメント
  - テストコード内のコメント

**正しい例 (Correct):**
```ruby
# ユーザーを作成する
def create_user(name)
  # バリデーションを実行
  validate(name)
end
```

## 2. ユーザーインターフェース (UIメッセージ)
- **すべての** ユーザー向けテキスト（画面表示）は **英語** で記述してください。
- 対象箇所:
  - ボタンラベル (Run, Clear, Share)
  - ステータスメッセージ ("Ruby WASM ready!", "Error: ...")
  - プレースホルダー、ツールチップ

**正しい例 (Correct):**
```javascript
this.updateOutput("// Ruby WASM ready!")
```

## 3. テストコード (Test Code)
- テストコード内の **コメント** および **テストの記述 (`it "..."`)** は **日本語** で記述してください。
- UIの文字列を検証する **Expectations**（期待値）は、英語のUIに合わせて **英語** で記述してください。

**正しい例 (Correct):**
```ruby
it "Rubyコードを実行する" do
  # Runボタンをクリック
  click_button "Run"
  
  # 出力を検証 (英語メッセージ)
  expect(page).to have_content("Hello")
end
```
