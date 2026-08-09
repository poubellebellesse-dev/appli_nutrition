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
import { readCuissons, type StoredCuisineSession } from '../data/user-store.js'
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
  // ⚠️ LA PÉREMPTION SE COMPTE DEPUIS LA FIN DU DERNIER MINUTEUR, pas depuis l'ouverture : une
  // marinade de 12 h faisait autrement disparaître le bandeau à la seconde où elle aboutissait.
  // Voir `fraicheurDe` dans `cuisine-session.ts`.
  if (session === null || sessionPerimee(session, maintenant)) return null
  return {
    recetteId: session.recetteId,
    depuis: anciennete(session.ouverteLe, maintenant),
    minuteursEchus: minuteursEchus(session, maintenant),
  }
}

function minuteursEchus(session: StoredCuisineSession, maintenant: number): number {
  return session.minuteurs.filter((t) => etatMinuteur(t, maintenant).mode === 'termine').length
}

/**
 * Le bandeau quand PLUSIEURS plats cuisent (schéma v13). `autresPlats` compte ceux qu'on ne nomme
 * pas : le lien les rouvre tous, la barre d'onglets du mode cuisine s'en charge.
 *
 * ⛔ CE BANDEAU LISAIT `WHERE id = 1`, ET LA v13 A FAIT SAUTER CE `CHECK`. Le défaut était muet et
 * il portait sur de la nourriture : ouvrir un rôti (`id = 1`) puis une sauce (`id = 2`), terminer le
 * rôti, et la sauce continuait de mijoter SANS que le bandeau ne la signale plus jamais. Or ce
 * bandeau est ce qui remplace la notification d'arrière-plan — il n'y a rien derrière lui.
 *
 * ⚠️ ON NOMME CELLE QUI RÉCLAME LA MAIN, pas la première venue : un minuteur échu passe devant tout
 * le reste. À égalité, la plus anciennement ouverte — c'est celle qu'on risque le plus d'avoir
 * oubliée. L'ordre est total et reproductible, `recetteId` tranche les ex æquo.
 */
export function resumeDesCuissons(
  cuissons: readonly StoredCuisineSession[],
  maintenant: number
): {
  readonly recetteId: string
  readonly depuis: string | null
  readonly minuteursEchus: number
  readonly autresPlats: number
} | null {
  const vivantes = cuissons.filter((c) => !sessionPerimee(c, maintenant))
  const triees = [...vivantes].sort((a, b) => {
    const echusA = minuteursEchus(a, maintenant) > 0
    const echusB = minuteursEchus(b, maintenant) > 0
    if (echusA !== echusB) return echusA ? -1 : 1
    if (a.ouverteLe !== b.ouverteLe) return a.ouverteLe - b.ouverteLe
    return a.recetteId < b.recetteId ? -1 : a.recetteId > b.recetteId ? 1 : 0
  })
  const tete = resumeDeSession(triees[0] ?? null, maintenant)
  return tete === null ? null : { ...tete, autresPlats: vivantes.length - 1 }
}

export function RepriseCuisine({ nomDeRecette }: { readonly nomDeRecette?: (id: string) => string }) {
  const [cuissons, setCuissons] = useState<readonly StoredCuisineSession[]>([])
  const [maintenant, setMaintenant] = useState(() => Date.now())

  useEffect(() => {
    let vivant = true
    chargerSocle()
      .then((socle) => {
        if (vivant) setCuissons(readCuissons(socle.db))
      })
      .catch(() => {
        /* pas de socle, pas de bandeau : jamais une erreur à l'écran pour ça */
      })
    return () => {
      vivant = false
    }
  }, [])

  /**
   * ⛔ SANS BATTEMENT, CE BANDEAU LISAIT L'HEURE UNE FOIS ET N'Y REVENAIT JAMAIS. Or c'est LUI qui
   * remplace la notification d'arrière-plan (§5) : quelqu'un posé sur « Aujourd'hui » pendant que sa
   * cuisson finit ne voyait jamais apparaître « un minuteur est arrivé à terme », et l'ancienneté
   * restait figée à ce qu'elle valait en arrivant. Le seul cas qui marchait était celui où l'on
   * ouvrait l'écran APRÈS coup.
   *
   * ⚠️ IL NE TOURNE QUE S'IL Y A UNE CUISSON — c'est-à-dire presque jamais. Un intervalle permanent
   * sur l'écran d'accueil pour un bandeau qui n'existe pas serait payé par tout le monde.
   */
  useEffect(() => {
    if (cuissons.length === 0) return undefined
    const battement = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(battement)
  }, [cuissons])

  const resume = resumeDesCuissons(cuissons, maintenant)
  if (resume === null) return null

  const nom = nomDeRecette?.(resume.recetteId) ?? resume.recetteId
  return (
    <a
      href={hashDeLaCuisine(resume.recetteId)}
      className="mb-5 flex min-h-tactile items-center justify-between gap-3 rounded-[--radius-carte] border border-accent bg-accent-doux px-4 py-3 text-accent-texte"
    >
      <span className="text-[1.02rem] leading-snug">
        <span className="font-semibold">Reprendre la cuisson</span> — {nom}
        {/* Le lien ne désigne qu'un plat, mais le mode cuisine rouvre TOUTES les cuissons en base :
            ce compte annonce ce qu'on va retrouver, il ne promet pas un second lien. */}
        {resume.autresPlats > 0 && (
          <span className="text-[0.9rem]">
            {' '}
            et {resume.autresPlats} autre{resume.autresPlats > 1 ? 's' : ''} plat
            {resume.autresPlats > 1 ? 's' : ''}
          </span>
        )}
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
