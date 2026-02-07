import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["version"]

  connect() {
    this.boundUpdateVersion = this.updateVersion.bind(this)
    window.addEventListener("ruby-vm:version-loaded", this.boundUpdateVersion)
  }

  disconnect() {
    window.removeEventListener("ruby-vm:version-loaded", this.boundUpdateVersion)
  }

  updateVersion(event) {
    if (this.hasVersionTarget && event.detail.version) {
      this.versionTarget.textContent = event.detail.version
    }
  }
}
