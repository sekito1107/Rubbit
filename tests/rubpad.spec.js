import { test, expect } from '@playwright/test';

test.describe('RubPad E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Rubyコードを実行して結果を表示する', async ({ page }) => {
    // Ruby WASM の初期化を待機（ターミナルの出力を確認）
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    // エディタにコードをセット
    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue('puts "Hello from WASM!"');
      }
    });

    // Runボタンをクリック
    await page.getByRole('button', { name: 'Run' }).click();

    // 出力がターミナルに表示されることを検証
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Hello from WASM!', { timeout: 10000 });
  });

  test('Rubyのエラーを適切にハンドリングする', async ({ page }) => {
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue('undefined_variable');
      }
    });

    await page.getByRole('button', { name: 'Run' }).click();

    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Error:', { timeout: 10000 });
  });

  test('ターミナルの出力をクリアする', async ({ page }) => {
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.locator('body')).not.toContainText('Ruby WASM ready!');
  });

  test('ShareボタンでコードをURLに保存・復元できる', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const targetCode = 'puts "Share Flow Test"';
    await page.evaluate((code) => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue(code);
      }
    }, targetCode);

    // Shareボタンをクリック
    await page.getByRole('button', { name: 'Share' }).click();

    // 通知を待機
    await expect(page.locator('[data-toast-target="message"]')).toContainText('URL copied to clipboard!', { timeout: 10000 });

    // クリップボードからの取得は環境によって難しいため、URLのハッシュを確認して遷移する
    // 実際の実装では location.hash がセットされるはず
    const urlWithHash = await page.evaluate(() => window.location.href);
    expect(urlWithHash).toContain('#code=');

    // 新しいページで開く
    const newPage = await context.newPage();
    await newPage.goto(urlWithHash);
    await expect(newPage.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    // コードが復元されているか確認
    const restoredCode = await newPage.evaluate(() => {
      const editor = window.monacoEditor;
      return editor ? editor.getValue() : "";
    });
    expect(restoredCode).toBe(targetCode);

    // consume-once: URLからハッシュが消えていること
    await expect(newPage).not.toHaveURL(/#code=/);
  });

  test('編集内容がlocalStorageに保存され永続化される', async ({ page }) => {
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const editedCode = 'puts "Persistence Test"';
    await page.evaluate((code) => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue(code);
      }
    }, editedCode);

    // Debounceを待つために少し待機
    await page.waitForTimeout(2000);

    // リロード
    await page.reload();
    await expect(page.locator('[data-editor--console-target="output"]')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const reloadedCode = await page.evaluate(() => {
      const editor = window.monacoEditor;
      return editor ? editor.getValue() : "";
    });
    expect(reloadedCode).toBe(editedCode);
  });
});
