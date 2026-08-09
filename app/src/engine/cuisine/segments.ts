// engine/cuisine/segments.ts — découper une recette en tranches actives et passives.
//
// À quoi ça sert : `ordonnancerCuissons` traitait chaque plat comme un bloc plein. Un coq au vin de
// 12 h 55 lui interdisait donc tout le reste de la soirée, alors que 12 h de ces 12 h 55 sont une
// marinade au frigo pendant laquelle on peut faire trois autres plats. Ce module dit OÙ, dans la
// recette, se trouve ce temps libre.
//
// ⛔ UNE HYPOTHÈSE, ET IL FAUT LA LIRE AVANT DE SE FIER À UN SEGMENT ACTIF. Le catalogue chiffre les
// minuteurs étape par étape, mais pas le temps de geste : personne n'a écrit « émincer l'oignon
// prend 4 min ». Ce qui existe est un total par recette (`tempsPrepMin + tempsCuissonMin`). Le temps
// non chiffré est donc RÉPARTI UNIFORMÉMENT sur les étapes qui ne portent aucun minuteur. C'est faux
// au détail près — hacher trois carottes n'est pas dresser une assiette — et ça n'a pas besoin d'être
// vrai : la seule chose que l'ordonnancement en tire est de savoir si un geste tombe pendant le geste
// d'un autre plat. Aucune de ces minutes n'est affichée à l'utilisateur.
//
// ⛔ CE QUI, EN REVANCHE, EST EXACT ET DOIT LE RESTER : la SOMME des segments vaut `dureeEcouleeMin`.
// Le contrat de sortie de `ordonnancerCuissons` en dépend (`departAvantServiceMin === dureeMin +
// retardMin`) et le module lève si l'écart dépasse la demi-minute. Toute la répartition ci-dessous
// n'est qu'une façon de distribuer un total connu, jamais une façon d'en inventer un autre.
//
// ⚠️ UNE CUISSON EST COMPTÉE ACTIVE. Décision instruite, pas oubli — voir `NatureSegment` dans
// `./ordonnancement.ts`. Seul un `timerType: 'repos'` chiffré ouvre du temps libre.
//
// Dépendances autorisées : ../domain/index.js pour les types, ./duree.js, ./ordonnancement.js pour
// le type `SegmentCuisson` seul.

import type { Recipe, RecipeStep } from '../domain/index.js'
import type { SegmentCuisson } from './ordonnancement.js'
import { dureeActiveMin } from './duree.js'

/**
 * Le découpage actif/passif d'une recette, dans l'ordre des étapes.
 *
 * ⚠️ SEULES LES ÉTAPES `nature: 'geste'` DEVIENNENT DES SEGMENTS. Un `avertissement` se lit après
 * coup et ne prend pas de temps (règle L0 du mode cuisine, verrouillée au build : il est toujours
 * la dernière étape et ne porte jamais de minuteur — 0 occurrence mesurée sur 1 548 étapes).
 */
export function segmentsDeLaRecette(recette: Recipe): readonly SegmentCuisson[] {
  const gestes = [...recette.etapes]
    .filter((e) => e.nature === 'geste')
    .sort((a, b) => a.ordre - b.ordre)

  const budgetActif = dureeActiveMin(recette)
  const actifs = gestes.filter((e) => !estRepos(e))

  // Une recette sans le moindre geste actif : tout son temps actif est réel, il n'a simplement
  // aucune étape où s'accrocher. On le pose en tête plutôt que de le perdre — perdre ces minutes
  // ferait démarrer le plat trop tard, et la somme cesserait de valoir `dureeEcouleeMin`.
  if (actifs.length === 0) {
    const tete: SegmentCuisson[] =
      budgetActif > 0 ? [{ ordre: 0, nature: 'actif', dureeMin: budgetActif }] : []
    return [...tete, ...gestes.map(segmentPassif)]
  }

  const parEtape = repartir(actifs, budgetActif)
  return gestes.map((etape) =>
    estRepos(etape)
      ? segmentPassif(etape)
      : { ordre: etape.ordre, nature: 'actif' as const, dureeMin: parEtape.get(etape.ordre) ?? 0 },
  )
}

function estRepos(etape: RecipeStep): boolean {
  return etape.timerType === 'repos' && etape.timerS !== null
}

function segmentPassif(etape: RecipeStep): SegmentCuisson {
  return { ordre: etape.ordre, nature: 'passif', dureeMin: (etape.timerS ?? 0) / 60 }
}

/**
 * Distribue `budgetActif` sur les étapes actives, et rend le résultat par `ordre`.
 *
 * Cas normal : les étapes qui portent un minuteur de cuisson gardent leur durée chiffrée, le reste
 * du budget se partage à parts égales entre celles qui n'en portent pas.
 *
 * ⛔ DEUX REPLIS, MESURÉS SUR LE CATALOGUE DU 2026-08-09 et pas imaginés :
 *
 *   - 7 recettes dont les minuteurs de cuisson TOTALISENT PLUS que leur temps actif déclaré (Veau
 *     Marengo : 122 min chiffrées pour 110 annoncées). Deux cuissons qui se recouvrent — le riz
 *     pendant le poulet — comptées une fois dans le champ éditorial et deux fois dans les étapes.
 *   - 3 recettes dont toutes les étapes actives sont déjà chiffrées, sans nulle part où poser le
 *     reste du budget (Poulet sauté aux noix de cajou : 9 min sans étape libre).
 *
 * Dans ces deux cas, le budget est réparti UNIFORMÉMENT sur toutes les étapes actives et les
 * minuteurs chiffrés sont ignorés pour ce découpage. On perd du détail, jamais le total — et le
 * total est la seule chose dont l'ordonnancement a besoin pour ne pas mentir. ⚠️ Ne pas « corriger »
 * ces recettes en remettant les minuteurs : leur incohérence est au CATALOGUE, qui n'appartient pas
 * à cette lane, et un découpage qui déborde son propre total fait lever `ordonnancerCuissons`.
 */
function repartir(actifs: readonly RecipeStep[], budgetActif: number): ReadonlyMap<number, number> {
  const chiffrees = actifs.filter((e) => e.timerType === 'cuisson' && e.timerS !== null)
  const libres = actifs.filter((e) => !(e.timerType === 'cuisson' && e.timerS !== null))
  const totalChiffre = chiffrees.reduce((somme, e) => somme + (e.timerS ?? 0) / 60, 0)
  const residu = budgetActif - totalChiffre

  const repliNecessaire = residu < 0 || (residu > 0 && libres.length === 0)
  if (repliNecessaire) {
    const part = budgetActif / actifs.length
    return new Map(actifs.map((e) => [e.ordre, part]))
  }

  const part = libres.length > 0 ? residu / libres.length : 0
  const parEtape = new Map<number, number>()
  for (const e of chiffrees) parEtape.set(e.ordre, (e.timerS ?? 0) / 60)
  for (const e of libres) parEtape.set(e.ordre, part)
  return parEtape
}
