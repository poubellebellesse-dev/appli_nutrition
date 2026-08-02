// ui/screens/accueil.tsx — premier lancement (§4.8 DESIGN).
//
// ⚠️ CE PARCOURS COMBLE UN TROU DE SÉCURITÉ, pas seulement un manque d'ergonomie. Le filtre
// allergènes est le seul garde-fou CRITIQUE et incontournable du moteur (§5.2 ARCHITECTURE : « ce
// filtre n'est jamais pondéré ni contournable ») — mais jusqu'ici aucun écran ne demandait ses
// allergies à l'utilisateur. Il tournait donc sur une liste VIDE, et l'application proposait
// tranquillement du gluten à qui n'en supporte pas. Le code était juste ; il n'avait pas de source.
//
// ⚠️ UN SEUL ÉCRAN EST OBLIGATOIRE — les allergies. §4.8 est explicite : « rien d'obligatoire sauf
// les allergies », et la divulgation progressive veut que l'application serve AVANT d'être
// configurée. En pratique il n'y a pas de bouton « Passer » nommé ainsi, et il n'en faut pas : rien
// n'oblige à cocher quoi que ce soit — « Continuer » et « C'est parti » traversent le parcours avec
// les valeurs par défaut. (Cet en-tête affirmait le contraire, décrivant un bouton qui n'a jamais
// existé.) Ce qui manquait vraiment, c'était le RETOUR : voir le composant `Accueil`.
//
// PÉRIMÈTRE — l'écran 4 (« vos goûts, façon découverte ») n'est PAS ici, pour deux raisons :
//   1. zéro photo sur 241 recettes, et la pile de photos est tout l'écran ;
//   2. plus fondamental : `user_preference` et la couche `preference` travaillent par ALIMENT,
//      l'écran propose des PLATS. Traduire « j'aime ce curry » en préférences d'aliments —
//      ingrédient caractéristique seul ? tous les ingrédients ? avec quelle pondération ? — est une
//      décision de conception absente des docs. La prendre au jugé fausserait le démarrage à froid
//      que cet écran existe justement pour bien résoudre.

import { useCallback, useEffect, useState } from 'react'
import type { Catalog } from '../../engine/domain/index.js'
import { recordConsent } from '../../data/user-store.js'
import {
  POINTS_CONSENTEMENT,
  VERSION_CONSENTEMENT as VERSION,
  type PointConsentement,
} from '../texte-consentement.js'
import { aujourdhuiIso, chargerSocle } from '../socle.js'
import { ChoixAllergenes, ChoixRegime, ChoixRythme } from '../champs-profil.js'
import {
  RYTHME_PAR_DEFAUT,
  ecrireChoixProfil,
  lireChoixProfil,
  type ChoixProfil,
} from '../profil-enregistre.js'

// Le texte de consentement et sa version vivent dans `ui/texte-consentement.ts` — côte à côte, pour
// qu'on ne modifie jamais l'un sans voir l'autre. Réexporté ici parce que `main.tsx` l'attend de cet
// écran depuis toujours.
export { VERSION_CONSENTEMENT } from '../texte-consentement.js'

// Les allergènes fréquents, les libellés, les paliers de temps et la dérivation des régimes vivent
// désormais dans `ui/champs-profil.tsx` — l'écran Paramètres règle les mêmes champs, et deux copies
// auraient divergé au premier allergène ajouté.

type Etape = 1 | 2 | 3 | 5

/**
 * L'étape « Installez l'application sur votre écran d'accueil ».
 *
 * Désactivée le 2026-08-01 (« désactive juste pour l'instant »), RÉTABLIE le 2026-08-02 après un
 * essai sur téléphone : elle est le SEUL endroit du produit qui explique l'installation, et sans
 * elle personne ne l'atteint. Or c'est l'installation qui fait accorder le stockage persistant —
 * sans elle, le navigateur peut effacer la base, et l'appli n'a plus qu'un bandeau à opposer.
 * Elle reste aussi NÉCESSAIRE aux rappels de préparation : hors application installée, aucune
 * notification programmée n'existe (voir `ui/notifications.ts`).
 *
 * ⚠️ Ne pas la supprimer si elle est un jour redésactivée : la laisser référencée ci-dessous est ce
 * qui l'a gardée réactivable en une ligne. Le composant `Installation` gère deux chemins — le
 * bouton réel sous Chromium, les instructions manuelles sous Safari, qui n'a aucune API.
 */
const ETAPE_INSTALLATION = true

/**
 * Les étapes réellement traversées, dans l'ordre.
 *
 * ⚠️ REMPLACE UNE ARITHMÉTIQUE QUI NE TENAIT QUE PAR CHANCE : le retour arrière faisait
 * `etape === 5 ? 3 : etape - 1`, ce qui supposait à la fois que 5 suit 3 et qu'aucun trou n'existe
 * ailleurs dans la numérotation. Une liste explicite dit la même chose sans rien supposer, et
 * désactiver une étape devient une ligne au lieu d'une relecture de tous les décalages.
 */
const ETAPES: readonly Etape[] = ETAPE_INSTALLATION ? [1, 2, 3, 5] : [1, 3, 5]

const voisine = (etape: Etape, pas: 1 | -1): Etape => ETAPES[ETAPES.indexOf(etape) + pas] ?? etape

const CHOIX_INITIAL: ChoixProfil = {
  allergenes: new Set(),
  regime: null,
  rythme: RYTHME_PAR_DEFAUT,
}

export function Accueil({ onTermine }: { readonly onTermine: () => void }) {
  const [etape, setEtape] = useState<Etape>(1)
  const [choix, setChoix] = useState<ChoixProfil>(CHOIX_INITIAL)
  const [catalogue, setCatalogue] = useState<Catalog | null>(null)
  /** Case « J'ai lu et compris » — ici et non dans `Engagement`, voir l'en-tête de ce composant. */
  const [compris, setCompris] = useState(false)

  useEffect(() => {
    let annule = false
    chargerSocle().then(
      (socle) => {
        if (annule) return
        setCatalogue(socle.catalogue)
        // ⚠️ ON PART DE CE QUI EXISTE DÉJÀ. Base neuve → les défauts ; parcours rouvert par un
        // nouveau texte de consentement → les allergies déjà déclarées, cochées. Sans cette ligne,
        // « Continuer, Continuer, C'est parti » sans rien toucher les effacerait toutes.
        setChoix(lireChoixProfil(socle.db))
      },
      () => undefined
    )
    return () => {
      annule = true
    }
  }, [])

  /** Écrit tout d'un coup, à la fin : un parcours abandonné ne doit rien laisser à moitié. */
  const terminer = useCallback(() => {
    chargerSocle()
      .then((socle) => {
        const date = aujourdhuiIso()
        ecrireChoixProfil(socle.db, choix)
        // Le consentement EN DERNIER : c'est lui qui referme le parcours. L'écrire d'abord ferait
        // qu'une fermeture d'onglet en cours de route donnerait une application « configurée »
        // sans allergies, c'est-à-dire le défaut qu'on est en train de corriger.
        recordConsent(socle.db, VERSION, date)
        onTermine()
      })
      .catch(() => onTermine())
  }, [choix, onTermine])

  return (
    <section className="mx-auto max-w-prose">
      {etape === 1 && (
        <Engagement
          compris={compris}
          onCompris={setCompris}
          onSuivant={() => setEtape(voisine(1, 1))}
        />
      )}
      {etape === 2 && <Installation onSuivant={() => setEtape(voisine(2, 1))} />}
      {etape === 3 && (
        <Allergies
          catalogue={catalogue}
          choix={choix}
          onChange={setChoix}
          onSuivant={() => setEtape(voisine(3, 1))}
        />
      )}
      {etape === 5 && (
        <Rythme choix={choix} onChange={setChoix} onTerminer={terminer} />
      )}

      {/* ⚠️ IL N'Y AVAIT AUCUN RETOUR. Le parcours n'allait que vers l'avant : une case d'allergène
          cochée par erreur ne se corrigeait qu'en fermant l'application avant la fin, puisque le
          consentement — écrit en dernier — est ce qui referme le parcours. Sur le seul garde-fou
          critique du moteur, l'aller simple n'est pas tenable.

          `choix` n'est PAS remis à zéro en revenant : les cases déjà cochées doivent être là,
          c'est tout l'intérêt de revenir. Rien n'est écrit en base avant `terminer`. */}
      {etape > 1 && (
        <button
          type="button"
          onClick={() => setEtape(voisine(etape, -1))}
          className="mt-4 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-4 text-[0.98rem] font-semibold text-texte-doux"
        >
          ← Revenir en arrière
        </button>
      )}
    </section>
  )
}

// --- Écran 1 — engagement -----------------------------------------------------------------------

/**
 * Un point du consentement : résumé toujours visible, détail d'un tap.
 *
 * La ligne entière est le bouton — pas un petit chevron : « cibles tactiles de 48 px minimum », et
 * viser une flèche de 12 px n'est pas la même chose que viser une carte.
 */
function PointDepliable({ point }: { readonly point: PointConsentement }) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <div className="rounded-[--radius-carte] border border-bordure bg-surface">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex min-h-tactile w-full items-center gap-3 p-4 text-left text-[1rem] leading-relaxed text-texte"
      >
        <span className="flex-1 font-medium">{point.resume}</span>
        <span aria-hidden="true" className="shrink-0 text-[0.85rem] font-semibold text-attenue">
          {ouvert ? 'Replier' : 'Lire'}
        </span>
      </button>
      {ouvert && (
        <div className="space-y-2 px-4 pb-4 text-[0.95rem] leading-relaxed text-texte-doux">
          {point.detail.map((paragraphe) => (
            <p key={paragraphe}>{paragraphe}</p>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * ⚠️ `compris` VIENT DU PARENT, il n'est pas un état local. Il l'a été, et « Revenir en arrière »
 * l'a immédiatement montré : React démonte l'étape qu'on quitte, si bien que revenir sur cet écran
 * décochait la case et redésactivait le bouton. On se retrouvait bloqué à l'étape 1, à devoir
 * relire pour ré-avancer. Les autres choix (allergies, régime, rythme) vivent déjà dans le parent
 * pour cette raison exacte ; celui-ci était le seul à ne pas suivre la règle.
 */
function Engagement({
  compris,
  onCompris,
  onSuivant,
}: {
  readonly compris: boolean
  readonly onCompris: (compris: boolean) => void
  readonly onSuivant: () => void
}) {
  const setCompris = (maj: (c: boolean) => boolean) => onCompris(maj(compris))

  return (
    <div>
      <h1 className="text-[2.4rem] text-texte">Bienvenue</h1>
      <p className="mt-2 text-[1.15rem] leading-relaxed text-texte-doux">
        Cuisinez au fil des jours, tranquillement.
      </p>
      <p className="mt-6 text-[1rem] text-texte-doux">
        Avant de commencer, quatre choses à savoir. Touchez un point pour tout lire.
      </p>

      <ul className="mt-4 space-y-3">
        {POINTS_CONSENTEMENT.map((point) => (
          <li key={point.resume}>
            <PointDepliable point={point} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setCompris((c) => !c)}
        aria-pressed={compris}
        className={
          'mt-6 flex min-h-tactile w-full items-center gap-3 rounded-[--radius-carte] border px-4 text-left text-[1.02rem] ' +
          (compris ? 'border-accent bg-accent-doux text-texte' : 'border-bordure-forte bg-surface text-texte')
        }
      >
        <span
          aria-hidden="true"
          className={
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] border-2 ' +
            (compris ? 'border-accent bg-accent text-white' : 'border-bordure-forte')
          }
        >
          {compris ? '✓' : ''}
        </span>
        J’ai lu et compris
      </button>

      <button
        type="button"
        onClick={onSuivant}
        disabled={!compris}
        className="mt-4 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1.05rem] font-semibold text-white disabled:opacity-40"
      >
        J’ai compris
      </button>
    </div>
  )
}

// --- Écran 2 — installation ---------------------------------------------------------------------

/** Événement Chromium d'invite d'installation. Absent des types DOM standard. */
interface InviteInstallation extends Event {
  prompt(): Promise<void>
}

/**
 * ⚠️ IL N'Y A PAS D'API D'INSTALLATION UNIVERSELLE. Chromium expose `beforeinstallprompt`, qu'on
 * capture pour offrir un vrai bouton ; Safari n'a RIEN — l'ajout à l'écran d'accueil s'y fait à la
 * main par le menu de partage. Afficher un bouton « Installer » inerte sur iPhone serait pire que
 * de ne rien afficher : on demanderait un geste impossible. D'où les deux chemins.
 */
function Installation({ onSuivant }: { readonly onSuivant: () => void }) {
  const [invite, setInvite] = useState<InviteInstallation | null>(null)

  useEffect(() => {
    const capturer = (event: Event) => {
      // L'invite ne peut être déclenchée que plus tard, sur un geste de l'utilisateur : on empêche
      // l'affichage automatique du navigateur et on garde l'événement sous la main.
      event.preventDefault()
      setInvite(event as InviteInstallation)
    }
    window.addEventListener('beforeinstallprompt', capturer)
    return () => window.removeEventListener('beforeinstallprompt', capturer)
  }, [])

  return (
    <div>
      <h1 className="text-[2rem] text-texte">Installez l’application sur votre écran d’accueil</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        Vous la retrouverez d’un seul geste, et elle fonctionnera hors-ligne.
      </p>
      {/* §7 ARCHITECTURE mesure 2 : le risque est dit EN CLAIR, pas caché derrière « recommandé ». */}
      <p className="mt-4 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[0.98rem] leading-relaxed text-alerte-texte">
        Sans installation, le navigateur peut effacer vos données pour faire de la place.
      </p>

      {invite === null ? (
        <p className="mt-5 text-[0.98rem] leading-relaxed text-texte-doux">
          Sur iPhone : touchez le bouton de partage, puis « Sur l’écran d’accueil ». Sur ordinateur,
          l’icône d’installation apparaît dans la barre d’adresse.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            void invite.prompt().catch(() => undefined)
          }}
          className="mt-5 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1.05rem] font-semibold text-white"
        >
          Installer maintenant
        </button>
      )}

      <button
        type="button"
        onClick={onSuivant}
        className="mt-3 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-5 text-[1.05rem] font-semibold text-texte-doux"
      >
        Plus tard
      </button>
    </div>
  )
}

// --- Écran 3 — allergies et régime --------------------------------------------------------------

function Allergies({
  catalogue,
  choix,
  onChange,
  onSuivant,
}: {
  readonly catalogue: Catalog | null
  readonly choix: ChoixProfil
  readonly onChange: (choix: ChoixProfil) => void
  readonly onSuivant: () => void
}) {
  if (catalogue === null) return <p className="text-attenue">Chargement…</p>

  return (
    <div>
      <h1 className="text-[2rem] text-texte">Des allergies ?</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        On écartera systématiquement ces aliments. Vous pourrez les modifier à tout moment dans
        Paramètres.
      </p>

      <div className="mt-5">
        <ChoixAllergenes
          catalogue={catalogue}
          choisies={choix.allergenes}
          onChange={(allergenes) => onChange({ ...choix, allergenes })}
        />
      </div>

      <h2 className="mt-8 text-[1.5rem] text-texte">Un régime particulier ?</h2>
      <div className="mt-3">
        <ChoixRegime
          catalogue={catalogue}
          choisi={choix.regime}
          onChange={(regime) => onChange({ ...choix, regime })}
        />
      </div>

      <button
        type="button"
        onClick={onSuivant}
        className="mt-6 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1.05rem] font-semibold text-white"
      >
        Continuer
      </button>
    </div>
  )
}

// --- Écran 5 — rythme ----------------------------------------------------------------------------

function Rythme({
  choix,
  onChange,
  onTerminer,
}: {
  readonly choix: ChoixProfil
  readonly onChange: (choix: ChoixProfil) => void
  readonly onTerminer: () => void
}) {
  return (
    <div>
      <h1 className="text-[2rem] text-texte">Votre rythme</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        Deux questions, modifiables à tout moment.
      </p>

      <div className="mt-6">
        <ChoixRythme rythme={choix.rythme} onChange={(rythme) => onChange({ ...choix, rythme })} />
      </div>

      <button
        type="button"
        onClick={onTerminer}
        className="mt-8 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1.05rem] font-semibold text-white"
      >
        C’est parti
      </button>
    </div>
  )
}
