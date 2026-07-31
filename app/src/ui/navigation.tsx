// ui/navigation.tsx — la barre à cinq onglets, présente sur TOUS les écrans.
//
// Source : bloc commun des maquettes (`project/CLAUDE.md` du bundle de handoff). Ce n'est pas de la
// décoration, c'est la contrainte centrale du produit — « utilisable par toutes les tranches d'âge,
// y compris des personnes peu à l'aise avec le numérique » :
//
//   « Navigation permanente et visible. INTERDIT : menu hamburger, navigation cachée. »
//   « Chaque icône est TOUJOURS accompagnée de son libellé texte. »
//   « Cibles tactiles de 48 px minimum. »
//   « Cinq onglets en bas sur mobile […] Sur écran large : colonne à gauche, MÊME ordre,
//     MÊMES libellés, MÊMES icônes. »
//
// ⚠️ NE JAMAIS RÉDUIRE UN ONGLET À SON ICÔNE, même par manque de place. Le libellé n'est pas une
// aide au débutant qu'on retire quand l'écran rétrécit : sans lui, une icône de livre et une icône
// d'ampoule ne se distinguent que par convention, et c'est précisément la convention que
// l'utilisateur visé n'a pas. À l'étroit, on réduit la taille du texte — jamais sa présence.
//
// Les tracés SVG viennent des maquettes, repris à l'identique.

import type { JSX } from 'react'
import { hashDe, type Onglet } from './router.js'

/** Un onglet de la barre. Nommé `EntreeOnglet` pour ne pas masquer le type `Onglet` du routeur. */
interface EntreeOnglet {
  readonly route: Onglet
  readonly libelle: string
  readonly icone: JSX.Element
}

const ONGLETS: readonly EntreeOnglet[] = [
  {
    route: 'aujourdhui',
    libelle: "Aujourd'hui",
    icone: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3.4" />
      </>
    ),
  },
  {
    route: 'semaine',
    libelle: 'Semaine',
    icone: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
        <line x1="8" y1="3" x2="8" y2="6.5" />
        <line x1="16" y1="3" x2="16" y2="6.5" />
      </>
    ),
  },
  {
    route: 'courses',
    libelle: 'Courses',
    icone: (
      <>
        <circle cx="9.5" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
        <path d="M2.5 4h2.2l2.3 11.4a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L20 8H6" />
      </>
    ),
  },
  {
    route: 'recettes',
    libelle: 'Recettes',
    icone: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="1.8" />
        <line x1="9" y1="4" x2="9" y2="20" />
      </>
    ),
  },
  {
    route: 'savoir',
    libelle: 'Savoir',
    icone: (
      <>
        <path d="M9.2 17.5h5.6" />
        <path d="M10 20.5h4" />
        <path d="M12 3.2a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6h5.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3.2z" />
      </>
    ),
  },
]

export function Navigation({ courante }: { readonly courante: Onglet }) {
  return (
    <nav
      aria-label="Navigation principale"
      className={
        // Mobile : barre fixée en bas, sous le pouce. Bureau (≥64rem) : colonne à gauche, même
        // ordre.
        //
        // ⚠️ `max(env(...), 0.75rem)` ET NON `env(...)` SEUL. Le défaut réel remonté par l'usage :
        // sur plusieurs téléphones, la barre système — pilule gestuelle, bandeau micro/assistant —
        // se dessine PAR-DESSUS le bas de l'écran, et les libellés disparaissaient sous elle. La
        // cause n'est pas la hauteur de la barre (48 px de cible tactile, soit ~1,3 cm, déjà
        // au-dessus du plancher accessibilité) : c'est que `env(safe-area-inset-bottom)` renvoie
        // **0** sur beaucoup d'Android en navigation gestuelle. Rien n'était alors réservé.
        // Augmenter la cible tactile n'y aurait rien changé ; il fallait un PLANCHER de réserve.
        'fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-bordure bg-surface ' +
        'pb-[max(env(safe-area-inset-bottom),0.75rem)] ' +
        'lg:inset-y-0 lg:right-auto lg:w-56 lg:grid-cols-1 lg:content-start lg:gap-1 ' +
        'lg:border-t-0 lg:border-r lg:p-3 lg:pt-8 lg:pb-3'
      }
    >
      {ONGLETS.map((onglet) => {
        const actif = onglet.route === courante
        return (
          <a
            key={onglet.route}
            href={hashDe(onglet.route)}
            aria-current={actif ? 'page' : undefined}
            className={
              // `min-h-tactile` = 3rem : en rem et non en px, pour que la cible GRANDISSE avec la
              // police système agrandie au lieu de rester figée.
              'flex min-h-tactile flex-col items-center justify-center gap-1 px-1 py-2 ' +
              'text-center no-underline lg:flex-row lg:justify-start lg:gap-3 lg:px-3 ' +
              'lg:rounded-[--radius-carte] ' +
              (actif
                ? 'text-accent-texte lg:bg-accent-doux '
                : 'text-attenue hover:text-texte ')
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              // `h-6 w-6` = 1.5rem, pas 24px : l'icône grandit avec la police système.
              className="h-6 w-6 shrink-0"
            >
              {onglet.icone}
            </svg>
            {/* ⚠️ Le libellé n'est JAMAIS masqué, quelle que soit la largeur — voir l'en-tête.
                0,8125rem au lieu des 0,66rem des maquettes : ~10,5 px de libellé sur la barre que
                tout le monde doit lire contredit la contrainte d'âge du même bloc commun. */}
            <span className="text-[0.8125rem] font-medium leading-tight lg:text-[0.95rem]">
              {onglet.libelle}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
