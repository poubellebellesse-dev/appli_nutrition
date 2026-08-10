// ui/export-courses.ts — la liste de courses en CSV et en JSON (§4.3 DESIGN : « impression et
// export »).
//
// ⚠️ FONCTIONS PURES, ET C'EST TOUT L'INTÉRÊT DU FICHIER. Le format vit ici, sans React, sans DOM et
// sans horloge : deux exports du même plan produisent deux fichiers OCTET POUR OCTET IDENTIQUES.
// C'est ce qui rend l'export testable sérieusement, et c'est aussi ce qui permet de comparer deux
// semaines avec un `diff`.
//
// ⚠️ AUCUNE DATE DE GÉNÉRATION DANS LE FICHIER. Elle rendrait tout export différent du précédent,
// donc tout `diff` illisible, pour une information que le système de fichiers porte déjà. La seule
// date écrite est celle des repas — la période du plan, qui, elle, dit quelque chose.
//
// ⚠️ L'EXPORT NE SUIT PAS LE RANGEMENT DE L'ÉCRAN. Il sort toujours par rayon, dans l'ordre du
// référentiel (`RAYONS_ALIMENTAIRES`), articles ajoutés à la main en dernier. « Ranger par repas »
// est une commodité de lecture ; un fichier, lui, doit être reproductible.
//
// ⚠️ LES ARTICLES COCHÉS SONT DEDANS, avec leur état. Les retirer ferait d'un export une liste de
// ce qui reste à faire à l'instant du clic — une liste de courses sert aussi à vérifier après coup
// ce qu'on a pris. `Partager` (`courses.tsx`) fait l'inverse et n'envoie que le restant : c'est un
// message qu'on lit debout dans un magasin, pas un fichier qu'on garde.

/** Une ligne d'export, déjà résolue : plus aucun identifiant, plus aucun calcul à faire ici. */
export interface LigneCourses {
  readonly libelle: string
  /** Telle qu'elle se lit en rayon (`Vue.quantiteDe`), `''` quand l'article n'en porte pas. */
  readonly quantite: string
  readonly rayon: string
  readonly coche: boolean
  /** `plan` : dérivé de la semaine. `ajout` : saisi à la main. Un import futur en aura besoin. */
  readonly origine: 'plan' | 'ajout'
}

/**
 * ⚠️ POINT-VIRGULE, PAS VIRGULE, ET UNE BOM. Le fichier est destiné à un tableur, et un tableur
 * francophone lit le séparateur de sa locale : une virgule y produit une seule colonne illisible, et
 * l'absence de BOM y affiche « Ã©chalote ». Les deux sont des défauts qu'on ne voit qu'à l'ouverture,
 * chez quelqu'un d'autre. `SEPARATEUR` est nommé pour que ce choix se relise, pas pour être changé
 * sans mesurer ce qu'il casse.
 */
const SEPARATEUR = ';'
const BOM = '\uFEFF' // ⛔ Écrit en séquence d'échappement, JAMAIS en caractère littéral : une BOM
// collée telle quelle dans le source est invisible à la relecture et le premier outil qui normalise
// le fichier la supprimerait sans que rien ne le signale.

const ENTETES: readonly string[] = ['Rayon', 'Article', 'Quantité', 'Coché', 'Origine']

/** Guillemets doublés, champ encadré dès qu'il porte un séparateur, un guillemet ou un saut de ligne (RFC 4180). */
function echapper(champ: string): string {
  if (!/[";\r\n]/.test(champ)) return champ
  return `"${champ.replace(/"/g, '""')}"`
}

export function versCsv(lignes: readonly LigneCourses[]): string {
  const corps = lignes.map((l) =>
    [l.rayon, l.libelle, l.quantite, l.coche ? 'oui' : 'non', l.origine].map(echapper).join(SEPARATEUR)
  )
  // ⚠️ CRLF : c'est la fin de ligne que la RFC 4180 impose, et la seule que tous les tableurs lisent.
  return BOM + [ENTETES.join(SEPARATEUR), ...corps].join('\r\n') + '\r\n'
}

/**
 * Le JSON, versionné dès la v1 — même parti que `export-recette.ts` : un lecteur futur doit pouvoir
 * REFUSER une version qu'il ne connaît pas plutôt que d'en deviner les champs.
 *
 * ⚠️ Comme `export-recette.ts`, ceci EXPORTE et n'importe pas. Aucune fonction de lecture n'existe
 * côté application : le fichier produit est une sauvegarde et un pont vers un tableur, pas encore un
 * format d'échange.
 */
export function versJson(lignes: readonly LigneCourses[], periode: string): string {
  return JSON.stringify({ format: 'courses', version: 1, periode, articles: lignes }, null, 2)
}

/**
 * Déclenche le téléchargement d'un fichier fabriqué en mémoire.
 *
 * ⚠️ TROISIÈME COPIE ASSUMÉE. `export-recette.ts:65` et `sauvegarde.ts:204` portent la même dizaine
 * de lignes. Les factoriser demanderait de toucher la sauvegarde et la restauration, qui n'ont rien
 * à voir avec ce lot ; la duplication est signalée ici pour être vue plutôt que découverte.
 */
export function telecharger(contenu: string, fichier: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: typeMime })
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = fichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  URL.revokeObjectURL(url)
}

export const FICHIER_CSV = 'mes-courses.csv'
export const FICHIER_JSON = 'mes-courses.json'
/** `charset=utf-8` explicite : sans lui, la BOM reste le seul indice, et tous les lecteurs ne la suivent pas. */
export const MIME_CSV = 'text/csv;charset=utf-8'
export const MIME_JSON = 'application/json'
