# ⭐ Fiche de reprise — appli_nutrition

> **À lire en premier.** État condensé + prochaines étapes. Pour le détail : `ETAT.md` (état
> complet), `RECAP_SESSION_2.md` (récit de la session 2), `ENGINE.md` / `ARCHITECTURE.md`
> (spécification, font foi), `CONCEPTION_B_VIN_REPAS.md` (chantier vin + modes repas).
> Dernière mise à jour : **2026-07-25** (P1b-2 clôturée).

---

## En une ligne

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur en TypeScript pur, catalogue
SQLite construit au build. On code le moteur en ligne de commande **avant toute UI** (P3).

## Où on en est

Tout ce qui suit est **committé** — la session 3 a d'abord vidé la dette de commits laissée par la
session 2, livré trois lots, puis codé et committé la tranche **P1b-2** par-dessus (6 commits).

| Livré | Contenu |
|---|---|
| **P0** ✅ · **P1a** ✅ | Fondations, chaîne de build, 4 couches d'exclusion initiales |
| **P1b-1** ✅ | Schéma saison/staple · index dérivés à l'init du moteur · 7 fonctions de score · `NEUTRAL_SCORE = 0.5` |
| **Contenu** ✅ | Catalogue de test porté à **76 aliments** (fromages, poissons, fruits de mer, alcools de cuisine) |
| **Couche `exclusions`** ✅ | Rejet personnel d'aliments (`excludedFoodIds`) |
| **Rang 0** ✅ | Origine `choisi`/`reste` sur `MealHistoryEntry` + `CourseKind` + `MealPlanEntry.service` — faits **pendant que `user.db` est vide**, donc gratuits |
| **`variety` TAU** ✅ | Vitesse d'oubli réglable à trois crans (3 / 7 / 14 j, défaut 7) |
| **Couche `requis`** ✅ | Miroir dur de `exclusions` — « je veux ça », conjonctif |
| **P1b-2** ✅ | Passe de score pondérée (`runScoringPass`) · `SuggestionRequest.preferences` (OBLIGATOIRE, −2…+2) · `nutrient.sens` (`scoreNutri` désormais asymétrique) · `computeEnergyNeeds` (`Kcal \| null`) / `resolveReferenceIntakes` (deux modes) réels · 6 archétypes codés, noms validés · `speed` en 17ᵉ couche du registre · bascule dynamique de `craving` · second garde-fou `assertScoringLayersNeverExclude` (+ extension de `PipelineTrace`) · `createEngine` réel · banc CLI `engine:try` |

**Le registre est passé à 17 couches** (6 exclusion + 11 score). Ordre de motif :
`allergenes` 🔒 → `regime` 🔒 → `exclusions` → `requis` → `temps` → `equipement`.

**État vérifié : `npm test` → 303 verts (29 fichiers) · `npm run typecheck` propre · `npm run build`
→ 76 aliments, 10 recettes.**

> ⚠️ Vérifier `git status -sb` en début de session : les derniers commits peuvent ne pas être
> poussés. Modèle en vigueur — **Claude committe, l'utilisateur pousse** (le shell agent ne peut pas
> s'authentifier auprès de GitHub).

## Acquis à ne pas défaire

1. **L'asymétrie `habit` / `variety`.** `habit` ne compte que les entrées d'origine `choisi` — un
   reste mangé n'est pas une préférence exprimée. `variety` lit **toutes** les origines — un reste
   mangé lasse quand même. Le filtre de `habit` s'applique **au dénominateur** : ne filtrer que le
   numérateur ferait baisser mécaniquement toutes les affinités dès qu'on mange des restes. Un test
   verrouille ça avec le piège chiffré (0,5 attendu ; 0,333 si le dénominateur est dilué).
2. **`requiredFoodIds` vit dans `MealContext`, pas dans `HardConstraints`.** Son miroir
   `excludedFoodIds` est pourtant dans `HardConstraints` : l'asymétrie est **volontaire**.
   `WeekPlanRequest` n'ayant pas de `MealContext`, l'exigence devient *structurellement
   inexprimable* pour un plan de semaine — c'est ainsi qu'on obtient « dur en contexte Aujourd'hui
   seulement » par la forme, et non par la discipline de l'appelant.
3. **Constat empirique du banc CLI — sur un profil neuf, `preference`, `craving` et `variety`
   rendent `NEUTRAL_SCORE` à TOUS les candidats.** Vérifié avec `engine:try` sans `--pref`/`--envie`
   et un historique vide : leurs contributions sont identiques pour chaque candidat, et le
   classement est en réalité décidé par `nutri` et `season` seules. Conséquence à ne pas oublier
   pour l'explication (§ENGINE 6.7, en cours d'écriture) : **ne jamais citer une couche dont la
   contribution ne discrimine pas** entre les candidats, sous peine d'annoncer « correspond à vos
   goûts » à quelqu'un dont le moteur ne sait encore rien.

## ▶ Reprendre ici — **P1c**

**P1b-2 est close.** Passe de score pondérée (`runScoringPass`), 6 archétypes codés et noms
validés, poids dynamique de `craving`, `speed` en 17ᵉ couche du registre, second garde-fou
(`assertScoringLayersNeverExclude`, + extension de `PipelineTrace`), `createEngine` réel et banc
CLI `engine:try` sont tous codés, testés (303 tests verts, 29 fichiers) et committés.

Prochaine tranche : **P1c**, qui assemble tout ça en une API utilisable de bout en bout.

| Sous-lot | Contenu |
|---|---|
| **Diversification** | MMR simplifié (§ENGINE 6.6) — évite que le top 5 soit 5 variations du même plat |
| **Explication** | Top 3 des contributions converties en phrases (§ENGINE 6.7) — voir le constat empirique consigné en « Acquis à ne pas défaire » point 3 avant d'écrire ce lot |
| **`suggestMeals` bout-en-bout** | Assemble exclusion → score → diversification → explication → post-conditions dans `Engine.suggestMeals` (aujourd'hui : lève « non implémenté (P1c) ») |
| **Flags** | `onlyFavorites` (restreint aux `user_favorite` avant scoring) et `varietyMode` (override explicite de `variety`) — proposés, pas encore dans `SuggestionRequest` |
| **`suggestAlternatives`** | Substitution d'ingrédient détesté — socle (`optionnel`, table `substitution`) déjà en place depuis P1b |

Point ouvert à garder en tête pendant ce lot : la **limite d'API `createEngine`** (voir « Dette
connue » ci-dessous) — `suggestMeals` devra décider s'il consomme le catalogue enrichi déjà présent
dans la fermeture de `createEngine`, ou s'il ré-enrichit comme le fait `engine:try` aujourd'hui.

## Chantier B — vin & modes repas (conception livrée, code à venir)

Document : `CONCEPTION_B_VIN_REPAS.md`, **8 décisions tranchées**. Le rang 0 de son ordre
d'implémentation est fait (voir ci-dessus). Restent, dans l'ordre :

1. Facette `service` au catalogue (`entree · plat · dessert · accompagnement`) + annoter les
   recettes de test — il manque **2 entrées et 2 desserts** pour exercer le mode repas en CLI.
2. `composeMeal` / `rerollCourse` + score d'accord entre services — **après P1c**.
3. Table `recipe_pairing` + règle miroir sans alcool au build + lexique d'incitation — volontairement
   après le point 2 : coder une table sans consommateur est ce qu'on a refusé pour les courses non
   alimentaires.
4. Affichage des accords (section repliée, réglage, message sanitaire) — P5.

## Décisions ouvertes (rappel)

- **Radar** : rayons cuisine/saveur = v2 (v1 = 6 pôles sensoriels).
- **Scan produit** (OpenFoodFacts, jamais Yuka) : opt-in **v2+++++**.
- **Token de push GitHub** : à fournir si on veut que l'agent pousse lui-même.

Tranchées en session 3, ne plus rediscuter : `requiredFoodIds` (dur, contexte Aujourd'hui) ·
alcool dans l'agrégat (un alcool **employé comme ingrédient** est compté comme les autres ; c'est la
**boisson servie** qui n'est jamais un aliment du repas) · les 8 décisions du chantier B · **noms
des 6 archétypes** (`equilibre` · `envie` · `decouverte` · `de_saison` · `mes_gouts` · `rapide`) ·
**`speed`** comme 17ᵉ couche du registre à part entière (pas une modulation interne).

## Dette connue

- La table qui matérialisera l'historique en v1 devra porter la colonne d'**origine** — le type
  `MealHistoryEntry` l'a, aucune table ne le modélise encore.
- `roquefort` porte l'allergène `lait` mais pas `sulfites` — à revoir avec la table CIQUAL réelle.
- Valeurs nutritionnelles du catalogue de test toujours en `PROV-` (ordres de grandeur).
- **Limite d'API `createEngine`** (point ouvert, pas tranché) : le catalogue enrichi
  (`attachDerivedIndexes`) reste dans sa fermeture, non exposé par `Engine`. Un appelant qui veut
  lancer les passes lui-même ou utiliser une couche seule (§ENGINE 6.8) doit rappeler
  `attachDerivedIndexes` — c'est ce que fait `engine:try` (§ENGINE 11.3) aujourd'hui, au prix d'un
  calcul dupliqué (négligeable sur le catalogue de test, réel sur un catalogue de 1000+ recettes).
- Le test de `createEngine` (`app/src/engine/api/index.test.ts`) vérifie l'appel à
  `attachDerivedIndexes` via `vi.spyOn` — un mock qui devra disparaître une fois `suggestMeals`
  câblé (P1c) et l'effet rendu observable directement (une suggestion qui utilise réellement les
  index dérivés), plutôt que de vérifier un appel de fonction en boîte noire.
- `ENGINE_VERSION` (`engine/api/index.ts`) est une constante codée en dur (`'0.1.0'`), faute de
  mécanisme d'injection depuis `package.json` — peut diverger silencieusement du numéro de version
  réel du dépôt si l'un est mis à jour sans l'autre.

## Artefacts de session 2 (privés, galerie claude.ai)

- Formules de score (valeurs réelles) : `…/artifact/a18ac7b5-738c-4a54-8c91-1c9bb45ea499`
- Rayons courses non alimentaires (~150 articles) : `…/artifact/6d512ae5-3665-4d56-8e66-719f745f7ec5`
- Conception `variety` : `…/artifact/ab696cb9-356f-4f4e-b3af-dadc60d71af5`
- Conception roue radar : `…/artifact/b4b3ed6e-768b-4b78-8c6c-77e5d883a9ca`

## Méthode (rappel `CLAUDE.md`)

Plan ≤3 bullets avant toute tâche 2+ fichiers · TDD sur la logique moteur · échec 2× → stop ·
jamais commit/push/install sans demande explicite · le code s'écrit via agents Sonnet, Claude
planifie et vérifie (tests + typecheck + relecture des diffs).
