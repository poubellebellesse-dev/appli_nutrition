// Référence LOCALE au fichier plutôt qu'un `types` ajouté à tsconfig.json : `import.meta.env` n'est
// utilisé qu'ici, et modifier la configuration de compilation pour une seule ligne serait un
// changement de build à signaler pour rien.
/// <reference types="vite/client" />

// ui/sw-register.ts — enregistrement du service worker.
//
// ⚠️ CE N'EST PAS DU CONFORT, C'EST LA CONDITION DE LA PROMESSE PRODUIT. Sans service worker :
//   - l'application ne fonctionne pas hors ligne, alors que §2 ARCHITECTURE l'annonce ;
//   - elle n'est pas installable, donc pas d'icône sur l'écran d'accueil — et Safari efface les
//     données après 7 jours d'inactivité pour une PWA NON installée (§7, risque critique) ;
//   - Bubblewrap refuse de l'empaqueter en TWA, donc pas de Play Store.
//
// ⚠️ EN PRODUCTION SEULEMENT. Un service worker en développement sert des fichiers en cache pendant
// que Vite en pousse d'autres par HMR : on débogue alors une version qui n'existe plus. C'est une
// perte de temps classique, et elle est difficile à diagnostiquer parce que le code affiché est
// juste.

/** Rappel invoqué quand une nouvelle version est prête à prendre la main. */
export type SurMiseAJour = () => void

export function enregistrerServiceWorker(surMiseAJour?: SurMiseAJour): void {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (enregistrement) => {
        // ⚠️ ON NE BASCULE JAMAIS TOUT SEUL sur la nouvelle version. `skipWaiting()` automatique
        // remplacerait les fichiers sous les pieds d'un utilisateur en train de composer sa
        // semaine — pire, l'ancien code déjà chargé continuerait de tourner face à de nouveaux
        // assets. On SIGNALE, et c'est l'appelant qui propose de recharger.
        enregistrement.addEventListener('updatefound', () => {
          const nouveau = enregistrement.installing
          if (nouveau === null) return
          nouveau.addEventListener('statechange', () => {
            // `controller` non nul = ce n'est pas la première installation, donc c'est bien une
            // MISE À JOUR. Sans ce test, on annoncerait une mise à jour au tout premier lancement.
            if (nouveau.state === 'installed' && navigator.serviceWorker.controller !== null) {
              surMiseAJour?.()
            }
          })
        })
      },
      () => {
        // Échec silencieux : un service worker qui ne s'enregistre pas dégrade l'application
        // (plus de hors-ligne), il ne la casse pas. L'utilisateur n'a rien à faire de ce message.
      }
    )
  })
}
