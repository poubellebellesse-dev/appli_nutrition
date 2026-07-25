// engine/selection/scoring/season.ts — couche de score `season` (docs/ENGINE.md §6.5
// précision 3).
//
// `toute_annee` (disponibilité, rayon/conservation longue) et `saison_mois` (pleine saison,
// goût/production locale) sont deux dimensions INDÉPENDANTES : une carotte peut être disponible
// toute l'année ET de pleine saison de septembre à avril. Le score n'est plus tout-ou-rien : chaque
// ingrédient retenu rapporte un CRÉDIT, et le score est la moyenne des crédits PONDÉRÉE PAR
// `quantiteG` — même motif que `preference.ts` (précision 4) : un ingrédient présent en petite
// quantité (persil, épice) ne doit pas peser autant qu'un ingrédient dominant en poids (courgette,
// pomme de terre) dans le score de saisonnalité de la recette.
//
//   - `saisonMois` contient le mois du contexte              → crédit 1
//   - hors saison, mais `touteAnnee === true`                → crédit 0,5
//   - hors saison et `touteAnnee === false`                  → crédit 0
//   - `saisonMois` vide (saisonnalité non renseignée)        → exclu du calcul, quel que soit `touteAnnee`
//
// Le critère d'inclusion au numérateur ET au dénominateur est donc UNIQUEMENT `saisonMois.length > 0`
// — `touteAnnee` ne sert plus à exclure, seulement à moduler le crédit d'un ingrédient hors saison.
// Contrairement à `preference.ts`, un ingrédient exclu (saisonMois vide) n'entre pas non plus dans
// le dénominateur : ce n'est pas une préférence neutre à absorber dans la pondération, c'est une
// donnée non pertinente pour la saisonnalité (staple d'épicerie sans saison).
//
// Justification du demi-crédit : sans lui, le double marquage n'aurait aucun effet sur le score et
// un légume de garde hors saison tomberait à 0 comme une tomate de janvier — alors qu'il n'a demandé
// ni serre ni transport longue distance. Le demi-crédit est exactement ce qui distingue « disponible
// mais pas à son meilleur » de « hors saison pour de bon ».
//
// Somme des quantités des ingrédients retenus nulle (aucun ingrédient avec `saisonMois` renseigné —
// ex. plat 100% épicerie) → NEUTRAL_SCORE, surtout pas 0 : un plat de pâtes ne doit pas être pénalisé
// comme « hors saison » (précision 3, « un plat sans aucun ingrédient saisonnier obtient un season
// neutre, pas un score nul punitif »).
//
// Dépendances autorisées : domain/, ./index.js — §2/§3 ENGINE.

import type { Food, FoodId, Month, Recipe } from '../../domain/index.js'
import { NEUTRAL_SCORE, clamp01 } from './index.js'

export function scoreSeason(recipe: Recipe, foods: ReadonlyMap<FoodId, Food>, mois: Month): number {
  let weightedCreditSum = 0
  let totalWeight = 0

  for (const ingredient of recipe.ingredients) {
    const food = foods.get(ingredient.foodId)
    if (!food) continue
    if (food.saisonMois.length === 0) continue // saisonnalité non renseignée

    let credit = 0
    if (food.saisonMois.includes(mois)) {
      credit = 1
    } else if (food.touteAnnee) {
      credit = 0.5
    }

    weightedCreditSum += credit * ingredient.quantiteG
    totalWeight += ingredient.quantiteG
  }

  if (totalWeight === 0) return NEUTRAL_SCORE

  return clamp01(weightedCreditSum / totalWeight)
}
