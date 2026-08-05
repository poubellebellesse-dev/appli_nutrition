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
| `recipe_step.timer_s` / `timer_type` | ✅ écrits, buildés, chargés | 512 étapes sur 1 118, dans 203 recettes sur 241 |
| `RecipeStep.timerS` côté app | ✅ chargé jusqu'en mémoire | `catalog-loader.ts:481-482` |
| Affichage d'un minuteur | ❌ **zéro** | `detail-recette.tsx:328` rend `texte` + gestes, rien d'autre |
| Gestes du lexique dépliés sur place | ✅ codé | `detail-recette.tsx:524-570` |
| Écran allumé | ❌ aucun appel `wakeLock` dans le dépôt | — |
| Alarme au premier plan | ❌ aucun son, aucune vibration | — |
| Reprise d'une cuisson | ❌ rien en base | schéma **v9** à écrire, §4.0 |
| Notifications programmées | ✅ **mais calibrées pour les repas** | `notifications.ts:78` — `allowWhileIdle`, donc ±9 min en Doze : voir §5 |
| Lien étape → ingrédient | ❌ **n'existe pas** | prérequis A, §2 |
| Distinction geste / avertissement | ❌ **n'existe pas** | prérequis B, §3 |

**Le fait structurant : 512 minuteurs sont payés et invisibles.** C'est ce qui justifie de livrer
l'écran avant les prérequis, et non l'inverse (§4).

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
| Étapes à annoter | **1 118** |
| Recettes | 241 (4,6 étapes en moyenne) |
| Ingrédients candidats par recette | **7,1 en moyenne** |

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

## 3. Prérequis B — l'étape qui n'est pas une étape

**18 recettes portent une étape qui n'est pas un geste** : un avertissement sanitaire (ANSES sur les
œufs peu cuits, déconseillés à certains publics). Sur `chakchouka`, il occupe l'étape 6 — le mode
cuisine annonce donc « 6 sur 6 » et promet un geste alors que le plat est déjà servi.

```sql
-- sur recipe_step
nature TEXT NOT NULL DEFAULT 'geste' CHECK (nature IN ('geste', 'avertissement'))
```

Conséquences, toutes portées par l'UI :

- Le compteur et les jalons ne comptent **que** les `nature = 'geste'` — chakchouka devient « 5 étapes ».
- L'avertissement s'affiche **après** la dernière étape, dans son propre bloc (jetons `alerte-*`,
  déjà définis dans `theme.css`), et jamais comme une chose à faire.
- ⚠️ **`detail-recette.tsx` doit continuer à l'afficher** : l'avertissement ne disparaît pas de la
  fiche recette, il change seulement de statut.

Coût : un champ, une valeur par défaut, **18 lignes de YAML**. C'est le prérequis le moins cher et
celui qui rend le compteur honnête — donc le premier.

---

## 4. Ordre des lots

L'ordre suit une règle : **livrer ce qui est utile seul avant ce qui coûte cher.** L1 rend visibles
512 minuteurs sans dépendre du prérequis A et de ses 1 118 annotations.

| Lot | Contenu | Dépend de | Nature |
|---|---|---|---|
| **L0** | Prérequis B — `recipe_step.nature`, 18 recettes marquées | — | schéma + contenu |
| **L1** | **Écran mono-recette** : écran allumé, étape courante, minuteurs parallèles, **alarme au premier plan**, **reprise (schéma v9 + bandeau)** | L0 | code |
| **L2** | Prérequis A — `food_ids` sur 1 118 étapes, 3 passes du §2.4 | — (parallélisable avec L1) | contenu |
| **L3** | Quantité au tap sur un ingrédient de l'étape | L1 + L2 | code |
| **L4** | v1.5 — synchronisation multi-recettes, bascule de service | L1 | code |

### 4.0 Le schéma v9 — reprise et minuteurs

`USER_SCHEMA_VERSION` est à **8**. La reprise est une **v9**, migration à part entière (la règle
posée en v2 ne fait pas d'exception d'ancienneté).

```sql
CREATE TABLE user_cuisine_session (
  id            INTEGER PRIMARY KEY CHECK (id = 1),  -- une seule session : la v1 est mono-recette
  recette_id    TEXT NOT NULL,
  ordre_courant INTEGER NOT NULL,
  ouverte_le    INTEGER NOT NULL                     -- ms epoch, pour périmer une session oubliée
);

CREATE TABLE user_cuisine_timer (
  ordre           INTEGER PRIMARY KEY,  -- l'étape qui porte le minuteur
  fin_ms          INTEGER NOT NULL,     -- ÉCHÉANCE ABSOLUE, jamais un « restant » (§5bis point 7)
  pause_restant_s INTEGER               -- NULL = en marche ; sinon en pause avec ce reste
);
```

- **`id = 1`** — même forme que `user_profile` et `user_rythme` : une ligne, pas une collection. La
  v1.5 fera sauter cette contrainte, pas avant.
- **`pause_restant_s` nullable est le discriminant.** En marche, il n'existe qu'une heure de fin ;
  en pause, il n'existe qu'un reste. Deux régimes, une table, aucun état impossible.
- ⚠️ **`INSERT … ON CONFLICT DO UPDATE`, jamais `INSERT OR REPLACE`** — la session a des minuteurs
  enfants, c'est le piège déjà payé (`reference/PIEGES.md`).
- **Péremption : 12 h.** Le bandeau affiche l'ancienneté (« commencée il y a 2 h ») et se referme
  seul au-delà. ⚠️ Seuil arbitraire, posé faute de mieux — à revoir au premier retour d'usage.

### 4.1 Ce que touche L1

| Fichier | Rôle |
|---|---|
| `app/src/data/user-schema.ts` | La migration **v9** ci-dessus, `USER_SCHEMA_VERSION` 8 → 9 |
| `app/src/data/user-store.ts` | Lire / écrire la session et ses minuteurs |
| `app/src/ui/ecran-allume.ts` *(nouveau)* | Wake Lock : demande, relâche, **re-demande sur `visibilitychange`**. Dégradation muette si l'API manque |
| `app/src/ui/alarme.ts` *(nouveau)* | Son + vibration + signal visuel. **Déverrouille l'audio sur l'appui « Lancer »**, pas à l'expiration |
| `app/src/ui/screens/cuisine.tsx` *(nouveau)* | L'écran. Étape courante, minuteurs, navigation |
| `app/src/ui/screens/cuisine.test.tsx` *(nouveau)* | Voir §4.2 |
| `app/src/ui/navigation.tsx` | Route `#/cuisine/:recetteId` |
| `app/src/ui/screens/detail-recette.tsx` | Le bouton d'entrée dans le mode |
| `app/src/ui/screens/aujourdhui.tsx` | Le bandeau « Reprendre la cuisson » |
| `app/src/ui/parcours.ts` | Une entrée de visite guidée, comme les 9 écrans existants |

⚠️ **Rien dans `engine/`.** Le mode cuisine ne calcule rien ; si un lot demande d'y toucher, c'est le
lot qui est faux.

### 4.2 Les tests qui font foi pour L1

Écrits **avant** l'écran, ils encodent les décisions plutôt que le rendu :

1. **Les étapes n'avancent jamais seules** — avancer les faux timers de vitest de plusieurs minutes
   laisse l'étape courante inchangée. C'est le test qui verrouille le point 2 de §5bis contre une
   régression bien intentionnée.
2. **Un minuteur survit au changement d'étape** — lancer à l'étape 2, aller en 4, le décompte est
   toujours là et étiqueté « étape 2 ».
3. **Plusieurs décomptes coexistent** — deux minuteurs lancés, deux décomptes distincts.
4. **Le compteur ignore les avertissements** — chakchouka annonce 5 étapes, pas 6 (dépend de L0).
5. **L'absence de Wake Lock ne casse rien** — `navigator.wakeLock` absent : l'écran fonctionne, seule
   la mention change.
6. **Aucun score affiché** — filet du principe 6, comme sur les autres écrans.
7. **Une session reprise dit la vérité** — écrire `fin_ms` dans le passé, rouvrir : l'écran annonce
   « terminé il y a N min », jamais un décompte figé ni « ça vient de sonner ». **C'est le test qui
   verrouille le point 7 de §5bis**, et le seul qui porte sur une affirmation de l'appli à propos de
   la nourriture.
8. **Une session périmée ne réapparaît pas** — `ouverte_le` à plus de 12 h : pas de bandeau.

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

**Maquette de référence pour L1** (chakchouka, minuteurs réels, Wake Lock actif) :
<https://claude.ai/code/artifact/00aae6df-f33d-4cb6-97cf-e11751419e0e> — hors dépôt, illustre la
spec sans la remplacer.
