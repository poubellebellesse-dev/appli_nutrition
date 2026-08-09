// ui/screens/editeur-recette.tsx — composer sa propre recette, de zéro ou en adaptant une existante.
//
// ⚠️ AUCUNE VALEUR NUTRITIONNELLE N'EST DEMANDÉE, et c'est ce qui rend l'écran acceptable. La règle
// du projet — « les valeurs nutritionnelles ne s'écrivent JAMAIS à la main » — tient parce qu'une
// recette utilisateur est une LISTE D'ALIMENTS DU CATALOGUE : les nutriments s'en déduisent par
// CIQUAL, exactement comme pour une recette livrée. Ne jamais ajouter ici un champ « calories ».
//
// ⚠️ LE RÉGIME N'EST PAS DEMANDÉ NON PLUS. Il est dérivé des ingrédients (`regimeExigeParIngredients`).
// Le demander laisserait quelqu'un étiqueter « végétarien » un plat au poisson — et cette étiquette
// pilote un filtre de sécurité.
//
// DEUX MODES, une seule mécanique :
//   - VARIANTE : tout ce qui ne se dérive pas (axes sensoriels, conservation, envergure, créneaux)
//     est HÉRITÉ de la recette de base. On ne redemande rien de tout ça à quelqu'un qui change deux
//     ingrédients.
//   - CRÉATION : ces mêmes champs sont demandés, parce qu'ils ne peuvent être ni dérivés ni devinés
//     sans fausser le scoring en silence. Voir l'en-tête de `data/user-recipe.ts`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Catalog, FoodId, MealSlot, RecipeEnvergure, SensoryAxes } from '../../engine/domain/index.js'
import { chercherParNom, normaliser } from '../../engine/search/index.js'
import {
  AXES_PAR_DEFAUT,
  construireRecette,
  estRecettePerso,
  mettreAJourRecette,
  nouvelIdRecette,
  problemes,
  readUserRecipe,
  saisieDepuisStockee,
  saveUserRecipe,
  variantePartantDe,
  type IngredientSaisi,
  type SaisieRecette,
  type StoredUserRecipe,
} from '../../data/user-recipe.js'
import { LIBELLE_CRENEAU, aujourdhuiIso, chargerSocle, rebatirCatalogue } from '../socle.js'
import { hashDe, hashDeRecette } from '../router.js'
import { LienTutoriel } from '../lien-tutoriel.js'
import { BoutonParcourir, ParcoursAliments } from '../parcours-aliments.js'

const SAISIE_VIDE: SaisieRecette = {
  nom: '',
  tempsPrepMin: 15,
  tempsCuissonMin: 15,
  portionsBase: 2,
  difficulte: 1,
  typesRepas: ['diner'],
  envergure: 'quotidien',
  // Deux jours : assez pour qu'un reste soit placé, assez court pour ne pas proposer de manger
  // trois jours plus tard un plat dont on ne sait rien. En cas d'ignorance, on ne présume pas.
  conservationJours: 2,
  axes: AXES_PAR_DEFAUT,
  ingredients: [],
  etapes: [''],
  estSauce: false,
}

const CRENEAUX: readonly MealSlot[] = ['petit_dejeuner', 'dejeuner', 'gouter', 'diner']

const ENVERGURES: readonly { readonly valeur: RecipeEnvergure; readonly libelle: string }[] = [
  { valeur: 'quotidien', libelle: 'De tous les jours' },
  { valeur: 'convivial', libelle: 'Pour recevoir' },
  { valeur: 'fete', libelle: 'De fête' },
]

const CONSERVATIONS: readonly { readonly jours: number; readonly libelle: string }[] = [
  { jours: 0, libelle: 'Le jour même' },
  { jours: 2, libelle: '2 jours' },
  { jours: 3, libelle: '3 jours' },
  { jours: 4, libelle: '4 jours' },
]

/**
 * Les trois axes sensoriels, avec les MÊMES MOTS que l'encart « Dites-moi ce que vous cherchez ».
 * Deux formulations différentes pour la même échelle feraient répondre à côté.
 */
const AXES: readonly {
  readonly cle: 'legerConsistant' | 'chaudFroid' | 'sucreSale'
  readonly question: string
  readonly bas: string
  readonly haut: string
}[] = [
  { cle: 'legerConsistant', question: 'Plutôt léger ou consistant ?', bas: 'Léger', haut: 'Consistant' },
  { cle: 'chaudFroid', question: 'Se mange chaud ou froid ?', bas: 'Froid', haut: 'Chaud' },
  { cle: 'sucreSale', question: 'Salé ou sucré ?', bas: 'Salé', haut: 'Sucré' },
]

type Etat =
  | { readonly phase: 'chargement' }
  | {
      readonly phase: 'pret'
      readonly catalogue: Catalog
      readonly variante: boolean
      /** Recette perso rouverte pour MODIFICATION — non nulle ⇒ on réenregistre sous ce même id. */
      readonly edition: StoredUserRecipe | null
    }
  | { readonly phase: 'erreur'; readonly message: string }

export function EditeurRecette({ baseId }: { readonly baseId: string | null }) {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [saisie, setSaisie] = useState<SaisieRecette>(SAISIE_VIDE)
  const [recherche, setRecherche] = useState('')
  const [enregistre, setEnregistre] = useState<string | null>(null)
  /**
   * La question « un plat ou une sauce ? » a-t-elle été tranchée (④).
   *
   * ⚠️ AVANT LE FORMULAIRE, JAMAIS AU MILIEU. Elle décide de ce que le formulaire DEMANDE — une
   * sauce n'a pas de créneau de repas — et une question qui retire un bloc déjà rempli fait perdre
   * une réponse sans le dire. Elle ne se pose donc qu'à la CRÉATION DE ZÉRO : une variante hérite de
   * la nature de sa base, une recette rouverte porte la sienne, et les deux la reposeraient pour
   * rien.
   */
  const [naturePosee, setNaturePosee] = useState(false)

  useEffect(() => {
    let annule = false
    chargerSocle()
      .then((socle) => {
        if (annule) return
        // ⚠️ `baseId` a DEUX SENS, distingués par son préfixe (voir l'en-tête) : un id `perso:…`
        // désigne une recette à MODIFIER — on la relit en base, jamais dans le catalogue, où une
        // recette perso n'existe jamais. Un id du catalogue désigne une recette à ADAPTER.
        if (baseId !== null && estRecettePerso(baseId)) {
          const stockee = readUserRecipe(socle.db, baseId)
          setSaisie(stockee === null ? SAISIE_VIDE : saisieDepuisStockee(stockee))
          // Une recette rouverte porte déjà sa nature — la redemander laisserait croire qu'on peut
          // la changer, alors que le formulaire est déjà celui de cette nature-là.
          setNaturePosee(stockee !== null)
          setEtat({
            phase: 'pret',
            catalogue: socle.catalogue,
            variante: stockee?.source === 'variante',
            edition: stockee,
          })
          return
        }
        // ⚠️ La base est cherchée dans le catalogue SOURCE : on adapte une recette livrée, et
        // adapter une adaptation empilerait des héritages dont plus personne ne suit la trace.
        const base = baseId === null ? undefined : socle.catalogueSource.recipes.get(baseId as never)
        setSaisie(base === undefined ? SAISIE_VIDE : variantePartantDe(base))
        // La variante d'une sauce est une sauce : `variantePartantDe` l'a déjà tranché.
        setNaturePosee(base !== undefined)
        setEtat({ phase: 'pret', catalogue: socle.catalogue, variante: base !== undefined, edition: null })
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        }
      })
    return () => {
      annule = true
    }
  }, [baseId])

  const maj = useCallback((partiel: Partial<SaisieRecette>) => {
    setSaisie((s) => ({ ...s, ...partiel }))
  }, [])

  const enregistrer = useCallback(() => {
    chargerSocle()
      .then(async (socle) => {
        // ⚠️ L'ID SE CHOISIT ICI, et c'est lui qui distingue « modifier » d'« adapter » (voir
        // l'en-tête) : `edition` non nulle ⇒ on réenregistre SOUS LE MÊME ID, source et
        // `baseRecipeId` d'origine préservés par `mettreAJourRecette`. Sinon, nouvel id.
        const edition = etat.phase === 'pret' ? etat.edition : null
        const recette =
          edition !== null
            ? mettreAJourRecette(edition, saisie)
            : construireRecette(
                nouvelIdRecette(Date.now(), Math.random()),
                saisie,
                baseId === null ? null : (socle.catalogueSource.recipes.get(baseId as never) ?? null)
              )
        saveUserRecipe(socle.db, recette, aujourdhuiIso())
        // ⚠️ RECONSTRUIRE LE SOCLE, sinon la recette existe en base et le moteur l'ignore : ses
        // index sont calculés à la construction du catalogue (voir `avecRecettesSupplementaires`).
        await rebatirCatalogue()
        setEnregistre(recette.id)
      })
      .catch((erreur: unknown) => {
        setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
  }, [baseId, saisie, etat])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">La recette n'a pas pu être enregistrée.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  if (enregistre !== null) {
    return (
      <section>
        <h1 className="text-[2.1rem] text-texte">C'est enregistré</h1>
        {/* ⚠️ DEUX PHRASES, PARCE QU'UNE SAUCE NE SE PLANIFIE PAS. Promettre « planifiée dans votre
            semaine » à une sauce serait annoncer quelque chose qui n'arrivera jamais : elle n'a
            aucun créneau, et le planificateur ne la verra pas. */}
        <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
          {saisie.estSauce
            ? `« ${saisie.nom.trim()} » fait maintenant partie de vos sauces. Elle sera proposée avec vos plats, et entrera dans vos courses chaque fois que vous la retiendrez avec l’un d’eux.`
            : `« ${saisie.nom.trim()} » fait maintenant partie de vos recettes. Elle peut être proposée, planifiée dans votre semaine et entrer dans vos courses, comme les autres.`}
        </p>
        <a
          href={hashDeRecette(enregistre, 'recettes')}
          className="mt-5 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white no-underline"
        >
          Voir ma recette
        </a>
        <a
          href={hashDe('recettes')}
          className="mt-3 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-4 text-[0.95rem] font-semibold text-texte-doux no-underline"
        >
          Retour aux recettes
        </a>
      </section>
    )
  }

  const { catalogue, variante, edition } = etat

  if (!naturePosee) {
    return (
      <QuestionNature
        onRepondre={(estSauce) => {
          // ⚠️ `typesRepas: []` EN MÊME TEMPS, dans le même `maj`. `SAISIE_VIDE` propose « dîner » ;
          // le laisser en place enregistrerait une sauce servie au dîner, que le bloc « À quel
          // moment ? » ne montre même pas pour une sauce. Une valeur invisible et fausse est pire
          // qu'une valeur absente.
          maj(estSauce ? { estSauce: true, typesRepas: [] } : { estSauce: false })
          setNaturePosee(true)
        }}
      />
    )
  }

  const bloquants = problemes(saisie)

  return (
    <section>
      <h1 data-visite="titre-composer" className="text-[2.1rem] text-texte">
        {edition !== null
          ? 'Modifier ma recette'
          : variante
            ? 'Adapter la recette'
            : saisie.estSauce
              ? 'Ma sauce'
              : 'Ma recette'}
      </h1>
      <LienTutoriel parcoursId="composer" />
      <p className="mt-2 text-[0.95rem] leading-relaxed text-attenue">
        {variante
          ? 'Changez ce que vous voulez. Le reste — texture, conservation, moment du repas — est repris de la recette d’origine.'
          : 'Les valeurs nutritionnelles se calculent toutes seules à partir des ingrédients. Il n’y a rien à saisir de ce côté.'}
      </p>

      <Champ libelle={saisie.estSauce ? 'Nom de la sauce' : 'Nom du plat'}>
        <input
          type="text"
          data-visite="nom-du-plat"
          value={saisie.nom}
          onChange={(e) => maj({ nom: e.target.value })}
          placeholder="Gratin de courgettes de ma mère"
          className="min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-[1.05rem] text-texte"
        />
      </Champ>

      <Ingredients
        catalogue={catalogue}
        ingredients={saisie.ingredients}
        recherche={recherche}
        onRecherche={setRecherche}
        onChange={(ingredients) => maj({ ingredients })}
      />

      <Etapes etapes={saisie.etapes} onChange={(etapes) => maj({ etapes })} />

      <h2 className="mt-8 font-titre text-[1.4rem] text-texte">Quelques repères</h2>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Nombre
          libelle="Préparation (min)"
          valeur={saisie.tempsPrepMin}
          onChange={(tempsPrepMin) => maj({ tempsPrepMin })}
        />
        <Nombre
          libelle="Cuisson (min)"
          valeur={saisie.tempsCuissonMin}
          onChange={(tempsCuissonMin) => maj({ tempsCuissonMin })}
        />
        <Nombre
          libelle="Pour combien de portions"
          valeur={saisie.portionsBase}
          onChange={(portionsBase) => maj({ portionsBase })}
        />
      </div>

      {/* ⚠️ TOUT CE BLOC EST MASQUÉ POUR UNE VARIANTE. Il est hérité, et redemander la texture d'un
          plat qu'on n'a fait que modifier est le meilleur moyen d'obtenir une réponse au hasard. */}
      {!variante && (
        <>
          {/* ⛔ PAS DE CRÉNEAU POUR UNE SAUCE. Les trois du catalogue portent `types_repas: []` et
              la décision 62 en fait la forme normale : une sauce accompagne un plat, elle ne se
              sert pas à une heure. Le bloc est retiré plutôt que laissé vide — et `problemes()`
              lève l'exigence en parallèle, sinon le bouton « Enregistrer » resterait bloqué sur un
              message auquel plus aucun champ à l'écran ne permet de répondre. */}
          {!saisie.estSauce && (
          <Groupe titre="À quel moment ?">
            <div className="flex flex-wrap gap-2">
              {CRENEAUX.map((creneau) => (
                <Pastille
                  key={creneau}
                  libelle={LIBELLE_CRENEAU[creneau]}
                  active={saisie.typesRepas.includes(creneau)}
                  onBasculer={() =>
                    maj({
                      typesRepas: saisie.typesRepas.includes(creneau)
                        ? saisie.typesRepas.filter((c) => c !== creneau)
                        : [...saisie.typesRepas, creneau],
                    })
                  }
                />
              ))}
            </div>
          </Groupe>
          )}

          <Groupe titre="Quel genre de plat ?">
            <div className="flex flex-wrap gap-2">
              {ENVERGURES.map((e) => (
                <Pastille
                  key={e.valeur}
                  libelle={e.libelle}
                  active={saisie.envergure === e.valeur}
                  onBasculer={() => maj({ envergure: e.valeur })}
                />
              ))}
            </div>
          </Groupe>

          <Groupe titre="Combien de temps se garde-t-il ?">
            <div className="flex flex-wrap gap-2">
              {CONSERVATIONS.map((c) => (
                <Pastille
                  key={c.jours}
                  libelle={c.libelle}
                  active={saisie.conservationJours === c.jours}
                  onBasculer={() => maj({ conservationJours: c.jours })}
                />
              ))}
            </div>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-attenue">
              Sert à placer les restes dans votre semaine. Dans le doute, restez court.
            </p>
          </Groupe>

          {AXES.map((axe) => (
            <Groupe key={axe.cle} titre={axe.question}>
              <div className="flex flex-wrap gap-2">
                <Pastille
                  libelle={axe.bas}
                  active={saisie.axes[axe.cle] === -1}
                  onBasculer={() => maj({ axes: { ...saisie.axes, [axe.cle]: -1 } satisfies SensoryAxes })}
                />
                <Pastille
                  libelle={axe.haut}
                  active={saisie.axes[axe.cle] === 1}
                  onBasculer={() => maj({ axes: { ...saisie.axes, [axe.cle]: 1 } satisfies SensoryAxes })}
                />
              </div>
            </Groupe>
          ))}
        </>
      )}

      {bloquants.length > 0 && (
        <ul className="mt-6 space-y-1 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[0.95rem] leading-relaxed text-alerte-texte">
          {bloquants.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        data-visite="enregistrer-recette"
        onClick={enregistrer}
        disabled={bloquants.length > 0}
        className="mt-6 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1.05rem] font-semibold text-white disabled:opacity-40"
      >
        {saisie.estSauce ? 'Enregistrer ma sauce' : 'Enregistrer ma recette'}
      </button>
    </section>
  )
}

// --- « Un plat ou une sauce ? » (④) ---------------------------------------------------------------

/**
 * La question posée AVANT le formulaire, pour une création de zéro.
 *
 * ⚠️ CE N'EST PAS UN CHAMP DU FORMULAIRE, ET LE PLACEMENT EST TOUTE LA DIFFÉRENCE. La réponse décide
 * de ce que le formulaire demande — une sauce n'a pas de créneau de repas. Posée au milieu, elle
 * ferait disparaître un bloc déjà rempli, donc perdre une réponse sans le dire.
 *
 * ⚠️ AUCUN DÉFAUT PRÉSÉLECTIONNÉ, aucun `aria-pressed` : deux chemins, pas une bascule. Un « plat »
 * préenfoncé ferait passer la question pour un réglage facultatif, et l'écran suivant ne serait pas
 * celui qu'on croit avoir demandé.
 */
function QuestionNature({ onRepondre }: { readonly onRepondre: (estSauce: boolean) => void }) {
  return (
    <section>
      {/* ⚠️ `data-visite="titre-composer"` AUSSI ICI, ET CE N'EST PAS UN DOUBLON : c'est l'ANCRE
          INCONDITIONNELLE du parcours « composer » (règle 1 de `parcours.ts` — la première étape
          d'un parcours doit résoudre sur un écran neuf, sans quoi le tutoriel est fantôme). Cet
          écran-ci EST désormais l'état neuf de #/composer ; sans l'ancre, le tutoriel ne s'ouvrait
          plus du tout, et rien d'autre que `parcours.test.tsx` ne le disait. Les étapes suivantes
          (« nom-du-plat », « ajout-ingredient ») se sautent tant que la question n'est pas
          tranchée — comportement prévu et documenté, pas un accident. */}
      <h1 data-visite="titre-composer" className="text-[2.1rem] text-texte">
        Qu'est-ce que vous composez ?
      </h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        Une sauce se prépare à côté et se sert avec un plat. Elle n'a pas de moment de repas à elle,
        et c'est la seule différence : tout le reste se saisit pareil.
      </p>

      <button
        type="button"
        onClick={() => onRepondre(false)}
        className="mt-6 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1.05rem] font-semibold text-white"
      >
        Un plat
      </button>
      <button
        type="button"
        onClick={() => onRepondre(true)}
        className="mt-3 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-surface px-5 text-[1.05rem] font-semibold text-accent-texte"
      >
        Une sauce
      </button>
    </section>
  )
}

// --- Ingrédients ------------------------------------------------------------------------------

function Ingredients({
  catalogue,
  ingredients,
  recherche,
  onRecherche,
  onChange,
}: {
  readonly catalogue: Catalog
  readonly ingredients: readonly IngredientSaisi[]
  readonly recherche: string
  readonly onRecherche: (texte: string) => void
  readonly onChange: (ingredients: readonly IngredientSaisi[]) => void
}) {
  const deja = ingredients.map((i) => i.foodId)

  // ⚠️ MÊME APPARIEMENT QU'AILLEURS (`chercherParNom`), et surtout pas une sous-chaîne réécrite ici.
  // C'était le cas, et une saisie plus longue que le nom éditorial rendait une liste VIDE — voir
  // `frigo.tsx` et la décision 58. Trois écrans interrogent le même catalogue d'aliments ; les trois
  // doivent y répondre pareil, sinon « on l'a trouvé sur l'autre écran » devient un défaut.
  const propositions = useMemo(() => {
    if (normaliser(recherche.trim()).length < 2) return []
    const candidats = [...catalogue.foods.values()].filter((a) => !deja.includes(a.id))
    return chercherParNom(candidats, recherche, 6)
  }, [catalogue, recherche, deja])

  const nomDe = (foodId: string) => catalogue.foods.get(foodId as FoodId)?.nom ?? foodId

  const [parcours, setParcours] = useState(false)

  // Un seul chemin d'ajout pour les deux entrées — la recherche et le parcours. Les dupliquer ferait
  // diverger la quantité par défaut, et l'écart ne se verrait qu'à l'usage.
  const ajouter = (foodId: FoodId) => {
    onChange([
      ...ingredients,
      // `uniteAffichage` reprend la quantité en grammes : c'est un texte FIGÉ que le moteur ne met
      // jamais à l'échelle (`ui/quantites.ts`). Écrire « 1 pièce » ici afficherait la même chose
      // pour 2 personnes que pour 6.
      { foodId, quantiteG: 100, uniteAffichage: '100 g', optionnel: false },
    ])
    onRecherche('')
  }

  return (
    <>
      <h2 className="mt-8 font-titre text-[1.4rem] text-texte">Ingrédients</h2>

      {ingredients.length > 0 && (
        <ul className="mt-3 space-y-2">
          {ingredients.map((ingredient, index) => (
            <li
              key={ingredient.foodId}
              className="rounded-[--radius-carte] border border-bordure bg-surface p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[1rem] text-texte">{nomDe(ingredient.foodId)}</span>
                <button
                  type="button"
                  onClick={() => onChange(ingredients.filter((_, i) => i !== index))}
                  aria-label={`Retirer ${nomDe(ingredient.foodId)}`}
                  className="flex min-h-tactile w-12 shrink-0 items-center justify-center rounded-[0.6rem] text-[1.2rem] text-texte-doux"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <span className="text-[0.9rem] text-texte-doux">Quantité (g)</span>
                  <input
                    type="number"
                    min={1}
                    value={ingredient.quantiteG}
                    onChange={(e) =>
                      onChange(
                        ingredients.map((i, idx) =>
                          idx === index ? { ...i, quantiteG: Number(e.target.value) } : i
                        )
                      )
                    }
                    className="min-h-tactile w-24 rounded-[0.6rem] border border-bordure-forte bg-fond px-2 text-[1rem] text-texte"
                  />
                </label>
                <PetiteBascule
                  libelle="Facultatif"
                  active={ingredient.optionnel}
                  onBasculer={() =>
                    onChange(
                      ingredients.map((i, idx) =>
                        idx === index ? { ...i, optionnel: !i.optionnel } : i
                      )
                    )
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Liste maison plutôt que `<datalist>`, même raison que l'écran frigo : il faut récupérer le
          `FoodId` choisi, pas un texte. Retrouver l'aliment par son nom réintroduirait une
          correspondance approximative là où on a déjà l'identifiant. */}
      <label className="mt-3 block">
        <span className="text-[0.9rem] text-texte-doux">Ajouter un ingrédient</span>
        <input
          type="search"
          data-visite="ajout-ingredient"
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
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
                onClick={() => ajouter(aliment.id)}
                className="flex min-h-tactile w-full items-center px-3 text-left text-[1rem] text-texte"
              >
                {aliment.nom}
              </button>
            </li>
          ))}
        </ul>
      )}

      <BoutonParcourir onOuvrir={() => setParcours(true)} />
      {parcours && (
        <ParcoursAliments
          foods={catalogue.foods}
          deja={deja}
          onChoisir={(aliment) => {
            ajouter(aliment.id)
            setParcours(false)
          }}
          onFermer={() => setParcours(false)}
        />
      )}
    </>
  )
}

// --- Étapes -------------------------------------------------------------------------------------

function Etapes({
  etapes,
  onChange,
}: {
  readonly etapes: readonly string[]
  readonly onChange: (etapes: readonly string[]) => void
}) {
  return (
    <>
      <h2 className="mt-8 font-titre text-[1.4rem] text-texte">Étapes</h2>
      <ol className="mt-3 space-y-2">
        {etapes.map((etape, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-[0.95rem] tabular-nums text-attenue">{index + 1}.</span>
            <textarea
              value={etape}
              rows={2}
              onChange={(e) => onChange(etapes.map((v, i) => (i === index ? e.target.value : v)))}
              placeholder="Faire revenir les oignons à feu doux."
              className="min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface p-3 text-[1rem] leading-relaxed text-texte"
            />
            {etapes.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(etapes.filter((_, i) => i !== index))}
                aria-label={`Retirer l'étape ${index + 1}`}
                className="mt-1 flex min-h-tactile w-12 shrink-0 items-center justify-center rounded-[0.6rem] text-[1.2rem] text-texte-doux"
              >
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...etapes, ''])}
        className="mt-2 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux"
      >
        Ajouter une étape
      </button>
    </>
  )
}

// --- Petits contrôles ---------------------------------------------------------------------------

function Champ({ libelle, children }: { readonly libelle: string; readonly children: React.ReactNode }) {
  return (
    <label className="mt-6 block">
      <span className="text-[0.9rem] text-texte-doux">{libelle}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function Groupe({ titre, children }: { readonly titre: string; readonly children: React.ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="text-[0.95rem] text-texte-doux">{titre}</legend>
      <div className="mt-2">{children}</div>
    </fieldset>
  )
}

function Nombre({
  libelle,
  valeur,
  onChange,
}: {
  readonly libelle: string
  readonly valeur: number
  readonly onChange: (valeur: number) => void
}) {
  return (
    <label className="block">
      <span className="text-[0.9rem] text-texte-doux">{libelle}</span>
      <input
        type="number"
        min={0}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-[1.05rem] text-texte"
      />
    </label>
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
        'flex min-h-tactile items-center rounded-[0.7rem] border px-4 text-[0.95rem] font-semibold ' +
        (active
          ? 'border-2 border-accent bg-accent-doux text-accent-texte'
          : 'border-bordure-forte bg-fond text-texte-doux')
      }
    >
      {libelle}
    </button>
  )
}

function PetiteBascule({
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
        'flex min-h-tactile items-center gap-2 rounded-[0.6rem] border px-3 text-[0.9rem] ' +
        (active ? 'border-accent bg-accent-doux text-texte' : 'border-bordure-forte bg-fond text-texte-doux')
      }
    >
      <span aria-hidden="true">{active ? '✓' : ''}</span>
      {libelle}
    </button>
  )
}
