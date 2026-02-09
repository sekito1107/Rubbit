/**
 * Ruby VM (Worker) へのコード送信と実行結果の購読を担当する
 */
export class Executor {
  constructor(rubyVMController) {
    this.controller = rubyVMController
  }

  /**
   * コードを実行する
   * @param {string} code 
   */
  execute(code) {
    if (!code) return
    this.controller.run(code)
  }
}
