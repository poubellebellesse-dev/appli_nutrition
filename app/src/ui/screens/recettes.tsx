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
// ⚠️ LE CHAMP S'ANNONCE « RECHERCHER UN PLAT », alors que l'index couvre aussi les ingrédients
// (§4.4 écrivait « plats, ingrédients, cuisines »). Ce n'est pas une omission : chercher par
// ALIMENT, c'est « Vider le frigo », qui le fait mieux — il classe par couverture et dit ce qui
// manque. Annoncer les deux ici ferait deux fonctions qui se marchent dessus. Taper « poulet »
// continue de trouver des plats au poulet ; c'est bien ce que la promesse dit.
//
// PÉRIMÈTRE — ce que §4.4 décrit et qui n'est PAS ici : l'état « Pourquoi pas ce plat ? »
// (`entonnoir.entries` porte déjà la matière), et la catégorie « Loufoque », qui n'a AUCUNE recette
// au catalogue — six styles seulement, du contenu à écrire, pas du code à ajouter.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Catalog, ExclusionLayerId, FacetteKind, RecipeId } from '../../engine/domain/index.js'
import { normaliser, valeursDeFacette } from '../../engine/search/index.js'
import type { BrowseResult, Engine } from '../../engine/api/index.js'
import {
  FILTRES_VIDES,
  FiltresActifs,
  FiltresRecettes,
  aucunFiltre,
  compterValeurs,
  facettesDe,
  sansFacette,
  type Comptes,
  type FiltresRecette,
} from '../filtres-recettes.js'
import { readUserState, setFavorite } from '../../data/user-store.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle } from '../socle.js'
import { hashDeLEditeur, hashDeRecette, hashDuFrigo } from '../router.js'
import { origineDeCuisine } from '../drapeaux.js'

const LIBELLE_COUCHE: Readonly<Record<ExclusionLayerId, string>> = {
  allergenes: 'allergènes',
  regime: 'régime',
  exclusions: 'vos exclusions',
  requis: 'aliment exigé',
  temps: 'temps',
  equipement: 'équipement',
  favoris: 'favoris',
}

/** Facettes dont l'écran affiche des pastilles — celles qu'il faut compter dynamiquement. */
const FACETTES: readonly FacetteKind[] = ['cuisine' as FacetteKind, 'style' as FacetteKind]

/** Ce que cet écran ajoute aux filtres communs à « Recettes » et « Vider le frigo ». */
interface Filtres {
  readonly commun: FiltresRecette
  readonly texte: string
  readonly favorisSeuls: boolean
}

const FILTRES_ECRAN: Filtres = { commun: FILTRES_VIDES, texte: '', favorisSeuls: false }

function aucunFiltreEcran(f: Filtres): boolean {
  return aucunFiltre(f.commun) && f.texte.trim() === '' && !f.favorisSeuls
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
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_ECRAN)
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

  /** Une requête de parcours, à partir d'un jeu de filtres communs donné. */
  const interroger = useCallback(
    (socle: Socle, commun: FiltresRecette): BrowseResult =>
      socle.moteur.browseRecipes({
        constraints: socle.contraintes,
        texte: filtres.texte,
        facettes: facettesDe(commun),
        tempsMaxMin: commun.tempsMaxMin,
        favoriteRecipeIds: socle.favoris,
        onlyFavorites: filtres.favorisSeuls,
      }),
    [filtres.texte, filtres.favorisSeuls]
  )

  const resultat = useMemo(
    () => (etat.phase === 'pret' ? interroger(etat.socle, filtres.commun) : null),
    [etat, filtres.commun, interroger]
  )

  /**
   * Comptes des pastilles, recalculés à chaque changement de filtre.
   *
   * ⚠️ CHAQUE FACETTE EST COMPTÉE SANS SA PROPRE SÉLECTION. Avec `française` choisie, tous les
   * résultats sont français ; compter `italienne` sur ce jeu donnerait 0, alors que retirer
   * `française` ramènerait 19 recettes. On refait donc une requête par facette en neutralisant
   * celle qu'on compte — deux requêtes de plus sur 241 recettes, sans conséquence perceptible.
   */
  const comptes: Comptes = useMemo(() => {
    if (etat.phase !== 'pret') return new Map()
    const parFacette = new Map<FacetteKind, ReadonlyMap<string, number>>()
    for (const facette of FACETTES) {
      const sansElle = interroger(etat.socle, sansFacette(filtres.commun, facette))
      parFacette.set(facette, compterValeurs(etat.socle.catalogue, sansElle.recipeIds, facette))
    }
    return parFacette
  }, [etat, filtres.commun, interroger])

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
  const trouvees = resultat?.recipeIds ?? []

  return (
    <section>
      <h1 className="text-[2.1rem] text-texte">Recettes</h1>

      <Recherche
        catalogue={socle.catalogue}
        valeur={filtres.texte}
        onChange={(texte) => setFiltres({ ...filtres, texte })}
      />

      {/* « Bloc d'entrée distinct Vider le frigo » (§4.4) — un chemin différent : on n'y cherche
          pas une recette, on part de ce qu'on a. C'est là que vit la recherche par ALIMENT. */}
      <a
        href={hashDuFrigo()}
        className="mt-3 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.98rem] font-semibold text-accent-texte no-underline"
      >
        Vider le frigo — partir de ce que j'ai
      </a>

      {/* Composer sa propre recette. Bloc d'entrée distinct, comme le frigo : c'est un autre
          chemin — on n'y cherche pas une recette, on en fabrique une. */}
      <a
        href={hashDeLEditeur(null)}
        className="mt-3 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.98rem] font-semibold text-accent-texte no-underline"
      >
        Composer ma propre recette
      </a>

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

      <FiltresRecettes
        catalogue={socle.catalogue}
        filtres={filtres.commun}
        comptes={comptes}
        deplie={deplie}
        onChange={(commun) => setFiltres({ ...filtres, commun })}
        onDeplier={() => setDeplie((d) => !d)}
      />

      {!aucunFiltreEcran(filtres) && (
        <FiltresActifs
          filtres={filtres.commun}
          extra={[
            ...(filtres.texte.trim() === ''
              ? []
              : [{ libelle: `« ${filtres.texte} »`, retirer: () => setFiltres({ ...filtres, texte: '' }) }]),
            ...(filtres.favorisSeuls
              ? [{ libelle: 'Mes favoris', retirer: () => setFiltres({ ...filtres, favorisSeuls: false }) }]
              : []),
          ]}
          onChange={(commun) => setFiltres({ ...filtres, commun })}
          onVider={() => setFiltres(FILTRES_ECRAN)}
        />
      )}

      {/* Entonnoir des écartées (§6.8 ENGINE) — le différenciateur : dire CE QUI a été retiré et
          par quoi, au lieu de laisser croire que le catalogue est petit. */}
      {resultat !== null && resultat.entonnoir.totalRejected > 0 && <Entonnoir resultat={resultat} />}

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
              {/* La CARTE ENTIÈRE ouvre la fiche, pas seulement le titre : viser un mot de 12 px est
                  hors de portée d'une main tremblante. L'étoile reste hors du lien pour rester
                  actionnable seule. */}
              <a href={hashDeRecette(id)} className="flex-1 p-3 no-underline">
                <h2 className="font-titre text-[1.2rem] leading-snug text-texte">
                  {drapeauDe(recette)}
                  {recette.nom}
                </h2>
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

/** Premier drapeau connu parmi les cuisines de la recette, ou rien. */
function drapeauDe(recette: {
  readonly facettes: readonly { readonly facette: string; readonly valeur: string }[]
}) {
  for (const facette of recette.facettes) {
    if (facette.facette !== 'cuisine') continue
    const origine = origineDeCuisine(facette.valeur)
    if (origine.drapeau !== null) {
      return (
        <span aria-hidden="true" className="mr-1">
          {origine.drapeau}
        </span>
      )
    }
  }
  return null
}

/**
 * Champ de recherche avec autocomplétion.
 *
 * ⚠️ `<datalist>` NATIF plutôt qu'une liste maison : déjà accessible au clavier et au lecteur
 * d'écran, correct sur mobile, et il ne capture pas le focus.
 *
 * ⚠️ LES SUGGESTIONS SONT DES PLATS ET DES CUISINES, PAS DES ALIMENTS. Proposer « courgette » ici
 * enverrait vers une liste de plats qui en contiennent, là où « Vider le frigo » répond bien mieux
 * à cette intention. Deux entrées pour la même chose brouilleraient la différence entre les écrans.
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
  const suggestions = useMemo(() => {
    const mots = new Set<string>()
    for (const recette of catalogue.recipes.values()) mots.add(recette.nom)
    for (const { valeur: cuisine } of valeursDeFacette(catalogue, 'cuisine' as FacetteKind)) {
      mots.add(cuisine)
    }
    return [...mots]
  }, [catalogue])

  // Filtrées à la frappe : 267 options dans un `<datalist>` rendent la liste inutilisable sur
  // mobile, où elle s'ouvre en plein écran.
  const proposees = useMemo(() => {
    const cherche = normaliser(valeur.trim())
    if (cherche.length < 2) return []
    return suggestions.filter((mot) => normaliser(mot).includes(cherche)).slice(0, 8)
  }, [suggestions, valeur])

  return (
    <label className="mt-4 block">
      <span className="text-[0.9rem] text-texte-doux">Rechercher un plat</span>
      <input
        type="search"
        list="suggestions-recettes"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="blanquette, tajine, gratin…"
        className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-[1.05rem] text-texte"
      />
      <datalist id="suggestions-recettes">
        {proposees.map((mot) => (
          <option key={mot} value={mot} />
        ))}
      </datalist>
    </label>
  )
}

/**
 * « 241 recettes → allergènes −18 → régime −40 = 183 disponibles » (§4.4, §6.8 ENGINE).
 *
 * ⚠️ NE COMPTE QUE LES EXCLUSIONS DURES. Les recettes écartées par la recherche ou par une pastille
 * n'y figurent pas : l'utilisateur vient de les exclure lui-même, les présenter comme « écartées »
 * rendrait le chiffre incompréhensible.
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
