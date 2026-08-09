// app/src/cli/stress-planning.ts — banc de STRESS du planning (`npm run engine:plan-stress`).
//
// Met `planWeek` sous contrainte sur le catalogue RÉEL, à travers 20 configurations plutôt qu'une
// seule. Ce n'est pas un doublon des tests unitaires : ceux-ci vérifient la logique du glouton avec
// une suggestion factice, celui-ci exerce le VRAI pipeline sur les VRAIES données.
//
// ⚠️ IL A DÉJÀ TROUVÉ UN BUG que la suite de tests ne pouvait pas voir : `slotRequest` ne fixait pas
// `limit`, donc `suggestMeals` ne rendait que 5 candidats et un créneau restait vide dès que ces 5
// étaient déjà placés. Invisible avec une suggestion factice, flagrant sur 14 jours réels
// (39 créneaux remplis sur 42). Garder ce banc, et le relancer après toute modification du glouton.
//
// Ce qu'on cherche : un plantage, un doublon, un créneau vide inexpliqué, un non-déterminisme, ou
// un régime/allergène qui vide le catalogue sans que rien ne le dise.
//
// ⛔ TROIS ÉTATS, ET LE TROISIÈME EXISTE À CAUSE D'UN ANGLE MORT PAYÉ LE 2026-08-06.
// Ce banc affichait « 20/20 configurations saines » pendant que le régime végétalien tournait à
// **18 accompagnements posés sur 28 attendus** et que « végétalien + sans gluten » laissait
// **17 créneaux VIDES sur 56**. Les deux nombres étaient à l'écran, dans la colonne detail — ils ne
// faisaient simplement rien rougir. Une session entière a été engagée sur un diagnostic faux
// (« il manque des accompagnements ») que ce banc aurait pu contredire s'il avait compté.
// Le même piège est déjà consigné dans `pickForSlot` : « LE BANC N'A RIEN DIT », dix créneaux vides
// de plus sans un seul KO. C'est la deuxième fois.
//
//   ÉCHEC (KO, exit 1)  — le moteur est FAUX : plantage, doublon de plat, non-déterminisme,
//                         mauvais nombre de créneaux posés. C'est un bug, il bloque.
//   SIGNAL (exit 0)     — le moteur est correct mais le CATALOGUE ne suit pas : créneaux vides,
//                         accompagnements manquants. Ce n'est pas un bug, c'est du contenu à
//                         écrire, et le corriger demande d'ÉCRIRE DES RECETTES, pas de coder.
//   OK                  — ni l'un ni l'autre.
//
// ⚠️ POURQUOI SIGNAL NE FAIT PAS ÉCHOUER, et ce n'est pas de la complaisance. `engine:plan-stress`
// est l'une des QUATRE COMMANDES qui font foi (CLAUDE.md) : le rendre rouge sur un manque de contenu
// connu bloquerait toute tâche, y compris celles qui n'ont aucun rapport, et la première réaction
// serait de le contourner. Un signal qu'on ne peut pas ignorer sans le voir vaut mieux qu'un rouge
// qu'on apprend à ignorer. ⛔ Ne pas « simplifier » en le repliant sur `ok`.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { createEngine } from '../engine/api/index.js'
import { attachDerivedIndexes } from '../engine/nutrition/index.js'
import type { AllergenId, DietCode, MealSlot, UserProfile, WeekPlanRequest } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')
const catalog = attachDerivedIndexes(loadCatalog(dbPath))
const engine = createEngine(loadCatalog(dbPath))
const energyIndex = catalog.nutrients.findIndex((n) => n.code === 'energie')

const FEMME: UserProfile = {
  trancheAge: '30_49',
  sexe: 'F',
  niveauActivite: 'actif',
  tailleCm: 165,
  poidsKg: 62,
  facteurPortion: 1,
}
const HOMME: UserProfile = { ...FEMME, sexe: 'M', tailleCm: 178, poidsKg: 78 }
const SENIOR: UserProfile = { ...FEMME, trancheAge: '65_plus', niveauActivite: 'sedentaire' }

function req(o: Partial<WeekPlanRequest> = {}): WeekPlanRequest {
  return {
    profile: FEMME,
    constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null },
    startDate: '2026-08-03',
    days: 7,
    slots: ['petit_dejeuner', 'dejeuner', 'diner'],
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
  tolerancePiquant: null,
    seed: 1,
    ...o,
  }
}

interface Verdict {
  readonly nom: string
  readonly ok: boolean
  readonly detail: string
  /** Manques de CONTENU — n'invalident pas le moteur, mais ne doivent plus passer inaperçus. */
  readonly signaux?: readonly string[]
}

/** Créneaux où `planWeek` pose un plat PUIS un accompagnement (`CRENEAUX_REPAS_PRINCIPAL`). */
const REPAS_PRINCIPAUX: readonly MealSlot[] = ['dejeuner', 'diner']

const verdicts: Verdict[] = []

function essai(nom: string, r: WeekPlanRequest): void {
  let plan
  try {
    plan = engine.planWeek(r)
  } catch (error) {
    verdicts.push({ nom, ok: false, detail: `PLANTAGE — ${(error as Error).message.slice(0, 90)}` })
    return
  }

  // ⚠️ ON COMPTE DES CRÉNEAUX, PAS DES LIGNES — et ce banc s'est trompé une journée entière sur ce
  // point (2026-08-04). Depuis le mode repas, un déjeuner porte jusqu'à DEUX entrées : le plat et
  // son accompagnement. Compter `plan.entries` a rendu « 35 créneaux au lieu de 21 » sur 17 des 20
  // configurations, sur un moteur parfaitement correct.
  const creneauxRemplis = new Set<string>()
  for (const e of plan.entries) {
    if (e.recipeId !== null) creneauxRemplis.add(`${e.slot.date}|${e.slot.creneau}`)
  }
  const creneauxPoses = new Set(plan.entries.map((e) => `${e.slot.date}|${e.slot.creneau}`))

  // ⚠️ LE DOUBLON NE SE JUGE QUE SUR LES PLATS. Un accompagnement est EXEMPTÉ de `placedRecipeIds`
  // exprès (`plan-week.ts`) : on mange du riz plusieurs fois par semaine. Le compter comme doublon
  // ferait crier ce banc sur la règle qu'on vient d'écrire. Sa monotonie se surveille ailleurs —
  // `npm run engine:plancher` publie le compte de répétitions.
  const plats = plan.entries.filter((e) => e.recipeId !== null && e.service !== 'accompagnement')
  const remplis = plan.entries.filter((e) => e.recipeId !== null)
  const distincts = new Set(plats.map((e) => e.recipeId))
  const attendus = r.days * r.slots.length

  const problemes: string[] = []
  if (creneauxPoses.size !== attendus) problemes.push(`${creneauxPoses.size} créneaux au lieu de ${attendus}`)
  if (distincts.size !== plats.length) problemes.push(`DOUBLON DE PLAT (${plats.length - distincts.size})`)

  // Déterminisme : deux appels identiques doivent rendre le même plan.
  const bis = engine.planWeek(r)
  const memeOrdre = bis.entries.every((e, i) => e.recipeId === plan.entries[i]?.recipeId)
  if (!memeOrdre) problemes.push('NON DÉTERMINISTE')

  const vides = attendus - creneauxRemplis.size
  const kcalParJour = new Map<string, number>()
  for (const e of plan.entries) {
    const k = e.recipeId === null ? 0 : (catalog.indexes.recipeNutrients.get(e.recipeId)?.[energyIndex] ?? 0)
    kcalParJour.set(e.slot.date, (kcalParJour.get(e.slot.date) ?? 0) + k)
  }
  const totaux = [...kcalParJour.values()]
  const min = totaux.length === 0 ? 0 : Math.round(Math.min(...totaux))

  // --- SIGNAUX : le moteur va bien, c'est le CATALOGUE qui manque -------------------------------
  //
  // ⚠️ L'ATTENDU D'ACCOMPAGNEMENTS SE DÉRIVE DES CRÉNEAUX, il ne s'écrit pas en dur : `planWeek`
  // n'en pose qu'aux repas principaux (`pickAccompagnement` sort sur tout autre créneau). Un banc
  // qui attendrait `days × slots` crierait sur chaque petit-déjeuner, et on apprendrait à ne plus
  // le lire.
  //
  // ⛔ CE QUE CE COMPTE RÉVÈLE, ET QUI A COÛTÉ UNE SESSION : un accompagnement manquant ne dit PAS
  // qu'il manque des accompagnements. `pickAccompagnement` sort aussi quand la recette posée n'est
  // pas un `plat` — ce qui arrive dès que la seconde passe de `pickForSlot` a dû se rabattre sur une
  // entrée, faute de plats DISTINCTS en nombre suffisant (`placedRecipeIds` interdit le doublon).
  // Mesuré le 2026-08-06 : le végétalien avait 18 plats de repas principal pour 28 créneaux, et
  // posait exactement 18 accompagnements. Écrire 18 accompagnements de plus n'a rien changé ;
  // écrire 10 PLATS a porté le compte à 28/28. **Lire ce signal comme "il manque des
  // accompagnements" est le contresens à ne pas refaire — compter d'abord les PLATS.**
  const accompAttendus = r.days * r.slots.filter((s) => REPAS_PRINCIPAUX.includes(s)).length
  const accompPoses = remplis.length - plats.length

  const signaux: string[] = []
  if (vides > 0) signaux.push(`${vides} créneau(x) VIDE(s) sur ${attendus}`)
  if (accompPoses < accompAttendus) {
    signaux.push(`${accompPoses}/${accompAttendus} accompagnements — compter les PLATS avant d'en écrire`)
  }

  verdicts.push({
    nom,
    ok: problemes.length === 0,
    signaux,
    detail:
      problemes.length > 0
        ? problemes.join(' · ')
        : `${creneauxRemplis.size}/${attendus} remplis${vides > 0 ? `, ${vides} vide(s)` : ''}` +
          ` · ${distincts.size} plats distincts · ${accompPoses} accomp.` +
          ` · min ${min} kcal · ${plan.warnings.length} avert.`,
  })
}

// --- Fenêtre ------------------------------------------------------------------------------------
essai('2 jours (minimum §7.1)', req({ days: 2 }))
essai('7 jours', req({ days: 7 }))
essai('14 jours (maximum §7.1)', req({ days: 14 }))

// --- Créneaux -----------------------------------------------------------------------------------
essai('1 créneau (dîner seul)', req({ slots: ['diner'], days: 14 }))
essai('2 créneaux', req({ slots: ['dejeuner', 'diner'], days: 14 }))
essai('4 créneaux', req({ slots: ['petit_dejeuner', 'dejeuner', 'gouter', 'diner'], days: 14 }))
essai('petit-déjeuner seul, 14 j (17 recettes dispo)', req({ slots: ['petit_dejeuner'], days: 14 }))

// --- Profils ------------------------------------------------------------------------------------
essai('homme', req({ profile: HOMME }))
essai('senior sédentaire', req({ profile: SENIOR }))

// --- Régimes ------------------------------------------------------------------------------------
for (const diet of ['omnivore', 'pescetarien', 'vegetarien', 'vegetalien'] as DietCode[]) {
  essai(`régime ${diet}, 14 j × 3`, req({ days: 14, constraints: { allergies: [], diet, excludedFoodIds: [], ownedEquipmentIds: null } }))
}

// --- Allergènes ---------------------------------------------------------------------------------
essai('sans gluten', req({ days: 7, constraints: { allergies: ['gluten' as AllergenId], diet: null, excludedFoodIds: [], ownedEquipmentIds: null } }))
essai('sans lait', req({ days: 7, constraints: { allergies: ['lait' as AllergenId], diet: null, excludedFoodIds: [], ownedEquipmentIds: null } }))
essai(
  'sans gluten NI lait NI œuf',
  req({ days: 7, constraints: { allergies: ['gluten', 'lait', 'oeuf'] as AllergenId[], diet: null, excludedFoodIds: [], ownedEquipmentIds: null } })
)

// --- Cumul le plus dur --------------------------------------------------------------------------
essai(
  'végétalien + sans gluten, 14 j × 4',
  req({
    days: 14,
    slots: ['petit_dejeuner', 'dejeuner', 'gouter', 'diner'],
    constraints: { allergies: ['gluten' as AllergenId], diet: 'vegetalien', excludedFoodIds: [], ownedEquipmentIds: null },
  })
)

// --- Historique pré-rempli ----------------------------------------------------------------------
const dejaVu = [...catalog.recipes.keys()].slice(0, 30)
essai(
  'historique de 30 repas récents',
  req({
    history: {
      windowDays: 21,
      entries: dejaVu.map((recipeId, i) => ({
        recipeId,
        date: `2026-07-${String(10 + (i % 20)).padStart(2, '0')}`,
        creneau: 'diner' as MealSlot,
        origine: 'choisi' as const,
      })),
    },
  })
)

// --- Bornes refusées ----------------------------------------------------------------------------
for (const [nom, jours] of [
  ['1 jour → doit REFUSER', 1],
  ['15 jours → doit REFUSER', 15],
] as const) {
  try {
    engine.planWeek(req({ days: jours }))
    verdicts.push({ nom, ok: false, detail: 'accepté alors qu’il devait être refusé' })
  } catch (error) {
    verdicts.push({ nom, ok: error instanceof RangeError, detail: `${(error as Error).constructor.name}` })
  }
}

// --- Rapport ------------------------------------------------------------------------------------
console.log('Configuration                                    verdict  detail')
console.log('-'.repeat(110))
for (const v of verdicts) {
  const etat = !v.ok ? 'KO' : (v.signaux?.length ?? 0) > 0 ? 'SIGNAL' : 'OK'
  console.log(`${v.nom.padEnd(48)} ${etat.padEnd(8)} ${v.detail}`)
  for (const s of v.signaux ?? []) console.log(`${' '.repeat(48)} ${' '.repeat(8)} ⚠ ${s}`)
}
const echecs = verdicts.filter((v) => !v.ok)
const signales = verdicts.filter((v) => v.ok && (v.signaux?.length ?? 0) > 0)
console.log('-'.repeat(110))
console.log(`${verdicts.length - echecs.length}/${verdicts.length} configurations saines`)

// ⚠️ CETTE LIGNE EST LA CORRECTION DE L'ANGLE MORT (voir l'en-tête) : « 20/20 configurations
// saines » était vrai ET trompeur. Le moteur ne cassait pas ; le catalogue ne suivait pas, et rien
// ne le disait. Un manque de contenu se répare en ÉCRIVANT DES RECETTES — d'où exit 0.
if (signales.length > 0) {
  console.log(
    `⚠ ${signales.length} configuration(s) portent un SIGNAL — le moteur est correct, ` +
      `c'est le CATALOGUE qui manque. Voir les ⚠ ci-dessus.`
  )
}
if (echecs.length > 0) process.exitCode = 1
