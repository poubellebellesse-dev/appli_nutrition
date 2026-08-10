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

import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Aujourdhui } from './screens/aujourdhui.js'
import { Semaine } from './screens/semaine.js'
import { Courses } from './screens/courses.js'
import { Recettes } from './screens/recettes.js'
import { DetailRecette } from './screens/detail-recette.js'
import { Frigo } from './screens/frigo.js'
import { Savoir } from './screens/savoir.js'
import { Accueil, VERSION_CONSENTEMENT } from './screens/accueil.js'
import { Parametres } from './screens/parametres.js'
import { EditeurRecette } from './screens/editeur-recette.js'
import { Cuisine } from './screens/cuisine.js'
import { Aliment } from './screens/aliment.js'
import { Navigation } from './navigation.js'
import { Panneau } from './panneau.js'
import { Visite } from './visite.js'
import { PARCOURS, etapesDuParcours } from './parcours.js'
import { ProvenanceLancerParcours } from './lancer-parcours.js'
import { chargerSocle } from './socle.js'
import { aConsenti, readDisplay, writeDisplay } from '../data/user-store.js'
import { surErreurDePersistance } from './user-source.js'
import { hashDe, hashDesParametres, useRoute, type Onglet, type SousVue } from './router.js'
import { enregistrerServiceWorker, surMiseAJourDisponible } from './sw-register.js'
import './index.css'

/**
 * Ce que la coquille doit dire sur le sort des données — §7 ARCHITECTURE, mesure 6.
 *
 * Trois situations, de la plus grave à la plus bénigne, et elles ne se disent pas pareil : ne rien
 * conserver du tout, avoir perdu une écriture, ou dépendre du bon vouloir du navigateur.
 */
type Alerte = 'aucune' | 'memoire' | 'autre_onglet' | 'echec_ecriture' | 'non_persistant'

const MESSAGE: Readonly<Record<Exclude<Alerte, 'aucune'>, string>> = {
  memoire:
    "Cet appareil ne permet pas d'enregistrer vos données : elles seront perdues en fermant l'onglet.",
  autre_onglet:
    "L'application est déjà ouverte dans un autre onglet, et c'est lui qui enregistre. Ce que vous ferez ici ne sera pas conservé — continuez dans l'autre onglet, ou fermez-le et rechargez cette page.",
  echec_ecriture:
    "Une modification n'a pas pu être enregistrée. L'espace de stockage est peut-être saturé.",
  non_persistant:
    "Vos réglages sont enregistrés sur cet appareil, mais le navigateur ne garantit pas de les conserver. Ajoutez l'application à votre écran d'accueil pour ne rien perdre.",
}

/**
 * Quelles alertes peuvent être écartées.
 *
 * ⚠️ `non_persistant` SEULEMENT, et la distinction est de fond. Ce message décrit un ÉTAT
 * permanent — le navigateur *pourrait* faire de la place un jour — qu'on peut avoir lu, compris et
 * accepté ; le répéter sur chaque écran à chaque visite est du harcèlement, pas de l'information.
 * Les deux autres décrivent une PERTE EN TRAIN DE SE PRODUIRE : « cet appareil n'enregistre rien »
 * et « une modification n'a pas pu être enregistrée ». On ne referme pas ceux-là — la personne
 * travaillerait alors dans une application qui perd ce qu'elle fait, sans plus rien à l'écran pour
 * le dire. §7 ARCHITECTURE mesure 6.
 */
const ECARTABLE: Readonly<Record<Exclude<Alerte, 'aucune'>, boolean>> = {
  memoire: false,
  // Même famille que `memoire` : cet onglet-ci n'enregistre rien. Le refermer laisserait quelqu'un
  // travailler dans une page dont le travail sera perdu, sans plus rien à l'écran pour le dire.
  autre_onglet: false,
  echec_ecriture: false,
  non_persistant: true,
}

function Ecran({
  onglet,
  sousVue,
}: {
  readonly onglet: Onglet
  readonly sousVue: SousVue
}) {
  // La sous-vue prime sur l'onglet : fiche et frigo appartiennent à `recettes`, mais on y arrive
  // aussi depuis la semaine, les courses ou Aujourd'hui.
  if (sousVue.type === 'recette') return <DetailRecette recetteId={sousVue.id} origine={sousVue.origine} />
  if (sousVue.type === 'frigo') return <Frigo />
  // ⚠️ `Parametres` ne reçoit plus `onLancerVisite` en prop : il lance ses parcours via
  // `useLancerParcours()` (voir `ui/lancer-parcours.tsx`), exactement comme les six autres écrans.
  if (sousVue.type === 'parametres') return <Parametres />
  if (sousVue.type === 'editeur') return <EditeurRecette baseId={sousVue.baseId} />
  if (sousVue.type === 'cuisine') return <Cuisine plats={sousVue.plats} />
  if (sousVue.type === 'aliment')
    return <Aliment alimentId={sousVue.id} retour={sousVue.retour} />
  if (onglet === 'aujourdhui') return <Aujourdhui />
  if (onglet === 'semaine') return <Semaine />
  if (onglet === 'courses') return <Courses />
  if (onglet === 'recettes') return <Recettes />
  // ⚠️ PAS DE BRANCHE PAR DÉFAUT. Les cinq onglets ont désormais un écran ; un repli
  // « pas encore construit » serait du code mort qui MENT sur des écrans qui existent. Si un
  // sixième onglet apparaît sans son écran, TypeScript signalera le chemin manquant ici.
  return <Savoir />
}

/**
 * L'accès aux réglages, en tête de chaque écran.
 *
 * ⚠️ ENGRENAGE **ET** LIBELLÉ, jamais l'icône seule. Le bloc commun des maquettes l'impose sans
 * réserve — « Chaque icône est TOUJOURS accompagnée de son libellé texte », « INTERDIT : menu
 * hamburger, navigation cachée » — et c'est la contrainte d'âge du produit : un engrenage nu est une
 * convention que l'utilisateur visé n'a pas forcément. Voir l'en-tête de `navigation.tsx`.
 *
 * En tête de contenu plutôt qu'en barre fixe : une seconde barre flottante mangerait la hauteur
 * utile sur un petit écran, et l'écran Paramètres n'est pas une destination fréquente.
 */
function LienParametres({ actif }: { readonly actif: boolean }) {
  return (
    <div className="mb-4 flex justify-end">
      <a
        href={hashDesParametres()}
        aria-current={actif ? 'page' : undefined}
        className={
          'flex min-h-tactile items-center gap-2 rounded-[--radius-carte] px-3 text-[0.95rem] font-medium no-underline ' +
          (actif ? 'text-accent-texte' : 'text-attenue hover:text-texte')
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
          // En rem (`h-5` = 1.25rem), comme les icônes de la barre : l'icône grandit avec la police
          // système au lieu de rester figée.
          className="h-5 w-5 shrink-0"
        >
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03z" />
        </svg>
        Paramètres
      </a>
    </div>
  )
}

function Coquille() {
  const route = useRoute()
  const refContenu = useRef<HTMLElement>(null)
  /**
   * La route du rendu précédent, pour distinguer une vraie navigation d'un simple remontage.
   *
   * ⚠️ UN DRAPEAU « a déjà monté » NE SUFFIT PAS. `<StrictMode>` (bas de ce fichier) invoque chaque
   * effet DEUX FOIS au montage en développement : le premier passage lèverait le drapeau, le second
   * le trouverait levé et volerait le focus au chargement — exactement ce que la garde existe pour
   * empêcher. Comparer la route est idempotent, donc insensible au nombre d'invocations.
   *
   * Repose sur `lireRouteStable` (`router.tsx`), qui ne rend un nouvel objet que si le hash a
   * changé. Si cette stabilité disparaissait, l'effet se déclencherait à chaque rendu.
   */
  const refRoutePrecedente = useRef(route)
  const [alerte, setAlerte] = useState<Alerte>('aucune')
  /**
   * `null` = on ne sait pas encore. Distinguer « pas encore lu » de « pas consenti » évite le
   * clignotement où l'accueil s'affiche une fraction de seconde à chaque lancement d'une
   * application déjà configurée.
   */
  const [consenti, setConsenti] = useState<boolean | null>(null)
  /**
   * La visite guidée (`ui/visite.tsx`) n'est proposée qu'UNE fois, à la fin de l'intro —
   * `visite_proposee` (`user_display`, v7) mémorise qu'on l'a déjà fait, accepter ou refuser comptent
   * pareil. `'aucune'` : rien à montrer. `'invitation'` : la fenêtre qui demande. `'active'` : la
   * visite tourne.
   */
  const [etapeVisite, setEtapeVisite] = useState<'aucune' | 'invitation' | 'active'>('aucune')
  /** Quel parcours la visite active joue — l'invitation de fin d'accueil lance toujours « menus ». */
  const [parcoursActif, setParcoursActif] = useState('menus')
  /**
   * Un parcours demandé depuis un AUTRE écran que le sien (typiquement Réglages), en attente que la
   * navigation vers `parcours.ecran` ait réellement abouti avant de monter `<Visite>`.
   *
   * ⚠️ SANS CETTE ATTENTE, `<Visite>` MESURERAIT LE MAUVAIS ÉCRAN. Poser `window.location.hash` ne
   * change pas la route SYNCHRONEMENT : `useRoute()` (`router.tsx`) ne se met à jour qu'à
   * l'événement `hashchange`, un tick plus tard. Monter la visite dans le même rendu que la
   * navigation la ferait chercher ses cibles dans le DOM de l'écran qu'on est en train de QUITTER —
   * aucune ne résoudrait, et la visite se terminerait aussitôt, en silence (voir `parcours.ts`).
   */
  const [parcoursEnAttente, setParcoursEnAttente] = useState<string | null>(null)
  /**
   * Le geste qui bascule sur la nouvelle version, ou `null` tant qu'aucune n'attend.
   *
   * ⚠️ RANGER UNE FONCTION DANS UN ÉTAT DEMANDE LA FORME `setX(() => f)`. `setX(f)` la prendrait
   * pour une fonction de mise à jour, l'appellerait avec l'état précédent, et rangerait son
   * résultat — ici `undefined`. Le bandeau ne s'afficherait jamais, et la bascule partirait au
   * moment exact où elle devait devenir proposable.
   */
  const [appliquerMiseAJour, setAppliquerMiseAJour] = useState<(() => void) | null>(null)

  /** Écrit `visite_proposee = 1` puis, selon la réponse, lance la visite ou referme l'invitation. */
  const repondreInvitation = (accepte: boolean) => {
    chargerSocle()
      .then((socle) => writeDisplay(socle.db, { ...readDisplay(socle.db), visiteProposee: true }))
      .catch(() => undefined)
    setEtapeVisite(accepte ? 'active' : 'aucune')
  }

  /**
   * `lancerParcours(id)`, posé dans le contexte pour tous les écrans (voir `ui/lancer-parcours.tsx`).
   *
   * ⚠️ NAVIGUE D'ABORD SI LE PARCOURS APPARTIENT À UN AUTRE ÉCRAN. C'est le cas depuis la fenêtre
   * « Revoir un tutoriel » de Réglages (`parametres.tsx`), qui liste TOUS les parcours : en choisir
   * un qui concerne Semaine depuis Réglages doit d'abord y aller, pas afficher une visite muette.
   * Lancé depuis l'écran auquel le parcours appartient déjà (le cas courant, via `LienTutoriel`),
   * la navigation est un no-op — le hash ne change pas.
   */
  const lancerParcours = (id: string) => {
    const parcours = PARCOURS.find((p) => p.id === id)
    if (parcours === undefined) return
    if (parcours.ecran !== null && window.location.hash !== parcours.ecran) {
      window.location.hash = parcours.ecran
      setParcoursEnAttente(id)
      return
    }
    setParcoursActif(id)
    setEtapeVisite('active')
  }

  // Termine la navigation en attente : une fois la route réellement arrivée sur l'écran du parcours,
  // on peut monter `<Visite>` sans risquer de mesurer le DOM de l'écran précédent (voir plus haut).
  useEffect(() => {
    if (parcoursEnAttente === null) return
    const parcours = PARCOURS.find((p) => p.id === parcoursEnAttente)
    if (parcours !== undefined && window.location.hash === parcours.ecran) {
      setParcoursActif(parcoursEnAttente)
      setEtapeVisite('active')
      setParcoursEnAttente(null)
    }
    // `route` (et non `window.location.hash`) en dépendance : c'est le changement de route, notifié
    // par `useRoute()`, qui doit redéclencher cette vérification.
  }, [route, parcoursEnAttente])

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
        // ⚠️ AVANT `non_persistant`, et l'ordre est le bon : « un autre onglet enregistre à ma place »
        // décrit une perte EN COURS, `non_persistant` un risque futur. La plus grave se dit.
        else if (socle.verrou === 'partage') setAlerte('autre_onglet')
        // Le bandeau écarté une fois ne revient pas — mais seulement celui-là (voir `ECARTABLE`).
        else if (!socle.persistant && !readDisplay(socle.db).bandeauStockageMasque) {
          setAlerte('non_persistant')
        }
        setConsenti(aConsenti(socle.db, VERSION_CONSENTEMENT))
      },
      // Socle indisponible : on n'impose pas l'accueil, les écrans afficheront l'erreur réelle.
      () => setConsenti(true)
    )
    return () => {
      annule = true
    }
  }, [])

  /**
   * L'annonce d'une nouvelle version — voir `ui/sw-register.ts`.
   *
   * ⚠️ ON S'ABONNE, ON N'ENREGISTRE PAS. L'enregistrement du service worker reste hors de React (fin
   * de ce fichier) : l'attacher à un composant le relancerait à chaque montage. Mais l'événement,
   * lui, doit atteindre l'interface — d'où le canal d'abonnement, exactement comme
   * `surErreurDePersistance` juste au-dessus. Le tampon de `sw-register.ts` couvre le cas où la
   * mise à jour est détectée avant que cet effet ait tourné.
   */
  useEffect(() => {
    surMiseAJourDisponible((appliquer) => setAppliquerMiseAJour(() => appliquer))
  }, [])

  /**
   * Focus sur le contenu à chaque changement de route, et défilement remis à zéro.
   *
   * ⚠️ LE PREMIER MONTAGE EST IGNORÉ. Voler le focus au chargement annoncerait l'écran sans qu'on
   * l'ait demandé. Au passage, remettre le défilement à zéro corrige un vrai défaut : changer
   * d'onglet en étant descendu dans la page atterrissait jusqu'ici au milieu du nouvel écran.
   */
  useEffect(() => {
    if (refRoutePrecedente.current === route) return
    refRoutePrecedente.current = route
    refContenu.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [route])

  if (consenti === null) return null

  // ⚠️ PAS DE BARRE DE NAVIGATION PENDANT L'ACCUEIL. §4.8 est un parcours linéaire jusqu'à une
  // première suggestion utile ; laisser les cinq onglets accessibles permettrait d'atterrir sur
  // « Semaine » sans avoir déclaré ses allergies, c'est-à-dire exactement le trou qu'on referme.
  if (!consenti) {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-10 pt-8">
        {/* ⚠️ ON ATTERRIT EXPLICITEMENT SUR « Aujourd'hui », on ne laisse pas l'adresse décider.
            L'accueil ne touchait pas au fragment d'URL : en sortant, la coquille rendait l'onglet
            que le fragment désignait encore. Sur une première installation il est vide, donc le
            défaut tombait juste par accident — mais un parcours ROUVERT par un nouveau texte de
            consentement (§6.4) part de l'écran où la personne se trouvait, et elle se retrouvait
            devant « Semaine » ou « Courses » au sortir de l'introduction, sans la suggestion que
            tout le parcours vient de préparer. */}
        <Accueil
          onTermine={() => {
            window.location.hash = hashDe('aujourdhui')
            setConsenti(true)
            // La visite ne se propose qu'une fois (voir `etapeVisite` ci-dessus) : on relit le
            // drapeau plutôt que de supposer qu'il vaut encore 0.
            chargerSocle()
              .then((socle) => {
                if (!readDisplay(socle.db).visiteProposee) setEtapeVisite('invitation')
              })
              .catch(() => undefined)
          }}
        />
      </div>
    )
  }

  return (
    <ProvenanceLancerParcours value={lancerParcours}>
      {/* Premier élément focusable du document. ⚠️ UN `<button>`, JAMAIS UNE ANCRE `#contenu` : le
          routeur est par hash (voir `router.tsx`), une ancre déclencherait `hashchange` et
          `ONGLET_PAR_HASH` ne reconnaîtrait pas `#contenu` — le repli renverrait sur « Aujourd'hui »,
          l'inverse exact de ce que ce lien doit faire. Invisible tant qu'il n'a pas le focus
          (`.sr-only`, `theme.css`). */}
      <button
        type="button"
        onClick={() => refContenu.current?.focus({ preventScroll: true })}
        className="sr-only"
      >
        Aller au contenu
      </button>
      <Navigation courante={route.onglet} />
      {/* `pb-28` réserve la hauteur de la barre du bas sur mobile ; sur bureau la barre passe à
          gauche (`lg:pl-56`) et la réserve disparaît. Marges en rem, jamais de hauteur figée. */}
      <div className="mx-auto max-w-3xl px-5 pb-28 pt-6 lg:pb-10 lg:pl-64 lg:pr-8">
        <LienParametres actif={route.sousVue.type === 'parametres'} />
        {alerte !== 'aucune' && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[0.95rem] leading-relaxed text-alerte-texte"
          >
            <p className="flex-1">{MESSAGE[alerte]}</p>
            {ECARTABLE[alerte] && (
              <button
                type="button"
                onClick={() => {
                  setAlerte('aucune')
                  chargerSocle()
                    .then((socle) => {
                      // Relire puis étaler : `writeDisplay` remplace la ligne entière.
                      writeDisplay(socle.db, {
                        ...readDisplay(socle.db),
                        bandeauStockageMasque: true,
                      })
                    })
                    .catch(() => undefined)
                }}
                // Cible tactile pleine, et un libellé accessible : une croix seule n'annonce rien.
                aria-label="Masquer cet avertissement"
                className="-my-2 -mr-2 flex min-h-tactile w-12 shrink-0 items-center justify-center rounded-[0.6rem] text-[1.3rem] leading-none"
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
        )}
        {/* ⚠️ APRÈS les alertes de stockage, jamais avant : celles-là décrivent une perte EN TRAIN
            de se produire, celle-ci est une PROPOSITION. `role="status"` et non `alert` pour la
            même raison — rien n'est cassé, rien ne presse.
            ⛔ ET RECHARGER LA PAGE NE SUFFIRAIT PAS. Le worker en attente ne prend la main qu'une
            fois tous les onglets de l'origine fermés ; ce bouton lui ENVOIE un message (voir
            `sw-register.ts`), c'est le seul chemin qui marche depuis un onglet ouvert. */}
        {appliquerMiseAJour !== null && (
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center gap-3 rounded-[--radius-carte] border border-bordure-forte bg-surface p-4 text-[0.95rem] leading-relaxed text-texte"
          >
            <p className="flex-1">Une nouvelle version de l’application est prête.</p>
            <button
              type="button"
              onClick={appliquerMiseAJour}
              className="flex min-h-tactile items-center justify-center rounded-[0.7rem] bg-accent-plein px-4 text-[0.95rem] font-semibold text-white"
            >
              Recharger
            </button>
            {/* Écartable, et la distinction est celle d'`ECARTABLE` plus haut : ce message
                n'annonce aucune perte. Quelqu'un au milieu d'une liste de courses doit pouvoir
                finir. Écarté pour la session seulement — la mise à jour attend toujours, et le
                bandeau reviendra à la prochaine ouverture. */}
            <button
              type="button"
              onClick={() => setAppliquerMiseAJour(null)}
              aria-label="Plus tard"
              className="-my-2 -mr-2 flex min-h-tactile w-12 shrink-0 items-center justify-center rounded-[0.6rem] text-[1.3rem] leading-none text-texte-doux"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}
        <main ref={refContenu} tabIndex={-1}>
          <Ecran onglet={route.onglet} sousVue={route.sousVue} />
        </main>
      </div>

      {/* L'invitation à la visite guidée — jamais un dépliant (voir l'en-tête de `panneau.tsx`) : une
          fenêtre plein écran, comme tout ce qui s'ouvre hors de l'accueil. Pas de déclencheur ici, donc
          pas d'`aria-haspopup` : elle s'affiche d'elle-même, une fois, à la fin de l'intro. */}
      {etapeVisite === 'invitation' && (
        <Panneau titre="Une visite guidée ?" onFermer={() => repondreInvitation(false)}>
          <p className="text-[0.95rem] leading-relaxed text-texte-doux">
            On vous montre les onglets un par un, et vous les touchez vous-même pour avancer. Deux à
            trois minutes, et vous pouvez la passer à tout moment.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => repondreInvitation(false)}
              className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux"
            >
              Non merci
            </button>
            <button
              type="button"
              onClick={() => repondreInvitation(true)}
              className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] bg-accent-plein px-4 text-[0.95rem] font-semibold text-white"
            >
              Oui, je découvre
            </button>
          </div>
        </Panneau>
      )}
      {etapeVisite === 'active' && (
        <Visite etapes={etapesDuParcours(parcoursActif)} onTerminer={() => setEtapeVisite('aucune')} />
      )}
    </ProvenanceLancerParcours>
  )
}

/**
 * La racine React de l'application, EXPORTÉE — et c'est le seul but de l'export.
 *
 * ⚠️ Au navigateur, personne ne la lit : la page se ferme, la racine part avec. **Elle est exportée
 * pour que les tests puissent la RENDRE.** `createRoot(...).render(...)` est appelé À L'IMPORT (voir
 * l'en-tête des fichiers de test), donc `cleanup()` de testing-library ne la connaît pas — il ne
 * démonte que ce qu'il a monté lui-même. Sans cet export, chaque `import('./main.js')` d'un test
 * laissait une racine montée derrière lui, toujours abonnée aux événements de `window`, toujours
 * capable de programmer du travail : quatre racines vivantes à la fin du fichier, qui se disputaient
 * le `hashchange` et se réveillaient après la destruction de jsdom (`ReferenceError: window is not
 * defined`). Voir `reference/PIEGES.md`.
 *
 * ⚠️ **Ne pas transformer cet export en « fonction de montage » appelée conditionnellement.** Ce
 * fichier est le point d'entrée déclaré dans `index.html` ; monter à l'import est son contrat.
 */
export const racine = createRoot(document.getElementById('root')!)

racine.render(
  <StrictMode>
    <Coquille />
  </StrictMode>
)

// Hors du rendu : l'installation du service worker ne concerne pas React, et l'attacher à un
// composant la relancerait à chaque montage.
enregistrerServiceWorker()
