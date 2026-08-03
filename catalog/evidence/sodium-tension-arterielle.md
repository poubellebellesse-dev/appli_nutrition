---
code: sodium-tension-arterielle
titre: "Faut-il manger moins de sel ?"
categorie: nutriments
niveau_preuve: forte
date_revue: 2026-07-31
liens:
  - { cible_type: nutrient, cible_id: sodium }

positions:
  - id: consensus-tension
    niveau_preuve: forte
    porte_par: "OMS, EFSA, ANSES, revues Cochrane et BMJ"
    affirmation: "Réduire le sodium fait baisser la pression artérielle, nettement chez les personnes hypertendues."
    detail: |
      C'est le point sur lequel les travaux les plus opposés se rejoignent. La revue systématique du
      BMJ (2013) et la revue Cochrane (2020), qui divergent sur presque tout le reste, mesurent
      toutes deux une baisse. Chez les participants hypertendus, Cochrane rapporte −5,71 mmHg de
      systolique et −2,87 mmHg de diastolique pour un passage de 203 à 65 mmol de sodium par jour.
      Le BMJ associe en outre la réduction à une diminution du risque d'accident vasculaire cérébral,
      sans effet défavorable observé sur les lipides sanguins ni la fonction rénale.
    sources: [aburto-2013, graudal-2020, oms-sodium]

  - id: cible-autorites
    niveau_preuve: forte
    porte_par: "OMS, EFSA, ANSES"
    affirmation: "Les autorités de santé situent la cible autour de 2 g de sodium par jour, soit 5 g de sel."
    detail: |
      L'OMS recommande moins de 2 000 mg de sodium par jour chez l'adulte. L'EFSA retient 2,0 g/j
      comme apport « sûr et adéquat » pour la population adulte de l'Union européenne, faute de
      données suffisantes pour établir un besoin moyen. En France, les objectifs du PNNS cités par
      l'ANSES sont exprimés en sel : 8 g/j chez l'homme adulte et 6,5 g/j chez la femme — des repères
      plus hauts que la cible de l'OMS, calés sur la consommation réellement observée.
    sources: [oms-sodium, efsa-2019, anses-sel]

  - id: cochrane-normotendus
    niveau_preuve: moderee
    porte_par: "Revue Cochrane (Graudal et coll., 2020)"
    affirmation: "Chez les personnes dont la tension est normale, l'effet mesuré est très faible, et la restriction déplace d'autres marqueurs."
    detail: |
      Sur la même réduction de sodium, Cochrane mesure −1,14 mmHg de systolique et −0,01 mmHg de
      diastolique chez les participants normotendus. La revue relève par ailleurs une hausse de la
      rénine, de l'aldostérone, du cholestérol et des triglycérides, et ses auteurs jugent ces
      variations « plus constantes que l'effet sur la pression artérielle ».
      Ce que cette position ne dit pas : la portée clinique de ces marqueurs reste débattue. Ce sont
      des grandeurs biologiques intermédiaires, pas des événements de santé mesurés.
    sources: [graudal-2020]

  - id: pure-seuil
    niveau_preuve: faible
    porte_par: "Étude PURE (Mente et coll., 2018) — analyse contestée"
    affirmation: "Une grande cohorte n'observe d'association avec les maladies cardiovasculaires qu'au-delà de 5 g de sodium par jour."
    detail: |
      PURE a suivi 95 767 participants dans 18 pays, avec un suivi médian de 8,1 ans. Les auteurs
      concluent à une association seulement dans les communautés dont l'apport moyen dépasse 5 g/j,
      et proposent d'y concentrer les efforts plutôt que de viser la population entière.
      ⚠️ Cette analyse est contestée dans la même revue. Messerli et coll. relèvent que le sodium y
      est estimé à partir d'un seul recueil d'urine ponctuel, via la formule de Kawasaki, dont les
      erreurs suffisent selon eux à produire la courbe observée. Le niveau de preuve reste « faible »
      pour cette raison : cohorte observationnelle, exposition mesurée indirectement.
    sources: [mente-2018, messerli-2018]

  - id: zone-de-debat
    niveau_preuve: forte
    porte_par: "Lecture croisée des positions ci-dessus"
    affirmation: "Le désaccord porte sur une zone étroite, et la consommation française moyenne tombe dedans."
    detail: |
      1 g de sodium équivaut à 2,5 g de sel. La cible des autorités (2 g de sodium) vaut donc 5 g de
      sel, et le seuil au-delà duquel PURE observe une association (5 g de sodium) vaut environ
      12,5 g de sel.
      L'ANSES relève en France 8,7 g de sel par jour chez l'homme et 6,7 g chez la femme au titre des
      aliments seuls, avant le sel ajouté à table et à la cuisson (1 à 2 g) — soit environ 3,4 et
      2,6 g de sodium. Ces apports se situent au-dessus de la cible des autorités et en dessous du
      seuil de PURE : précisément dans l'intervalle où les positions divergent.
    sources: [anses-sel, oms-sodium, mente-2018]

sources:
  - id: oms-sodium
    titre_etude: "Sodium reduction"
    auteurs: "Organisation mondiale de la santé"
    annee: 2026
    revue: "OMS — aide-mémoire, mis à jour le 11 mai 2026"
    doi: null
    url: "https://www.who.int/news-room/fact-sheets/detail/sodium-reduction"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31

  - id: efsa-2019
    titre_etude: "Dietary reference values for sodium"
    auteurs: "EFSA Panel on Nutrition, Novel Foods and Food Allergens (NDA)"
    annee: 2019
    revue: "EFSA Journal 17(9):5778"
    doi: "10.2903/j.efsa.2019.5778"
    url: "https://doi.org/10.2903/j.efsa.2019.5778"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31

  # ⚠️ URL de la version ANGLAISE du dossier : c'est celle que j'ai pu ouvrir et vérifier.
  # L'équivalent français existe probablement sous un autre slug — à remplacer après vérification.
  - id: anses-sel
    titre_etude: "Salt"
    auteurs: "ANSES — Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail"
    annee: 2022
    revue: "ANSES — dossier, mis à jour le 03/11/2022"
    doi: null
    url: "https://www.anses.fr/en/content/salt"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31

  - id: aburto-2013
    titre_etude: "Effect of lower sodium intake on health: systematic review and meta-analyses"
    auteurs: "Aburto NJ, Ziolkovska A, Hooper L, Elliott P, Cappuccio FP, Meerpohl JJ"
    annee: 2013
    revue: "BMJ 346:f1326"
    doi: "10.1136/bmj.f1326"
    url: "https://doi.org/10.1136/bmj.f1326"
    type_etude: meta_analyse
    effectif: null
    consulte_le: 2026-07-31

  - id: graudal-2020
    titre_etude: "Effects of low sodium diet versus high sodium diet on blood pressure, renin, aldosterone, catecholamines, cholesterol, and triglyceride"
    auteurs: "Graudal NA, Hubeck-Graudal T, Jurgens G"
    annee: 2020
    revue: "Cochrane Database of Systematic Reviews 2020(12), CD004022"
    doi: "10.1002/14651858.CD004022.pub5"
    url: "https://doi.org/10.1002/14651858.CD004022.pub5"
    type_etude: revue_systematique
    effectif: null
    consulte_le: 2026-07-31

  - id: mente-2018
    titre_etude: "Urinary sodium excretion, blood pressure, cardiovascular disease, and mortality: a community-level prospective epidemiological cohort study"
    auteurs: "Mente A, O'Donnell M, Rangarajan S, et coll."
    annee: 2018
    revue: "The Lancet 392(10146):496-506"
    doi: "10.1016/S0140-6736(18)31376-X"
    url: "https://doi.org/10.1016/S0140-6736(18)31376-X"
    type_etude: cohorte
    effectif: "95 767 participants, 18 pays, suivi médian de 8,1 ans"
    consulte_le: 2026-07-31

  - id: messerli-2018
    titre_etude: "Salt and heart disease: a second round of « bad science »?"
    auteurs: "Messerli FH, Hofstetter L, Bangalore S"
    annee: 2018
    revue: "The Lancet 392(10146):456-458"
    doi: "10.1016/S0140-6736(18)31724-0"
    url: "https://doi.org/10.1016/S0140-6736(18)31724-0"
    type_etude: commentaire_critique
    effectif: null
    consulte_le: 2026-07-31
---

Le sel de table est composé à 40 % de sodium : c'est ce sodium qui agit sur la pression artérielle.

Deux choses ne sont contestées par personne : le sodium fait monter la tension, et les apports
européens dépassent les cibles publiées. Le désaccord porte sur un point précis — jusqu'où descendre,
et pour qui. Les positions ci-dessous sont celles des instances de santé et des revues qui ont
compilé les essais ; elles sont présentées telles qu'elles sont publiées, y compris quand elles se
contredisent.
