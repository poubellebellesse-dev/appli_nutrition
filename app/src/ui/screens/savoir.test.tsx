// @vitest-environment jsdom
//
// ui/screens/savoir.test.tsx — le lexique des gestes illustré (docs/CONCEPTION_GESTES_ILLUSTRES.md
// §5, lot geste 3 — variante D de la décision D6).
//
// ⚠️ CE FICHIER EXISTE POUR EMPÊCHER LE DÉFAUT SIGNATURE DU PROJET DE SE REFERMER : « un champ
// déclaré n'est pas un champ branché », déjà payé trois fois, dont une sur `Recipe.imagePath`
// lui-même — importé, stocké, chargé jusqu'au `Catalog`, et lu par aucun écran pendant des jours.
// Le lot geste 1 a déclaré `LexiconEntry.clips` ; sans ce fichier, rien ne prouverait qu'un chemin de
// clip atteint réellement un attribut du DOM.
//
// ⚠️ LES VALEURS ASSERTÉES VIENNENT DU CATALOGUE DU DÉPÔT, jamais d'une fixture : `catalogueDeTest()`
// lit `app/public/catalog/catalog.db`. Un geste illustré y est un fait, pas une invention du test.
//
// ⛔ AUCUN GESTE N'EST DÉSIGNÉ PAR SON NOM NI PAR « LE PREMIER DE LA LISTE ». Piège déjà payé le
// 2026-08-13 : un test qui pilote vers `lexique[0]` passe au vert le jour où le tri change, et
// surtout il n'exerce pas forcément le cas qu'il prétend couvrir. On CHERCHE ici un geste à
// plusieurs segments dans le catalogue, et le test se déclare non pertinent s'il n'y en a aucun.
//
// ⚠️ TERRAIN NON BALISÉ, NOMMÉ COMME TEL DANS LE BRIEF : rien dans ce dépôt ne documentait `<video>`
// sous jsdom, où `HTMLMediaElement.play()` n'est pas implémenté. C'est pour ça que le composant
// avale l'échec de `play()` — et pour ça que ce test vérifie la SOURCE affichée, jamais qu'une
// lecture a démarré. Vérifier la lecture testerait jsdom, pas le produit.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { catalogueDeTest, confianceDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'
import type { LexiconEntry } from '../../engine/domain/index.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

const lexique = () => [...catalogueDeTest().lexicon.values()]

/** Un geste à PLUSIEURS segments — cherché, jamais nommé en dur. */
const aPlusieursSegments = (): LexiconEntry | undefined => lexique().find((e) => e.clips.length > 1)
/** Un geste sans aucun clip — il doit se déplier exactement comme avant le chantier. */
const sansClip = (): LexiconEntry | undefined => lexique().find((e) => e.clips.length === 0)

/**
 * ⚠️ `ProvenanceLancerParcours` EST IMPORTÉ DYNAMIQUEMENT ICI, PAS EN TÊTE DE FICHIER — même motif
 * que `aujourdhui.test.tsx` et `courses.test.tsx` : `beforeEach` appelle `vi.resetModules()`, et un
 * provider importé statiquement viendrait d'une AUTRE instance du module que celle que l'écran
 * consomme dans son `<LienTutoriel>`. `useLancerParcours()` lèverait malgré un provider bel et bien
 * monté au-dessus, avec un message qui accuse le montage plutôt que le cache de modules.
 */
async function monter() {
  const { Savoir } = await import('./savoir.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  const resultat = render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Savoir />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Gestes de cuisine')
  return resultat
}

/** Ouvre l'accordéon d'un geste par son terme, et rend le `<li>` qui le porte. */
async function deplier(terme: string): Promise<HTMLElement> {
  const bouton = await screen.findByRole('button', { name: new RegExp(terme, 'i') })
  const rang = bouton.closest('li')
  expect(rang, `le geste « ${terme} » n’est pas dans un rang de liste`).not.toBeNull()
  // ⚠️ `fireEvent.click`, JAMAIS `element.click()` : le second dispatche bien l'événement mais laisse
  // React vider sa file plus tard, si bien qu'une assertion lue juste après voit l'état d'AVANT le
  // clic. Attrapé ici même — le test du changement de segment lisait le premier segment et
  // accusait la bande de ne rien faire. `fireEvent` enveloppe dans `act()` et flush.
  fireEvent.click(bouton)
  return rang as HTMLElement
}

describe('Savoir — le lexique porte ses clips jusqu’au DOM', () => {
  it('la ligne repliée porte une vignette pour un geste illustré, et un carré vide sinon', async () => {
    const illustre = aPlusieursSegments()
    const nu = sansClip()
    if (!illustre || !nu) return

    await monter()

    // La vignette est le poster du PREMIER segment — pas un chemin fabriqué à partir du code.
    const rangIllustre = (await screen.findByRole('button', { name: new RegExp(illustre.terme, 'i') })).closest('li')!
    const vignette = rangIllustre.querySelector('img')
    expect(vignette, `« ${illustre.code} » est illustré mais son rang ne porte aucune vignette`).not.toBeNull()
    expect(vignette!.getAttribute('src')).toBe(illustre.clips[0]!.posterPath)

    // ⛔ La vignette ne doit PAS être une cible cliquable distincte : tout le rang ouvre le panneau.
    expect(vignette!.closest('button'), 'la vignette vit hors du bouton du rang').not.toBeNull()
    expect(within(rangIllustre).queryAllByRole('button')).toHaveLength(1)

    // Un geste sans clip garde un carré vide, sinon les termes ne s'alignent plus d'un rang à l'autre.
    const rangNu = (await screen.findByRole('button', { name: new RegExp(nu.terme, 'i') })).closest('li')!
    expect(rangNu.querySelector('img'), `« ${nu.code} » n’a aucun clip mais porte une vignette`).toBeNull()
  })

  it('déplié, un geste illustré montre ses DEUX sources vidéo — muet, sans contrôles ni téléchargement', async () => {
    const illustre = aPlusieursSegments()
    if (!illustre) return

    await monter()
    const rang = await deplier(illustre.terme)

    const video = rang.querySelector('video')
    expect(video, `« ${illustre.code} » déplié ne monte aucun élément vidéo`).not.toBeNull()

    const premier = illustre.clips[0]!
    expect(video!.getAttribute('poster')).toBe(premier.posterPath)

    // ⛔ LES DEUX FORMATS, DANS CET ORDRE (décision D2). Un H.264 absent laisse un iPhone un peu
    // ancien devant une image fixe, sans que l'utilisateur sache qu'il manque quelque chose.
    const sources = [...video!.querySelectorAll('source')].map((s) => s.getAttribute('src'))
    expect(sources).toEqual([premier.av1Path, premier.h264Path])

    // ⛔ CONTREPARTIE EXPLICITE DE LA DÉCISION 69 : aucun bouton pour ressortir le média.
    expect(video!.hasAttribute('muted') || video!.muted, 'le clip n’est pas muet').toBe(true)
    expect(video!.hasAttribute('controls'), 'des contrôles natifs sont exposés').toBe(false)
    expect(video!.getAttribute('controlsList')).toBe('nodownload')
    // Pas de lecture automatique : le poster tient lieu d'aperçu jusqu'au clic.
    expect(video!.hasAttribute('autoplay'), 'le clip démarre tout seul').toBe(false)
  })

  it('cliquer une vignette de la bande CHANGE le segment joué, sans replier le panneau', async () => {
    const illustre = aPlusieursSegments()
    if (!illustre) return

    await monter()
    const rang = await deplier(illustre.terme)

    // La bande porte un bouton par segment, en plus du cadre et du rang lui-même.
    const bande = within(rang).getAllByRole('button')
    expect(bande.length, 'la bande de moments est absente').toBeGreaterThanOrEqual(illustre.clips.length)

    const second = illustre.clips[1]!
    const cible = bande.find((b) => b.textContent?.trim() !== '' && b.querySelector(`img[src="${second.posterPath}"]`))
    expect(cible, `aucun bouton de bande ne porte le poster du 2e segment de « ${illustre.code} »`).toBeDefined()

    fireEvent.click(cible!)

    // C'est ICI que la variante D se distingue de toutes les autres : le cadre suit la bande.
    const apres = rang.querySelector('video')
    expect(apres, 'le panneau s’est replié au clic sur la bande').not.toBeNull()
    expect(apres!.getAttribute('poster')).toBe(second.posterPath)
    expect([...apres!.querySelectorAll('source')].map((s) => s.getAttribute('src'))).toEqual([
      second.av1Path,
      second.h264Path,
    ])
  })

  it('un geste SANS média se déplie comme avant : sa définition, et rien de plus', async () => {
    const nu = sansClip()
    if (!nu) return

    await monter()
    const rang = await deplier(nu.terme)

    expect(within(rang).getByText(nu.definition.trim())).toBeTruthy()
    expect(rang.querySelector('video'), `« ${nu.code} » n’a aucun clip mais monte une vidéo`).toBeNull()
    // Ni cadre, ni bande, ni trou : le rang ne garde que son propre bouton.
    expect(within(rang).getAllByRole('button')).toHaveLength(1)
  })
})
