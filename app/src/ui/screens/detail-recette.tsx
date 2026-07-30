// ui/screens/detail-recette.tsx — fiche d'une recette (§4.6 DESIGN).
//
// « Conçu pour être LU DEBOUT, MAINS OCCUPÉES, PARFOIS DE LOIN — gros caractères, beaucoup d'air. »
// Ce n'est pas une préférence esthétique : c'est le seul écran qu'on consulte en cuisinant, avec
// les doigts pleins et le téléphone posé à un mètre. Les tailles de texte y sont volontairement
// plus grandes qu'ailleurs, et les étapes sont des blocs, pas une liste serrée.
//
// ⚠️ LES VALEURS NUTRITIONNELLES SONT PAR PORTION, REPLIÉES, ET OPT-IN. §6.5 ARCHITECTURE est
// précis sur ce qui est interdit, et ce n'est pas le chiffre : c'est le COMPTEUR DE RESTE
// QUOTIDIEN. « Cette portion : 520 kcal » est explicitement autorisé ; « il te reste 340 kcal
// aujourd'hui », un objectif présenté comme cible et un code couleur rouge/vert ne le sont pas.
// Ne jamais ajouter ici de cumul de la journée, de barre de progression, ni de couleur de jugement.
//
// PÉRIMÈTRE — ce que §4.6 décrit et qui n'est PAS ici : la photo (zéro sur 241 recettes), la
// section « Matériel » (le catalogue n'a AUCUNE table équipement — c'est aussi pourquoi la couche
// `equipement` est inerte depuis P1a), les alternatives d'ingrédients (`suggestAlternatives` exige
// une `SuggestionRequest` complète pour que les substitutions repassent les filtres d'allergènes —
// un lot, pas un bouton), les notes locales, la roue des goûts, et « Ajouter à ma semaine ».

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Catalog,
  LexiconEntry,
  Recipe,
  RecipeId,
  RecipeStep,
} from '../../engine/domain/index.js'
import { readDisplay, readUserState, setFavorite, writeDisplay } from '../../data/user-store.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle } from '../socle.js'
import { hashDe } from '../router.js'

interface Vue {
  readonly recette: Recipe
  readonly catalogue: Catalog
  readonly nomAliment: (id: string) => string
  readonly quantitePour: (portions: number) => ReadonlyMap<string, string>
  readonly favori: boolean
  readonly manquants: ReadonlySet<string>
  readonly afficherMacros: boolean
  readonly energiePortion: number | null
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'introuvable' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

/** Énergie d'UNE portion, ou `null` si le catalogue ne la connaît pas. */
function energieParPortion(catalogue: Catalog, id: RecipeId): number | null {
  const index = catalogue.nutrients.findIndex((n) => n.code === 'energie')
  if (index < 0) return null
  // ⚠️ `recipeNutrients` est DÉJÀ par portion (§6.5 précision 8) — ne pas rediviser par
  // `portionsBase`, ce qui donnerait une valeur quatre fois trop basse sur un plat familial.
  return catalogue.indexes.recipeNutrients.get(id)?.[index] ?? null
}

export function DetailRecette({ recetteId }: { readonly recetteId: string }) {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [portions, setPortions] = useState<number | null>(null)

  const charger = useCallback(() => {
    chargerSocle()
      .then((socle) => {
        const id = recetteId as RecipeId
        const recette = socle.catalogue.recipes.get(id)
        if (recette === undefined) {
          setEtat({ phase: 'introuvable' })
          return
        }
        const utilisateur = readUserState(socle.db, {
          windowDays: FENETRE_HISTORIQUE_JOURS,
          today: aujourdhuiIso(),
        })
        setEtat({
          phase: 'pret',
          vue: {
            recette,
            catalogue: socle.catalogue,
            nomAliment: (foodId) => socle.catalogue.foods.get(foodId as never)?.nom ?? foodId,
            // `scaleRecipe` fait le calcul, jamais l'écran : les arrondis d'achat et les unités
            // d'affichage sont du domaine, et les recopier ici les ferait diverger.
            quantitePour: (n) =>
              new Map(
                socle.moteur
                  .scaleRecipe(id, n)
                  .ingredients.map((i) => [i.foodId as string, i.uniteAffichage])
              ),
            favori: utilisateur.favoriteRecipeIds.has(id),
            manquants: new Set(
              recette.ingredients
                .map((i) => i.foodId as string)
                .filter((foodId) => !utilisateur.pantryFoodIds.includes(foodId as never))
            ),
            afficherMacros: readDisplay(socle.db).afficherMacros,
            energiePortion: energieParPortion(socle.catalogue, id),
          },
        })
        setPortions((actuel) => actuel ?? recette.portionsBase)
      })
      .catch((erreur: unknown) => {
        setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
  }, [recetteId])

  useEffect(charger, [charger])

  const basculerFavori = useCallback(() => {
    if (etat.phase !== 'pret') return
    const suivant = !etat.vue.favori
    chargerSocle()
      .then((socle) => {
        setFavorite(socle.db, recetteId as RecipeId, suivant, aujourdhuiIso())
        charger()
      })
      .catch(() => undefined)
  }, [etat, recetteId, charger])

  const basculerMacros = useCallback(() => {
    if (etat.phase !== 'pret') return
    const suivant = !etat.vue.afficherMacros
    chargerSocle()
      .then((socle) => {
        writeDisplay(socle.db, { afficherMacros: suivant })
        charger()
      })
      .catch(() => undefined)
  }, [etat, charger])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'introuvable') {
    return (
      <section>
        <h1 className="text-[1.9rem] text-texte">Recette introuvable</h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
          Elle a peut-être disparu d'une mise à jour du catalogue.
        </p>
        <a
          href={hashDe('recettes')}
          className="mt-5 inline-flex min-h-cta items-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white no-underline"
        >
          Voir toutes les recettes
        </a>
      </section>
    )
  }
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">La recette n'a pas pu être lue.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat
  const { recette } = vue
  const portionsAffichees = portions ?? recette.portionsBase
  const quantites = vue.quantitePour(portionsAffichees)

  return (
    <article>
      <a
        href={hashDe('recettes')}
        className="inline-flex min-h-tactile items-center text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        ← Toutes les recettes
      </a>

      <header className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-[2.2rem] leading-tight text-texte">{recette.nom}</h1>
        <button
          type="button"
          onClick={basculerFavori}
          aria-pressed={vue.favori}
          aria-label={vue.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={
            'flex min-h-tactile w-14 shrink-0 items-center justify-center text-[1.6rem] ' +
            (vue.favori ? 'text-accent-texte' : 'text-attenue')
          }
        >
          {vue.favori ? '★' : '☆'}
        </button>
      </header>

      <p className="mt-2 text-[1.05rem] leading-relaxed text-texte-doux">{recette.description}</p>
      <p className="mt-3 text-[1rem] text-attenue">
        {recette.tempsPrepMin} min de préparation · {recette.tempsCuissonMin} min de cuisson ·
        difficulté {recette.difficulte}/3
      </p>

      <SelecteurPortions
        portions={portionsAffichees}
        base={recette.portionsBase}
        onChange={setPortions}
      />

      <h2 className="mt-8 text-[1.5rem] text-texte">Ingrédients</h2>
      <ul className="mt-3 space-y-1">
        {recette.ingredients.map((ingredient) => {
          const foodId = ingredient.foodId as string
          return (
            <li key={foodId} className="flex items-baseline gap-2 py-1 text-[1.08rem] text-texte">
              <span className="tabular-nums text-texte-doux">
                {quantites.get(foodId) ?? ingredient.uniteAffichage}
              </span>
              <span>{vue.nomAliment(foodId)}</span>
              {ingredient.optionnel && <span className="text-[0.9rem] text-attenue">(facultatif)</span>}
              {/* « Absents du garde-manger signalés DISCRÈTEMENT » (§4.6) : une mention, pas un
                  avertissement — ne rien avoir chez soi est le cas normal, pas un problème. */}
              {vue.manquants.has(foodId) && (
                <span className="text-[0.85rem] text-attenue">· à acheter</span>
              )}
            </li>
          )
        })}
      </ul>

      <h2 className="mt-8 text-[1.5rem] text-texte">Préparation</h2>
      <ol className="mt-3 space-y-4">
        {recette.etapes.map((etape, index) => (
          <Etape key={index} numero={index + 1} etape={etape} catalogue={vue.catalogue} />
        ))}
      </ol>

      <ValeursNutritionnelles
        affiche={vue.afficherMacros}
        energiePortion={vue.energiePortion}
        onBasculer={basculerMacros}
      />
    </article>
  )
}

/**
 * Sélecteur de portions qui recalcule EN DIRECT (§4.6).
 *
 * ⚠️ Ce n'est pas le même réglage que `convives` de l'écran Semaine ni que `facteurPortion` du
 * profil. Ici on demande « pour combien de personnes je cuisine CE plat, maintenant » — un ajustement
 * ponctuel de lecture, qui n'est pas persisté et n'influence aucune suggestion.
 */
function SelecteurPortions({
  portions,
  base,
  onChange,
}: {
  readonly portions: number
  readonly base: number
  readonly onChange: (portions: number) => void
}) {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-[--radius-carte] border border-bordure bg-surface p-3">
      <span className="text-[1.05rem] text-texte-doux">Pour</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, portions - 1))}
        disabled={portions <= 1}
        aria-label="Une portion de moins"
        className="flex min-h-tactile w-12 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond text-[1.4rem] text-texte disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[3ch] text-center text-[1.5rem] font-semibold tabular-nums text-texte">
        {portions}
      </span>
      <button
        type="button"
        onClick={() => onChange(portions + 1)}
        aria-label="Une portion de plus"
        className="flex min-h-tactile w-12 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond text-[1.4rem] text-texte"
      >
        +
      </button>
      <span className="text-[1.05rem] text-texte-doux">
        portion{portions > 1 ? 's' : ''}
        {portions !== base && <span className="text-attenue"> (recette pour {base})</span>}
      </span>
    </div>
  )
}

/**
 * Une étape, en GROS BLOC NUMÉROTÉ, avec ses gestes techniques ouvrables (§4.6).
 *
 * ⚠️ LE GESTE EST DÉPLIÉ SUR PLACE, pas dans une autre page. Quelqu'un qui a les mains dans la pâte
 * et qui veut savoir ce que « chemiser » veut dire ne doit pas perdre l'étape qu'il est en train de
 * lire. §4.6 prévoit une animation ; il n'y a pour l'instant que du texte (les 62 fiches du lexique
 * sont écrites, les illustrations promises par §8.5 n'existent pas).
 */
function Etape({
  numero,
  etape,
  catalogue,
}: {
  readonly numero: number
  readonly etape: RecipeStep
  readonly catalogue: Catalog
}) {
  const [ouvert, setOuvert] = useState<string | null>(null)

  const gestes = useMemo(
    () =>
      etape.lexiconIds
        .map((id) => catalogue.lexicon.get(id as never))
        .filter((entree): entree is LexiconEntry => entree !== undefined),
    [etape, catalogue]
  )

  return (
    <li className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-doux text-[1.1rem] font-semibold text-accent-texte"
        >
          {numero}
        </span>
        <p className="text-[1.12rem] leading-relaxed text-texte">{etape.texte}</p>
      </div>

      {gestes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          {gestes.map((geste) => (
            <button
              key={geste.id}
              type="button"
              onClick={() => setOuvert(ouvert === geste.id ? null : geste.id)}
              aria-expanded={ouvert === geste.id}
              className="flex min-h-tactile items-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-[0.95rem] font-semibold text-accent-texte underline"
            >
              {geste.terme}
            </button>
          ))}
        </div>
      )}

      {gestes
        .filter((geste) => geste.id === ouvert)
        .map((geste) => (
          <p
            key={geste.id}
            className="mt-3 ml-12 rounded-[--radius-carte] border border-bordure bg-fond p-3 text-[1rem] leading-relaxed text-texte-doux"
          >
            <span className="font-semibold text-texte">{geste.terme}</span> — {geste.definition}
          </p>
        ))}
    </li>
  )
}

/**
 * « Valeurs nutritionnelles », repliée et opt-in (§4.6, §6.5 ARCHITECTURE).
 *
 * ⚠️ CE QUI EST INTERDIT ICI, ET QUI NE DOIT JAMAIS Y REVENIR : un compteur de reste quotidien
 * (« il te reste 340 kcal »), un objectif journalier présenté comme cible, un code couleur
 * rouge/vert, un cumul de la journée mis en avant. §6.5 est explicite : c'est le MÉCANISME de
 * restriction qui est proscrit, pas le chiffre. Une valeur par portion, brute et neutre, est
 * autorisée — et l'apport de référence ne peut être cité qu'EN NOTE, jamais comme un but.
 */
function ValeursNutritionnelles({
  affiche,
  energiePortion,
  onBasculer,
}: {
  readonly affiche: boolean
  readonly energiePortion: number | null
  readonly onBasculer: () => void
}) {
  return (
    <section className="mt-10 border-t border-bordure pt-5">
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={affiche}
        className="flex min-h-tactile w-full items-center justify-between rounded-[0.7rem] px-1 text-left text-[1.05rem] font-semibold text-texte-doux"
      >
        Valeurs nutritionnelles
        <span aria-hidden="true" className="text-attenue">
          {affiche ? '−' : '+'}
        </span>
      </button>

      {affiche && (
        <div className="mt-2 px-1">
          {energiePortion === null ? (
            <p className="text-[1rem] text-attenue">Non renseignées pour cette recette.</p>
          ) : (
            <p className="text-[1.1rem] text-texte">
              Cette portion : <span className="tabular-nums">{Math.round(energiePortion)}</span> kcal
            </p>
          )}
          <p className="mt-2 text-[0.9rem] leading-relaxed text-attenue">
            Une information, pas un objectif. Ce réglage se désactive à tout moment.
          </p>
        </div>
      )}
    </section>
  )
}
