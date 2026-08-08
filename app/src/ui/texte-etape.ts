// ui/texte-etape.ts — injecter la quantité DANS la phrase de l'étape.
//
// « Émincer l'oignon » → « Émincer 1 gros oignon ». « Faire fondre le beurre » → « Faire fondre
// 50 g de beurre ». Le nombre suit le sélecteur de portions, parce qu'il vient de
// `quantiteAffichee` et de nulle part ailleurs.
//
// ---------------------------------------------------------------------------------------------
// CE MODULE NE DÉCIDE PAS QUEL INGRÉDIENT UNE ÉTAPE EMPLOIE. IL NE CHERCHE QUE L'ENDROIT.
//
// C'est la seule raison pour laquelle il a le droit d'exister à côté de
// `catalog/lien-etape-ingredient.mjs`, qui porte le même vocabulaire (normalisation, formes,
// pluriel) et dont l'en-tête interdit explicitement une seconde copie. La copie interdite est
// celle du VERDICT — « cette étape emploie-t-elle l'oignon ? ». Ce verdict est rendu une seule
// fois, au build, et arrive ici tout cuit dans `RecipeStep.foodIds` : ce fichier ne le rediscute
// jamais, il ne reçoit que des ingrédients déjà retenus.
//
// Ce qu'il fait en plus, le build ne peut pas le donner : `rapprocherEtape` travaille sur un
// tableau de mots normalisés, où les positions dans le texte d'origine sont perdues. Or pour
// remplacer « l'oignon » il faut ses indices de caractères, accents et apostrophe compris.
//
// ⚠️ LA DIVERGENCE EST DONC SANS CONSÉQUENCE, ET C'EST VOULU. Si ce localisateur échoue là où le
// build avait trouvé, il ne se passe RIEN : aucun segment n'est injecté, `QuantitesDeLEtape` garde
// l'ingrédient dans sa ligne de badges, et l'utilisateur voit la quantité comme avant. L'inverse
// (localiser un mot que le build n'a pas retenu) est structurellement impossible : on ne cherche
// que dans la liste qu'il fournit. Le pire cas est une occasion manquée, jamais une erreur.
//
// ---------------------------------------------------------------------------------------------
// POURQUOI LE LIBELLÉ ET JAMAIS LE GRAMME
//
// Mesure sur les 2 158 lignes d'ingrédient des 305 recettes : 42,2 % comptent en pièces
// (« 2 poivrons rouges »), 23,6 % en cuillères, 19,1 % en masse ou volume (« 180 g », « 20 cl »),
// 15,1 % sans nombre du tout (« au goût », « quelques brins »).
//
// Injecter le gramme brut partout retomberait exactement dans le défaut que l'en-tête de
// `quantites.ts` documente : « 4 artichauts » devient « 2,4 kg », « 2 cuillères » devient « 28 g ».
// Le libellé écrit à la main porte DÉJÀ la bonne unité de cuisine — c'est l'information que la
// conversion détruisait. On l'injecte tel quel, mis à l'échelle, et rien d'autre.

/** Un ingrédient que le build a rattaché à l'étape, prêt à être posé dans la phrase. */
export interface IngredientDeLEtape {
  readonly foodId: string
  /**
   * Les noms sous lesquels la phrase peut le désigner : `Food.nom` coupé à la première virgule,
   * plus `Food.synonymes`, plus l'identifiant. Même matière que `formesDe` côté build.
   */
  readonly formes: readonly string[]
  /** Quantité DÉJÀ mise à l'échelle des portions — sortie de `quantiteAffichee`, jamais recalculée. */
  readonly quantite: string
}

/**
 * Les formes d'un aliment du catalogue, dans l'ordre où on veut les essayer.
 *
 * ⚠️ EN UN SEUL EXEMPLAIRE ICI PLUTÔT QU'À CHAQUE ÉCRAN. Les deux appelants (fiche recette et mode
 * cuisine) auraient écrit la même ligne, et c'est exactement le motif de trois tables jumelles que
 * `7040c33` a dû réunir — dont une avait déjà divergé.
 *
 * L'identifiant vient en dernier et sert de filet : `poivron_rouge` → « poivron rouge » rattrape
 * les aliments dont le nom CIQUAL ne ressemble pas au mot de cuisine.
 */
export function formesDeLAliment(
  aliment: { readonly nom: string; readonly synonymes: readonly string[] } | undefined,
  foodId: string
): readonly string[] {
  const identifiant = foodId.replace(/_/g, ' ')
  if (aliment === undefined) return [identifiant]
  return [aliment.nom, ...aliment.synonymes, identifiant]
}

export type SegmentEtape =
  /** Texte de la recette, inchangé. */
  | { readonly type: 'texte'; readonly contenu: string }
  /** Quantité injectée, à mettre en valeur. Porte son `foodId` pour le test et l'accessibilité. */
  | { readonly type: 'quantite'; readonly contenu: string; readonly foodId: string }

export interface EtapeInjectee {
  readonly segments: readonly SegmentEtape[]
  /**
   * Les ingrédients réellement posés dans la phrase. L'appelant retire ceux-là de la ligne de
   * badges — et SEULEMENT ceux-là, pour que l'union des deux reste égale à `foodIds`.
   */
  readonly injectes: ReadonlySet<string>
}

/**
 * Déterminants que la quantité REMPLACE purement et simplement : « l'oignon » → « 1 gros oignon ».
 *
 * ⚠️ `de` ET `d'` NUS EN SONT ABSENTS, et c'est le garde-fou principal. Derrière un NOM ils
 * introduisent un complément — « le jus **de** citron », « des morceaux **de** chocolat », « un
 * filet **d'**huile » — où la phrase porte souvent déjà sa propre mesure. Y remplacer poserait un
 * second nombre qui contredit le premier. Ils ne passent que derrière un infinitif (`PARTITIFS`).
 */
const DETERMINANTS = new Set(['le', 'la', 'l', 'les', 'un', 'une'])

/**
 * Les déterminants qui ne se remplacent pas mais s'ACCORDENT — le second cas de la règle.
 *
 * « Casser la queue **des** artichauts » ne peut pas devenir « la queue 4 artichauts » : le groupe
 * appartient à « la queue », pas au verbe. Mais il devient très bien « la queue **des 4**
 * artichauts ». Le déterminant reste, la quantité se glisse derrière, et la forme du déterminant
 * suit le NOMBRE de la quantité :
 *
 *   le reste **du** beurre        + « 50 g »          → le reste **des 50 g de** beurre
 *   la moitié **de l'**oignon     + « 1 gros oignon » → la moitié **d'1 gros** oignon
 *   Fendre **chaque** banane      + « 4 bananes »     → Fendre **les 4** bananes
 *   la crème **aux** poireaux     + « 2 poireaux »    → la crème **aux 2** poireaux
 *
 * ⚠️ LE SENS EST PRÉSERVÉ, ET C'EST CE QUI REND L'ACCORD LÉGITIME LÀ OÙ LE REMPLACEMENT NE L'EST
 * PAS. « Le reste des 50 g de beurre » ne dit pas qu'on met 50 g : il dit le reste DE ces 50 g.
 * Remplacer aurait affirmé la totalité — le seul type d'erreur qui compte ici, puisqu'un nombre
 * faux se suit alors qu'une phrase bancale se voit.
 */
const CONTRACTES = new Set(['des', 'aux'])
const PARTIELS = new Set(['du'])
/** `de la`, `de l'` — deux jetons, à reconnaître comme un seul déterminant. */
const PARTIELS_EN_DEUX = new Set(['la', 'l', 'le'])

/**
 * Mots après lesquels le groupe appartient au VERBE, donc se remplace au lieu de s'accorder.
 *
 * « Servir avec **du** pain » → « Servir avec ½ pain », et non « avec de ½ pain ». C'est le même
 * partage que pour `PARTITIFS` : ce qui précède décide si l'on est dans un complément d'objet
 * (remplaçable) ou dans un complément de nom (accordable seulement).
 */
const OUVREURS = new Set(['avec', 'dans', 'sur', 'sous', 'pour', 'par', 'en'])

/**
 * Tout ce qui, placé devant un mot, en fait un NOM et non un verbe. Sert à démasquer les faux
 * infinitifs — « la chair », « le reste », « les quartiers ». Voir `ouvertPar`.
 */
const ARTICLES = new Set([
  'le', 'la', 'l', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux',
  'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'chaque', 'quelques',
])

/**
 * Mots qui, JUSTE AVANT le déterminant, signalent eux aussi un complément de nom.
 *
 * « à base **de** la crème », « le jus **de** l'orange » : le déterminant est bien dans la liste
 * ci-dessus, mais il n'ouvre pas le groupe verbal. Sans ce second garde-fou, le premier se contourne.
 */
const AVANT_INTERDIT = new Set(['de', 'd', 'a', 'au', 'aux'])

/**
 * Le `de` / `d'` nu, qui derrière un infinitif se GARDE et accueille la quantité.
 *
 * ⚠️ IL A D'ABORD ÉTÉ SUPPRIMÉ, ET C'ÉTAIT FAUX SUR 85 PHRASES. Le raisonnement de départ — « le
 * `de` suit le verbe, donc il ouvre un complément d'objet remplaçable » — confond deux `de`. Celui
 * de « Verser **de la** crème » porte un article et s'efface avec lui ; celui de « Arroser
 * **d'**huile » n'en a pas : il est RÉGI PAR LE VERBE. Le retirer retourne la phrase —
 * « Arroser 3 c. à soupe d'huile » dit qu'on arrose l'huile — et fait tomber la coordination qui
 * suit : « arroser d'huile et de citron » → « arroser 3 c. à soupe d'huile et de citron ».
 * Concernait `arroser` (25), `parsemer` (37), `saupoudrer` (16), `napper` (7).
 *
 * Il se garde donc, accordé : « Arroser **de** 3 cuillères à soupe d'huile ». Et comme il ne porte
 * aucun article, **il ne se contracte jamais en `des`** — c'est ce qui le sépare de `du` / `de la`,
 * qui eux donnent « le reste **des** 50 g de beurre ». Derrière un NOM, il reste intouchable :
 * « le jus **de** citron », « un filet **d'**huile ».
 */
const PARTITIFS = new Set(['de', 'd'])

/** Forme verbale des recettes. Même règle que `estInfinitif` de `lien-etape-ingredient.mjs`. */
function estInfinitif(mot: string): boolean {
  return /(er|ir|re)$/.test(mot) && mot.length > 3
}

/** Mots vides des noms CIQUAL — mêmes que `formesDe` côté build, même raison. */
const VIDES = new Set([
  // ⚠️ `d` (le « de » élidé) est un jeton À PART ENTIÈRE — l'oublier laissait « jaune d'œuf » ne
  // s'apparier que sur « jaune », et la phrase rendait « 4 jaunes d'œufs d'œufs ».
  'de', 'd', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'a', 'en', 'et', 'ou', 'un', 'une',
  'cru', 'crue', 'cuit', 'cuite', 'nature', 'entier', 'entiere', 'frais', 'fraiche', 'sec', 'seche',
])

/**
 * Le libellé porte-t-il une quantité chiffrée ? Même ancrage en tête que `quantites.ts` : dans un
 * libellé, la quantité est au début ou n'y est pas.
 *
 * ⚠️ CE QUI N'EN PORTE PAS N'EST PAS INJECTÉ. « au goût », « quelques brins », « une petite
 * poignée » : 15,1 % des lignes. « Saler avec au goût de sel » ne se dit pas, et le repli en
 * grammes de `quantiteAffichee` rendrait « 8 g de sel » — le nombre que personne ne mesure.
 */
const COMMENCE_PAR_UN_NOMBRE = /^\s*(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/

/**
 * Mots à `h` MUET rencontrés dans le catalogue — ils prennent l'élision, les autres non.
 *
 * « 1 filet **d'**huile » mais « 200 g **de** haricots ». Liste courte et explicite : deviner
 * l'aspiration produirait « d'haricots », faute que tout le monde voit.
 */
const H_MUET = ['huil', 'huit', 'herb', 'hui']

const VOYELLES = new Set(['a', 'e', 'i', 'o', 'u', 'y'])

/** Minuscules, sans accents. Copie assumée de `normaliser` du build — voir l'en-tête. */
function normaliserMot(mot: string): string {
  return mot
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}

/** Tolérance au pluriel des deux côtés, et rien de plus. Même règle que `memeMot` du build. */
function memeMot(a: string, b: string): boolean {
  if (a === b) return true
  const sansPluriel = (m: string) => m.replace(/(s|x)$/, '')
  return sansPluriel(a) === sansPluriel(b) && sansPluriel(a).length > 2
}

interface Jeton {
  /** Le mot normalisé, pour comparer. */
  readonly mot: string
  /** Indices dans le texte D'ORIGINE — accents, majuscules et apostrophe compris. */
  readonly debut: number
  readonly fin: number
}

/**
 * Découpe le texte en mots en gardant leurs positions d'origine.
 *
 * L'apostrophe sépare : « l'oignon » rend deux jetons, `l` et `oignon`. C'est ce qui permet de
 * reconnaître le déterminant élidé et de l'emporter dans la substitution.
 */
function jetonner(texte: string): readonly Jeton[] {
  const jetons: Jeton[] = []
  const motif = /[\p{L}\p{N}]+/gu
  let trouve: RegExpExecArray | null
  while ((trouve = motif.exec(texte)) !== null) {
    jetons.push({
      mot: normaliserMot(trouve[0]),
      debut: trouve.index,
      fin: trouve.index + trouve[0].length,
    })
  }
  return jetons
}

/** Les formes d'un ingrédient, en mots normalisés, les plus longues d'abord. */
function formesEnMots(formes: readonly string[]): readonly (readonly string[])[] {
  const sorties: string[][] = []
  for (const brute of formes) {
    const mots = brute
      .split(',')[0]!
      .split(/[\s'’_-]+/)
      .map(normaliserMot)
      .filter((m) => m.length > 1 && !VIDES.has(m))
    if (mots.length > 0) sorties.push(mots)
  }
  return sorties.sort((a, b) => b.length - a.length)
}

/**
 * Les mots du libellé, une fois son nombre de tête retiré : « 2 poivrons rouges » → poivron, rouge.
 *
 * ⚠️ MÊME SÉPARATEUR QUE `formesEnMots`, TRAIT D'UNION COMPRIS. Les deux tables se comparent mot à
 * mot : dès que l'une découpe « chou-fleur » en deux et l'autre non, l'aliment ne peut plus se
 * reconnaître dans son propre libellé, et le rendu recolle son nom derrière lui — « Détailler
 * 1 chou-fleur DE CHOU-FLEUR en bouquets ». Huit étapes du catalogue s'affichaient ainsi.
 */
function motsDuLibelle(quantite: string): readonly string[] {
  return quantite
    .replace(COMMENCE_PAR_UN_NOMBRE, '')
    .split(/[\s'’_-]+/)
    .map(normaliserMot)
    .filter((m) => m.length > 1)
}

/** Le libellé nomme-t-il déjà l'ingrédient ? « 2 poivrons rouges » oui, « 50 g » non. */
function libelleNommeLAliment(
  quantite: string,
  formes: readonly (readonly string[])[]
): boolean {
  return motsDuLibelle(quantite).some((m) =>
    formes.some((forme) => forme.some((f) => memeMot(m, f)))
  )
}

/**
 * Le libellé n'apporte-t-il RIEN de plus que le mot déjà écrit dans la phrase ?
 *
 * ⚠️ CE TEST N'EXISTE QUE POUR L'ACCORD, jamais pour le remplacement, et la différence se voit à
 * l'œil :
 *
 *   « Émincer l'oignon » + « 1 oignon »            → « Émincer 1 oignon »            on gagne le compte
 *   « la chair de la courge » + « 1 courge spaghetti » → « de 1 courge spaghetti »   on n'a rien gagné
 *
 * Dans le premier cas la quantité REMPLACE l'article et le nombre est l'information. Dans le
 * second elle s'ajoute à un déterminant qui reste, et « 1 » devant un nom déjà singulier alourdit
 * la phrase sans rien dire. Le critère est donc : un seul exemplaire, et pas un mot de plus que le
 * nom de l'aliment. « 1 GROS oignon » passe — « gros » n'est pas dans le nom.
 */
function libelleSansApport(quantite: string, formes: readonly (readonly string[])[]): boolean {
  const nombre = lireNombre(quantite)
  if (nombre === null || nombre >= 2) return false
  const mots = motsDuLibelle(quantite)
  return mots.length > 0 && mots.every((m) => formes.some((forme) => forme.some((f) => memeMot(m, f))))
}

/** La valeur du nombre de tête du libellé, ou `null`. Décide du singulier et du pluriel. */
function lireNombre(quantite: string): number | null {
  const trouve = COMMENCE_PAR_UN_NOMBRE.exec(quantite)
  if (trouve === null) return null
  const brut = trouve[0].trim()
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(brut)
  if (fraction !== null) {
    const bas = Number(fraction[2])
    return bas === 0 ? null : Number(fraction[1]) / bas
  }
  return Number(brut.replace(',', '.'))
}

/** « de » ou « d' » selon le mot qui suit. */
function liaison(motSuivant: string): string {
  const n = normaliserMot(motSuivant)
  if (VOYELLES.has(n[0] ?? '')) return "d'"
  if (n.startsWith('h')) return H_MUET.some((p) => n.startsWith(p)) ? "d'" : 'de '
  return 'de '
}

interface Occurrence {
  readonly debut: number
  readonly fin: number
  readonly foodId: string
  /**
   * Le déterminant accordé, qui reste du TEXTE ordinaire : « des », « les », « d' ». `''` quand la
   * quantité prend simplement la place de l'article.
   *
   * ⚠️ HORS DU SEGMENT MIS EN VALEUR, à dessein. Mettre « **des 4** artichauts » en gras ferait
   * ressortir un article ; ce qu'on cherche des yeux, les mains occupées, c'est le NOMBRE seul.
   */
  readonly prefixe: string
  readonly remplacement: string
  /** Ce qui suit la quantité et reste du texte de la recette : « de beurre ». `''` pour les pièces. */
  readonly suite: string
}

/**
 * La forme `essai` commence-t-elle en position `i` ? Rend l'indice du DERNIER jeton apparié, ou -1.
 *
 * ⚠️ LES MOTS VIDES INTERCALÉS SONT SAUTÉS, et c'est ce qui répare « pomme de terre ». `formesEnMots`
 * retire les mots vides du NOM CIQUAL (« Pomme de terre, crue » → pomme, terre), mais la phrase, elle,
 * les garde : « les pommes DE terre ». Sans ce saut, seul « pommes » s'appariait, la substitution
 * s'arrêtait là et la phrase rendait « 6 pommes de terre de terre ». Défaut antérieur à l'accord du
 * déterminant — il ne se voyait pas parce que la queue de phrase passait pour du texte ordinaire.
 */
function apparier(jetons: readonly Jeton[], i: number, essai: readonly string[]): number {
  let k = i
  for (let j = 0; j < essai.length; j++) {
    const attendu = essai[j]!
    while (j > 0 && k < jetons.length && VIDES.has(jetons[k]!.mot) && !memeMot(jetons[k]!.mot, attendu)) {
      k++
    }
    if (k >= jetons.length || !memeMot(jetons[k]!.mot, attendu)) return -1
    k++
  }
  return k - 1
}

/**
 * Mots de liaison qu'on saute POUR PROLONGER un nom composé — « pomme **de** terre », « jaune
 * **d'**œuf », « chou **de** Bruxelles ». Sous-ensemble strict de `VIDES`, et volontairement plus
 * court que lui : un ARTICLE (`le`, `les`, `des`…) ou une coordination (`et`) n'attache pas un mot
 * au nom qui précède, il en ouvre un nouveau.
 */
const LIAISONS = new Set(['de', 'd', 'du', 'au', 'aux', 'a'])

/**
 * Prolonge l'appariement sur les mots suivants qui appartiennent ENCORE au nom de l'aliment.
 *
 * ⚠️ SANS ÇA, LA QUEUE DU NOM SE RETROUVE EN DOUBLE. Quand la forme complète ne s'apparie pas,
 * `localiser` se rabat sur le mot de tête seul ; la substitution ne couvre alors que ce mot, et le
 * libellé — qui, lui, porte le nom entier — réécrit le reste :
 *
 *     « le chou chinois »    + « 1 demi-chou chinois » → « 1 demi-chou chinois **chinois** »
 *     « le filet mignon »    + « 1 filet mignon »      → « 1 filet mignon **mignon** »
 *     « les jaunes d'œufs »  + « 4 jaunes d'œufs »     → « 4 jaunes d'œufs **d'œufs** »
 *
 * Le repli sur le mot de tête reste nécessaire (le nom CIQUAL porte des mentions absentes de la
 * phrase — « Chou chinois (pak-choï) »), donc la réparation se fait ici, en aval : on avale les
 * mots suivants tant qu'ils sont dans le vocabulaire de CET aliment. « poivron rouge » n'est pas
 * concerné quand l'aliment est le poivron nu : `rouge` n'est dans aucune de ses formes.
 */
function etendre(
  texte: string,
  jetons: readonly Jeton[],
  dernier: number,
  motsDeLAliment: readonly string[]
): number {
  let fin = dernier
  let sautees = 0
  for (let j = dernier + 1; j < jetons.length; j++) {
    // ⚠️ UNE PONCTUATION FERME LE GROUPE NOMINAL, et l'oublier vole son nom au voisin :
    // « le concentré de tomate, les tomates concassées » — sans ce garde-fou, l'extension avalait
    // « les tomates », et l'ingrédient `tomate`, privé de sa place, perdait son injection.
    if (/\S/.test(texte.slice(jetons[j - 1]!.fin, jetons[j]!.debut))) break

    const mot = jetons[j]!.mot
    if (motsDeLAliment.some((m) => memeMot(mot, m))) {
      fin = j
      sautees = 0
      continue
    }
    // Deux liaisons d'affilée sans rien derrière : on est sorti du nom, pas au milieu.
    if (!LIAISONS.has(mot) || ++sautees > 2) break
  }
  return fin
}

/** Le groupe déterminant qui précède le nom, et ce qui le précède lui-même. */
interface GroupeDeterminant {
  /**
   * `remplace` = la quantité prend sa place ; les autres = il reste, accordé, et la quantité se
   * glisse après. `preposition` est le seul qui ne se contracte jamais : il n'a pas d'article.
   */
  readonly nature: 'remplace' | 'contracte' | 'partiel' | 'chaque' | 'preposition'
  /** Le mot tel qu'il est écrit, normalisé : `des`, `aux`, `du`, `chaque`… */
  readonly mot: string
  /** Indice de caractère du DÉBUT du groupe, `de la` compris. */
  readonly debut: number
  /** Le groupe appartient-il au verbe plutôt qu'à un nom ? Décide entre remplacer et accorder. */
  readonly ouvert: boolean
}

/**
 * Reconnaît le déterminant qui précède immédiatement le nom en position `i`.
 *
 * ⚠️ IL PEUT FAIRE DEUX JETONS. `de la crème`, `de l'oignon` s'écrivent en deux mots là où `du` et
 * `des` n'en font qu'un : les traiter séparément produisait « la moitié de la 1 courge » d'un côté
 * et rien de l'autre, pour la même construction française.
 */
function groupeDeterminant(jetons: readonly Jeton[], i: number): GroupeDeterminant | null {
  const d = jetons[i - 1]
  if (d === undefined) return null
  const avant1 = jetons[i - 2]
  const avant2 = jetons[i - 3]

  /**
   * Le groupe est-il ouvert par un VERBE (ou une préposition), et non par un nom ?
   *
   * ⚠️ `estInfinitif` NE SUFFIT PAS, ET LE CONTRE-EXEMPLE EST DANS LE CATALOGUE : « la **chair**
   * de la courge » — « chair » finit par `-ir`, la règle en faisait un verbe et remplaçait au lieu
   * d'accorder. Le même piège attend « beurre », « sucre », « poivre », « vinaigre », « litre »,
   * tous en `-re`, et « quartier », « papier », « saladier » en `-er`. Une liste d'exceptions
   * courrait après le vocabulaire sans jamais le rattraper.
   *
   * Le signal qui tient est syntaxique et non lexical : **un mot précédé d'un article est un nom.**
   * « la chair », « le reste », « les quartiers » sont des noms quoi qu'en dise leur terminaison ;
   * « Racler », « Parsemer » ouvrent la phrase sans article devant eux.
   */
  const ouvertPar = (rang: number): boolean => {
    const jeton = jetons[rang]
    if (jeton === undefined) return false
    if (OUVREURS.has(jeton.mot)) return true
    if (!estInfinitif(jeton.mot)) return false
    return !ARTICLES.has(jetons[rang - 1]?.mot ?? '')
  }

  // `de la` / `de l'` — deux jetons, un seul déterminant.
  if (avant1 !== undefined && PARTITIFS.has(avant1.mot) && PARTIELS_EN_DEUX.has(d.mot)) {
    return { nature: 'partiel', mot: `${avant1.mot} ${d.mot}`, debut: avant1.debut, ouvert: ouvertPar(i - 3) }
  }
  if (PARTIELS.has(d.mot)) {
    return { nature: 'partiel', mot: d.mot, debut: d.debut, ouvert: ouvertPar(i - 2) }
  }
  if (CONTRACTES.has(d.mot)) {
    return { nature: 'contracte', mot: d.mot, debut: d.debut, ouvert: ouvertPar(i - 2) }
  }
  if (d.mot === 'chaque') {
    // ⚠️ « la base ligneuse DE chaque asperge » : le `de` doit entrer dans le groupe, sinon
    // l'accord rend « de les 2 bottes ». `de` + pluriel se contracte en `des`, toujours.
    return avant1 !== undefined && PARTITIFS.has(avant1.mot)
      ? { nature: 'partiel', mot: `${avant1.mot} chaque`, debut: avant1.debut, ouvert: ouvertPar(i - 3) }
      : { nature: 'chaque', mot: d.mot, debut: d.debut, ouvert: false }
  }
  // Article franc : la quantité le remplace, sauf s'il ouvre lui-même un complément de nom.
  if (DETERMINANTS.has(d.mot)) {
    if (AVANT_INTERDIT.has(avant1?.mot ?? '')) return null
    return { nature: 'remplace', mot: d.mot, debut: d.debut, ouvert: true }
  }
  // `de` nu derrière un vrai verbe : il est régi par lui, donc il RESTE (« Arroser de 3 c. à soupe
  // d'huile »). Derrière un nom — « la chair de courge », « un filet d'huile » — on n'y touche pas.
  if (PARTITIFS.has(d.mot) && avant1 !== undefined && estInfinitif(avant1.mot) && !ARTICLES.has(avant2?.mot ?? '')) {
    return { nature: 'preposition', mot: d.mot, debut: d.debut, ouvert: false }
  }
  return null
}

/**
 * Ce qu'il faut écrire DEVANT la quantité, ou `null` pour ne pas injecter du tout.
 *
 * `''` = le déterminant disparaît, la quantité prend sa place. Sinon on rend le déterminant
 * accordé au nombre de la quantité, suivi d'une espace.
 */
function accorder(
  groupe: GroupeDeterminant,
  quantite: string,
  formes: readonly (readonly string[])[]
): string | null {
  if (groupe.nature === 'remplace') return ''

  // `de` nu régi par le verbe. AVANT le garde-fou `libelleSansApport` à dessein : ces occurrences
  // étaient toutes injectées quand la règle les remplaçait, garder le mot ne doit rien retirer.
  if (groupe.nature === 'preposition') return elider(quantite)

  // Un groupe ouvert par un verbe ou une préposition appartient au verbe : « Servir avec du pain »
  // → « avec ½ pain », pas « avec de ½ pain ».
  if (groupe.ouvert) return ''

  // À partir d'ici le groupe appartient à un NOM (« le reste du beurre »). Le déterminant reste, et
  // n'ajouter qu'un « 1 » devant un nom déjà singulier n'apprendrait rien — voir `libelleSansApport`.
  if (libelleSansApport(quantite, formes)) return null

  const pluriel = (lireNombre(quantite) ?? 1) >= 2

  if (groupe.nature === 'chaque') {
    // « Fendre chaque banane » → « Fendre les 4 bananes ». Au singulier, « chaque » dit déjà tout.
    return pluriel ? 'les ' : null
  }
  if (groupe.nature === 'contracte') {
    // `des` et `aux` sont déjà pluriels : ils ne s'accordent pas, ils accueillent.
    return pluriel ? `${groupe.mot} ` : null
  }
  // `du`, `de la`, `de l'` : c'est le nombre de la QUANTITÉ qui décide, pas celui du nom.
  //   « le reste du beurre »    + 50 g          → « le reste des 50 g de beurre »
  //   « la moitié de l'oignon » + 1 gros oignon → « la moitié d'1 gros oignon »
  if (pluriel) return 'des '
  return elider(quantite)
}

/** « de » ou « d' » devant la quantité : « d'1 gros oignon », « de 3 cuillères à soupe ». */
function elider(quantite: string): string {
  return /^[1aeiouyàâéèêîïôûü]/i.test(quantite.trim()) ? "d'" : 'de '
}

/**
 * Où, dans le texte, l'ingrédient est-il nommé avec un déterminant qu'on peut remplacer ?
 *
 * Rend `null` dès que l'un des garde-fous parle. C'est le cas NORMAL, pas un échec : une étape sur
 * six ne nomme aucun ingrédient, et les compléments de nom sont fréquents.
 */
function localiser(
  texte: string,
  jetons: readonly Jeton[],
  ingredient: IngredientDeLEtape
): Occurrence | null {
  if (!COMMENCE_PAR_UN_NOMBRE.test(ingredient.quantite)) return null

  const formes = formesEnMots(ingredient.formes)
  if (formes.length === 0) return null
  const vocabulaire = formes.flat()

  for (const forme of formes) {
    // Forme entière (« poivron rouge »), puis mot de tête seul (« les poivrons »). Le nom CIQUAL
    // met parfois le règne devant — « Veau, escalope » — d'où les DEUX premiers mots, comme au build.
    const essais: readonly (readonly string[])[] =
      forme.length > 1 ? [forme, [forme[0]!], [forme[1]!]] : [forme]

    for (const essai of essais) {
      for (let i = 0; i + essai.length <= jetons.length; i++) {
        const brut = apparier(jetons, i, essai)
        if (brut < 0) continue
        const dernier = etendre(texte, jetons, brut, vocabulaire)

        const groupe = groupeDeterminant(jetons, i)
        if (groupe === null) continue

        const prefixe = accorder(groupe, ingredient.quantite, formes)
        if (prefixe === null) continue

        const nomDansLaPhrase = texte.slice(jetons[i]!.debut, jetons[dernier]!.fin)
        const suite = libelleNommeLAliment(ingredient.quantite, formes)
          ? ''
          : ` ${liaison(nomDansLaPhrase)}${nomDansLaPhrase}`

        return {
          debut: groupe.debut,
          fin: jetons[dernier]!.fin,
          foodId: ingredient.foodId,
          prefixe,
          remplacement: ingredient.quantite,
          suite,
        }
      }
    }
  }
  return null
}

/** Majuscule initiale, quand la substitution ouvre la phrase. */
function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Le texte d'une étape, quantités posées à l'endroit où les ingrédients sont nommés.
 *
 * @param texte       le texte de l'étape, tel qu'il est écrit dans le YAML — jamais modifié en base
 * @param ingredients ceux que le build a rattachés à CETTE étape, quantités déjà mises à l'échelle
 *
 * ⚠️ L'ORDRE DE `ingredients` DÉCIDE DES CONFLITS. Deux ingrédients qui se disputent le même
 * morceau de phrase (« poivron » et « poivron rouge ») : le premier de la liste gagne, le second
 * n'est pas injecté et garde son badge. On passe la liste dans l'ordre de la recette, donc le
 * conflit se tranche toujours pareil d'une étape à l'autre.
 */
export function injecterQuantites(
  texte: string,
  ingredients: readonly IngredientDeLEtape[]
): EtapeInjectee {
  const jetons = jetonner(texte)

  const occurrences: Occurrence[] = []
  for (const ingredient of ingredients) {
    const trouve = localiser(texte, jetons, ingredient)
    if (trouve === null) continue
    // Un morceau de phrase ne se remplace qu'une fois.
    if (occurrences.some((o) => trouve.debut < o.fin && o.debut < trouve.fin)) continue
    occurrences.push(trouve)
  }
  occurrences.sort((a, b) => a.debut - b.debut)

  const segments: SegmentEtape[] = []
  const injectes = new Set<string>()
  let curseur = 0

  for (const o of occurrences) {
    if (o.debut > curseur) segments.push({ type: 'texte', contenu: texte.slice(curseur, o.debut) })
    // Le déterminant accordé reste du texte : seul le nombre est mis en valeur.
    if (o.prefixe !== '') {
      segments.push({ type: 'texte', contenu: o.debut === 0 ? capitaliser(o.prefixe) : o.prefixe })
    }
    segments.push({
      type: 'quantite',
      contenu: o.debut === 0 && o.prefixe === '' ? capitaliser(o.remplacement) : o.remplacement,
      foodId: o.foodId,
    })
    if (o.suite !== '') segments.push({ type: 'texte', contenu: o.suite })
    injectes.add(o.foodId)
    curseur = o.fin
  }
  if (curseur < texte.length) segments.push({ type: 'texte', contenu: texte.slice(curseur) })

  return { segments, injectes }
}
