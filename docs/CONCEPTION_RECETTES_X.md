# Recettes venues de X — plan de montée

> **Ce document porte la décision et l'ordre des lots, pas la spec du code.** Le cadre des sources
> fait foi dans `SOURCES_RECETTES.md` (§2 amendé, §6) ; la décision figée, dans
> `decisions/06-communaute-contenu.md`.
> Ouvert le 2026-10-14, **décision de l'auteur** : faire entrer au catalogue des recettes publiées
> sur X, avec l'accord de leur auteur.

Demande : trouver sur X des recettes bonnes ou originales, dans plusieurs langues et plusieurs
pays, demander à leurs auteurs l'autorisation de les reprendre (et si possible leurs photos), et les
faire entrer au catalogue — **par l'auteur du projet, dans `catalog/recipes/`, livrées par mise à
jour de l'APK**. Ce n'est **pas** l'import par l'utilisateur de `ARCHITECTURE.md` §8.7, qui reste
inchangé.

---

## 1. Le principe directeur — l'accord de l'auteur, pas la permission de la loi

La loi permet de reprendre le noyau factuel d'une recette (§2 de `SOURCES_RECETTES.md`). Le projet
s'y refusait par choix. **Ce choix est levé pour X à une seule condition : l'accord écrit de
l'auteur de la recette.** C'est l'accord qui fait la différence avec le scrap que §6 écarte — pas la
plateforme, pas le volume.

Conséquences, toutes tranchées le 2026-10-14 :

| Règle | Ce qu'elle exige |
|---|---|
| **Accord écrit, recette par recette** | Une réponse de l'auteur (message privé ou réponse publique) qui accepte la reprise. Sans accord, la recette n'entre pas. |
| **Photos : accord explicite à part** | Le droit d'auteur protège la photo, ce n'est pas un choix du projet. Un accord qui ne cite pas les photos ne couvre pas les photos. |
| **Auteur crédité, source citée** | `licence` et `auteur` restent **obligatoires** sur la source `provenance` (`build.mjs:973-976`). `auteur` = le nom ou pseudo que la personne accepte ; `licence` = « autorisation de l'auteur du AAAA-MM-JJ » ; `url` = le post. |
| **Registre des accords hors dépôt** | Une capture ou copie de chaque accord, gardée par l'auteur du projet, **jamais dans git** (données personnelles). Emplacement à fixer au lot RX2. |
| **Retrait respecté** | Un auteur qui retire son accord voit sa recette sortir du catalogue à la mise à jour suivante. |
| **Demande envoyée à la main** | Un message par personne, écrit ou relu et envoyé par l'auteur du projet. **Aucun envoi automatique** — voir §2. |
| **Traduction en français** | Le catalogue v1 est en français (`ARCHITECTURE.md` §8.8). L'accord demandé couvre la reprise **traduite et adaptée** (grammes, étapes au format du catalogue). |
| **Mêmes contrôles qu'une recette maison** | Aliments rattachés à la base, grammes obligatoires, vocabulaire interdit, cuissons à risque (`SOURCES_RECETTES.md` §5 bis à §5 quinquies). Une recette dont les quantités ne se ramènent pas en grammes n'entre pas. |

## 2. Pourquoi l'envoi reste à la main — les règles de X

Lu le 2026-10-14 (recherche déléguée ; la page d'aide a renvoyé un 403 au chargement direct, sa
citation vient de l'extrait indexé — **à relire dans un navigateur avant le lot RX2**) :

- Règles d'automatisation, <https://help.x.com/en/rules-and-policies/x-automation> : « You may not
  send unsolicited Direct Messages in a bulk or automated manner ».
- Politique développeur, <https://docs.x.com/developer-terms/policy> (lue directement) : « Always
  get explicit consent before sending people automated replies or Direct Messages ».
- **Le rythme ne rend pas licite un envoi non sollicité** : aucun texte trouvé ne le dit. La
  fréquence n'y est qu'une précaution de plus.
- Plafond technique de l'API : 1 440 messages privés par jour (<https://docs.x.com/x-api/fundamentals/rate-limits>).
  Plus de palier gratuit pour les nouveaux développeurs depuis février 2026 — **non vérifié sur une
  page officielle de tarifs**.

Un message écrit et envoyé par une personne, une personne à la fois, est l'usage normal. Beaucoup de
comptes ferment leurs messages privés aux non-abonnés : la réponse publique sous le post, écrite à
la main, est l'alternative.

## 3. Ce que Grok fait, et ce qu'il ne fait jamais

**Grok sert hors de l'application, à la préparation du catalogue.** Le principe 4 vise le moteur ;
rien de généré n'entre dans l'APK sans relecture, et l'application n'appelle jamais aucun service.

- **Il cherche et il rédige** : des candidates (lien, texte d'origine, raison du choix) et le
  message de demande dans la langue de l'auteur.
- **Il ne fait pas foi sur la recette.** Le brouillon YAML est confronté **par un script** au texte
  d'origine : chaque ingrédient et chaque quantité doivent y figurer, sinon la recette est rejetée.
  Une consigne « n'invente pas » ne garantit rien ; le contrôle, si.
- **Les allergènes ne viennent jamais de Grok** : ils se déduisent des aliments rattachés, comme
  pour toute recette du catalogue.
- **La clé d'API xAI** est fournie par l'auteur du projet, en variable d'environnement, jamais lue
  ni écrite par l'agent.

⏳ **Les images générées par IA ne sont PAS tranchées** — question **83** du registre.

## 4. Les lots

| Lot | Objet | État |
|---|---|---|
| **RX1** | Le build accepte une recette autorisée par son auteur : `origine: autorisee`, `x.com` admis comme source **seulement** sur une telle recette, `licence` et `auteur` toujours obligatoires | à écrire |
| **RX2** | L'outil de préparation, hors de l'application : recherche par Grok, message de demande rédigé, brouillon YAML confronté au texte d'origine. Envoi par l'auteur du projet | à écrire, après RX1 — clé d'API xAI et accès réseau à fournir par l'auteur |

Le moteur et l'écran ne sont touchés par aucun des deux. RX1 touche `catalog/build.mjs` et suit le
cycle habituel (`/brief`, `/attaquer`, `/sceller`). Le dossier de l'outil RX2 se fixe à son brief.
