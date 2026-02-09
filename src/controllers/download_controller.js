import { Controller } from "@hotwired/stimulus"
import { Exporter } from "runtime/exporter"

export default class extends Controller {
  connect() {
    this.editor = null
    this.exporter = null
    this.boundHandleEditorInit = (e) => {
      this.editor = e.detail.editor
      this.exporter = new Exporter(this.editor)
    }
    document.addEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  disconnect() {
    document.removeEventListener("editor--main:initialized", this.boundHandleEditorInit)
  }

  download() {
    if (this.exporter) {
      this.exporter.export("rubpad.rb")
    }
  }
}
