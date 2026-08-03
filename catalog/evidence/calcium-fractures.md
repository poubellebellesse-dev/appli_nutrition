---
code: calcium-fractures
titre: "Le calcium protège-t-il des fractures ?"
categorie: vitamines_mineraux
niveau_preuve: moderee
date_revue: 2026-07-31
liens:
  - { cible_type: nutrient, cible_id: calcium }

positions:
  - id: repere-alimentaire
    niveau_preuve: forte
    porte_par: "EFSA (2015)"
    affirmation: "Le repère européen d'apport en calcium est de 950 mg par jour chez l'adulte."
    detail: |
      L'EFSA retient 950 mg/j comme apport de référence pour la population adulte à partir de 25 ans.
      ⚠️ Ce chiffre décrit un apport **alimentaire**. Il ne dit rien sur l'intérêt d'avaler un
      complément en plus — c'est une autre question, et c'est elle qui est disputée.
    sources: [efsa-calcium-2015]

  - id: meta-nof
    niveau_preuve: faible
    porte_par: "Méta-analyse Weaver et coll. (2016) — corrigée et contestée"
    affirmation: "Une méta-analyse conclut que calcium et vitamine D combinés réduisent les fractures de 15 %."
    detail: |
      Sur 8 essais randomisés et 30 970 participants : 15 % de fractures totales en moins (risque
      relatif 0,85 ; IC à 95 % : 0,73–0,98) et 30 % de fractures de hanche en moins (0,70 ;
      0,56–0,87).
      ⚠️ Trois éléments doivent accompagner ce chiffre, tous publics. Un erratum et des analyses
      additionnelles ont été publiés par les auteurs eux-mêmes. Une lettre parue dans la même revue
      (Avenell et coll., 2017) signale des erreurs restées non corrigées. Enfin, le financement :
      le travail a été soutenu par des subventions sans restriction d'usage de la Consumer
      Healthcare Products Association, du Council for Responsible Nutrition et de la Natural Products
      Association — trois organisations professionnelles du secteur des compléments alimentaires.
      Cette dernière information ne disqualifie rien à elle seule. Elle fait partie de ce qu'il faut
      savoir pour lire le résultat.
    sources: [weaver-2016, weaver-erratum-2016, avenell-2017]

  - id: meta-jama
    niveau_preuve: moderee
    porte_par: "Méta-analyse JAMA (Zhao et coll., 2017) — contestée elle aussi"
    affirmation: "Une autre méta-analyse ne retrouve aucune baisse des fractures chez les personnes âgées vivant à domicile."
    detail: |
      Sur 33 essais et 51 145 participants de 50 ans et plus vivant à domicile, ni le calcium, ni la
      vitamine D, ni les deux combinés ne s'accompagnent d'une baisse du risque de fracture. Les
      auteurs concluent que ces résultats ne soutiennent pas l'usage systématique de ces compléments
      dans cette population.
      ⚠️ Cette analyse a suscité une objection publiée dans Osteoporosis International, portant sur
      la sélection des essais retenus et sur la prise en compte des sous-groupes. Les deux
      méta-analyses opposées ont donc chacune leur critique publiée : c'est une situation de
      désaccord ouvert, pas un camp contre un autre.
    sources: [zhao-2017, critique-zhao-2018]

  - id: position-uspstf
    niveau_preuve: forte
    porte_par: "US Preventive Services Task Force (2018)"
    affirmation: "L'autorité américaine de prévention déconseille les faibles doses et juge les données insuffisantes au-delà."
    detail: |
      Grade D — c'est-à-dire une recommandation contre — pour une supplémentation quotidienne de
      400 UI ou moins de vitamine D avec 1 000 mg ou moins de calcium, chez la femme ménopausée
      vivant à domicile, en prévention primaire des fractures.
      Grade I — données insuffisantes pour conclure — au-delà de ces doses, ainsi que chez l'homme et
      chez la femme non ménopausée. « Insuffisantes » ne veut pas dire « inefficace » : cela veut
      dire que l'autorité refuse de trancher en l'état.
    sources: [uspstf-2018]

  - id: ou-porte-le-debat
    niveau_preuve: forte
    porte_par: "Constat sur l'ensemble des sources"
    affirmation: "Le désaccord porte sur les compléments, pas sur le calcium des aliments."
    detail: |
      Aucune des sources ci-dessus ne remet en cause le repère d'apport alimentaire. Ce qui est
      disputé, c'est l'effet d'un complément avalé en plus d'une alimentation ordinaire sur le nombre
      de fractures.
      Les deux questions sont régulièrement confondues, y compris dans les titres de presse qui
      annoncent que « le calcium ne sert à rien ». Aucune des études citées ne porte cette
      conclusion-là.
    sources: [efsa-calcium-2015, zhao-2017, uspstf-2018]

sources:
  - id: efsa-calcium-2015
    titre_etude: "Scientific Opinion on Dietary Reference Values for calcium"
    auteurs: "EFSA Panel on Dietetic Products, Nutrition and Allergies (NDA)"
    annee: 2015
    revue: "EFSA Journal 13(5):4101"
    doi: "10.2903/j.efsa.2015.4101"
    url: "https://doi.org/10.2903/j.efsa.2015.4101"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31

  - id: weaver-2016
    titre_etude: "Calcium plus vitamin D supplementation and risk of fractures: an updated meta-analysis from the National Osteoporosis Foundation"
    auteurs: "Weaver CM, Alexander DD, Boushey CJ, Dawson-Hughes B, Lappe JM, LeBoff MS, Liu S, Looker AC, Wallace TC, Wang DD"
    annee: 2016
    revue: "Osteoporosis International 27:367-376 (mise en ligne 2015)"
    doi: "10.1007/s00198-015-3386-5"
    url: "https://doi.org/10.1007/s00198-015-3386-5"
    type_etude: meta_analyse
    effectif: "8 essais randomisés, 30 970 participants"
    financement: "Subventions sans restriction d'usage de la Consumer Healthcare Products Association, du Council for Responsible Nutrition et de la Natural Products Association"
    consulte_le: 2026-07-31

  - id: weaver-erratum-2016
    titre_etude: "Erratum and additional analyses re: Calcium plus vitamin D supplementation and the risk of fractures: an updated meta-analysis from the National Osteoporosis Foundation"
    auteurs: "Weaver CM, Alexander DD, Boushey CJ, et coll."
    annee: 2016
    revue: "Osteoporosis International"
    doi: "10.1007/s00198-016-3699-z"
    url: "https://doi.org/10.1007/s00198-016-3699-z"
    type_etude: commentaire_critique
    effectif: null
    consulte_le: 2026-07-31

  - id: avenell-2017
    titre_etude: "Further major uncorrected errors in National Osteoporosis Foundation meta-analyses of calcium and vitamin D supplementation in fracture prevention"
    auteurs: "Avenell A, Bolland MJ, Grey A, Reid IR"
    annee: 2017
    revue: "Osteoporosis International 28(2):733-734"
    doi: "10.1007/s00198-016-3765-6"
    url: "https://doi.org/10.1007/s00198-016-3765-6"
    type_etude: commentaire_critique
    effectif: null
    consulte_le: 2026-07-31

  - id: zhao-2017
    titre_etude: "Association Between Calcium or Vitamin D Supplementation and Fracture Incidence in Community-Dwelling Older Adults: A Systematic Review and Meta-analysis"
    auteurs: "Zhao JG, Zeng XT, Wang J, Liu L"
    annee: 2017
    revue: "JAMA 318(24):2466-2482"
    doi: "10.1001/jama.2017.19344"
    url: "https://doi.org/10.1001/jama.2017.19344"
    type_etude: meta_analyse
    effectif: "33 essais randomisés, 51 145 participants de 50 ans et plus"
    consulte_le: 2026-07-31

  # ⚠️ Auteurs NON VÉRIFIÉS : la page éditeur exige un compte. Titre, revue, année et DOI, eux,
  # ont été confirmés. À compléter avant publication — voir règle 5 du README.
  - id: critique-zhao-2018
    titre_etude: "Issues of trial selection and subgroup considerations in the recent meta-analysis of Zhao and colleagues on fracture reduction by calcium and vitamin D supplementation in community-dwelling older adults"
    auteurs: null
    annee: 2018
    revue: "Osteoporosis International"
    doi: "10.1007/s00198-018-4587-5"
    url: "https://doi.org/10.1007/s00198-018-4587-5"
    type_etude: commentaire_critique
    effectif: null
    consulte_le: 2026-07-31

  - id: uspstf-2018
    titre_etude: "Vitamin D, Calcium, or Combined Supplementation for the Primary Prevention of Fractures in Community-Dwelling Adults: US Preventive Services Task Force Recommendation Statement"
    auteurs: "US Preventive Services Task Force"
    annee: 2018
    revue: "JAMA 319(15):1600-1612"
    doi: null
    url: "https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/vitamin-d-calcium-or-combined-supplementation-for-the-primary-prevention-of-fractures-in-adults-preventive-medication"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31
---

Sur ce sujet, deux méta-analyses sérieuses aboutissent à des conclusions opposées — et chacune a reçu
sa critique publiée. C'est un cas où l'honnêteté consiste à montrer le désaccord tel qu'il est,
plutôt qu'à choisir le camp qui arrange.

Une distinction résout une grande partie de la confusion : l'apport alimentaire en calcium fait
consensus, l'intérêt d'un complément avalé en plus ne fait pas consensus du tout. Les deux questions
portent le même mot et ne se ressemblent pas.
