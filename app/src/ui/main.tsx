// ui/main.tsx — point d'entrée de la PWA.
//
// Première tranche VOLONTAIREMENT MINIMALE : un seul écran, « Aujourd'hui » (§4.1 DESIGN). Le but
// n'est pas de livrer l'interface mais de prouver la chaîne complète dans un navigateur —
// catalog.db téléchargé, SQLite WASM, mapping partagé, moteur, suggestions à l'écran. Sept autres
// écrans construits sur une chaîne non vérifiée seraient sept fois le même risque.

import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { chargerCatalogue } from './catalog-source.js'
import { createEngine } from '../engine/api/index.js'
import type { ScoredSuggestion, SuggestionRequest } from '../engine/domain/index.js'
import './index.css'

/**
 * Requête de démonstration. ⚠️ PROVISOIRE : le vrai profil viendra de `user.db` (§4.1
 * ARCHITECTURE) après l'onboarding (§4.8 DESIGN). Aucune valeur n'est inventée en silence — tout
 * est visible ici, et le jour où le profil arrive, ce bloc disparaît d'un coup.
 */
function requeteDemo(date: string): SuggestionRequest {
  return {
    profile: {
      trancheAge: '30_49',
      sexe: 'NP',
      tailleCm: null,
      poidsKg: null,
      niveauActivite: 'actif',
      facteurPortion: 1,
    },
    constraints: { allergies: [], diet: null, excludedFoodIds: [] },
    context: {
      date,
      creneau: 'diner',
      envie: null,
      tempsDisponibleMin: null,
      requiredFoodIds: [],
      pantryFoodIds: [],
    },
    history: { windowDays: 21, entries: [] },
    preferences: new Map(),
    favoriteRecipeIds: new Set(),
    activeTopics: [],
    seed: 1,
    limit: 5,
  }
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly suggestions: readonly ScoredSuggestion[]; readonly nomDe: (id: string) => string }
  | { readonly phase: 'erreur'; readonly message: string }

function Aujourdhui() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

  useEffect(() => {
    let annule = false
    chargerCatalogue()
      .then((catalog) => {
        if (annule) return
        const engine = createEngine(catalog)
        // Date figée : l'horloge du moteur est TOUJOURS injectée (§3 ENGINE), jamais `Date.now()`
        // en interne. Ici c'est l'UI qui la fournit, comme le fera l'écran réel.
        const aujourdhui = new Date().toISOString().slice(0, 10)
        const resultat = engine.suggestMeals(requeteDemo(aujourdhui))
        setEtat({
          phase: 'pret',
          suggestions: resultat.suggestions,
          nomDe: (id) => catalog.recipes.get(id as never)?.nom ?? id,
        })
      })
      .catch((erreur: unknown) => {
        if (!annule) setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
    return () => {
      annule = true
    }
  }, [])

  if (etat.phase === 'chargement') {
    return <p className="p-6 text-stone-500">Chargement du catalogue…</p>
  }
  if (etat.phase === 'erreur') {
    return (
      <div className="p-6">
        <p className="font-medium text-red-700">Le catalogue n'a pas pu être chargé.</p>
        <p className="mt-2 text-sm text-stone-600">{etat.message}</p>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-stone-900">Ce soir</h1>
      <p className="mt-1 text-sm text-stone-500">
        {etat.suggestions.length} suggestions, classées et diversifiées.
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
          </li>
        ))}
      </ul>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Aujourdhui />
  </StrictMode>
)
