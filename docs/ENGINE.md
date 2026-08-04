# Architecture du moteur — index

> Complément de [ARCHITECTURE.md](./ARCHITECTURE.md), qui reste la référence pour le périmètre,
> le modèle de données et le cadre réglementaire. Ce document ne traite que du moteur : couches,
> contrats, algorithmes, plan de construction.

**Statut d'origine** : « spécification, à valider avant implémentation » — **Date** : 2026-07-22
> ⚠️ Ce statut est **périmé** : le moteur est complet (voir `ETAT.md` §1). Il est conservé tel quel
> plutôt que réécrit — l'état courant fait foi dans `ETAT.md`, pas ici.

> 📄 **Ce fichier faisait 2 126 lignes.** Il a été découpé le 2026-08-03 en 8 parties dans
> [`reference/`](./reference/), **sans qu'une seule ligne de contenu soit modifiée, ajoutée ou
> supprimée** (conservation vérifiée ligne à ligne). Une seule section a changé de voisinage :
> `§8.4`, remise à sa place logique (voir plus bas). **Aucun numéro de section n'a bougé** :
> toute référence `ENGINE §6.6 bis`, `§5.1 bis`, `§8.4` faite ailleurs dans la doc reste valide.

---

## Où lire quoi

| § | Sujet | Fichier | Lignes |
|---|---|---|---|
| **1–3** | Décision fondatrice · vue en couches · règles de dépendance | [`reference/ENGINE_1_socle.md`](./reference/ENGINE_1_socle.md) | 122 |
| **4 · 5 · 9** | L1 Domaine · L2 Nutrition & garde-fous · le catalogue en mémoire | [`reference/ENGINE_2_domaine_et_nutrition.md`](./reference/ENGINE_2_domaine_et_nutrition.md) | 355 |
| **6 → 6.4** | L3 Sélection : natures de couches, contrat commun, registre, archétypes, pipeline | [`reference/ENGINE_3_selection_registre.md`](./reference/ENGINE_3_selection_registre.md) | 259 |
| **6.5 → 6.6** | Couches de score en détail, décisions de conception, diversification MMR | [`reference/ENGINE_4_selection_score.md`](./reference/ENGINE_4_selection_score.md) | 245 |
| **6.6 bis → 6.8** | Historique des corrections mesurées, explication, usage d'une couche seule | [`reference/ENGINE_5_selection_historique_et_explication.md`](./reference/ENGINE_5_selection_historique_et_explication.md) | 290 |
| **7** | L4 Planification | [`reference/ENGINE_6_planification.md`](./reference/ENGINE_6_planification.md) | 339 |
| **8 · 10** | L5 API publique (§8.1 → **8.4**) · Fonctionnalités | [`reference/ENGINE_7_api_et_fonctionnalites.md`](./reference/ENGINE_7_api_et_fonctionnalites.md) | 352 |
| **11–13** | Stratégie de test · plan de lancement · décisions à valider | [`reference/ENGINE_8_tests_et_lancement.md`](./reference/ENGINE_8_tests_et_lancement.md) | 201 |

**Charger une partie coûte 3 à 9 fois moins que charger l'ancien fichier entier.** Ouvrir la partie
qui traite le sujet, pas l'index puis tout le reste.

## Une anomalie corrigée le 2026-08-03

✅ **`### 8.4 suggestAlternatives` était physiquement rangé à l'intérieur de la section 6**, entre
l'historique des corrections et §6.7 — héritage de l'écriture au fil de l'eau. Il a été **déplacé à
sa place logique**, à la suite de §8.3, dans `ENGINE_7_api_et_fonctionnalites.md`. Contenu inchangé
au caractère près, conservation vérifiée. **Aucun numéro de section n'a bougé** : une référence
`ENGINE §8.4` pointe toujours juste — elle est simplement dans le fichier qu'on attend.

> Signalé le 2026-08-03 puis **écarté** : « deux sections portent le numéro 6.3 ». Fausse alerte —
> `6.3 bis` est la convention systématique de ce document (`§5.1 bis`, `§5 quater`, `§6.5 ter`,
> `§6.6 quinquies`, `§8.2 bis`). Rien à corriger.

## Ordre d'autorité

**Le code fait foi**, puis ce document (et ses parties) sur tout ce qui touche le moteur, puis
`ARCHITECTURE.md` sur le reste. Une contradiction constatée se corrige dans le document, elle ne se
contourne pas dans le code.

## Sommaire d'origine

1. [Décision fondatrice](./reference/ENGINE_1_socle.md)
2. [Vue en couches](./reference/ENGINE_1_socle.md)
3. [Règles de dépendance](./reference/ENGINE_1_socle.md)
4. [L1 — Domaine](./reference/ENGINE_2_domaine_et_nutrition.md)
5. [L2 — Nutrition & garde-fous](./reference/ENGINE_2_domaine_et_nutrition.md)
6. [L3 — Sélection : le registre de couches](./reference/ENGINE_3_selection_registre.md)
7. [L4 — Planification](./reference/ENGINE_6_planification.md)
8. [L5 — API publique](./reference/ENGINE_7_api_et_fonctionnalites.md)
9. [Le catalogue en mémoire](./reference/ENGINE_2_domaine_et_nutrition.md)
10. [Fonctionnalités](./reference/ENGINE_7_api_et_fonctionnalites.md)
11. [Stratégie de test](./reference/ENGINE_8_tests_et_lancement.md)
12. [Plan de lancement](./reference/ENGINE_8_tests_et_lancement.md)
13. [Décisions à valider](./reference/ENGINE_8_tests_et_lancement.md)
