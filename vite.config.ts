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
    // ⚠️ CES EN-TÊTES NE SONT PLUS REQUISES (2026-07-30). Elles avaient été posées pour le VFS OPFS
    // de SQLite, qui exige `SharedArrayBuffer`. Ce VFS s'est révélé inutilisable ici : les deux VFS
    // OPFS de sqlite-wasm ne fonctionnent QUE dans un Worker dédié, et `ui/user-source.ts` persiste
    // désormais `user.db` comme un simple fichier OPFS — aucune isolation cross-origin nécessaire.
    // Conservées telles quelles pour ne pas toucher à la configuration de build en passant ; à
    // retirer, parce que `require-corp` bloquera toute ressource cross-origin sans en-tête CORP le
    // jour où l'application en chargera une.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: { outDir: '../dist', emptyOutDir: true },
})
