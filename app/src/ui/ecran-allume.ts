// ui/ecran-allume.ts — empêcher la veille pendant une cuisson (§5bis point 1 ARCHITECTURE).
//
// ⚠️ LE VERROU TOMBE QUAND LE DOCUMENT DEVIENT `hidden`, PAS QUAND L'APPLI PERD LE FOCUS. La nuance
// est ce qui rend l'écran partagé utilisable : en fenêtres côte à côte, le document reste visible et
// le verrou tient. C'est aussi pourquoi il faut le REDEMANDER au retour — le navigateur le relâche
// pour nous, il ne le rend jamais tout seul.
//
// ⚠️ CONTEXTE SÉCURISÉ EXIGÉ. `navigator.wakeLock` n'existe pas en `http://` : servir un build sur
// `http://192.168.x.x` pour essayer sur un téléphone fait échouer l'API, et l'échec ressemble à un
// défaut de l'appareil (piège payé le 2026-08-05, `CONCEPTION_MODE_CUISINE.md` §7).
//
// ⚠️ DÉGRADATION MUETTE, JAMAIS D'ERREUR. Un navigateur sans l'API, une permission refusée, un
// onglet en arrière-plan : dans tous les cas la cuisson continue, seule la mention à l'écran change.
// Empêcher de cuisiner parce qu'on ne peut pas garder l'écran allumé serait absurde.

interface SentinelleVeille {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', ecouteur: () => void): void
}

interface ApiVeille {
  request(type: 'screen'): Promise<SentinelleVeille>
}

function apiVeille(): ApiVeille | null {
  const api = (navigator as Navigator & { wakeLock?: ApiVeille }).wakeLock
  return api ?? null
}

/** L'API est-elle seulement disponible ? Sert à choisir la mention affichée, jamais à bloquer. */
export function veillePossible(): boolean {
  return apiVeille() !== null
}

/**
 * Garde l'écran allumé tant que la fonction rendue n'est pas appelée.
 *
 * `surEtat` reçoit l'état réel après chaque tentative : c'est la seule façon honnête d'afficher
 * « l'écran reste allumé » — l'annoncer sans vérifier serait une promesse que rien ne tient.
 *
 * @returns de quoi tout relâcher, à brancher sur le nettoyage d'un effet React.
 */
export function garderEcranAllume(surEtat: (actif: boolean) => void): () => void {
  const api = apiVeille()
  if (api === null) {
    surEtat(false)
    return () => undefined
  }

  let sentinelle: SentinelleVeille | null = null
  let abandonne = false

  const demander = (): void => {
    if (abandonne || document.visibilityState !== 'visible') return
    api.request('screen').then(
      (obtenue) => {
        if (abandonne) {
          void obtenue.release()
          return
        }
        sentinelle = obtenue
        // Le navigateur relâche de lui-même (passage en arrière-plan, batterie faible) : l'écran
        // doit le DIRE plutôt que d'afficher une promesse périmée.
        obtenue.addEventListener('release', () => {
          if (sentinelle === obtenue) sentinelle = null
          if (!abandonne) surEtat(false)
        })
        surEtat(true)
      },
      // Permission refusée, onglet non visible, batterie faible : aucun de ces cas n'est une erreur
      // à remonter. La cuisson continue.
      () => {
        if (!abandonne) surEtat(false)
      }
    )
  }

  const auRetour = (): void => {
    if (document.visibilityState === 'visible' && sentinelle === null) demander()
  }

  document.addEventListener('visibilitychange', auRetour)
  demander()

  return () => {
    abandonne = true
    document.removeEventListener('visibilitychange', auRetour)
    if (sentinelle !== null) {
      void sentinelle.release()
      sentinelle = null
    }
  }
}
