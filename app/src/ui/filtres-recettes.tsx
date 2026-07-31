// ui/filtres-recettes.tsx — pastilles de filtre, partagées par « Recettes » et « Vider le frigo ».
//
// ⚠️ PARTAGÉ EXPRÈS. Les deux écrans filtrent le même catalogue avec les mêmes critères ; deux
// implémentations divergeraient au premier ajout de facette, et l'utilisateur découvrirait qu'un
// filtre existe ici mais pas là. C'est aussi ce que demande §4.4 pour l'écran frigo — « les mêmes
// que Recettes ».
//
// ⚠️ LES COMPTEURS SONT DYNAMIQUES ET FOURNIS PAR L'APPELANT. Afficher « française (115) » alors que
// la recherche « blanquette de veau » ne rend qu'une recette est un mensonge par omission : le
// chiffre décrit le catalogue, pas ce qu'on regarde. Ce composant ne sait pas compter — il ne
// connaît ni le moteur ni la requête en cours — donc chaque écran lui passe ses propres comptes,
// calculés sur SES résultats.
//
// ⚠️ LE COMPTE D'UNE FACETTE IGNORE SA PROPRE SÉLECTION. Si `française` est choisie, tous les
// résultats sont français et `italienne` afficherait 0 — alors que désélectionner `française`
// ramènerait 19 recettes. Chaque écran calcule donc les comptes d'une facette en appliquant tous
// les filtres SAUF elle. Voir `comptesParFacette` ci-dessous.

import type { Catalog, FacetteKind, RecipeId } from '../engine/domain/index.js'
import { valeursDeFacette } from '../engine/search/index.js'

/** Combien de valeurs montrer avant de replier (§4.4 : « deux rangées »). */
const PASTILLES_VISIBLES = 5

/** Paliers de temps total, en minutes. */
const PALIERS_TEMPS: readonly { readonly minutes: number; readonly libelle: string }[] = [
  { minutes: 20, libelle: '20 min' },
  { minutes: 40, libelle: '40 min' },
  { minutes: 60, libelle: '1 h' },
]

export interface FiltresRecette {
  readonly cuisines: readonly string[]
  readonly styles: readonly string[]
  readonly tempsMaxMin: number | null
}

export const FILTRES_VIDES: FiltresRecette = { cuisines: [], styles: [], tempsMaxMin: null }

export function aucunFiltre(f: FiltresRecette): boolean {
  return f.cuisines.length === 0 && f.styles.length === 0 && f.tempsMaxMin === null
}

/** Facettes → valeurs choisies, dans la forme qu'attend le moteur. */
export function facettesDe(f: FiltresRecette): ReadonlyMap<FacetteKind, readonly string[]> {
  const facettes = new Map<FacetteKind, readonly string[]>()
  if (f.cuisines.length > 0) facettes.set('cuisine' as FacetteKind, f.cuisines)
  if (f.styles.length > 0) facettes.set('style' as FacetteKind, f.styles)
  return facettes
}

/** Les mêmes filtres, une facette retirée — pour compter sans que la sélection s'auto-annule. */
export function sansFacette(f: FiltresRecette, facette: FacetteKind): FiltresRecette {
  if (facette === ('cuisine' as FacetteKind)) return { ...f, cuisines: [] }
  if (facette === ('style' as FacetteKind)) return { ...f, styles: [] }
  return f
}

export type Comptes = ReadonlyMap<FacetteKind, ReadonlyMap<string, number>>

/** Combien de recettes portent chaque valeur d'une facette, parmi `ids`. */
export function compterValeurs(
  catalogue: Catalog,
  ids: Iterable<RecipeId>,
  facette: FacetteKind
): ReadonlyMap<string, number> {
  const comptes = new Map<string, number>()
  for (const id of ids) {
    for (const f of catalogue.recipes.get(id)?.facettes ?? []) {
      if (f.facette === facette) comptes.set(f.valeur, (comptes.get(f.valeur) ?? 0) + 1)
    }
  }
  return comptes
}

export function FiltresRecettes({
  catalogue,
  filtres,
  comptes,
  deplie,
  onChange,
  onDeplier,
}: {
  readonly catalogue: Catalog
  readonly filtres: FiltresRecette
  readonly comptes: Comptes
  readonly deplie: boolean
  readonly onChange: (filtres: FiltresRecette) => void
  readonly onDeplier: () => void
}) {
  const basculer = (liste: readonly string[], valeur: string): readonly string[] =>
    liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]

  return (
    <>
      <Pastilles
        titre="Cuisine"
        valeurs={valeursDeFacette(catalogue, 'cuisine' as FacetteKind)}
        comptes={comptes.get('cuisine' as FacetteKind)}
        choisies={filtres.cuisines}
        deplie={deplie}
        onBasculer={(v) => onChange({ ...filtres, cuisines: basculer(filtres.cuisines, v) })}
      />
      <Pastilles
        titre="Style"
        valeurs={valeursDeFacette(catalogue, 'style' as FacetteKind)}
        comptes={comptes.get('style' as FacetteKind)}
        choisies={filtres.styles}
        deplie={deplie}
        onBasculer={(v) => onChange({ ...filtres, styles: basculer(filtres.styles, v) })}
      />

      {/* ⚠️ TOUJOURS VISIBLE, plus derrière « Plus de filtres ». §4.4 range « le reste » dans le
          dépliant, mais le temps disponible n'est pas un raffinement : c'est le premier critère de
          quelqu'un qui cherche quoi faire à manger ce soir. Le laisser replié le rendait
          introuvable pour qui ne pense pas à déplier — et il pilote la couche `temps` du moteur. */}
      <fieldset className="mt-4">
        <legend className="text-[0.9rem] text-texte-doux">Temps maximum</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PALIERS_TEMPS.map((palier) => (
            <Pastille
              key={palier.libelle}
              libelle={palier.libelle}
              active={filtres.tempsMaxMin === palier.minutes}
              onBasculer={() =>
                onChange({
                  ...filtres,
                  tempsMaxMin: filtres.tempsMaxMin === palier.minutes ? null : palier.minutes,
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onDeplier}
        aria-expanded={deplie}
        className="mt-3 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux"
      >
        {deplie ? 'Moins de filtres' : 'Plus de filtres'}
      </button>
    </>
  )
}

function Pastilles({
  titre,
  valeurs,
  comptes,
  choisies,
  deplie,
  onBasculer,
}: {
  readonly titre: string
  readonly valeurs: readonly { readonly valeur: string; readonly nombre: number }[]
  readonly comptes: ReadonlyMap<string, number> | undefined
  readonly choisies: readonly string[]
  readonly deplie: boolean
  readonly onBasculer: (valeur: string) => void
}) {
  // ⚠️ ORDRE STABLE, issu de la fréquence GLOBALE, et non de la fréquence du moment. Réordonner les
  // pastilles à chaque frappe les ferait danser sous le doigt : on ne saurait plus où viser. Seuls
  // les COMPTES bougent.
  const visibles = deplie
    ? valeurs
    : valeurs.filter((v, i) => i < PASTILLES_VISIBLES || choisies.includes(v.valeur))

  return (
    <fieldset className="mt-4">
      <legend className="text-[0.9rem] text-texte-doux">{titre}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibles.map((v) => {
          const nombre = comptes?.get(v.valeur) ?? 0
          const active = choisies.includes(v.valeur)
          return (
            <Pastille
              key={v.valeur}
              libelle={`${v.valeur} (${nombre})`}
              active={active}
              // Une pastille à zéro ne donnerait aucun résultat : la désactiver évite un tap qui
              // vide l'écran sans explication. Une pastille DÉJÀ choisie reste toujours cliquable,
              // sinon on ne pourrait plus la retirer.
              inerte={nombre === 0 && !active}
              onBasculer={() => onBasculer(v.valeur)}
            />
          )
        })}
      </div>
    </fieldset>
  )
}

function Pastille({
  libelle,
  active,
  inerte = false,
  onBasculer,
}: {
  readonly libelle: string
  readonly active: boolean
  readonly inerte?: boolean
  readonly onBasculer: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      disabled={inerte}
      aria-pressed={active}
      className={
        'flex min-h-tactile items-center rounded-[0.7rem] px-3 text-[0.92rem] font-semibold disabled:opacity-40 ' +
        (active
          ? 'border-2 border-accent bg-accent-doux text-accent-texte'
          : 'border border-bordure-forte bg-surface text-texte-doux')
      }
    >
      {libelle}
    </button>
  )
}

/** Filtres actifs, chacun RETIRABLE D'UN TAP (§4.4). `extra` permet d'y glisser ceux d'un écran. */
export function FiltresActifs({
  filtres,
  extra = [],
  onChange,
  onVider,
}: {
  readonly filtres: FiltresRecette
  readonly extra?: readonly { readonly libelle: string; readonly retirer: () => void }[]
  readonly onChange: (filtres: FiltresRecette) => void
  readonly onVider: () => void
}) {
  const actifs = [
    ...extra,
    ...filtres.cuisines.map((cuisine) => ({
      libelle: cuisine,
      retirer: () => onChange({ ...filtres, cuisines: filtres.cuisines.filter((c) => c !== cuisine) }),
    })),
    ...filtres.styles.map((style) => ({
      libelle: style,
      retirer: () => onChange({ ...filtres, styles: filtres.styles.filter((s) => s !== style) }),
    })),
    ...(filtres.tempsMaxMin === null
      ? []
      : [{ libelle: `≤ ${filtres.tempsMaxMin} min`, retirer: () => onChange({ ...filtres, tempsMaxMin: null }) }]),
  ]
  if (actifs.length === 0) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {actifs.map((actif) => (
        <button
          key={actif.libelle}
          type="button"
          onClick={actif.retirer}
          aria-label={`Retirer le filtre ${actif.libelle}`}
          className="flex min-h-tactile items-center gap-2 rounded-[0.7rem] border-2 border-accent bg-accent-doux px-3 text-[0.92rem] font-semibold text-accent-texte"
        >
          {actif.libelle}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onVider}
        className="flex min-h-tactile items-center px-3 text-[0.92rem] font-semibold text-attenue underline"
      >
        Tout retirer
      </button>
    </div>
  )
}
