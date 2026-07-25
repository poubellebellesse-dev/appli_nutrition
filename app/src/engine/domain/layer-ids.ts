// engine/domain/layer-ids.ts
//
// Identifiants et nature des couches du registre de sélection (docs/ENGINE.md §6.3).
//
// Placés dans domain/ (L1), pas dans selection/ (L3), pour respecter le graphe de dépendance
// de §2 ENGINE : guards/ (L2) référence LayerId via PipelineTrace (voir domain/result.ts) et ne
// doit connaître QUE domain/, jamais selection/ qui lui est supérieure. selection/index.ts
// réexporte ces types pour offrir une surface unique `engine/selection` à l'appelant.
//
// ⚠️ Incohérence de la spec relevée telle quelle : §6.3 et §12 ENGINE parlent d'un "registre de
// 12 couches", mais le bloc de code de §6.3 énumère 4 couches d'exclusion + 10 couches de score
// = 14 entrées. Implémenté ici avec les 14 entrées listées (la liste explicite fait foi sur le
// chiffre en prose) — voir aussi LAYER_DESCRIPTORS dans selection/index.ts.
//
// Registre étendu à 15 entrées (5 exclusion + 10 score) par l'ajout de la couche `exclusions`
// (rejet personnel d'aliments, lit `HardConstraints.excludedFoodIds` — non critique, à la
// différence d'`allergenes`/`regime`, car c'est un choix désactivable, pas une question de
// sécurité alimentaire).
//
// Registre étendu à 16 entrées (6 exclusion + 10 score) par l'ajout de la couche `requis` (miroir
// dur d'`exclusions` — « je veux ça » plutôt que « je ne veux pas ça », lit
// `MealContext.requiredFoodIds`, pas `HardConstraints` — voir domain/request.ts et
// selection/requis.ts).
//
// Registre étendu à 17 entrées (6 exclusion + 11 score) par l'ajout de la couche `speed` (session
// du 2026-07-25, tranchée) : la note ¶ de §6.5 ENGINE laissait son rattachement ouvert (« pas une
// 17ᵉ couche du registre ») — c'est désormais résolu, `speed` EST une couche du registre à part
// entière, poids par défaut nul, relevée par l'archétype « Rapide » (§6.3 bis, voir
// selection/archetypes.ts). Voir selection/scoring/speed.ts.

export type ExclusionLayerId = 'allergenes' | 'regime' | 'exclusions' | 'requis' | 'temps' | 'equipement'

export type ScoringLayerId =
  | 'nutri'
  | 'preference'
  | 'craving'
  | 'variety'
  | 'season'
  | 'pantry'
  | 'habit'
  | 'occasion'
  | 'speed'
  | 'topic'
  | 'cost'

export type LayerId = ExclusionLayerId | ScoringLayerId

export type LayerKind = 'exclusion' | 'scoring'
