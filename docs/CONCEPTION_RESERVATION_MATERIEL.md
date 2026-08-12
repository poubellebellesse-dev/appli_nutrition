# Réservation de matériel — plan de montée

> **Ce document ne contient pas la spec.** Le cadre fait foi ailleurs : `CONCEPTION_MODE_CUISINE.md`
> §4.3.3 pour le niveau 3 du mode cuisine, `reference/ENGINE_*.md` §6.5 pour la couche `equipement`.
> Ici : dans quel ordre coder, ce qui est déjà construit, et à quoi on reconnaît que chaque lot est
> fini.
> Ouvert le 2026-08-11, en réponse à la **décision 65** (`ETAT.md` §4).

Demande : que le mode cuisine cesse de seulement **nommer** les ustensiles que deux plats se
disputent, et sache dire **de quand à quand** chacun est pris.

---

## 1. Le principe directeur — on n'occupe pas une recette, on occupe des intervalles

La décision 65 demandait **une colonne d'étape** sur `recipe_equipment`. **La mesure du 2026-08-11
dit que cette colonne ne peut pas porter le cas réel**, et c'est le fait fondateur de ce plan.

`recipe_equipment` a pour clé `(recipe_id, equipment_id)` : **une seule ligne par couple**. Or, sur
les 83 recettes qui exigent un four ou un micro-ondes :

| Occupations de l'ustensile | Recettes | Part |
|---|---|---|
| 1 fois | 69 | 83 % |
| **2 fois** | **13** | **16 %** |
| **3 fois** | **1** | **1 %** |

`colin_four_fenouil` enfourne le fenouil **seul** 15 min (étape 2), on sort le plat, on pose le
poisson dessus, on remet 15 min (étape 4). **Entre les deux, le four est LIBRE** — et c'est
précisément le trou dans lequel un autre plat vient se loger. Une colonne unique l'efface.

⛔ **La bonne unité n'est donc pas « quelle étape », c'est « de quand à quand, et combien de fois ».**
Tout le reste du plan en découle.

⚠️ **Ce défaut ne se serait vu qu'APRÈS avoir rempli les données**, au moment d'écrire le code de
réservation. Il a été trouvé par une sonde de lecture, avant d'écrire quoi que ce soit — c'est
l'ordre que la décision 60 avait déjà imposé au lien étape → ingrédient.

---

## 2. Ce qui est déjà là, et ce qui manque

### Ce qui existe et qu'on ne refait pas

- **`equipement-partage.ts`** nomme déjà les ustensiles indivisibles que plusieurs plats réclament.
  Il n'ordonnance rien, **délibérément**, et son en-tête dit pourquoi.
- **Les durées sont là.** `recipe_step` porte `timer_s` et `timer_type ∈ ('cuisson','repos')`.
  **89 % des occupations mesurées ont déjà leur durée** — aucune donnée nouvelle à saisir pour ça.
- **Le référentiel est complet** : 30 ustensiles, 1 473 couples recette × ustensile.
- **La personne déclare déjà ce qu'elle possède** — `user_equipment`.

### Ce qui manque, et le coût réel

⛔ **LE NOMBRE « 1 473 » TROMPE, ET C'EST LUI QUI A FAIT PARAÎTRE LE CHANTIER ÉNORME.** La
réservation ne concerne **que le niveau `requis`** :

| Niveau | Couples | Concerné |
|---|---|---|
| `informatif` | 1 078 | non — aucun effet moteur |
| `accelere` | 38 | non — n'exclut jamais |
| **`requis`** | **357** | **oui** |
| dont `four` + `micro_ondes` | **83** | **le périmètre de ce plan** |

**Le chantier est donc 4 fois plus petit qu'annoncé**, et 17 fois plus petit si l'on s'en tient aux
ustensiles réellement indivisibles.

### Les chiffres du refus, revérifiés — le refus reste fondé

⚠️ **Rien de ce plan ne remet en cause la raison pour laquelle la réservation a été refusée en
août.** Remesuré le 2026-08-11 : une réservation **exclusive et sans capacité** déclarerait un
conflit sur **34 290 paires de recettes sur 54 285, soit 63 %**. `plaque_cuisson` est `requis` sur
**260 recettes (79 %)**, `four` sur **82 (25 %)**, et **74 recettes exigent les deux**. **Un
avertissement qui se déclenche deux fois sur trois n'est plus lu.** C'est le lot C qui lève ça, pas
le lot D.

---

## 3. Les lots

### Lot A — la table d'occupations, dérivée du texte

Une table neuve, **calquée trait pour trait sur `recipe_step_ingredient`**, qui résout déjà ce
problème pour les ingrédients :

```sql
CREATE TABLE recipe_step_equipment (
  recipe_id    TEXT NOT NULL,
  ordre        INTEGER NOT NULL,
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  origine      TEXT NOT NULL CHECK (origine IN ('declare', 'derive')),
  PRIMARY KEY (recipe_id, ordre, equipment_id),
  FOREIGN KEY (recipe_id, ordre) REFERENCES recipe_step(recipe_id, ordre)
);
```

⛔ **Une table, pas une colonne** — voir §1. La clé porte l'étape, donc plusieurs occupations par
recette sont exprimables. C'est tout l'objet du lot.

⛔ **`origine` n'est pas décorative, et elle n'a que DEUX valeurs ici.** `recipe_step_ingredient` en
a trois parce qu'un pronom peut hériter de l'étape précédente (« les blanchir ») ; **un ustensile
n'hérite de rien** — « remettre au four » nomme le four. Ne pas recopier `herite` par symétrie.
`declare` **l'emporte toujours** sur `derive` : c'est le mécanisme qui rend le lot B possible sans
toucher au détecteur.

⛔ **LA RÈGLE VIT DANS `catalog/lien-etape-equipement.mjs`, EN UN SEUL EXEMPLAIRE**, appelée par
`build.mjs` **et** par la sonde de mesure. Deux copies divergeraient et le chiffre mesuré cesserait
de décrire ce que le build produit — c'est la contrainte que `lien-etape-ingredient.mjs` s'impose
déjà, en en-tête, et pour cette raison exacte.

✅ **Et ça règle un défaut découvert en chemin** : `atelier/` est **gitignoré en entier**
(`.gitignore:43`). Une règle posée là ne serait dans aucun clone. En la mettant dans `catalog/`, la
règle est versionnée et seule la sonde ne l'est pas — ce qui est acceptable, parce qu'une sonde se
réécrit et qu'une règle, non.

**Ce que le détecteur lit, par ordre de sûreté décroissant :**

| Source | Occupations | Ce que c'est |
|---|---|---|
| geste `enfourner` | 74 (76 %) | une annotation humaine dont c'est **le sens exact** |
| gestes implicites | 14 (14 %) | `gratiner`, `rotir`, `papillote`, `bain_marie` — le four sans le nommer |
| texte | 10 (10 %) | « remettre au four », « sous le gril du four », une température en °C |

⚠️ **Deux familles de faux positifs ont été éliminées PENDANT la mesure, et il faut les garder :**
« à la **sortie** du four » (3 cas — la phrase dit le contraire de ce qu'elle a l'air de dire), et
les explications écrites **après un tiret cadratin**, la convention d'écriture du projet servant
alors de filtre (« Cuire les pâtes deux minutes de moins — elles finiront au four »).

**Fini quand** : 98 occupations en base, **aucune recette muette**, `colin_four_fenouil` porte
**deux** lignes `four` (étapes 2 et 4), et `node atelier/mesure-occupation-four.mjs` retrouve le
compte du build.

---

### Lot B — corriger les 6 faux, par déclaration

Le détecteur se trompe **6 fois sur 98 (~6 %)**, mesuré en relisant **à la main les 24 cas qui ne
reposent pas sur le geste `enfourner`** : **18 justes, 6 faux**. Les six, en trois familles :

| Cas | Ce que le détecteur voit | Ce qui se passe vraiment |
|---|---|---|
| `sardines_grillees_tomates` ét. 4 | le geste `rotir` | **on sert** |
| `pommes_terre_four_romarin` ét. 2 | le geste `rotir` | **on rince et on sèche** |
| `boulgour_pois_chiches_courgettes` ét. 3 | le geste `rotir` | **on mélange** |
| `chou_fleur_roti_curcuma` ét. 3 | le geste `rotir` | **on étale**, et la phrase explique pourquoi |
| `poireaux_gratines_bechamel` ét. 3 | « l'eau rendue au four » | **une phrase d'explication** |
| `oeufs_cocotte_epinards` ét. 1 | `bain_marie` + préchauffage | **discutable** — l'eau chauffe déjà |

⛔ **ON CORRIGE LES SIX RECETTES, PAS LE DÉTECTEUR.** Un détecteur durci pour six cas devient un
détecteur qu'un lot de contenu casse en silence — c'est l'objection que la décision 65 opposait à la
dérivation, et elle reste juste **appliquée au détecteur**. Une déclaration explicite dans la source,
elle, ne casse rien.

⚠️ **Les 74 occupations portées par `enfourner` n'ont PAS été relues.** Elles sont tenues pour justes
**par construction**. Si ce postulat tombe, le taux de 6 % tombe avec — le dire ici pour que
personne ne le redécouvre en le prenant pour un audit complet.

**Fini quand** : 0 faux sur les 24 cas fragiles, compte à **92 occupations**, et les 6 lignes
corrigées portent `origine = 'declare'`.

---

### Lot C — la capacité ⭐ *c'est une décision, pas du travail*

**C'est le seul point d'arrêt du plan**, et c'est la question que la décision 65 rangeait au mauvais
endroit.

```sql
-- catalogue : ce qui est vrai chez tout le monde
ALTER TABLE equipment ADD COLUMN partageable TEXT NOT NULL
  CHECK (partageable IN ('jamais', 'selon_quantite', 'toujours'));

-- réglages : ce qui dépend de la cuisine de la personne  (user.db → v17)
ALTER TABLE user_equipment ADD COLUMN quantite INTEGER;
```

| Valeur | Exemple | Pourquoi |
|---|---|---|
| `jamais` | le four | **un thermostat**. Deux gratins à 180 °C et 220 °C ne cohabitent pas, chez personne |
| `selon_quantite` | la plaque | **2 à 5 feux selon la cuisine**. Le catalogue ne peut pas le savoir |
| `toujours` | le saladier | se rince en dix secondes |

⛔ **NE JAMAIS ÉCRIRE « LA PLAQUE A 3 FEUX » DANS `catalog/`.** Ce serait refaire le défaut que le
lot B du régime a évité — figer au catalogue un fait qui appartient à l'utilisateur — et cette
fois **ça se verrait chez la moitié des gens**. La quantité est demandée **une fois**, dans les
réglages, à côté de la déclaration de matériel qui existe déjà.

⚠️ **`quantite` est NULLABLE, et `NULL` ne vaut pas 1.** `NULL` = « la personne n'a pas répondu ».
Un ustensile `selon_quantite` sans réponse **ne déclenche aucun avertissement** — on n'invente pas
une contrainte qu'on n'a pas mesurée. Défaut prudent : se taire.

✅ **CE LOT SUPPRIME UNE DETTE EXISTANTE, ET C'EST LA MOITIÉ DE SA VALEUR.** `CODES_INDIVISIBLES`
(`['four','micro_ondes']`) est un **jugement éditorial écrit en dur dans le moteur**, parce que le
champ qui devrait le porter n'existe pas. Son propre commentaire le dit et demande sa disparition le
jour où la donnée arrive. Ce jour-là, c'est ce lot.

**Fini quand** : `CODES_INDIVISIBLES` a **disparu** du moteur, remplacé par une lecture de données ;
une personne à 2 feux et une personne à 5 ne reçoivent pas le même avertissement ; et une personne
qui n'a pas répondu n'en reçoit aucun.

---

### Lot D — le moteur, en intervalles

`engine/cuisine/` calcule les intervalles d'occupation depuis les durées d'étapes et signale un
chevauchement **au-delà de la capacité effective**.

⚠️ **`engine:plan-stress` EST LE TÉMOIN, ET IL DOIT RESTER À 20/20 À CHAQUE LOT.** Le mode cuisine a
ajouté une durée **écoulée** (actif + repos) sans toucher à la durée **active** que lit le solveur.
Si le banc bouge après un lot de cuisine, **c'est que les deux durées ont été confondues** — c'est
écrit dans `CLAUDE.md` et ça vaut ici mot pour mot.

⚠️ **11 occupations sur 98 n'ont pas de durée.** Elles se signalent **« durée inconnue »**, jamais
devinée. **Un intervalle inventé est pire qu'un intervalle absent** : il déplace un plat pour une
raison fausse.

⛔ **`engine/` reste du TypeScript pur** — n'importe jamais `react`, `sqlite` ni `features/`. Si une
tâche de ce lot demande le contraire, c'est la tâche qui est fausse.

**Fini quand** : deux plats dans la même session signalent le conflit sur la **première** cuisson et
**pas sur le trou** entre les deux occupations de `colin_four_fenouil` ; `plan-stress` à 20/20 ;
couverture du module au niveau du reste de `engine/cuisine/`.

---

### Lot E — l'écran

> « Le four est pris de 18h10 à 18h35. »

Un fait, une plage. **Pas de croix rouge, pas de « conflit », pas de score, pas de code couleur.**

⛔ **Principe 6 — informer, jamais juger.** Un badge rouge sur un repas que la personne a choisi de
faire transforme son choix en anomalie. L'écran dit **ce qui est pris et quand**, elle décide.

⚠️ **Les fenêtres, pas les menus déroulants** : réglages et filtres ouvrent un `Panneau`, le
déclencheur porte `aria-haspopup="dialog"`, jamais `aria-expanded`, et les tests lisent la présence
du dialogue.

**Fini quand** : la plage s'affiche pour une session à deux plats concurrents, l'écran reste muet
quand la capacité suffit, et aucun jeton de couleur d'alerte n'a été ajouté.

---

## 4. Ce que ce plan exclut délibérément

⛔ **L'ORDONNANCEMENT AUTOMATIQUE — déplacer les plats pour éviter les conflits.** C'est un solveur,
personne ne l'a demandé, et l'appli dit déjà ce qu'elle sait sans décider à la place de la personne.
Le module existant l'a refusé une première fois, en connaissance de cause. **Ne pas le rouvrir sans
une demande explicite.**

⛔ **Les ustensiles `accelere` et `informatif`** — 1 116 couples, aucun effet moteur. Hors périmètre.

---

## 5. Ordre

```
A  →  B           indépendants, livrables tout de suite
C                 ⛔ DÉCISION — bloque D, pas A ni B
      C  →  D  →  E
```

**Le seul vrai point d'arrêt est C.** A et B n'attendent rien : ils remplissent une donnée qui
manque, et cette donnée est juste ou fausse indépendamment de ce qu'on décidera des feux de plaque.

⚠️ **La dérivation donne le QUAND, jamais le COMBIEN.** A et B ne règlent pas la plaque de cuisson,
et ne prétendent pas le faire. Sans C, on saura à quelle minute le four est pris — et on ne pourra
toujours rien dire de la plaque.

---

## 6. Les garde-fous, quel que soit le lot

1. **`engine/` reste pur** — aucun import de `react`, `sqlite` ou `features/`.
2. **Aucun horaire deviné.** Durée absente ⇒ « durée inconnue ». Jamais une valeur par défaut.
3. **Aucun jugement à l'écran** — pas de score, pas de code couleur, pas de « conflit ».
4. **Le faible reste visible** : `origine` sépare ce qu'un humain a déclaré de ce qu'une règle a
   trouvé. Un taux de 94 % ou de 6 % ne vaut que si l'on sait quelles lignes sont concernées.
5. **`plan-stress` à 20/20** à chaque lot — le témoin de la confusion durée active / durée écoulée.
