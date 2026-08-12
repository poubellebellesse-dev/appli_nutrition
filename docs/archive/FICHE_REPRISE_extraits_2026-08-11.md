# Blocs sortis de `FICHE_REPRISE.md` le 2026-08-11 — sixième dégonflage

> **119 → 99 lignes.** Recopiés **verbatim**, sans retouche. Ce fichier dit, bloc par bloc, **où
> leur fait vit désormais** et **lesquels avaient tort**.
>
> ⚠️ **Dégonflage mené à DEUX SESSIONS DANS LE MÊME ARBRE, et ça se voit dans le compte** : pendant
> que celle-ci coupait, la lane « photos » enrichissait le point 3 de la fiche. Quatre estimations
> de longueur successives ont été fausses. **Le plafond de 100 lignes ne se vérifie pas de tête, il
> se compte** — `wc -l`, après chaque coupe, et jusqu'à ce que le nombre tienne.
>
> ⚠️ **LE CRITÈRE DE TRI N'EST PAS L'ÂGE, C'EST LE DOUBLON.** Un bloc sort d'ici quand son fait est
> déjà écrit ailleurs — dans `CLAUDE.md`, dans `ETAT.md`, ou dans un document de chantier. Un fait
> vrai et unique reste dans la fiche, même vieux. ⛔ **Le fait le plus cher de ce dégonflage était
> recopié dans `CLAUDE.md` depuis le 2026-08-09 sans que personne le remarque** — les deux copies
> disaient la même chose, l'une des deux était donc du poids mort qui poussait la fiche au-dessus
> de son plafond.

---

## 1. « ACTION RÉCURRENTE — `audit-mapping.mjs` » — **DOUBLON INTÉGRAL**

Verbatim :

> ⚠️ **ACTION RÉCURRENTE** : `node catalog/audit-mapping.mjs` — balayage identifiant ⇄ nom Ciqual,
> **451 mappings, 9 candidats** au 2026-08-10. **À relancer À LA MAIN après chaque lot de contenu**,
> et **uniquement dans l'arbre principal** : `documents Ciqual/` est gitignoré, donc ça ne peut ni
> devenir un test ni tourner dans un worktree. Premier passage : deux mappings faux que **aucun test
> ne pouvait voir** — un identifiant qui contredit sa ligne Ciqual ne fait rougir personne.

**Où le fait vit maintenant** : `CLAUDE.md`, section « Vérifier », sous « Une cinquième commande,
qu'aucun test ne remplacera ». Chargé à chaque session, donc lu avant la fiche.

**Avait-il tort ?** Non. Il était **exact et redondant** — le pire cas pour une page à plafond dur,
parce que rien ne signale un doublon : les deux copies se relisent juste et se confirment l'une
l'autre. Le compte « 451 mappings, 9 candidats » reste vrai au 2026-08-11.

---

## 2. « QUATRE CHANTIERS DE CODE SE SONT FERMÉS » — fait déplacé en `ETAT.md`

Verbatim :

> ✅ **QUATRE CHANTIERS DE CODE SE SONT FERMÉS** — sauces (①②③④), mode cuisine (L0→L4 **plus** durée
> écoulée, entrelacement actif/passif, matériel partagé), référence (équipement, repos, piquant,
> 22 recettes), photos (encodage et import). Détail en `ETAT.md` §8 et
> [CONCEPTION_MODE_CUISINE.md](../CONCEPTION_MODE_CUISINE.md) §4.3.

*(Seul le chemin relatif est ajusté — `./` → `../`, le fichier ayant changé de dossier. Les mots
sont ceux d'origine.)*

**Où le fait vit maintenant** : `ETAT.md` §8 et `CONCEPTION_MODE_CUISINE.md` §4.3 — que ce bloc
citait lui-même. Il ne faisait que pointer.

**Avait-il tort ?** Non, mais il enfreignait la règle écrite en tête de la fiche : *un lot fini pose
son fait dans `ETAT.md` ou dans son document de chantier, JAMAIS ici*. ⚠️ **Un bloc « ✅ ceci est
fermé » vieillit mal par nature** : il ne se supprime jamais tout seul, et chaque session en ajoute
un. C'est le mécanisme exact qui a fait passer la fiche de 207 à 268 lignes sans qu'aucune session
se trompe.

---

## 3. Le détail de « Vérifier sur un vrai téléphone » — replié sur une ligne

Verbatim :

> 3. **Vérifier sur un vrai téléphone.** `npx vite build && npx vite preview --host`, puis installer :
>    service worker et installation **ne s'activent qu'en build de production**. ⚠️ L'essai du
>    2026-08-05 était partiel — Chrome et non la WebView, **sur une maquette** : audio validé,
>    vibration morte, **pari `rem` à 150 % NON MESURÉ**, le seul dont l'échec toucherait les neuf
>    écrans. L'écran réel existe : `#/cuisine/chakchouka`, **en HTTPS** (`http://` fait disparaître
>    `navigator.wakeLock`, et l'échec ressemble à un défaut d'appareil). ▶ **Deux relevés dans le même
>    passage** : le chrono d'apparition de `#/recettes`, seul chiffre qui manque pour clore la
>    décision 61 et **que personne n'a jamais pris** ; et un Profiler sur appareil, seule façon de
>    trancher le re-rendu supposé. ⚠️ **Jamais par une mesure jsdom** — elle ne fait ni mise en page
>    ni peinture, et elle a déjà fait conclure faux ici même.

**Où le fait vit maintenant** : `RETOUR_ESSAI_TELEPHONE.md` — §0 porte le **protocole et le seuil
fixé à l'avance** (< 200 ms → décision 61 fermée · 200-500 → à rouvrir · > 500 → virtualiser), §1 à
§5 l'essai du 2026-08-02, §6 le lot de la session 8. La décision 61 d'`ETAT.md` §4 porte le reste,
avec les trois points de mesure et l'outillage `npm run mesure:61`.

**Avait-il tort ?** **Oui, sur un point — et la correction évidente était fausse elle aussi.**
« les neuf écrans » : il n'y en a pas neuf. Mais il n'y en a pas dix non plus, ce qu'`ETAT.md` §2
affirmait encore à deux endroits (« UI ✅ (10 écrans) », « les dix écrans »). ⛔ **Le compte juste
est celui de `ETAT.md` §5, qui porte les TROIS et interdit de les uniformiser : 8 spécifiés dans
`DESIGN.md`, 12 codés, 11 couverts par des tests d'écran** (`savoir.tsx` ne l'est pas). §5 avertit
lui-même que « dix codés, neuf testés » était **faux depuis le 2026-08-06** — le mode cuisine avait
été livré sans que la ligne bouge. **Trois documents portaient donc trois comptes différents, et
aucun des deux plus lus n'avait raison.** §2 et la fiche sont corrigés le 2026-08-11 ; §5 fait foi.
⚠️ Rien ne dépendait de ce nombre, et c'est précisément pourquoi il a dérivé sans résistance.
⚠️ **Le reste est vrai et important** :
le chrono d'apparition de `#/recettes` **n'a toujours pas été pris** au 2026-08-11, et c'est le seul
chiffre qui manque pour fermer la 61. La fiche le rappelle désormais en une ligne qui renvoie ici.

---

## 4. Le détail Capacitor — replié sur une ligne

Verbatim :

> 4. **Empaquetage Capacitor, puis Play.** ⚠️ La cible n'est plus TWA/Bubblewrap (2026-08-01).
>    `capacitor.config.ts` et `@capacitor/*` sont en place ; `npx cap add android` n'a jamais été
>    lancé (pas de SDK sur la machine). Le web reste le seul chemin vers un iPhone sans Mac.

**Où le fait vit maintenant** : `ETAT.md` §4 décision 9 (le choix Capacitor et sa date) et
`STRATEGIE_DISTRIBUTION.md` (stores, modèle, marketing).

**Avait-il tort ?** Non — et il **gagne en importance** le 2026-08-11 plutôt qu'il n'en perd : le
plafond AAB de 150 Mo qu'il implique est l'argument central de la décision 68, désormais forcée par
les 98 clips encodés. C'est pour ça qu'il sort **replié et pas supprimé** : la fiche garde la ligne
« Capacitor, `npx cap add android` jamais lancé », qui est l'état, et laisse l'argument au document
qui porte la décision.

---

## Les cinq dégonflages précédents

[08-10](./FICHE_REPRISE_extraits_2026-08-10.md) · [08-09](./FICHE_REPRISE_extraits_2026-08-09.md) ·
[08-07](./FICHE_REPRISE_extraits_2026-08-07.md) · [08-03](./FICHE_REPRISE_extraits_2026-08-03.md)
