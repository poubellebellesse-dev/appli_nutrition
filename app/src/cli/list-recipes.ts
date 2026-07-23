// cli/list-recipes.ts
//
// Mini-CLI de lecture : charge catalog.db via data/catalog-loader et affiche les recettes.
// Zéro logique moteur — juste un banc d'essai manuel pour vérifier le pont data/ (§9.2 ENGINE.md).
// Exécution : `npm run catalog:list` (tsx). Nécessite catalog.db généré (`npm run build`).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')

function main(): void {
  const catalog = loadCatalog(DEFAULT_DB_PATH)
  const recipes = [...catalog.recipes.values()].slice(0, 10)

  console.log(`${catalog.recipes.size} recette(s) dans le catalogue — ${DEFAULT_DB_PATH}\n`)

  for (const recipe of recipes) {
    const facettes = recipe.facettes.map((f) => `${f.facette}:${f.valeur}`).join(', ') || '(aucune)'
    console.log(
      `${recipe.nom} · prep ${recipe.tempsPrepMin} min / cuisson ${recipe.tempsCuissonMin} min · ` +
        `${recipe.ingredients.length} ingrédient(s) · ${facettes}`
    )
  }
}

main()
