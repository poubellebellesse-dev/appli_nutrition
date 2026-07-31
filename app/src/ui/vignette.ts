// ui/vignette.ts — l'aplat de couleur qui tient la place des photos.
//
// ⚠️ BOUCHE-TROU ASSUMÉ, PAS UNE FAUSSE PHOTO. Le catalogue compte 241 recettes et ZÉRO image
// (`recipe.image_path` est renseigné nulle part), alors que §4.1 DESIGN veut « photo dominante ».
// Concevoir la carte plein écran en attendant les vraies images imposait un choix : un grand
// rectangle vide, qui donne une application cassée — ou une image d'illustration générique, qui
// ment sur le plat. D'où cet aplat : visiblement décoratif, jamais confondu avec une photo.
//
// ⚠️ L'APLAT EST `aria-hidden` ET NE PORTE AUCUNE INFORMATION. Le nom du plat, son score et ses
// explications sont du VRAI texte, sous l'aplat. C'est ce qui dispense la lettre affichée dessus du
// seuil de contraste 7:1 (§1 DESIGN) : elle n'est pas du texte, c'est un motif. Le jour où les
// photos arrivent, on remplace ce bloc sans toucher au reste de la carte.
//
// ⚠️ DÉTERMINISTE. La même recette garde sa couleur d'un affichage à l'autre, d'une session à
// l'autre : une carte qui change de teinte à chaque rendu donne l'impression d'un autre plat. Pas
// de `Math.random`, pas d'index de position — l'identifiant, et rien d'autre.

/**
 * Teintes de l'aplat. Dérivées de la palette (`ui/theme.css`) et volontairement DÉSATURÉES : ce
 * bloc occupe la moitié de l'écran, une couleur franche écraserait l'accent terracotta qui porte,
 * lui, les actions. Six suffisent — au-delà, deux teintes voisines ne se distinguent plus.
 */
const TEINTES: readonly string[] = [
  '#d8c3a5', // sable
  '#c9d1c0', // sauge
  '#e0c8b8', // argile claire
  '#c6cdd6', // ardoise douce
  '#dcd0b4', // lin
  '#cfc2cb', // prune pâle
]

/**
 * Hachage stable d'une chaîne (variante de djb2).
 *
 * `>>> 0` à chaque tour : sans lui, l'accumulateur déborde en entier signé 32 bits et rend des
 * valeurs négatives, dont le modulo est négatif en JavaScript — un index hors du tableau, donc une
 * couleur `undefined` sur certaines recettes seulement.
 */
function hacher(texte: string): number {
  let h = 5381
  for (let i = 0; i < texte.length; i++) h = (((h << 5) + h + texte.charCodeAt(i)) >>> 0) % 0xffffffff
  return h
}

/** La teinte d'une recette. Même identifiant → même couleur, toujours. */
export function couleurDeRecette(recetteId: string): string {
  return TEINTES[hacher(recetteId) % TEINTES.length]!
}

/**
 * La lettre affichée sur l'aplat — purement décorative.
 *
 * `Array.from` et non `nom[0]` : sur un nom commençant par un caractère hors du plan multilingue de
 * base, l'indexation rendrait une demi-paire de substitution et afficherait un losange noir.
 */
export function initialeDeRecette(nom: string): string {
  return (Array.from(nom.trim())[0] ?? '?').toUpperCase()
}
