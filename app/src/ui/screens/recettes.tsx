// ui/screens/recettes.tsx — écran « Recettes » (§4.4 DESIGN).
//
// ⚠️ CHERCHER N'EST PAS SE FAIRE PROPOSER. Cet écran n'applique AUCUN score et AUCUN classement par
// goût : `browseRecipes` rend les recettes dans l'ordre du catalogue. Quand on cherche un plat
// précis, le voir passer derrière trois autres « mieux notés » est déroutant — c'est ce qui
// distingue cet écran d'« Aujourd'hui ».
//
// ⚠️ LES EXCLUSIONS S'APPLIQUENT QUAND MÊME, et elles passent par le MOTEUR. Filtrer les allergènes
// ici, en JavaScript d'écran, serait plus simple et introduirait une seconde implémentation d'un
// garde-fou critique — le jour où les deux divergent, la recherche affiche un plat dangereux. Voir
// `Engine.browseRecipes`, et le test `tests/recherche-catalogue-reel.test.ts` qui vérifie la
// propriété sur TOUTES les recettes rendues, y compris quand on cherche explicitement le plat exclu.
//
// PÉRIMÈTRE — ce que §4.4 décrit et qui n'est PAS ici : l'état « Pourquoi pas ce plat ? » (nommer
// la raison d'exclusion d'une recette précise — `entonnoir.entries` porte déjà la matière), le bloc
// d'entrée « Vider le frigo » (l'écran 4.5 n'existe pas), et la catégorie « Loufoque », qui n'a
// AUCUNE recette au catalogue : les six styles présents sont quotidien, convivial, simple,
// reconfortant, rapide et gourmand. C'est du contenu à écrire, pas du code à ajouter.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Catalog, ExclusionLayerId, FacetteKind, RecipeId } from '../../engine/domain/index.js'
import type { BrowseResult, Engine } from '../../engine/api/index.js'
import { valeursDeFacette } from '../../engine/search/index.js'
import { readUserState, setFavorite } from '../../data/user-store.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle } from '../socle.js'
import { hashDeRecette } from '../router.js'

/** Combien de valeurs par facette montrer avant de replier (§4.4 : « deux rangées »). */
const PASTILLES_VISIBLES = 5

/** Paliers de temps total, en minutes. `null` = sans limite. */
const PALIERS_TEMPS: readonly { readonly minutes: number | null; readonly libelle: string }[] = [
  { minutes: 20, libelle: '20 min' },
  { minutes: 40, libelle: '40 min' },
  { minutes: 60, libelle: '1 h' },
]

const LIBELLE_COUCHE: Readonly<Record<ExclusionLayerId, string>> = {
  allergenes: 'allergènes',
  regime: 'régime',
  exclusions: 'vos exclusions',
  requis: 'aliment exigé',
  temps: 'temps',
  equipement: 'équipement',
  favoris: 'favoris',
}

interface Filtres {
  readonly texte: string
  readonly cuisines: readonly string[]
  readonly styles: readonly string[]
  readonly tempsMaxMin: number | null
  readonly favorisSeuls: boolean
}

const FILTRES_VIDES: Filtres = {
  texte: '',
  cuisines: [],
  styles: [],
  tempsMaxMin: null,
  favorisSeuls: false,
}

function aucunFiltre(f: Filtres): boolean {
  return (
    f.texte.trim() === '' &&
    f.cuisines.length === 0 &&
    f.styles.length === 0 &&
    f.tempsMaxMin === null &&
    !f.favorisSeuls
  )
}

interface Socle {
  readonly catalogue: Catalog
  readonly moteur: Engine
  readonly favoris: ReadonlySet<RecipeId>
  readonly contraintes: ReturnType<typeof readUserState>['constraints']
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly socle: Socle }
  | { readonly phase: 'erreur'; readonly message: string }

export function Recettes() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES)
  const [deplie, setDeplie] = useState(false)

  const rafraichir = useCallback(() => {
    chargerSocle()
      .then((s) => {
        const utilisateur = readUserState(s.db, {
          windowDays: FENETRE_HISTORIQUE_JOURS,
          today: aujourdhuiIso(),
        })
        setEtat({
          phase: 'pret',
          socle: {
            catalogue: s.catalogue,
            moteur: s.moteur,
            favoris: utilisateur.favoriteRecipeIds,
            contraintes: utilisateur.constraints,
          },
        })
      })
      .catch((erreur: unknown) => {
        setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
  }, [])

  useEffect(rafraichir, [rafraichir])

  const basculerFavori = useCallback(
    (id: RecipeId, favori: boolean) => {
      chargerSocle()
        .then((s) => {
          setFavorite(s.db, id, favori, aujourdhuiIso())
          rafraichir()
        })
        .catch(() => undefined)
    },
    [rafraichir]
  )

  const resultat: BrowseResult | null = useMemo(() => {
    if (etat.phase !== 'pret') return null
    const facettes = new Map<FacetteKind, readonly string[]>()
    if (filtres.cuisines.length > 0) facettes.set('cuisine' as FacetteKind, filtres.cuisines)
    if (filtres.styles.length > 0) facettes.set('style' as FacetteKind, filtres.styles)
    return etat.socle.moteur.browseRecipes({
      constraints: etat.socle.contraintes,
      texte: filtres.texte,
      facettes,
      tempsMaxMin: filtres.tempsMaxMin,
      favoriteRecipeIds: etat.socle.favoris,
      onlyFavorites: filtres.favorisSeuls,
    })
  }, [etat, filtres])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement du catalogue…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">Le catalogue n'a pas pu être lu.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { socle } = etat
  const cuisines = valeursDeFacette(socle.catalogue, 'cuisine' as FacetteKind)
  const styles = valeursDeFacette(socle.catalogue, 'style' as FacetteKind)
  const trouvees = resultat?.recipeIds ?? []

  return (
    <section>
      <h1 className="text-[2.1rem] text-texte">Recettes</h1>

      <Recherche
        catalogue={socle.catalogue}
        valeur={filtres.texte}
        onChange={(texte) => setFiltres({ ...filtres, texte })}
      />

      {/* « Mes favoris » en tête, à UN TAP (§4.4). */}
      <button
        type="button"
        onClick={() => setFiltres({ ...filtres, favorisSeuls: !filtres.favorisSeuls })}
        aria-pressed={filtres.favorisSeuls}
        className={
          'mt-3 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-4 text-[1rem] font-semibold ' +
          (filtres.favorisSeuls
            ? 'border-2 border-accent bg-accent-doux text-accent-texte'
            : 'border border-bordure-forte bg-surface text-texte-doux')
        }
      >
        Mes favoris ({socle.favoris.size})
      </button>

      <Pastilles
        titre="Cuisine"
        valeurs={cuisines}
        choisies={filtres.cuisines}
        deplie={deplie}
        onBasculer={(v) => setFiltres({ ...filtres, cuisines: basculerValeur(filtres.cuisines, v) })}
      />
      <Pastilles
        titre="Style"
        valeurs={styles}
        choisies={filtres.styles}
        deplie={deplie}
        onBasculer={(v) => setFiltres({ ...filtres, styles: basculerValeur(filtres.styles, v) })}
      />

      {deplie && (
        <fieldset className="mt-4">
          <legend className="text-[0.9rem] text-texte-doux">Temps maximum</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PALIERS_TEMPS.map((palier) => (
              <Pastille
                key={palier.libelle}
                libelle={palier.libelle}
                active={filtres.tempsMaxMin === palier.minutes}
                onBasculer={() =>
                  setFiltres({
                    ...filtres,
                    tempsMaxMin: filtres.tempsMaxMin === palier.minutes ? null : palier.minutes,
                  })
                }
              />
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={() => setDeplie((d) => !d)}
        aria-expanded={deplie}
        className="mt-3 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux"
      >
        {deplie ? 'Moins de filtres' : 'Plus de filtres'}
      </button>

      {!aucunFiltre(filtres) && (
        <FiltresActifs filtres={filtres} onVider={() => setFiltres(FILTRES_VIDES)} onChange={setFiltres} />
      )}

      {/* Entonnoir des écartées (§6.8 ENGINE) — le différenciateur : dire CE QUI a été retiré et
          par quoi, au lieu de laisser croire que le catalogue est petit. */}
      {resultat !== null && resultat.entonnoir.totalRejected > 0 && (
        <Entonnoir resultat={resultat} />
      )}

      <p className="mt-5 text-[0.95rem] text-attenue">
        {trouvees.length} recette{trouvees.length > 1 ? 's' : ''}
        {trouvees.length === 0 && ' — essayez de retirer un filtre.'}
      </p>

      <ul className="mt-3 space-y-2">
        {trouvees.map((id) => {
          const recette = socle.catalogue.recipes.get(id)
          if (recette === undefined) return null
          const favori = socle.favoris.has(id)
          return (
            <li
              key={id}
              className="flex items-stretch rounded-[--radius-carte] border border-bordure bg-surface"
            >
              {/* La CARTE ENTIÈRE ouvre la fiche, pas seulement le titre : même raison que la
                  ligne cochable des courses — viser un mot de 12 px est hors de portée d'une main
                  tremblante. L'étoile reste en dehors du lien pour rester actionnable seule. */}
              <a
                href={hashDeRecette(id)}
                className="flex-1 p-3 no-underline"
              >
                <h2 className="font-titre text-[1.2rem] leading-snug text-texte">{recette.nom}</h2>
                <p className="mt-1 text-[0.92rem] leading-relaxed text-texte-doux">{recette.description}</p>
                <p className="mt-1 text-[0.85rem] text-attenue">
                  {recette.tempsPrepMin + recette.tempsCuissonMin} min · {recette.portionsBase} portions
                </p>
              </a>
              <button
                type="button"
                onClick={() => basculerFavori(id, !favori)}
                aria-pressed={favori}
                aria-label={favori ? `Retirer ${recette.nom} des favoris` : `Ajouter ${recette.nom} aux favoris`}
                className={
                  'flex min-h-tactile w-14 items-center justify-center text-[1.3rem] ' +
                  (favori ? 'text-accent-texte' : 'text-attenue')
                }
              >
                {favori ? '★' : '☆'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function basculerValeur(liste: readonly string[], valeur: string): readonly string[] {
  return liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur]
}

/**
 * Champ de recherche avec autocomplétion.
 *
 * ⚠️ `<datalist>` NATIF plutôt qu'une liste déroulante maison. Le composant natif est déjà
 * accessible au clavier et au lecteur d'écran, il s'affiche correctement sur mobile, et il ne
 * capture pas le focus. Une liste maison demanderait de reproduire tout ça — pour un gain visuel
 * que §4.4 ne réclame pas.
 */
function Recherche({
  catalogue,
  valeur,
  onChange,
}: {
  readonly catalogue: Catalog
  readonly valeur: string
  readonly onChange: (texte: string) => void
}) {
  // Suggestions : plats, ingrédients et cuisines (§4.4). Calculées une fois, pas par frappe.
  const suggestions = useMemo(() => {
    const mots = new Set<string>()
    for (const recette of catalogue.recipes.values()) mots.add(recette.nom)
    for (const aliment of catalogue.foods.values()) mots.add(aliment.nom)
    for (const { valeur: cuisine } of valeursDeFacette(catalogue, 'cuisine' as FacetteKind)) {
      mots.add(cuisine)
    }
    return [...mots]
  }, [catalogue])

  return (
    <label className="mt-4 block">
      <span className="text-[0.9rem] text-texte-doux">Rechercher un plat, un ingrédient</span>
      <input
        type="search"
        list="suggestions-recettes"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="poulet, crème, italienne…"
        className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-[1.05rem] text-texte"
      />
      <datalist id="suggestions-recettes">
        {suggestions.map((mot) => (
          <option key={mot} value={mot} />
        ))}
      </datalist>
    </label>
  )
}

function Pastilles({
  titre,
  valeurs,
  choisies,
  deplie,
  onBasculer,
}: {
  readonly titre: string
  readonly valeurs: readonly { readonly valeur: string; readonly nombre: number }[]
  readonly choisies: readonly string[]
  readonly deplie: boolean
  readonly onBasculer: (valeur: string) => void
}) {
  // Repliées : les plus fréquentes d'abord (l'ordre vient de `valeursDeFacette`), plus celles déjà
  // choisies — masquer un filtre actif le rendrait impossible à retirer depuis cette rangée.
  const visibles = deplie
    ? valeurs
    : valeurs.filter((v, i) => i < PASTILLES_VISIBLES || choisies.includes(v.valeur))

  return (
    <fieldset className="mt-4">
      <legend className="text-[0.9rem] text-texte-doux">{titre}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {visibles.map((v) => (
          <Pastille
            key={v.valeur}
            libelle={`${v.valeur} (${v.nombre})`}
            active={choisies.includes(v.valeur)}
            onBasculer={() => onBasculer(v.valeur)}
          />
        ))}
      </div>
    </fieldset>
  )
}

function Pastille({
  libelle,
  active,
  onBasculer,
}: {
  readonly libelle: string
  readonly active: boolean
  readonly onBasculer: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      aria-pressed={active}
      className={
        'flex min-h-tactile items-center rounded-[0.7rem] px-3 text-[0.92rem] font-semibold ' +
        (active
          ? 'border-2 border-accent bg-accent-doux text-accent-texte'
          : 'border border-bordure-forte bg-surface text-texte-doux')
      }
    >
      {libelle}
    </button>
  )
}

/** Filtres actifs, chacun RETIRABLE D'UN TAP (§4.4). */
function FiltresActifs({
  filtres,
  onChange,
  onVider,
}: {
  readonly filtres: Filtres
  readonly onChange: (filtres: Filtres) => void
  readonly onVider: () => void
}) {
  const actifs: { readonly libelle: string; readonly retirer: () => void }[] = []
  if (filtres.texte.trim() !== '') {
    actifs.push({ libelle: `« ${filtres.texte} »`, retirer: () => onChange({ ...filtres, texte: '' }) })
  }
  if (filtres.favorisSeuls) {
    actifs.push({ libelle: 'Mes favoris', retirer: () => onChange({ ...filtres, favorisSeuls: false }) })
  }
  for (const cuisine of filtres.cuisines) {
    actifs.push({
      libelle: cuisine,
      retirer: () => onChange({ ...filtres, cuisines: filtres.cuisines.filter((c) => c !== cuisine) }),
    })
  }
  for (const style of filtres.styles) {
    actifs.push({
      libelle: style,
      retirer: () => onChange({ ...filtres, styles: filtres.styles.filter((s) => s !== style) }),
    })
  }
  if (filtres.tempsMaxMin !== null) {
    actifs.push({
      libelle: `≤ ${filtres.tempsMaxMin} min`,
      retirer: () => onChange({ ...filtres, tempsMaxMin: null }),
    })
  }

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

/**
 * « 241 recettes → allergènes −18 → régime −40 = 183 disponibles » (§4.4, §6.8 ENGINE).
 *
 * ⚠️ NE COMPTE QUE LES EXCLUSIONS DURES. Les recettes écartées par la recherche ou par une pastille
 * n'y figurent pas : l'utilisateur vient de les exclure lui-même, les présenter comme « écartées »
 * rendrait le chiffre incompréhensible. L'entonnoir dit ce que ses CONTRAINTES lui retirent.
 */
function Entonnoir({ resultat }: { readonly resultat: BrowseResult }) {
  const etapes = [...resultat.entonnoir.byLayer.entries()].filter(([, n]) => n > 0)
  const restantes = resultat.entonnoir.totalInitial - resultat.entonnoir.totalRejected

  return (
    <p className="mt-4 rounded-[--radius-carte] border border-bordure bg-surface p-3 text-[0.9rem] leading-relaxed text-texte-doux">
      <span className="tabular-nums">{resultat.entonnoir.totalInitial}</span> recettes
      {etapes.map(([couche, nombre]) => (
        <span key={couche}>
          {' → '}
          {LIBELLE_COUCHE[couche] ?? couche} <span className="tabular-nums">−{nombre}</span>
        </span>
      ))}
      {' = '}
      <span className="font-semibold tabular-nums text-texte">{restantes}</span> disponibles
    </p>
  )
}
