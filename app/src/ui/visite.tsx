// ui/visite.tsx — LE MÉCANISME des tutoriels guidés : des bulles qui désignent un élément réel de
// l'écran et, pour la plupart des étapes, EXIGENT un geste avant d'avancer.
//
// ⚠️ CE FICHIER NE CONNAÎT AUCUN PARCOURS PAR SON NOM. La table des huit parcours (« menus »,
// « aujourdhui »…), leurs étapes et leurs textes vivent dans `ui/parcours.ts` — voir son en-tête
// pour pourquoi la séparation est délibérée. `Visite` reçoit un `readonly EtapeVisite[]`, rien de
// plus, et n'a aucune raison de savoir à quel écran il appartient.
//
// ⚠️ CE N'EST PLUS UNE VISITE PUREMENT INFORMATIVE. La version précédente affichait quatre bulles
// qu'on lisait puis qu'on passait avec « Suivant » — l'utilisateur ne touchait jamais l'application
// pendant qu'on la lui présentait. Le retour d'essai est explicite : « on lui dit les menus → il
// clique sur les menus pour changer », « ne doit pas que informer mais inciter l'utilisateur à
// utiliser l'appli ». D'où `EtapeAttendu` : une étape peut exiger un CLIC sur la vraie cible ou une
// ARRIVÉE sur une vraie route, et dans ces deux cas le bouton « Suivant » disparaît — on ne peut pas
// passer l'étape sans avoir fait le geste.
//
// ⚠️ INSPIRÉ DE `panneau.tsx` (portail vers `document.body`, Échap, focus rendu, défilement bloqué),
// SANS LE RÉUTILISER — voir l'historique de ce fichier : un panneau est plein écran et REMPLACE le
// contenu, une visite doit laisser voir ce qu'elle désigne.
//
// ⚠️ LE FOND NE CAPTE LES CLICS QUE POUR UNE ÉTAPE « lecture ». Le fond assombri interceptait avant
// TOUT clic, sur toute étape — cohérent tant qu'aucune étape n'attendait d'action réelle sur
// l'application. Une étape « clic » ou « route » a l'effet inverse : il FAUT que le clic sur la vraie
// cible (un onglet, un bouton) atteigne l'application en dessous, sinon l'exigence de geste ne peut
// jamais être remplie. `pointer-events-none` sur tout le calque (fond + éventuel contour) résout ça —
// `pointer-events` est une propriété HÉRITÉE, la bulle elle-même reprend explicitement
// `pointer-events-auto` pour que « Passer » reste cliquable.
//
// ⚠️ CIBLE INTROUVABLE = ÉTAPE SAUTÉE, JAMAIS DE PLANTAGE — décision reprise telle quelle de la
// version précédente. `premierIndexValide` reste l'unique point qui décide « cette étape existe-t-
// elle », sur `document.querySelector(...) !== null` uniquement (jamais une dimension mesurée, nulle
// sous jsdom et avant la première peinture). Si plus aucune étape n'est valide, la visite se termine
// d'elle-même.
//
// ⚠️ LE TUTORIEL VIT AU-DESSUS DU ROUTEUR — c'est le point structurant d'une étape « route » : une
// étape « touchez l'onglet Recettes » fait CHANGER D'ÉCRAN, et un tutoriel monté DANS un écran serait
// démonté au moment même où il réussit. `Visite` est donc monté par `main.tsx` en dehors de l'arbre
// qui dépend de la route (voir `Coquille`), et il observe la route courante avec `useRoute()` —
// EXACTEMENT le hook que `router.tsx` expose déjà pour ça, pas un second écouteur `hashchange`.
//
// ⚠️ « Passer » EST TOUJOURS LÀ, sur CHAQUE étape, y compris les étapes qui attendent un geste — un
// tutoriel qui exige une action et dont on ne peut pas sortir est un piège, pas un guide, en
// particulier sur la contrainte d'âge de ce produit (§4 CLAUDE.md).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { hashDe, useRoute } from './router.js'
// Note : aucun import de `./parcours.js` ici — voir l'en-tête, ce fichier ignore délibérément ce
// qu'est un parcours.

/**
 * Ce qu'il faut faire pour quitter l'étape.
 *
 * `lecture` : on lit, on appuie sur « Suivant » — seul mode qui existait avant. `clic` : il faut
 * cliquer la cible RÉELLE dans l'application (pas un bouton de la bulle) ; `route` : il faut ARRIVER
 * sur cet écran (utile quand le geste attendu est un lien natif, pas un clic intercepté ici — voir
 * l'en-tête). Dans les deux derniers cas, il n'y a pas de « Suivant » : c'est tout l'intérêt.
 */
export type EtapeAttendu =
  | { readonly type: 'lecture' }
  | { readonly type: 'clic'; readonly cible: string }
  | { readonly type: 'route'; readonly hash: string }

export interface EtapeVisite {
  readonly cible: string
  readonly titre: string
  readonly texte: string
  readonly attendu: EtapeAttendu
}

/** Premier index ≥ `depart` dont la cible existe dans le DOM, ou `null` s'il n'en reste aucune. */
export function premierIndexValide(etapes: readonly EtapeVisite[], depart: number): number | null {
  for (let i = depart; i < etapes.length; i++) {
    const etape = etapes[i]
    if (etape !== undefined && document.querySelector(etape.cible) !== null) return i
  }
  return null
}

/** Marge, en pixels, entre la bulle (ou le contour) et le bord de l'écran ou de la cible. */
const MARGE_PX = 16

/**
 * Au-dessus si la cible est dans la moitié basse de l'écran, en dessous sinon — c'est ce qui évite
 * que la bulle recouvre l'élément qu'elle désigne. Largeur pleine (moins la marge) plutôt qu'un
 * calage horizontal sur la cible : cela évite de mesurer la bulle elle-même pour la garder dans
 * l'écran, et correspond à la maquette (§2) où la bulle occupe l'essentiel de la largeur.
 */
function stylePositionBulle(rect: DOMRect | null): CSSProperties {
  if (rect === null) return { top: MARGE_PX, left: MARGE_PX, right: MARGE_PX }
  const cibleEnBas = rect.top + rect.height / 2 > window.innerHeight / 2
  return cibleEnBas
    ? { bottom: Math.max(window.innerHeight - rect.top + MARGE_PX, MARGE_PX), left: MARGE_PX, right: MARGE_PX }
    : { top: Math.max(rect.bottom + MARGE_PX, MARGE_PX), left: MARGE_PX, right: MARGE_PX }
}

export function Visite({
  etapes,
  onTerminer,
}: {
  readonly etapes: readonly EtapeVisite[]
  readonly onTerminer: () => void
}): JSX.Element | null {
  const [etapeIndex, setEtapeIndex] = useState<number | null>(() => premierIndexValide(etapes, 0))
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bulle = useRef<HTMLDivElement>(null)
  // La route courante, pour les étapes « route » — même hook que `main.tsx` : pas de second
  // écouteur `hashchange` (voir l'en-tête).
  const route = useRoute()

  // Plus aucune étape valide — au montage comme après un « Suivant » qui vide la liste : on prévient
  // l'appelant plutôt que de rester affiché sur rien.
  useEffect(() => {
    if (etapeIndex === null) onTerminer()
  }, [etapeIndex, onTerminer])

  // Mesure la cible courante, recalcule sur `resize` et à chaque changement d'étape.
  useEffect(() => {
    if (etapeIndex === null) return
    const etape = etapes[etapeIndex]
    if (etape === undefined) return
    const recalculer = () => {
      const cible = document.querySelector(etape.cible)
      setRect(cible === null ? null : cible.getBoundingClientRect())
    }
    recalculer()
    window.addEventListener('resize', recalculer)
    return () => window.removeEventListener('resize', recalculer)
  }, [etapeIndex, etapes])

  // Le focus entre dans la bulle à chaque étape — c'est aussi ce qui annonce le changement d'étape
  // aux lecteurs d'écran (dialogue nommé par `aria-label`, focus déplacé dedans).
  useEffect(() => {
    bulle.current?.focus()
  }, [etapeIndex])

  // Le focus REVIENT d'où il venait quand la visite se démonte — même raisonnement que `panneau.tsx`.
  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null
    return () => origine?.focus?.()
  }, [])

  // Défilement du fond bloqué pendant la visite : sinon un doigt qui glisse sur la bulle fait
  // défiler l'écran qu'elle est censée figer pour la présenter.
  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedent
    }
  }, [])

  // Échap = « Passer ».
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onTerminer()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [onTerminer])

  const surSuivant = useCallback(() => {
    setEtapeIndex((i) => (i === null ? null : premierIndexValide(etapes, i + 1)))
  }, [etapes])

  const etape = etapeIndex === null ? undefined : etapes[etapeIndex]

  // Étape « clic » : avance quand la VRAIE cible est cliquée à travers le calque (voir l'en-tête —
  // le calque ne capte plus les clics pour ce type d'étape). Capture, pas bulle : on veut réagir
  // même si la cible arrête elle-même la propagation dans son propre gestionnaire.
  useEffect(() => {
    if (etape === undefined || etape.attendu.type !== 'clic') return
    const { cible } = etape.attendu
    const surClic = (evenement: MouseEvent) => {
      if (evenement.target instanceof Element && evenement.target.closest(cible) !== null) surSuivant()
    }
    document.addEventListener('click', surClic, true)
    return () => document.removeEventListener('click', surClic, true)
  }, [etape, surSuivant])

  // Étape « route » : avance dès que la route RÉELLE correspond à celle attendue — jamais avant.
  useEffect(() => {
    if (etape === undefined || etape.attendu.type !== 'route') return
    if (hashDe(route.onglet) === etape.attendu.hash) surSuivant()
  }, [etape, route, surSuivant])

  if (etapeIndex === null || etape === undefined) return null

  // Une étape qui attend un geste (clic ou route) n'a pas de « Suivant » : le geste EST le seul
  // moyen d'avancer, hors « Passer ». C'est aussi elle qui décide si le calque bloque les clics.
  const attendGeste = etape.attendu.type !== 'lecture'

  return createPortal(
    <div className={'fixed inset-0 z-50 ' + (attendGeste ? 'pointer-events-none' : '')}>
      {/* Assombrit. Capte les clics seulement pour une étape « lecture » — voir l'en-tête : une
          étape qui attend un geste doit laisser le clic atteindre la vraie cible en dessous. */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" />

      {rect !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[--radius-carte]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            outline: '3px solid var(--color-accent-texte)',
            outlineOffset: '3px',
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal={attendGeste ? undefined : 'true'}
        aria-label={etape.titre}
        ref={bulle}
        tabIndex={-1}
        // `pointer-events-auto` EXPLICITE : le calque parent passe à `pointer-events-none` pour les
        // étapes « clic »/« route », une propriété HÉRITÉE — sans ce contre-ordre, « Passer »
        // deviendrait lui aussi incliquable.
        className="pointer-events-auto absolute max-w-prose rounded-[--radius-carte] border border-bordure bg-surface p-4 shadow-lg outline-none"
        style={stylePositionBulle(rect)}
      >
        {/* Lisible en texte, pas seulement en pastilles, et ANNONCÉ (`role="status"`) à chaque
            changement d'étape — même mécanisme que le bandeau de persistance dans `main.tsx`. */}
        <p role="status" className="text-[0.85rem] font-medium text-attenue">
          Étape {etapeIndex + 1} sur {etapes.length}
        </p>
        <h2 className="mt-1 font-titre text-[1.25rem] text-texte">{etape.titre}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etape.texte}</p>

        <div aria-hidden="true" className="mt-3 flex gap-1.5">
          {/* Index en clé, pas `e.cible` : deux étapes d'un même parcours peuvent légitimement
              partager une cible (voir `ETAPES_FRIGO`, `ui/parcours.ts`) — la liste est statique pour
              la durée du montage, l'ordre ne bouge jamais. */}
          {etapes.map((_e, i) => (
            <span
              key={i}
              className={'h-2 w-2 rounded-full ' + (i === etapeIndex ? 'bg-accent-plein' : 'bg-bordure-forte')}
            />
          ))}
        </div>

        {/* ⚠️ « Passer » N'EST JAMAIS PLUS DISCRET QUE « Suivant » — même gabarit, même cible
            tactile : on doit pouvoir sortir aussi facilement qu'avancer. */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onTerminer}
            className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux"
          >
            Passer
          </button>
          {/* Absent pour une étape « clic »/« route » : voir `attendGeste` ci-dessus, c'est tout
              l'intérêt de ces deux types. */}
          {!attendGeste && (
            <button
              type="button"
              onClick={surSuivant}
              className="flex min-h-tactile flex-1 items-center justify-center gap-2 rounded-[0.7rem] bg-accent-plein px-4 text-[0.95rem] font-semibold text-white"
            >
              Suivant
              <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
