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

/** Version du texte ci-dessous. À incrémenter à CHAQUE modification, résumé ou détail. */
export const VERSION_CONSENTEMENT = 'accueil-2026-07-31'

export interface PointConsentement {
  readonly resume: string
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
    detail: [
      'Aucun compte à créer. Aucun serveur. Rien n’est envoyé à personne — ni à des tiers, ni à moi.',
      'Aucune mesure d’audience, aucun traceur, rien à récupérer.',
      'Seuls vos réglages et vos choix restent dans l’application, sur votre téléphone.',
    ],
  },
  {
    resume: 'Une aide pour cuisiner, pas un avis médical.',
    detail: [
      'L’application propose des repas et met à disposition des chapitres d’information. Elle ne pose aucun diagnostic, ne connaît pas votre état de santé, et ne vous demande rien à ce sujet.',
      'Pour toute question qui concerne votre santé, adressez-vous à un professionnel.',
      'En cas de doute sur ce que vous lisez ici : les sources sont toujours citées.',
    ],
  },
  {
    resume: 'Gratuite et indépendante.',
    detail: [
      'Pas de publicité. Aucune vente de données. Aucune recette sponsorisée ni placée par une marque.',
      'Rien à acheter, rien à débloquer, aucune version payante.',
    ],
  },
  {
    resume: 'Faite par une seule personne.',
    detail: [
      'Un développeur indépendant, seul, qui fait passer les gens qui l’utilisent avant le reste.',
      'Ses coordonnées sont dans Paramètres, section « À propos ».',
    ],
  },
]
