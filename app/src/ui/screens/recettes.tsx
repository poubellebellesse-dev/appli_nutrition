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
// ⚠️ LE CHAMP S'ANNONCE « RECHERCHER UN PLAT OU UN INGRÉDIENT » — DÉCISION RENVERSÉE LE 2026-08-02.
// Il s'annonçait « Rechercher un plat », et ce fichier soutenait que c'était volontaire : chercher
// par aliment, c'était « Vider le frigo », qui le fait mieux (il classe par couverture et dit ce qui
// manque), et annoncer les deux ici ferait deux fonctions qui se marchent dessus.
//
// Ce que l'essai sur téléphone a démenti : un filtre « aliments voulus » a été RÉCLAMÉ alors que la
// capacité existait déjà ici. L'argument d'origine confond deux intentions distinctes — « j'AI du
// poulet » est un inventaire, que le frigo classe par couverture ; « je VEUX du poulet » est une
// envie, et la traiter comme un garde-manger d'un seul aliment n'a pas de sens. Ce ne sont pas deux
// fonctions qui se marchent dessus, ce sont deux besoins.
//
// Le vrai défaut était pire qu'une omission : le libellé disait « un plat » et donnait « blanquette,
// tajine, gratin » en exemple — trois noms de plats. L'affordance ne TAISAIT pas la capacité, elle
// la CONTREDISAIT. Un test verrouille désormais le libellé (`recettes.test.tsx`), sans quoi une
// reformulation la recacherait en silence.
//
// ✅ « POURQUOI PAS CE PLAT ? » EST LÀ DEPUIS LE 2026-08-10 (`PourquoiPasCePlat`, bas de fichier) —
// cette ligne l'annonçait comme manquant. L'entonnoir disait déjà COMBIEN de recettes une contrainte
// dure avait retirées ; il ne disait pas LESQUELLES, et c'est la seule forme de la question qu'un
// utilisateur se pose vraiment : « je cherche ce plat, il n'est pas là, pourquoi ». Le bloc ne
// s'affiche donc QUE sur une recherche en cours.
//
// PÉRIMÈTRE — ce que §4.4 décrit et qui n'est PAS ici : la catégorie « Loufoque », qui n'a AUCUNE
// recette au catalogue — six styles seulement, du contenu à écrire, pas du code à ajouter.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Catalog,
  ExclusionLayerId,
  FacetteKind,
  Recipe,
  RecipeId,
  RejectionSummary,
} from '../../engine/domain/index.js'
import { normaliser, valeursDeFacette } from '../../engine/search/index.js'
import type { BrowseResult, Engine } from '../../engine/api/index.js'
import {
  COMPTES_VIDES,
  FACETTES,
  FILTRES_VIDES,
  FiltresActifs,
  FiltresRecettes,
  aucunFiltre,
  compterEnvergure,
  compterService,
  compterValeurs,
  facettesDe,
  sansEnvergure,
  sansFacette,
  sansService,
  type Comptes,
  type FiltresRecette,
} from '../filtres-recettes.js'
import { readUserState, setFavorite } from '../../data/user-store.js'
import { nouvelIdRecette, readUserRecipes, saveUserRecipe, type StoredUserRecipe } from '../../data/user-recipe.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle, rebatirCatalogue } from '../socle.js'
import { hashDeLEditeur, hashDeRecette, hashDuFrigo } from '../router.js'
import { origineDeCuisine } from '../drapeaux.js'
import { Panneau } from '../panneau.js'
import { MesureMontage, mesureDemandee } from '../mesure-montage.js'
import { exporterRecette } from '../export-recette.js'
import { importerRecette } from '../import-recette.js'
import { LienTutoriel } from '../lien-tutoriel.js'

const LIBELLE_COUCHE: Readonly<Record<ExclusionLayerId, string>> = {
  allergenes: 'allergènes',
  regime: 'régime',
  exclusions: 'vos exclusions',
  requis: 'aliment exigé',
  temps: 'temps',
  equipement: 'équipement',
  favoris: 'favoris',
}

/** Les quatre facettes filtrables — celles qu'il faut compter dynamiquement. Service et envergure
 *  ne sont PAS des facettes (`recette.service`/`recette.envergure`, champs directs) : ils ont leur
 *  propre comptage, voir `compterService`/`compterEnvergure`. */
/** Ce que cet écran ajoute aux filtres communs à « Recettes » et « Vider le frigo ». */
interface Filtres {
  readonly commun: FiltresRecette
  readonly texte: string
  readonly favorisSeuls: boolean
  /** Exclusif avec `favorisSeuls` — voir le bouton, plus bas : tous deux désignent un point de
   *  DÉPART dans le catalogue, pas un critère, et deux départs ne s'empilent pas. */
  readonly saucesSeules: boolean
}

const FILTRES_ECRAN: Filtres = { commun: FILTRES_VIDES, texte: '', favorisSeuls: false, saucesSeules: false }

function aucunFiltreEcran(f: Filtres): boolean {
  return aucunFiltre(f.commun) && f.texte.trim() === '' && !f.favorisSeuls && !f.saucesSeules
}

interface Socle {
  readonly catalogue: Catalog
  readonly moteur: Engine
  readonly favoris: ReadonlySet<RecipeId>
  readonly contraintes: ReturnType<typeof readUserState>['constraints']
  /** Les recettes composées par l'utilisateur, forme stockée — nécessaire pour l'export (§8.7), que
   *  le `Recipe` fusionné dans `catalogue` ne porte plus (voir `versRecette`). */
  readonly recettesPerso: readonly StoredUserRecipe[]
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly socle: Socle }
  | { readonly phase: 'erreur'; readonly message: string }

export function Recettes() {
  // Instant du PREMIER rendu, pour la décision 61 — capté ici parce que `MesureMontage` n'est monté
  // qu'une fois l'écran prêt et serait donc incapable de voir le début. `useState` avec initialiseur
  // paresseux : évaluée une seule fois, jamais à chaque rendu. Voir `ui/mesure-montage.tsx`.
  const [debutMontage] = useState(() => performance.now())
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_ECRAN)
  const [panneauMesRecettesOuvert, setPanneauMesRecettesOuvert] = useState(false)

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
            recettesPerso: readUserRecipes(s.db),
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
        services: commun.services,
        envergures: commun.envergures,
        favoriteRecipeIds: socle.favoris,
        onlyFavorites: filtres.favorisSeuls,
        saucesSeules: filtres.saucesSeules,
      }),
    [filtres.texte, filtres.favorisSeuls, filtres.saucesSeules]
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
    if (etat.phase !== 'pret') return COMPTES_VIDES
    const parFacette = new Map<FacetteKind, ReadonlyMap<string, number>>()
    for (const facette of FACETTES) {
      const sansElle = interroger(etat.socle, sansFacette(filtres.commun, facette))
      parFacette.set(facette, compterValeurs(etat.socle.catalogue, sansElle.recipeIds, facette))
    }
    const sansServiceR = interroger(etat.socle, sansService(filtres.commun))
    const sansEnvergureR = interroger(etat.socle, sansEnvergure(filtres.commun))
    return {
      facettes: parFacette,
      services: compterService(etat.socle.catalogue, sansServiceR.recipeIds),
      envergures: compterEnvergure(etat.socle.catalogue, sansEnvergureR.recipeIds),
    }
  }, [etat, filtres.commun, interroger])

  /** Combien de sauces porte le catalogue. Annoncé DANS le libellé du bouton, avant d'y entrer :
   *  ailleurs sur cet écran un compte se lit après coup, mais ici la liste est vide par défaut et
   *  un bouton qui ouvre le vide ne se distingue pas d'un bouton cassé. */
  const nombreDeSauces = useMemo(() => {
    if (etat.phase !== 'pret') return 0
    let n = 0
    for (const recette of etat.socle.catalogue.recipes.values()) if (recette.estSauce) n += 1
    return n
  }, [etat])

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
  // Décision 61 : instant de DÉPART de CETTE passe de rendu, pour mesurer une reconstruction de la
  // liste (changement de filtre) séparément du montage, qui paie en plus le chargement du catalogue.
  // ⚠️ Derrière `mesureDemandee()` : sans le drapeau, l'écran ne lit même pas l'horloge.
  const debutRendu = mesureDemandee() ? performance.now() : 0

  return (
    <section>
      <h1 data-visite="titre-recettes" className="text-[2.1rem] text-texte">
        Recettes
      </h1>
      <LienTutoriel parcoursId="recettes" />

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

      {/* Retrouver ce qu'on a composé soi-même — pas un dépliant (§4.4/panneau.tsx) : garder la
          liste, potentiellement longue, hors du flux de l'écran. */}
      <button
        type="button"
        onClick={() => setPanneauMesRecettesOuvert(true)}
        aria-haspopup="dialog"
        className="mt-3 flex min-h-tactile w-full items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.98rem] font-semibold text-accent-texte"
      >
        Mes recettes ({socle.recettesPerso.length})
      </button>

      {panneauMesRecettesOuvert && (
        <Panneau titre="Mes recettes" onFermer={() => setPanneauMesRecettesOuvert(false)}>
          <ImporterRecette catalogue={socle.catalogue} onImportee={rafraichir} />
          <PanneauMesRecettes catalogue={socle.catalogue} recettesPerso={socle.recettesPerso} />
        </Panneau>
      )}

      {/* « Mes favoris » en tête, à UN TAP (§4.4). */}
      <button
        type="button"
        data-visite="favoris"
        onClick={() => setFiltres({ ...filtres, favorisSeuls: !filtres.favorisSeuls, saucesSeules: false })}
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

      {/* Les sauces sont l'AUTRE MOITIÉ du catalogue, pas une facette de celui-ci : `browseRecipes`
          les retire toujours de la liste ordinaire (`recettesHorsSauces`). Sans ce bouton, une
          sauce ne s'atteint que depuis la fiche d'un plat qui la cite — et celle que personne ne
          cite ne s'atteint nulle part. Le même geste qu'un favori, donc le même bouton : c'est un
          point de départ, et deux départs ne s'empilent pas — chacun éteint l'autre. */}
      <button
        type="button"
        onClick={() => setFiltres({ ...filtres, saucesSeules: !filtres.saucesSeules, favorisSeuls: false })}
        aria-pressed={filtres.saucesSeules}
        className={
          'mt-3 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-4 text-[1rem] font-semibold ' +
          (filtres.saucesSeules
            ? 'border-2 border-accent bg-accent-doux text-accent-texte'
            : 'border border-bordure-forte bg-surface text-texte-doux')
        }
      >
        Sauces ({nombreDeSauces})
      </button>

      <FiltresRecettes
        catalogue={socle.catalogue}
        filtres={filtres.commun}
        comptes={comptes}
        onChange={(commun) => setFiltres({ ...filtres, commun })}
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
            ...(filtres.saucesSeules
              ? [{ libelle: 'Sauces', retirer: () => setFiltres({ ...filtres, saucesSeules: false }) }]
              : []),
          ]}
          onChange={(commun) => setFiltres({ ...filtres, commun })}
          onVider={() => setFiltres(FILTRES_ECRAN)}
        />
      )}

      {/* Entonnoir des écartées (§6.8 ENGINE) — le différenciateur : dire CE QUI a été retiré et
          par quoi, au lieu de laisser croire que le catalogue est petit. */}
      {resultat !== null && resultat.entonnoir.totalRejected > 0 && <Entonnoir resultat={resultat} />}

      {/* « Pourquoi pas ce plat ? » (§4.4) — l'entonnoir dit COMBIEN, celui-ci dit LEQUEL. */}
      {resultat !== null && (
        <PourquoiPasCePlat
          entonnoir={resultat.entonnoir}
          texte={filtres.texte}
          catalogue={socle.catalogue}
        />
      )}

      <p className="mt-5 text-[0.95rem] text-attenue">
        {trouvees.length} recette{trouvees.length > 1 ? 's' : ''}
        {trouvees.length === 0 && ' — essayez de retirer un filtre.'}
      </p>

      {/* Décision 61 : n'apparaît QUE derrière `?perf` dans `location.search`. Rend `null` sinon. */}
      <MesureMontage depuis={debutMontage} depuisRendu={debutRendu} nbCartes={trouvees.length} />

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
                <ContenuCarteRecette recette={recette} />
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

/**
 * Le rendu d'une ligne de recette — nom, description, temps, portions — partagé entre la liste
 * principale et la fenêtre « Mes recettes ». Deux implémentations divergeraient au premier ajout de
 * champ, exactement le raisonnement qui vaut pour `filtres-recettes.tsx` (voir son en-tête).
 */
function ContenuCarteRecette({ recette }: { readonly recette: Recipe }) {
  return (
    <>
      <h2 className="font-titre text-[1.2rem] leading-snug text-texte">
        {drapeauDe(recette)}
        {recette.nom}
      </h2>
      <p className="mt-1 text-[0.92rem] leading-relaxed text-texte-doux">{recette.description}</p>
      <p className="mt-1 text-[0.85rem] text-attenue">
        {recette.tempsPrepMin + recette.tempsCuissonMin} min · {recette.portionsBase} portions
      </p>
    </>
  )
}

/**
 * Contenu de la fenêtre « Mes recettes ».
 *
 * ⚠️ SANS RECETTE PERSO, PAS DE LISTE VIDE MUETTE : le message dit ce qui manque et propose le
 * chemin pour le combler (`#/composer`), même raisonnement que « 0 recette — essayez de retirer un
 * filtre » plus haut dans cet écran.
 */
function PanneauMesRecettes({
  catalogue,
  recettesPerso,
}: {
  readonly catalogue: Catalog
  readonly recettesPerso: readonly StoredUserRecipe[]
}) {
  if (recettesPerso.length === 0) {
    return (
      <p className="text-[0.95rem] leading-relaxed text-texte-doux">
        Vous n'avez pas encore composé de recette.{' '}
        <a href={hashDeLEditeur(null)} className="font-semibold text-accent-texte underline">
          Composer ma première recette
        </a>
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {recettesPerso.map((stockee) => {
        const recette = catalogue.recipes.get(stockee.id as RecipeId)
        if (recette === undefined) return null
        return (
          <li
            key={stockee.id}
            className="flex items-stretch rounded-[--radius-carte] border border-bordure bg-surface"
          >
            <a href={hashDeRecette(stockee.id)} className="flex-1 p-3 no-underline">
              <ContenuCarteRecette recette={recette} />
            </a>
            <BoutonExporter recette={stockee} />
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Export d'UNE recette perso à la fois (§8.7 : « Une recette à la fois »). Voir `export-recette.ts`
 * pour le partage/repli — ce bouton ne fait que déclencher, silencieusement, dans les deux cas.
 */
function BoutonExporter({ recette }: { readonly recette: StoredUserRecipe }) {
  return (
    <button
      type="button"
      onClick={() => void exporterRecette(recette)}
      aria-label={`Exporter ${recette.nom}`}
      className="flex min-h-tactile w-14 items-center justify-center text-[1.2rem] text-attenue"
    >
      <span aria-hidden="true">⬇</span>
    </button>
  )
}

/**
 * Import d'un fichier `.nutri-recipe` (§8.7 : « un autre l'importe → rendu comme dans l'appli »),
 * à côté de l'export dans la même fenêtre.
 *
 * ⚠️ AUCUNE REQUÊTE RÉSEAU : `<input type="file">` + lecture locale (`File.text()`), rien d'autre —
 * c'est la promesse n°2 du produit (§2 ARCHITECTURE, « zéro donnée qui sort »).
 *
 * ⚠️ REFUS EXPLIQUÉ, PAS UN CODE D'ERREUR. `importerRecette` rend une raison en français ; ce
 * composant se contente de l'afficher — la traduire une seconde fois ici la ferait diverger.
 */
function ImporterRecette({
  catalogue,
  onImportee,
}: {
  readonly catalogue: Catalog
  readonly onImportee: () => void
}) {
  const [etat, setEtat] = useState<{ readonly type: 'erreur' | 'succes'; readonly message: string } | null>(null)

  const surFichier = useCallback(
    (fichier: File) => {
      fichier
        .text()
        .then((contenu) => {
          const id = nouvelIdRecette(Date.now(), Math.random())
          const resultat = importerRecette(contenu, catalogue, id)
          if (!resultat.ok) {
            setEtat({ type: 'erreur', message: resultat.raison })
            return
          }
          chargerSocle()
            .then((s) => {
              saveUserRecipe(s.db, resultat.recette, aujourdhuiIso())
              return rebatirCatalogue()
            })
            .then(() => {
              setEtat({ type: 'succes', message: `« ${resultat.recette.nom} » a été importée.` })
              onImportee()
            })
            .catch(() => setEtat({ type: 'erreur', message: "La recette n'a pas pu être enregistrée." }))
        })
        .catch(() => setEtat({ type: 'erreur', message: 'Ce fichier n’a pas pu être lu.' }))
    },
    [catalogue, onImportee]
  )

  return (
    <div className="mb-4">
      <label className="flex min-h-tactile w-full cursor-pointer items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.98rem] font-semibold text-accent-texte">
        Importer une recette (.nutri-recipe)
        <input
          type="file"
          accept=".nutri-recipe,application/json"
          aria-label="Importer une recette (.nutri-recipe)"
          className="sr-only"
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            e.target.value = ''
            if (fichier !== undefined) surFichier(fichier)
          }}
        />
      </label>
      {etat !== null && (
        <p
          role={etat.type === 'erreur' ? 'alert' : undefined}
          className={
            'mt-2 text-[0.9rem] leading-relaxed ' +
            (etat.type === 'erreur' ? 'text-texte' : 'text-texte-doux')
          }
        >
          {etat.message}
        </p>
      )}
    </div>
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
      {/* ⚠️ « ou un ingrédient » n'est PAS un ornement : `texteIndexe` cherche depuis toujours dans
          le nom des ingrédients, et le libellé disait « un plat » avec trois noms de plats en
          exemple. L'affordance ne taisait pas la capacité, elle la CONTREDISAIT — personne n'avait
          de raison d'y taper « poulet ». Repéré à l'essai du 2026-08-02, où le filtre « aliments
          voulus » a été demandé alors qu'il existait déjà sous cette forme. */}
      <span className="text-[0.9rem] text-texte-doux">Rechercher un plat ou un ingrédient</span>
      <input
        type="search"
        data-visite="recherche-recettes"
        list="suggestions-recettes"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder="blanquette, poulet, gratin…"
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

/** Au-delà, la liste cesse d'être une réponse et devient un mur. Ce qui dépasse est COMPTÉ, jamais
 *  tu : un « et 12 autres » dit qu'on n'a pas tout montré, une troncature muette ment. */
const ECARTEES_MONTREES = 6

/**
 * « Pourquoi pas ce plat ? » (§4.4) — l'entonnoir dit COMBIEN ont été écartées, celui-ci dit
 * LESQUELLES, quand ce sont justement celles qu'on cherchait.
 *
 * ⚠️ SEULEMENT SUR UNE RECHERCHE EN COURS, et c'est ce qui rend le bloc lisible. Sans texte saisi,
 * la question « pourquoi pas ce plat » n'a pas de sujet : dérouler les 58 écartées d'un catalogue
 * répondrait à une question que personne n'a posée, et l'entonnoir donne déjà les comptes. La
 * question ne se pose que quand quelqu'un cherche un plat précis et ne le voit pas revenir.
 *
 * ⚠️ CORRESPONDANCE SUR LE NOM SEUL, alors que `browseRecipes` cherche aussi dans les ingrédients.
 * L'écart est voulu : celui qui tape « poulet » et lit « Tarte aux pommes — écartée » ne comprend
 * pas, la tarte contenant du beurre issu d'un lait qu'il a exclu. Ici on répond à « je cherchais CE
 * plat », pas à « montre-moi tout ce que ma saisie effleure ».
 *
 * ⚠️ LE MOTIF VIENT DU MOTEUR, mot pour mot (`RejectionEntry.reason`). Le réécrire à l'écran ferait
 * une seconde formulation à tenir à jour, qui divergerait le jour où une couche change de critère —
 * et c'est la couche qui sait pourquoi elle a écarté, pas l'écran. Corollaire assumé : un régime y
 * apparaît sous son identifiant (« vegetalien »), sans accent.
 *
 * ⛔ AUCUN SCORE, ICI MOINS QU'AILLEURS. Ces plats ont été écartés par une contrainte DURE, pas mal
 * notés — afficher un nombre à côté ferait exactement lire l'inverse.
 */
function PourquoiPasCePlat({
  entonnoir,
  texte,
  catalogue,
}: {
  readonly entonnoir: RejectionSummary
  readonly texte: string
  readonly catalogue: Catalog
}) {
  const recherche = normaliser(texte.trim())
  if (recherche.length === 0) return null

  // Une entrée par recette — `RejectionEntry` retient déjà le PREMIER motif rencontré, mais passer
  // par une table rend la clé React sûre sans avoir à en dépendre.
  const parRecette = new Map<RecipeId, { readonly id: RecipeId; readonly nom: string; readonly motif: string }>()
  for (const entree of entonnoir.entries) {
    if (parRecette.has(entree.recipeId)) continue
    const nom = catalogue.recipes.get(entree.recipeId)?.nom
    if (nom === undefined || !normaliser(nom).includes(recherche)) continue
    parRecette.set(entree.recipeId, { id: entree.recipeId, nom, motif: entree.reason })
  }

  // Trié par nom : deux passages sur la même recherche donnent la même liste dans le même ordre.
  const ecartees = [...parRecette.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  if (ecartees.length === 0) return null

  const montrees = ecartees.slice(0, ECARTEES_MONTREES)
  const restantes = ecartees.length - montrees.length

  return (
    <div className="mt-3 rounded-[--radius-carte] border border-bordure bg-surface p-3">
      <p className="text-[0.9rem] font-semibold text-texte">
        Écartée{ecartees.length > 1 ? 's' : ''} de vos résultats
      </p>
      <ul className="mt-2 space-y-2">
        {montrees.map((ecartee) => (
          <li key={ecartee.id} className="text-[0.9rem] leading-relaxed">
            <span className="text-texte">{ecartee.nom}</span>
            <span className="block text-texte-doux">{ecartee.motif}</span>
          </li>
        ))}
      </ul>
      {restantes > 0 && (
        <p className="mt-2 text-[0.9rem] text-attenue">
          et <span className="tabular-nums">{restantes}</span> autre{restantes > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  )
}
