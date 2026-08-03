// ui/texte-consentement.ts — le texte du premier lancement, et la version qui l'accompagne.
//
// ⚠️ LE TEXTE ET SA VERSION VIVENT DANS LE MÊME FICHIER, EXPRÈS. §6.4 ARCHITECTURE : `consent`
// garde une ligne par version acceptée, et le parcours se rouvre sur une version non acceptée. Un
// texte modifié sans changement de version serait donc accepté RÉTROACTIVEMENT par des gens qui ont
// lu autre chose. Les séparer, c'était rendre l'oubli facile ; côte à côte, on ne modifie pas l'un
// sans voir l'autre.
//
// ⚠️ INCRÉMENTER `VERSION_CONSENTEMENT` ROUVRE LE PARCOURS pour tout le monde, y compris ceux qui
// utilisent l'application depuis longtemps. C'est voulu — et c'est ce qui rend obligatoire de partir
// de l'existant à l'écran (`ui/profil-enregistre.ts`) : sans ça, retraverser l'accueil viderait
// `user_allergy`.
//
// Fichier sans JSX : il est ainsi testable sans monter React (`texte-consentement.test.ts` le
// confronte à `BANNED_TERMS`).

/** Version du texte ci-dessous. À incrémenter à CHAQUE modification, résumé, explication ou détail. */
export const VERSION_CONSENTEMENT = 'accueil-2026-08-02'

export interface PointConsentement {
  readonly resume: string
  /**
   * Une ligne, TOUJOURS VISIBLE, sous le résumé — demandée après l'essai sur téléphone
   * (« petit mais complet »).
   *
   * ⚠️ ELLE N'EST PAS UN RÉSUMÉ DU DÉTAIL, ELLE EST LE MINIMUM SUFFISANT. Le repli existait pour la
   * lisibilité, mais un résumé de six mots au-dessus d'un bouton « Lire » demande de faire confiance
   * pour savoir de quoi on parle : on cochait « J'ai lu et compris » en ayant lu quatre titres. Cette
   * ligne doit donc suffire à comprendre l'engagement SANS déplier — le détail reste là pour qui veut
   * tout, il n'est plus la seule voie vers le sens.
   */
  readonly explication: string
  readonly detail: readonly string[]
}

/**
 * Les quatre points du premier lancement.
 *
 * ⚠️ LE DÉTAIL EST ATTEIGNABLE AVANT D'ACCEPTER, jamais après. C'est la condition pour que le
 * consentement en soit un : un résumé qu'on ne peut pas déplier avant de cocher ne vaut rien. Le
 * repli sert la lisibilité — quatre pavés de texte ne se lisent pas — pas la dissimulation.
 *
 * ⚠️ CES PROMESSES ENGAGENT LE PRODUIT. « Gratuite, sans publicité, aucune vente de données, aucune
 * recette sponsorisée » n'est pas une formule commerciale : c'est §2 STRATEGIE_DISTRIBUTION,
 * « 100 % gratuit, sans pub, sans tracking, 100 % local — confirmé ». Le jour où le modèle
 * changerait, ce texte devrait changer d'abord.
 *
 * ⚠️ LE POINT SANTÉ NE PEUT PAS ÊTRE SUPPRIMÉ. §6 ARCHITECTURE est une section contraignante qui
 * conditionne la légalité du produit dans l'UE. Il peut être reformulé — mais « ne pose aucun
 * diagnostic, ne connaît pas votre état de santé, ne vous demande rien à ce sujet » n'est pas de
 * l'habillage : c'est ce qui maintient l'application dans le modèle « encyclopédie » de §6.1, donc
 * hors du champ « dispositif médical » (UE 2017/745) et hors de l'article 9 du RGPD.
 */
export const POINTS_CONSENTEMENT: readonly PointConsentement[] = [
  {
    resume: 'Vos données ne quittent pas cet appareil.',
    explication:
      'Pas de compte, pas de serveur, pas de traceur : tout est enregistré dans la mémoire de votre téléphone, et rien n’en sort.',
    detail: [
      'Il n’y a pas de compte à créer, pas de mot de passe à retenir, pas d’adresse à donner. Vous ouvrez l’application, et elle fonctionne.',
      'Il n’y a pas non plus de serveur derrière. Tout ce que vous faites ici — vos allergies, vos goûts, vos repas de la semaine, votre liste de courses — est enregistré dans la mémoire de votre téléphone, et n’en sort jamais. Rien n’est envoyé à personne : ni à des entreprises, ni à moi qui l’ai écrite.',
      'Aucune mesure d’audience, aucun traceur, aucun cookie publicitaire. Je ne sais pas combien de personnes se servent de cette application, ni ce qu’elles y cherchent, ni ce qu’elles mangent. C’est volontaire : ce qui n’est pas collecté ne peut ni fuiter, ni être revendu, ni m’être réclamé un jour.',
      'La contrepartie mérite d’être dite franchement : si vous changez de téléphone ou désinstallez l’application, vos réglages partent avec. Il n’y a pas de sauvegarde ailleurs, puisqu’il n’y a pas d’ailleurs.',
    ],
  },
  {
    resume: 'Une aide pour cuisiner, pas un avis médical.',
    explication:
      'Elle propose des repas et cite ses sources. Elle ne pose aucun diagnostic, ne connaît pas votre état de santé et ne vous demande rien à ce sujet.',
    detail: [
      'Cette application vous propose des idées de repas et met à votre disposition des chapitres d’information sur les aliments. C’est ce qu’elle sait faire, et elle s’y tient.',
      'Elle ne pose aucun diagnostic. Elle ne connaît pas votre état de santé, et elle ne vous demande rien à ce sujet — ni maladie, ni ordonnance, ni résultat d’analyse. Ces questions ne la regardent pas, et elle est construite pour ne pas pouvoir y répondre.',
      'Pour tout ce qui touche à votre santé, la bonne personne à qui parler est un médecin, un pharmacien ou un diététicien : quelqu’un qui vous connaît et qui peut vous répondre à vous.',
      'Quand vous lisez ici une affirmation sur un aliment, sa source est indiquée. Vous pouvez toujours remonter jusqu’à elle et vous faire votre propre idée — c’est même l’usage auquel ces pages sont destinées.',
    ],
  },
  {
    resume: 'Gratuite, sans publicité, sans rien à vendre.',
    explication:
      'Rien à acheter, aucune publicité, aucune recette sponsorisée — et aucune donnée transmise à qui que ce soit, puisqu’il n’y en a pas qui sorte d’ici.',
    detail: [
      'Gratuite veut dire gratuite. Il n’y a rien à acheter, rien à débloquer, pas de version « premium » qui attendrait son heure, pas de période d’essai qui se termine un matin.',
      'Aucune publicité ne s’affichera ici. Aucune donnée n’est vendue — il n’y en a pas à vendre, elles ne quittent pas votre téléphone.',
      'Et aucune recette n’est sponsorisée. Personne ne paie pour qu’un produit ou une marque remonte dans vos suggestions. Ce que l’application vous propose ne dépend que de ce que vous lui avez dit, jamais de ce que quelqu’un aurait payé.',
    ],
  },
  {
    resume: 'Faite par une seule personne.',
    explication:
      'Un développeur indépendant, seul, sans entreprise ni investisseur : personne à qui rendre des comptes, donc aucune raison de faire commerce de vous.',
    detail: [
      'Cette application est écrite par un développeur indépendant, seul, sur son temps. Il n’y a ni entreprise derrière, ni investisseur à rembourser, ni objectif de croissance à tenir.',
      'C’est précisément ce qui rend les trois promesses précédentes tenables : sans personne à qui rendre des comptes, il n’y a aucune raison de faire commerce de vous.',
      'Cela veut dire aussi que les choses avancent au rythme d’une seule personne, et qu’il y aura des maladresses. Si vous en croisez une, ou s’il vous manque quelque chose, écrivez-moi : les coordonnées sont dans Paramètres, section « À propos ».',
    ],
  },
]
