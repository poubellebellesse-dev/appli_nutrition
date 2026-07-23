// engine/domain/errors.ts
//
// Erreurs métier (docs/ENGINE.md §4.4, §8.3). EngineSafetyError ne doit JAMAIS être capturée
// silencieusement par l'UI : une post-condition violée est un bug de sécurité, pas un cas à
// dégrader proprement.

/** Post-condition de sécurité violée (garde-fou, guards/). Jamais rattrapée. */
export class EngineSafetyError extends Error {}

/** Filtrage trop restrictif — 0 candidat après exclusion. Rattrapée par l'UI. */
export class NoViableRecipeError extends Error {}

/** Catalogue corrompu ou version incompatible, détecté au chargement. */
export class CatalogIntegrityError extends Error {}
