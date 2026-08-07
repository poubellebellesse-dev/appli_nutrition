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
import type { AllergenId, RecipeId } from '../../engine/domain/index.js'
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
  await screen.findByRole('heading', { name: 'Paramètres' })
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
  const etat = readUserState(socle.db, { windowDays: 21, today: '2026-08-01' })
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
