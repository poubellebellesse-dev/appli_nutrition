// ui/retour-android.ts — le bouton retour d'Android (lot D).
//
// Sans écouteur `backButton`, Capacitor termine l'activité : un appui fermait l'appli depuis
// n'importe quel écran. Ici, UN écouteur, et une PILE de « ce qui se ferme d'abord ».
//
// ⚠️ UNE PILE DE MODULE, PAS UN CONTEXTE REACT. Les fenêtres passent par un portail, la visite
// aussi, et une fenêtre peut vivre dans une racine React séparée : la pile doit les voir toutes.
// Chaque entrée retire SA PROPRE place au démontage (jamais un `pop`) — `<StrictMode>` monte deux
// fois, et une fenêtre fermée par son propre bouton ne doit rien laisser derrière elle.
//
// ⚠️ SEUL IMPORTEUR DE `@capacitor/app`, SEUL APPEL À `exitApp` (clause 1 du lot D).

import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import { hashDe, routeDepuisHash } from './router.js'

interface Entree {
  readonly action: () => void
}

const pile: Entree[] = []

/**
 * Tant que le composant est monté, un appui sur retour appelle `action` — si rien n'a été monté
 * après lui. L'action lue est toujours la dernière rendue, sans que l'entrée change de rang.
 */
export function useRetourAndroid(action: () => void): void {
  const courante = useRef(action)
  courante.current = action
  useEffect(() => {
    const entree: Entree = { action: () => courante.current() }
    pile.push(entree)
    return () => {
      const rang = pile.lastIndexOf(entree)
      if (rang !== -1) pile.splice(rang, 1)
    }
  }, [])
}

export function quitterLAppli(): void {
  void App.exitApp()
}

/**
 * Pile vide : sur Aujourd'hui on quitte ; ailleurs on remonte l'historique, et sans historique
 * (appli ouverte directement sur un autre écran) on revient sur Aujourd'hui. « Aujourd'hui » se lit
 * sur la route à l'appui — `#/parametres` est de l'onglet `aujourdhui` mais n'est pas l'accueil.
 */
function surRetour(canGoBack: boolean): void {
  const dessus = pile[pile.length - 1]
  if (dessus !== undefined) {
    dessus.action()
    return
  }
  const route = routeDepuisHash(window.location.hash)
  if (route.onglet === 'aujourdhui' && route.sousVue.type === 'liste') {
    quitterLAppli()
    return
  }
  if (canGoBack) window.history.back()
  else window.location.hash = hashDe('aujourdhui')
}

/** Pose l'écouteur. À appeler une fois, au démarrage, dans le conteneur natif seulement. */
export function installerRetourAndroid(): void {
  void App.addListener('backButton', ({ canGoBack }) => surRetour(canGoBack))
}
