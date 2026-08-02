// ui/visite.tsx — visite guidée au premier lancement : des bulles qui désignent successivement
// quatre éléments réels de l'écran, avec « Passer » et « Suivant » toujours visibles.
//
// ⚠️ INSPIRÉ DE `panneau.tsx` (portail vers `document.body`, Échap, focus rendu, défilement bloqué),
// SANS LE RÉUTILISER : un panneau est plein écran et REMPLACE le contenu ; une visite doit laisser
// voir ce qu'elle désigne, avec un fond simplement assombri autour d'un contour. Les deux composants
// partagent une préoccupation, pas une implémentation.
//
// ⚠️ CIBLE INTROUVABLE = ÉTAPE SAUTÉE, JAMAIS DE PLANTAGE. L'écran peut encore charger, ou un
// sélecteur peut ne plus correspondre à rien d'une version à l'autre. `premierIndexValide` est
// l'unique point qui décide « cette étape existe-t-elle », et il ne s'appuie que sur
// `document.querySelector(...) !== null` — jamais sur une dimension mesurée (`getBoundingClientRect`
// rend des zéros sous jsdom, et une cible réelle peut légitimement avoir une largeur nulle avant sa
// première peinture). Si plus aucune étape n'est valide, la visite se termine d'elle-même : elle ne
// doit jamais rester bloquée à désigner du vide, ni faire planter l'écran qu'elle présente.
//
// ⚠️ LE FOND CAPTE LES CLICS. Rien de spécial à coder : le calque assombri est un `div` plein écran,
// rendu par-dessus l'application via le portail, sans `pointer-events: none` — il intercepte donc
// nativement tout clic qui viserait l'écran en dessous. Interdire l'interaction pendant la visite
// évite d'atterrir, bulle affichée, sur un autre écran dont les cibles ont disparu.
//
// Les quatre textes ont été vérifiés à la main contre `engine/guards/banned-terms.ts` (aucun terme
// banni, y compris en sous-chaîne — « traitement » contiendrait « traite »).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'

export interface EtapeVisite {
  readonly cible: string
  readonly titre: string
  readonly texte: string
}

/**
 * Sélecteurs RÉELS, lus dans `navigation.tsx`, `main.tsx` et `screens/aujourdhui.tsx` — pas de
 * `data-*` inventé pour l'occasion : le projet ne s'appuie déjà que sur la structure et les
 * attributs existants pour ses tests (voir `aujourdhui.test.tsx`).
 */
export const ETAPES_VISITE: readonly EtapeVisite[] = [
  {
    cible: 'nav[aria-label="Navigation principale"]',
    titre: 'La navigation',
    texte: "Ces cinq onglets sont toujours là, en bas de l'écran. Un onglet, une destination.",
  },
  {
    // La `CarteRepas` de `screens/aujourdhui.tsx`. `[data-visite="carte-plat"]` et non `article` nu
    // : ce tag réapparaît dans `courses.tsx`, `detail-recette.tsx` et `semaine.tsx` — un sélecteur
    // sur la seule balise dépendrait d'être le premier `<article>` du document, par accident.
    cible: '[data-visite="carte-plat"]',
    titre: 'Le plat du jour',
    texte: "Un plat à la fois, en grand. Rien d'autre ne vient encombrer l'écran.",
  },
  {
    // Le conteneur des deux `BoutonNavigation` (Précédent / Suivant), à l'intérieur de la carte.
    // `[data-visite="fleches"]` et non des classes Tailwind : `flex gap-2` casserait en silence dès
    // qu'on retouche la mise en page (voir `aujourdhui.tsx`).
    cible: '[data-visite="fleches"]',
    titre: 'Précédent et Suivant',
    texte:
      "Ces flèches changent de plat sans rien valider. Rien n'est enregistré tant que vous ne choisissez pas.",
  },
  {
    // Le lien vers `#/parametres`, posé par `LienParametres` dans `main.tsx`.
    cible: 'a[href="#/parametres"]',
    titre: 'Vos réglages',
    texte: 'Vos allergies, votre régime et vos rappels se règlent ici, à tout moment.',
  },
]

/** Premier index ≥ `depart` dont la cible existe dans le DOM, ou `null` s'il n'en reste aucune. */
function premierIndexValide(depart: number): number | null {
  for (let i = depart; i < ETAPES_VISITE.length; i++) {
    const etape = ETAPES_VISITE[i]
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

export function Visite({ onTerminer }: { readonly onTerminer: () => void }): JSX.Element | null {
  const [etapeIndex, setEtapeIndex] = useState<number | null>(() => premierIndexValide(0))
  const [rect, setRect] = useState<DOMRect | null>(null)
  const bulle = useRef<HTMLDivElement>(null)

  // Plus aucune étape valide — au montage comme après un « Suivant » qui vide la liste : on prévient
  // l'appelant plutôt que de rester affiché sur rien.
  useEffect(() => {
    if (etapeIndex === null) onTerminer()
  }, [etapeIndex, onTerminer])

  // Mesure la cible courante, recalcule sur `resize` et à chaque changement d'étape.
  useEffect(() => {
    if (etapeIndex === null) return
    const etape = ETAPES_VISITE[etapeIndex]
    if (etape === undefined) return
    const recalculer = () => {
      const cible = document.querySelector(etape.cible)
      setRect(cible === null ? null : cible.getBoundingClientRect())
    }
    recalculer()
    window.addEventListener('resize', recalculer)
    return () => window.removeEventListener('resize', recalculer)
  }, [etapeIndex])

  // Le focus entre dans la bulle à chaque étape.
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
    setEtapeIndex((i) => (i === null ? null : premierIndexValide(i + 1)))
  }, [])

  if (etapeIndex === null) return null
  const etape = ETAPES_VISITE[etapeIndex]
  if (etape === undefined) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Assombrit ET capte les clics — voir l'en-tête. */}
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
        aria-modal="true"
        aria-label={etape.titre}
        ref={bulle}
        tabIndex={-1}
        className="absolute max-w-prose rounded-[--radius-carte] border border-bordure bg-surface p-4 shadow-lg outline-none"
        style={stylePositionBulle(rect)}
      >
        {/* Lisible en texte, pas seulement en pastilles : un lecteur d'écran n'annonce rien de
            points colorés. */}
        <p className="text-[0.85rem] font-medium text-attenue">
          Étape {etapeIndex + 1} sur {ETAPES_VISITE.length}
        </p>
        <h2 className="mt-1 font-titre text-[1.25rem] text-texte">{etape.titre}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etape.texte}</p>

        <div aria-hidden="true" className="mt-3 flex gap-1.5">
          {ETAPES_VISITE.map((e, i) => (
            <span
              key={e.cible}
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
          <button
            type="button"
            onClick={surSuivant}
            className="flex min-h-tactile flex-1 items-center justify-center gap-2 rounded-[0.7rem] bg-accent-plein px-4 text-[0.95rem] font-semibold text-white"
          >
            Suivant
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
