# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md) · Font
> foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> ⛔ **RÈGLE DE SURVIE, APPRISE AUX DÉPENS DE CETTE PAGE : un lot fini pose son fait dans `ETAT.md`
> ou dans son document de chantier, JAMAIS ici.** Sinon elle grossit seule — chaque lot ajoute son
> récit, aucun n'en repart, et à plusieurs sessions le solde est positif : 207 → 239 lignes le
> 2026-08-09, puis **268** le 2026-08-10, sans qu'aucune session se soit trompée. Dégonflée cinq
> fois ; les blocs sortis sont recopiés verbatim en archive, qui dit **où leur fait vit désormais**
> et **lesquels avaient tort** (voir la dernière ligne du tableau ci-dessous).

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 9 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

✅ **SUITE VERTE EN ENTIER — RELEVÉ DU 2026-08-10, SUR L'ARBRE COMMITÉ** (`1918626`) :
`npm test` → **1 953 passed / 0 failed**, **101 fichiers** · `npm run typecheck` propre ·
`npx vite build` ✓ (2,80 s) · `npm run engine:plan-stress` → **20/20**.

⚠️ **`git status -sb` donne l'état, jamais cette page.** Un nombre écrit ici est faux dès le commit
suivant. ⚠️ **Piège de relevé** : `npm test 2>&1 | tail -25` rend le code de sortie du **pipe**,
donc 0. Lire le compte `Tests N failed`, jamais `$?`.

**L'application fait sa boucle complète** : s'installer → déclarer ses allergies → voir une
suggestion → planifier sa semaine → sortir sa liste de courses → cuisiner. Plus « partir de ce
qu'on a », un lexique de 62 gestes, et l'onglet Savoir complet.

## ⛔ Travailler à plusieurs sessions dans cet arbre

**Cinq incidents payés, dont un qui a vidé l'arbre entier.** Trois gestes, sans exception :

1. **Jamais `git commit -a`** — commiter ses fichiers nommés un par un. L'index est partagé : un
   `git add` trop large a fait déclarer livré, en août, un lot dont **aucune ligne de code
   n'existait**.
2. **Jamais `git stash`** — il n'a pas de forme sûre ici. `-- <chemins>` limite ce qu'on remise,
   **rien ne limite ce qu'on rend**. Committer son lot est le seul geste qui ne prend pas l'arbre
   des autres en otage. Si le mal est fait : `git stash list` **avant** `git reflog`, puis
   `git checkout stash@{0} -- <chemins>`, jamais `pop`.
3. **`git status -sb` avant chaque commit.**

⛔ **AUCUN ✅ SANS `git log --all -S` SUR UN IDENTIFIANT DU CODE CONCERNÉ.** Un compte de tests vert
ne prouve rien : celui de 1 940 était vrai sur un arbre qui n'existe plus. **Un écart de compte
s'attribue par `git diff --name-only`, jamais par déduction** — à trois sessions, chacune voit
l'écart depuis SON relevé et l'impute par défaut à sa voisine.
⚠️ **HEAD est EN AVANCE sur `origin/main`.** Claude committe, l'utilisateur pousse — le shell agent
ne peut pas s'authentifier auprès de GitHub.
▶ Méthode complète, découpage et contre-exemples : **[reference/PIEGES.md](./reference/PIEGES.md)**.

## ▶ La prochaine étape

⚠️ **ACTION RÉCURRENTE** : `node catalog/audit-mapping.mjs` — balayage identifiant ⇄ nom Ciqual,
**451 mappings, 9 candidats** au 2026-08-10. **À relancer À LA MAIN après chaque lot de contenu**,
et **uniquement dans l'arbre principal** : `documents Ciqual/` est gitignoré, donc ça ne peut ni
devenir un test ni tourner dans un worktree. Premier passage : deux mappings faux que **aucun test
ne pouvait voir** — un identifiant qui contredit sa ligne Ciqual ne fait rougir personne.

✅ **QUATRE CHANTIERS DE CODE SE SONT FERMÉS** — sauces (①②③④), mode cuisine (L0→L4 **plus** durée
écoulée, entrelacement actif/passif, matériel partagé), référence (équipement, repos, piquant,
22 recettes), photos (encodage et import). Détail en `ETAT.md` §8 et
[CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) §4.3.

**Ce qui reste, par ordre de dépendance :**

1. **📷 La récolte de photos — 116 / 330.** ⛔ **Ce n'est pas un défaut de tri : le bac est de
   nouveau épuisé, plus une seule candidate non jugée, et 19 recettes n'ont AUCUNE candidate.** Le
   goulot est la **source**. Relancer une session sans en changer rendra le même résultat. ⛔ « le
   build échoue sans photo » : **interdit avant 330/330**. ⚠️ **Et à 330/330 le bundle dépasserait
   les 15 Mo du critère P6 — décision 68, ouverte, à trancher AVANT de produire les 214 restantes.**
2. **⛔ Relecture par un tiers du contenu Savoir** (`ETAT.md` §8.2 bis) — **bloquante avant
   publication**. Les 73 tips et les 8 fiches sont sourcés un par un, **aucun n'est relu**. Un build
   qui passe ne rend pas le contenu publiable.
3. **Vérifier sur un vrai téléphone.** `npx vite build && npx vite preview --host`, puis installer :
   service worker et installation **ne s'activent qu'en build de production**. ⚠️ L'essai du
   2026-08-05 était partiel — Chrome et non la WebView, **sur une maquette** : audio validé,
   vibration morte, **pari `rem` à 150 % NON MESURÉ**, le seul dont l'échec toucherait les neuf
   écrans. L'écran réel existe : `#/cuisine/chakchouka`, **en HTTPS** (`http://` fait disparaître
   `navigator.wakeLock`, et l'échec ressemble à un défaut d'appareil). ▶ **Deux relevés dans le même
   passage** : le chrono d'apparition de `#/recettes`, seul chiffre qui manque pour clore la
   décision 61 et **que personne n'a jamais pris** ; et un Profiler sur appareil, seule façon de
   trancher le re-rendu supposé. ⚠️ **Jamais par une mesure jsdom** — elle ne fait ni mise en page
   ni peinture, et elle a déjà fait conclure faux ici même.
4. **Empaquetage Capacitor, puis Play.** ⚠️ La cible n'est plus TWA/Bubblewrap (2026-08-01).
   `capacitor.config.ts` et `@capacitor/*` sont en place ; `npx cap add android` n'a jamais été
   lancé (pas de SDK sur la machine). Le web reste le seul chemin vers un iPhone sans Mac.

**Contenu qui reste** : photos, lexique illustré, 27 tips pour la centaine visée, 8 fiches sur les
60-100 visées. ⚠️ **Deux trous sanitaires déclarés, non comblés** : les céphalopodes (`calamar`,
`poulpe`) et le critère de cuisson de l'œuf, qu'aucune autorité lue ne donne.

**Trois questions attendent un arbitrage** — `ETAT.md` §4 : décision **64** (un dérivé de viande
servi à un végétarien — 5 aliments, mesuré, non corrigé), **65** (la réservation d'équipement,
bloquée par deux colonnes absentes du catalogue), et les **366 doublons d'affichage**, jamais posés.

## Où chercher le reste

Les **cinq acquis à ne pas défaire** et les **quatre commandes qui font foi** vivent dans
**[../CLAUDE.md](../CLAUDE.md)**, chargé à chaque session — plus recopiés ici.

| Question | Document |
|---|---|
| Avancement, décisions, **dette connue** (§8) | [ETAT.md](./ETAT.md) |
| Couches, algorithmes, API du moteur | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal · Écrans et jetons visuels | [ARCHITECTURE.md](./ARCHITECTURE.md) · [DESIGN.md](./DESIGN.md) |
| **Pièges, impasses payées, règle de sourçage** — à ouvrir avant de rouvrir un chantier | [reference/PIEGES.md](./reference/PIEGES.md) |
| **Mode cuisine** : lots, questions ouvertes, essai sur appareil | [CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) |
| Écriture du contenu Savoir · Distribution | [tips](../catalog/tips/README.md) · [evidence](../catalog/evidence/README.md) · [STRATEGIE](./STRATEGIE_DISTRIBUTION.md) |
| Tri des photos : barème, décisions, régénération | `../atelier/photos/REPRISE.md` (hors dépôt) |
| Ce qui a été essayé **et écarté** | [archive/](./archive/) — [README](./archive/README.md) apparie les pistes parallèles |
| **Blocs sortis de cette fiche, et lesquels avaient tort** | [08-10](./archive/FICHE_REPRISE_extraits_2026-08-10.md) · [08-09](./archive/FICHE_REPRISE_extraits_2026-08-09.md) · [08-07](./archive/FICHE_REPRISE_extraits_2026-08-07.md) · [08-03](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
