# Courriers aux détenteurs de recettes

> Brouillons rédigés le **2026-08-04**, **non envoyés**. Ils accompagnent
> [SOURCES_RECETTES.md](./SOURCES_RECETTES.md) §3.1 (cuisine-libre.org) et §3.5 (mangerbouger.fr).
>
> ⚠️ **Trois règles tenues dans ces textes, à ne pas défaire en les réécrivant :**
> 1. **Aucune adresse e-mail n'est inventée.** cuisine-libre.org se joint par son formulaire,
>    <https://www.cuisine-libre.org/contact> — la page ne publie aucune adresse. Pour Santé publique
>    France, la voie n'est pas identifiée : passer par le formulaire institutionnel.
> 2. **Nulle part il n'est écrit que l'application est open source.** Il n'y a pas de fichier de
>    licence dans le dépôt et `package.json` ne porte pas de champ `license` : ce serait faux.
> 3. **Aucun engagement de gratuité perpétuelle n'est pris** — voir la note §3.
>
> À remplacer avant envoi : `[ton nom]`, `[ton contact]`.

---

## 0. Vérification des affirmations — relevé du 2026-08-04

⚠️ **Une première version de ces courriers contenait deux erreurs de fait.** Elles sont corrigées
ci-dessous. Ne pas réintroduire les formulations barrées en recopiant une version antérieure.

### cuisine-libre.org

| Affirmation | Vérifié |
|---|---|
| CC0 **342** + domaine public **261** = **603** recettes sans contrainte | ✅ exact, page `/licences` |
| Six licences listées : DP 261 · CC0 342 · LPRAB 3 · CC by 154 · CC by-sa **3 001** · GNU GPL 44 | ✅ (la note « CC BY-SA 3 000 » de SOURCES_RECETTES §3.1 est arrondie) |
| ~~« ~3 800 recettes » d'après leur page~~ | ❌ **aucun total n'est imprimé sur la page.** 3 805 est la somme des six compteurs, calculée par nous. Ne pas le leur attribuer, et **ne pas en tirer que la table est close** : le site peut compter plus de recettes que la somme. |
| **CC BY-NC-SA circule dans les flux mais n'est pas dans les six licences de la page** | ✅ **confirmé de première main.** Exemple citable : <https://www.cuisine-libre.org/barmbrack-simplifie> — « Recette partagée sous licence CC by-nc-sa par Motzee en novembre 2025 ». Présente dans le flux principal le 2026-08-04. |
| Les flux RSS portent le texte complet **et** la licence | ✅ quantités, étapes numérotées, images, mention « © CC by-sa », « © GNU GPL », « © CC by-nc-sa » |
| ~~11 recettes par flux~~ | ❌ **faux.** Le flux principal (`spip.php?page=backend`) en rend **12** le 2026-08-04 ; la page `/exporter` annonce **10** pour le widget JavaScript. « Onze » ne vient d'aucune source. → dire « une douzaine », daté. |
| Aucun filtre par licence | ✅ sur `/licences`, les six noms pointent vers les *deeds* Creative Commons externes, pas vers des listes internes filtrées |
| Pas d'API, pas de dump, invitation à décrire son besoin | ✅ mot à mot : « Ce site ne propose encore pas d'API, mais pourquoi pas. » et « Pour nous aider à définir ça, expliquez-nous vos besoins précisément : quels contenus ? dans quel format ? » |
| Page de contact | ✅ formulaire e-mail / sujet / message ; **aucune adresse publiée** |
| Leur position juridique affichée | ℹ️ leur page dit « les recettes de cuisine ne sont pas protégeables par le droit d'auteur ». **Ne pas leur opposer d'argument juridique** : les licences portent sur les textes, pas sur le procédé. Demander le service pratique, pas une permission. |

### mangerbouger.fr — Santé publique France

| Affirmation | Vérifié |
|---|---|
| Éditeur : Santé publique France, sous tutelle du ministère chargé de la Santé | ✅ mentions légales |
| *La Fabrique à menus* est active | ✅ `/manger-mieux/la-fabrique-a-menus/recettes` |
| Droits réservés | ✅ « Santé publique France et ses partenaires possèdent l'intégralité des droits de propriété intellectuelle et industrielle » |
| Usage non commercial imposé | ✅ « les informations utilisées ne doivent l'être qu'à des fins non commerciales (personnelles, associatives ou professionnelles), toute diffusion ou utilisation à des fins commerciales ou publicitaires étant exclues. » |
| Mention obligatoire | ✅ « l'ajout en bas de chaque contenu de la mention "Droits réservés Santé publique France" », **plus** « l'ajout de la mention : "… paru sur le site mangerbouger.fr" » avec **lien hypertexte** |
| ~~« Ces mentions m'interdisent la réutilisation sans votre accord »~~ | ❌ **FAUX, et c'était l'erreur grave.** Leurs mentions **autorisent** la reproduction d'« extraits textuels non modifiés » à titre non commercial, sous les deux conditions ci-dessus. Écrire l'inverse annonçait qu'on ne les avait pas lues. |
| ~~« ~2 000 recettes »~~ | ⚠️ **invérifiable** : la page recettes n'affiche aucun compteur (chargement par « Afficher plus de recettes »). Des tiers avancent ~2 300. → **ne citer aucun chiffre.** |

**Les deux vrais motifs de la demande à SPF**, une fois les mentions lues correctement :
1. **le volume** — reprendre l'ensemble des recettes n'est plus « des extraits », c'est la substance
   de la rubrique ;
2. **le lien hypertexte est insatisfaisable** — l'application est hors-ligne par conception : elle
   peut afficher l'URL, pas la rendre cliquable vers une page atteignable.

C'est un bien meilleur courrier que le précédent : il montre qu'on a lu leurs conditions et qu'on a
identifié précisément les deux clauses que notre cas met en tension.

---

## 1. cuisine-libre.org

**Voie :** <https://www.cuisine-libre.org/contact>
**Objet :** Réutilisation de recettes sous licence libre — application de nutrition gratuite et hors-ligne

Bonjour,

Je développe une application de planification de repas et de nutrition, gratuite et entièrement
hors-ligne, sans compte utilisateur. Elle embarque aujourd'hui 241 recettes que j'ai écrites moi-même
et 200 aliments issus de la table CIQUAL de l'ANSES.

Je cherche à élargir ce catalogue, et cuisine-libre.org est la piste la plus sérieuse que j'aie
trouvée en français. Avant toute chose : je ne veux pas passer par un robot d'aspiration. J'ai vu
qu'un *scraper* tiers circulait sur GitHub ; je préfère vous écrire.

**Deux points.**

**1. Cibler les recettes réutilisables.** Votre page « exporter » invite à expliquer précisément
quels contenus et dans quel format — voici donc ma demande. Vos flux RSS sont déjà remarquables :
ils portent le texte complet, les quantités, les étapes numérotées *et* la licence de chaque recette.
Mais ils ne rendent qu'une douzaine de publications récentes (douze dans le flux principal au moment
où j'écris) et ne se filtrent pas par licence. Existe-t-il un moyen d'obtenir la liste des recettes
en CC0 et en domaine public — 603 d'après vos compteurs —, ou plus largement un export filtrable par
licence ? Un simple fichier de liens me suffirait ; je n'ai pas besoin des contenus eux-mêmes, les
flux savent déjà les servir.

**2. Un écart que vous voudrez peut-être connaître.** Votre page « licences » recense six licences :
domaine public, CC0, LPRAB, CC by, CC by-sa et GNU GPL. Or le flux principal contient aujourd'hui au
moins une recette sous **CC by-nc-sa** — « Barmbrack simplifié », partagée par Motzee en novembre
2025. Cette licence n'apparaît nulle part sur la page « licences ». Ce n'est pas un reproche : c'est
le genre de détail qui piège un réutilisateur de bonne foi, la clause NC changeant tout.

Pour que vous sachiez à qui vous répondez : chaque recette reprise porterait sa source, son auteur et
sa licence, affichés à l'écran sous la forme « D'après *titre* — auteur · licence ». J'accepte le
partage à l'identique. L'application est gratuite, sans publicité, sans suivi et sans don ; elle
n'est pas encore publiée.

Merci pour le travail que représente ce site.

Cordialement,
**[ton nom]** — **[ton contact]**

---

## 2. Santé publique France — recettes de mangerbouger.fr

**Voie :** formulaire de contact de santepubliquefrance.fr ou de mangerbouger.fr.
**Objet :** Réutilisation des recettes de mangerbouger.fr dans une application hors-ligne — demande de précisions

Madame, Monsieur,

Je développe une application de planification de repas et de nutrition destinée au grand public. Elle
fonctionne entièrement hors ligne, sans compte, sans serveur et sans aucune collecte de données :
rien ne quitte l'appareil de l'utilisateur.

J'ai lu vos mentions légales. Elles autorisent la reproduction d'extraits textuels non modifiés à des
fins non commerciales, sous réserve d'ajouter la mention « … paru sur le site mangerbouger.fr » avec
un lien hypertexte, ainsi que la mention « Droits réservés Santé publique France » en bas de chaque
contenu. **Mon projet met deux de ces conditions en tension, et c'est la raison de ce courrier plutôt
que d'une reprise silencieuse.**

**Premièrement, le volume.** Je souhaiterais reprendre les recettes de *La Fabrique à menus* dans leur
ensemble, et non quelques-unes : à cette échelle, il ne s'agit plus d'« extraits » mais de la
substance de la rubrique. Il me paraît malhonnête de me prévaloir d'une clause manifestement écrite
pour la citation.

**Deuxièmement, le lien hypertexte.** L'application est hors-ligne par conception : elle n'a pas de
serveur et ne suppose aucune connexion. Elle peut afficher l'adresse de la recette d'origine en toutes
lettres, mais ne peut pas garantir un lien atteignable au moment de la lecture. La mention « Droits
réservés Santé publique France » et le crédit, eux, ne posent aucune difficulté et seraient affichés
sur chaque recette.

**Ce que je peux vous indiquer sur le projet :**

- **gratuit**, sans publicité, sans suivi, sans don et sans achat intégré à ce jour ;
- **aucune donnée de santé n'est collectée ni transmise** — l'application n'a pas de serveur ;
- le moteur de suggestion est **déterministe et auditable**, sans IA générative : il ne rédige aucun
  texte nutritionnel de lui-même et ne modifierait pas vos contenus ;
- l'application **informe et n'évalue pas** — aucun score global, aucun code couleur, aucun aliment
  désigné comme « sain » ou « mauvais » ;
- elle est en développement et **n'est pas encore publiée**.

**Trois questions :**

1. La reprise de l'ensemble des recettes, plutôt que d'extraits, entre-t-elle dans le cadre que vous
   accordez, ou demande-t-elle une autorisation distincte ?
2. Qu'est-ce qui satisferait la condition de lien hypertexte pour une application sans réseau —
   l'affichage de l'URL en clair suffirait-il ?
3. Que recouvre exactement l'usage « non commercial » pour une application gratuite distribuée sur un
   magasin d'applications ?

Je pose la troisième franchement : je ne suis pas en mesure de m'engager aujourd'hui à ce que cette
application reste gratuite indéfiniment, et je préfère vous le dire plutôt que de souscrire à un
engagement que je ne tiendrais peut-être pas. Si cela ferme la porte, je le comprendrai.

Je vous remercie de l'attention portée à cette demande.

**[ton nom]** — **[ton contact]**

---

## 3. Note sur le dernier paragraphe du courrier 2

Il est **délibéré**, pas une maladresse. `SOURCES_RECETTES.md` §3.5 relève que la clause NC
« interdirait pour toujours toute version payante », alors que `STRATEGIE_DISTRIBUTION.md` §1 laisse
« argent = bonus » ouvert. Obtenir une autorisation en laissant croire à un engagement perpétuel
coûterait plus cher plus tard qu'un refus aujourd'hui.

Si le choix est fait de **fermer** cette porte pour maximiser les chances d'obtenir l'accord,
remplacer le paragraphe par un engagement explicite de non-commercialité — et **le reporter en
décision figée dans `ETAT.md` §3**, parce qu'il liera le projet.

Aucune des deux réponses n'est bloquante pour la suite : sourcer les ~30 classiques du groupe A
(§7 point 2 bis) ne dépend ni de l'une ni de l'autre.
