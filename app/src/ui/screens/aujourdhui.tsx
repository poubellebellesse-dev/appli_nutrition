// ui/screens/aujourdhui.tsx — écran « Aujourd'hui » (§4.1 DESIGN).
//
// ⚠️ CET ÉCRAN ÉTAIT UNE LISTE DE CINQ CARTES DE TEXTE. §4.1 décrivait depuis le début tout autre
// chose : « repas du jour PLEIN ÉCRAN : photo dominante, nom, heure du repas · bouton Voir la
// recette · changement de plat par FLÈCHES VISIBLES, glissement en raccourci · après quelques
// changements, encart Dites-moi ce que vous cherchez ». La liste était une version P1 jamais
// reprise. Ce fichier rattrape la spec, il ne l'invente pas.
//
// ⚠️ « AUCUNE ACTION UNIQUEMENT GESTUELLE » (§3 DESIGN). Les flèches sont le mode NORMAL ; le
// balayage est un raccourci qu'on active dans Paramètres (`gestesBalayage`, défaut faux). C'est la
// contrainte d'âge du produit : un geste que personne n'annonce n'existe pas pour une partie des
// utilisateurs. Ne jamais inverser ce défaut.
//
// PÉRIMÈTRE — ce que §4.1 décrit et qui n'est PAS ici, volontairement :
//   - la GALERIE de photos (taper l'image pour la voir en grand, défiler entre plusieurs) :
//     `Recipe.imagePath` est UNE chaîne, pas une liste, et vaut `null` sur les 241 recettes. Une
//     galerie d'aplats de couleur ne serait pas une fonctionnalité dégradée, elle n'aurait aucun
//     sens. À reprendre avec les vraies photos, et il faudra une table `recipe_image`.
//   - la poignée « le reste de la journée », la carte « Le saviez-vous ? » et la carte occasion.
//   - les tags cliquables sous la photo : ils réorientent la sélection, ce que fait déjà — mieux et
//     explicitement — l'encart « Dites-moi ce que vous cherchez ».

import { useCallback, useEffect, useState } from 'react'
import type {
  CravingAxes,
  MealSlot,
  Minutes,
  RecipeId,
  ScoredSuggestion,
  SuggestionRequest,
} from '../../engine/domain/index.js'
import { min } from '../../engine/domain/index.js'
import { readDisplay, readRythme, readUserState, recordMeal, type StoredUserState } from '../../data/user-store.js'
import type { UserProfile } from '../../engine/domain/index.js'
import {
  FENETRE_HISTORIQUE_JOURS,
  aujourdhuiIso,
  chargerSocle,
  profilCourant,
} from '../socle.js'
import { hashDeRecette, hashDuFrigo } from '../router.js'
import { REPAS_PAR_DEFAUT, TITRE_CRENEAU, creneauDuMoment, creneauxDuRythme } from '../creneau.js'
import { couleurDeRecette, initialeDeRecette } from '../vignette.js'

/**
 * Combien de plats on prépare d'avance. Assez pour défiler sans recalculer à chaque flèche, pas
 * plus : chaque suggestion passe par le scoring, la diversification ET la génération d'explications.
 */
const PROFONDEUR = 12

/** Plats proches montrés sous la carte. Quatre tiennent sur une ligne de téléphone. */
const NB_PROCHES = 4

/**
 * Après combien de changements SANS CHOIX on propose de l'aide.
 *
 * §4.1 dit « ~4 changements ». Porté à 7 à la demande de l'utilisateur : à quatre, l'encart tombe
 * alors qu'on est encore en train de regarder tranquillement. L'esprit de la spec est conservé —
 * « détecter l'indécision PUIS proposer, plutôt qu'interroger d'emblée » — c'est le seuil qui bouge.
 */
const SEUIL_INDECISION = 7

/** Paliers de temps de l'écran. Mêmes valeurs que le rythme, pour ne pas inventer un 3ᵉ barème. */
const PALIERS_TEMPS: readonly { readonly minutes: number | null; readonly libelle: string }[] = [
  { minutes: 20, libelle: '20 min' },
  { minutes: 30, libelle: '30 min' },
  { minutes: 45, libelle: '45 min' },
  { minutes: null, libelle: 'Peu importe' },
]

/**
 * Les axes de l'encart d'aide, du plus général au plus précis — l'ordre demandé.
 *
 * ⚠️ CES TROIS AXES SONT EXACTEMENT `CravingAxes`, et pas un de plus. Le moteur lit `sucreSale`,
 * `legerConsistant` et `chaudFroid` ; ajouter ici « rapide / mijoté » donnerait une pastille qui
 * ne pilote RIEN — le défaut récurrent du projet, un réglage sans consommateur. Le temps a son
 * propre contrôle, qui lui passe par `tempsDisponibleMin`.
 */
const AXES_ENVIE: readonly {
  readonly cle: keyof CravingAxes
  readonly question: string
  readonly bas: string
  readonly haut: string
}[] = [
  { cle: 'legerConsistant', question: 'Plutôt léger ou consistant ?', bas: 'Léger', haut: 'Consistant' },
  { cle: 'chaudFroid', question: 'Chaud ou froid ?', bas: 'Chaud', haut: 'Froid' },
  { cle: 'sucreSale', question: 'Salé ou sucré ?', bas: 'Salé', haut: 'Sucré' },
]

/** Est-on samedi ou dimanche ? `getUTCDay` : une date de plan est un JOUR, pas un instant. */
function estWeekend(isoDate: string): boolean {
  const jour = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return jour === 0 || jour === 6
}

interface Reglages {
  readonly envie: CravingAxes | null
  readonly tempsMaxMin: number | null
}

const REGLAGES_VIDES: Reglages = { envie: null, tempsMaxMin: null }

function construireRequete(
  etat: StoredUserState,
  profile: UserProfile,
  date: string,
  creneau: MealSlot,
  tempsDisponibleMin: Minutes | null,
  envie: CravingAxes | null
): SuggestionRequest {
  return {
    profile,
    constraints: etat.constraints,
    context: {
      date,
      creneau,
      envie,
      tempsDisponibleMin,
      // Exigence ponctuelle « je veux ça » : par construction jamais persistée (§6.5 ter ENGINE).
      requiredFoodIds: [],
      pantryFoodIds: etat.pantryFoodIds,
    },
    history: etat.history,
    preferences: etat.preferences,
    favoriteRecipeIds: etat.favoriteRecipeIds,
    activeTopics: etat.activeTopics,
    seed: 1,
    limit: PROFONDEUR,
  }
}

interface Vue {
  readonly suggestions: readonly ScoredSuggestion[]
  readonly nomDe: (id: string) => string
  readonly nbRetenus: number
  readonly creneau: MealSlot
  readonly balayageActif: boolean
  /** Les plats proches, par identifiant de plat regardé — calculés à la demande, mémorisés. */
  readonly prochesDe: (id: RecipeId) => readonly RecipeId[]
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

async function calculerVue(reglages: Reglages): Promise<Vue> {
  const socle = await chargerSocle()
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const etat = readUserState(socle.db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: date })
  const rythme = readRythme(socle.db)

  // Le temps choisi À L'ÉCRAN prime sur le rythme déclaré : c'est un « ce soir je suis pressé »,
  // pas un changement de réglage durable. `null` à l'écran = on retombe sur le rythme.
  const duRythme = estWeekend(date) ? rythme?.tempsWeekendMin : rythme?.tempsSemaineMin
  const minutes = reglages.tempsMaxMin ?? duRythme ?? null

  // ⚠️ Heure LOCALE, contrairement aux dates du plan qui sont en UTC — voir `creneau.ts`.
  const creneau = creneauDuMoment(
    new Date().getHours(),
    creneauxDuRythme(rythme?.repasParJour ?? REPAS_PAR_DEFAUT)
  )

  const requete = construireRequete(
    etat,
    profil,
    date,
    creneau,
    minutes === null ? null : min(minutes),
    reglages.envie
  )
  const resultat = socle.moteur.suggestMeals(requete)

  // Mémorisation : `similarRecipes` repasse toute la passe d'exclusion, et l'écran le redemanderait
  // à chaque rendu de React sinon.
  const cache = new Map<RecipeId, readonly RecipeId[]>()

  return {
    suggestions: resultat.suggestions,
    nomDe: (id) => socle.catalogue.recipes.get(id as never)?.nom ?? id,
    nbRetenus: etat.history.entries.length,
    creneau,
    balayageActif: readDisplay(socle.db).gestesBalayage,
    prochesDe: (id) => {
      const connu = cache.get(id)
      if (connu !== undefined) return connu
      const proches = socle.moteur.similarRecipes(requete, id, NB_PROCHES)
      cache.set(id, proches)
      return proches
    },
  }
}

export function Aujourdhui() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_VIDES)
  const [position, setPosition] = useState(0)
  /** Changements de plat SANS choix — c'est l'indécision qu'on mesure, pas l'activité. */
  const [changements, setChangements] = useState(0)
  const [aideOuverte, setAideOuverte] = useState(false)

  const rafraichir = useCallback((suivants: Reglages) => {
    let annule = false
    calculerVue(suivants)
      .then((vue) => {
        if (annule) return
        setEtat({ phase: 'pret', vue })
        setPosition(0)
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

  useEffect(() => rafraichir(reglages), [rafraichir, reglages])

  /**
   * L'indécision OUVRE l'encart, elle ne le maintient pas ouvert.
   *
   * ⚠️ LE DÉFAUT QUE CE VERROU CORRIGE. L'encart s'affichait tant que `changements >= SEUIL` ;
   * choisir une pastille remettait le compteur à zéro — pour ne pas re-proposer de l'aide juste
   * après en avoir donné — et l'encart DISPARAISSAIT sous le doigt, entre la première pastille et
   * la deuxième. Une fois ouvert, il reste jusqu'à « Masquer » ou jusqu'à ce qu'un plat soit retenu.
   */
  useEffect(() => {
    if (changements >= SEUIL_INDECISION) setAideOuverte(true)
  }, [changements])

  /**
   * « J'ai choisi ce plat » — écrit une entrée d'historique d'origine `choisi`.
   *
   * ⚠️ CE N'EST PAS UN JOURNAL ALIMENTAIRE (§6.5 ARCHITECTURE). Le geste est facultatif, sans
   * quantité, sans relance et sans conséquence si on ne le fait jamais.
   */
  const retenir = useCallback(
    (recipeId: string, creneau: MealSlot) => {
      chargerSocle()
        .then((socle) => {
          // Le créneau vient de la vue, pas d'une relecture de l'horloge : un plat retenu à 13 h 59
          // s'enregistre sur le déjeuner qu'on regardait, même si l'écriture aboutit à 14 h 01.
          recordMeal(socle.db, { recipeId: recipeId as never, date: aujourdhuiIso(), creneau, origine: 'choisi' })
          // Choisir MET FIN à l'indécision : le compteur repart, l'encart se referme.
          setChangements(0)
          setAideOuverte(false)
          rafraichir(reglages)
        })
        .catch((erreur: unknown) => {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        })
    },
    [rafraichir, reglages]
  )

  const deplacer = useCallback(
    (pas: number, total: number) => {
      setPosition((p) => Math.min(Math.max(p + pas, 0), total - 1))
      if (pas > 0) setChangements((c) => c + 1)
    },
    []
  )

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">
          Les suggestions n'ont pas pu être calculées.
        </p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat
  const total = vue.suggestions.length
  const courante = vue.suggestions[Math.min(position, total - 1)]

  if (courante === undefined) {
    return (
      <section>
        <h1 className="text-[2.1rem] text-texte">{TITRE_CRENEAU[vue.creneau]}</h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
          Aucun plat ne correspond à ce que vous avez demandé. Élargissez le temps disponible, ou
          repartez de zéro.
        </p>
        <button
          type="button"
          onClick={() => setReglages(REGLAGES_VIDES)}
          className="mt-5 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white"
        >
          Repartir de zéro
        </button>
      </section>
    )
  }

  const doitAider = aideOuverte

  return (
    <section>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[2.1rem] text-texte">{TITRE_CRENEAU[vue.creneau]}</h1>
        <p className="text-[0.9rem] tabular-nums text-attenue">
          {position + 1} sur {total}
        </p>
      </header>

      <CarteRepas
        suggestion={courante}
        nom={vue.nomDe(courante.recipeId)}
        balayageActif={vue.balayageActif}
        surPrecedent={position > 0 ? () => deplacer(-1, total) : null}
        surSuivant={position < total - 1 ? () => deplacer(1, total) : null}
        surRetenir={() => retenir(courante.recipeId, vue.creneau)}
      />

      {/* §4.1 — « détecter l'indécision PUIS proposer, plutôt qu'interroger d'emblée ». */}
      {doitAider && (
        <EncartEnvie
          reglages={reglages}
          // Régler une pastille ne touche PAS au compteur d'indécision : c'est le verrou ci-dessus
          // qui garde l'encart ouvert, et y remettre `setChangements(0)` le refermerait aussitôt.
          onChange={setReglages}
          onFermer={() => {
            setAideOuverte(false)
            setChangements(0)
          }}
        />
      )}

      {!doitAider && (
        <button
          type="button"
          onClick={() => setAideOuverte(true)}
          className="mt-4 flex min-h-tactile w-full items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.95rem] font-semibold text-texte-doux"
        >
          Dites-moi ce que vous cherchez
        </button>
      )}

      <PlatsProches
        ids={vue.prochesDe(courante.recipeId as RecipeId)}
        nomDe={vue.nomDe}
      />

      {/* §4.5 DESIGN veut « Vider le frigo » accessible depuis Aujourd'hui et Recettes. */}
      <a
        href={hashDuFrigo()}
        className="mt-4 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        Vider le frigo — partir de ce que j'ai
      </a>

      {vue.nbRetenus > 0 && (
        <p className="mt-4 text-[0.9rem] leading-relaxed text-attenue">
          {vue.nbRetenus} plat{vue.nbRetenus > 1 ? 's' : ''} retenu{vue.nbRetenus > 1 ? 's' : ''} ces{' '}
          {FENETRE_HISTORIQUE_JOURS} derniers jours.
        </p>
      )}
    </section>
  )
}

// --- La carte -------------------------------------------------------------------------------------

/**
 * Seuil de balayage, en pixels. En dessous, c'est un défilement vertical maladroit ou un tremblement
 * de la main — pas une intention. Volontairement haut : un déclenchement accidentel fait « sauter »
 * le plat qu'on regardait, et l'utilisateur ne sait pas ce qui vient de se passer.
 */
const SEUIL_BALAYAGE_PX = 60

function CarteRepas({
  suggestion,
  nom,
  balayageActif,
  surPrecedent,
  surSuivant,
  surRetenir,
}: {
  readonly suggestion: ScoredSuggestion
  readonly nom: string
  readonly balayageActif: boolean
  readonly surPrecedent: (() => void) | null
  readonly surSuivant: (() => void) | null
  readonly surRetenir: () => void
}) {
  const [departX, setDepartX] = useState<number | null>(null)

  const finBalayage = (finX: number) => {
    if (departX === null) return
    const ecart = finX - departX
    setDepartX(null)
    if (Math.abs(ecart) < SEUIL_BALAYAGE_PX) return
    if (ecart < 0) surSuivant?.()
    else surPrecedent?.()
  }

  return (
    <article
      className="mt-4 overflow-hidden rounded-[--radius-carte] border border-bordure bg-surface"
      // ⚠️ Les gestes ne sont posés QUE si le réglage est actif, et ils ne font jamais rien que les
      // flèches ci-dessous ne fassent — §3 DESIGN, « chaque geste doublé d'un contrôle visible ».
      onTouchStart={balayageActif ? (e) => setDepartX(e.touches[0]?.clientX ?? null) : undefined}
      onTouchEnd={balayageActif ? (e) => finBalayage(e.changedTouches[0]?.clientX ?? 0) : undefined}
    >
      {/* L'aplat qui tient la place de la photo. `aria-hidden` : purement décoratif, tout ce qui
          compte est en texte dessous. Voir `ui/vignette.ts`. */}
      <div
        aria-hidden="true"
        style={{ backgroundColor: couleurDeRecette(suggestion.recipeId) }}
        className="flex h-[40vh] min-h-[12rem] items-center justify-center"
      >
        <span className="font-titre text-[5rem] leading-none text-white/70">
          {initialeDeRecette(nom)}
        </span>
      </div>

      <div className="p-4">
        {/* ⚠️ AUCUNE NOTE CHIFFRÉE ICI, PLUS JAMAIS. Cet emplacement affichait
            `Math.round(suggestion.score)/100` — le score de CLASSEMENT interne du moteur
            (api/index.ts : un flottant de [0, 1] ramené sur 100), qui n'a de sens que RELATIF aux
            autres candidats de la même passe : il dépend des réglages, de l'historique et du reste
            de la liste, si bien que le même plat peut valoir 62 aujourd'hui et 78 demain.
            Au-delà de l'obscurité, un nombre sur 100 posé à côté d'un nom de plat se lit comme une
            note de qualité nutritionnelle — Nutri-Score, Yuka — c'est-à-dire exactement le jugement
            que §6.2 ARCHITECTURE interdit à cette application de porter. */}
        <h2 className="font-titre text-[1.6rem] leading-tight text-texte">{nom}</h2>

        {/* ⚠️ Les explications viennent du moteur (§6.7) et passent `assertNoTherapeuticClaim`. Ne
            JAMAIS composer une phrase d'explication ici : la garde ne verrait rien.
            Rendu CONDITIONNEL : une couche peut être délibérément muette (`EXPLANATION_LABELS`,
            selection/explain.ts) et la liste revenir vide — un `<p>` vide laisserait une marge
            inexpliquée sous le titre. */}
        {suggestion.explanations.length > 0 && (
          <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">
            {suggestion.explanations.map((e) => e.label).join(' · ')}
          </p>
        )}

        <p className="mt-3 text-[0.85rem] text-attenue">Photo à venir</p>

        {/* Les flèches. Toujours présentes, jamais réduites à une icône nue. */}
        <div className="mt-4 flex gap-2">
          <BoutonNavigation libelle="Précédent" fleche="←" onClic={surPrecedent} />
          <BoutonNavigation libelle="Suivant" fleche="→" onClic={surSuivant} apresTexte />
        </div>

        <a
          href={hashDeRecette(suggestion.recipeId)}
          className="mt-3 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-[1rem] font-semibold text-texte no-underline"
        >
          Voir la recette
        </a>

        <button
          type="button"
          onClick={surRetenir}
          className="mt-3 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-4 text-[1rem] font-semibold text-white"
        >
          J'ai choisi ce plat
        </button>
      </div>
    </article>
  )
}

function BoutonNavigation({
  libelle,
  fleche,
  onClic,
  apresTexte = false,
}: {
  readonly libelle: string
  readonly fleche: string
  readonly onClic: (() => void) | null
  readonly apresTexte?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClic ?? undefined}
      disabled={onClic === null}
      className="flex min-h-tactile flex-1 items-center justify-center gap-2 rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-[0.95rem] font-semibold text-texte-doux disabled:opacity-40"
    >
      {!apresTexte && <span aria-hidden="true">{fleche}</span>}
      {libelle}
      {apresTexte && <span aria-hidden="true">{fleche}</span>}
    </button>
  )
}

// --- L'encart d'aide ------------------------------------------------------------------------------

/**
 * « Dites-moi ce que vous cherchez » — alimente la couche `craving` (§4.1, §6.5 ENGINE).
 *
 * ⚠️ CHAQUE PASTILLE PILOTE UN AXE RÉEL DE `CravingAxes`. Une pastille qui ne changerait aucune
 * suggestion serait pire qu'absente : elle donnerait le sentiment d'avoir été écouté sans l'être.
 */
function EncartEnvie({
  reglages,
  onChange,
  onFermer,
}: {
  readonly reglages: Reglages
  readonly onChange: (suivants: Reglages) => void
  readonly onFermer: () => void
}) {
  const envie = reglages.envie ?? { sucreSale: null, legerConsistant: null, chaudFroid: null }

  const regler = (cle: keyof CravingAxes, valeur: number | null) =>
    onChange({ ...reglages, envie: { ...envie, [cle]: valeur } })

  return (
    <div className="mt-4 rounded-[--radius-carte] border border-bordure-forte bg-surface p-4">
      <h2 className="font-titre text-[1.25rem] text-texte">Dites-moi ce que vous cherchez</h2>
      <p className="mt-1 text-[0.9rem] leading-relaxed text-attenue">
        Rien n'est obligatoire. Ce que vous indiquez ne vaut que pour ce repas.
      </p>

      {/* Le temps d'abord : c'est le critère le plus général, et le plus souvent décisif. */}
      <fieldset className="mt-4">
        <legend className="text-[0.9rem] text-texte-doux">Combien de temps devant vous ?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PALIERS_TEMPS.map((palier) => (
            <Pastille
              key={palier.libelle}
              libelle={palier.libelle}
              active={reglages.tempsMaxMin === palier.minutes}
              onBasculer={() =>
                onChange({
                  ...reglages,
                  tempsMaxMin: reglages.tempsMaxMin === palier.minutes ? null : palier.minutes,
                })
              }
            />
          ))}
        </div>
      </fieldset>

      {AXES_ENVIE.map((axe) => (
        <fieldset key={axe.cle} className="mt-4">
          <legend className="text-[0.9rem] text-texte-doux">{axe.question}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pastille
              libelle={axe.bas}
              active={envie[axe.cle] === -1}
              onBasculer={() => regler(axe.cle, envie[axe.cle] === -1 ? null : -1)}
            />
            <Pastille
              libelle={axe.haut}
              active={envie[axe.cle] === 1}
              onBasculer={() => regler(axe.cle, envie[axe.cle] === 1 ? null : 1)}
            />
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={onFermer}
        className="mt-4 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-4 text-[0.95rem] font-semibold text-texte-doux"
      >
        Masquer
      </button>
    </div>
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

// --- Les plats proches ----------------------------------------------------------------------------

/**
 * « En bas, des plats qui ressemblent à celui qu'on vient de voir ».
 *
 * ⚠️ CE NE SONT PAS LES AUTRES SUGGESTIONS. Celles-ci sont passées par `diversify`, dont le travail
 * est de les rendre DIFFÉRENTES ; les afficher ici afficherait l'exact contraire de la promesse.
 * `moteur.similarRecipes` classe par proximité et repasse la passe d'exclusion — allergies
 * comprises, voir son en-tête.
 */
function PlatsProches({
  ids,
  nomDe,
}: {
  readonly ids: readonly RecipeId[]
  readonly nomDe: (id: string) => string
}) {
  if (ids.length === 0) return null

  return (
    <section className="mt-6">
      <h2 className="font-titre text-[1.25rem] text-texte">Dans le même esprit</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ids.map((id) => (
          <li key={id}>
            <a
              href={hashDeRecette(id)}
              className="flex min-h-tactile items-center gap-3 rounded-[--radius-carte] border border-bordure bg-surface p-2 text-[0.95rem] text-texte no-underline"
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: couleurDeRecette(id) }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.6rem] font-titre text-[1.3rem] text-white/70"
              >
                {initialeDeRecette(nomDe(id))}
              </span>
              <span className="leading-snug">{nomDe(id)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
