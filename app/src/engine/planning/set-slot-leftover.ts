// engine/planning/set-slot-leftover.ts — poser un reste À LA MAIN (lot `retour-4`, décision 78).
//
// « Trop compliqué à gérer » disait le retour d'essai : l'application place les restes toute seule
// et l'utilisateur n'a aucun mot à dire. §7.3 explique POURQUOI elle les place ; elle ne dit nulle
// part comment quelqu'un pourrait décider, lui, que ce sera le dahl de mardi et pas autre chose.
//
// ⛔ CE LOT N'AJOUTE PAS UNE CAPACITÉ, IL AJOUTE UN CHOIX — et c'est mesuré, pas supposé. Sous la
// comptabilité de `planLeftovers`, une semaine fraîchement composée n'offre AUCUNE portion encore
// plaçable, à 1, 2 comme 3 convives : la machine a déjà tout distribué. `sourcesDeReste` ne déduit
// donc PAS `dejaPlaces`. Poser un reste à la main, c'est DÉPLACER une décision déjà prise, pas
// exploiter un surplus oublié.
//
// ⛔ LE VERROU VA PAR DEUX, ET C'EST TOUT LE LOT. `plan-week.ts` verse le `recipeId` de toute entrée
// verrouillée non-accompagnement dans `placedRecipeIds`, qui interdit le doublon dans la semaine.
// Verrouiller le RESTE sans verrouiller sa CUISSON fait donc compter le reste comme la cuisson : la
// recomposition suivante n'ordonne plus jamais le plat, et la semaine porte un repas que personne
// n'a acheté ni cuisiné. Mesuré sur le code livré, en verrouillant le seul reste d'un plan :
// « cuissons : AUCUNE / restes : 1 ». En verrouillant les deux : « cuissons : 2026-03-10 diner
// locked=true / restes : 2026-03-11 dejeuner locked=true », 13 restes, aucune inflation.
// ▶ C'est aussi le « décalage » de la décision 78, et il est ÉMERGENT : rien n'est replacé ici. Le
//   plat chassé du créneau ressort à la composition suivante, parce que ses deux créneaux à lui
//   sont figés et que le reste du plan se rejoue autour.
//
// ⛔ L'ENTRÉE ÉCRITE DOIT ÊTRE INDISCERNABLE DE CELLE QUE `planLeftovers` AURAIT ÉCRITE, au verrou
// près. Ce n'est pas une élégance : `setSlotHorsCatalogue` fait l'INVERSE — il vide le créneau et
// emporte l'accompagnement — et c'est le geste dont le code ressemble le plus à celui-ci. Un reste
// GARDE son accompagnement (mesuré : 10 des 13 créneaux que `planLeftovers` transforme le gardent),
// garde son `service`, et ne porte jamais d'étiquette libre.
//
// Dépendances autorisées : domain/ uniquement — §2/§3 ENGINE. Ni suggestion, ni accompagnement à
// recalculer : le plat existe déjà ailleurs dans la semaine, il n'y a rien à choisir.

import type { Catalog, MealPlanEntry, RecipeId, SlotRef, WeekPlan } from '../domain/index.js'
import { ecartJours } from './plan-leftovers.js'

/** Une cuisson du plan dont il resterait de quoi remplir le créneau visé. */
export interface SourceDeReste {
  /** Le créneau où le plat est CUISINÉ. */
  readonly slot: SlotRef
  readonly recipeId: RecipeId
}

/** Ce qu'il faut avoir mémorisé pour défaire le geste exactement. */
export interface ResteDefait {
  /** L'entrée principale du créneau cible, telle qu'elle était avant le geste. */
  readonly cible: MealPlanEntry
  /** L'entrée principale du créneau de cuisson, telle qu'elle était avant le geste. */
  readonly cuisson: MealPlanEntry
}

const memeCreneau = (a: SlotRef, b: SlotRef): boolean => a.date === b.date && a.creneau === b.creneau

const estAccompagnement = (e: MealPlanEntry): boolean => e.service === 'accompagnement'

/** L'entrée qui porte LE PLAT d'un créneau — jamais son accompagnement. */
function indexDuPlat(plan: WeekPlan, slot: SlotRef): number {
  return plan.entries.findIndex((e) => memeCreneau(e.slot, slot) && !estAccompagnement(e))
}

/**
 * Les plats du plan dont un reste pourrait être servi sur `slot`.
 *
 * Rejoue les QUATRE RÈGLES de `planLeftovers` (l. 85-91) et rien d'autre : cuisiné strictement
 * avant, dans la limite de `conservationJours`, la recette portant ce `MealSlot`, et au moins un
 * repas de portions au-delà des convives. S'y ajoute la règle de bon sens que le placement
 * automatique porte aussi : on ne sert pas le reste du plat qu'on avait déjà prévu ici.
 *
 * ⚠️ `dejaPlaces` N'EST PAS DÉDUIT, contrairement à `planLeftovers`. Là-bas la déduction sert
 * l'IDEMPOTENCE — un second passage replacerait les mêmes portions. Ici il n'y a pas de second
 * passage : l'utilisateur DÉSIGNE un créneau, et ce qu'il demande, c'est de déplacer un reste que
 * la machine avait mis ailleurs. Déduire rendrait la liste systématiquement vide (mesuré : 0
 * créneau plaçable sur une semaine fraîche, à 1, 2 et 3 convives) et le geste inutile.
 *
 * Créneau introuvable, verrouillé, ou déjà un reste → liste VIDE. `planLeftovers` écarte les mêmes
 * candidats, et pour les mêmes raisons : un créneau figé ne se laisse pas écraser, et remplacer un
 * reste par un autre reste revient à jeter le premier.
 */
export function sourcesDeReste(
  catalog: Catalog,
  plan: WeekPlan,
  slot: SlotRef,
  convives = 1
): readonly SourceDeReste[] {
  if (convives < 1) {
    throw new RangeError(`sourcesDeReste : ${convives} convive(s) — il en faut au moins 1.`)
  }

  const index = indexDuPlat(plan, slot)
  if (index < 0) return []
  const cible = plan.entries[index]!
  if (cible.locked || cible.isLeftover) return []

  const sources: SourceDeReste[] = []
  for (const entree of plan.entries) {
    if (entree.recipeId === null || entree.isLeftover || estAccompagnement(entree)) continue
    if (memeCreneau(entree.slot, slot)) continue
    if (entree.recipeId === cible.recipeId) continue

    const recette = catalog.recipes.get(entree.recipeId)
    if (recette === undefined) continue

    const age = ecartJours(entree.slot.date, slot.date)
    if (age < 1 || age > recette.conservationJours) continue
    if (!recette.typesRepas.includes(slot.creneau)) continue
    if (Math.floor((recette.portionsBase - convives) / convives) < 1) continue

    sources.push({ slot: entree.slot, recipeId: entree.recipeId })
  }
  return sources
}

/**
 * Sert sur `slot` le reste de `recipeId`, cuisiné ailleurs dans la semaine. Rend un NOUVEAU plan.
 *
 * Trois effets, et pas un de plus :
 *   1. le créneau cible porte le reste, et il est GARDÉ — c'est un choix de l'utilisateur ;
 *   2. le créneau où le plat est CUISINÉ est gardé lui aussi (voir l'en-tête : sans ça, la
 *      recomposition suivante fait disparaître la cuisson) ;
 *   3. rien d'autre ne bouge. Aucun créneau n'est vidé, aucun plat n'est replacé, la semaine n'est
 *      pas recomposée. Le plat chassé ressort tout seul au prochain tirage.
 *
 * ⚠️ L'ACCOMPAGNEMENT DE LA CIBLE RESTE EN PLACE, à l'inverse de `setSlotHorsCatalogue`. Un reste
 * est un plat comme un autre : le riz qui l'accompagnait accompagne encore.
 *
 * Créneau introuvable, verrouillé, déjà un reste, ou plat qui n'est pas une source éligible → le
 * plan est rendu INCHANGÉ, sans erreur. Même posture que `rerollSlot` sur un créneau verrouillé :
 * l'écran ne propose que ce que `sourcesDeReste` a rendu, donc un identifiant non éligible ne peut
 * venir que d'un état périmé — le refuser suffit, lever ferait tomber l'écran sur un décalage.
 */
export function setSlotLeftover(
  catalog: Catalog,
  plan: WeekPlan,
  slot: SlotRef,
  recipeId: RecipeId,
  convives = 1
): WeekPlan {
  const eligible = sourcesDeReste(catalog, plan, slot, convives).find((s) => s.recipeId === recipeId)
  if (eligible === undefined) return plan

  const entries = plan.entries.map((entree) => {
    if (memeCreneau(entree.slot, slot) && !estAccompagnement(entree)) {
      return {
        ...entree,
        recipeId,
        // ⛔ L'ÉTIQUETTE NE SURVIT PAS AU PLAT. Un créneau porte un plat OU une étiquette, jamais
        // les deux : c'est le `CHECK` de la migration v9, et c'est ce qui a mordu au lot
        // `retour-3` — le moteur rendait un plan bien formé que la BASE refusait à l'écriture.
        horsCatalogue: null,
        // Un reste, ce sont les assiettes servies ce soir-là, pas ce que la recette produit.
        portions: convives,
        isLeftover: true,
        locked: true,
      }
    }
    if (memeCreneau(entree.slot, eligible.slot) && !estAccompagnement(entree)) {
      return { ...entree, locked: true }
    }
    return entree
  })

  return { ...plan, entries }
}

/**
 * Défait un `setSlotLeftover` : le créneau retrouve son plat, la cuisson son verrou d'avant.
 *
 * ⚠️ POURQUOI LA MÉMOIRE EST PASSÉE EN ARGUMENT, ET NON RECONSTITUÉE ICI. Un plan ne dit pas ce
 * qu'il portait avant : le plat chassé n'y est plus, et le verrou de la cuisson ne dit pas QUI l'a
 * posé. Reconstituer reviendrait à retirer un verrou que l'utilisateur avait peut-être mis
 * lui-même. L'appelant tient donc la mémoire du geste — mémoire de SESSION, comme `ui/dehors.ts` :
 * elle meurt avec l'écran, et c'est assumé. Un annuler qui survivrait au rechargement demanderait
 * une colonne, donc une migration, pour défaire un geste qu'on refait en deux clics.
 *
 * ⚠️ LA CUISSON N'EST RELÂCHÉE QUE SI PLUS AUCUN AUTRE RESTE **POSÉ À LA MAIN** N'EN DÉPEND. Deux
 * créneaux peuvent servir le reste du même plat ; libérer la cuisson en défaisant le premier
 * casserait le second, exactement de la façon décrite en tête de fichier.
 * ⛔ MAIS LES RESTES QUE LA MACHINE A POSÉS NE COMPTENT PAS, et c'est mesuré : la source d'un geste
 * est presque toujours un plat que `planLeftovers` sert DÉJÀ ailleurs — 3 restes de dahl sur la seule
 * source du premier créneau cible, à 2 comme à 3 repas par jour. Les compter reviendrait à ne jamais
 * relâcher la cuisson, donc à laisser derrière chaque annulation un créneau figé que personne n'a
 * demandé à garder. Un reste automatique n'a pas besoin de ce verrou : il est RECALCULÉ à chaque
 * recomposition, là où un reste gardé est reposé tel quel.
 *
 * Créneau introuvable ou qui n'est plus un reste → plan inchangé.
 */
export function unsetSlotLeftover(plan: WeekPlan, slot: SlotRef, memoire: ResteDefait): WeekPlan {
  const index = indexDuPlat(plan, slot)
  if (index < 0) return plan
  const cible = plan.entries[index]!
  if (!cible.isLeftover) return plan

  const cuisson = memoire.cuisson.slot
  const encoreServiAilleurs = plan.entries.some(
    (e) =>
      e.isLeftover &&
      // Gardé = posé à la main. Un reste automatique se recalcule, il n'a pas besoin du verrou.
      e.locked &&
      e.recipeId === cible.recipeId &&
      !estAccompagnement(e) &&
      !memeCreneau(e.slot, slot)
  )

  const entries = plan.entries.map((entree) => {
    if (memeCreneau(entree.slot, slot) && !estAccompagnement(entree)) return memoire.cible
    if (!encoreServiAilleurs && memeCreneau(entree.slot, cuisson) && !estAccompagnement(entree)) {
      return { ...entree, locked: memoire.cuisson.locked }
    }
    return entree
  })

  return { ...plan, entries }
}
