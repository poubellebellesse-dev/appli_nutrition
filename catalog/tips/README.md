# Tips — « Le saviez-vous ? » (§8.4 ARCHITECTURE, §4.7 DESIGN)

Un fichier YAML par tip. Compilés dans `catalog.db` par `catalog/build.mjs`, affichés dans le
carrousel de l'écran Savoir. **Ajouter un `.yaml` ici suffit.**

## Les trois catégories

| Catégorie | Ce que c'est | Précaution |
|---|---|---|
| `biologie_aliment` | Un fait sur l'aliment lui-même — botanique, chimie, transformation, conservation | Aucune. C'est du savoir, pas un conseil. |
| `nutrition_humaine` | Ce qui concerne l'alimentation de l'utilisateur | ⚠️ **Tombe sous §6.1 et §6.2.** Aucun claim thérapeutique, aucun vocabulaire de jugement. Le lint de contenu bloque le build. |
| `nutrition_animale` | Contenu **culturel**, pas actionnable | §8.4 : à garder **visuellement distinct** — sinon on ne sait plus ce qui s'applique à soi. L'écran ajoute la mention « À propos des animaux ». |

## Règle de rédaction : un fait vérifiable, jamais un conseil

« La tomate est botaniquement un fruit » est un tip ; « mangez des tomates » n'en est pas un — c'est
une recommandation, et le produit n'en donne pas (§6.1 : bibliothèque consultable, jamais de
prescription).

Cela vaut aussi pour les tips `nutrition_humaine`, qui sont les plus faciles à faire déraper :

| ❌ | ✅ |
|---|---|
| « Visez 25 g de fibres par jour. » | « L'EFSA considère qu'un apport de 25 g de fibres suffit à un transit normal chez l'adulte. » |
| « Buvez 1,5 L d'eau par jour. » | « Les valeurs de référence de l'EFSA pour l'eau sont de 2,0 L chez la femme et 2,5 L chez l'homme. » |

## Règle de sourçage : `source_url` est obligatoire

`tip.source_url` est `NOT NULL` et le build refuse un tip sans lien http(s) — §4.2 ARCHITECTURE
prévoyait cette colonne dès l'origine.

**Le lien est ouvert et lu avant que le tip soit écrit.** Un tip est une phrase courte, isolée et
affirmative : exactement ce qu'on recopie sans vérifier. Écrire d'abord et chercher la source
ensuite produit inévitablement des sources qui « disent à peu près » ce qu'on avait en tête.
Une source non vérifiée ⇒ **le tip n'est pas écrit.**

Trois conséquences pratiques :

1. **On n'écrit que ce que la source dit.** Si la source établit le mécanisme mais pas le remède
   populaire qui va avec, le remède saute (voir `oignon-larmes.yaml`) ou est rendu à son statut
   d'hypothèse. Le commentaire en tête du fichier note ce qui a été retiré et pourquoi.
2. **Les chiffres viennent de la source citée**, pas de la mémoire ni du chiffre le plus répandu
   (voir `safran-stigmates.yaml` : 60 000 fleurs par kilo, pas les 150 000 qui circulent).
3. **Beaucoup de domaines bloquent la lecture automatisée** (Britannica, Smithsonian, plusieurs
   extensions universitaires renvoient 403). Ce n'est pas une raison de citer sans lire : il faut
   trouver une source lisible, ou renoncer au tip.

> ⚠️ **Le niveau d'exigence n'est pas celui de `catalog/evidence/`.** Un fait botanique n'a pas de
> méta-analyse : les sources ici sont des articles à comité de lecture (PMC), des textes d'autorité
> (EFSA, Cochrane, OMS) ou des références institutionnelles (manuels vétérinaires de référence,
> départements universitaires). C'est plus faible qu'une revue systématique, et il faut l'assumer
> plutôt que laisser croire à l'équivalence. Un tip n'est jamais une preuve d'efficacité.

## Format

```yaml
# Un commentaire portant la citation COMPLÈTE (auteurs, année, titre, revue, DOI) : `source_url` ne
# stocke que l'URL, et une URL seule ne dit pas ce qu'on a lu. Y noter aussi ce qui a été
# volontairement retiré du texte, sinon quelqu'un le remettra.
code: tomate-fruit          # identifiant stable, en kebab-case
categorie: biologie_aliment # biologie_aliment | nutrition_humaine | nutrition_animale
texte: >
  Une phrase ou deux. Pas de titre, pas de conclusion — le tip EST la phrase.
source_url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4528740/"
```

Le nom du fichier n'a pas besoin de correspondre au `code` (contrairement aux fiches
`catalog/evidence/`) ; `pdt-verte.yaml` porte le code `pomme-de-terre-verte`.

## Ce que le build vérifie, et ce qu'il ne peut pas vérifier

Il **échoue** si : `code` manquant ou en double, `categorie` hors des trois valeurs, `texte` vide,
`source_url` absente ou non http(s), ou vocabulaire banni §6.2 dans le texte.

Il ne sait **pas** si l'URL répond, encore moins si elle dit ce que le tip prétend. Cela reste au
rédacteur — c'est l'objet de la règle de sourçage ci-dessus.

## État du contenu

73 tips au 2026-08-01 : 51 `biologie_aliment`, 11 `nutrition_humaine`, 11 `nutrition_animale`.
Cible §8.2 pour l'ordre de grandeur : une centaine.

71 sources distinctes pour 73 tips — trois tips partagent la page de synthèse des valeurs de
référence de l'EFSA (fibres, eau, macronutriments), qui les porte toutes les trois. C'est la seule
mutualisation ; ailleurs, un tip = une source.

### Tips écartés faute de source lisible

La règle de sourçage a un coût, et il est visible : plusieurs sujets solides n'ont pas de tip parce
qu'aucune source vérifiable n'a été trouvée. L'anneau vert du jaune d'œuf trop cuit (la seule
référence, *Biochemical Journal* 1920, n'existe qu'en images scannées) ; « le champignon est plus
proche de l'animal que de la plante » (la source la mieux placée conteste justement ce consensus) ;
l'ananas et la gélatine ; les valeurs de référence EFSA pour le calcium, le fer, la vitamine C et
les folates, annoncées sur les pages de presse mais publiées seulement dans des PDF illisibles.
**Ne pas écrire est une issue normale**, pas un échec.

> ⚠️ **CONTENU NON RELU PAR UN TIERS.** Chaque source a été ouverte et vérifiée à l'écriture, mais
> §8.2 bis exige une relecture externe avant publication. Le fait que le build passe ne rend pas le
> contenu publiable.
