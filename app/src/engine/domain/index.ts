// engine/domain/index.ts — L1 Domaine (docs/ENGINE.md §4)
//
// Types purs uniquement : identifiants et unités brandés, entités du catalogue, requêtes et
// réponses de l'API publique, erreurs métier. Zéro logique, zéro dépendance externe. C'est la
// seule couche dont dépendent toutes les autres (§2/§3 ENGINE) — elle-même ne dépend de rien
// dans engine/.

export * from './brand.js'
export * from './units.js'
export * from './ids.js'
export * from './layer-ids.js'
export * from './errors.js'
export * from './catalog.js'
export * from './profile.js'
export * from './request.js'
export * from './result.js'
export * from './planning.js'
