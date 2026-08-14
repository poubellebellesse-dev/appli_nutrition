// @vitest-environment jsdom
//
// ui/screens/parametres.test.tsx — l'écran qui referme le défaut de sécurité du lot 1.
//
// ⚠️ CE QUI EST EN JEU ICI N'EST PAS DU CONFORT. `writeAllergies` n'était appelé QUE par
// l'onboarding : passé le premier lancement, les allergies étaient IMMUABLES — une case cochée par
// erreur l'était pour toujours, une allergie découverte plus tard n'était pas déclarable. §5.2
// ARCHITECTURE qualifie ce filtre de « seul garde-fou CRITIQUE et incontournable » du moteur.
//
// Le test qui compte va jusqu'au bout de la chaîne : décocher à l'écran doit CHANGER CE QUE LE
// MOTEUR PROPOSE. Vérifier que la case bascule ne prouverait rien.
//
// ⚠️ DEPUIS QUE LES SOUS-MENUS SONT DES PANNEAUX EN SUPERPOSITION (`ui/panneau.tsx`), chaque champ
// est caché derrière une ligne ouvrante (« Mes allergies », « Réglages d'affichage », « Rappels »…)
// et n'existe dans le DOM qu'une fois le panneau ouvert. `ouvrir(libelle)` fait ce clic avant toute
// interaction avec un champ, ET REND UN OBJET DE REQUÊTES SCOPÉ AU PANNEAU (`within`) : la ligne
// ouvrante reste montée EN DESSOUS pendant que le panneau est ouvert, et son résumé peut porter
// exactement le même texte que le champ qu'on veut toucher — un seul allergène déclaré fait que
// « Mes allergies » se résume à « Gluten », strictement le même texte que la case à cocher du même
// nom À L'INTÉRIEUR du panneau. `screen.getByText('Gluten')` y trouverait alors DEUX éléments et
// échouerait — d'où l'usage systématique du scope retourné par `ouvrir` pour tout ce qui se trouve
// dans un panneau.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AllergenId, FoodId, RecipeId } from '../../engine/domain/index.js'
import { readAllergies, readDisplay, readMealTimes, writeAllergies } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from '../test-socle.js'
import { remplacerLeFichier } from '../user-source.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
/**
 * Le verrou d'onglet, rendu pilotable par test. Un objet et non une variable : le corps d'un
 * `vi.mock` est hissé au-dessus des déclarations du fichier, seule une référence stable survit.
 */
const verrouDeTest = vi.hoisted(() => ({ courant: 'exclusif' as 'exclusif' | 'partage' | 'indisponible' }))

vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve({ ...sessionDeTest(), verrou: verrouDeTest.courant }),
  surErreurDePersistance: () => undefined,
  octetsDeLaBase: vi.fn(),
  remplacerLeFichier: vi.fn(),
  verifierSauvegarde: vi.fn(),
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // Un seul onglet : le cas nominal. Les tests qui parlent du verrou le disent explicitement.
  verrouDeTest.courant = 'exclusif'
})
afterEach(cleanup)

// ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT, PAS EN TÊTE DE FICHIER — voir
// `courses.test.tsx` : `vi.resetModules()` en `beforeEach` figerait sinon un `Context` React
// distinct de celui que `Parametres` utilise réellement (`useLancerParcours`).
async function monter(lancerParcours: (id: string) => void = () => undefined) {
  const { Parametres } = await import('./parametres.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={lancerParcours}>
      <Parametres />
    </ProvenanceLancerParcours>
  )
  // ⛔ PAS DE `findByRole('heading', { name })` pour attendre un montage — raisonnement complet et
  // chiffres dans `recettes.test.tsx`. Le filtre par NOM recalcule le nom accessible de chaque
  // élément du document, à chaque sonde.
  await waitFor(() => {
    if (document.querySelector('h1') === null) throw new Error('écran pas encore monté')
  })
}

/** État `aria-pressed` d'un bouton, cherché DANS le scope donné (voir `ouvrir`). */
const presseDans = (scope: ReturnType<typeof within>, texte: string): string | null =>
  scope.getByText(texte).closest('button')!.getAttribute('aria-pressed')

/**
 * Ouvre le panneau d'un réglage depuis sa ligne ouvrante, par son libellé exact (ex. « Mes
 * allergies », « Rappels »). Rend les requêtes SCOPÉES à ce panneau — voir la note en tête de
 * fichier sur la collision entre le résumé de la ligne et le libellé d'un champ.
 */
function ouvrir(libelleLigne: string): ReturnType<typeof within> {
  fireEvent.click(screen.getByText(libelleLigne))
  return within(screen.getByRole('dialog'))
}

/**
 * Referme le panneau ouvert via son bouton « ← Retour ».
 *
 * ⚠️ REGEX, PAS DE TEXTE EXACT : le bouton porte une flèche dans un `<span aria-hidden>` séparé du
 * texte « Retour » — un piège classique pour `queryByText` en assertion d'absence ailleurs dans ce
 * fichier, donc la même prudence ici même si le clic n'a pas ce problème.
 */
function retour() {
  fireEvent.click(screen.getByText(/Retour/))
}

/** Les recettes que le moteur propose, à travers un socle reconstruit depuis la base courante. */
async function suggestions(): Promise<readonly RecipeId[]> {
  const { chargerSocle } = await import('../socle.js')
  const socle = await chargerSocle()
  const { readUserState } = await import('../../data/user-store.js')
  const etat = readUserState(socle.db, { windowDays: 21, today: '2026-08-01' }, socle.catalogue.foods)
  return socle.moteur
    .suggestMeals({
      profile: { trancheAge: '30_49', sexe: 'NP', tailleCm: null, poidsKg: null, niveauActivite: 'actif', facteurPortion: 1 },
      constraints: etat.constraints,
      tolerancePiquant: null,
      context: {
        date: '2026-08-01',
        creneau: 'diner',
        envie: null,
        tempsDisponibleMin: null,
        requiredFoodIds: [],
        pantryFoodIds: [],
      },
      history: etat.history,
      preferences: etat.preferences,
      favoriteRecipeIds: etat.favoriteRecipeIds,
      activeTopics: etat.activeTopics,
      seed: 1,
      limit: 400,
    })
    .suggestions.map((s) => s.recipeId)
}

describe('parametres — les allergies sont modifiables, et ça compte', () => {
  it('affiche cochées celles qui sont déjà déclarées', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    await monter()
    const panneau = ouvrir('Mes allergies')
    expect(presseDans(panneau, 'Gluten')).toBe('true')
    expect(presseDans(panneau, 'Lait')).toBe('false')
  })

  it('écrit IMMÉDIATEMENT, sans bouton « Enregistrer »', async () => {
    // Un formulaire qu'on peut quitter à moitié rempli laisse croire qu'une allergie est déclarée
    // alors que rien n'est parti en base — sur ce filtre, c'est une protection imaginaire. Vrai
    // aussi bien avant qu'après l'ouverture du panneau : ce n'est pas un formulaire non plus.
    await monter()
    expect(screen.queryByText(/Enregistrer/)).toBeNull()

    const panneau = ouvrir('Mes allergies')
    expect(screen.queryByText(/Enregistrer/)).toBeNull()

    fireEvent.click(panneau.getByText('Gluten'))
    await waitFor(() =>
      expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['gluten'])
    )
  })

  it('⛔ DÉCOCHER RETIRE RÉELLEMENT DU FILTRE — la chaîne complète', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'gluten' as AllergenId, severite: null }])
    const avec = await suggestions()

    await monter()
    const panneau = ouvrir('Mes allergies')
    fireEvent.click(panneau.getByText('Gluten'))
    await waitFor(() => expect(readAllergies(baseCourante())).toEqual([]))

    const sans = await suggestions()
    // Retirer une allergie ne peut qu'ÉLARGIR ce que le moteur propose.
    expect(sans.length).toBeGreaterThan(avec.length)
  })

  it('sait revenir à AUCUNE allergie — « je m’étais trompé » doit être exprimable', async () => {
    writeAllergies(baseCourante(), [{ allergenId: 'arachides' as AllergenId, severite: null }])
    await monter()
    const panneau = ouvrir('Mes allergies')
    fireEvent.click(panneau.getByText('Arachides'))
    await waitFor(() => expect(readAllergies(baseCourante())).toEqual([]))
  })

  it('donne accès aux 14 allergènes réglementaires — aucun caché', async () => {
    await monter()
    const panneau = ouvrir('Mes allergies')
    fireEvent.click(panneau.getByText(/Voir les \d+ allergènes réglementaires/))
    expect(panneau.getByText('Sésame')).toBeDefined()
  })
})

describe('parametres — « Aliments que je ne veux pas »', () => {
  /**
   * Le libellé de la ligne d'un groupe, effectif compris — cherché par REGEX, jamais en dur.
   *
   * ⛔ AUCUN EFFECTIF ÉCRIT EN DUR ICI. Quatre tests ont déjà parié sur la taille du catalogue et un
   * lot de contenu les a cassés. Le nombre attendu se DEMANDE au catalogue de test, comme le fait
   * l'écran lui-même.
   */
  function ligneDuGroupe(libelle: string): RegExp {
    return new RegExp(`^${libelle} \\(\\d+\\)$`)
  }

  it('montre les sept groupes, chacun avec son effectif', async () => {
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    for (const libelle of [
      'Lait et produits laitiers',
      'Œufs',
      'Miel',
      'Viande de mammifère',
      'Volaille',
      'Poisson',
      'Fruits de mer',
    ]) {
      expect(panneau.getByText(ligneDuGroupe(libelle)), libelle).toBeDefined()
    }
  })

  it('écrit IMMÉDIATEMENT au geste — pas à la fermeture du panneau', async () => {
    // Le geste est le contrat. Refermer par « ← Retour » n'est pas un « Enregistrer » déguisé : ce
    // défaut a déjà eu lieu sur les allergies, et c'est la raison d'être de cet écran.
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    fireEvent.click(panneau.getByText(ligneDuGroupe('Œufs')))

    const { readExcludedGroupIds } = await import('../../data/user-store.js')
    await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['oeufs']))
    expect(screen.queryByText(/Enregistrer/)).toBeNull()
  })

  it('⛔ COCHER UN GROUPE RETIRE RÉELLEMENT DES PLATS — la chaîne complète', async () => {
    // Vérifier que la case bascule ne prouverait rien : ce qui compte est que le MOTEUR en tienne
    // compte, via le dépliage de `readConstraints`.
    const avant = await suggestions()

    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    fireEvent.click(panneau.getByText(ligneDuGroupe('Lait et produits laitiers')))

    const { readExcludedGroupIds } = await import('../../data/user-store.js')
    await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['laitiers']))

    const apres = await suggestions()
    expect(apres.length).toBeLessThan(avant.length)
  })

  it('⛔ LE GROUPE EST STOCKÉ, PAS SES ALIMENTS — rien n’atterrit dans `user_excluded_food`', () => {
    // C'est la décision de schéma, vue depuis l'écran : si le cochage recopiait les membres du
    // groupe, ils apparaîtraient ici — et le huitième œuf ajouté le mois prochain serait servi à
    // quelqu'un qui avait justement coché « Œufs ».
    return (async () => {
      await monter()
      const panneau = ouvrir('Aliments que je ne veux pas')
      fireEvent.click(panneau.getByText(ligneDuGroupe('Œufs')))

      const { readExcludedGroupIds, readExcludedFoodIds } = await import('../../data/user-store.js')
      await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['oeufs']))
      expect(readExcludedFoodIds(baseCourante())).toEqual([])
    })()
  })

  it('déplie un groupe jusqu’à l’aliment, et décocher un aliment écrit une EXCEPTION', async () => {
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    fireEvent.click(panneau.getByText(ligneDuGroupe('Œufs')))

    const { readExcludedFoodIds, readGroupExceptionFoodIds } = await import(
      '../../data/user-store.js'
    )
    // ⚠️ SCOPÉ AU GROUPE, pas au panneau : les sept groupes portent tous un bouton « Voir les N
    // aliments », et prendre le premier venu déplierait les produits laitiers.
    const groupe = within(panneau.getByText(ligneDuGroupe('Œufs')).closest('div')!)
    // Le dépliant est INTERNE au panneau : il pousse du contenu, il n'ouvre pas de fenêtre.
    fireEvent.click(groupe.getByText(/^Voir les \d+ aliments$/))

    // Un aliment du groupe, quel qu'il soit — on ne parie pas sur le contenu du catalogue.
    const catalogue = catalogueDeTest()
    const unOeuf = [...catalogue.foods.values()].find(
      (f) => f.origineAnimale?.origine === 'volaille' && f.origineAnimale.provenance === 'production'
    )!
    fireEvent.click(panneau.getByText(unOeuf.nom))

    await waitFor(() => expect(readGroupExceptionFoodIds(baseCourante())).toEqual([unOeuf.id]))
    // ⚠️ LES DEUX TABLES RESTENT DISJOINTES : une ré-admission n'est pas une exclusion à l'envers.
    expect(readExcludedFoodIds(baseCourante())).toEqual([])
  })

  it('⚠️ UN GROUPE DÉJÀ ÉCARTÉ PAR LE RÉGIME EST AFFICHÉ, PAS MASQUÉ — et sans case', async () => {
    // Un végétarien doit VOIR que « Viande de mammifère » est écarté, et par quoi : sinon l'écran
    // ment par omission sur ce qui filtre ses suggestions. Le ré-admettre toucherait la couche
    // `regime`, qui reste 🔒 critique — c'est un autre lot.
    const { writeDiet } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetarien')
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')

    const viande = panneau.getByText(ligneDuGroupe('Viande de mammifère'))
    expect(viande.closest('button')).toBeNull()
    expect(panneau.getAllByText(/Déjà écarté par votre régime/).length).toBeGreaterThan(0)

    // Et les groupes que le régime laisse passer gardent bien leur case.
    expect(panneau.getByText(ligneDuGroupe('Œufs')).closest('button')).not.toBeNull()
  })

  it('⛔ AUCUNE ALLERGIE NE PASSE PAR CET ÉCRAN — un régime est une préférence', async () => {
    // Un régime est une préférence, une allergie un fait médical : le filtre allergène est le seul
    // garde-fou CRITIQUE du moteur (§5.2 ARCHITECTURE), il ne se règle pas au même endroit ni avec
    // la même portée. L'écran a le droit de RENVOYER vers « Mes allergies » — il n'a pas le droit
    // d'en proposer une, ni d'en écrire une.
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    for (const allergene of ['Gluten', 'Arachides', 'Sésame']) {
      expect(panneau.queryByText(allergene), allergene).toBeNull()
    }

    fireEvent.click(panneau.getByText(ligneDuGroupe('Lait et produits laitiers')))
    const { readAllergies, readExcludedGroupIds } = await import('../../data/user-store.js')
    await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['laitiers']))
    // Retirer le lait par goût N'EST PAS déclarer une allergie au lait.
    expect(readAllergies(baseCourante())).toEqual([])
  })

  // --- Le compteur de plats restants (lot C) ----------------------------------------------------

  /**
   * Les lignes du compteur, telles qu'affichées.
   *
   * ⛔ AUCUN NOMBRE ATTENDU N'EST ÉCRIT EN DUR. Ce que les tests vérifient est une RELATION — quels
   * créneaux sont listés, et dans quel sens le nombre bouge quand on coche. La valeur, elle,
   * appartient au contenu du catalogue et change à chaque lot.
   */
  function lignesDuCompteur(panneau: ReturnType<typeof within>): readonly string[] {
    const bloc = panneau.getByText('Il reste, avec vos choix :').closest('div')!
    return [...bloc.querySelectorAll('li')].map((li) => li.textContent ?? '')
  }

  function platsDuCreneau(panneau: ReturnType<typeof within>, libelle: string): number {
    const ligne = lignesDuCompteur(panneau).find((texte) => texte.startsWith(libelle))
    return Number(/(\d+)\s*plat/.exec(ligne ?? '')![1])
  }

  it('compte les plats restants CRÉNEAU PAR CRÉNEAU, et seulement ceux que l’utilisateur planifie', async () => {
    // Un total global peut être vert pendant qu'un créneau est déjà vide — c'est la panne mesurée au
    // banc (« végétalien + sans gluten », 28 plats pour 28 créneaux). Et compter le goûter de qui
    // mange deux fois par jour est du bruit : un avertissement de bruit ne se lit plus.
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    const lignes = lignesDuCompteur(panneau)

    // Rythme par défaut : deux repas par jour → déjeuner et dîner, pas les quatre créneaux.
    expect(lignes.some((l) => l.startsWith('Déjeuner'))).toBe(true)
    expect(lignes.some((l) => l.startsWith('Dîner'))).toBe(true)
    expect(lignes.some((l) => l.startsWith('Goûter'))).toBe(false)
    expect(lignes.some((l) => l.startsWith('Petit-déjeuner'))).toBe(false)
  })

  it('le compteur SUIT le rythme déclaré', async () => {
    const { writeRythme, readRythme } = await import('../../data/user-store.js')
    const rythme = readRythme(baseCourante())
    writeRythme(baseCourante(), {
      repasParJour: 3,
      tempsSemaineMin: rythme?.tempsSemaineMin ?? 30,
      tempsWeekendMin: rythme?.tempsWeekendMin ?? null,
    })

    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    expect(lignesDuCompteur(panneau).some((l) => l.startsWith('Petit-déjeuner'))).toBe(true)
  })

  it('⛔ LE COMPTE BAISSE QUAND ON COCHE — il décrit les contraintes, il ne les décore pas', async () => {
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    const avant = platsDuCreneau(panneau, 'Dîner')
    expect(avant).toBeGreaterThan(0)

    fireEvent.click(panneau.getByText(ligneDuGroupe('Viande de mammifère')))

    await waitFor(() => expect(platsDuCreneau(panneau, 'Dîner')).toBeLessThan(avant))
  })

  it('⛔ À ZÉRO PLAT, LA PHRASE DIT « ne pourra pas », JAMAIS « répétitif » NI « impossible »', async () => {
    // Le mot « infaisable » est plus fort que le fait, et les deux seuils ne disent pas la même
    // chose : à 0, `suggestMeals` LÈVE (le créneau ne peut pas être rempli) ; en dessous d'une
    // semaine, `planWeek` ne répète pas, il laisse des cases VIDES. « répétitif » serait faux, et
    // « impossible » le serait aussi — dans le sens qui fait peur.
    const { writeExcludedFoodIds } = await import('../../data/user-store.js')
    writeExcludedFoodIds(baseCourante(), [...catalogueDeTest().foods.keys()])

    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    expect(platsDuCreneau(panneau, 'Dîner')).toBe(0)

    const ligne = lignesDuCompteur(panneau).find((l) => l.startsWith('Dîner'))!
    expect(ligne).toMatch(/ne pourra pas être proposé/)
    expect(ligne).not.toMatch(/répétitif|impossible|infaisable/i)
  })

  it('⛔ RIEN N’EST BLOQUÉ NI GRISÉ PAR LE COMPTE — l’utilisateur a le droit de se mettre dans une impasse', async () => {
    // Principe 1 et principe 6 : l'écran informe, il ne décide pas. Le seul devoir est de le dire
    // AVANT. On coche donc tout, et les cases doivent toutes continuer de répondre.
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    const cochables = ['Lait et produits laitiers', 'Œufs', 'Miel', 'Viande de mammifère', 'Volaille', 'Poisson', 'Fruits de mer']
    for (const libelle of cochables) {
      const bouton = panneau.getByText(ligneDuGroupe(libelle)).closest('button')!
      expect(bouton.hasAttribute('disabled'), libelle).toBe(false)
      fireEvent.click(bouton)
    }

    const { readExcludedGroupIds } = await import('../../data/user-store.js')
    await waitFor(() => expect(readExcludedGroupIds(baseCourante()).length).toBe(cochables.length))
  })

  // --- Les présélections nommées (lot C) --------------------------------------------------------

  it('⛔ AUCUNE PRÉSÉLECTION SANS LE RÉGIME QUI LA REND SENSÉE', async () => {
    // « Lacto-végétarien » proposé à un omnivore ouvrirait un SECOND chemin vers un état que la
    // couche `regime` porte déjà — deux écrans qui décrivent la même chose sans se parler.
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    expect(panneau.queryByText('Lacto-végétarien')).toBeNull()
    expect(panneau.queryByText('Ovo-végétarien')).toBeNull()
    expect(panneau.queryByText('Sans fruits de mer')).toBeNull()
  })

  it('sous « végétarien », les deux présélections apparaissent — et AUCUN bouton « ovo-lacto »', async () => {
    // 📌 L'ovo-lacto est l'état PAR DÉFAUT de `vegetarien` : le bouton ne cocherait rien. Le document
    // de conception le listait, il a été corrigé dans le même lot.
    const { writeDiet } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetarien')
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')

    expect(panneau.getByText('Lacto-végétarien')).toBeDefined()
    expect(panneau.getByText('Ovo-végétarien')).toBeDefined()
    expect(panneau.queryByText(/ovo.?lacto/i)).toBeNull()
  })

  it('une présélection coche les groupes qu’elle nomme, et rien de plus', async () => {
    const { writeDiet, readExcludedGroupIds } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetarien')
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')

    fireEvent.click(panneau.getByText('Lacto-végétarien'))
    await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['oeufs']))
  })

  it('⛔ UNE PRÉSÉLECTION AJOUTE, ELLE NE DÉCOCHE JAMAIS', async () => {
    // Même polarité que partout dans ce chantier : l'erreur qui retire un aliment de trop se voit et
    // se répare, celle qui en réadmet un en silence ne se voit pas. Contrepartie assumée — se
    // tromper de présélection ne s'annule pas d'un clic.
    const { writeDiet, readExcludedGroupIds } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetarien')
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')

    fireEvent.click(panneau.getByText(ligneDuGroupe('Miel')))
    await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['miel']))

    fireEvent.click(panneau.getByText('Ovo-végétarien'))
    await waitFor(() =>
      expect([...readExcludedGroupIds(baseCourante())].sort()).toEqual(['laitiers', 'miel'])
    )
  })

  it('⛔ AUCUN NOM DE PRÉSÉLECTION N’EST STOCKÉ — seules les cases le sont', async () => {
    // Un nom stocké se désynchronise des cases dès le premier cochage manuel : l'écran afficherait
    // « lacto-végétarien » à quelqu'un qui vient de reprendre les œufs.
    const { writeDiet, readExcludedGroupIds, readExcludedFoodIds, readGroupExceptionFoodIds } =
      await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetarien')
    await monter()
    const panneau = ouvrir('Aliments que je ne veux pas')
    fireEvent.click(panneau.getByText('Lacto-végétarien'))
    await waitFor(() => expect(readExcludedGroupIds(baseCourante())).toEqual(['oeufs']))

    // Rien d'autre n'a bougé, et aucune table ne porte de libellé.
    expect(readExcludedFoodIds(baseCourante())).toEqual([])
    expect(readGroupExceptionFoodIds(baseCourante())).toEqual([])
    const tables = baseCourante().all<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    )
    expect(tables.some((t) => /preselection|preset/i.test(t.name))).toBe(false)
  })
})

// --- « Mes exceptions » (lot D3) ----------------------------------------------------------------

describe('parametres — « Mes exceptions »', () => {
  /** Même précaution que le panneau voisin : l'effectif se DEMANDE, il ne s'écrit pas en dur. */
  function ligneDuGroupe(libelle: string): RegExp {
    return new RegExp(`^${libelle} \\(\\d+\\)$`)
  }

  /** Déplie un groupe DEPUIS SA PROPRE LIGNE — tous les groupes portent le même bouton. */
  function deplier(panneau: ReturnType<typeof within>, libelle: string) {
    const groupe = within(panneau.getByText(ligneDuGroupe(libelle)).closest('div')!)
    fireEvent.click(groupe.getByText(/^Voir les \d+ aliments$/))
  }

  /**
   * Ce que le moteur laisse passer, et ce qu'il écarte AVEC LA COUCHE QUI L'A FAIT — lu à travers
   * `readConstraints`, donc par le même chemin que la production.
   *
   * ⚠️ `browseRecipes` PLUTÔT QUE `suggestMeals` ICI, ET C'EST MESURÉ, PAS PRÉFÉRÉ : les recettes
   * qu'admettre le miel débloque sont au petit-déjeuner, au goûter et au déjeuner, aucune au dîner.
   * `suggestions()` interroge le seul dîner — le bout-en-bout y aurait été VERT SANS RIEN PROUVER.
   * `browseRecipes` applique exactement les mêmes couches d'exclusion, sans axe de créneau, et c'est
   * aussi lui que le compteur « il reste N plats » interroge.
   */
  async function passeDExclusion(): Promise<{
    visibles: ReadonlySet<RecipeId>
    ecarteesParLeRegime: ReadonlySet<RecipeId>
  }> {
    const { chargerSocle } = await import('../socle.js')
    const socle = await chargerSocle()
    const { readConstraints } = await import('../../data/user-store.js')
    const result = socle.moteur.browseRecipes({
      constraints: readConstraints(socle.db, socle.catalogue.foods),
    })
    return {
      visibles: new Set(result.recipeIds),
      ecarteesParLeRegime: new Set(
        result.entonnoir.entries.filter((e) => e.layerId === 'regime').map((e) => e.recipeId)
      ),
    }
  }

  it('⛔ AUCUNE LIGNE SANS RÉGIME NI POUR UN OMNIVORE — il n’y a rien à excepter', async () => {
    // Un panneau qui s'ouvrirait sur une liste vide est un réglage qui ne règle rien. ⚠️ Ce n'est PAS
    // le cas du panneau voisin, qui affiche les groupes déjà écartés au lieu de les masquer : là-bas
    // cacher aurait tu ce qui FILTRE les suggestions ; ici il n'y a rien à taire.
    await monter()
    expect(screen.queryByText('Mes exceptions')).toBeNull()

    cleanup()
    const { writeDiet } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'omnivore')
    await monter()
    expect(screen.queryByText('Mes exceptions')).toBeNull()
  })

  it('ne liste QUE ce que le régime déclaré écarte — un pescétarien ne voit pas les poissons', async () => {
    const { writeDiet } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'pescetarien')
    await monter()
    const panneau = ouvrir('Mes exceptions')

    expect(panneau.getByText(ligneDuGroupe('Viande de mammifère'))).toBeDefined()
    expect(panneau.getByText(ligneDuGroupe('Volaille'))).toBeDefined()
    // Le pescétarien mange déjà du poisson : la question ne se pose pas, le groupe n'est pas là.
    expect(panneau.queryByText(ligneDuGroupe('Poisson'))).toBeNull()
    expect(panneau.queryByText(ligneDuGroupe('Fruits de mer'))).toBeNull()
  })

  it('⛔ AUCUNE CASE DE GROUPE — le groupe ouvre, il ne coche pas', async () => {
    // Le schéma l'a décidé avant l'écran : `user_admitted_food` stocke un `food_id`, il n'existe
    // aucune table d'admission par groupe. « Admettre tous les produits laitiers » ferait d'un
    // végétalien autre chose qu'un végétalien — ça s'appelle changer de régime, pas excepter.
    const { writeDiet } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    await monter()
    const panneau = ouvrir('Mes exceptions')

    for (const libelle of ['Miel', 'Lait et produits laitiers', 'Œufs']) {
      expect(panneau.getByText(ligneDuGroupe(libelle)).closest('button'), libelle).toBeNull()
    }
  })

  it('écrit IMMÉDIATEMENT au geste — pas à la fermeture du panneau', async () => {
    const { writeDiet, readAdmittedFoodIds } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    await monter()
    const panneau = ouvrir('Mes exceptions')
    deplier(panneau, 'Miel')
    fireEvent.click(panneau.getByText('Miel'))

    await waitFor(() => expect(readAdmittedFoodIds(baseCourante())).toEqual(['miel']))
    expect(screen.queryByText(/Enregistrer/)).toBeNull()

    // Et le geste s'annule du même clic — une exception se retire aussi simplement qu'elle se pose.
    fireEvent.click(panneau.getByText('Miel'))
    await waitFor(() => expect(readAdmittedFoodIds(baseCourante())).toEqual([]))
  })

  it('⛔ UN ALIMENT PORTEUR D’UN ALLERGÈNE DÉCLARÉ N’A PAS DE CASE — garde-fou 1', async () => {
    // P4 (lot D1) garantit qu'admettre n'atteint jamais la couche `allergenes` : une case ici
    // promettrait ce qu'elle ne tient pas, ce qui est PIRE que son absence. On l'affiche quand même,
    // avec le motif et l'endroit où ça se règle — masquer ferait conclure à un bug.
    const { writeDiet, writeAllergies } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    writeAllergies(baseCourante(), [{ allergenId: 'lait' as AllergenId, severite: null }])

    // L'aliment se DEMANDE au catalogue de test, il ne s'écrit pas en dur.
    const laitier = [...catalogueDeTest().foods.values()].find((f) =>
      f.allergenes.some((a) => a.allergenId === 'lait')
    )!

    await monter()
    const panneau = ouvrir('Mes exceptions')
    deplier(panneau, 'Lait et produits laitiers')

    expect(panneau.getByText(laitier.nom).closest('button')).toBeNull()
    expect(panneau.getAllByText(/Écarté par une allergie que vous avez déclarée/).length)
      .toBeGreaterThan(0)
  })

  it('⛔ UN ALIMENT DÉJÀ RETIRÉ DANS « Aliments que je ne veux pas » N’A PAS DE CASE NON PLUS', async () => {
    // D2 a tranché : l'exclusion personnelle l'emporte sur l'admission, et DÉLIBÉRÉMENT sans
    // arbitrage à la lecture — le moteur reçoit les deux listes pour que P4 reste testable. Côté
    // écran, la conséquence est qu'une case y serait sans effet.
    const { writeDiet, writeExcludedFoodIds } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    writeExcludedFoodIds(baseCourante(), ['miel' as FoodId])

    await monter()
    const panneau = ouvrir('Mes exceptions')
    deplier(panneau, 'Miel')

    expect(panneau.getByText('Miel').closest('button')).toBeNull()
    expect(panneau.getByText(/Vous l’avez retiré dans « Aliments que je ne veux pas »/)).toBeDefined()
  })

  it('⭐ LE LIBELLÉ DU RÉGIME PORTE SES EXCEPTIONS — et rien de plus quand il n’y en a pas', async () => {
    const { writeDiet, readAdmittedFoodIds } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    await monter()

    // ⚠️ Zéro exception ⇒ le libellé ne change pas. Pas de « végétalien, sauf 0 ».
    expect(screen.getByText('Végétalien')).toBeDefined()

    const panneau = ouvrir('Mes exceptions')
    deplier(panneau, 'Miel')
    fireEvent.click(panneau.getByText('Miel'))
    await waitFor(() => expect(readAdmittedFoodIds(baseCourante())).toEqual(['miel']))
    retour()

    await waitFor(() => expect(screen.getByText('Végétalien, sauf 1')).toBeDefined())
    // Et l'écran du régime les NOMME, là où la ligne se contente de les compter.
    const regime = ouvrir('Mon régime')
    expect(regime.getByText(/Vous acceptez malgré ce régime/)).toBeDefined()
    expect(regime.getByText('Miel')).toBeDefined()
  })

  it('⛔ UNE ADMISSION QUI N’AGIT PAS N’EST PAS COMPTÉE — le libellé ne ment pas dans l’autre sens', async () => {
    // Une ligne en base survit à un changement de régime, et c'est voulu : rien n'est effacé dans le
    // dos de l'utilisateur. Mais un pescétarien mange déjà du miel — annoncer « Pescétarien, sauf 1 »
    // serait faux. Le compte suit les cases ACTIVES, pas les lignes stockées.
    const { writeDiet, writeAdmittedFoodIds, readAdmittedFoodIds } = await import(
      '../../data/user-store.js'
    )
    writeDiet(baseCourante(), 'pescetarien')
    writeAdmittedFoodIds(baseCourante(), ['miel' as FoodId])
    await monter()

    expect(screen.getByText('Pescétarien')).toBeDefined()
    expect(screen.queryByText(/Pescétarien, sauf/)).toBeNull()
    // ⚠️ Et la ligne n'a PAS été effacée : elle redeviendra active si le régime redevient végétalien.
    expect(readAdmittedFoodIds(baseCourante())).toEqual(['miel'])
  })

  it('⭐ COCHER « Miel » FAIT RÉAPPARAÎTRE DES PLATS AU MIEL — la chaîne complète', async () => {
    // ⛔ Le test du lot. Vérifier que la case bascule ne prouverait rien : ce qui compte est que le
    // MOTEUR change d'avis, à travers `readConstraints`.
    const { writeDiet, readAdmittedFoodIds } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    const avant = await passeDExclusion()

    await monter()
    const panneau = ouvrir('Mes exceptions')
    deplier(panneau, 'Miel')
    fireEvent.click(panneau.getByText('Miel'))
    await waitFor(() => expect(readAdmittedFoodIds(baseCourante())).toEqual(['miel']))

    const apres = await passeDExclusion()

    // ⚠️ UNE RELATION, JAMAIS UN COMPTE : le prochain lot de contenu ne doit pas casser ce test.
    const perdues = [...avant.visibles].filter((id) => !apres.visibles.has(id))
    expect(perdues, 'admettre ne retire jamais un plat (P2)').toEqual([])

    const gagnees = [...apres.visibles].filter((id) => !avant.visibles.has(id))
    expect(gagnees.length, 'au moins un plat au miel redevient visible').toBeGreaterThan(0)

    // Et ce sont bien des plats AU MIEL — pas n'importe quel effet de bord.
    const catalogue = catalogueDeTest()
    for (const id of gagnees) {
      const recette = catalogue.recipes.get(id)!
      expect(
        recette.ingredients.some((i) => i.foodId === 'miel'),
        recette.nom
      ).toBe(true)
      // ⛔ Et « pourquoi pas ce plat » ne l'attribue plus au régime : elle n'est plus écartée du tout.
      expect(avant.ecarteesParLeRegime.has(id), recette.nom).toBe(true)
      expect(apres.ecarteesParLeRegime.has(id), recette.nom).toBe(false)
    }
  })

  it('le compteur « il reste N plats » suit les exceptions — il ne reste pas sur l’ancien chiffre', async () => {
    // ⚠️ LE `[]` EN DUR QUE CE TEST REMPLACE ÉTAIT JUSTE tant que personne ne pouvait cocher. Le
    // panneau existant, le laisser aurait affiché un compte que les cases d'à côté démentaient, sur
    // le même écran. C'est le piège « un champ déclaré n'est pas un champ branché ».
    const { writeDiet } = await import('../../data/user-store.js')
    writeDiet(baseCourante(), 'vegetalien')
    await monter()
    const panneau = ouvrir('Mes exceptions')

    const compte = () =>
      [...panneau.getByText('Il reste, avec vos choix :').closest('div')!.querySelectorAll('li')]
        .map((li) => Number(/(\d+) plat/.exec(li.textContent ?? '')?.[1] ?? -1))
        .reduce((a, b) => a + b, 0)

    const avant = compte()
    deplier(panneau, 'Miel')
    fireEvent.click(panneau.getByText('Miel'))

    // ⚠️ Une relation, pas un nombre : admettre ne peut qu'AJOUTER (P2).
    await waitFor(() => expect(compte()).toBeGreaterThan(avant))
  })
})

describe('parametres — les réglages d’affichage', () => {
  it('⛔ n’efface PAS les autres en changeant un seul', async () => {
    // `writeDisplay` remplace la ligne entière : un champ omis repartirait au défaut du schéma.
    // Le défaut a existé — `detail-recette` écrivait `{ afficherMacros }` seul.
    await monter()
    const panneau = ouvrir("Réglages d'affichage")
    fireEvent.click(panneau.getByText('Afficher plus de détails'))
    await waitFor(() => expect(readDisplay(baseCourante()).afficherMacros).toBe(true))

    fireEvent.click(panneau.getByText("Changer de plat en balayant l'écran"))
    await waitFor(() => expect(readDisplay(baseCourante()).gestesBalayage).toBe(true))
    expect(readDisplay(baseCourante()).afficherMacros).toBe(true)
  })

  it('part de rien d’activé — chaque réglage est un opt-in', async () => {
    await monter()
    const panneau = ouvrir("Réglages d'affichage")
    expect(presseDans(panneau, "Changer de plat en balayant l'écran")).toBe('false')
    expect(presseDans(panneau, 'Afficher plus de détails')).toBe('false')
  })
})

describe('parametres — les rappels', () => {
  it('DIT que les notifications demandent l’application installée', async () => {
    // Hors conteneur natif, aucune notification programmée n'existe. Plutôt qu'un interrupteur qui
    // ne ferait rien, on explique — une promesse non tenue coûte plus cher qu'une absence.
    await monter()
    const panneau = ouvrir('Rappels')
    await panneau.findByText(/demandent l'application installée/)
  })

  it('n’active PAS les rappels quand la permission ne peut pas être accordée', async () => {
    await monter()
    const panneau = ouvrir('Rappels')
    fireEvent.click(panneau.getByText('Me prévenir quand il est temps de commencer'))
    await waitFor(() => expect(readDisplay(baseCourante()).rappelsActifs).toBe(false))
  })

  it('enregistre quand même l’heure des repas — elle décrit l’utilisateur, pas la plateforme', async () => {
    await monter()
    ouvrir('Rappels')
    const heures = document.querySelectorAll('input[type="time"]')
    expect(heures.length).toBeGreaterThan(0)
    fireEvent.change(heures[heures.length - 1]!, { target: { value: '19:30' } })
    await waitFor(() => expect([...readMealTimes(baseCourante()).values()]).toContain(19 * 60 + 30))
  })
})

describe('parametres — revoir un tutoriel', () => {
  it('« Revoir un tutoriel » ouvre la liste de TOUS les parcours, dérivée de `PARCOURS`', async () => {
    // Cette ligne ne dépend PAS de `visite_proposee` (voir `ui/parcours.ts`) : la déclarer déjà
    // proposée ne doit rien changer à sa disponibilité ici.
    await monter()
    const panneau = ouvrir('Revoir un tutoriel')
    expect(panneau.getByText('Découvrir les menus')).toBeDefined()
    expect(panneau.getByText('Réglages')).toBeDefined()
  })

  it('choisir un parcours le lance ET referme la fenêtre', async () => {
    const lancerParcours = vi.fn()
    await monter(lancerParcours)
    const panneau = ouvrir('Revoir un tutoriel')
    fireEvent.click(panneau.getByText('Découvrir les menus'))
    expect(lancerParcours).toHaveBeenCalledWith('menus')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('parametres — à propos', () => {
  it('énonce les engagements du produit et donne un contact', async () => {
    await monter()
    const panneau = ouvrir('À propos')
    expect(panneau.getByText(/sans publicité, sans compte et sans mesure/)).toBeDefined()
    expect(panneau.getByText(/développeur indépendant/)).toBeDefined()
    expect(document.querySelector('a[href^="mailto:"]')).not.toBeNull()
  })
})

describe('parametres — les sous-menus sont des fenêtres en superposition, pas des dépliants', () => {
  it('« ← Retour » referme le panneau SANS annuler la modification — déjà écrite en base', async () => {
    await monter()
    const panneau = ouvrir('Mes allergies')
    expect(screen.getByRole('dialog', { name: 'Mes allergies' })).toBeDefined()

    fireEvent.click(panneau.getByText('Gluten'))
    await waitFor(() =>
      expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['gluten'])
    )

    retour()
    // Le panneau est refermé…
    expect(screen.queryByRole('dialog')).toBeNull()
    // … mais fermer n'annule rien : l'écriture était déjà faite pendant que le panneau était ouvert.
    expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['gluten'])
  })

  it('la ligne ouvrante affiche la valeur courante, et elle change après modification', async () => {
    await monter()
    // Rien de déclaré au départ : la ligne le dit sans qu'on ait besoin d'ouvrir le panneau.
    expect(screen.getByText('Aucune')).toBeDefined()

    const panneau = ouvrir('Mes allergies')
    fireEvent.click(panneau.getByText('Gluten'))
    await waitFor(() =>
      expect(readAllergies(baseCourante()).map((a) => a.allergenId)).toEqual(['gluten'])
    )
    retour()

    // La ligne reflète maintenant ce qui a été déclaré, sans qu'on rouvre le panneau.
    expect(screen.getByText('Gluten')).toBeDefined()
    expect(screen.queryByText('Aucune')).toBeNull()
  })
})

describe('Sauvegarde', () => {
  it('la ligne ouvrante dit « Jamais sauvegardé » sur une base neuve', async () => {
    await monter()
    expect(screen.getByText('Jamais sauvegardé')).toBeDefined()
  })

  it('le panneau ouvert propose de créer une sauvegarde et de restaurer un fichier', async () => {
    await monter()
    const panneau = ouvrir('Sauvegarder mes données')
    expect(panneau.getByRole('button', { name: 'Créer une sauvegarde' })).toBeDefined()
    expect(panneau.getByLabelText('Restaurer une sauvegarde (.nutri-backup)')).toBeDefined()
  })

  it('⛔ CHOISIR UN FICHIER N’ÉCRASE RIEN TOUT SEUL — la confirmation s’interpose', async () => {
    await monter()
    const panneau = ouvrir('Sauvegarder mes données')
    const champ = panneau.getByLabelText('Restaurer une sauvegarde (.nutri-backup)')
    const fichier = new File([new Uint8Array([1, 2, 3])], 'ma-sauvegarde.nutri-backup')

    fireEvent.change(champ, { target: { files: [fichier] } })

    await panneau.findByText('Restaurer remplacera toutes vos données actuelles.')
    expect(remplacerLeFichier).not.toHaveBeenCalled()
  })

  it('« Annuler » depuis la confirmation revient aux deux commandes sans rien appeler', async () => {
    await monter()
    const panneau = ouvrir('Sauvegarder mes données')
    const champ = panneau.getByLabelText('Restaurer une sauvegarde (.nutri-backup)')
    const fichier = new File([new Uint8Array([1, 2, 3])], 'ma-sauvegarde.nutri-backup')
    fireEvent.change(champ, { target: { files: [fichier] } })
    await panneau.findByText('Restaurer remplacera toutes vos données actuelles.')

    fireEvent.click(panneau.getByText('Annuler'))

    expect(panneau.getByRole('button', { name: 'Créer une sauvegarde' })).toBeDefined()
    expect(panneau.getByLabelText('Restaurer une sauvegarde (.nutri-backup)')).toBeDefined()
    expect(remplacerLeFichier).not.toHaveBeenCalled()
  })

  it('la confirmation nomme le fichier choisi', async () => {
    await monter()
    const panneau = ouvrir('Sauvegarder mes données')
    const champ = panneau.getByLabelText('Restaurer une sauvegarde (.nutri-backup)')
    const fichier = new File([new Uint8Array([1, 2, 3])], 'ma-sauvegarde.nutri-backup')

    fireEvent.change(champ, { target: { files: [fichier] } })

    await panneau.findByText(/ma-sauvegarde\.nutri-backup/)
  })
})

// ⚠️ AJOUTÉ APRÈS RELECTURE (2026-08-06), ET CE N'EST PAS DU CONFORT D'AFFICHAGE. Un onglet qui n'a
// pas le verrou n'enregistre plus rien : sa base en mémoire est vivante, mais elle ne descend plus
// sur OPFS. S'il pouvait restaurer, l'écriture aurait bien lieu — puis l'onglet DÉTENTEUR, qui
// n'en sait rien, écraserait le fichier restauré à sa modification suivante avec SA propre base.
// La restauration aurait paru marcher, puis se serait défaite toute seule, sans erreur. Le refus
// dur vit dans `user-source.ts` ; ce test verrouille qu'on le DISE avant le geste, et non après la
// fenêtre de confirmation.
describe('Sauvegarde — un onglet qui n’enregistre pas ne restaure pas', () => {
  it('⛔ n’offre AUCUN champ de restauration quand un autre onglet détient le verrou', async () => {
    verrouDeTest.courant = 'partage'
    await monter()
    const panneau = ouvrir('Sauvegarder mes données')

    expect(panneau.queryByLabelText('Restaurer une sauvegarde (.nutri-backup)')).toBeNull()
    expect(panneau.getByText(/ouverte dans un autre onglet/i)).toBeDefined()
  })

  it('laisse en revanche CRÉER une sauvegarde — exporter ne fait que lire', async () => {
    verrouDeTest.courant = 'partage'
    await monter()
    const panneau = ouvrir('Sauvegarder mes données')

    expect(panneau.getByRole('button', { name: 'Créer une sauvegarde' })).toBeDefined()
  })
})
