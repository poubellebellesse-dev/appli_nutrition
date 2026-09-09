# Décisions figées — Produit & architecture

> Sorti intégralement de `ETAT.md` §3 le 2026-09-08 (cure, P-14). Texte non réécrit. Ne pas rediscuter sans raison.
> Index : [README.md](./README.md) · questions numérotées : [registre.md](./registre.md).

## Produit & architecture
- **PWA React + Vite + TypeScript**, SQLite WASM sur OPFS. Capacitor en porte de sortie.
- **Aucune donnée ne quitte l'appareil.** Pas de compte, pas de serveur, pas de télémétrie.
- **Aucune IA.** Le moteur est un solveur déterministe sous contraintes.
- **6 principes directeurs**, dont le n°6 « informer, jamais juger ».
- **Dépôt** : `github.com/poubellebellesse-dev/appli_nutrition`. Modèle : **Claude committe,
  l'utilisateur pousse** (le shell agent ne peut pas s'authentifier auprès de GitHub).
