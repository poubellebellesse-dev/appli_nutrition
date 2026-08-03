// ui/champs-profil.tsx — les champs de profil, partagés par « Premier lancement » et « Paramètres ».
//
// ⚠️ PARTAGÉ EXPRÈS, même raison que `filtres-recettes.tsx`. Les deux écrans règlent EXACTEMENT les
// mêmes choses : allergies, régime, rythme. Deux implémentations divergeraient au premier allergène
// ajouté, et l'utilisateur découvrirait qu'une case cochable à l'installation ne l'est plus ensuite
// — sur le filtre de sécurité du moteur, ce serait le pire endroit où laisser deux vérités.
//
// ⚠️ CES COMPOSANTS NE PORTENT PAS LEURS TITRES. L'accueil est un parcours linéaire (h1 par étape),
// Paramètres est une page à sections (h1 unique, h2 par section) ; un titre figé ici casserait la
// hiérarchie de l'un ou de l'autre. Les écrans gardent leurs titres, ces composants gardent les
// contrôles — c'est la seule ligne de partage qui tienne pour les deux.

import { useState } from 'react'
import type { Catalog, DietCode } from '../engine/domain/index.js'
import type { StoredRythme } from '../data/user-store.js'

/**
 * Les huit allergènes mis en avant (§4.8 : « les 8 allergènes fréquents en accès rapide »).
 *
 * ⚠️ « LAIT » ET NON « LACTOSE », contrairement au libellé de la maquette. L'allergène de la liste
 * UE — et du catalogue — est le LAIT ; l'allergie aux protéines de lait et l'intolérance au lactose
 * sont deux affections distinctes. Étiqueter cette case « Lactose » ferait qu'une personne
 * allergique au lait ne reconnaîtrait pas la sienne, et qu'une personne intolérante au lactose
 * exclurait plus large que nécessaire. Sur un filtre de sécurité, le mot exact n'est pas un détail.
 */
export const ALLERGENES_FREQUENTS: readonly string[] = [
  'fruits_a_coque',
  'arachides',
  'gluten',
  'lait',
  'oeufs',
  'poissons',
  'crustaces',
  'soja',
]

/**
 * Libellés courts — ceux du catalogue sont réglementaires et trop longs pour une case tactile
 * (« Céréales contenant du gluten », « Anhydride sulfureux et sulfites »).
 *
 * ⚠️ EXPORTÉS, et pas seulement par commodité. L'écran Paramètres en a besoin pour résumer la
 * valeur courante sur ses lignes (« Mes allergies — Gluten, Lait »), et il en avait d'abord tenu
 * une COPIE. Or ce fichier existe précisément parce que Paramètres et l'accueil règlent les mêmes
 * champs : deux tables séparées auraient divergé au premier libellé retouché, et l'application
 * aurait nommé le même allergène de deux façons selon l'écran.
 */
export const LIBELLE_COURT: Readonly<Record<string, string>> = {
  gluten: 'Gluten',
  oeufs: 'Œuf',
  poissons: 'Poisson',
  sesame: 'Sésame',
  sulfites: 'Sulfites',
}

/** Même raison d'être exportée que `LIBELLE_COURT` ci-dessus. */
export const LIBELLE_REGIME: Readonly<Record<string, string>> = {
  pescetarien: 'Pescétarien',
  vegetarien: 'Végétarien',
  vegetalien: 'Végétalien',
}

/** Paliers de temps. `null` = pas de limite, le neutre (voir `StoredRythme`). */
export const PALIERS_TEMPS: readonly { readonly minutes: number | null; readonly libelle: string }[] = [
  { minutes: 20, libelle: '20 min' },
  { minutes: 30, libelle: '30 min' },
  { minutes: 45, libelle: '45 min' },
  { minutes: null, libelle: 'Peu importe' },
]

/**
 * Régimes réellement proposés par le catalogue (§4.8 : « régime = liste DÉRIVÉE du catalogue »).
 *
 * `omnivore` est écarté : ce n'est pas une restriction, et « je mange de tout » est déjà la première
 * option. Le tri suit la chaîne d'inclusion, du plus large au plus restrictif.
 */
export function regimesDuCatalogue(catalogue: Catalog): readonly DietCode[] {
  const ordre = ['pescetarien', 'vegetarien', 'vegetalien']
  const presents = new Set<string>()
  for (const recette of catalogue.recipes.values()) {
    for (const facette of recette.facettes) {
      if (facette.facette === 'regime') presents.add(facette.valeur)
    }
  }
  return ordre.filter((code) => presents.has(code))
}

// --- Contrôles élémentaires ----------------------------------------------------------------------

/**
 * Case à cocher, ligne entière cliquable.
 *
 * `min-h-tactile` (3rem) et non un padding en px : la cible doit GRANDIR avec la police système au
 * lieu de rester figée.
 */
export function Case({
  libelle,
  description,
  cochee,
  onBasculer,
  dataVisite,
}: {
  readonly libelle: string
  readonly description?: string
  readonly cochee: boolean
  readonly onBasculer: () => void
  /** Cible optionnelle pour `ui/visite.tsx` — évite d'envelopper le bouton dans un `div` qui
   *  décalerait le contour dessiné par la visite (voir `ui/parcours.ts`). */
  readonly dataVisite?: string
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-pressed={cochee}
      data-visite={dataVisite}
      className={
        'flex min-h-tactile w-full items-center gap-3 rounded-[--radius-carte] border px-4 py-2 text-left text-[1.02rem] ' +
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
      <span>
        {libelle}
        {description !== undefined && (
          <span className="block text-[0.88rem] leading-snug text-attenue">{description}</span>
        )}
      </span>
    </button>
  )
}

export function OptionRadio({
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

export function Segment({
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

// --- Champs composés -----------------------------------------------------------------------------

/**
 * Les allergies. Les huit fréquents en accès direct, les autres derrière un dépliant.
 *
 * ⚠️ « AUCUN CACHÉ, SÉCURITÉ » (§4.8). Le dépliant est replié par défaut pour ne pas noyer les huit
 * fréquents, mais il est TOUJOURS présent : aucun allergène réglementaire n'est inatteignable.
 */
export function ChoixAllergenes({
  catalogue,
  choisies,
  onChange,
}: {
  readonly catalogue: Catalog
  readonly choisies: ReadonlySet<string>
  readonly onChange: (choisies: ReadonlySet<string>) => void
}) {
  const [toutDeplie, setToutDeplie] = useState(false)

  const tous = [...catalogue.allergens.values()]
  const frequents = tous.filter((a) => ALLERGENES_FREQUENTS.includes(a.id))
  const autres = tous.filter((a) => !ALLERGENES_FREQUENTS.includes(a.id))
  const nomDe = (id: string, nom: string) => LIBELLE_COURT[id] ?? nom

  const basculer = (id: string) => {
    const suivant = new Set(choisies)
    if (suivant.has(id)) suivant.delete(id)
    else suivant.add(id)
    onChange(suivant)
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {frequents.map((allergene) => (
          <Case
            key={allergene.id}
            libelle={nomDe(allergene.id, allergene.nom)}
            cochee={choisies.has(allergene.id)}
            onBasculer={() => basculer(allergene.id)}
          />
        ))}
      </div>

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
            <Case
              key={allergene.id}
              libelle={nomDe(allergene.id, allergene.nom)}
              cochee={choisies.has(allergene.id)}
              onBasculer={() => basculer(allergene.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** Le régime. `null` = « je mange de tout », qui reste la première option (§4.8). */
export function ChoixRegime({
  catalogue,
  choisi,
  onChange,
}: {
  readonly catalogue: Catalog
  readonly choisi: DietCode | null
  readonly onChange: (regime: DietCode | null) => void
}) {
  return (
    <div className="space-y-2">
      <OptionRadio
        libelle="Aucun, je mange de tout"
        choisie={choisi === null}
        onChoisir={() => onChange(null)}
      />
      {regimesDuCatalogue(catalogue).map((code) => (
        <OptionRadio
          key={code}
          libelle={LIBELLE_REGIME[code] ?? code}
          choisie={choisi === code}
          onChoisir={() => onChange(code)}
        />
      ))}
    </div>
  )
}

/** Le rythme : repas par jour, et le temps disponible en semaine puis le week-end. */
export function ChoixRythme({
  rythme,
  onChange,
}: {
  readonly rythme: StoredRythme
  readonly onChange: (rythme: StoredRythme) => void
}) {
  const maj = (partiel: Partial<StoredRythme>) => onChange({ ...rythme, ...partiel })

  return (
    <>
      <p className="text-[0.95rem] text-attenue">Combien de repas par jour ?</p>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <Segment
            key={n}
            libelle={String(n)}
            actif={rythme.repasParJour === n}
            onChoisir={() => maj({ repasParJour: n })}
          />
        ))}
      </div>

      <p className="mt-4 text-[0.95rem] text-attenue">Temps pour cuisiner un repas, en semaine</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PALIERS_TEMPS.map((palier) => (
          <Segment
            key={palier.libelle}
            libelle={palier.libelle}
            actif={rythme.tempsSemaineMin === palier.minutes}
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
            actif={rythme.tempsWeekendMin === palier.minutes}
            onChoisir={() => maj({ tempsWeekendMin: palier.minutes })}
          />
        ))}
      </div>
    </>
  )
}
