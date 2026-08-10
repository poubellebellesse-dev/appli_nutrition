// Référence LOCALE au fichier plutôt qu'un `types` ajouté à tsconfig.json : `import.meta.env` n'est
// utilisé qu'ici, et modifier la configuration de compilation pour une seule ligne serait un
// changement de build à signaler pour rien.
/// <reference types="vite/client" />

// ui/sw-register.ts — enregistrement du service worker, et annonce des mises à jour.
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
//
// ⛔ CE QUI MANQUAIT, ET CE QUE ÇA COÛTAIT. `surMiseAJour` était déclaré, typé et appelé ici ; PAS
// UN APPELANT NE LE PASSAIT (`main.tsx`, `enregistrerServiceWorker()` nu). Le worker en attente
// restait donc en attente indéfiniment : recharger l'onglet NE SUFFIT PAS, il faut fermer tous les
// onglets de l'origine. Autrement dit, une mise à jour publiée n'atteignait personne, et rien à
// l'écran ne le disait. Septième occurrence du défaut maison — un champ déclaré n'est pas un champ
// branché.
//
// ⛔ ET LE CORRECTIF N'EST PAS `skipWaiting()` À L'INSTALLATION. Basculer seul remplacerait les
// fichiers sous les pieds de quelqu'un en train de composer sa semaine, et l'ancien code déjà
// chargé tournerait face à de nouveaux assets. On SIGNALE ; c'est l'interface qui propose, et c'est
// l'utilisateur qui décide.

/**
 * Rappel invoqué quand une nouvelle version est prête à prendre la main.
 *
 * `appliquer()` est le geste que le bandeau déclenche : il envoie `SKIP_WAITING` au worker en
 * attente, lequel prend la main et provoque le rechargement. ⚠️ **Le rappel ne DOIT PAS l'appeler
 * de lui-même** — ce serait le `skipWaiting()` automatique que l'en-tête écarte, par un autre
 * chemin.
 */
export type SurMiseAJour = (appliquer: () => void) => void

/**
 * L'abonné, et la mise à jour détectée avant qu'il n'existe.
 *
 * ⚠️ CE TAMPON N'EST PAS DE LA PRÉCAUTION GRATUITE. L'enregistrement se fait HORS React (voir la fin
 * de `main.tsx`) et l'abonnement dans un effet de la coquille : rien ne garantit l'ordre des deux,
 * et un worker peut déjà être en attente au chargement de la page — c'est même le cas le plus
 * fréquent, celui de quelqu'un qui rouvre l'application le lendemain d'une publication. Sans
 * tampon, cette annonce-là tomberait dans le vide et le bandeau ne s'afficherait jamais.
 *
 * Même canal que `surErreurDePersistance` (`ui/user-source.ts`) : un événement qui naît hors de
 * React et doit l'atteindre.
 */
let annonceur: SurMiseAJour | null = null
let enAttente: (() => void) | null = null

/** Abonne l'interface aux mises à jour. Le dernier abonné gagne — il n'y en a qu'un, la coquille. */
export function surMiseAJourDisponible(rappel: SurMiseAJour): void {
  annonceur = rappel
  if (enAttente !== null) {
    const appliquer = enAttente
    enAttente = null
    rappel(appliquer)
  }
}

/** Remet le canal à zéro entre deux tests. ⚠️ N'a aucun appelant en production, et c'est voulu. */
export function reinitialiserAnnonce(): void {
  annonceur = null
  enAttente = null
}

function signaler(appliquer: () => void): void {
  if (annonceur === null) enAttente = appliquer
  else annonceur(appliquer)
}

/**
 * Branche l'annonce des mises à jour sur un enregistrement déjà obtenu — EXPORTÉE POUR ÊTRE TESTÉE.
 *
 * ⚠️ `enregistrerServiceWorker` ci-dessous ne fait rien hors production, et jsdom n'a pas de
 * `navigator.serviceWorker` : tout ce qui décide se trouve donc ici, où des doublures suffisent.
 * Même parti que `versionDuCache` et `imagesPubliques` dans `vite-plugin-sw.ts`.
 *
 * @param container    `navigator.serviceWorker`, ou sa doublure
 * @param enregistrement l'enregistrement rendu par `register()`
 * @param recharger    ce qu'on fait quand le nouveau worker a pris la main (`location.reload`)
 */
export function brancherMiseAJour(
  container: ServiceWorkerContainer,
  enregistrement: ServiceWorkerRegistration,
  recharger: () => void
): void {
  /**
   * ⛔ AUCUN RECHARGEMENT QUI N'AIT ÉTÉ DEMANDÉ, et ce drapeau est la seule chose qui l'empêche.
   * `controllerchange` se déclenche AUSSI à la toute première installation, quand le
   * `clients.claim()` du worker généré prend la main. Recharger là recharge la page de quelqu'un
   * qui vient d'arriver, n'a rien demandé, et perdrait sa saisie en cours.
   */
  let demande = false

  container.addEventListener('controllerchange', () => {
    if (!demande) return
    // Remis à `false` avant de recharger : sur certains navigateurs l'événement se répète, et une
    // seconde entrée dans `reload()` est au mieux inutile, au pire une boucle.
    demande = false
    recharger()
  })

  const annoncer = (worker: ServiceWorker) => {
    signaler(() => {
      demande = true
      worker.postMessage({ type: 'SKIP_WAITING' })
    })
  }

  // ⚠️ LE CAS LE PLUS FRÉQUENT EST CELUI-CI, PAS `updatefound`. Un worker installé lors d'une visite
  // précédente attend déjà au chargement de la page ; `updatefound` ne se déclenchera jamais pour
  // lui, puisqu'il n'y a plus rien à trouver. Ne guetter que l'événement laissait l'utilisateur le
  // plus courant — celui qui revient le lendemain — sans bandeau.
  if (enregistrement.waiting !== null) {
    annoncer(enregistrement.waiting)
    return
  }

  enregistrement.addEventListener('updatefound', () => {
    const nouveau = enregistrement.installing
    if (nouveau === null) return
    nouveau.addEventListener('statechange', () => {
      // `controller` non nul = ce n'est pas la première installation, donc c'est bien une
      // MISE À JOUR. Sans ce test, on annoncerait une mise à jour au tout premier lancement.
      if (nouveau.state === 'installed' && container.controller !== null) annoncer(nouveau)
    })
  })
}

export function enregistrerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (enregistrement) => {
        brancherMiseAJour(navigator.serviceWorker, enregistrement, () => window.location.reload())
      },
      () => {
        // Échec silencieux : un service worker qui ne s'enregistre pas dégrade l'application
        // (plus de hors-ligne), il ne la casse pas. L'utilisateur n'a rien à faire de ce message.
      }
    )
  })
}
