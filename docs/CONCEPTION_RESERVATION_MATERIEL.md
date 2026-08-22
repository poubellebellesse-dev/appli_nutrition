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

### La coupe 65a / 65b — décidée le 2026-08-13

⭐ **LE LOT C EMPAQUETAIT DEUX FAITS DE NATURE OPPOSÉE, ET C'EST CE QUI RENDAIT LA DÉCISION 65
INTRANCHABLE.** `equipment.partageable` est vrai chez tout le monde — c'est du catalogue.
`user_equipment.quantite` est vrai chez cette personne-là — c'est un réglage. Posée comme
« catalogue **ou** utilisateur ? », la question forçait à choisir entre deux champs qui ne sont pas
le même champ. Il n'y avait pas d'arbitrage à rendre : il y avait une fusion à défaire.

Le lot C se coupe donc en deux, et le reste du plan ne bouge pas :

| | contenu | ce que ça débloque |
|---|---|---|
| **65a** | A → B → **C′** → D → E | le **four** et le **micro-ondes** |
| **65b** | **C″** — `user_equipment.quantite` + l'écran de réglage | la **plaque de cuisson** |

- **C′** — la moitié catalogue : `equipment.partageable`, et `CODES_INDIVISIBLES` disparaît du moteur.
- **C″** — la moitié utilisateur : la quantité possédée, l'écran qui la demande, et `plaque_cuisson`
  qui passe en réservation effective.

✅ **LA COUPE TIENT PARCE QUE L'ENUM A TROIS ÉTATS, PAS DEUX.** En 65a, `plaque_cuisson` vaut
`selon_quantite` et personne n'a répondu : `quantite` est absente, donc **le moteur se tait sur la
plaque**, exactement comme aujourd'hui. **65a est strictement additif — il ne peut pas rouvrir les
63 % de fausses alertes**, parce qu'il ne prononce pas un mot sur l'ustensile qui les causait. Ce
n'est pas un contournement : c'est le troisième état de l'ENUM qui porte le découpage.

⚠️ **65b n'est pas « la suite naturelle », c'est une décision qui reste ouverte.**
`user_pantry.quantite_approx` existe déjà, mais son en-tête précise qu'elle est *indicative, jamais
décomptée*. Une quantité de feux serait **portante** : le solveur compterait dessus. Ce n'est pas le
même objet, et le schéma devra le dire. Ne pas invoquer le précédent du garde-manger pour trancher
vite.

**Fini quand (65a, l'état final des cinq lots — c'est ce qui est scellé)** : **exactement 85
recettes** portent au moins une occupation de four ou de micro-ondes — donc **aucune muette** ;
`colin_four_fenouil` porte **deux** occupations de four, `[2,2]` et `[4,4]`, et **rien à l'étape 3** ;
`oeufs_cocotte_epinards` porte **une seule** occupation, `[1,5]`, qui **couvre les étapes 2, 3 et 4** ;
aucun des **5 faux positifs** du lot B n'est présent ; `CODES_INDIVISIBLES` a disparu du moteur et
`equipementsDisputes` **change de réponse quand la valeur de `partageable` change** ;
`plaque_cuisson` vaut `selon_quantite` et **ne déclenche aucun avertissement** ; le moteur ne
signale **aucun conflit** entre deux plats dont les occupations ne se chevauchent pas, ni quand la
capacité suffit ; et l'écran du mode cuisine affiche une **plage horaire** au lieu d'une liste de
noms.

⛔ **AUCUN TOTAL D'OCCUPATIONS N'EST SCELLÉ, ET C'EST DÉLIBÉRÉ.** Les **98** ont été mesurées avec
une ligne **par étape**. Le modèle à portée (`ordre_debut`/`ordre_fin`) ne compte plus le même
objet : deux étapes détectées qui se rejoignent ne font plus qu'une ligne. Le nouveau total dépend
du nombre de continuités, **et ce nombre n'a jamais été mesuré**. Écrire « 92 » ou « 93 » ici serait
inventer un chiffre pour avoir l'air précis. Il se mesure **pendant le lot A**, et il s'écrit ici
**après**.

⚠️ **CE QUI REMPLACE LE TOTAL : les 85 recettes.** C'est un compte connu, stable, et qu'aucune
implémentation générique ne peut atteindre sans faire le travail recette par recette.

⛔ **CE NOMBRE A ÉTÉ ÉCRIT 83, ET 83 ÉTAIT FAUX — corrigé le 2026-08-13 sur décision de l'auteur.**
C'était une confusion entre deux tables. **83 est le nombre de recettes qui EXIGENT** le four ou le
micro-ondes (`recipe_equipment.niveau = 'requis'`) — c'est le chiffre juste plus haut dans ce
document, et il ne bouge pas. Le « Fini quand », lui, parle des recettes qui **PORTENT** une
occupation (`recipe_step_equipment`). Les deux ensembles ne coïncident pas :

| | |
|---|---|
| recettes portant une occupation **détectée** | 82 |
| **+** muettes que le lot B déclare : `flan_oeufs_caramel` (bain-marie à 160 °C), `tarte_citron` (cuisson à blanc à 180 °C), `mug_cake_chocolat` (micro-ondes) | +3 |
| **total scellé** | **85** |

⛔ **ET CE N'EST PAS UN DÉCALAGE CONSTANT DE +2.** `moules_gratinees_chapelure` et
`soupe_oignon_gratinee` passent « sous le gril » — occupation vraie — **sans déclarer `four:
requis`**. Elles comptent dans les 85 et pas dans les 83. Aligner les deux nombres demanderait de
corriger leurs équipements : **c'est un autre lot**, pas celui-ci.

⚠️ **L'ERREUR A ÉTÉ TROUVÉE PAR L'AUTRE MOITIÉ DU CRITÈRE**, et c'est ce qui la rend instructive :
« aucune muette » FORCE les trois déclarations, donc force le total au-dessus de 83. Deux clauses du
même « Fini quand » qui ne pouvaient pas être vraies ensemble. **Un critère chiffré ne se relit pas
seul — il se relit contre les autres clauses de la même phrase.**

⚠️ **EN SCELLANT L'ÉTAT FINAL, ON PERD AUSSI LE PALIER DE 98.** Le lot A seul détecte 98 étapes, le
lot B en retire 5. Un sceau posé sur les cinq lots ne le voit plus. Le contrôle du palier reste à
faire **à la main entre A et B**, et rien ne le rappellera.

---

## La redéfinition du 2026-08-18 — 65b change de contenu, et 65c naît

⭐ **CE QUI SUIT REMPLACE LA LIGNE « 65b » DU TABLEAU DE LA COUPE.** Elle annonçait
`user_equipment.quantite` + l'écran de réglage, et disait que ça « débloque la plaque de cuisson ».
**Mesuré le 2026-08-18 : c'est faux, et il manquait une pièce que personne n'avait nommée.**

### Les trois écarts mesurés — sur `catalog.db` réel et sur l'arbre, jamais déduits

⛔ **(1) LA QUANTITÉ NE DÉBLOQUE RIEN, PARCE QU'AUCUNE RECETTE N'OCCUPE LA PLAQUE.**
`conflitsDEquipement` ne parle que de ce que `recipe_step_equipment` porte. Compté :

| ustensile | occupations | recettes |
|---|---|---|
| `four` | 91 | 84 |
| `micro_ondes` | 1 | 1 |
| **`plaque_cuisson`** | **0** | **0** |

Le détecteur du build ne sait détecter **que le four** — sa fonction s'appelle
`etapeOccupeLeFour`. La plaque n'entre que par une déclaration `occupe:` écrite à la main, et aucune
recette n'en porte. **La quantité de feux, livrée seule, resterait invisible à l'écran.** Elle
n'appartient donc plus à 65b : voir 65c.

⛔ **(2) L'ÉCRAN N'EXISTE PAS, ET IL N'EN EXISTE MÊME PAS LA MOITIÉ.** `writeOwnedEquipmentIds`
(`app/src/data/user-store.ts`) n'a **aucun appelant de production** — seul son propre test unitaire
l'appelle. `user_equipment` est donc vide chez tout le monde depuis P1a. 65b ne pose pas une
quantité sur un écran existant : **il crée le premier écran qui déclare du matériel.**

⛔ **(3) ET CET ÉCRAN ALLUMERAIT UNE COUCHE D'EXCLUSION QUI DORT.** `readConstraints`
(`app/src/data/user-store.ts:378`) branche `ownedEquipmentIds` **sans condition**. La couche
`equipement` est écrite, testée, documentée en `ENGINE.md` §6.5, et inerte pour une seule raison :
la table est vide. **À la première ligne écrite, les recettes commencent à tomber.** Mesuré sur les
330 recettes du catalogue :

| ce que la personne possède | recettes écartées | il en reste |
|---|---|---|
| rien de coché, filtre allumé | **271** | **59** |
| le seul `four` | **264** | **66** |

⚠️ **271 sur 330 portent au moins un ustensile `requis`** — dont `plaque_cuisson` sur 260 et `four`
sur 82. Un écran qui écrirait la table sans rien d'autre viderait donc le catalogue aux quatre
cinquièmes, en silence, dès la première case cochée.

### Ce que l'auteur a tranché le 2026-08-18

1. **L'écran de déclaration du matériel se fait**, dans les Paramètres, **optionnel**.
2. **Déclarer son matériel n'enlève aucune recette.** Le filtrage existe, mais il est **allumé par la
   personne**, jamais par défaut.
3. **Une recette écartée suit le comportement DÉJÀ EN PLACE des autres couches** : l'entonnoir
   chiffré (« 330 recettes → équipement −264 = 66 disponibles ») et le bloc « pourquoi pas ce
   plat ? » sur recherche. ⛔ **Aucun affichage neuf n'est à inventer** — `LIBELLE_COUCHE` de
   `app/src/ui/screens/recettes.tsx` porte déjà l'entrée `equipement: 'équipement'`, écrite et
   jamais atteinte.
4. **Les ustensiles d'une recette sont déjà affichés** — section « Matériel » de la fiche détail,
   sans aucun niveau, exactement l'indicatif demandé. **Rien à faire de ce côté**, et surtout pas
   les dériver des gestes : le lien recette × ustensile est une donnée saisie (1 473 couples), pas
   une devinette à refaire.

✅ **L'INTERRUPTEUR FERME UN TROU QUE `user-store.ts` DEMANDAIT DE FERMER.** Son en-tête prévient
qu'une table vide ne distingue pas « jamais ouvert l'écran » de « tout décoché », et qu'il faudra un
marqueur de déclaration le jour où un écran permettra de décocher. **L'interrupteur EST ce
marqueur** : éteint ⇒ `null` ⇒ couche inerte ; allumé ⇒ la liste, **fût-elle vide**, ⇒ « je ne
possède rien ». Le tri-état ne se devine plus, il se déclare. Aucune ligne datée à ajouter.

---

### Lot 65b — l'écran de matériel et l'interrupteur ✅ LIVRÉ le 2026-08-18 · commit `d0c4bb3`

`user.db` passe en **v17** avec un interrupteur singleton (patron de `user_diet` : `id = 1`), éteint
par défaut. `readConstraints` ne transmet le matériel déclaré **que** si l'interrupteur est allumé.
Un écran de Paramètres coche les 30 ustensiles du référentiel et écrit `user_equipment`.

**Fini quand** — les huit clauses, vérifiées contre `catalog.db` réel et une `user.db` réelle :

1. Sur une base neuve, l'interrupteur est **éteint** et `readConstraints` rend
   `ownedEquipmentIds === null`.
2. Sur une base où `user_equipment` porte des lignes et l'interrupteur est **éteint**,
   `readConstraints` rend **toujours `null`**.
3. Interrupteur **allumé**, `user_equipment` portant exactement `four` : `readConstraints` rend une
   liste de longueur 1 contenant `four`.
4. Interrupteur **allumé**, `user_equipment` **vide** : `readConstraints` rend `[]`, jamais `null` —
   « je ne possède rien » est une réponse, pas une absence de réponse.
5. Le compte de recettes disponibles est **strictement identique** entre « rien de déclaré » et
   « **le seul `four`** déclaré, interrupteur éteint » : **330 dans les deux cas**, zéro recette
   écartée par la couche `equipement`. ⛔ **La déclaration doit être PARTIELLE, et c'est tout
   l'intérêt de la clause.** Déclarer les 30 ustensiles laisserait 330 recettes **même filtre
   allumé** — la clause serait alors satisfaite par une implémentation qui ignore l'interrupteur, et
   ne prouverait rien. Écrite avec le seul `four`, elle forme une tenaille avec la clause 6 : mêmes
   données, interrupteur seul à changer, **330 contre 66**.
6. Interrupteur **allumé** avec le seul `four` coché, la couche `equipement` écarte **exactement
   264 recettes** — et l'ensemble écarté est **exactement** celui que `recipe_equipment` désigne
   (`niveau = 'requis'`, code ≠ `four`), identifiant par identifiant, pas seulement en nombre.
7. L'écran des Paramètres **écrit réellement** : cocher un ustensile puis relire la base par un
   autre chemin rend cet ustensile. ⛔ Un test qui lirait le source du fichier ou compterait des
   cases à cocher ne compte pas — c'est l'attaque exacte qui a fait tomber la première version des
   tests du lot E.
8. Allumer l'interrupteur avec **zéro** ustensile coché ouvre un `Panneau` (`role="dialog"`) qui
   annonce le nombre de recettes qui disparaîtraient, et **l'interrupteur reste éteint** tant que
   personne n'a confirmé.

⚠️ **CE QUI RENDRAIT CE CRITÈRE FAUX**, et c'est ce qui en fait un critère : une implémentation qui
rendrait `null` en toutes circonstances passerait 1, 2 et 5 et **échouerait 3, 4 et 6** ; une qui
transmettrait toujours la liste passerait 3, 4 et 6 et **échouerait 1, 2 et 5**. Les deux moitiés se
tiennent en tenaille — aucune constante ne satisfait les deux.

⛔ **LE GARDE-FOU N'EST PAS DU CONFORT.** Sans lui, un interrupteur allumé sur une table vide laisse
**59 recettes sur 330**. C'est le même défaut que le lot C de `CONCEPTION_REGIME_PERSONNALISE.md`
évitait : un écran qui peut vider le catalogue prévient **avant**, pas après.

**Ce que 65b ne touche pas** : `catalog/` (aucun YAML, aucune table, aucun rebuild), `engine/cuisine/`,
la couche `equipement` elle-même (son code est juste et reste tel quel — on change ce qui l'alimente),
la fiche détail d'une recette, et `equipment.partageable`.

#### Ce que la livraison a réellement posé — 2026-08-18

`user.db` v17, table singleton `user_equipment_filter (id, actif)`. `readFiltreEquipement` /
`writeFiltreEquipement` dans le store, et **une seule ligne changée dans `readConstraints`** :
`ownedEquipmentIds: readFiltreEquipement(db) ? (readOwnedEquipmentIds(db) ?? []) : null`. Section
« Ma cuisine » et panneau `ReglageMateriel` dans les Paramètres. **Aucune ligne du moteur n'a bougé.**

✅ **PREUVE PAR MUTATION, JOUÉE SUR LES 20 TESTS SCELLÉS**, `user-store.ts` remis à l'identique après
chaque essai :

| mutation de `readConstraints` | rouges | lesquels |
|---|---|---|
| témoin, arbre sain | **0** | 20/20 verts |
| `ownedEquipmentIds: null` — ignore la déclaration | **4** | clauses 3, 4, 6, 6 bis |
| `readOwnedEquipmentIds(db)` — ignore l'interrupteur | **6** | clauses 2, 4, 5, 5 bis, 6 bis, migration |
| `? readOwnedEquipmentIds(db) :` — replie `[]` sur `null` | **2** | clauses 4 et 6 bis |

⚠️ **LA TROISIÈME MUTATION N'AVAIT PAS ÉTÉ PRÉVUE**, et elle n'est vue que par DEUX tests, tous deux
sur le cas « allumé, table vide ». La clause 4 porte donc du poids à elle seule : la retirer rendrait
le `?? []` indéfendable.

⛔ **UN TEST UNITAIRE ORDINAIRE A CHANGÉ DE SENS, ET CE N'ÉTAIT PAS UN SCELLÉ.**
`app/src/data/user-store.test.ts` exigeait que `readConstraints` transmette le matériel **sans
condition** — c'est-à-dire exactement ce que le lot supprime. Il a été **scindé en deux** (aller-retour
en base d'un côté, contrat de l'interrupteur de l'autre), avec l'en-tête qui dit la date et la
décision. **Il n'a pas été mis en silence** : sa version neuve assert les trois cas.

⛔ **ET LE SCEAU LAISSE UN TROU, NOMMÉ PAR LA RELECTURE INDÉPENDANTE.** Aucun des 20 tests ne
vérifie que l'interrupteur **survit à la fermeture de l'application**. Une implémentation qui
garderait l'état dans une `WeakMap` indexée par l'objet `UserDb` passerait les vingt : aucun test ne
lit `user_equipment_filter` en SQL brut, et aucun ne rouvre la même base physique. ⚠️ **Le code
livré n'a PAS ce défaut — mesuré à part** : fichier écrit, fermé, rouvert, la table contient
`{id: 1, actif: 1}` et le moteur revoit `["four"]`. **C'est l'examen qui est incomplet, pas la
copie.** Inscrit en dette sur décision de l'auteur ▶ lot **65b-bis**.

---

### Lot 65b-bis — l'interrupteur survit à la fermeture, et le sceau le dit ✅ LIVRÉ le 2026-08-19 · commit `d0c4bb3`

Dette du 65b, inscrite sur décision de l'auteur plutôt que corrigée à chaud. Le lot 65b a livré un
interrupteur qui **persiste réellement** — mesuré — mais dont **aucun des 20 tests scellés n'exige la
persistance**. C'est l'examen qui est incomplet, pas la copie.

⛔ **LA FAILLE, NOMMÉE PAR LA RELECTURE, EN TROIS LIGNES :**

```
const cache = new WeakMap<UserDb, boolean>()      // clé = l'OBJET db, jamais la table SQL
readFiltreEquipement  = (db) => cache.get(db) ?? false
writeFiltreEquipement = (db, actif) => cache.set(db, actif)
```

Elle passe les vingt tests du 65b. Aucun ne lit `user_equipment_filter` en SQL brut, aucun ne rouvre
la même base **physique**. En production, l'utilisateur retrouverait son filtre éteint à chaque
lancement **pendant que son matériel, lui, survivrait** — l'asymétrie la plus déroutante possible.

⛔ **CE LOT VIOLE LA RÈGLE « UN TEST SCELLÉ DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT », ET IL FAUT LE
DIRE PLUTÔT QUE DE LE MAQUILLER.** Le code est déjà juste : ses tests seront **verts d'emblée**. Ce
n'est pas un test d'acceptation, c'est un **garde de régression**, et le repère habituel ne s'y
applique pas. ⚠️ **Ce qui le remplace, et qui vaut mieux : la MUTATION.** Un garde qui ne rougit pas
quand on casse le code ne garde rien. La preuve de sortie n'est donc pas « il était rouge hier »,
c'est « il devient rouge sous la fausse implémentation nommée ci-dessus ». **Aucun autre argument
n'est recevable pour ce lot.**

✅ **L'AUTEUR A VALIDÉ CE REMPLACEMENT LE 2026-08-18.** La question lui a été posée telle quelle :
« acceptes-tu que ce lot sorte sur la preuve par mutation au lieu du rouge du premier jour ? ».
Réponse : oui. ⚠️ **La dérogation vaut pour CE lot et pour ce motif** — un garde de régression posé
après coup sur du code déjà juste. Elle ne se cite pas pour un lot d'acceptation ordinaire, où le
rouge du premier jour reste la seule preuve que le test mesure quelque chose qui n'existait pas.

**Fini quand** — cinq clauses, sur un **vrai fichier** `user.db`, jamais `:memory:` :

1. Filtre allumé, base **fermée puis rouverte** : il est toujours allumé. ⛔ `:memory:` est
   interdit ici — une base en mémoire meurt avec sa connexion, le test ne mesurerait rien.
2. Filtre **éteint explicitement** puis rouvert : toujours éteint. La valeur revient, pas le défaut.
3. `user_equipment_filter` contient réellement `{id: 1, actif: 1}`, **lu en SQL brut**, sans passer
   par le store — un chemin indépendant de celui qu'on teste.
4. Après réouverture, `readConstraints` rend toujours la liste : **c'est la chaîne entière** qui
   survit, pas seulement le drapeau.
5. Une base **jamais réglée** n'a **aucune ligne** dans `user_equipment_filter`. ⛔ Sans cette
   clause, écrire `actif = 0` au démarrage passerait les quatre autres — et transformerait « n'a
   jamais répondu » en « a répondu non », ce que tout le 65b a construit pour distinguer.
6. **La preuve par mutation est jouée et écrite ici** : sous la fausse implémentation `WeakMap`, les
   clauses 1 à 4 rougissent. Si l'une d'elles reste verte, elle ne garde rien et sort du lot.

**LA PREUVE PAR MUTATION, JOUÉE LE 2026-08-18 — clause 6 remplie.** La fausse implémentation ci-
dessus a remplacé les deux fonctions du store, la suite a tourné, le fichier a été restauré :

| tests scellés | arbre sain | sous la `WeakMap` |
|---|---|---|
| `65b.test.ts` + `65b-ecran.test.tsx` | 20/20 verts | **20/20 verts** — la faille passe intacte |
| `65b-bis.test.ts` | 5/5 verts | **1/5 vert, 4 rouges** — clauses 1, 2, 3, 4 |

⛔ **LA PREMIÈRE LIGNE EST LE CONSTAT, PAS UN DÉTAIL.** Vingt tests d'acceptation, écrits avant le
code et attaqués par un relecteur, ne voient rien passer. Ce n'est pas qu'ils étaient mal écrits :
ils gardaient une AUTRE question — « le filtre change-t-il ce que le moteur reçoit ? » — et ils y
répondent toujours. La persistance est une question distincte, et une question non posée n'a pas de
réponse fausse : elle n'a pas de réponse.

⚠️ **La clause 5 reste verte sous la mutation, et c'est correct.** Elle mesure qu'une base jamais
réglée ne porte AUCUNE ligne ; une `WeakMap` n'écrit rien en base, donc zéro ligne aussi. Elle ne
garde pas contre cette faille-là, elle garde contre l'écriture d'un `actif = 0` au démarrage — la
confusion « n'a rien dit » / « a dit non ». Deux gardes, deux fautes différentes.
**Ce que 65b-bis ne touche pas** : aucun code de production. **Pas une ligne.** Si ce lot modifie
`app/src/`, c'est qu'il a cessé d'être ce qu'il est — dis-le et arrête-toi.

**CLÔTURE DU 2026-08-19.** Les cinq clauses sont écrites et vertes ; la sixième — la mutation —
était déjà jouée à la rédaction, et son tableau ci-dessus n'a pas été retouché. Relevé sur l'arbre
fermé : `npm test` → **2 238 passed / 0 failed (121 fichiers)** en 66,9 s · typecheck propre ·
`npx vite build` ✓ (2,98 s) · `engine:plan-stress` **20/20**. `audit-mapping` **non relancé, et
c'est justifié** : ce lot ne touche à aucune ligne de catalogue.

⛔ **CE LOT N'A PAS DE COMMIT À LUI, ET IL FAUT LE SAVOIR POUR LE RETROUVER.** Son fichier de test
est parti **dans `d0c4bb3`**, le commit du 65b, avant même que le lot ne soit ouvert. Un
`git log -S` sur un identifiant du 65b-bis renvoie donc au 65b et non à une livraison distincte —
ce n'est pas une anomalie de l'historique, c'est l'ordre dans lequel les choses se sont faites.
Seule la présente clôture porte un commit propre, et il ne contient que des documents.

---

### Lot 65c — la quantité de feux et les occupations de plaque ✅ LIVRÉ le 2026-08-20 · commit `4a9f373`

**Les deux ensemble, jamais l'une sans l'autre**, et c'est la leçon de l'écart (1) ci-dessus :
`user_equipment.quantite` sans occupation de plaque au catalogue ne produit **aucun** affichage, et
des occupations de plaque sans quantité laissent le moteur se taire — `capaciteDepuisPartage` rend
`null` pour `selon_quantite`, par construction.

### La mesure préalable, faite le 2026-08-19 — le lot ne pouvait pas s'écrire avant

⛔ **LE CHIFFRE QUI MANQUAIT EXISTE : 285 OCCUPATIONS DE PLAQUE SUR 166 RECETTES.** Dérivées des
gestes du lexique sur `catalog.db` réel, jamais estimées. Trois fois le four, qui en porte 91 sur
84 recettes.

| ce qui est mesuré | valeur |
|---|---|
| recettes qui **exigent** la plaque (`recipe_equipment.niveau='requis'`) | **260 / 330** |
| occupations de plaque enregistrées **aujourd'hui** | **0** — le détecteur ne connaît que le four |
| occupations dérivables, règle complète | **285**, sur **166 recettes** |
| dont par un geste sûr (15 codes) | 267 |
| dont par `dorer` + indice dans l'étape même | 13 |
| dont par `dorer` + indice **reporté d'une étape précédente** | 5 |
| écartées : signe de four | 1 |
| écartées : `dorer` sans aucun indice, ni chez lui ni avant | 11 |
| écartées : étape déjà occupée par le four ou le micro-ondes | 27 |

⛔ **`dorer` EST LE PIÈGE DE CE LOT, ET IL A FAILLI PASSER.** C'est le geste le plus fréquent de la
liste — 64 étapes — et **23 d'entre elles sont au four**. Une règle qui lit seulement l'étape en
attrape 22 ; la vingt-troisième ne se trahit que par l'étape d'avant :

> `pommes_terre_four_romarin` #5 — « Retourner les quartiers et poursuivre jusqu'à ce qu'ils
> soient dorés. » Rien dans cette phrase ne dit le four. L'étape #2 l'y a mises.

⭐ **D'OÙ LA RÈGLE DE REPORT, POSÉE PAR L'AUTEUR LE 2026-08-19** : un geste ambigu prend l'indice de
son étape, et à défaut celui des quatre étapes qui précèdent — un plat mis au four y reste jusqu'à
ce qu'on l'en sorte. Le report rattrape **1 faux positif** que la lecture à l'étape seule laissait
passer, et **confirme 5 occupations** de plaque qui n'ont aucun mot à elles.

⚠️ **ET IL RESTE 11 `dorer` QUE RIEN NE TRANCHE**, pas même les étapes d'avant : « faire dorer les
amandes à sec », « griller les tranches de pain complet ». **La règle ne devine pas** — elle les
laisse dehors, et c'est un choix : deux d'entre eux sont probablement un grille-pain, pas un feu.
Les déclarer un par un est possible plus tard ; le lot ne le fait pas.

⚠️ **94 RECETTES EXIGENT LA PLAQUE SANS QU'AUCUNE ÉTAPE NE L'OCCUPE** (260 − 166), et ce n'est pas
un défaut du détecteur : « cuire les pâtes », « porter à ébullition » ne portent aucun geste du
lexique. **Écrit plutôt que découvert.** Le lot ne prétend pas fermer cet écart.

⚠️ **`vapeur` N'ENTRE PAS DANS LA RÈGLE.** Ses 2 étapes décrivent un risque et ne commandent rien
— « entassés, ils cuiraient à la vapeur ». C'est le piège de `poireaux_gratines_bechamel`, déjà
payé au lot 65a-B.

### ⚔️ Le brief a été attaqué le 2026-08-20, et il n'a pas tenu

⛔ **UN CRITIQUE A ÉCRIT DEUX IMPLÉMENTATIONS FAUSSES QUI PASSAIENT LES DIX CLAUSES D'ORIGINE.**
Elles sont écrites ici parce qu'un trou refermé sans être nommé se rouvre au lot suivant.

| la triche | ce qu'elle faisait | ce qui la laissait passer |
|---|---|---|
| **au hasard** | poser une occupation sur n'importe quelle étape libre de 166 recettes, **sans lire un mot de texte** | on scellait un TOTAL et cinq points nommés ; les 161 autres recettes n'étaient vérifiées par rien |
| **hors du temps** | compter les recettes DISTINCTES qui demandent l'ustensile, sans regarder QUAND | les deux plats du test se recouvraient ; aucun cas disjoint n'était testé |

⛔ **LA SECONDE EST LA PLUS GRAVE : elle réintroduit en silence la régression que le 65a a payé
63 % de fausses alertes pour éliminer**, et l'ancien sceau la déclarait verte.

Trois autres trous, plus petits, tous vérifiés dans le code :

- `readEquipmentQuantite = () => 3` suffisait — **3 était le seul nombre jamais écrit** de toute la
  suite.
- ⛔ **`writeOwnedEquipmentIds` fait `DELETE FROM user_equipment` puis réinsère** (`user-store.ts`,
  l. 358-365), **et l'écran du 65b l'appelle à chaque cochage**. Le lot livrait donc une quantité que
  le clic suivant effaçait sans erreur, sans type fâché, sans test rouge. C'est le piège
  `INSERT OR REPLACE` de `CLAUDE.md` sous un autre nom, et **personne ne l'avait vu**.
- Le test passait un `Map` à `conflitsDEquipement`, qui prend une **fonction** — il ne testait donc
  pas le chemin réel de `cuisine.tsx`.

### Les trois signatures, tranchées ici pour qu'on n'ait pas à les deviner

1. **`capaciteDepuisPartage(partageable, quantiteDeclaree?)`** — un second argument OPTIONNEL. Les
   appelants d'aujourd'hui continuent de marcher sans le passer, et continuent de recevoir `null`.
2. **`conflitsDEquipement(plats, capaciteDe)` NE CHANGE PAS.** `capaciteDe` reste une **fonction**
   `(code) => number | null`, comme `cuisine.tsx` l'appelle. Les « plats » restent des `Recipe`
   entières : les fenêtres se calculent dans le moteur, elles ne se fabriquent pas dans le test.
3. **`writeOwnedEquipmentIds` cesse d'effacer.** `INSERT … ON CONFLICT DO UPDATE`, jamais un
   `DELETE` suivi d'un `INSERT` — la quantité est une colonne de cette table et elle a des enfants.

**Fini quand** — seize clauses. Les huit premières portent le catalogue, les huit suivantes le
réglage et le moteur. ⛔ **Les deux moitiés ensemble ou aucune** : une quantité de feux sans
occupation de plaque n'affiche rien, et des occupations sans quantité laissent le moteur muet.

**Moitié A — le catalogue**

1. **Exactement 166 recettes** portent une occupation `plaque_cuisson` dans `recipe_step_equipment`,
   comptées sur le `catalog.db` construit par `catalog/build.mjs` — **jamais sur une fixture**.
   ⛔ **C'EST LE COMPTE DE RECETTES QUI EST SCELLÉ, PAS CELUI DES LIGNES, ET C'EST LA LEÇON DU 65a.**
   Les 285 sont mesurées **par étape** ; le modèle à portée (`ordre_debut`/`ordre_fin`) ne compte pas
   le même objet dès que deux occupations se rejoignent.
2. ⛔ **AUCUNE OCCUPATION INVENTÉE.** Toute occupation de plaque couvre au moins une étape qui porte
   un des **seize gestes** de la règle. ⭐ **C'est la clause qui tue le placement au hasard** : sans
   elle, la clause 1 se satisfait de 166 lignes posées n'importe où.
3. ⛔ **AUCUNE OCCUPATION OMISE.** Toute étape qui porte un des **quinze gestes sûrs**, et que le
   four ou le micro-ondes ne prend pas déjà, porte une occupation de plaque — les 267 y passent.
   ⭐ **C'est la clause qui tue « une occupation par recette »**, sans nommer une seule recette.
4. ⛔ **`pommes_terre_four_romarin` #5 ne porte AUCUNE occupation de plaque.** C'est le cas que la
   règle de report existe pour attraper ; sans elle il en porte une.
5. ⚠️ **Et le four ne la revendique pas non plus** : sa portée s'arrête à l'étape 4. L'étape 5
   n'appartient à aucun ustensile. **Écart nommé, hors périmètre** — étendre les portées est un
   autre lot, et le sceau l'écrit pour que personne ne croie que le report l'a réparé.
6. ⛔ **Les 11 `dorer` indécis ne portent aucune occupation** — vérifié nommément sur
   `tartine_sardine_citron_echalote` #4 et `riz_pilaf_amandes` #1.
7. Les gestes sûrs marchent : `boeuf_bourguignon` #1 (*saisir*) et `blanquette_veau` #1 (*frémir*)
   portent chacun une occupation de plaque.
8. ⛔ **Aucune étape ne porte à la fois une occupation de four et une de plaque.** Les 27 étapes
   déjà occupées restent au four seul.

**Moitié B — le réglage, et le moteur**

9. `user_equipment` porte une **quantité déclarée**, et ⛔ **relue après fermeture et réouverture du
   fichier**, lue une troisième fois en SQL brut — la leçon du 65b-bis s'applique d'emblée.
10. ⛔ **La quantité relue est CELLE QU'ON A ÉCRITE** : 4, puis 1, et un autre ustensile à 2 qui ne
    bouge pas. Un ustensile jamais déclaré rend `null`, pas 1. ⭐ **C'est la clause qui tue
    `() => 3`.**
11. ⛔ **Resauver la liste du matériel n'efface pas la quantité déjà déclarée.** Le chemin exact de
    l'écran du 65b : cocher une case de plus, et retrouver ses quatre feux. ⭐ **Le trou le plus
    dangereux des cinq** — sans cette clause, le lot livre un effacement silencieux.
12. `capaciteDepuisPartage` rend **le nombre déclaré** pour `selon_quantite` quand la quantité est
    connue ; `null` sans elle ; `jamais` → 1 et `toujours` → ∞ ne bougent pas d'un iota.
13. Deux plats qui occupent la plaque **en même temps** produisent un conflit qui **nomme les deux**
    quand un seul feu est déclaré, et **aucun conflit** quand quatre le sont. Le même montage, deux
    réponses.
14. ⛔ **Deux plats qui tiennent le feu à des MOMENTS DIFFÉRENTS ne se disputent rien**, à un seul
    feu. ⭐ **C'est la clause qui tue le comptage hors du temps** — et elle se cherche dans le
    catalogue, pas sur une paire choisie d'avance : il doit exister une paire qui se dispute la
    plaque ET une qui ne se la dispute pas, sur la même donnée et à la même capacité.
15. ⛔ **Trois plats, deux seulement qui se chevauchent : le conflit ne nomme que ces deux-là.** Un
    comptage global nommerait les trois.
16. ⛔ **Quantité NON déclarée ⇒ le moteur se tait sur la plaque, exactement comme aujourd'hui.**
    C'est la propriété que le 65a a payée pour obtenir — 63 % de fausses alertes éteintes. Un lot qui
    la casse en croyant bien faire est un lot raté, et cette clause est là pour le dire.

#### Ce qui a été livré le 2026-08-20, et ce qui ne l'a pas été

✅ **LES SEIZE CLAUSES PASSENT, ET LES CHIFFRES SONT CEUX D'AVANT LE CODE** : 285 occupations de
plaque sur **166 recettes**, mesurées le 2026-08-19 et retrouvées à l'identique le 2026-08-20.
`recipe_step_equipment` passe de 92 à **377 occupations sur 228 recettes**.

⛔ **UNE MOITIÉ DU LOT N'EST DÉMONTRÉE PAR AUCUN TEST, ET C'EST ÉCRIT ICI PARCE QUE C'EST LA RÈGLE.**
Le **champ visible** « combien en avez-vous ? » de l'écran de matériel a été ajouté à la demande
explicite de l'auteur, APRÈS que les seize clauses aient été scellées. Les seize s'arrêtent à la
donnée et au moteur : **aucune ne rend l'écran.** Il marche — il écrit ce que les clauses 9 à 11
relisent — mais rien ne le garde. ▶ C'est exactement ce qui est arrivé au lot D3.

⛔ **DEUX CLAUSES SCELLÉES DU 65b ONT ÉTÉ DESSERRÉES POUR QUE CE LOT PASSE**, par décision de
l'auteur du 2026-08-20. Elles écrivaient le numéro de schéma **en dur** (`toBe(17)`), ce qui
n'affirmait pas seulement « la v17 existe » mais « et il n'y en aura jamais de dix-huitième ».
▶ Motif, ce qui reste scellé et ce qui saute : `ETAT.md` §3.

⚠️ **LE TROU LE PLUS DANGEREUX N'A PAS ÉTÉ TROUVÉ PAR LA SUITE DE TESTS.** Cocher une case du même
écran aurait effacé la quantité déjà déclarée — sans erreur, sans type fâché, sans rouge. C'est un
critique lancé sur le brief AVANT le code qui l'a vu, et la clause 11 existe pour ça.

**Ce que le lot ne touche pas** : le four et le micro-ondes — leurs 92 occupations sont inchangées.
La liste du matériel possédé et l'interrupteur du 65b — seule la quantité s'ajoute. Le solveur de
plan de semaine : `engine:plan-stress` doit rendre 20/20 avant et après.

⚠️ **Rien ne presse ce lot, et `ETAT.md` le dit** : « ce silence est un état stable, pas un
provisoire — il ne coûte aucune fausse alerte, donc rien ne le forcera à se refermer. »

---

## ✅ 65a — LIVRÉ le 2026-08-13, cinq lots · commit `faf115c` sur `main`

⚠️ **Ce commit emporte aussi le texte de la lane MÉDIA dans `ETAT.md`**, et c'était prévu : elle
avait écrit son état sans commiter parce que cette lane tenait le fichier, et laissé un bandeau
demandant au committeur de le relire puis de le retirer. **Son code, lui, n'est pas dedans** — il
vit sur `lot/photo-affichage` (`f3d4fa1`), non fusionné.

**Le total qui manquait est mesuré : 92.** `recipe_step_equipment` porte **92 occupations sur
85 recettes — 4 déclarées, 88 dérivées**. Les 98 du lot A étaient des lignes **par étape** ; le
modèle à portée replie les étapes contiguës. Le palier de 98 n'a **pas** été relevé à la main entre
A et B — l'avertissement ci-dessus disait que rien ne le rappellerait, et rien ne l'a rappelé.

**Relevé sur l'arbre livré, 2026-08-13** : `npm test` → **2 136 passed / 0 failed (110 fichiers)** ·
typecheck propre · `npx vite build` ✓ (3,34 s) · `engine:plan-stress` **20/20** ·
`catalog/audit-mapping.mjs` → 451 mappings, 9 candidats (inchangé).

⚠️ **Le compte de tests a BAISSÉ de 2 144 à 2 136, sans aucun rouge.** L'écart est attribué et
non déduit : **−11** par la suppression de `app/src/engine/cuisine/equipement-partage.test.ts`,
qui ne testait que la fonction retirée, **+3** ajoutés à `tests/scelles/65a-ecran.test.tsx`. Une
baisse sans rouge est un signal dans ce dépôt ; celle-ci est expliquée ligne à ligne.

**Ce que le taux de fausses alertes devient.** L'ancien détecteur répondait « le four est pris par
le colin et le gratin » sans jamais dire quand : **63 % de fausses alertes** mesurées. Le moteur en
intervalles ne signale que le chevauchement réel. Sur les paires de recettes portant une occupation
de four, **2 831 des 3 321 paires se chevauchent encore (85,2 %)** — la fenêtre écarte donc environ
une paire sur sept, pas la majorité. **Le gain n'est pas le volume, c'est la phrase** : ce qui
s'affiche est une plage, pas une liste de noms.

### Lot 65a-A — la table d'occupations, dérivée du texte ✅ LIVRÉ le 2026-08-13

Une table neuve, **calquée trait pour trait sur `recipe_step_ingredient`**, qui résout déjà ce
problème pour les ingrédients :

```sql
CREATE TABLE recipe_step_equipment (
  recipe_id    TEXT NOT NULL,
  ordre_debut  INTEGER NOT NULL,
  ordre_fin    INTEGER NOT NULL,
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  origine      TEXT NOT NULL CHECK (origine IN ('declare', 'derive')),
  CHECK (ordre_fin >= ordre_debut),
  PRIMARY KEY (recipe_id, ordre_debut, equipment_id),
  FOREIGN KEY (recipe_id, ordre_debut) REFERENCES recipe_step(recipe_id, ordre)
);
```

⭐ **UNE OCCUPATION PORTE UN DÉBUT ET UNE FIN D'ÉTAPE — décidé le 2026-08-13, et ce n'était pas le
premier modèle.** La table portait un `ordre` unique, une ligne par étape détectée. C'est
`oeufs_cocotte_epinards` qui l'a fait tomber : le plat d'eau du bain-marie **entre au four à
l'étape 1 et y reste jusqu'à l'étape 5**, pendant qu'on fait tomber les épinards et qu'on remplit
les ramequins. Une ligne par étape aurait enregistré 1 et 5, donc déclaré le four **libre aux
étapes 2, 3 et 4** — pendant qu'il chauffe de l'eau.

⛔ **ET C'EST L'INVERSE EXACT DU TÉMOIN.** Les deux recettes s'écrivaient pareil et ne disent pas la
même chose :

| | ce qui se passe | ce que la table doit dire |
|---|---|---|
| `colin_four_fenouil` | on enfourne, **on sort le plat**, on remet | deux occupations : `[2,2]` et `[4,4]` — le trou de l'étape 3 est **vrai** |
| `oeufs_cocotte_epinards` | l'eau entre et **ne ressort pas** | une occupation : `[1,5]` — il n'y a **pas** de trou |

⛔ **LE SENS DE L'ERREUR N'EST PAS SYMÉTRIQUE.** Annoncer le four pris alors qu'il est libre agace ;
annoncer le four libre alors qu'il est pris **fait rater un plat**. En cas de doute sur une
continuité, c'est le doute qui doit être visible, pas comblé au jugé.

⛔ **LA CONTINUITÉ NE SE DÉDUIT PAS, ELLE SE DÉCLARE.** Aucune règle ne sépare le trou vrai du colin
du trou faux des œufs sans lire ce que la recette fait de l'objet entre les deux. Donc : le
détecteur produit par défaut des occupations d'**une seule étape** (`ordre_debut = ordre_fin`), et
c'est une **déclaration dans la source** qui étend la portée. Même mécanique que le lot B, qui
corrige un faux positif par déclaration plutôt qu'en durcissant le détecteur.

⚠️ **LES CONTINUITÉS N'ONT JAMAIS ÉTÉ RECHERCHÉES.** Les 24 cas relus à la main l'ont été pour
trouver des **faux positifs**, pas des continuités, et les 74 occupations portées par `enfourner`
n'ont été relues pour rien du tout. **`oeufs_cocotte_epinards` a été trouvé par hasard, en relisant
une recette entière pour une autre raison.** Il y en a probablement d'autres. Cette passe est du
travail du lot A, et son résultat n'est pas connu au moment où ces lignes sont écrites.

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

#### Ce que le détecteur lit exactement — ajouté le 2026-08-13

⛔ **CES TROIS POINTS ÉTAIENT ABSENTS DU BRIEF, ET LE CODEUR LES AURAIT DEVINÉS.** Une heuristique
inventée pour retomber sur un total connu n'est pas une implémentation, c'est un ajustement de
courbe sur sept points de données.

1. **Le geste `enfourner`** — occupation, sans condition. C'est une annotation humaine dont c'est le
   sens exact.
2. **Quatre gestes implicites** : `gratiner`, `rotir`, `papillote`, `bain_marie`. Le four sans le
   nommer. ⚠️ **`prechauffer` N'EN FAIT PAS PARTIE** : préchauffer, c'est régler un appareil vide.
3. **Le texte**, seulement sur la partie de l'étape qui précède un tiret cadratin, et seulement si
   elle mentionne le four autrement que pour l'en sortir. Les 10 cas mesurés se répartissent en
   « remettre au four », « sous le gril du four », et une température en °C dans une étape qui cite
   déjà un geste de cuisson.

⚠️ **LE TOTAL DE 98 EST UNE MESURE, PAS UNE CIBLE.** Si la règle ci-dessus rend 96 ou 101, **c'est
la mesure qui est à refaire, pas la règle à tordre** jusqu'à retomber sur 98. Un détecteur ajusté
pour atteindre un nombre est un détecteur qu'un lot de contenu casse en silence — l'objection même
que la décision 65 opposait à la dérivation.

#### Où s'écrit une déclaration — ajouté le 2026-08-13

Dans le YAML de la recette, sur l'étape, à côté de `lexicon_ids` et `timer_s` :

```yaml
  - ordre: 1
    texte: "Préchauffer le four à 180 °C et mettre à chauffer un plat rempli d'eau…"
    lexicon_ids: [bain_marie, prechauffer]
    occupe:
      - code: four
        jusqu_a: 5        # facultatif ; absent = l'occupation tient sur cette seule étape
```

⛔ **`occupe` NE SERT QU'À AJOUTER OU À ÉTENDRE, JAMAIS À NIER.** Retirer un faux positif (lot B) se
fait en corrigeant **le texte ou les gestes de l'étape**, pas en écrivant « pas d'occupation ici ».
Stocker une absence obligerait la table à porter des lignes qui ne décrivent rien.

**Fini quand** : 98 occupations en base, **aucune recette muette**, `colin_four_fenouil` porte
**deux** lignes `four` (étapes 2 et 4), et la règle vit **en un seul exemplaire versionné** dans
`catalog/lien-etape-equipement.mjs`, importée par `build.mjs`.

⚠️ **CETTE DERNIÈRE CLAUSE A ÉTÉ RÉÉCRITE LE 2026-08-13.** Elle demandait à
`node atelier/mesure-occupation-four.mjs` de retrouver le compte du build. **`atelier/` est
gitignoré en entier** (`.gitignore:43`) : la clause n'était vérifiable sur **aucun clone**, et un
critère d'acceptation qui ne se rejoue nulle part ailleurs n'est pas un critère. Le compte, lui, se
vérifie directement contre la base. L'intention conservée est l'autre moitié : une règle, un
exemplaire, versionné.

---

### Lot 65a-B — corriger les 6 faux, par déclaration ✅ LIVRÉ le 2026-08-13

Le détecteur se trompe **6 fois sur 98 (~6 %)**, mesuré en relisant **à la main les 24 cas qui ne
reposent pas sur le geste `enfourner`** : **18 justes, 6 faux**. Les six, en trois familles :

| Cas | Ce que le détecteur voit | Ce qui se passe vraiment |
|---|---|---|
| `sardines_grillees_tomates` ét. 4 | le geste `rotir` | **on sert** |
| `pommes_terre_four_romarin` ét. 2 | le geste `rotir` | **on rince et on sèche** |
| `boulgour_pois_chiches_courgettes` ét. 3 | le geste `rotir` | **on mélange** |
| `chou_fleur_roti_curcuma` ét. 3 | le geste `rotir` | **on étale**, et la phrase explique pourquoi |
| `poireaux_gratines_bechamel` ét. 3 | « l'eau rendue au four » | **une phrase d'explication** |
| ~~`oeufs_cocotte_epinards` ét. 1~~ | ~~`bain_marie` + préchauffage~~ | ⛔ **TRANCHÉ LE 2026-08-13 : CE N'EST PAS UN FAUX POSITIF.** Le détecteur avait raison |

⛔ **LE SIXIÈME CAS EST SORTI DE LA LISTE — ILS SONT CINQ.** `oeufs_cocotte_epinards` étape 1 était
noté « discutable ». Il ne l'est plus : le plat d'eau **entre dans le four** au préchauffage et n'en
ressort pas avant l'étape 5. Le four est bel et bien occupé, et il l'est **en continu** — c'est ce
cas qui a imposé le modèle à portée du lot A. ⚠️ **Ne pas relire ça comme « le détecteur ratisse
large » : il a vu juste ici.** Ce qui manquait n'était pas de la sévérité, c'était la portée.

⚠️ **ET LA RÈGLE GÉNÉRALE NE BOUGE PAS : préchauffer n'occupe pas le four.** `colin_four_fenouil`
étape 1 préchauffe à vide et ne compte toujours pas. Ce qui occupe ici, c'est `bain_marie` —
l'objet posé dedans — pas `prechauffer`.

⛔ **ON CORRIGE LES SIX RECETTES, PAS LE DÉTECTEUR.** Un détecteur durci pour six cas devient un
détecteur qu'un lot de contenu casse en silence — c'est l'objection que la décision 65 opposait à la
dérivation, et elle reste juste **appliquée au détecteur**. Une déclaration explicite dans la source,
elle, ne casse rien.

⚠️ **Les 74 occupations portées par `enfourner` n'ont PAS été relues.** Elles sont tenues pour justes
**par construction**. Si ce postulat tombe, le taux de 6 % tombe avec — le dire ici pour que
personne ne le redécouvre en le prenant pour un audit complet.

**Fini quand** : **0 faux sur les 24 cas fragiles**, et les **5** étapes corrigées ne portent plus
aucune occupation de four.

⛔ **AMBIGUÏTÉ LEVÉE LE 2026-08-13.** Cette ligne disait « compte à 92 occupations **et** les
6 lignes corrigées portent `origine = 'declare'` » — deux clauses qui ne peuvent pas être vraies
ensemble. Si les lignes fautives sont **retirées**, elles n'existent plus et ne portent rien ; si
elles **restent** avec `origine = 'declare'`, le compte ne descend pas. Le sens retenu est le
premier : **corriger, c'est faire disparaître l'occupation**, et `declare` sert à écrire ce qui
**est**, jamais ce qui n'est pas. Une déclaration négative aurait demandé une ligne « le four n'est
pas occupé ici », c'est-à-dire stocker une absence — ce que la table ne sait pas faire et n'a pas à
apprendre.

---

### Lot 65a-C — la capacité ⭐ *c'est une décision, pas du travail* — C′ ✅ LIVRÉ le 2026-08-13 · C″ ✅ LIVRÉ EN 65b le 2026-08-18 (`d0c4bb3`)

> ⭐ **CE LOT EST COUPÉ EN DEUX DEPUIS LE 2026-08-13 — voir « La coupe 65a / 65b » plus haut.**
> **C′** (`equipment.partageable`, suppression de `CODES_INDIVISIBLES`) appartient à **65a**.
> **C″** (`user_equipment.quantite`, l'écran de réglage, la plaque) appartient à **65b**.
> Le texte ci-dessous décrit les deux moitiés ensemble : le lire en gardant la coupe en tête.
>
> ✅ **LES DEUX MOITIÉS SONT LIVRÉES — titre corrigé le 2026-08-22.** Il annonçait encore « C″ (65b)
> NON OUVERT » alors que le 65b est livré le 2026-08-18 (`d0c4bb3`, ligne 225 de ce document) et
> que le 65c a suivi le 2026-08-20 (`4a9f373`). ⚠️ **Le corps du lot n'a PAS été réécrit** : il
> décrit le plan tel qu'il a été pensé, et un plan ne se réécrit pas après coup. Ce qui a été livré
> se lit aux sections 65b, 65b-bis et 65c.

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

### Lot 65a-D — le moteur, en intervalles ✅ LIVRÉ le 2026-08-13

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

#### Les deux contrats qui manquaient — ajoutés le 2026-08-13

**Quelle durée alimente l'intervalle** : `recipe_step.timer_s`, **et seulement quand
`timer_type = 'cuisson'`**. ⛔ **JAMAIS `timer_type = 'repos'`** : une pâte qui lève n'occupe pas le
four. ⛔ **ET JAMAIS `temps_cuisson_min` DE LA RECETTE** — c'est un total, il ne sait pas à quelle
étape il s'applique, et le confondre avec la durée d'une étape est exactement le défaut que
`duree.ts` a corrigé. Une occupation dont aucune étape couverte ne porte de minuteur `cuisson` a une
**durée inconnue** : elle se signale comme telle et **ne se devine pas**.

**Ce que rend `capaciteDe`** : le nombre de choses que l'ustensile peut porter en même temps, ou
`null` pour « on ne sait pas ».

| `partageable` | ce que `capaciteDe` rend en 65a | effet |
|---|---|---|
| `jamais` | `1` | une occupation à la fois — c'est le four |
| `selon_quantite` | `null` (la quantité vit en 65b) | **aucun conflit signalé**, jamais |
| `toujours` | `Infinity` | aucun conflit possible |

⛔ **`null` NE VAUT PAS `1`.** C'est « la personne n'a pas répondu », pas « elle en a un ». Un
ustensile `selon_quantite` sans réponse **se tait** : on n'invente pas une contrainte qu'on n'a pas
mesurée. C'est ce qui rend 65a strictement additif sur la plaque.

**Fini quand** : deux plats dans la même session signalent le conflit sur la **première** cuisson et
**pas sur le trou** entre les deux occupations de `colin_four_fenouil` ; `plan-stress` à 20/20 ;
couverture du module au niveau du reste de `engine/cuisine/`.

---

### Lot 65a-E — l'écran ✅ LIVRÉ le 2026-08-13

> « Le four est pris de 18h10 à 18h35. »

Un fait, une plage. **Pas de croix rouge, pas de « conflit », pas de score, pas de code couleur.**

⛔ **Principe 6 — informer, jamais juger.** Un badge rouge sur un repas que la personne a choisi de
faire transforme son choix en anomalie. L'écran dit **ce qui est pris et quand**, elle décide.

⚠️ **Les fenêtres, pas les menus déroulants** : réglages et filtres ouvrent un `Panneau`, le
déclencheur porte `aria-haspopup="dialog"`, jamais `aria-expanded`, et les tests lisent la présence
du dialogue.

**Fini quand** : la plage s'affiche pour une session à deux plats concurrents, l'écran reste muet
quand la capacité suffit, et aucun jeton de couleur d'alerte n'a été ajouté.

⚠️ **LA MOITIÉ « SANS HEURE DE SERVICE » N'EST DÉMONTRÉE PAR AUCUN TEST SCELLÉ — écrit ici parce
que c'est exactement ce qui est arrivé au lot D3.** L'écran a **deux** formulations : une plage
d'horloge (« de 19h43 à 19h57 ») quand `heure_service_ms` est connue, une fenêtre relative (« de 17
à 3 min avant le service ») quand elle ne l'est pas. Les tests scellés de 65a **posent tous une
heure de service** et ne franchissent donc jamais la seconde branche. Elle est couverte
uniquement par `app/src/ui/screens/cuisine.test.tsx`, qui n'est **pas** scellé et peut être réécrit
pour coller au code le jour où il rougira. Ce n'est pas une conjecture : la branche relative est
codée et verte, mais **rien n'empêche structurellement de la casser**.

Cette asymétrie vient d'une contradiction trouvée pendant le lot : le test scellé initial exigeait
un horaire `\d{1,2}h\d{2}` sur une base fraîche, où `heure_service_ms` est NULL — alors que le
garde-fou §6.2 interdit de deviner un horaire. On ne peut pas afficher une horloge sans ancre. Le
test a été corrigé (sous autorisation explicite) pour poser l'ancre ; la branche sans ancre est
restée hors sceau.

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
