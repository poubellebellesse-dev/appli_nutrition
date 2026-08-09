// catalog/lien-etape-ingredient.mjs — quels ingrédients de la recette une étape emploie-t-elle ?
//
// ⚠️ CE MODULE EXISTE EN UN SEUL EXEMPLAIRE, ET C'EST LE POINT. Il est appelé par `build.mjs` (qui
// remplit `recipe_step_ingredient`) et par `atelier/mesure-liens-etapes.mjs` (qui compte). Deux
// copies divergeraient, et le chiffre mesuré cesserait de décrire ce que le build produit — c'est
// le motif que `7040c33` a dû réunir côté écrans, on ne le rouvre pas côté catalogue.
//
// ---------------------------------------------------------------------------------------------
// POURQUOI UNE DÉRIVATION, ALORS QUE LE PLAN D'ORIGINE PRÉVOYAIT 1 101 ANNOTATIONS À LA MAIN
//
// La décision 8 (2026-08-04) posait le lien comme « écrit à la main, pas dérivé », au motif que
// « `food` n'a ni synonyme ni alias ». Deux défauts, tous deux mesurés depuis (décision 60) :
//
//   1. La prémisse est fausse depuis le 2026-08-05 — `food.synonymes` existe (décision 58).
//   2. Le tableau qui écartait la dérivation la mesurait contre les 450 ALIMENTS DU CATALOGUE. Le
//      problème réel est FERMÉ : choisir parmi les ~7 ingrédients de LA recette. « Découper les
//      tomates » n'a jamais risqué de désigner l'ail — l'ail n'est pas candidat sur cette phrase.
//
// Relevé du 2026-08-07 sur 292 recettes et 1 317 gestes : **94,0 % des étapes trouvent au moins un
// ingrédient, 2,0 % portent une ambiguïté, 6,0 % ne trouvent rien.** Les 6 % sont massivement des
// étapes qui n'emploient réellement aucun ingrédient (« Préchauffer le four », « Enfourner »,
// « Couvrir et laisser braiser »). Rejouer la mesure : `node atelier/mesure-liens-etapes.mjs`.
//
// ⚠️ CE QUE CE MODULE NE DOIT JAMAIS SERVIR À FAIRE : masquer des ingrédients. Un lien manqué doit
// rester sans conséquence, donc l'écran AJOUTE une information et n'en retranche aucune — la liste
// complète reste accessible en permanence (L1bis). Le jour où quelqu'un s'en servira pour FILTRER,
// une étape sur seize affichera une liste vide et 4 % des ingrédients n'apparaîtront nulle part.
// C'est l'écran qui « ment par omission », la seule objection de la décision 60 qui tenait debout.

/**
 * Les verbes qui DÉSIGNENT un ingrédient sans le nommer. Le seul cas que le §2.1 du document de
 * conception appelait à juste titre résistant : « saler » ne contient pas « sel », aucun
 * rapprochement de chaîne ne les rapprochera jamais.
 *
 * ⚠️ Douze entrées, et la liste est fermée par la LANGUE, pas par le catalogue : ajouter un aliment
 * n'oblige pas à revenir ici.
 */
const VERBES = new Map([
  ['sal', 'sel'],
  ['poivr', 'poivre'],
  ['beurr', 'beurre'],
  ['huil', 'huile'],
  ['sucr', 'sucre'],
  ['farin', 'farine'],
  ['citronn', 'citron'],
  ['vinaigr', 'vinaigre'],
  ['persill', 'persil'],
  ['safran', 'safran'],
  ['gratin', 'fromage'],
  ['paner', 'chapelure'],
])

/**
 * ⚠️ UNE RACINE DE VERBE EST AUSSI UN PRÉFIXE DE NOM, et `startsWith` ne fait pas la différence.
 * Relevé sur le catalogue le 2026-08-08, mot à mot :
 *
 *   sal      → saler×123  salee×50   MAIS saladier×10  salade×4  salsifis×1
 *   poivr    → poivrer×24 poivre×17  MAIS poivron×22   poivrons×13
 *   vinaigr  → vinaigre×24           MAIS vinaigrette×17
 *   gratin   → gratiner×5 gratine×1  MAIS gratin×3     gratinage×1
 *
 * « Verser la vinaigrette » rattachait donc le VINAIGRE, « un plat à gratin » le FROMAGE. Des liens
 * plausibles et faux — la forme la plus chère, parce qu'aucune sonde ne les distingue des vrais.
 *
 * La parade : la racine doit être suivie d'une TERMINAISON VERBALE. Les recettes n'emploient que
 * trois formes — infinitif, participe passé, gérondif — donc la liste est courte et fermée.
 * ⚠️ `ons` et `ez` en sont volontairement ABSENTS : aucune étape ne dit « nous poivrons », et les
 * y mettre rendrait `poivrons` au poivre.
 */
const TERMINAISONS_VERBALES = new Set(['er', 'e', 'es', 'ee', 'ees', 'ant'])

/**
 * Le mot est-il une forme verbale de cette racine, plutôt qu'un nom qui commence pareil ?
 *
 * Le reste vide n'est accepté que si la racine EST déjà un infinitif (`paner`) — sans quoi le nom
 * `gratin` passerait pour le verbe `gratiner`.
 */
function estFormeVerbale(mot, racine) {
  if (!mot.startsWith(racine)) return false
  const reste = mot.slice(racine.length)
  return reste === '' ? racine.endsWith('er') : TERMINAISONS_VERBALES.has(reste)
}

/**
 * L'HYPERONYME — le mot générique qui désigne plusieurs ingrédients sans en nommer aucun.
 *
 * ⚠️ C'ÉTAIT LE SEUL CAS OÙ L'ANNOTATION MANUELLE BATTAIT VRAIMENT LA MACHINE, et il se résout sans
 * elle. `bol_fruits_graines` porte pomme, orange et banane ; son étape 1 dit « couper LES FRUITS ».
 * Aucun rapprochement de chaîne n'y arrivera — mais chaque aliment porte un `groupe`, et l'ensemble
 * reste fermé aux ingrédients de la recette : « les fruits » ne peut désigner que les fruits DE
 * CETTE recette-là.
 */
const HYPERONYMES = new Map([
  ['fruit', 'fruits'],
  ['legume', 'légumes'],
  ['viande', 'viandes'],
  ['poisson', 'poissons'],
  ['epice', 'condiments'],
  ['aromate', 'condiments'],
  ['herbe', 'condiments'],
  ['legumineuse', 'légumineuses'],
  ['agrume', 'fruits'],
])

/**
 * LE NOM DE PORTION — le mot par lequel une recette compte une chair sans jamais la nommer.
 *
 * ⚠️ C'EST LE GISEMENT QU'AUCUNE SONDE NE VOYAIT, et pour une raison circulaire : ces étapes
 * n'avaient AUCUN lien, donc n'apparaissaient dans aucun relevé de liens, donc dans aucun chantier
 * de relecture. Quatorze étapes de poisson, mesurées le 2026-08-09 : `maquereau_moutarde_poele`
 * écrit « retourner les filets » et ne redit jamais « maquereau » — aucun rapprochement de chaîne
 * n'y arrivera, pas plus que « les fruits » n'atteint la pomme.
 *
 * Le mot manquant est pourtant déjà écrit dans la recette, une ligne plus haut : le libellé de
 * l'ingrédient dit « 8 filets ». Il DÉCLARE l'unité dans laquelle cette recette-là compte cette
 * chair-là. Même mouvement que `HYPERONYMES` — le sens vient de la recette, jamais d'une table par
 * aliment — sauf qu'il vient ici de la ligne d'ingrédient plutôt que du `groupe`.
 *
 * ⚠️ MÊME LISTE QUE `PORTIONS` DANS `app/src/ui/texte-etape.ts`, et il faut les tenir ensemble : ce
 * module décide QUEL ingrédient l'étape emploie, l'autre décide OÙ poser la quantité. Un mot présent
 * ici et absent là-bas produit « 4 pavés DE PAVÉS » — le défaut « 1 chou-fleur de chou-fleur »,
 * corrigé le 2026-08-08, dans son autre sens. La liste est fermée par la BOUCHERIE et la
 * POISSONNERIE, pas par le catalogue : ajouter un aliment n'oblige pas à revenir ici.
 */
const PORTIONS = new Set([
  'filet', 'pave', 'dos', 'darne', 'tranche', 'escalope', 'aiguillette', 'medaillon', 'steak',
])

/**
 * Le nom de portion qu'emploie ce libellé, ou `null`. « 4 pavés » → `pave`, « 500 g » → `null`.
 *
 * Un libellé au poids ne compte rien : il n'y a pas d'unité à retrouver dans la phrase. C'est ce qui
 * laisse `soupe_poisson_fenouil` (merlu « 500 g » + lieu « 400 g ») hors de portée — à raison, elle
 * dit « les poissons » au pluriel générique et relève d'un autre mécanisme.
 */
export function portionDuLibelle(libelle) {
  if (typeof libelle !== 'string') return null
  for (const mot of normaliser(libelle).split(' ')) {
    const singulier = mot.replace(/(s|x)$/, '')
    if (PORTIONS.has(singulier)) return singulier
  }
  return null
}

/**
 * ⚠️ « UN FILET D'HUILE » N'EST PAS UNE PORTION DE POISSON, ET « UNE TRANCHE DE JAMBON » N'EST PAS
 * UNE TRANCHE DE PAIN. Le mot est le même, la chose comptée ne l'est pas — et la phrase le dit
 * elle-même, en plaçant son complément juste derrière.
 *
 * Un nom de portion NU (« poser les filets », « napper chaque pavé ») est le seul cas où le mot
 * remplace l'ingrédient. Suivi de « de X », il le qualifie : X est nommé, et les voies normales du
 * rapprochement s'en chargent déjà. Les quatre rendus fautifs relevés au diff du 2026-08-09 avaient
 * tous cette forme, dont un qui inventait un nombre — « rouler chacune dans UNE TRANCHE de jambon »
 * devenait « rouler chacune dans 8 TRANCHES », soit huit fois la vérité.
 *
 * ⚠️ LE TEST PORTE SUR LE COMPLÉMENT, PAS SUR LE « DE ». « Napper chaque pavé DE CE MÉLANGE » ne
 * nomme aucun ingrédient : c'est une portion nue, et le saumon s'y rattache. La première version,
 * qui refusait tout « de », a emporté cette étape-là avec les fautives.
 *
 * ⚠️ ET C'EST UN AUTRE ALIMENT QU'IL FAUT Y LIRE, PAS N'IMPORTE LEQUEL. « Poser les pavés DE
 * SAUMON » nomme le saumon lui-même : la phrase dit deux fois la même chose, elle ne compte pas
 * autre chose. Une version intermédiaire refusait aussi ce cas et éteignait six étapes que la
 * relecture manuelle avait justement écrites sous cette forme.
 */
function suiviDUnAutreIngredient(mots, i, nommeUnAutre) {
  if (mots[i + 1] !== 'de' && mots[i + 1] !== 'd') return false
  const complement = mots[i + 2]
  return complement !== undefined && nommeUnAutre(complement)
}

/**
 * ⚠️ UN NOM DE PORTION EST AUSSI UN PARTICIPE PASSÉ — troisième occurrence du même piège, après
 * « la vinaigrette » pour `vinaigr` et « chou-fleur » pour le séparateur. `salade_poulet_parmesan`
 * dit « dresser le poulet TRANCHÉ dessus » : `normaliser` en fait « tranche », le mot du libellé du
 * PAIN, et l'étape se voyait rattacher le pain. Trouvé au diff, pas au test — il n'était pas dans
 * les 17 étapes visées, il est arrivé en prime.
 *
 * La parade tient à ce qu'est une portion : une chose qu'on COMPTE. Elle porte donc un déterminant
 * — « les filets », « chaque tranche », « le pavé ». « le poulet tranché » n'en a pas devant lui, il
 * a un nom. Aucune des 14 étapes visées n'y perd quoi que ce soit, toutes disent « les » ou
 * « chaque ».
 */
const DEVANT_UNE_PORTION = new Set([
  'le', 'la', 'l', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux',
  'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses', 'leur', 'leurs', 'chaque',
])

/** Le nom de portion est-il employé comme portion dans cette phrase, plutôt que comme mesure ? */
function portionEmployee(mots, portion, nommeUnAutre) {
  for (let i = 0; i < mots.length; i++) {
    if (!memeMot(mots[i], portion)) continue
    if (i === 0 || !DEVANT_UNE_PORTION.has(mots[i - 1])) continue
    // `normaliser` a déjà transformé « d'huile » en « d huile ».
    if (suiviDUnAutreIngredient(mots, i, nommeUnAutre)) continue
    return true
  }
  return false
}

/** Mots qui ne discriminent rien — articles, et qualificatifs d'état des noms CIQUAL. */
const VIDES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'a', 'en', 'et', 'ou', 'un', 'une',
  'cru', 'crue', 'cuit', 'cuite', 'nature', 'entier', 'entiere', 'frais', 'fraiche', 'sec', 'seche',
])

/**
 * Les infinitifs sont la forme verbale des recettes (« Émincer », « Blanchir »). C'est ce qui permet
 * de distinguer le PRONOM de l'ARTICLE, et la distinction n'est pas cosmétique :
 *
 *   « LES blanchir trois minutes »  → pronom : reprend l'ingrédient de l'étape précédente
 *   « LE four à 190 °C »            → article : ne reprend rien du tout
 *
 * Sans elle, « Préchauffer le four » hériterait des ingrédients précédents.
 */
const estInfinitif = (mot) => /(er|ir|re)$/.test(mot) && mot.length > 3

/**
 * Minuscules, sans accents, ponctuation en espaces.
 *
 * ⚠️ LA LIGATURE `œ` N'EST PAS DÉCOMPOSÉE PAR NFD. Sans la ligne qui la traite, « œufs » devient
 * « ufs » et aucune recette au monde ne relie plus un œuf à un œuf. Défaut trouvé dans la sonde
 * elle-même, et il coûtait à lui seul deux points de couverture.
 */
export function normaliser(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Les formes sous lesquelles un aliment peut apparaître dans une phrase de recette.
 *
 * ⚠️ LE `nom` DU CATALOGUE EST UN NOM CIQUAL, PAS UN MOT DE CUISINE : « Tomate, crue », « Thon,
 * conserve au naturel, égoutté ». On coupe à la première virgule — ce qui suit qualifie l'état de
 * l'aliment, jamais la façon dont une recette le nomme.
 */
function formesDe(aliment) {
  const brutes = [
    aliment.nom.split(',')[0],
    ...(aliment.synonymes ?? []),
    aliment.sous_famille ?? '',
    aliment.id.replace(/_/g, ' '),
  ]
  const formes = []
  for (const brute of brutes) {
    const mots = normaliser(brute)
      .split(' ')
      .filter((m) => m.length > 1 && !VIDES.has(m))
    if (mots.length > 0) formes.push(mots)
  }
  return formes
}

/**
 * Tolérance au pluriel des DEUX côtés (« tomate » ↔ « tomates », « poireaux » ↔ « poireau »), et
 * rien de plus : pas de racinisation, qui produirait des rapprochements qu'on ne saurait pas
 * justifier devant un utilisateur.
 */
function memeMot(a, b) {
  if (a === b) return true
  const sansPluriel = (m) => m.replace(/(s|x)$/, '')
  return sansPluriel(a) === sansPluriel(b) && sansPluriel(a).length > 2
}

/** `forme` (suite de mots) apparaît-elle dans `motsTexte` ? */
function formePresente(motsTexte, forme) {
  for (let i = 0; i + forme.length <= motsTexte.length; i++) {
    let ok = true
    for (let j = 0; j < forme.length; j++) {
      if (!memeMot(motsTexte[i + j], forme[j])) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

/**
 * ⚠️ LES NOMS QUI FINISSENT COMME DES INFINITIFS. `estInfinitif` n'est qu'un test de terminaison :
 * tout mot de plus de trois lettres en -er/-ir/-re passe. « la chair », « le beurre », « le sucre »
 * étaient donc lus comme pronom + verbe, et l'étape héritait des ingrédients de la précédente.
 *
 * « la chair » à lui seul déclenchait 8 héritages faux — toutes des cuissons de poisson
 * (« jusqu'à ce que la chair se détache de l'arête »).
 *
 * Cette liste est MESURÉE, pas devinée : elle vient du dépouillement des 143 mots que le catalogue
 * place réellement derrière un pronom. La compléter se fait de la même façon — relever, puis
 * ajouter. Aucun de ces mots n'est un infinitif français, et aucun ne peut le devenir.
 */
const NOMS_EN_APPARENCE_INFINITIFS = new Set([
  'chair', 'beurre', 'laurier', 'sucre', 'vinaigre', 'gingembre', 'concentre', 'cuillere',
  'chapelure', 'poivre', 'concombre', 'ventre', 'levure', 'chevre', 'coriandre', 'centre',
  'texture', 'poudre', 'panier', 'temperature', 'charniere', 'fibre', 'terre', 'blessure',
  'poire', 'boulangere', 'ministere', 'agriculture',
  // Déterminants, adjectifs et numéraux pris au même piège : « l'autre face », « la première eau ».
  'autre', 'premiere', 'derniere', 'dernier', 'quatre', 'moindre',
  // Non relevés à ce jour, mais de la même famille et sans ambiguïté possible.
  'litre', 'verre', 'heure', 'papier', 'quartier', 'saladier', 'entier', 'entiere',
])

const estVerbeInfinitif = (mot) => estInfinitif(mot) && !NOMS_EN_APPARENCE_INFINITIFS.has(mot)

/**
 * Sel, poivre, herbes sèches, laurier : ce que la cuisine suppose présent. Le catalogue le marque
 * déjà, et des DEUX côtés — `fond_de_placard` (on ne l'achète pas pour la recette) et
 * `quantite_figee` (sa quantité ne suit pas les portions : une pincée reste une pincée).
 */
export function estFondDePlacard(aliment) {
  return (aliment?.fond_de_placard ?? aliment?.quantite_figee) === true
}

/** L'étape reprend-elle un ingrédient déjà nommé sans le renommer ? Déterminant + infinitif. */
function aUnPronom(mots) {
  for (let i = 0; i + 1 < mots.length; i++) {
    if (['les', 'le', 'la', 'l', 'en', 'y'].includes(mots[i]) && estVerbeInfinitif(mots[i + 1])) return true
  }
  return false
}

/**
 * Le rapprochement, sur UNE étape et les ingrédients de SA recette.
 *
 * Quatre verdicts par ingrédient trouvé :
 *   - `complet` : une forme entière est dans le texte (« poivron rouge »)
 *   - `tete`    : un des deux premiers mots de la forme y est (« les poivrons »)
 *   - `verbe`   : désigné par un verbe (« saler » → `sel_fin`)
 *   - `groupe`  : désigné par un hyperonyme (« les fruits » → tous les fruits DE LA RECETTE)
 *
 * L'AMBIGUÏTÉ est le cas où deux ingrédients ne sont attrapés que par le même mot de tête — deux
 * huiles, deux poivrons. Elle est RENDUE, jamais avalée : l'appelant décide de se taire plutôt que
 * d'affirmer à moitié.
 */
export function rapprocherEtape(texte, candidats) {
  const mots = normaliser(texte).split(' ').filter(Boolean)
  const trouves = []
  /** Ce mot nomme-t-il un AUTRE ingrédient de la recette ? Garde-fou des noms de portion. */
  const nommeUnAutreQue = (aliment) => (mot) =>
    candidats.some(
      (c) => c.id !== aliment.id && formesDe(c).some((forme) => forme.some((f) => memeMot(mot, f)))
    )

  for (const aliment of candidats) {
    let verdict = null
    let tete = null
    for (const forme of formesDe(aliment)) {
      if (forme.length > 1 && formePresente(mots, forme)) {
        verdict = 'complet'
        break
      }
      // ⚠️ LE MOT DE TÊTE N'EST PAS TOUJOURS LE MOT DE CUISINE. Le nom CIQUAL met le règne devant :
      // « Veau, escalope », « Lieu, colin » — or la recette dit « les escalopes », « le colin ». On
      // essaie donc les DEUX premiers mots.
      for (const mot of forme.slice(0, 2)) {
        if (formePresente(mots, [mot])) {
          verdict ??= 'tete'
          tete ??= mot
          break
        }
      }
    }
    // Le nom de portion ne parle qu'en dernier : quand la phrase écrit « le saumon », c'est le nom
    // propre qui gagne, et le verdict `tete` porte alors le VRAI mot de tête.
    if (verdict === null) {
      const portion = portionDuLibelle(aliment.libelle)
      if (portion !== null && portionEmployee(mots, portion, nommeUnAutreQue(aliment))) {
        // ⚠️ VERDICT `tete` ET NON UN CINQUIÈME VERDICT, pour que l'AMBIGUÏTÉ joue toute seule :
        // deux poissons comptés en filets dans la même recette portent la même tête, l'appelant les
        // fait taire tous les deux. Un cinquième verdict aurait fallu redire cette règle.
        verdict = 'tete'
        tete = portion
      }
    }
    if (verdict === null) {
      for (const [racine, cible] of VERBES) {
        if (!mots.some((m) => estFormeVerbale(m, racine))) continue
        if (formesDe(aliment).some((f) => memeMot(f[0], cible))) {
          verdict = 'verbe'
          break
        }
      }
    }
    if (verdict !== null) trouves.push({ id: aliment.id, verdict, tete })
  }

  // L'hyperonyme ne se déclenche QUE si rien n'a été nommé directement : « couper les légumes et
  // l'oignon » nomme l'oignon, on n'y ajoute pas tous les légumes de la recette par-dessus.
  if (trouves.length === 0) {
    for (const [mot, groupe] of HYPERONYMES) {
      if (!mots.some((m) => memeMot(m, mot))) continue
      for (const aliment of candidats) {
        if (aliment.groupe === groupe) trouves.push({ id: aliment.id, verdict: 'groupe', tete: null })
      }
    }
  }

  const parTete = new Map()
  for (const t of trouves.filter((t) => t.verdict === 'tete' && t.tete !== null)) {
    parTete.set(t.tete, (parTete.get(t.tete) ?? 0) + 1)
  }

  return {
    trouves,
    ambigus: [...parTete.entries()].filter(([, n]) => n > 1).map(([tete]) => tete),
    pronom: aUnPronom(mots),
  }
}

/**
 * Les liens d'une recette entière, étape par étape.
 *
 * @param recette  l'objet YAML de la recette (ingredients, etapes)
 * @param aliments Map<id, aliment> du catalogue
 * @returns Map<ordre, { ids: string[], origine: 'declare' | 'derive' | 'herite' }>
 *
 * ⚠️ `food_ids` DÉCLARÉ DANS LE YAML GAGNE TOUJOURS, et la dérivation n'est même pas tentée. C'est
 * la soupape : là où la machine se trompe ou ne trouve rien, un humain tranche, et son verdict n'est
 * jamais discuté. Le champ reste FACULTATIF pour toujours — le rendre obligatoire sur 1 350 gestes
 * remettrait exactement la corvée que la dérivation existe pour supprimer.
 */
export function liensDeLaRecette(recette, aliments) {
  // ⚠️ LE LIBELLÉ VOYAGE AVEC L'ALIMENT, parce qu'il appartient à la RECETTE et non au catalogue :
  // le même saumon se compte en pavés ici et au poids ailleurs. `rapprocherEtape` reçoit donc une
  // copie enrichie, jamais l'entrée du catalogue — qu'on ne modifie pas sous les pieds du build.
  const candidats = (recette.ingredients ?? [])
    .map((i) => {
      const aliment = aliments.get(i.food_id)
      return aliment === undefined ? undefined : { ...aliment, libelle: i.unite_affichage }
    })
    .filter((a) => a !== undefined)

  const liens = new Map()
  // Le dernier ensemble RÉELLEMENT nommé, pour résoudre « les blanchir » en « blanchir les
  // brocolis ». ⚠️ On n'hérite JAMAIS d'un héritage : deux étapes de pronom d'affilée ne repoussent
  // pas la référence plus loin, elles la perdent. Une chaîne d'approximations n'est plus une donnée.
  let precedent = []

  for (const etape of recette.etapes ?? []) {
    if ((etape.nature ?? 'geste') !== 'geste') {
      // Un avertissement se lit, il ne se fait pas : il n'emploie aucun ingrédient.
      liens.set(etape.ordre, { ids: [], origine: 'derive' })
      continue
    }

    if (Array.isArray(etape.food_ids)) {
      liens.set(etape.ordre, { ids: [...etape.food_ids], origine: 'declare' })
      precedent = [...etape.food_ids]
      continue
    }

    const { trouves, ambigus, pronom } = rapprocherEtape(etape.texte, candidats)

    // ⚠️ UNE AMBIGUÏTÉ FAIT TAIRE L'INGRÉDIENT CONCERNÉ, elle ne le devine pas. Deux huiles dans la
    // recette et « l'huile » dans l'étape : on ne sait pas laquelle, donc on n'en nomme aucune.
    const retenus = trouves.filter((t) => !(t.verdict === 'tete' && ambigus.includes(t.tete)))

    if (retenus.length > 0) {
      const ids = retenus.map((t) => t.id)
      liens.set(etape.ordre, { ids, origine: 'derive' })
      // ⚠️ CE QUE L'ÉTAPE EMPLOIE ET CE QUE SON PRONOM DÉSIGNERA NE SONT PAS LA MÊME CHOSE. « LES
      // plonger dans une eau salée et citronnée » emploie le sel et le citron, mais « les » de
      // l'étape suivante, ce sont toujours les artichauts. Prendre les liens pour antécédent faisait
      // dériver la référence vers l'assaisonnement, et l'erreur se propageait aux étapes d'après.
      //
      // Deux exclusions, chacune tirée d'un défaut mesuré :
      //   - le VERBE (« salée » → sel_fin) désigne un traitement, jamais l'objet du geste ;
      //   - le FOND DE PLACARD (sel, poivre, thym, laurier) est un accompagnement même nommé en
      //     toutes lettres — on n'enveloppe pas « le thym », on enveloppe les betteraves.
      // Si rien ne reste, l'antécédent PRÉCÉDENT tient : mieux vaut une référence un peu ancienne
      // qu'une référence fausse.
      const objets = retenus
        .filter((t) => t.verdict !== 'verbe')
        .map((t) => t.id)
        .filter((id) => !estFondDePlacard(aliments.get(id)))
      if (objets.length > 0) precedent = objets
    } else if (pronom && precedent.length > 0) {
      liens.set(etape.ordre, { ids: [...precedent], origine: 'herite' })
      precedent = []
    } else {
      liens.set(etape.ordre, { ids: [], origine: 'derive' })
    }
  }

  return liens
}
