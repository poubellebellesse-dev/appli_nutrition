// ui/screens/accueil.tsx — premier lancement (§4.8 DESIGN).
//
// ⚠️ CE PARCOURS COMBLE UN TROU DE SÉCURITÉ, pas seulement un manque d'ergonomie. Le filtre
// allergènes est le seul garde-fou CRITIQUE et incontournable du moteur (§5.2 ARCHITECTURE : « ce
// filtre n'est jamais pondéré ni contournable ») — mais jusqu'ici aucun écran ne demandait ses
// allergies à l'utilisateur. Il tournait donc sur une liste VIDE, et l'application proposait
// tranquillement du gluten à qui n'en supporte pas. Le code était juste ; il n'avait pas de source.
//
// ⚠️ UN SEUL ÉCRAN EST OBLIGATOIRE — les allergies. Tout le reste se saute, et « Passer » reste
// visible : §4.8 est explicite, « rien d'obligatoire sauf les allergies », et la divulgation
// progressive veut que l'application serve AVANT d'être configurée.
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

/**
 * Version du texte de consentement. À INCRÉMENTER dès que les trois points ci-dessous changent :
 * `consent` garde une ligne par version (§6.4), et le parcours se rouvre sur une version non
 * acceptée. Un texte modifié sans changement de version serait accepté rétroactivement.
 */
export const VERSION_CONSENTEMENT = 'accueil-2026-07-30'

/**
 * Les huit allergènes mis en avant (§4.8 : « les 8 allergènes fréquents en accès rapide »).
 *
 * ⚠️ « LAIT » ET NON « LACTOSE », contrairement au libellé de la maquette. L'allergène de la liste
 * UE — et du catalogue — est le LAIT ; l'allergie aux protéines de lait et l'intolérance au lactose
 * sont deux affections distinctes. Étiqueter cette case « Lactose » ferait qu'une personne
 * allergique au lait ne reconnaîtrait pas la sienne, et qu'une personne intolérante au lactose
 * exclurait plus large que nécessaire. Sur un filtre de sécurité, le mot exact n'est pas un détail.
 */
const ALLERGENES_FREQUENTS: readonly string[] = [
  'fruits_a_coque',
  'arachides',
  'gluten',
  'lait',
  'oeufs',
  'poissons',
  'crustaces',
  'soja',
]

/** Libellés courts — ceux du catalogue sont réglementaires et trop longs pour une case tactile. */
const LIBELLE_COURT: Readonly<Record<string, string>> = {
  gluten: 'Gluten',
  oeufs: 'Œuf',
  poissons: 'Poisson',
  sesame: 'Sésame',
  sulfites: 'Sulfites',
}

const LIBELLE_REGIME: Readonly<Record<string, string>> = {
  pescetarien: 'Pescétarien',
  vegetarien: 'Végétarien',
  vegetalien: 'Végétalien',
}

/**
 * Régimes réellement proposés par le catalogue (§4.8 : « régime = liste DÉRIVÉE du catalogue »).
 *
 * `omnivore` est écarté : ce n'est pas une restriction, et « je mange de tout » est déjà la première
 * option. Le tri suit la chaîne d'inclusion, du plus large au plus restrictif.
 */
function regimesDuCatalogue(catalogue: Catalog): readonly DietCode[] {
  const ordre = ['pescetarien', 'vegetarien', 'vegetalien']
  const presents = new Set<string>()
  for (const recette of catalogue.recipes.values()) {
    for (const facette of recette.facettes) {
      if (facette.facette === 'regime') presents.add(facette.valeur)
    }
  }
  return ordre.filter((code) => presents.has(code))
}

/** Paliers de temps. `null` = pas de limite, le neutre (voir `StoredRythme`). */
const PALIERS_TEMPS: readonly { readonly minutes: number | null; readonly libelle: string }[] = [
  { minutes: 20, libelle: '20 min' },
  { minutes: 30, libelle: '30 min' },
  { minutes: 45, libelle: '45 min' },
  { minutes: null, libelle: 'Peu importe' },
]

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
      {etape === 1 && <Engagement onSuivant={() => setEtape(2)} />}
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
    </section>
  )
}

// --- Écran 1 — engagement -----------------------------------------------------------------------

function Engagement({ onSuivant }: { readonly onSuivant: () => void }) {
  const [compris, setCompris] = useState(false)

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
  const [toutDeplie, setToutDeplie] = useState(false)

  if (catalogue === null) return <p className="text-attenue">Chargement…</p>

  const tous = [...catalogue.allergens.values()]
  const frequents = tous.filter((a) => ALLERGENES_FREQUENTS.includes(a.id))
  const autres = tous.filter((a) => !ALLERGENES_FREQUENTS.includes(a.id))
  const nomDe = (id: string, nom: string) => LIBELLE_COURT[id] ?? nom

  const basculer = (id: string) => {
    const suivant = new Set(choix.allergenes)
    if (suivant.has(id)) suivant.delete(id)
    else suivant.add(id)
    onChange({ ...choix, allergenes: suivant })
  }

  return (
    <div>
      <h1 className="text-[2rem] text-texte">Des allergies ?</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        On écartera systématiquement ces aliments. Vous pourrez modifier plus tard.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {frequents.map((allergene) => (
          <CaseAllergene
            key={allergene.id}
            libelle={nomDe(allergene.id, allergene.nom)}
            cochee={choix.allergenes.has(allergene.id)}
            onBasculer={() => basculer(allergene.id)}
          />
        ))}
      </div>

      {/* §4.8 : « dépliant les 14 UE — AUCUN CACHÉ, sécurité ». Replié par défaut pour ne pas noyer
          les huit fréquents, jamais absent. */}
      <button
        type="button"
        onClick={() => setToutDeplie((d) => !d)}
        aria-expanded={toutDeplie}
        className="mt-4 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.98rem] font-semibold text-texte-doux"
      >
        {toutDeplie ? 'Masquer' : `Voir les ${tous.length} allergènes réglementaires`}
      </button>

      {toutDeplie && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {autres.map((allergene) => (
            <CaseAllergene
              key={allergene.id}
              libelle={nomDe(allergene.id, allergene.nom)}
              cochee={choix.allergenes.has(allergene.id)}
              onBasculer={() => basculer(allergene.id)}
            />
          ))}
        </div>
      )}

      <h2 className="mt-8 text-[1.5rem] text-texte">Un régime particulier ?</h2>
      <div className="mt-3 space-y-2">
        <OptionRadio
          libelle="Aucun, je mange de tout"
          choisie={choix.regime === null}
          onChoisir={() => onChange({ ...choix, regime: null })}
        />
        {regimesDuCatalogue(catalogue).map((code) => (
          <OptionRadio
            key={code}
            libelle={LIBELLE_REGIME[code] ?? code}
            choisie={choix.regime === code}
            onChoisir={() => onChange({ ...choix, regime: code })}
          />
        ))}
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

function CaseAllergene({
  libelle,
  cochee,
  onBasculer,
}: {
  readonly libelle: string
  readonly cochee: boolean
  readonly onBasculer: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-pressed={cochee}
      className={
        'flex min-h-tactile items-center gap-3 rounded-[--radius-carte] border px-4 text-left text-[1.02rem] ' +
        (cochee ? 'border-accent bg-accent-doux text-texte' : 'border-bordure-forte bg-surface text-texte')
      }
    >
      <span
        aria-hidden="true"
        className={
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] border-2 ' +
          (cochee ? 'border-accent bg-accent text-white' : 'border-bordure-forte')
        }
      >
        {cochee ? '✓' : ''}
      </span>
      {libelle}
    </button>
  )
}

function OptionRadio({
  libelle,
  choisie,
  onChoisir,
}: {
  readonly libelle: string
  readonly choisie: boolean
  readonly onChoisir: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={choisie}
      className={
        'flex min-h-tactile w-full items-center gap-3 rounded-[--radius-carte] border px-4 text-left text-[1.02rem] ' +
        (choisie ? 'border-accent bg-accent-doux text-texte' : 'border-bordure-forte bg-surface text-texte')
      }
    >
      <span
        aria-hidden="true"
        className={
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ' +
          (choisie ? 'border-accent' : 'border-bordure-forte')
        }
      >
        {choisie && <span className="h-3 w-3 rounded-full bg-accent" />}
      </span>
      {libelle}
    </button>
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
  const maj = (partiel: Partial<StoredRythme>) =>
    onChange({ ...choix, rythme: { ...choix.rythme, ...partiel } })

  return (
    <div>
      <h1 className="text-[2rem] text-texte">Votre rythme</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        Deux questions, modifiables à tout moment.
      </p>

      <h2 className="mt-6 text-[1.3rem] text-texte">Combien de repas par jour ?</h2>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3].map((n) => (
          <Segment
            key={n}
            libelle={String(n)}
            actif={choix.rythme.repasParJour === n}
            onChoisir={() => maj({ repasParJour: n })}
          />
        ))}
      </div>

      <h2 className="mt-8 text-[1.3rem] text-texte">Combien de temps pour cuisiner ?</h2>
      <p className="mt-1 text-[0.95rem] text-attenue">En semaine</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PALIERS_TEMPS.map((palier) => (
          <Segment
            key={palier.libelle}
            libelle={palier.libelle}
            actif={choix.rythme.tempsSemaineMin === palier.minutes}
            onChoisir={() => maj({ tempsSemaineMin: palier.minutes })}
          />
        ))}
      </div>
      <p className="mt-4 text-[0.95rem] text-attenue">Le week-end</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PALIERS_TEMPS.map((palier) => (
          <Segment
            key={palier.libelle}
            libelle={palier.libelle}
            actif={choix.rythme.tempsWeekendMin === palier.minutes}
            onChoisir={() => maj({ tempsWeekendMin: palier.minutes })}
          />
        ))}
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

function Segment({
  libelle,
  actif,
  onChoisir,
}: {
  readonly libelle: string
  readonly actif: boolean
  readonly onChoisir: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={actif}
      className={
        'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-4 text-[1rem] font-semibold ' +
        (actif
          ? 'border-2 border-accent bg-accent-doux text-accent-texte'
          : 'border border-bordure-forte bg-surface text-texte-doux')
      }
    >
      {libelle}
    </button>
  )
}
