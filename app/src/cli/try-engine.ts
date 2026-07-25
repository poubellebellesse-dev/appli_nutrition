// cli/try-engine.ts — banc d'essai en ligne de commande du moteur (docs/ENGINE.md §11.3, §6.8).
//
// Rôle : juger le moteur SANS navigateur ni UI — le point de non-retour de §12 ENGINE (« si le
// moteur ne produit pas des repas crédibles en ligne de commande, aucune interface ne le
// sauvera »). Construit une `SuggestionRequest` à la main, appelle `engine.suggestMeals(request)`
// (§8 ENGINE, câblé P1c) et affiche un rapport LISIBLE PAR UN HUMAIN (jamais un dump JSON) :
// contexte effectif → entonnoir d'exclusion (§6.8) → poids appliqués → classement expliqué.
//
// ⚠️ CHANGEMENT DE STRUCTURE (P1c) : ce banc appelait autrefois `runExclusionPass`/
// `runScoringPass`/`diversify`/`explainSuggestion` À LA MAIN, et redérivait son propre catalogue
// enrichi via `attachDerivedIndexes` (§6.5 précision 8) parce que `createEngine` gardait le sien
// en fermeture sans l'exposer. Les deux dettes sont soldées ici : `suggestMeals` est la SEULE
// porte d'entrée du pipeline — entonnoir, poids, classement et explications viennent tous de son
// `SuggestionResult` — et ce fichier n'appelle plus jamais `attachDerivedIndexes` (le catalogue
// « brut » suffit pour les lookups d'affichage : noms de recettes/aliments/allergènes ne sont pas
// affectés par l'enrichissement, seul `catalog.indexes` l'est).
//
// Une information affichée par l'ancienne version n'a PAS survécu à ce changement : la similarité
// maximale de chaque recette retenue avec les précédentes (`DiversifiedCandidate.
// maxSimilarityToRetained`, engine/selection/diversify.ts). `ScoredSuggestion` (domain/result.ts,
// §8.2 ENGINE) n'a que les 6 champs listés par la doc — recipeId/score/breakdown/explanations/
// portions/nutrition — aucun champ de diagnostic MMR. Plutôt que de rappeler `diversify` ici en
// doublon pour le retrouver (exactement la dette qu'on solde), cette ligne d'affichage a été
// retirée ; voir le rapport de lot pour la décision et la piste (l'ajouter à `ScoredSuggestion`
// serait un changement de contrat public, hors périmètre de ce fichier).
//
// Exécution : `npm run engine:try -- [options]` (tsx, comme `catalog:list` — voir package.json).
// Nécessite `catalog.db` généré (`npm run build`).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader.js'
import { createEngine } from '../engine/api/index.js'
import { ARCHETYPE_WEIGHT_OVERRIDES, DEFAULT_ARCHETYPE, DEFAULT_MMR_LAMBDA, EXCLUSION_LAYERS } from '../engine/selection/index.js'
import type {
  AllergenId,
  ArchetypeId,
  Catalog,
  CravingAxes,
  DietCode,
  ExclusionLayerId,
  FoodId,
  MealHistory,
  MealSlot,
  RejectionSummary,
  ScoredSuggestion,
  ScoreWeights,
  ScoringLayerId,
  SuggestionRequest,
  UserProfile,
} from '../engine/domain/index.js'
import { NoViableRecipeError, min } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')

// ------------------------------------------------------------------------------------------
// Défauts du banc — DOCUMENTÉS (demandé explicitement) plutôt qu'implicites.
// ------------------------------------------------------------------------------------------

const DEFAULT_SLOT: MealSlot = 'diner'

/**
 * Date par défaut FIXE EN DUR — jamais `new Date()` ni aucun accès à l'horloge système, ici
 * comme dans engine/ (§3 ENGINE : « horloge injectée, jamais implicite »). Deux raisons
 * cumulées : (1) le moteur interdit explicitement l'horloge implicite dans son propre code, un
 * banc qui l'exercerait avec `Date.now()` serait incohérent avec ce qu'il est censé vérifier ;
 * (2) un banc d'essai reproductible (même sortie à chaque exécution, pour comparer un run
 * d'aujourd'hui à un run d'il y a un mois) vaut mieux qu'un banc dont le résultat dérive avec le
 * calendrier — notamment via la couche `season`, sensible au mois de `--date`. Valeur choisie
 * arbitrairement (15 juin, milieu d'année) : rien de spécial dans le catalogue ne s'y accroche.
 */
const DEFAULT_DATE = '2026-06-15'

const DEFAULT_LIMIT = 5
const DEFAULT_SEED = 42

/**
 * Table de traduction `--envie` → `CravingAxes` (demandée explicitement, documentée ici).
 * Un axe non cité dans `--envie` reste `null` dans la requête — c'est ce qui fait que seuls les
 * axes RÉELLEMENT DEMANDÉS comptent dans `scoreCraving` (§6.5 précision 2 ENGINE), au lieu de
 * comparer systématiquement les 3 axes.
 */
const CRAVING_AXIS_MAP: Readonly<Record<string, { readonly axis: keyof CravingAxes; readonly value: number }>> = {
  leger: { axis: 'legerConsistant', value: -1 },
  consistant: { axis: 'legerConsistant', value: 1 },
  chaud: { axis: 'chaudFroid', value: 1 },
  froid: { axis: 'chaudFroid', value: -1 },
  sale: { axis: 'sucreSale', value: -1 },
  sucre: { axis: 'sucreSale', value: 1 },
}

/** Libellés humains des couches d'exclusion (§6.8 ENGINE — accentués, contrairement aux `LayerId`). */
const EXCLUSION_LAYER_LABELS: Readonly<Record<ExclusionLayerId, string>> = {
  allergenes: 'allergènes',
  regime: 'régime',
  exclusions: 'exclusions',
  requis: 'requis',
  temps: 'temps',
  equipement: 'équipement',
}

/** Libellés humains des couches de score effectivement implémentées (voir SCORING_LAYERS). */
const SCORING_LAYER_LABELS: Partial<Record<ScoringLayerId, string>> = {
  nutri: 'nutrition',
  preference: 'préférences',
  craving: 'envie',
  variety: 'variété',
  season: 'saison',
  habit: 'habitudes',
  speed: 'rapidité',
}

function scoringLayerLabel(id: ScoringLayerId): string {
  return SCORING_LAYER_LABELS[id] ?? id
}

// ------------------------------------------------------------------------------------------
// Lecture des arguments — `process.argv` seul, aucune dépendance externe (demandé explicitement).
// ------------------------------------------------------------------------------------------

class CliUsageError extends Error {}

const KNOWN_VALUE_FLAGS = [
  'slot',
  'date',
  'temps',
  'envie',
  'archetype',
  'allergies',
  'regime',
  'exclus',
  'requis',
  'pref',
  'limit',
  'seed',
  'lambda',
] as const

/** Drapeaux sans valeur (présence = vrai) — `--no-mmr` compare le classement brut au classement
 * diversifié (§6.6 ENGINE) sans avoir à répéter une valeur, comme `--flag` en ligne de commande usuelle. */
const KNOWN_BOOLEAN_FLAGS = ['no-mmr'] as const

const KNOWN_FLAGS = [...KNOWN_VALUE_FLAGS, ...KNOWN_BOOLEAN_FLAGS]

interface RawArgs {
  readonly values: ReadonlyMap<string, string>
  readonly flags: ReadonlySet<string>
}

function readRawArgs(argv: readonly string[]): RawArgs {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!
    if (!token.startsWith('--')) {
      throw new CliUsageError(`argument inattendu '${token}' — toutes les options s'écrivent --nom valeur`)
    }
    const name = token.slice(2)
    if ((KNOWN_BOOLEAN_FLAGS as readonly string[]).includes(name)) {
      flags.add(name)
      continue
    }
    if (!(KNOWN_VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new CliUsageError(`option inconnue --${name} — options valides : ${KNOWN_FLAGS.map((f) => `--${f}`).join(', ')}`)
    }
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new CliUsageError(`--${name} attend une valeur`)
    }
    values.set(name, value)
    i++
  }
  return { values, flags }
}

const MEAL_SLOTS: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

function parseSlot(raw: string | undefined): MealSlot {
  const value = raw ?? DEFAULT_SLOT
  if (!(MEAL_SLOTS as readonly string[]).includes(value)) {
    throw new CliUsageError(`--slot invalide '${value}' — valeurs valides : ${MEAL_SLOTS.join(', ')}`)
  }
  return value as MealSlot
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Pas de `Date` ici — même esprit que §3 ENGINE (« jamais `new Date()` ») : validation calendaire
 * manuelle plutôt que de construire un objet horloge, même de façon déterministe. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[month - 1]!
}

function parseDate(raw: string | undefined): string {
  const value = raw ?? DEFAULT_DATE
  if (!ISO_DATE_RE.test(value)) {
    throw new CliUsageError(`--date invalide '${value}' — format attendu yyyy-mm-dd`)
  }
  const [yearStr, monthStr, dayStr] = value.split('-') as [string, string, string]
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new CliUsageError(`--date invalide '${value}' — date calendaire impossible`)
  }
  return value
}

function parseTemps(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new CliUsageError(`--temps invalide '${raw}' — entier positif attendu (minutes)`)
  }
  return value
}

interface ParsedEnvie {
  readonly envie: CravingAxes | null
  readonly tokens: readonly string[]
}

function parseEnvie(raw: string | undefined): ParsedEnvie {
  if (raw === undefined) return { envie: null, tokens: [] }
  const tokens = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (tokens.length === 0) return { envie: null, tokens: [] }

  let sucreSale: number | null = null
  let legerConsistant: number | null = null
  let chaudFroid: number | null = null

  for (const token of tokens) {
    const mapped = CRAVING_AXIS_MAP[token]
    if (!mapped) {
      throw new CliUsageError(
        `--envie : mot-clé inconnu '${token}' — valeurs valides : ${Object.keys(CRAVING_AXIS_MAP).join(', ')}`
      )
    }
    if (mapped.axis === 'sucreSale') sucreSale = mapped.value
    else if (mapped.axis === 'legerConsistant') legerConsistant = mapped.value
    else chaudFroid = mapped.value
  }

  return { envie: { sucreSale, legerConsistant, chaudFroid }, tokens }
}

const VALID_ARCHETYPES = Object.keys(ARCHETYPE_WEIGHT_OVERRIDES) as readonly ArchetypeId[]

function parseArchetype(raw: string | undefined): ArchetypeId {
  const value = raw ?? DEFAULT_ARCHETYPE
  if (!(VALID_ARCHETYPES as readonly string[]).includes(value)) {
    throw new CliUsageError(`--archetype invalide '${value}' — valeurs valides : ${VALID_ARCHETYPES.join(', ')}`)
  }
  return value as ArchetypeId
}

function parseAllergies(raw: string | undefined, catalog: Catalog): readonly AllergenId[] {
  if (raw === undefined) return []
  const codes = raw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
  if (codes.length === 0) return []

  const byCode = new Map<string, AllergenId>()
  for (const allergen of catalog.allergens.values()) byCode.set(allergen.code, allergen.id)

  const result: AllergenId[] = []
  for (const code of codes) {
    const id = byCode.get(code)
    if (!id) {
      throw new CliUsageError(`--allergies : code inconnu '${code}' — codes valides : ${[...byCode.keys()].sort().join(', ')}`)
    }
    result.push(id)
  }
  return result
}

/**
 * `DietCode` est un vocabulaire OUVERT (pas de CHECK en base, voir domain/catalog.ts) : à la
 * différence des allergènes, aucune liste fermée à valider ici. Un code sans recette
 * correspondante n'est pas une ERREUR D'ARGUMENT — c'est un cas légitime que la couche `regime`
 * traduira en 0 candidat, exactement le cas que ce banc sait signaler (voir printNoCandidates).
 */
function parseRegime(raw: string | undefined): DietCode | null {
  return raw ?? null
}

function parseFoodIdList(raw: string | undefined, catalog: Catalog, flagName: string): readonly FoodId[] {
  if (raw === undefined) return []
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const id of ids) {
    if (!catalog.foods.has(id as FoodId)) {
      throw new CliUsageError(`--${flagName} : foodId inconnu '${id}' (absent du catalogue)`)
    }
  }
  return ids as FoodId[]
}

function parsePreferences(raw: string | undefined, catalog: Catalog): ReadonlyMap<FoodId, number> {
  const preferences = new Map<FoodId, number>()
  if (raw === undefined) return preferences

  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':')
    if (separatorIndex === -1) {
      throw new CliUsageError(`--pref : entrée invalide '${entry}' — format attendu foodId:valeur (ex. tomate:+2)`)
    }
    const foodId = entry.slice(0, separatorIndex)
    const valueRaw = entry.slice(separatorIndex + 1)
    const value = Number(valueRaw)

    if (!catalog.foods.has(foodId as FoodId)) {
      throw new CliUsageError(`--pref : foodId inconnu '${foodId}' (absent du catalogue)`)
    }
    if (!Number.isInteger(value) || value < -2 || value > 2) {
      throw new CliUsageError(`--pref : valeur invalide '${valueRaw}' pour '${foodId}' — entier entre -2 et 2 attendu`)
    }
    preferences.set(foodId as FoodId, value)
  }
  return preferences
}

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new CliUsageError(`--limit invalide '${raw}' — entier positif attendu`)
  }
  return value
}

function parseSeed(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_SEED
  const value = Number(raw)
  if (!Number.isInteger(value)) {
    throw new CliUsageError(`--seed invalide '${raw}' — entier attendu`)
  }
  return value
}

/** §6.6 ENGINE : λ n'a de sens qu'en pénalité, jamais négatif (une similarité négative n'existe
 * pas, `similarity` reste dans [0, 1] — voir engine/selection/similarity.ts). */
function parseLambda(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MMR_LAMBDA
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new CliUsageError(`--lambda invalide '${raw}' — nombre réel ≥ 0 attendu`)
  }
  return value
}

interface CliOptions {
  readonly slot: MealSlot
  readonly date: string
  readonly tempsDisponibleMin: number | null
  readonly envieTokens: readonly string[]
  readonly envie: CravingAxes | null
  readonly archetype: ArchetypeId
  readonly allergies: readonly AllergenId[]
  readonly regime: DietCode | null
  readonly exclus: readonly FoodId[]
  readonly requis: readonly FoodId[]
  readonly preferences: ReadonlyMap<FoodId, number>
  readonly limit: number
  readonly seed: number
  /** §6.6 ENGINE — poids de la pénalité de redondance dans la diversification MMR. Sans effet si `noMmr`. */
  readonly lambda: number
  /** `--no-mmr` : désactive la diversification, affiche le classement brut par score (comparaison). */
  readonly noMmr: boolean
}

function parseOptions(argv: readonly string[], catalog: Catalog): CliOptions {
  const raw = readRawArgs(argv)
  const { envie, tokens: envieTokens } = parseEnvie(raw.values.get('envie'))

  return {
    slot: parseSlot(raw.values.get('slot')),
    date: parseDate(raw.values.get('date')),
    tempsDisponibleMin: parseTemps(raw.values.get('temps')),
    envieTokens,
    envie,
    archetype: parseArchetype(raw.values.get('archetype')),
    allergies: parseAllergies(raw.values.get('allergies'), catalog),
    regime: parseRegime(raw.values.get('regime')),
    exclus: parseFoodIdList(raw.values.get('exclus'), catalog, 'exclus'),
    requis: parseFoodIdList(raw.values.get('requis'), catalog, 'requis'),
    preferences: parsePreferences(raw.values.get('pref'), catalog),
    limit: parseLimit(raw.values.get('limit')),
    seed: parseSeed(raw.values.get('seed')),
    lambda: parseLambda(raw.values.get('lambda')),
    noMmr: raw.flags.has('no-mmr'),
  }
}

// ------------------------------------------------------------------------------------------
// Construction de la requête.
// ------------------------------------------------------------------------------------------

/**
 * Profil UTILISATEUR DU BANC — valeurs plausibles en dur, PAS un défaut produit (aucun
 * onboarding ici, aucune valeur qui devrait un jour vivre ailleurs que dans ce fichier). Choisi
 * pour que `computeEnergyNeeds` (engine/nutrition/energy-needs.ts) retourne une valeur non nulle
 * (taille/poids renseignés) et que la couche `nutri` ait donc une cible réellement personnalisée
 * à comparer, plutôt que de retomber sur les VNR à plat.
 */
const BENCH_PROFILE: UserProfile = {
  trancheAge: '30_49',
  sexe: 'NP',
  tailleCm: 170,
  poidsKg: 70,
  niveauActivite: 'peu_actif',
  facteurPortion: 1,
}

/** Historique vide — démarrage à froid (§7.5 ENGINE) : `habit` neutre, `variety` sans récence à
 * pénaliser. Fenêtre 21 jours = le défaut documenté §13 ENGINE, même si aucune entrée n'y vit ici. */
const EMPTY_HISTORY: MealHistory = { windowDays: 21, entries: [] }

function buildRequest(opts: CliOptions): SuggestionRequest {
  return {
    profile: BENCH_PROFILE,
    constraints: {
      allergies: opts.allergies,
      diet: opts.regime,
      excludedFoodIds: opts.exclus,
    },
    context: {
      creneau: opts.slot,
      date: opts.date,
      tempsDisponibleMin: opts.tempsDisponibleMin === null ? null : min(opts.tempsDisponibleMin),
      envie: opts.envie,
      pantryFoodIds: [],
      requiredFoodIds: opts.requis,
    },
    history: EMPTY_HISTORY,
    preferences: opts.preferences,
    activeTopics: [],
    archetype: opts.archetype,
    limit: opts.limit,
    seed: opts.seed,
    mmrLambda: opts.lambda,
    skipDiversification: opts.noMmr,
  }
}

// ------------------------------------------------------------------------------------------
// Affichage — dans l'ordre demandé : en-tête → entonnoir → poids → classement (ou motif de rejet
// dominant si 0 candidat).
// ------------------------------------------------------------------------------------------

function describeCravingAxes(envie: CravingAxes | null): string {
  if (envie === null) return '(aucun axe)'
  const parts: string[] = []
  if (envie.legerConsistant !== null) parts.push(`légerConsistant=${envie.legerConsistant}`)
  if (envie.chaudFroid !== null) parts.push(`chaudFroid=${envie.chaudFroid}`)
  if (envie.sucreSale !== null) parts.push(`sucreSale=${envie.sucreSale}`)
  return parts.join(', ')
}

/** Reconstruit la commande à partir des options RÉSOLUES (pas de `argv` brut) : les défauts
 * implicites (créneau, date, archétype, limit, seed…) sont donc rendus EXPLICITES, pour que la
 * commande affichée rejoue exactement le même run même si l'appel d'origine omettait ces options. */
function buildReplayCommand(opts: CliOptions): string {
  const parts = ['npm run engine:try --', `--slot ${opts.slot}`, `--date ${opts.date}`]
  if (opts.tempsDisponibleMin !== null) parts.push(`--temps ${opts.tempsDisponibleMin}`)
  if (opts.envieTokens.length > 0) parts.push(`--envie ${opts.envieTokens.join(',')}`)
  parts.push(`--archetype ${opts.archetype}`)
  if (opts.allergies.length > 0) parts.push(`--allergies ${opts.allergies.join(',')}`)
  if (opts.regime !== null) parts.push(`--regime ${opts.regime}`)
  if (opts.exclus.length > 0) parts.push(`--exclus ${opts.exclus.join(',')}`)
  if (opts.requis.length > 0) parts.push(`--requis ${opts.requis.join(',')}`)
  if (opts.preferences.size > 0) {
    const prefStr = [...opts.preferences.entries()].map(([id, v]) => `${id}:${v >= 0 ? '+' : ''}${v}`).join(',')
    parts.push(`--pref ${prefStr}`)
  }
  if (opts.noMmr) parts.push('--no-mmr')
  else if (opts.lambda !== DEFAULT_MMR_LAMBDA) parts.push(`--lambda ${opts.lambda}`)
  parts.push(`--limit ${opts.limit}`, `--seed ${opts.seed}`)
  return parts.join(' ')
}

function printHeader(opts: CliOptions, catalog: Catalog, engineVersion: string, catalogVersion: string): void {
  console.log("=== engine:try — banc d'essai du moteur (docs/ENGINE.md §11.3) ===")
  console.log(`Moteur v${engineVersion} · catalogue v${catalogVersion} (${catalog.recipes.size} recette(s))`)
  console.log('')
  console.log(`Créneau      : ${opts.slot}`)
  console.log(`Date         : ${opts.date}${opts.date === DEFAULT_DATE ? " (défaut fixe — jamais l'horloge système, voir en-tête de fichier)" : ''}`)
  console.log(`Archétype    : ${opts.archetype}`)
  console.log(`Temps dispo  : ${opts.tempsDisponibleMin === null ? '(aucune contrainte)' : `${opts.tempsDisponibleMin} min`}`)
  console.log(
    `Envie        : ${opts.envieTokens.length === 0 ? '(aucune)' : `${opts.envieTokens.join(', ')} → ${describeCravingAxes(opts.envie)}`}`
  )
  console.log(
    `Allergies    : ${opts.allergies.length === 0 ? '(aucune)' : opts.allergies.map((id) => catalog.allergens.get(id)?.nom ?? id).join(', ')}`
  )
  console.log(`Régime       : ${opts.regime ?? '(aucun)'}`)
  console.log(
    `Exclus       : ${opts.exclus.length === 0 ? '(aucun)' : opts.exclus.map((id) => catalog.foods.get(id)?.nom ?? id).join(', ')}`
  )
  console.log(
    `Requis       : ${opts.requis.length === 0 ? '(aucun)' : opts.requis.map((id) => catalog.foods.get(id)?.nom ?? id).join(', ')}`
  )
  console.log(
    `Préférences  : ${
      opts.preferences.size === 0
        ? '(aucune)'
        : [...opts.preferences.entries()].map(([id, v]) => `${catalog.foods.get(id)?.nom ?? id}:${v}`).join(', ')
    }`
  )
  console.log(`Limit / seed : ${opts.limit} / ${opts.seed}`)
  console.log(
    `Diversif.    : ${
      opts.noMmr
        ? 'désactivée (--no-mmr) — classement brut par score'
        : `MMR active, λ=${opts.lambda}${opts.lambda === DEFAULT_MMR_LAMBDA ? ' (DEFAULT_MMR_LAMBDA)' : ''} (§6.6 ENGINE)`
    }`
  )
  console.log('')
  console.log(`Rejouer : ${buildReplayCommand(opts)}`)
  console.log('')
}

function printFunnel(rejected: RejectionSummary): void {
  console.log("--- Entonnoir d'exclusion (§6.8 ENGINE) ---")
  console.log(`${rejected.totalInitial} recette(s) au créneau`)

  for (const layer of EXCLUSION_LAYERS) {
    const layerId = layer.id as ExclusionLayerId
    const count = rejected.byLayer.get(layerId) ?? 0
    if (count === 0) continue // seules les couches ayant réellement écarté quelque chose s'affichent
    console.log(`  → ${EXCLUSION_LAYER_LABELS[layerId].padEnd(12)} − ${count}`)
  }

  console.log(`= ${rejected.totalInitial - rejected.totalRejected} candidat(s)`)
  console.log('')
}

function printWeights(weights: Partial<ScoreWeights>): void {
  console.log("--- Poids appliqués (après archétype, bascule d'envie, normalisation) ---")
  const entries = Object.entries(weights) as Array<[ScoringLayerId, number]>

  if (entries.length === 0) {
    console.log('  (aucune couche active — score neutre 0.5 pour tout candidat, §6.4 règle 4 ENGINE)')
  } else {
    entries.sort((a, b) => b[1] - a[1])
    for (const [id, weight] of entries) {
      console.log(`  ${scoringLayerLabel(id).padEnd(14)} ${(weight * 100).toFixed(1)}%`)
    }
  }
  console.log('')
}

/**
 * Classement (§6.4, §6.7 ENGINE) — une seule fonction pour les deux modes d'affichage
 * (`--no-mmr` ou MMR active) : `result.suggestions` vient DÉJÀ du bon classement, `suggestMeals`
 * ayant lui-même appliqué `diversify` ou non selon `request.skipDiversification` (§6.6 ENGINE).
 * Ce banc n'a donc plus qu'à FORMATER — `breakdown` et `explanations` sont repris tels quels
 * depuis chaque `ScoredSuggestion`, jamais recalculés ici (voir en-tête de fichier).
 */
function printSuggestions(
  suggestions: readonly ScoredSuggestion[],
  catalog: Catalog,
  opts: CliOptions,
  candidatsApresFiltrage: number
): void {
  console.log(
    opts.noMmr
      ? `--- Classement (top ${opts.limit}) ---`
      : `--- Classement diversifié (MMR, λ=${opts.lambda}, §6.6 ENGINE) ---`
  )

  suggestions.forEach((suggestion, index) => {
    const recipe = catalog.recipes.get(suggestion.recipeId)
    const nom = recipe?.nom ?? suggestion.recipeId
    console.log(`#${index + 1}  ${nom} — ${suggestion.score.toFixed(1)}/100`)

    const contributions = (Object.entries(suggestion.breakdown) as Array<[ScoringLayerId, number]>).sort(
      (a, b) => b[1] - a[1]
    )
    for (const [id, contribution] of contributions) {
      console.log(`      ${scoringLayerLabel(id).padEnd(14)} ${(contribution * 100).toFixed(1)}`)
    }

    if (suggestion.explanations.length === 0) {
      console.log(
        '      Explication : (aucune — aucune couche de score ne discrimine sur cet ensemble de candidats, §6.7 ENGINE)'
      )
    } else {
      console.log(`      Explication : ${suggestion.explanations.map((e) => `« ${e.label} »`).join(' · ')}`)
    }
  })
  console.log('')
  console.log(
    `${candidatsApresFiltrage} candidat(s) classé(s) au total, ${suggestions.length} ` +
      `${opts.noMmr ? 'affiché(s)' : 'retenu(s) après diversification'} (--limit ${opts.limit}).`
  )
}

/** 0 candidat après exclusion (§8.3 ENGINE, `NoViableRecipeError` côté API) : le cas que l'UI
 * transformera en écran « assouplir un critère », motif dominant issu de `RejectionSummary`. */
function printNoCandidates(rejected: RejectionSummary): void {
  console.log('--- Résultat ---')
  console.log('0 candidat après exclusion : aucune suggestion possible avec ces contraintes.')

  if (rejected.entries.length === 0) {
    console.log('(le créneau demandé ne contient déjà aucune recette dans le catalogue)')
    return
  }

  const exampleByLayer = new Map<ExclusionLayerId, string>()
  for (const entry of rejected.entries) {
    if (!exampleByLayer.has(entry.layerId)) exampleByLayer.set(entry.layerId, entry.reason)
  }

  let dominant: ExclusionLayerId | null = null
  let dominantCount = 0
  for (const layer of EXCLUSION_LAYERS) {
    const layerId = layer.id as ExclusionLayerId
    const count = rejected.byLayer.get(layerId) ?? 0
    if (count > dominantCount) {
      dominant = layerId
      dominantCount = count
    }
  }

  if (dominant !== null) {
    console.log(
      `Motif dominant : ${EXCLUSION_LAYER_LABELS[dominant]} (${dominantCount} recette(s) écartée(s) sur ce motif)`
    )
    console.log(`  ex. « ${exampleByLayer.get(dominant)} »`)
  }
  console.log("→ cas « assouplir un critère » (§8.3 ENGINE) : c'est ce que l'interface devra proposer ici.")
}

// ------------------------------------------------------------------------------------------
// Orchestration.
// ------------------------------------------------------------------------------------------

function run(argv: readonly string[]): void {
  const catalog = loadCatalog(DEFAULT_DB_PATH)
  const engine = createEngine(catalog)

  const opts = parseOptions(argv, catalog)
  const request = buildRequest(opts)

  printHeader(opts, catalog, engine.version, engine.catalogVersion)

  let result: ReturnType<typeof engine.suggestMeals>
  try {
    result = engine.suggestMeals(request)
  } catch (err) {
    if (err instanceof NoViableRecipeError) {
      printNoCandidates(err.rejected)
      return
    }
    throw err
  }

  printFunnel(result.rejected)

  // Seules les couches à poids > 0 s'affichent (même convention que l'ancien
  // `scoringResult.weights`, partiel) — `EngineDiagnostics.weights` est désormais un
  // `ScoreWeights` COMPLET (§8.2 ENGINE), zéros compris pour les couches non implémentées.
  const activeWeights = Object.fromEntries(
    (Object.entries(result.diagnostics.weights) as Array<[ScoringLayerId, number]>).filter(([, weight]) => weight > 0)
  ) as Partial<ScoreWeights>
  printWeights(activeWeights)

  printSuggestions(result.suggestions, catalog, opts, result.diagnostics.candidatsApresFiltrage)
}

function main(): void {
  try {
    run(process.argv.slice(2))
  } catch (err) {
    if (err instanceof CliUsageError) {
      console.error(`engine:try — ${err.message}`)
      console.error(`\nOptions : ${KNOWN_FLAGS.map((f) => `--${f}`).join(', ')}`)
      process.exitCode = 1
      return
    }
    throw err
  }
}

main()
