# Décisions figées — Communauté sans serveur & contenu

> Sorti intégralement de `ETAT.md` §3 le 2026-09-08 (cure, P-14). Texte non réécrit. Ne pas rediscuter sans raison.
> Index : [README.md](./README.md) · questions numérotées : [registre.md](./registre.md).

## Communauté sans serveur & contenu
- **Aucun serveur, jamais** : pas de feed social ni de commentaires agrégés hébergés (principe 2).
- **Partage P2P par fichier** `.nutri-recipe` autonome (recette + photo embarquée + notes de
  l'auteur, opt-in) via le partage natif ; carte-image (Canvas) pour les réseaux.
- **Commentaires locaux** par recette et par étape (`user_recipe_note`), exportables avec le
  partage ; à l'import, marqués « non vérifié », n'écrasent rien.
- **Import** : une recette à la fois, faits + lien source, jamais la prose/photo, jamais de scrap
  massif ni d'API payante. Prototype mesuré le 2026-10-14 ; aller chercher la page sur lien est
  la question **84**, ouverte → [CONCEPTION_IMPORT_RECETTE.md](../CONCEPTION_IMPORT_RECETTE.md).
- **Recettes de X au catalogue** (2026-10-14, décision de l'auteur) : seulement avec l'**accord
  écrit** de leur auteur, crédité et sourcé ; photos seulement si l'accord les cite ; demande
  envoyée **à la main**, jamais par un robot ; Grok cherche et rédige, ne fait jamais foi.
  → [CONCEPTION_RECETTES_X.md](../CONCEPTION_RECETTES_X.md).
- **Recettes user/importées** toujours **« non vérifié »**, hors garanties allergènes/nutrition.
- **Favoris** (`user_favorite`) : marque-page rapide, n'influence pas le moteur par défaut.
- **Catégorie `loufoque`** (recettes virales) : facette de style ; contenu **original** obligatoire.
- **Alternatives** : substitution d'ingrédients **secondaires** (table `substitution`) avec
  **recalcul des allergènes** ; édition d'étape = variante perso « non vérifié ».
