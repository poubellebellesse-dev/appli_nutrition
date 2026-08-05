// tests/banned-terms-consistency.test.mjs
//
// Garantie de non-divergence entre les DEUX copies du lexique banni (§6.2 ARCHITECTURE) :
//   - catalog/build.mjs (source canonique, JS pur, bloquante sur le contenu édité au build)
//   - app/src/engine/guards/banned-terms.ts (copie DANS engine/, nécessaire parce que guards/ ne
//     peut PAS importer catalog/ sans violer §3 ENGINE — GUARD --> DOM uniquement, vérifié par
//     tests/engine-boundaries.test.ts)
//
// Une liste de sécurité dupliquée qui dérive en silence serait pire que pas de garde-fou du tout :
// CE TEST est la garantie réelle contre cette dérive, pas la duplication en soi. Voir l'en-tête de
// guards/banned-terms.ts pour le détail du problème de source unique.
//
// Pourquoi un fichier .mjs, et pourquoi à la racine de tests/ (pas dans app/src/engine/) :
//   1. Importer catalog/build.mjs (JS pur, sans déclaration de type) depuis un fichier .ts ferait
//      échouer `npm run typecheck` (tsconfig n'active pas allowJs — l'activer serait un changement
//      de configuration de build à signaler séparément, pas à faire en passant pour un test).
//      Un fichier .mjs n'est pas soumis à tsc (tsconfig `include` ne liste que **/*.ts), donc aucun
//      conflit : Vitest l'exécute nativement (glob par défaut **/*.{test,spec}.?(c|m)[jt]s?(x)).
//   2. Le placer dans app/src/engine/ déclencherait à tort tests/engine-boundaries.test.ts, qui
//      scanne CET ARBRE pour des imports interdits (data/, features/, ui/, react, sqlite…) — ce
//      test-ci n'a rien à voir avec cette barrière et ne doit pas la percuter.
//
// ⚠️ Pourquoi un SOUS-PROCESSUS Node plutôt qu'un `import` direct de catalog/build.mjs ici : ce
// fichier a un shebang (`#!/usr/bin/env node`) ET des fins de ligne CRLF (propriété préexistante du
// fichier, pas introduite par ce lot) — combinaison que le chemin d'exécution « transform sautée »
// de vite-node ne gère pas quand le module est chargé À TRAVERS le graphe de modules de Vite/Vitest
// (`SyntaxError: Invalid or unexpected token`, reproductible même sur un fichier réduit au seul
// shebang + fins de ligne CRLF, hors de tout rapport avec BANNED_TERMS lui-même). `node -e` lance
// un VRAI processus Node, qui charge catalog/build.mjs exactement comme `npm run build` le fait
// déjà (aucun Vite dans la boucle) — même approche que `catalog/build.test.ts`, qui invoque déjà
// ce fichier via `spawnSync` plutôt qu'un import direct, pour la même raison de fond (isoler le
// script JS pur du pipeline Vite du moteur). `catalog/build.mjs` garde de toute façon son effet de
// bord `main()` derrière une garde « exécuté comme script, pas importé » (voir son en-tête) :
// `node -e` n'a pas d'argv[1] correspondant au fichier, donc `main()` ne se déclenche pas ici non
// plus — seul BANNED_TERMS est lu.

import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BANNED_TERMS as GUARD_BANNED_TERMS,
  findBannedTerms as guardFindBannedTerms,
} from '../app/src/engine/guards/banned-terms.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')

/**
 * Exécute une expression dans catalog/build.mjs, côté vrai Node — voir l'avertissement ci-dessus sur
 * le shebang + CRLF. `expression` reçoit le module chargé sous le nom `m` et rend du JSON.
 */
function lireDepuisBuild(expression) {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import('./catalog/build.mjs').then(m => process.stdout.write(JSON.stringify(${expression})))`,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  )
  if (result.status !== 0) {
    throw new Error(`lecture depuis catalog/build.mjs échouée : ${result.stderr}`)
  }
  return JSON.parse(result.stdout)
}

const CATALOG_BANNED_TERMS = lireDepuisBuild('m.BANNED_TERMS')

// Corpus de comparaison. Chaque ligne existe pour une raison : les quatre premières sont les FUITES
// mesurées le 2026-08-05 (formes fléchies qu'aucune entrée n'attrapait), les suivantes couvrent la
// normalisation (accents, casse), le multi-mots, et de la langue de recette qui ne doit rien
// déclencher. Toute divergence entre les deux copies sur l'une d'elles est un défaut de sécurité.
const CORPUS = [
  'La guérison passe par l’assiette',
  'Ces plantes guérissent l’insomnie',
  'Il en est guéri depuis',
  'Une approche thérapeutique de l’assiette',
  'Ce plat GUERIT tout',
  'un aliment sain à privilégier',
  'Prévient la maladie cardiovasculaire',
  'à éviter en excès',
  'Rincer soigneusement les lentilles',
  'Émincer finement, cuire à feu doux',
  '',
]

describe('lexique banni — cohérence catalog/build.mjs ↔ engine/guards/banned-terms.ts (§6.2 ARCHITECTURE)', () => {
  it('les deux listes ne sont pas vides (garde-fou contre une dérive vers « les deux vides »)', () => {
    expect(CATALOG_BANNED_TERMS.length).toBeGreaterThan(0)
    expect(GUARD_BANNED_TERMS.length).toBeGreaterThan(0)
  })

  it('les deux listes contiennent exactement les mêmes termes, peu importe l’ordre', () => {
    expect([...GUARD_BANNED_TERMS].sort()).toEqual([...CATALOG_BANNED_TERMS].sort())
  })

  // ⛔ CE QUI MANQUAIT (2026-08-05). Les deux tests ci-dessus comparent les LISTES, et l'en-tête de
  // guards/banned-terms.ts affirmait que ce fichier était « la vraie garantie » contre la dérive.
  // Mais `normalize()` et `findBannedTerms()` sont dupliquées elles aussi. Si l'une des deux cessait
  // de retirer les accents, ou passait de `includes` à un autre appariement, les listes resteraient
  // identiques au caractère près et ce fichier resterait VERT — pendant que le build et le moteur
  // n'interdiraient plus la même chose.
  it('les deux implémentations rendent le même verdict sur tout le corpus', () => {
    const attendu = lireDepuisBuild(`[${CORPUS.map((t) => JSON.stringify(t)).join(',')}].map(t => m.findBannedTerms(t))`)
    for (const [i, texte] of CORPUS.entries()) {
      expect([...guardFindBannedTerms(texte)].sort(), `divergence sur « ${texte} »`).toEqual(
        [...attendu[i]].sort()
      )
    }
  })

  it('le corpus fait bien travailler la garde — sinon on comparerait deux fois « rien »', () => {
    // Sans ça, un corpus devenu inoffensif rendrait le test ci-dessus vert en comparant des listes
    // vides : la panne la plus discrète possible pour un test de non-divergence.
    const bloques = CORPUS.filter((t) => guardFindBannedTerms(t).length > 0)
    expect(bloques.length).toBeGreaterThanOrEqual(7)
  })
})
