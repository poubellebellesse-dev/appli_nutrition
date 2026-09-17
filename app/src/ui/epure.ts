// ui/epure.ts — les quatre interrupteurs de l'épure (lot B, décision 2.c de CONCEPTION_RETOURS_APK).
//
// LE DÉFAUT QU'ILS CORRIGENT. L'écran disait trop : le moteur expliquait chaque plat retenu, chaque
// écran rassurait sur ce qu'il ne fait pas, une ligne annonçait des valeurs nutritionnelles sans en
// afficher aucune, une jauge redisait en couleur ce qu'une phrase venait de dire en chiffres. Rien
// de tout cela n'était faux ; tout cela était de l'encombrement. C'est le retour le plus répété de
// la passe à l'œil sur l'APK.
//
// ⭐ MASQUER, JAMAIS SUPPRIMER. Chaque bloc retiré reste dans le code, derrière l'interrupteur qui
//    le nomme. Rallumer tient en UNE ligne, ici, et le bloc revient — ce n'est pas une promesse de
//    commentaire : `tests/scelles/lot-B.test.tsx` retourne les quatre à l'exécution et redemande le
//    texte (clauses 5c, 5d, 8e, 8f). Un texte effacé en dur ne reviendrait pas, et elles rougiraient.
//
// ⛔ QUATRE `boolean` MUTABLES. NI `as const`, NI `Object.freeze`, NI `readonly`.
//    Ce n'est pas un oubli de rigueur, c'est la condition de la preuve ci-dessus : un objet gelé
//    ferait lever les clauses de retour au lieu de les faire mesurer quoi que ce soit. Le premier
//    tour d'attaque du brief a montré qu'une épure qui SUPPRIME passait toutes les clauses tant que
//    ce fichier n'était pas retournable — trois interrupteurs sur quatre ne reposaient sur rien.
//
// ⚠️ UN SEUL FICHIER. Aucun autre module de `app/src` ne déclare d'interrupteur d'épure ; la clause
//    1b balaie l'arborescence pour le refuser. Vingt conditions dispersées ne se rallument pas.
//
// ⚠️ CES QUATRE-LÀ NE SONT PAS DES RÉGLAGES UTILISATEUR — sauf `explicationsMoteur`, qui est DOUBLÉ
//    d'un réglage persisté (`afficherExplications`, colonne `user_display.afficher_explications`,
//    décision 2.a). L'interrupteur décide de ce que l'application montre par défaut ; le réglage
//    décide de ce que CET utilisateur-là veut revoir. Les trois autres se rallument en éditant ce
//    fichier, et c'est volontaire : ils n'ont pas mérité une ligne de plus dans Paramètres.

/** Les quatre interrupteurs de l'épure. Voir l'en-tête : mutables, exprès. */
export interface Epure {
  /**
   * Les libellés d'explication sous un plat (`EXPLANATION_LABELS`), « N ingrédients sur M déjà chez
   * vous — soit X % du poids du plat », « N plats retenus ces 21 derniers jours ».
   *
   * ⚠️ Le moteur continue de les CALCULER : `engine/selection/explain.ts` n'est pas touché, et le
   * principe 3 (toute suggestion s'explique en une phrase) reste tenu — c'est l'affichage qui se
   * tait par défaut, pas le raisonnement qui disparaît. Le réglage `afficherExplications` les rend.
   */
  explicationsMoteur: boolean
  /**
   * Les six phrases de réassurance : « Tout se modifie à tout moment. Rien n'est envoyé nulle
   * part. » · « L'écran reste allumé pendant la cuisson. » · « Vos repas gardés ne changeront
   * pas. » · la mention d'origine d'une recette · « Ajoutez ce qu'il vous reste. On cherche des
   * plats à faire avec. » · « Rien n'est obligatoire. Ce que vous indiquez ne vaut que pour ce
   * repas. »
   *
   * ⛔ NE COMMANDE AUCUN AVERTISSEMENT. Les textes sanitaires et de souveraineté de « Savoir », le
   * texte de consentement, « Un repas sans heure n'est jamais rappelé », l'avertissement de liste
   * coupée du frigo et celui d'énergie de la semaine ressemblent à de la réassurance et n'en sont
   * pas : le principe 1 passe avant l'épure. Les gardes A, B et C du test les protègent.
   */
  phrasesRassurantes: boolean
  /**
   * La ligne « Valeurs nutritionnelles » de la fiche recette TANT QUE `afficherMacros` est décoché
   * — celle qui n'affichait aucun chiffre et disait « Non affichées ».
   *
   * ⚠️ DISTINCT DE `afficherMacros`, QUI EXISTAIT AVANT LE LOT. Allumé, la ligne revient même macros
   * décochées. Les deux ensemble font une table de vérité que la clause 8e épuise.
   */
  valeursNutritionnelles: boolean
  /**
   * La barre de couverture du frigo et le nombre brut de recettes trouvées.
   *
   * ⛔ PAS L'AVERTISSEMENT DE TRONCATURE. « — les 30 mieux couvertes sont affichées » et « aucune
   * recette ne correspond à ce que vous avez » restent : sans eux une liste coupée ou vide passe
   * pour un bug, et `frigo.tsx` porte le commentaire qui dit que c'est déjà arrivé.
   */
  jaugesEtCompteurs: boolean
}

export const epure: Epure = {
  explicationsMoteur: false,
  phrasesRassurantes: false,
  valeursNutritionnelles: false,
  jaugesEtCompteurs: false,
}
