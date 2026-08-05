// ui/reprise-cuisine.tsx — « vous aviez une cuisson en cours » (§5bis point 7 ARCHITECTURE).
//
// ⚠️ CE BANDEAU REMPLACE LA NOTIFICATION D'ARRIÈRE-PLAN, il ne la complète pas. La v1 ne sonne pas
// quand l'application n'est pas visible — décision instruite, quatre voies Android refusées
// (`CONCEPTION_MODE_CUISINE.md` §5). Ce qu'on rend en échange, c'est qu'au retour l'appli sache
// exactement où en était la cuisson et le DISE, plutôt que d'avoir tout oublié.
//
// ⚠️ IL N'EFFACE RIEN. Une session périmée cesse d'être proposée, elle n'est pas supprimée : la
// supprimer à la lecture ferait dépendre l'état de la base du fait qu'on ait ouvert un écran.

import { useEffect, useState } from 'react'
import { readCuisineSession, type StoredCuisineSession } from '../data/user-store.js'
import { chargerSocle } from './socle.js'
import { hashDeLaCuisine } from './router.js'
import { etatMinuteur, sessionPerimee } from './cuisine-session.js'

/** « il y a 2 h », « il y a 12 min ». Une cuisson d'il y a une minute n'a pas besoin d'ancienneté. */
export function anciennete(ouverteLe: number, maintenant: number): string | null {
  const minutes = Math.floor((maintenant - ouverteLe) / 60_000)
  if (minutes < 2) return null
  if (minutes < 60) return `il y a ${minutes} min`
  return `il y a ${Math.floor(minutes / 60)} h`
}

/**
 * Ce que le bandeau annonce, ou `null` s'il ne doit pas s'afficher. Pur et exporté : c'est la règle,
 * séparée du rendu.
 */
export function resumeDeSession(
  session: StoredCuisineSession | null,
  maintenant: number
): { readonly recetteId: string; readonly depuis: string | null; readonly minuteursEchus: number } | null {
  if (session === null || sessionPerimee(session.ouverteLe, maintenant)) return null
  return {
    recetteId: session.recetteId,
    depuis: anciennete(session.ouverteLe, maintenant),
    minuteursEchus: session.minuteurs.filter((t) => etatMinuteur(t, maintenant).mode === 'termine').length,
  }
}

export function RepriseCuisine({ nomDeRecette }: { readonly nomDeRecette?: (id: string) => string }) {
  const [session, setSession] = useState<StoredCuisineSession | null>(null)

  useEffect(() => {
    let vivant = true
    chargerSocle()
      .then((socle) => {
        if (vivant) setSession(readCuisineSession(socle.db))
      })
      .catch(() => {
        /* pas de socle, pas de bandeau : jamais une erreur à l'écran pour ça */
      })
    return () => {
      vivant = false
    }
  }, [])

  const resume = resumeDeSession(session, Date.now())
  if (resume === null) return null

  const nom = nomDeRecette?.(resume.recetteId) ?? resume.recetteId
  return (
    <a
      href={hashDeLaCuisine(resume.recetteId)}
      className="mb-5 flex min-h-tactile items-center justify-between gap-3 rounded-[--radius-carte] border border-accent bg-accent-doux px-4 py-3 text-accent-texte"
    >
      <span className="text-[1.02rem] leading-snug">
        <span className="font-semibold">Reprendre la cuisson</span> — {nom}
        {resume.depuis !== null && <span className="text-[0.9rem]"> · commencée {resume.depuis}</span>}
        {/* Dire qu'un minuteur est ÉCHU, sans dire depuis quand : l'ancienneté exacte appartient à
            l'écran de cuisine, qui la calcule minuteur par minuteur. Ici, c'est un appel à revenir. */}
        {resume.minuteursEchus > 0 && (
          <span className="block text-[0.9rem] font-semibold">
            {resume.minuteursEchus === 1 ? 'Un minuteur est arrivé à terme.' : `${resume.minuteursEchus} minuteurs sont arrivés à terme.`}
          </span>
        )}
      </span>
      <span aria-hidden="true">→</span>
    </a>
  )
}
