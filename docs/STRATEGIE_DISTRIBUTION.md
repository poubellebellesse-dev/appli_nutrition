# Stratégie — distribution, publication & modèle

> Décisions issues de la revue marché/distribution (session 2026-07-23).
> Complète [ETAT.md](./ETAT.md) et [ARCHITECTURE.md](./ARCHITECTURE.md) — ne traite que
> du positionnement, de la publication et du modèle économique, pas du produit ni du moteur.
> **Réconcilié le 2026-07-23** avec les décisions d'ETAT : don → simple lien « À propos »
> (aucun don), et la publication en store est une **proposition à confirmer**, pas une décision figée.

**Statut** : cadre posé ; les points « à confirmer » restent ouverts jusqu'à la publication (post-P7).
**Date** : 2026-07-23

---

## 1. Objectif du projet (cadre qui prime sur tout le reste)

- Appli **pour mon usage** + **publication gratuite pour qui veut**.
- **Gagner de l'argent = bonus**, jamais une condition de succès.
- Conséquence : la portée est un « bonus de diffusion », pas un objectif. On vise que
  **les gens que ça intéresse** trouvent l'appli facilement, sans trahir les valeurs.

---

## 2. Modèle — confirmé et assumé

- **100 % gratuit, sans pub, sans tracking, 100 % local.** Confirmé.
- Ce n'est **pas** un handicap : en 2026 c'est un **différenciateur** (lassitude anti-tracking,
  « digital detox » en hausse). Le public qui **fuit** les applis nutrition classiques est
  exactement la cible.
- Distinction clé retenue :
  - **Différencier sur les valeurs** (gratuit, privacy, local) → OUI, à garder. C'est le
    meilleur argument de vente.
  - **Se couper de la distribution** (rester invisible) → NON, c'est séparable et à éviter.
  - « Je refuse la pub et le tracking » ≠ « je refuse d'être trouvé ». On peut avoir les deux.

---

## 3. Publication dans les stores (proposition — à confirmer)

> ✅ **TRANCHÉ le 2026-07-30 — le store n'est plus optionnel sur Android.** Principe posé par
> l'utilisateur : *« l'appli ne doit pas ouvrir un navigateur, elle doit être indépendante »*.
> Une PWA **installée** ne montre effectivement aucun navigateur (fenêtre autonome, icône propre,
> pas de barre d'URL) — mais **il faut passer par un navigateur UNE fois pour l'installer**, et
> elle n'apparaît dans aucun store. C'est ce chemin d'entrée qui est refusé, pas le mode
> d'exécution.
>
> ~~**Décision : Play d'abord via TWA, iOS plus tard.**~~ **Remplacée le 2026-07-31 — voir ci-dessous.**
> La PWA reste le socle technique dans les deux cas.

> ✅ **TRANCHÉ le 2026-07-31 — Capacitor remplace le TWA.** Ce qui a fait basculer la décision :
> l'utilisateur veut des **notifications de rappel de préparation**, et un TWA ne peut pas en
> produire. Un TWA est une page web dans un conteneur Chrome ; il n'a accès qu'aux API du web, et
> l'API qui aurait convenu — *Notification Triggers* — **a été abandonnée par Google**, qui écrit ne
> pas pouvoir en garantir un comportement cohérent entre plateformes
> ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)).
> Les seules voies restantes sont le **push serveur** (qui exige un serveur et un abonnement, donc
> contredit « 100 % local, sans compte », §2) et un **conteneur natif**. Capacitor donne
> `LocalNotifications` : programmées sur l'appareil, hors ligne, sans serveur — le principe de §2
> est intact.
>
> **Ce que ça change, au-delà des notifications :**
>
> | | TWA *(écarté)* | **Capacitor** *(retenu)* |
> |---|---|---|
> | Notifications programmées | Non | **Oui**, sur l'appareil |
> | Hébergement HTTPS + domaine | **Bloquant** — pas d'appli sans origine | **Facultatif** : les fichiers sont dans l'APK |
> | `assetlinks.json` | Obligatoire | Sans objet |
> | Mise à jour | Déploiement du site, instantané | **Revue du store à chaque correctif** |
> | iOS | Impossible | Ouvert plus tard (Mac requis) |
>
> ⚠️ **L'hébergement sort du chemin critique.** C'était le préalable n°1 du TWA ; il redevient un
> chemin parallèle, utile pour la version web consultable en navigateur, plus jamais bloquant pour
> publier. Cloudflare Pages / GitHub Pages restent le choix par défaut le jour où on le fera.
>
> ⚠️ **Le prix : un projet natif à maintenir** (dossier Android dans le dépôt, chaîne de build
> supplémentaire) et **la fin des correctifs instantanés** — toute rustine attend Google.
>
> ⚠️ **Piste à mesurer, pas encore un acquis** : Capacitor donnerait accès à un vrai système de
> fichiers pour `user.db`, là où les deux VFS OPFS de SQLite ne tournent que dans un Worker dédié
> (d'où la base en mémoire recopiée dans un fichier OPFS, `ui/user-source.ts`). Cela simplifierait
> peut-être cette couche — mais créerait deux chemins de persistance selon la plateforme. À ne pas
> compter comme un gain avant de l'avoir vérifié.

Une **PWA seule n'est PAS dans les stores** → invisible là où les gens cherchent une appli.
Deux niveaux, à activer si on veut la découvrabilité :

- **PWA hébergée** (Cloudflare Pages / GitHub Pages, gratuit) = base technique, suffisante en soi.
- **+ Empaquetage** (TWA/Bubblewrap pour Play, Capacitor pour iOS) pour entrer dans les stores.
  **N'enfreint pas** le principe « aucune donnée ne sort » : l'appli empaquetée reste 100 % locale.

| Store | Coût | Difficulté | Statut |
|---|---|---|---|
| **Google Play** | **25 $ une fois**, à vie | Faible (wrapper TWA/Capacitor, outillage gratuit) | **Proposé** — bon rapport visibilité/coût |
| **App Store (iOS)** | **99 $/an + un Mac** (ou build cloud) + revue | Élevée (Apple refuse les wrappers web « nus ») | **Optionnel**, plus tard si traction |

→ **Décidé** : commencer par **Play seul**, ajouter iOS plus tard si la traction le justifie.

**Fait le 2026-07-30 — le socle PWA est en place** : `manifest.webmanifest` (`display: standalone`),
icônes 192/512/maskable générées par `npm run icons:build`, balises iOS, service worker de
pré-cache, et le test automatisé « zéro requête réseau » de §6.6. Il servait au TWA ; il sert autant
à Capacitor, qui empaquette le même `dist/`.

**Reste à faire pour être sur Play** : ajouter Capacitor et son projet Android, brancher
`LocalNotifications`, générer l'APK, créer le compte développeur (25 $). Rien n'est engagé côté
argent. ~~Choisir l'hébergeur, déposer `assetlinks.json`~~ — sans objet depuis le 2026-07-31.

⚠️ **La boucle de développement ne change pas.** Capacitor n'a pas de moteur de rendu à lui : il
embarque le `dist/` produit par `vite build`. On continue de coder et de tester dans le navigateur ;
l'empaquetage n'intervient qu'à la publication.

---

## 4. Catalogue de recettes

- **150-200 recettes en v1** (confirmé) ; on **remplit davantage après**.
- Rappel : le contenu est le chemin critique du projet, pas le code (§8 ARCHITECTURE).

---

## 5. Marketing organique (0 €, aligné valeurs)

Cible = les gens qui **rejettent** les applis nutrition classiques. Regroupés et vocaux :

- **Mouvement anti-régime / intuitive eating** 🎯 — cible n°1. Rejettent calories, streaks,
  culpabilisation, tracking — que l'appli refuse par conception. Communautés
  « non-diet », diététiciennes non-diet sur les réseaux.
- **Communautés privacy** : r/privacy, r/degoogle, r/fossdroid — « 100 % local, aucune
  télémétrie, vérifiable » est leur came.
- **Cuisine du quotidien / anti-gaspi** : r/mealprep, r/eatcheapandhealthy, groupes FB
  anti-gaspi (le « vider le frigo »).
- **Show HN (Hacker News)** : angle *déterministe + auditable + no-AI + no-tracking + moteur
  explicable* = aimant à HN.
- **Product Hunt** : lancement gratuit, première vague.
- **Français d'abord** (v1 FR) : communautés FR, moins de concurrence anglophone.

**Arme principale = le récit** : « l'appli nutrition qui ne t'espionne pas, ne te culpabilise
pas, ne vend rien, marche sans compte ». En 2026, ce récit se partage tout seul. À écrire
(post de blog / thread).

---

## 6. Modèle « commercial » — aucun don, juste un lien « À propos »

Décision (alignée ETAT §3) : **pas de page de don, pas de Ko-fi/Liberapay, aucune sollicitation.**
L'appli est gratuite, point. Le seul élément « perso » est un **lien « À propos »** discret dans
les Paramètres → site / réseaux du projet : informatif, ne débloque rien, ne demande rien.

Justification : c'est la version la plus simple et la plus honnête de l'objectif « argent = bonus »
(§1) — on ne demande rien du tout. Et le coût récurrent est quasi nul (hébergement PWA statique
gratuit), donc il n'y a même pas de facture à couvrir. Un lien de don pur rapporterait de toute
façon une poignée d'euros (repère : « bien moins de 1 % » des utilisateurs donnent) — pas de quoi
justifier d'encombrer l'écran avec une demande.

---

## 7. Récap' des décisions

| Sujet | Décision |
|---|---|
| Objectif | Perso + partage gratuit ; argent = bonus |
| Modèle | 100 % gratuit, sans pub, sans tracking, local — **gardé, c'est le différenciateur** |
| Stores | **Play d'abord via Capacitor** (tranché 2026-07-31, 25 $ une fois) ; iOS plus tard. TWA écarté : pas de notifications programmées |
| Catalogue | 150-200 en v1, enrichi après |
| Marketing | Anti-régime + privacy + anti-gaspi + Show HN + Product Hunt, **FR d'abord** |
| Don | **Aucun.** Seulement un lien « À propos » discret, sans sollicitation |
| Principe | Différenciation (valeurs) ≠ distribution (tuyauterie) — garder les deux |
