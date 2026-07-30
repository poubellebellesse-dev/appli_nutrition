// ui/main.tsx — point d'entrée de la PWA.
//
// Toujours UN SEUL écran, « Aujourd'hui » (§4.1 DESIGN) — mais il ne tourne plus sur des données de
// démonstration. Le profil, les contraintes, les goûts et l'historique viennent de `user.db`
// (OPFS), et ce qu'on y écrit survit au rechargement. C'était le vrai préalable aux sept autres
// écrans : sans base utilisateur, chacun d'eux n'aurait été qu'une maquette de plus.
//
// Ce qui n'est PAS encore là, volontairement : le routage, les cinq écrans d'onboarding (§4.8
// DESIGN) et l'export/import de §7 ARCHITECTURE. D'où le profil par défaut ci-dessous.

import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { chargerCatalogue } from './catalog-source.js'
import { ouvrirUserDb } from './user-source.js'
import { createEngine, type Engine } from '../engine/api/index.js'
import type { UserDb } from '../data/user-db.js'
import { readUserState, recordMeal, writeProfile, type StoredUserState } from '../data/user-store.js'
import type {
  MealSlot,
  ScoredSuggestion,
  SuggestionRequest,
  UserProfile,
} from '../engine/domain/index.js'
import './index.css'

/**
 * Profil semé au tout premier lancement, quand `user.db` est vide.
 *
 * ⚠️ PROVISOIRE, mais plus du tout au même titre que la `requeteDemo()` qu'il remplace. Celle-ci
 * était recalculée à chaque affichage et n'existait nulle part ; ce profil-ci est ÉCRIT EN BASE,
 * relu ensuite comme n'importe quel profil, et sera simplement écrasé par l'écran d'onboarding
 * (§4.8 DESIGN) le jour où il existera. Aucune valeur n'est inventée en silence — elles sont
 * toutes ici, et neutres : pas de gabarit corporel, pas d'allergie devinée, pas de régime supposé.
 */
const PROFIL_PAR_DEFAUT: UserProfile = {
  trancheAge: '30_49',
  sexe: 'NP',
  tailleCm: null,
  poidsKg: null,
  niveauActivite: 'actif',
  facteurPortion: 1,
}

/** L'écran ne couvre que le dîner pour l'instant — « Ce soir ». */
const CRENEAU: MealSlot = 'diner'

/** §13 ENGINE — fenêtre glissante de 21 jours. Appliquée à la LECTURE (voir `readHistory`). */
const FENETRE_HISTORIQUE_JOURS = 21

/**
 * Assemble la requête moteur à partir de l'état persisté et du contexte d'écran.
 *
 * La frontière est nette et vaut d'être tenue : `user.db` fournit ce qui SURVIT (profil,
 * contraintes, goûts, historique), l'écran fournit ce qui ne survit pas (le créneau regardé, la
 * date, la graine, le nombre de résultats). Persister une graine ou un créneau n'aurait aucun sens.
 */
function construireRequete(
  etat: StoredUserState,
  profile: UserProfile,
  date: string
): SuggestionRequest {
  return {
    profile,
    constraints: etat.constraints,
    context: {
      date,
      creneau: CRENEAU,
      envie: null,
      tempsDisponibleMin: null,
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

/**
 * Moteur mémorisé. `createEngine` calcule tous ses index dérivés à l'init (§6.5 précision 8) : le
 * reconstruire à chaque rafraîchissement referait ce travail pour rien.
 */
let moteurCache: Promise<Engine> | undefined
function obtenirMoteur(): Promise<Engine> {
  moteurCache ??= chargerCatalogue().then(createEngine)
  return moteurCache
}

interface VueChargee {
  readonly phase: 'pret'
  readonly suggestions: readonly ScoredSuggestion[]
  readonly nomDe: (id: string) => string
  readonly persistant: boolean
  readonly nbRetenus: number
}

type Etat = { readonly phase: 'chargement' } | VueChargee | { readonly phase: 'erreur'; readonly message: string }

/** Aujourd'hui en ISO. L'horloge est fournie par l'UI et injectée — jamais lue dans engine/ (§3). */
function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

async function calculerVue(): Promise<VueChargee> {
  const [catalogue, moteur, session] = await Promise.all([
    chargerCatalogue(),
    obtenirMoteur(),
    ouvrirUserDb(),
  ])
  const date = aujourdhui()
  const fenetre = { windowDays: FENETRE_HISTORIQUE_JOURS, today: date }

  let etat = readUserState(session.db, fenetre)
  if (etat.profile === null) {
    // Premier lancement : on sème le profil par défaut EN BASE plutôt que de le tenir en mémoire,
    // pour que le chemin de lecture soit le même dès la première seconde que six mois plus tard.
    writeProfile(session.db, PROFIL_PAR_DEFAUT, date)
    etat = readUserState(session.db, fenetre)
  }

  const resultat = moteur.suggestMeals(construireRequete(etat, etat.profile ?? PROFIL_PAR_DEFAUT, date))
  return {
    phase: 'pret',
    suggestions: resultat.suggestions,
    nomDe: (id) => catalogue.recipes.get(id as never)?.nom ?? id,
    persistant: session.persistant,
    nbRetenus: etat.history.entries.length,
  }
}

function Aujourdhui() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

  const rafraichir = useCallback(() => {
    let annule = false
    calculerVue()
      .then((vue) => {
        if (!annule) setEtat(vue)
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
   * été retenu », pas « voici ce que j'ai mangé » — et c'est cette origine `choisi` qui distingue
   * une préférence exprimée d'un reste placé automatiquement.
   */
  const retenir = useCallback(
    (recipeId: string) => {
      ouvrirUserDb()
        .then((session) => {
          enregistrer(session.db, recipeId)
          rafraichir()
        })
        .catch((erreur: unknown) => {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        })
    },
    [rafraichir]
  )

  if (etat.phase === 'chargement') {
    return <p className="p-6 text-stone-500">Chargement…</p>
  }
  if (etat.phase === 'erreur') {
    return (
      <div className="p-6">
        <p className="font-medium text-red-700">L'application n'a pas pu démarrer.</p>
        <p className="mt-2 text-sm text-stone-600">{etat.message}</p>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      {/* §7 ARCHITECTURE mesure 6 : bandeau permanent si la persistance a été refusée. */}
      {!etat.persistant && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Vos réglages sont enregistrés sur cet appareil, mais le navigateur ne garantit pas de les
          conserver. Ajoutez l'application à votre écran d'accueil pour ne rien perdre.
        </p>
      )}

      <h1 className="text-2xl font-semibold text-stone-900">Ce soir</h1>
      <p className="mt-1 text-sm text-stone-500">
        {etat.suggestions.length} suggestions, classées et diversifiées.
        {etat.nbRetenus > 0 && ` ${etat.nbRetenus} plat${etat.nbRetenus > 1 ? 's' : ''} retenu${etat.nbRetenus > 1 ? 's' : ''} ces ${FENETRE_HISTORIQUE_JOURS} derniers jours.`}
      </p>

      <ul className="mt-6 space-y-3">
        {etat.suggestions.map((suggestion) => (
          <li key={suggestion.recipeId} className="rounded-lg border border-stone-200 p-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-medium text-stone-900">{etat.nomDe(suggestion.recipeId)}</h2>
              <span className="shrink-0 text-sm tabular-nums text-stone-500">
                {Math.round(suggestion.score)}/100
              </span>
            </div>
            {/* ⚠️ Les explications viennent du moteur (§6.7) et passent `assertNoTherapeuticClaim`.
                Ne JAMAIS composer une phrase d'explication ici : la garde ne verrait rien. */}
            <p className="mt-2 text-sm text-stone-600">
              {suggestion.explanations.map((e) => e.label).join(' · ')}
            </p>
            <button
              type="button"
              onClick={() => retenir(suggestion.recipeId)}
              className="mt-3 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              J'ai choisi ce plat
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

/** Isolé pour garder le composant lisible — l'entrée d'historique est toujours d'origine `choisi`. */
function enregistrer(db: UserDb, recipeId: string): void {
  recordMeal(db, {
    recipeId: recipeId as never,
    date: aujourdhui(),
    creneau: CRENEAU,
    origine: 'choisi',
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Aujourdhui />
  </StrictMode>
)
