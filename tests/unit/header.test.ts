import { describe, it, expect, beforeEach } from 'vitest';
import { HeaderComponent } from '../../src/header';

describe('HeaderComponent', () => {
  let versionElement: HTMLElement;
  let mockVM: any;

  beforeEach(() => {
    document.body.innerHTML = '<span id="ruby-version"></span>';
    versionElement = document.getElementById('ruby-version') as HTMLElement;
    
    // RubyVM のモックを作成
    mockVM = {
      readyPromise: Promise.resolve(),
      rubyVersion: '4.0.0'
    };
  });

  it('readyPromise 解決時にバージョンを更新すること', async () => {
    // 解決後の値をセット
    mockVM.rubyVersion = '4.0.0';
    let resolveReady: () => void;
    mockVM.readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    new HeaderComponent(versionElement, mockVM as any);
    
    // まだ更新されていない
    expect(versionElement.textContent).toBe('');

    // Promise を解決
    resolveReady!();
    await mockVM.readyPromise;
    
    // 非同期のマイクロタスク完了を待つ
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(versionElement.textContent).toBe('Ruby 4.0.0');
  });

  it('要素が存在しない場合でもエラーにならないこと', async () => {
    new HeaderComponent(null, mockVM as any);
    await mockVM.readyPromise;
    expect(true).toBe(true); // 到達すればOK
  });
});
