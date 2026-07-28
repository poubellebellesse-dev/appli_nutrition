// vite.config.ts — configuration de la PWA (docs/ARCHITECTURE.md §3).
//
// ⚠️ `root` pointe sur `app/`, pas sur la racine du dépôt. Le dépôt contient aussi `catalog/`
// (scripts de build Node) et `tests/` (Vitest), qui ne doivent JAMAIS entrer dans le bundle
// navigateur — l'un importe `node:sqlite`, l'autre `node:child_process`.
//
// ⚠️ `optimizeDeps.exclude` sur sqlite-wasm : le paquet charge son binaire `.wasm` et un worker à
// l'exécution. Le pré-bundler de Vite casse ces chemins relatifs, et l'erreur ne se voit qu'au
// runtime, dans le navigateur.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'app',
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  server: {
    // Requis par SQLite WASM sur OPFS : sans isolation cross-origin, `SharedArrayBuffer` est
    // indisponible et le VFS OPFS refuse de démarrer.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: { outDir: '../dist', emptyOutDir: true },
})
