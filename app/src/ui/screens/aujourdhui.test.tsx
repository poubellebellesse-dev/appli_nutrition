// @vitest-environment jsdom
//
// ui/screens/aujourdhui.test.tsx — la carte plein écran, ses flèches et son encart d'aide.
//
// ⚠️ CE FICHIER GARDE UN DÉFAUT TROUVÉ EN PILOTANT UN NAVIGATEUR, pas en relisant. L'encart
// « Dites-moi ce que vous cherchez » s'affichait tant que `changements >= SEUIL` ; choisir une
// pastille remettait ce compteur à zéro — pour ne pas re-proposer de l'aide juste après en avoir
// donné — et l'encart DISPARAISSAIT sous le doigt, entre la première pastille et la deuxième.
//
// Le test qui suit clique une pastille et vérifie que l'encart est toujours là. C'est exactement ce
// qu'aucun test unitaire ne pouvait voir.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { writeRythme } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
}))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // Deux repas par jour : déjeuner + dîner, comme le défaut du premier lancement.
  writeRythme(baseCourante(), { repasParJour: 2, tempsSemaineMin: null, tempsWeekendMin: null })
})
afterEach(cleanup)

/** Monte l'écran et attend la première carte. */
async function monter() {
  const { Aujourdhui } = await import('./aujourdhui.js')
  render(<Aujourdhui />)
  await screen.findByText(/sur \d+$/)
}

const platAffiche = (): string => document.querySelector('article h2')!.textContent!
const compteur = (): string => screen.getByText(/^\d+ sur \d+$/).textContent!
const bouton = (texte: string | RegExp) => screen.getByText(texte).closest('button') as HTMLButtonElement

describe('aujourdhui — la carte', () => {
  it('titre l’écran d’après l’heure et le rythme, jamais « Ce soir » en dur', async () => {
    await monter()
    // Le titre vient de `TITRE_CRENEAU` ; à deux repas, c'est « Ce midi » ou « Ce soir » selon
    // l'heure de la machine. Ce qui compte est qu'il appartienne au vocabulaire, pas qu'il soit figé.
    const titre = screen.getByRole('heading', { level: 1 }).textContent
    expect(['Ce matin', 'Ce midi', 'Ce soir', 'Pour le goûter']).toContain(titre)
  })

  it('affiche un aplat de couleur et l’annonce comme un bouche-trou', async () => {
    await monter()
    const aplat = document.querySelector('article div[aria-hidden]') as HTMLElement
    expect(aplat).not.toBeNull()
    expect(aplat.style.backgroundColor).not.toBe('')
    expect(screen.getByText('Photo à venir')).toBeDefined()
  })

  it('désactive « Précédent » sur la première carte, jamais « Suivant »', async () => {
    await monter()
    expect(bouton(/Précédent/).disabled).toBe(true)
    expect(bouton(/Suivant/).disabled).toBe(false)
  })
})

describe('aujourdhui — les flèches', () => {
  it('change de plat et fait avancer le compteur', async () => {
    await monter()
    const premier = platAffiche()
    expect(compteur()).toMatch(/^1 sur /)

    fireEvent.click(bouton(/Suivant/))
    await waitFor(() => expect(compteur()).toMatch(/^2 sur /))
    expect(platAffiche()).not.toBe(premier)

    fireEvent.click(bouton(/Précédent/))
    await waitFor(() => expect(compteur()).toMatch(/^1 sur /))
    expect(platAffiche()).toBe(premier)
  })
})

describe('aujourdhui — l’encart d’aide', () => {
  it('reste fermé au départ — « détecter l’indécision PUIS proposer »', async () => {
    await monter()
    expect(screen.queryByText(/Rien n'est obligatoire/)).toBeNull()
  })

  it('s’ouvre après sept changements sans choix', async () => {
    await monter()
    for (let i = 0; i < 7; i++) fireEvent.click(bouton(/Suivant/))
    await screen.findByText(/Rien n'est obligatoire/)
    expect(screen.getByText('Plutôt léger ou consistant ?')).toBeDefined()
  })

  it('⛔ NE SE REFERME PAS quand on choisit une pastille', async () => {
    // LE DÉFAUT QUE CE TEST GARDE. Régler une envie remettait le compteur d'indécision à zéro, ce
    // qui rendait la condition d'affichage de l'encart fausse : il disparaissait entre la première
    // pastille et la deuxième.
    await monter()
    for (let i = 0; i < 7; i++) fireEvent.click(bouton(/Suivant/))
    await screen.findByText(/Rien n'est obligatoire/)

    fireEvent.click(screen.getByText('Léger'))
    await waitFor(() => expect(screen.getByText('Léger').getAttribute('aria-pressed')).toBe('true'))

    // L'encart est toujours là…
    expect(screen.queryByText(/Rien n'est obligatoire/)).not.toBeNull()
    // …et on peut en choisir une seconde, ce qui était impossible.
    fireEvent.click(screen.getByText('20 min'))
    await waitFor(() => expect(screen.getByText('20 min').getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByText('Léger').getAttribute('aria-pressed')).toBe('true')
  })

  it('ne s’ouvre PAS après un aller-retour répété entre les deux mêmes plats', async () => {
    // C'est quelqu'un qui compare deux plats, pas quelqu'un de perdu : `vues` ne grossit pas au-delà
    // des deux recettes distinctes visitées, même après beaucoup de gestes.
    await monter()
    for (let i = 0; i < 10; i++) {
      fireEvent.click(bouton(/Suivant/))
      await waitFor(() => expect(compteur()).toMatch(/^2 sur /))
      fireEvent.click(bouton(/Précédent/))
      await waitFor(() => expect(compteur()).toMatch(/^1 sur /))
    }
    expect(screen.queryByText(/^Dites-moi ce que vous cherchez$/)).not.toBeNull()
    expect(screen.queryByText(/Rien n'est obligatoire/)).toBeNull()
  })

  it('choisir un plat remet le compteur d’indécision à zéro', async () => {
    await monter()
    for (let i = 0; i < 7; i++) fireEvent.click(bouton(/Suivant/))
    await screen.findByText(/Rien n'est obligatoire/)

    fireEvent.click(bouton(/J'ai choisi ce plat/))
    await waitFor(() => expect(screen.queryByText(/Rien n'est obligatoire/)).toBeNull())

    // Sept nouveaux plats distincts après le choix redéclenchent l'encart : la remise à zéro n'est
    // pas définitive.
    for (let i = 0; i < 7; i++) fireEvent.click(bouton(/Suivant/))
    await screen.findByText(/Rien n'est obligatoire/)
  })

  it('ne propose QUE des axes que le moteur sait lire', async () => {
    // Une pastille qui ne piloterait aucune couche donnerait le sentiment d'avoir été écouté sans
    // l'être. Les trois axes sont exactement ceux de `CravingAxes`.
    await monter()
    fireEvent.click(screen.getByText('Dites-moi ce que vous cherchez'))
    await screen.findByText(/Rien n'est obligatoire/)
    const questions = [...document.querySelectorAll('legend')].map((l) => l.textContent)
    expect(questions).toEqual([
      'Combien de temps devant vous ?',
      'Plutôt léger ou consistant ?',
      'Chaud ou froid ?',
      'Salé ou sucré ?',
    ])
  })
})

describe('aujourdhui — proposer autre chose', () => {
  it('change effectivement la liste et remet la position à 0', async () => {
    await monter()

    // Toutes les recettes de la 1ère liste (pas seulement le 1er plat) : on avance jusqu'au bout.
    const premiereListe: string[] = [platAffiche()]
    let position = 1
    while (!bouton(/Suivant/).disabled) {
      fireEvent.click(bouton(/Suivant/))
      position++
      await waitFor(() => expect(compteur()).toMatch(new RegExp(`^${position} sur `)))
      premiereListe.push(platAffiche())
    }

    fireEvent.click(bouton(/Proposer autre chose/))
    await waitFor(() => expect(compteur()).toMatch(/^1 sur /))

    const secondeListe: string[] = [platAffiche()]
    position = 1
    while (!bouton(/Suivant/).disabled) {
      fireEvent.click(bouton(/Suivant/))
      position++
      await waitFor(() => expect(compteur()).toMatch(new RegExp(`^${position} sur `)))
      secondeListe.push(platAffiche())
    }

    expect(secondeListe).not.toEqual(premiereListe)
  })
})

describe('aujourdhui — les plats proches', () => {
  it('propose d’autres plats, tous différents de celui qu’on regarde', async () => {
    await monter()
    await screen.findByText('Dans le même esprit')
    const proches = [...document.querySelectorAll('section ul li a')].map((a) => a.textContent ?? '')
    expect(proches.length).toBeGreaterThan(0)
    for (const proche of proches) expect(proche).not.toContain(platAffiche())
  })
})

describe('aujourdhui — le frigo', () => {
  it('offre l’entrée « Vider le frigo », que §4.5 réclamait depuis le début, une seule fois', async () => {
    await monter()
    // ⚠️ « une seule fois » : deux liens identiques feraient douter qu'ils fassent la même chose.
    expect(screen.getAllByText(/Vider le frigo/)).toHaveLength(1)
    expect(document.querySelector('a[href="#/frigo"]')).not.toBeNull()
  })
})

describe('aujourdhui — changer de créneau', () => {
  it('propose exactement les créneaux du rythme déclaré, deux repas', async () => {
    // `beforeEach` règle déjà 2 repas/jour : déjeuner + dîner.
    await monter()
    expect(screen.getByRole('button', { name: 'Ce midi' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ce soir' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Ce matin' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pour le goûter' })).toBeNull()
  })

  it('n’affiche aucun sélecteur à un seul repas par jour', async () => {
    writeRythme(baseCourante(), { repasParJour: 1, tempsSemaineMin: null, tempsWeekendMin: null })
    await monter()
    // Un seul créneau ('diner') → rien à choisir : ni « Ce soir » ni aucun autre bouton de créneau.
    expect(screen.queryByRole('button', { name: /^Ce (matin|midi)$|^Pour le goûter$|^Ce soir$/ })).toBeNull()
  })

  it('choisir un autre créneau change les suggestions et remet la position à 1 sur N', async () => {
    await monter()
    fireEvent.click(bouton(/Suivant/))
    await waitFor(() => expect(compteur()).toMatch(/^2 sur /))

    const titreDepart = screen.getByRole('heading', { level: 1 }).textContent
    const autre = titreDepart === 'Ce midi' ? 'Ce soir' : 'Ce midi'
    const platAvant = platAffiche()

    fireEvent.click(screen.getByRole('button', { name: autre }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(autre))
    expect(compteur()).toMatch(/^1 sur /)
    expect(platAffiche()).not.toBe(platAvant)
    expect(screen.getByRole('button', { name: autre }).getAttribute('aria-pressed')).toBe('true')
  })
})
