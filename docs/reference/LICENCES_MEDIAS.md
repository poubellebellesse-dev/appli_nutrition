# Licences des médias — texte relevé, daté, et ce qui n'est pas vérifié

> **Ce document rapporte des textes, il ne rend pas d'avis juridique.** Chaque clause y est citée
> avec son URL, la date affichée sur la page et la date du relevé. Ce qui n'a pas pu être lu
> directement est marqué comme tel — **une lacune signalée vaut mieux qu'une lacune comblée au
> plausible**, et c'est la seule façon de savoir plus tard ce qu'il reste à revérifier.
>
> **Relevé du 2026-08-11.** Recherche déléguée, sources primaires exigées : la presse a servi à
> repérer et à dater, jamais à énoncer une clause.
>
> ⚠️ **RÉSERVE DE MÉTHODE, VALABLE SUR TOUT CE DOCUMENT.** Les citations proviennent d'un outil qui
> récupère la page et la fait relire par un modèle intermédiaire, **pas d'une lecture humaine du
> HTML brut**. Les clauses marquées ✅ ont été obtenues à l'identique sur deux passes indépendantes ;
> c'est le maximum atteignable ici, et ce n'est pas une vérification humaine.

---

## 1. Ce que le projet utilise aujourd'hui

**52 clips vidéo, tous Pexels, 33 auteurs distincts, 0 sans page source.** Aucun média Pixabay n'a
survécu au tri des gestes — un fonds unique évite d'avoir à se rappeler quelle clause s'applique à
quel fichier.

Le manifeste `<bac>/videos/clips-retenus.json` porte, pour chaque clip : auteur, URL de la page
source, licence, source. **Il est la pièce de traçabilité du principe 3** — un `.mp4` seul ne se
source plus. L'attribution n'est pas exigée par Pexels ; on la conserve quand même, un crédit absent
étant irrattrapable après coup.

---

## 2. Pexels — ce qui est autorisé

Source : `https://www.pexels.com/license/`, relevée le 2026-08-11.
⚠️ **Cette page n'affiche AUCUNE date de mise à jour.** À traiter comme une lacune, pas comme une
absence de révision.

✅ « All photos and videos on Pexels are free to use. »
✅ « You can modify the photos and videos from Pexels. »
- Attribution non obligatoire mais appréciée — **paraphrase, pas citation** : la formulation exacte
  n'a pas pu être extraite avec certitude.

Usage commercial couvert. Aucune clause distincte entre photo et vidéo n'a été trouvée, mais le
document des conditions générales n'a pas été lu ligne à ligne : **absence constatée, pas garantie**.

---

## 3. Pexels — les deux clauses d'interdiction, et pourquoi elles ne disent pas la même chose

**a) Page `/license/`** ✅
> « Don't redistribute or sell the photos and videos on other stock photo or wallpaper platforms. »

Elle vise nommément les **plateformes concurrentes**. Elle ne dit rien des logiciels qui embarquent
un média comme élément d'un produit plus large.

**b) Conditions générales `/terms-of-service/`, section 5** — page datée **« Last updated:
November 15th, 2024 »** ✅
> « You cannot sell or distribute the Content (either in digital or physical form) on a Standalone
> basis. »

avec la définition :
> « When we refer to "Standalone" we mean where no creative effort has been applied to the Content
> and it remains in substantially the same form as it exists on the Service. »

et les deux exemples donnés dans le même document :
> « using the Content in its original form or solely using a filter, changing colors, **resizing or
> cropping** the Content remains Standalone use. »
> « using the Content with a combination of images, videos, audio files, other media, text,
> illustrations, background features and editing techniques is not Standalone use, so long as the
> combined effect is to make a "new" creative work. »

⚠️ **LE POINT DUR : LE RECADRAGE ET LE REDIMENSIONNEMENT SONT NOMMÉMENT INSUFFISANTS.** Découper à
3 s, recadrer au carré et réduire à 480 px **ne constitue pas, à soi seul, l'effort créatif** qui
fait sortir du régime « Standalone ». La découpe temporelle et le ré-encodage ne sont pas nommés dans
le texte : ni permis, ni interdits.

⛔ **AUCUN TEXTE OFFICIEL NE TRANCHE NOTRE CAS** — des clips découpés et recadrés, embarqués dans le
paquet d'une application hors ligne distribuée gratuitement. Voir `ETAT.md` §4 décision **69**.

---

## 4. Pexels — droit à l'image : aucune garantie

Conditions générales, obligation mise à la charge du **contributeur qui téléverse**, pas de
l'utilisateur final ✅ :
> « you have obtained (and shall retain a copy of) any and all releases, permissions or licenses
> necessary to enable the use of the Content or Communications in accordance with these Terms. »

Non-garantie explicite ✅ :
> « We do not warrant that any consents or licenses have been obtained in relation to any Content. »
> « THE SERVICE, CONTENT AND COMMUNICATIONS ARE PROVIDED "AS IS". »

Restrictions d'usage ✅ :
> « Identifiable people may not appear in a bad light or in a way that is offensive. »
> « Don't imply endorsement of your product by people or brands on the imagery. »

⚠️ **CE QUE ÇA IMPOSE À LA PASSE DE TRI, CONCRÈTEMENT** : à qualité égale de démonstration du geste,
**préférer les mains au visage**. Un plan serré sur des mains n'a pas de question de droit à
l'image et illustre mieux le geste ; un visage identifiable à côté d'un propos de santé se lit comme
une caution — ce que la clause « endorsement » interdit et que le **principe 6** rejette déjà. Le
recadrage carré est l'outil qui règle les deux d'un coup.

---

## 5. CapCut — écarté pour la production, et pourquoi

**Décision : CapCut peut servir à explorer un cadrage. Les fichiers livrés passent par `ffmpeg`.**
Trois raisons, par ordre de force — la première ne dépend d'aucun texte juridique.

1. **Reproductibilité.** Le cadre est stocké en fractions dans `clips-decisions.json`, l'encodage est
   une commande mesurée : les 52 clips se refabriquent à l'identique. Cinquante-deux exports faits à
   la main dans une interface, non — et le format de sortie a déjà changé deux fois en une journée.
2. **Empilement de licences.** La sortie est aujourd'hui sous une licence unique, et le manifeste
   l'affirme geste par geste. Un seul élément CapCut dans l'export — transition, police, habillage —
   et cette affirmation devient fausse, sans que rien dans le fichier ne le signale.
3. **La licence accordée à ByteDance** (ci-dessous). Peu grave sur des clips de stock ; sérieuse le
   jour où les gestes manquants seront filmés sur place.

⚠️ **DIVERGENCE DE DATE NON RÉSOLUE.** La page `capcut.com/clause/terms-of-service` affiche
« Last updated: 15 April 2026 », mais le seul document lisible mot pour mot est le **PDF officiel du
CDN CapCut daté 2024.3.5** (26 pages, lues intégralement). Le PDF est peut-être une version périmée
non purgée. **Rien de ce qui suit n'est à jour de façon certaine.**

Licence accordée sur le contenu de l'utilisateur, PDF section 12 ✅ :
> « you hereby grant us and our affiliates, agents, services providers, partners and other connected
> third parties an unconditional, irrevocable, non-exclusive, royalty-free, fully transferable
> (including sub-licensable), perpetual, worldwide license to use, modify, adapt, reproduce, make
> derivative works of, display, publish, transmit, distribute and/or store your User Content »

⚠️ **En UE, ce paragraphe est explicitement écarté** — « The paragraphs under "User-Generated
Content" of Section 12 shall not apply » — et remplacé par une clause « Your Content » **toujours
perpétuelle, irrévocable, cessible et sous-licenciable**, mais sans « modify / adapt / make
derivative works ». Moins large ; large quand même.

Non-commercial par défaut, section 1 ✅ :
> « Our Services are generally provided for private, non-commercial use »

Cette restriction vise le contenu **fourni par CapCut** (musiques, effets, templates), réservé au
non-commercial hors « CapCut for Business ». **Que les exports personnels y échappent est une lecture
de structure, pas une clause** : le texte ne le dit pas en ces termes.

⛔ **Aucune clause d'entraînement de modèles d'IA trouvée** dans le PDF lu intégralement. Absence
constatée, **pas preuve d'absence de pratique**.

---

## 6. Ce qui n'a PAS pu être vérifié

| Élément | Obstacle |
|---|---|
| `help.pexels.com` (articles licence et usage commercial) | **HTTP 403** à chaque tentative. Contenu connu par indexation seulement — **ne pas citer entre guillemets** |
| Historique des versions Pexels | `web.archive.org` refusé par l'outil. Impossible de dater l'apparition de la clause « Standalone » |
| Formulation exacte de l'attribution facultative | Résumée sans guillemets par l'outil |
| Clause vidéo distincte de la clause photo | Non trouvée, mais sans lecture exhaustive du document |
| CapCut *Materials License Agreement* (« Last Updated: January 22, 2026 ») | **Jamais lu en direct**, uniquement résumé. C'est pourtant lui qui régit polices, effets et templates — donc le document qui déciderait de l'empilement de licences |
| CapCut, page en ligne d'avril 2026 | Texte brut non obtenu ; seul le PDF de 2024.3.5 est lisible mot pour mot |
| Politique de confidentialité CapCut (local contre nuage) | Résumé seulement. Les CGU ne disent **nulle part** quelles fonctions d'édition s'exécutent à distance |
| Une modification des CGU CapCut du 12 juin 2025 | Affirmée par la presse, **non confirmée sur source officielle datée** |

⚠️ **La version chinoise 剪映 / Jianying est régie par des documents entièrement séparés**, hors
`capcut.com` — pas des traductions. Sans effet ici, mais ça confirme que ByteDance publie des textes
juridiquement distincts par marché : un relevé fait sur un domaine ne vaut pas pour l'autre.

---

## 7. Ce qui en découle pour le code

1. **Ne jamais offrir un clip comme fichier séparé** — pas de bouton « télécharger le média », pas
   d'export de pack. Ça maintient l'usage du côté « composant d'un ensemble » plutôt que
   « distribution du Contenu », et ça ne coûte rien puisque personne ne l'a demandé.
2. **Le manifeste d'attribution reste**, bien qu'aucune licence ne l'exige.
3. **Les fichiers livrés sont produits par `ffmpeg`**, à partir des coordonnées de la passe de
   relecture — jamais à la main dans un éditeur tiers.
4. **Préférer les mains au visage** à qualité de démonstration égale (§4).
