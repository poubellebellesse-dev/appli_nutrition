// engine/domain/errors.ts
//
// Erreurs métier (docs/ENGINE.md §4.4, §8.3). EngineSafetyError ne doit JAMAIS être capturée
// silencieusement par l'UI : une post-condition violée est un bug de sécurité, pas un cas à
// dégrader proprement.

import type { RejectionSummary } from './result.js'

/** Post-condition de sécurité violée (garde-fou, guards/). Jamais rattrapée. */
export class EngineSafetyError extends Error {}

/**
 * Filtrage trop restrictif — 0 candidat après exclusion (§8.3 ENGINE). Rattrapée par l'UI, qui
 * affiche « assouplir un critère ». Porte le `RejectionSummary` complet (pas seulement un message
 * texte) : §8.3 dit explicitement que le motif dominant vient de `RejectionSummary` — l'attacher
 * ici évite à l'appelant (CLI, future UI) de rejouer `runExclusionPass` lui-même pour retrouver
 * l'entonnoir complet derrière le message.
 */
export class NoViableRecipeError extends Error {
  constructor(
    message: string,
    readonly rejected: RejectionSummary
  ) {
    super(message)
    this.name = 'NoViableRecipeError'
  }
}

/** Catalogue corrompu ou version incompatible, détecté au chargement. */
export class CatalogIntegrityError extends Error {}
