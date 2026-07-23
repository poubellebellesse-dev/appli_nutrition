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

> ⚠️ **Non figé.** Piste recommandée, à valider avant tout achat de compte développeur.
> Cohérent avec ETAT §4 (« iOS : ouverte, reco PWA ») : la PWA reste la base ; passer en
> store est une **couche de distribution optionnelle**, pas une obligation.

Une **PWA seule n'est PAS dans les stores** → invisible là où les gens cherchent une appli.
Deux niveaux, à activer si on veut la découvrabilité :

- **PWA hébergée** (Cloudflare Pages / GitHub Pages, gratuit) = base technique, suffisante en soi.
- **+ Empaquetage** (TWA/Bubblewrap pour Play, Capacitor pour iOS) pour entrer dans les stores.
  **N'enfreint pas** le principe « aucune donnée ne sort » : l'appli empaquetée reste 100 % locale.

| Store | Coût | Difficulté | Statut |
|---|---|---|---|
| **Google Play** | **25 $ une fois**, à vie | Faible (wrapper TWA/Capacitor, outillage gratuit) | **Proposé** — bon rapport visibilité/coût |
| **App Store (iOS)** | **99 $/an + un Mac** (ou build cloud) + revue | Élevée (Apple refuse les wrappers web « nus ») | **Optionnel**, plus tard si traction |

→ **Reco (à confirmer)** : commencer par **Play seul**, ajouter iOS plus tard si la traction le
justifie. Rien n'est engagé tant que ce n'est pas validé.

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
| Stores | **Proposition (à confirmer)** — PWA + empaquetage ; Play (25 $ une fois) d'abord, iOS optionnel |
| Catalogue | 150-200 en v1, enrichi après |
| Marketing | Anti-régime + privacy + anti-gaspi + Show HN + Product Hunt, **FR d'abord** |
| Don | **Aucun.** Seulement un lien « À propos » discret, sans sollicitation |
| Principe | Différenciation (valeurs) ≠ distribution (tuyauterie) — garder les deux |
