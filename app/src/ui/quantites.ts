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

/** Unités qui ne prennent jamais la marque du pluriel. */
const UNITES_INVARIABLES = new Set([
  'g',
  'kg',
  'mg',
  'l',
  'dl',
  'cl',
  'ml',
  'cs',
  'cc',
  'càs',
  'càc',
  'c.',
])

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
  /** `Food.fondDePlacard` — sel, poivre, épices. */
  readonly fondDePlacard: boolean
  /** Repli quand le libellé ne commence par aucun nombre. Déjà mis à l'échelle par `scaleRecipe`. */
  readonly grammes: number
}

/**
 * Quantité à afficher pour un ingrédient, au nombre de portions demandé.
 *
 * Trois cas, dans cet ordre :
 *   1. **Fond de placard** — sel, poivre, épices : le libellé est FIGÉ. Le moteur applique bien une
 *      règle de trois (choix assumé de `scale-recipe.ts`), mais l'afficher serait absurde : « qui
 *      mesure 8 g de sel ? ». L'en-tête de `scale-recipe.ts` dit lui-même que le sel ne double pas.
 *   2. **Nombre de tête** — on le multiplie, on garde le reste du libellé tel quel. Couvre les
 *      pièces, les cuillères, les centilitres et les kilos d'un seul mécanisme.
 *   3. **Sinon** — grammes ou kilos. Repli honnête pour un libellé sans quantité en tête.
 */
export function quantiteAffichee(options: OptionsQuantite): QuantiteAffichee {
  const { libelle, facteur, fondDePlacard, grammes } = options

  if (fondDePlacard) return { texte: libelle, fige: facteur !== 1 }
  // Au facteur 1, le libellé d'origine est exact ET mieux écrit que tout ce qu'on produirait.
  if (facteur === 1) return { texte: libelle, fige: false }

  const nombre = lireNombreDeTete(libelle)
  if (nombre === null) return { texte: formaterMasse(grammes), fige: false }

  const valeur = nombre.valeur * facteur
  const reste = libelle.slice(nombre.longueur)
  return { texte: `${formaterNombre(valeur)}${accorder(reste, valeur)}`, fige: false }
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
