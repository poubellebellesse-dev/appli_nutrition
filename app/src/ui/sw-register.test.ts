// ui/sw-register.test.ts — l'annonce d'une nouvelle version, et les deux fois où elle doit se taire.
//
// ⚠️ CE FICHIER TESTE `brancherMiseAJour`, PAS `enregistrerServiceWorker`. Ce dernier sort au
// premier `if` hors production, et jsdom n'a de toute façon aucun `navigator.serviceWorker` :
// l'appeler ici ne vérifierait rien. Tout ce qui décide vit dans la fonction branchable, à qui des
// doublures suffisent — même parti que `versionDuCache` dans `vite-plugin-sw.ts`.
//
// ⛔ LES DEUX TESTS QUI COMPTENT SONT LES DEUX SILENCES : une première installation ne doit
// annoncer aucune mise à jour, et un `controllerchange` que personne n'a demandé ne doit recharger
// aucune page. Les deux feraient perdre à quelqu'un ce qu'il est en train de saisir.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { brancherMiseAJour, reinitialiserAnnonce, surMiseAJourDisponible } from './sw-register.js'

class FauxWorker extends EventTarget {
  state: ServiceWorkerState = 'installing'
  readonly recus: unknown[] = []

  postMessage(message: unknown): void {
    this.recus.push(message)
  }

  /** Reproduit la transition réelle : l'état change PUIS l'événement part. */
  passerA(etat: ServiceWorkerState): void {
    this.state = etat
    this.dispatchEvent(new Event('statechange'))
  }
}

class FauxContainer extends EventTarget {
  controller: ServiceWorker | null = null
}

class FauxEnregistrement extends EventTarget {
  waiting: ServiceWorker | null = null
  installing: ServiceWorker | null = null

  /** Reproduit `updatefound` : le nouveau worker est posé, PUIS l'événement part. */
  trouver(worker: FauxWorker): void {
    this.installing = worker as unknown as ServiceWorker
    this.dispatchEvent(new Event('updatefound'))
  }
}

interface Banc {
  readonly container: FauxContainer
  readonly enregistrement: FauxEnregistrement
  readonly recharger: () => void
  /** Ce que le canal a annoncé — un élément par mise à jour proposée. */
  readonly annonces: (() => void)[]
}

function banc(): Banc {
  const annonces: (() => void)[] = []
  surMiseAJourDisponible((appliquer) => annonces.push(appliquer))
  return {
    container: new FauxContainer(),
    enregistrement: new FauxEnregistrement(),
    recharger: vi.fn(),
    annonces,
  }
}

function brancher(b: Banc): void {
  brancherMiseAJour(
    b.container as unknown as ServiceWorkerContainer,
    b.enregistrement as unknown as ServiceWorkerRegistration,
    b.recharger
  )
}

beforeEach(() => {
  reinitialiserAnnonce()
})

describe('ui/sw-register — quand une mise à jour est annoncée', () => {
  it('un worker DÉJÀ en attente est annoncé tout de suite — le cas de celui qui revient le lendemain', () => {
    // `updatefound` ne se déclenchera jamais pour lui : il n'y a plus rien à trouver. Ne guetter
    // que l'événement laissait sans bandeau l'utilisateur le plus fréquent.
    const b = banc()
    const worker = new FauxWorker()
    b.enregistrement.waiting = worker as unknown as ServiceWorker

    brancher(b)

    expect(b.annonces).toHaveLength(1)
  })

  it('une mise à jour découverte pendant la visite est annoncée quand elle est installée', () => {
    const b = banc()
    b.container.controller = new FauxWorker() as unknown as ServiceWorker
    brancher(b)

    const nouveau = new FauxWorker()
    b.enregistrement.trouver(nouveau)
    expect(b.annonces).toHaveLength(0)

    nouveau.passerA('installed')
    expect(b.annonces).toHaveLength(1)
  })

  it('appliquer() envoie SKIP_WAITING au worker en attente, et rien d’autre', () => {
    const b = banc()
    const worker = new FauxWorker()
    b.enregistrement.waiting = worker as unknown as ServiceWorker
    brancher(b)

    b.annonces[0]!()

    expect(worker.recus).toEqual([{ type: 'SKIP_WAITING' }])
    // ⚠️ La bascule ne recharge PAS elle-même : c'est le worker qui prend la main, et c'est
    // `controllerchange` qui le dit. Recharger ici servirait l'ancienne version.
    expect(b.recharger).not.toHaveBeenCalled()
  })

  it('le rechargement suit la prise de main du nouveau worker', () => {
    const b = banc()
    b.enregistrement.waiting = new FauxWorker() as unknown as ServiceWorker
    brancher(b)

    b.annonces[0]!()
    b.container.dispatchEvent(new Event('controllerchange'))

    expect(b.recharger).toHaveBeenCalledTimes(1)
  })

  it('un controllerchange qui se répète ne recharge qu’une fois', () => {
    const b = banc()
    b.enregistrement.waiting = new FauxWorker() as unknown as ServiceWorker
    brancher(b)

    b.annonces[0]!()
    b.container.dispatchEvent(new Event('controllerchange'))
    b.container.dispatchEvent(new Event('controllerchange'))

    expect(b.recharger).toHaveBeenCalledTimes(1)
  })

  it('une annonce faite AVANT l’abonnement n’est pas perdue', () => {
    // L'enregistrement se fait hors React, l'abonnement dans un effet : l'ordre n'est pas garanti.
    reinitialiserAnnonce()
    const container = new FauxContainer()
    const enregistrement = new FauxEnregistrement()
    enregistrement.waiting = new FauxWorker() as unknown as ServiceWorker
    brancherMiseAJour(
      container as unknown as ServiceWorkerContainer,
      enregistrement as unknown as ServiceWorkerRegistration,
      () => undefined
    )

    const annonces: (() => void)[] = []
    surMiseAJourDisponible((appliquer) => annonces.push(appliquer))

    expect(annonces).toHaveLength(1)
  })
})

describe('ui/sw-register — ⛔ les deux silences, et c’est le sujet du lot', () => {
  it('⛔ LA PREMIÈRE INSTALLATION N’ANNONCE RIEN — `controller` est nul, ce n’est pas une mise à jour', () => {
    const b = banc()
    b.container.controller = null
    brancher(b)

    const nouveau = new FauxWorker()
    b.enregistrement.trouver(nouveau)
    nouveau.passerA('installed')

    expect(b.annonces).toEqual([])
  })

  it('⛔ UN controllerchange QUE PERSONNE N’A DEMANDÉ NE RECHARGE RIEN', () => {
    // Il se déclenche à la toute première installation, quand le `clients.claim()` du worker
    // généré prend la main. Recharger là recharge la page de quelqu'un qui vient d'arriver.
    const b = banc()
    brancher(b)

    b.container.dispatchEvent(new Event('controllerchange'))

    expect(b.recharger).not.toHaveBeenCalled()
  })

  it('un état intermédiaire n’annonce rien — seul « installed » compte', () => {
    const b = banc()
    b.container.controller = new FauxWorker() as unknown as ServiceWorker
    brancher(b)

    const nouveau = new FauxWorker()
    b.enregistrement.trouver(nouveau)
    nouveau.passerA('activating')
    nouveau.passerA('redundant')

    expect(b.annonces).toEqual([])
  })

  it('un `updatefound` sans worker installé ne lève pas et n’annonce rien', () => {
    const b = banc()
    brancher(b)

    b.enregistrement.installing = null
    b.enregistrement.dispatchEvent(new Event('updatefound'))

    expect(b.annonces).toEqual([])
  })
})
