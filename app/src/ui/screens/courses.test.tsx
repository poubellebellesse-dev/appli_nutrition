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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { JSX } from 'react'
import type { AllergenId } from '../../engine/domain/index.js'
import {
  readPantryDeclareLe,
  readPantryFoodIds,
  readShoppingList,
  savePlan,
  writeAllergies,
  writePantry,
} from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'
import { hashDe, hashDuFrigo } from '../router.js'

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
async function avecUnPlan({ restes = true }: { restes?: boolean } = {}) {
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
  // `restes: false` sert le seul cas où l'absence de restes EST ce qu'on vérifie — le plan brut de
  // `planWeek` n'en porte aucun, c'est `planLeftovers` qui les pose (§7.3 ENGINE).
  const plan = restes ? socle.moteur.planLeftovers(brut, profil, 1) : brut
  savePlan(socle.db, plan, date)
  return { socle, plan }
}

/**
 * Enveloppe MINUSCULE, requise depuis que `Courses` porte `<LienTutoriel>` — voir
 * `ui/lancer-parcours.tsx` : `useLancerParcours()` lève hors de ce provider.
 *
 * ⚠️ `ProvenanceLancerParcours` EST IMPORTÉ DYNAMIQUEMENT ICI, PAS EN TÊTE DE FICHIER. `beforeEach`
 * appelle `vi.resetModules()` : un import statique figerait un `Context` React d'AVANT la
 * réinitialisation, tandis que `Courses` (importé dynamiquement dans `monter`) recevrait sa propre
 * instance de `ui/lancer-parcours.tsx` — deux objets `Context` distincts que `useContext` ne relie
 * jamais, et `useLancerParcours()` lèverait malgré un provider bel et bien monté au-dessus.
 */
async function rendreCourses(Courses: () => JSX.Element) {
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  return render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Courses />
    </ProvenanceLancerParcours>
  )
}

/** Monte l'écran et attend qu'il ait quitté la phase `chargement`. Rend le composant, pour pouvoir
 * remonter l'écran (nouveau `render`) sans changer d'import — c'est CE remontage qui prouve qu'un
 * état survit en base et pas seulement dans la mémoire React du premier montage. */
async function monter() {
  const { Courses } = await import('./courses.js')
  await rendreCourses(Courses)
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

/** Le formulaire d'ajout, pour scoper les requêtes : un nom d'aliment proposé en complétion (ex.
 * « Courgette, crue ») peut aussi apparaître comme article de la liste de courses réelle. */
function formulaire(): HTMLElement {
  return screen.getByPlaceholderText('Lessive, pain, croquettes…').closest('form') as HTMLElement
}

describe('courses — la complétion sur les aliments du catalogue', () => {
  it('taper « courg » propose Courgette ; la choisir range l’article en fruits et légumes', async () => {
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: 'courg' },
    })
    fireEvent.click(await within(formulaire()).findByText('Courgette, crue'))
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras).toEqual([expect.objectContaining({ libelle: 'Courgette, crue', rayon: 'fruits et légumes' })])
    })
  })

  it('le rayon déduit reste modifiable, et c’est la valeur choisie à la main qui est enregistrée', async () => {
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: 'courg' },
    })
    fireEvent.click(await within(formulaire()).findByText('Courgette, crue'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'épicerie' } })
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras).toEqual([expect.objectContaining({ libelle: 'Courgette, crue', rayon: 'épicerie' })])
    })
  })

  it('un libellé libre sans proposition choisie s’ajoute toujours, avec son rayon manuel', async () => {
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: 'lessive' },
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lessive & linge' } })
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras).toEqual([expect.objectContaining({ libelle: 'lessive', rayon: 'lessive & linge' })])
    })
  })

  it('la quantité saisie est enregistrée et réaffichée', async () => {
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: 'croquettes' },
    })
    fireEvent.change(screen.getByPlaceholderText('2 boîtes, un paquet…'), { target: { value: '2 paquets' } })
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras).toEqual([expect.objectContaining({ libelle: 'croquettes', quantite: '2 paquets' })])
    })
    expect(await screen.findByText('2 paquets')).toBeDefined()
  })
})

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
    await rendreCourses(Courses)
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
    await rendreCourses(Courses)
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

describe('courses — la note d’allergène sur un article choisi par complétion', () => {
  /** Un aliment RÉEL du catalogue de test qui porte l'allergène gluten, pris tel quel. */
  function alimentAuGluten() {
    const aliment = [...catalogueDeTest().foods.values()].find((f) =>
      f.allergenes.some((a) => a.allergenId === ('gluten' as AllergenId))
    )
    if (aliment === undefined) throw new Error('aucun aliment du catalogue de test ne porte le gluten')
    return aliment
  }

  it('choisir en complétion un aliment qui porte un allergène déclaré écrit et affiche la note', async () => {
    const aliment = alimentAuGluten()
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: aliment.nom.slice(0, 5) },
    })
    fireEvent.click(await within(formulaire()).findByText(aliment.nom))
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras[0]?.noteAllergene).toMatch(/Gluten/)
    })
    expect(await screen.findByText(/Contient un allergène que vous avez déclaré : Gluten/)).toBeDefined()
  })

  it('le même aliment sans allergie déclarée n’écrit aucune note', async () => {
    const aliment = alimentAuGluten()
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: aliment.nom.slice(0, 5) },
    })
    fireEvent.click(await within(formulaire()).findByText(aliment.nom))
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras[0]?.noteAllergene).toBeNull()
    })
    expect(screen.queryByText(/Contient un allergène/)).toBeNull()
  })

  it('un libellé libre, non choisi en complétion, ne promet jamais rien même s’il nomme un allergène', async () => {
    const aliment = alimentAuGluten()
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: aliment.nom },
    })
    // Aucune proposition cliquée : `aliment.nom` est tapé au clavier, pas choisi en complétion.
    fireEvent.click(screen.getByText('Ajouter'))

    await waitFor(() => {
      const extras = readShoppingList(baseCourante())!.extras
      expect(extras[0]?.noteAllergene).toBeNull()
    })
    expect(screen.queryByText(/Contient un allergène/)).toBeNull()
  })

  it('la note survit à un remontage de l’écran — elle vient de la base, pas de l’état React', async () => {
    const aliment = alimentAuGluten()
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await avecUnPlan()
    const Courses = await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: aliment.nom.slice(0, 5) },
    })
    fireEvent.click(await within(formulaire()).findByText(aliment.nom))
    fireEvent.click(screen.getByText('Ajouter'))
    await screen.findByText(/Contient un allergène que vous avez déclaré : Gluten/)

    cleanup()
    await rendreCourses(Courses)
    await screen.findByRole('heading', { name: 'Mes courses' })
    expect(await screen.findByText(/Contient un allergène que vous avez déclaré : Gluten/)).toBeDefined()
  })
})

/**
 * ⚠️ CE QUE CE BLOC GARDE (décision 50). Les restes font tomber une semaine de courses de 24 à 15 kg
 * (§2 ARCHITECTURE) : c'est l'effet le plus spectaculaire du moteur, et il était **invisible là où il
 * se produit**. L'écran Semaine les montrait depuis toujours, l'écran Courses n'en disait rien — au
 * point que la question a été posée deux fois de suite pendant l'essai sur téléphone (« où sont
 * rangés les restes de la veille ? comment l'utilisateur peut le voir ? »).
 */
describe('courses — les repas couverts par un reste', () => {
  it('nomme chaque créneau servi par un reste, et il y en a autant que dans le plan', async () => {
    const { plan } = await avecUnPlan()
    const restes = plan.entries.filter((e) => e.isLeftover)
    // Si `planLeftovers` cessait d'en placer, ce test passerait au vert en ne vérifiant plus rien.
    expect(restes.length).toBeGreaterThan(0)

    await monter()

    const section = (
      await screen.findByText(new RegExp(`^Couverts par un reste \\(${restes.length}\\)$`))
    ).closest('section') as HTMLElement
    expect(within(section).getAllByRole('listitem')).toHaveLength(restes.length)
  })

  // ⚠️ BUG TROUVÉ ET CORRIGÉ LE 2026-08-04, deux commits après avoir été écrit. La section
  // annonçait « Rien à acheter pour eux », et c'était FAUX dans le cas nominal : `planLeftovers` ne
  // remplace que le PLAT du créneau, son accompagnement reste une recette entière que
  // `buildShoppingList` achète. Sur un plan de sept jours en mode repas, TOUS les créneaux couverts
  // par un reste en portent un — l'écran affirmait donc le contraire de la liste juste au-dessus.
  it('⛔ NOMME L’ACCOMPAGNEMENT, QUI LUI EST BIEN À ACHETER', async () => {
    const { socle, plan } = await avecUnPlan()
    const avecAccompagnement = plan.entries.filter(
      (e) =>
        e.isLeftover &&
        plan.entries.some(
          (a) =>
            a.service === 'accompagnement' &&
            !a.isLeftover &&
            a.slot.date === e.slot.date &&
            a.slot.creneau === e.slot.creneau
        )
    )
    // Si le moteur cessait d'accompagner les restes, ce test deviendrait vide sans le dire.
    expect(avecAccompagnement.length).toBeGreaterThan(0)

    await monter()

    const section = (await screen.findByText(/^Couverts par un reste/)).closest('section') as HTMLElement
    const accompagnement = plan.entries.find(
      (a) =>
        a.service === 'accompagnement' &&
        !a.isLeftover &&
        a.slot.date === avecAccompagnement[0]!.slot.date &&
        a.slot.creneau === avecAccompagnement[0]!.slot.creneau
    )!
    const nom = socle.catalogue.recipes.get(accompagnement.recipeId!)!.nom
    // `getAllByText` et non `getByText` : deux créneaux couverts par un reste peuvent partager le
    // MÊME accompagnement, et c'est légitime. L'unicité n'a jamais été l'objet de ce test — elle
    // n'était qu'une propriété accidentelle du catalogue d'alors, tombée en passant à 450 aliments.
    expect(within(section).getAllByText(new RegExp(`avec ${nom} — à acheter`)).length).toBeGreaterThan(0)
    // Et la promesse fausse ne doit pas revenir par une reformulation.
    expect(section.textContent).not.toMatch(/[Rr]ien à acheter/)
  })

  it('⛔ RIEN N’Y EST COCHABLE — ce ne sont pas des articles à acheter', async () => {
    await avecUnPlan()
    await monter()

    const section = (await screen.findByText(/^Couverts par un reste/)).closest('section') as HTMLElement
    expect(within(section).queryAllByRole('button')).toHaveLength(0)
  })

  // Même raison que le lien vers « Vider le frigo » de « Déjà chez vous » : nommer un effet sans
  // dire où il se voit laisse la question entière — et c'est LA question qui a été posée deux fois.
  it('porte le chemin pour aller voir ces repas — un lien vers la Semaine', async () => {
    await avecUnPlan()
    await monter()

    const section = (await screen.findByText(/^Couverts par un reste/)).closest('section') as HTMLElement
    const lien = within(section).getByRole('link', { name: /semaine/i })
    expect(lien.getAttribute('href')).toBe(hashDe('semaine'))
  })

  it('plan sans le moindre reste : la section n’existe pas', async () => {
    const { plan } = await avecUnPlan({ restes: false })
    expect(plan.entries.some((e) => e.isLeftover)).toBe(false)

    await monter()
    expect(screen.queryByText(/^Couverts par un reste/)).toBeNull()
  })

  // ⚠️ AUCUN CHIFFRE DE GAIN, ET C'EST DÉLIBÉRÉ (voir l'en-tête de `CouvertsParUnReste`). Un reste
  // réutilise LA MÊME recette que son plat source : le cuisiner à part n'ajouterait aucun article,
  // ça doublerait des quantités. Un « n articles évités » vaudrait zéro en permanence, et un total
  // en poids demanderait d'additionner des grammes, des millilitres et des pièces.
  it('⛔ N’AFFICHE AUCUN GAIN CHIFFRÉ — on ne chiffre pas ce qu’on ne peut pas défendre', async () => {
    await avecUnPlan()
    await monter()

    const section = (await screen.findByText(/^Couverts par un reste/)).closest('section') as HTMLElement
    expect(section.textContent).not.toMatch(/kg|économis|évité|au lieu de|\d+\s*%/i)
  })
})

/**
 * Les dates du garde-manger, TOUJOURS relatives au jour courant.
 *
 * ⚠️ AUCUN LITTÉRAL DE DATE ICI, et ce n'est pas du zèle : ces tests écrivaient `'2026-08-04'`, ce
 * qui était le jour même où ils ont été écrits. Depuis que `courses.tsx` n'applique plus un
 * garde-manger de plus de sept jours, ce littéral serait devenu périmé une semaine plus tard et les
 * tests seraient passés au rouge un matin sans qu'aucune ligne de code ait bougé.
 */
async function datesDuFrigo(): Promise<{ aujourdhui: string; vieux: string }> {
  const { aujourdhuiIso } = await import('../socle.js')
  const aujourdhui = aujourdhuiIso()
  const vieux = new Date(Date.parse(`${aujourdhui}T00:00:00Z`) - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return { aujourdhui, vieux }
}

describe('courses — le garde-manger', () => {
  it("garde-manger non vide : l'article est sous « Déjà chez vous », pas dans la liste à acheter", async () => {
    const { socle, plan } = await avecUnPlan()
    const { aujourdhui } = await datesDuFrigo()
    const liste = socle.moteur.buildShoppingList(plan)
    const item = liste.items[0]!
    const nom = socle.catalogue.foods.get(item.foodId)!.nom
    writePantry(baseCourante(), [{ foodId: item.foodId, quantiteApprox: null }], aujourdhui)

    await monter()

    expect(await screen.findByText(new RegExp(`^Déjà chez vous \\(1\\)$`))).toBeDefined()
    const sectionDejaChezVous = screen.getByText(nom).closest('section') as HTMLElement
    expect(within(sectionDejaChezVous).getByText(new RegExp(`^Déjà chez vous`))).toBeDefined()
    // L'article n'est plus une ligne cochable de la liste à acheter.
    expect(screen.queryByText(nom)?.closest('button[aria-pressed]')).toBeNull()
  })

  it('garde-manger vide : la section « Déjà chez vous » n’existe pas', async () => {
    await avecUnPlan()
    await monter()
    expect(screen.queryByText(/^Déjà chez vous/)).toBeNull()
  })

  // ⚠️ NOMMER LE RETRAIT SANS OFFRIR DE LE DÉFAIRE laisse l'utilisateur devant un article manquant
  // qu'il voit, comprend, et ne peut pas récupérer sans deviner par quel écran passer. Un
  // garde-manger se périme dans la vraie vie. Le libellé est verrouillé ici parce qu'une
  // reformulation future recacherait ce chemin en silence — même raison que le champ de recherche
  // de « Recettes », qui avait perdu sa capacité par un simple changement de libellé.
  it('la section porte le chemin pour se corriger — un lien vers « Vider le frigo »', async () => {
    const { socle, plan } = await avecUnPlan()
    const { aujourdhui } = await datesDuFrigo()
    const item = socle.moteur.buildShoppingList(plan).items[0]!
    writePantry(baseCourante(), [{ foodId: item.foodId, quantiteApprox: null }], aujourdhui)

    await monter()

    const section = (await screen.findByText(/^Déjà chez vous \(1\)$/)).closest('section') as HTMLElement
    const lien = within(section).getByRole('link', { name: /garde-manger/i })
    expect(lien.getAttribute('href')).toBe(hashDuFrigo())
  })
})

/**
 * ⚠️ CE QUE CE BLOC GARDE, et il garde l'INVERSE de `choisir-plat`. Sur cet écran, le garde-manger ne
 * fait jamais qu'ENLEVER des lignes. Un garde-manger périmé appliqué quand même vous fait donc
 * rentrer du magasin SANS la crème, et vous ne le découvrez qu'au moment de cuisiner — alors que
 * l'ignorer vous fait, au pire, racheter une crème que vous aviez. Les deux erreurs ne coûtent pas
 * la même chose : celle-ci se raye d'un trait, l'autre gâche le repas.
 *
 * D'où deux comportements pour un même composant, et c'est délibéré : dans « Choisir un plat » la
 * question RETIENT les résultats (un garde-manger périmé y rend la proposition FAUSSE), ici elle
 * n'empêche rien (il rend seulement la liste TROP LONGUE). Voir décision 57, `ETAT.md`.
 */
describe('courses — un garde-manger périmé n’est pas appliqué', () => {
  it('⛔ AUCUNE LIGNE N’EST RETIRÉE quand le garde-manger a plus de sept jours', async () => {
    const { socle, plan } = await avecUnPlan()
    const { vieux } = await datesDuFrigo()
    const item = socle.moteur.buildShoppingList(plan).items[0]!
    const nom = socle.catalogue.foods.get(item.foodId)!.nom
    writePantry(baseCourante(), [{ foodId: item.foodId, quantiteApprox: null }], vieux)

    await monter()

    // L'article reste une ligne à acheter…
    expect(lignesAffichees().some((l) => l.includes(nom))).toBe(true)
    // …et n'est PAS annoncé comme déjà possédé, puisqu'on n'en sait rien.
    expect(screen.queryByText(/^Déjà chez vous/)).toBeNull()
    expect(screen.getByText(/date(nt)? trop pour qu/)).toBeDefined()
  })

  it('⛔ GARDE-MANGER MIXTE : le frais est appliqué, le vieux reste sur la liste', async () => {
    // La péremption se juge ALIMENT PAR ALIMENT. Un oignon oublié depuis trois semaines ne doit pas
    // remettre en question une crème déclarée ce matin — et inversement, la crème fraîche ne doit
    // pas blanchir l'oignon. Sans dates par ligne, les deux basculaient ensemble.
    const { socle, plan } = await avecUnPlan()
    const { aujourdhui, vieux } = await datesDuFrigo()
    const items = socle.moteur.buildShoppingList(plan).items
    const frais = items[0]!
    const perime = items[1]!
    const nomFrais = socle.catalogue.foods.get(frais.foodId)!.nom
    const nomPerime = socle.catalogue.foods.get(perime.foodId)!.nom
    writePantry(
      baseCourante(),
      [
        { foodId: frais.foodId, quantiteApprox: null, declareLe: aujourdhui },
        { foodId: perime.foodId, quantiteApprox: null, declareLe: vieux },
      ],
      aujourdhui
    )

    await monter()

    // Le frais a bien été retiré des courses…
    expect(await screen.findByText(/^Déjà chez vous \(1\)$/)).toBeDefined()
    expect(lignesAffichees().some((l) => l.includes(nomFrais))).toBe(false)
    // …le périmé non, et c'est le seul qu'on questionne.
    expect(lignesAffichees().some((l) => l.includes(nomPerime))).toBe(true)
    const bandeau = screen.getByText(/date(nt)? trop pour qu/).closest('div') as HTMLElement
    expect(within(bandeau).getByRole('checkbox', { name: nomPerime })).toBeDefined()
    expect(within(bandeau).queryByRole('checkbox', { name: nomFrais })).toBeNull()
  })

  it('la question NE BLOQUE PAS — la liste est lisible pendant qu’elle est posée', async () => {
    // C'est toute la différence avec « Choisir un plat ». Retenir une liste de courses derrière
    // douze cases à cocher pendant que quelqu'un est debout dans un magasin coûterait plus que les
    // deux lignes en trop qu'elle contient.
    const { socle, plan } = await avecUnPlan()
    const { vieux } = await datesDuFrigo()
    const item = socle.moteur.buildShoppingList(plan).items[0]!
    writePantry(baseCourante(), [{ foodId: item.foodId, quantiteApprox: null }], vieux)

    await monter()

    expect(screen.getByText(/Vous les avez toujours/)).toBeDefined()
    expect(lignesAffichees().length).toBeGreaterThan(0)
  })

  it('« Oui, tout est là » redate le garde-manger et la liste se resserre aussitôt', async () => {
    const { socle, plan } = await avecUnPlan()
    const { aujourdhui, vieux } = await datesDuFrigo()
    const item = socle.moteur.buildShoppingList(plan).items[0]!
    const nom = socle.catalogue.foods.get(item.foodId)!.nom
    writePantry(baseCourante(), [{ foodId: item.foodId, quantiteApprox: null }], vieux)

    await monter()
    fireEvent.click(screen.getByText('Oui, tout est là'))

    await screen.findByText(/^Déjà chez vous \(1\)$/)
    expect(lignesAffichees().some((l) => l.includes(nom))).toBe(false)
    expect(screen.queryByText(/date(nt)? trop pour qu/)).toBeNull()
    // La date, pas seulement l'affichage : sans ça la question reviendrait au montage suivant.
    expect(readPantryDeclareLe(baseCourante())).toBe(aujourdhui)
  })

  it('⛔ DÉCOCHER RETIRE POUR DE BON — la ligne reste à acheter et le frigo est vidé en base', async () => {
    // Ne l'ignorer que pour l'affichage en cours reposerait la même question à l'identique la fois
    // suivante : on contournerait la dérive au lieu de la corriger (décision 57).
    const { socle, plan } = await avecUnPlan()
    const { vieux } = await datesDuFrigo()
    const item = socle.moteur.buildShoppingList(plan).items[0]!
    const nom = socle.catalogue.foods.get(item.foodId)!.nom
    writePantry(baseCourante(), [{ foodId: item.foodId, quantiteApprox: null }], vieux)

    await monter()
    fireEvent.click(screen.getByRole('checkbox', { name: nom }))
    fireEvent.click(screen.getByText('Continuer avec 0 aliment'))

    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toEqual([]))
    expect(lignesAffichees().some((l) => l.includes(nom))).toBe(true)
    expect(screen.queryByText(/^Déjà chez vous/)).toBeNull()
  })
})

describe('courses — le regroupement « Repas » nomme le PLAT, pas son accompagnement', () => {
  it('⛔ un créneau à deux entrées est titré par le plat', async () => {
    // ⚠️ BUG TROUVÉ ET CORRIGÉ LE 2026-08-04. `platParCreneau` se construisait par `set` en boucle
    // sur `plan.entries` : depuis que `planWeek` pose un accompagnement en plus du plat, la SECONDE
    // entrée écrasait la première et la liste titrait « lundi · Déjeuner — Ratatouille » au lieu du
    // plat. Rien n'aurait planté — le regroupement aurait juste désigné le mauvais repas.
    const { plan, socle } = await avecUnPlan()
    await monter()

    const accompagnements = plan.entries.filter((e) => e.service === 'accompagnement')
    expect(accompagnements.length).toBeGreaterThan(0) // sinon le test ne prouve rien

    fireEvent.click(screen.getByText('Repas'))
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 }).some((h) => (h.textContent ?? '').includes(' — '))).toBe(true)
    )

    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
    for (const acc of accompagnements) {
      const nom = socle.catalogue.recipes.get(acc.recipeId!)?.nom
      if (nom === undefined) continue
      // Le nom d'un accompagnement ne peut apparaître que s'il est AUSSI le plat d'un autre créneau
      // (rien ne l'interdit) — on vérifie donc le créneau précis, pas l'absence globale du mot.
      const prefixe = titres.find((t) => t.includes(' — ') && t.endsWith(`— ${nom}`))
      if (prefixe === undefined) continue
      const platDuMemeCreneau = plan.entries.find(
        (e) =>
          e.slot.date === acc.slot.date && e.slot.creneau === acc.slot.creneau && e.service !== 'accompagnement'
      )
      expect(socle.catalogue.recipes.get(platDuMemeCreneau!.recipeId!)?.nom).toBe(nom)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Décision 58, cause (1). La complétion comparait des SOUS-CHAÎNES : une saisie plus longue que le
// nom éditorial, ou dans un autre ordre, rendait une liste VIDE. Ici ce n'était pas qu'un défaut de
// confort — sans proposition à cliquer, on saisit du texte libre et la note d'allergène disparaît.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Les mots d'un nom, remis dans l'ordre inverse : « Courgette, crue » → « crue courgette ».
 *  Garantit une saisie qui n'est PAS une sous-chaîne du nom, sans dépendre d'un aliment précis. */
function motsInverses(nom: string): string {
  return nom
    .split(/[^\p{L}]+/u)
    .filter((mot) => mot.length > 2)
    .reverse()
    .join(' ')
}

describe('courses — la complétion ne dépend plus de l’ordre ni de la longueur de la saisie', () => {
  it('« crue courgette » propose Courgette — l’ordre des mots n’est pas celui du nom éditorial', async () => {
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: 'crue courgette' },
    })

    expect(await within(formulaire()).findByText('Courgette, crue')).toBeDefined()
  })

  it('⛔ et la note d’allergène suit : une saisie qui ne trouvait rien la faisait TAIRE', async () => {
    // Sans proposition cliquable, `alimentChoisi` reste `null` et `noteAllergeneDe` n'a rien à quoi
    // s'appliquer. Le rappel manqué retirait donc une information que l'application avait.
    const aliment = [...catalogueDeTest().foods.values()].find((f) =>
      f.allergenes.some((a) => a.allergenId === ('gluten' as AllergenId))
    )
    if (aliment === undefined) throw new Error('aucun aliment du catalogue de test ne porte le gluten')
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await avecUnPlan()
    await monter()

    fireEvent.click(screen.getByText('Ajouter un article'))
    fireEvent.change(screen.getByPlaceholderText('Lessive, pain, croquettes…'), {
      target: { value: motsInverses(aliment.nom) },
    })
    fireEvent.click(await within(formulaire()).findByText(aliment.nom))
    fireEvent.click(screen.getByText('Ajouter'))

    expect(await screen.findByText(/Contient un allergène que vous avez déclaré : Gluten/)).toBeDefined()
  })
})
