// ui/main.tsx — coquille de la PWA : navigation, bandeau de persistance, montage React.
//
// Les écrans vivent dans `ui/screens/`, le socle partagé (catalogue, moteur, `user.db`, profil)
// dans `ui/socle.ts`. Ce fichier ne contient plus aucune logique métier — il en portait toute
// quand il n'y avait qu'un écran.
//
// ⚠️ `ui/screens/` et non `features/` comme l'écrit §9 ARCHITECTURE. §9 décrit une arborescence
// qui ne correspond déjà plus au moteur (`engine/types.ts`, `engine/filters.ts`… n'existent pas,
// remplacés par domain/ selection/ planning/). Rouvrir ce chantier pour deux écrans n'apporterait
// rien ; à signaler le jour où les huit existeront.

import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Aujourdhui } from './screens/aujourdhui.js'
import { Semaine } from './screens/semaine.js'
import { chargerSocle } from './socle.js'
import { hashDe, useRoute, type Route } from './router.js'
import './index.css'

const ONGLETS: readonly { readonly route: Route; readonly libelle: string }[] = [
  { route: 'aujourdhui', libelle: "Aujourd'hui" },
  { route: 'semaine', libelle: 'Ma semaine' },
]

function Coquille() {
  const route = useRoute()
  const [persistant, setPersistant] = useState(true)

  useEffect(() => {
    let annule = false
    // Échec ignoré : c'est aux écrans d'afficher l'erreur de chargement, la coquille ne fait que
    // relever l'état de persistance.
    chargerSocle().then(
      (socle) => {
        if (!annule) setPersistant(socle.persistant)
      },
      () => undefined
    )
    return () => {
      annule = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* §7 ARCHITECTURE mesure 6 : bandeau PERMANENT si la persistance a été refusée. */}
      {!persistant && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Vos réglages sont enregistrés sur cet appareil, mais le navigateur ne garantit pas de les
          conserver. Ajoutez l'application à votre écran d'accueil pour ne rien perdre.
        </p>
      )}

      <nav className="mb-6 flex gap-1 border-b border-stone-200">
        {ONGLETS.map((onglet) => (
          <a
            key={onglet.route}
            href={hashDe(onglet.route)}
            aria-current={route === onglet.route ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              route === onglet.route
                ? 'border-stone-800 font-medium text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {onglet.libelle}
          </a>
        ))}
      </nav>

      <main>{route === 'semaine' ? <Semaine /> : <Aujourdhui />}</main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Coquille />
  </StrictMode>
)
