import { test, expect } from '@playwright/test';

test.describe('Value Capture Regression Tests (WASM)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#terminal-output')).toContainText('Ruby WASM ready!', { timeout: 90000 });
        await page.waitForSelector('.monaco-editor');
        await page.evaluate(async () => {
            for (let i = 0; i < 60; i++) {
                if (window.ruboxLSPReady) return true;
                await new Promise(r => setTimeout(r, 500));
            }
        });
    });

    test('単一行ループの最終状態がキャプチャされること', async ({ page }) => {
        const code = 'a = []; 3.times { a << [1] }';
        await setCodeAndSync(page, code);
        const result = await measureValue(page, 0, 0, 'a << [1]');
        // ユーザー様の期待通り、変遷の系列をそのまま出す（二重 inspect や副作用なし）
        expect(result).toBe('[[1]], [[1], [1]], [[1], [1], [1]]');
    });

    test('複数行ループの最終状態がキャプチャされること', async ({ page }) => {
        const code = [
            'a = []',
            '3.times do |i|',
            '  a << [i]',
            'end'
        ].join('\n');
        await setCodeAndSync(page, code);
        const result = await measureValue(page, 2, 2, 'a << [i]');
        // ユーザー様の期待値に基づき、入れ子配列の蓄積を正確に検証
        expect(result).toBe('[[0]], [[0], [1]], [[0], [1], [2]]');
    });

    test('gets による多重代入の結果がキャプチャされること', async ({ page }) => {
        const code = 'x, y = gets.split.map(&:to_i)';
        await setCodeAndSync(page, code);
        
        // STDINのシミュレーション (Workerのグローバル変数を更新)
        await page.evaluate(() => {
            const worker = window.ruboxLSPManager.client.worker;
            worker.postMessage({ 
                type: "updateStdin", 
                payload: { stdin: "10 20\n" } 
            });
        });
        await page.waitForTimeout(500); // メッセージの到達を待つ
        
        const result = await measureValue(page, 0, 0, 'x');
        // 初期状態(before)の10と、完了後(after)の10が重複して記録されないことも確認
        expect(result).toBe('10');
    });
});

async function setCodeAndSync(page, code) {
    await page.evaluate((c) => {
        window.monacoEditor.setValue(c);
        window.ruboxLSPManager.flushDocumentSync();
    }, code);
    await page.waitForTimeout(2000); // Wait for analysis
}

async function measureValue(page, line, character, expression) {
    return await page.evaluate(async ({ line, character, expression }) => {
        try {
            const params = {
                command: "typeprof.measureValue",
                arguments: [{
                    uri: window.monacoEditor.getModel().uri.toString(),
                    line, character, expression
                }]
            };
            return await window.ruboxLSPManager.client.sendRequest("workspace/executeCommand", params);
        } catch (e) {
            return "ERROR: " + e.toString();
        }
    }, { line, character, expression });
}
