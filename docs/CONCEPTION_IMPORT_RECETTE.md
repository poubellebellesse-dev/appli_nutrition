# Import d'une recette par l'utilisateur — prototype et conditions

> **Ce document porte ce qui a été mesuré et ce qui en découle, pas la spec du code.** Rien n'est
> codé dans `app/`. Le prototype vit hors dépôt, dans `atelier/import-recette/` (gitignoré).
> Ouvert le 2026-10-14, relevé repris le 2026-10-21. Cadre produit : `ARCHITECTURE.md` §8.7 ;
> décision figée : `decisions/06-communaute-contenu.md` (« Import »). Ce n'est **pas** le chantier
> des recettes de X (`CONCEPTION_RECETTES_X.md`), qui fait entrer des recettes au catalogue.

## 1. Ce que l'auteur a tranché

| Date | Décision |
|---|---|
| 2026-10-14 | **L'application va chercher la page elle-même** à partir d'un lien ; **en option, l'utilisateur colle le texte.** |
| 2026-10-14 | **Prototyper d'abord** : « fabrique la feature, teste, et si cela marche on l'implémente ». Plan validé. |
| 2026-10-21 | Les textes de style réseau social **inventés par l'agent ne prouvent rien** (« auto-test, auto-confirme ») : la mesure du collage se refait sur de **vrais posts**. |

⛔ **Aller chercher une page touche au principe 5** (« la connexion ne sert qu'à mettre à jour
l'app et son catalogue »). L'amendement n'est **pas écrit** : question **84** du registre.

## 2. Pourquoi aucun gabarit par site

L'auteur a demandé (2026-10-21) s'il fallait un « modèle de mise en forme » par site — un
gabarit, pas une IA. **Non, sauf cas rare :**

- **Blogs et sites** : presque tous publient la recette dans un bloc standard caché
  (JSON-LD schema.org `Recipe`, exigé par Google pour l'affichage en résultat enrichi). **Un seul
  lecteur** a lu 23 pages sur 24, sur 8 sites. Un gabarit par site serait sans fin et casserait à
  chaque refonte.
- **Le site sans ce bloc** (1 sur 24) : un gabarit pour un seul blog ne vaut pas sa maintenance —
  l'utilisateur colle le texte.
- **Réseaux sociaux** : la page a une forme fixe, mais **le texte du post est libre**. Un gabarit
  trouverait le texte, pas les ingrédients. Ce sont des **règles fixes sur la forme d'une ligne**
  (nombre + unité + aliment, titres de section, puces et emojis) qui les trouvent — déterministes,
  principe 4.

## 3. Ce qui a été mesuré (2026-10-14, relancé le 2026-10-21)

Corpus : **24 pages** de 8 sites (marmiton, 750g, cuisineaz, journaldesfemmes, chefsimon,
hervecuisine, undejeunerdesoleil, ricardocuisine) et **10 textes collés** — ⚠️ ces 10 textes
sont **synthétiques**, écrits par l'agent, et récusés comme preuve (§1). Le rattachement passe par
`chercherParNom`, en lecture seule sur `catalog.db`. Jugement des aliments **à la main**, ligne par
ligne (`verdicts.tsv`).

| Mesure | Seuil fixé avant | Pages web | Textes collés ⚠️ | Total |
|---|---|---|---|---|
| Bloc standard lisible | — | **23/24 (95,8 %)** | — | — |
| Ligne découpée (quantité, unité, aliment) | ≥ 90 % | 95,1 % (212/223) | 95,0 % (57/60) | **95,1 % (269/283)** |
| Aliment juste (jugé à la main) | ≥ 80 % | 79,3 % | 93,7 % | **82,3 %** |
| Juste ou proche | — | 89,5 % | 95,2 % | 90,7 % |
| Faux | — | 8,4 % | 1,6 % | 7,0 % |
| … dont faux qui **change les allergènes** | — | 8 | 0 | **8, tous « à confirmer »** |
| Faux marqué sûr | 0 qui change les allergènes | 1 | 0 | **1** (noix → noix de pécan, même allergène) |
| Quantité ramenée en grammes | — | 75,5 % | 77,8 % | 76,0 % |
| Lignes perdues | 0 | — | — | **0** (300 entrées, 300 rendues) |

« Au goût » (sel, poivre…) : 17 lignes, hors du compte de découpe. 38 lignes de texte hors
ingrédients écartées et listées, aucune en silence.

## 4. Ce que la mesure a appris — les conditions avant tout code

1. ⛔ **Le premier passage rendait deux erreurs d'allergène marquées sûres** : « œufs » → *Œufs de
   lump* (poisson) et « farine » → *Farine de riz* (sans gluten). Cause : `chercherParNom` classe un
   synonyme exact **au même rang** qu'un nom qui commence par le mot, puis départage par la
   longueur du nom. **Son en-tête affirme le contraire** (`app/src/engine/search/index.ts`) — à
   corriger dans un lot.
2. **Corrigé dans le prototype par deux moyens, tous deux à porter au code** : une **passe exacte
   avant la recherche**, et des **synonymes au catalogue** (15 simulés : farine → T55, œuf → œuf de
   poule, lait → demi-écrémé…).
3. **Le drapeau « sûr »** n'est posé que si chaque mot significatif lu figure dans le nom ou un
   synonyme rattaché ; tout le reste est **« à confirmer »**, et la confirmation est **obligatoire**
   avant enregistrement (principe 1).
4. **Un quart des quantités ne se ramène pas en grammes** (pièces sans poids, volumes ramenés à une
   densité de 1, marqués approchés) : l'écran doit demander le poids, jamais le deviner.
5. **Le collage d'une liste sur une seule ligne** perd encore des ingrédients (« le jus d'1
   citron », « sel » manqués dans un texte court).

## 5. Les vrais posts — où l'on en est

| Source | Accès sans compte | Constat |
|---|---|---|
| Mastodon (mastodon.social, piaille.fr) | ✅ API publique, mot-dièse `#recette` | 4 posts sur ~160 portent une liste d'ingrédients ; plus désordonnés que les textes inventés (ingrédients dans les étapes, « 125 g [1/2 cup] », posts bilingues) |
| Reddit, Bluesky | ❌ 403 sur l'API publique | — |
| Instagram, X, TikTok | ❌ mur de connexion | — |

⛔ **L'agent ne se connecte à aucun compte de l'auteur pour récolter des posts** (proposé le
2026-10-21, refusé) : un identifiant est un secret (règles du dépôt), les conditions d'X, Meta et
TikTok interdisent la collecte automatisée sans accord (vérifié pour X ; **non relu pour Meta et
TikTok**), et c'est le compte de l'auteur qui serait bloqué. Surtout, **l'application n'aura jamais
de compte ni de robot** : le vrai usage est un texte **copié par une personne**, et c'est ce texte,
avec ce que la copie abîme, qu'il faut mesurer.

▶ **Prochaine mesure** : 10 à 15 posts réels copiés à la main par l'auteur depuis son téléphone
(Instagram, TikTok, X, Facebook), séparés par une ligne `=====`, déposés sur le dépôt SFTP ; plus
une quinzaine de posts Mastodon publics récoltés par l'agent. Même prototype, même jugement à la
main, seuls ces textes comptés.

## 6. Les lots — après la mesure sur vrais posts, et sur accord de l'auteur

| Ordre | Objet | Préalable |
|---|---|---|
| 0 | Amendement du principe 5 (`CLAUDE.md`, `decisions/01`, `ARCHITECTURE.md` §8.7) | question 84 tranchée |
| 1 | Synonymes au catalogue + passe exacte + en-tête de `chercherParNom` corrigé | — |
| 2 | Le collage : découpe, rattachement, confirmation obligatoire, poids demandé | lot 1 |
| 3 | Le lien : lecture du bloc standard, récupération depuis l'APK | lot 1 ; ⚠️ touche `capacitor.config.ts` (`CapacitorHttp`) — **configuration de build, à signaler** |

⚠️ **Jamais mesuré** : la récupération d'une page **depuis l'APK** (CORS, `CapacitorHttp`). Les 24
pages ont été téléchargées depuis la machine de développement.
