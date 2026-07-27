// engine/selection/scoring/variety.ts — couche de score `variety` (docs/ENGINE.md §6.5
// précision 5, §13 fenêtre d'historique de 21 jours glissants).
//
// Récence : ancienneté en jours de la DERNIÈRE occurrence, sur la recette ELLE-MÊME ou sur un plat
// de COMPOSITION PROCHE — la plus récente des deux l'emporte. `signatureByRecipe` résout la
// signature des entrées d'HISTORIQUE (pas de la recette candidate, dont l'appelant fournit déjà
// `signature` directement) : cette fonction reste testable sans dépendre du catalogue complet.
//
// ⚠️ CORRECTION MESURÉE (2026-07-27, décision 31). La règle comparait auparavant l'ingrédient LE
// PLUS LOURD (`recipeMainIngredient`) — le même index que la similarité a dû abandonner. Mesuré sur
// le catalogue réel : 194 paires sur 290 (67 %) partageaient un « ingrédient principal » avec des
// compositions très différentes. Une mousse au chocolat rendait « récentes » des galettes de
// sarrasin, les deux étant majoritairement des œufs par le poids.
//
// Cinq règles comparées (banc app/src/cli/compare-variety.ts) sur des paires jugées pour CETTE
// question — « manger A hier rend-il B répétitif aujourd'hui ? », qui n'est PAS « A et B se
// ressemblent-ils » :
//
//   règle                            déclenche à tort   rate à raison   paires touchées
//   ingrédient le plus lourd              6 / 6             1 / 7            326
//   chevauchement ≥ 0,35                  3 / 6             1 / 7            204
//   chevauchement ≥ 0,45                  0 / 6             1 / 7             86
//   chevauchement ≥ 0,55                  0 / 6             2 / 7             43
//   ≥ 0,45 OU même groupe alim.           4 / 6             1 / 7            735
//   sous-famille ≥ 0,45   ← RETENU        0 / 6             1 / 7            102
//   sous-famille ≥ 0,38                   3 / 6             0 / 7            191
//
// Le repli par `Food.groupe` a été TESTÉ ET ÉCARTÉ : « viandes » mélange bœuf, poulet, porc et
// agneau, donc tout plat carné rendait tout autre plat carné répétitif. La SOUS-FAMILLE
// (`Food.sousFamille`, §6.6 quater) est le MÊME repli, mais d'un cran plus fin : `poulet_blanc` et
// `poulet_cuisse` se replient sur `poulet`, jamais sur « viandes ».
//
// La comparaison se fait donc dans l'ESPACE NORMALISÉ PAR SOUS-FAMILLE
// (`catalog.indexes.recipeFamilySignature`), pas dans l'espace brut que lit la similarité. Les deux
// questions diffèrent : la diversification doit encore distinguer un blanc rôti d'un tajine de
// cuisses, la récence non — voir `computeRecipeFamilySignature` pour la justification complète.
//
// À seuil ÉGAL (0,45) la normalisation ne dégrade rien sur le jeu jugé (0/6 et 1/7 dans les deux
// cas) et rattrape 16 paires que la signature brute manquait, toutes légitimes : gigot × navarin
// d'agneau (14 → 65 %), lentilles vertes × lentilles corail (38 → 90 %), crêpes × flan aux œufs
// (12 → 58 %) et HUIT paires de poulet, dont « poulet au curry » × « poulet teriyaki » (0 → 64 %).
//
// ⚠️ CE SEUIL SEUL ratait « poulet rôti aux carottes » × « poulet au citron et aux olives »
// (39 %), le cas qui avait motivé la sous-famille. La cause n'est pas l'absence de repli — il
// s'applique — mais le POIDS : le poulet pèse 43 % de la signature d'un côté contre 71 % de
// l'autre, et les accompagnements ne se recoupent pas. Descendre le seuil à 0,38 le rattrapait au
// prix de 3 faux déclenchements sur 6. Corrigé autrement en §6.6 quinquies, ci-dessous.
//
// ================================ §6.6 quinquies (2026-07-27) ================================
// DEUX AJOUTS MESURÉS, qui portent la règle à 0 faux ET 0 raté sur les jeux jugés :
//
//  1. SECOND DÉCLENCHEUR — une même sous-famille DÉCLARÉE pesant ≥ 40 % des deux côtés suffit,
//     même quand le chevauchement global reste sous 0,45. Voir `countsAsSameMeal`.
//  2. FILTRE DE CRÉNEAU — une entrée d'historique dont le `creneau` ne figure pas dans les
//     `typesRepas` du candidat est ignorée pour le rapprochement par composition.
//
//   règle                                        déclenche à tort   rate à raison   paires
//   fam ≥ 0,45 (avant)                                0 / 6             1 / 7          102
//   rang 60/25/15 (principal + secondaires)           1 / 6             3 / 7           83
//   rang + départage par rôle                         0 / 6             2 / 7           93
//   fam ≥ 0,45 OU toute famille ≥ 40 %                3 / 6             0 / 7          510
//   + créneau, fam ≥ 0,38                             1 / 6             0 / 7          168
//   + créneau + famille déclarée ≥ 40 %  ← RETENU     0 / 6             0 / 7          174
//
// Le modèle « un ingrédient PRINCIPAL + des SECONDAIRES à poids fixes » a été TESTÉ ET ÉCARTÉ :
// il détruit de l'information. Poulet à 54 % et poulet à 43 % sont proches ; les ramener à
// « 1ᵉʳ » et « 2ᵉ » les éloigne d'un coup, d'où 2 à 3 ratés au lieu d'1. Le départage par rôle
// (le structurant passe devant à part égale) corrige bien le bug d'égalité — « Blanc de poulet
// rôti, carottes fondantes » a carotte 43 % ET poulet 43 %, départagés alphabétiquement, donc la
// machine y voyait « un plat de carottes » — mais ne compense pas la perte.
//
// Le filtre de créneau ne remplace pas le second déclencheur, il le complète : seul, à 0,38, il
// laisse encore passer 1 faux. Ensemble ils tombent à 0. Ce que le créneau écarte, ce sont les
// rapprochements entre moments de la journée — « Clafoutis aux framboises » [gouter] et « Gratin
// de pâtes au jambon » [dejeuner, diner] partagent 40 % et 50 % de lait mais ne peuvent jamais
// être candidats à la même demande. Une fois le créneau appliqué, les paires laitières qui
// subsistent sont légitimes : deux flans au goûter, deux porridges au petit-déjeuner.
//
// `recence = exp(-ageJours / TAU)`, TAU réglable à TROIS CRANS — 3, 7 ou 14 jours, défaut 7 jours
// (§6.5 ter ENGINE, « variety — trois réglages séparés ») — via `ScoreVarietyArgs.tauDays`
// (`VarietyTau`, union littérale fermée : le réglage a trois positions, pas un curseur libre).
// Absent → `VARIETY_RECENCY_TAU_DAYS_DEFAULT` (constante nommée ci-dessous). Ne pas confondre avec
// les 21 jours de la fenêtre d'historique de §13 : TAU règle la VITESSE D'OUBLI (décroissance d'un
// plat individuel), la fenêtre de 21 jours borne la PROFONDEUR des entrées considérées — deux
// horloges indépendantes, l'une ne change pas l'autre. Jamais vu (aucune occurrence pertinente dans
// l'historique fourni) → recence = 0. `nouveaute = 1 - recence`.
//
// Modulation par `habit` (précision 5) : `familiarity` ∈ [0, 1] — 0 = pure nouveauté (le score EST
// la nouveauté), 0.5 = neutre (aucune modulation), 1 = BONUS DE FAMILIARITÉ, le signal s'inverse :
// score = (1 − familiarity)·nouveaute + familiarity·(1 − nouveaute). Cette fonction ne calcule pas
// `familiarity` elle-même — voir scoreHabit, destiné à l'alimenter (P1b-2 pour le câblage).
//
// Override (« Surprends-moi » / « Mes classiques ») : prime sur la modulation — 'surprise' force
// familiarity=0, 'classiques' force familiarity=1, quelle que soit la valeur passée. Vient de
// `SuggestionRequest.varietyMode` (§8.1 ENGINE) depuis P1c ; le vocabulaire de `VarietyOverride`
// était 'classics' (anglais) jusque-là — aligné sur le français comme le reste des unions fermées
// du domaine (`MealOrigin`, `NutrientSense`, `ArchetypeId`) pour éviter une table de traduction
// entre `VarietyMode` et cette union.
//
// Dates : écarts calculés en jours calendaires depuis les chaînes ISO `yyyy-mm-dd`, jamais
// `Date.now()` (§3 ENGINE — l'horloge vient de `today`). Une entrée d'historique postérieure à
// `today` est ignorée (donnée incohérente, ne doit pas produire une ancienneté négative).
//
// Origine des entrées (§6.5 ter ENGINE, §2.7 CONCEPTION_B_VIN_REPAS) : `variety` lit TOUTES les
// entrées d'historique, `choisi` comme `reste` — un reste mangé lasse tout autant qu'un plat
// choisi, la lassitude ne se soucie pas de la raison du repas. C'est l'INVERSE de `habit`, qui ne
// compte que les `choisi` (un reste n'est pas une préférence exprimée) — voir en-tête de habit.ts.
// Asymétrie volontaire : ne pas « corriger » l'un en croyant aligner l'autre.
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { MealHistory, MealSlot, RecipeFamilySignature, RecipeId, VarietyMode } from '../../domain/index.js'
import { signatureOverlap } from '../../nutrition/signature.js'
import type { CandidateSet, ScoringLayerResult, SelectionLayer } from '../index.js'
import { clamp01 } from './index.js'
import { scoreHabit } from './habit.js'

/** Cran de vitesse d'oubli de `variety` (§6.5 ter ENGINE) — trois positions, pas un curseur libre. */
export type VarietyTau = 3 | 7 | 14

/** Cran par défaut quand `tauDays` est absent (§6.5 ter ENGINE). */
const VARIETY_RECENCY_TAU_DAYS_DEFAULT: VarietyTau = 7

const MS_PER_DAY = 86_400_000

/** Repli quand l'appelant ne fournit pas les familles déclarées : le 2ᵉ déclencheur est alors inerte. */
const EMPTY_FAMILIES: ReadonlySet<string> = new Set()

function parseIsoDateUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

function ageInDays(entryDate: string, today: string): number {
  return Math.round((parseIsoDateUtc(today) - parseIsoDateUtc(entryDate)) / MS_PER_DAY)
}

export type VarietyOverride = 'surprise' | 'classiques' | null

/**
 * Seuil de chevauchement au-delà duquel deux plats comptent comme « le même repas » pour la
 * récence, appliqué dans l'espace NORMALISÉ PAR SOUS-FAMILLE. MESURÉ (voir en-tête), pas réglé au
 * jugé : à 0,38 la règle réintroduit des faux rapprochements, à 0,55 elle manque des doublons
 * évidents. Partagé avec `habit`, qui pose la même question sur le même espace.
 */
export const VARIETY_RECENCY_OVERLAP_THRESHOLD = 0.45

/**
 * Second déclencheur (§6.6 quinquies) : part qu'une MÊME sous-famille déclarée doit peser des DEUX
 * côtés pour que les plats comptent comme le même repas, même quand le chevauchement global reste
 * sous `VARIETY_RECENCY_OVERLAP_THRESHOLD`.
 *
 * Ce qu'il rattrape : « blanc de poulet rôti, carottes fondantes » (poulet 43 %) × « poulet au
 * citron et aux olives » (poulet 71 %). Chevauchement global 39 % — les accompagnements n'ont rien
 * en commun — mais c'est deux fois du poulet, et deux jours de suite ça se voit.
 *
 * MESURÉ à 0,30 / 0,40 / 0,50 : 0,40 est le seul à faire 0 faux ET 0 raté. À 0,50 la paire de
 * poulet ci-dessus repasse à travers.
 */
export const VARIETY_RECENCY_FAMILY_PART_THRESHOLD = 0.4

/**
 * « Manger A rend-il B répétitif ? » — LE prédicat de récence, partagé par `variety` et `habit`
 * pour qu'ils ne puissent pas diverger (ils répondaient à la même question avec deux copies du
 * même code). Deux déclencheurs, en OU :
 *
 *  1. le chevauchement global des signatures repliées atteint `VARIETY_RECENCY_OVERLAP_THRESHOLD` ;
 *  2. une MÊME sous-famille DÉCLARÉE pèse `VARIETY_RECENCY_FAMILY_PART_THRESHOLD` des deux côtés.
 *
 * Le point 2 est restreint aux familles déclarées et ce n'est pas cosmétique : les clés d'une
 * `RecipeFamilySignature` mélangent noms de famille et `foodId` bruts. Sans le filtre, partager
 * `oeuf` à 40 % suffirait à rapprocher une mousse au chocolat d'une omelette — mesuré, 3 faux
 * déclenchements sur 6 cas jugés.
 *
 * ⚠️ Ne PAS appeler ce prédicat sans avoir d'abord écarté les entrées d'historique hors créneau
 * (voir `partageCreneau` dans `scoreVariety`) : c'est ce filtre-là qui empêche un clafoutis mangé
 * au goûter de rendre « répétitif » un gratin de pâtes proposé au dîner.
 */
export function countsAsSameMeal(
  signature: RecipeFamilySignature,
  pastSignature: RecipeFamilySignature,
  declaredFamilies: ReadonlySet<string>
): boolean {
  if (signatureOverlap(signature, pastSignature) >= VARIETY_RECENCY_OVERLAP_THRESHOLD) return true

  for (const [key, part] of signature) {
    if (!declaredFamilies.has(key)) continue
    if (part < VARIETY_RECENCY_FAMILY_PART_THRESHOLD) continue
    if ((pastSignature.get(key) ?? 0) >= VARIETY_RECENCY_FAMILY_PART_THRESHOLD) return true
  }
  return false
}

export interface ScoreVarietyArgs {
  readonly recipeId: RecipeId
  /**
   * Signature du candidat NORMALISÉE PAR SOUS-FAMILLE (§6.6 quater). Map vide = composition
   * inconnue, aucun rapprochement. Doit venir du MÊME espace que `signatureByRecipe` : la fonction
   * compare les deux directement et ne peut pas vérifier qu'ils sont commensurables.
   */
  readonly signature: RecipeFamilySignature
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE). */
  readonly today: string
  readonly familiarity: number
  /** Résout la signature des entrées d'historique, même espace que `signature` — voir en-tête. */
  readonly signatureByRecipe?: ReadonlyMap<RecipeId, RecipeFamilySignature>
  /** Sous-familles déclarées (`catalog.indexes.declaredFamilies`) — voir `countsAsSameMeal`. */
  readonly declaredFamilies?: ReadonlySet<string>
  /**
   * Créneaux du CANDIDAT (`Recipe.typesRepas`). Une entrée d'historique dont le `creneau` n'y
   * figure pas est ignorée : un clafoutis mangé au goûter ne doit pas rendre « répétitif » un
   * gratin de pâtes proposé au dîner, les deux ne pouvant jamais être candidats à la même demande.
   *
   * ⚠️ Ce n'est PAS « même créneau que la demande en cours ». Poulet au déjeuner puis poulet au
   * dîner DOIT compter comme répétitif : la recette candidate porte `[dejeuner, diner]`, donc
   * l'entrée de déjeuner passe le filtre. Comparer au créneau demandé casserait ce cas.
   *
   * Absent → aucun filtrage (créneaux inconnus). Réservé aux appels unitaires qui ne testent pas
   * cette dimension ; le câblage réel les fournit toujours.
   */
  readonly candidateSlots?: readonly MealSlot[] | undefined
  readonly override?: VarietyOverride
  /** Cran de vitesse d'oubli — 3/7/14 jours. Absent → `VARIETY_RECENCY_TAU_DAYS_DEFAULT` (7). */
  readonly tauDays?: VarietyTau
}

/** `true` si l'entrée peut concerner le même repas que le candidat — voir `candidateSlots`. */
function partageCreneau(entrySlot: MealSlot, candidateSlots: readonly MealSlot[] | undefined): boolean {
  return candidateSlots === undefined || candidateSlots.includes(entrySlot)
}

export function scoreVariety(args: ScoreVarietyArgs): number {
  let bestAgeJours: number | null = null

  for (const historyEntry of args.history.entries) {
    if (historyEntry.date > args.today) continue // postérieure à today : ignorée

    const matchesRecipe = historyEntry.recipeId === args.recipeId
    const pastSignature = args.signatureByRecipe?.get(historyEntry.recipeId)
    const matchesComposition =
      pastSignature !== undefined &&
      partageCreneau(historyEntry.creneau, args.candidateSlots) &&
      countsAsSameMeal(args.signature, pastSignature, args.declaredFamilies ?? EMPTY_FAMILIES)

    // `matchesRecipe` n'est VOLONTAIREMENT pas filtré par créneau : avoir mangé exactement cette
    // recette compte, quel que soit le moment de la journée. Seul le rapprochement par COMPOSITION,
    // qui est une inférence, exige que les deux plats puissent occuper la même place.
    if (!matchesRecipe && !matchesComposition) continue

    const age = ageInDays(historyEntry.date, args.today)
    if (bestAgeJours === null || age < bestAgeJours) bestAgeJours = age
  }

  const tauDays = args.tauDays ?? VARIETY_RECENCY_TAU_DAYS_DEFAULT
  const recence = bestAgeJours === null ? 0 : Math.exp(-bestAgeJours / tauDays)
  const nouveaute = 1 - recence

  const familiarity =
    args.override === 'surprise' ? 0 : args.override === 'classiques' ? 1 : args.familiarity

  const score = (1 - familiarity) * nouveaute + familiarity * (1 - nouveaute)
  return clamp01(score)
}

// ------------------------------------------------------------------------------------------
// Couche `variety` (§6.2 ENGINE) — enveloppe `scoreVariety` dans le contrat `SelectionLayer`.
//
// `configure` pré-calcule ce qui dépend du `Catalog` : `signatureByRecipe` est directement
// `catalog.indexes.recipeFamilySignature` (§9.1 ENGINE) — le même index sert à la fois à résoudre
// la signature du CANDIDAT scoré et celle des entrées d'HISTORIQUE, ce qui garantit que les deux
// côtés de la comparaison vivent dans le même espace (voir en-tête de fichier). `history`/`today`
// viennent de `req.history`/`req.context.date`.
//
// ⚠️ Import de `scoreHabit` depuis `./habit.js` : NE PAS lire comme un couplage entre couches. Ce
// n'est PAS `habitLayer` qui est appelé ici — c'est la fonction PURE `scoreHabit` du même module
// `scoring/`, exactement comme le documente l'en-tête de ce fichier (§6.5 précision 5 : « habit
// module variety »). Une couche ne connaît toujours ni les autres couches ni le pipeline (§6.2
// ENGINE) : `varietyLayer` ne référence jamais `habitLayer`, seulement une fonction de calcul.
//
// `familiarity` est donc calculée PAR CANDIDAT dans `apply`, avant l'appel à `scoreVariety` —
// c'est un calcul dérivé de `candidates`/`config`, pas quelque chose de pré-calculable une fois
// pour toutes au `configure` (il dépend du `recipeId` scoré). `override`, lui, EST pré-calculable :
// il vaut la même chose pour tous les candidats, il est donc résolu une fois au `configure` depuis
// `req.varietyMode` (P1c, §8.1 ENGINE).
//
// ⚠️ La modulation par `habit` continue d'être calculée même sous override, alors que le résultat
// sera écrasé. C'est délibéré : sauter `scoreHabit` ferait diverger le chemin « avec override » du
// chemin normal, et `scoreVariety` est la SEULE à connaître la règle de priorité (voir sa
// signature — elle reçoit `familiarity` ET `override`, et tranche elle-même). Le coût est un
// exponentielle par candidat sur un catalogue en RAM.
// ------------------------------------------------------------------------------------------

export interface VarietyLayerConfig {
  readonly history: MealHistory
  /** ISO yyyy-mm-dd — horloge injectée (§3 ENGINE), reprise de `req.context.date`. */
  readonly today: string
  readonly signatureByRecipe: ReadonlyMap<RecipeId, RecipeFamilySignature>
  /** `catalog.indexes.declaredFamilies` — voir `countsAsSameMeal`. */
  readonly declaredFamilies: ReadonlySet<string>
  /** `Recipe.typesRepas` par recette — sert à écarter les entrées d'historique hors créneau. */
  readonly slotsByRecipe: ReadonlyMap<RecipeId, readonly MealSlot[]>
  /**
   * Résolu depuis `req.varietyMode` (§8.1 ENGINE) : `'auto'` et l'absence donnent tous deux
   * `null` — la position `auto` de `VarietyMode` n'existe pas dans `VarietyOverride`, l'absence
   * d'override EST le mode automatique.
   */
  readonly override: VarietyOverride
}

/** `VarietyMode` (domain/, L1) → `VarietyOverride` (scoring, L3) — voir `VarietyLayerConfig`. */
function resolveOverride(mode: VarietyMode | undefined): VarietyOverride {
  return mode === undefined || mode === 'auto' ? null : mode
}

export const varietyLayer: SelectionLayer<VarietyLayerConfig> = {
  id: 'variety',
  kind: 'scoring',
  critical: false,
  defaultWeight: 0.15,

  configure: (req, catalog) => ({
    history: req.history,
    today: req.context.date,
    signatureByRecipe: catalog.indexes.recipeFamilySignature,
    declaredFamilies: catalog.indexes.declaredFamilies,
    slotsByRecipe: new Map([...catalog.recipes].map(([id, recipe]) => [id, recipe.typesRepas])),
    override: resolveOverride(req.varietyMode),
  }),

  apply: (candidates: CandidateSet, config: VarietyLayerConfig): ScoringLayerResult => {
    const scores = new Map<RecipeId, number>()
    for (const recipeId of candidates) {
      const signature = config.signatureByRecipe.get(recipeId) ?? new Map()
      const candidateSlots = config.slotsByRecipe.get(recipeId)
      const familiarity = scoreHabit({
        recipeId,
        signature,
        history: config.history,
        today: config.today,
        signatureByRecipe: config.signatureByRecipe,
        declaredFamilies: config.declaredFamilies,
        candidateSlots,
      })
      scores.set(
        recipeId,
        scoreVariety({
          recipeId,
          signature,
          history: config.history,
          today: config.today,
          familiarity,
          signatureByRecipe: config.signatureByRecipe,
          declaredFamilies: config.declaredFamilies,
          candidateSlots,
          override: config.override,
        })
      )
    }
    return { scores }
  },
}
