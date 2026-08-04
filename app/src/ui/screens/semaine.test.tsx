// @vitest-environment jsdom
//
// ui/screens/semaine.test.tsx — l'écran qui écrit une structure dans `user.db`, pas seulement un
// réglage isolé.
//
// ⚠️ CE QUE CE FICHIER GARDE. L'en-tête de `semaine.tsx` documente trois régressions réelles :
// (1) l'écran générait et ENREGISTRAIT sept jours de repas dès la première visite — composer une
// semaine est désormais un geste, jamais un effet de bord du montage ; (2) le bouton « Proposer une
// autre semaine » vivait AVANT les réglages qu'il consomme, on relançait un tirage puis on
// découvrait le réglage qu'on aurait voulu changer d'abord ; (3) `readPlan` rend `warnings: []` par
// construction — un plan restauré qui ne rappelle pas `checkPlan` perd silencieusement l'alerte de
// plancher calorique. Les tests ci-dessous vérifient ces trois points sur le vrai DOM, plus la
// chaîne des verrous (§7.2 ENGINE) et le reroll d'un seul créneau (`rerollSlot`), jamais testés.
//
// ⚠️ DÉFAUT CORRIGÉ (documenté ici jusqu'à sa correction, pour la trace) — le champ `seed`/`graine`
// était transporté de bout en bout (ui/screens/semaine.tsx → engine/planning/plan-week.ts →
// engine/api/index.ts) mais n'était LU NULLE PART dans la sélection : aucune trace au-delà d'une
// recopie en métadonnée. « Proposer une autre semaine » sans aucun verrou pouvait rendre EXACTEMENT
// le même plan qu'avant. Corrigé par le tirage seedé dans la bande de tolérance de
// `rankScoredCandidates` (engine/selection/scoring-pass.ts, `DEFAULT_VARIETY_TOLERANCE`) et la
// dérivation d'un flux par créneau (`derive`, engine/selection/prng.ts, appelée depuis
// `slotRequest`, plan-week.ts) — voir le test de variété ci-dessous, mesuré sur le catalogue réel.
//
// (L'AUTRE défaut signalé ici jusqu'à v7 — `readLatestPlan` triait sur `date_debut DESC, id DESC`
// et pouvait rouvrir un ancien plan après un changement de jours à date de début inchangée — est
// CORRIGÉ : `savePlan` écrit désormais `meal_plan.mis_a_jour_le`, et `readLatestPlan` trie dessus
// en premier. Voir data/user-store.ts et user-schema.ts, migration v7.)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MealPlanEntry, RecipeId, WeekPlan } from '../../engine/domain/index.js'
import { readLatestPlan, savePlan, writeDisplay } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

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

/** Monte l'écran, sans attendre d'état particulier. */
// ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT, PAS EN TÊTE DE FICHIER — voir
// `courses.test.tsx` : `vi.resetModules()` en `beforeEach` figerait sinon un `Context` React
// distinct de celui que `Semaine` utilise réellement dans `<LienTutoriel>`.
async function monter() {
  const { Semaine } = await import('./semaine.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
}

/** Monte et attend l'état de départ — aucune semaine composée. */
async function monterVide() {
  await monter()
  await screen.findByText('Composer ma semaine')
}

/** Monte, compose une semaine réelle et attend l'état « prêt ». */
async function composerSemaine() {
  await monterVide()
  fireEvent.click(screen.getByText('Composer ma semaine'))
  await screen.findByText('Proposer une autre semaine')
}

/** La carte d'un créneau, à partir d'un de ses deux boutons (« Changer »/« Choisir » ou « Garder »). */
function carteDuBouton(bouton: HTMLElement): HTMLElement {
  return bouton.parentElement!.parentElement!
}

describe('semaine — au premier lancement', () => {
  it('est VIDE : aucun plan écrit tant que rien n’a été demandé', async () => {
    // LE DÉFAUT QUE CE TEST GARDE — voir l'en-tête de `semaine.tsx` : l'écran composait et
    // sauvegardait sept jours de repas au montage. « Je n'ai rien planifié » doit rester exprimable.
    await monterVide()
    expect(screen.getByText(/Rien de prévu pour l.instant/)).toBeDefined()
    expect(readLatestPlan(baseCourante())).toBeNull()
  })
})

describe('semaine — composer un plan', () => {
  it('« Composer ma semaine » génère des repas réels et les écrit en base', async () => {
    await composerSemaine()
    const enregistre = readLatestPlan(baseCourante())
    expect(enregistre).not.toBeNull()
    expect(enregistre!.days).toBe(7)
    // Défaut du premier lancement : 2 repas/jour (déjeuner + dîner) × 7 jours.
    //
    // ⚠️ ON COMPTE LES CRÉNEAUX, PAS LES LIGNES DU PLAN. Depuis le mode repas (2026-08-04), un
    // déjeuner porte jusqu'à DEUX entrées — le plat et son accompagnement. Compter `entries` a
    // donné 28 le jour où la fonctionnalité est arrivée : le test aurait échoué sur un plan
    // parfaitement correct, et le réflexe aurait été de « réparer » le moteur.
    const creneauxServis = new Set(enregistre!.entries.map((e) => `${e.slot.date}|${e.slot.creneau}`))
    expect(creneauxServis.size).toBe(14)
    expect(enregistre!.entries.some((e) => e.recipeId !== null)).toBe(true)
    expect(document.querySelectorAll('a[href^="#/recette/"]').length).toBeGreaterThan(0)
  })
})

describe('semaine — les réglages', () => {
  it('sont AU-DESSUS de « Proposer une autre semaine » — ordre réel du DOM', async () => {
    // Le sujet de la correction : le bouton vivait dans l'en-tête, AVANT les réglages qu'il
    // consomme. On vérifie la position relative des nœuds, pas seulement leur présence.
    await composerSemaine()
    const champJours = screen.getByLabelText(/Nombre de jours/)
    const bouton = screen.getByText('Proposer une autre semaine')
    const relation = champJours.compareDocumentPosition(bouton)
    expect(Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('changer le nombre de jours réplanifie l’écran', async () => {
    // ⚠️ NE VÉRIFIE PAS `readLatestPlan` ICI — voir le défaut rapporté en tête de fichier
    // (id de plan collisionnant sur `startDate`) : la lecture la plus récente peut rendre
    // l'ANCIEN plan quand seul le nombre de jours change. L'écran, lui, se met bien à jour ; ce
    // test s'arrête volontairement là où la lecture cesse d'être fiable.
    await composerSemaine()
    const champJours = screen.getByLabelText(/Nombre de jours/) as HTMLInputElement
    fireEvent.change(champJours, { target: { value: '3' } })
    fireEvent.blur(champJours)
    await waitFor(() => expect(document.querySelectorAll('article').length).toBe(3))
  })

  it('changer « Repas par jour » ajoute les créneaux correspondants au plan enregistré', async () => {
    await composerSemaine()
    const selectRepas = screen.getByLabelText('Repas par jour') as HTMLSelectElement
    fireEvent.change(selectRepas, { target: { value: '3' } })
    await waitFor(() => {
      const creneaux = new Set(readLatestPlan(baseCourante())!.entries.map((e) => e.slot.creneau))
      expect(creneaux.has('petit_dejeuner')).toBe(true)
    })
  })
})

describe('semaine — changer un plat', () => {
  it('« Changer » reroll UNIQUEMENT le créneau visé, et l’écrit en base', async () => {
    // `rerollSlot` est censé ne toucher qu'un créneau — le reste du plan doit survivre à l'identique.
    //
    // ⚠️ REPÉRAGE PAR (date, créneau, service), PAS PAR INDICE. Un créneau porte désormais jusqu'à
    // deux entrées : indexer positionnellement ferait comparer le plat de lundi à l'accompagnement
    // de lundi dès que leur nombre change. Et « Changer » vise LE PLAT — reproposer le riz à la
    // place du poulet n'aurait aucun sens (voir `reroll-slot.ts`).
    await composerSemaine()
    const cle = (e: MealPlanEntry): string => `${e.slot.date}|${e.slot.creneau}|${e.service ?? ''}`
    const avant = new Map(readLatestPlan(baseCourante())!.entries.map((e) => [cle(e), e.recipeId]))

    const premier = readLatestPlan(baseCourante())!.entries.find((e) => e.service !== 'accompagnement')!
    const cleCible = cle(premier)

    fireEvent.click(screen.getAllByText('Changer')[0]!)

    await waitFor(() => {
      const apres = new Map(readLatestPlan(baseCourante())!.entries.map((e) => [cle(e), e.recipeId]))
      expect(apres.get(cleCible)).not.toBe(avant.get(cleCible))
    })

    const apres = new Map(readLatestPlan(baseCourante())!.entries.map((e) => [cle(e), e.recipeId]))
    for (const [k, recipeId] of avant) {
      if (k === cleCible) continue
      expect(apres.get(k)).toBe(recipeId)
    }
  })
})

describe('semaine — les verrous', () => {
  it('⛔ UN REPAS GARDÉ SURVIT À UNE RÉGÉNÉRATION', async () => {
    // LA CHAÎNE QUI COMPTE (§7.2 ENGINE) : « vos repas gardés ne changeront pas » n'est vraie que si
    // `lockedEntries` est effectivement reposé APRÈS coup — voir l'avertissement de `planifier` dans
    // `semaine.tsx`. Verrouiller une case sans vérifier la regénération ne prouverait rien.
    //
    // ⚠️ NE VÉRIFIE PAS QUE LES AUTRES CRÉNEAUX CHANGENT — voir l'en-tête de fichier : `seed`
    // influence désormais la sélection (tirage dans la bande de tolérance), mais RIEN ne garantit
    // qu'un incrément de graine change TEL créneau précis avec un seul catalogue de test réduit —
    // la variété mesurée à l'échelle vit dans plan-week.test.ts, sur le catalogue réel. Ce test se
    // limite à ce qui est garanti à coup sûr : l'entrée gardée traverse la régénération intacte, et
    // « Changer » lui reste interdit.
    await composerSemaine()

    const boutonGarder = screen.getAllByText('Garder')[0]!.closest('button') as HTMLButtonElement
    const carte = carteDuBouton(boutonGarder)

    fireEvent.click(boutonGarder)
    await waitFor(() => expect(boutonGarder.getAttribute('aria-pressed')).toBe('true'))

    // Un créneau verrouillé est aussi invisible pour « Changer » — sinon on pourrait remplacer à la
    // main ce qu'on vient de dire vouloir garder.
    const boutonChanger = [...carte.querySelectorAll('button')].find((b) => b.textContent === 'Changer')!
    expect(boutonChanger.disabled).toBe(true)

    // ⚠️ MÊME PIÈGE QUE PLUS HAUT : on retrouve le créneau gardé par sa (date, créneau), pas par
    // son indice. Une régénération ne rend pas forcément le même NOMBRE d'entrées — un plat sans
    // accompagnement possible en produit une, un plat accompagné en produit deux.
    const avecVerrou = readLatestPlan(baseCourante())!.entries
    const verrou = avecVerrou.find((e) => e.locked && e.service !== 'accompagnement')
    expect(verrou).toBeDefined()
    const recetteGardee = verrou!.recipeId
    const memeSlot = (e: MealPlanEntry): boolean =>
      e.slot.date === verrou!.slot.date && e.slot.creneau === verrou!.slot.creneau

    fireEvent.click(screen.getByText('Proposer une autre semaine'))
    await waitFor(() => {
      const apres = readLatestPlan(baseCourante())!.entries.find(memeSlot)
      expect(apres?.locked).toBe(true)
    })

    const apres = readLatestPlan(baseCourante())!.entries.find(memeSlot)
    expect(apres!.recipeId).toBe(recetteGardee)
  })
})

describe('semaine — les alertes d’énergie', () => {
  // Un plan écrit à la main, avec une recette FICTIVE (aucune entrée dans les nutriments du
  // catalogue) : `checkCalorieFloor` compte 0 kcal pour les deux créneaux principaux, ce qui
  // déclenche l'avertissement à coup sûr, sans dépendre des valeurs caloriques réelles du catalogue.
  const RECETTE_FICTIVE = 'recette-inexistante-pour-le-test' as RecipeId
  function planAvecAlerte(): WeekPlan {
    return {
      id: 'plan-test-alerte',
      startDate: '2026-08-03',
      days: 1,
      seed: 1,
      entries: [
        {
          slot: { date: '2026-08-03', creneau: 'dejeuner' },
          recipeId: RECETTE_FICTIVE,
          portions: 1,
          locked: false,
          isLeftover: false,
          service: null,
        },
        {
          slot: { date: '2026-08-03', creneau: 'diner' },
          recipeId: RECETTE_FICTIVE,
          portions: 1,
          locked: false,
          isLeftover: false,
          service: null,
        },
      ],
      warnings: [],
    }
  }

  /** Fonction utilitaire : le réglage `afficher_macros` (Paramètres) gouverne le mode avancé. */
  function activerModeAvance() {
    writeDisplay(baseCourante(), {
      afficherMacros: true,
      gestesBalayage: false,
      alertesDiscretes: false,
      bandeauStockageMasque: false,
      rappelsActifs: false,
      visiteProposee: false,
    })
  }

  it('mode avancé INACTIF (le défaut) : l’avertissement n’apparaît nulle part à l’écran', async () => {
    // AMENDEMENT du 2026-08-02 (ARCHITECTURE.md §6.5) : l'avertissement de plancher n'est plus
    // affiché par défaut, seulement en mode avancé. `checkCalorieFloor` tourne toujours et
    // `WeekPlan.warnings` reste peuplé — seul l'AFFICHAGE devient conditionnel. Regex, pas
    // `queryByText` sur une chaîne nue : un `null` ne prouve rien si le libellé réel diffère d'un
    // préfixe — voir FICHE_REPRISE.md.
    savePlan(baseCourante(), planAvecAlerte(), '2026-08-01T00:00:00.000Z')
    await monter()
    await screen.findByText('Proposer une autre semaine')

    expect(screen.queryByText(/repas prévus restent sous le seuil/)).toBeNull()
    expect(screen.queryByText(/journée.*à surveiller/)).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('mode avancé actif : le marqueur reste visible en permanence, le détail s’ouvre en fenêtre au tap', async () => {
    // §6.5 ARCHITECTURE : une fois monté (mode avancé actif), le marqueur ne doit JAMAIS être
    // absent. Le détail (une ligne par jour) ne s'affiche plus en bloc sous le marqueur — il
    // s'ouvre désormais dans une fenêtre en superposition (`Panneau`), c'est le sujet de la
    // correction documentée en tête de `AlerteEnergie` dans `semaine.tsx`.
    activerModeAvance()
    savePlan(baseCourante(), planAvecAlerte(), '2026-08-01T00:00:00.000Z')
    await monter()
    await screen.findByText('Proposer une autre semaine')

    // Le détail n'est nulle part dans le DOM tant que la fenêtre n'a pas été ouverte — ni en bloc
    // sous le marqueur (l'ancien comportement), ni déjà présent dans un panneau caché.
    expect(screen.queryByText(/Seuil de vigilance/)).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    const marqueur = screen.getByText(/les repas prévus restent sous le seuil de vigilance/)
    const boutonDetail = marqueur.closest('button')!
    // `aria-haspopup="dialog"`, PAS `aria-expanded` : ce bouton ouvre une fenêtre, il n'allonge
    // rien en place (voir filtres-recettes.tsx pour le même patron).
    expect(boutonDetail.getAttribute('aria-haspopup')).toBe('dialog')
    expect(boutonDetail.hasAttribute('aria-expanded')).toBe(false)

    fireEvent.click(boutonDetail)
    const dialogue = await screen.findByRole('dialog')
    // ⚠️ CE QUE CES TROIS ATTENTES GARDENT (2026-08-04) : le texte disait « une journée apporte
    // moins d'énergie que la référence habituelle », ce qui était faux deux fois. Ce qui est
    // additionné, ce sont les repas PRÉVUS — pas ce que la personne mange ; et 1 500 kcal est un
    // SEUIL DE VIGILANCE, pas une référence (elle tourne autour de 2 000).
    expect(within(dialogue).getByText(/2 repas prévus/)).toBeDefined()
    expect(within(dialogue).getByText(/Seuil de vigilance : 1500 kcal pour une journée entière/)).toBeDefined()
    expect(within(dialogue).getByText(/ne compte que les recettes de votre plan/)).toBeDefined()

    // « ← Retour » referme la fenêtre — ciblé par regex : le libellé réel porte la flèche.
    fireEvent.click(within(dialogue).getByText(/Retour/))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Le marqueur, lui, n'a jamais bougé.
    expect(screen.getByText(/les repas prévus restent sous le seuil de vigilance/)).toBeDefined()
  })

  it('mode avancé actif : n’allonge pas la semaine en dessous — la fenêtre de détail est un enfant direct de document.body', async () => {
    // Le point de fond de la conversion en superposition (voir panneau.tsx) : le `dialog` doit être
    // un enfant du PORTAIL (document.body), jamais un nœud inséré dans le flux des journées — sinon
    // ouvrir le détail repousserait la liste des repas vers le bas exactement comme avant.
    activerModeAvance()
    savePlan(baseCourante(), planAvecAlerte(), '2026-08-01T00:00:00.000Z')
    await monter()
    await screen.findByText('Proposer une autre semaine')

    const marqueur = screen.getByText(/les repas prévus restent sous le seuil de vigilance/)
    fireEvent.click(marqueur.closest('button')!)

    const dialogue = await screen.findByRole('dialog')
    expect(dialogue.parentElement).toBe(document.body)
  })
})
