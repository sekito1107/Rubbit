# Rubbit (Static Site version)

Rubbit is a client-side Ruby playground using Ruby WASM, Stimulus, and Vite.

## Features

- **Ruby WASM**: Run Ruby code directly in your browser without a backend.
- **Vite + Stimulus**: Modern, fast frontend build system and lightweight JS framework.
- **Tailwind CSS**: Utility-first CSS for a clean, responsive UI.
- **Monaco Editor**: Professional editing experience.
- **Share**: Sync and share your code via URL (compressed with pako).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Testing

Run E2E tests with Playwright:

```bash
npx playwright test
```

### Build

Build the production site into `dist/`:

```bash
npm run build
```

The content of `dist/` can be deployed to any static site hosting (GitHub Pages, Vercel, etc.).

## Architecture

- `src/main.js`: Entry point and Stimulus controller registration.
- `src/controllers/`: Stimulus controllers for UI logic.
- `src/utils/`: Shared utilities and interactors.
- `public/`: Static assets including Ruby WASM binaries.
- `index.html`: Main application layout.
