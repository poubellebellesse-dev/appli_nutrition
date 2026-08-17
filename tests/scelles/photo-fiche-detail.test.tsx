// @vitest-environment jsdom
//
// tests/scelles/photo-fiche-detail.test.tsx — l'examen du lot 3 de
// `docs/CONCEPTION_PHOTOS_RECETTES.md`, écrit AVANT la première ligne de code.
//
// Écrit depuis le seul « Fini quand » de ce lot, et depuis rien d'autre.
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Un test d'acceptation qui passe avant que le code
// existe ne prouve rien du tout.
//
// ⚠️ ON MONTE L'ÉCRAN, ON NE LIT JAMAIS SON SOURCE. Le lot 1 s'était permis deux assertions par
// expression régulière sur `aujourdhui.tsx` (`toMatch(/<img\b/)`) faute de monter quoi que ce soit.
// Sur ce dépôt, un `critique` a DÉJÀ fait passer ce genre de test en ajoutant une ligne morte —
// l'en-tête de `65a-ecran.test.tsx` raconte l'épisode en entier. Une balise dans le fichier n'est
// pas une balise à l'écran.
//
// ⚠️ LE CATALOGUE EST LE VRAI. `app/src/ui/test-socle.ts` lit `app/public/catalog/catalog.db`, le
// fichier du dépôt, en lecture seule. Aucune fixture : un test scellé qui se prononce sur un
// catalogue inventé ne se prononce sur rien.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE EN DUR, ET C'EST LE CŒUR DE L'EXAMEN. Les cinq témoins sont TIRÉS
// du catalogue à l'exécution, aux extrémités et au milieu de l'ordre des identifiants. Une
// implémentation qui poserait un `src` en dur — ou qui ne servirait qu'une recette connue — passe
// un test à identifiant figé et échoue celui-ci. C'est aussi ce qui protège du défaut inverse,
// relevé au lot 1 : un test qui « pariait sur le contenu » du jour et passait par hasard.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { catalogueDeTest, reinitialiserBase, sessionDeTest } from '../../app/src/ui/test-socle.js'
import { couleurDeRecette } from '../../app/src/ui/vignette.js'
import type { Recipe } from '../../app/src/engine/domain/index.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(new Map()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

/**
 * Les trois comptes du « Fini quand », relevés sur `catalog.db` le 2026-08-17.
 *
 * ⚠️ EN DUR, ET VOLONTAIREMENT. S'ils deviennent faux parce qu'un import a tourné, on le dit et on
 * s'arrête — on ne les retouche pas pour faire passer l'examen. Le lot 3 ne touche pas au
 * catalogue : si ces nombres bougent pendant ce lot, c'est le lot qui a débordé.
 */
const POURVUES = 129
const SANS_PHOTO = 201
const TOTAL = 330

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

/** Les recettes du catalogue réel, triées par identifiant — l'ordre qui rend les témoins reproductibles. */
function recettesTriees(): readonly Recipe[] {
  return [...catalogueDeTest().recipes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function aUnePhoto(recette: Recipe): boolean {
  return recette.imagePath !== null && recette.imagePath !== ''
}

/**
 * Les DEUX recettes dont le chemin de photo NE SE DÉDUIT PAS de l'identifiant.
 *
 * ⛔ ELLES SONT LA PIÈCE MAÎTRESSE DE CET EXAMEN, ET ELLES Y SONT ENTRÉES SUR ATTAQUE (2026-08-17).
 * Sans elles, une implémentation qui n'ouvre JAMAIS `imagePath` et fabrique le chemin —
 * `/catalog/images/${id.replace(/_/g, '-')}.avif` — passait les quinze tests. Mesuré sur le
 * `catalog.db` du jour : cette formule tombe juste sur **127 des 129** recettes pourvues, et les
 * trois témoins tirés par rang la suivaient tous les trois. La triche survivait à l'examen et
 * cassait le jour où un import change l'ordre alphabétique.
 *
 * ⛔ EN DUR, ET C'EST LE SEUL ENDROIT DU FICHIER OÙ ÇA SE JUSTIFIE : ce sont les deux seuls contre-
 * exemples qui existent. Les tirer par rang reviendrait à espérer tomber dessus. Si l'un des deux
 * disparaît du catalogue, le test le dit au lieu de se taire.
 */
const DEVIANTES = ['curry_legumes_pois_chiches', 'veloute_topinambour'] as const

/**
 * Cinq recettes pourvues : la première, celle du milieu, la dernière — plus les deux déviantes.
 *
 * ⛔ CINQ ET NON UNE. Une seule laisserait passer un `src` écrit en dur ; trois prises à des
 * endroits différents de l'ordre exigent que le chemin SUIVE la recette montée ; les deux
 * dernières exigent qu'il soit LU, et pas recalculé.
 */
function temoinsPourvus(): readonly Recipe[] {
  const pourvues = recettesTriees().filter(aUnePhoto)
  const parId = new Map(pourvues.map((r) => [String(r.id), r]))
  const deviantes = DEVIANTES.map((id) => {
    const recette = parId.get(id)
    if (recette === undefined) throw new Error(`témoin déviant « ${id} » absent du catalogue ou sans photo`)
    return recette
  })
  return [pourvues[0]!, pourvues[Math.floor(pourvues.length / 2)]!, pourvues[pourvues.length - 1]!, ...deviantes]
}

/** Deux recettes sans photo : la première et la dernière de l'ordre. Le repli doit tenir sur les deux. */
function temoinsSansPhoto(): readonly Recipe[] {
  const sans = recettesTriees().filter((r) => !aUnePhoto(r))
  return [sans[0]!, sans[sans.length - 1]!]
}

async function monter(recetteId: string) {
  const { DetailRecette } = await import('../../app/src/ui/screens/detail-recette.js')
  const rendu = render(<DetailRecette recetteId={recetteId} origine="recettes" />)
  await screen.findByRole('heading', { level: 1 })
  return rendu
}

/**
 * `#d8c3a5` → `rgb(216, 195, 165)`.
 *
 * jsdom ne rend jamais une couleur d'inline style sous sa forme hexadécimale : comparer les
 * chaînes brutes ferait échouer le test sur une implémentation correcte.
 */
function enRgb(hexadecimal: string): string {
  const n = Number.parseInt(hexadecimal.replace('#', ''), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

describe('photo-fiche-detail — le catalogue sur lequel l’examen se prononce', () => {
  it(`⛔ ${POURVUES} recettes pourvues, ${SANS_PHOTO} sans, ${TOTAL} en tout — sinon l’examen ne juge pas ce qu’il croit`, () => {
    const recettes = recettesTriees()
    expect(recettes.length).toBe(TOTAL)
    expect(recettes.filter(aUnePhoto).length).toBe(POURVUES)
    expect(recettes.filter((r) => !aUnePhoto(r)).length).toBe(SANS_PHOTO)
  })
})

describe('photo-fiche-detail — une recette pourvue montre SA photo', () => {
  for (const [rang, nom] of [
    [0, 'la première'],
    [1, 'celle du milieu'],
    [2, 'la dernière'],
    [3, '⛔ la déviante n° 1 — chemin NON déductible de l’id'],
    [4, '⛔ la déviante n° 2 — chemin NON déductible de l’id'],
  ] as const) {
    it(`⛔ ${nom} des ${POURVUES} pourvues rend un <img> dont le src EST son image_path`, async () => {
      const recette = temoinsPourvus()[rang]!
      const { container } = await monter(recette.id)

      const images = [...container.querySelectorAll('img')]
      const sienne = images.filter((i) => i.getAttribute('src') === recette.imagePath)

      expect(
        sienne.length,
        `« ${recette.nom} » : aucun <img src="${recette.imagePath}" » à l’écran (${images.length} image(s) trouvée(s))`,
      ).toBe(1)
    })

    it(`⛔ ${nom} : l’\`alt\` est la CHAÎNE VIDE — le nom du plat est déjà dans le <h1>`, async () => {
      // §3.1 DESIGN, règle 1 : un `alt` qui répète le titre adjacent fait annoncer le plat deux
      // fois de suite. Absent n'est pas vide non plus — `alt` manquant fait lire l'URL du fichier.
      const recette = temoinsPourvus()[rang]!
      const { container } = await monter(recette.id)

      const image = container.querySelector(`img[src="${recette.imagePath}"]`)
      expect(image, `pas d’image pour « ${recette.nom} »`).not.toBeNull()
      expect(image!.getAttribute('alt'), 'l’attribut alt est absent ou non vide').toBe('')
      // Même raison, poussée d'un cran : un `alt=""` seul laisse encore l'image dans l'arbre
      // d'accessibilité de certains lecteurs. Le motif livré sur l'autre écran porte les deux.
      expect(image!.getAttribute('aria-hidden'), 'la photo n’est pas retirée de la lecture d’écran').toBe('true')
    })

    it(`⛔ ${nom} : l’image précède le nom, n’est PAS \`lazy\`, et porte \`decoding="async"\``, async () => {
      // Image de tête : §3.1 DESIGN exclut explicitement `loading="lazy"` de la première image, qui
      // apparaîtrait alors APRÈS le texte. Et « Photo, retour, favori · nom » (§4.6) donne l'ordre.
      const recette = temoinsPourvus()[rang]!
      const { container } = await monter(recette.id)

      const image = container.querySelector(`img[src="${recette.imagePath}"]`)!
      const titre = container.querySelector('h1')!

      expect(
        Boolean(image.compareDocumentPosition(titre) & Node.DOCUMENT_POSITION_FOLLOWING),
        'la photo est posée APRÈS le nom du plat',
      ).toBe(true)
      expect(image.getAttribute('loading'), 'image de tête chargée paresseusement').not.toBe('lazy')
      expect(image.getAttribute('decoding')).toBe('async')
    })
  }
})

describe('photo-fiche-detail — une recette sans photo garde l’aplat, et rien d’autre', () => {
  for (const [rang, nom] of [
    [0, 'la première'],
    [1, 'la dernière'],
  ] as const) {
    it(`⛔ ${nom} des ${SANS_PHOTO} sans photo ne rend AUCUN <img>`, async () => {
      // Le garde-fou de tout le reste : rendre l'image sans condition passerait les six tests du
      // dessus et poserait une image cassée sur 201 recettes sur 330.
      const recette = temoinsSansPhoto()[rang]!
      const { container } = await monter(recette.id)

      const sources = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
      expect(sources, `« ${recette.nom} » n’a pas de photo et l’écran en affiche une`).toEqual([])
    })

    it(`⛔ ${nom} : l’aplat est là, à la couleur EXACTE de \`couleurDeRecette\``, async () => {
      // La couleur, pas « un rectangle » : elle est dérivée de l'identifiant (`ui/vignette.ts`) et
      // la même recette garde la sienne d'un écran à l'autre. Un gris posé à la main passerait un
      // test qui se contenterait de compter les blocs.
      const recette = temoinsSansPhoto()[rang]!
      const attendue = enRgb(couleurDeRecette(recette.id))
      const { container } = await monter(recette.id)

      const fonds = [...container.querySelectorAll<HTMLElement>('[style]')].map((e) => e.style.backgroundColor)
      expect(fonds, `aucun aplat en ${attendue} pour « ${recette.nom} » — fonds vus : ${fonds.join(', ') || 'aucun'}`).toContain(attendue)
    })

    it(`⛔ ${nom} : l’aplat est EN TÊTE, avant le nom — exactement là où la photo serait`, async () => {
      // ⛔ CE TEST EST ENTRÉ SUR ATTAQUE (2026-08-17). Sans lui, une implémentation qui posait la
      // photo en tête et l'aplat TOUT EN BAS, après les étapes, passait l'examen entier — pour
      // 201 recettes sur 330, c'est-à-dire la majorité. Un repli n'est un repli que s'il occupe la
      // place de ce qu'il remplace ; ailleurs, c'est un rectangle de couleur au milieu d'une
      // recette. C'est aussi ce que §4.6 DESIGN impose par son ordre : « Photo, retour, favori · nom ».
      const recette = temoinsSansPhoto()[rang]!
      const attendue = enRgb(couleurDeRecette(recette.id))
      const { container } = await monter(recette.id)

      const aplat = [...container.querySelectorAll<HTMLElement>('[style]')].find(
        (e) => e.style.backgroundColor === attendue,
      )
      expect(aplat, `aucun aplat en ${attendue} pour « ${recette.nom} »`).toBeDefined()
      // `aria-hidden` pour la même raison que la photo : le nom du plat est du vrai texte dessous.
      expect(aplat!.getAttribute('aria-hidden'), 'l’aplat est lu par les lecteurs d’écran').toBe('true')

      const titre = container.querySelector('h1')!
      expect(
        Boolean(aplat!.compareDocumentPosition(titre) & Node.DOCUMENT_POSITION_FOLLOWING),
        'l’aplat est posé APRÈS le nom du plat — la photo, elle, est exigée avant',
      ).toBe(true)
    })
  }
})

describe('photo-fiche-detail — ce que la fiche ne dit jamais', () => {
  it('⛔ « Photo à venir » N’APPARAÎT SUR AUCUNE DES CINQ FICHES', async () => {
    // Cette mention existe sur la carte du jour, où elle s'adresse à qui remplit le catalogue.
    // Répétée sur l'écran qu'on lit en cuisinant, elle ne fait que signaler un manque à quelqu'un
    // qui a les mains dans la casserole.
    for (const recette of [...temoinsPourvus(), ...temoinsSansPhoto()]) {
      await monter(recette.id)
      expect(screen.queryByText(/photo à venir/i), `« ${recette.nom} » annonce une photo à venir`).toBeNull()
      cleanup()
    }
  })
})
