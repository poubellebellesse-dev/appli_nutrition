---
code: fibres-cardiovasculaire
titre: "Les fibres changent-elles quelque chose au risque cardiovasculaire ?"
categorie: nutriments
niveau_preuve: forte
date_revue: 2026-07-31
liens:
  - { cible_type: nutrient, cible_id: fibres }

positions:
  - id: dose-reponse
    niveau_preuve: forte
    porte_par: "Lancet 2019 (Reynolds et coll.), BMJ 2013 (Threapleton et coll.)"
    affirmation: "Plus l'apport en fibres est élevé, plus le risque cardiovasculaire observé est bas, sans palier net."
    detail: |
      La méta-analyse du BMJ, portant sur 22 cohortes, mesure une baisse de 9 % du risque par tranche
      de 7 g de fibres par jour — risque relatif 0,91 (IC à 95 % : 0,88–0,94) pour les maladies
      cardiovasculaires, et 0,91 (0,87–0,94) pour les maladies coronariennes.
      La série publiée dans le Lancet en 2019 retrouve, en comparant les plus gros aux plus petits
      consommateurs, une baisse de 15 à 30 % de la mortalité toutes causes et cardiovasculaire, de
      l'incidence des maladies coronariennes et des AVC. Ses auteurs situent la réduction de risque
      maximale entre 25 et 29 g par jour, avec des données suggérant un bénéfice supplémentaire
      au-delà de 30 g.
    sources: [threapleton-2013, reynolds-2019]

  - id: references-autorites
    niveau_preuve: forte
    porte_par: "EFSA, ANSES"
    affirmation: "Les repères officiels vont de 25 à 30 g par jour, et les apports français restent en dessous."
    detail: |
      L'EFSA retient 25 g/j comme apport adéquat chez l'adulte. ⚠️ Ce chiffre est établi sur le
      transit intestinal, pas sur le risque cardiovasculaire : les deux sujets ne sont pas les mêmes,
      même si le repère est souvent cité comme s'ils l'étaient.
      L'ANSES retient 30 g/j comme apport satisfaisant, avec 25 g/j jugés acceptables chez la femme
      ménopausée et les personnes âgées. Les apports observés en France sont de 21 g/j chez l'homme
      adulte et 17 g/j chez la femme — sous les deux repères.
    sources: [efsa-2010, anses-pnns-2016]

  - id: limite-observationnelle
    niveau_preuve: moderee
    porte_par: "Lecture des méthodes — position des auteurs eux-mêmes"
    affirmation: "La preuve vient de l'observation des populations, pas d'essais ayant compté les infarctus."
    detail: |
      Les deux méta-analyses compilent des études de cohorte : on suit des personnes qui mangent
      déjà plus ou moins de fibres, sans rien leur assigner. Les auteurs du Lancet gradent eux-mêmes
      la certitude de la preuve comme « modérée » et écrivent que la relation « pourrait être
      causale » — une formulation prudente, pas une démonstration.
      Deux limites subsistent, et aucune n'est levée à ce jour. Les aliments riches en fibres
      apportent aussi du potassium, du magnésium et des polyphénols : isoler la part des fibres
      seules n'est pas possible dans ce type d'étude. Et personne n'a randomisé des milliers de
      personnes sur vingt ans pour compter les infarctus.
    sources: [reynolds-2019, threapleton-2013]

  - id: absence-de-divergence
    niveau_preuve: forte
    porte_par: "Constat sur l'ensemble des sources ci-dessus"
    affirmation: "Aucune instance ni revue majeure ne défend de position opposée sur ce sujet."
    detail: |
      Contrairement au sel ou aux graisses saturées, les fibres ne font l'objet d'aucun désaccord
      publié entre autorités de santé ou méta-analyses. Le débat existant porte sur le chiffre du
      repère (25 ou 30 g/j) et sur le rôle respectif des différents types de fibres — pas sur le sens
      de l'association.
      Cette fiche ne présente donc pas de position contradictoire, parce qu'il n'y en a pas à
      présenter. En fabriquer une donnerait une fausse image de l'état des connaissances.
    sources: [efsa-2010, anses-pnns-2016, reynolds-2019]

sources:
  - id: reynolds-2019
    titre_etude: "Carbohydrate quality and human health: a series of systematic reviews and meta-analyses"
    auteurs: "Reynolds A, Mann J, Cummings J, Winter N, Mete E, Te Morenga L"
    annee: 2019
    revue: "The Lancet 393(10170):434-445"
    doi: "10.1016/S0140-6736(18)31809-9"
    url: "https://doi.org/10.1016/S0140-6736(18)31809-9"
    type_etude: meta_analyse
    effectif: null
    consulte_le: 2026-07-31

  - id: threapleton-2013
    titre_etude: "Dietary fibre intake and risk of cardiovascular disease: systematic review and meta-analysis"
    auteurs: "Threapleton DE, Greenwood DC, Evans CEL, Cleghorn CL, Nykjaer C, Woodhead C, Cade JE, Gale CP, Burley VJ"
    annee: 2013
    revue: "BMJ 347:f6879"
    doi: "10.1136/bmj.f6879"
    url: "https://doi.org/10.1136/bmj.f6879"
    type_etude: meta_analyse
    effectif: "22 publications de cohortes prospectives, suivi minimal de 3 ans"
    consulte_le: 2026-07-31

  - id: efsa-2010
    titre_etude: "Scientific Opinion on Dietary Reference Values for carbohydrates and dietary fibre"
    auteurs: "EFSA Panel on Dietetic Products, Nutrition and Allergies (NDA)"
    annee: 2010
    revue: "EFSA Journal 8(3):1462"
    doi: "10.2903/j.efsa.2010.1462"
    url: "https://doi.org/10.2903/j.efsa.2010.1462"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31

  - id: anses-pnns-2016
    titre_etude: "Actualisation des repères du PNNS : élaboration des références nutritionnelles"
    auteurs: "ANSES — Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail"
    annee: 2016
    revue: "ANSES, rapport d'expertise collective (saisine 2012-SA-0103)"
    doi: null
    url: "https://www.anses.fr/fr/system/files/NUT2012SA0103Ra-1.pdf"
    type_etude: rapport_autorite
    effectif: null
    consulte_le: 2026-07-31
---

Les fibres ne sont pas absorbées : elles traversent l'intestin sans passer dans le sang. C'est
justement ce qui rend leur effet sur le cœur peu intuitif, et longtemps discuté.

Sur ce sujet, l'état des connaissances est inhabituellement calme — les grandes revues et les
autorités de santé disent la même chose. Ce qui reste ouvert, ce n'est pas le sens de la relation,
c'est sa solidité : elle repose sur l'observation de populations, pas sur des essais ayant compté les
accidents cardiaques.
