// @vitest-environment jsdom
//
// ui/panneau.test.tsx — la fenêtre superposée et sa promesse d'accessibilité.
//
// ⚠️ CE FICHIER EXISTE POUR UNE PROMESSE QUI ÉTAIT FAUSSE. `Panneau` porte `aria-modal="true"`,
// qui annonce aux technologies d'assistance que le reste de la page est INERTE. Rien ne bornait
// `Tab`/`Shift+Tab` : au clavier, on sortait de la fenêtre par le haut et on tabulait dans l'écran
// qu'elle recouvre. L'attribut mentait, et aucun test ne pouvait le dire — les tests d'écran
// existants vérifient la PRÉSENCE du dialogue (`getByRole('dialog')`), jamais son confinement.
//
// ⚠️ ON TESTE LE COMPOSANT, PAS UN ÉCRAN. Le confinement est une propriété de `Panneau` ; la
// vérifier depuis `recettes.tsx` ou `parametres.tsx` la lierait au contenu de ces écrans, et
// personne ne saurait lequel des deux couvre la règle.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Panneau } from './panneau.js'

afterEach(cleanup)

/** Un bouton HORS de la fenêtre : c'est lui que `Tab` ne doit jamais atteindre. */
function monter(contenu: React.ReactNode, onFermer = () => undefined) {
  return render(
    <div>
      <button type="button" data-dehors>
        Bouton de la page en dessous
      </button>
      <Panneau titre="Mon régime" onFermer={onFermer}>
        {contenu}
      </Panneau>
    </div>
  )
}

function dialogue() {
  return screen.getByRole('dialog')
}

describe('ui/panneau — le confinement du focus', () => {
  it('⛔ Shift+Tab depuis le premier élément revient au DERNIER, jamais dans la page en dessous', () => {
    monter(
      <>
        <button type="button">Premier choix</button>
        <button type="button">Dernier choix</button>
      </>
    )
    const retour = screen.getByRole('button', { name: /Retour/ })
    retour.focus()
    expect(document.activeElement).toBe(retour)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Dernier choix' }))
  })

  it('⛔ Tab depuis le dernier élément revient au PREMIER', () => {
    monter(
      <>
        <button type="button">Premier choix</button>
        <button type="button">Dernier choix</button>
      </>
    )
    const dernier = screen.getByRole('button', { name: 'Dernier choix' })
    dernier.focus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Retour/ }))
  })

  // Le conteneur porte `tabIndex={-1}` et reçoit le focus à l'ouverture : c'est l'état RÉEL au
  // moment où l'utilisateur commence à tabuler, et c'était le trou le plus facile à laisser.
  it('⛔ Shift+Tab depuis le conteneur lui-même, à l’ouverture, ne sort pas', () => {
    monter(<button type="button">Un choix</button>)
    expect(document.activeElement).toBe(dialogue())

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Un choix' }))
  })

  // ⛔ CE QUE CE FICHIER NE PEUT PAS TESTER, ET IL FAUT LE DIRE PLUTÔT QUE DE FAIRE SEMBLANT.
  //
  // Une assertion « aucune combinaison de Tab ne sort de la fenêtre » a été écrite, puis RETIRÉE :
  // elle était verte AVEC ET SANS le piège. jsdom n'implémente pas le déplacement natif du focus par
  // `Tab` — `fireEvent.keyDown` notifie l'écouteur, il ne déplace rien. Sans piège, le focus ne
  // bougeait donc pas du tout, et « il est resté dans la fenêtre » était vrai pour la mauvaise
  // raison. C'est exactement le test vert qui ne prouve rien que ce dépôt traque partout ailleurs.
  //
  // Les trois tests ci-dessus tiennent parce qu'ils vérifient un déplacement que NOTRE code exécute
  // (`preventDefault` + `.focus()` explicite), pas un déplacement du navigateur. **Le confinement
  // réel, sur un vrai navigateur, reste à vérifier à la main** — il est dans les deux passes
  // manuelles déjà dues (§8 : clavier seul sur tous les écrans).
  //
  // Même honnêteté sur la branche « aucun élément focusable » de `panneau.tsx` : elle est
  // INATTEIGNABLE par ce composant, le bouton « Retour » étant toujours rendu. Elle est défensive,
  // elle n'est pas couverte, et un test qui monterait un `Panneau` sans contenu ne l'exercerait pas
  // davantage — il compterait le bouton « Retour ».
})

describe('ui/panneau — ce qui existait déjà et ne doit pas régresser', () => {
  it('Échap ferme', () => {
    const onFermer = vi.fn()
    monter(<button type="button">Un choix</button>, onFermer)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledTimes(1)
  })

  // ⚠️ Le `return` anticipé ajouté pour `Tab` aurait pu couper la fermeture par `Échap` : la même
  // fonction traite maintenant deux touches.
  it('Échap ferme AUSSI quand le focus est sur un élément de contenu', () => {
    const onFermer = vi.fn()
    monter(<button type="button">Un choix</button>, onFermer)
    screen.getByRole('button', { name: 'Un choix' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledTimes(1)
  })

  it('porte son titre comme étiquette accessible', () => {
    monter(<p>Contenu</p>)
    expect(dialogue().getAttribute('aria-label')).toBe('Mon régime')
    expect(dialogue().getAttribute('aria-modal')).toBe('true')
  })
})
