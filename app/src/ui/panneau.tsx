// ui/panneau.tsx — une fenêtre en superposition, plein écran, avec un bouton retour.
//
// ⚠️ CE FICHIER EXISTE POUR REMPLACER LES MENUS DÉROULANTS, et la raison vient de l'usage :
// « les menus déroulants rallongent l'écran et on perd l'utilisateur ». C'est exact, et c'est pire
// que de la gêne. Un dépliant pousse vers le bas TOUT ce qui le suit : on ouvre « Plus de filtres »,
// le bouton qu'on visait s'en va, la page grandit sous le doigt, et il faut retrouver où on en
// était. Sur la contrainte d'âge du produit — « utilisable par des personnes peu à l'aise avec le
// numérique » — c'est exactement le mécanisme qui fait abandonner.
//
// Une fenêtre pleine ne bouge rien : elle recouvre, on choisit, on revient, l'écran est resté
// identique. Le prix à payer est un aller-retour explicite ; c'est un prix que l'utilisateur voit
// et contrôle, contrairement à une page qui s'allonge toute seule.
//
// ⚠️ CE N'EST PAS UNE NAVIGATION CACHÉE. Le bloc commun des maquettes interdit « menu hamburger,
// navigation cachée » — mais ce qu'il interdit, c'est de dissimuler les DESTINATIONS du produit.
// Ici, le déclencheur reste une ligne visible, libellée, qui annonce ce qu'elle contient et affiche
// la valeur courante (« Mon régime — Végétarien ») ; la fenêtre ne fait qu'héberger le choix. Les
// cinq onglets, eux, restent permanents et ne passent jamais par ce composant.
//
// ⚠️ PORTAIL, PAS UN `fixed` POSÉ DANS L'ARBRE. Un ancêtre porteur de `transform`, `filter` ou
// `contain` devient le bloc conteneur d'un descendant `fixed`, qui se retrouve alors positionné par
// rapport à LUI et non à l'écran — la superposition s'ancrerait dans une carte. Aucun ancêtre ne le
// fait aujourd'hui ; la première animation en introduirait un, et le défaut serait incompréhensible
// à distance. Le portail rend le problème inexprimable.

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Le titre est OBLIGATOIRE et sert d'étiquette accessible : une fenêtre modale sans nom annonce
 * « dialogue » et rien d'autre à un lecteur d'écran, ce qui ne dit pas ce qu'on est en train de
 * régler.
 */
export function Panneau({
  titre,
  onFermer,
  children,
}: {
  readonly titre: string
  readonly onFermer: () => void
  readonly children: ReactNode
}) {
  const contenu = useRef<HTMLDivElement>(null)

  // Échap ferme. Le clavier n'est pas l'usage principal du produit, mais c'est trois lignes et ça
  // évite le piège classique d'une modale dont on ne sort qu'à la souris.
  //
  // ⚠️ ET `Tab` EST BORNÉ À LA FENÊTRE — corrigé le 2026-08-07, ce ne l'était pas. `aria-modal="true"`
  // (ci-dessous) PROMET aux technologies d'assistance que le reste de la page est inerte ; sans
  // bornage, on sortait de la fenêtre par le haut et on tabulait dans l'écran qu'elle recouvre.
  // L'attribut mentait. Un contournement était en place — `.sr-only:focus` remonté en `z-index: 60`
  // pour que le lien d'évitement reste visible quand on l'atteignait ainsi — il reste utile, mais il
  // rendait le symptôme supportable, pas la promesse vraie.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        onFermer()
        return
      }
      if (evenement.key !== 'Tab') return
      const boite = contenu.current
      if (boite === null) return

      // ⚠️ AUCUN CRITÈRE DE VISIBILITÉ CALCULÉE ICI (`offsetParent`, `getBoundingClientRect`) : jsdom
      // ne fait pas de mise en page et les rendrait tous invisibles, ce qui ferait passer le test
      // sans que le piège fonctionne dans un navigateur. On s'en tient aux attributs.
      const focusables = [
        ...boite.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ].filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

      // Fenêtre sans rien de focusable : le focus reste sur le conteneur plutôt que de partir dans
      // la page derrière. N'arrive pas aujourd'hui — le bouton « Retour » est toujours là — mais
      // laisser `Tab` s'échapper dans ce cas serait le seul trou restant.
      if (focusables.length === 0) {
        evenement.preventDefault()
        boite.focus()
        return
      }

      const premier = focusables[0] as HTMLElement
      const dernier = focusables[focusables.length - 1] as HTMLElement
      const actif = document.activeElement

      // Le conteneur lui-même porte `tabIndex={-1}` et reçoit le focus à l'ouverture : `Tab` doit
      // alors entrer normalement (le navigateur le fait), mais `Shift+Tab` en sortirait par le haut.
      if (evenement.shiftKey && (actif === premier || actif === boite)) {
        evenement.preventDefault()
        dernier.focus()
        return
      }
      if (!evenement.shiftKey && actif === dernier) {
        evenement.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [onFermer])

  // ⚠️ LE DÉFILEMENT DU FOND EST BLOQUÉ. Sans ça, le doigt qui glisse sur la fenêtre fait défiler
  // la page EN DESSOUS : on revient et on ne reconnaît plus l'écran qu'on vient de quitter — soit
  // précisément le désordre que ce composant existe pour supprimer.
  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedent
    }
  }, [])

  // Le focus entre dans la fenêtre à l'ouverture et RETOURNE d'où il venait à la fermeture. Sans le
  // retour, on se retrouve rejeté en haut de la page, à chercher la ligne sur laquelle on avait
  // appuyé.
  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null
    contenu.current?.focus()
    return () => origine?.focus?.()
  }, [])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      ref={contenu}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-fond outline-none"
    >
      {/* L'en-tête ne défile pas : le retour reste atteignable quel que soit le contenu, sans
          remonter. C'est la seule sortie, elle ne doit jamais être hors de portée. */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-bordure bg-surface px-4 py-2">
        <button
          type="button"
          onClick={onFermer}
          // Cible pleine et libellé écrit : une flèche seule est une convention que l'utilisateur
          // visé n'a pas forcément — même raisonnement que pour les onglets (navigation.tsx).
          className="flex min-h-tactile items-center gap-2 rounded-[0.7rem] px-2 text-lecture font-semibold text-texte"
        >
          <span aria-hidden="true">←</span>
          Retour
        </button>
        <h2 className="flex-1 truncate text-right font-titre text-lecture leading-tight text-texte">
          {titre}
        </h2>
      </div>

      <div className="mx-auto w-full max-w-prose flex-1 px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-5">
        {children}
      </div>
    </div>,
    document.body
  )
}

/**
 * La ligne qui OUVRE un panneau : libellé, valeur courante, chevron.
 *
 * ⚠️ LA VALEUR COURANTE EST AFFICHÉE SUR LA LIGNE, ET CE N'EST PAS DE L'ORNEMENT. C'est ce qui
 * distingue « replier pour ranger » de « cacher » : sans elle, connaître son régime déclaré
 * demanderait d'ouvrir la fenêtre, et chaque réglage coûterait un aller-retour rien que pour être
 * lu. Avec elle, l'écran de réglages se parcourt d'un regard et on n'ouvre que ce qu'on change.
 */
export function LigneOuvrante({
  libelle,
  valeur,
  onOuvrir,
  dataVisite,
}: {
  readonly libelle: string
  readonly valeur: string
  readonly onOuvrir: () => void
  /** Cible optionnelle pour `ui/visite.tsx` — évite d'envelopper le bouton dans un `div` qui
   *  décalerait le contour dessiné par la visite (voir `ui/parcours.ts`). */
  readonly dataVisite?: string
}) {
  return (
    <button
      type="button"
      onClick={onOuvrir}
      data-visite={dataVisite}
      className="flex min-h-tactile w-full items-center gap-3 rounded-[--radius-carte] border border-bordure bg-surface px-4 py-3 text-left"
    >
      <span className="flex-1">
        <span className="block text-lecture font-medium text-texte">{libelle}</span>
        <span className="mt-0.5 block text-courant leading-snug text-attenue">{valeur}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-lecture text-attenue">
        ›
      </span>
    </button>
  )
}
