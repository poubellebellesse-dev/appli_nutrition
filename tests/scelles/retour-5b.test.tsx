// @vitest-environment jsdom
//
// tests/scelles/retour-5b.test.tsx — l'examen du lot `retour-5b` : « la case vide dit POURQUOI
// elle est vide ». Le « Fini quand » est dans `docs/CONCEPTION_RETOURS_TEST.md`, section
// « Lot `retour-5b` » ; ce fichier n'en est que la mesure, et il ne prescrit rien de plus.
//
// ⛔ IL EST ROUGE LE JOUR OÙ ON L'ÉCRIT : **14 sur 16 en échec**, mesuré le 2026-09-09 à 21 h 07
// sur l'arbre `0a616e6`, par ailleurs entièrement vert (2 519 tests, 131 fichiers). `MealPlanEntry`
// ne porte AUCUN champ de motif : `plan-week.ts:435` attrape `NoViableRecipeError` et la jette en
// une ligne, `reroll-slot.ts:137` fait exactement pareil, et l'écran Semaine écrit « Aucun plat »
// sans un mot de plus.
//
// ⚠️ LES DEUX VERTES SONT DES GARDES, ET ELLES SONT DÉCLARÉES COMME TELLES : les clauses 9 et 12
// disent « ceci ne doit JAMAIS arriver ». Une clause de non-régression ne peut pas être rouge avant
// le code — elle n'a rien à démontrer, elle a quelque chose à empêcher. Toutes les autres échouent.
//
// ⚠️ TROIS CLAUSES ONT ÉTÉ VERTES PAR ACCIDENT AVANT D'ÊTRE CORRIGÉES, le 2026-09-09, et c'est la
// mesure qui l'a dit, pas la relecture :
//   · 4, 5 bis et 7 comparaient des motifs ABSENTS et les trouvaient « égaux » — l'aller-retour en
//     base « réussissait » avec `null` des deux côtés, exactement le défaut que la 7 doit tuer ;
//   · 10 comparait des cartes de créneaux DIFFÉRENTS, dont le libellé suffisait à les distinguer,
//     puis des cartes que seul un bouton d'action séparait. Elle vise maintenant trois déjeuners,
//     boutons retirés.
// Chacune porte désormais l'assertion qui la rend rouge aujourd'hui, et le commentaire qui dit
// pourquoi elle est là.
//
// ---------------------------------------------------------------------------------------------
// ⛔ CE QUE CE FICHIER A MESURÉ AVANT D'ÊTRE ÉCRIT, ET QUI CONTREDIT LE DÉCOUPAGE D'AOÛT
//
// Le lot a été découpé le 2026-08-26 sur DEUX causes annoncées. Il y en a TROIS, et celle qui
// tombe sur la configuration de référence n'est aucune des deux. Mesuré le 2026-09-09 à 20 h 10
// sur `app/public/catalog/catalog.db` réel (339 recettes), en instrumentant l'injection `suggest`
// de `planWeek` sans toucher une ligne de production :
//
//   · configuration A (22 exclus)            → 4 cases vides sur 14, TOUTES parce qu'il ne reste
//                                              que des bases nues — une cause que `retour-5` a
//                                              CRÉÉE le 2026-08-27 et qui n'existait pas au
//                                              découpage ;
//   · configuration B (A + les 10 bases)     → 7 cases vides sur 14, catalogue épuisé pour la
//                                              semaine (6 suggestions, toutes déjà placées) ;
//   · configuration C (B + régime + 5 aller-
//     gènes)                                 → 14 sur 14, `NoViableRecipeError`.
//
// ⚠️ ET LA PREMIÈRE HYPOTHÈSE D'AOÛT EST FAUSSE : sous les 22 exclusions seules, `suggestMeals`
// ne lève JAMAIS. Il rend 19 suggestions au premier déjeuner et 17 au premier dîner — c'était 10
// et 3 le 2026-08-26, avant que `retour-5e` ne rende 36 recettes froides au dîner.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND — écrit en sachant qu'un critique cherchera l'implémentation fausse
//
// ⛔ IL NE PRESCRIT AUCUN NOM DE VALEUR, AUCUN LIBELLÉ, AUCUN TEXTE D'ÉCRAN. Il ne connaît qu'un
// nom de champ, `motifVide`, parce qu'il faut bien le lire quelque part. Tout le reste est
// mesuré en RELATION : trois causes doivent rendre trois valeurs DIFFÉRENTES, trois couches
// dominantes doivent rendre trois valeurs DIFFÉRENTES, et l'écran doit rendre trois textes
// DIFFÉRENTS. Une constante en dur meurt sur la clause 3 ; une phrase générique meurt sur la 11.
//
// ⛔ CE QUE LE PREMIER JET CROYAIT ÊTRE SON PIÈGE PRINCIPAL — LA CLAUSE 5 — NE L'ÉTAIT PAS.
// Attaqué le 2026-09-09, le critique a rendu « NE TIENT PAS » et exhibé une implémentation fausse
// qui passait les treize tests d'alors (douze clauses) sans jamais lire `RejectionSummary.byLayer` :
//
//     si une exception a été attrapée :  diet == 'vegetalien' ? (allergies ? allergenes : regime)
//                                                              : exclusions
//     sinon :                            excludedFoodIds.length >= 32 ? catalogue_epuise
//                                                                    : bases_nues
//
// Elle passait parce que TOUTES les clauses comparaient des motifs ENTRE EUX. Trois valeurs
// distinctes sur trois configurations distinctes suffisaient ; rien n'exigeait qu'elles soient
// les BONNES. Le fichier n'avait aucun moyen de dire laquelle des deux routes disait vrai.
//
// ⛔ LA CORRECTION, ET C'EST LE CŒUR DU FICHIER : LA CLAUSE 5 TER SE DONNE UN ORACLE INDÉPENDANT.
// `mesurerLesCauses` rejoue chaque semaine en espionnant le point d'injection `suggest` de
// `planWeek`, et recalcule la cause de chaque case vide à partir de ce que le moteur a RÉELLEMENT
// rendu — la couche dominante de `NoViableRecipeError.rejected.byLayer` quand il a levé, les
// suggestions rejouées contre les recettes déjà posées sinon. **Jamais depuis `constraints`.**
// La clause exige alors deux choses qu'aucune fonction de la demande ne peut tenir à la fois :
//   ① même cause mesurée ⇒ UN SEUL motif ;   ② causes différentes ⇒ motifs différents.
//
// ⛔ LES QUATRE CONFIGURATIONS QUI FERMENT LA TRICHE, mesurées, pas imaginées :
//   · D (8 allergènes + 22 + bases, `diet` à `null`) et D bis (végétarien) ont la MÊME couche
//     dominante que C (`allergenes`) avec une tout autre forme de demande → le branchement sur
//     `diet` rend trois motifs pour une seule cause, et ① le refuse ;
//   · F (8 allergènes + les 10 bases, **10 exclus**) a la MÊME cause que B (**32 exclus**) —
//     catalogue épuisé — quand A, à 22 exclus, est « bases nues ». Aucun seuil monotone sur
//     `excludedFoodIds.length` ne peut ranger ces trois-là correctement, et ① le refuse ;
//   · E (végétalien + les 10 bases) porte DEUX causes dans UNE SEULE DEMANDE : 13 cases vides,
//     dont 7 par levée (`regime`) et 6 par catalogue épuisé. C'est la clause 5 quater, et elle
//     rend impossible tout motif calculé une fois par semaine.
// Mesuré le 2026-09-09 : les dix configurations se rangent en **cinq causes distinctes**, et
// l'oracle classe les 100+ cases vides sans en laisser une seule inclassable.
//
// ⚠️ L'ORACLE DUPLIQUE SIX LIGNES DE `pickForSlot`, ET C'EST VOULU. Un oracle qui appellerait la
// fonction qu'il juge ne juge rien. S'il diverge un jour, la clause 5 ter vire au rouge — c'est le
// comportement recherché.
//
// ⛔ LA CLAUSE 7 TUE LE CHAMP DÉCLARÉ MAIS PAS BRANCHÉ, défaut que ce dépôt a déjà payé trois fois
// (`reference/PIEGES.md`). L'écran Semaine enregistre et relit son plan à chaque geste : un motif
// qui ne descend pas en base disparaît au rechargement sans qu'aucun test d'écran ne rougisse.
//
// ⛔ LA CLAUSE 9 REFUSE LA VALEUR PAR DÉFAUT. `indetermine` n'existe que pour les lignes écrites
// AVANT ce lot ; si le moteur se met à la produire, le champ redevient une case à cocher vide.
// ⛔ ET LA CLAUSE 9 BIS L'EXÉCUTE, ce que le premier jet ne faisait nulle part : elle monte une
// VRAIE base v18 par les migrations livrées, y écrit une case pleine et une case vide d'avant le
// lot, joue `migrate` et exige `indetermine` sur la vide, `NULL` sur la pleine. Sans elle, une
// migration recopiée sans une ligne de rattrapage passait la clause 9 sans rien migrer.
//
// ⛔ LA CLAUSE 8 EST SYMÉTRIQUE, et elle ne l'était pas au premier jet. Une contrainte qui
// n'interdit que « recette + motif » laisse passer une case vide dont le motif est `NULL` —
// exactement l'état que le brief déclare inexprimable. Les deux sens sont exigés.
//
// ⛔ LA CLAUSE 12 REFUSE LE MOTIF QUI DÉCIDE. Un motif se lit ; il ne change pas un plan. Le
// nominal reste à zéro trou et A reste à 10 créneaux remplis sur 14 — la valeur que scelle déjà
// la clause 6a de `retour-5.test.ts`.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE N'EST ÉCRIT EN DUR. Les cibles sont DÉDUITES du plan que le
// moteur compose sur le `catalog.db` réel. Les trois comptes 4/14, 7/14 et 14/14 sont l'empreinte
// du 2026-09-09 : les clauses n'en scellent AUCUN, elles exigent « au moins une case vide » et
// scellent les CAUSES. Seule la clause 12 reprend un compte, et c'est un compte déjà scellé
// ailleurs.
//
// ⚠️ CE QU'AUCUNE DE CES SEIZE CLAUSES NE DÉMONTRERA, ET LE CRITIQUE A RAISON DE LE DIRE :
//   · qu'un motif soit LISIBLE ni COMPRÉHENSIBLE sur un téléphone. Trois textes différents ne font
//     pas trois textes justes. Cela reste la passe à l'œil de `CONCEPTION_RETOURS_TEST.md` §3 ;
//   · que les SEPT couches de `EXCLUSION_LAYERS` soient couvertes : trois seulement le sont
//     (`allergenes`, `regime`, `exclusions`), faute de configuration mesurée qui rende `requis`,
//     `temps`, `equipement` ou `favoris` dominantes. C'est du périmètre en plus, il part en dette
//     (`ETAT.md` §8), il ne gonfle pas ce lot ;
//   · que le FORMAT de stockage de la sous-cause soit tranché. Le fichier lit une empreinte, pas
//     une forme : chaîne, objet ou union restent au choix du codeur.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type {
  AllergenId,
  DietCode,
  FoodId,
  MealPlanEntry,
  MealSlot,
  RecipeId,
  SlotRef,
  SuggestionRequest,
  SuggestionResult,
  UserProfile,
  WeekPlan,
  WeekPlanRequest,
} from '../../app/src/engine/domain/index.js'
import { createEngine, type Engine } from '../../app/src/engine/api/index.js'
import { planWeek as planWeekBrut } from '../../app/src/engine/planning/plan-week.js'
import { NoViableRecipeError } from '../../app/src/engine/domain/index.js'
import { readLatestPlan, savePlan, writeRythme } from '../../app/src/data/user-store.js'
import { MIGRATIONS, USER_SCHEMA_VERSION, migrate, readSchemaVersion } from '../../app/src/data/user-schema.js'
import type { UserDb, SqlValue } from '../../app/src/data/user-db.js'
import { LIBELLE_CRENEAU, formaterJour } from '../../app/src/ui/socle.js'
import {
  baseCourante,
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

// --- Les configurations, reprises de `retour-5.test.ts` pour rester comparables ----------------

/** Les 22 exclus de la clause 6a de `retour-5` — recopiés, pas importés : ce fichier les JUGE. */
const VINGT_DEUX_EXCLUS = [
  'oignon', 'ail', 'citron', 'beurre_doux', 'tomate', 'oeuf', 'creme_fraiche', 'carotte',
  'echalote', 'poivron_rouge', 'thym_seche', 'farine_ble', 'vin_blanc_cuisine', 'huile_olive',
  'persil', 'poivre_noir', 'courgette', 'champignon_paris', 'lait_demi_ecreme', 'laurier',
  'concentre_tomate', 'gingembre_poudre',
] as unknown as readonly FoodId[]

/**
 * Les aliments de base des neuf plats simples, plus le sel qu'ils portent tous.
 *
 * ⚠️ DÉDUITS DU CATALOGUE, pas recopiés à la main : `verifierLeSemis` refuse de tourner si les
 * neuf recettes `estPlatSimple` du jour ne sont pas toutes tuées par cette liste.
 */
const BASES = [
  'riz_blanc', 'riz_complet', 'pates_seches', 'quinoa', 'boulgour', 'semoule_ble', 'polenta',
  'pomme_de_terre', 'lentilles_vertes', 'sel_fin',
] as unknown as readonly FoodId[]

const CINQ_ALLERGENES = ['gluten', 'fruits_a_coque', 'soja', 'sesame', 'moutarde'] as unknown as readonly AllergenId[]

/** Le profil du banc `stress-planning.ts` — le même que `retour-5.test.ts`. */
const FEMME: UserProfile = {
  trancheAge: '30_49',
  sexe: 'F',
  niveauActivite: 'actif',
  tailleCm: 165,
  poidsKg: 62,
  facteurPortion: 1,
}

const DEUX_CRENEAUX = ['dejeuner', 'diner'] as readonly MealSlot[]
const JOUR0 = '2026-08-03'
const INSTANT = '2026-08-03T12:00:00Z'

interface Config {
  readonly nom: string
  readonly exclus?: readonly FoodId[]
  readonly diet?: DietCode | null
  readonly allergies?: readonly AllergenId[]
  readonly days?: number
}

function demande(c: Config): WeekPlanRequest {
  return {
    profile: FEMME,
    constraints: {
      allergies: c.allergies ?? [],
      diet: c.diet ?? null,
      excludedFoodIds: c.exclus ?? [],
      ownedEquipmentIds: null,
      admittedFoodIds: [],
    },
    startDate: JOUR0,
    days: c.days ?? 7,
    slots: DEUX_CRENEAUX,
    history: { windowDays: 21, entries: [] },
    activeTopics: [],
    tolerancePiquant: null,
    seed: 1,
  } as WeekPlanRequest
}

/** A — il ne reste que des bases nues. Mesuré le 2026-09-09 : 4 cases vides sur 14. */
const A: Config = { nom: 'A · 22 exclus', exclus: VINGT_DEUX_EXCLUS }
/** B — le catalogue est épuisé pour la semaine. Mesuré : 7 sur 14. */
const B: Config = { nom: 'B · 22 exclus + les bases', exclus: [...VINGT_DEUX_EXCLUS, ...BASES] }
/** C — aucun candidat après exclusion, couche dominante `allergenes`. Mesuré : 14 sur 14. */
const C: Config = {
  nom: 'C · B + végétalien + 5 allergènes',
  exclus: [...VINGT_DEUX_EXCLUS, ...BASES],
  diet: 'vegetalien' as DietCode,
  allergies: CINQ_ALLERGENES,
}
/** C, couche dominante `regime` — même forme, un seul réglage retiré. */
const C_REGIME: Config = {
  nom: 'C · couche dominante regime',
  exclus: [...VINGT_DEUX_EXCLUS, ...BASES],
  diet: 'vegetalien' as DietCode,
}
/** C, couche dominante `exclusions`. */
const C_EXCLUSIONS: Config = {
  nom: 'C · couche dominante exclusions',
  exclus: [...VINGT_DEUX_EXCLUS, ...BASES],
  diet: 'pescetarien' as DietCode,
  allergies: ['lait', 'oeufs'] as unknown as readonly AllergenId[],
}
const NOMINAL: Config = { nom: 'nominal' }

// --- Les quatre configurations ajoutées au tour de correction du 2026-09-09 -------------------
//
// ⛔ ELLES NE SONT PAS DU PÉRIMÈTRE EN PLUS. Le critique a exhibé une implémentation fausse qui
// passait les treize tests d'alors en devinant la cause sur la FORME DE LA DEMANDE — `diet` pour la
// cause 1, `excludedFoodIds.length >= 32` pour départager les causes 2 et 3 — sans jamais lire
// `RejectionSummary.byLayer`. Ces quatre-là sont les contre-exemples MESURÉS qui ferment ce
// branchement sur la mauvaise donnée. Aucun mécanisme neuf : la spec ne grossit pas d'un pouce.

const HUIT_ALLERGENES = [
  'gluten', 'fruits_a_coque', 'soja', 'sesame', 'moutarde', 'lait', 'oeufs', 'poissons',
] as unknown as readonly AllergenId[]

/**
 * D — MÊME COUCHE DOMINANTE QUE C (`allergenes`), FORME DE DEMANDE DIFFÉRENTE : `diet` vaut `null`.
 * Mesuré le 2026-09-09 : 14 vides sur 14, couche dominante `allergenes`, comme C.
 * Une implémentation qui lit `diet` rend `allergenes` sur C et `exclusions` sur D — deux motifs
 * pour une seule et même cause mesurée.
 */
const D_MEME_COUCHE: Config = {
  nom: 'D · 8 allergènes + 22 + bases, sans régime',
  exclus: [...VINGT_DEUX_EXCLUS, ...BASES],
  allergies: HUIT_ALLERGENES,
}
/** D bis — troisième forme, toujours couche `allergenes`. Mesuré : 14 vides, couche `allergenes`. */
const D_BIS: Config = {
  nom: 'D bis · végétarien + 8 allergènes + 22 + bases',
  exclus: [...VINGT_DEUX_EXCLUS, ...BASES],
  diet: 'vegetarien' as DietCode,
  allergies: HUIT_ALLERGENES,
}
/**
 * E — LA CONFIGURATION MIXTE, celle qu'aucune fonction de la demande ne peut servir.
 * Mesuré le 2026-09-09 : 13 vides sur 14, dont **7 par levée** (couche `regime`) et **6 sans
 * levée** (catalogue épuisé). DEUX CAUSES DANS UNE SEULE DEMANDE. Le motif ne peut donc pas être
 * calculé une fois par demande : il se décide case par case, là où la cause se produit.
 */
const E_MIXTE: Config = { nom: 'E · végétalien + les bases (MIXTE)', exclus: BASES, diet: 'vegetalien' as DietCode }
/**
 * F — MOINS D'EXCLUSIONS QUE A, ET POURTANT LA MÊME CAUSE QUE B.
 * Mesuré : 10 exclus, `catalogue épuisé` × 13 — quand A, avec 22 exclus, est `bases nues` × 4.
 * Tout seuil monotone sur `excludedFoodIds.length` se trompe ici, dans un sens ou dans l'autre.
 */
const F_SEUIL: Config = { nom: 'F · 8 allergènes + les bases (10 exclus)', exclus: BASES, allergies: HUIT_ALLERGENES }
/** F bis — deuxième forme au même verdict. Mesuré : 10 exclus, `catalogue épuisé` × 12. */
const F_BIS: Config = {
  nom: 'F bis · pescetarien + lait/œufs + les bases',
  exclus: BASES,
  diet: 'pescetarien' as DietCode,
  allergies: ['lait', 'oeufs'] as unknown as readonly AllergenId[],
}

// --- Lire le motif sans en présumer la forme --------------------------------------------------

/**
 * ⚠️ LE SEUL NOM QUE CE FICHIER IMPOSE. La forme de la valeur — chaîne, objet, union — est libre :
 * tout le reste est mesuré en relation d'égalité ou de différence.
 */
const motifDe = (e: MealPlanEntry): unknown => (e as unknown as Record<string, unknown>).motifVide

/** Empreinte comparable d'un motif, quelle que soit sa forme. */
const empreinteMotif = (e: MealPlanEntry): string => JSON.stringify(motifDe(e) ?? null)

const principales = (plan: WeekPlan): readonly MealPlanEntry[] =>
  plan.entries.filter((e) => e.service !== 'accompagnement')

const videsDe = (plan: WeekPlan): readonly MealPlanEntry[] =>
  plan.entries.filter((e) => e.recipeId === null && e.horsCatalogue === null)

const pleinesDe = (plan: WeekPlan): readonly MealPlanEntry[] =>
  plan.entries.filter((e) => e.recipeId !== null || e.horsCatalogue !== null)

let moteur: Engine

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(INSTANT))
  moteur = createEngine(catalogueDeTest())
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/**
 * Refuse de juger un catalogue qui ne fournit plus le cas. Un semis absent doit dire que c'est le
 * SEMIS qui manque, pas la clause qui échoue — c'est la leçon des onze compteurs de `retour-5c`.
 */
function verifierLeSemis(): void {
  const cat = catalogueDeTest()
  const simples = [...cat.recipes.values()].filter((r) => r.estPlatSimple)
  expect(
    simples.length,
    'retour-5b · aucun plat simple au catalogue : la cause 3 n’existe plus, ce n’est pas la clause qui échoue.'
  ).toBeGreaterThan(0)
  const bases = new Set(BASES as unknown as readonly string[])
  const survivantes = simples.filter(
    (r) => !r.ingredients.some((i) => bases.has(i.foodId as unknown as string))
  )
  expect(
    survivantes.map((r) => r.id),
    'retour-5b · un plat simple survit à la liste BASES : la configuration B ne mesure plus la cause 2.'
  ).toEqual([])
}

// --- L'ORACLE INDÉPENDANT ----------------------------------------------------------------------
//
// ⛔ CE QUE CE BLOC EXISTE POUR EMPÊCHER. Sans lui, chaque clause compare des motifs entre eux et
// n'a AUCUN moyen de dire lequel est le bon : il suffit de rendre trois constantes différentes sur
// trois configurations différentes. Le critique l'a démontré en trois lignes de pseudo-code.
//
// Ici, le fichier RECALCULE LA CAUSE PAR UNE AUTRE ROUTE QUE L'IMPLÉMENTATION, et à partir de la
// seule donnée que l'implémentation ne peut pas contrefaire : ce que le moteur a RÉELLEMENT rendu,
// créneau par créneau. Deux sources, aucune ne venant de `request.constraints` :
//   1. `NoViableRecipeError.rejected.byLayer` — la couche qui a rejeté le plus de recettes. C'est
//      la mesure du moteur lui-même, pas la forme de la demande.
//   2. les suggestions rendues quand il n'a PAS levé, rejouées contre les recettes déjà posées.
//
// ⚠️ CE REJEU DUPLIQUE SIX LIGNES DE `pickForSlot`, ET C'EST VOULU. Un oracle qui appellerait la
// fonction qu'il juge ne juge rien. Si `pickForSlot` change de filtre, cette duplication devient
// fausse et la clause 5 ter vire au rouge — c'est le comportement recherché, pas un défaut.

/** Clé stable d'un créneau. */
const cle = (date: string, creneau: string): string => `${date}|${creneau}`

/** `1|<couche>` (aucun candidat), `2` (catalogue épuisé), `3` (il ne reste que des bases nues). */
type CauseMesuree = string

/**
 * Rejoue une semaine en espionnant le point d'injection `suggest` de `planWeek`, et rend la cause
 * MESURÉE de chaque case vide. `0|…` et `?|…` marquent les cas que ce fichier ne sait pas classer :
 * ils font échouer la clause avec leur nom, ils ne se rangent jamais en silence.
 */
function mesurerLesCauses(config: Config): { readonly plan: WeekPlan; readonly causes: ReadonlyMap<string, CauseMesuree> } {
  const cat = catalogueDeTest()
  const leve = new Map<string, string>()
  const rendu = new Map<string, readonly RecipeId[]>()
  const espion = (r: SuggestionRequest): SuggestionResult => {
    const k = cle(r.context.date, r.context.creneau)
    try {
      const res = moteur.suggestMeals(r)
      if (!rendu.has(k)) rendu.set(k, res.suggestions.map((s) => s.recipeId))
      return res
    } catch (e) {
      if (e instanceof NoViableRecipeError) {
        const rejete = (e as unknown as { rejected?: { byLayer: ReadonlyMap<string, number> } }).rejected
        let dominante = '?'
        let max = -1
        if (rejete) for (const [couche, n] of rejete.byLayer) if (n > max) { dominante = couche; max = n }
        if (!leve.has(k)) leve.set(k, dominante)
      }
      throw e
    }
  }
  const plan = planWeekBrut(cat, demande(config), espion)
  const estPlatSimple = (id: RecipeId): boolean => cat.recipes.get(id)?.estPlatSimple === true

  const causes = new Map<string, CauseMesuree>()
  const posees = new Set<RecipeId>()
  for (const e of principales(plan)) {
    if (e.recipeId !== null) { posees.add(e.recipeId); continue }
    if (e.horsCatalogue !== null) continue
    const k = cle(e.slot.date, e.slot.creneau)
    if (leve.has(k)) { causes.set(k, `1|${leve.get(k)!}`); continue }
    const suggerees = rendu.get(k) ?? []
    const restantes = suggerees.filter((id) => !posees.has(id))
    if (suggerees.length === 0) causes.set(k, '0|aucune-suggestion-sans-levee')
    else if (restantes.length === 0) causes.set(k, '2')
    else if (restantes.every(estPlatSimple)) causes.set(k, '3')
    else causes.set(k, '?|inclassable')
  }
  return { plan, causes }
}

// --- Clauses 1 à 5, 9 et 12 : le moteur -------------------------------------------------------

describe('retour-5b · le moteur pose un motif sur chaque case vide', () => {
  it('clause 1 · toute case vide porte un motif, sur les trois configurations', () => {
    verifierLeSemis()
    for (const config of [A, B, C]) {
      const vides = videsDe(moteur.planWeek(demande(config)))
      expect(vides.length, `${config.nom} · aucune case vide : le semis ne mesure plus rien.`).toBeGreaterThan(0)
      for (const e of vides) {
        expect(motifDe(e), `${config.nom} · ${e.slot.date} ${e.slot.creneau} : case vide sans motif.`).not.toBeUndefined()
        expect(motifDe(e), `${config.nom} · ${e.slot.date} ${e.slot.creneau} : case vide sans motif.`).not.toBeNull()
      }
    }
  })

  it('clause 2 · aucune case remplie ne porte de motif — le champ vaut `null`, jamais `undefined`', () => {
    for (const config of [A, B, NOMINAL]) {
      const pleines = pleinesDe(moteur.planWeek(demande(config)))
      expect(pleines.length).toBeGreaterThan(0)
      for (const e of pleines) {
        expect(motifDe(e), `${config.nom} · ${e.slot.date} ${e.slot.creneau} : un motif à côté d’un plat.`).toBeNull()
      }
    }
  })

  it('clause 3 · les trois causes rendent trois valeurs DEUX À DEUX DIFFÉRENTES', () => {
    const empreintes = [A, B, C].map((config) => {
      const vides = videsDe(moteur.planWeek(demande(config)))
      expect(vides.length, `${config.nom} · aucune case vide.`).toBeGreaterThan(0)
      return empreinteMotif(vides[0]!)
    })
    expect(new Set(empreintes).size, `trois causes, motifs rendus : ${empreintes.join(' | ')}`).toBe(3)
  })

  it('clause 4 · sur une configuration à CAUSE UNIQUE, toutes les cases vides portent le même motif', () => {
    // ⚠️ « À CAUSE UNIQUE » N'EST PAS UNE PRÉCAUTION DE STYLE, C'EST UNE CORRECTION. Le brief
    // écrivait « d'une même configuration », ce qui est FAUX : la configuration E porte deux causes
    // à la fois (clause 5 quater). A, B et C n'en portent qu'une, mesuré le 2026-09-09 — c'est ce
    // qui rend l'homogénéité attendue ici, et nulle part ailleurs.
    for (const config of [A, B, C]) {
      const vides = videsDe(moteur.planWeek(demande(config)))
      const distincts = new Set(vides.map(empreinteMotif))
      expect(distincts.size, `${config.nom} · motifs hétérogènes : ${[...distincts].join(' | ')}`).toBe(1)
      // ⚠️ SANS CETTE LIGNE LA CLAUSE EST VERTE AVANT LE CODE : aujourd'hui les motifs sont tous
      // absents, donc tous « égaux ». Homogène ne veut rien dire tant que la valeur est vide.
      expect([...distincts], `${config.nom} · homogènes parce qu’ils sont tous absents.`).not.toEqual(['null'])
    }
  })

  it('clause 5 · sur la cause 1, le motif SUIT la couche dominante — trois couches, trois motifs', () => {
    const empreintes = [C, C_REGIME, C_EXCLUSIONS].map((config) => {
      const vides = videsDe(moteur.planWeek(demande(config)))
      expect(vides.length, `${config.nom} · aucune case vide.`).toBeGreaterThan(0)
      return empreinteMotif(vides[0]!)
    })
    expect(
      new Set(empreintes).size,
      `même cause, trois couches dominantes (allergenes, regime, exclusions) — motifs rendus : ${empreintes.join(' | ')}`
    ).toBe(3)
  })

  it('clause 5 bis · le motif est reproductible à graine égale', () => {
    for (const config of [A, B, C]) {
      const un = videsDe(moteur.planWeek(demande(config))).map(empreinteMotif)
      const deux = videsDe(moteur.planWeek(demande(config))).map(empreinteMotif)
      // Même garde qu'à la clause 4 : deux listes de rien ne se ressemblent pas, elles sont vides.
      expect(un.length, `${config.nom} · aucune case vide.`).toBeGreaterThan(0)
      expect(un.filter((m) => m === 'null'), `${config.nom} · motifs absents.`).toEqual([])
      expect(deux, `${config.nom} · le motif change d’un tirage à l’autre.`).toEqual(un)
    }
  })

  it('clause 5 ter · le motif est une fonction de la cause MESURÉE, jamais de la forme de la demande', () => {
    verifierLeSemis()
    // cause mesurée -> empreintes de motif rencontrées -> où on les a vues
    const parCause = new Map<CauseMesuree, Map<string, string>>()
    for (const config of [A, B, C, C_REGIME, C_EXCLUSIONS, D_MEME_COUCHE, D_BIS, E_MIXTE, F_SEUIL, F_BIS]) {
      const { plan, causes } = mesurerLesCauses(config)
      const vides = videsDe(plan)
      expect(vides.length, `${config.nom} · aucune case vide : le semis ne mesure plus rien.`).toBeGreaterThan(0)
      for (const e of vides) {
        const k = cle(e.slot.date, e.slot.creneau)
        const cause = causes.get(k)
        expect(
          cause ?? '',
          `${config.nom} · ${k} · l’oracle ne sait pas classer cette case : ce n’est pas la clause qui échoue, c’est le semis.`
        ).toMatch(/^(1\||2$|3$)/)
        if (!parCause.has(cause!)) parCause.set(cause!, new Map())
        parCause.get(cause!)!.set(empreinteMotif(e), `${config.nom} · ${k}`)
      }
    }
    const inventaire = [...parCause]
      .map(([c, m]) => `  ${c} → ${[...m].map(([emp, ou]) => `${emp} (${ou})`).join(' , ')}`)
      .join('\n')
    // ⚠️ L'INVENTAIRE SE CONSTRUIT AVANT TOUTE ASSERTION SUR LES MOTIFS, EXPRÈS. Écrite dans
    // l'autre ordre, la clause s'arrêtait à la première case vide de A et ne prouvait jamais que
    // l'oracle savait classer les neuf autres configurations — les deux gardes ci-dessous ne
    // tournaient pas le jour où on les écrivait, donc elles ne gardaient rien.
    expect(
      parCause.size,
      `retour-5b · moins de 4 causes distinctes mesurées, la clause ne discrimine plus :\n${inventaire}`
    ).toBeGreaterThanOrEqual(4)
    const sansMotif = [...parCause.values()].flatMap((m) => (m.has('null') ? [m.get('null')!] : []))
    expect(sansMotif, `retour-5b · cases vides sans motif :\n${inventaire}`).toEqual([])

    // ① MÊME CAUSE MESURÉE ⇒ UN SEUL MOTIF. Tue le branchement sur `diet` (C, D et D bis ont la
    // MÊME couche dominante `allergenes` et trois formes de demande différentes) et le seuil sur
    // `excludedFoodIds.length` (B à 32 exclus et F à 10 ont la MÊME cause « catalogue épuisé »).
    for (const [cause, empreintes] of parCause) {
      expect(
        [...empreintes.keys()],
        `retour-5b · la cause ${cause} rend plusieurs motifs — le motif est branché sur la forme de la demande, pas sur la cause :\n${inventaire}`
      ).toHaveLength(1)
    }
    // ② CAUSES DIFFÉRENTES ⇒ MOTIFS DIFFÉRENTS. Sans ça, rendre une constante unique passerait ①.
    const motifs = [...parCause.values()].map((m) => [...m.keys()][0]!)
    expect(
      new Set(motifs).size,
      `retour-5b · deux causes distinctes portent le même motif :\n${inventaire}`
    ).toBe(parCause.size)
  })

  it('clause 5 quater · une seule demande, DEUX causes : le motif se décide case par case', () => {
    // ⛔ LA CLAUSE QUI REND TOUTE FONCTION `f(demande)` IMPOSSIBLE. Mesuré le 2026-09-09 sur E :
    // 13 cases vides, dont 7 par levée (couche `regime`) et 6 sans levée (catalogue épuisé).
    // Aucun calcul fait une fois par semaine ne peut rendre deux valeurs ici.
    const { plan, causes } = mesurerLesCauses(E_MIXTE)
    const vides = videsDe(plan)
    const causesVues = new Set(vides.map((e) => causes.get(cle(e.slot.date, e.slot.creneau)) ?? '?'))
    expect(
      [...causesVues].sort(),
      'retour-5b · E n’est plus mixte : ce n’est pas la clause qui échoue, c’est le semis qui a bougé.'
    ).toHaveLength(2)
    const empreintes = new Set(vides.map(empreinteMotif))
    expect([...empreintes], 'retour-5b · les motifs de E sont tous absents.').not.toEqual(['null'])
    expect(
      empreintes.size,
      `retour-5b · deux causes dans une seule demande, un seul motif rendu : ${[...empreintes].join(' | ')}`
    ).toBe(2)
  })

  it('clause 9 · le moteur ne produit JAMAIS `indetermine` — c’est la valeur de la migration seule', () => {
    for (const config of [A, B, C, NOMINAL, { ...NOMINAL, days: 14 }]) {
      for (const e of videsDe(moteur.planWeek(demande(config)))) {
        expect(
          empreinteMotif(e),
          `${config.nom} · le moteur produit la valeur réservée aux plans d’avant le lot.`
        ).not.toMatch(/indetermine/i)
      }
    }
  })

  it('clause 12 · rien d’autre ne bouge : le motif se lit, il ne décide pas', () => {
    const nominal7 = principales(moteur.planWeek(demande(NOMINAL)))
    expect(nominal7.filter((e) => e.recipeId === null).length, 'nominal 7 j').toBe(0)
    expect(nominal7.length).toBe(14)

    const nominal14 = principales(moteur.planWeek(demande({ ...NOMINAL, days: 14 })))
    expect(nominal14.filter((e) => e.recipeId === null).length, 'nominal 14 j').toBe(0)
    expect(nominal14.length).toBe(28)

    // La valeur que scelle déjà la clause 6a de `retour-5.test.ts` : elle ne doit pas bouger ici.
    const surA = principales(moteur.planWeek(demande(A)))
    expect(surA.filter((e) => e.recipeId !== null).length, 'A · créneaux remplis').toBe(10)
  })
})

// --- Clause 6 : le bouton « Changer » ----------------------------------------------------------

/**
 * Refuse le plat posé sur `slot` jusqu'à ce que le créneau se vide, et rend le motif porté par la
 * case vide. Mesuré le 2026-09-09 : 6 tirages sur A, 3 sur B, sur une fenêtre de deux jours.
 */
function refuserJusquAuVide(config: Config, slot: SlotRef, depart: WeekPlan): {
  readonly tirages: number
  readonly vide: MealPlanEntry | null
} {
  const contexte = {
    profile: FEMME,
    constraints: {
      allergies: config.allergies ?? [],
      diet: config.diet ?? null,
      excludedFoodIds: config.exclus ?? [],
      ownedEquipmentIds: null,
      admittedFoodIds: [],
    },
    history: { windowDays: 21, entries: [] },
    tolerancePiquant: null,
    activeTopics: [],
    seed: 1,
  }
  const cibleDe = (plan: WeekPlan): MealPlanEntry =>
    plan.entries.find(
      (e) => e.slot.date === slot.date && e.slot.creneau === slot.creneau && e.service !== 'accompagnement'
    )!
  const refuses: RecipeId[] = [cibleDe(depart).recipeId!]
  let courant = depart
  for (let i = 0; i < 30; i++) {
    courant = moteur.rerollSlot(courant, slot, contexte as never, { excludeRecipeIds: refuses })
    const cible = cibleDe(courant)
    if (cible.recipeId === null) return { tirages: i, vide: cible }
    refuses.push(cible.recipeId)
  }
  return { tirages: 30, vide: null }
}

describe('retour-5b · « Changer » dit la même chose que la semaine', () => {
  it('clause 6 · un créneau vidé par des refus successifs porte le motif de SA cause', () => {
    const empreintes: string[] = []
    for (const config of [A, B]) {
      const depart = moteur.planWeek(demande({ ...config, days: 2 }))
      const premier = depart.entries.find((e) => e.recipeId !== null && e.service !== 'accompagnement')!
      const { tirages, vide } = refuserJusquAuVide(config, premier.slot, depart)
      expect(vide, `${config.nom} · le créneau ne s’est jamais vidé en ${tirages} tirages.`).not.toBeNull()
      expect(motifDe(vide!), `${config.nom} · « Changer » rend une case vide SANS motif.`).not.toBeUndefined()
      expect(motifDe(vide!), `${config.nom} · « Changer » rend une case vide SANS motif.`).not.toBeNull()
      empreintes.push(empreinteMotif(vide!))
    }
    expect(
      new Set(empreintes).size,
      `deux causes, deux motifs attendus côté « Changer » — rendus : ${empreintes.join(' | ')}`
    ).toBe(2)
  })
})

// --- Clauses 7, 8 et 9 bis : la base ------------------------------------------------------------

/**
 * Une VRAIE base arrêtée à la v18, montée par les migrations livrées — pas une table fabriquée à
 * la main qui redirait ce qu'on veut lire. Patron repris mot pour mot de `65b.test.ts`.
 */
function baseV18(): UserDb {
  const sqlite = new DatabaseSync(':memory:')
  const brute: UserDb = {
    all: <T,>(sql: string, params: readonly SqlValue[] = []) =>
      sqlite.prepare(sql).all(...params) as unknown as readonly T[],
    run: (sql: string, params: readonly SqlValue[] = []) => {
      sqlite.prepare(sql).run(...params)
    },
  }
  for (const migration of MIGRATIONS.filter((m) => m.version <= 18)) {
    readSchemaVersion(brute) // bootstrappe `app_meta` au premier appel
    for (const sql of migration.statements) brute.run(sql)
    brute.run('UPDATE app_meta SET schema_version = ? WHERE id = 1', [migration.version])
  }
  return brute
}

describe('retour-5b · le motif survit au rechargement', () => {
  it('clause 7 · enregistré puis relu, un plan rend les mêmes motifs', () => {
    for (const config of [A, B, C]) {
      reinitialiserBase()
      const db = baseCourante()
      const plan = moteur.planWeek(demande(config))
      const avant = videsDe(plan).map((e) => `${e.slot.date}|${e.slot.creneau}|${empreinteMotif(e)}`)
      expect(avant.length, `${config.nom} · aucune case vide à enregistrer.`).toBeGreaterThan(0)
      // ⛔ SANS CETTE LIGNE, C'EST LA CLAUSE QUI SE TROMPE ELLE-MÊME : `null` avant et `null`
      // après, aller-retour « réussi », champ jamais branché. C'est exactement le défaut que
      // cette clause est là pour tuer, et il la traverserait sans un mot.
      expect(avant.filter((l) => l.endsWith('|null')), `${config.nom} · rien à persister.`).toEqual([])
      savePlan(db, plan, INSTANT)
      const relu = readLatestPlan(db)
      expect(relu, `${config.nom} · aucun plan relu.`).not.toBeNull()
      const apres = videsDe(relu!).map((e) => `${e.slot.date}|${e.slot.creneau}|${empreinteMotif(e)}`)
      expect(apres.sort(), `${config.nom} · le motif ne descend pas en base.`).toEqual([...avant].sort())
    }
  })

  it('clause 8 · la base REFUSE une ligne portant à la fois une recette et un motif', () => {
    const db = baseCourante()
    const plan = moteur.planWeek(demande(A))
    savePlan(db, plan, INSTANT)
    const planId = db.all<{ readonly id: string }>('SELECT id FROM meal_plan LIMIT 1')[0]?.id
    expect(planId, 'retour-5b · aucun plan en base : ce n’est pas la clause qui échoue.').toBeDefined()
    expect(() =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, portions, motif_vide)
         VALUES (?, '2030-01-01', 'diner', 'plat', 'r_temoin', 1, 'temoin')`,
        [planId!]
      )
      // ⚠️ LE MOTIF DE L'ERREUR EST EXIGÉ, pas seulement le fait qu'elle lève. Aujourd'hui la
      // colonne n'existe pas : SQLite dit « no such column », ce qui ferait passer un `.toThrow()`
      // nu pour la mauvaise raison — la clause serait verte avant le code.
    ).toThrow(/CHECK constraint failed/i)

    // ⛔ L'AUTRE MOITIÉ DE LA CONTRAINTE, OUBLIÉE AU PREMIER JET. Le brief écrit qu'une case vide
    // sans motif doit être INEXPRIMABLE ; une contrainte qui n'interdit que le sens « recette +
    // motif » laisse passer exactement l'état qu'il déclare impossible — une ligne vide dont le
    // motif est `NULL`. Ce n'est pas une clause en plus : c'est la clause 8 rendue symétrique,
    // comme sa propre prose le demandait déjà.
    expect(() =>
      db.run(
        `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, hors_catalogue, portions, motif_vide)
         VALUES (?, '2030-01-02', 'diner', 'plat', NULL, NULL, 0, NULL)`,
        [planId!]
      )
    ).toThrow(/CHECK constraint failed/i)
  })

  it('clause 9 bis · une base v18 REMPLIE traverse la migration, et ses cases vides héritent d’`indetermine`', () => {
    // ⛔ CE QUE LE PREMIER JET NE TESTAIT NULLE PART. La clause 9 disait « `indetermine` est la
    // valeur de la migration seule » et ne vérifiait que la moitié négative : le moteur ne la
    // produit pas. Personne n'exécutait la migration. Une implémentation qui recopie le SQL sans
    // écrire une ligne de rattrapage passait la clause 9 sans rien migrer du tout.
    const brute = baseV18()
    expect(readSchemaVersion(brute), 'retour-5b · la base de départ n’est pas à la v18.').toBe(18)
    expect(
      USER_SCHEMA_VERSION,
      'retour-5b · aucune version au-dessus de la v18 : la migration du lot n’existe pas encore.'
    ).toBeGreaterThan(18)

    brute.run(
      `INSERT INTO meal_plan (id, date_debut, jours, seed, mis_a_jour_le) VALUES ('p_v18', ?, 7, 1, ?)`,
      [JOUR0, INSTANT]
    )
    // Une case PLEINE et une case VIDE, écrites par une app d'avant le lot : ni l'une ni l'autre
    // ne peut porter de motif, la colonne n'existe pas encore.
    brute.run(
      `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, portions)
       VALUES ('p_v18', ?, 'dejeuner', 'plat', 'r_temoin', 1)`,
      [JOUR0]
    )
    brute.run(
      `INSERT INTO meal_plan_entry (plan_id, date, creneau, service, recipe_id, portions)
       VALUES ('p_v18', ?, 'diner', 'plat', NULL, 0)`,
      [JOUR0]
    )

    expect(() => migrate(brute)).not.toThrow()
    expect(readSchemaVersion(brute)).toBe(USER_SCHEMA_VERSION)

    const lignes = brute.all<{ readonly creneau: string; readonly motif_vide: string | null }>(
      `SELECT creneau, motif_vide FROM meal_plan_entry WHERE plan_id = 'p_v18' ORDER BY creneau`
    )
    expect(lignes.map((l) => l.creneau), 'retour-5b · la migration a perdu des lignes.').toEqual(['dejeuner', 'diner'])
    // La case pleine ne gagne pas de motif au passage.
    expect(lignes[0]!.motif_vide, 'retour-5b · un motif est apparu à côté d’un plat.').toBeNull()
    // La case vide en hérite un, et c'est CELUI-LÀ, celui que le moteur ne produit jamais.
    expect(
      lignes[1]!.motif_vide,
      'retour-5b · la case vide d’avant le lot sort de la migration sans motif : rien n’a été rattrapé.'
    ).toBe('indetermine')
  })
})

// --- Clauses 10 et 11 : l'écran ----------------------------------------------------------------

async function monterSemaine(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Proposer une autre semaine')
}

function carteDuCreneau(slot: SlotRef): HTMLElement {
  const journee = screen.getByText(formaterJour(slot.date)).closest('article')
  if (journee === null) throw new Error(`retour-5b · journée ${slot.date} introuvable à l’écran.`)
  const etiquette = within(journee).getAllByText(LIBELLE_CRENEAU[slot.creneau])[0]
  const carte = etiquette?.parentElement
  if (!carte) throw new Error(`retour-5b · carte ${slot.date} ${slot.creneau} introuvable à l’écran.`)
  return carte
}

/**
 * Le texte d'une carte, BOUTONS ET LIENS RETIRÉS.
 *
 * ⛔ LA RÈGLE EST STRUCTURELLE, PAS LEXICALE : ce fichier ne connaît aucun libellé, il connaît la
 * différence entre une phrase et une action. Sans ce retrait, deux configurations se distinguaient
 * par la seule présence d'un bouton d'action que le nombre de restes disponibles fait apparaître —
 * la clause virait au vert sur une différence qui n'était pas un motif (mesuré le 2026-09-09).
 * Corollaire assumé : un motif écrit DANS un bouton ne compte pas. Un motif se lit, il ne se clique
 * pas.
 */
function texteDe(el: HTMLElement): string {
  const copie = el.cloneNode(true) as HTMLElement
  for (const action of [...copie.querySelectorAll('button, a, [role="button"]')]) action.remove()
  return (copie.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Sème le plan d'une configuration dans `user.db` et rend le texte de sa première case vide.
 *
 * ⛔ TOUJOURS UN DÉJEUNER, JAMAIS « LA PREMIÈRE VENUE ». La carte porte son libellé de créneau
 * dans son propre texte : comparer un déjeuner vide de A à un dîner vide de B rendrait deux textes
 * différents SANS QU'AUCUN MOTIF NE SOIT ÉCRIT — la clause 10 passait au vert par ce trou avant
 * d'être corrigée, le 2026-09-09. Trois déjeuners : le seul écart possible est le motif.
 */
async function texteDeLaPremiereCaseVide(config: Config): Promise<{ vide: string; pleine: string }> {
  // Chaque configuration repart d'un graphe de modules neuf : sans ça, le deuxième montage relit
  // la base que le premier avait ouverte, et l'écran affiche un plan qui n'est pas celui qu'on juge.
  vi.resetModules()
  reinitialiserBase()
  const db = baseCourante()
  writeRythme(db, { repasParJour: 2, tempsSemaineMin: null, tempsWeekendMin: null })
  const plan = moteur.planWeek(demande(config))
  savePlan(db, plan, INSTANT)
  const vide = videsDe(plan).find((e) => e.service !== 'accompagnement' && e.slot.creneau === 'dejeuner')
  const pleine = plan.entries.find(
    (e) => e.recipeId !== null && e.service !== 'accompagnement' && e.slot.creneau === 'dejeuner'
  )
  if (vide === undefined) throw new Error(`retour-5b · ${config.nom} : aucun déjeuner vide à afficher.`)
  await monterSemaine()
  const texteVide = texteDe(carteDuCreneau(vide.slot))
  const textePleine = pleine ? texteDe(carteDuCreneau(pleine.slot)) : ''

  // ⛔ LE SEMIS SE VÉRIFIE, IL NE SE SUPPOSE PAS. Un écran qui recompose son propre plan au lieu
  // de relire celui qu'on vient d'écrire rendrait trois textes différents SANS UN MOT DE MOTIF, et
  // la clause 10 passerait au vert sur une confusion de harnais — c'est arrivé le 2026-09-09,
  // avant cette garde. Le plat semé DOIT être celui qui s'affiche.
  if (pleine?.recipeId != null) {
    const titre = catalogueDeTest().recipes.get(pleine.recipeId)?.nom ?? ''
    // ⚠️ LA GARDE LIT LE TEXTE BRUT, boutons compris : sur une carte pleine, le nom du plat EST le
    // bouton « Changer ce plat ». Le retrait des actions, qui sert à comparer les motifs, effacerait
    // justement ce qu'elle vérifie.
    expect(
      (carteDuCreneau(pleine.slot).textContent ?? '').replace(/\s+/g, ' '),
      `retour-5b · ${config.nom} : l’écran n’affiche pas le plan semé — ce n’est pas la clause qui échoue.`
    ).toContain(titre)
  }
  expect(
    texteVide,
    `retour-5b · ${config.nom} : la case semée vide n’est pas vide à l’écran — semis non relu.`
  ).not.toBe(textePleine)

  cleanup()
  return { vide: texteVide, pleine: textePleine }
}

describe('retour-5b · l’écran Semaine écrit le motif', () => {
  it('clause 10 · trois causes donnent TROIS TEXTES DIFFÉRENTS sous la case vide', async () => {
    const textes: string[] = []
    for (const config of [A, B, C]) {
      const { vide, pleine } = await texteDeLaPremiereCaseVide(config)
      expect(vide.length, `${config.nom} · carte vide sans texte.`).toBeGreaterThan(0)
      if (pleine.length > 0) {
        expect(vide, `${config.nom} · la case vide dit la même chose qu’une case pleine.`).not.toBe(pleine)
      }
      textes.push(vide)
    }
    expect(
      new Set(textes).size,
      `trois causes, textes affichés :\n  ${textes.join('\n  ')}`
    ).toBe(3)
  })

  it('clause 11 · sur la cause 1, le texte change quand la couche dominante change', async () => {
    const textes: string[] = []
    for (const config of [C, C_REGIME, C_EXCLUSIONS]) {
      const { vide } = await texteDeLaPremiereCaseVide(config)
      textes.push(vide)
    }
    expect(
      new Set(textes).size,
      `même cause, trois couches dominantes — textes affichés :\n  ${textes.join('\n  ')}`
    ).toBe(3)
  })
})
