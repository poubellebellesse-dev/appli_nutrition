// ui/contraste.test.ts — le « même contrôle de contraste » que §1 DESIGN annonce sans l'avoir.
//
// `DESIGN.md` écrit : « Toute teinte ajoutée devra passer le même contrôle de contraste ». La phrase
// existait, le contrôle non. Ce fichier LIT `theme.css` et recalcule les rapports WCAG 2.1 des deux
// thèmes — il ne relit pas les chiffres écrits en commentaire, il les vérifie.
//
// ⛔ CE QUI L'A MOTIVÉ, mesuré le 2026-08-05 : `--color-attenue` en mode SOMBRE annonçait
// « 7,3:1 — même exigence qu'en clair » et valait 6,79:1 sur le fond, 6,27:1 sur les cartes. Les
// cinq jetons du mode clair, eux, étaient exacts au centième. Le clair avait été audité (les trois
// écarts aux maquettes, §1 DESIGN), le sombre jamais — et rien ne pouvait le dire, un commentaire
// n'échouant pas.
//
// ⚠️ ON TESTE LE FICHIER SOURCE, PAS UNE COPIE DES COULEURS. Redéclarer les hex ici ferait
// exactement ce que ce test existe pour empêcher : deux vérités, dont une périmée.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const THEME = readFileSync(path.join(process.cwd(), 'app/src/ui/theme.css'), 'utf8')

/** Seuil AAA pour du texte de taille normale — l'exigence que le bloc commun impose au projet. */
const AAA = 7

/**
 * Seuil du bouton principal. `blanc sur accent-plein` vaut 5,43:1 en clair et 4,55:1 en sombre :
 * c'est un ÉCART ASSUMÉ ET ÉCRIT (§1 DESIGN, « écart 3 ») — les maquettes étaient à 3,95:1, sous AA,
 * et `#a3542f` est déjà le relèvement. Le faire échouer ici rouvrirait une décision tranchée ; le
 * taire laisserait le bouton dériver sans garde-fou. On le tient donc à AA.
 */
const AA = 4.5

type Jetons = ReadonlyMap<string, string>

/** Les `--color-x: #hex` d'un bloc de CSS. */
function jetonsDe(bloc: string): Jetons {
  const table = new Map<string, string>()
  for (const m of bloc.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) table.set(m[1]!, m[2]!)
  return table
}

const coupe = THEME.indexOf('prefers-color-scheme: dark')
const CLAIR = jetonsDe(THEME.slice(0, coupe))
const SOMBRE = jetonsDe(THEME.slice(coupe))

/** Luminance relative sRGB — WCAG 2.1, définition officielle. */
function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, v, b] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ]
  return 0.2126 * r + 0.7152 * v + 0.0722 * b
}

function rapport(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (haut + 0.05) / (bas + 0.05)
}

/** Ce qui se pose sur quoi. Le texte courant se lit sur le FOND comme sur la SURFACE (cartes) :
 *  les deux comptent, et le test retient la pire des deux — c'est elle que quelqu'un subira. */
const TEXTES_COURANTS: readonly (readonly [string, readonly string[]])[] = [
  ['texte', ['fond', 'surface']],
  ['texte-doux', ['fond', 'surface']],
  ['attenue', ['fond', 'surface']],
  ['accent-texte', ['fond', 'surface']],
  ['alerte-texte', ['alerte-fond']],
]

function verifier(nom: string, jetons: Jetons) {
  describe(`ui/theme.css — contraste, mode ${nom}`, () => {
    it('les jetons attendus existent — un thème incomplet ne doit pas passer par un test vide', () => {
      for (const [avant, fonds] of TEXTES_COURANTS) {
        expect(jetons.get(avant), `--color-${avant} absent du mode ${nom}`).toBeDefined()
        for (const fond of fonds) expect(jetons.get(fond), `--color-${fond} absent`).toBeDefined()
      }
      expect(jetons.get('accent-plein')).toBeDefined()
    })

    for (const [avant, fonds] of TEXTES_COURANTS) {
      for (const fond of fonds) {
        it(`${avant} sur ${fond} atteint ${AAA}:1`, () => {
          const r = rapport(jetons.get(avant)!, jetons.get(fond)!)
          expect(Number(r.toFixed(2)), `${avant} sur ${fond} : ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AAA)
        })
      }
    }

    it(`blanc sur accent-plein atteint au moins ${AA}:1 — écart 3, assumé et écrit`, () => {
      const r = rapport('#ffffff', jetons.get('accent-plein')!)
      expect(Number(r.toFixed(2)), `bouton principal : ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    })
  })
}

verifier('clair', CLAIR)
verifier('sombre', SOMBRE)

describe('ui/theme.css — non-régression de la mesure elle-même', () => {
  it('le calcul rend les valeurs de référence WCAG : 21:1 en noir sur blanc, 1:1 à couleur égale', () => {
    // Sans ça, une erreur dans `luminance` rendrait tous les tests ci-dessus verts pour rien.
    expect(rapport('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(rapport('#7b452f', '#7b452f')).toBeCloseTo(1, 5)
  })

  it('les deux thèmes sont bien lus séparément — sinon on mesurerait deux fois le même', () => {
    expect(CLAIR.get('fond')).not.toBe(SOMBRE.get('fond'))
  })
})
