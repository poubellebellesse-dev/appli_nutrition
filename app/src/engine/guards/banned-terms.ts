// engine/guards/banned-terms.ts — copie du lexique banni (§6.2 ARCHITECTURE), consommée par
// assertNoTherapeuticClaim (guards/index.ts).
//
// ⚠️ PROBLÈME DE SOURCE UNIQUE, assumé, pas contourné autrement : la liste canonique vit dans
// catalog/build.mjs (`BANNED_TERMS`), qui bloque le build si un mot banni apparaît dans le contenu
// édité (nom/description/étape de recette, terme/définition de lexique). `engine/` ne peut PAS
// importer catalog/build.mjs : ce serait un import remontant hors du graphe autorisé (§3 ENGINE —
// guards/ ne dépend que de domain/, vérifié par tests/engine-boundaries.test.ts) et catalog/
// build.mjs est de toute façon un script Node ESM pur, pas du code applicatif (voir son en-tête).
//
// La liste et sa normalisation (minuscules + suppression des accents) sont donc DUPLIQUÉES ici à
// l'identique. Une liste de sécurité dupliquée qui dérive en silence serait pire que pas de
// garde-fou du tout — la vraie garantie n'est pas cette copie, c'est
// tests/banned-terms-consistency.test.mjs (racine du repo, hors app/src/engine/ pour ne pas
// déclencher tests/engine-boundaries.test.ts), qui importe les DEUX listes et échoue si elles
// divergent. Toute modification de l'une doit être répercutée manuellement sur l'autre — ce test
// est ce qui rend cet oubli visible plutôt que silencieux.
//
// Dépendances : aucune — fonctions pures sur des chaînes, pas de types domain/ nécessaires ici.

/** Vocabulaire banni de toute chaîne affichée par l'application (§6.2 ARCHITECTURE, deux familles). */
export const BANNED_TERMS: readonly string[] = [
  // Famille thérapeutique (§6.1 ARCHITECTURE)
  'soigne', 'soigner', 'guérit', 'guérir', 'traite', 'traiter',
  'prévient la maladie', 'remède', 'thérapie',
  // Famille jugement (principe 6 ARCHITECTURE)
  'malsain', 'mauvais pour', 'à éviter', 'trop gras', 'cheat meal',
  'se rattraper', 'plaisir coupable', 'aliment sain',
]

// Marques diacritiques combinantes Unicode (U+0300–U+036F) — retirées après normalisation NFD pour
// comparer le texte indépendamment des accents. Même plage que catalog/build.mjs `normalize()`.
const COMBINING_DIACRITICS = /[̀-ͯ]/g

/** Normalise pour la comparaison : minuscules, accents retirés — copie de catalog/build.mjs `normalize()`. */
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '')
}

const NORMALIZED_BANNED_TERMS = BANNED_TERMS.map((term) => ({ term, normalized: normalize(term) }))

/**
 * Termes bannis trouvés dans `text` (liste vide si aucun) — même contrat que la fonction homonyme
 * de catalog/build.mjs.
 */
export function findBannedTerms(text: string): readonly string[] {
  if (text.length === 0) return []
  const normalized = normalize(text)
  return NORMALIZED_BANNED_TERMS.filter(({ normalized: n }) => normalized.includes(n)).map((m) => m.term)
}
