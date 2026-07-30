// ui/screens/frigo.tsx — « Vider le frigo » (§4.5 DESIGN, §10.2 ① ENGINE).
//
// ⚠️ ON CLASSE, ON NE FILTRE PAS, et c'est la décision qui structure tout l'écran. Avec quatre
// ingrédients déclarés, AUCUNE recette n'est intégralement couverte : filtrer rendrait une page
// vide, et l'utilisateur conclurait que la fonction ne marche pas. Les mieux couvertes remontent,
// les autres restent atteignables, et on écrit EN CLAIR ce qu'il manque. Le réglage « Réalisables
// maintenant » existe pour ceux qui veulent l'inverse — jamais par défaut.
//
// ⚠️ LA COUVERTURE EST PONDÉRÉE PAR LA MASSE. Avoir le sel et le poivre d'un bœuf bourguignon ne
// couvre rien ; avoir le bœuf couvre l'essentiel. La jauge affiche donc cette masse, pas le
// « 6 sur 8 » écrit à côté — les deux disent des choses différentes et c'est voulu : le compte
// parle à l'utilisateur, la masse ordonne la liste.
//
// ⚠️ CE N'EST PAS UN ONGLET. §4.5 le veut accessible depuis Aujourd'hui et Recettes ; la barre
// reste à cinq onglets stables (§2 DESIGN).
//
// PÉRIMÈTRE — la substitution suggérée (« le cas échéant », §4.5) n'est pas là :
// `suggestSubstitutions` n'est pas câblée et la table `substitution` est vide par décision 27.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Catalog, FoodId, RecipeId } from '../../engine/domain/index.js'
import type { Engine, PantryMatch } from '../../engine/api/index.js'
import { normaliser } from '../../engine/search/index.js'
import { readUserState, writePantry } from '../../data/user-store.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle } from '../socle.js'
import { hashDe, hashDeRecette } from '../router.js'

/** Combien de raccourcis proposer. Au-delà, la grille devient une liste et ne rend plus service. */
const NOMBRE_RACCOURCIS = 8

/** Combien de résultats afficher. La liste est classée : au-delà, la couverture devient dérisoire. */
const RESULTATS_AFFICHES = 30

interface Socle {
  readonly catalogue: Catalog
  readonly moteur: Engine
  readonly contraintes: ReturnType<typeof readUserState>['constraints']
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly socle: Socle }
  | { readonly phase: 'erreur'; readonly message: string }

/**
 * Raccourcis « ajout rapide » — les aliments les plus PRÉSENTS dans les recettes.
 *
 * ⚠️ DÉRIVÉS DU CATALOGUE, jamais écrits à la main. Une liste figée (« pâtes, fromage, beurre… »)
 * survit à la disparition de ses aliments et propose alors des raccourcis qui ne débloquent rien.
 * Le fond de placard est écarté : déclarer qu'on a du sel n'apprend rien au moteur, tout le monde
 * en a.
 */
function raccourcis(catalogue: Catalog): readonly FoodId[] {
  const compte = new Map<FoodId, number>()
  for (const recette of catalogue.recipes.values()) {
    for (const ingredient of recette.ingredients) {
      if (catalogue.foods.get(ingredient.foodId)?.fondDePlacard === true) continue
      compte.set(ingredient.foodId, (compte.get(ingredient.foodId) ?? 0) + 1)
    }
  }
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, NOMBRE_RACCOURCIS)
    .map(([id]) => id)
}

export function Frigo() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [garde, setGarde] = useState<readonly FoodId[]>([])
  const [saisie, setSaisie] = useState('')
  const [realisablesSeules, setRealisablesSeules] = useState(false)

  useEffect(() => {
    let annule = false
    chargerSocle()
      .then((s) => {
        if (annule) return
        const utilisateur = readUserState(s.db, {
          windowDays: FENETRE_HISTORIQUE_JOURS,
          today: aujourdhuiIso(),
        })
        setEtat({
          phase: 'pret',
          socle: { catalogue: s.catalogue, moteur: s.moteur, contraintes: utilisateur.constraints },
        })
        setGarde(utilisateur.pantryFoodIds)
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        }
      })
    return () => {
      annule = true
    }
  }, [])

  /** Le garde-manger est PERSISTÉ : on le retrouve au prochain lancement (table `user_pantry`). */
  const enregistrer = useCallback((suivant: readonly FoodId[]) => {
    setGarde(suivant)
    chargerSocle()
      .then((s) => writePantry(s.db, suivant.map((foodId) => ({ foodId, quantiteApprox: null }))))
      .catch(() => undefined)
  }, [])

  const ajouter = useCallback(
    (foodId: FoodId) => {
      if (garde.includes(foodId)) return
      enregistrer([...garde, foodId])
      setSaisie('')
    },
    [garde, enregistrer]
  )

  const retirer = useCallback(
    (foodId: FoodId) => enregistrer(garde.filter((id) => id !== foodId)),
    [garde, enregistrer]
  )

  const resultats = useMemo(() => {
    if (etat.phase !== 'pret' || garde.length === 0) return null
    return etat.socle.moteur.searchByPantry({
      constraints: etat.socle.contraintes,
      pantryFoodIds: garde,
      seulementRealisables: realisablesSeules,
    })
  }, [etat, garde, realisablesSeules])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">Le catalogue n'a pas pu être lu.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { socle } = etat
  const nomDe = (id: FoodId) => socle.catalogue.foods.get(id)?.nom ?? String(id)
  const suggestionsRapides = raccourcis(socle.catalogue).filter((id) => !garde.includes(id))

  return (
    <section>
      <a
        href={hashDe('recettes')}
        className="inline-flex min-h-tactile items-center text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        ← Recettes
      </a>

      <h1 className="mt-2 text-[2rem] leading-tight text-texte">Qu'avez-vous sous la main ?</h1>
      <p className="mt-2 text-[1.05rem] leading-relaxed text-texte-doux">
        Ajoutez ce qu'il vous reste. On cherche des plats à faire avec.
      </p>

      <Recherche
        catalogue={socle.catalogue}
        valeur={saisie}
        deja={garde}
        onSaisir={setSaisie}
        onChoisir={ajouter}
      />

      {garde.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[0.95rem] text-texte-doux">Chez vous · {garde.length}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {garde.map((foodId) => (
              <li key={foodId}>
                <button
                  type="button"
                  onClick={() => retirer(foodId)}
                  aria-label={`Retirer ${nomDe(foodId)}`}
                  className="flex min-h-tactile items-center gap-2 rounded-full border-2 border-accent bg-accent-doux px-4 text-[0.95rem] font-semibold text-accent-texte"
                >
                  {nomDe(foodId)}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestionsRapides.length > 0 && (
        <div className="mt-5">
          <h2 className="text-[0.95rem] text-texte-doux">Ajout rapide</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {suggestionsRapides.map((foodId) => (
              <button
                key={foodId}
                type="button"
                onClick={() => ajouter(foodId)}
                className="flex min-h-tactile items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-2 text-center text-[0.92rem] font-semibold text-texte-doux"
              >
                {nomDe(foodId)}
              </button>
            ))}
          </div>
        </div>
      )}

      {resultats === null ? (
        <p className="mt-8 text-[1.05rem] leading-relaxed text-attenue">
          Ajoutez au moins un aliment pour voir ce que vous pouvez cuisiner.
        </p>
      ) : (
        <>
          <fieldset className="mt-8">
            <legend className="sr-only">Étendue des résultats</legend>
            <div className="flex gap-2">
              <Bascule
                libelle="Tout montrer"
                actif={!realisablesSeules}
                onChoisir={() => setRealisablesSeules(false)}
              />
              <Bascule
                libelle="Réalisables maintenant"
                actif={realisablesSeules}
                onChoisir={() => setRealisablesSeules(true)}
              />
            </div>
          </fieldset>

          <p className="mt-4 text-[0.95rem] text-attenue">
            {resultats.matches.length} recette{resultats.matches.length > 1 ? 's' : ''}
            {realisablesSeules && resultats.matches.length === 0 && (
              <> — rien n'est réalisable en l'état. Essayez « Tout montrer ».</>
            )}
          </p>

          <ul className="mt-3 space-y-3">
            {resultats.matches.slice(0, RESULTATS_AFFICHES).map((match) => (
              <Resultat
                key={match.recipeId}
                match={match}
                catalogue={socle.catalogue}
                nomDe={nomDe}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/**
 * Champ de recherche d'aliment.
 *
 * ⚠️ Liste maison plutôt que `<datalist>`, à la différence de l'écran Recettes : ici il faut
 * récupérer le `FoodId` choisi, pas un texte. Un `<datalist>` ne rend que la chaîne saisie, et
 * retrouver l'aliment par son nom réintroduirait une correspondance approximative là où on a déjà
 * l'identifiant.
 */
function Recherche({
  catalogue,
  valeur,
  deja,
  onSaisir,
  onChoisir,
}: {
  readonly catalogue: Catalog
  readonly valeur: string
  readonly deja: readonly FoodId[]
  readonly onSaisir: (texte: string) => void
  readonly onChoisir: (foodId: FoodId) => void
}) {
  const propositions = useMemo(() => {
    const cherche = normaliser(valeur.trim())
    if (cherche.length < 2) return []
    return [...catalogue.foods.values()]
      .filter((aliment) => !deja.includes(aliment.id) && normaliser(aliment.nom).includes(cherche))
      .slice(0, 6)
  }, [catalogue, valeur, deja])

  return (
    <div className="mt-5">
      <label className="block">
        <span className="text-[0.9rem] text-texte-doux">Ajouter un aliment</span>
        <input
          type="search"
          value={valeur}
          onChange={(e) => onSaisir(e.target.value)}
          placeholder="courgette, œufs, riz…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-[1.05rem] text-texte"
        />
      </label>
      {propositions.length > 0 && (
        <ul className="mt-1 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
          {propositions.map((aliment) => (
            <li key={aliment.id}>
              <button
                type="button"
                onClick={() => onChoisir(aliment.id)}
                className="flex min-h-tactile w-full items-center px-3 text-left text-[1rem] text-texte"
              >
                {aliment.nom}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Bascule({
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
        'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-3 text-center text-[0.95rem] font-semibold leading-tight ' +
        (actif
          ? 'border-2 border-accent bg-accent-doux text-accent-texte'
          : 'border border-bordure-forte bg-surface text-texte-doux')
      }
    >
      {libelle}
    </button>
  )
}

function Resultat({
  match,
  catalogue,
  nomDe,
}: {
  readonly match: PantryMatch
  readonly catalogue: Catalog
  readonly nomDe: (id: FoodId) => string
}) {
  const recette = catalogue.recipes.get(match.recipeId as RecipeId)
  if (recette === undefined) return null

  const requis = recette.ingredients.filter((i) => !i.optionnel).length
  const presents = requis - match.manquants.length
  const pourcent = Math.round(match.couverture * 100)

  return (
    <li className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
      <h3 className="font-titre text-[1.2rem] leading-snug">
        <a href={hashDeRecette(match.recipeId)} className="text-texte no-underline">
          {recette.nom}
        </a>
      </h3>

      <p className="mt-2 text-[0.95rem] text-texte-doux">
        {presents} ingrédient{presents > 1 ? 's' : ''} sur {requis} déjà chez vous
      </p>

      {/* ⚠️ La jauge affiche la couverture EN MASSE, pas le « x sur y » ci-dessus : les deux
          diffèrent, et c'est voulu. Le compte parle à l'utilisateur, la masse ordonne la liste.
          Couleur ACCENT et non verte comme la maquette : le thème n'a qu'une couleur d'accent, et
          un vert « ça va » réinstallerait un code couleur de jugement (§5 DESIGN). */}
      <div
        role="img"
        aria-label={`Couverture ${pourcent} %`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-bordure"
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pourcent}%` }} />
      </div>

      {match.manquants.length > 0 && (
        // « Écrit en clair » (§4.5) : afficher ce qui manque est la contrepartie directe du choix
        // « score et non filtre » — une recette couverte à 80 % reste proposable À CONDITION que
        // l'utilisateur voie ce qu'il doit acheter.
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">
          Il vous manque : {match.manquants.map(nomDe).join(', ')}
        </p>
      )}
    </li>
  )
}
