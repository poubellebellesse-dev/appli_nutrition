// catalog/lien-etape-equipement.mjs — quand un ustensile est-il occupé, et jusqu'à quelle étape ?
//
// ⚠️ CE MODULE EXISTE EN UN SEUL EXEMPLAIRE, ET C'EST LE POINT. Il est appelé par `build.mjs` (qui
// remplit `recipe_step_equipment`) et par toute sonde qui compte. Deux copies divergeraient, et le
// chiffre mesuré cesserait de décrire ce que le build produit — même contrainte que
// `lien-etape-ingredient.mjs`, et pour la même raison.
//
// ✅ ET LA RÈGLE VIT DANS `catalog/`, PAS DANS `atelier/`. `atelier/` est gitignoré en entier
// (`.gitignore:43`) : une règle posée là ne serait dans aucun clone. Une sonde se réécrit, une règle
// non.
//
// ---------------------------------------------------------------------------------------------
// POURQUOI UNE PORTÉE, ET PAS UNE ÉTAPE
//
// `recipe_equipment` a pour clé `(recipe_id, equipment_id)` : une seule ligne par couple, donc
// aucune façon de dire QUAND. Mais une ligne par étape ne suffit pas non plus, et c'est
// `oeufs_cocotte_epinards` qui l'a montré : le plat d'eau du bain-marie entre au four à l'étape 1 et
// n'en ressort pas avant la 5. Deux lignes (1 et 5) auraient déclaré le four LIBRE aux étapes 2 à 4.
//
//   `colin_four_fenouil`      on enfourne, ON SORT LE PLAT, on remet   → [2,2] et [4,4], trou VRAI
//   `oeufs_cocotte_epinards`  l'eau entre et NE RESSORT PAS            → [1,5], aucun trou
//
// ⛔ LE SENS DE L'ERREUR N'EST PAS SYMÉTRIQUE. Annoncer le four pris alors qu'il est libre agace ;
// annoncer le four libre alors qu'il est pris FAIT RATER UN PLAT.
//
// ⛔ LA CONTINUITÉ NE SE DÉDUIT PAS, ELLE SE DÉCLARE. Rien dans le texte ne sépare le trou vrai du
// colin du trou faux des œufs sans lire ce que la recette fait de l'objet entre les deux. Le
// détecteur produit donc des occupations d'UNE SEULE ÉTAPE, et c'est `occupe.jusqu_a` dans le YAML
// qui étend la portée.
//
// ---------------------------------------------------------------------------------------------
// POURQUOI `rotir` N'EST PAS UN SIGNAL À LUI SEUL — mesuré le 2026-08-13 sur les 11 étapes qui le
// portent
//
// Le geste `rotir` est posé là où le MOT apparaît, jamais là où l'action se fait. Sur les 11 étapes,
// 4 ne rôtissent rien :
//
//   « Servir les sardines avec les tomates RÔTIES »            → on sert
//   « Mélanger le boulgour … et les courgettes RÔTIES »        → on mélange
//   « … puis les sécher — mouillées, elles cuiraient … »       → on sèche
//   « Les étaler en UNE SEULE COUCHE : entassés, ils … »       → on étale
//
// ⛔ ET POURTANT ON NE RETIRE PAS LE GESTE DES RECETTES. C'était la correction prévue au lot B ; elle
// est fausse. Dans les quatre cas, `rotir` est le SEUL endroit de la recette où le geste est cité —
// le retirer priverait le lecteur de la définition de « rôtir » sur une recette qui rôtit vraiment.
// Le geste est bien placé pour ce qu'il sert ; c'est le détecteur qui le lisait mal.
//
// ⛔ ET ON NE LE SUPPRIME PAS DE LA RÈGLE NON PLUS. `poivrons_grilles_marines` exige le four et son
// UNIQUE signal est `rotir` à l'étape 2 (« Les rôtir en les retournant »). L'écarter rendrait cette
// recette muette — exactement ce qu'un four réservé ne doit jamais être.
//
// La règle qui reste distingue les deux par la LANGUE, pas par la liste des cas :
//
//   infinitif dans la partie commandée   « Les RÔTIR en les retournant »      → occupation
//   participe passé, donc adjectif       « les tomates RÔTIES »               → non
//   après un tiret cadratin ou un « : »  « … au lieu de rôtir »               → non
//
// Les 11 étapes se rangent toutes, et aucune n'a demandé de cas particulier.

/** Minuscules, sans accents, ponctuation en espaces. Même normalisation que le lien ingrédient. */
export function normaliser(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * La partie de l'étape qui COMMANDE, débarrassée de ce qui explique.
 *
 * ⚠️ DEUX SÉPARATEURS, ET C'EST UNE CONVENTION D'ÉCRITURE DU PROJET, pas une astuce. Le tiret
 * cadratin et le deux-points introduisent tous deux la raison d'un geste — « les sécher — mouillées,
 * elles cuiraient à la vapeur », « en UNE SEULE COUCHE : entassés, ils cuiraient ». Ce qui suit
 * explique ce qu'on ferait AUTREMENT ; le lire comme une consigne, c'est lire l'inverse du texte.
 *
 * ⚠️ Le tiret d'incise `–` compte aussi. Le trait d'union `-` NON : il vit à l'intérieur des mots
 * (« chou-fleur », « bain-marie ») et couper dessus casserait les termes.
 */
export function partieCommandee(texte) {
  const coupure = texte.search(/\s[—–]\s|\s?:\s/)
  return coupure === -1 ? texte : texte.slice(0, coupure)
}

/**
 * Les ustensiles que chaque geste du lexique désigne, et à quelle condition.
 *
 * - `enfourner` est SANS CONDITION : c'est une annotation humaine dont c'est le sens exact, et les
 *   74 étapes qui la portent sont tenues pour justes par construction. ⚠️ Si ce postulat tombe, le
 *   taux mesuré tombe avec — il n'a jamais été audité.
 * - `rotir` et `gratiner` sont des VERBES : ils ne comptent qu'à l'infinitif, dans la partie
 *   commandée. Voir l'en-tête pour les quatre faux qu'ils produisaient.
 * - `papillote` est un NOM : aucune forme verbale à distinguer, on demande que le terme soit dans
 *   la partie commandée.
 *
 * ⛔ `bain_marie` N'EST PAS DANS CETTE TABLE, ET C'EST LE CAS LE PLUS INSTRUCTIF DU LOT. Le brief
 * l'avait rangé parmi les gestes de four implicites. `mousse_chocolat` le réfute : « casser le
 * chocolat en morceaux et le faire fondre AU BAIN-MARIE » — casserole dans casserole, SUR LA PLAQUE,
 * et la recette ne demande même pas de four. Le bain-marie par défaut n'est pas un geste de four.
 *
 * ⚠️ ET `oeufs_cocotte_epinards` NE CONTREDIT PAS ÇA, IL LE CONFIRME : son bain-marie est bien au
 * four, et c'est justement pourquoi il se DÉCLARE (`occupe:` à l'étape 1). Le geste ne dit pas où ;
 * seul l'auteur de la recette le sait. Automatiser l'exception aurait fait entrer la mousse au
 * chocolat dans la réservation du four.
 */
const GESTES = new Map([
  ['enfourner', { code: 'four', forme: 'toujours' }],
  ['rotir', { code: 'four', forme: 'infinitif', racine: 'rotir' }],
  ['gratiner', { code: 'four', forme: 'infinitif', racine: 'gratiner' }],
  ['papillote', { code: 'four', forme: 'terme', racine: 'papillote' }],
])

/**
 * Les tournures de TEXTE qui disent le four sans qu'aucun geste ne le porte.
 *
 * ⚠️ VOLONTAIREMENT ÉTROITES. « au four » tout court ne suffit pas : `poireaux_gratines_bechamel`
 * écrit « l'eau rendue AU FOUR délaierait la béchamel », qui explique un risque et ne commande rien.
 * Une règle large aurait ramassé cette phrase, et c'est le cinquième faux positif du lot B.
 *
 * ⛔ « à la SORTIE du four » n'est pas ici, et n'y sera jamais : la phrase dit le contraire de ce
 * qu'elle a l'air de dire.
 */
const TOURNURES = [/\bremettre\b[^.]*\bau four\b/, /\bsous le gril\b/, /\bau gril du four\b/]

/** Le mot est-il l'infinitif de cette racine, plutôt qu'un participe employé comme adjectif ? */
function infinitifPresent(mots, racine) {
  const cible = racine.endsWith('r') ? racine : `${racine}r`
  return mots.some((m) => m === cible)
}

function termePresent(texteNormalise, racine) {
  return texteNormalise.includes(racine)
}

/** L'étape occupe-t-elle le four, d'après ses gestes puis son texte ? */
function etapeOccupeLeFour(etape) {
  const commandee = normaliser(partieCommandee(etape.texte ?? ''))
  const mots = commandee.split(' ').filter(Boolean)

  for (const geste of etape.lexicon_ids ?? []) {
    const regle = GESTES.get(geste)
    if (regle === undefined) continue
    if (regle.forme === 'toujours') return regle.code
    if (regle.forme === 'infinitif' && infinitifPresent(mots, regle.racine)) return regle.code
    if (regle.forme === 'terme' && termePresent(commandee, regle.racine)) return regle.code
  }

  if (TOURNURES.some((t) => t.test(commandee))) return 'four'
  return null
}

// ---------------------------------------------------------------------------------------------
// LA PLAQUE — lot 65c, `docs/CONCEPTION_RESERVATION_MATERIEL.md`
//
// Le four se trahit par un geste ou une tournure ; la plaque, elle, n'a presque jamais de mot à
// elle. « Faire revenir les oignons » ne nomme aucun ustensile — c'est le GESTE qui dit le feu.
//
// ⛔ QUINZE GESTES SÛRS, ET UN SEUL AMBIGU. Mesuré le 2026-08-19 sur les 1 548 étapes : les quinze
// ne rendent aucun faux positif. `dorer`, lui, est le geste le plus fréquent de la liste — 64
// étapes — et VINGT-TROIS SONT AU FOUR.
//
// ⛔ `vapeur` N'EST PAS DANS LA LISTE. Ses deux étapes décrivent un risque et ne commandent rien —
// « entassés, ils cuiraient à la vapeur ». C'est le piège de `poireaux_gratines_bechamel`, déjà
// payé au lot B du 65a, et la même phrase le retendrait ici.

/** Les quinze gestes qui ne se font QUE sur un feu du dessus. */
const GESTES_PLAQUE = new Set([
  'revenir',
  'suer',
  'saisir',
  'sauter',
  'poeler',
  'mijoter',
  'fremir',
  'reduire',
  'deglacer',
  'mouiller',
  'blanchir',
  'pocher',
  'carameliser',
  'braiser',
  'bain_marie',
])

/** Le seizième, et le seul qui se fasse des deux côtés. */
const GESTE_AMBIGU = 'dorer'

/** Nommer le récipient, c'est nommer le feu : aucun de ces objets ne va au four tout seul. */
const CONTENANT_SUR_LE_FEU =
  /\b(po[eê]le|casserole|sauteuse|cocotte|wok|faitout|marmite|po[eê]lon)\b/i

/**
 * Le signe qu'on est au four. ⚠️ PLUS LARGE QUE `TOURNURES`, ET C'EST VOULU : ici le signe ne sert
 * qu'à ÉCARTER une occupation de plaque, jamais à en créer une. Se tromper coûte une occupation en
 * moins, pas une fausse alerte — et le sens de l'erreur n'est pas symétrique.
 */
const SIGNE_DE_FOUR = /\bau four\b|\benfourn|\bgratin|\bgril du four\b|\bpapillote/i

/**
 * Combien d'étapes en arrière on cherche l'indice qui manque à l'étape courante.
 *
 * ⭐ LA RÈGLE DE REPORT, POSÉE PAR L'AUTEUR LE 2026-08-19 : un plat mis au four y reste jusqu'à ce
 * qu'on l'en sorte, et l'étape qui dit « poursuivre jusqu'à ce qu'ils soient dorés » n'a aucune
 * raison de le redire. `pommes_terre_four_romarin` #5 est le cas exact — son texte ne contient pas
 * le mot « four », c'est l'étape #4 qui l'y a mis. Une règle qui lit l'étape SEULE lui pose une
 * occupation de plaque, et le plat sort d'un feu où il n'est jamais allé.
 */
const PORTEE_DU_REPORT = 4

/** Ce que l'étape dit d'elle-même : `four`, `plaque_cuisson`, ou rien. */
function indiceDeLEtape(etape) {
  const texte = etape.texte ?? ''
  const gestes = etape.lexicon_ids ?? []
  const gesteDeFour = gestes.some((g) => g === 'enfourner' || g === 'gratiner' || g === 'rotir')
  if (gesteDeFour || SIGNE_DE_FOUR.test(texte)) return 'four'
  if (CONTENANT_SUR_LE_FEU.test(texte)) return 'plaque_cuisson'
  return null
}

/**
 * L'étape occupe-t-elle la plaque ?
 *
 * ⛔ ELLE NE DEVINE PAS. Un `dorer` que ni son texte ni les quatre étapes d'avant ne tranchent reste
 * DEHORS — onze cas, dont « faire dorer les amandes à sec » et « griller les tranches de pain
 * complet », qui sont probablement un grille-pain que personne n'a écrit. Les déclarer un par un
 * reste possible ; le détecteur, lui, se tait.
 *
 * @param etape       l'étape courante
 * @param precedentes les étapes de geste qui la précèdent, dans l'ordre
 */
function etapeOccupeLaPlaque(etape, precedentes) {
  const gestes = etape.lexicon_ids ?? []
  if (gestes.some((g) => GESTES_PLAQUE.has(g))) return 'plaque_cuisson'
  if (!gestes.includes(GESTE_AMBIGU)) return null

  const propre = indiceDeLEtape(etape)
  if (propre !== null) return propre === 'plaque_cuisson' ? 'plaque_cuisson' : null

  const depuis = Math.max(0, precedentes.length - PORTEE_DU_REPORT)
  for (let i = precedentes.length - 1; i >= depuis; i -= 1) {
    const reporte = indiceDeLEtape(precedentes[i])
    if (reporte !== null) return reporte === 'plaque_cuisson' ? 'plaque_cuisson' : null
  }
  return null
}

/**
 * Deux portées du même ustensile se recouvrent-elles ? ⚠️ RECOUVREMENT SEUL, JAMAIS ADJACENCE :
 * `[2,2]` et `[3,3]` restent deux occupations. Fusionner des étapes voisines effacerait le trou de
 * `colin_four_fenouil`, où l'on sort réellement le plat entre les deux enfournements.
 */
const seRecouvrent = (a, b) => a.ordreDebut <= b.ordreFin && b.ordreDebut <= a.ordreFin

/**
 * Les occupations d'ustensile d'une recette, en portées `[ordreDebut, ordreFin]`.
 *
 * @param recette l'objet YAML de la recette (`etapes`, chacune avec `texte`, `lexicon_ids`, et
 *                éventuellement `occupe: [{ code, jusqu_a }]`)
 * @returns tableau de `{ code, ordreDebut, ordreFin, origine }`, trié par `ordreDebut`
 *
 * ⚠️ `occupe` AJOUTE OU ÉTEND, JAMAIS NE NIE. Retirer un faux positif se fait en corrigeant le texte
 * ou les gestes de l'étape, pas en écrivant « pas d'occupation ici » : stocker une absence
 * obligerait la table à porter des lignes qui ne décrivent rien.
 *
 * ⚠️ UN AVERTISSEMENT N'OCCUPE RIEN. Les 18 mentions ANSES occupent une ligne d'étape sans en être
 * une — elles se lisent, elles ne se font pas.
 */
export function occupationsDeLaRecette(recette) {
  const etapes = (recette.etapes ?? []).filter((e) => (e.nature ?? 'geste') === 'geste')
  const brutes = []

  // Passe 1 — ce que l'humain a déclaré, puis le four dérivé. Inchangée depuis le lot 65a.
  for (const etape of etapes) {
    for (const declaree of etape.occupe ?? []) {
      brutes.push({
        code: declaree.code,
        ordreDebut: etape.ordre,
        ordreFin: declaree.jusqu_a ?? etape.ordre,
        origine: 'declare',
      })
    }

    if ((etape.occupe ?? []).length > 0) continue

    const code = etapeOccupeLeFour(etape)
    if (code !== null) {
      brutes.push({ code, ordreDebut: etape.ordre, ordreFin: etape.ordre, origine: 'derive' })
    }
  }

  // ⛔ LA PLAQUE SE DÉRIVE APRÈS LE FOUR, ET SUR CE QU'IL LAISSE. Une étape que le four tient déjà
  // — portée déclarée comprise, donc les étapes 2 à 4 des œufs cocotte — n'est pas aussi sur un feu
  // du dessus. 27 étapes à geste sûr sont dans ce cas, et les compter deux fois annoncerait un plat
  // à deux endroits à la fois.
  const tenuesParLeFour = new Set()
  for (const occupation of brutes) {
    if (occupation.code !== 'four' && occupation.code !== 'micro_ondes') continue
    for (let i = occupation.ordreDebut; i <= occupation.ordreFin; i += 1) tenuesParLeFour.add(i)
  }

  // Passe 2 — la plaque, avec le report sur les étapes qui précèdent.
  for (let i = 0; i < etapes.length; i += 1) {
    const etape = etapes[i]
    if ((etape.occupe ?? []).length > 0) continue
    if (tenuesParLeFour.has(etape.ordre)) continue

    const code = etapeOccupeLaPlaque(etape, etapes.slice(0, i))
    if (code !== null) {
      brutes.push({ code, ordreDebut: etape.ordre, ordreFin: etape.ordre, origine: 'derive' })
    }
  }

  // Deux occupations du même ustensile qui se recouvrent SONT la même occupation. Le cas vient des
  // œufs cocotte : l'étape 1 déclare `jusqu_a: 5`, et l'étape 4 redit `bain_marie` — c'est le même
  // plat d'eau, pas un second. ⚠️ Une portée DÉCLARÉE absorbe la dérivée, jamais l'inverse : c'est
  // l'humain qui a tranché.
  const fusionnees = []
  for (const occupation of [...brutes].sort((a, b) => a.ordreDebut - b.ordreDebut)) {
    const voisine = fusionnees.find((f) => f.code === occupation.code && seRecouvrent(f, occupation))
    if (voisine === undefined) {
      fusionnees.push({ ...occupation })
      continue
    }
    voisine.ordreFin = Math.max(voisine.ordreFin, occupation.ordreFin)
    if (occupation.origine === 'declare') voisine.origine = 'declare'
  }

  return fusionnees
}
