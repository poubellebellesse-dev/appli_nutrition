// ui/screens/frigo.tsx — « Vider le frigo » (§4.5 DESIGN, §10.2 ① ENGINE).
//
// ⚠️ ON CLASSE PAR COUVERTURE, ON NE FILTRE PAS SUR ELLE — nuance depuis le retour utilisateur qui
// a fait ajouter un filtre minimal (voir `searchByPantry`, §10.2). Avec quatre ingrédients
// déclarés, AUCUNE recette n'est intégralement couverte : filtrer sur la couverture rendrait une
// page vide. Mais un garde-manger de condiments seuls, lui, ne doit proposer AUCUNE recette sans
// rapport — `searchByPantry` écarte donc celles sans le moindre ingrédient non optionnel en
// commun ; parmi les autres, les mieux couvertes remontent et on écrit EN CLAIR ce qu'il manque.
// Le réglage « Sans rien acheter » existe pour ceux qui veulent l'inverse — jamais par défaut.
//
// ⚠️ LA COUVERTURE EST PONDÉRÉE PAR LA MASSE, ET L'ÉCRAN DOIT LE DIRE. Avoir le sel et le poivre
// d'un bœuf bourguignon ne couvre rien ; avoir le bœuf couvre l'essentiel. La jauge affiche donc
// cette masse, pas le « 1 sur 5 » écrit à côté — et une barre aux trois quarts en face d'un seul
// ingrédient RESSEMBLE À UN BUG tant que rien ne l'explique. C'était le cas de la première version.
// Le pourcentage est désormais écrit en toutes lettres à côté du compte.
//
// ⚠️ CE N'EST PAS UN ONGLET. §4.5 le veut accessible depuis Aujourd'hui et Recettes ; la barre
// reste à cinq onglets stables (§2 DESIGN).
//
// PÉRIMÈTRE — la substitution suggérée (« le cas échéant », §4.5) n'est pas là :
// `suggestSubstitutions` n'est pas câblée et la table `substitution` est vide par décision 27.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Catalog, FacetteKind, FoodId, RecipeId } from '../../engine/domain/index.js'
import type { Engine, PantryMatch, PantryResult } from '../../engine/api/index.js'
import { chercherParNom, normaliser } from '../../engine/search/index.js'
import { readPantryEntries, readUserState, writePantry } from '../../data/user-store.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle } from '../socle.js'
import { hashDe, hashDeRecette } from '../router.js'
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
import { LienTutoriel } from '../lien-tutoriel.js'
import { BoutonParcourir, ParcoursAliments } from '../parcours-aliments.js'

/** Combien de raccourcis par famille. Au-delà, la grille devient une liste et ne rend plus service. */
const RACCOURCIS_PAR_FAMILLE = 8

/** Facettes filtrables — les mêmes que l'écran Recettes (§4.4). Service et envergure ne sont pas
 *  des facettes, voir l'en-tête de `filtres-recettes.tsx`. */
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

interface Famille {
  readonly groupe: string
  readonly aliments: readonly FoodId[]
}

/**
 * Raccourcis « ajout rapide », RANGÉS PAR FAMILLE — matières grasses, condiments, légumes…
 *
 * ⚠️ DÉRIVÉS DU CATALOGUE, jamais écrits à la main. Une liste figée (« pâtes, fromage, beurre… »)
 * survit à la disparition de ses aliments et propose alors des raccourcis qui ne débloquent rien.
 * Les familles sont les `groupe` du catalogue, ordonnées par usage réel dans les recettes, et
 * chacune ne montre que ses aliments les plus employés.
 *
 * ⚠️ LE FOND DE PLACARD EST INCLUS, contrairement à la première version. L'argument « tout le monde
 * a du sel » vaut pour le sel — pas pour le curcuma, le cumin ou le laurier, qu'on n'a pas
 * forcément et qui changent ce qu'on peut cuisiner. Les écarter rendait les épices inatteignables
 * autrement qu'en tapant leur nom.
 */
function famillesDeRaccourcis(catalogue: Catalog): readonly Famille[] {
  const usage = new Map<FoodId, number>()
  for (const recette of catalogue.recipes.values()) {
    for (const ingredient of recette.ingredients) {
      usage.set(ingredient.foodId, (usage.get(ingredient.foodId) ?? 0) + 1)
    }
  }

  const parGroupe = new Map<string, FoodId[]>()
  for (const aliment of catalogue.foods.values()) {
    if ((usage.get(aliment.id) ?? 0) === 0) continue
    const liste = parGroupe.get(aliment.groupe)
    if (liste === undefined) parGroupe.set(aliment.groupe, [aliment.id])
    else liste.push(aliment.id)
  }

  const total = (ids: readonly FoodId[]) => ids.reduce((n, id) => n + (usage.get(id) ?? 0), 0)
  return [...parGroupe.entries()]
    .map(([groupe, ids]) => ({
      groupe,
      aliments: [...ids]
        .sort((a, b) => (usage.get(b) ?? 0) - (usage.get(a) ?? 0))
        .slice(0, RACCOURCIS_PAR_FAMILLE),
    }))
    .sort((a, b) => total(b.aliments) - total(a.aliments))
}

export function Frigo() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [garde, setGarde] = useState<readonly FoodId[]>([])
  const [saisie, setSaisie] = useState('')
  const [realisablesSeules, setRealisablesSeules] = useState(false)
  const [filtres, setFiltres] = useState<FiltresRecette>(FILTRES_VIDES)

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
      // ⚠️ LA DATE EST INJECTÉE, jamais `Date.now()` — et elle sert : un garde-manger non daté ne
      // peut pas se faire questionner quand il vieillit (`ui/confirmer-frigo.tsx`, migration v8).
      //
      // ⚠️ CHAQUE ALIMENT GARDE SA PROPRE DATE, ET C'EST UN BUG DÉJÀ PAYÉ. `writePantry` réécrit la
      // table ENTIÈRE à chaque ajout et à chaque retrait : dater tout le monde d'aujourd'hui faisait
      // qu'ajouter du riz ce matin certifiait fraîche une crème déclarée il y a trois semaines. Un
      // geste qui ne la concernait pas la blanchissait, et la question ne se posait plus jamais —
      // c'est-à-dire que la migration v8 ne servait à rien dès le deuxième aliment.
      .then((s) => {
        const connues = new Map(readPantryEntries(s.db).map((e) => [e.foodId, e.declareLe]))
        writePantry(
          s.db,
          suivant.map((foodId) => {
            const date = connues.get(foodId)
            return { foodId, quantiteApprox: null, ...(date === undefined ? {} : { declareLe: date }) }
          }),
          aujourdhuiIso()
        )
      })
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

  /** Une requête frigo, à partir d'un jeu de filtres donné — les MÊMES que l'écran Recettes. */
  const interroger = useCallback(
    (socle: Socle, actifs: FiltresRecette): PantryResult =>
      socle.moteur.searchByPantry({
        constraints: socle.contraintes,
        pantryFoodIds: garde,
        seulementRealisables: realisablesSeules,
        facettes: facettesDe(actifs),
        tempsMaxMin: actifs.tempsMaxMin,
        services: actifs.services,
        envergures: actifs.envergures,
      }),
    [garde, realisablesSeules]
  )

  const resultats = useMemo(() => {
    if (etat.phase !== 'pret' || garde.length === 0) return null
    return interroger(etat.socle, filtres)
  }, [etat, garde, filtres, interroger])

  /** Comptes dynamiques, chaque facette calculée SANS sa propre sélection — voir l'écran Recettes. */
  const comptes: Comptes = useMemo(() => {
    if (etat.phase !== 'pret' || garde.length === 0) return COMPTES_VIDES
    const parFacette = new Map<FacetteKind, ReadonlyMap<string, number>>()
    for (const facette of FACETTES) {
      const sansElle = interroger(etat.socle, sansFacette(filtres, facette))
      parFacette.set(
        facette,
        compterValeurs(
          etat.socle.catalogue,
          sansElle.matches.map((m) => m.recipeId),
          facette
        )
      )
    }
    const sansServiceR = interroger(etat.socle, sansService(filtres))
    const sansEnvergureR = interroger(etat.socle, sansEnvergure(filtres))
    return {
      facettes: parFacette,
      services: compterService(etat.socle.catalogue, sansServiceR.matches.map((m) => m.recipeId)),
      envergures: compterEnvergure(etat.socle.catalogue, sansEnvergureR.matches.map((m) => m.recipeId)),
    }
  }, [etat, garde, filtres, interroger])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-lecture font-semibold text-texte">Le catalogue n'a pas pu être lu.</p>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { socle } = etat
  const nomDe = (id: FoodId) => socle.catalogue.foods.get(id)?.nom ?? String(id)
  const familles = famillesDeRaccourcis(socle.catalogue)

  return (
    <section>
      <a
        href={hashDe('recettes')}
        className="inline-flex min-h-tactile items-center text-courant font-semibold text-accent-texte no-underline"
      >
        ← Recettes
      </a>

      <h1 data-visite="titre-frigo" className="mt-2 text-titre-l leading-tight text-texte">
        Qu'avez-vous sous la main ?
      </h1>
      <LienTutoriel parcoursId="frigo" />
      <p className="mt-2 text-lecture leading-relaxed text-texte-doux">
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
          <h2 className="text-courant text-texte-doux">Chez vous · {garde.length}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {garde.map((foodId) => (
              <li key={foodId}>
                <button
                  type="button"
                  onClick={() => retirer(foodId)}
                  aria-label={`Retirer ${nomDe(foodId)}`}
                  className="flex min-h-tactile items-center gap-2 rounded-full border-2 border-accent bg-accent-doux px-4 text-courant font-semibold text-accent-texte"
                >
                  {nomDe(foodId)}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AjoutRapide familles={familles} deja={garde} nomDe={nomDe} onAjouter={ajouter} />

      {resultats === null ? (
        <p className="mt-8 text-lecture leading-relaxed text-attenue">
          Ajoutez au moins un aliment pour voir ce que vous pouvez cuisiner.
        </p>
      ) : (
        <>
          <fieldset data-visite="sans-rien-acheter" className="mt-8">
            <legend className="sr-only">Étendue des résultats</legend>
            <div className="flex gap-2">
              <Bascule
                libelle="Tout montrer"
                actif={!realisablesSeules}
                onChoisir={() => setRealisablesSeules(false)}
              />
              <Bascule
                libelle="Sans rien acheter"
                actif={realisablesSeules}
                onChoisir={() => setRealisablesSeules(true)}
              />
            </div>
          </fieldset>

          <FiltresRecettes
            catalogue={socle.catalogue}
            filtres={filtres}
            comptes={comptes}
            onChange={setFiltres}
          />

          {!aucunFiltre(filtres) && (
            <FiltresActifs
              filtres={filtres}
              onChange={setFiltres}
              onVider={() => setFiltres(FILTRES_VIDES)}
            />
          )}

          {/* ⚠️ DIRE QUE LA LISTE EST COUPÉE. Annoncer « 241 recettes » puis n'en afficher que 30
              sans un mot ressemble à un bug d'affichage — c'était le cas. La liste est classée par
              couverture : au-delà des premières, la couverture devient dérisoire, mais c'est à
              l'écran de le dire, pas à l'utilisateur de le deviner. */}
          <p className="mt-4 text-courant text-attenue">
            {resultats.matches.length} recette{resultats.matches.length > 1 ? 's' : ''}
            {resultats.matches.length > RESULTATS_AFFICHES && (
              <> — les {RESULTATS_AFFICHES} mieux couvertes sont affichées</>
            )}
            {/* ⚠️ « Aucune recette » PEUT ARRIVER MAINTENANT même en « Tout montrer », depuis que
                `searchByPantry` écarte les recettes sans ingrédient commun (§10.2) — un
                garde-manger de condiments seuls n'a plus rien à proposer. Une liste vide muette
                laisserait croire à un bug ; le message dit quoi faire. */}
            {resultats.matches.length === 0 && (
              <>
                {' — '}
                {realisablesSeules
                  ? <>rien n'est réalisable en l'état. Essayez « Tout montrer ».</>
                  : <>aucune recette ne correspond à ce que vous avez. Ajoutez un autre aliment.</>}
              </>
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
 *
 * ⚠️ L'APPARIEMENT VIT DANS LE MOTEUR (`chercherParNom`), PAS ICI. C'était une sous-chaîne écrite sur
 * place, et elle rendait une liste VIDE dès que la saisie était plus longue que le nom éditorial —
 * « noix de saint-jacques » ne trouvait pas « Coquille Saint-Jacques », pourtant au catalogue.
 * Sur cet écran une liste vide se lit « cet aliment n'existe pas » (décision 58).
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
  const [parcours, setParcours] = useState(false)

  const propositions = useMemo(() => {
    if (normaliser(valeur.trim()).length < 2) return []
    const candidats = [...catalogue.foods.values()].filter((aliment) => !deja.includes(aliment.id))
    return chercherParNom(candidats, valeur, 6)
  }, [catalogue, valeur, deja])

  return (
    <div className="mt-5">
      <label className="block">
        <span className="text-courant text-texte-doux">Ajouter un aliment</span>
        <input
          type="search"
          data-visite="ajout-aliment"
          value={valeur}
          onChange={(e) => onSaisir(e.target.value)}
          placeholder="courgette, œufs, riz…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-lecture text-texte"
        />
      </label>
      {propositions.length > 0 && (
        <ul className="mt-1 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
          {propositions.map((aliment) => (
            <li key={aliment.id}>
              <button
                type="button"
                onClick={() => onChoisir(aliment.id)}
                className="flex min-h-tactile w-full items-center px-3 text-left text-lecture text-texte"
              >
                {aliment.nom}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ VISIBLE EN PERMANENCE, pas seulement quand la recherche échoue. Ne l'afficher qu'en cas
          d'échec supposerait qu'on sache reconnaître un échec — or le pire cas mesuré n'est PAS la
          liste vide, c'est la liste qui rend un faux ami en premier (cause 4, décision 58). */}
      <BoutonParcourir onOuvrir={() => setParcours(true)} />
      {parcours && (
        <ParcoursAliments
          foods={catalogue.foods}
          deja={deja}
          onChoisir={(aliment) => {
            onChoisir(aliment.id)
            setParcours(false)
          }}
          onFermer={() => setParcours(false)}
        />
      )}
    </div>
  )
}

/**
 * « Ajout rapide », rangé par famille.
 *
 * ⚠️ DES ONGLETS ET NON UNE GRILLE UNIQUE. Une grille des huit aliments les plus fréquents ne
 * contient que des légumes et des bases : les huiles, les épices et la crèmerie n'y apparaissent
 * jamais, alors que ce sont précisément les choses qu'on a « au fond du placard » et qu'on ne
 * pense pas à taper. Les familles sont les `groupe` du catalogue, dans l'ordre de leur usage réel.
 */
function AjoutRapide({
  familles,
  deja,
  nomDe,
  onAjouter,
}: {
  readonly familles: readonly Famille[]
  readonly deja: readonly FoodId[]
  readonly nomDe: (id: FoodId) => string
  readonly onAjouter: (id: FoodId) => void
}) {
  const [ouverte, setOuverte] = useState(0)
  const famille = familles[ouverte]
  if (famille === undefined) return null

  const proposes = famille.aliments.filter((id) => !deja.includes(id))

  return (
    <div data-visite="ajout-rapide" className="mt-5">
      <h2 className="text-courant text-texte-doux">Ajout rapide</h2>

      {/* Défilement horizontal : quatorze familles ne tiennent pas sur la largeur d'un téléphone,
          et les replier derrière un menu contredirait « navigation permanente et visible ». */}
      <div className="mt-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {familles.map((f, index) => (
          <button
            key={f.groupe}
            type="button"
            onClick={() => setOuverte(index)}
            aria-pressed={index === ouverte}
            className={
              'flex min-h-tactile shrink-0 items-center rounded-[0.7rem] px-3 text-courant font-semibold ' +
              (index === ouverte
                ? 'border-2 border-accent bg-accent-doux text-accent-texte'
                : 'border border-bordure-forte bg-surface text-texte-doux')
            }
          >
            {f.groupe}
          </button>
        ))}
      </div>

      {proposes.length === 0 ? (
        <p className="mt-2 text-courant text-attenue">Vous avez déjà tout de cette famille.</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {proposes.map((foodId) => (
            <button
              key={foodId}
              type="button"
              onClick={() => onAjouter(foodId)}
              className="flex min-h-tactile items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-2 text-center text-courant font-semibold text-texte-doux"
            >
              {nomDe(foodId)}
            </button>
          ))}
        </div>
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
        'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-3 text-center text-courant font-semibold leading-tight ' +
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
      <h3 className="font-titre text-titre-s leading-snug">
        <a href={hashDeRecette(match.recipeId, 'frigo')} className="text-texte no-underline">
          {recette.nom}
        </a>
      </h3>

      {/* ⚠️ LE POURCENTAGE EST ÉCRIT, pas seulement dessiné. La jauge mesure la MASSE, pas le
          nombre : un seul ingrédient sur cinq peut représenter les trois quarts du plat si c'est la
          pièce de viande. Sans cette phrase, la barre aux trois quarts en face d'un « 1 sur 5 »
          passe pour un bug — c'est le retour d'usage qui a motivé ce texte. */}
      <p className="mt-2 text-courant text-texte-doux">
        {presents} ingrédient{presents > 1 ? 's' : ''} sur {requis} déjà chez vous — soit {pourcent} %
        du poids du plat
      </p>

      {/* ⚠️ La jauge affiche la couverture EN MASSE, pas le « x sur y » ci-dessus : les deux
          diffèrent, et c'est voulu. Le compte parle à l'utilisateur, la masse ordonne la liste.
          Couleur ACCENT et non verte comme la maquette : le thème n'a qu'une couleur d'accent, et
          un vert « ça va » réinstallerait un code couleur de jugement (§5 DESIGN). */}
      <div
        role="img"
        aria-label={`${pourcent} % du poids du plat`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-bordure"
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pourcent}%` }} />
      </div>

      {match.manquants.length > 0 && (
        // « Écrit en clair » (§4.5) : afficher ce qui manque est la contrepartie directe du choix
        // « score et non filtre » — une recette couverte à 80 % reste proposable À CONDITION que
        // l'utilisateur voie ce qu'il doit acheter.
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">
          Il vous manque : {match.manquants.map(nomDe).join(', ')}
        </p>
      )}
    </li>
  )
}
