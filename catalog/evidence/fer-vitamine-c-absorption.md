---
code: fer-vitamine-c-absorption
titre: "La vitamine C aide-t-elle à absorber le fer des végétaux ?"
categorie: vitamines_mineraux
niveau_preuve: moderee
date_revue: 2026-07-31
liens:
  - { cible_type: nutrient, cible_id: fer }
  - { cible_type: nutrient, cible_id: vitamine_c }

positions:
  - id: mecanisme-repas-isole
    niveau_preuve: forte
    porte_par: "Hurrell & Egli (2010), synthèse des études isotopiques"
    affirmation: "Sur un repas isolé, l'acide ascorbique augmente nettement l'absorption du fer non héminique."
    detail: |
      Les études au fer marqué sur repas unique montrent de façon répétée que plusieurs composants du
      repas modifient l'absorption du fer non héminique — celui des végétaux : le phytate, les
      polyphénols et le calcium la diminuent, l'acide ascorbique et les protéines de viande
      l'augmentent.
      C'est sur cette base qu'ont été estimées les biodisponibilités servant aux repères d'apport :
      14 à 18 % pour un régime mixte, 5 à 12 % pour un régime végétarien, chez des personnes sans
      réserves de fer.
    sources: [hurrell-2010]

  - id: repere-efsa
    niveau_preuve: forte
    porte_par: "EFSA (2015)"
    affirmation: "Les repères européens intègrent déjà le fait qu'une grande partie du fer avalé n'est pas absorbée."
    detail: |
      L'EFSA retient 11 mg/j chez l'homme adulte et 16 mg/j chez la femme non ménopausée. Ces chiffres
      ne sont pas des besoins : ce sont des pertes physiologiques converties en apport alimentaire en
      supposant une absorption de 16 % chez l'homme et 18 % chez la femme.
      Autrement dit, le repère suppose déjà qu'environ cinq sixièmes du fer avalé ne passent pas.
    sources: [efsa-fer-2015]

  - id: regime-complet
    niveau_preuve: moderee
    porte_par: "Cook & Reddy (2001)"
    affirmation: "Mesuré sur un régime complet et sur plusieurs jours, l'effet ne se retrouve pas."
    detail: |
      Douze participants ont suivi trois périodes alimentaires de cinq jours, avec un apport en
      vitamine C allant de 51 à 247 mg par jour. Résultat : aucune différence significative
      d'absorption moyenne du fer entre les trois périodes — alors même que l'analyse de régression
      retrouvait bien une corrélation positive une fois les autres facteurs neutralisés.
      Les auteurs concluent que l'effet facilitateur de la vitamine C sur un régime complet est
      nettement moins marqué que dans les études sur repas unique, et suggèrent que cela explique
      pourquoi une supplémentation prolongée en vitamine C n'a pas amélioré le statut en fer dans les
      travaux antérieurs.
      ⚠️ Ce n'est pas une réfutation du mécanisme, qui reste établi. C'est une contestation de sa
      portée à l'échelle d'une alimentation réelle.
    sources: [cook-2001, hurrell-2010]

  - id: pourquoi-cet-ecart
    niveau_preuve: moderee
    porte_par: "Lecture croisée des trois sources"
    affirmation: "L'écart entre les deux mesures tient à ce que chacune observe."
    detail: |
      Une étude sur repas unique mesure un aliment isolé, chez des personnes à jeun, sur une seule
      prise. Un régime complet mêle activateurs et inhibiteurs qui se compensent en partie, et
      l'organisme ajuste lui-même son absorption selon ses réserves — plus elles sont basses, plus il
      absorbe.
      Les deux résultats sont donc justes, et ne répondent pas à la même question. Celui qui compte
      pour une alimentation ordinaire est le second.
    sources: [hurrell-2010, cook-2001, efsa-fer-2015]

sources:
  - id: hurrell-2010
    titre_etude: "Iron bioavailability and dietary reference values"
    auteurs: "Hurrell R, Egli I"
    annee: 2010
    revue: "The American Journal of Clinical Nutrition 91(5):1461S-1467S"
    doi: "10.3945/ajcn.2010.28674F"
    url: "https://doi.org/10.3945/ajcn.2010.28674F"
    type_etude: revue_systematique
    effectif: null
    consulte_le: 2026-07-31

  - id: efsa-fer-2015
    titre_etude: "Scientific Opinion on Dietary Reference Values for iron"
    auteurs: "EFSA Panel on Dietetic Products, Nutrition and Allergies (NDA)"
    annee: 2015
    revue: "EFSA Journal 13(10):4254"
    doi: "10.2903/j.efsa.2015.4254"
    url: "https://doi.org/10.2903/j.efsa.2015.4254"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31

  - id: cook-2001
    titre_etude: "Effect of ascorbic acid intake on nonheme-iron absorption from a complete diet"
    auteurs: "Cook JD, Reddy MB"
    annee: 2001
    revue: "The American Journal of Clinical Nutrition 73(1):93-98"
    doi: "10.1093/ajcn/73.1.93"
    url: "https://doi.org/10.1093/ajcn/73.1.93"
    type_etude: essai_randomise
    effectif: "12 participants, 3 périodes alimentaires de 5 jours"
    consulte_le: 2026-07-31
---

« Un filet de citron sur les lentilles » est l'un des conseils les plus répétés en nutrition. Il
repose sur un mécanisme réel — et sur des études qui, mesurées autrement, n'en retrouvent pas
l'effet.

Le fer des végétaux (dit non héminique) s'absorbe moins bien que celui de la viande. La vitamine C
facilite son passage : c'est démontré sur un repas isolé. Ce qui est discuté, c'est ce qu'il en reste
à l'échelle d'une semaine d'alimentation ordinaire.
