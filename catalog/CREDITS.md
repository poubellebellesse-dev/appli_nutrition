# Crédits et licences

Toutes les ressources tierces embarquées dans l'application, avec leur licence. §8.1
ARCHITECTURE : « ne rien créer soi-même » — donc tout créditer.

> Ce fichier est **obligatoire avant publication** (critère de sortie de P6, §12 ENGINE). Il est
> incomplet tant que les photos de recettes n'existent pas.

---

## Polices

Auto-hébergées dans `app/public/fonts/`, jamais chargées depuis un service tiers : §6.6
ARCHITECTURE promet **zéro requête réseau après le chargement initial**, et un lien vers Google
Fonts casserait à la fois cette promesse et l'affichage hors ligne.

| Police | Auteurs | Licence | Fichier |
|---|---|---|---|
| **Newsreader** | Production Type (Jean-Baptiste Levée, Aleksandra Samuļenkova) | [SIL Open Font License 1.1](https://openfontlicense.org/) | `newsreader-latin.woff2` |
| **Instrument Sans** | Instrument, Rodrigo Fuenzalida, Jordan Egstad | [SIL Open Font License 1.1](https://openfontlicense.org/) | `instrument-sans-latin.woff2` |

L'OFL autorise explicitement l'usage, la redistribution et l'intégration, y compris commerciale, à
condition de conserver l'avis de licence et de ne pas vendre la police seule. Les deux fichiers sont
des **polices variables** (graisses 400 à 600 dans un seul fichier), restreintes au sous-ensemble
`latin` — qui contient les accents français et la ligature œ. Total : environ 160 Ko.

Source des fichiers : sous-ensembles servis par `fonts.gstatic.com`, téléchargés le 2026-07-30.

---

## Données nutritionnelles

| Source | Détenteur | Conditions |
|---|---|---|
| **Table CIQUAL 2025** | ANSES | Réutilisation libre avec mention de la source. Version et date d'extraction dans `catalog/sources/ciqual/`. |

Les valeurs ne sont **jamais saisies à la main** : `foods.yaml` + `ciqual-mapping.yaml`, puis
`npm run catalog:ciqual -- --write`.

---

## Bibliothèques

Licences complètes dans `node_modules/*/LICENSE`. Les dépendances d'exécution embarquées dans le
bundle sont React, React DOM et SQLite WASM.

| Bibliothèque | Licence |
|---|---|
| React, React DOM | MIT |
| SQLite (`@sqlite.org/sqlite-wasm`) | Domaine public |
| Tailwind CSS | MIT |
| Vite, Vitest, TypeScript | MIT / Apache-2.0 |

---

---

## Recettes

**Les 241 recettes du catalogue sont écrites pour ce projet** — aucune ne provient d'une source
externe, et il n'y a donc rien à créditer ici. Ce n'est pas un oubli : c'est le seul contenu du dépôt
sans source, et il ne faut pas lui en inventer une.

Les sources de recettes réutilisables (cuisine-libre.org, USDA MyPlate, Wikibooks Cookbook), leurs
licences et le coût réel d'un import sont recensés dans
[`docs/SOURCES_RECETTES.md`](../docs/SOURCES_RECETTES.md). **Toute recette qui en viendrait devra
être créditée ici, ligne à ligne** — auteur, licence, lien.

~~⚠️ `recipe` n'a aujourd'hui ni colonne auteur, ni source, ni licence : le crédit ne serait pas
affichable à l'écran. À traiter avant le premier import.~~

✅ **CORRIGÉ LE 2026-08-05 — C'ÉTAIT FAUX, et depuis un moment.** Tout le dispositif existe et il est
branché de bout en bout :

| Élément | État |
|---|---|
| `recipe.origine` | `maison \| domaine_public \| libre`, NOT NULL + CHECK |
| `recipe_source` | `type`, `titre`, `url`, `consulte_le`, **`licence`**, **`auteur`** |
| Validation au build | Bidirectionnelle : `maison` + `provenance` → **erreur** ; `domaine_public`/`libre` sans `provenance` → **erreur** |
| Affichage | `ui/screens/detail-recette.tsx` : « **D'après** *titre* — *auteur* · *licence* » |

Une recette importée sait donc se créditer à l'écran, et le build REFUSE une origine revendiquée
sans source. **Le premier import n'est plus bloqué par ce point.** Aujourd'hui 41 recettes portent
52 sources, **toutes de type `reference`** (consultées pour vérifier) et **aucune `provenance`** —
ce qui est cohérent avec « les 241 recettes sont écrites pour ce projet ».

---

## À compléter avant publication

- **Photos de recettes** — aucune à ce jour (0 sur 241). Chaque photo devra porter son auteur, sa
  licence et sa source.
- **Illustrations du lexique** — les 62 gestes sont en texte seul ; §8.5 les annonce illustrés.
- **Fiches de niveau de preuve** — chaque fiche cite déjà sa source dans son frontmatter ; à
  regrouper ici au moment de la revue juridique.
