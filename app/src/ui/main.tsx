// ui/main.tsx — coquille de la PWA : navigation, bandeau de persistance, montage React.
//
// Les écrans vivent dans `ui/screens/`, le socle partagé (catalogue, moteur, `user.db`, profil)
// dans `ui/socle.ts`, les jetons de design dans `ui/theme.css`. Ce fichier ne contient aucune
// logique métier — il en portait toute quand il n'y avait qu'un écran.
//
// ⚠️ `ui/screens/` et non `features/` comme l'écrit §9 ARCHITECTURE. §9 décrit une arborescence qui
// ne correspond déjà plus au moteur (`engine/types.ts`, `engine/filters.ts`… n'existent pas,
// remplacés par domain/ selection/ planning/). Rouvrir ce chantier pour deux écrans n'apporterait
// rien ; à signaler le jour où les huit existeront.

import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Aujourdhui } from './screens/aujourdhui.js'
import { Semaine } from './screens/semaine.js'
import { Courses } from './screens/courses.js'
import { Recettes } from './screens/recettes.js'
import { DetailRecette } from './screens/detail-recette.js'
import { Frigo } from './screens/frigo.js'
import { Savoir } from './screens/savoir.js'
import { Accueil, VERSION_CONSENTEMENT } from './screens/accueil.js'
import { Navigation } from './navigation.js'
import { chargerSocle } from './socle.js'
import { aConsenti } from '../data/user-store.js'
import { surErreurDePersistance } from './user-source.js'
import { useRoute, type Onglet, type SousVue } from './router.js'
import { enregistrerServiceWorker } from './sw-register.js'
import './index.css'

/**
 * Ce que la coquille doit dire sur le sort des données — §7 ARCHITECTURE, mesure 6.
 *
 * Trois situations, de la plus grave à la plus bénigne, et elles ne se disent pas pareil : ne rien
 * conserver du tout, avoir perdu une écriture, ou dépendre du bon vouloir du navigateur.
 */
type Alerte = 'aucune' | 'memoire' | 'echec_ecriture' | 'non_persistant'

const MESSAGE: Readonly<Record<Exclude<Alerte, 'aucune'>, string>> = {
  memoire:
    "Cet appareil ne permet pas d'enregistrer vos données : elles seront perdues en fermant l'onglet.",
  echec_ecriture:
    "Une modification n'a pas pu être enregistrée. L'espace de stockage est peut-être saturé.",
  non_persistant:
    "Vos réglages sont enregistrés sur cet appareil, mais le navigateur ne garantit pas de les conserver. Ajoutez l'application à votre écran d'accueil pour ne rien perdre.",
}

function Ecran({ onglet, sousVue }: { readonly onglet: Onglet; readonly sousVue: SousVue }) {
  // La sous-vue prime sur l'onglet : fiche et frigo appartiennent à `recettes`, mais on y arrive
  // aussi depuis la semaine, les courses ou Aujourd'hui.
  if (sousVue.type === 'recette') return <DetailRecette recetteId={sousVue.id} />
  if (sousVue.type === 'frigo') return <Frigo />
  if (onglet === 'aujourdhui') return <Aujourdhui />
  if (onglet === 'semaine') return <Semaine />
  if (onglet === 'courses') return <Courses />
  if (onglet === 'recettes') return <Recettes />
  // ⚠️ PAS DE BRANCHE PAR DÉFAUT. Les cinq onglets ont désormais un écran ; un repli
  // « pas encore construit » serait du code mort qui MENT sur des écrans qui existent. Si un
  // sixième onglet apparaît sans son écran, TypeScript signalera le chemin manquant ici.
  return <Savoir />
}

function Coquille() {
  const route = useRoute()
  const [alerte, setAlerte] = useState<Alerte>('aucune')
  /**
   * `null` = on ne sait pas encore. Distinguer « pas encore lu » de « pas consenti » évite le
   * clignotement où l'accueil s'affiche une fraction de seconde à chaque lancement d'une
   * application déjà configurée.
   */
  const [consenti, setConsenti] = useState<boolean | null>(null)

  useEffect(() => {
    let annule = false
    // ⚠️ Une écriture OPFS échoue APRÈS coup, détachée du geste de l'utilisateur : personne ne peut
    // l'attraper au vol. Sans ce canal, l'application continuerait de tourner parfaitement — en
    // mémoire — et la perte ne se découvrirait qu'au rechargement.
    surErreurDePersistance(() => {
      if (!annule) setAlerte('echec_ecriture')
    })
    // Échec ignoré : c'est aux écrans d'afficher l'erreur de chargement, la coquille ne relève que
    // l'état du stockage.
    chargerSocle().then(
      (socle) => {
        if (annule) return
        if (socle.stockage === 'memoire') setAlerte('memoire')
        else if (!socle.persistant) setAlerte('non_persistant')
        setConsenti(aConsenti(socle.db, VERSION_CONSENTEMENT))
      },
      // Socle indisponible : on n'impose pas l'accueil, les écrans afficheront l'erreur réelle.
      () => setConsenti(true)
    )
    return () => {
      annule = true
    }
  }, [])

  if (consenti === null) return null

  // ⚠️ PAS DE BARRE DE NAVIGATION PENDANT L'ACCUEIL. §4.8 est un parcours linéaire jusqu'à une
  // première suggestion utile ; laisser les cinq onglets accessibles permettrait d'atterrir sur
  // « Semaine » sans avoir déclaré ses allergies, c'est-à-dire exactement le trou qu'on referme.
  if (!consenti) {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-8">
        <Accueil onTermine={() => setConsenti(true)} />
      </div>
    )
  }

  return (
    <>
      <Navigation courante={route.onglet} />
      {/* `pb-28` réserve la hauteur de la barre du bas sur mobile ; sur bureau la barre passe à
          gauche (`lg:pl-56`) et la réserve disparaît. Marges en rem, jamais de hauteur figée. */}
      <div className="mx-auto max-w-3xl px-5 pb-28 pt-6 lg:pb-10 lg:pl-64 lg:pr-8">
        {alerte !== 'aucune' && (
          <p
            role="status"
            className="mb-5 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[0.95rem] leading-relaxed text-alerte-texte"
          >
            {MESSAGE[alerte]}
          </p>
        )}
        <main>
          <Ecran onglet={route.onglet} sousVue={route.sousVue} />
        </main>
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Coquille />
  </StrictMode>
)

// Hors du rendu : l'installation du service worker ne concerne pas React, et l'attacher à un
// composant la relancerait à chaque montage.
enregistrerServiceWorker()
