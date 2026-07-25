// engine/domain/archetype-ids.ts
//
// Identifiant d'archétype de pondération (docs/ENGINE.md §6.3 bis) — un archétype = un vecteur de
// poids NOMMÉ qui surcharge certaines couches de SCORE. La table des surcharges et la logique de
// résolution vivent dans selection/archetypes.ts (L3), pas ici.
//
// Placé dans domain/ (L1), pas dans selection/ (L3), pour la MÊME raison que `LayerId`
// (domain/layer-ids.ts, voir son en-tête) : `SuggestionRequest.archetype` (domain/request.ts) a
// besoin de ce type, et domain/ est la couche la plus basse — elle ne doit dépendre de rien
// d'autre dans engine/ (§2/§3 ENGINE), surtout pas de selection/ qui lui est supérieure.
// selection/archetypes.ts réexporte ce type pour offrir la même surface unique `engine/selection`
// que LayerId/ScoringLayerId.
//
// Union fermée, noms validés par l'utilisateur (session du 2026-07-25) — voir docs/ENGINE.md
// §6.3 bis pour la table complète (archétype → couche de score mise en avant).

export type ArchetypeId = 'equilibre' | 'envie' | 'decouverte' | 'de_saison' | 'mes_gouts' | 'rapide'
