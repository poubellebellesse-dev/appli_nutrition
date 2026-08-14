# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md) · Font
> foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> ⛔ **RÈGLE DE SURVIE, APPRISE AUX DÉPENS DE CETTE PAGE : un lot fini pose son fait dans `ETAT.md`
> ou dans son document de chantier, JAMAIS ici.** Sinon elle grossit seule, et **le critère de tri
> n'est pas l'âge mais le doublon**. Dégonflée six fois ; les blocs sortis sont en archive, dernière
> ligne du tableau ci-dessous — elle dit où leur fait vit et lesquels avaient tort.

## Le projet

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue
SQLite construit au build, PWA React servie en statique. La boucle complète tourne : s'installer →
allergies → suggestion → semaine → liste de courses → cuisiner.

## Où on en est

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 12 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

⚠️ **RELEVÉ DU 2026-08-14, SUR L'ARBRE DE TRAVAIL — LOT 66 CODÉ, PAS ENCORE COMMITÉ** :
`npm test` → **2 147 tests, 2 143 passed / 4 failed**, **112 fichiers** · typecheck propre ·
`npx vite build` ✓ (2,98 s) · `engine:plan-stress` → **20/20** · `audit-mapping` → 451 / 9 candidats
(inchangé).
⛔ **LES 4 ROUGES NE SONT PAS UNE RÉGRESSION : ce sont les tests scellés de la lane média**
(`gestes-champ-media.test.ts`), écrits avant leur code, donc rouges par construction. **Les six
tests scellés du lot 66 sont verts.** Ne pas lire ce relevé comme un arbre cassé.
⚠️ **LE COMPTE EST MONTÉ DE 2 136 À 2 147 SANS QU'AUCUN TEST DE PRODUCTION NE DISPARAISSE** : +6
pour les scellés du 66, +5 pour ceux de la lane média, sur 2 fichiers nouveaux. Un écart de compte
s'attribue par `git diff --name-only`, jamais par déduction — et ce relevé dit sur quel arbre il a
été pris, parce qu'un relevé du 2026-08-07 ne le disait pas et annonçait 22 tests de moins que
l'arbre.

⚠️ **`git status -sb` donne l'état, jamais cette page.** ⚠️ **Piège de relevé** : `npm test 2>&1 |
tail -25` rend le code de sortie du **pipe**, donc 0. Lire `Tests N failed`, jamais `$?`.
⚠️ **Le compte d'écrans se lit en `ETAT.md` §5, qui en porte TROIS et interdit de les uniformiser** :
**8 spécifiés**, **12 codés**, **11 testés**. Ni « neuf » ni « dix » n'était juste.

## ⛔ Travailler à plusieurs sessions dans cet arbre

**Cinq incidents payés, dont un qui a vidé l'arbre entier.** Trois gestes, sans exception :

1. **Jamais `git commit -a`** — commiter ses fichiers nommés un par un. L'index est partagé : un
   `git add` trop large a fait déclarer livré un lot dont **aucune ligne de code n'existait**.
2. **Jamais `git stash`** — `-- <chemins>` limite ce qu'on remise, **rien ne limite ce qu'on rend**.
   Si le mal est fait : `git stash list` **avant** `git reflog`, puis `git checkout stash@{0} --
   <chemins>`, jamais `pop`.
3. **`git status -sb` avant chaque commit.**

⛔ **AUCUN ✅ SANS `git log --all -S` SUR UN IDENTIFIANT DU CODE CONCERNÉ.** Un compte vert ne prouve
rien : celui de 1 940 était vrai sur un arbre qui n'existe plus. **Un écart de compte s'attribue par
`git diff --name-only`, jamais par déduction.** ⚠️ **HEAD est EN AVANCE sur `origin/main`** : Claude
committe, l'utilisateur pousse. ▶ Méthode complète : **[reference/PIEGES.md](./reference/PIEGES.md)**.

## ▶ La prochaine étape

⛔ **LE BLOCAGE N'EST PLUS LA RÉCOLTE, C'EST L'ACCROCHE** — les médias existent, rien ne les porte.

1. **▶ LE CHANTIER EST CADRÉ ET DÉBLOQUÉ — commencer par `/brief gestes-champ-media`.** Le lexique
   n'a toujours **aucun champ pour porter un média** (ni YAML, ni `catalog/build.mjs`, ni
   `LexiconEntry`, ni écran), mais le plan en 4 lots existe et **deux décisions sont tranchées**
   (2026-08-14) : **les deux formats vidéo** et **binaires versionnés dans git**. ▶ Plan, « Fini
   quand » et décisions restantes : **[CONCEPTION_GESTES_ILLUSTRES.md](./CONCEPTION_GESTES_ILLUSTRES.md)**.
   ✅ **Le lot 1 ne dépend d'aucune décision** ; ⛔ le motif « montrer un écran à Pexels » a été
   **écarté** — le chantier se fait pour lui-même. ▶ Historique :
   [archive/RECAP_SESSION_2026-08-11_clips-gestes.md](./archive/RECAP_SESSION_2026-08-11_clips-gestes.md) §7.
2. **🎬 Les clips de gestes sont FAITS** — 62/62 jugés, **51 illustrés, 98 segments de 3 s encodés**
   (AV1 + H.264 + poster, 22,4 Mo), sourcés un par un. **7 gestes n'ont aucun candidat** (`piquer`,
   `blanchir`, `essorer`, `effeuiller`, `gratiner`, `chinois`, `ecosser`) : homonymes, cause nommée
   pour chacun — ⛔ ne pas relancer une moisson sans changer la requête.
3. **📷 Photos — 116 importées · 13 décidées non importées · 201 recettes sans rien.** ⛔ **Pas un
   défaut de tri : bac épuisé, 19 recettes sans AUCUNE candidate** — goulot = la source. ⛔ Build-
   qui-échoue-sans-photo **interdit avant 330/330**. ▶ **Recadrage carré livré, PAS lu à l'import.**
4. **⛔ Relecture par un tiers du contenu Savoir** (`ETAT.md` §8.2 bis) — **bloquante avant
   publication**. 73 tips et 8 fiches sourcés un par un, **aucun relu**.
5. **Vérifier sur un vrai téléphone** — protocole et seuil fixés à l'avance :
   [RETOUR_ESSAI_TELEPHONE.md](./RETOUR_ESSAI_TELEPHONE.md) §0. ⚠️ Le chrono de `#/recettes`, seul
   chiffre qui manque pour fermer la décision 61, **n'a toujours pas été pris** — jamais en jsdom.
6. **Empaquetage Capacitor, puis Play** — `capacitor.config.ts` en place, `npx cap add android`
   jamais lancé (pas de SDK). Le web reste le seul chemin vers un iPhone sans Mac.

**Contenu qui reste** : photos, 27 tips sur la centaine visée, 8 fiches sur les 60-100.
⚠️ **Deux trous sanitaires, non comblés** : céphalopodes et cuisson de l'œuf, qu'aucune autorité lue
ne donne.

**Cinq arbitrages attendent** — `ETAT.md` §4. ⚠️ **64 et 67 en sont SORTIES** (fermées les 08-10 et
08-11) : **66** (invariant origine ⟺ provenance), **65** (⚠️ **réduite le 2026-08-13 : 65a est livré, la
table d'occupations et le partage existent ; ne reste que la quantité de feux possédés** ·
[plan](./CONCEPTION_RESERVATION_MATERIEL.md) · état : `ETAT.md` §3 et §4), **68** (budget P6 — ⚠️ **forcée depuis le
2026-08-11** : photos + clips ≈ 27,6 Mo contre un critère de 15, mais ce seuil visait un **premier
chargement web**, avant le cache à deux étages et Capacitor), **69** (licence Pexels « Standalone »),
et les **366 doublons d'affichage**, jamais posés.

## Où chercher le reste

Les **cinq acquis à ne pas défaire** et les **quatre commandes qui font foi** vivent dans
**[../CLAUDE.md](../CLAUDE.md)**, chargé à chaque session — plus recopiés ici.

| Question | Document |
|---|---|
| Avancement, décisions, **dette connue** (§8) | [ETAT.md](./ETAT.md) |
| Couches, algorithmes, API du moteur | [ENGINE.md](./ENGINE.md) |
| Périmètre produit, données, cadre légal · Écrans et jetons visuels | [ARCHITECTURE.md](./ARCHITECTURE.md) · [DESIGN.md](./DESIGN.md) |
| **Pièges, impasses payées, règle de sourçage** — à ouvrir avant de rouvrir un chantier | [reference/PIEGES.md](./reference/PIEGES.md) |
| **Licences des médias embarqués** — clauses citées, et ce qui n'a PAS pu être vérifié | [reference/LICENCES_MEDIAS.md](./reference/LICENCES_MEDIAS.md) |
| **Mode cuisine** : lots, questions ouvertes, essai sur appareil | [CONCEPTION_MODE_CUISINE.md](./CONCEPTION_MODE_CUISINE.md) |
| Écriture du contenu Savoir · Distribution | [tips](../catalog/tips/README.md) · [evidence](../catalog/evidence/README.md) · [STRATEGIE](./STRATEGIE_DISTRIBUTION.md) |
| Tri des photos et des clips : barème, décisions, outils | `../atelier/photos/REPRISE.md` · `../atelier/gestes/` (hors dépôt) |
| Ce qui a été essayé **et écarté** | [archive/](./archive/) — [README](./archive/README.md) apparie les pistes parallèles |
| **Blocs sortis de cette fiche, et lesquels avaient tort** | [08-11](./archive/FICHE_REPRISE_extraits_2026-08-11.md) · [08-10](./archive/FICHE_REPRISE_extraits_2026-08-10.md) · [08-09](./archive/FICHE_REPRISE_extraits_2026-08-09.md) · [08-07](./archive/FICHE_REPRISE_extraits_2026-08-07.md) · [08-03](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
