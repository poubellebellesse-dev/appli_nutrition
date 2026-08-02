// ui/export-recette.ts — export d'une recette perso en fichier autonome `.nutri-recipe` (§8.7
// ARCHITECTURE : « Partage P2P »).
//
// ⚠️ V1 SANS PHOTO. §8.7 décrit « recette + photo embarquée + notes de l'auteur », mais aucune
// recette — catalogue ou perso — ne porte de photo aujourd'hui (`imagePath` toujours `null`, voir
// `versRecette` dans `data/user-recipe.ts`). Ce module n'en fabrique donc aucune : ce n'est pas un
// oubli, il n'y a rien à embarquer tant que la saisie de photo n'existe pas.
//
// ⚠️ EXPORT SEUL, PAS D'IMPORT. Le fichier produit est un `StoredUserRecipe` sérialisé, versionné
// par `schemaVersion` — en théorie réimportable proprement. Mais aucune fonction de LECTURE n'existe
// côté appli : partagé aujourd'hui, ce fichier ne peut être relu par personne. Tant que l'import
// n'est pas écrit, cette fonction produit une sauvegarde, pas un partage.
//
// ⚠️ LE PARTAGE DE FICHIERS N'EST NI UNIVERSEL NI GARANTI PAR LA SEULE PRÉSENCE DE `navigator.share`
// — certains navigateurs le supportent pour du texte mais pas pour des fichiers. `navigator.canShare`
// tranche cette question ; sans lui (ou s'il répond non), on bascule sur le téléchargement plutôt que
// de laisser un bouton sans effet visible. Même principe que `courses.tsx#BoutonPartager`.

import type { StoredUserRecipe } from '../data/user-recipe.js'

const EXTENSION = '.nutri-recipe'
const TYPE_MIME = 'application/json'

/** Nom de fichier dérivé du nom de la recette — accents et ponctuation neutralisés. */
function nomFichier(recette: StoredUserRecipe): string {
  const base = recette.nom
    .trim()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `${base === '' ? 'recette' : base}${EXTENSION}`
}

/**
 * Contenu du fichier : le `StoredUserRecipe` tel quel. C'est déjà le format versionné — un futur
 * import pourra refuser une version inconnue plutôt que d'en deviner les champs (voir l'en-tête de
 * `user-recipe.ts`).
 */
export function serialiserRecette(recette: StoredUserRecipe): string {
  return JSON.stringify(recette, null, 2)
}

/**
 * Partage ou télécharge une recette perso, une seule à la fois (§8.7 : « Une recette à la fois »).
 *
 * ⚠️ SILENCIEUX PARTOUT. Ni `navigator.share`, ni `canShare`, ni le repli ne doivent lever : un clic
 * sans effet visible vaut mieux qu'un écran cassé.
 */
export async function exporterRecette(recette: StoredUserRecipe): Promise<void> {
  const contenu = serialiserRecette(recette)
  const fichier = nomFichier(recette)

  if (typeof navigator !== 'undefined' && navigator.share !== undefined) {
    const partage = new File([contenu], fichier, { type: TYPE_MIME })
    if (navigator.canShare?.({ files: [partage] }) === true) {
      await navigator.share({ files: [partage], title: recette.nom }).catch(() => undefined)
      return
    }
  }

  telecharger(contenu, fichier)
}

/** Repli : `Blob` + `<a download>`, révoqué juste après le clic déclenché par script. */
function telecharger(contenu: string, fichier: string): void {
  const blob = new Blob([contenu], { type: TYPE_MIME })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = fichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  URL.revokeObjectURL(url)
}
