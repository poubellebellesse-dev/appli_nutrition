// @vitest-environment jsdom
//
// tests/scelles/65a-ecran.test.tsx — l'examen du lot E de 65a : ce que l'écran MONTRE.
//
// ⛔ SÉPARÉ DE `65a.test.ts` PARCE QUE L'ENVIRONNEMENT SE CHOISIT PAR FICHIER. Les tests du
// catalogue et du moteur tournent en Node avec `node:sqlite` ; celui-ci a besoin de `jsdom`. Les
// mélanger n'est pas possible, et ce n'est pas un découpage de confort.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT.
//
// ⚠️ CE FICHIER EXISTE PARCE QUE LA VERSION PRÉCÉDENTE NE TESTAIT RIEN. Elle vérifiait qu'un
// `import` figurait dans `cuisine.tsx`, par expression régulière sur le source. Un `critique` l'a
// fait passer en ajoutant une ligne d'import jamais appelée : l'écran continuait d'afficher
// « Four — utilisé par… » sans jamais montrer une heure. On lit donc le RENDU, pas le fichier.
//
// ⚠️ LE HARNAIS LIT LE VRAI `catalog.db` (`app/src/ui/test-socle.ts` → `app/public/catalog/`), pas
// une fixture montée à la main. C'est ce qui rend ce test recevable comme test scellé.
//
// ⚠️ LA FORMULATION EXACTE APPARTIENT AU LOT. Ce test n'impose pas « Le four est pris de 18h10 à
// 18h35 » mot pour mot : il impose qu'une PLAGE apparaisse, c'est-à-dire deux heures reliées par
// « à ». Sceller une phrase interdirait de la retoucher ; sceller la plage est le vrai critère.
//
// ---------------------------------------------------------------------------------------------
// ⚠️ CE FICHIER A ÉTÉ ROUVERT LE 2026-08-13, SUR DÉCISION DE L'AUTEUR, ET IL FAUT SAVOIR POURQUOI.
//
// Un `critique` l'a attaqué avant que le lot E soit codé. Verdict : les quatre tests vérifiaient une
// FORME, jamais un CALCUL. Trois lignes les passaient toutes —
//
//     if (plats.length > 1) afficher « Le four est pris de 18h10 à 18h35 »
//
// — sans appeler `conflitsDEquipement` une seule fois. Pire : la regex `PLAGE` n'exige même pas le
// mot « four ». Tout le lot D — les vraies fenêtres, l'axe qui remonte, les recettes distinctes —
// n'était vérifié à l'écran par rien.
//
// ⛔ ET IL Y AVAIT PLUS GRAVE, UNE CONTRADICTION FRANCHE. Le moteur rend des MINUTES AVANT LE
// SERVICE ; ces tests exigeaient une horloge, sur une base neuve dont `heure_service_ms` vaut
// `NULL`. Le garde-fou §6.2 du plan interdit de deviner une heure. Le critère était donc
// insatisfaisable autrement qu'en trichant — un test qui n'a l'air de garder quelque chose que
// parce que personne n'a essayé de le satisfaire honnêtement.
//
// Deux corrections, et deux seulement : le harnais POSE une heure de service (`HEURE_SERVICE`), et
// un test compare la plage affichée aux NOMBRES que rend le moteur. Les deux autres pistes ouvertes
// par le critique — exiger le nom de l'ustensile, exiger que deux paires de plats donnent deux
// plages différentes — ont été écartées par l'auteur comme du confort.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  baseCourante,
  catalogueDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'
import { writeHeureService } from '../../app/src/data/user-store.js'
import { conflitsDEquipement } from '../../app/src/engine/cuisine/reservation.js'
import type { Recipe, RecipeId } from '../../app/src/engine/domain/index.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(new Map()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

/**
 * L'heure à laquelle on passe à table, FIXE et posée par le harnais.
 *
 * ⚠️ SANS ELLE, CE FICHIER DEMANDAIT L'IMPOSSIBLE — c'est la correction du 2026-08-13. Le moteur
 * calcule en MINUTES AVANT LE SERVICE ; pour écrire « 18h10 » il faut une ancre. Or la base neuve
 * de `reinitialiserBase()` porte `heure_service_ms = NULL`, et le garde-fou §6.2 du plan interdit
 * d'en deviner une (« aucun horaire deviné, jamais une valeur par défaut »). Le test exigeait donc
 * une horloge que le code ne pouvait produire qu'en trichant. Le harnais pose l'heure ; l'écran la
 * lit ; personne n'invente rien.
 *
 * ⚠️ UNE DATE EN DUR, JAMAIS `Date.now()` : un test dont l'attendu bouge avec l'horloge n'est pas
 * un test.
 */
const HEURE_SERVICE = new Date(2026, 7, 13, 20, 0, 0, 0).getTime()

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  writeHeureService(baseCourante(), HEURE_SERVICE)
})
afterEach(() => {
  cleanup()
})

/** Deux heures reliées par « à » — « de 18h10 à 18h35 », « de 18 h 10 à 18 h 35 ». */
const PLAGE = /\d{1,2}\s?h\s?\d{2}\s*(?:à|–|-)\s*\d{1,2}\s?h\s?\d{2}/

/** L'ancienne formulation, celle qui NOMME sans dire quand. Elle doit avoir disparu. */
const ANCIENNE_LISTE = /utilisé par/i

/**
 * Deux plats qui se disputent VRAIMENT le four, et un plat seul.
 *
 * ⛔ CES IDS SONT EN DUR PARCE QUE LA VERSION D'AVANT NE L'ÉTAIT PAS, et c'était le défaut. Elle
 * prenait « les deux premières recettes au four par ordre d'id » — `ananas_roti_coco_citron_vert` et
 * `aubergines_farcies_quinoa_pignons`. Ces deux-là **ne se disputent rien** : leurs créneaux de four
 * ne se recouvrent pas. Le test exigeait donc une plage là où un écran honnête doit se taire, et
 * c'est très exactement la fausse alerte que ce chantier supprime — l'ancien écran affichait
 * « Four — utilisé par l'ananas et les aubergines », et il avait tort.
 *
 * MESURÉ le 2026-08-13 sur les 3 321 paires de recettes « four requis » : **2 831 en conflit
 * (85,2 %)**. La paire tirée par l'ancien helper était dans les 14,8 % qui n'en ont pas. Celle-ci
 * est la première EN CONFLIT dans l'ordre des id, fenêtre 17 → 3 min avant le service.
 *
 * ⚠️ Si le catalogue change et que cette paire cesse de se disputer le four, le test échoue en
 * disant « le moteur ne voit aucun conflit sur ces deux plats ». C'est un message juste : on le DIT
 * et on choisit une autre paire, on ne rafistole pas l'assertion.
 */
const PAIRE_EN_CONFLIT = ['ananas_roti_coco_citron_vert', 'bananes_roties_chocolat'] as readonly string[] as readonly RecipeId[]

/** Un seul plat au four — pour le test du silence. */
const PLAT_SEUL = ['ananas_roti_coco_citron_vert'] as readonly string[] as readonly RecipeId[]

/** `minutes` avant le service, rendues en heure d'horloge locale — la même que lira l'écran. */
function horloge(minutesAvantService: number): { readonly h: number; readonly mm: string } {
  const d = new Date(HEURE_SERVICE - minutesAvantService * 60_000)
  return { h: d.getHours(), mm: String(d.getMinutes()).padStart(2, '0') }
}

/**
 * Les deux heures attendues, dans cet ordre, séparées par n'importe quoi de court.
 *
 * ⚠️ ON N'IMPOSE NI L'ESPACEMENT NI LE MOT DE LIAISON — « 19h25 à 19h50 », « 19 h 25 – 19 h 50 »
 * conviennent tous. Sceller une typographie interdirait de la retoucher ; ce qui compte est que ce
 * soient CES deux heures, dans CET ordre.
 */
function plageExacte(
  debut: { readonly h: number; readonly mm: string },
  fin: { readonly h: number; readonly mm: string },
): RegExp {
  return new RegExp(`${debut.h}\\s?h\\s?${debut.mm}[^0-9]{1,20}${fin.h}\\s?h\\s?${fin.mm}`)
}

async function monter(plats: readonly RecipeId[]) {
  const { Cuisine } = await import('../../app/src/ui/screens/cuisine.js')
  const rendu = render(<Cuisine plats={plats.map((id) => ({ id, portions: null }))} />)
  await screen.findByRole('heading', { level: 1 })
  return rendu
}

describe('65a · E — l’écran donne une plage, et il se tait quand il n’a rien à dire', () => {
  it('⛔ DEUX PLATS AU FOUR — l’écran affiche une PLAGE HORAIRE', async () => {
    // Le critère du lot, lu à l'écran et pas dans le source. « Le four est pris de … à … » : un
    // fait et une plage, que la personne utilise pour s'organiser elle-même.
    await monter(PAIRE_EN_CONFLIT)
    expect(document.body.textContent ?? '').toMatch(PLAGE)
  })

  it('⛔ LA PLAGE AFFICHÉE EST CELLE QUE REND LE MOTEUR — pas une constante, pas un sens inversé', async () => {
    // ⚠️ LE SEUL TEST DE CE FICHIER QUI VÉRIFIE UN CALCUL. Les autres vérifient une FORME : qu'une
    // plage apparaisse, qu'elle disparaisse, qu'un mot ait été retiré. Un `critique` a montré que
    // trois lignes les passaient toutes — `if (plats.length > 1) afficher "de 18h10 à 18h35"` —
    // sans jamais appeler `conflitsDEquipement`. Celui-ci tue cette triche ET le formateur qui
    // intervertirait début et fin, parce qu'il compare les NOMBRES, pas le gabarit.
    //
    // ⚠️ LA CAPACITÉ EST POSÉE ICI, PAS IMPORTÉE DU CODE TESTÉ. Réutiliser l'helper de l'écran
    // ferait passer le test même si cet helper se trompait : `four` est `jamais`, donc 1 — c'est un
    // fait scellé par le lot C′, et le test le redit de sa propre autorité.
    const ids = PAIRE_EN_CONFLIT
    const catalogue = catalogueDeTest()
    const plats = ids.map((id) => catalogue.recipes.get(id)).filter((r): r is Recipe => r !== undefined)
    expect(plats).toHaveLength(2)

    const conflits = conflitsDEquipement(plats, (code) =>
      code === 'four' || code === 'micro_ondes' ? 1 : null,
    )
    expect(conflits.length, 'le moteur ne voit aucun conflit sur ces deux plats').toBeGreaterThan(0)
    const attendu = conflits[0]!

    await monter(ids)

    // Minutes AVANT le service → heure d'horloge. Le début est plus LOIN du service que la fin :
    // il tombe donc PLUS TÔT sur l'horloge. Un code qui inverserait les deux produirait les deux
    // mêmes chiffres dans l'autre ordre, et échouerait ici.
    const debut = horloge(attendu.debutAvantServiceMin)
    const fin = horloge(attendu.finAvantServiceMin)
    expect(document.body.textContent ?? '').toMatch(plageExacte(debut, fin))
  })

  it('⛔ ET L’ANCIENNE LISTE DE NOMS A DISPARU', async () => {
    // Avant ce lot, l'écran disait « Four — utilisé par colin…, gratin… » : il nommait l'ustensile
    // disputé sans jamais dire QUAND. C'est précisément ce que le chantier remplace.
    await monter(PAIRE_EN_CONFLIT)
    expect(document.body.textContent ?? '').not.toMatch(ANCIENNE_LISTE)
  })

  it('⛔ UN SEUL PLAT — AUCUNE PLAGE, l’écran se tait', async () => {
    // ⚠️ LE TEST QUI TUE LA PHRASE CODÉE EN DUR. Afficher une plage tout le temps ferait passer le
    // test précédent ; ici, il faut qu'elle disparaisse quand il n'y a rien à signaler. Un écran qui
    // parle toujours n'est plus lu — c'est le raisonnement qui a fait refuser la réservation
    // exclusive au départ, avec ses 63 % de fausses alertes.
    await monter(PLAT_SEUL)
    expect(document.body.textContent ?? '').not.toMatch(PLAGE)
  })

  it('⛔ AUCUN JETON DE COULEUR D’ALERTE AJOUTÉ — principe 6, informer sans juger', async () => {
    // ⚠️ CE TEST PASSE DÉJÀ AUJOURD'HUI, et il faut le lire comme tel : ce n'est pas un critère
    // d'acceptation, c'est un garde-fou. Il ne prouve rien maintenant ; il servira le jour où
    // quelqu'un voudra poser un badge rouge sur un repas que la personne a CHOISI de faire.
    const { container } = await monter(PAIRE_EN_CONFLIT)
    const rouges = container.querySelectorAll('[class*="alerte-"]')
    expect(rouges).toHaveLength(0)
  })
})
