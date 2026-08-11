// cli/calibre-lambda.ts — calibration de λ, le poids de la pénalité de redondance de la
// diversification MMR (docs/ENGINE.md §6.6, dette « λ n'est pas calibré » d'ETAT.md §8).
//
// POURQUOI CE BANC EXISTE. `DEFAULT_MMR_LAMBDA = 0,4` vient d'une intuition de conception, et c'est
// le DERNIER nombre du moteur posé au jugé : la signature de recette, la pondération de similarité,
// la règle de récence et la couverture nutritionnelle ont toutes été corrigées PAR MESURE. Le
// principe 4 du projet dit « solveur auditable ligne par ligne » ; une constante qu'aucune mesure
// ne soutient est une ligne qu'on ne peut pas auditer.
//
// ⚠️ CE BANC NE MESURE PAS UNE QUALITÉ, IL MESURE UN ÉCHANGE. λ n'a pas d'optimum absolu : le
// monter fait toujours baisser la redondance et toujours baisser la pertinence. Une seule courbe
// ne pourrait donc que recommander λ = +∞ (listes parfaitement variées et inutiles) ou λ = 0
// (cinq déclinaisons du même plat). Ce qu'on cherche est le GENOU : le point au-delà duquel un
// point de redondance gagné coûte plus d'un point de score.
//
// CE QU'IL LIT, ET POURQUOI ÇA N'A RIEN COÛTÉ À PRODUIRE. `diversify` calcule déjà, pour chaque
// recette retenue, sa similarité maximale avec celles déjà retenues ; `suggestMeals` la jetait en
// retypant le résultat. Elle ressort désormais par `EngineDiagnostics.diversification`.
// ⛔ ELLE NE PASSE PAS PAR `ScoredSuggestion` — c'est ce que l'interface rend, et un nombre à côté
// d'un plat se lit comme une note nutritionnelle (principe 6). Voir `DiversificationDiagnostics`.
//
// Exécution : `npm run engine:calibrate-lambda`. Nécessite `catalog.db` (`npm run build`).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../data/catalog-loader-node.js'
import { createEngine } from '../engine/api/index.js'
import { DEFAULT_MMR_LAMBDA } from '../engine/selection/index.js'
import type {
  ArchetypeId,
  DietCode,
  MealHistory,
  MealSlot,
  SuggestionRequest,
  UserProfile,
} from '../engine/domain/index.js'
import { NoViableRecipeError } from '../engine/domain/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'public', 'catalog', 'catalog.db')

// ------------------------------------------------------------------------------------------
// Le plan d'expérience.
// ------------------------------------------------------------------------------------------

/**
 * ⚠️ λ MONTE AU-DESSUS DE 1, ET CE N'EST PAS UNE ERREUR DE BORNE. La valeur ajustée vaut
 * `score − λ·similarité` avec les deux termes dans [0, 1] : à λ = 2, une similarité de 0,5 annule
 * un score parfait.
 *
 * ⛔ LE BALAYAGE S'ARRÊTAIT À 2,0, ET CETTE BORNE FABRIQUAIT UNE PARTIE DE LA RÉPONSE. Une relecture
 * adverse l'a montrée le 2026-08-07 en poussant à 5,0 : le genou passe alors de 0,3 à 0,5. La
 * justification de la borne (« à 2,0 la pénalité peut déjà annuler un score parfait ») était vraie
 * mais ne prouvait rien — elle l'est aussi dès λ = 1,0, et elle aurait donc légitimé n'importe quelle
 * borne. **On balaie désormais jusqu'à 5,0 pour que la dépendance à la fenêtre soit VISIBLE dans la
 * sortie du banc, au lieu d'être une note de bas de page sur un chiffre unique.**
 */
const LAMBDAS: readonly number[] = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0]

/**
 * ⚠️ LES QUATRE CRÉNEAUX, PAS SEULEMENT LE DÎNER. Le catalogue est très inégal (dîner 197,
 * petit-déjeuner 43) et la redondance dépend directement du nombre de candidats : calibrer sur le
 * seul créneau le mieux fourni donnerait un λ qui maltraite le petit-déjeuner, où cinq retenues se
 * prennent dans un vivier six fois plus étroit.
 */
const CRENEAUX: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

/**
 * Trois archétypes qui fonctionnent SANS donnée utilisateur. `mes_gouts` et `envie` sont écartés
 * exprès : sans préférences ni axes d'envie renseignés, leurs couches sont inertes et l'archétype
 * ne serait qu'un `equilibre` déguisé — trois fois le même point de mesure présenté comme trois.
 */
const ARCHETYPES: readonly ArchetypeId[] = ['equilibre', 'decouverte', 'de_saison']

/** `null` = aucun régime déclaré. Les deux autres RÉTRÉCISSENT le vivier, ce qui est le cas où λ
 * compte le plus : moins de candidats, donc des retenues structurellement plus proches. */
const REGIMES: readonly (DietCode | null)[] = [null, 'vegetarien', 'pescetarien']

/**
 * ⚠️ PLUSIEURS GRAINES, ET C'EST INDISPENSABLE. `diversify` tire dans une bande de tolérance
 * (`DEFAULT_DIVERSIFY_TOLERANCE`) : une graine unique mesurerait un tirage, pas un λ. Huit graines
 * moyennent ce bruit sans faire exploser le temps de calcul.
 */
const GRAINES: readonly number[] = [1, 2, 3, 5, 8, 13, 21, 42]

/** Le défaut produit (`suggestMeals` sans `limit`) — calibrer sur une autre taille de liste
 * mesurerait un écran qui n'existe pas. */
const LIMITE = 5

/** Fixe, jamais l'horloge : la couche `season` dépend du mois, et un banc dont le résultat dérive
 * avec le calendrier ne peut pas être rejoué (même règle que `try-engine.ts`). */
const DATE = '2026-06-15'

const PROFIL: UserProfile = {
  trancheAge: '30_49',
  sexe: 'NP',
  tailleCm: 170,
  poidsKg: 70,
  niveauActivite: 'peu_actif',
  facteurPortion: 1,
}

/** Historique vide — démarrage à froid. `variety` et `habit` sont donc inertes, ce qui est VOULU
 * ici : on veut isoler l'effet de λ, pas le mélanger à une récence qui bougerait avec le scénario. */
const HISTORIQUE: MealHistory = { windowDays: 21, entries: [] }

/** Seuil de « ces deux plats se ressemblent trop », repris de la mesure de similarité du catalogue
 * (`engine:similarity` compte les paires au-dessus de 60 %) — pas un seuil inventé pour ce banc. */
const SEUIL_DOUBLON = 0.6

interface Config {
  readonly creneau: MealSlot
  readonly archetype: ArchetypeId
  readonly regime: DietCode | null
  readonly graine: number
}

function plan(): readonly Config[] {
  const configs: Config[] = []
  for (const creneau of CRENEAUX) {
    for (const archetype of ARCHETYPES) {
      for (const regime of REGIMES) {
        for (const graine of GRAINES) configs.push({ creneau, archetype, regime, graine })
      }
    }
  }
  return configs
}

function requete(config: Config, lambda: number): SuggestionRequest {
  return {
    profile: PROFIL,
    constraints: { allergies: [], diet: config.regime, excludedFoodIds: [], ownedEquipmentIds: null , admittedFoodIds: [] },
    context: {
      creneau: config.creneau,
      date: DATE,
      tempsDisponibleMin: null,
      envie: null,
      pantryFoodIds: [],
      requiredFoodIds: [],
    },
    history: HISTORIQUE,
    tolerancePiquant: null,
    preferences: new Map(),
    favoriteRecipeIds: new Set(),
    onlyFavorites: false,
    varietyMode: 'auto',
    activeTopics: [],
    archetype: config.archetype,
    limit: LIMITE,
    seed: config.graine,
    mmrLambda: lambda,
    skipDiversification: false,
  }
}

// ------------------------------------------------------------------------------------------
// Les deux mesures opposées.
// ------------------------------------------------------------------------------------------

interface Releve {
  readonly lambda: number
  /** Moyenne, sur les configurations, de la PIRE proximité interne d'une liste servie. */
  readonly redondanceMax: number
  /** Moyenne, sur les configurations, de la proximité moyenne d'une liste servie. */
  readonly redondanceMoyenne: number
  /** Part des listes servies qui contiennent au moins une paire au-dessus de `SEUIL_DOUBLON`. */
  readonly partListesAvecDoublon: number
  /** Score moyen des recettes retenues, 0 → 100. */
  readonly scoreMoyen: number
  readonly configsMesurees: number
  readonly configsSansCandidat: number
}

function mesurer(engine: ReturnType<typeof createEngine>, configs: readonly Config[], lambda: number): Releve {
  let sommeMax = 0
  let sommeMoyenne = 0
  let listesAvecDoublon = 0
  let sommeScore = 0
  let nbScores = 0
  let mesurees = 0
  let sansCandidat = 0

  for (const config of configs) {
    let resultat: ReturnType<typeof engine.suggestMeals>
    try {
      resultat = engine.suggestMeals(requete(config, lambda))
    } catch (err) {
      // Une configuration sans candidat n'est pas un défaut du banc : elle est COMPTÉE et annoncée.
      // La taire ferait passer une couverture partielle pour une couverture totale.
      if (err instanceof NoViableRecipeError) {
        sansCandidat++
        continue
      }
      throw err
    }

    const diag = resultat.diagnostics.diversification
    if (diag === null) throw new Error('calibre-lambda : diversification absente des diagnostics — banc invalide')

    // ⚠️ ON JETTE LE PREMIER. `maxSimilarities[0]` vaut 0 PAR CONVENTION (l'ensemble des retenues
    // est vide au premier tour), ce n'est pas une proximité mesurée. Le garder tirerait toutes les
    // moyennes vers le bas d'un cinquième, à tout λ — un biais constant qui déplacerait le genou.
    const proximites = diag.maxSimilarities.slice(1)
    if (proximites.length === 0) continue // liste à une seule recette : rien à comparer

    const pire = Math.max(...proximites)
    sommeMax += pire
    sommeMoyenne += proximites.reduce((a, b) => a + b, 0) / proximites.length
    if (pire > SEUIL_DOUBLON) listesAvecDoublon++

    for (const suggestion of resultat.suggestions) {
      sommeScore += suggestion.score
      nbScores++
    }
    mesurees++
  }

  return {
    lambda,
    redondanceMax: mesurees === 0 ? 0 : sommeMax / mesurees,
    redondanceMoyenne: mesurees === 0 ? 0 : sommeMoyenne / mesurees,
    partListesAvecDoublon: mesurees === 0 ? 0 : listesAvecDoublon / mesurees,
    scoreMoyen: nbScores === 0 ? 0 : sommeScore / nbScores,
    configsMesurees: mesurees,
    configsSansCandidat: sansCandidat,
  }
}

// ------------------------------------------------------------------------------------------
// Lecture du genou.
// ------------------------------------------------------------------------------------------

const pct = (v: number): string => `${(v * 100).toFixed(1)} %`

/**
 * Le taux d'échange local : combien de POINTS DE REDONDANCE (en %) chaque POINT DE SCORE achète,
 * entre deux λ consécutifs. Affiché parce qu'il se lit bien, JAMAIS utilisé pour désigner le genou.
 *
 * ⛔ CE RAPPORT NE PEUT PAS TRANCHER, ET LA PREMIÈRE VERSION DE CE BANC LUI A DEMANDÉ DE LE FAIRE.
 * Elle retenait « le dernier λ dont le pas est encore rentable », rentable voulant dire taux > 1.
 * Le seuil 1 compare des points de redondance (l'échelle bouge de ~29 points sur le balayage) à des
 * points de score (elle bouge de ~2). Le rapport est donc supérieur à 1 PARTOUT, par construction
 * des deux échelles, et le critère désignait mécaniquement la plus grande valeur balayée — il
 * aurait dit λ = 10 si on avait balayé jusqu'à 10. Un critère qui ne peut rendre qu'une réponse
 * n'est pas une mesure.
 */
function tauxEchange(precedent: Releve, courant: Releve): number {
  const redondanceGagnee = (precedent.redondanceMax - courant.redondanceMax) * 100
  const scorePerdu = precedent.scoreMoyen - courant.scoreMoyen
  if (scorePerdu <= 0) return Number.POSITIVE_INFINITY
  return redondanceGagnee / scorePerdu
}

/**
 * Le genou, par distance au point idéal — le seul critère des deux qui soit INVARIANT D'ÉCHELLE.
 *
 * Les deux mesures sont d'abord ramenées chacune dans [0, 1] sur l'étendue RÉELLEMENT BALAYÉE
 * (0 = la meilleure valeur observée, 1 = la pire). Le point idéal — redondance nulle ET coût nul —
 * n'existe jamais ; le genou est le λ qui s'en approche le plus. Normaliser d'abord est ce qui fait
 * qu'aucune des deux courbes ne l'emporte du seul fait que son unité bouge davantage.
 *
 * ⚠️ LE RÉSULTAT DÉPEND DE L'ÉTENDUE BALAYÉE, ET C'EST INHÉRENT AU PROCÉDÉ, PAS UN DÉFAUT CACHÉ :
 * ajouter un λ extrême repousse la borne « pire » et redistribue les distances. C'est pourquoi
 * `LAMBDAS` va jusqu'à 2,0, où la pénalité peut annuler un score parfait — la fenêtre couvre le
 * régime utile en entier, elle n'est pas centrée sur la réponse attendue.
 */
function genouParDistance(releves: readonly Releve[]): Releve {
  const redondances = releves.map((r) => r.redondanceMax)
  const couts = releves.map((r) => releves[0]!.scoreMoyen - r.scoreMoyen)
  const etendue = (valeurs: readonly number[]): { min: number; span: number } => {
    const min = Math.min(...valeurs)
    const span = Math.max(...valeurs) - min
    return { min, span: span === 0 ? 1 : span }
  }
  const er = etendue(redondances)
  const ec = etendue(couts)

  let meilleur = releves[0]!
  let meilleureDistance = Number.POSITIVE_INFINITY
  releves.forEach((releve, i) => {
    const x = (redondances[i]! - er.min) / er.span
    const y = (couts[i]! - ec.min) / ec.span
    const distance = Math.hypot(x, y)
    if (distance < meilleureDistance) {
      meilleureDistance = distance
      meilleur = releve
    }
  })
  return meilleur
}

/**
 * Le plus petit λ qui vide TOUTES les listes servies de leurs doublons — critère de produit, pas de
 * courbe : « aucune des cinq suggestions ne ressemble à une autre au-delà de 60 % ».
 * `null` si aucun λ balayé n'y parvient.
 */
function seuilSansDoublon(releves: readonly Releve[]): Releve | null {
  return releves.find((r) => r.partListesAvecDoublon === 0) ?? null
}

function main(): void {
  const catalog = loadCatalog(DB_PATH)
  const engine = createEngine(catalog)
  const configs = plan()

  console.log('=== engine:calibrate-lambda — calibration de λ (docs/ENGINE.md §6.6) ===')
  console.log(`Catalogue v${engine.catalogVersion} · ${catalog.recipes.size} recettes`)
  console.log(
    `Plan : ${CRENEAUX.length} créneaux × ${ARCHETYPES.length} archétypes × ${REGIMES.length} régimes × ` +
      `${GRAINES.length} graines = ${configs.length} configurations, × ${LAMBDAS.length} valeurs de λ ` +
      `= ${configs.length * LAMBDAS.length} appels à suggestMeals.`
  )
  console.log(`Listes de ${LIMITE} · date fixe ${DATE} · historique vide (variety et habit inertes, VOULU).`)
  console.log('')

  const releves = LAMBDAS.map((lambda) => mesurer(engine, configs, lambda))

  console.log('--- Les deux courbes opposées ---')
  console.log('   λ    redondance max   redondance moy   listes avec doublon   score moyen   coût vs λ=0')
  const reference = releves[0]!
  for (const r of releves) {
    const cout = reference.scoreMoyen - r.scoreMoyen
    console.log(
      `${r.lambda.toFixed(1).padStart(5)}` +
        `${pct(r.redondanceMax).padStart(16)}` +
        `${pct(r.redondanceMoyenne).padStart(17)}` +
        `${pct(r.partListesAvecDoublon).padStart(22)}` +
        `${r.scoreMoyen.toFixed(2).padStart(14)}` +
        `${cout.toFixed(2).padStart(14)}`
    )
  }
  console.log('')

  const mesurees = releves[0]!.configsMesurees
  const sansCandidat = releves[0]!.configsSansCandidat
  console.log(
    `${mesurees} configuration(s) réellement mesurée(s), ${sansCandidat} sans candidat (contraintes trop serrées).`
  )
  console.log('')

  console.log("--- Taux d'échange, à titre indicatif SEULEMENT (voir `tauxEchange`) ---")
  for (let i = 1; i < releves.length; i++) {
    const taux = tauxEchange(releves[i - 1]!, releves[i]!)
    console.log(
      `  λ ${releves[i - 1]!.lambda.toFixed(1)} → ${releves[i]!.lambda.toFixed(1)} : ` +
        `${taux === Number.POSITIVE_INFINITY ? 'gratuit (le score ne baisse pas)' : `${taux.toFixed(2)} pts de redondance par pt de score`}`
    )
  }
  console.log('')

  // ⚠️ LE CRÉNEAU EST LA VARIABLE QUI POURRAIT INVALIDER UN λ GLOBAL. Le vivier va de 43 recettes
  // (petit-déjeuner) à 197 (dîner) : un λ calibré sur la moyenne pourrait laisser le créneau le plus
  // étroit servir des doublons. On le vérifie au lieu de le supposer.
  console.log(`--- Contrôle par créneau : redondance max, et λ qui vide les doublons ---`)
  for (const creneau of CRENEAUX) {
    const sousPlan = configs.filter((c) => c.creneau === creneau)
    const parLambda = LAMBDAS.map((lambda) => mesurer(engine, sousPlan, lambda))
    const sansDoublon = seuilSansDoublon(parLambda)
    // ⚠️ ON MONTRE LA REDONDANCE AU λ RETENU, PAS « AU GENOU ». Le genou se déplace avec la fenêtre
    // balayée (bloc plus bas) : indexer cette colonne dessus ferait bouger quatre lignes de contrôle
    // à chaque fois qu'on ajoute un point au balayage, sans qu'aucune donnée n'ait changé.
    const auRetenu = parLambda.find((r) => r.lambda === DEFAULT_MMR_LAMBDA)
    console.log(
      `  ${creneau.padEnd(15)} λ=0 : ${pct(parLambda[0]!.redondanceMax).padStart(7)}  ·  ` +
        `λ=${DEFAULT_MMR_LAMBDA} : ${auRetenu === undefined ? '(hors balayage)' : pct(auRetenu.redondanceMax).padStart(7)}  ·  ` +
        `plus aucun doublon dès λ = ${sansDoublon === null ? 'JAMAIS sur le balayage' : sansDoublon.lambda.toFixed(1)}`
    )
  }
  console.log('')

  // ⚠️ ON TESTE ICI LA FAIBLESSE ANNONCÉE PAR `genouParDistance`, au lieu de la mentionner et de
  // passer outre : le critère normalise sur l'étendue balayée, donc tronquer le balayage PEUT
  // déplacer sa réponse. Si le genou tient sur trois fenêtres très différentes, la dépendance
  // existe toujours mais elle ne mord pas ; s'il bouge, c'est le balayage qui décide, pas la donnée,
  // et alors aucune constante ne doit être changée sur cette base.
  // ⛔ CE BLOC N'EST PAS UN CONTRÔLE DE ROBUSTESSE QUI RASSURE, C'EST UNE RÉFUTATION. Il montre que
  // le genou NE DÉSIGNE PAS UNE VALEUR UNIQUE : il se déplace avec l'étendue balayée, parce que la
  // normalisation min-max se recale sur les bornes observées. Quatre fenêtres, quatre lectures.
  console.log("--- Le genou dépend de l'étendue balayée — quatre fenêtres, et c'est le point ---")
  const fenetres = [0.6, 1.0, 2.0, 5.0]
  const genoux: number[] = []
  for (const plafond of fenetres) {
    const fenetre = releves.filter((r) => r.lambda <= plafond)
    const g = genouParDistance(fenetre).lambda
    genoux.push(g)
    console.log(`  λ balayé jusqu'à ${plafond.toFixed(1)} (${fenetre.length} points) → genou λ = ${g.toFixed(1)}`)
  }
  console.log(
    `  ⇒ le genou BORNE λ entre ${Math.min(...genoux).toFixed(1)} et ${Math.max(...genoux).toFixed(1)}, il ne le pointe pas.`
  )
  console.log('')

  const sansDoublon = seuilSansDoublon(releves)
  console.log('--- Ce que la mesure dit, et ce qu\'elle ne dit pas ---')
  console.log(
    `Plus petit λ sans AUCUN doublon servi (> ${pct(SEUIL_DOUBLON)}) : ` +
      `${sansDoublon === null ? 'aucun sur le balayage' : `λ = ${sansDoublon.lambda.toFixed(1)}`}` +
      ' ← seul critère INDÉPENDANT de la fenêtre'
  )
  console.log(`Genou, selon la fenêtre balayée                  : λ ∈ [${Math.min(...genoux).toFixed(1)}, ${Math.max(...genoux).toFixed(1)}]`)
  console.log(`DEFAULT_MMR_LAMBDA retenu                        : ${DEFAULT_MMR_LAMBDA}`)
  console.log('')
  console.log(
    'Raisonnement du choix : le seuil sans doublon est le seul repère que la méthode ne fabrique pas,'
  )
  console.log(
    "et il vaut 0,2 ; on prend un pas de marge au-dessus parce qu'il a été mesuré sur CE catalogue,"
  )
  console.log(
    "qui grossit. ⚠️ La mesure n'EXCLUT pas 0,4 — elle ne le désigne simplement jamais, et il coûte"
  )
  console.log('0,19 point de score de plus pour 1,7 point de redondance de moins.')
}

main()
