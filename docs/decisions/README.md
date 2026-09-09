# docs/decisions/ — ce qui a été tranché

> Créé le 2026-09-08 en sortant `ETAT.md` §3 et §4 (cure, problème P-14). Texte non réécrit.
> Une décision figée ne se rediscute pas sans raison ; une question ouverte se tranche dans
> [registre.md](./registre.md), jamais ailleurs.

| Fichier | Contenu | Ex-section |
|---|---|---|
| [01-produit-architecture.md](./01-produit-architecture.md) | Local, sans IA, sans compte, PWA | §3 |
| [02-sante.md](./02-sante.md) | Le choix structurant : aucune collecte de santé, évictions par régime déclaré, allergènes sourcés | §3 |
| [03-moteur.md](./03-moteur.md) | Registre à 18 couches, garde-fous, poids, mesures | §3 |
| [04-design.md](./04-design.md) | Écrans, parcours, jetons, accessibilité, mode cuisine | §3 |
| [05-media-stockage-modele.md](./05-media-stockage-modele.md) | Photos, clips, cache, `user.db`, OPFS, schéma | §3 |
| [06-communaute-contenu.md](./06-communaute-contenu.md) | Partage sans serveur, contenu Savoir | §3 |
| [07-multi-langue.md](./07-multi-langue.md) | Structure maintenant, contenu plus tard | §3 |
| [08-positionnement.md](./08-positionnement.md) | Analyse marché | §3 |
| [registre.md](./registre.md) | **Questions numérotées 1 → 82**, barrées quand fermées | §4 |

Règles héritées de `ETAT.md` :

- Une nouvelle question prend le numéro suivant dans `registre.md` ; un numéro n'est jamais réattribué.
- Fermer une question = barrer son numéro **et** laisser la ligne avec son raisonnement.
- Une décision de lot (`/brief`) vit dans son document de chantier `docs/CONCEPTION_*.md`, pas ici,
  sauf si elle fige quelque chose pour tout le projet — alors elle s'ajoute au fichier de thème.
- Les références « `ETAT.md` §3 » et « `ETAT.md` §4 » dans le code et les documents antérieurs au
  2026-09-08 pointent ici ; `ETAT.md` garde ces deux titres comme renvois.
