// @vitest-environment jsdom
//
// ui/screens/courses.test.tsx — l'écran « Mes courses » (§4.3 DESIGN, §7.4 ENGINE).
//
// ⚠️ CET ÉCRAN N'EXISTE QUE PARCE QU'UN PLAN DE SEMAINE EXISTE. `calculerVue` lit `readLatestPlan` et
// s'arrête net (`phase: 'sans_plan'`) s'il n'y en a aucun — donc chaque test qui veut voir une vraie
// liste doit d'abord EN CONSTRUIRE UN, par le moteur (`planWeek` + `planLeftovers`), comme le fait
// réellement `semaine.tsx`. Un objet `WeekPlan` inventé à la main contournerait exactement ce que ces
// tests doivent vérifier : que la liste dérive du VRAI plan.
//
// ⚠️ LA LISTE SE REDÉRIVE, LE COCHAGE NON (voir l'en-tête de `courses.tsx`). C'est le seul état que
// `user.db` porte vraiment ici, avec les articles ajoutés à la main — les tests qui comptent vont
// donc jusqu'à la base, pas seulement jusqu'à `aria-pressed`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readShoppingList, savePlan } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'
import { hashDe } from '../router.js'

vi.mock('../catalog-source.js', () => ({ chargerCatalogue: () => Promise.resolve(catalogueDeTest()) }))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

/**
 * Construit un VRAI plan de semaine — via le moteur, pas un objet inventé — et l'enregistre.
 * Sept jours, deux repas, un convive : de quoi laisser `buildShoppingList` produire une liste non
 * triviale et `planLeftovers` placer des restes comme `semaine.tsx` le fait réellement.
 */
async function avecUnPlan() {
  const { chargerSocle, aujourdhuiIso, profilCourant } = await import('../socle.js')
  const socle = await chargerSocle()
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const brut = socle.moteur.planWeek({
    profile: profil,
    constraints: { allergies: [], diet: null, excludedFoodIds: [] },
    startDate: date,
    days: 7,
    slots: ['dejeuner', 'diner'],
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    convives: 1,
    seed: 1,
  })
  const plan = socle.moteur.planLeftovers(brut, profil, 1)
  savePlan(socle.db, plan, date)
  return { socle, plan }
}

/** Monte l'écran et attend qu'il ait quitté la phase `chargement`. Rend le composant, pour pouvoir
 * remonter l'écran (nouveau `render`) sans changer d'import — c'est CE remontage qui prouve qu'un
 * état survit en base et pas seulement dans la mémoire React du premier montage. */
async function monter() {
  const { Courses } = await import('./courses.js')
  render(<Courses />)
  await screen.findByRole('heading', { name: 'Mes courses' })
  return Courses
}

/** Ouvre le formulaire, ajoute un article et attend qu'il s'affiche. */
async function ajouterArticle(libelle: string): Promise<void> {
  fireEvent.click(screen.getByText('Ajouter un article'))
  fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
    target: { value: libelle },
  })
  fireEvent.click(screen.getByText('Ajouter'))
  await screen.findByText(new RegExp(libelle))
}

/**
 * Les boutons de bascule des lignes de courses.
 *
 * ⚠️ `article button[aria-pressed]`, PAS `ul li button` (piège #3 du patron) : les trois boutons
 * « Ranger par » ont EUX AUSSI `aria-pressed`, et un simple `ul li button` attraperait aussi les
 * croix de suppression des extras. Scoper à `article` exclut le fieldset de rangement ; exiger
 * `aria-pressed` exclut les boutons « Retirer ».
 */
function lignesAffichees(): string[] {
  return [...document.querySelectorAll('article button[aria-pressed]')].map((b) => b.textContent ?? '')
}

describe('courses — sans plan', () => {
  it("dit pourquoi la liste est vide et propose de composer sa semaine, pas un cadre muet", async () => {
    await monter()
    expect(screen.getByText(/La liste se construit à partir de votre semaine/)).toBeDefined()
    const lien = screen.getByText('Composer ma semaine').closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe(hashDe('semaine'))
    // Aucun compteur : rien à afficher tant qu'il n'y a rien à acheter.
    expect(screen.queryByText(/cochés$/)).toBeNull()
  })
})

describe('courses — cocher un article', () => {
  it('coche un article : persiste en base et survit à un remontage de l’écran', async () => {
    const { socle, plan } = await avecUnPlan()
    const liste = socle.moteur.buildShoppingList(plan)
    const item = liste.items[0]!
    const nom = socle.catalogue.foods.get(item.foodId)!.nom

    const Courses = await monter()
    const ligne = screen.getByText(nom).closest('button') as HTMLButtonElement
    expect(ligne.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(ligne)
    await waitFor(() => expect(ligne.getAttribute('aria-pressed')).toBe('true'))
    await waitFor(() => {
      const enregistree = readShoppingList(baseCourante())!
      expect(enregistree.coches.has(item.foodId)).toBe(true)
    })

    // La chaîne complète : un nouveau montage doit retrouver la case cochée DEPUIS LA BASE, pas
    // depuis un état React qui aurait juste survécu par accident.
    cleanup()
    render(<Courses />)
    await screen.findByRole('heading', { name: 'Mes courses' })
    const ligneApres = screen.getByText(nom).closest('button') as HTMLButtonElement
    expect(ligneApres.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('courses — le regroupement', () => {
  it('changer de rangement réorganise, sans faire disparaître un seul article', async () => {
    // Le défaut classique : une catégorie non prévue par `grouper`, et la ligne s'évapore. On
    // compare l'ensemble des articles DISTINCTS affichés, avant/après changement de rangement.
    await avecUnPlan()
    await monter()

    const parRayon = [...new Set(lignesAffichees())].sort()
    expect(parRayon.length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('Jour'))
    await waitFor(() => expect([...new Set(lignesAffichees())].sort()).toEqual(parRayon))

    fireEvent.click(screen.getByText('Repas'))
    await waitFor(() => expect([...new Set(lignesAffichees())].sort()).toEqual(parRayon))
  })
})

describe('courses — les articles ajoutés à la main', () => {
  it('ajoute un article, le persiste, et il reste là après un remontage', async () => {
    await avecUnPlan()
    const Courses = await monter()

    await ajouterArticle('Lessive')
    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras.map((e) => e.libelle)).toEqual(['Lessive'])
    })

    cleanup()
    render(<Courses />)
    await screen.findByRole('heading', { name: 'Mes courses' })
    expect(screen.getByText(/Lessive/)).toBeDefined()
  })

  it('retire un article ajouté : la base et l’écran s’accordent', async () => {
    await avecUnPlan()
    await monter()
    await ajouterArticle('Croquettes')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Croquettes' }))
    await waitFor(() => expect(screen.queryByText(/Croquettes/)).toBeNull())
    expect(readShoppingList(baseCourante())!.extras).toEqual([])
  })

  it("« Que cuisiner avec ? » n'apparaît qu'à partir de DEUX articles ajoutés", async () => {
    // Invite discrète et tardive (§4.3) : un seul ajout ne doit pas déclencher la relance, sous
    // peine de harceler quelqu'un qui vient juste de noter sa lessive. Seuil exact = piège classique.
    await avecUnPlan()
    await monter()
    expect(screen.queryByText('Que cuisiner avec ?')).toBeNull()

    await ajouterArticle('Lessive')
    expect(screen.queryByText('Que cuisiner avec ?')).toBeNull()

    await ajouterArticle('Croquettes')
    await waitFor(() => expect(screen.getByText('Que cuisiner avec ?')).toBeDefined())
  })
})

describe('courses — le compteur', () => {
  it("reflète exactement ce qui est affiché, pas un total calculé à part", async () => {
    await avecUnPlan()
    await monter()

    const total = new Set(lignesAffichees()).size
    expect(total).toBeGreaterThan(0)
    expect(screen.getByText(new RegExp(`^0 sur ${total} cochés$`))).toBeDefined()

    fireEvent.click(document.querySelector('article button[aria-pressed]') as HTMLButtonElement)
    await waitFor(() => expect(screen.getByText(new RegExp(`^1 sur ${total} cochés$`))).toBeDefined())
  })
})

describe('courses — partager', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('le texte partagé contient les articles NON cochés, jamais ceux déjà cochés', async () => {
    // `navigator.share` n'existe pas sous jsdom, `navigator.clipboard` non plus : on ne stubbe QUE
    // `clipboard.writeText`, le repli que le code utilise déjà — pas la moitié du navigateur.
    const { socle, plan } = await avecUnPlan()
    const ecrire = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })

    await monter()
    const liste = socle.moteur.buildShoppingList(plan)
    const coche = liste.items[0]!
    const nonCoche = liste.items[1]!
    const nomCoche = socle.catalogue.foods.get(coche.foodId)!.nom
    const nomNonCoche = socle.catalogue.foods.get(nonCoche.foodId)!.nom

    fireEvent.click(screen.getByText(nomCoche).closest('button')!)
    await waitFor(() =>
      expect(screen.getByText(nomCoche).closest('button')!.getAttribute('aria-pressed')).toBe('true')
    )

    fireEvent.click(screen.getByText('Partager'))
    await waitFor(() => expect(ecrire).toHaveBeenCalledTimes(1))
    const texte = ecrire.mock.calls[0]![0] as string
    expect(texte).not.toContain(`- ${nomCoche} :`)
    expect(texte).toContain(`- ${nomNonCoche} :`)

    await screen.findByText('Copié')
  })
})

describe('courses — les restes de la veille', () => {
  it('ne les liste pas ici : elle renvoie vers Semaine, sous « Reste du plat de la veille »', async () => {
    // Un reste ne se rachète JAMAIS (`shopping-list.ts` écarte `isLeftover`) : cet écran ne peut
    // qu'indiquer où ils sont, pas les montrer lui-même sans les faire acheter en double.
    await avecUnPlan()
    await monter()
    const lien = screen.getByText('visible dans votre semaine').closest('a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe(hashDe('semaine'))
    expect(screen.getByText(/Reste du plat de la veille/)).toBeDefined()
  })
})
