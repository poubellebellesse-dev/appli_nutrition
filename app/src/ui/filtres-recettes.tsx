// ui/filtres-recettes.tsx — filtres de recette, partagés par « Recettes » et « Vider le frigo ».
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
// ⚠️ LE COMPTE D'UN AXE IGNORE SA PROPRE SÉLECTION. Si `française` est choisie, tous les résultats
// sont français et `italienne` afficherait 0 — alors que désélectionner `française` ramènerait 19
// recettes. Chaque écran calcule donc les comptes d'un axe en appliquant tous les filtres SAUF lui.
//
// ⚠️ SIX AXES, TROIS EN ACCÈS DIRECT — retour d'essai explicite : « la cuisine est à deux gestes »,
// « plus de filtres = autres filtres en plus ». Cuisine, Régime et Service ouvrent chacun SA PROPRE
// fenêtre en un tap ; Style, Occasion et Envergure vivent derrière « Plus de filtres », qui ne les
// duplique JAMAIS. Le geste se réduit en répartissant, pas en dépliant en place — §1 panneau.tsx
// explique pourquoi un dépliant est écarté (contrainte d'âge du produit).
//
// ⚠️ SERVICE ET ENVERGURE NE SONT PAS DES FACETTES. `recette.service` (`CourseKind`) et
// `recette.envergure` (`RecipeEnvergure`) sont des champs directs de `Recipe`, pas des
// `RecipeFacet` — d'où des fonctions de comptage et de bascule séparées de celles des facettes
// (cuisine/régime/style/occasion), qui partagent toutes `recipe_facet`.

import { useState } from 'react'
import type { Catalog, CourseKind, FacetteKind, RecipeEnvergure, RecipeId } from '../engine/domain/index.js'
import { valeursDeEnvergure, valeursDeFacette, valeursDeService } from '../engine/search/index.js'
import { Panneau } from './panneau.js'

/** Paliers de temps total, en minutes. */
const PALIERS_TEMPS: readonly { readonly minutes: number; readonly libelle: string }[] = [
  { minutes: 20, libelle: '20 min' },
  { minutes: 40, libelle: '40 min' },
  { minutes: 60, libelle: '1 h' },
]

/** Libellés éditoriaux — `recette.service` et `recette.envergure` sont des codes bruts en base
 *  ('entree', 'quotidien'…), pas du texte à afficher. Même libellés que `editeur-recette.tsx` pour
 *  l'envergure : c'est le même concept, deux écrans doivent dire pareil. */
const LIBELLE_SERVICE: Readonly<Record<CourseKind, string>> = {
  entree: 'Entrée',
  plat: 'Plat',
  accompagnement: 'Accompagnement',
  fromage: 'Fromage',
  dessert: 'Dessert',
}

const LIBELLE_ENVERGURE: Readonly<Record<RecipeEnvergure, string>> = {
  quotidien: 'De tous les jours',
  convivial: 'Pour recevoir',
  fete: 'De fête',
}

export interface FiltresRecette {
  readonly cuisines: readonly string[]
  readonly regimes: readonly string[]
  readonly services: readonly CourseKind[]
  readonly styles: readonly string[]
  readonly occasions: readonly string[]
  readonly envergures: readonly RecipeEnvergure[]
  readonly tempsMaxMin: number | null
}

export const FILTRES_VIDES: FiltresRecette = {
  cuisines: [],
  regimes: [],
  services: [],
  styles: [],
  occasions: [],
  envergures: [],
  tempsMaxMin: null,
}

export function aucunFiltre(f: FiltresRecette): boolean {
  return (
    f.cuisines.length === 0 &&
    f.regimes.length === 0 &&
    f.services.length === 0 &&
    f.styles.length === 0 &&
    f.occasions.length === 0 &&
    f.envergures.length === 0 &&
    f.tempsMaxMin === null
  )
}

/** Facettes → valeurs choisies, dans la forme qu'attend le moteur. N'y figurent QUE les quatre axes
 *  qui sont réellement des `RecipeFacet` — service et envergure passent par des champs dédiés de
 *  `BrowseRequest`/`PantryRequest`, voir `servicesDe`/`enverguresDe`. */
export function facettesDe(f: FiltresRecette): ReadonlyMap<FacetteKind, readonly string[]> {
  const facettes = new Map<FacetteKind, readonly string[]>()
  if (f.cuisines.length > 0) facettes.set('cuisine' as FacetteKind, f.cuisines)
  if (f.regimes.length > 0) facettes.set('regime' as FacetteKind, f.regimes)
  if (f.styles.length > 0) facettes.set('style' as FacetteKind, f.styles)
  if (f.occasions.length > 0) facettes.set('occasion' as FacetteKind, f.occasions)
  return facettes
}

/** Les mêmes filtres, une facette retirée — pour compter sans que la sélection s'auto-annule. */
export function sansFacette(f: FiltresRecette, facette: FacetteKind): FiltresRecette {
  if (facette === ('cuisine' as FacetteKind)) return { ...f, cuisines: [] }
  if (facette === ('regime' as FacetteKind)) return { ...f, regimes: [] }
  if (facette === ('style' as FacetteKind)) return { ...f, styles: [] }
  if (facette === ('occasion' as FacetteKind)) return { ...f, occasions: [] }
  return f
}

/** Même raisonnement que `sansFacette`, pour les deux axes hors facette. */
export function sansService(f: FiltresRecette): FiltresRecette {
  return { ...f, services: [] }
}

export function sansEnvergure(f: FiltresRecette): FiltresRecette {
  return { ...f, envergures: [] }
}

export interface Comptes {
  readonly facettes: ReadonlyMap<FacetteKind, ReadonlyMap<string, number>>
  readonly services: ReadonlyMap<CourseKind, number>
  readonly envergures: ReadonlyMap<RecipeEnvergure, number>
}

export const COMPTES_VIDES: Comptes = { facettes: new Map(), services: new Map(), envergures: new Map() }

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

/** Même chose que `compterValeurs`, pour le champ direct `recette.service`. */
export function compterService(catalogue: Catalog, ids: Iterable<RecipeId>): ReadonlyMap<CourseKind, number> {
  const comptes = new Map<CourseKind, number>()
  for (const id of ids) {
    const service = catalogue.recipes.get(id)?.service
    if (service !== null && service !== undefined) comptes.set(service, (comptes.get(service) ?? 0) + 1)
  }
  return comptes
}

/** Même chose, pour `recette.envergure` — jamais `null` sur une recette, contrairement à `service`. */
export function compterEnvergure(
  catalogue: Catalog,
  ids: Iterable<RecipeId>
): ReadonlyMap<RecipeEnvergure, number> {
  const comptes = new Map<RecipeEnvergure, number>()
  for (const id of ids) {
    const envergure = catalogue.recipes.get(id)?.envergure
    if (envergure !== undefined) comptes.set(envergure, (comptes.get(envergure) ?? 0) + 1)
  }
  return comptes
}

type Panneau6 = 'cuisine' | 'regime' | 'service' | 'plus' | null

export function FiltresRecettes({
  catalogue,
  filtres,
  comptes,
  onChange,
}: {
  readonly catalogue: Catalog
  readonly filtres: FiltresRecette
  readonly comptes: Comptes
  readonly onChange: (filtres: FiltresRecette) => void
}) {
  const [panneauOuvert, setPanneauOuvert] = useState<Panneau6>(null)

  const cuisines = valeursDeFacette(catalogue, 'cuisine' as FacetteKind)
  const regimes = valeursDeFacette(catalogue, 'regime' as FacetteKind)
  const services = valeursDeService(catalogue)
  const styles = valeursDeFacette(catalogue, 'style' as FacetteKind)
  const occasions = valeursDeFacette(catalogue, 'occasion' as FacetteKind)
  const envergures = valeursDeEnvergure(catalogue)

  const onBasculerCuisine = (v: string) =>
    onChange({ ...filtres, cuisines: basculer(filtres.cuisines, v) })
  const onBasculerRegime = (v: string) => onChange({ ...filtres, regimes: basculer(filtres.regimes, v) })
  const onBasculerService = (v: CourseKind) =>
    onChange({ ...filtres, services: basculer(filtres.services, v) })
  const onBasculerStyle = (v: string) => onChange({ ...filtres, styles: basculer(filtres.styles, v) })
  const onBasculerOccasion = (v: string) =>
    onChange({ ...filtres, occasions: basculer(filtres.occasions, v) })
  const onBasculerEnvergure = (v: RecipeEnvergure) =>
    onChange({ ...filtres, envergures: basculer(filtres.envergures, v) })

  const fermer = () => setPanneauOuvert(null)
  const nombrePlusDeFiltres = filtres.styles.length + filtres.occasions.length + filtres.envergures.length

  return (
    <>
      {/* Trois axes en ACCÈS DIRECT, un geste chacun (voir l'en-tête). */}
      <BoutonAxe titre="Cuisine" nombreChoisi={filtres.cuisines.length} onOuvrir={() => setPanneauOuvert('cuisine')} />
      <BoutonAxe titre="Régime" nombreChoisi={filtres.regimes.length} onOuvrir={() => setPanneauOuvert('regime')} />
      <BoutonAxe titre="Service" nombreChoisi={filtres.services.length} onOuvrir={() => setPanneauOuvert('service')} />

      {/* ⚠️ TOUJOURS VISIBLE, jamais derrière une fenêtre. §4.4 range « le reste » dans le
          dépliant, mais le temps disponible n'est pas un raffinement : c'est le premier critère de
          quelqu'un qui cherche quoi faire à manger ce soir. Il pilote la couche `temps` du moteur. */}
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

      {/* « Plus de filtres » = D'AUTRES filtres, jamais les mêmes (retour d'essai explicite). Style,
          Occasion et Envergure n'ont AUCUN accès direct — ce sont les seuls endroits où on les
          règle. */}
      <BoutonAxe titre="Plus de filtres" nombreChoisi={nombrePlusDeFiltres} onOuvrir={() => setPanneauOuvert('plus')} />

      {panneauOuvert === 'cuisine' && (
        <Panneau titre="Cuisine" onFermer={fermer}>
          <Pastilles
            titre="Cuisine"
            valeurs={cuisines}
            comptes={comptes.facettes.get('cuisine' as FacetteKind)}
            choisies={filtres.cuisines}
            toutesLesValeurs
            onBasculer={onBasculerCuisine}
          />
        </Panneau>
      )}

      {panneauOuvert === 'regime' && (
        <Panneau titre="Régime" onFermer={fermer}>
          <Pastilles
            titre="Régime"
            valeurs={regimes}
            comptes={comptes.facettes.get('regime' as FacetteKind)}
            choisies={filtres.regimes}
            toutesLesValeurs
            onBasculer={onBasculerRegime}
          />
        </Panneau>
      )}

      {panneauOuvert === 'service' && (
        <Panneau titre="Service" onFermer={fermer}>
          <Pastilles
            titre="Service"
            valeurs={services}
            comptes={comptes.services}
            choisies={filtres.services}
            libelleDe={(v) => LIBELLE_SERVICE[v]}
            toutesLesValeurs
            onBasculer={onBasculerService}
          />
        </Panneau>
      )}

      {panneauOuvert === 'plus' && (
        <Panneau titre="Plus de filtres" onFermer={fermer}>
          <Pastilles
            titre="Style"
            valeurs={styles}
            comptes={comptes.facettes.get('style' as FacetteKind)}
            choisies={filtres.styles}
            toutesLesValeurs
            onBasculer={onBasculerStyle}
          />
          <Pastilles
            titre="Occasion"
            valeurs={occasions}
            comptes={comptes.facettes.get('occasion' as FacetteKind)}
            choisies={filtres.occasions}
            toutesLesValeurs
            onBasculer={onBasculerOccasion}
          />
          <Pastilles
            titre="Envergure"
            valeurs={envergures}
            comptes={comptes.envergures}
            choisies={filtres.envergures}
            libelleDe={(v) => LIBELLE_ENVERGURE[v]}
            toutesLesValeurs
            onBasculer={onBasculerEnvergure}
          />
        </Panneau>
      )}
    </>
  )
}

function basculer<T>(liste: readonly T[], valeur: T): readonly T[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]
}

/**
 * Ligne qui OUVRE la fenêtre d'un axe — libellé, compte de sélection, et l'état actif/inactif.
 *
 * ⚠️ LE COMPTE EST SUR LA LIGNE, PAS SEULEMENT DANS LA FENÊTRE. Sans lui, savoir si « Cuisine »
 * filtre quelque chose demanderait d'ouvrir la fenêtre pour vérifier — exactement le coût qu'on
 * cherche à retirer.
 *
 * ⚠️ `aria-haspopup="dialog"` ET NON `aria-expanded` : ce bouton n'agrandit rien EN PLACE, il ouvre
 * une fenêtre (voir panneau.tsx). `aria-expanded` annoncerait un contenu qui se déplie ici même.
 */
function BoutonAxe({
  titre,
  nombreChoisi,
  onOuvrir,
}: {
  readonly titre: string
  readonly nombreChoisi: number
  readonly onOuvrir: () => void
}) {
  const actif = nombreChoisi > 0
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-haspopup="dialog"
      className={
        'mt-3 flex min-h-tactile w-full items-center justify-between rounded-[0.7rem] px-4 text-[0.98rem] font-semibold ' +
        (actif
          ? 'border-2 border-accent bg-accent-doux text-accent-texte'
          : 'border border-bordure-forte bg-surface text-texte-doux')
      }
    >
      <span>
        {titre}
        {actif ? ` · ${nombreChoisi}` : ''}
      </span>
      <span aria-hidden="true" className="text-attenue">
        ›
      </span>
    </button>
  )
}

function Pastilles<T extends string>({
  titre,
  valeurs,
  comptes,
  choisies,
  toutesLesValeurs = false,
  libelleDe,
  onBasculer,
}: {
  readonly titre: string
  readonly valeurs: readonly { readonly valeur: T; readonly nombre: number }[]
  readonly comptes: ReadonlyMap<T, number> | undefined
  readonly choisies: readonly T[]
  readonly toutesLesValeurs?: boolean
  readonly libelleDe?: (valeur: T) => string
  readonly onBasculer: (valeur: T) => void
}) {
  const nomDe = libelleDe ?? ((v: T) => v)
  // ⚠️ ORDRE STABLE, issu de la fréquence GLOBALE (ou de l'ordre naturel pour service/envergure), et
  // non de la fréquence du moment. Réordonner les pastilles à chaque frappe les ferait danser sous
  // le doigt. Seuls les COMPTES bougent.
  const visibles = toutesLesValeurs ? valeurs : valeurs.filter((v) => choisies.includes(v.valeur))

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
              libelle={`${nomDe(v.valeur)} (${nombre})`}
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
    ...filtres.regimes.map((regime) => ({
      libelle: regime,
      retirer: () => onChange({ ...filtres, regimes: filtres.regimes.filter((r) => r !== regime) }),
    })),
    ...filtres.services.map((service) => ({
      libelle: LIBELLE_SERVICE[service],
      retirer: () => onChange({ ...filtres, services: filtres.services.filter((s) => s !== service) }),
    })),
    ...filtres.styles.map((style) => ({
      libelle: style,
      retirer: () => onChange({ ...filtres, styles: filtres.styles.filter((s) => s !== style) }),
    })),
    ...filtres.occasions.map((occasion) => ({
      libelle: occasion,
      retirer: () => onChange({ ...filtres, occasions: filtres.occasions.filter((o) => o !== occasion) }),
    })),
    ...filtres.envergures.map((envergure) => ({
      libelle: LIBELLE_ENVERGURE[envergure],
      retirer: () => onChange({ ...filtres, envergures: filtres.envergures.filter((e) => e !== envergure) }),
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
