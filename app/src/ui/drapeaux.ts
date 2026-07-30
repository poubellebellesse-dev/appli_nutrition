// ui/drapeaux.ts — drapeau du pays d'origine d'une recette, d'après la facette `cuisine`.
//
// ⚠️ DES EMOJIS, PAS DES IMAGES. §6.6 ARCHITECTURE promet zéro requête réseau après chargement, et
// embarquer 19 fichiers de drapeaux alourdirait le bundle pour une information décorative. Un emoji
// ne coûte rien et suit la taille du texte.
//
// ⚠️ WINDOWS NE REND PAS LES DRAPEAUX. Le système n'embarque pas ces glyphes : le navigateur y
// affiche les deux lettres du pays (« FR », « IT ») au lieu du drapeau. C'est lisible, pas cassé, et
// la cible du produit est le téléphone — iOS et Android les rendent correctement. À savoir avant de
// conclure à un bug en testant sur un PC.
//
// ⚠️ SEULES LES CUISINES QUI DÉSIGNENT UN PAYS EN ONT UN. Sur les 26 valeurs du catalogue, 7 sont
// des zones ou des ensembles — méditerranéenne (20 recettes !), asiatique, maghrébine,
// internationale, scandinave, africaine, tex-mex. Leur attribuer un drapeau demanderait de CHOISIR
// un pays à leur place : le Maghreb n'est pas le Maroc, la Méditerranée n'est pas la Grèce. Elles
// n'en reçoivent aucun, ce qui est une information juste plutôt qu'une approximation crédible.

/**
 * Cuisine → drapeau.
 *
 * `provencale` et `bretonne` sont des cuisines RÉGIONALES françaises : le drapeau français est
 * exact, la région n'ayant pas d'existence étatique. Ce n'est pas le cas du Maghreb ou de la
 * Scandinavie, qui recouvrent plusieurs pays — d'où leur absence.
 */
const DRAPEAU_PAR_CUISINE: Readonly<Record<string, string>> = {
  francaise: '🇫🇷',
  provencale: '🇫🇷',
  bretonne: '🇫🇷',
  italienne: '🇮🇹',
  indienne: '🇮🇳',
  grecque: '🇬🇷',
  libanaise: '🇱🇧',
  chinoise: '🇨🇳',
  britannique: '🇬🇧',
  turque: '🇹🇷',
  suisse: '🇨🇭',
  japonaise: '🇯🇵',
  espagnole: '🇪🇸',
  vietnamienne: '🇻🇳',
  thai: '🇹🇭',
  portugaise: '🇵🇹',
  mexicaine: '🇲🇽',
  hongroise: '🇭🇺',
  belge: '🇧🇪',
}

/** Libellé lisible d'une cuisine — `tex_mex` s'écrit mal tel quel. */
const LIBELLE_CUISINE: Readonly<Record<string, string>> = {
  tex_mex: 'tex-mex',
  thai: 'thaïe',
}

export interface OrigineAffichee {
  /** Drapeau, ou `null` quand la cuisine ne désigne pas un pays. */
  readonly drapeau: string | null
  readonly libelle: string
}

/**
 * ⚠️ Le libellé accompagne TOUJOURS le drapeau, jamais l'inverse. Le bloc commun des maquettes est
 * explicite — « chaque icône est TOUJOURS accompagnée de son libellé texte » — et un drapeau seul
 * est illisible pour qui ne le reconnaît pas, invisible sur Windows, et muet pour un lecteur
 * d'écran.
 */
export function origineDeCuisine(cuisine: string): OrigineAffichee {
  return {
    drapeau: DRAPEAU_PAR_CUISINE[cuisine] ?? null,
    libelle: LIBELLE_CUISINE[cuisine] ?? cuisine,
  }
}
