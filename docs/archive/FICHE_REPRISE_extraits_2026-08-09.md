# Extraits datés sortis de la fiche de reprise le 2026-08-09

> **Instantané daté — ne jamais réécrire.** Ces blocs viennent de `FICHE_REPRISE.md`, où ils
> décrivaient des faits **vrais à leur date**. Ils en sortent en appliquant la règle que la fiche
> porte elle-même dans son en-tête : *« Chacun de ces blocs part le jour où son chantier se
> ferme. »* Les trois qui suivent décrivaient des chantiers fermés depuis le 2026-08-07.
>
> Rien n'est perdu et rien n'est corrigé : les blocs sont recopiés **tels quels**, avec les nombres
> qu'ils portaient. Plusieurs sont donc faux aujourd'hui — 1 669 tests, 91 fichiers, 305 recettes,
> et surtout « l'arbre est propre », qui a cessé d'être vrai le jour même. C'est voulu.
> ⚠️ **Ne jamais s'en servir pour établir l'état courant**, qui est dans
> [../FICHE_REPRISE.md](../FICHE_REPRISE.md) et [../ETAT.md](../ETAT.md).
>
> Précédents identiques : [FICHE_REPRISE_extraits_2026-08-03.md](./FICHE_REPRISE_extraits_2026-08-03.md)
> · [FICHE_REPRISE_extraits_2026-08-07.md](./FICHE_REPRISE_extraits_2026-08-07.md).

## Pourquoi ces blocs-là, et pas d'autres

| Bloc sorti | Où le fait vit maintenant |
|---|---|
| Le relevé du 2026-08-07 (1 669 tests, 91 fichiers, 305 recettes) | Remplacé sur la fiche par celui du 2026-08-09. Un relevé ne s'archive pas, il se **remplace** — mais celui-ci est gardé parce qu'il sert de point de comparaison à l'écart de comptes |
| Les 2 échecs d'`aujourdhui.test.tsx` | Fermés par `70e2493`. Le fait — *« quatre tests pariaient sur la taille du catalogue »* — vit dans `CLAUDE.md` et dans [RECAP_SESSION_2026-08-07_recettes-aliments.md](./RECAP_SESSION_2026-08-07_recettes-aliments.md) §5 |
| « L'arbre est propre, plus aucun lot en vol » | **Devenu faux le jour même.** Ce qui reste vrai est la méthode, pas l'état : elle est dans `reference/PIEGES.md` et rappelée en une ligne sur la fiche |
| Le dernier signal du banc de plan-stress | Éteint le 2026-08-07. Le fait — *« un catalogue qui suffit tout juste ne suffit pas »* — vit dans `CLAUDE.md` ; le détail dans [RECAP_SESSION_2026-08-07_recettes-aliments.md](./RECAP_SESSION_2026-08-07_recettes-aliments.md) §2 |

| Le bloc du tri des photos, dans sa version longue | **Sorti le même jour, par la session qui l'avait écrit** — voir §5 ci-dessous. Il reste sur la fiche, mais réduit à six lignes : les trois chiffres, la cause des 220, et les deux décisions qui bloquent l'import. Tout le reste — mesures, causes, chiffres corrigés — vit dans [RECAP_SESSION_2026-08-09_photos-fin-du-tri.md](./RECAP_SESSION_2026-08-09_photos-fin-du-tri.md) |

⚠️ **Le bloc du tri des photos avait d'abord été laissé en place**, bien que son chantier fût fermé :
il venait d'être réécrit le 2026-08-09 par une **autre session**, en direct dans le même arbre, et le
dégonfler aurait effacé son travail non commité. **Cette session l'a dégonflé elle-même dans la
foulée** — c'est la §5, et c'est la seule des cinq à ne pas venir d'un chantier tiers.

---

## 1. Le relevé du 2026-08-07

> ✅ **SUITE VERTE EN ENTIER — RÉEXÉCUTÉE LE 2026-08-07 SUR L'ARBRE COMPLET**, lot mode cuisine et
> facettes `cuisine` inclus.
> `npm test` → **1 669 passed / 0 failed**, **91 fichiers**, en 50,2 s · `npm run typecheck` propre ·
> `npx vite build` ✓ (2,9 s) · `npm run engine:plan-stress` → **20/20, PLUS AUCUN SIGNAL** ·
> `node catalog/build.mjs` → **451 aliments, 305 recettes, 1 415 étapes, 62 gestes, 73 tips,
> 8 fiches**.

## 2. Les 2 échecs d'`aujourdhui.test.tsx`

> ✅ **LES 2 ÉCHECS D'`aujourdhui.test.tsx` SONT FERMÉS** (`70e2493`) — l'arbitrage attendu ici a été
> rendu : les assertions étaient trop fortes, elles pariaient sur la taille du catalogue. Le récit de
> la bissection et la falsification qui a écarté la couche `piquant` restent dans
> [archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./RECAP_SESSION_2026-08-07_recettes-aliments.md) §5.

## 3. « L'arbre est propre — plus aucun lot en vol »

⚠️ **Ce bloc est le plus instructif des trois, parce qu'il a eu tort en moins de 48 h.** Il annonçait
un arbre vide de tout lot ; le 2026-08-09, **trois sessions** y écrivaient en même temps et une
quarantaine de fichiers étaient modifiés. Un état d'arbre ne se met pas dans un document : il se lit
avec `git status -sb`, ce que le bloc disait lui-même deux lignes plus haut.

> ✅ **L'ARBRE EST PROPRE — PLUS AUCUN LOT EN VOL, 2026-08-07.** Les trois lots qui traînaient sont
> commités (décisions 33 et 35 et dette §8 dans `5b63e5f`, rouge d'`aujourdhui.test.tsx` fermé par
> `70e2493`, branche `recette-aliments` disparue), **et les deux derniers lots en vol le sont aussi** :
> les 8 plats végétaliens sans gluten, puis le lot mode cuisine + facettes `cuisine`.
> **Le découpage à trois pistes qui bloquait tout commit n'existe plus.**

## 4. Le dernier signal du banc

> ✅ **LE DERNIER SIGNAL DU BANC EST ÉTEINT — 2026-08-07, lot « 8 plats végétaliens sans gluten ».**
> « végétalien + sans gluten, 14 j × 4 » passe de **27/28 à 28/28 accompagnements**, plancher
> **1 302 → 1 530 kcal**. ⚠️ **La cause mesurée n'était pas celle que cette page annonçait.** Elle
> disait « il manque des plats » ; le compte exact dit **marge zéro** : le catalogue portait
> **exactement 28** plats végétaliens ET sans gluten portant `dejeuner` ou `diner`, pour **exactement
> 28 créneaux** (14 j × 2). Il suffisait qu'un seul soit écarté par une autre contrainte pour qu'un
> créneau reçoive un non-plat — et `pickAccompagnement` sort dès que la recette posée n'est pas
> `service: 'plat'`. Ils sont **36**. **Un catalogue qui suffit tout juste ne suffit pas** : c'est le
> fait à retenir, pas le nombre.
> ⚠️ **Reste vrai, et c'est ce qui a guidé le lot** : le manque est dans les PLATS, jamais dans les
> accompagnements — tripler les accompagnements végétaliens (11 → 29) n'avait pas bougé le compteur
> d'une unité. Détail :
> [archive/RECAP_SESSION_2026-08-07_recettes-aliments.md](./archive/RECAP_SESSION_2026-08-07_recettes-aliments.md) §2.

## 5. Le tri des photos, version longue

> 🏁 **LE TRI DES PHOTOS EST TERMINÉ — LE BAC EST VIDE (2026-08-06 → 08-09).** Outil :
> `atelier/photos/` (**gitignoré, hors de `app/`**, `vite.config.ts` pose `root: 'app'`). Détail du
> chantier : **`atelier/photos/REPRISE.md`** (hors dépôt) · récit :
> **[archive/…_photos-fin-du-tri.md](./RECAP_SESSION_2026-08-09_photos-fin-du-tri.md)**.
>
> **Les trois seuls chiffres à citer** : **88** recettes avec une photo validée · **220** sans ·
> **22** photos validées pour un plat absent du catalogue. 2 740 couples (image × recette) jugés,
> 178 décisions humaines. **Il n'y a plus de lot à tirer.**
>
> ⛔ **Les 220 ne sont pas un problème de tri, c'est la récolte qui n'a pas rapporté.** 201 d'entre
> elles ont vu passer **2 059 photos distinctes**, et **94 en ont vu plus de dix sans en garder
> aucune**. ▶ **Relancer une récolte sous un troisième angle, ne pas rejuger le bac** — il est vide.
> Le défaut de ciblage (`lire_csv` de `chercher_photos.py` retombe **en silence** sur le slug de
> recette quand la colonne de requête est vide, d'où une libellule dans `photos/crepes/`) **n'est
> toujours pas corrigé** ; il rendait 2,2 % de `oui` contre 5,6 % sur un dossier ciblé. Le fichier
> `recettes-appli.csv` (224 recettes, vérifié) attend dans `G:\Claude\Dessinateur\recettes\`, et
> **c'est à l'utilisateur de le lancer** — réseau et clés API.
>
> ⚠️ **`image_path` n'est encore posé nulle part : trier n'est pas rattacher.** L'étape d'import
> n'est **pas écrite**, et **elle est bloquée sur le ré-encodage**.
> ⛔ **LE RÉ-ENCODAGE EST REQUIS — ET LA MESURE QUI DISAIT LE CONTRAIRE, ÉCRITE LE MÊME JOUR, LISAIT
> LE MAUVAIS CRITÈRE.** Les 88 photos retenues pèsent **19,9 Mo**, médiane **189 Ko** : **2 sur 88**
> tiennent dans le budget de **40 Ko par image** du critère de sortie P6 (`ETAT.md:1261`), et les
> 19,9 Mo dépassent à eux seuls le « bundle < 15 Mo », avant `catalog.db` et le JS. Le poids des
> fichiers **à stocker** ne dit rien du budget **à expédier**. ⚠️ **Aucun encodeur n'est présent sur
> la machine** (ni `sharp`, ni `magick`, ni `ffmpeg`, ni `cwebp`, ni Pillow) — **installer quelque
> chose est donc une décision, pas un détail d'exécution**, et elle se prend sur 88 photos plutôt que
> sur 308.
> ⚠️ **Deuxième conséquence non vue : `vite-plugin-sw.ts:39` `ASSETS_PUBLICS` est une liste ÉCRITE À
> LA MAIN.** Des images posées dans `public/` n'y entreraient pas, donc **ne seraient pas
> pré-cachées** — invisibles hors ligne, ce que le principe 5 interdit. L'en-tête du plugin dit
> lui-même qu'une liste écrite à la main est le défaut qu'il existe pour éviter : il faut l'énumérer
> au build, pas y coller 88 lignes.
> ✅ Ce qui reste vrai : **deux extensions mentent, pas 212** (ce chiffre portait sur le bac entier),
> et **0 fichier manquant**. Arbitrages toujours ouverts : les **binaires qui entrent dans
> l'historique git**, et **où la photo s'affiche** — ⚠️ `ui/vignette.ts` ne sert **pas** l'aplat
> « partout », un seul écran l'utilise (`screens/aujourdhui.tsx`) ; `detail-recette.tsx` n'a aucun
> bloc visuel, l'y poser est une décision de `DESIGN.md` §4.1, pas un branchement.
>
> ⚠️ **231 plats du bac n'existent pas dans le catalogue (3 007 photos).** Le serveur **refuse
> structurellement un `oui`** dessus (`donnees.mjs:633` les préfixe `hors:`) — la garantie est dans le
> code. La liste penche vers les plats carnés et **entre en tension avec la direction végétale du
> catalogue** : habiller ces photos, ce serait laisser la photothèque décider du contenu.
