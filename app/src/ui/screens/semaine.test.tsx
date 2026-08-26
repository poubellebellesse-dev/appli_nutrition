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
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from '../test-socle.js'

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

  it('changer le nombre de jours réplanifie l’écran ET le plan enregistré', async () => {
    // ⛔ CE TEST S'EST PRIVÉ DE `readLatestPlan` JUSQU'AU 2026-08-26, en se réclamant d'un défaut
    // que l'en-tête de ce fichier donne pour CORRIGÉ (migration v7 : `savePlan` écrit
    // `meal_plan.mis_a_jour_le`, et `readLatestPlan` trie dessus en premier). Le contournement a
    // survécu à sa cause — et c'est LUI qui tombait : le 2026-08-26, sur quatre exécutions du même
    // arbre, la plus lente (71,6 s d'horloge contre 46,3 s) a rendu « Expected 3, Received 7 ».
    // Compter les `<article>` mesure le DOM des SEPT jours d'avant tant que le remplacement n'a
    // pas eu lieu, et `waitFor` abandonnait à 1 s (`asyncUtilTimeout` — voir tests/setup-jsdom.ts).
    // ▶ Le test suivant lit `readLatestPlan` sans difficulté : celui-ci n'avait aucune raison de
    // s'en priver. On attend le PLAN ENREGISTRÉ, puis on vérifie que l'écran le suit.
    await composerSemaine()
    const champJours = screen.getByLabelText(/Nombre de jours/) as HTMLInputElement
    fireEvent.change(champJours, { target: { value: '3' } })
    fireEvent.blur(champJours)
    await waitFor(() => {
      const jours = new Set(readLatestPlan(baseCourante())!.entries.map((e) => e.slot.date))
      expect(jours.size).toBe(3)
    })
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
    // ⚠️ L'EXEMPTION PORTE SUR LE CRÉNEAU ENTIER, PAS SUR LA SEULE ENTRÉE VISÉE. « Changer » rejoue
    // le plat ET son accompagnement (décision 54) : reproposer le poulet en laissant la purée à côté
    // laisserait une garniture sans rapport avec le plat. L'accompagnement du créneau visé a donc
    // TOUJOURS le droit de changer.
    //
    // ⛔ CE TEST PASSAIT PAR CHANCE, et il l'a avoué le 2026-08-06. En exemptant la seule clé
    // (date, créneau, SERVICE), il exigeait que l'accompagnement du créneau visé reste identique —
    // l'inverse de ce que `rerollSlot` promet. Il restait vert parce qu'avec 21 accompagnements au
    // catalogue le tirage retombait souvent sur le même ; passé à 39, il tombe sur un autre. Un test
    // dont le résultat dépend de la TAILLE du catalogue ne vérifiait pas ce qu'il annonçait.
    const creneauCible = `${premier.slot.date}|${premier.slot.creneau}|`

    fireEvent.click(screen.getAllByText('Changer')[0]!)

    await waitFor(() => {
      const apres = new Map(readLatestPlan(baseCourante())!.entries.map((e) => [cle(e), e.recipeId]))
      expect(apres.get(cleCible)).not.toBe(avant.get(cleCible))
    })

    const apres = new Map(readLatestPlan(baseCourante())!.entries.map((e) => [cle(e), e.recipeId]))
    for (const [k, recipeId] of avant) {
      if (k.startsWith(creneauCible)) continue
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
          horsCatalogue: null,
          portions: 1,
          locked: false,
          isLeftover: false,
          service: null,
        },
        {
          slot: { date: '2026-08-03', creneau: 'diner' },
          recipeId: RECETTE_FICTIVE,
          horsCatalogue: null,
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

describe('semaine — « Choisir » CHOISIT, il ne tire pas (décision 49)', () => {
  // ⚠️ LE DÉFAUT QUE CE BLOC GARDE. Sur un créneau vide, le bouton s'intitulait « Choisir » et
  // appelait `rerollSlot` — un TIRAGE. Le libellé promettait un choix et rendait un hasard. C'est la
  // classe de défaut que ce projet rencontre en boucle sous d'autres formes (`note_allergene`,
  // filtre d'allergènes sur liste vide, `Recipe.service` déclaré mais jamais lu) : l'écart entre ce
  // qui est ANNONCÉ et ce qui est BRANCHÉ.

  it('⛔ le bouton de TIRAGE ne s’appelle plus « Choisir » — les mots disent l’acte', async () => {
    await composerSemaine()

    // « Changer » sur un créneau rempli, « Proposer » sur un vide : les deux tirent, et aucun des
    // deux ne prétend choisir. « Choisir » existe à côté, et ouvre la fenêtre.
    expect(screen.getAllByText('Changer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Choisir').length).toBeGreaterThan(0)
    for (const bouton of screen.getAllByText('Choisir')) {
      expect(bouton.closest('button')!.getAttribute('aria-haspopup')).toBe('dialog')
    }
  })

  it('ouvre une fenêtre à trois sources, et le titre dit OÙ le plat se posera', async () => {
    await composerSemaine()
    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)

    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText(/Choisir un plat —/)).toBeDefined()
    expect(within(dialogue).getByRole('tab', { name: 'Chercher une recette' })).toBeDefined()
    expect(within(dialogue).getByRole('tab', { name: 'Avec ce que j’ai' })).toBeDefined()
    // Troisième source depuis la décision 51 : « j'ai un dîner prévu et ce n'est pas une recette »
    // est une façon de remplir un créneau, pas une fonctionnalité à part.
    expect(within(dialogue).getByRole('tab', { name: 'Un plat préparé' })).toBeDefined()
  })

  it('⛔ POSE LA RECETTE DÉSIGNÉE, et l’écrit en base', async () => {
    // Le cœur du lot : ce qu'on tape dans la fenêtre est ce qui atterrit dans le plan. Un tirage
    // « amélioré » qui rendrait autre chose serait le même mensonge sous un autre habillage.
    await composerSemaine()
    const avant = readLatestPlan(baseCourante())!.entries
    const premier = avant.find((e) => e.service !== 'accompagnement')!

    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)
    const dialogue = await screen.findByRole('dialog')

    // La première recette proposée par la fenêtre, quelle qu'elle soit — on ne teste pas le
    // classement de `browseRecipes` ici, seulement que le clic pose CE plat-là.
    const boutons = within(dialogue).getAllByRole('button')
    const choix = boutons.find((b) => b.textContent !== null && b.getAttribute('role') !== 'tab' && !/Retour/.test(b.textContent))!
    const nomChoisi = choix.textContent

    fireEvent.click(choix)

    await waitFor(() => {
      const apres = readLatestPlan(baseCourante())!.entries.find(
        (e) => e.slot.date === premier.slot.date && e.slot.creneau === premier.slot.creneau && e.service !== 'accompagnement'
      )
      const nom = catalogueDeTest().recipes.get(apres!.recipeId!)?.nom
      expect(nomChoisi).toContain(nom)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // --- Plats préparés (décision 51, issue « (a) ») ---------------------------------------------

  it('⛔ POSE LE PLAT PRÉPARÉ, l’écrit en base, et l’AFFICHE — les trois, pas deux sur trois', async () => {
    // ⚠️ CE TEST EXISTE POUR LE TROISIÈME MAILLON. Un champ écrit en base et jamais relu à l'écran
    // ne casse rien : le créneau affiche « Aucun plat » et personne ne voit passer l'oubli. C'est
    // exactement `note_allergene` et `Recipe.service`, deux fois déjà.
    await composerSemaine()
    const avant = readLatestPlan(baseCourante())!.entries
    const premier = avant.find((e) => e.service !== 'accompagnement')!

    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)
    const dialogue = await screen.findByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('tab', { name: 'Un plat préparé' }))

    const champ = within(dialogue).getByRole('textbox')
    fireEvent.change(champ, { target: { value: '  Lasagnes surgelées  ' } })
    fireEvent.click(within(dialogue).getByText('Poser ce plat'))

    await waitFor(() => {
      const apres = readLatestPlan(baseCourante())!.entries.find(
        (e) => e.slot.date === premier.slot.date && e.slot.creneau === premier.slot.creneau && e.service !== 'accompagnement'
      )
      // Nettoyé au passage : un libellé encadré d'espaces ne doit pas devenir la vérité en base.
      expect(apres!.horsCatalogue).toBe('Lasagnes surgelées')
      expect(apres!.recipeId).toBeNull()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    // À l'écran, et PAS sous « Aucun plat » : le créneau est rempli.
    expect(screen.getByText('Lasagnes surgelées')).toBeDefined()
  })

  it('dit à l’écran que l’appli ne connaît pas cet apport — sinon son silence passe pour un oubli', async () => {
    // C'est la contrepartie visible de la décision 51 : l'alerte de plancher calorique ne se
    // déclenche plus sur cette journée, et l'utilisateur ne peut pas le deviner. Formulé comme un
    // fait sur ce que l'application SAIT, jamais comme un reproche sur ce qui est mangé (principe 6).
    await composerSemaine()
    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)
    const dialogue = await screen.findByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('tab', { name: 'Un plat préparé' }))

    // Annoncé AVANT le geste, dans la fenêtre.
    expect(within(dialogue).getByText(/ne connaîtra pas ce que ce repas apporte/)).toBeDefined()

    fireEvent.change(within(dialogue).getByRole('textbox'), { target: { value: 'Restaurant' } })
    fireEvent.click(within(dialogue).getByText('Poser ce plat'))

    // Et rappelé APRÈS, sur la carte du créneau.
    await waitFor(() => expect(screen.getByText(/l’application ne connaît pas ce qu’il apporte/)).toBeDefined())
  })

  it('⛔ NE DEMANDE NI CALORIES NI QUANTITÉ — c’est l’arbitrage, pas un manque', async () => {
    // L'issue (b) de la décision 51 (saisie d'énergie facultative) a été écartée : un nombre tapé
    // par l'utilisateur se mélangerait aux valeurs CIQUAL sans provenance (principe 3). Un champ
    // « quantité mangée » est en outre nommément interdit par §6.5 ARCHITECTURE. Si ce test rougit,
    // quelqu'un a rouvert une décision tranchée en ajoutant un champ « pendant qu'on y est ».
    await composerSemaine()
    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)
    const dialogue = await screen.findByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('tab', { name: 'Un plat préparé' }))

    expect(within(dialogue).queryAllByRole('spinbutton')).toHaveLength(0)
    expect(within(dialogue).queryByText(/kcal|calorie|quantité/i)).toBeNull()
  })

  it('un libellé blanc ne pose rien — un créneau occupé par rien éteindrait l’alerte en silence', async () => {
    await composerSemaine()
    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)
    const dialogue = await screen.findByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('tab', { name: 'Un plat préparé' }))

    fireEvent.change(within(dialogue).getByRole('textbox'), { target: { value: '   ' } })
    expect((within(dialogue).getByText('Poser ce plat') as HTMLButtonElement).disabled).toBe(true)
  })

  it('un créneau GARDÉ n’est pas choisissable — pas de porte dérobée sur un verrou', async () => {
    // §7.2 : un créneau gardé est « invisible pour toute replanification ». Un geste manuel ne doit
    // pas être le chemin par lequel on écrase ce qu'on vient de dire vouloir garder.
    await composerSemaine()
    const boutonGarder = screen.getAllByText('Garder')[0]!.closest('button') as HTMLButtonElement
    const carte = carteDuBouton(boutonGarder)

    fireEvent.click(boutonGarder)
    await waitFor(() => expect(boutonGarder.getAttribute('aria-pressed')).toBe('true'))

    const boutonChoisir = [...carte.querySelectorAll('button')].find((b) => b.textContent === 'Choisir')!
    expect(boutonChoisir.disabled).toBe(true)
  })
})

describe('semaine — le garde-manger périmé se fait confirmer avant de servir', () => {
  // ⚠️ CE QUE CE BLOC GARDE : un garde-manger de trois semaines produisait des recettes « réalisables
  // avec ce que vous avez » fondées sur des aliments qu'on n'a plus, sans que rien ne le dise. C'est
  // le grief n°1 relevé sur les applications comparables — voir reference/CONCURRENCE_ET_ATTENTES.md.

  async function ouvrirOngletFrigo() {
    fireEvent.click(screen.getAllByText('Choisir')[0]!.closest('button')!)
    const dialogue = await screen.findByRole('dialog')
    fireEvent.click(within(dialogue).getByRole('tab', { name: 'Avec ce que j’ai' }))
    return dialogue
  }

  it('⛔ NE PROPOSE RIEN tant que la question n’a pas été répondue', async () => {
    const { writePantry } = await import('../../data/user-store.js')
    const foods = [...catalogueDeTest().foods.keys()].slice(0, 3)
    writePantry(baseCourante(), foods.map((foodId) => ({ foodId, quantiteApprox: null })), '2026-01-01')

    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo()

    expect(within(dialogue).getByText(/Vous les avez toujours/)).toBeDefined()
    expect(within(dialogue).queryByText(/du mieux couvert/)).toBeNull()
  })

  it('un garde-manger déclaré AUJOURD’HUI n’est pas questionné — l’appli ne réclame rien', async () => {
    const { writePantry } = await import('../../data/user-store.js')
    const { aujourdhuiIso } = await import('../socle.js')
    const foods = [...catalogueDeTest().foods.keys()].slice(0, 3)
    writePantry(baseCourante(), foods.map((foodId) => ({ foodId, quantiteApprox: null })), aujourdhuiIso())

    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo()

    expect(within(dialogue).queryByText(/Vous les avez toujours/)).toBeNull()
  })

  it('⛔ DÉCOCHER RETIRE POUR DE BON — la question ne se repose pas à l’identique', async () => {
    const { writePantry, readPantryFoodIds } = await import('../../data/user-store.js')
    const foods = [...catalogueDeTest().foods.keys()].slice(0, 3)
    writePantry(baseCourante(), foods.map((foodId) => ({ foodId, quantiteApprox: null })), '2026-01-01')

    await composerSemaine()
    const dialogue = await ouvrirOngletFrigo()

    const cases = within(dialogue).getAllByRole('checkbox')
    expect(cases).toHaveLength(3)
    fireEvent.click(cases[0]!)
    fireEvent.click(within(dialogue).getByText(/Continuer avec 2 aliments/))

    await waitFor(() => expect(readPantryFoodIds(baseCourante())).toHaveLength(2))
  })
})
