// ui/screens/aujourdhui.tsx — écran « Aujourd'hui » (§4.1 DESIGN).
//
// Déplacé de `main.tsx` à l'arrivée du deuxième écran ; le comportement est inchangé. Le socle
// (catalogue, moteur, `user.db`, profil) vient de `ui/socle.ts`, partagé avec « Semaine ».

import { useCallback, useEffect, useState } from 'react'
import type { MealSlot, Minutes, ScoredSuggestion, SuggestionRequest } from '../../engine/domain/index.js'
import { min } from '../../engine/domain/index.js'
import { readRythme, readUserState, recordMeal, type StoredUserState } from '../../data/user-store.js'
import type { UserProfile } from '../../engine/domain/index.js'
import {
  FENETRE_HISTORIQUE_JOURS,
  aujourdhuiIso,
  chargerSocle,
  profilCourant,
} from '../socle.js'
import { hashDeRecette, hashDuFrigo } from '../router.js'
import { REPAS_PAR_DEFAUT, TITRE_CRENEAU, creneauDuMoment, creneauxDuRythme } from '../creneau.js'

/**
 * Assemble la requête moteur à partir de l'état persisté et du contexte d'écran.
 *
 * La frontière vaut d'être tenue : `user.db` fournit ce qui SURVIT (profil, contraintes, goûts,
 * historique), l'écran fournit ce qui ne survit pas (le créneau regardé, la date, la graine).
 */
/**
 * Est-on samedi ou dimanche ? Le rythme distingue semaine et week-end (§4.8, écran 5).
 *
 * `getUTCDay` et non `getDay` : les dates du plan sont des JOURS, pas des instants — lire l'heure
 * locale ferait basculer le vendredi soir au samedi selon le fuseau du navigateur.
 */
function estWeekend(isoDate: string): boolean {
  const jour = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return jour === 0 || jour === 6
}

function construireRequete(
  etat: StoredUserState,
  profile: UserProfile,
  date: string,
  creneau: MealSlot,
  tempsDisponibleMin: Minutes | null
): SuggestionRequest {
  return {
    profile,
    constraints: etat.constraints,
    context: {
      date,
      creneau,
      envie: null,
      tempsDisponibleMin,
      // Exigence ponctuelle « je veux ça » : par construction jamais persistée (§6.5 ter ENGINE).
      requiredFoodIds: [],
      pantryFoodIds: etat.pantryFoodIds,
    },
    history: etat.history,
    preferences: etat.preferences,
    favoriteRecipeIds: etat.favoriteRecipeIds,
    activeTopics: etat.activeTopics,
    seed: 1,
    limit: 5,
  }
}

interface Vue {
  readonly suggestions: readonly ScoredSuggestion[]
  readonly nomDe: (id: string) => string
  readonly nbRetenus: number
  /** Le repas regardé, déduit de l'heure locale et du rythme déclaré. */
  readonly creneau: MealSlot
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

async function calculerVue(): Promise<Vue> {
  const socle = await chargerSocle()
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const etat = readUserState(socle.db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: date })

  // ⚠️ LE CHAMP EXISTAIT DEPUIS P0 ET RESTAIT `null` : la couche `temps` n'avait aucune source de
  // données, exactement le défaut corrigé en P1b-2 sur `preference`. Le rythme du premier lancement
  // la remplit enfin. Absent (parcours sauté) → `null`, soit « pas de limite ».
  const rythme = readRythme(socle.db)
  const minutes = estWeekend(date) ? rythme?.tempsWeekendMin : rythme?.tempsSemaineMin

  // ⚠️ HEURE LOCALE, contrairement aux dates du plan qui sont en UTC — voir l'en-tête de `creneau.ts`.
  // Le rythme absent (parcours sauté) retombe sur le défaut, jamais sur une liste vide.
  const creneau = creneauDuMoment(
    new Date().getHours(),
    creneauxDuRythme(rythme?.repasParJour ?? REPAS_PAR_DEFAUT)
  )

  const resultat = socle.moteur.suggestMeals(
    construireRequete(
      etat,
      profil,
      date,
      creneau,
      minutes === undefined || minutes === null ? null : min(minutes)
    )
  )

  return {
    suggestions: resultat.suggestions,
    nomDe: (id) => socle.catalogue.recipes.get(id as never)?.nom ?? id,
    nbRetenus: etat.history.entries.length,
    creneau,
  }
}

export function Aujourdhui() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

  const rafraichir = useCallback(() => {
    let annule = false
    calculerVue()
      .then((vue) => {
        if (!annule) setEtat({ phase: 'pret', vue })
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        }
      })
    return () => {
      annule = true
    }
  }, [])

  useEffect(rafraichir, [rafraichir])

  /**
   * « J'ai choisi ce plat » — écrit une entrée d'historique d'origine `choisi`.
   *
   * ⚠️ CE N'EST PAS UN JOURNAL ALIMENTAIRE (§6.5 ARCHITECTURE). Le geste est facultatif, sans
   * quantité, sans relance et sans conséquence si on ne le fait jamais. Il enregistre « ce plat a
   * été retenu », pas « voici ce que j'ai mangé ».
   */
  const retenir = useCallback(
    (recipeId: string, creneau: MealSlot) => {
      chargerSocle()
        .then((socle) => {
          // ⚠️ LE CRÉNEAU VIENT DE LA VUE, pas d'une relecture de l'horloge. Un plat retenu à 13 h 59
          // doit s'enregistrer sur le déjeuner qu'on regardait, même si l'écriture aboutit à 14 h 01.
          recordMeal(socle.db, {
            recipeId: recipeId as never,
            date: aujourdhuiIso(),
            creneau,
            origine: 'choisi',
          })
          rafraichir()
        })
        .catch((erreur: unknown) => {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        })
    },
    [rafraichir]
  )

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">
          Les suggestions n'ont pas pu être calculées.
        </p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat
  return (
    <section>
      <h1 className="text-[2.1rem] text-texte">{TITRE_CRENEAU[vue.creneau]}</h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-attenue">
        {vue.suggestions.length} suggestions, classées et diversifiées.
        {vue.nbRetenus > 0 &&
          ` ${vue.nbRetenus} plat${vue.nbRetenus > 1 ? 's' : ''} retenu${vue.nbRetenus > 1 ? 's' : ''} ces ${FENETRE_HISTORIQUE_JOURS} derniers jours.`}
      </p>

      {/* §4.5 DESIGN veut « Vider le frigo » accessible « depuis Aujourd'hui et Recettes ». Le
          routeur le documentait déjà ; seule l'entrée depuis Recettes existait. */}
      <a
        href={hashDuFrigo()}
        className="mt-4 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        Vider le frigo — partir de ce que j'ai
      </a>

      <ul className="mt-6 space-y-3">
        {vue.suggestions.map((suggestion) => (
          <li
            key={suggestion.recipeId}
            className="rounded-[--radius-carte] border border-bordure bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-titre text-[1.35rem]">
                <a href={hashDeRecette(suggestion.recipeId)} className="text-texte no-underline">
                  {vue.nomDe(suggestion.recipeId)}
                </a>
              </h2>
              <span className="shrink-0 text-[0.85rem] tabular-nums text-attenue">
                {Math.round(suggestion.score)}/100
              </span>
            </div>
            {/* ⚠️ Les explications viennent du moteur (§6.7) et passent `assertNoTherapeuticClaim`.
                Ne JAMAIS composer une phrase d'explication ici : la garde ne verrait rien. */}
            <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">
              {suggestion.explanations.map((e) => e.label).join(' · ')}
            </p>
            {/* Cible tactile : `min-h-tactile` (3rem) et non un padding en px — la cible doit
                grandir avec la police système, pas rester figée. */}
            <button
              type="button"
              onClick={() => retenir(suggestion.recipeId, vue.creneau)}
              className="mt-4 flex min-h-tactile w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux hover:bg-accent-doux"
            >
              J'ai choisi ce plat
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
