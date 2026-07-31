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
import type { AllergenId, Catalog, DietCode } from '../../engine/domain/index.js'
import {
  recordConsent,
  writeAllergies,
  writeDiet,
  writeRythme,
  type StoredRythme,
} from '../../data/user-store.js'
import { aujourdhuiIso, chargerSocle } from '../socle.js'
import { ChoixAllergenes, ChoixRegime, ChoixRythme } from '../champs-profil.js'

/**
 * Version du texte de consentement. À INCRÉMENTER dès que les trois points ci-dessous changent :
 * `consent` garde une ligne par version (§6.4), et le parcours se rouvre sur une version non
 * acceptée. Un texte modifié sans changement de version serait accepté rétroactivement.
 */
export const VERSION_CONSENTEMENT = 'accueil-2026-07-30'

// Les allergènes fréquents, les libellés, les paliers de temps et la dérivation des régimes vivent
// désormais dans `ui/champs-profil.tsx` — l'écran Paramètres règle les mêmes champs, et deux copies
// auraient divergé au premier allergène ajouté.

type Etape = 1 | 2 | 3 | 5

interface Choix {
  readonly allergenes: ReadonlySet<string>
  readonly regime: DietCode | null
  readonly rythme: StoredRythme
}

const CHOIX_INITIAL: Choix = {
  allergenes: new Set(),
  regime: null,
  rythme: { repasParJour: 2, tempsSemaineMin: 30, tempsWeekendMin: null },
}

export function Accueil({ onTermine }: { readonly onTermine: () => void }) {
  const [etape, setEtape] = useState<Etape>(1)
  const [choix, setChoix] = useState<Choix>(CHOIX_INITIAL)
  const [catalogue, setCatalogue] = useState<Catalog | null>(null)
  /** Case « J'ai lu et compris » — ici et non dans `Engagement`, voir l'en-tête de ce composant. */
  const [compris, setCompris] = useState(false)

  useEffect(() => {
    let annule = false
    chargerSocle().then(
      (socle) => {
        if (!annule) setCatalogue(socle.catalogue)
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
        writeAllergies(
          socle.db,
          [...choix.allergenes].map((id) => ({ allergenId: id as AllergenId, severite: null }))
        )
        writeDiet(socle.db, choix.regime)
        writeRythme(socle.db, choix.rythme)
        // Le consentement EN DERNIER : c'est lui qui referme le parcours. L'écrire d'abord ferait
        // qu'une fermeture d'onglet en cours de route donnerait une application « configurée »
        // sans allergies, c'est-à-dire le défaut qu'on est en train de corriger.
        recordConsent(socle.db, VERSION_CONSENTEMENT, date)
        onTermine()
      })
      .catch(() => onTermine())
  }, [choix, onTermine])

  return (
    <section className="mx-auto max-w-prose">
      {etape === 1 && (
        <Engagement compris={compris} onCompris={setCompris} onSuivant={() => setEtape(2)} />
      )}
      {etape === 2 && <Installation onSuivant={() => setEtape(3)} />}
      {etape === 3 && (
        <Allergies
          catalogue={catalogue}
          choix={choix}
          onChange={setChoix}
          onSuivant={() => setEtape(5)}
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
          onClick={() => setEtape(etape === 5 ? 3 : ((etape - 1) as Etape))}
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
      <p className="mt-6 text-[1rem] text-texte-doux">Avant de commencer, trois choses à savoir.</p>

      {/* ⚠️ Ces trois phrases sont le TEXTE DE CONSENTEMENT. Les modifier oblige à incrémenter
          VERSION_CONSENTEMENT, sinon une acceptation ancienne vaudrait pour un texte jamais lu. */}
      <ul className="mt-4 space-y-3">
        {[
          'Vos données restent sur cet appareil. Aucun compte, rien n’est envoyé.',
          'L’application ne remplace pas un professionnel de santé.',
          'En cas de doute, vérifiez les sources : elles sont toujours citées.',
        ].map((point) => (
          <li
            key={point}
            className="rounded-[--radius-carte] border border-bordure bg-surface p-4 text-[1rem] leading-relaxed text-texte"
          >
            {point}
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
  readonly choix: Choix
  readonly onChange: (choix: Choix) => void
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
  readonly choix: Choix
  readonly onChange: (choix: Choix) => void
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
