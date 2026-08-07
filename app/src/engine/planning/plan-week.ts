// engine/planning/plan-week.ts — planification glouton (docs/ENGINE.md §7.1).
//
// Jour par jour, créneau par créneau : on demande une suggestion, on retient la première, on passe
// au créneau suivant. Pas d'optimisation globale — §7.1 : optimiser 21 créneaux sous contraintes
// multiples est NP-difficile, mais surtout INCOMPRÉHENSIBLE pour l'utilisateur. Modifier une
// préférence rebattrait toutes les cartes, y compris les repas qu'il aimait. Le glouton produit un
// résultat stable où chaque changement est local et explicable.
//
// ⚠️ CE QUI FAIT UNE SEMAINE ET NON N SUGGESTIONS INDÉPENDANTES : l'HISTORIQUE DE TRAVAIL. Après
// chaque choix, la recette retenue est ajoutée à l'historique passé au créneau suivant, avec
// `origine: 'choisi'` et la date du créneau. Les couches `variety` et `habit` la voient donc comme
// un repas réellement pris — c'est ce qui empêche le lundi et le mardi d'être le même plat.
//
// Sans ce mécanisme, `planWeek` ne serait qu'une boucle appelant `suggestMeals` : chaque créneau
// verrait le même historique initial, donc les mêmes scores, donc la même tête de classement. Le
// planning rendrait sept fois le même dîner sans que rien ne signale l'anomalie.
//
// Deux protections se cumulent, et ce n'est pas une redondance :
//   - l'historique de travail fait BAISSER le score d'un plat récent (signal continu, il décroît
//     avec les jours — c'est `variety`, §6.5 précision 5) ;
//   - `placedRecipeIds` INTERDIT le doublon exact dans la même fenêtre (garantie dure).
// Le premier seul laisserait passer un doublon quand tous les autres candidats sont mauvais ; le
// second seul ne dirait rien de la lassitude à J+3. Retirer l'un des deux dégrade le résultat.
//
// ⚠️ LA CIBLE NUTRITIONNELLE RESTANTE (2026-07-28) — le « cumul réinjecté » de §7.1. À chaque
// créneau, la cible n'est plus la part théorique du créneau mais CE QUI RESTE de la journée, réparti
// sur les créneaux qui restent : `(référence journalière − déjà placé aujourd'hui) / créneaux
// restants`. Un déjeuner léger relève donc mécaniquement la cible du dîner.
//
// ⚠️ CE QUE ÇA NE FAIT PAS, et il faut le savoir avant d'en attendre trop. `nutri` reste UNE couche
// de score parmi d'autres, et son écart est moyenné sur les 9 nutriments : MESURÉ, l'énergie pèse
// environ `0,25 / 9 ≈ 2,8 %` de la note finale. Réinjecter le cumul déplace le classement à la
// marge — ça ne rend pas l'énergie contraignante. Le seul mécanisme qui REFUSE une journée
// insuffisante reste `assertCalorieFloor`. Ne pas confondre les deux.
//
// ⚠️ LE MODE REPAS EST PARTIELLEMENT OUVERT depuis le 2026-08-04, et il faut savoir jusqu'où.
// `planWeek` produit DEUX entrées sur un même créneau quand il pose un plat en déjeuner ou en dîner :
// l'une `service: 'plat'`, l'autre `service: 'accompagnement'` (voir `pickAccompagnement`). Tout
// lecteur de `WeekPlan.entries` doit donc cesser de supposer une entrée par créneau — `find` sur
// (date, créneau) rend le plat, jamais l'assiette entière.
//   - `entree`, `fromage` et `dessert` ne sont TOUJOURS PAS produits, ni le petit-déjeuner ni le
//     goûter, qui restent en mode recette (une entrée, `service: null`).
//   - un plat posé SEUL garde `service: null`, pas `'plat'` : le champ dit le MODE, pas la recette.
//
// ⚠️ CE QUI N'EST TOUJOURS PAS FAIT :
//   - les RESTES (`planLeftovers`, §7.3) — `isLeftover` reste `false` partout.
//
// ⚠️ LA SUGGESTION EST INJECTÉE, pas reconstruite. `planWeek` reçoit `suggest` en paramètre plutôt
// que de recomposer `runExclusionPass` + `runScoringPass` + `diversify` lui-même. Deux raisons :
//   - la couche L4 ne peut pas importer `api/` (L5), où vit l'assemblage de `suggestMeals` (§2) ;
//   - surtout, dupliquer le pipeline le ferait DÉRIVER. `suggestMeals` exécute au passage
//     `assertNoDeclaredAllergen` et `assertCriticalLayersRan` (§8) ; une copie qui les oublierait
//     produirait un planning moins sûr que la suggestion unitaire, sans que rien ne le signale.
// C'est exactement le `P->>S: suggest(...)` du diagramme de séquence de §7.1.
//
// Dépendances autorisées : domain/, ../selection/prng.js (§2 ENGINE : PLAN --> SEL est permis,
// voir planning/index.ts ; seul `derive`, une fonction pure sans lien avec les couches de
// sélection, est importé ici — aucun risque de faire dériver le pipeline, voir plus haut le
// pourquoi de `suggest` injecté).

import type {
  Catalog,
  MealHistory,
  MealHistoryEntry,
  MealPlanEntry,
  MealSlot,
  RecipeId,
  SuggestionRequest,
  WeekPlan,
  WeekPlanRequest,
} from '../domain/index.js'
import { COURSE_ORDER, NoViableRecipeError } from '../domain/index.js'
import type { NutrientVector, SuggestionResult } from '../domain/index.js'
import { resolveReferenceIntakes } from '../nutrition/index.js'
import { signatureOverlap } from '../nutrition/signature.js'
import { derive } from '../selection/prng.js'

/** Ce que `planWeek` demande au moteur de sélection — voir l'en-tête sur l'injection. */
export type SuggestForSlot = (req: SuggestionRequest) => SuggestionResult

/** Bornes de la fenêtre glissante (§7.1) — 2 jours couvre le week-end, 14 la planification anticipée. */
export const MIN_PLAN_DAYS = 2
export const MAX_PLAN_DAYS = 14

const MS_PER_DAY = 86_400_000

/** ISO yyyy-mm-dd + n jours. Jamais `Date.now()` : la date de départ vient de la requête (§3 ENGINE). */
export function addDays(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T00:00:00Z`)
  return new Date(base + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * Construit la requête d'un créneau. `history` n'est PAS `req.history` mais l'historique DE TRAVAIL,
 * enrichi des plats déjà placés (voir en-tête). `excludedFoodIds` reste celui de l'utilisateur : on
 * n'exclut pas des ALIMENTS pour éviter un doublon, on exclut la RECETTE (voir `placedRecipeIds`).
 */
function slotRequest(
  req: WeekPlanRequest,
  date: string,
  creneau: MealSlot,
  history: MealHistory,
  nutrientTarget: NutrientVector | undefined,
  nombreDeCreneaux: number
): SuggestionRequest {
  return {
    // ⚠️ OMISE, PAS POSÉE À `undefined` — `exactOptionalPropertyTypes` est actif, et surtout c'est
    // l'ABSENCE de la clé que `scoreNutri` interprète comme « pas de cible imposée, prends la part
    // fixe du créneau » (nutri.ts : `req.nutrientTarget ?? defaultSlotTarget(...)`). Une clé
    // présente valant `undefined` dirait la même chose à l'exécution, mais par accident.
    ...(nutrientTarget === undefined ? {} : { nutrientTarget }),
    // Transmise TELLE QUELLE : sans cette ligne, la tolérance jouerait sur Aujourd'hui et pas sur
    // la semaine — un écart que l'utilisateur lirait comme un caprice de l'application.
    tolerancePiquant: req.tolerancePiquant,
    profile: req.profile,
    constraints: req.constraints,
    context: {
      date,
      creneau,
      envie: null,
      tempsDisponibleMin: null,
      requiredFoodIds: [],
      pantryFoodIds: [],
    },
    history,
    preferences: new Map(),
    favoriteRecipeIds: new Set(),
    // ⚠️ DEUX RÉGLAGES INDISPENSABLES, et leur absence était un BUG (trouvé au banc de stress
    // 2026-07-28) : `suggestMeals` rend 5 suggestions par défaut, diversifiées. Le glouton écarte
    // celles déjà placées ; quand les 5 l'étaient toutes, le créneau restait VIDE alors que des
    // dizaines de candidats attendaient. Mesuré : 11 petits-déjeuners placés sur 14 demandés, avec
    // 17 recettes disponibles.
    //
    // `limit` couvre le pire cas — tout ce qui peut déjà avoir été placé, plus un. Garantit qu'un
    // candidat libre apparaît s'il en existe un.
    limit: nombreDeCreneaux + 1,
    // La diversification MMR est INUTILE ici et nuisible : elle réordonne un ensemble dont on ne
    // prend qu'un élément, et la variété du plan est déjà assurée autrement — l'historique de
    // travail fait baisser le score des plats récents, `placedRecipeIds` interdit le doublon.
    skipDiversification: true,
    activeTopics: req.activeTopics,
    ...(req.weights === undefined ? {} : { weights: req.weights }),
    // Un flux DÉRIVÉ par créneau, pas `req.seed` recopié tel quel — sinon les 14 créneaux
    // partageraient le même premier tirage de `rankScoredCandidates` (scoring-pass.ts) et la bande
    // de tolérance ferait le même choix relatif partout. Dérivé depuis `slotKey`, PAS un compteur
    // de boucle : la clé est stable quel que soit l'ordre d'itération des créneaux/jours, un
    // compteur ne l'est pas.
    seed: derive(req.seed, slotKey(date, creneau)),
  }
}

/** Clé de créneau — `MealPlanEntry.slot` est un objet, inutilisable tel quel dans une Map. */
function slotKey(date: string, creneau: MealSlot): string {
  return `${date}|${creneau}`
}

/** Cumule l'apport d'une recette dans le total du jour. Sans effet si la recette n'est pas indexée. */
function addNutrients(placedToday: Float64Array, apport: NutrientVector | undefined): void {
  if (apport === undefined) return
  for (let i = 0; i < placedToday.length; i++) placedToday[i] = (placedToday[i] ?? 0) + (apport[i] ?? 0)
}

/**
 * Verrous ramenés à leur créneau, LIMITÉS À LA FENÊTRE du plan.
 *
 * Un verrou hors fenêtre est ignoré : il n'appartient pas à ce plan, et le compter dans
 * `placedRecipeIds` interdirait sa recette pour rien.
 *
 * ⚠️ UNE LISTE PAR CRÉNEAU, PAS UNE ENTRÉE — corrigé le 2026-08-04. La règle était « deux verrous
 * sur le même créneau : le premier gagne », écrite quand un créneau ne portait qu'un plat. Depuis le
 * mode repas, garder un déjeuner verrouille DEUX entrées (le plat et son accompagnement) : n'en
 * reposer qu'une faisait DISPARAÎTRE l'accompagnement à chaque « Proposer une autre semaine ». Le
 * repas gardé changeait donc quand même — exactement ce que §7.2 promet d'empêcher — et la journée
 * perdait ~250 kcal en silence.
 *
 * Le départage subsiste, mais PAR SERVICE : deux verrous de même service sur le même créneau, le
 * premier gagne. La liste est rendue dans l'ordre de service français (`COURSE_ORDER`), `null` en
 * tête — le même ordre que le `ORDER BY` de `readPlan`, pour qu'un plan relu et un plan calculé se
 * présentent pareil.
 */
function indexLockedEntries(req: WeekPlanRequest): ReadonlyMap<string, readonly MealPlanEntry[]> {
  const lockedBySlot = new Map<string, MealPlanEntry[]>()
  if (req.lockedEntries === undefined || req.lockedEntries.length === 0) return lockedBySlot

  const fenetre = new Set<string>()
  for (let dayOffset = 0; dayOffset < req.days; dayOffset++) {
    const date = addDays(req.startDate, dayOffset)
    for (const creneau of req.slots) fenetre.add(slotKey(date, creneau))
  }

  for (const entry of req.lockedEntries) {
    const cle = slotKey(entry.slot.date, entry.slot.creneau)
    if (!fenetre.has(cle)) continue
    const deja = lockedBySlot.get(cle) ?? []
    if (deja.some((e) => e.service === entry.service)) continue
    deja.push(entry)
    lockedBySlot.set(cle, deja)
  }

  const rang = (entry: MealPlanEntry): number =>
    entry.service === null ? -1 : COURSE_ORDER.indexOf(entry.service)
  for (const liste of lockedBySlot.values()) liste.sort((a, b) => rang(a) - rang(b))
  return lockedBySlot
}

export function planWeek(catalog: Catalog, req: WeekPlanRequest, suggest: SuggestForSlot): WeekPlan {
  if (req.days < MIN_PLAN_DAYS || req.days > MAX_PLAN_DAYS) {
    throw new RangeError(
      `planWeek : fenêtre de ${req.days} jour(s) hors bornes — §7.1 impose ${MIN_PLAN_DAYS} à ${MAX_PLAN_DAYS}.`
    )
  }
  if (req.slots.length === 0) {
    throw new RangeError('planWeek : aucun créneau demandé — `slots` ne peut pas être vide.')
  }

  const dailyReference = resolveReferenceIntakes(req.profile, catalog)
  const entries: MealPlanEntry[] = []
  const placedRecipeIds = new Set<RecipeId>()
  // Copie de travail : on n'ajoute JAMAIS à `req.history`, qui appartient à l'appelant.
  const workingEntries: MealHistoryEntry[] = [...req.history.entries]

  // ⚠️ AMORÇAGE DES VERROUS AVANT LE GLOUTON, et c'est tout l'intérêt du champ. Les recettes
  // verrouillées entrent dans `placedRecipeIds` DÈS MAINTENANT : sinon le glouton pourrait placer
  // lundi le plat verrouillé pour mercredi, et le plan contiendrait deux fois le même dîner.
  // C'est exactement ce qu'un réassemblage côté appelant ne peut pas garantir.
  //
  // ⚠️ SAUF LES ACCOMPAGNEMENTS, exemptés de `placedRecipeIds` partout ailleurs pour que le riz
  // puisse revenir. Les y mettre ici les interdirait pour toute la semaine au seul motif qu'un
  // créneau a été gardé.
  const lockedBySlot = indexLockedEntries(req)
  for (const verrous of lockedBySlot.values()) {
    for (const verrou of verrous) {
      if (verrou.recipeId !== null && verrou.service !== 'accompagnement') placedRecipeIds.add(verrou.recipeId)
    }
  }

  for (let dayOffset = 0; dayOffset < req.days; dayOffset++) {
    const date = addDays(req.startDate, dayOffset)

    // Cumul du JOUR : remis à zéro à chaque date, jamais cumulé sur la semaine — la référence est
    // journalière (§7.1 : « la cible est calculée sur la durée réelle de la fenêtre » pour la
    // fenêtre, mais l'apport se juge jour par jour, comme `assertCalorieFloor`).
    const placedToday = new Float64Array(dailyReference.length)

    // ⚠️ UNE JOURNÉE QUI PORTE UN PLAT PRÉPARÉ CESSE DE RÉINJECTER SON CUMUL (décision 51, issue
    // « (a) », 2026-08-05). Le cumul réinjecté suppose que `placedToday` dit ce qui a déjà été
    // couvert aujourd'hui. Un créneau hors catalogue n'a pas d'apport connu : il compterait ZÉRO
    // (`addNutrients` ne fait rien sur une recette inconnue), et `remainingTarget` demanderait alors
    // aux créneaux restants de couvrir la journée ENTIÈRE — le planificateur surcompenserait pour un
    // repas qui existe et qu'il ne voit pas. En omettant la cible, chaque créneau retombe sur la part
    // fixe du créneau (`defaultSlotTarget`), le comportement d'avant le cumul réinjecté. On renonce à
    // piloter un total qu'on ne sait pas calculer, plutôt que de le piloter faux.
    //
    // ⚠️ CALCULÉ AVANT LA BOUCLE, pas au fil des créneaux. Un plat préparé au DÎNER doit désarmer le
    // cumul dès le DÉJEUNER : à le découvrir en chemin, le déjeuner aurait déjà été classé contre une
    // journée entière, et l'erreur serait seulement plus discrète.
    const journeeImmesurable = req.slots.some((creneau) =>
      (lockedBySlot.get(slotKey(date, creneau)) ?? []).some((verrou) => verrou.horsCatalogue !== null)
    )

    for (const [slotIndex, creneau] of req.slots.entries()) {
      // Créneau gardé par l'utilisateur : on le repose tel quel, sans rien demander à `suggest`.
      // Son apport et son entrée d'historique sont comptés ICI, à SA date — les semer en amont
      // ferait voir au lundi un repas du mercredi (`variety` ignore le futur, `habit` non).
      const verrous = lockedBySlot.get(slotKey(date, creneau))
      if (verrous !== undefined && verrous.length > 0) {
        for (const verrou of verrous) {
          entries.push({ ...verrou, slot: { date, creneau }, locked: true })
          if (verrou.recipeId === null) continue
          workingEntries.push({ recipeId: verrou.recipeId, date, creneau, origine: 'choisi' })
          addNutrients(placedToday, catalog.indexes.recipeNutrients.get(verrou.recipeId))
        }
        continue
      }

      // ⚠️ COPIE, pas la référence. `workingEntries` continue de grossir après cet appel : passer
      // le tableau vif ferait voir à la requête du lundi les repas placés le mercredi. Défaut réel,
      // trouvé par test — la sortie du glouton était juste, mais l'objet remis à l'appelant mentait.
      const history: MealHistory = { windowDays: req.history.windowDays, entries: [...workingEntries] }
      const cible = journeeImmesurable
        ? undefined
        : remainingTarget(dailyReference, placedToday, req.slots.length - slotIndex)
      const scored = pickForSlot(
        suggest,
        slotRequest(req, date, creneau, history, cible, req.days * req.slots.length),
        placedRecipeIds,
        (recipeId) => peutRemplirSeul(catalog, creneau, recipeId)
      )

      if (scored === null) {
        entries.push({
          slot: { date, creneau },
          recipeId: null,
          horsCatalogue: null,
          portions: 0,
          locked: false,
          isLeftover: false,
          service: null,
        })
        continue
      }

      // Le plat entre dans les deux protections AVANT qu'on cherche son accompagnement : l'historique
      // de travail sert à ne pas lui adjoindre ce qu'on vient déjà de servir ailleurs.
      placedRecipeIds.add(scored)
      workingEntries.push({ recipeId: scored, date, creneau, origine: 'choisi' })
      addNutrients(placedToday, catalog.indexes.recipeNutrients.get(scored))

      // ⚠️ UNE SECONDE REQUÊTE DE CRÉNEAU, PAS `history`/`cible` RÉUTILISÉS. L'historique doit
      // maintenant contenir le plat qu'on vient de poser, et la cible doit être CE QUI RESTE une
      // fois son apport déduit — sinon l'accompagnement serait classé contre la journée entière.
      const complement = pickAccompagnement(
        catalog,
        suggest,
        slotRequest(
          req,
          date,
          creneau,
          { windowDays: req.history.windowDays, entries: [...workingEntries] },
          journeeImmesurable
            ? undefined
            : remainingTarget(dailyReference, placedToday, req.slots.length - slotIndex),
          req.days * req.slots.length
        ),
        scored
      )

      // ⚠️ `service` DIT LE MODE, il ne décrit pas la recette. `null` = mode recette, une entrée pour
      // ce créneau ; non-`null` = mode repas, plusieurs. Une recette de service `plat` posée SEULE
      // garde donc `service: null` — sinon un lecteur qui compte les entrées non nulles croirait
      // qu'il en manque une (§2.1 CONCEPTION_B_VIN_REPAS, et le commentaire de `MealPlanEntry`).
      entries.push({
        slot: { date, creneau },
        recipeId: scored,
        horsCatalogue: null,
        portions: catalog.recipes.get(scored)?.portionsBase ?? 0,
        locked: false,
        isLeftover: false,
        service: complement === null ? null : 'plat',
      })

      if (complement === null) continue

      entries.push({
        slot: { date, creneau },
        recipeId: complement,
        horsCatalogue: null,
        portions: catalog.recipes.get(complement)?.portionsBase ?? 0,
        locked: false,
        isLeftover: false,
        service: 'accompagnement',
      })
      // ⚠️ PAS DANS `placedRecipeIds`, ET C'EST LE CŒUR DE LA RÈGLE. On mange du riz plusieurs fois
      // par semaine : l'interdit dur du doublon exact, juste pour un plat, serait faux ici. Mais
      // l'entrée d'historique, elle, EST poussée — `variety` fait décroître le score d'un
      // accompagnement récent. Le riz peut revenir, il ne doit pas lasser. C'est exactement
      // l'asymétrie décrite en tête de fichier entre les deux protections, appliquée pour la
      // première fois séparément.
      //
      // ⚠️ MESURÉ le 2026-08-04 avant d'écrire ça : sans l'entrée d'historique, la semaine nominale
      // rendait `7× Ratatouille` et `7× Boulgour aux légumes grillés` sur 14 créneaux.
      workingEntries.push({ recipeId: complement, date, creneau, origine: 'choisi' })
      addNutrients(placedToday, catalog.indexes.recipeNutrients.get(complement))
    }
  }

  // `warnings` vide ici : le contrôle du plancher calorique (§6.5) appartient à guards/, que L4 ne
  // peut pas importer. C'est `createEngine` qui l'exécute et enrichit le plan — même motif que
  // l'injection de `suggest`.
  return {
    id: `plan-${req.startDate}-${req.days}`,
    startDate: req.startDate,
    days: req.days,
    seed: req.seed,
    entries,
    warnings: [],
  }
}

/**
 * Le meilleur candidat non encore placé, ou `null` si le créneau ne peut pas être rempli.
 *
 * ⚠️ UN CRÉNEAU VIDE N'EST PAS UNE ERREUR. `MealPlanEntry.recipeId` est explicitement nullable
 * (§7.2 : l'état `Vide` existe), et un catalogue qui n'a que 7 petits-déjeuners ne peut pas en
 * fournir 14 sans répétition. Faire échouer tout le plan pour un créneau impossible serait pire
 * que de le laisser vide : l'utilisateur perdrait les treize autres.
 *
 * `NoViableRecipeError` (aucun candidat après exclusion) est donc RATTRAPÉE ici, et seulement ici.
 * Ne pas la laisser remonter : elle est normale en planification, anormale en suggestion unitaire.
 */
function pickForSlot(
  suggest: SuggestForSlot,
  req: SuggestionRequest,
  placedRecipeIds: ReadonlySet<RecipeId>,
  peutRemplirSeul: (recipeId: RecipeId) => boolean
): RecipeId | null {
  let result: SuggestionResult
  try {
    result = suggest(req)
  } catch (error) {
    if (error instanceof NoViableRecipeError) return null
    throw error
  }

  // DEUX PASSES, et l'ordre est tout l'intérêt. La première ne retient qu'un plat ; la seconde
  // reprend les mêmes candidats sans cette exigence.
  //
  // ⚠️ PRÉFÉRENCE, PAS EXIGENCE — et ce n'est pas un adoucissement de confort, c'est une régression
  // MESURÉE le 2026-08-03. La règle en version dure a fait retomber le végétalien 14 j de 42/42
  // créneaux remplis à 32/42, et le « végétalien + sans gluten » de 16 trous à 33 : beaucoup des
  // 30 recettes végétaliennes de la décision 37 sont des accompagnements ou des entrées. Défaire
  // cet acquis pour éviter une assiette d'artichauts au dîner serait un très mauvais échange —
  // un créneau VIDE ne nourrit personne.
  //
  // ⚠️ LE BANC N'A RIEN DIT. `plan-stress` affichait 20/20 « configurations saines » avec dix
  // créneaux vides de plus : il ne compte comme échec qu'un plantage, un doublon ou un
  // non-déterminisme. Un compte de créneaux remplis qui baisse sans rouge est un signal, comme le
  // compte de tests qui baisse sans rouge de `vitest.config.ts`.
  for (const suggestion of result.suggestions) {
    if (placedRecipeIds.has(suggestion.recipeId)) continue
    if (!peutRemplirSeul(suggestion.recipeId)) continue
    return suggestion.recipeId
  }
  for (const suggestion of result.suggestions) {
    if (!placedRecipeIds.has(suggestion.recipeId)) return suggestion.recipeId
  }
  return null
}

/** Créneaux où le placement automatique doit poser un vrai plat — voir `peutRemplirSeul`. */
const CRENEAUX_REPAS_PRINCIPAL: readonly MealSlot[] = ['dejeuner', 'diner']

/**
 * Cette recette peut-elle constituer À ELLE SEULE ce créneau, en placement AUTOMATIQUE ?
 *
 * ⚠️ LA RÈGLE NE VAUT QUE POUR LE PLACEMENT AUTOMATIQUE, et c'est une décision utilisateur du
 * 2026-08-03. Chercher, parcourir, choisir une entrée comme dîner reste entièrement permis : le
 * produit informe, il ne juge pas (principe 6). Ce qui est interdit ici, c'est que la MACHINE
 * décide qu'une assiette d'artichauts sera le dîner de samedi, sans que personne l'ait demandé.
 * D'où le filtre posé dans `planWeek` et NON dans `HardConstraints` — l'y mettre le rendrait
 * exprimable dans toute suggestion, y compris celles que l'utilisateur pilote. Même raisonnement
 * que `requiredFoodIds`, tenu hors de `HardConstraints` pour la raison inverse (acquis n°2).
 *
 * ⚠️ `service === null` EST ACCEPTÉ, ce n'est pas un oubli. `Recipe.service` vaut `null` pour les
 * recettes qui remplissent un créneau seules (`catalog.ts`) ; seules les valeurs EXPLICITES
 * `entree`, `accompagnement`, `fromage` et `dessert` désignent un rôle partiel. Refuser `null`
 * viderait le vivier de tout ce qui n'a pas été annoté.
 *
 * ⚠️ POURQUOI PAS UN SEUIL D'ÉNERGIE à la place. « Assez consistant pour faire un repas » se
 * mesurerait en kcal, et un nombre qui décide si un plat est un vrai repas EST un jugement
 * nutritionnel — précisément ce que le principe 6 interdit. Le service est un fait éditorial, pas
 * une note.
 *
 * MESURÉ le 2026-08-03 avant d'écrire cette règle : 61 recettes sur 189 éligibles à un repas
 * principal ne sont pas des plats (39 entrées, 20 accompagnements, 2 desserts), et leur médiane est
 * de ~250 kcal/portion contre 437 pour un plat.
 */
function peutRemplirSeul(catalog: Catalog, creneau: MealSlot, recipeId: RecipeId): boolean {
  if (!CRENEAUX_REPAS_PRINCIPAL.includes(creneau)) return true
  const service = catalog.recipes.get(recipeId)?.service ?? null
  return service === null || service === 'plat'
}

/**
 * Chevauchement de composition au-delà duquel un accompagnement est refusé : il répéterait le plat.
 *
 * ⚠️ MESURÉ SUR `recipeFamilySignature`, PAS SUR `recipeSignature`, et ce n'est pas une confusion
 * entre les deux espaces (acquis n°4). Les deux index gardent leur rôle — le brut sert la
 * SIMILARITÉ, le replié sert la RÉCENCE. Ce filtre est un TROISIÈME lecteur du replié, et il l'est
 * exprès : la question posée ici est « ce que j'ajoute est-il le MÊME PRODUIT DE BASE que ce qui est
 * dans l'assiette ? », qui est mot pour mot la définition de `sousFamille` (voir `Food.sousFamille`).
 * MESURÉ : « Dahl de lentilles corail » + « Lentilles vertes aux carottes » sort à 8 % en brut —
 * deux `foodId` distincts — et à 36 % une fois replié. Le brut ne peut PAS voir ce cas.
 *
 * MESURÉ le 2026-08-04 sur les 2 880 paires `plat × accompagnement` du catalogue réel. À 0,30 :
 * 40 paires refusées (1,4 %), et AUCUN plat ne se retrouve sans le moindre accompagnement possible
 * — le refus ne coûte donc rien, le suivant du classement prend la place. De part et d'autre :
 *
 *   99 %  Rösti de pommes de terre       + Pommes de terre sautées       refusé
 *   50 %  Lentilles à la poitrine de porc+ Lentilles vertes aux carottes refusé
 *   44 %  Boulgour aux pois chiches      + Boulgour aux légumes grillés  refusé
 *   40 %  Caldo verde                    + Purée de pommes de terre      refusé
 *   31 %  Tofu sauté au brocoli          + Brocoli sauté au sésame       refusé
 *   ------------------------------------------------------------------- 0,30
 *   29 %  Sardines et pommes de terre    + Gratin dauphinois             accepté ⚠️
 *   28 %  Cuisses de poulet rôties       + Gratin dauphinois             accepté
 *
 * ⚠️ CE SEUIL NE REMPLACE PAS L'INFORMATION QUI MANQUE, et la ligne à 29 % le dit : rien dans le
 * catalogue ne déclare qu'un plat SE SUFFIT. Les 144 plats portent `service: 'plat'` et rien
 * d'autre. La composition partagée est un substitut mesurable, pas la vérité éditoriale.
 *
 * ⚠️ NE PAS CORRIGER ÇA EN DESCENDANT LE SEUIL. À 0,28, « Sardines et pommes de terre » + « Gratin
 * dauphinois » tombe — mais « Cuisses de poulet rôties » + « Gratin dauphinois » aussi, et c'est un
 * classique parfaitement mangeable. Le signal ne SAIT PAS que les pommes de terre du plat de
 * sardines sont déjà le féculent : il voit deux plats qui partagent un ingrédient, exactement comme
 * le poulet et son gratin. Seul un champ éditorial sur les 144 plats tranche.
 *
 * ⚠️ NE PAS CHERCHER UNE MESURE « DIRIGÉE » NON PLUS — impasse déjà payée, voir l'en-tête de
 * `nutrition/signature.ts` : les signatures sont normalisées à 1, toute variante de ce genre est
 * une remise à l'échelle monotone du même Jaccard, donc le même classement.
 */
const SEUIL_REPETITION = 0.3

/**
 * L'accompagnement à poser EN PLUS du plat, ou `null` si ce créneau n'en prend pas.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE — décision du 2026-08-04, et c'est LE correctif du plancher
 * calorique de §6.5, contrairement au filtre `service` de la veille. `checkCalorieFloor` compare
 * une JOURNÉE à un plancher journalier, alors que le plan ne posait que des PLATS : trois plats
 * cuisinés ne font pas ce qu'une personne mange dans la journée. La comparaison n'a jamais été
 * homogène. MESURÉ sur 20 graines × 7 jours, cas nominal :
 *
 *   SANS accompagnement : min 813  · médiane 1023 · max 1205 — 38 jours sous 1 200 sur 140
 *   AVEC accompagnement : min 1345 · médiane 1545 · max 1869 —  0 jour  sous 1 200 sur 140
 *
 * 1 545 kcal pour trois repas cuisinés reste réaliste : ce n'est pas du gonflage destiné à passer
 * le contrôle, c'est l'assiette qui devient complète.
 *
 * ⚠️ SEULEMENT DERRIÈRE UN `service: 'plat'` EXPLICITE. Une recette à `service: null` remplit son
 * créneau seule (`peutRemplirSeul`) — lui adjoindre du riz serait une invention. Et une entrée ou
 * un accompagnement posé par la SECONDE passe de `pickForSlot` est déjà un pis-aller : l'empiler
 * avec un second pis-aller aggraverait le cas au lieu de le corriger.
 *
 * ⚠️ AUCUN FILTRE PAR `service` N'EST POSÉ DANS LA REQUÊTE, et ce n'est pas un oubli. Le tri se fait
 * ICI, sur la liste rendue. Poser le service dans `SuggestionRequest` le rendrait exprimable dans
 * toute suggestion, y compris celles que l'utilisateur pilote — exactement ce que la décision 53
 * refuse, et le même raisonnement que `requiredFoodIds` tenu hors de `HardConstraints` (acquis n°2).
 */
export function pickAccompagnement(
  catalog: Catalog,
  suggest: SuggestForSlot,
  base: SuggestionRequest,
  platId: RecipeId
): RecipeId | null {
  if (!CRENEAUX_REPAS_PRINCIPAL.includes(base.context.creneau)) return null
  if (catalog.recipes.get(platId)?.service !== 'plat') return null

  const requete: SuggestionRequest = {
    ...base,
    // TOUT le catalogue, pas la fenêtre du glouton. Les accompagnements sont minoritaires (20 sur
    // 241 éligibles à un repas principal) : ils peuvent parfaitement se trouver tous hors des 22
    // premiers rangs, et le créneau n'aurait alors aucun complément sans que rien ne le signale.
    limit: catalog.recipes.size,
    // Flux dérivé DISTINCT de celui du plat. La même graine corrélerait la tête des deux
    // classements — même piège que les 14 créneaux partageant `req.seed`, corrigé plus haut.
    // On dérive depuis `base.seed`, qui est DÉJÀ le flux du créneau : l'accompagnement de lundi et
    // celui de mardi restent donc distincts sans que cette fonction ait à connaître la date.
    seed: derive(base.seed, 'accompagnement'),
  }

  let result: SuggestionResult
  try {
    result = suggest(requete)
  } catch (error) {
    if (error instanceof NoViableRecipeError) return null
    throw error
  }

  const signaturePlat = catalog.indexes.recipeFamilySignature.get(platId) ?? new Map<string, number>()
  for (const suggestion of result.suggestions) {
    if (catalog.recipes.get(suggestion.recipeId)?.service !== 'accompagnement') continue
    const signatureAcc =
      catalog.indexes.recipeFamilySignature.get(suggestion.recipeId) ?? new Map<string, number>()
    if (signatureOverlap(signaturePlat, signatureAcc) >= SEUIL_REPETITION) continue
    return suggestion.recipeId
  }
  return null
}

/**
 * Ce qu'il RESTE à couvrir aujourd'hui, réparti sur les créneaux restants — le « cumul réinjecté ».
 *
 * ⚠️ PLANCHER À ZÉRO, pas de valeur négative. Un créneau qui a déjà dépassé la référence du jour
 * doit viser 0, pas un nombre négatif : `scoreNutri` ignore les cibles ≤ 0 (§6.5 précision 1), donc
 * un négatif ferait silencieusement DISPARAÎTRE le nutriment du score au lieu de dire « on a assez ».
 *
 * `slotsRemaining` inclut le créneau courant : au premier créneau d'une journée à 4, on vise le
 * quart de la journée, pas le tiers de ce qui reste après lui.
 */
function remainingTarget(
  dailyReference: NutrientVector,
  placedToday: NutrientVector,
  slotsRemaining: number
): NutrientVector {
  const diviseur = Math.max(1, slotsRemaining)
  const target = new Float64Array(dailyReference.length)
  for (let i = 0; i < target.length; i++) {
    target[i] = Math.max(0, (dailyReference[i] ?? 0) - (placedToday[i] ?? 0)) / diviseur
  }
  return target
}
