// tests/engine-version-consistency.test.mjs
//
// `ENGINE_VERSION` (app/src/engine/api/index.ts) est une CONSTANTE ÉCRITE À LA MAIN, et elle doit le
// rester : §3 ENGINE interdit à `engine/` toute I/O et toute dépendance externe, donc lire
// `package.json` depuis là est structurellement exclu — ce n'est pas une facilité qu'on aurait
// négligée, c'est la contrainte d'architecture.
//
// ⚠️ CE QUI RESTAIT NON GARANTI, ET QUI ÉTAIT LA DETTE : rien n'empêchait la constante de diverger
// de `package.json`. Une version de moteur fausse ne casse rien et ne rougit nulle part — elle
// MENT, dans `engineVersion` (rendu avec chaque résultat du moteur) et dans `version` de la
// description publique. Le genre de défaut qui ne se découvre qu'en lisant un rapport de bug où le
// numéro ne correspond à rien.
//
// Même motif que `banned-terms-consistency.test.mjs` : deux copies d'une même vérité que la
// structure interdit de fusionner, donc un test qui les compare. Et même choix de `.mjs` à la
// racine de `tests/` — le placer dans `app/src/engine/` déclencherait à tort
// `tests/engine-boundaries.test.ts`, qui scanne cet arbre pour des imports interdits.
//
// ⚠️ ON LIT LE FICHIER, ON NE L'IMPORTE PAS. `engine/api/index.ts` tire toute la chaîne du moteur ;
// une lecture de texte suffit ici et garde le test insensible à ce que le module fait à l'import.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_MOTEUR = path.join(RACINE, 'app', 'src', 'engine', 'api', 'index.ts')

function versionDuMoteur() {
  const source = readFileSync(SOURCE_MOTEUR, 'utf8')
  const trouve = /^const ENGINE_VERSION = '([^']+)'/m.exec(source)
  if (trouve === null) {
    throw new Error(
      `ENGINE_VERSION introuvable dans ${SOURCE_MOTEUR}. Si la constante a été renommée ou déplacée, ` +
        'ce test doit suivre — ne pas le supprimer : il est la seule garantie de non-divergence.'
    )
  }
  return trouve[1]
}

describe('ENGINE_VERSION ne diverge pas de package.json', () => {
  it('porte exactement la version du dépôt', () => {
    const paquet = JSON.parse(readFileSync(path.join(RACINE, 'package.json'), 'utf8'))
    expect(versionDuMoteur()).toBe(paquet.version)
  })

  // Garde-fou du garde-fou : si l'extraction échouait en silence (constante renommée, guillemets
  // changés), le test précédent comparerait `undefined` à `undefined` sur certains refactors et
  // resterait vert. On exige donc une forme de version reconnaissable.
  it('extrait bien une version, et pas une chaîne vide', () => {
    expect(versionDuMoteur()).toMatch(/^\d+\.\d+\.\d+/)
  })
})
