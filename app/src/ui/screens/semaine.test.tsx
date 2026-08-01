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
// ⚠️ DEUX DÉFAUTS RÉELS TROUVÉS EN ÉCRIVANT CE FICHIER, NON CORRIGÉS (hors périmètre de ce
// fichier) — signalés au lieu d'être masqués par un test affaibli :
//
//   1. `readLatestPlan` (data/user-store.ts:434-439) trie par `date_debut DESC, id DESC`, et
//      `planWeek` construit l'id en `plan-${startDate}-${days}` (engine/planning/plan-week.ts:240).
//      Changer le nombre de jours SANS changer de date (le cas courant : `startDate` est toujours
//      « aujourd'hui ») crée une DEUXIÈME ligne dans `meal_plan` au lieu de remplacer la première —
//      les deux partagent `date_debut`, et le tri retombe sur l'id, comparé comme du texte :
//      « plan-2026-08-01-7 » > « plan-2026-08-01-3 » lexicographiquement. `readLatestPlan` peut
//      donc rendre l'ANCIEN plan après un changement de jours. L'écran affiche correctement l'état
//      courant (React ne repasse pas par la base), mais un rechargement de page rouvrirait le
//      mauvais plan.
//   2. Le champ `seed`/`graine` est transporté de bout en bout (ui/screens/semaine.tsx →
//      engine/planning/plan-week.ts:243 → engine/api/index.ts:435) mais n'est LU NULLE PART dans la
//      sélection (`engine/selection/*`) : aucune trace au-delà d'une recopie en métadonnée.
//      Conséquence : « Proposer une autre semaine » sans aucun verrou peut rendre EXACTEMENT le
//      même plan qu'avant, la sélection étant par ailleurs déterministe (profil, historique,
//      contraintes inchangés). Constaté avec le catalogue réel du dépôt : 0 créneau différent sur
//      14 après régénération.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { RecipeId, WeekPlan } from '../../engine/domain/index.js'
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
async function monter() {
  const { Semaine } = await import('./semaine.js')
  render(<Semaine />)
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
    expect(enregistre!.entries.length).toBe(14)
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
    await composerSemaine()
    const avant = readLatestPlan(baseCourante())!.entries
    const indexCible = 0 // premier jour, premier créneau (déjeuner) — premier bouton rendu à l'écran.

    fireEvent.click(screen.getAllByText('Changer')[0]!)

    await waitFor(() => {
      const apres = readLatestPlan(baseCourante())!.entries
      expect(apres[indexCible]!.recipeId).not.toBe(avant[indexCible]!.recipeId)
    })

    const apres = readLatestPlan(baseCourante())!.entries
    for (let i = 0; i < avant.length; i++) {
      if (i === indexCible) continue
      expect(apres[i]!.recipeId).toBe(avant[i]!.recipeId)
    }
  })
})

describe('semaine — les verrous', () => {
  it('⛔ UN REPAS GARDÉ SURVIT À UNE RÉGÉNÉRATION', async () => {
    // LA CHAÎNE QUI COMPTE (§7.2 ENGINE) : « vos repas gardés ne changeront pas » n'est vraie que si
    // `lockedEntries` est effectivement reposé APRÈS coup — voir l'avertissement de `planifier` dans
    // `semaine.tsx`. Verrouiller une case sans vérifier la regénération ne prouverait rien.
    //
    // ⚠️ NE VÉRIFIE PAS QUE LES AUTRES CRÉNEAUX CHANGENT — voir le défaut n°2 en tête de fichier :
    // la sélection est déterministe et `seed` n'influence rien, donc une régénération sans verrou
    // peut rendre un plan identique. Ce test se limite à ce qui est vrai : l'entrée gardée traverse
    // la régénération intacte, et « Changer » lui reste interdit.
    await composerSemaine()

    const boutonGarder = screen.getAllByText('Garder')[0]!.closest('button') as HTMLButtonElement
    const carte = carteDuBouton(boutonGarder)

    fireEvent.click(boutonGarder)
    await waitFor(() => expect(boutonGarder.getAttribute('aria-pressed')).toBe('true'))

    // Un créneau verrouillé est aussi invisible pour « Changer » — sinon on pourrait remplacer à la
    // main ce qu'on vient de dire vouloir garder.
    const boutonChanger = [...carte.querySelectorAll('button')].find((b) => b.textContent === 'Changer')!
    expect(boutonChanger.disabled).toBe(true)

    const avecVerrou = readLatestPlan(baseCourante())!.entries
    const indexVerrou = avecVerrou.findIndex((e) => e.locked)
    expect(indexVerrou).toBeGreaterThanOrEqual(0)
    const recetteGardee = avecVerrou[indexVerrou]!.recipeId

    fireEvent.click(screen.getByText('Proposer une autre semaine'))
    await waitFor(() => {
      const apres = readLatestPlan(baseCourante())!.entries
      expect(apres[indexVerrou]!.locked).toBe(true)
    })

    const apres = readLatestPlan(baseCourante())!.entries
    expect(apres[indexVerrou]!.recipeId).toBe(recetteGardee)
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

  it('le marqueur reste visible en permanence, le détail s’ouvre en fenêtre au tap', async () => {
    // §6.5 ARCHITECTURE : le marqueur ne doit JAMAIS être absent. Le détail (une ligne par jour) ne
    // s'affiche plus en bloc sous le marqueur — il s'ouvre désormais dans une fenêtre en
    // superposition (`Panneau`), c'est le sujet de la correction documentée en tête de
    // `AlerteEnergie` dans `semaine.tsx`.
    savePlan(baseCourante(), planAvecAlerte())
    await monter()
    await screen.findByText('Proposer une autre semaine')

    // Le détail n'est nulle part dans le DOM tant que la fenêtre n'a pas été ouverte — ni en bloc
    // sous le marqueur (l'ancien comportement), ni déjà présent dans un panneau caché.
    expect(screen.queryByText(/kcal pour une référence de/)).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    const marqueur = screen.getByText(/Une journée apporte moins d.énergie/)
    const boutonDetail = marqueur.closest('button')!
    // `aria-haspopup="dialog"`, PAS `aria-expanded` : ce bouton ouvre une fenêtre, il n'allonge
    // rien en place (voir filtres-recettes.tsx pour le même patron).
    expect(boutonDetail.getAttribute('aria-haspopup')).toBe('dialog')
    expect(boutonDetail.hasAttribute('aria-expanded')).toBe(false)

    fireEvent.click(boutonDetail)
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText(/kcal pour une référence de 1500 kcal/)).toBeDefined()

    // « ← Retour » referme la fenêtre — ciblé par regex : le libellé réel porte la flèche.
    fireEvent.click(within(dialogue).getByText(/Retour/))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Le marqueur, lui, n'a jamais bougé.
    expect(screen.getByText(/Une journée apporte moins d.énergie/)).toBeDefined()
  })

  it('n’allonge pas la semaine en dessous : la fenêtre de détail est un enfant direct de document.body', async () => {
    // Le point de fond de la conversion en superposition (voir panneau.tsx) : le `dialog` doit être
    // un enfant du PORTAIL (document.body), jamais un nœud inséré dans le flux des journées — sinon
    // ouvrir le détail repousserait la liste des repas vers le bas exactement comme avant.
    savePlan(baseCourante(), planAvecAlerte())
    await monter()
    await screen.findByText('Proposer une autre semaine')

    const marqueur = screen.getByText(/Une journée apporte moins d.énergie/)
    fireEvent.click(marqueur.closest('button')!)

    const dialogue = await screen.findByRole('dialog')
    expect(dialogue.parentElement).toBe(document.body)
  })

  it('le réglage « alertes discrètes » raccourcit le résumé, sans faire disparaître le marqueur', async () => {
    // Le code est explicite là-dessus : « NI L'UN NI L'AUTRE ne fait disparaître le marqueur ».
    // `alertesDiscretes` change le TEXTE, pas la présence de l'alerte — ce test vérifie exactement
    // ce que le code fait, pas ce qu'un nom de réglage pourrait laisser supposer.
    writeDisplay(baseCourante(), {
      afficherMacros: false,
      gestesBalayage: false,
      alertesDiscretes: true,
      bandeauStockageMasque: false,
      rappelsActifs: false,
    })
    savePlan(baseCourante(), planAvecAlerte())
    await monter()
    await screen.findByText('Proposer une autre semaine')

    expect(screen.queryByText(/Une journée apporte moins d.énergie/)).toBeNull()
    const resume = screen.getByText(/1 journée à surveiller/)
    fireEvent.click(resume.closest('button')!)

    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText(/kcal pour une référence de/)).toBeDefined()
  })
})
