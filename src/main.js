import "./main.css"
import { Application } from "@hotwired/stimulus"

const application = Application.start()

// Stimulus の開発体験を向上させる設定
application.debug = false
window.Stimulus   = application

// Vite の import.meta.glob を使用してコントローラーをロード
const controllers = import.meta.glob('./controllers/**/*_controller.js', { eager: true })

Object.entries(controllers).forEach(([path, module]) => {
  // パスからコントローラー名を抽出
  // 例: "./controllers/hello_controller.js" -> "hello"
  // 例: "./controllers/nested/deep_controller.js" -> "nested--deep"
  const match = path.match(/^\.\/controllers\/(.*)_controller\.js$/)
  if (match) {
    const name = match[1].replace(/\//g, "--").replace(/_/g, "-")
    application.register(name, module.default)
  }
})

export { application }
