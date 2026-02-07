/**
 * JSON-RPCを介してRuby Workerと通信するLSPクライアント
 */
export class LSPClient {
    constructor(worker) {
      this.worker = worker
      this.requestId = 0
      this.pendingRequests = new Map()
      this.notificationHandlers = {}
      
      // Workerからのメッセージを監視する
      this.worker.addEventListener("message", this.handleMessage.bind(this))
    }
  
    /**
     * LSPサーバーにリクエストを送り、レスポンスを待機する
     * @param {string} method - LSPメソッド名（例: "initialize"）
     * @param {object} params - リクエストパラメータ
     * @returns {Promise<any>} レスポンス結果
     */
    sendRequest(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = this.requestId++
        
        // レスポンスが到着したときに呼び出されるPromiseのリゾルバを保存する
        this.pendingRequests.set(id, { resolve, reject })
  
        this.worker.postMessage({
          type: "lsp",
          payload: {
            code: JSON.stringify({
              jsonrpc: "2.0",
              id: id,
              method: method,
              params: params
            })
          }
        })
      })
    }
  
    /**
     * 通知を送信する（レスポンスを待機しない）
     * @param {string} method 
     * @param {object} params 
     */
    sendNotification(method, params = {}) {
      this.worker.postMessage({
        type: "lsp",
        payload: {
          code: JSON.stringify({
            jsonrpc: "2.0",
            method: method,
            params: params
          })
        }
      })
    }
  
    /**
     * 受信した通知に対するコールバックを登録する
     * @param {string} method - 通知メソッド名
     * @param {Function} callback - コールバック関数 (paramsを受け取る)
     */
    onNotification(method, callback) {
      // 後方互換性: 引数が1つの場合はすべての通知を受け取る (今回は使用しない想定だが念のため)
      if (typeof method === 'function') {
        callback = method
        method = '*'
      }
      
      if (!this.notificationHandlers[method]) {
        this.notificationHandlers[method] = []
      }
      this.notificationHandlers[method].push(callback)
    }
  
    handleMessage(event) {
      const { type, payload } = event.data
      if (type !== "lsp") return
  
      try {
        const message = JSON.parse(payload) // ペイロードは文字列化されたJSON-RPC
        
        // リクエストへのレスポンス
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)
          this.pendingRequests.delete(message.id)
          
          if (message.error) {
            reject(message.error)
          } else {
            resolve(message.result)
          }
        } 
        // サーバーからの通知またはリクエスト
        else {
          const method = message.method
          const params = message.params
          
          // 特定のメソッドに対するハンドラを実行
          if (this.notificationHandlers[method]) {
            this.notificationHandlers[method].forEach(handler => handler(params))
          }
          
          // 全通知ハンドラを実行 ('*' キー)
          if (this.notificationHandlers['*']) {
            this.notificationHandlers['*'].forEach(handler => handler(params))
          }
        }
      } catch (e) {
        console.error("LSPメッセージのパースに失敗しました", e)
      }
    }
  }
