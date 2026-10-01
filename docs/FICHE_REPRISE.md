# ⭐ Fiche de reprise — appli_nutrition

> **Une page, jamais plus — plafond dur : 100 lignes.** État vérifié + prochaine étape, rien d'autre.
> Avancement, décisions et dette : [ETAT.md](./ETAT.md) · Index : [README.md](./README.md) · Font
> foi : [ENGINE.md](./ENGINE.md) (moteur), [ARCHITECTURE.md](./ARCHITECTURE.md) (le reste).
> ⛔ **RÈGLE DE SURVIE, APPRISE AUX DÉPENS DE CETTE PAGE : un lot fini pose son fait dans `ETAT.md`
> ou dans son document de chantier, JAMAIS ici** — **le critère de tri n'est pas l'âge, c'est le
> doublon**. Dégonflée sept fois ; les blocs sortis sont en archive (dernière ligne du tableau).

## Le projet, et où on en est

Planificateur de repas **100 % local, sans IA, sans compte**. Moteur TypeScript pur, catalogue SQLite
au build, PWA React statique. La boucle tourne en entier : s'installer → allergies → suggestion →
semaine → courses → cuisiner.

```
MOTEUR ✅ ─ CONTENU ✅ ─ user.db ✅ ─ DESIGN ✅ ─ 12 ÉCRANS ✅ ─ TESTS D'ÉCRAN ✅ ─▶ CONTENU & DISTRIBUTION ▓▓
                                                                                          ⬅ ICI
```

⛔ **LE RELEVÉ QUI FAIT FOI VIT DANS [../CLAUDE.md](../CLAUDE.md) § « Vérifier », JAMAIS ICI** — avec
ses pièges de comptage (`| tail` rend le code du pipe ; un `it.each` nourri par une table de
production déplace le compte sans qu'aucun fichier de test change).
⚠️ **`git status -sb` donne l'état, jamais cette page.**

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

⛔ **LE HORS-LIGNE EST FERMÉ. CE QUI BLOQUE MAINTENANT, C'EST LE CONTENU.**
⭐ **LA PASSE À L'ŒIL SUR TÉLÉPHONE A EU LIEU LE 2026-09-12**, en APK natif — elle était due depuis
le 2026-08-21. Ce qu'elle a trouvé est trié en lots A → G dans
▶ **[CONCEPTION_RETOURS_APK.md](./CONCEPTION_RETOURS_APK.md)**, qui fait foi pour ce chantier.
(La passe de 2026-08-21, faite au navigateur, est close : `CONCEPTION_RETOURS_TEST.md`.)

- ▶ **AUCUN LOT OUVERT. Les lots A, B, C, D, E, F1, F2, H, I et J sont livrés ; la suite est F3**
  (« Proposer une autre semaine », reproduire d'abord), puis le tutoriel — ordre tranché le 2026-09-30 dans
  [CONCEPTION_RETOURS_APK.md](./CONCEPTION_RETOURS_APK.md). Le G se juge à l'œil et vient en dernier.
- ⚠️ **Rebâtir l'APK après les lots B → H et refaire une passe à l'œil** : ce que les tests jsdom ne
  savent pas voir ne se voit que là, et le lot A en est la démonstration.
  ⚠️ **En ouvrant un brief : nommer les réglages persistants que l'écran lit, et dire lesquels
  les clauses font varier.** C'est ce qui a manqué à `retour-2` — `ETAT.md` §8.

**Les chantiers TERMINÉS ne sont plus détaillés ici** — leur fait vit dans `ETAT.md` et dans leur
document de chantier. ⚠️ **Gestes illustrés : 3 sur 62 en base** — lot geste 2 arrêté à trois par
la décision D5, TOUJOURS OUVERT, sa clause en demande 51. Clips récoltés (7 gestes sans candidat),
photos (129/339, source), origine animale (66c), matériel (65c), retours test (1, 1b, 2, 3, 4, 5, 5b, 5c, 5d, 5e, 6, 7, 8 livrés).

**Ce qui reste à faire, et qui n'attend que d'être commencé :**

1. **Les mesures que seul un téléphone donne** — protocole et seuils :
   [RETOUR_ESSAI_TELEPHONE.md](./RETOUR_ESSAI_TELEPHONE.md) §0. ⚠️ Le chrono de `#/recettes`, seul
   chiffre qui manque pour fermer la décision 61, **n'a toujours pas été pris** — jamais en jsdom.
2. **Play Store** — l'APK de débogage se fabrique et s'installe (`ETAT.md` §8) ; ce qui reste est la
   signature, la fiche et la publication. Le web demeure le seul chemin vers un iPhone sans Mac.

⚠️ **Deux trous sanitaires bloquent la publication** (la relecture ne bloque plus depuis le lot I, `ETAT.md` §8) : céphalopodes et
cuisson de l'œuf, qu'aucune autorité lue ne donne — le principe 3 interdit d'écrire sans source.
⚠️ **Les questions ouvertes se comptent dans [decisions/registre.md](./decisions/registre.md) et se
résument en `ETAT.md` §4 — jamais ici.** Cette ligne en a annoncé NEUF pour DOUZE pendant six jours.

## Où chercher le reste

Les **six acquis** et les **quatre commandes qui font foi** vivent dans **[../CLAUDE.md](../CLAUDE.md)**, chargé à chaque session.

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
| **Blocs sortis de cette fiche, et lesquels avaient tort** | [08-22](./archive/FICHE_REPRISE_extraits_2026-08-22.md) · [08-14](./archive/FICHE_REPRISE_extraits_2026-08-14.md) · [08-11](./archive/FICHE_REPRISE_extraits_2026-08-11.md) · [08-10](./archive/FICHE_REPRISE_extraits_2026-08-10.md) · [08-09](./archive/FICHE_REPRISE_extraits_2026-08-09.md) · [08-07](./archive/FICHE_REPRISE_extraits_2026-08-07.md) · [08-03](./archive/FICHE_REPRISE_extraits_2026-08-03.md) |
| **Récit de la session `retour-1b` — sept clauses vertes sur dix, et le tutoriel cassé** | [RECAP 08-22](./archive/RECAP_SESSION_2026-08-22_tutoriel-qui-traverse.md) |
