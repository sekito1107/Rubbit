import { test, expect } from '@playwright/test';

test.describe('Rubbit E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));
    page.on('requestfailed', req => console.log(`[Browser RequestFailed] ${req.url()} - ${req.failure().errorText}`));
    await page.goto('/');
  });

  test('Rubyコードを実行して結果を表示する', async ({ page }) => {
    // Ruby WASM の初期化を待機（ターミナルの出力を確認）
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

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
    await expect(page.locator('#terminal-output')).toContainText('Hello from WASM!', { timeout: 10000 });
  });

  test('Rubyのエラーを適切にハンドリングする', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.evaluate(() => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue('undefined_variable');
      }
    });

    await page.getByRole('button', { name: 'Run' }).click();

    await expect(page.locator('#terminal-output')).toContainText('Error:', { timeout: 10000 });
  });

  test('ターミナルの出力をクリアする', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.locator('body')).not.toContainText('Ruby WASM ready!');
  });

  test('ShareボタンでコードをURLに保存・復元できる', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const targetCode = 'puts "Share Flow Test"';
    await page.evaluate((code) => {
      const editor = window.monacoEditor;
      if (editor) {
        editor.setValue(code);
      }
    }, targetCode);

    // Shareボタンをクリック (モーダルが開く)
    await page.getByRole('button', { name: 'Share' }).click();

    // モーダルが表示されるのを待つ
    await expect(page.locator('#share-modal')).toBeVisible();

    // Copyボタンをクリック
    // クリップボード書き込みが行われる
    await page.locator('#share-copy-btn').click();

    // 通知を待機
    // モーダルが閉じるのも確認できるとなお良い
    await expect(page.locator('[data-toast="message"]')).toContainText('Copied to clipboard!', { timeout: 10000 });

    // クリップボードからの取得は環境によって難しいため、URLのハッシュを確認して遷移する
    // Copyボタン押下時に history.replaceState で URL が更新されているはず
    const urlWithHash = await page.evaluate(() => window.location.href);
    // URLハッシュが含まれていない場合、クリップボードの内容を確認する必要があるが、
    // ShareComponentの実装では window.history.replaceState も呼んでいるため URL も変わっているはず。
    // ただし、preview生成時に replaceState しているので、モーダルを開いた時点で変わっている可能性がある。
    
    // Check if hash is present
    // If not, maybe read from clipboard?
    // Let's assume replaceState logic works.
    
    // 新しいページで開く
    const newPage = await context.newPage();
    // ここで urlWithHash がハッシュ付きであることを期待
    if (!urlWithHash.includes('#')) {
        // Fallback: Read from clipboard if URL not updated (though it should be)
         const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
         await newPage.goto(clipboardText);
    } else {
         await newPage.goto(urlWithHash);
    }
    
    await expect(newPage.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    // コードが復元されているか確認
    const restoredCode = await newPage.evaluate(() => {
      const editor = window.monacoEditor;
      return editor ? editor.getValue() : "";
    });
    expect(restoredCode).toBe(targetCode);
  });

  test('ファイルをダウンロードできる', async ({ page }) => {
    // Force fallback to legacy download by removing showSaveFilePicker
    await page.evaluate(() => {
        // @ts-ignore
        window.showSaveFilePicker = undefined;
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByTitle('コードを保存').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('rubbit.rb');
    await download.path();
  });

  test('編集内容がlocalStorageに保存され永続化される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

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
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const reloadedCode = await page.evaluate(() => {
      const editor = window.monacoEditor;
      return editor ? editor.getValue() : "";
    });
    expect(reloadedCode).toBe(editedCode);
  });

  test('エディタ設定を変更して永続化される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    // 設定モーダルを開く
    await page.getByTitle('Editor Settings').click();

    // フォントサイズを変更 (14px -> 20px)
    await page.locator('[data-setting="fontSize"]').selectOption('20');
    
    // 設定が反映されるのを待つ (イベント発火待ち)
    await page.waitForTimeout(500);

    // モーダルを閉じる
    await page.getByRole('button', { name: 'Close' }).click();

    // リロード
    await page.reload();
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    // 設定モーダルを再度開く
    await page.getByTitle('Editor Settings').click();

    // フォントサイズが維持されているか確認
    const fontSize = await page.locator('[data-setting="fontSize"]').inputValue();
    expect(fontSize).toBe('20');
  });

  test('テーマを切り替えて永続化される', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.getByTitle('テーマ切り替え').click();

    const isDark = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
    
    // リロード
    await page.reload();
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    const isDarkAfter = await page.locator('html').getAttribute('class').then(c => c?.includes('dark'));
    expect(isDarkAfter).toBe(isDark);
  });

  test('サンプルコードをロードできる', async ({ page }) => {
    await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 30000 });

    await page.locator('#examples-button').click(); // Examplesボタン
    await page.locator('#examples-menu button[data-key="fizzbuzz"]').click();
    
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const editor = window.monacoEditor;
        return editor ? editor.getValue() : "";
      });
    }, { timeout: 10000 }).toContain('1.upto(100) do |i|');
  });

  test('ファイルをダウンロードできる', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    await page.getByTitle('コードを保存').click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('rubbit.rb');
    await download.path();
  });
});
