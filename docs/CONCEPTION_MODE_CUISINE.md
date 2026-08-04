# Mode cuisine — plan de montée

> **Ce document ne contient pas la spec.** La spec vit dans `ARCHITECTURE.md` §5bis et fait foi.
> Ici : dans quel ordre coder, comment monter les deux prérequis, et à quoi on reconnaît que
> chacun est fini. Ouvert le 2026-08-04, après la fermeture de la décision 8 (`ETAT.md` §4).

Rappel du découpage tranché : **v1 = une recette à la fois** · **v1.5 = synchronisation
multi-recettes** · **le pilotage vocal est exclu, pas différé**.

---

## 1. Ce qui est déjà là, et ce qui manque

| Brique | État | Preuve |
|---|---|---|
| `recipe_step.timer_s` / `timer_type` | ✅ écrits, buildés, chargés | 512 étapes sur 1 118, dans 203 recettes sur 241 |
| `RecipeStep.timerS` côté app | ✅ chargé jusqu'en mémoire | `catalog-loader.ts:481-482` |
| Affichage d'un minuteur | ❌ **zéro** | `detail-recette.tsx:328` rend `texte` + gestes, rien d'autre |
| Gestes du lexique dépliés sur place | ✅ codé | `detail-recette.tsx:524-570` |
| Écran allumé | ❌ aucun appel `wakeLock` dans le dépôt | — |
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
| **L1** | **Écran mono-recette** : écran allumé, étape courante, minuteurs parallèles | L0 | code |
| **L2** | Prérequis A — `food_ids` sur 1 118 étapes, 3 passes du §2.4 | — (parallélisable avec L1) | contenu |
| **L3** | Quantité au tap sur un ingrédient de l'étape | L1 + L2 | code |
| **L4** | v1.5 — synchronisation multi-recettes, bascule de service | L1 | code |

### 4.1 Ce que touche L1

| Fichier | Rôle |
|---|---|
| `app/src/ui/ecran-allume.ts` *(nouveau)* | Wake Lock : demande, relâche, **re-demande sur `visibilitychange`**. Dégradation muette si l'API manque |
| `app/src/ui/screens/cuisine.tsx` *(nouveau)* | L'écran. Étape courante, minuteurs, navigation |
| `app/src/ui/screens/cuisine.test.tsx` *(nouveau)* | Voir §4.2 |
| `app/src/ui/navigation.tsx` | Route `#/cuisine/:recetteId` |
| `app/src/ui/screens/detail-recette.tsx` | Le bouton d'entrée dans le mode |
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

---

## 5. Ce qui reste ouvert

| # | Question | Piste |
|---|---|---|
| A | Un minuteur terminé pendant que l'app est en arrière-plan : notification, ou rien ? | `@capacitor/local-notifications` est installé mais `npx cap add android` n'a jamais été lancé (`ETAT.md` §4 n°9). Sur PWA pure, best-effort |
| B | Le mode cuisine garde-t-il l'étape atteinte si on quitte l'écran ? | Suppose une écriture dans `user_*`. Non tranché — L1 peut vivre sans |
| C | Entrée dans le mode : depuis la fiche recette seulement, ou aussi depuis « Aujourd'hui » ? | Depuis la fiche en L1. Le reste dépend de L4 |
| D | Le son du minuteur | Aucune décision. ⚠️ Un son qui se déclenche seul dans une appli sans compte et sans permission demandée n'est pas neutre |

---

**Maquette de référence pour L1** (chakchouka, minuteurs réels, Wake Lock actif) :
<https://claude.ai/code/artifact/00aae6df-f33d-4cb6-97cf-e11751419e0e> — hors dépôt, illustre la
spec sans la remplacer.
