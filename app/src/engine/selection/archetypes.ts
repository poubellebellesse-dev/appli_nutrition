// engine/selection/archetypes.ts — archétypes de pondération nommés (docs/ENGINE.md §6.3 bis).
//
// Un archétype = un vecteur de poids NOMMÉ qui SURCHARGE certaines couches de SCORE ; les couches
// absentes de la surcharge gardent leur `defaultWeight` (LAYER_DESCRIPTORS, selection/index.ts).
// La normalisation Σ = 1 déjà en place dans `runScoringPass` (scoring-pass.ts) fait le reste :
// relever une couche abaisse mécaniquement la part des autres, sans qu'on ait à les recalculer à
// la main ici.
//
// Invariant §6.3 : un archétype ne touche JAMAIS une couche d'exclusion, et JAMAIS une couche
// `critical`. `ARCHETYPE_WEIGHT_OVERRIDES` est typé `Partial<Record<ScoringLayerId, number>>` —
// seul un `ScoringLayerId` peut y être une clé, ce qui rend une surcharge d'une couche d'exclusion
// une ERREUR DE COMPILATION plutôt qu'un cas à intercepter au runtime. Les deux couches `critical`
// (`allergenes`, `regime`) sont elles-mêmes des couches d'EXCLUSION (LAYER_DESCRIPTORS) — donc
// déjà hors de portée du même type, sans garde runtime redondante.
//
// `ArchetypeId` est défini dans domain/ (domain/archetype-ids.ts), pas ici — voir son en-tête pour
// le pourquoi (même raison que `LayerId`/domain/layer-ids.ts : `SuggestionRequest.archetype`,
// domain/request.ts, en a besoin, et domain/ ne dépend de rien dans engine/). Réexporté ci-dessous
// pour la surface unique `engine/selection`.
//
// Dépendances autorisées : domain/ — §2/§3 ENGINE.

import type { ArchetypeId, ScoringLayerId } from '../domain/index.js'

export type { ArchetypeId } from '../domain/index.js'

/** Aucun archétype précisé dans la requête → poids de référence, aucune surcharge (§8.1 ENGINE). */
export const DEFAULT_ARCHETYPE: ArchetypeId = 'equilibre'

/**
 * Table archétype → surcharges de poids de couches de score (§6.3 bis ENGINE, noms et valeurs
 * validés — session du 2026-07-25, appliqués tels quels). `equilibre` : objet vide, c'est le poids
 * de référence, rien à surcharger.
 */
export const ARCHETYPE_WEIGHT_OVERRIDES: Readonly<
  Record<ArchetypeId, Partial<Readonly<Record<ScoringLayerId, number>>>>
> = {
  equilibre: {},
  envie: { craving: 0.4 },
  decouverte: { variety: 0.35 },
  de_saison: { season: 0.3 },
  mes_gouts: { preference: 0.4 },
  rapide: { speed: 0.3 },
}

/**
 * Poids surchargé par l'archétype pour `layerId`, ou `undefined` si cet archétype ne touche pas
 * cette couche (elle garde alors son `defaultWeight`, résolu par l'appelant — scoring-pass.ts).
 * `archetype` absent → `DEFAULT_ARCHETYPE` (`'equilibre'`, donc toujours `undefined` en pratique).
 */
export function archetypeWeightOverride(
  archetype: ArchetypeId | undefined,
  layerId: ScoringLayerId
): number | undefined {
  return ARCHETYPE_WEIGHT_OVERRIDES[archetype ?? DEFAULT_ARCHETYPE][layerId]
}
