// engine/selection/explain.ts — explication d'une suggestion (docs/ENGINE.md §6.7).
//
// Convertit les contributions d'une recette (`ScoreBreakdown`, déjà PONDÉRÉES — voir la décision
// documentée en en-tête de scoring-pass.ts, « la somme des entrées du breakdown est EXACTEMENT le
// score final ») en phrases prêtes à afficher, format `Explanation` (domain/result.ts).
//
// ⚠️ DÉCISION DE FOND DE CE FICHIER — constat du banc d'essai (§11.3 ENGINE), à documenter ici
// parce qu'elle change la SIGNATURE de la fonction, pas seulement son calcul interne.
//
// Sur un profil neuf (aucune préférence enregistrée, aucune envie exprimée, historique vide), les
// couches `preference`, `craving` et `variety` rendent NEUTRAL_SCORE (0.5, scoring/index.ts) à
// TOUS les candidats — aucune n'a rien à comparer. Leur CONTRIBUTION pondérée (poids normalisé ×
// NEUTRAL_SCORE) est donc RIGOUREUSEMENT IDENTIQUE d'une recette à l'autre : ces couches ne
// discriminent rien entre les candidats, elles se contentent de translater tous les scores de la
// même quantité. Une explication naïve « top 3 par contribution » citerait pourtant « proche de vos
// goûts » à quelqu'un dont l'application ne sait STRICTEMENT rien sur ses goûts — une affirmation
// fausse, qui percute frontalement le principe 6 d'ARCHITECTURE.md (« informer, jamais juger ») en
// inventant un motif qui n'existe pas.
//
// D'où la règle : une couche dont la contribution est IDENTIQUE sur l'ENSEMBLE des candidats
// scorés n'est JAMAIS citée, quelle que soit la taille de cette contribution — même si elle est
// numériquement la plus forte de toutes. C'est pour ça que `explainSuggestion` prend en paramètre
// l'ENSEMBLE des breakdowns de la passe de score (`ScoringPassResult.breakdowns` en entier, pas une
// seule recette isolée) : c'est la SEULE façon de savoir ce qui discrimine réellement — une
// fonction qui ne verrait qu'une recette ne pourrait structurellement pas faire la différence entre
// « ce plat est vraiment un bon match pour vos goûts » et « cette couche dit la même chose à tout
// le monde en ce moment ».
//
// Conséquences assumées :
//   - si moins de trois couches discriminent, on en cite MOINS — jamais de remplissage par une
//     couche non discriminante pour atteindre trois ;
//   - si AUCUNE ne discrimine (cas limite : un seul candidat dans l'ensemble, ou tous les candidats
//     strictement identiques sur toutes les couches actives), on retourne une liste VIDE plutôt
//     qu'une explication mensongère. Le banc d'essai (cli/try-engine.ts) affiche explicitement ce
//     cas plutôt que de laisser un vide silencieux — voir son en-tête.
//   - la comparaison entre candidats se fait À EPSILON PRÈS (`CONTRIBUTION_EPSILON` ci-dessous) :
//     les contributions sont des flottants issus de produits poids × score, un écart d'erreur
//     d'arrondi ne doit jamais être lu comme une discrimination réelle.
//
// `contribution` est reprise TELLE QUELLE depuis le breakdown (déjà « part du score final, 0 → 1 »,
// §6.7 ENGINE) — aucun recalcul, aucun accès aux poids ici.
//
// `authority`/`evidenceSheetId` ne sont JAMAIS renseignés par ce fichier : ils sont réservés à la
// couche `topic` (§6.7 ENGINE), qui n'est pas implémentée (voir scoring-pass.ts, SCORING_LAYERS).
// Les inventer ici pour une autre couche serait fabriquer une source qui n'existe pas.
//
// Dépendances autorisées : domain/ uniquement (§2/§3 ENGINE : SEL --> DOM). Ce fichier ne calcule
// rien depuis `Catalog` — il ne consomme que la sortie déjà produite par `runScoringPass`.

import type { Explanation, RecipeId, ScoreBreakdown, ScoringLayerId } from '../domain/index.js'

/** Nombre maximal d'explications retournées (§6.7 ENGINE — « les trois plus fortes contributions »). */
export const MAX_EXPLANATIONS = 3

/**
 * Tolérance de comparaison flottante entre contributions (voir la décision de fond ci-dessus).
 * Les contributions comparées ici sont des produits (poids normalisé × score brut, tous deux dans
 * [0, 1]) : l'erreur d'arrondi flottante attendue est de l'ordre de 1e-15, très loin en dessous des
 * écarts qui comptent réellement pour l'utilisateur (au moins 1e-3, la granularité des poids). 1e-9
 * laisse une marge large sans jamais masquer un écart réel.
 */
export const CONTRIBUTION_EPSILON = 1e-9

/**
 * Couches de score dont la contribution DISCRIMINE réellement entre les candidats de `breakdowns`
 * — c'est-à-dire dont la valeur diffère de plus de `CONTRIBUTION_EPSILON` entre au moins deux
 * candidats. Une couche absente de tout breakdown, ou présente sur un seul candidat (rien à
 * comparer), n'est structurellement pas discriminante.
 *
 * Fonction pure, exposée séparément d'`explainSuggestion` : c'est elle qui porte la décision de
 * fond documentée en en-tête de ce fichier, et elle est testable indépendamment de la construction
 * des phrases.
 */
export function discriminatingScoringLayers(
  breakdowns: ReadonlyMap<RecipeId, ScoreBreakdown>
): ReadonlySet<ScoringLayerId> {
  const valuesByLayer = new Map<ScoringLayerId, number[]>()

  for (const breakdown of breakdowns.values()) {
    for (const [id, contribution] of Object.entries(breakdown) as Array<[ScoringLayerId, number]>) {
      const values = valuesByLayer.get(id)
      if (values) values.push(contribution)
      else valuesByLayer.set(id, [contribution])
    }
  }

  const discriminating = new Set<ScoringLayerId>()
  for (const [id, values] of valuesByLayer) {
    if (values.length < 2) continue // une seule valeur connue pour cette couche : rien à comparer
    const min = Math.min(...values)
    const max = Math.max(...values)
    if (max - min > CONTRIBUTION_EPSILON) discriminating.add(id)
  }
  return discriminating
}

/** Gabarits de phrase, un par couche de score IMPLÉMENTÉE (SCORING_LAYERS, scoring-pass.ts) — ton
 * neutre et descriptif (§6.2 ARCHITECTURE : l'application décrit, elle ne juge ni ne félicite). Les
 * 4 couches non implémentées (`pantry`, `occasion`, `topic`, `cost`) n'apparaissent jamais dans un
 * breakdown réel et n'ont donc pas de gabarit — `labelFor` lève si on les rencontre malgré tout. */
const EXPLANATION_LABELS: Readonly<Partial<Record<ScoringLayerId, string>>> = {
  nutri: 'apports équilibrés pour ce repas',
  preference: 'proche de vos goûts',
  craving: "correspond à l'envie exprimée",
  season: 'ingrédients de saison',
  variety: 'change de vos derniers repas',
  habit: 'dans vos habitudes',
  speed: 'rapide à préparer',
}

function labelFor(id: ScoringLayerId): string {
  const label = EXPLANATION_LABELS[id]
  if (label === undefined) {
    throw new Error(
      `explain.ts : aucun gabarit de phrase pour la couche '${id}' — couche non implémentée ou hors périmètre de ce lot`
    )
  }
  return label
}

/**
 * Les explications de `recipeId`, prêtes à afficher : au plus `MAX_EXPLANATIONS`, restreintes aux
 * couches qui discriminent réellement sur `breakdowns` (voir la décision de fond en en-tête).
 *
 * `breakdowns` doit porter l'ENSEMBLE des candidats scorés (typiquement
 * `ScoringPassResult.breakdowns` en entier, pas seulement les recettes affichées après diversifi-
 * cation/limite) — c'est ce qui permet de déterminer ce qui discrimine. `recipeId` absent de
 * `breakdowns`, ou breakdown vide pour ce candidat : liste vide (défensif), pas une exception.
 *
 * Tri par contribution décroissante, départage déterministe par id de couche croissant à égalité
 * stricte (même convention que `rankScoredCandidates`, scoring-pass.ts).
 */
export function explainSuggestion(
  recipeId: RecipeId,
  breakdowns: ReadonlyMap<RecipeId, ScoreBreakdown>
): readonly Explanation[] {
  const breakdown = breakdowns.get(recipeId)
  if (!breakdown) return []

  const discriminating = discriminatingScoringLayers(breakdowns)

  const entries = (Object.entries(breakdown) as Array<[ScoringLayerId, number]>)
    .filter(([id]) => discriminating.has(id))
    .sort((a, b) => {
      if (a[1] !== b[1]) return b[1] - a[1]
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
    })
    .slice(0, MAX_EXPLANATIONS)

  return entries.map(([id, contribution]) => ({
    criterion: id,
    contribution,
    label: labelFor(id),
  }))
}
