# Tips — « Le saviez-vous ? » (§8.4 ARCHITECTURE, §4.7 DESIGN)

Un fichier YAML par tip. Compilés dans `catalog.db` par `catalog/build.mjs`.

## Les trois catégories

| Catégorie | Ce que c'est | Précaution |
|---|---|---|
| `biologie_aliment` | Un fait sur l'aliment lui-même — botanique, transformation, conservation | Aucune. C'est du savoir, pas un conseil. |
| `nutrition_humaine` | Ce qui concerne l'alimentation de l'utilisateur | ⚠️ **Tombe sous §6.1 et §6.2.** Aucun claim thérapeutique, aucun vocabulaire de jugement. Le lint de contenu bloque le build. |
| `nutrition_animale` | Contenu **culturel**, pas actionnable | §8.4 : à garder **visuellement distinct** — sinon on ne sait plus ce qui s'applique à soi. |

## ⚠️ Pourquoi il n'y a que du `biologie_aliment` ici

Les tips livrés au 2026-07-30 sont **exclusivement factuels** et ne portent **aucune
affirmation de santé**. C'est un choix, pas un oubli : écrire des tips de
`nutrition_humaine`, c'est fixer la voix du produit et son exposition juridique, et
cela relève d'une décision éditoriale — pas d'un lot de code.

Le tuyau (table, build, lint, écran) est en place. Ajouter un fichier suffit.

## Format

```yaml
code: tomate-fruit          # identifiant stable, en kebab-case
categorie: biologie_aliment # biologie_aliment | nutrition_humaine | nutrition_animale
texte: >
  Une phrase ou deux. Pas de titre, pas de conclusion — le tip EST la phrase.
```

## Règle de rédaction

**Un fait vérifiable, jamais un conseil.** « La tomate est botaniquement un fruit »
est un tip ; « mangez des tomates » n'en est pas un — c'est une recommandation, et le
produit n'en donne pas (§6.1 : bibliothèque consultable, jamais de prescription).
