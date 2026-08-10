// ui/gestes-etape.tsx — les gestes techniques d'une étape, dépliables sur place. PARTAGÉS.
//
// ⚠️ EXTRAIT DE `screens/detail-recette.tsx`, PAS RECOPIÉ — même motif que `ingredients-recette.tsx`
// et pour la même raison : `7040c33` a dû réunir trois tables jumelles dont une avait divergé. Le
// mode cuisine avait besoin du même dépliant ; en écrire un second exemplaire aurait rouvert le
// motif un lot après l'avoir fermé.
//
// ⚠️ DÉPLIÉ SUR PLACE, JAMAIS EN FENÊTRE — et c'est l'inverse du choix fait pour les ingrédients
// (L1bis), délibérément. Une liste d'ingrédients se consulte À CÔTÉ de l'étape : la recouvrir d'un
// `Panneau` ne coûte rien puisqu'on ne lit plus l'étape pendant ce temps. Une définition, elle, se
// lit DANS l'étape — « quelqu'un qui a les mains dans la pâte et qui veut savoir ce que "chemiser"
// veut dire ne doit pas perdre l'étape qu'il est en train de lire » (en-tête de `detail-recette`).
// Une fenêtre ferait exactement ça.
//
// ⚠️ CE DÉPLIANT N'EST PAS UN MENU. La règle « plus aucun menu déroulant hors de l'accueil » vise
// les menus, filtres et réglages, qui ouvrent une fenêtre et portent `aria-haspopup="dialog"`. Ici
// le bouton agrandit bien un contenu EN PLACE : `aria-expanded` est l'attribut juste, et le mettre
// à `dialog` mentirait aux lecteurs d'écran.

import { useMemo, useState } from 'react'
import type { Catalog, LexiconEntry, RecipeStep } from '../engine/domain/index.js'

/**
 * Les gestes du lexique cités par une étape (`lexicon_ids`), en pastilles, avec la définition du
 * geste ouvert juste en dessous.
 *
 * Rend `null` quand l'étape n'en cite aucun — c'est le cas le plus fréquent, et les deux appelants
 * peuvent donc l'appeler sans condition.
 *
 * ⚠️ UN SEUL GESTE OUVERT À LA FOIS, et l'état vit ICI. En mode cuisine, une seule instance sert
 * toutes les étapes : l'appelant lui donne `key={etape.ordre}` pour qu'un changement d'étape la
 * remonte fermée, sinon un geste partagé par deux étapes consécutives resterait déplié tout seul.
 */
export function GestesDeLEtape({
  etape,
  catalogue,
}: {
  readonly etape: RecipeStep
  readonly catalogue: Catalog
}) {
  const [ouvert, setOuvert] = useState<string | null>(null)

  const gestes = useMemo(
    () =>
      etape.lexiconIds
        .map((id) => catalogue.lexicon.get(id as never))
        .filter((entree): entree is LexiconEntry => entree !== undefined),
    [etape, catalogue]
  )

  if (gestes.length === 0) return null

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {gestes.map((geste) => (
          <button
            key={geste.id}
            type="button"
            onClick={() => setOuvert(ouvert === geste.id ? null : geste.id)}
            aria-expanded={ouvert === geste.id}
            className="flex min-h-tactile items-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-accent-texte underline"
          >
            {geste.terme}
          </button>
        ))}
      </div>

      {gestes
        .filter((geste) => geste.id === ouvert)
        .map((geste) => (
          <p
            key={geste.id}
            className="mt-3 rounded-[--radius-carte] border border-bordure bg-fond p-3 text-lecture leading-relaxed text-texte-doux"
          >
            <span className="font-semibold text-texte">{geste.terme}</span> — {geste.definition}
          </p>
        ))}
    </>
  )
}
