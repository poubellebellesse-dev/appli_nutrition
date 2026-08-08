// ui/quantites.ts — mise à l'échelle des quantités POUR L'AFFICHAGE.
//
// ⚠️ POURQUOI CE FICHIER EST DANS ui/ ET PAS DANS engine/. `scale-recipe.ts` refuse explicitement de
// toucher à `uniteAffichage` : « le mettre à l'échelle demanderait de réécrire du français, ce
// qu'aucune règle ne sait faire ». Le moteur a raison de refuser — sa sortie est de la DONNÉE, elle
// doit rester exacte, et un « 1,5 pincée » calculé aurait l'air juste sans l'être.
//
// Mais la conséquence, côté écran, était pire : tout finissait en grammes. « 4 artichauts » devenait
// « 2,4 kg », « 2 cuillères à soupe » devenait « 28 g », « 20 cl de crème » devenait « 206 g », et
// le sel s'affichait à « 8 g » — que personne ne mesure.
//
// D'où la règle retenue : on ne réécrit RIEN, on multiplie le NOMBRE DE TÊTE et on laisse le reste
// du libellé verbatim. Le libellé porte déjà la bonne unité (pièces, cuillères, cl, kg) — c'est
// précisément l'information que la conversion en grammes détruisait. La seule liberté prise est
// l'accord du nom compté, et une erreur d'accord est COSMÉTIQUE, là où une quantité fausse ne l'est
// pas. Le nombre, lui, est toujours juste.
//
// Le catalogue n'a NI densité NI marqueur de liquide (vérifié : 199 aliments, aucun des deux) : les
// centilitres ne sont donc pas dérivables. Ils ne le sont pas non plus par ce fichier — ils sont
// simplement CONSERVÉS depuis le libellé, ce qui suffit.

/**
 * Unités de mesure, avec leur précision d'affichage.
 *
 * ⚠️ UNE MESURE NE SE FRACTIONNE PAS. « 18 ¾ g de beurre » n'a aucun sens en cuisine : on pèse 19 g.
 * Les fractions sont réservées à ce qui se COMPTE (un demi-citron, trois quarts de pomme). C'est la
 * distinction que la première version ratait, et elle produisait des quantités illisibles.
 *
 * `decimales: 0` → entier ; `1` → un chiffre après la virgule (2,4 kg).
 */
const UNITES_DE_MESURE: Readonly<Record<string, { readonly decimales: 0 | 1 }>> = {
  g: { decimales: 0 },
  mg: { decimales: 0 },
  ml: { decimales: 0 },
  cl: { decimales: 0 },
  kg: { decimales: 1 },
  l: { decimales: 1 },
  dl: { decimales: 1 },
}

/** Unités qui ne prennent jamais la marque du pluriel. */
const UNITES_INVARIABLES = new Set([...Object.keys(UNITES_DE_MESURE), 'cs', 'cc', 'càs', 'càc', 'c.'])

/**
 * Au-delà de ce nombre de cuillères, on bascule en centilitres.
 *
 * Compter neuf cuillères à soupe est une corvée et une source d'erreur ; 9 cl se lisent sur
 * n'importe quel verre doseur. En dessous du seuil, la cuillère reste la mesure la plus pratique —
 * personne ne sort un doseur pour 1,5 cl.
 */
const SEUIL_CUILLERES = 4

/** Contenances usuelles françaises, en millilitres. */
const ML_PAR_CUILLERE = { soupe: 15, cafe: 5 } as const

/** « cuillères à soupe », « c. à café », au singulier comme au pluriel. */
const CUILLERE = /^\s*(?:cuill[eè]res?|c\.?)\s*[àa]\s*(soupe|caf[ée]s?)/i

/** Fractions courantes en cuisine, rendues en caractère plutôt qu'en décimal. */
const FRACTIONS: Readonly<Record<string, string>> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
}

/**
 * Nombre de tête : entier, décimal (virgule ou point), ou fraction `1/2`.
 *
 * Ancré au début : on ne cherche PAS un nombre au milieu du texte. « Poulet 220 g » ne doit pas voir
 * son 220 multiplié comme s'il était la quantité — dans un libellé, la quantité est en tête ou n'y
 * est pas.
 */
const NOMBRE_DE_TETE = /^\s*(\d+)\s*\/\s*(\d+)|^\s*(\d+(?:[.,]\d+)?)/

interface NombreTrouve {
  readonly valeur: number
  readonly longueur: number
}

function lireNombreDeTete(libelle: string): NombreTrouve | null {
  const trouve = NOMBRE_DE_TETE.exec(libelle)
  if (trouve === null) return null

  const [entier, numerateur, denominateur, decimal] = [
    trouve[0],
    trouve[1],
    trouve[2],
    trouve[3],
  ]
  if (numerateur !== undefined && denominateur !== undefined) {
    const bas = Number(denominateur)
    if (bas === 0) return null
    return { valeur: Number(numerateur) / bas, longueur: entier.length }
  }
  if (decimal === undefined) return null
  return { valeur: Number(decimal.replace(',', '.')), longueur: entier.length }
}

/** Nombre → texte français : virgule décimale, deux décimales au plus, fractions courantes. */
function formaterNombre(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100
  const fraction = FRACTIONS[String(arrondi % 1)]
  if (fraction !== undefined) {
    const entier = Math.floor(arrondi)
    return entier === 0 ? fraction : `${entier} ${fraction}`
  }
  return Number.isInteger(arrondi) ? String(arrondi) : String(arrondi).replace('.', ',')
}

/** Le mot qui suit le nombre, en minuscules, ou `''`. */
function motSuivant(reste: string): string {
  return (/^\s*([\p{L}.]+)/u.exec(reste)?.[1] ?? '').toLowerCase()
}

/** Formate une valeur exprimée dans une unité de MESURE — jamais de fraction, arrondi au plus près. */
function formaterMesure(valeur: number, decimales: 0 | 1): string {
  if (decimales === 0) {
    // Plancher à 1 : « 0 g de beurre » ferait croire qu'il n'en faut pas.
    return String(Math.max(1, Math.round(valeur)))
  }
  const arrondi = Math.round(valeur * 10) / 10
  return String(arrondi).replace('.', ',')
}

/**
 * Accorde le premier mot après le nombre — le nom compté, en français.
 *
 * ⚠️ VOLONTAIREMENT NAÏF, et borné à ce mot-là. « 2 cuillères à soupe » : seul « cuillères » porte
 * la marque. Les unités abrégées (`g`, `cl`) n'en prennent jamais. Les mots déjà terminés par s, x
 * ou z sont laissés tels quels. On ne cherche pas à traiter les pluriels irréguliers : un mot mal
 * accordé se voit et ne trompe personne sur la quantité.
 */
function accorder(reste: string, valeur: number): string {
  const trouve = /^(\s*)([\p{L}.]+)/u.exec(reste)
  if (trouve === null) return reste
  const [tout, espace, mot] = [trouve[0], trouve[1] ?? '', trouve[2] ?? '']
  if (UNITES_INVARIABLES.has(mot.toLowerCase())) return reste

  const pluriel = valeur >= 2
  const finitParS = /[sxz]$/i.test(mot)
  if (pluriel === finitParS) return reste

  const accorde = pluriel ? `${mot}s` : mot.slice(0, -1)
  return `${espace}${accorde}${reste.slice(tout.length)}`
}

export interface QuantiteAffichee {
  readonly texte: string
  /**
   * `true` quand la quantité n'a PAS suivi les portions — cas du fond de placard. L'écran doit le
   * dire discrètement, sinon l'utilisateur croit à un bug (c'est exactement ce qui vient d'être
   * signalé sur les grammes).
   */
  readonly fige: boolean
}

export interface OptionsQuantite {
  /** Libellé d'origine, écrit à la main dans le YAML : « 4 artichauts », « 20 cl de crème ». */
  readonly libelle: string
  /** Portions demandées / portions de la recette. */
  readonly facteur: number
  /** `Food.quantiteFigee` — sel, poivre, épices : le libellé ne suit pas les portions. */
  readonly quantiteFigee: boolean
  /** Repli quand le libellé ne commence par aucun nombre. Déjà mis à l'échelle par `scaleRecipe`. */
  readonly grammes: number
}

/**
 * Quantité à afficher pour un ingrédient, au nombre de portions demandé.
 *
 * Trois cas, dans cet ordre :
 *   1. **Quantité figée** — sel, poivre, épices : le libellé est FIGÉ. Le moteur applique bien une
 *      règle de trois (choix assumé de `scale-recipe.ts`), mais l'afficher serait absurde : « qui
 *      mesure 8 g de sel ? ». L'en-tête de `scale-recipe.ts` dit lui-même que le sel ne double pas.
 *   2. **Nombre de tête** — on le multiplie, on garde le reste du libellé tel quel. Couvre les
 *      pièces, les cuillères, les centilitres et les kilos d'un seul mécanisme.
 *   3. **Sinon** — grammes ou kilos. Repli honnête pour un libellé sans quantité en tête.
 */
export function quantiteAffichee(options: OptionsQuantite): QuantiteAffichee {
  const { libelle, facteur, quantiteFigee, grammes } = options

  if (quantiteFigee) return { texte: libelle, fige: facteur !== 1 }
  // Au facteur 1, le libellé d'origine est exact ET mieux écrit que tout ce qu'on produirait.
  if (facteur === 1) return { texte: libelle, fige: false }

  const nombre = lireNombreDeTete(libelle)
  if (nombre === null) return { texte: formaterMasse(grammes), fige: false }

  const valeur = nombre.valeur * facteur
  const reste = libelle.slice(nombre.longueur)

  // 1. Trop de cuillères — on passe au verre doseur.
  const cuillere = CUILLERE.exec(reste)
  if (cuillere !== null && valeur > SEUIL_CUILLERES) {
    const ml = /caf/i.test(cuillere[1] ?? '') ? ML_PAR_CUILLERE.cafe : ML_PAR_CUILLERE.soupe
    const suite = reste.slice(cuillere[0].length)
    return { texte: `${formaterMesure((valeur * ml) / 10, 0)} cl${suite}`, fige: false }
  }

  // 2. Unité de mesure — pas de fraction, on arrondit.
  const mesure = UNITES_DE_MESURE[motSuivant(reste)]
  if (mesure !== undefined) {
    return { texte: `${formaterMesure(valeur, mesure.decimales)}${reste}`, fige: false }
  }

  // 3. Ce qui se COMPTE — arrondi au quart, jamais moins d'un quart.
  //
  // ⚠️ « 0,13 citron » ne veut rien dire et n'est pas actionnable. Le quart est la plus petite
  // fraction qu'on manipule vraiment en cuisine ; en dessous, on prend un quart. Arrondir vers le
  // haut est sans risque ici — un peu trop de citron n'a jamais gâché un plat, et le contraire
  // (« 0 citron ») supprimerait un ingrédient de la recette.
  const arrondi = Math.max(0.25, Math.round(valeur * 4) / 4)
  return { texte: `${formaterNombre(arrondi)}${accorder(reste, arrondi)}`, fige: false }
}

/**
 * Grammes → texte. Repli seulement.
 *
 * ⚠️ AUCUNE conversion en pièces ici, alors que `Food.poidsPieceG` la permettrait :
 * `shopping-list.ts` sait déjà le faire, avec un arrondi d'ACHAT (on achète un légume entier) qui
 * n'est pas celui de la cuisine. Deux implémentations divergeraient. Le jour où ce repli doit rendre
 * des pièces, il faut EXTRAIRE la conversion du domaine et l'appeler des deux côtés.
 */
export function formaterMasse(grammes: number): string {
  if (grammes >= 1000) {
    const kilos = Math.round(grammes / 100) / 10
    return `${String(kilos).replace('.', ',')} kg`
  }
  // Un dixième de gramme n'a aucun sens en cuisine — l'arrondi évite « 83,3 g ».
  return `${Math.round(grammes)} g`
}

/**
 * Une quantité de la LISTE DE COURSES, telle qu'elle se lit dans un rayon (décision 41).
 *
 * ⚠️ CE N'EST PAS UNE CONVERSION, et la distinction décide de où vit ce code. `buildShoppingList`
 * a DÉJÀ converti (`quantiteAffichee`, §7.4 ENGINE) : il rend un nombre de pièces ou une masse
 * arrondie au conditionnement. Ici on ne recalcule rien — on NOMME ce que le moteur a décidé. C'est
 * la répartition posée par la décision 40 : « le moteur donne la quantité, pas sa formulation ».
 * La réserve de `formaterMasse` ci-dessus — « extraire la conversion du domaine avant de rendre des
 * pièces » — ne s'applique donc PAS : rien n'est converti deux fois.
 *
 * Trois corrections, toutes mesurées sur le catalogue du 2026-08-06 :
 *
 *  1. **L'accord** — l'écran concaténait `${quantiteTotale} ${unite}` et affichait « 3 pièce ».
 *     88 aliments sur 450 portent `poidsPieceG`, donc sortent en pièces.
 *  2. **Le kilo** — la farine s'affichait « 1000 g ». `formaterMasse` existait et n'était appelée
 *     de nulle part.
 *  3. **Le nombre de paquets** — « 500 g » de beurre ne disait pas que c'étaient DEUX plaquettes
 *     de 250. 228 aliments sont conditionnés.
 *
 * ⚠️ « 2 × 250 g » ET NON « 2 plaquettes » : le catalogue porte un NOMBRE (`conditionnementG`) et
 * aucun nom d'emballage. Écrire « 2 paquets » pour 1,5 kg d'huile d'olive serait faux, et inventer
 * le mot par aliment serait un lot de contenu sur 228 entrées. La multiplication est vraie pour une
 * plaquette, une brique et une bouteille à la fois.
 *
 * ⚠️ AFFICHÉ SEULEMENT À PARTIR DE DEUX. « 1 × 250 g » répète la ligne sans rien apprendre.
 */
export function formaterQuantiteAchat(
  quantiteTotale: number,
  unite: string,
  conditionnementG: number | null
): string {
  // Tout ce qui se COMPTE : le nombre, puis le nom compté accordé. `accorder` est déjà la règle de
  // ce fichier pour les libellés de recette — une seconde règle d'accord divergerait.
  if (unite !== 'g') {
    return `${formaterNombre(quantiteTotale)}${accorder(` ${unite}`, quantiteTotale)}`
  }

  const masse = formaterMasse(quantiteTotale)
  if (conditionnementG === null || conditionnementG <= 0) return masse

  // `quantiteTotale` est un multiple exact du conditionnement (`arrondiAchat`) : l'arrondi ne
  // corrige rien ici, il protège d'un flottant qui rendrait « 1,9999 ».
  const paquets = Math.round(quantiteTotale / conditionnementG)
  if (paquets < 2) return masse
  return `${masse} (${paquets} × ${formaterMasse(conditionnementG)})`
}
