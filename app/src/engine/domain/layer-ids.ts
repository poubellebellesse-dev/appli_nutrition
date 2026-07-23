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

export type ExclusionLayerId = 'allergenes' | 'regime' | 'temps' | 'equipement'

export type ScoringLayerId =
  | 'nutri'
  | 'preference'
  | 'craving'
  | 'variety'
  | 'season'
  | 'pantry'
  | 'habit'
  | 'occasion'
  | 'topic'
  | 'cost'

export type LayerId = ExclusionLayerId | ScoringLayerId

export type LayerKind = 'exclusion' | 'scoring'
