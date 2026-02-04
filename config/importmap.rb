# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# CodeMirror 6 & Dependencies
pin "codemirror", to: "https://ga.jspm.io/npm:codemirror@6.0.1/dist/index.js"
pin "@codemirror/autocomplete", to: "https://ga.jspm.io/npm:@codemirror/autocomplete@6.12.0/dist/index.js"
pin "@codemirror/commands", to: "https://ga.jspm.io/npm:@codemirror/commands@6.3.3/dist/index.js"
pin "@codemirror/lang-ruby", to: "https://ga.jspm.io/npm:@codemirror/lang-ruby@6.2.0/dist/index.js"
pin "@codemirror/language", to: "https://ga.jspm.io/npm:@codemirror/language@6.10.0/dist/index.js"
pin "@codemirror/lint", to: "https://ga.jspm.io/npm:@codemirror/lint@6.4.2/dist/index.js"
pin "@codemirror/search", to: "https://ga.jspm.io/npm:@codemirror/search@6.5.5/dist/index.js"
pin "@codemirror/state", to: "https://ga.jspm.io/npm:@codemirror/state@6.4.0/dist/index.js"
pin "@codemirror/theme-one-dark", to: "https://ga.jspm.io/npm:@codemirror/theme-one-dark@6.1.2/dist/index.js"
pin "@codemirror/view", to: "https://ga.jspm.io/npm:@codemirror/view@6.23.0/dist/index.js"

# CodeMirror Dependencies
pin "@lezer/common", to: "https://ga.jspm.io/npm:@lezer/common@1.2.1/dist/index.js"
pin "@lezer/highlight", to: "https://ga.jspm.io/npm:@lezer/highlight@1.2.0/dist/index.js"
pin "@lezer/lr", to: "https://ga.jspm.io/npm:@lezer/lr@1.4.0/dist/index.js"
pin "@lezer/ruby", to: "https://ga.jspm.io/npm:@lezer/ruby@0.2.0/dist/index.js"
pin "crelt", to: "https://ga.jspm.io/npm:crelt@1.0.6/index.js"
pin "style-mod", to: "https://ga.jspm.io/npm:style-mod@4.1.0/src/style-mod.js"
pin "w3c-keyname", to: "https://ga.jspm.io/npm:w3c-keyname@2.2.8/index.js"
