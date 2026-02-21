// ヘッダーコンポーネント
// header/index.ts
import { RubyVM } from "./ruby-vm";

export class HeaderComponent {
  private versionElement: HTMLElement | null;

  // versionElement: バージョンを表示する要素
  // vm: RubyVM の準備完了とバージョン取得に使用
  constructor(versionElement: HTMLElement | null, vm: RubyVM) {
    this.versionElement = versionElement;

    vm.readyPromise.then(() => {
      this.updateVersion(vm.rubyVersion);
    });
  }

  public updateVersion(version: string): void {
    if (this.versionElement) {
      this.versionElement.textContent = `Ruby ${version}`;
    }
  }
}
