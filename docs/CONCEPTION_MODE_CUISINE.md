# Mode cuisine — plan de montée

> **Ce document ne contient pas la spec.** La spec vit dans `ARCHITECTURE.md` §5bis et fait foi.
> Ici : dans quel ordre coder, comment monter les deux prérequis, et à quoi on reconnaît que
> chacun est fini. Ouvert le 2026-08-04, après la fermeture de la décision 8 (`ETAT.md` §4).

Rappel du découpage tranché : **v1 = une recette à la fois** · **v1.5 = synchronisation
multi-recettes** · **le pilotage vocal est exclu, pas différé** · **la v1 sonne au premier plan mais
pas en arrière-plan**, et la reprise remplace la notification (§5).

---

## 1. Ce qui est déjà là, et ce qui manque

| Brique | État | Preuve |
|---|---|---|
| `recipe_step.timer_s` / `timer_type` | ✅ écrits, buildés, chargés | 512 étapes sur 1 119, dans 203 recettes sur 241 |
| `RecipeStep.timerS` côté app | ✅ chargé jusqu'en mémoire | `catalog-loader.ts:481-482` |
| Gestes du lexique dépliés sur place | ✅ codé | `detail-recette.tsx` — **sur la fiche, pas en mode cuisine** |
| Affichage d'un minuteur | ✅ **fait le 2026-08-05** (L1) | `screens/cuisine.tsx` |
| Écran allumé | ✅ **fait** (L1) | `ui/ecran-allume.ts` |
| Alarme au premier plan | ✅ **fait** (L1) | `ui/alarme.ts` |
| Reprise d'une cuisson | ✅ **faite** (L1) | schéma **v10**, §4.0 · `ui/reprise-cuisine.tsx` |
| Notifications programmées | ✅ **mais calibrées pour les repas** | `notifications.ts:78` — `allowWhileIdle`, donc ±9 min en Doze : voir §5 |
| Lien étape → ingrédient | ❌ **n'existe pas** | prérequis A, §2 |
| Distinction geste / avertissement | ✅ **faite le 2026-08-05** (L0) | `recipe_step.nature`, §3 |

**Le fait structurant était : 512 minuteurs payés et invisibles.** C'est ce qui a justifié de livrer
l'écran avant les prérequis, et non l'inverse (§4). ✅ **Ils sont visibles depuis le 2026-08-05.**

---

## 2. Prérequis A — le lien étape → ingrédient

### 2.1 Pourquoi la dérivation automatique est écartée

Elle a été envisagée, et elle ne tient pas. `food` n'a **ni synonyme ni alias** (`build.mjs`, schéma
`food`) et le texte des étapes n'emploie pas les identifiants du catalogue. Sur la seule chakchouka :

| Texte de l'étape | Aliment visé | Rapprochement naïf |
|---|---|---|
| « les poivrons » | `poivron_rouge` | ❌ le nom complet n'apparaît jamais |
| « saler » | `sel_fin` | ❌ aucun substantif à rapprocher |
| « l'huile » | `huile_olive` | ⚠️ marche ici, ambigu dès qu'il y a deux huiles |
| « les tomates en dés » | `tomate` | ✅ au pluriel près |

Un rapprochement qui réussit sur la moitié des cas **produit un écran qui ment par omission** :
l'utilisateur appuie sur « poivrons », rien ne s'affiche, et rien n'indique que c'est un trou de
données plutôt qu'une absence de quantité. C'est le motif habituel du projet — une règle non
vérifiée au build n'est pas une règle.

### 2.2 La forme retenue : écrit, puis validé au build

Même régime que `lexicon_ids`, qui est **écrit à la main** dans le YAML et dont le build rouge sur un
identifiant inconnu (`build.mjs:531-535`).

```yaml
etapes:
  - ordre: 3
    texte: "Ajouter l'ail, le cumin et le paprika, remuer une minute, puis verser les tomates en dés et saler."
    lexicon_ids: [tailler_des]
    food_ids: [ail, cumin_graine, paprika, tomate, sel_fin]   # ← nouveau
    timer_s: 600
    timer_type: cuisson
```

```sql
CREATE TABLE recipe_step_ingredient (
  recipe_id TEXT NOT NULL,
  ordre     INTEGER NOT NULL,
  food_id   TEXT NOT NULL REFERENCES food(id),
  PRIMARY KEY (recipe_id, ordre, food_id),
  FOREIGN KEY (recipe_id, ordre) REFERENCES recipe_step(recipe_id, ordre)
);
```

**Trois règles de build, à poser à côté de la boucle `build.mjs:526-536` :**

1. `food_id` inconnu du catalogue → **build rouge**. Miroir exact de la règle `lexicon_ids`.
2. `food_id` **absent des `ingredients` de la recette** → **build rouge**. C'est la règle qui compte :
   elle garantit qu'une quantité est *toujours* résolvable depuis l'étape. Sans elle, l'écran peut
   citer un aliment dont il n'a pas l'`unite_affichage`.
3. Un ingrédient de la recette **cité par aucune étape** → **rien**, pas même un avertissement. Le
   sel, l'huile et le poivre échappent légitimement au fil des étapes ; en faire une erreur
   forcerait à mentir dans le YAML.

⚠️ **`food_ids` reste facultatif pendant la montée.** Une étape sans le champ n'offre pas de quantité
au tap — dégradation muette et acceptable. Le rendre obligatoire avant que les 241 recettes soient
faites rendrait le build rouge en permanence, donc inutile comme signal.

### 2.3 Le volume, sans l'arrondir

| Mesure | Valeur |
|---|---|
| Étapes, toutes natures | 1 119 |
| **Gestes à annoter** | **1 101** — les 18 avertissements n'ont pas d'ingrédient |
| Recettes | 241 (4,6 étapes en moyenne) |
| Ingrédients candidats par recette | **7,1 en moyenne** |

*(Relevé du 2026-08-05, `node catalog/build.mjs`. Le document annonçait 1 118 : une étape avait été
ajoutée depuis. Le build sort désormais le compte à chaque passage — plus de chiffre à recopier.)*

Le second chiffre est celui qui rend le travail faisable : annoter une étape, ce n'est pas écrire
des identifiants de mémoire, c'est **cocher dans une liste de sept**.

### 2.4 Méthode de montée, en trois passes

1. **Proposer** — un script d'atelier (`atelier/`, **hors du build**, jamais appelé par
   `catalog/build.mjs`) parcourt les recettes et écrit sous chaque étape un
   `# food_ids: [...]  # proposition` obtenu par rapprochement grossier, **suivi de la liste
   complète des ingrédients de la recette en commentaire**. Il ne décide rien : il pré-remplit.
2. **Relire** — recette par recette, un humain décommente, corrige, complète. C'est la seule passe
   qui coûte, et elle est interruptible : chaque recette relue est un gain acquis.
3. **Verrouiller** — quand le compteur atteint 241/241, `food_ids` passe d'optionnel à obligatoire
   et la règle 2 du §2.2 devient un filet permanent.

**Critère d'arrêt, vérifiable :** `node catalog/build.mjs` affiche `recipe_step_ingredient : N
lignes · X/241 recettes annotées` et sort en erreur sur toute violation des règles 1 et 2.

---

## 3. Prérequis B — l'étape qui n'est pas une étape ✅ FAIT (L0, 2026-08-05)

**18 recettes portaient une étape qui n'est pas un geste** : un avertissement sanitaire (ANSES sur
les œufs peu cuits, ministère de l'Agriculture sur les produits de la mer crus). Sur `chakchouka`, il
occupait l'étape 6 — la fiche annonçait « 6 » et promettait un geste alors que le plat est servi.

```sql
-- sur recipe_step
nature TEXT NOT NULL DEFAULT 'geste' CHECK (nature IN ('geste', 'avertissement'))
```

**Deux règles rouges au build**, et la seconde est la moins évidente :

1. `nature` hors du vocabulaire fermé → build rouge.
2. **Un avertissement ailleurs qu'en DERNIÈRE position → build rouge.** Un avertissement au milieu
   passerait tout contrôle de forme, puis ferait annoncer au mode cuisine un nombre d'étapes juste
   pour un déroulé faux. La règle porte sur la position, pas sur `ordre`.

Le champ est **facultatif en YAML** : absent = `geste`, ce qui est le cas de 223 recettes. Le rendre
obligatoire n'aurait rien ajouté qu'un bruit sur 1 101 lignes.

Conséquences côté écrans :

- Le compteur et les jalons ne comptent **que** les `nature = 'geste'` — chakchouka fait 5 étapes.
- L'avertissement s'affiche **après** la dernière étape, dans son propre bloc (jetons `alerte-*`),
  et jamais comme une chose à faire.
- ✅ **`detail-recette.tsx` continue de l'afficher** : il n'a pas disparu de la fiche recette, il a
  changé de statut. Verrouillé par un test sur `chakchouka` — 5 `<li>` numérotés, et la mention
  présente mais hors de tout `<ol>`.

Coût réel : le champ, 18 lignes de YAML, la chaîne de lecture (`StepNature` → `catalog-loader` →
`user-recipe`), et 5 tests.

---

## 4. Ordre des lots

L'ordre suit une règle : **livrer ce qui est utile seul avant ce qui coûte cher.** L1 rend visibles
512 minuteurs sans dépendre du prérequis A et de ses 1 101 annotations.

| Lot | Contenu | Dépend de | Nature |
|---|---|---|---|
| ~~**L0**~~ | ✅ **Fait le 2026-08-05** — prérequis B, `recipe_step.nature`, 18 recettes marquées | — | schéma + contenu |
| ~~**L1**~~ | ✅ **Fait le 2026-08-05** — écran mono-recette : écran allumé, étape courante, minuteurs parallèles, alarme au premier plan, reprise (schéma **v10** + bandeau) | L0 | code |
| **L2** | Prérequis A — `food_ids` sur 1 101 gestes, 3 passes du §2.4 | — (parallélisable avec L1) | contenu |
| **L3** | Quantité au tap sur un ingrédient de l'étape | L1 + L2 | code |
| **L4** | v1.5 — synchronisation multi-recettes, bascule de service | L1 | code |

### 4.0 Le schéma v10 — reprise et minuteurs ✅ ÉCRIT

⚠️ **CE PARAGRAPHE ANNONÇAIT UNE « v9 ». C'EST UNE v10.** Entre la rédaction du plan et son
exécution, une autre piste a pris la v9 pour les plats préparés (décision 51, le même jour). La
règle de v2 ne fait pas d'exception d'ancienneté : deux migrations portant le même numéro seraient
exactement la perte de données que `user-schema.ts` existe pour empêcher.

```sql
CREATE TABLE user_cuisine_session (
  id            INTEGER PRIMARY KEY CHECK (id = 1),  -- une seule session : la v1 est mono-recette
  recette_id    TEXT NOT NULL,
  ordre_courant INTEGER NOT NULL CHECK (ordre_courant >= 1),
  ouverte_le    INTEGER NOT NULL                     -- ms epoch, pour périmer une session oubliée
);

CREATE TABLE user_cuisine_timer (
  session_id      INTEGER NOT NULL DEFAULT 1
                    REFERENCES user_cuisine_session(id) ON DELETE CASCADE,
  ordre           INTEGER NOT NULL CHECK (ordre >= 1),
  fin_ms          INTEGER,              -- ÉCHÉANCE ABSOLUE, jamais un « restant » (§5bis point 7)
  pause_restant_s INTEGER CHECK (pause_restant_s IS NULL OR pause_restant_s >= 0),
  CHECK ((fin_ms IS NOT NULL AND pause_restant_s IS NULL)
      OR (fin_ms IS NULL AND pause_restant_s IS NOT NULL)),
  PRIMARY KEY (session_id, ordre)
);
```

- **`id = 1`** — même forme que `user_profile` et `user_rythme` : une ligne, pas une collection. La
  v1.5 fera sauter cette contrainte, pas avant.
- ⚠️ **Le `CHECK` d'exclusion est un ÉCART VOLONTAIRE au plan.** L'esquisse ci-dessus portait
  `fin_ms NOT NULL` et faisait de `pause_restant_s` le seul discriminant : une ligne en pause y
  aurait gardé une **échéance périmée, lisible par erreur**. Les deux colonnes sont donc nullables
  et mutuellement exclusives — en marche il n'existe qu'une échéance, en pause qu'un reste. La
  garantie vient de la forme (acquis n°2), comme `hors_catalogue` en v9.
- ⚠️ **`INSERT … ON CONFLICT DO UPDATE`, jamais `INSERT OR REPLACE`** — la session a des minuteurs
  enfants, c'est le piège déjà payé (`reference/PIEGES.md`). Verrouillé par un test qui réécrit la
  session et vérifie que ses minuteurs sont toujours là.
- **Péremption : 12 h.** Le bandeau affiche l'ancienneté (« commencée il y a 2 h ») et se referme
  seul au-delà. ⚠️ Seuil arbitraire, posé faute de mieux — à revoir au premier retour d'usage.

### 4.1 Ce qu'a touché L1 (relevé après coup)

| Fichier | Rôle |
|---|---|
| `app/src/data/user-schema.ts` | La migration **v10** ci-dessus, `USER_SCHEMA_VERSION` 9 → 10 |
| `app/src/data/user-store.ts` | `readCuisineSession` / `writeCuisineSession` / `clearCuisineSession` |
| `app/src/ui/cuisine-session.ts` *(nouveau, non prévu)* | **La logique pure du point 7** : état d'un minuteur, péremption, libellés. Extraite de l'écran pour être testable sans DOM — c'est le seul code du mode dont l'erreur porterait sur de la nourriture |
| `app/src/ui/ecran-allume.ts` *(nouveau)* | Wake Lock : demande, relâche, **re-demande sur `visibilitychange`**. Dégradation muette si l'API manque |
| `app/src/ui/alarme.ts` *(nouveau)* | Son + vibration + arrêt automatique. **Déverrouille l'audio sur l'appui « Lancer »**, pas à l'expiration. **Aucun rendu** : le signal visuel appartient à l'écran |
| `app/src/ui/reprise-cuisine.tsx` *(nouveau, non prévu)* | Le bandeau, sorti d'`aujourdhui.tsx` pour que cet écran ne bouge que de deux lignes |
| `app/src/ui/screens/cuisine.tsx` *(nouveau)* | L'écran. Étape courante, minuteurs, navigation |
| `app/src/ui/theme.css` | L'animation d'inversion, avec son `prefers-reduced-motion` |
| `app/src/ui/router.tsx` | Route `#/cuisine/<id>` — ⚠️ **troisième route paramétrée**, voir ci-dessous |
| `app/src/ui/main.tsx` | Le branchement de la sous-vue |
| `app/src/ui/screens/detail-recette.tsx` | Le bouton « Cuisiner pas à pas », sous « Préparation » |
| `app/src/ui/screens/aujourdhui.tsx` | Le bandeau « Reprendre la cuisson », **avant le titre** |

⚠️ **`parcours.ts` n'a PAS été touché** — le plan prévoyait une entrée de visite guidée. Elle n'a pas
été faite : la visite guidée présente des écrans qu'on atteint depuis la barre d'onglets, et le mode
cuisine s'ouvre depuis une fiche recette. À trancher, pas à oublier.

⚠️ **La question de la bibliothèque de routage a été ROUVERTE, comme `router.tsx` l'exigeait au
troisième cas paramétré. Réponse : toujours non**, et le raisonnement est écrit dans le fichier
plutôt que laissé à refaire. Ce qui la rouvrirait vraiment : une route qui en imbrique une autre.

⚠️ **Rien dans `engine/`.** Le mode cuisine ne calcule rien ; si un lot demande d'y toucher, c'est le
lot qui est faux. Vérifié : L1 n'a ajouté aucun import dans `engine/`.

### 4.2 Les tests qui font foi pour L1 — ✅ les huit sont écrits et verts

Ils encodent les décisions plutôt que le rendu. Où ils vivent : **`screens/cuisine.test.tsx`** (17),
**`cuisine-session.test.ts`** (15, purs, sans DOM), **`reprise-cuisine.test.tsx`** (10, purs),
**`alarme.test.ts`** (8), **`user-store.test.ts`** (+8 sur la v10), **`router.test.ts`** (+4).

1. **Les étapes n'avancent jamais seules** — avancer les faux timers de vitest de plusieurs minutes
   laisse l'étape courante inchangée. C'est le test qui verrouille le point 2 de §5bis contre une
   régression bien intentionnée.
2. **Un minuteur survit au changement d'étape** — lancer à l'étape 2, aller en 4, le décompte est
   toujours là et étiqueté « étape 2 ».
3. **Plusieurs décomptes coexistent** — deux minuteurs lancés, deux décomptes distincts.
4. **Le compteur ignore les avertissements** — chakchouka annonce 5 étapes, pas 6, et la mention
   ANSES n'apparaît qu'à la dernière.
5. **L'absence de Wake Lock ne casse rien** — `navigator.wakeLock` absent : l'écran fonctionne, seule
   la mention change.
6. **Aucun score affiché** — filet du principe 6, comme sur les autres écrans.
7. **Une session reprise dit la vérité** — écrire `fin_ms` dans le passé, rouvrir : l'écran annonce
   « terminé il y a N min », jamais un décompte figé ni « ça vient de sonner ». **C'est le test qui
   verrouille le point 7 de §5bis**, et le seul qui porte sur une affirmation de l'appli à propos de
   la nourriture.
8. **Une session périmée ne réapparaît pas** — `ouverte_le` à plus de 12 h : pas de bandeau.

**Un neuvième s'est ajouté à l'écriture, et il n'était pas dans le plan :** ⛔ **l'alarme ne sonne
PAS pour un minuteur déjà échu à l'ouverture.** Sans ce garde-fou, reprendre une cuisson déclenche
la sonnerie pour un plat sorti du feu depuis quarante minutes — le mensonge du point 7 retourné en
son contraire sonore. Le code le tient par un `Set` des minuteurs échus au montage.

⚠️ **Le déverrouillage audio n'est PAS testable en Vitest.** `jsdom` n'implémente pas la politique
d'autoplay : un test vert ne prouverait rien. C'est un **point de vérification manuelle sur
appareil**, à faire en même temps que le Wake Lock en WebView et le pari sur `rem` (risque n°1 de la
décision 9). Les trois se testent dans la même session, sur le même téléphone.

---

## 5. L'alarme en arrière-plan — les quatre voies, vérifiées et refusées

**Tranché le 2026-08-04 : la v1 ne sonne pas quand l'appli n'est pas visible.** Ce paragraphe existe
pour que la question ne se re-débatte pas à l'aveugle : les quatre voies ont été instruites, chacune
coûte plus qu'elle ne rapporte **à ce stade**. Aucune n'est enterrée.

Le problème, en une phrase : un minuteur de cuisine doit sonner à la seconde pendant que le téléphone
dort, et **« posé, immobile, écran éteint » est la définition même du mode Doze**, qu'Android a
conçu pour supprimer exactement ces réveils. Le cas d'usage est le cas d'école que le système
combat.

| Voie | Ce qu'elle coûte | Verdict |
|---|---|---|
| `allowWhileIdle` — **déjà en place** (`notifications.ts:78`) | En Doze, **une notification toutes les 9 min par appli**. Correct pour un rappel de repas à ±10 min, inutilisable pour 8 min de pochage | Insuffisant |
| `SCHEDULE_EXACT_ALARM` | ⚠️ **Ce n'est pas une fenêtre d'autorisation.** Aucun « Autoriser / Refuser » : l'appli ne peut que projeter l'utilisateur dans `Paramètres › Applis › Accès spécial › Alarmes et rappels`, où il doit trouver l'appli, basculer un interrupteur et revenir seul. Pour un public « toutes tranches d'âge », c'est disqualifiant | Refusée |
| `USE_EXACT_ALARM` | Aucune friction, accordée à l'installation. Mais réservée aux applis d'agenda et de réveil, et **Play refuse la publication** hors de ces catégories. La politique nomme bien « alarm or timer app » — le test est « **core, user facing functionality** », et notre fiche Play dira « nutrition ». Le refus tombe **à la soumission, après tout le travail** | Pari, non joué |
| Service de premier plan | **Aucun `foregroundServiceType` ne convient** : `shortService` plafonne à ~3 min, tous les autres sont caméra / position / média / santé. Reste `specialUse` → déclaration en Play Console avec **lien vidéo démontrant la fonctionnalité**, re-jugée **à chaque mise à jour**. Et le plugin Capacitor existe mais est **Sponsorware** (payant), annoncé pour Capacitor 4 quand le projet est en 8 | Refusée |

⚠️ **Les Live Updates d'Android 16 ne sauvent pas la quatrième voie.** Elles sont l'équivalent des
Live Activities d'iOS, mais *« the work behind Live Updates typically runs in a foreground service on
Android 14+ … they remain complementary technologies »* : c'est **l'affichage, pas le moteur**. Ni le
`foregroundServiceType` ni la déclaration Play ne disparaissent.

**Ce qui remplace l'alarme :** le point 7 de §5bis. On ne sonne pas, mais au retour on ne ment pas.
Le pari `USE_EXACT_ALARM` reste rejouable — c'est une ligne de manifeste, pas une réécriture.

## 6. Ce que font les autres applis

| Appli | Écran allumé | Sonne appli fermée |
|---|---|---|
| Applis **de minuteur** (Cooking Timer, Kitchen Timer Pro) | — | ✅ — elles ont droit à `USE_EXACT_ALARM`, leur fiche Play dit « minuteur ». **Pas un précédent utilisable** |
| Kitchen Stories | ✅ mode « start cooking » plein écran qui empêche la veille | ❌ |
| **Nous (v1)** | ✅ | ❌ — remplacé par la reprise |
| Paprika (natif, payant) | ✅ réglage « Keep Screen On » | ✅ *« Timers will fire and play a sound even if the app is not open »* |

⚠️ **Le manque face à Paprika est réel et assumé.** Détail révélateur : sa page d'aide ne demande à
l'utilisateur de toucher **aucun** réglage système — donc elle ne passe pas par
`SCHEDULE_EXACT_ALARM`. Reste `USE_EXACT_ALARM` ou l'imprécision assumée. **Déduction, pas preuve :
son manifeste n'a pas été lu.** Et c'est une appli native payante, sans aucune de nos contraintes.

## 7. Essai sur appareil — 2026-08-05

**Environnement : Chrome Android, PAS la WebView applicative.** L'instrument est la maquette
(§5bis), ouverte en HTTPS. ⚠️ Servir le `dist/` sur `http://192.168.x.x` aurait faussé l'essai :
`navigator.wakeLock` n'existe pas hors contexte sécurisé, et l'échec aurait eu l'air d'un défaut
de l'API.

| Ce qui a été mesuré | Résultat |
|---|---|
| **Déverrouillage audio sur le geste** | ✅ **Validé.** Le son sort, et un contexte déverrouillé le reste — il sonne encore plusieurs minutes après l'appui. C'était le point le plus fragile de la spec |
| **Signal visuel** | ✅ **Inversion retenue**, contre cadre, bandes latérales, plein écran et balayage. Protocole : téléphone posé de côté, regard fixé devant — de face, les cinq marchent, ce qui rend un essai de face inutile |
| **Arrêt sur appui n'importe où** | ✅ Validé |
| **Vibration** | ❌ **Rien**, ni immédiatement ni en différé. Ce n'est donc pas l'expiration de l'activation utilisateur, qui était l'hypothèse. Probablement le navigateur ou l'appareil ; à rejouer dans l'appli installée, où `@capacitor/haptics` serait de toute façon la bonne voie — **plugin non installé, à flaguer avant** |
| **Le pari `rem` à 150 %** | ⚠️ **NON MESURÉ.** Un premier essai n'a rien montré, mais l'instrument était en cause : il visait la taille de police d'Android alors que **Chrome a sa propre mise à l'échelle du texte** (⋮ → Paramètres → Accessibilité), et un `text-size-adjust: 100%` dans un reset l'aurait de toute façon neutralisée. La sonde a été corrigée — la mesure reste à refaire. **Ne pas conclure dans un sens ni dans l'autre** |

### Ce que cet essai ne prouve pas

Il tourne dans Chrome. Le **risque n°1 de la décision 9** porte exactement sur l'écart entre Chrome
et une WebView applicative, et il reste entier. Trois choses sont à rejouer sur un APK :

1. Le Wake Lock dans la WebView.
2. La vibration par `@capacitor/haptics` plutôt que par l'API web.
3. **Le pari `rem`** — le seul dont l'échec déborderait très au-delà du mode cuisine, puisque les
   neuf écrans reposent dessus.

⚠️ **Depuis L1 (2026-08-05), l'instrument n'est plus la maquette : c'est l'écran réel.** Le prochain
essai doit se faire sur `#/cuisine/chakchouka` dans un build servi **en HTTPS** — en `http://`,
`navigator.wakeLock` n'existe pas et l'échec ressemblera à un défaut de l'appareil. Ce qui reste à
constater de visu, et qu'aucun test ne peut donner : **le son sort au premier appui sur « Lancer le
minuteur »** (politique d'autoplay), **l'écran ne s'éteint pas**, et **l'inversion se voit du coin
de l'œil** avec le téléphone posé de côté.

⚠️ **Obstacles connus à cet essai-là** : le SDK Android n'est pas installé, `npx cap add android`
n'a jamais été lancé, et le **JDK 25** de la machine est vraisemblablement trop récent pour le
Gradle de Capacitor 8, qui attend du 17 ou du 21.

## 8. Ce qui reste ouvert

| # | Question | Piste |
|---|---|---|
| C | Entrée dans le mode depuis « Aujourd'hui » **autrement que pour reprendre** | Le bandeau de reprise couvre le retour ; démarrer une cuisson depuis l'accueil dépend de L4 |
| D | Le seuil de péremption du bandeau (12 h) | Arbitraire, posé faute de mieux. À revoir au premier retour d'usage |
| E | Cuisine partagée **sur plusieurs appareils** | ⚠️ **Pas interdit par le principe 2** — le partage `.nutri-recipe` fait déjà sortir des données à l'initiative de l'utilisateur. Bloqué par le coût : plugin Bluetooth natif, permissions à l'exécution, état distribué (qui gagne si deux personnes avancent l'étape ?). Et un téléphone posé au milieu absorbe l'essentiel du besoin. **v2** |

---

⚠️ **PÉRIMÉE DEPUIS L1.** La maquette qui a servi à trancher le signal visuel et à valider l'audio
(chakchouka, minuteurs réels, Wake Lock actif) vivait hors dépôt :
<https://claude.ai/code/artifact/00aae6df-f33d-4cb6-97cf-e11751419e0e>. **Elle n'est plus la
référence de rien** — l'écran réel existe (`ui/screens/cuisine.tsx`) et c'est lui qu'il faut essayer
sur appareil. Le lien est conservé parce que le récit de l'essai du 2026-08-05 (§7) s'y rapporte ;
il n'a aucune autorité sur le code.
