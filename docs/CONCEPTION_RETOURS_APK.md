# Chantier — les retours de la passe APK (2026-09-12)

> **Ce document fait foi pour les lots A à G.** État d'avancement : [ETAT.md](./ETAT.md).
> Ne pas confondre avec [CONCEPTION_RETOURS_TEST.md](./CONCEPTION_RETOURS_TEST.md), qui porte la
> passe du 2026-08-21 (lots `retour-1` à `retour-8`, tous livrés) faite **dans un navigateur**.

## 1. D'où vient ce chantier

Le 2026-09-12, l'application a été installée pour la première fois **en APK sur un téléphone
Android** (Poco F8 Ultra) — pas en PWA, pas au navigateur de bureau. La chaîne de fabrication est
en mémoire, hors dépôt : voir `~/.claude/.../memory/apk-vers-telephone.md`.

L'auteur a parcouru les neuf écrans et produit **une quarantaine d'observations**. Elles ont été
confrontées au code écran par écran avant d'être classées ici : trois visaient à côté, six
touchaient un principe ou une décision gelée, le reste sont des défauts nets.

⚠️ **C'est la « passe à l'œil sur téléphone » que `FICHE_REPRISE.md` réclamait depuis le
2026-08-21.** Elle a eu lieu. Ce qu'elle a trouvé vit ici.

### Ce qui visait à côté, et pourquoi c'est utile quand même

| Observation | Ce que le code dit |
|---|---|
| « Enlever les valeurs nutritionnelles » | Elles sont **déjà masquées par défaut** (`afficher_macros` = 0). Ce qui reste visible est la ligne d'accès, qui affiche « Non affichées » et **aucun chiffre**. Le retour est donc de l'**encombrement visuel**, pas une fuite — il rejoint le lot B. |
| « Toujours pas d'image » | **129 recettes sur 339** portent une photo (38 %). Les aliments n'ont **aucun champ image** : il n'y en aura jamais sans un chantier de données neuf. |
| « Distinguer les familles dans l'ajout rapide du frigo » | Les familles **existent déjà**, en onglets défilants (`Food.groupe`). Soit elles ne se voient pas, soit c'est une autre taxonomie qui est demandée — `groupe` est un **rayon de magasin**, pas une classification diététique. |

## 2. Ce qui a été tranché pendant l'analyse

**(a) Les explications du moteur ne s'affichent plus par défaut.** « change de vos derniers repas ·
ingrédients de saison », « 1 ingrédient sur 4 déjà chez vous », les compteurs d'historique : tout
passe derrière une option de Paramètres, **décochée à l'installation**.

⚠️ **Cela touche le principe 3** (« toute suggestion s'explique en une phrase »). Une variante était
proposée — une ligne « Pourquoi ce plat ? » dépliable sur place, qui gardait l'explication à un tap
— et elle a été **explicitement refusée par l'auteur le 2026-09-12** au profit de l'option. Le
principe reste tenu au sens où l'explication n'est ni supprimée ni fausse : elle est **facultative**.
À porter en décision dans `ETAT.md` §3 à la livraison du lot B.

**(b) La décision 60 est précisée, pas renversée.** En mode cuisine, la ligne de quantités sous une
étape **ne répète plus une quantité déjà donnée à une étape précédente**. La décision 60 interdit à
l'écran de « mentir par omission » — elle visait une proposition différente (remplacer la liste
complète des ingrédients par celle de l'étape, ce qui faisait disparaître 5 % des ingrédients de
partout). Ici rien ne disparaît : la liste entière reste à un tap derrière « Voir les ingrédients »,
et la quantité est dite **une fois au lieu de trois**.

⚠️ Le test qui montait la garde (`app/src/ui/screens/cuisine.test.tsx`, dernier bloc) **change de
sens** et sera réécrit dans le lot E. Il n'est pas scellé.

**(c) Masquer, jamais supprimer.** Tout ce que les lots retirent de l'écran reste dans le code,
derrière **quatre interrupteurs nommés réunis dans un seul fichier**. Pas vingt conditions
dispersées : un seul endroit, réversible en une ligne.

**(d) Le temps affiché est la somme.** `tempsPrepMin + tempsCuissonMin`, présenté comme « temps en
tout ». ⚠️ Deux endroits du code avertissent que cette somme **n'est pas la durée réelle** quand les
étapes se chevauchent (`engine/cuisine/ordonnancement.ts`, `ui/screens/cuisine.tsx`). Arbitrage de
l'auteur : on affiche le temps **non compressible**, le majorant, pas la durée optimale.

**(e) Le texte sera justifié, avec coupure automatique des mots.** Sans la coupure, une colonne de
~35 caractères justifiée creuse des trous blancs. À juger sur le téléphone, pas ici.

## 3. Les lots

| Lot | Objet | État |
|---|---|---|
| **A** | Le bandeau du téléphone | ✅ **LIVRÉ le 2026-09-12** (`dfb8811`) |
| **B** | Épurer : les quatre interrupteurs | ✅ **LIVRÉ le 2026-09-14** (`cd328ad`) |
| **C** | La fiche recette, et le compte brut de l'écran « Recettes » | ✅ **LIVRÉ le 2026-09-14** (`28dfea8`) |
| **D** | Navigation et retour : le bouton retour d’Android | ✅ **LIVRÉ le 2026-09-30** (`c155a1c`) |
| **E** | Mode cuisine : une quantité dite une fois | ✅ **LIVRÉ le 2026-09-17** (`2d8fcfd`) |
| **F1** | La semaine en frise, les gestes dans une fenêtre | ✅ **LIVRÉ le 2026-10-01** (`4d8e198`) |
| **F2** | Semaine à la main (＋ par case) et « Vider la semaine » | ✅ **LIVRÉ le 2026-10-01** (`e729540`) |
| **F3** | « Proposer une autre semaine » ne marche pas une deuxième fois | à écrire, après F2 — reproduire d'abord |
| **G** | Apparence : justification, police, logo, transitions | à écrire, après F |
| **H** | La quantité injectée mange le nom de l'aliment | ✅ **LIVRÉ le 2026-09-19** (`c22f03c`) |
| **I** | « Savoir » devient « Gestes » : l'onglet ne garde que le lexique | ✅ **LIVRÉ le 2026-09-26** (`6c60e5a`) |
| **J** | Corrections rapides de la passe du 2026-09-30 | ✅ **LIVRÉ le 2026-09-30** (`94a2d8f`) |

### Lot A — le bandeau du téléphone ✅ LIVRÉ le 2026-09-12

**État à la livraison.** Les deux conteneurs de `ui/main.tsx` portent la réserve ; `lot-A.test.tsx`
rend 5/5 ; l'arbre entier rend **2 636 tests sur 136 fichiers, zéro rouge** (contre 2 631 sur 135
avant le lot — l'écart est exactement ce fichier). **Commité le 2026-09-17 : `dfb8811`**, avec les
trois autres lots livrés, chacun dans son commit.

⭐ **La moitié du « Fini quand » que le test déclarait ne pas pouvoir démontrer a été démontrée
autrement** : la feuille compilée par `vite build` contient les deux règles, **hors de toute
`@media`** — donc actives sur téléphone.

```css
.pt-\[max\(env\(safe-area-inset-top\)\,1\.5rem\)\]{padding-top:max(env(safe-area-inset-top),1.5rem)}
.pt-\[max\(env\(safe-area-inset-top\)\,2rem\)\]{padding-top:max(env(safe-area-inset-top),2rem)}
```

✅ **VÉRIFIÉ À L'ŒIL LE 2026-09-13**, sur l'appareil, dans un APK reconstruit : la hauteur réservée
est la bonne, le contenu ne passe plus sous la barre d'état. C'était la seule moitié du « Fini
quand » qu'aucun test ne pouvait trancher — `env(safe-area-inset-top)` est rendu par le système, pas
par nous. Le lot A est clos pour de bon.

⚠️ **Piège rencontré en codant, et qui n'était dans aucun brief** : la clause de non-dispersion
compte les occurrences dans le **fichier entier**, commentaires compris. Un commentaire qui cite le
nom de l'inset en clair fait rougir le lot. Les commentaires de `ui/main.tsx` le disent sur place.

**Le défaut, et sa cause mécanique.** `app/index.html` déclare `viewport-fit=cover` : le contenu web
occupe l'écran entier, encoche comprise. Le bas est compensé à deux endroits
(`ui/navigation.tsx`, `ui/panneau.tsx`, tous deux en `env(safe-area-inset-bottom)`). **Le haut ne
l'est nulle part** — `safe-area-inset-top` n'apparaît pas une seule fois dans `app/src`. Sur
Android 15 et au-delà, un `targetSdk` de 36 **impose** l'affichage bord à bord : le contenu passe
donc sous la barre d'état. C'est ce qui a été décrit comme « les pages sont trop hautes ».

**Fini quand** : les **deux** conteneurs de premier niveau de la coquille — celui de l'accueil avant
consentement (`pt-8`, soit 2rem, `ui/main.tsx:316`) et celui qui enveloppe `<main>` (`pt-6`, soit
1,5rem, `ui/main.tsx:358`) — portent chacun **un jeton de classe entier** de la forme
`pt-[max(env(safe-area-inset-top),<repli>)]`, **sans préfixe de variante et sans espace intérieur**,
dont le repli est **au moins égal à la marge que ce conteneur porte aujourd'hui** et qui **remplace**
le `pt-` existant au lieu de s'y ajouter — **la même forme que la réserve du bas déjà en production**
(`pb-[max(env(safe-area-inset-bottom),0.75rem)]`, `ui/navigation.tsx:109`). Et
`safe-area-inset-top` n'apparaît **nulle part ailleurs** dans `app/src` — exactement **2
occurrences**, toutes deux dans `ui/main.tsx`.

**Ce qui le rend faux :**

- un seul des deux conteneurs traité ;
- `pt-[env(safe-area-inset-top)]` **sans** `max(` : sur un téléphone sans encoche l'inset vaut 0 et
  la marge de respiration actuelle disparaît — l'écran devient *plus* collé qu'avant ;
- un **préfixe de variante** — `lg:pt-[max(env(...),2rem)]` : la réserve ne s'active qu'à partir de
  1024 px, donc sur aucun téléphone, donc pas sur l'appareil qui a motivé le lot ;
- un **espace après la virgule** — `pt-[max(env(...), 2rem)]` : le navigateur découpe l'attribut
  `class` sur les blancs et le scanner de Tailwind fait de même. Deux jetons cassés, aucune règle
  CSS produite, et rien ne le signale ;
- un **repli arbitraire** (`0.01px`) : la forme est là, la respiration a disparu ;
- la marge actuelle **remplacée** au lieu d'être cumulée, ou **juxtaposée** (`pt-8` gardé à côté :
  deux `padding-top` sur le même élément, c'est l'ordre de la feuille compilée qui tranche) ;
- la réserve **recopiée** dans un écran (3ᵉ occurrence) : le jour où elle devra changer, il faudra
  la chasser partout.

⚠️ **Les quatre formes du milieu viennent du premier tour d'attaque** (2026-09-12). La version
initiale du test cherchait une sous-chaîne : `lg:pt-[max(env(...),2rem)]` passait ses cinq clauses
**sans changer un seul pixel sur un téléphone**. Le test raisonne désormais en **jetons de classe
entiers**, et compare le repli à la marge du jour au lieu de le comparer à zéro.

**Mesuré avant d'écrire le test (2026-09-12)** : `safe-area-inset-top` = **0 occurrence** dans tout
`app/src`. Le test est donc rouge par construction.

⛔ **Ce que le test NE prouve PAS, et qui ne se voit qu'à l'œil sur le téléphone** : que la classe
produise réellement des pixels. Le test lit le DOM rendu, pas la feuille de style compilée par
Tailwind. Le risque est tenu bas — et seulement bas — par la **parité de forme** avec la réserve du
bas, en production et vérifiée sur appareil. **À regarder au prochain APK.**

**Le lot ne touche pas** : le catalogue (aucun rebuild), `app/src/engine/` (rien à y faire), la base
utilisateur (aucune migration, `USER_SCHEMA_VERSION` reste à 20), la barre de navigation et les
fenêtres (leur réserve du bas est déjà juste), **`app/index.html`** — `viewport-fit=cover` reste tel
quel, c'est la compensation qui manque, pas la déclaration —, et **le centrage comme la
justification du texte**, sortis de ce lot (voir ci-dessous).

⚠️ **Périmètre réduit par rapport à ce qui avait été annoncé.** Le lot A annoncé le 2026-09-12
portait aussi le centrage des titres et la justification. Ils partent au lot G, pour une raison
précise : la réserve du bandeau est un **défaut démontrable** — on peut dire ce qui la rendrait
fausse — alors que le centrage et la justification sont des **choix de typographie que seul l'œil
tranche**. Les sceller dans le même test aurait produit des clauses tautologiques (« la classe
`text-center` est là parce que je l'ai mise »), et une clause qui ne peut pas échouer affaiblit
celles qui le peuvent.

**Connu, et laissé dehors** : la barre « Quitter » du mode cuisine est en `sticky top-0`. Sous
l'affichage bord à bord elle se colle elle aussi sous la barre d'état. Même défaut, autre endroit —
à traiter dans un lot ultérieur, ou à ajouter ici sur demande.

### Lot B — épurer : les quatre interrupteurs ✅ LIVRÉ le 2026-09-14

**État à la livraison (relevé du 2026-09-14 à 09 h 59, arbre complet).** **2 666 passed / 0 failed
(2 666 tests, 137 fichiers)** en 60,7 s ; `lot-B.test.tsx` rend **29/29**, les dix points du « Fini
quand » sont couverts par une clause au moins. `typecheck` propre · `vite build` ✓ 2,48 s ·
`engine:plan-stress` 20/20. **Commité le 2026-09-17 : `cd328ad`** — les deux écrans partagés avec
les lots C et E n'y portent que leurs parties « épure ».

⭐ **CE LOT A OUVERT 42 ROUGES DANS TROIS FICHIERS SCELLÉS ANTÉRIEURS, ET C'EST SA LEÇON.**
`retour-1.test.tsx` (8), `retour-5d.test.tsx` (8) et `retour-6.test.tsx` (26) — **une cause unique**,
vérifiée identique sur les 42 : chacun ouvrait l'encart d'envie en attendant à l'écran « Rien n'est
obligatoire… », que la clause 3f de ce lot-ci fait disparaître. Aucun n'échouait sur sa propre
assertion ; tous mouraient dans leur helper `ouvrirEncart()`, avant de mesurer quoi que ce soit.
**Deux artefacts scellés se contredisaient**, et ça ne se tranche pas en codant : arrêt, et décision
de l'auteur le 2026-09-14 — sceau levé (`libre sceau`), repère remplacé par « Combien de temps devant
vous ? » (légende du premier groupe de pastilles : structurelle, sous aucun interrupteur, présente
une seule fois), sceau remis. **Aucune assertion n'a bougé** : le compte de lignes de code de
`retour-1` est resté à **324**, ce que l'empreinte de `retour-5c` atteste — elle a été rebasée en
conséquence (`8806528362af02e5` → `31c347329503e523`).

⚠️ **CE QU'IL FAUT EN RETENIR, ET QUI VAUT POUR LES LOTS C → G** : une phrase qu'on masque peut être
la **poignée** dont un test se sert pour ouvrir l'écran. Avant de masquer un texte, chercher qui le
lit comme repère — `grep` sur la phrase dans `tests/` et `app/src`, pas seulement dans les écrans.
⛔ **Ce balayage n'a PAS été fait pour les cinq autres phrases de l'interrupteur 2** : elles n'ont
rien cassé aujourd'hui, ce qui ne dit rien de ce qu'un futur `findByText` en fera.

⚠️ **Piège rencontré en codant, et qui n'était dans aucun brief** : la clause 1b balaie **tous** les
`.ts`/`.tsx` de `app/src`, **fichiers de test compris**. Un test non scellé qui rallumait un
interrupteur par `epure.phrasesRassurantes = true` faisait donc rougir le lot. D'où
`rallumerEpure(nom)` dans `ui/test-socle.ts` : import dynamique (pour tomber après le
`vi.resetModules()` du `beforeEach`) et nom **passé par variable**, ce qui ne redéclare rien.

⭐ **Les tests non scellés qui mesuraient un texte désormais masqué n'ont pas perdu leur
assertion : ils rallument leur interrupteur.** Ils continuent de mesurer ce qu'ils mesuraient (le
libellé du Wake Lock, les 288,6 kcal, le classement du frigo par masse) et rougiraient si le lot
avait *supprimé* au lieu de *masquer*.

**Le défaut.** L'écran dit trop. Sous chaque plat le moteur explique pourquoi il l'a retenu, chaque
écran rassure sur ce qu'il ne fait pas, une ligne annonce des valeurs nutritionnelles qu'elle
n'affiche pas, et une jauge redit en couleur ce qu'une phrase vient de dire en chiffres. Rien de tout
cela n'est faux ; tout cela est de l'encombrement. C'est le retour le plus répété de la passe APK.

**La forme, décidée en 2.c : masquer, jamais supprimer.** Chaque bloc retiré reste dans le code,
derrière **un interrupteur nommé**, et les quatre interrupteurs vivent dans **un seul fichier neuf**,
`app/src/ui/epure.ts`. Le rallumer est **une ligne, à un seul endroit**.

⭐ **`epure` est un objet de quatre `boolean` MUTABLES — pas `as const`, pas `Object.freeze`, pas
`readonly`.** C'est ce qui rend « masquer, jamais supprimer » *démontrable* plutôt que *déclaré* :
le test retourne l'interrupteur à l'exécution et redemande le texte. Sans ça, une clause ne peut que
relire le source, et un effacement en dur assorti d'une citation décorative passe — c'est
exactement l'implémentation fausse qu'a exhibée le premier tour d'attaque (voir plus bas).

| # | Interrupteur | Ce qu'il masque | Où |
|---|---|---|---|
| 1 | `explicationsMoteur` | les libellés d'explication sous un plat (`EXPLANATION_LABELS`), « N ingrédients sur M déjà chez vous — soit X % du poids du plat », « N plats retenus ces 21 derniers jours » | `ui/screens/aujourdhui.tsx`, `ui/screens/frigo.tsx` |
| 2 | `phrasesRassurantes` | six phrases de réassurance, nommées ci-dessous | `parametres.tsx`, `cuisine.tsx`, `semaine.tsx`, `detail-recette.tsx`, `frigo.tsx`, `aujourdhui.tsx` |
| 3 | `valeursNutritionnelles` | la ligne « Valeurs nutritionnelles » **tant que le réglage `afficherMacros` est décoché** — celle qui n'affiche aucun chiffre et dit « Non affichées » | `ui/screens/detail-recette.tsx` |
| 4 | `jaugesEtCompteurs` | la barre de couverture du frigo et le nombre brut de recettes trouvées | `ui/screens/frigo.tsx` |

✅ **Arbitré par l'auteur le 2026-09-13** : « le compteur de recettes » du retour d'origine désigne
bien le **« 255 recettes » du frigo** (`frigo.tsx:366-383`), et rien d'autre. Aucun compteur de
l'écran de recette n'entre dans ce lot — celui de `detail-recette.tsx:942` compte des **sauces**,
pas des recettes, et reste intact. Le nombre brut disparaît ; « les 30 mieux couvertes sont
affichées » reste, c'est un avertissement de troncature, pas une jauge (garde B).
⚠️ **Précisé le 2026-09-14, sans être contredit** : le « *N* recettes » de l'écran **Recettes**
(`recettes.tsx:367`) relève du même retour et passe par le **même** interrupteur n° 4 — il est
traité par le **lot C**, dont la colonne « où » de la ligne 4 ci-dessus s'augmentera de
`ui/screens/recettes.tsx`. Le lot B n'a câblé que la moitié frigo.

Les six phrases de l'interrupteur 2, à la lettre : « Tout se modifie à tout moment. Rien n'est envoyé
nulle part. » · « L'écran reste allumé pendant la cuisson. » (et ses deux variantes du même `<p>`) ·
« Vos repas gardés ne changeront pas. » · « Recette écrite pour cette application, non encore
testée. » (et les trois autres branches de `mentionOrigine`) · « Ajoutez ce qu'il vous reste. On
cherche des plats à faire avec. » · « Rien n'est obligatoire. Ce que vous indiquez ne vaut que pour
ce repas. »

**L'interrupteur 1 est le seul que l'utilisateur peut rallumer lui-même** (décision 2.a) : un réglage
persisté `afficher_explications`, colonne de `user_display`, **à 0 à l'installation**, avec sa case
dans « Réglages d'affichage ». `USER_SCHEMA_VERSION` passe de **20 à 21**, par un
`ALTER TABLE user_display ADD COLUMN` — la forme de la v4, **pas** celle des v19/v20 qui recréent des
tables. Les trois autres interrupteurs sont des constantes : on les rallume en éditant `epure.ts`.

⛔ **CE QUI NE DOIT PAS DISPARAÎTRE, ET QUI RESSEMBLE POURTANT À DE LA RÉASSURANCE.** Le principe 1
passe avant l'épure, et ces textes-là ne sont pas décoratifs :

- « Cette application ne remplace pas un professionnel de santé… » et « Tout reste sur cet appareil.
  Aucun compte, aucune donnée envoyée… » (`ui/screens/savoir.tsx`, bloc « Sources et limites ») —
  cadre sanitaire et réglementaire, §6.5 `ARCHITECTURE.md` ;
- le texte de consentement (`ui/texte-consentement.ts`) — il est lu **une fois, avant tout le
  reste**, et c'est son objet ;
- « Un repas sans heure n'est jamais rappelé. » (`parametres.tsx`) — ce n'est pas de la réassurance,
  c'est la règle de fonctionnement des rappels ;
- sur le frigo, « — les 30 mieux couvertes sont affichées » et « aucune recette ne correspond à ce
  que vous avez » : sans elles, une liste coupée ou vide passe pour un bug — le commentaire de
  `frigo.tsx:362` dit que ça s'est déjà produit. L'interrupteur 4 retire **le compte brut**, pas
  l'avertissement ;
- l'avertissement d'énergie de la semaine (`alertes_discretes`), qui a déjà son propre réglage.

**Fini quand** — les **dix** points suivants sont vrais ensemble :

1. `app/src/ui/epure.ts` existe et exporte `epure`, un objet déclarant **exactement quatre**
   interrupteurs nommés `explicationsMoteur`, `phrasesRassurantes`, `valeursNutritionnelles`,
   `jaugesEtCompteurs`, **tous les quatre à `false`**, chacun sur une ligne `nom: false,` qu'on
   retourne seule. **Quatre `boolean` mutables** — ni `as const`, ni `Object.freeze` : les points 9
   et 10 les retournent à l'exécution, et un objet gelé lèverait. Aucun autre fichier de `app/src`
   ne déclare d'interrupteur d'épure.
2. Chacun des six fichiers d'écran listés dans le tableau **nomme** l'interrupteur qui le concerne.
   Un écran qui masque sans nommer son interrupteur n'est pas réversible en une ligne.
3. **Sur une base neuve**, aucune des six phrases de réassurance n'est dans le texte rendu de son
   écran — `document.body.textContent`, pas seulement `queryByText` : une phrase coupée en deux
   `<span>` reste lue par un œil humain.
4. **Sur une base neuve**, l'écran « Aujourd'hui » ne contient **aucun** des sept libellés non nuls
   de `EXPLANATION_LABELS`, et ne contient pas « N plats retenus ces 21 derniers jours » **alors que
   l'historique en porte deux** ; l'écran « Vider le frigo », garde-manger rempli, ne contient ni
   « déjà chez vous » ni « du poids du plat ».
5. **Le réglage rallume vraiment.** La même mesure qu'au point 4, refaite après avoir écrit
   `afficherExplications: true` en base, retrouve **au moins un** libellé d'explication et la ligne
   « … retenus ces 21 derniers jours ». C'est la preuve que rien n'a été supprimé.
6. Le réglage est **persisté et décoché à l'installation** : `readDisplay` d'une base neuve rend
   `afficherExplications === false` ; un aller-retour par `writeDisplay` le rend à `true` **sans
   effacer `afficherMacros`**. `USER_SCHEMA_VERSION === 21`, et la v21 est **un
   `ALTER TABLE user_display ADD COLUMN afficher_explications` sans aucun `DROP TABLE`,
   `CREATE TABLE` ni `DELETE FROM`** — la donnée de l'utilisateur ne se recrée pas pour un booléen
   d'affichage. C'est une clause de **forme**, et c'est exprès : elle garantit la survie des données
   sans avoir à monter une base v20 dans un test.
7. La case **« Afficher les explications sous chaque plat »** — ce libellé exact, il ne se devine
   pas — est dans le panneau « Réglages d'affichage », part **décochée** (`aria-pressed="false"`),
   et la cliquer écrit `afficherExplications = true` en base **et coche la case**. Le libellé est
   fixé ici parce que le panneau contient déjà « Les valeurs nutritionnelles sur la fiche d'une
   recette… » : une clause qui chercherait mollement `/explications/i` tomberait sur deux éléments
   dès que le codeur écrit une description, et l'échec ne parlerait plus du lot.
8. **Les garde-fous ci-dessus tiennent, interrupteurs éteints** : l'écran « Savoir » contient
   toujours « ne remplace pas un professionnel de santé » et « Tout reste sur cet appareil » ; la
   fiche recette ne montre plus « Valeurs nutritionnelles » quand `afficherMacros` est décoché,
   **et la remontre quand il est coché** ; le frigo n'a plus de `role="img"` dont l'étiquette finit
   par « % du poids du plat », plus de compte brut de recettes, mais garde son avertissement de
   liste coupée.
9. **Les interrupteurs 2 et 4 rallument vraiment, eux aussi.** `epure.phrasesRassurantes = true`
   avant montage : les **six** phrases reviennent, chacune sur son écran. `jaugesEtCompteurs = true` :
   la barre de couverture et le compte de recettes reviennent au frigo. C'est la même preuve qu'au
   point 5, portée aux constantes — un texte effacé en dur ne revient pas.
10. **L'interrupteur 3 est distinct du réglage `afficherMacros`, qui existait avant le lot.**
    `epure.valeursNutritionnelles = true` avec les macros **décochées** : la ligne « Valeurs
    nutritionnelles » et sa mention « Non affichées » reviennent. Avec le point 8, la table
    de vérité est épuisée — (éteint, décoché) absent · (éteint, coché) présent · (allumé, décoché)
    présent — et seule cette troisième ligne est fausse si l'interrupteur ne commande rien.

**Ce qui le rend faux :**

- **les phrases sont supprimées au lieu d'être masquées** — le point 5 tombe pour l'interrupteur 1,
  et le point 1 n'a plus rien à commander pour les trois autres ;
- **un seul drapeau pour les quatre groupes** : le point 1 en exige quatre, le point 2 exige que
  chaque écran nomme le sien ;
- **le drapeau est déclaré mais pas lu** — le piège déjà payé trois fois sur ce projet : le point 2
  exige le nom **dans le fichier de l'écran**, et les points 3/4 exigent l'effet à l'écran ;
- **la colonne est ajoutée mais jamais lue** : le point 5 la fait basculer et redemande le texte ;
- **la case de Paramètres est branchée sur `afficher_macros`** (le réglage voisin, déjà en place) :
  le point 6 exige que l'un ne touche pas l'autre ;
- **le texte est masqué en CSS** (`hidden`, `sr-only`, hauteur nulle) : les points 3 et 4 lisent
  `textContent`, qui ne sait rien de la feuille de style — un texte masqué en CSS y reste ;
- **le texte est coupé en morceaux** pour échapper à `getByText` : même réponse, `textContent`
  recolle ce que le DOM sépare ;
- **la ligne « Valeurs nutritionnelles » disparaît aussi quand le réglage est coché** : le seul
  endroit où l'on voit ses macros deviendrait inatteignable — le point 8 exige qu'elle revienne ;
- **le compte de recettes du frigo emporte l'avertissement de liste coupée** : le point 8 exige
  l'avertissement, `frigo.tsx:362` dit pourquoi ;
- **les avertissements sanitaires de « Savoir » partent avec le reste** : le point 8 les exige.

- **un interrupteur est déclaré mais rien ne le lit** — `epure.ts` réduit à un artefact de texte qui
  satisfait des expressions régulières : les points 9 et 10 le retournent et redemandent le texte ;
- **l'interrupteur 3 est en fait `afficherMacros` déguisé** : le point 10 l'allume avec les macros
  décochées.

⛔ **Ce que le test NE prouve PAS.** Que chaque interrupteur commande **exactement** le bloc qui lui a
été assigné, et lui seul. Un écran qui masquerait ses phrases de réassurance derrière
`explicationsMoteur` au lieu de `phrasesRassurantes` ferait rougir les clauses d'absence, donc la
confusion se voit ; mais **deux interrupteurs câblés au même bloc**, aucune clause ne les sépare.
**À vérifier à la relecture du diff, pas au vert.**

⚠️ **Deux pièges pour le codeur, écrits ici parce qu'ils ne se voient pas depuis le « Fini quand ».**

- **La colonne `afficher_explications` s'ajoute à TROIS endroits synchronisés**, pas un : le type
  `StoredDisplay`, la liste de colonnes du `SELECT` de `readDisplay`, et la liste de colonnes **et**
  les `VALUES` de l'`INSERT OR REPLACE` de `writeDisplay` (`data/user-store.ts`). Un oubli dans
  l'`INSERT` ne lève rien — ni au type, ni au test unitaire : la persistance devient un no-op
  silencieux et c'est le point 5 qui tombe, sans dire pourquoi. Le commentaire de `writeDisplay` le
  dit déjà pour un autre réglage.
- **« Rien n'est obligatoire. » existe DEUX FOIS, dans deux fichiers sans rapport.** Celle du lot est
  dans `aujourdhui.tsx:1049` (encart d'envie). L'autre est dans `parametres.tsx:969`, collée à « Un
  repas sans heure n'est jamais rappelé. » — c'est une règle de fonctionnement, et la garde C refuse
  qu'on l'emporte. Ne pas chercher la phrase dans tout le dépôt pour appliquer l'épure.

**Le lot ne touche pas** : `app/src/engine/` (aucun calcul ne change ; `EXPLANATION_LABELS` reste
intacte — c'est l'affichage qui se tait, pas le moteur), le catalogue (aucun rebuild), les données
existantes de l'utilisateur (la v21 **ajoute** une colonne, elle n'en réécrit aucune), l'écran
« Savoir », l'écran « Courses », l'écran « Recettes », le texte de consentement, le réglage
`afficher_macros` et ce qu'il commande déjà, la réserve de bandeau du lot A, et la ligne « Repas noté
à la main » de la semaine — elle explique une absence de données, pas une suggestion.

**Dette créée par ce lot, à porter en `ETAT.md` §8 à la livraison** : les tests d'écran existants qui
affirment la PRÉSENCE de ces textes (`aujourdhui.test.tsx`, `detail-recette.test.tsx`,
`cuisine.test.tsx`, `frigo.test.tsx`, `semaine.test.tsx`) changent de sens et devront être réécrits
dans le même lot. Ils ne sont pas scellés.

**Mesuré avant d'écrire le test (2026-09-13)** : `afficherExplications`, `afficher_explications`,
`epure` et `EPURE` = **0 occurrence** dans tout `app/`. `USER_SCHEMA_VERSION` = **20**. Témoins de
l'arbre à 21 h 06 : `npm test` = **2 636 passed / 0 failed** (136 fichiers, 86,2 s),
`engine:plan-stress` = **20/20**.

**État du test scellé (`tests/scelles/lot-B.test.tsx`, non scellé), après le premier tour
d'attaque** : **29 clauses, 22 rouges / 7 vertes** (21 h 43, 5,0 s). Les sept vertes le sont **par
déclaration**, pas par accident : trois gardes (ce qu'un correctif trop large casserait), une clause
de non-dispersion vraie par vacuité tant qu'`epure.ts` n'existe pas, et **trois clauses de RETOUR
appariées** à leurs jumelles d'absence — c'est la paire, pas la clause seule, qui sépare « masqué »
de « supprimé ». Les quatre retours ajoutés par l'attaque (5c, 5d, 8e, 8f) sont **rouges**, sur
« Cannot find module `ui/epure.js` ».

⚠️ **`npm run typecheck` est ROUGE, et c'est normal à ce stade** : 6 erreurs, toutes dans ce fichier,
toutes `afficherExplications does not exist on type 'StoredDisplay'` — c'est-à-dire la colonne que le
lot doit ajouter. Elles s'éteignent avec le point 6. Aucune autre erreur dans l'arbre.

⛔ **PREMIER TOUR D'ATTAQUE, 2026-09-13 — le brief a été ROUVERT.** Le critique a exhibé une
implémentation fausse qui passait **les 25 clauses** : effacer les textes en dur dans les six écrans,
et laisser `epure.ts` **mort** — quatre constantes que personne ne lit, satisfaites par une citation
décorative que la clause 2 accepte (`.includes(nom)`). Trois interrupteurs sur quatre ne reposaient
sur rien, et le quatrième (`valeursNutritionnelles`) était en réalité porté par `afficherMacros`, un
réglage antérieur au lot. Corrigé en rendant les quatre interrupteurs **retournables à l'exécution**
(objet de `boolean` mutables) et en ajoutant quatre clauses de retour. C'est ce que le point 1 du
« Fini quand » exige désormais ; les points 9 et 10 sont nés là.

⛔ **Et un second piège, découvert en lançant le test corrigé, qui coûtait le FICHIER ENTIER.** Un
`await import('../../app/src/ui/epure.js')` écrit **en clair** est résolu par l'analyse statique de
Vite **au moment de la transformation** : tant que le fichier n'existe pas, la suite tombe sur
« Failed to resolve import » et rend « Tests: no tests » — zéro clause exécutée, y compris les
vingt-cinq qui n'avaient rien à voir. Le test passe donc par un spécificateur **calculé**
(`['..','..','app','src',chemin].join('/')` + `@vite-ignore`), et le mécanisme a été vérifié par une
sonde temporaire pointée sur un module **qui existe** avant d'être scellé sur un module qui n'existe
pas encore. L'absence d'`epure.ts` doit rougir une clause, pas rendre le fichier muet.

⚠️ **Deux clauses étaient vertes à tort au premier jet, et les deux pour la même raison : elles
cherchaient quelque chose qui n'était pas là.** C'est le défaut du lot A, sous une autre forme.

- « Dites-moi ce que vous cherchez » est porté par **deux** éléments — le bouton qui ouvre l'encart
  et le titre de l'encart ouvert. Une boucle qui s'arrêtait au premier texte trouvé s'arrêtait sur le
  bouton : l'encart n'était jamais déplié, et la phrase qu'on voulait voir disparaître n'avait jamais
  été affichée. Le test attend désormais une légende qui n'existe **que** dans l'encart déplié.
- `textContent` ne met **aucun blanc entre deux éléments voisins** : le frigo rend
  « …Plus de filtres›255 recettes — les 30 mieux couvertes… ». La clause exigeait un blanc devant le
  nombre et ne trouvait donc rien à retirer.

### Lot C — la fiche recette, et le compte brut de l'écran « Recettes » ✅ LIVRÉ le 2026-09-14

**État à la livraison (relevé du 2026-09-14 à 12 h 45, arbre complet).** **2 677 passed / 0 failed
(2 677 tests, 138 fichiers)** en 70,03 s ; `lot-C.test.tsx` rend **11/11** en 31,2 s, et chacun des
sept points du « Fini quand » est couvert par une clause au moins. `typecheck` propre (12 h 46) ·
`vite build` ✓ 2,46 s (12 h 46) · `engine:plan-stress` **20/20** (12 h 47). L'écart avec le témoin
d'avant le lot (2 666 sur 137, le 2026-09-14 à 09 h 59) est **exactement ce fichier** : +11 tests,
+1 fichier. **Commité le 2026-09-17 : `28dfea8`** — `ingredients-recette.tsx` n'y porte que l'ordre
nom/quantité, sa part du lot E est dans `2d8fcfd`.
⚠️ **`node .claude/lots.mjs etat "lot-C" …` répond « Lot « lot-C » absent de l'index »** — au sceau
comme à la fermeture. L'index `.claude/lots.json` est un cache et il est en retard sur ce document ;
la ligne n'a pas été inventée, `/plan` réconciliera.

**Le défaut.** Deux lignes de la fiche se lisent à l'envers de ce qu'on y cherche — et un nombre
posé au-dessus de la liste des recettes n'y répond à aucune question.

- **La ligne de temps donne les parties avant le tout** : « 10 min de préparation · 40 min de
  cuisson · difficulté 1/3 ». Ce qu'on veut savoir avant de choisir un plat, c'est **combien de
  temps ça prend en tout** — la somme est laissée à faire de tête, et elle arrive après.
- **La difficulté sur 3 n'aide personne** : trois paliers pour 339 recettes, sans échelle de
  référence. Elle est de plus à la limite du principe 6 — un chiffre sur 3 à côté d'un plat se lit
  comme une note.
- **Chaque ingrédient donne sa quantité avant son nom** : « 4 artichauts · Artichaut, cru ». On lit
  une liste d'ingrédients pour savoir **ce qu'il faut**, la quantité vient après. C'est aussi ce qui
  permet à l'œil de descendre une colonne de noms alignés au lieu d'une colonne de nombres.
- **« 336 recettes » au-dessus de la liste ne sert à rien** (`ui/screens/recettes.tsx:367`). Le compte
  n'est ni une réponse ni une explication : la liste est juste dessous, l'entonnoir dit déjà combien
  ont été écartées et par quoi, et les boutons annoncent leur propre compte avant qu'on y entre. Ce
  qui reste est un nombre brut — exactement ce que `jaugesEtCompteurs` était censé éteindre.

**La forme.** Deux `<p>`/`<li>` réécrits, rien de plus. **Aucun calcul nouveau** : le total est
`tempsPrepMin + tempsCuissonMin`, déjà la règle de la décision 2.d, et déjà ce qu'affiche la carte de
l'écran « Recettes » (`ui/screens/recettes.tsx:424`) — la fiche se met d'accord avec sa propre carte.

⛔ **PAS DE CINQUIÈME INTERRUPTEUR D'ÉPURE, ET CE N'EST PAS UNE PRÉFÉRENCE.** La clause 1 de
`tests/scelles/lot-B.test.tsx` scelle `ui/epure.ts` à **exactement quatre** déclarations et compte
les lignes `nom: false,`. Un cinquième ferait rougir un test scellé — donc la difficulté ne se met
pas derrière un interrupteur. « Masquer, jamais supprimer » est tenu autrement, et plus solidement :
**le champ ne bouge pas du tout**. `recipe.difficulte` reste en base, reste dans `Recipe`
(`engine/domain/catalog.ts:556`), reste lu par `catalog-loader.ts:647`, reste dans les recettes
personnelles (`data/user-recipe.ts`). Seule la **ligne 448 de `detail-recette.tsx`** cesse de
l'écrire, et c'est son **unique** lieu d'affichage dans tout `app/src` (vérifié : 30 occurrences de
`difficulte`, une seule dans du JSX rendu).

⭐ **LE COMPTEUR, LUI, A DÉJÀ SON INTERRUPTEUR — ET IL EXISTE.** `ui/epure.ts` décrit
`jaugesEtCompteurs` comme couvrant « la barre de couverture du frigo **et le nombre brut de recettes
trouvées** ». Le lot B a câblé la moitié frigo et laissé l'autre : `recettes.tsx` ne cite pas
l'interrupteur, il n'y a **aucune** occurrence d'`epure` dans ce fichier. Le lot C finit le câblage.
Aucun drapeau neuf n'est créé — la clause 1 de `lot-B` reste à quatre, la clause 1b n'est pas
concernée (l'écran **lit** le drapeau, il ne l'assigne pas), et la clause 2 est une vérification de
présence : y ajouter un écran ne peut pas la faire rougir. Conséquence : pour ce point-là, « masquer,
jamais supprimer » se **mesure** (clause 7c retourne le drapeau et redemande le compte), alors que
pour la difficulté il se prouve autrement (le champ ne bouge pas).

⚠️ **`ui/ingredients-recette.tsx` EST PARTAGÉ ENTRE LA FICHE ET LE MODE CUISINE**, extrait et non
recopié (son en-tête raconte les trois tables jumelles dont une avait divergé). Changer l'ordre des
lignes change **les deux écrans** — c'est voulu, et c'est déclaré ici pour que personne ne le
découvre à l'exécution. `ListeIngredients` a deux appelants : `detail-recette.tsx:463` et
`cuisine.tsx:601` (derrière « Voir les ingrédients »).

⛔ **`QuantitesDeLEtape`, DANS LE MÊME FICHIER, N'EST PAS TOUCHÉE.** Ce sont les quantités posées sous
**une** étape en mode cuisine, et c'est exactement ce que le lot E rouvre (décision 2.b, et les trois
observations « Problème mode cuisine » de la passe APK, qui contestent **quels** ingrédients y
apparaissent). Y toucher ici ferait deux lots qui éditent la même fonction.

**Ce que le lot fait de l'observation « toujours pas d'image ».** Rien : la fiche **affiche déjà** la
photo quand il y en a une (`detail-recette.tsx:360`), et **210 recettes sur 339 n'en ont aucune** —
c'est un chantier de contenu (§1, tableau « ce qui visait à côté »), pas un défaut d'affichage.
`artichauts_vinaigrette`, la recette de référence de ce brief, est dans les 210.

**Fini quand** — les **sept** points suivants sont vrais ensemble. Les nombres ci-dessous sont
**mesurés sur le `catalog.db` du dépôt le 2026-09-14** (339 recettes), pas sur une fixture :

⛔ **LES POINTS 1 À 4 BALAIENT LE CATALOGUE ENTIER, ET CE N'EST PAS DU ZÈLE.** La première version
de ce brief les mesurait sur **huit** fiches nommées. Le critique du 2026-09-14 a exhibé une
implémentation fausse qui les passait : une table `identifiant → chaîne toute faite` de huit
entrées, plus un `if (id === 'artichauts_vinaigrette')` pour l'ordre des lignes — **8 clauses
vertes sur 11**. Un échantillon publié dans le brief est un échantillon que le codeur peut coder
en dur. Les points 1 à 4 portent donc sur **toutes** les recettes, et les identifiants ci-dessous
ne sont plus des cas de test : ils **datent la mesure**.

1. **La ligne de temps commence par le total.** Sur **chacune** des **282** recettes que le
   catalogue compte à cuisson non nulle, la ligne se lit **exactement**
   `T min en tout · P min de préparation · C min de cuisson`, avec `T = P + C`, séparateur « · »,
   dans cet ordre et sans rien d'autre. Mesuré le 2026-09-14 : par exemple
   `ananas_roti_coco_citron_vert` (10 + 20 = **30**) et `veloute_topinambour` (20 + 30 = **50**).
2. **Une recette sans cuisson n'affiche qu'un temps.** **57 recettes sur 339** portent
   `temps_cuisson_min = 0`, et **aucune** ne porte `temps_prep_min = 0`. Pour **chacune** de ces 57
   la ligne se lit **exactement** `P min en tout`, sans « de préparation » ni « de cuisson » :
   répéter deux fois le même nombre et annoncer « 0 min de cuisson » n'apprend rien.
3. **La difficulté ne se lit plus — sous aucun mot — et le champ n'a pas bougé.** Sur les **339**
   fiches du catalogue, montées une par une : le texte rendu ne contient nulle part
   « difficulté *n*/3 », la ligne de temps ne contient pas la sous-chaîne « difficult », **et** —
   c'est le point qui ne se contourne pas — la fiche montée avec `difficulte` forcée à **1** rend
   **exactement le même texte** que la même fiche montée avec `difficulte` forcée à **3**. Un
   affichage renommé (« Niveau : 2/3 », « Facile », « ★★☆ ») fait diverger les deux textes ; aucune
   liste de mots interdits n'est à tenir à jour. **Et**, au même instant, les **339** recettes
   portent toutes un `difficulte` entier de 1 à 3, **les trois valeurs étant représentées**
   (aujourd'hui 213 · 108 · 18). C'est la moitié qui distingue « retiré de l'affichage » de
   « supprimé du modèle ».
4. **Le nom de l'ingrédient précède sa quantité, sur la fiche.** Sur les **339** fiches, **chaque**
   ligne d'ingrédient est dans l'ordre du catalogue, **commence** par le nom de l'aliment et donne
   sa quantité **après** — « Artichaut, cru » avant « 4 artichauts », « Sel fin » avant « au goût ».
   Une ligne dont le catalogue ne donnerait aucun libellé de quantité fait rougir la clause au lieu
   de la sauter en silence : elle ne saurait pas où chercher.
5. **La même liste, en mode cuisine, obéit à la même règle.** Derrière « Voir les ingrédients » de
   `cuisine.tsx`, **sept** recettes (la référence `artichauts_vinaigrette` et six tirées du
   catalogue), lignes nom d'abord — c'est le même composant, et le point existe pour que le partage
   soit **mesuré** et pas seulement affirmé. Sept suffisent ici, et seulement ici : le point 4 a
   déjà balayé les 339 fiches à travers ce même composant, donc un branchement par identifiant y
   est déjà mort.
6. **Gardes — ce qu'un correctif trop large casserait** : le nom porte toujours le **lien** vers la
   fiche aliment sur la fiche recette, et **aucun lien** en mode cuisine (divergence voulue,
   `ingredients-recette.test.tsx`) ; « (facultatif) » se lit toujours sur l'échalote ; les **5**
   étapes et « Cuisiner pas à pas » sont toujours là ; le sélecteur de portions aussi.
7. **Le compte brut de l'écran « Recettes » se tait, et l'explication reste.** Trois choses
   ensemble, sur un profil neuf (aucune allergie, aucun régime, aucun favori) :
   a. **liste pleine** — l'écran affiche aujourd'hui **336 cartes** (339 recettes moins les **3**
   sauces, que `browseRecipes` sort de la liste ordinaire), et le texte rendu ne contient **aucun**
   « *nombre* recette(s) » **ni le nombre 336 lui-même**, sous quelque mot que ce soit : on
   n'annonce pas un compte sans l'écrire, donc c'est le **nombre** qu'on cherche, pas le vocabulaire
   posé à côté. Le compte des cartes est relu à l'exécution, jamais scellé ;
   b. **liste vide** — une recherche sans résultat n'affiche **pas** « 0 recette », **ni le nombre 0
   ailleurs sur l'écran** hors des comptes entre parenthèses des libellés de bouton, et la phrase qui
   dit quoi faire **demeure**, **se tient seule** et **ne porte aucun chiffre** : elle commence par
   une majuscule et finit par un point. Aujourd'hui elle est la queue de « 0 recette — essayez de
   retirer un filtre. » ; retirer le compte devant laisserait une ligne qui commence par un tiret, et
   une liste vide muette passe pour un bug — c'est le raisonnement de l'avertissement de troncature
   du frigo, que `ui/epure.ts` exclut explicitement de cet interrupteur ;
   c. **`jaugesEtCompteurs` rallumé, le compte revient exact** — la même page, drapeau à `true`,
   redonne « 336 recettes », avec le nombre de cartes réellement rendues. C'est ce qui sépare
   « masqué » de « supprimé ».

**Ce qui le rend faux :**

- ⛔ **une table de correspondance `identifiant → chaîne toute faite`**, ou un `if` sur un identifiant
  précis — **c'est l'implémentation fausse qu'a exhibée le critique**, et c'est pour elle que les
  points 1 à 4 balaient les 339 recettes au lieu de huit : une table de 339 entrées écrites à la
  main n'est plus une triche, c'est le calcul recopié ;
- **le total est écrit en dur, ou lu dans une colonne neuve** — le point 1 le redemande sur les
  **282** recettes à cuisson non nulle, toutes calculées depuis `catalog.db` à l'exécution ;
- **l'ordre est « P min de préparation · C min de cuisson · T min en tout »** — le point 1 compare la
  **chaîne entière** de la ligne, pas sa présence ;
- **« 0 min de cuisson » s'affiche quand même**, ou « 5 min en tout · 5 min de préparation » — le
  point 2 compare l'égalité exacte ;
- ⛔ **la difficulté est RENOMMÉE au lieu d'être retirée** (« Niveau : 2/3 », « Facile », « ★★☆ »), ou
  **le compte brut est reformulé** (« 336 résultats trouvés ») — **c'est l'implémentation fausse du
  second tour d'attaque, et elle passait 11 clauses sur 11.** Une clause d'absence qui cherche un mot
  ne mesure que l'absence de ce mot. Les deux points visent désormais la **donnée** : le point 3
  force `difficulte` à 1 puis à 3 et exige un texte identique, le point 7.a cherche le **nombre** de
  cartes. Aucune liste de synonymes n'est à tenir à jour ;
- **la difficulté est déplacée ailleurs sur la fiche** au lieu d'être retirée — le point 3 balaie le
  texte entier de l'écran, pas la ligne de temps ;
- **la difficulté est masquée en CSS** (`hidden`, `sr-only`, hauteur nulle) — le point 3 lit
  `textContent`, qui ne sait rien de la feuille de style ;
- **le champ `difficulte` est supprimé du modèle ou du chargeur** « pour faire propre » — la seconde
  moitié du point 3 le relit depuis `catalog.db` chargé par le vrai `loadCatalog` ;
- **l'ordre est inversé dans la fiche seulement**, par une copie locale du composant — le point 5
  monte le mode cuisine ;
- **l'ordre est inversé en mettant la quantité nulle part** — les points 4 et 5 exigent que la
  quantité soit **présente**, et **après** le nom ;
- **la ligne entière devient le lien** vers l'aliment maintenant que le nom est en tête — le point 6
  exige que le lien porte le nom seul, et qu'il n'y en ait aucun au fourneau ;
- **le compteur est SUPPRIMÉ au lieu d'être mis derrière l'interrupteur** — le point 7.c rallume
  `jaugesEtCompteurs` et redemande la chaîne exacte ;
- **le compteur est déplacé ailleurs sur l'écran** (sous la liste, dans un bouton) — le point 7.a
  balaie le texte entier de l'écran, pas un élément désigné ;
- **le compteur est masqué en CSS** — le point 7 lit `textContent`, qui ne sait rien de la feuille de
  style ;
- **la ligne vide devient « — essayez de retirer un filtre. »**, ou disparaît avec le compte — le
  point 7.b exige la phrase, une majuscule au début et un point à la fin ;
- **un cinquième interrupteur est ajouté** pour l'occasion — la clause 1 de `lot-B.test.tsx`, scellée,
  compte les déclarations de `ui/epure.ts` et en exige **quatre**.

⛔ **Ce que le test NE prouve PAS.** Que la ligne de temps soit **lisible** sur un téléphone : elle
passe de 3 à 3 segments dans le cas nominal, mais de 3 à 1 pour les 57 recettes froides, et ça ne se
juge qu'à l'œil. Ni que « nom d'abord » soit la bonne colonne visuelle — l'alignement se voit sur
l'APK, pas en jsdom. ⚠️ **Les deux se revoient à la passe à l'œil qui suit les lots B → E.**

⚠️ **Quatre pièges pour le codeur, écrits ici parce qu'ils ne se voient pas depuis le « Fini quand ».**

- ⛔ **DEUX ASSERTIONS NON SCELLÉES ATTENDENT LA PHRASE QUE LE LOT VA COUPER.**
  `app/src/ui/screens/recettes.test.tsx`, lignes **430** et **508**, appellent
  `findByText(/0 recette — essayez de retirer un filtre\./)`. Le point 7.b interdit précisément ce
  « 0 recette » : les deux rougiront, **et c'est attendu**. Elles ne sont pas dans `tests/scelles/`,
  elles se corrigent avec le lot. **C'est la leçon du lot B qui se répète** — une phrase qu'on
  retire est la poignée dont un autre test se sert. Trouvé par le second tour d'attaque, pas par le
  brief.

- **`quantite.fige` vaut `false` au facteur 1**, même pour le sel (`ui/quantites.ts:182`) : la mention
  « · quantité au goût, non ajustée » **ne s'affiche pas** tant qu'on n'a pas changé les portions.
  Elle n'est donc pas dans les gardes du point 6 — l'y mettre aurait fait une clause verte qui ne
  mesure rien.
- **Un pas de côté à ne pas faire** : `tempsPrepMin` et `tempsCuissonMin` sont des minutes entières
  au catalogue, jamais `null`. Pas de `?? 0`, pas de formatage en heures — « 210 min en tout » pour
  le bœuf bourguignon est ce que la décision 2.d demande (le **majorant non compressible**), et
  « 3 h 30 » est un lot d'apparence, pas celui-ci.
- **`MesureMontage` reçoit `nbCartes={trouvees.length}` juste sous le compteur**
  (`recettes.tsx:372`) : c'est la sonde de la **décision 61**, elle ne rend rien sans `?perf` et elle
  n'est **pas** un affichage. Masquer le compteur ne doit pas la débrancher — sinon le seul chiffre
  qui manque encore pour fermer la décision 61 devient immesurable.

**Le lot ne touche pas** : `app/src/engine/` (aucun calcul, la somme est faite à l'affichage comme
elle l'est déjà sur la carte de l'écran « Recettes »), le catalogue (aucun rebuild, aucune colonne),
`user.db` (`USER_SCHEMA_VERSION` reste à **21**), le **contenu** de `ui/epure.ts` (les quatre
interrupteurs restent quatre, aucun change de valeur par défaut), `QuantitesDeLEtape` (lot E),
l'éditeur de recette, la photo et son aplat, les origines, le matériel, les étapes, le lien
« Cuisiner pas à pas », les sauces et leur compteur (`detail-recette.tsx:942`, qui compte des
**sauces** — arbitrage du 2026-09-13 plus haut).

Sur l'écran « Recettes », **une seule ligne bouge**, et le reste est déclaré intact :

- **la carte** garde son « *T* min · *N* portions » (`recettes.tsx:424`) — c'est même le précédent
  dont la fiche s'aligne au point 1 ;
- **les libellés de bouton** gardent leur compte : « Mes recettes (0) », « Mes favoris (0) »,
  « Sauces (3) », et les pastilles de facette. Le compte y dit ce qu'on trouvera **avant** d'y entrer,
  et `recettes.tsx:216` porte déjà la raison : un bouton qui ouvre le vide ne se distingue pas d'un
  bouton cassé ;
- **l'entonnoir** (« *N* recettes → allergènes −18 → régime −40 = *M* disponibles ») reste : c'est une
  explication du moteur, pas une jauge, et il est le différenciateur de §6.8 ENGINE ;
- **« Pourquoi pas ce plat ? »** et son « et *N* autres » restent, pour la même raison qu'une
  troncature s'annonce.

**Décision de l'auteur, 2026-09-14 : le compteur de l'écran « Recettes » entre dans le lot C.**
« Le compteur du nombre de recette est mal placé → enlever » avait été arbitré le 2026-09-13 comme
désignant le « 255 recettes » du frigo, que le lot B a éteint. L'auteur **précise** l'arbitrage sans
le contredire : le « *N* recettes » de `recettes.tsx:367`, posé entre l'entonnoir et la liste,
relève du même retour et se traite ici. L'arbitrage du 13/09 reste vrai pour ce qu'il disait — le
compteur du **frigo** — et les deux passent désormais par le **même** interrupteur, ce qui est
précisément ce que `ui/epure.ts` annonçait depuis le lot B.

**Mesuré avant d'écrire le test (2026-09-14 à 09 h 59, arbre sans ce lot)** : `npm test` =
**2 666 passed / 0 failed** (137 fichiers) · `engine:plan-stress` = **20/20** · `typecheck` propre.
« min en tout » = **0 occurrence** dans `app/`. Catalogue **non concerné** — aucun
`node catalog/build.mjs` dans ce lot, aucune colonne ajoutée.

⛔ **SECOND ET DERNIER TOUR D'ATTAQUE — 2026-09-14, corrigé. LE QUOTA EST ÉPUISÉ : il n'y aura pas
de troisième attaque** (règle de `/attaquer`, décision de l'auteur du 2026-08-27). Le critique a
exhibé une **seconde** implémentation fausse, plus solide que la première parce qu'elle ne dépend
d'aucun échantillon : garder le vrai calcul partout, et **renommer** les deux seules choses que le
lot retire — « Niveau : 2/3 » au lieu de « difficulté 2/3 », « 336 résultats trouvés » au lieu de
« 336 recettes ». **11 clauses sur 11 vertes, les deux informations toujours à l'écran.** Cause :
les clauses 3 et 7 mesuraient un **vocabulaire**, pas une donnée. Corrigé — le point 3 force la
difficulté à 1 puis à 3 et exige un texte identique, le point 7.a cherche le nombre de cartes, le
point 7.b interdit tout chiffre dans la phrase de liste vide. Aucun mécanisme neuf, aucune clause
créée : deux clauses existantes changent d'objet de mesure.

⭐ **LE RÉSIDU DU POINT 7.b A ÉTÉ FERMÉ SUR DÉCISION DE L'AUTEUR (2026-09-14), ET LA FERMETURE A
COÛTÉ LE PIÈGE DU `\b` UNE TROISIÈME FOIS.** Le premier jet avait laissé passer un compte de zéro
reformulé dans un élément **séparé** de la phrase, faute de pouvoir balayer l'écran entier sans
rougir sur « Mes favoris (0) ». La fermeture : on cherche le **nombre** de cartes sur tout l'écran,
en exemptant les nombres **immédiatement enfermés dans une parenthèse** — c'est-à-dire exactement
les libellés de bouton que le lot épargne déjà par écrit. Aucune structure de balisage n'est figée,
aucune décision de rédaction n'est prise. ⛔ Et le motif ne porte **ni `\b` devant ni `\b` derrière**
: `textContent` donne « …Tout retirer**0** recette — essayez… », le zéro est précédé d'une lettre,
et `\b0\b` n'y trouvait rien — le filet était **vert avant toute ligne de code**. Il est borné par
les chiffres, pas par les mots.

**Premier tour d'attaque — 2026-09-14, corrigé.** Le critique a exhibé
l'implémentation fausse décrite en tête du « Fini quand » : **8 clauses vertes sur 11** sans rien
calculer. Les points 1 à 4 balaient depuis le catalogue entier ; **aucun mécanisme n'a été ajouté**
au brief, seul le domaine des clauses existantes s'est élargi, donc la surface d'attaque n'a pas
grossi. Coût mesuré du balayage complet avant de s'y engager : **339 fiches montées en 6,99 s** sur
une clause verte, sans `vi.resetModules()` dans la boucle.

**État du test scellé (`tests/scelles/lot-C.test.tsx`), le 2026-09-14 à 12 h 37, après les DEUX
tours d'attaque et la fermeture du résidu** : **11 clauses, 8 rouges / 3 vertes**, 4,37 s — les
clauses élargies échouent sur la **première** fiche, donc le balayage complet ne coûte rien tant que
le code n'existe pas. L'arbre entier rend **2 669 passed / 8 failed (2 677 tests, 138 fichiers)** en
67,7 s (12 h 37) — l'écart avec le témoin est **exactement ce fichier** (+11 tests, +1 fichier).
`typecheck` propre (12 h 39), `vite build` ✓ 2,51 s (12 h 39), `engine:plan-stress` **20/20**
(12 h 39) : le lot n'a encore rien touché.

⚠️ **COÛT À PRÉVOIR UNE FOIS LE CODE ÉCRIT** : la clause 3 monte chaque fiche **deux** fois —
339 × 2 = 678 montages, **13,1 s** mesurés. Les clauses 1, 2 et 4 en montent 282 + 57 + 339. Le
fichier passera de 4 s à une vingtaine de secondes le jour où il verdira ; c'est le prix de la
discrimination, et il est connu d'avance.

⛔ **LE PRIX ANNONCÉ ÉTAIT SOUS-ESTIMÉ DE MOITIÉ** : la clause 3 coûte **28,5 s** une fois le code
écrit, contre 13,1 s prévus. Les 13,1 s mesuraient le **montage** de 678 fiches ; elles ne
comptaient pas la comparaison caractère à caractère des deux rendus, ni les 678 `cleanup()`. Le
fichier entier fait **31,2 s**. À retenir avant de promettre le coût d'un balayage différentiel :
mesurer le montage ne mesure pas la clause.

⭐ **LES DEUX ROUGES COLLATÉRALES SONT TOMBÉES EXACTEMENT LÀ OÙ LE CRITIQUE LES ANNONÇAIT, ET NULLE
PART AILLEURS.** `recettes.test.tsx` lignes 430 et 510, toutes deux sur
`/0 recette — essayez de retirer un filtre\./`, non scellées, corrigées avec le lot vers la phrase
seule. La dette annoncée par le brief citait cinq fichiers de tests d'écran par prudence : quatre
d'entre eux n'affirmaient la présence d'aucun des textes coupés.

**Trois fichiers de production touchés** : la ligne de temps de la fiche, l'ordre nom/quantité des
lignes d'ingrédients — partagé avec le mode cuisine, donc l'ordre change sur les deux écrans — et le
compteur de l'écran Recettes passé derrière `jaugesEtCompteurs`, un interrupteur qui existait déjà.

⛔ **CINQ SONDES ONT ÉTÉ TIRÉES AVANT D'ÉCRIRE LES NOUVEAUX NETS, PUIS RETIRÉES.** Sans elles, trois
d'entre eux auraient été verts ou rouges pour une raison étrangère au lot. (1) Les **339** fiches
rendent deux fois le même texte : **zéro divergence** en 13,1 s, donc la comparaison différentielle
de la clause 3 mesure la difficulté et rien d'autre. (2) La phrase de liste vide ne porte **aucun
chiffre** hors « 0 recette ». (3) Sur la liste pleine, le motif ne trouve **que** le « 336 » du
compteur. (4) Sur la liste vide, **que** le « 0 » du compteur — les autres nombres de l'écran sont
tous entre parenthèses (« Mes favoris (0) », « francaise (0) », « Tout voir (26) »). (5) Et c'est
la sonde qui a révélé le `\b` : le zéro est collé à « Tout retirer », `\b0\b` ne le voyait pas.

Les huit rouges, et ce qu'elles disent :

| Clause | Message |
|---|---|
| 1 | `Unable to find an element with the text: /\d+\s*min en tout/` — la fiche ne dit pas de total |
| 2 | idem, sur les recettes froides |
| 3 | `ananas_roti_coco_citron_vert : « difficulté 1/3 » se lit encore sur la fiche` (le filet différentiel est derrière et n'est pas atteint) |
| 4 | `la fiche de ananas_roti_coco_citron_vert, ligne 1 : « 1 ananasAnanas, cru » donne la quantité avant le nom` |
| 5 | `le mode cuisine de artichauts_vinaigrette, ligne 1 : « 4 artichautsArtichaut, cru » donne la quantité avant le nom` |
| 7 | `« 336 recettes » se lit encore sur l'écran Recettes (336 cartes)` |
| 7b | `« 0 recette » se lit encore sur une liste vide` |
| 7c | `le compte est affiché interrupteur éteint: expected true to be false` |

⚠️ **Les messages des clauses 4 et 5 nomment désormais la recette** : c'est ce qui fait qu'un
balayage de 339 fiches reste diagnosticable. Une clause qui parcourt tout le catalogue et dit
seulement « ligne 1 » rend le rouge illisible.

⛔ **UN PIÈGE PAYÉ EN ÉCRIVANT LA CLAUSE 7, ET QUI VAUT POUR TOUT LE PROJET.** La première version
cherchait `/\d+\s*recettes?\b/` : elle était **verte avant toute ligne de code**. `textContent`
recolle les frères sans rien insérer entre eux — le compteur donne
« 336 recettes**A**nanas rôti à la noix… », le mot est suivi d'une lettre, et le `\b` final ne
trouve rien. Une clause d'absence qui passe le jour où on l'écrit ne mesure pas l'absence : elle
mesure sa propre erreur. Le `\b` a été retiré, et la clause rougit. ⚠️ Second piège du même montage :
le champ de recherche porte un `list=`, ce qui lui donne le rôle **`combobox`** et non `searchbox` —
`getByRole('searchbox')` ne le trouve pas.

**Les trois vertes le sont PAR DÉCLARATION, pas par accident** — ce sont les trois gardes : elles ne
décrivent aucun défaut, elles disent ce qu'un correctif trop large casserait (le champ `difficulte`
au modèle, le lien porté par le nom seul, les mentions et les étapes de la fiche). ⚠️ La clause 3b
est la **seconde moitié** du point 3 : prise seule elle ne prouve rien, appariée à la clause 3 elle
sépare « retiré de l'affichage » de « supprimé du modèle ».

### Lot D — le bouton retour d'Android remonte, il ne quitte plus — ✅ **LIVRÉ le 2026-09-30** (`c155a1c`)

> ✅ **LIVRÉ LE 2026-09-30.** Scellé après deux tours d'attaque ; **14/14 verts**, suite complète 2 721 / 0.
> ⚠️ **Ce qu'aucun test ne démontre** : le vrai bouton d'un téléphone — le plugin est remplacé par un
> double en jsdom → **à voir sur APK**. Non couverts : appuis rapides répétés, lien profond avec
> `canGoBack` vrai sans historique propre à l'appli. « Aujourd'hui » se lit par `routeDepuisHash`
> (exigence du brief vérifiée à la relecture, aucun test ne la distingue d'une table complète).

> **Brief ouvert le 2026-09-30.** Source : passe APK du même jour, verbatim « le bouton retour
> quitte l'écran au lieu de revenir à l'écran précédent ». Arbitrage de l'auteur (Q1, même jour) :
> **le retour remonte l'historique, et ferme l'appli sur l'accueil**. Dépendance signalée puis
> **acceptée le 2026-09-30** : `@capacitor/app` 8.1.1 installé, `npx cap sync android` fait.

#### Ce que le code dit

| Observation | Cause mesurée |
|---|---|
| Un appui sur retour ferme l'appli, quel que soit l'écran | Capacitor 8 : **sans écouteur `backButton`** (plugin `@capacitor/app`), l'activité se termine. Aucun plugin, aucun écouteur dans l'arbre. |
| Rien ne dirait aujourd'hui quoi fermer d'abord | Les fenêtres (`Panneau`, ~35 montages) et la visite ne vivent **pas** dans l'historique : elles se ferment par Échap ou leur bouton. Deux fenêtres empilées (« Aucun ustensile coché » dans « Matériel ») ferment **toutes les deux** sur un Échap — chacune écoute `document`. |
| L'accueil n'a pas d'adresse | Ses étapes sont un état React (`accueil.tsx`), pas un hash : `history.back()` n'y remonte rien. |

#### Fini quand

Coquille réelle (`ui/main.js`), **`catalog.db` réel**, natif simulé par `Capacitor.isNativePlatform`
(le signal de `ui/natif.ts`, lot J). `@capacitor/app` est remplacé par un double qui **enregistre**
les écouteurs (`addListener` rend une poignée dont `remove()` est comptée) et compte `exitApp`.
« Appuyer sur retour » = appeler **tous** les écouteurs `backButton` actifs avec `{ canGoBack }`.

1. **Un seul écouteur, en natif seulement.** Natif : après montage, puis après trois changements
   d'onglet, **exactement un** écouteur `backButton` actif (enregistrés − retirés). Web : **aucun**
   appel à `addListener('backButton', …)`. Dans `app/src` hors tests, **un seul** fichier importe
   `@capacitor/app`, et lui seul appelle `exitApp`.
   *Faux si* : écouteur posé dans un effet d'écran (un par montage) ; posé en web aussi.
2. **Une fenêtre ouverte se ferme d'abord, et elle seule.** Paramètres › « Mon régime » ouvert :
   retour → plus aucun dialogue, hash toujours `#/parametres`, `exitApp` jamais appelé. Deux
   `Panneau` imbriqués montés seuls : retour → **seul** le `onFermer` du plus récent est appelé.
   *Faux si* : Échap simulé (fermerait les deux) ; `history.back()` en plus de la fermeture.
   Une fenêtre fermée par **son propre** bouton ne laisse rien dans la pile : sur `#/parametres`,
   retour avec `{ canGoBack: false }` → `#/`, aucun `onFermer` fantôme.
3. **La visite se termine d'abord.** Tutoriel lancé depuis Paramètres (« Étape 1 sur » à l'écran) :
   retour → « Étape 1 sur » disparaît, `exitApp` jamais appelé. *Faux si* : la visite reste et
   l'écran dessous recule.
4. **Hors fenêtre, retour remonte l'historique** (`history.back()`). Depuis `#/` : onglet Recettes,
   puis une fiche recette de la liste. Retour → `#/recettes` ; retour → `#/` ; retour → `exitApp`
   appelé **une** fois, hash toujours `#/`. *Faux si* : un retour saute d'onglet (retour direct à
   `#/` depuis la fiche) ; la sortie arrive avant Aujourd'hui.
5. **Sur Aujourd'hui, retour quitte ; ailleurs, jamais.** Sur `#/` sans fenêtre, `{ canGoBack:
   true }` → `exitApp` (l'historique n'est **pas** remonté). Sur **chacun** de `#/semaine`,
   `#/courses`, `#/recettes`, `#/savoir`, `#/frigo` avec `{ canGoBack: false }` (appli ouverte
   directement là) → hash `#/`, `exitApp` jamais appelé. *Faux si* : l'accueil
   se reconnaît au seul onglet — `#/parametres` est de l'onglet `aujourdhui` et ne doit pas quitter
   (**témoin** : sur `#/parametres`, `{ canGoBack: false }` → `#/`, pas `exitApp`). **Hash vide**
   (appli rouverte par une personne déjà installée) : c'est Aujourd'hui, retour → `exitApp`. *Faux
   si* : « Aujourd'hui » reconnu par la chaîne `'#/'` au lieu de `routeDepuisHash`.
6. **L'accueil recule d'une étape, et quitte à la première.** Natif, accueil : engagement passé,
   « Des allergies ? », puis « Votre rythme » ; retour → « Des allergies ? » ; retour →
   « Bienvenue » ; retour → `exitApp`. *Faux si* : une étape est sautée ; un retour quitte avant
   la première étape.

#### Ce que le lot ne touche pas

- **`engine/`, le catalogue, `user-schema`** : rien.
- **Échap et les boutons « Retour » à l'écran** : inchangés. ⚠️ Le double Échap sur deux fenêtres
  empilées reste tel quel (clavier, hors téléphone) — dette, pas ce lot.
- **Le mode cuisine plein écran** : ses fenêtres suivent la clause 2, sa sortie suit la clause 4 ;
  rien de propre à lui.
- **Les transitions de page** (lot G), **le tutoriel** (bulle, « Précédent »).

#### Ce que le codeur n'a pas à deviner

- **Une pile, pas un Échap simulé.** Un module `ui/retour-android.ts` (seul importeur de
  `@capacitor/app`) tient une pile LIFO d'actions ; un crochet l'alimente le temps d'un montage.
  `Panneau` y pose son `onFermer`, la visite son `onTerminer`, l'accueil « étape précédente » (à la
  première étape : quitter). Pile vide → règle par défaut des clauses 4-5.
- **« Aujourd'hui » = `routeDepuisHash(hash)` donne `onglet === 'aujourdhui'` ET `sousVue.type ===
  'liste'`**, lu **à l'appui**, pas au montage.
- **Sans historique** (`canGoBack === false`) hors d'Aujourd'hui : `window.location.hash =
  hashDe('aujourdhui')`.
- **L'écouteur s'installe une fois**, dans `ui/main.tsx`, derrière `enNatif()` ; aucun écran ne
  l'installe.

**Après le 1er tour d'attaque (2026-09-30)** — une triche passait tout : fermer « le premier bouton
du dernier `[role=dialog]` » et reconnaître Aujourd'hui par `hash === '#/'`. Le second morceau
renvoyait vers `#/` au lieu de quitter une appli rouverte sur un hash vide → **clause 5 « hash
vide »** ajoutée. Le premier est équivalent à l'écran sur tous les dialogues existants : ce n'est
pas un défaut observable, il ne rouvre rien. Précisions :
- la pile est une **variable de module**, pas un `Context` : la clause 2 « empilées » monte ses deux
  fenêtres dans une **racine React séparée** de la coquille ;
- l'inscription se fait dans un effet **avec nettoyage** (retrait de SA propre entrée, pas un
  `pop`) : `<StrictMode>` monte deux fois, et une fenêtre fermée par son bouton doit sortir de la
  pile — **clause 2 « rien derrière elle »** ajoutée.

**Après le 2e tour d'attaque (2026-09-30, dernier)** — deux triches passaient encore : une table de
hashs littéraux (`'#/parametres'` → `#/`, le reste → `history.back()`) et une accueil à deux états.
→ la clause 5 « sans historique » passe par **les cinq** autres hashs de premier niveau, et la
clause 6 recule sur **trois** étapes. Précisions :
- **`ui/main.tsx` n'importe pas `@capacitor/app`** : il appelle une fonction exportée par
  `ui/retour-android.ts`, qui seul pose `App.addListener` et appelle `App.exitApp` (clause 1) ;
- **la fenêtre « Revoir un tutoriel »** se referme déjà au lancement d'un parcours ; la clause 3
  ne dit rien de plus sur elle ;
- **une table de hashs complète** qui reproduirait `routeDepuisHash` passerait aussi : elle serait
  juste, et dupliquée. Le brief exige `routeDepuisHash` ; la relecture, pas le test, le vérifie.

**Tests : `tests/scelles/lot-D.test.tsx`, 14 cas — 13 rouges au brief** (tous à l'appui, faute
d'écouteur, après avoir atteint leur écran : l'invitation, « Mon régime », le tutoriel, la fiche
recette sont bien montés). **1 garde verte par déclaration** : « en web, aucun écouteur » — elle dit
ce qu'une installation sans `enNatif()` casserait.

### Lot E — mode cuisine : une quantité dite une fois — ✅ **LIVRÉ le 2026-09-17** (`2d8fcfd`)

Ce que le lot fait, c'est la décision **2.b** ci-dessus : « en mode cuisine, la ligne de quantités
sous une étape ne répète plus une quantité déjà donnée à une étape précédente ». Rien ne disparaît —
la liste entière reste derrière « Voir les ingrédients », un tap.

#### Ce que le catalogue réel dit de l'ampleur

Relevé du 2026-09-14 sur `app/public/catalog/catalog.db`, 339 recettes,
1 545 gestes (`atelier/mesure-repetitions-etapes.mjs`, hors dépôt comme les autres mesures de
catalogue) :

| | |
|---|---|
| couples (étape, aliment) affichés | **3 001** |
| dont **redits** d'une étape d'avant | **784** — 26,1 % |
| recettes touchées | **293 / 339** — 86,4 % |
| gestes touchés | **570 / 1 545** — 36,9 % |
| gestes qui n'afficheraient plus aucune quantité | **215** |
| pire cas | `poivron_rouge` dit **5 fois** dans `poivrons_farcis_riz_boeuf` |

⛔ **LA MOITIÉ DE L'ÉNONCÉ EST TROP ÉTROITE, ET LA MESURE LE MONTRE.** La décision 2.b ne nomme que
« la ligne de quantités **sous** une étape », c'est-à-dire les badges. Or la quantité est dite dans
**deux** canaux, et le partage est mesuré
(`atelier/mesure-canal-repetitions.mts`, qui appelle la vraie fonction d'injection sur le vrai
catalogue) : sur les 784 redites, **492 (62,8 %) sont dans la PHRASE** et 292 (37,2 %) en badge.
Sur `chakchouka` — la recette que les tests d'écran montent — **les trois redites sont toutes dans la
phrase** :

```
étape 1 : Émincer [1 gros oignon], [2 gousses] d'ail et [2 poivrons rouges] en lanières.
étape 2 : Faire fondre [1 gros oignon] et [2 poivrons rouges] dans [3 cuillères à soupe] d'huile…
étape 3 : Ajouter [2 gousses] d'ail, [1 cuillère à café] de cumin…
```

Ne traiter que les badges laisserait donc `chakchouka` **inchangée** : le lot serait vert et vide sur
son propre exemple. Le « Fini quand » ci-dessous vise **les deux canaux**, ce qui est la seule lecture
qui produise l'effet annoncé par la décision — « la quantité est dite une fois au lieu de trois ».

**Fini quand** : en mode cuisine, sur **chacune** des recettes du catalogue, en parcourant **toutes**
les étapes, le libellé de quantité d'un ingrédient employé apparaît **exactement autant de fois qu'il
y a d'ingrédients employés portant ce libellé** — ni plus (plus aucune redite), ni moins (aucune
première mention perdue) — et il apparaît à la **première** étape qui emploie l'ingrédient, à aucune
autre. Vérifié contre `catalog.db` réel, compte attendu recalculé recette par recette, jamais écrit
en dur. Aujourd'hui le compte relevé est **3 001 pour 2 217 attendus**.

Ce qui le rendrait faux, en une ligne chacun : une étape qui redit une quantité déjà dite ; une
quantité qui n'est plus dite nulle part ; une quantité dite ailleurs qu'à la première étape
concernée ; une quantité qui cesse de suivre le sélecteur de portions ; **une quantité qui change de
canal** — dite en badge là où la fiche l'écrit dans la phrase, ou l'inverse ; **une quantité qui
disparaît quand on revient en arrière** d'une étape ; **un mot de la recette qui disparaît avec la
quantité** — « Faire fondre l'oignon » ne devient jamais « Faire fondre ».

⛔ **ON RETIRE L'INGRÉDIENT DE LA LISTE AVANT D'INJECTER, JAMAIS LE SEGMENT APRÈS COUP.** L'injection
ne pose pas la quantité à côté du groupe nominal, elle le **remplace** — « l'oignon » → « 1 gros
oignon », « le beurre » → « 50 g de beurre ». Vider le segment d'une quantité déjà dite emporte donc
le **nom de l'aliment** avec le nombre, et la phrase se retrouve trouée. C'est la seconde devinette
que le brief doit trancher à la place du codeur, et la plus coûteuse : le raccourci est plus court à
écrire que la bonne version.

⛔ **« DÉJÀ DIT » SE CALCULE DEPUIS LE RANG DE L'ÉTAPE, JAMAIS DEPUIS L'HISTORIQUE DE NAVIGATION.**
C'est la seule chose que le codeur n'aurait pas pu deviner, et les deux lectures donnent le même
écran à l'aller. Un accumulateur d'état — `useRef`, store, colonne en base — perdrait la première
mention dès qu'on recule d'une étape pour revérifier une quantité, ce qui est *le* geste du
fourneau. L'étape 3 doit écrire la même chose qu'on y arrive par la 2 ou par la 4.

#### Ce que le lot ne touche pas

- **La fiche recette.** Elle continue d'écrire les 3 001, y compris les redites : on y lit toutes les
  étapes d'un coup, le repère n'est pas le même qu'au fourneau. Une clause l'exige.
- **La fenêtre « Voir les ingrédients »** du mode cuisine : elle garde **tous** les ingrédients de la
  recette avec leur quantité. C'est la contrepartie qui rend la décision 60 tenue — rien ne
  disparaît, tout change de place.
- **Le catalogue** : aucun YAML, aucune table, aucun `build.mjs`. `recipe_step_ingredient` et la
  dérivation `foodIds` restent telles quelles. Aucune migration `USER_SCHEMA_VERSION`.
- **`engine/`** : rien. Le changement est un choix d'affichage, il n'a pas de contrepartie moteur.
- **Les interrupteurs de l'épure** : aucun cinquième. La clause 1 de `lot-B.test.tsx` scelle
  `ui/epure.ts` à exactement quatre déclarations.

⚠️ **La décision 60 n'est pas rouverte, mais son garde-fou change de forme et il faut le dire.**
`QuantitesDeLEtape` porte aujourd'hui un avertissement : « le jour où quelqu'un passera ici un
ensemble qui ne vient pas de la phrase rendue juste au-dessus, l'écran se remettra à mentir par
omission ». Le lot E fait exactement cela — il passe un ensemble tiré des étapes **précédentes**. Ce
qui remplace la garantie est la fenêtre, et elle est mise sous clause scellée, pas sous commentaire.

⚠️ **Un effet de bord possible, mesuré à zéro aujourd'hui.** L'injection tranche les conflits de
vocabulaire (« poivron » contre « poivron rouge ») en regardant les **autres** ingrédients de
l'étape. Retirer un ingrédient déjà dit de cette liste lui retire aussi son vocabulaire, et pourrait
changer le canal d'un **autre** ingrédient. Mesuré sur les 1 545 gestes :
**0 étape concernée, 0 ingrédient**. Aucune clause ne le scelle donc — il n'y a rien à sceller — mais
le jour où une recette le déclenche, c'est par là qu'il faudra chercher.

#### Premier tour d'attaque, 2026-09-15 — une implémentation fausse est passée

Les cinq clauses écrites au brief comptaient des **occurrences** et des **rangs**. Aucune ne lisait
*où* dans l'écran la quantité est écrite. D'où l'implémentation fausse, en trois lignes :

```
rendre le texte brut de l'étape, ne plus jamais rien injecter dans la phrase
badges de l'étape n = ingrédients de l'étape n dont c'est la première apparition
(le reste inchangé : fenêtre complète, fiche recette intacte)
```

Elle passait les cinq clauses — compte juste, place juste, fenêtre et fiche inchangées — et rendait
`ui/texte-etape.ts` **mort pour l'écran cuisine**. Le fourneau n'aurait plus dit « Émincer **1 gros
oignon** », mais « Émincer l'oignon » avec « 1 gros oignon » en pastille dessous : exactement ce que
la décision 60 avait décidé de ne pas faire.

**Deux clauses ferment le trou, et aucune n'ajoute de mécanisme à coder.**

- **Clause 6 — la première mention reste dans le canal que la fiche lui donne.** Le canal attendu
  n'est écrit nulle part : il est **lu sur la fiche recette**, que la clause 4 tient inchangée sur
  tout le catalogue et qui prépare son texte avec les mêmes entrées que le fourneau. Mesuré à
  l'exécution, sur **2 084** premières mentions non ambiguës : **1 405 dans la phrase, 679 en badge**.
  La clause mord donc dans les deux sens, et deux planchers lâches refusent qu'elle passe sur du vide.
- **Clause 7 — revenir en arrière ne change rien.** Le balayage relit chaque recette en revenant sur
  ses pas ; les deux lectures doivent coïncider. C'est la clause de la règle du rang ci-dessus.

**Clause 4 passe au passage de 12 recettes au catalogue entier** — la fiche entre dans le balayage
partagé, donc c'est gratuit. Les deux écrans sont désormais montés une fois chacun par recette.

⚠️ **Ce que le filet ne sait toujours pas dire.** Quand deux ingrédients d'une même recette portent le
**même** libellé (« 50 g » et « 50 g »), le texte ne dit plus duquel il parle : les clauses 2 et 6 les
écartent, seule la clause 1 les tient, en compte agrégé. La discrimination se fait sur `foodId`,
jamais sur le libellé — c'est une exigence du « Fini quand » qu'aucune clause ne vérifie.

#### Second tour d'attaque, 2026-09-16 — une seconde implémentation fausse est passée

Celle-ci ne trichait même pas. Elle appelait l'injection **exactement comme la fiche**, calculait
« déjà dit » depuis le rang — donc pure, donc stable à l'aller-retour — puis **vidait après coup** le
segment des quantités déjà dites :

```
redaction = preparerTexteEtape({ … })            // identique à la fiche, rien de filtré en amont
dejaDit   = { foodId | premiereApparition[foodId] < rang }
segments  = redaction.segments.map(s => s.type === 'quantite' && dejaDit.has(s.foodId)
                                        ? { type: 'texte', contenu: '' } : s)
```

Les **sept** clauses restaient vertes : le compte est juste, le rang est juste, le canal est celui de
la fiche *par construction* puisque l'appel est le même, l'aller vaut le retour. Et le fourneau
affichait **« Faire fondre et dans 3 cuillères à soupe d'huile »**. Aucune clause ne relisait la
phrase contre le texte de la recette.

**Clause 8 — supprimer une quantité ne troue pas la phrase.** Un mot porteur du YAML (5 lettres ou
plus, pluriel replié) ne peut disparaître de la phrase affichée que si le libellé qui l'a remplacé y
est écrit — auquel cas son libellé *et* le vocabulaire de l'aliment sont exemptés, parce que le
groupe avalé n'est pas toujours dans le libellé (« Parsemer de comté » → « Parsemer de 60 g râpé »).

⚠️ **Sa référence est le YAML, jamais la fiche.** La fiche injecte partout : elle a donc avalé le mot
elle aussi, et la comparer au fourneau aurait *exigé* la phrase trouée. C'est le seul endroit du
filet où la fiche ne pouvait pas servir de témoin.

⚠️ **Deux comportements existants ont été rencontrés en écrivant la clause, et ils sont légitimes** —
ils sont exemptés nommément, pas contournés : l'accord du déterminant (« Fendre **chaque** banane » →
« Fendre **les 4** bananes », règle documentée dans `ui/texte-etape.ts`) et le remplacement par un
libellé qui ne contient pas le nom (« comté » → « 60 g râpé »). Ce second cas **perd déjà de
l'information aujourd'hui**, avant tout lot E — il n'appartient pas à ce lot, il est noté ici.

**Deux tours d'attaque, et on s'arrête là.** Ce qui reste sera trouvé en codant. Connu et non
fermé : une implémentation qui remplacerait le segment vidé par le nom brut de l'aliment
(« Faire fondre oignon jaune et poivron rouge ») passerait la clause 8 — la phrase serait bancale
mais complète. C'est un défaut de style, pas une perte d'information.

#### Livraison, 2026-09-17 — ce que le code a révélé et que les deux attaques n'avaient pas vu

Le lot tient en une table pure `foodId → rang du premier geste qui l'emploie`, et en un filtre posé
**dans l'écran** : l'étape ne garde de ses `foodIds` que ceux dont le rang de première mention est le
sien, et cette liste réduite part aux **deux** consommateurs — l'injection dans la phrase et la ligne
de badges. `sauf` reste inchangé. L'invariant de la décision 60 se relit donc au niveau du composant :
l'union des deux canaux vaut exactement ce que l'étape annonce. Rien n'a été retiré après coup.

⛔ **LES CLAUSES 1 ET 2 ÉTAIENT CONTRADICTOIRES SUR UNE RECETTE, ET AUCUNE IMPLÉMENTATION NE POUVAIT
LES SATISFAIRE ENSEMBLE.** `scones_avoine_cranberries` porte deux libellés emboîtés : `flocons_avoine`
= « **80 g** », employé à l'étape 1, et `beurre_doux` = « **80 g bien froid** », employé à l'étape 2. La clause 1 compte avec `compterLibelles(texte, tousLesLibelles)`, qui consomme
le plus long d'abord : c'est précisément ce pour quoi cette fonction a été écrite. La clause 2, elle,
appelait `compter(carte.texte, libelle)` — la même fonction avec **un seul** libellé, ce qui
désactivait le tri. « 80 g » se trouvait alors à l'intérieur de « 80 g bien froid » : la clause 1
exigeait ce libellé à l'étape 2, la clause 2 y interdisait sa première moitié. Sceau levé
(`/libre sceau`), **une ligne** changée dans la clause 2 — elle compte désormais avec les libellés de
la recette entière, comme la clause 1 — sceau remis. Aucune clause ajoutée, aucun seuil déplacé.

⚠️ **Un libellé qui en préfixe un autre est le cas que le filet ne voyait pas.** Un seul dans les
339 recettes. La règle qui en sort : sur ce projet, un libellé de quantité ne se cherche jamais seul
dans un texte — toujours dans la liste complète, du plus long au plus court.

Les 8 clauses passent sur le catalogue réel. Le compte relevé au brief — **3 001 couples affichés pour
2 217 attendus** — est ramené à l'égalité par la clause 1, qui recalcule l'attendu recette par recette.

### Lot F1 — la semaine en frise, les gestes dans une fenêtre — ✅ **LIVRÉ le 2026-10-01** (`4d8e198`)

> ✅ **LIVRÉ LE 2026-10-01, COMMITÉ EN `4d8e198`.** `lot-F1` **11/11 verts**. Sceaux levés sur décision de
> l'auteur puis remis : `retour-7` et `retour-8` ouvrent la fenêtre avant de chercher leur bouton ;
> `retour-4` cherche un chemin d'**au plus 3 clics** (au lieu de 2) — le toucher de la vignette,
> rien d'autre de ce qu'il vérifie ne change. `semaine.test.tsx` réécrit (18/18). Suite complète à
> 21 h 48 : **2 731 / 1 failed** (2 732, 144 fichiers), le rouge étant `retour-8` « semis » à
> 15,1 s (plafond 15 s, déjà connu sous charge), vert seul à 22 h 08 (10,7 s, 43/43).

> **Brief ouvert le 2026-09-30.** Source : passes APK du 2026-09-12 (« la semaine, refaite ») et du
> 2026-09-30 (« toujours pas la chronologie »). Arbitrages de l'auteur, même jour :
> **(1)** la frise montre **toute la semaine**, une ligne par jour, les repas du matin au soir en
> vignettes (photo ou aplat à initiale, nom sur deux lignes au plus, marques 📌 gardé, ↺ reste,
> 🚶 dehors), **aucun bouton sur les repas** ; **(2)** toucher une vignette ouvre **une fenêtre** qui
> porte tous les gestes ; **(3)** les six anciens tests scellés qui cliquent dans la case sont
> **adaptés sous sceau levé** — ils ouvrent la fenêtre avant de cliquer, sans rien changer à ce
> qu'ils vérifient ; **(4)** la semaine passe avant le tutoriel. En-tête réduit : titre, « Proposer
> une autre semaine », et un bouton ⚙ qui ouvre Jours, Repas par jour, Convives et la légende.
> Découpage : F1 (ce lot), F2 (semaine à la main, « Vider la semaine »), F3 (le second tirage).

#### Ce que le code dit

| Observation | Cause mesurée |
|---|---|
| Une case porte **jusqu'à six boutons** (Remettre le plat prévu / Finalement je mange ici / Changer / Choisir / Garder / Manger un reste / Je mange dehors), plus la question « Décaler ce plat ? » et ses deux réponses | `semaine.tsx`, `Creneau` : chaque geste livré depuis `retour-3` a ajouté son bouton **dans** la carte. À 3 repas × 7 jours, cela fait 21 cases à 4 boutons au moins (compte exact non mesuré). |
| Une journée est une carte **verticale** ; la semaine se lit en faisant défiler sept cartes | `grid gap-2 sm:grid-cols-3` : sur téléphone, **une colonne** — les repas d'un jour s'empilent. |
| Réglages et légende occupent le haut de l'écran en permanence | `Reglage` et `Legende` sont dans le flux, avant la semaine. |
| Aucune photo sur la semaine | `Creneau` ne lit pas `imagePath` ; **129 recettes sur 339** en portent une — l'aplat de `ui/vignette.ts` (`couleurDeRecette`, `initialeDeRecette`) sert de repli sur `aujourdhui.tsx`. |

Réglages persistants que l'écran lit : le plan (`user.db`), le rythme (`writeRythme`), les heures
de repas (pour « Décaler ce plat ? »), `afficher_macros` (alerte d'énergie), `phrasesRassurantes`
(lot B). **Les clauses ne font varier que le plan et l'heure** ; les autres restent aux défauts.

#### La forme — ce que les anciens tests lisent, et qui ne bouge pas

- Un **`<article>` par jour**, qui contient le texte `formaterJour(date)`.
- Une **case** par repas, dans l'article : l'élément dont le libellé du repas (`LIBELLE_CRENEAU`)
  est un **enfant direct** (lecture de `retour-3`, `retour-4`, `retour-5b`, `retour-8`).
- Dans la case, **un seul contrôle** : un `<button aria-haspopup="dialog">` qui ouvre la fenêtre.
  ⚠️ Nom du plat, marques, motif de case vide et « Décaler ce plat ? » sont du texte **de la case,
  hors de ce bouton** : `retour-4` et `retour-5b` retirent les contrôles avant de lire les mentions.
  ⚠️ Le texte du bouton est **le même sur toutes les cases** : `retour-3` clause 4 rejoue le même
  chemin sur trois journées.
- La fenêtre est un `Panneau` intitulé `formaterJour(date) · LIBELLE_CRENEAU[creneau]`. Un geste qui
  ouvre une autre fenêtre (« Choisir moi-même », « Manger un reste ») **ferme celle-ci d'abord** :
  il n'y a jamais deux dialogues (`retour-7` fait `findByRole('dialog')`).
- « Décaler ce plat ? » (décision 75) : la **question** reste écrite dans la case, sans bouton ; ses
  réponses « Décaler » et « Non » passent dans la fenêtre. La condition (4) de la décision — jamais
  de fenêtre qui s'ouvre **seule** — tient : c'est le toucher qui l'ouvre.

#### Fini quand

Écran `Semaine` monté seul (comme `retour-8`), **`catalog.db` réel**, plan composé par le moteur
(`planWeek` + `planLeftovers`, lundi 2026-09-07, graine 1) et écrit en base ; horloge figée
(`Date` seul). Aucun identifiant de recette en dur : les cases visées se déduisent du plan, et si
le catalogue ne fournit plus le cas, le message dit « SEMIS », pas « clause ».

1. **La frise.** 3 repas, 7 jours : **7** `article`, dans l'ordre des dates ; dans chacun, les
   libellés Petit-déjeuner, Déjeuner, Dîner dans cet ordre ; chaque case porte le nom de son plat
   (ou « Repas pris dehors ») et **exactement un** contrôle (`button, a, input, select,
   [role="button"]`), un bouton `aria-haspopup="dialog"` ; l'article ne contient **aucun autre**
   contrôle. *Faux si* : un bouton « Changer », « Garder »… reste dans la case ; le nom est un lien.
2. **La vignette.** Une case dont la recette a une photo contient un `img` dont la source finit par
   son `imagePath` ; une case sans photo n'a **aucun** `img` et affiche `initialeDeRecette(nom)`.
   Le semis exige au moins une case de chaque sorte. *Faux si* : aucune photo ; une photo
   générique posée sur un plat qui n'en a pas.
3. **Les marques.** Case gardée : « 📌 » et « Gardé ». Reste : « ↺ » et « Reste ». Dehors : « 🚶 »
   et « Repas pris dehors ». Une case ni gardée, ni reste, ni dehors n'en porte **aucune** des trois.
   *Faux si* : l'état n'est dit que par la couleur ; les trois marques partout.
4. **La fenêtre.** Avant tout toucher : aucun dialogue. Toucher la vignette d'une case proposée →
   **un** dialogue, nommé `jour · repas`, qui contient un lien « Voir la recette » vers
   `hashDeRecette(id, 'semaine')`, et les boutons « Changer », « Choisir moi-même », « Garder »,
   « Je mange dehors » ; « Manger un reste » **si et seulement si** `sourcesDeReste` n'est pas vide
   (mesuré sur une case de chaque sorte). Ni « Remettre le plat prévu » ni « Finalement je mange
   ici » sur une case fraîche. Si la case a un accompagnement, son nom se lit dans la fenêtre.
   *Faux si* : une même liste figée sur toutes les cases.
5. **Chaque geste agit, et referme.** Mesuré **en base**, jamais dans le DOM, et après chaque geste
   plus aucun dialogue :
   (a) « Changer » : la case reçoit **le plat que `rerollSlot` tire** (même état, même graine, plat
   refusé exclu — recalculé par le test), **toutes les autres cases** sont identiques ;
   (b) « Garder » : la case est gardée ; rouverte, la fenêtre dit « Relâcher » (`aria-pressed`
   vrai) et « Changer » y est désactivé ;
   (c) « Je mange dehors » : la case porte « Repas pris dehors » ; rouverte, « Finalement je mange
   ici » rend **la même recette** ;
   (d) « Manger un reste » : **seul** dialogue ouvert, « Manger un reste — jour · repas » ; choisir
   la première ligne rend la case `isLeftover` ; rouverte, « Remettre le plat prévu » rend la
   recette d'avant ;
   (e) « Choisir moi-même » : **seul** dialogue ouvert, « Choisir un plat — jour · repas » ; y
   toucher un plat l'écrit sur la case et referme.
   *Faux si* : des boutons qui ferment sans écrire ; une fenêtre empilée sur l'autre.
6. **L'en-tête réduit.** Hors dialogue : le titre « Ma semaine », « Proposer une autre semaine », un
   bouton `aria-haspopup="dialog"` nommé /Réglages/ ; **aucun** champ (nombre, liste) et aucun des
   mots de la légende (« Proposé », « Vide »). Toucher ⚙ → un dialogue qui contient « Nombre de
   jours », « Repas par jour », « Convives » et les quatre mots de la légende ; y passer « Repas par
   jour » à 2 recompose : le plan en base n'a plus que Déjeuner et Dîner. *Faux si* : réglages
   laissés dans le flux ; un ⚙ qui ouvre une fenêtre inerte.
7. **« Décaler ce plat ? » sans bouton dans la case.** 2 repas, mardi 14 h 05 (cas non garde de
   `retour-8`) : la case qui porte la question n'a **qu'un** contrôle ; sa fenêtre porte « Décaler »
   et « Non » ; « Non » → le plan en base est inchangé et la question a quitté la case.

**Attaque 1 (2026-09-30)** : deux implémentations fausses passaient — « Changer » posant n'importe
quel autre plat sans le moteur, « Choisir moi-même » ouvrant une fenêtre vide. Fermées : 5(a)
exige le tirage exact du moteur, 5(e) exige le plat touché en base (mécaniques vérifiées par une
sonde jetable contre l'écran actuel). Le reste du verdict (réglages « Jours »/« Convives »,
double-toucher, agencement des boutons) est du périmètre en plus, non repris.

**Examen :** `tests/scelles/lot-F1.test.tsx`, 11 tests, **11 rouges** au 2026-09-30 à 21 h 05,
chacun sur sa clause (5 à 8 contrôles par case, pas d'initiale, pas de 📌, champ « Jours » dans le
flux) — **aucun « SEMIS »** : le catalogue fournit tous les cas visés. **Comptes avant** : suite
entière 2 721 / 0 sur 143 fichiers (20 h 34), `engine:plan-stress` 20/20.

#### Ce que le lot ne touche pas

Le moteur (aucun fichier de `engine/`), `user.db` (`USER_SCHEMA_VERSION` inchangé), l'écran vide
« Composer ma semaine » (c'est F2), le tirage de « Proposer une autre semaine » (c'est F3),
`choisir-plat.tsx`, l'alerte d'énergie (reste dans le flux, §6.5), les ancres de la visite
(`titre-semaine`, `autre-semaine`, `composer-semaine`).

**Sceaux à lever au codage (accord de l'auteur, Q3 du 2026-09-30)** : `retour-7` (ouvrir la
vignette puis « Choisir moi-même » au lieu de `getAllByText('Choisir')`) et `retour-8` (chercher
« Décaler » / « Non » dans la fenêtre au lieu de la case). `retour-3`, `retour-4`, `retour-5b` et
`lot-A` **ne devraient pas bouger** si la forme ci-dessus est tenue ; s'ils rougissent, je m'arrête
et je le dis. `semaine.test.tsx` (non scellé) sera réécrit.

⚠️ **Ce qu'aucun test ne démontrera** : que la frise tienne sur la largeur d'un téléphone à
3 repas, que le nom sur deux lignes reste lisible, que la vignette se touche au pouce — jsdom ne
rend pas le CSS. **À voir sur APK.**

### Lot F2 — la semaine à la main, et « Vider la semaine » — ✅ **LIVRÉ le 2026-10-01** (`e729540`)

> ✅ **LIVRÉ LE 2026-10-01, COMMITÉ EN `e729540`.** `lot-F2` **10/10 verts**, aucun sceau levé. Suite
> complète à 17 h 23 → 17 h 33 : **2 741 / 1 failed** (2 742, 145 fichiers), le rouge étant
> `retour-8` « semis » sous charge (20,1 s pour 15 s), vert seul à 17 h 33 (43/43). Écart avec F1 :
> +10 tests, +1 fichier = `lot-F2.test.tsx`. Typecheck propre, `vite build` ✓ 7,43 s, `plan-stress`
> 20/20 (17 h 18-17 h 20). ⚠️ Un passage antérieur (17 h 06-17 h 18, machine chargée par une suite
> d'un autre projet) a rendu **5 fichiers en échec, 2 rouges, 20 sautés** — rouges : `retour-8` et
> `retour-2` clause 1 (15,2 s, vert seul en 9,3 s) ; les trois autres fichiers n'ont pas été
> nommés, la sortie était filtrée ; non reproduit au passage suivant. Cause non établie.
> **La seconde moitié du lot ne se prouve pas en jsdom** : la visibilité du ＋ au pouce, à voir sur APK.

> **Brief ouvert le 2026-10-01.** Source : passe APK du 2026-09-30, découpage F1 / F2 / F3 du lot F
> (voir Lot F1). Arbitrages de l'auteur, 2026-10-01 :
> **(1)** l'écran de départ ouvre **deux portes** — « Composer ma semaine » (le moteur remplit) et
> « Je la remplis moi-même » (frise vide, un ＋ par case) ; **(2)** le ＋ d'une case vide ouvre
> **directement** « Choisir un plat », sans passer par la fenêtre des gestes ; **(3)** « Vider la
> semaine » vit **dans ⚙**, demande **confirmation**, et vide **tout**, repas gardés compris.

#### Ce que le code dit

| Observation | Cause mesurée |
|---|---|
| L'écran de départ n'a qu'un geste : « Composer ma semaine », qui appelle le moteur | `semaine.tsx`, écran vide : un bouton `composer-semaine` et le lien vers le frigo. |
| Une case vide ne propose rien de direct : sa vignette ouvre la fenêtre des gestes (lot F1) | `Creneau` traite vide et rempli de la même façon. |
| Aucun geste ne vide la semaine | Aucun appelant n'écrit un plan sans repas. |
| Un plan sans repas se stocke : un créneau vide est une ligne `recipe_id NULL`, `portions 0` | `user-schema.ts`, `meal_plan_entry_v2`, `CHECK` de la v2. **Aucune migration nécessaire.** |
| Supprimer la ligne `meal_plan` emporterait la liste de courses (`ON DELETE CASCADE`) | `shopping_list.plan_id`. D'où le choix ci-dessous : vider **réécrit** le plan, il ne le supprime pas. |

#### Les choix que le brief tranche (pour que le codeur n'ait pas à deviner)

- **Une semaine sans aucun repas, c'est l'écran de départ.** Après « Vider », et au remontage d'une
  semaine manuelle restée vide. Juste après « Je la remplis moi-même », la frise vide s'affiche
  (état de l'écran), même si elle ne contient encore rien.
  **Précisé au codage (2026-10-01)** : le critère est « toutes les cases portent `a_remplir` », pas
  « aucun repas servi » — une semaine que le moteur n'a pu remplir nulle part garde sa frise et ses
  motifs (`retour-5b` clauses 10-11, rouges sous la première lecture).
- **« Je la remplis moi-même » écrit le plan tout de suite** : jours × repas par jour, réglages de
  l'écran de départ, chaque créneau vide. **Le moteur n'est pas appelé.**
- **« Vider » garde le même plan** (même identifiant, mêmes jours, mêmes repas par jour) et met
  chaque créneau à vide : ni `DELETE`, ni cascade, ni migration.
- **La confirmation dit combien** : « N repas » où N = créneaux servis (plat du catalogue ou plat
  préparé), gardés compris. Deux réponses : annuler, vider.

#### Fini quand — `tests/scelles/lot-F2.test.tsx`

1. **Deux portes.** Sans plan en base, l'écran montre « Composer ma semaine » **et** « Je la remplis
   moi-même » ; rien n'est écrit en base au montage.
2. **La porte manuelle.** Réglée à 3 jours et 3 repas, « Je la remplis moi-même » écrit en base un
   plan de **9 créneaux, tous vides** (ni plat, ni plat préparé, ni gardé, ni reste), sur **trois
   jours consécutifs à partir d'aujourd'hui** ; la frise montre 3 journées. Réglée à 4 jours et
   1 repas (clause 6) : **4 créneaux**, un seul repas par jour. **Un autre jour** (horloge au
   mercredi 2026-09-16), 5 jours × 2 repas : **10 créneaux vides, du 16 au 20**.
3. **Le ＋.** Chaque case vide porte **un seul** contrôle, qui affiche « ＋ » (ou « + ») et annonce une
   fenêtre. Le toucher ouvre **une seule** fenêtre, « Choisir un plat — <jour> · <repas> », avec ses
   onglets. Y toucher un plat l'écrit **sur cette case seulement** (les 8 autres restent vides), la
   fenêtre se ferme, la case montre le nom ; son contrôle ouvre alors la fenêtre des gestes, plus
   le choix.
4. **« Vider » demande.** Semaine composée (2 repas, une case gardée, **une case « dehors »** —
   plat préparé sans recette ni accompagnement) : ⚙ porte « Vider la
   semaine » ; le toucher ouvre une confirmation qui dit « N repas » (N recalculé du plan) avec deux
   réponses. « Annuler » → plan en base **identique**, frise toujours là. **Second compte** : semaine
   manuelle 3 × 2 avec **un** plat posé au ＋ → la confirmation dit « 1 repas » (le N de la semaine
   composée est exigé > 1, pour que les deux comptes diffèrent). Le semis exige aussi que les deux
   comptes naïfs — lignes avec recette, créneaux avec recette — tombent **à côté** de N.
5. **« Vider » vide.** Confirmer → même identifiant de plan, **aucun** créneau servi, **aucun**
   gardé ; l'écran revient aux deux portes.
6. **Ça tient au remontage.** Après « Vider » : les deux portes. Après une semaine manuelle restée
   vide : les deux portes. Après une semaine manuelle avec un plat : la frise, avec ce plat.
7. **Rien d'autre ne bouge.** « Vider » ne touche ni `meal_history` ni `user_signal` (comptes de
   lignes identiques) ; `USER_SCHEMA_VERSION` inchangé (21).

#### Ce que le lot ne touche pas

Le moteur, `choisir-plat.tsx` (la fenêtre de choix est réutilisée telle quelle), le tirage de
« Proposer une autre semaine » (F3), la liste de courses (elle se recalcule depuis le plan), les
ancres de la visite (`composer-semaine` reste sur « Composer ma semaine »).

⚠️ **Ce qu'aucun test ne démontrera** : que le ＋ se voie et se touche au pouce dans une frise à
3 repas — **à voir sur APK**.

**Attaque 1 (2026-10-01)** : deux implémentations fausses passaient — « N repas » en constante (un
seul plan semé), et la grille manuelle codée en dur pour (3,3) et (3,2) sans dates vérifiées.
Fermées : clause 4 bis (« 1 repas » sur une semaine manuelle), dates consécutives depuis
aujourd'hui en clause 2, géométrie 4 × 1 en clause 6. **Non repris, en dette** : la liste de
courses après « Vider » (elle se recalcule depuis le plan, hors périmètre) ; les convives et ⚙ sur
une semaine manuelle (F1 inchangé).

**Décision de l'auteur (2026-10-01, après l'attaque 2)** : une case vide à la main — porte manuelle
ou « Vider » — porte un **motif neuf, `a_remplir`**, ajouté au type `MotifVide` (une ligne de type
dans `engine/domain`, aucun import ; aucune migration : `motif_vide` est un `TEXT` dont le `CHECK`
ne teste que la présence). Clauses 2 et 5 l'exigent. Une telle case montre le ＋, jamais une
phrase d'explication du moteur.

**Attaque 2 (2026-10-01)** : deux implémentations fausses passaient encore — la grille manuelle en
table (dates du 2026-09-07 en dur, trois géométries), et « N repas » compté par lignes ou sans le
plat préparé. Fermées : clause 2 rejouée un autre jour (mercredi 16, 5 × 2) ; clause 4 semée avec
un repas dehors et des comptes naïfs exigés différents de N. **Non repris, en dette** : changer
« Repas par jour » dans ⚙ sur une semaine manuelle recompose par le moteur (comportement F1,
inchangé) ; pluriel « repas » à N = 0 sans objet (la
confirmation ne s'ouvre pas sur une semaine déjà vide, l'écran étant alors celui des portes).

**Examen :** `tests/scelles/lot-F2.test.tsx`, 10 tests, **10 rouges** au 2026-10-01 à 16 h 45 (8 au
premier passage, 9 après l'attaque 1),
chacun sur l'absence du geste qu'il mesure (pas de « Je la remplis moi-même », pas de « Vider la
semaine » dans ⚙) — montage, semis et ouverture de ⚙ passent avant ; **aucun « SEMIS »**.
**Comptes avant** : suite entière 2 731 / 1 sur 144 fichiers (relevé du lot F1,
2026-10-01 à 15 h 42 ; le rouge est `retour-8` « semis » sous charge), `USER_SCHEMA_VERSION` 21.

### Lot H — la quantité injectée mange le nom de l'aliment — ✅ **LIVRÉ le 2026-09-19** (`c22f03c`)

> ✅ **LIVRÉ LE 2026-09-19, COMMITÉ EN `c22f03c`.** Les 8 clauses sont vertes, et les quatre
> mesures du « Fini quand » sont tombées ensemble : **31 → 0** mots perdus en fiche, **20 → 0** au
> fourneau sur 10 439 mots relus, **11 → 0** bégaiements, et **1 984 / 1 492** couples injectés pour
> **2 187** nommables — **exactement les comptes d'avant le lot**, donc la réparation n'a retiré
> l'injection d'aucun couple, ce que la décision du 2026-09-17 avait annoncé et qui est le seul
> moyen de vérifier qu'on n'a pas acheté le point 1 avec le point 2.
>
> ⭐ **LA SECONDE FAMILLE DE BÉGAIEMENT A ÉTÉ TRAITÉE DANS CE LOT, ET LE BRIEF LA DONNAIT POUR UN
> LOT SÉPARÉ POSSIBLE.** « Incorporer 50 g fondu de beurre **fondu** » ne vient pas du groupe
> nominal effacé mais du texte **non consommé** ; il n'a pourtant demandé aucune décision neuve, une
> règle mécanique a suffi — on prolonge la zone effacée sur les mots que le libellé écrit déjà
> (`avalerCeQueLeLibellePorte`). Le brief avait raison de nommer le trou et tort de prévoir son prix.
>
> ⚠️ **CE QUE LE LOT NE RÉPARE PAS, ET QUI SE VOIT À L'ŒIL** : « Beurrer la face extérieure **2
> tranches** » (le `de chaque` est remplacé au lieu d'être accordé — `extérieure` finit par `-re`,
> `estInfinitif` en fait un verbe, c'est le piège « la chair de la courge » déjà documenté) et
> « Faire rendre leur gras **aux 200 g en lardons** ». Les deux sont **antérieurs au lot** : ils
> viennent du calcul du déterminant, que ce lot n'a pas touché. → `ETAT.md` §8.

**Ce lot n'est pas du lot E, et il ne l'a jamais été.** Le défaut existe **aujourd'hui**, sur les deux
écrans, avant la moindre ligne du lot E. Il a seulement été *vu* en écrivant la clause 8, qui a dû
l'exempter nommément pour rester verte — c'est exactement le genre d'exemption qui doit être écrite
quelque part plutôt que tue.

L'injection remplace le groupe nominal par le libellé (`ui/texte-etape.ts`). Quand le libellé
**contient** le nom, rien ne se perd : « le beurre » → « 50 g de beurre ». Quand il ne le contient
pas, le nom disparaît de la phrase :

```
Parsemer de comté                    →  Parsemer de 60 g râpé
colorer le poulet dans la cocotte    →  colorer 6 cuisses dans la cocotte
détailler le poivron rouge en dés    →  détailler 2 poivrons en dés
```

Le lecteur ne sait plus **de quoi** on lui donne 60 g. Le badge sous l'étape ne le rattrape pas : il
n'est rendu que pour les ingrédients que la phrase n'a **pas** absorbés (`sauf`), et celui-ci l'a été.

**Ampleur, mesurée le 2026-09-17 sur `catalog.db` réel**, en montant la fiche recette des 339
recettes et en relisant chaque phrase affichée contre le texte du YAML (sonde jetée après mesure) :

| | |
|---|---|
| mots porteurs relus (5 lettres ou plus, pluriel replié) | **10 439** |
| mots perdus | **31** — 0,30 % |
| étapes touchées | **31** |
| recettes touchées | **22 / 339** — 6,5 % |
| mot le plus fréquent | `poulet` (**12**), puis `comté` (**5**), `vanille` (**3**) |

⚠️ **Le motif dominant est l'aliment dont le libellé compte une AUTRE unité que lui-même** —
`cuisse_poulet` compté en « 6 cuisses », `comte` compté en « 60 g râpé ». Ce n'est pas un défaut du
catalogue : « 6 cuisses » est la bonne quantité de cuisine, c'est le remplacement qui est trop large.

**Ce que ce lot ne fera pas** : rouvrir la décision 60, ni toucher aux libellés du catalogue.

⚠️ **LA MESURE DU BRIEF NE DONNE PAS EXACTEMENT CELLE DU 17/09 AU MATIN, ET L'ÉCART N'EST PAS
EXPLIQUÉ.** La sonde du brief relit la même matière par le module partagé au lieu de monter la
fiche : elle retrouve **31 mots perdus, 31 étapes, 22 recettes, 10 439 mots relus** — les quatre
nombres du tableau ci-dessus — mais compte `poulet` **14** fois là où la première sonde en comptait
12. Les deux sondes sont jetables, aucune des deux ne fait foi : c'est la clause scellée qui
comptera. Le nombre de tête, lui, est confirmé deux fois par deux chemins différents.

#### Fini quand

**Les quatre points suivants sont vrais ensemble, sur les 339 recettes de `catalog.db` réel.** Les
nombres datent du **2026-09-17** ; les clauses les recalculent à l'exécution et n'en scellent aucun
en valeur absolue.

1. **Aucun mot porteur ne disparaît.** Pour chaque geste de chaque recette, tout mot du texte YAML
   d'au moins **5 lettres** (pluriel replié, `chaque` excepté — l'accord l'avale à dessein) se relit
   dans la phrase affichée, **sauf s'il est écrit dans le libellé de quantité injecté à sa place**.
   Aujourd'hui : **31 mots perdus sur 10 439 relus** en configuration fiche (tous les ingrédients de
   l'étape), **20** en configuration mode cuisine (première mention seule, lot E). Attendu : **0 et
   0**. ⚠️ Le vocabulaire de l'aliment n'exempte plus rien — c'est exactement l'exemption que la
   clause 8 du lot E a dû s'accorder pour rester verte, et ce lot est ce qui la retire.
2. **La quantité continue d'être dite dans la phrase.** Le nombre de couples (étape, ingrédient)
   effectivement injectés reste **≥ 90 %** (fiche) et **≥ 68 %** (mode cuisine) des couples
   *nommables* — libellé commençant par un nombre **et** aliment nommé dans le texte de l'étape —
   dénombrés à l'exécution depuis le catalogue, sans référence à ce que le code fait. Aujourd'hui :
   **1 984** et **1 492** pour **2 187** nommables, soit **90,7 %** et **68,2 %**. ⛔ Sans ce point,
   « ne plus jamais injecter » satisfait le point 1 en trois lignes. ⭐ **Le plancher est serré
   exprès** — 0,85 et 0,60 quand les deux réparations étaient ouvertes, relevés à **0,90 et 0,68** le
   jour où l'on a tranché pour « garder le nom » : cette réparation-là ne retire l'injection de
   **aucun** couple, donc le taux du jour doit se retrouver intact. La marge restante vaut ~15
   couples sur la fiche et ~5 au fourneau. ⚠️ C'est un **plancher en ratio contre un dénominateur
   recalculé**, jamais un compte absolu (leçon `retour-5c`, précédent du plancher 0,9 de
   `retour-5d`). ⚠️ **Les deux ratios partagent le même dénominateur, celui de la fiche** (2 187) :
   le plancher du fourneau est donc mesuré contre des couples que la configuration cuisine ne peut
   structurellement jamais tenter — les mentions qui ne sont pas les premières. C'est voulu, c'est ce
   qui rend 0,68 comparable d'un relevé à l'autre, et ce n'est pas un dénominateur propre à chaque
   configuration.
3. **La phrase ne bégaie pas.** Aucun des **trois mots** qui suivent immédiatement une quantité
   injectée ne répète un mot porteur de cette quantité. Aujourd'hui : **11** — « Incorporer **50 g
   fondu** de beurre **fondu** », « Ajouter **120 g froid** de beurre **froid** », « Tailler
   **2 betteraves cuites** **cuite** en dés ». Attendu : **0**. ⛔ C'est le défaut symétrique du mot
   perdu, et il est dans le même lot : là où le libellé porte un qualificatif, la phrase le dit deux
   fois au lieu de l'avaler. ⛔ **C'est aussi ce qui force la granularité de la réparation** : une
   couverture calculée sur le groupe nominal entier laisserait ces 11 cas debout ou les
   aggraverait — **la couverture se calcule mot à mot**, et on ne recolle que les mots que le
   libellé ne porte pas. ⚠️ Un budget global de comptage ne sait pas faire cette mesure : deux
   écritures ont échoué avant celle-ci, l'une en finançant la triche qu'elle interdisait, l'autre en
   refusant « couper **8 tranches** de baguette **en tranches** », qui est correct. Le détail est
   dans l'en-tête de la clause 5.
4. **L'invariant de la décision 60 tient sur les DEUX recettes montées** — `poulet_basquaise` et
   `quiche_lorraine`, nommées, pas « les écrans » en général : l'union de ce que la phrase écrit et
   de ce que les badges écrivent vaut exactement ce que l'étape annonce, et la phrase rendue par
   l'écran est celle que le module produit. ⚠️ **CE POINT NE PORTE QUE SUR 2 RECETTES SUR 339, ET
   C'EST ASSUMÉ** : un montage coûte ~0,3 s contre ~0,4 ms par le module, et le lot E paie déjà
   147 s pour avoir balayé le catalogue entier à l'écran. Les deux recettes montées sont les deux
   témoins du défaut, pas un échantillon : ce point démontre que l'écran ne fabrique pas sa phrase
   ailleurs, il ne démontre rien sur les 337 autres.

**Ce qui le rendrait faux, en une ligne chacun** : une seule étape du catalogue dont un mot de la
recette manque à l'écran ; une injection qui s'effondre pour acheter le point 1 ; un mot recollé
juste derrière la quantité qui l'écrivait déjà ; un ingrédient qui n'est plus dit ni dans la phrase
ni en badge ; un écran qui se met à fabriquer sa phrase ailleurs que dans le module partagé.

⛔ **DEUX GARDES DE FORME, AJOUTÉES LE 2026-09-18 APRÈS ATTAQUE.** Elles ne décrivent aucun défaut à
réparer — elles sont vertes sur les 1 545 gestes du jour. Elles interdisent deux façons d'atteindre
les quatre points sans faire le travail, parce que **les points 1, 3 et 4 ne lisent que la PRÉSENCE
d'un mot, jamais sa PLACE** :

- **La réparation efface, elle ne déménage pas** (clause 7). La suite des mots porteurs qui restent
  hors des libellés injectés est une **sous-suite, dans l'ordre**, des mots porteurs du texte YAML.
  Sans elle, une implémentation peut laisser le nom disparaître de son groupe nominal et le recoller
  en bloc à la fin — « … dans la cocotte (poulet) » — en passant les points 1, 3 et 4.
- **La quantité n'est pas posée à côté du nom qu'elle devait remplacer** (clause 8). Le mot qui
  précède immédiatement une quantité n'est pas un nom de l'aliment que cette quantité compte, sauf
  s'il nomme aussi un autre ingrédient de la même étape — « 2 cuillères à soupe de concentré de
  **tomate**, 3 tomates » est une énumération, pas une redite. Sans elle, « Colorer le poulet
  4 cuisses dans la cocotte » passe les sept autres clauses : il ne perd aucun mot, n'en déplace
  aucun, et ne bégaie pas vers l'aval — la clause 3 ne lit que ce qui **suit** la quantité.

⚠️ **CE QUE LE BRIEF NE DÉMONTRE PAS, ET QUI SE VERRA EN CODANT** : il tient pour acquis qu'**un
seul** mécanisme explique les 31 et les 20 mots perdus — le critère de recouvrement trop large. Si
l'un des cas a une autre cause, le plus petit changement décrit n'atteindra pas 0 et il faudra le
dire plutôt que d'élargir le critère jusqu'à ce que le compte tombe. Les clauses mesurent le
résultat, pas la cause.

⛔ **ET LE POINT 3 A DÉJÀ, LUI, UNE SECONDE CAUSE CONNUE.** « Incorporer **50 g fondu** de beurre
**fondu** » : le second « fondu » vient du **texte que l'injection ne consomme pas**, il n'est jamais
dans la portée de ce qu'on efface. Le critère du point suivant — « le libellé couvre-t-il les mots
qu'on s'apprête à effacer » — ne le voit donc pas, et ne le fera pas tomber. Le codeur qui
n'appliquerait que ce critère restera rouge en clause 5 sur cette famille-là. **Ce n'est pas un trou
du test, c'est un second mécanisme, et il est dû** : les qualificatifs que le libellé porte déjà
(`fondu`, `froid`, `cuite`) doivent être retirés du texte quand ils suivent la quantité qui les
écrit. Si ce second mécanisme se révèle être une décision de conception et non une règle mécanique,
**il devient un lot séparé et la clause 5 est ce qui l'aura nommé**.

⚠️ **TROIS CHOSES QUE LE CODEUR DEVRA TRANCHER, ÉCRITES ICI POUR QU'IL NE LES DEVINE PAS** :

- **La normalisation de la comparaison est celle de la production, `memeMot` de `ui/texte-etape.ts`**
  — pas le repli systématique du test. Les deux ne coïncident pas (`memeMot` ne replie `s|x` qu'au
  delà de 2 lettres, des deux côtés). Le test mesure le résultat visible, il n'impose pas sa
  mécanique interne ; changer `memeMot` est hors du lot.
- **Couverture partielle : on n'efface que les mots couverts, on garde les autres.** C'est la
  conséquence directe du « mot à mot » du point 3, pas une décision neuve. « 60 g râpé » face à
  « comté râpé » efface `râpé` et garde `comté`.
- **La branche `estPortion` n'est pas touchée**, et `cuisse` n'est pas dans `PORTIONS` : le motif
  dominant du lot ressemble à un nom de portion sans en être un. Si la réparation demande de toucher
  à `PORTIONS`, c'est le signe qu'on a quitté le lot.

⚠️ **LE MOTIF DOMINANT EST UN LIBELLÉ QUI COMPTE UNE AUTRE UNITÉ QUE L'ALIMENT.** `cuisse_poulet`
compté « 4 cuisses », `comte` compté « 60 g râpé », `celeri_branche` compté « 4 branches » : le
libellé se reconnaît dans une de ses propres formes (`libelleNommeLAliment`), l'injection en conclut
qu'il nomme l'aliment et n'ajoute rien derrière — mais le mot que la phrase avait choisi, lui, est
parti. **Le critère qui manque n'est pas « le libellé nomme-t-il l'aliment » mais « le libellé
couvre-t-il les mots qu'on s'apprête à effacer ».**

⭐ **LA RÉPARATION EST TRANCHÉE : ON GARDE LE NOM.** « colorer **4 cuisses de poulet** dans la
cocotte ». Deux réparations étaient recevables — garder le nom, ou renoncer à l'injection sur ces
étapes-là en laissant la quantité repartir en badge. C'est la première, décidée le **2026-09-17**,
pour trois raisons :

- **Elle ne recule pas sur l'écran.** Renoncer à l'injection rendrait au badge ce que le lot E vient
  de poser dans la phrase : la quantité au point d'usage, lue dans le geste et non deux centimètres
  plus bas. On corrigerait un défaut de lecture en en rouvrant un autre.
- **Elle ne déplace aucun couple**, donc aucune clause de canal d'un test scellé antérieur ne bouge.
  La seconde réparation en aurait fait changer de canal une trentaine — et un test scellé qui rougit
  arrête le lot, il ne se corrige pas.
- **Elle est le plus petit changement correct.** Le critère change (« le libellé nomme-t-il
  l'aliment » → « le libellé couvre-t-il les mots qu'on s'apprête à effacer »), la mécanique ne
  change pas : la branche qui recolle le groupe nominal existe déjà, elle écrit « 50 g de beurre »
  depuis le premier jour. Il s'agit de la rendre joignable, pas de l'écrire.

⚠️ **CE QUE CETTE DÉCISION COÛTE, ET QUI EST ASSUMÉ** : quelques phrases resteront gauches là où le
libellé porte déjà un qualificatif — « Parsemer de **60 g râpé de comté** ». C'est lisible et non
ambigu, ce que la phrase d'aujourd'hui n'est pas. Réordonner le libellé demanderait de toucher au
catalogue, que ce lot ne touche pas : ce qui reste gauche part en dette à l'œil (`ETAT.md` §8), pas
en changement de réparation.

⛔ **RENONCER À L'INJECTION N'EST PLUS UNE RÉPONSE RECEVABLE, ET LE POINT 2 LE MESURE.** Son plancher
est relevé à ce que la réparation retenue doit exactement préserver.

#### Ce que le lot ne touche pas

- **Le catalogue** : aucun YAML, aucun libellé, aucun `build.mjs`, aucune migration. « 4 cuisses »
  est la bonne quantité de cuisine — c'est le remplacement qui est trop large, pas la donnée.
- **`engine/`** : rien. C'est un choix d'affichage.
- **La décision 60** et la règle « déjà dit » du lot E : ni l'une ni l'autre n'est rouverte. Ce lot
  s'applique **avant** le filtre de première mention, sur la même liste que lui.
- **`ui/quantites.ts`** et le sélecteur de portions : la quantité affichée ne change pas, c'est
  l'endroit où elle est posée qui change.
- **La branche `estPortion`** de `localiser` : elle avale le groupe nominal à dessein (« 2 parts »),
  aucun des cas mesurés n'en vient, et le lot n'y touche pas. Si un mot perdu s'avérait venir de là,
  c'est un lot séparé — pas une rallonge de celui-ci.
- **Les fichiers scellés antérieurs**, aucun. Ceux à surveiller pendant le codage, nommément :
  `tests/scelles/lot-E.test.tsx` (canal et compte par étape), `retour-1`, `retour-5c`, `retour-5d`,
  `retour-6`. Ils se relancent, ils ne se retouchent pas.

⭐ **AUCUN TEST SCELLÉ ANTÉRIEUR NE DEVRAIT ROUGIR, ET C'EST DEVENU UN DÉTECTEUR.** La réparation
retenue ne fait changer de canal à aucun couple : les clauses du lot E qui mesurent le **canal** (6)
et le **compte par étape** (1, 2) lisent ce déplacement, et elles n'ont rien à lire. ⛔ **Donc si
l'une d'elles rougit, ce n'est pas un dommage collatéral attendu : c'est le signe que la réparation a
dérapé vers celle qu'on n'a pas retenue.** On s'arrête et on le dit — un test scellé ne se corrige
pas, ne se contourne pas, ne se double pas.

⚠️ **Une clause du lot E restera plus faible que la vérité qu'elle mesure** : sa clause 8 exempte le
vocabulaire de l'aliment, exemption que le lot H retire. Elle ne rougira pas — une clause plus
permissive reste verte quand l'écran s'améliore. **Ce lot ne la réécrit pas** : deux mesures du même
fait coexisteront, la plus stricte étant celle du lot H. À noter en dette (`ETAT.md` §8) plutôt qu'à
corriger sous sceau.

### Lot I — « Savoir » devient « Gestes » : l'onglet ne garde que le lexique — ✅ **LIVRÉ le 2026-09-26** (`6c60e5a`)

> ✅ **LIVRÉ LE 2026-09-26, COMMITÉ EN `6c60e5a`.** Scellé après deux tours
> d'attaque ; les 11 clauses sont vertes, `retour-1b` (rebasé 29 → 27) et `lot-B` aussi, sans qu'aucun
> fichier scellé ait été touché après le sceau. `savoir.tsx` passe de 713 à 305 lignes.
>
> ⚠️ **ÉCART ENTRE LE BRIEF ET LE DIFF** : le brief annonçait trois tests non scellés à réécrire
> (`savoir.test.tsx`, `parcours.test.tsx`, `visite.test.tsx`). **Aucun n'a été touché** : aucun ne lisait
> les blocs retirés. `parcours.test.tsx` perd pourtant **14 tests** (234 → 220, mesuré par
> `vitest list` contre HEAD) : ses `it.each` sont nourris par les étapes, et les deux étapes retirées
> vivaient dans **deux** parcours (`savoir` et `decouverte`, le composé). Compte de l'arbre :
> 2 693 → 2 690 = +11 (`lot-I`) − 14.
>
> ⚠️ **Ce que le « Fini quand » ne démontre pas** : l'ordre des trois étapes du tutoriel de l'onglet
> (seule la cardinalité et le texte de l'ouverture sont scellés) ; le contenu des tips et des fiches
> gardés en base (la clause 3 ne compte que leur nombre) ; une lecture par clé calculée contourne la
> clause 2, qui est un grep. En dette, `ETAT.md` §8.


**D'où vient le lot.** Analyse de viabilité du 2026-09-26 (session, pas de document) : le contenu
éditorial est le point faible du projet, et **la relecture par un tiers des 73 tips et des 8 fiches
« Comprendre » bloque la publication** (`ETAT.md` §8, « Avant publication »). Décision de l'auteur, le
même jour : **ne plus montrer ce contenu**, épurer l'onglet jusqu'au lexique des gestes.

**Deux arbitrages de l'auteur, 2026-09-26 :**
1. **Retirer de l'écran, pas masquer derrière un interrupteur.** Les deux blocs et leurs composants
   sortent de `savoir.tsx`. ⚠️ C'est une **exception assumée** à la décision 2.c (« masquer, jamais
   supprimer ») : un cinquième interrupteur aurait exigé de lever le sceau du lot B (clause 1,
   « exactement quatre »). **Les données restent** : `catalog.db` garde ses tips et ses fiches, le
   chargeur les lit toujours — les rallumer est un lot d'écran, pas un chantier de contenu.
2. **L'onglet s'appelle « Gestes ».** ⛔ **Cela rouvre la décision 3** (`decisions/registre.md` : « c'est
   « Savoir », et ça le reste », fermée le 2026-08-07). ✅ **Reconfirmé par l'auteur le 2026-09-26** :
   la ligne 3 du registre est réécrite à la livraison.

**Ce que le lot gagne, et ce qu'il ne gagne pas.** Il retire de l'écran **tout** le contenu soumis à
relecture (73 tips, 8 fiches, 33 positions) : la relecture cesse d'être bloquante tant que ce contenu
n'est pas rallumé. ⛔ **Il ne ferme PAS les deux trous sanitaires** (céphalopodes, cuisson de l'œuf) :
ils portent sur les **recettes** (`SOURCES_RECETTES.md`), pas sur Savoir.

**Mesuré le 2026-09-26 sur `catalog.db` réel** (`app/public/catalog/catalog.db`) : `tip` **73**
lignes (texte le plus court : 156 caractères), `evidence_sheet` **8**, `evidence_position` **33**,
`evidence_source` **33**, `lexicon_entry` **62**, `lexicon_clip` **6**. Seul `ui/screens/savoir.tsx`
lit `catalogue.tips` et `catalogue.evidence` dans `app/src/ui` (grep du même jour).

#### Fini quand

Toutes les mesures se font sur l'écran monté avec **`catalog.db` réel** (`catalogueDeTest()`), jamais
sur une fixture. Aucun compte absolu du catalogue n'est scellé : les attendus se recalculent depuis la
base.

1. **Aucun texte des tips ni des fiches n'atteint l'écran, même après avoir tout touché.** Sur l'écran
   monté, puis après un clic sur **chaque** bouton hors de la liste des gestes et sur chaque geste
   dépliable : aucun `texte` de tip, aucun `titre`, `resume_vulgarise` ni `affirmation` de fiche n'est
   contenu dans `document.body.textContent` ; aucun lien ne pointe vers une `source_url` de tip ou
   une `url` de source de fiche ; il n'existe ni titre « Le saviez-vous ? » ni titre « Comprendre »,
   ni bouton « Fait suivant » / « Fait précédent », ni élément `[data-visite="preuve-forte"]`.
   *Faux si* : un bloc est caché par CSS, replié derrière un bouton, ou renommé.
2. **Aucun autre écran ne les reprend, et le code des deux blocs est effacé, pas mis en sommeil.**
   Aucun fichier non-test de `app/src/ui` ne contient, commentaires compris : le mot `tips` ni le
   mot `evidence` ; les types `Tip`, `TipCategorie`, `EvidenceSheet`, `EvidencePosition`,
   `EvidenceSource`, `EvidenceCategorie`, `NiveauPreuve`, `TypeEtude` ; les chaînes « Fait
   suivant », « Fait précédent », `preuve-forte`. *Faux si* : le carrousel est déplacé vers
   « Aujourd'hui » ou la fiche recette, ou les composants restent derrière un `false &&`.
   ⛔ **Premier tour d'attaque, 2026-09-26** : la première forme (`\.(?:tips|evidence)\b`) laissait
   passer `{false && <LeSaviezVous tips={[]} />}`, composants gardés morts — un masquage non
   déclaré, l'inverse de l'arbitrage 1. D'où la forme ci-dessus.
3. **Les données restent.** `catalogueDeTest().tips.length` égale `SELECT COUNT(*) FROM tip` et
   est > 0 ; `catalogueDeTest().evidence.size` égale `SELECT COUNT(*) FROM evidence_sheet` et est > 0.
   *Faux si* : le lot vide la table ou débranche le chargeur au lieu de l'écran.
4. **Le lexique est entier et cherchable.** Chaque `terme` du lexique réel est le texte d'un bouton
   de l'écran ; la ligne de compte dit `N gestes` avec `N = lexicon.size` ; taper le terme d'une entrée
   réduit le compte à un nombre ≥ 1 et < N, et cette entrée reste affichée.
5. **« Sources et limites » est intact** (principe 1 avant l'épure) : ses quatre paragraphes — CIQUAL
   2025, « ne remplace pas un professionnel de santé », « Ce qu'elle ne fait pas », « Tout reste sur
   cet appareil. » — sont à l'écran.
6. **L'onglet s'appelle « Gestes » partout où l'utilisateur le lit.** Le titre de niveau 1 de l'écran
   est exactement « Gestes » ; le lien de `Navigation` vers `hashDe('savoir')` a pour texte « Gestes »
   et aucun lien de la barre ne dit « Savoir » ; la fiche aliment ouverte avec `retour =
   hashDe('savoir')` affiche le retour « ← Gestes ».
7. **Le tutoriel ne parle plus de ce qui n'existe plus.** Le parcours `savoir` a pour titre « Gestes » ;
   **chaque** `cible` de ses étapes existe dans l'écran monté ; aucun `titre` ni `texte` d'aucune étape
   d'aucun parcours, ni aucun titre de parcours, ne contient le mot `Savoir` (mot entier, casse
   respectée — le verbe « savoir » reste permis). Chaque étape du parcours `savoir` a un texte de
   plus de 30 caractères, celui de l'ouverture contient « geste » ; toute étape qui mène à l'onglet
   s'intitule « Le coin Gestes » et dit, mot pour mot, le texte prescrit plus bas.
   ⛔ **Second tour d'attaque, 2026-09-26** : aucune clause ne lisait `texte` — trois étapes à
   `texte: 'x'` passaient tout. D'où la clause 7c.

#### Ce que le lot ne touche pas

- **Le catalogue** : ni YAML, ni `build.mjs`, ni `catalog.db`, ni `catalog-loader*.ts`, ni les types
  `Tip` / `EvidenceSheet` de `engine/domain`. **`engine/`** : rien.
- **Les identifiants internes** : l'onglet reste `'savoir'` dans `Onglet`, `ParcoursId`, le hash
  `#/savoir`, `data-visite="titre-savoir"` et le nom de fichier `savoir.tsx`. Renommer un identifiant
  ne change rien à ce que l'utilisateur lit et toucherait le routeur et une dizaine de tests.
- **Le sous-titre « Gestes de cuisine »** reste : c'est la **poignée** de `monterSavoir()` dans
  `tests/scelles/lot-B.test.tsx`. Un titre « Gestes » au-dessus d'un sous-titre « Gestes de cuisine »
  est une redite assumée.
- **Le titre de la première étape du parcours** (« Pour comprendre, pas pour décider à votre place »)
  reste : c'est la poignée `DERNIERE_OUVERTURE` de `tests/scelles/retour-1b.test.tsx`. Son texte
  peut changer.
- **`ui/epure.ts`** : les quatre interrupteurs restent quatre.
- **Aucun fichier scellé antérieur n'est modifié par le code.** ⛔ **SAUF UN CONFLIT CONNU, TRANCHÉ
  AVANT LE SCEAU** : `retour-1b` scellait `29` étapes pour le tutoriel composé, qui reprend les 5
  étapes du parcours `savoir`. En retirer deux (le carrousel et `preuve-forte`, dont les cibles
  disparaissent) donne **27**. ✅ **Option (a) retenue par l'auteur le 2026-09-26** : `retour-1b` est
  **rebasé à 27** pendant le brief, à ses deux assertions (« Étape 1 sur 27 », `etapes.length`) —
  même défaut de valeur absolue que les compteurs éteints par `retour-5c`. Il est donc **rouge
  jusqu'à la livraison du code**, comme les clauses du lot. L'option (b), deux étapes de remplissage
  pour tenir le compte, est écartée.
- **Les documents** (`DESIGN.md` §4.7, `ARCHITECTURE.md` §6.3, `ETAT.md`, `FICHE_REPRISE.md`,
  `decisions/registre.md` ligne 3) sont mis à jour à la livraison, par `/fin`.
- **Les types du moteur** (`Tip`, `EvidenceSheet`, `NiveauPreuve`…) restent dans
  `engine/domain/catalog.ts` : le chargeur les produit toujours. Seul `app/src/ui` doit les perdre.

#### Ce que le codeur n'a pas à deviner

- **L'en-tête de `savoir.tsx` est réécrit** : il annonce « quatre sections » et « 73 tips ». La
  clause 2 lit les commentaires et le fera rougir sinon.
- **Tout ce qui devient orphelin est effacé**, pas seulement ce que la clause 2 nomme : `domaine()`,
  `formaterDate()`, `estAReviser()`, `BadgePreuve`, `Chapitre`, `Position`, `Source`, `CATEGORIE`,
  `FAMILLES`, `NIVEAU_LIBELLE`, `TYPE_ETUDE_LIBELLE`, et les imports devenus inutiles.
  `tsconfig.json` n'active pas `noUnusedLocals` : rien d'autre ne le rattrapera. `CadreClip` et les
  clips du lexique **restent**.
- **Les étapes du tutoriel.** `ETAPES_SAVOIR` garde, dans cet ordre, l'ouverture (titre inchangé,
  texte réécrit pour parler des gestes), « Les gestes de cuisine », « D'où vient tout ça ». Dans
  `ETAPES_MENUS`, l'étape vers l'onglet devient : titre « Les gestes de cuisine » est déjà pris —
  donc **« Le coin Gestes »**, texte **« Touchez « Gestes » pour retrouver ce que veut dire un mot
  croisé dans une recette. »** (vouvoiement, une phrase, charte de `parcours.ts`). ⚠️ Relire
  `engine/guards/banned-terms.ts` avant toute reformulation : le lexique banni est une sous-chaîne.
- **Les tests NON scellés qui vont rougir ou perdre leur objet**, à réécrire dans le lot :
  `app/src/ui/screens/savoir.test.tsx` (carrousel, « Comprendre », filtre de preuve),
  `app/src/ui/parcours.test.tsx` (montage de l'écran, contenu soumis à §6), `app/src/ui/visite.test.tsx`
  (lien « Savoir » en dur dans son gabarit), et tout compte d'étapes qu'ils portent.

**Ce que l'attaque a vu et qui va en dette, pas dans le lot** (deux tours, 2026-09-26) : la clause 3
ne prouve qu'une cardinalité (un chargeur qui rendrait 73 tips vides passerait) ; l'ordre narratif
des trois étapes restantes n'est scellé par aucune clause ; la clause 2 est un grep, qu'une clé
calculée (`catalogue['ti' + 'ps']`) contourne — **triche délibérée**, classée comme telle par le
critique, hors de portée d'un grep ; les tests non scellés réécrits n'ont aucun critère minimal
d'assertion. Le fonctionnement orphelin résiduel sans mot interdit (`domaine()`…) est prescrit
ci-dessus, sans clause.

**Témoins d'avant** : relevés au lancement du brief, collés dans le compte rendu du 2026-09-26.

### Lot J — corrections rapides de la passe du 2026-09-30 — ✅ **LIVRÉ le 2026-09-30** (`94a2d8f`)

> ✅ **LIVRÉ LE 2026-09-30, COMMITÉ EN `94a2d8f`.** Scellé après deux tours d'attaque ; **17/17 verts**.
> Sceaux levés, chacun sur accord de l'auteur : `lot-A` clause 4 (au brief) et `lot-J` clause 6
> (pendant le codage, défaut du test — voir plus bas). `parametres.test.tsx` (non scellé) adapté :
> poignée « Voir l'aliment », petit-déjeuner listé à 3 repas.
> ⚠️ **Ce qu'aucun test ne démontre** : que le contenu qui défile ne passe plus sous l'heure, et
> que « Retour » de Paramètres est atteignable — jsdom ne rend pas le CSS, **à voir sur APK** ;
> les deux autres gabarits « Voir les N » (familles, « Mes exceptions ») sont corrigés mais non
> mesurés ; « Imprimer » reste inerte en natif (lot courses, export PDF demandé).

> **Brief ouvert le 2026-09-30.** Source : seconde passe à l'œil sur APK natif, retours verbatim
> dans `/srv/apk/retours-2026-09-30.md` (hors dépôt), captures du même jour. Arbitrages de l'auteur
> du même jour : Q2 « en natif, l'étape d'installation et le bandeau `non_persistant` disparaissent »
> — **oui** ; Q4 « retirer « Comment ça marche ? » des sept écrans, les tutoriels ne vivent plus que
> dans Paramètres » — **oui** ; « combien de repas par jour → par défaut 3 ».

#### Ce que les captures montrent, et ce que le code dit

| Observation | Cause mesurée |
|---|---|
| L'heure et la batterie s'impriment sur « ← Retour » et le titre de **chaque** fenêtre (« Le piquant », « Mon régime », « Aliments que je ne veux pas ») ; « le bouton retour de Paramètres est trop haut » | `ui/panneau.tsx` : l'en-tête collant de `Panneau` porte `py-2` et **aucune** réserve du haut. Le lot A n'a traité que les deux conteneurs de `ui/main.tsx` ; `Panneau` passe par un portail vers `document.body`, **hors** de ces conteneurs. |
| Page défilée : « Ce soir », « Comment ça marche ? » et « 3 sur 12 » passent **sous** l'heure | Bord à bord imposé (`targetSdk` 36) : la réserve du lot A **pousse** le contenu au chargement, mais rien d'opaque ne **couvre** la barre d'état quand la page défile. |
| « Installez l'application sur votre écran d'accueil » dans l'APK | `accueil.tsx` : `ETAPES` est une constante de module, sans cas natif. |
| « Ajoutez l'application à votre écran d'accueil pour ne rien perdre » peut s'afficher dans l'APK | `main.tsx` : `non_persistant` ne dépend que de `socle.persistant`. Dans une WebView, `navigator.storage.persist()` n'a pas de sens ; le conseil est inexécutable. |
| « Voir les 1 aliments » (Miel) | `parametres.tsx` : trois gabarits `Voir les ${n}…` sans cas singulier. |
| « Comment ça marche ? » jugé « chiant » sur chaque écran | `ui/lien-tutoriel.tsx`, monté par sept écrans. Les huit parcours restent dans Paramètres › Aide › « Revoir un tutoriel ». |

#### Fini quand

Écrans montés par la coquille réelle (`ui/main.js`) ou l'écran seul, avec **`catalog.db` réel**
(`catalogueDeTest()`). Le natif se simule en remplaçant **`Capacitor.isNativePlatform`** de
`@capacitor/core` — c'est **le seul signal natif** du code (`ui/notifications.ts`), le lot n'en
invente pas un second.

1. **Les fenêtres réservent la barre d'état.** L'en-tête collant de `Panneau` (le parent du bouton
   « Retour ») porte un jeton entier `pt-[max(env(safe-area-inset-top),<n>rem|px)]` de repli
   **≥ 0,5rem** (sa marge actuelle), **aucun autre** jeton qui pose un `padding-top` (`pt-`, `py-`,
   `p-`, variantes comprises), et reste `sticky top-0` sur un fond `bg-surface`.
   *Faux si* : `py-2` gardé à côté (deux `padding-top`, l'ordre de la feuille tranche) ; réserve
   posée sur le corps de la fenêtre au lieu de l'en-tête (le « Retour » reste sous l'heure) ; repli à 0.
2. **Un bandeau opaque couvre la barre d'état, sur les deux branches de la coquille.** Avant et après
   consentement, le DOM contient **un et un seul** élément `aria-hidden="true"` portant `fixed`,
   `inset-x-0`, `top-0`, `bg-fond`, un `z-` **strictement entre 10** (barre d'onglets) **et 50**
   (fenêtres, tutoriel), et le jeton `pt-[max(env(safe-area-inset-top),0px)]` — hauteur nulle sur un
   écran sans encoche. Il n'est l'ancêtre d'aucun contenu.
   *Faux si* : bandeau sous la barre d'onglets ou au-dessus des fenêtres ; présent sur une seule
   branche ; `h-[env(...)]` (forme que le lot A interdit).
3. **En natif, pas d'étape d'installation.** Natif simulé, accueil traversé : après « J'ai compris »,
   le titre suivant est « Des allergies ? » ; le titre « Installez l'application sur votre écran
   d'accueil » n'apparaît **à aucun moment** ; « Retour » depuis « Des allergies ? » ramène à
   l'engagement. **Témoin** : sans natif, l'étape est toujours là, entre les deux.
   *Faux si* : l'étape est retirée partout ; le natif est lu une fois au chargement du module (la
   clause monte deux fois, natif puis web, dans le même fichier).
4. **En natif, pas de bandeau `non_persistant`.** Socle `opfs`, `persistant: false`, verrou
   exclusif : natif simulé, le texte « ne garantit pas de les conserver » est absent de la coquille ;
   **témoin** : sans natif, il est présent. Les trois autres alertes ne changent pas (`memoire` reste
   affichée en natif — **témoin**).
5. **Trois repas par jour par défaut.** `RYTHME_PAR_DEFAUT.repasParJour === 3` ; accueil traversé
   sans toucher au rythme, `readRythme(db).repasParJour === 3`. *Faux si* : seul l'affichage change.
   Un profil **déjà enregistré** à 2 reste à 2 (**témoin** : `writeRythme` à 2, relu à 2).
6. **« Voir l'aliment » au singulier.** Paramètres › « Aliments que je ne veux pas », tous les groupes
   : un groupe de **1** aliment a pour bouton exactement « Voir l'aliment » ; un groupe de N > 1,
   « Voir les N aliments » (**témoin**). Nulle part dans l'écran, fenêtres ouvertes, le texte ne
   correspond à `/Voir les 1\b/`. Le groupe à un aliment se **cherche** dans le catalogue réel, il
   n'est pas écrit en dur ; s'il n'en existe aucun, la clause échoue au lieu de passer à vide.
7. **« Comment ça marche ? » a disparu des écrans, les tutoriels restent.** Aucun fichier non-test
   de `app/src` ne contient la chaîne `Comment ça marche` ni n'importe `lien-tutoriel` ; sur les cinq
   onglets montés par la coquille, le texte est absent. **Témoin** : Paramètres › « Revoir un
   tutoriel » liste **autant** de lignes que `PARCOURS.length`, et toucher la première lance son
   parcours (« Étape 1 sur » à l'écran).

#### Ce que le lot ne touche pas

- **`engine/`, le catalogue, `user-schema`** : rien. Pas de migration : un profil existant garde son
  nombre de repas.
- **« Imprimer » et les exports de la liste de courses**, inertes en natif : ils relèvent du lot
  courses (PDF, texte, partage — décision à prendre, et une dépendance `@capacitor/share` probable à
  signaler). Pas ici.
- **Le tutoriel lui-même** (bulle, « Précédent », étape 3 hors écran) : lot tutoriel, après F.
- **La semaine** (lot F), **le bouton retour Android** (lot D), **les valeurs nutritionnelles à
  l'écran** (lot de recentrage).
- **Aucune dépendance nouvelle** : `@capacitor/core` est déjà là.

⛔ **UN CONFLIT CONNU AVEC UN SCEAU, À TRANCHER AVANT LE SCEAU DE J.** `tests/scelles/lot-A.test.tsx`
clause 4 borne `safe-area-inset-top` à **2 occurrences** dans `app/src`. Les clauses 1 et 2 de J en
ajoutent **2** (`ui/panneau.tsx`, et le bandeau dans `ui/main.tsx`) : lot-A rougirait. Proposition :
lever le sceau de lot-A **pour la seule clause 4**, dont la borne devient « au plus 4, dans
`ui/main.tsx` et `ui/panneau.tsx` seulement, jamais dans `ui/screens/` » — l'esprit (la réserve ne
se disperse pas dans les écrans) est gardé. Les clauses 1 à 3 de lot-A ne changent pas, et les
nouveaux jetons en respectent la forme.
✅ **Tranché par l'auteur le 2026-09-30 : oui.** `lot-A` clause 4 est amendée pendant le brief (borne
4, fichiers limités à `ui/main.tsx` et `ui/panneau.tsx`). Même jour : **`ui/lien-tutoriel.tsx`
supprimé — oui** ; **« Imprimer » laissé tel quel** jusqu'au lot courses, qui **mettra en place
l'export PDF** (demande de l'auteur).

#### Ce que le codeur n'a pas à deviner

**Après le 1er tour d'attaque (2026-09-30)** — trois points qui étaient à deviner :
- le signal natif vit dans **`ui/natif.ts`** et nulle part ailleurs (`notifications.ts` l'importe) ;
  testé par la clause 3-4 bis, qui refuse aussi `getPlatform` et `window.Capacitor` ;
- le bandeau opaque porte **`z-40`** (au-dessus de la navigation `z-10`, sous `Panneau` et la visite `z-50`) ;
- « Imprimer » reste **visible et inerte en natif** jusqu'au lot courses ;
- `ui/lien-tutoriel.tsx` est **supprimé**, pas vidé : clause 7a bis.

**Après le 2e tour d'attaque (2026-09-30, dernier)** :
- un bouton de tutoriel réécrit en place dans Frigo ou l'éditeur (sous-vues que 7b ne visite pas)
  passait 7a → **clause 7a ter** : `useLancerParcours` n'est appelé que dans
  `ui/screens/parametres.tsx` (et défini dans `ui/lancer-parcours.tsx`) ;
- le bandeau opaque reste **inline dans `ui/main.tsx`** : l'extraire dans un troisième fichier ferait
  rougir `lot-A` clause 4 amendée ;
- le module natif s'appelle **`ui/natif.ts`**, exigé par la clause 3-4 bis ;
- les **trois** gabarits « Voir les N » de `parametres.tsx` suivent la même règle singulier/pluriel ;
  seul « Aliments que je ne veux pas » est mesuré — **limite déclarée**.

**Pendant le codage (2026-09-30)** — ⚠️ **clause 6 amendée sous sceau levé, choix A de l'auteur** :
le test comptait tout libellé « … (N) » comme un groupe, dont le titre « Ou parcourez les familles
(14) » — 14 familles valaient un faux groupe de 14. Il écarte désormais ce titre et « Vos retraits
(N) ». Le code n'a pas été plié au test. Sceau remis aussitôt.
- **Limite déclarée, non fermée** : la clause 6 lit le catalogue du jour ; un singulier écrit en dur
  par nom de groupe passerait tant que le catalogue ne bouge pas. Défilement réel, rotation et
  pliables ne se rejouent pas sous jsdom : vérification à l'œil sur APK.

- **Une seule fonction « natif ? »**, extraite de `ui/notifications.ts` (`enNatif`) vers un module de
  `ui/`, lue par `notifications.ts`, `accueil.tsx` et `main.tsx`. Lue **au rendu**, pas au chargement
  du module (`ETAPES` devient calculé).
- **`ui/lien-tutoriel.tsx` est supprimé** (confirmé par la validation de ce brief), avec ses sept
  montages et les commentaires qui le nomment (`main.tsx`, `parcours.ts`).
- **Les tests NON scellés à réécrire dans le lot** : les huit qui nomment `LienTutoriel` ou « Comment
  ça marche » (`parcours.test.tsx`, et les tests d'écran `aujourdhui`, `semaine`, `courses`,
  `recettes`, `frigo`, `savoir`, `editeur-recette`) ; `profil-enregistre.test.ts` (défaut à 2) ; tout
  test qui compte des créneaux en supposant 2 repas par défaut — **à attribuer par la sortie de
  vitest**, jamais par grep.
- **Les poignées** : « Comment ça marche ? » n'est lu par **aucun** test scellé (grep du
  2026-09-30). « Plus tard » et le titre de l'étape d'installation sont lus par lot-A et d'autres —
  ils restent, **en web**.
