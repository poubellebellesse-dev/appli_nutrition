// app/src/cli/diag-couverture.ts — `npm run engine:couverture`. Que manque-t-il au catalogue ?
//
// Le critère n'est pas « combien de recettes » mais « un plan de 14 jours (fenêtre maximale §7.1)
// peut-il être rempli sans répétition, pour chaque régime que l'utilisateur peut choisir ». Un
// créneau × régime sous 14 recettes produit mécaniquement des trous.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'
import { DIET_CHAIN } from '../engine/selection/index.js'
import type { DietCode, MealSlot } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const catalog = loadCatalog(path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db'))

const SLOTS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']
const CIBLE = 14 // fenêtre maximale de §7.1

/** Régimes qu'un utilisateur peut demander, du plus restrictif au plus permissif. */
const REGIMES = DIET_CHAIN

/** Un régime demandé accepte les recettes de son rang ET des rangs inférieurs (§6.3 ter). */
function accepte(recipeDiet: string, demande: DietCode): boolean {
  const rangDemande = REGIMES.indexOf(demande)
  const rangRecette = REGIMES.indexOf(recipeDiet as DietCode)
  return rangRecette >= 0 && rangDemande >= 0 && rangRecette <= rangDemande
}

const dietOf = (id: string) =>
  catalog.recipes.get(id as never)?.facettes.find((f) => f.facette === 'regime')?.valeur ?? '?'

console.log(`Recettes disponibles par créneau × régime — cible : ${CIBLE} (fenêtre max de §7.1)\n`)
console.log('créneau            ' + REGIMES.map((d) => d.slice(0, 11).padStart(12)).join(''))

const manques: [MealSlot, DietCode, number][] = []
for (const slot of SLOTS) {
  const ligne: string[] = []
  for (const regime of REGIMES) {
    const n = [...catalog.recipes.values()].filter(
      (r) => r.typesRepas.includes(slot) && accepte(dietOf(r.id), regime)
    ).length
    ligne.push((n >= CIBLE ? `${n}` : `${n} ⚠`).padStart(12))
    if (n < CIBLE) manques.push([slot, regime, CIBLE - n])
  }
  console.log(slot.padEnd(19) + ligne.join(''))
}

console.log('\nCe qu’il manque pour qu’un plan de 14 jours soit remplissable partout :')
if (manques.length === 0) console.log('   (rien)')
const parSlot = new Map<MealSlot, number>()
for (const [slot, , manque] of manques) parSlot.set(slot, Math.max(parSlot.get(slot) ?? 0, manque))
for (const [slot, regime, manque] of manques) {
  console.log(`   ${slot.padEnd(16)} ${regime.padEnd(13)} manque ${manque}`)
}

console.log('\nEn nombre de recettes À ÉCRIRE (le plus restrictif couvre les autres) :')
for (const [slot, manque] of parSlot) {
  console.log(`   ${slot.padEnd(16)} ${manque} recette(s) végétalienne(s) — elles comptent aussi pour tous les autres régimes`)
}

// Le rôle compte aussi : un créneau principal a besoin de PLATS, pas seulement d'entrées.
console.log('\nPlats (service = plat) par créneau principal :')
for (const slot of ['dejeuner', 'diner'] as const) {
  for (const regime of REGIMES) {
    const n = [...catalog.recipes.values()].filter(
      (r) => r.typesRepas.includes(slot) && r.service === 'plat' && accepte(dietOf(r.id), regime)
    ).length
    if (n < CIBLE) console.log(`   ⚠ ${slot} × ${regime} : ${n} plats (cible ${CIBLE})`)
  }
}
