// capacitor.config.ts — empaquetage Android (docs/STRATEGIE_DISTRIBUTION.md §3).
//
// ⚠️ CAPACITOR PLUTÔT QUE TWA, tranché le 2026-07-31. Un TWA est une page web dans un conteneur
// Chrome : il n'a accès qu'aux API du web, et celle qui aurait convenu pour les rappels de
// préparation — *Notification Triggers* — a été ABANDONNÉE par Google. Restaient le push serveur,
// qui contredit « 100 % local, sans compte » (§2), et un conteneur natif. Capacitor donne
// `LocalNotifications` : programmées sur l'appareil, hors ligne, sans serveur.
//
// ⚠️ `webDir` POINTE SUR LA SORTIE DE VITE, à la racine du dépôt. `vite.config.ts` a `root: 'app'`
// et `build.outDir: '../dist'` — le chemin est donc `dist/` vu d'ici, pas `app/dist/`. Se tromper
// produit un APK qui s'ouvre sur une page blanche, sans erreur de build.
//
// ⚠️ LA BOUCLE DE DÉVELOPPEMENT NE CHANGE PAS. Capacitor n'a pas de moteur de rendu : il embarque
// le `dist/` que produit `vite build`. On continue de coder et de tester dans le navigateur ;
// l'empaquetage n'intervient qu'à la publication.

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // ⚠️ À REMPLACER AVANT TOUTE PUBLICATION. L'identifiant d'application est DÉFINITIF une fois
  // publié sur Play : il ne se change plus, et une appli publiée sous `org.example` ne peut pas
  // être renommée sans repartir d'une fiche vierge. Laissé en évidence plutôt que masqué.
  appId: 'org.example.nutrition',
  appName: 'Nutrition',
  webDir: 'dist',
}

export default config
