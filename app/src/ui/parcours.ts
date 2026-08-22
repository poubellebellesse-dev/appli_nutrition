// ui/parcours.ts — le CONTENU des tutoriels : un parcours par écran, et rien d'autre.
//
// ⚠️ SÉPARÉ DE `visite.tsx` EXPRÈS, même raison que `texte-consentement.ts` face à `accueil.tsx` :
// `visite.tsx` porte le MÉCANISME (bulles, exigence de geste, portail, focus), ce fichier porte ce
// qu'on raconte. Ajouter un parcours ne doit jamais demander de rouvrir le mécanisme. Fichier sans
// JSX : testable sans monter React.
//
// ⚠️ UNE ÉTAPE DONT LA CIBLE N'EXISTE PAS EST SILENCIEUSEMENT SAUTÉE (`premierIndexValide`), et si
// AUCUNE ne résout, la visite se termine sans rien afficher — sans erreur, sans test rouge, sans
// trace. C'est le mode de défaillance de ce fichier, et il est invisible. D'où deux règles :
//
//   1. **Chaque parcours ouvre sur une étape INCONDITIONNELLE** — le titre de l'écran, toujours
//      monté. Les étapes suivantes peuvent dépendre de l'état ; celle-là, jamais. C'est ce que
//      `parcours.test.ts` verrouille, et c'est le seul invariant qui empêche un tutoriel fantôme.
//   2. **Aucune cible générique.** Jamais `article`, `section`, `fieldset`, `input[type="search"]`
//      ni `[role="status"]` nus : ils existent sur plusieurs écrans (`article` sur quatre), et le
//      premier du document gagne. La visite guidée a déjà désigné le mauvais élément comme ça.
//
// ⚠️ SAUTER UNE ÉTAPE EST SOUVENT LE BON COMPORTEMENT. Sur un compte neuf, Courses n'a pas de liste,
// le frigo est vide, aucune recette n'est en favori. Expliquer « Ranger par » devant une page vide
// serait pire que de se taire. Les étapes conditionnelles sont donc écrites pour être sautées sans
// que le parcours perde son sens — chacune se suffit à elle-même, aucune ne dit « comme on vient de
// le voir ».
//
// ⚠️ LE TON. Cible du produit : « utilisable par des personnes peu à l'aise avec le numérique »
// (§4 DESIGN). Phrases courtes, vouvoiement, un verbe d'action par étape. On dit ce que ça fait,
// jamais comment c'est fait. Aucun jargon — ni « facette », ni « créneau », ni « catalogue ».
//
// Dépendances : `router.js` seulement, pour les hash de route (jamais un littéral `'#/semaine'`,
// qui se périmerait en silence si le routeur changeait de forme).

// ⚠️ `hashDe` N'ACCEPTE QUE LES CINQ ONGLETS (`type Onglet`). L'éditeur de recette est une SOUS-VUE,
// son hash vient de `hashDeLEditeur(null)` — `hashDe('composer')` ne compile pas, et c'est tant
// mieux : le routeur refuse par son type qu'on invente une route.
import { hashDe, hashDeLEditeur, hashDesParametres, hashDuFrigo } from './router.js'
import type { EtapeVisite } from './visite.js'

/**
 * Un parcours nommé : un thème, l'écran auquel il appartient, une suite d'étapes.
 *
 * ⚠️ CE TYPE VIT ICI ET NON DANS `visite.tsx`, contrairement à `EtapeVisite`. `visite.tsx` sait
 * dérouler une suite d'étapes et n'a aucune raison de savoir qu'il existe des parcours, encore moins
 * à quel écran ils se rattachent. Il reçoit un `readonly EtapeVisite[]`, rien de plus.
 */
/**
 * Les identifiants de parcours, en union littérale.
 *
 * ⚠️ PAS `string`, ET C'EST LE POINT. `LienTutoriel` reçoit un identifiant depuis chaque écran ;
 * avec `string`, une faute de frappe (`'aujourdhuii'`) rendrait un bouton parfaitement normal qui ne
 * ferait RIEN au toucher — `etapesDuParcours` rend un tableau vide et la visite se termine aussitôt.
 * Aucun test d'écran ne verrait la différence. L'union déplace ce défaut du silence vers le
 * compilateur, comme les tables totales de `explain.ts` : un cas non traité est une erreur de
 * compilation, pas un plantage chez l'utilisateur.
 */
export type ParcoursId =
  | 'decouverte'
  | 'menus'
  | 'aujourdhui'
  | 'semaine'
  | 'courses'
  | 'recettes'
  | 'savoir'
  | 'frigo'
  | 'composer'
  | 'reglages'

export interface Parcours {
  readonly id: ParcoursId
  readonly titre: string
  /**
   * Le hash de l'écran auquel ce parcours appartient — c'est lui qui permet à un écran de lancer LE
   * SIEN sans le nommer, et à Réglages de tous les lister.
   *
   * ⚠️ `null` pour « menus », et ce n'est pas un oubli : ce parcours TRAVERSE les écrans, il n'en a
   * aucun. Le type `string | null` force chaque nouveau parcours à répondre à la question.
   */
  readonly ecran: string | null
  readonly etapes: readonly EtapeVisite[]
}

/**
 * Le sélecteur du titre d'un écran — l'ancre inconditionnelle de chaque parcours (règle 1).
 *
 * ⚠️ `data-visite` et NON `h1` : un `h1` nu résoudrait sur n'importe quel écran monté, et le jour où
 * deux le sont (une fiche par-dessus une liste), la bulle désignerait le mauvais.
 */
const titre = (ecran: string): string => `[data-visite="titre-${ecran}"]`

/** Une cible posée exprès pour la visite, ailleurs que sur un titre. */
const cible = (nom: string): string => `[data-visite="${nom}"]`

// --- 1. Découvrir les menus ---------------------------------------------------------------------

/**
 * Le parcours d'origine, décrit tel quel par l'utilisateur : on nomme un onglet, il le touche, on
 * passe au suivant. `[data-visite]` est délibérément absent ici — CES cibles sont les liens RÉELS de
 * la barre (`navigation.tsx`), déjà stables par leur `href` : un `data-visite` de plus dupliquerait
 * une identité qui existe déjà.
 *
 * ⚠️ « Aujourd'hui » n'a pas son étape : c'est l'écran de départ le plus courant, le désigner
 * n'apprendrait rien que la première bulle ne dise déjà.
 */
const ETAPES_MENUS: readonly EtapeVisite[] = [
  {
    cible: 'nav[aria-label="Navigation principale"]',
    titre: 'La navigation',
    texte:
      "Ces cinq onglets sont toujours là, en bas de l'écran. On va les découvrir ensemble : à chaque étape, touchez l'onglet nommé.",
    attendu: { type: 'lecture' },
  },
  {
    cible: `a[href="${hashDe('semaine')}"]`,
    titre: 'Cette semaine',
    texte: 'Touchez « Semaine » pour voir le planning des prochains jours.',
    attendu: { type: 'route', hash: hashDe('semaine') },
  },
  {
    cible: `a[href="${hashDe('courses')}"]`,
    titre: 'Vos courses',
    texte: 'Touchez « Courses » pour voir la liste à acheter.',
    attendu: { type: 'route', hash: hashDe('courses') },
  },
  {
    cible: `a[href="${hashDe('recettes')}"]`,
    titre: 'Toutes les recettes',
    texte: 'Touchez « Recettes » pour parcourir le catalogue complet.',
    attendu: { type: 'route', hash: hashDe('recettes') },
  },
  {
    cible: `a[href="${hashDe('savoir')}"]`,
    titre: 'Le coin Savoir',
    texte: 'Touchez « Savoir » pour les explications et les conseils.',
    attendu: { type: 'route', hash: hashDe('savoir') },
  },
]

/**
 * L'étape que `ETAPES_MENUS` n'a jamais eue : « touchez Aujourd'hui ».
 *
 * ⚠️ ELLE RENVERSE UNE DÉCISION ÉCRITE JUSTE AU-DESSUS, et c'est voulu (lot `retour-1b`, décision 81).
 * « Aujourd'hui n'a pas son étape » se tenait tant que le tutoriel se contentait de NOMMER les
 * onglets : le désigner n'apprenait rien. Le parcours composé, lui, ENTRE dans chaque écran — il lui
 * faut donc une porte d'entrée comme aux quatre autres, sans quoi le premier bloc arriverait sans
 * qu'on ait rien touché.
 *
 * ⛔ ELLE VIT ICI ET NON DANS `ETAPES_MENUS`. Le parcours « menus » garde ses cinq étapes et son
 * sens d'origine — ce lot AJOUTE un chemin, il n'en modifie aucun.
 */
const ETAPE_VERS_AUJOURDHUI: EtapeVisite = {
  cible: `a[href="${hashDe('aujourdhui')}"]`,
  titre: 'On commence par aujourd’hui',
  texte:
    "Touchez « Aujourd'hui » : c'est l'écran qui vous propose une idée pour le prochain repas, une à la fois.",
  attendu: { type: 'route', hash: hashDe('aujourdhui') },
}

// --- 2. Aujourd'hui -----------------------------------------------------------------------------

const ETAPES_AUJOURDHUI: readonly EtapeVisite[] = [
  {
    cible: titre('aujourdhui'),
    titre: 'Une idée à la fois',
    texte:
      "Cet écran ne propose qu'un plat : celui du moment. Pas de liste à trier, pas de note, pas de classement.",
    attendu: { type: 'lecture' },
  },
  {
    cible: 'article[data-visite="carte-plat"]',
    titre: 'Le plat proposé',
    texte: "Voilà la proposition. Le temps de préparation et les ingrédients principaux sont dessus.",
    attendu: { type: 'lecture' },
  },
  {
    // ⚠️ ÉTAPE À GESTE sur les flèches, et non « lecture » : le retour d'essai disait « il ne doit
    // pas que informer, mais inciter à utiliser ». Changer de plat est le geste central de l'écran ;
    // le faire une fois vaut mieux que le lire.
    cible: 'div[data-visite="fleches"]',
    titre: 'Ça ne vous dit rien ?',
    texte: "Touchez la flèche pour voir la proposition suivante. Vous pouvez en passer autant que vous voulez.",
    attendu: { type: 'clic', cible: 'div[data-visite="fleches"]' },
  },
  {
    cible: cible('envie'),
    titre: 'Vous savez ce que vous voulez ?',
    texte:
      "Dites-le ici — quelque chose de rapide, de léger, de chaud — et les propositions suivantes en tiendront compte.",
    attendu: { type: 'lecture' },
  },
  {
    cible: `a[href="${hashDuFrigo()}"]`,
    titre: "Partir de ce que vous avez",
    texte:
      "Si le frigo commande, passez par ici : vous dites ce que vous avez, on cherche ce qui se fait avec.",
    attendu: { type: 'lecture' },
  },
]

// --- 3. Cette semaine ---------------------------------------------------------------------------

const ETAPES_SEMAINE: readonly EtapeVisite[] = [
  {
    cible: titre('semaine'),
    titre: 'Toute la semaine d’un coup',
    texte:
      "Ici, on ne choisit pas repas par repas : l'application compose la semaine entière, et vous ajustez ce qui ne va pas.",
    attendu: { type: 'lecture' },
  },
  {
    // Conditionnelle : n'existe qu'à l'état « vide ». Sautée dès qu'un plan est enregistré, et
    // c'est correct — on ne compose pas une semaine qui existe déjà.
    cible: cible('composer-semaine'),
    titre: 'Composer la semaine',
    texte: "Touchez ce bouton : l'application remplit les jours à venir, en tenant compte de vos allergies.",
    attendu: { type: 'clic', cible: cible('composer-semaine') },
  },
  {
    // Conditionnelle inverse de la précédente : n'existe qu'une fois un plan composé.
    cible: cible('autre-semaine'),
    titre: 'La semaine ne vous plaît pas ?',
    texte: "Demandez-en une autre. Les repas que vous avez gardés ne bougeront pas.",
    attendu: { type: 'lecture' },
  },
  {
    cible: `a[href="${hashDe('courses')}"]`,
    titre: 'Et ensuite, les courses',
    texte: "Une fois la semaine faite, votre liste de courses en découle toute seule. Rien à recopier.",
    attendu: { type: 'lecture' },
  },
]

// --- 4. Mes courses -----------------------------------------------------------------------------

const ETAPES_COURSES: readonly EtapeVisite[] = [
  {
    cible: titre('courses'),
    titre: 'La liste se fait toute seule',
    texte:
      "Cette liste vient de votre semaine. Vous n'avez rien à y recopier : elle se refait quand la semaine change.",
    attendu: { type: 'lecture' },
  },
  {
    // Conditionnelle : sur un compte neuf, l'écran ne contient QUE ce lien. C'est donc l'étape la
    // plus utile là, et elle disparaît dès qu'un plan existe.
    cible: `a[href="${hashDe('semaine')}"]`,
    titre: 'Il faut une semaine d’abord',
    texte: "Sans semaine composée, il n'y a rien à acheter. Touchez ce lien pour en faire une.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('ranger-courses'),
    titre: 'Ranger comme vous marchez',
    texte:
      "Par rayon pour suivre le magasin, par repas ou par jour si vous préférez. Le rangement ne change rien à la liste.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('ajouter-article'),
    titre: 'Ajouter ce qui manque',
    texte:
      "Lessive, pain, ce que vous voulez. Si c'est un aliment, commencez à l'écrire : l'application propose la suite et devine le rayon.",
    attendu: { type: 'lecture' },
  },
]

// --- 5. Recettes --------------------------------------------------------------------------------

const ETAPES_RECETTES: readonly EtapeVisite[] = [
  {
    cible: titre('recettes'),
    titre: 'Chercher, pas se faire proposer',
    texte:
      "Ici, rien n'est classé par goût : les recettes sortent dans l'ordre. Quand vous cherchez un plat précis, c'est ce qu'il faut.",
    attendu: { type: 'lecture' },
  },
  {
    // ⚠️ §2.D — capacité EXISTANTE et non trouvée pendant l'essai : la recherche indexe déjà les
    // ingrédients. Le libellé a été corrigé depuis, cette étape est la seconde ceinture.
    cible: cible('recherche-recettes'),
    titre: 'Un plat, ou un ingrédient',
    texte:
      "Tapez « blanquette » si vous savez ce que vous voulez. Tapez « poulet » et vous aurez tous les plats qui en contiennent, même sans le nommer.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('filtre-cuisine'),
    titre: 'Réduire la liste',
    texte:
      "Touchez une pastille pour ne garder que ce type de cuisine. Le nombre à côté dit combien de recettes restent.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('favoris'),
    titre: 'Vos favoris',
    texte: "Les plats que vous marquez se retrouvent ici, sans avoir à les rechercher.",
    attendu: { type: 'lecture' },
  },
  {
    cible: `a[href="${hashDeLEditeur(null)}"]`,
    titre: 'Vos propres recettes',
    texte: "Vous pouvez écrire les vôtres. Elles se mélangent aux autres et comptent dans vos semaines.",
    attendu: { type: 'lecture' },
  },
]

// --- 6. Vider le frigo --------------------------------------------------------------------------

const ETAPES_FRIGO: readonly EtapeVisite[] = [
  {
    cible: titre('frigo'),
    titre: 'Partir de ce que vous avez',
    texte:
      "L'inverse du reste de l'application : ici, on ne cherche pas une envie, on part de ce qui est déjà chez vous.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('ajout-aliment'),
    titre: 'Dites ce que vous avez',
    texte:
      "Écrivez les premières lettres d'un aliment, l'application propose la suite. Deux ou trois suffisent pour commencer.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('ajout-rapide'),
    titre: 'Plus vite',
    texte: "Les aliments courants sont rangés par famille : touchez-les au lieu de les écrire.",
    attendu: { type: 'lecture' },
  },
  {
    // Conditionnelle : n'existe qu'une fois le garde-manger non vide.
    cible: cible('sans-rien-acheter'),
    titre: 'Sans rien acheter',
    texte:
      "Ne garder que les plats faisables avec ce que vous avez, ou voir aussi ceux à qui il manque une chose ou deux.",
    attendu: { type: 'lecture' },
  },
  {
    cible: titre('frigo'),
    titre: 'Ce que ça change ailleurs',
    texte:
      "Ce que vous déclarez ici est retiré de votre liste de courses, dans une partie « Déjà chez vous » — rien ne disparaît en douce.",
    attendu: { type: 'lecture' },
  },
]

// --- 7. Savoir ----------------------------------------------------------------------------------

/**
 * ⚠️ LE SEUL PARCOURS QUI DÉCRIT UN CONTENU SOUMIS À §6 ARCHITECTURE, section contraignante. Chaque
 * phrase reste DESCRIPTIVE — « l'application dit d'où vient l'information », jamais « mangez ceci ».
 * Le lexique banni de §6.2 est une correspondance de SOUS-CHAÎNE après retrait des accents : y écrire
 * « traitement » déclencherait le refus par « traite ». Relire `engine/guards/banned-terms.ts` avant
 * de reformuler quoi que ce soit ici.
 */
const ETAPES_SAVOIR: readonly EtapeVisite[] = [
  {
    cible: titre('savoir'),
    titre: 'Pour comprendre, pas pour décider à votre place',
    texte:
      "Cet onglet explique. Il ne vous dira jamais quoi manger, ne vous fixe aucun objectif et ne suit rien de ce que vous faites.",
    attendu: { type: 'lecture' },
  },
  {
    // ⚠️ Cible RÉELLE et déjà stable (`aria-label`) : inutile d'y poser un `data-visite` de plus.
    // Conditionnelle en théorie — sautée si le catalogue n'a aucun fait —, mais il en compte 73.
    cible: 'button[aria-label="Fait suivant"]',
    titre: 'Le saviez-vous ?',
    texte:
      "Des faits courts sur les aliments, un par un. Touchez la flèche pour passer au suivant — il y en a plusieurs dizaines.",
    attendu: { type: 'clic', cible: 'button[aria-label="Fait suivant"]' },
  },
  {
    cible: cible('recherche-gestes'),
    titre: 'Les gestes de cuisine',
    texte:
      "« Chemiser », « blanchir », « émincer » : cherchez un mot croisé dans une recette et vous aurez ce qu'il veut dire. La recherche regarde aussi les définitions, si vous ne connaissez pas le mot.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('preuve-forte'),
    titre: 'Ce qui est solide, ce qui l’est moins',
    texte:
      "Chaque affirmation dit sur quoi elle repose. Cochez cette case pour ne garder que les mieux établies — l'application vous dit alors combien de chapitres elle a masqués.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('sources-limites'),
    titre: 'D’où vient tout ça',
    texte:
      "Les valeurs nutritionnelles viennent de la table CIQUAL de l'ANSES, importées telles quelles. Et ce que l'application ne fait pas est écrit ici, noir sur blanc.",
    attendu: { type: 'lecture' },
  },
]

// --- 8. Composer une recette --------------------------------------------------------------------

const ETAPES_COMPOSER: readonly EtapeVisite[] = [
  {
    cible: titre('composer'),
    titre: 'Votre recette à vous',
    texte:
      "Ce que vous écrivez ici reste chez vous, et compte comme les autres : dans les recherches, et dans vos semaines.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('nom-du-plat'),
    titre: 'Le nom, d’abord',
    texte: "C'est la seule chose vraiment obligatoire. Le reste peut venir plus tard.",
    attendu: { type: 'lecture' },
  },
  {
    // ⚠️ §2.D — la complétion EXISTE et n'a pas été trouvée pendant l'essai (« trouvé mais pas de
    // complétion »). La cause reste inconnue et à reproduire sur appareil ; cette étape ne la
    // corrige pas, elle la rend au moins visible.
    cible: cible('ajout-ingredient'),
    titre: 'Les ingrédients',
    texte:
      "Écrivez au moins deux lettres — « cour », « poul » — et l'application propose les aliments qu'elle connaît. Choisissez dans la liste.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('enregistrer-recette'),
    titre: 'Enregistrer',
    texte:
      "Le bouton s'active quand il ne manque plus rien d'indispensable. Vous pourrez modifier la recette après coup.",
    attendu: { type: 'lecture' },
  },
]

// --- 8. Réglages --------------------------------------------------------------------------------

/**
 * ⚠️ L'ÉTAPE D'OUVERTURE DU PANNEAU EST OBLIGATOIRE ET DOIT PRÉCÉDER. Le réglage de balayage vit
 * DANS la fenêtre « Réglages d'affichage » : sa cible n'existe pas tant que la fenêtre est fermée, et
 * sans le clic préalable l'étape serait sautée à chaque fois — un tutoriel qui n'enseigne rien, sans
 * que rien ne le signale. C'est précisément la fonction que l'essai téléphone a désignée comme
 * introuvable (§2.D : « le problème est l'emplacement »).
 */
const ETAPES_REGLAGES: readonly EtapeVisite[] = [
  {
    cible: titre('parametres'),
    titre: 'Tout est modifiable',
    texte: "Rien de ce que vous avez répondu au début n'est figé. Tout se change ici, à tout moment.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('allergies'),
    titre: 'Vos allergies',
    texte:
      "C'est le réglage le plus important : les aliments déclarés ici sont écartés de toutes les propositions, sans exception.",
    attendu: { type: 'lecture' },
  },
  {
    cible: cible('reglages-affichage'),
    titre: 'Les réglages d’affichage',
    texte: "Touchez cette ligne : elle cache deux réglages que peu de gens trouvent tout seuls.",
    attendu: { type: 'clic', cible: cible('reglages-affichage') },
  },
  {
    cible: cible('geste-balayage'),
    titre: 'Changer de plat en balayant',
    texte:
      "Si vous préférez faire glisser le doigt plutôt que toucher les flèches, c'est ici. Les flèches restent là dans tous les cas.",
    attendu: { type: 'lecture' },
  },
]

// --- La table -----------------------------------------------------------------------------------

/**
 * Les neuf parcours : un par écran, plus « menus » qui les traverse.
 *
 * ⚠️ L'ORDRE EST CELUI DU PARCOURS D'USAGE, pas celui des onglets : on découvre les menus, puis le
 * plat du jour, puis la semaine qu'il alimente, puis les courses qui en découlent. C'est aussi
 * l'ordre dans lequel Réglages les liste — une liste triée par autre chose demanderait à
 * l'utilisateur de savoir par où commencer.
 *
 * ⛔ LE MODE CUISINE N'EN A PAS, ET C'EST UNE DÉCISION, PAS UN OUBLI (tranchée le 2026-08-07 ;
 * `CONCEPTION_MODE_CUISINE.md` §4.1 la portait comme « à trancher » depuis L1). La raison n'est pas
 * esthétique, elle est mécanique :
 *
 *   `lancerParcours` (main.tsx) NAVIGUE vers `parcours.ecran` quand on choisit un tutoriel depuis la
 *   fenêtre « Revoir un tutoriel » de Réglages. Pour le mode cuisine, `ecran` devrait être un
 *   `#/cuisine/<id>` en dur — et OUVRIR CET ÉCRAN ÉCRIT EN BASE : `user_cuisine_session` ne tient
 *   qu'une ligne (`id = 1`), donc une cuisson en cours sur une autre recette serait REMPLACÉE. Un
 *   tutoriel qui détruit une cuisson en cours est disqualifié, quel que soit son contenu.
 *
 * Et `ecran: null` (la forme de « menus ») ne sauve rien : la cible de la première étape ne
 * résoudrait alors sur aucun écran, toutes les étapes seraient sautées, et l'on obtiendrait
 * exactement le tutoriel fantôme que la règle 1 de l'en-tête existe pour empêcher.
 *
 * La ligne qui en découle, et qui vaut aussi pour la fiche recette : **un parcours par écran
 * atteignable depuis la barre d'onglets.** La fiche recette et le mode cuisine s'atteignent depuis
 * un contenu, pas depuis la barre — ni l'une ni l'autre n'a de parcours, pour le même motif. Le mode
 * cuisine se découvre là où l'on y entre : le bouton « Cuisiner pas à pas » de la fiche.
 */
/**
 * Le tutoriel de PREMIÈRE OUVERTURE : celui qui traverse les menus en entrant dans chacun.
 *
 * ⛔ ENTRELACÉ, PAS CONCATÉNÉ, ET LA DIFFÉRENCE N'EST PAS ESTHÉTIQUE. Une étape de transition, puis
 * le bloc de l'écran où elle mène, puis la transition suivante. Mettre les cinq transitions d'abord
 * et les cinq blocs ensuite donne le même compte (29) et les mêmes objets — et un tutoriel MORT :
 * les cibles de Semaine ne sont pas dans le DOM tant qu'on est sur Aujourd'hui, `premierIndexValide`
 * les écarte toutes, et la visite s'arrête après le premier bloc. **Mesuré le 2026-08-21** : cette
 * erreur-là fait 4 rouges sur 10 dans `tests/scelles/retour-1b.test.tsx`.
 *
 * ⚠️ LES ÉTAPES SONT LES MÊMES OBJETS que ceux des parcours d'écran, jamais des copies : un texte
 * recopié divergerait au premier lot de contenu. C'est vérifié par identité (`toBe`), pas par
 * égalité.
 *
 * ⚠️ LE FRIGO, L'ÉDITEUR ET LES RÉGLAGES N'Y SONT PAS, et ce n'est pas un oubli : ce parcours suit
 * la BARRE D'ONGLETS, qui en compte cinq. Les trois autres écrans gardent leur tutoriel propre,
 * atteignable depuis « Revoir un tutoriel ».
 */
const ETAPES_DECOUVERTE: readonly EtapeVisite[] = [
  ETAPES_MENUS[0] as EtapeVisite,
  ETAPE_VERS_AUJOURDHUI,
  ...ETAPES_AUJOURDHUI,
  ETAPES_MENUS[1] as EtapeVisite,
  ...ETAPES_SEMAINE,
  ETAPES_MENUS[2] as EtapeVisite,
  ...ETAPES_COURSES,
  ETAPES_MENUS[3] as EtapeVisite,
  ...ETAPES_RECETTES,
  ETAPES_MENUS[4] as EtapeVisite,
  ...ETAPES_SAVOIR,
]

export const PARCOURS: readonly Parcours[] = [
  /* ⚠️ EN TÊTE DE TABLE, ET C'EST L'ORDRE D'USAGE : c'est le tutoriel qu'on voit en premier, le jour
     de la première ouverture. `ecran: null` comme « menus » — il n'appartient à aucun écran puisqu'il
     les traverse tous. ⛔ NE PAS LUI DONNER `hashDe('aujourdhui')` « pour qu'il y navigue » :
     `parcours.test.tsx` exige que chaque `ecran` NON NUL soit unique, et Aujourd'hui a déjà le sien. */
  { id: 'decouverte', titre: 'Découvrir l’application', ecran: null, etapes: ETAPES_DECOUVERTE },
  { id: 'menus', titre: 'Découvrir les menus', ecran: null, etapes: ETAPES_MENUS },
  { id: 'aujourdhui', titre: 'Aujourd’hui', ecran: hashDe('aujourdhui'), etapes: ETAPES_AUJOURDHUI },
  { id: 'semaine', titre: 'Cette semaine', ecran: hashDe('semaine'), etapes: ETAPES_SEMAINE },
  { id: 'courses', titre: 'Mes courses', ecran: hashDe('courses'), etapes: ETAPES_COURSES },
  { id: 'recettes', titre: 'Recettes', ecran: hashDe('recettes'), etapes: ETAPES_RECETTES },
  { id: 'savoir', titre: 'Savoir', ecran: hashDe('savoir'), etapes: ETAPES_SAVOIR },
  { id: 'frigo', titre: 'Vider le frigo', ecran: hashDuFrigo(), etapes: ETAPES_FRIGO },
  { id: 'composer', titre: 'Composer une recette', ecran: hashDeLEditeur(null), etapes: ETAPES_COMPOSER },
  { id: 'reglages', titre: 'Réglages', ecran: hashDesParametres(), etapes: ETAPES_REGLAGES },
]

/** Les étapes d'un parcours par son identifiant, ou un tableau vide s'il n'existe pas.
 *
 *  ⚠️ Le paramètre reste `string` À DESSEIN, alors que `Parcours.id` est une union : cette fonction
 *  est aussi appelée avec un identifiant venu de l'extérieur du typage (un test, un futur lien). Le
 *  repli sur un tableau vide est le comportement voulu là — la visite se termine, jamais un plantage.
 *  Les APPELANTS internes, eux, passent par `ParcoursId` et sont vérifiés à la compilation. */
export function etapesDuParcours(id: string): readonly EtapeVisite[] {
  return PARCOURS.find((p) => p.id === id)?.etapes ?? []
}

// ⛔ IL Y AVAIT ICI `parcoursDeLEcran(hash)`, RETIRÉE LE 2026-08-22 — elle n'avait aucun appelant
// depuis sa naissance. Ce n'est pas du ménage de confort : une fonction exportée que personne
// n'appelle se lit comme une API, et elle était un `find` sur `ecran`, donc fausse par construction
// dès que deux parcours partagent un écran (ce qui est le cas depuis `retour-1b` : `menus` et
// `decouverte` valent tous deux `ecran: null`). Elle aurait rendu le premier, en silence.
// ▶ La déduction du parcours depuis la route est un choix DÉJÀ ÉCARTÉ — `lien-tutoriel.tsx` dit
// pourquoi : chaque écran sait quel est le sien et le passe explicitement.
