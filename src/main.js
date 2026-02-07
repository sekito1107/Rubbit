import "./main.css"
import { Application } from "@hotwired/stimulus"

const application = Application.start()

// Configure Stimulus development experience
application.debug = false
window.Stimulus   = application

// Load controllers via Vite's import.meta.glob
const controllers = import.meta.glob('./controllers/**/*_controller.js', { eager: true })

Object.entries(controllers).forEach(([path, module]) => {
  // Extract controller name from path
  // e.g., "./controllers/hello_controller.js" -> "hello"
  // e.g., "./controllers/nested/deep_controller.js" -> "nested--deep"
  const match = path.match(/^\.\/controllers\/(.*)_controller\.js$/)
  if (match) {
    const name = match[1].replace(/\//g, "--").replace(/_/g, "-")
    application.register(name, module.default)
  }
})

export { application }
