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
// PÉRIMÈTRE — ce que §4.6 décrit et qui n'est PAS ici : la photo (`imagePath` n'est lu nulle part
// dans cet écran), les alternatives d'ingrédients (`suggestAlternatives` exige
// une `SuggestionRequest` complète pour que les substitutions repassent les filtres d'allergènes —
// un lot, pas un bouton), les notes locales, la roue des goûts, et « Ajouter à ma semaine ».

import { useCallback, useEffect, useState } from 'react'
import type {
  Catalog,
  Equipment,
  EquipmentId,
  HardConstraints,
  Recipe,
  RecipeId,
  RecipeSource,
  RecipeStep,
} from '../../engine/domain/index.js'
import {
  readDisplay,
  readSaucesChoisies,
  readUserState,
  setFavorite,
  setSauceChoisie,
  writeDisplay,
} from '../../data/user-store.js'
import type { Socle } from '../socle.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, chargerSocle } from '../socle.js'
import type { OrigineRecette } from '../router.js'
import { hashDe, hashDeLAliment, hashDeLEditeur, hashDeLaCuisine, hashDeRecette, hashDuFrigo } from '../router.js'
import { estRecettePerso, readUserRecipe } from '../../data/user-recipe.js'
import { GestesDeLEtape } from '../gestes-etape.js'
import {
  ListeIngredients,
  QuantitesDeLEtape,
  SelecteurPortions,
  TexteEtape,
  preparerTexteEtape,
} from '../ingredients-recette.js'
import { formesDeLAliment } from '../texte-etape.js'
import { origineDeCuisine } from '../drapeaux.js'
import { LigneOuvrante, Panneau } from '../panneau.js'

/**
 * Retour contextuel (§ « Retour contextuel depuis la fiche recette ») : le lien du haut ramène là
 * d'où l'on vient, avec un libellé qui suit la destination — un libellé qui mentirait serait pire
 * qu'absent. `origine` vient du hash (`OrigineRecette`, router.tsx), jamais d'un état React : un
 * rechargement sur `#/recette/xxx?de=aujourdhui` doit continuer de retourner au bon endroit.
 */
const RETOUR_PAR_ORIGINE: Readonly<Record<OrigineRecette, { readonly hash: string; readonly libelle: string }>> = {
  aujourdhui: { hash: hashDe('aujourdhui'), libelle: "← Aujourd'hui" },
  recettes: { hash: hashDe('recettes'), libelle: '← Toutes les recettes' },
  semaine: { hash: hashDe('semaine'), libelle: '← Cette semaine' },
  frigo: { hash: hashDuFrigo(), libelle: '← Vider le frigo' },
}

interface Vue {
  readonly recette: Recipe
  readonly catalogue: Catalog
  readonly nomAliment: (id: string) => string
  readonly estQuantiteFigee: (id: string) => boolean
  readonly quantitePour: (portions: number) => ReadonlyMap<string, number>
  readonly favori: boolean
  readonly manquants: ReadonlySet<string>
  /** `false` = garde-manger vide : on ne signale rien, sinon TOUT serait « à acheter ». */
  readonly gardeManger: boolean
  readonly afficherMacros: boolean
  readonly energiePortion: number | null
  /** `null` pour une recette du catalogue. Distingue le libellé de l'avertissement « non vérifié »
   *  (§8.7 ARCHITECTURE) : « Votre recette » mentirait sur un fichier reçu d'ailleurs. */
  readonly sourcePerso: 'perso' | 'variante' | 'importe' | null
  readonly sauces: VueSauces
}

interface LigneSauce {
  readonly id: RecipeId
  readonly nom: string
  readonly energiePortion: number | null
  /**
   * L'utilisateur a dit prendre TOUJOURS cette sauce avec ce plat (`user_recipe_sauce`, v14) — donc
   * ses ingrédients entrent dans la liste de courses chaque fois que le plat est prévu.
   *
   * ⚠️ RIEN À VOIR AVEC LE FAIT D'ÊTRE « attachée ». Le catalogue PROPOSE (`Recipe.sauceIds`),
   * l'utilisateur CHOISIT. Une sauce de la section « Autres sauces » se choisit tout autant.
   */
  readonly choisie: boolean
}

interface VueSauces {
  /** Faux → la section entière ne s'affiche pas (dessert, sauce, ou plat qui vient déjà saucé). */
  readonly proposer: boolean
  readonly attachees: readonly LigneSauce[]
  readonly autres: readonly LigneSauce[]
  /**
   * Sauces retirées par les couches d'exclusion. **Se dit à l'écran.** Une liste raccourcie en
   * silence par une allergie se lit comme un catalogue pauvre, et l'utilisateur cherche alors un
   * défaut là où l'application a fait exactement son travail (principe 6 : informer).
   */
  readonly ecartees: number
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'introuvable' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

/**
 * Les sauces proposées avec ce plat, résolues en libellés affichables.
 *
 * ⚠️ TOUT LE FILTRAGE EST FAIT PAR LE MOTEUR, aucun ici. `suggestSauces` passe les sauces par les
 * mêmes couches d'exclusion que n'importe quelle recette, allergènes et régime compris, puis les
 * repasse au garde-fou. Refaire un tri à l'écran, c'est créer la seconde implémentation qui finira
 * par diverger — et cette fois sur un allergène déclaré.
 */
function lireLesSauces(socle: Socle, id: RecipeId, constraints: HardConstraints): VueSauces {
  const res = socle.moteur.suggestSauces({ recipeId: id, constraints })
  const choisies = new Set(readSaucesChoisies(socle.db).get(id) ?? [])
  const ligne = (sauceId: RecipeId): LigneSauce => ({
    id: sauceId,
    nom: socle.catalogue.recipes.get(sauceId)?.nom ?? sauceId,
    energiePortion: energieParPortion(socle.catalogue, sauceId),
    choisie: choisies.has(sauceId),
  })
  return {
    proposer: res.proposer,
    attachees: res.attachees.map(ligne),
    autres: res.autres.map(ligne),
    ecartees: res.ecartees,
  }
}

/** Énergie d'UNE portion, ou `null` si le catalogue ne la connaît pas. */
function energieParPortion(catalogue: Catalog, id: RecipeId): number | null {
  const index = catalogue.nutrients.findIndex((n) => n.code === 'energie')
  if (index < 0) return null
  // ⚠️ `recipeNutrients` est DÉJÀ par portion (§6.5 précision 8) — ne pas rediviser par
  // `portionsBase`, ce qui donnerait une valeur quatre fois trop basse sur un plat familial.
  return catalogue.indexes.recipeNutrients.get(id)?.[index] ?? null
}

export function DetailRecette({
  recetteId,
  origine,
}: {
  readonly recetteId: string
  readonly origine: OrigineRecette
}) {
  const retour = RETOUR_PAR_ORIGINE[origine]
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
            estQuantiteFigee: (foodId) =>
              socle.catalogue.foods.get(foodId as never)?.quantiteFigee === true,
            // ⚠️ ON LIT `quantiteG`, PAS `uniteAffichage`. C'était le bug de la première version :
            // `scaleRecipe` recalcule les grammes mais laisse le libellé TEL QUEL, à dessein — « 2
            // carottes » ne se met pas à l'échelle sans réécrire du français, et « 1,5 pincée »
            // aurait l'air juste sans l'être. Son en-tête dit explicitement que l'appelant doit
            // afficher la quantité recalculée. Afficher le libellé donnait des quantités qui ne
            // bougeaient jamais.
            quantitePour: (n) =>
              new Map(
                socle.moteur.scaleRecipe(id, n).ingredients.map((i) => [i.foodId as string, i.quantiteG])
              ),
            favori: utilisateur.favoriteRecipeIds.has(id),
            // ⚠️ LES OPTIONNELS NE MANQUENT PAS. Ne pas avoir une garniture facultative n'empêche
            // pas de cuisiner le plat — c'est déjà la règle de `ingredientsManquants` côté moteur.
            manquants: new Set(
              recette.ingredients
                .filter((i) => !i.optionnel)
                .map((i) => i.foodId as string)
                .filter((foodId) => !utilisateur.pantryFoodIds.includes(foodId as never))
            ),
            gardeManger: utilisateur.pantryFoodIds.length > 0,
            afficherMacros: readDisplay(socle.db).afficherMacros,
            energiePortion: energieParPortion(socle.catalogue, id),
            sourcePerso: estRecettePerso(recetteId) ? (readUserRecipe(socle.db, recetteId)?.source ?? 'perso') : null,
            sauces: lireLesSauces(socle, id, utilisateur.constraints),
          },
        })
      })
      .catch((erreur: unknown) => {
        setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
  }, [recetteId])

  useEffect(charger, [charger])

  /**
   * ⚠️ RÉINITIALISÉ À CHAQUE RECETTE, et non conservé. Garder la valeur précédente faisait s'ouvrir
   * une recette prévue pour 4 sur les 8 portions réglées SUR UNE AUTRE — toutes ses quantités mises
   * à l'échelle sans que personne ne l'ait demandé.
   *
   * ⛔ ET SURTOUT PAS DANS `charger`, QUI EST AUSSI LE RAFRAÎCHISSEMENT. `basculerFavori`,
   * `basculerSauce` et `basculerMacros` le rappellent pour relire la base : y laisser la remise à
   * zéro faisait qu'appuyer sur l'étoile — un geste sans aucun rapport — reperdait en silence les
   * 6 portions réglées, sans un mot. La clé est `recetteId`, pas « chaque fois qu'on relit ».
   *
   * `null` et non `portionsBase` : `portionsAffichees` retombe déjà sur la base de la recette, et
   * l'écrire ici obligerait à attendre le chargement pour connaître la valeur.
   */
  useEffect(() => {
    setPortions(null)
  }, [recetteId])

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

  /**
   * « Je la prends toujours avec ce plat » — écrit `user_recipe_sauce` (v14).
   *
   * ⚠️ ÉCRIT SUR LA RECETTE AFFICHÉE, PAS SUR UN CRÉNEAU. C'est une préférence durable, valable pour
   * toutes les semaines à venir, régénérations comprises. Voir la migration v14 pour la variante par
   * créneau qui a été écartée, et pourquoi.
   */
  const basculerSauce = useCallback(
    (sauceId: RecipeId, choisie: boolean) => {
      chargerSocle()
        .then((socle) => {
          setSauceChoisie(socle.db, recetteId as RecipeId, sauceId, choisie)
          charger()
        })
        .catch(() => undefined)
    },
    [recetteId, charger]
  )

  const basculerMacros = useCallback(() => {
    if (etat.phase !== 'pret') return
    const suivant = !etat.vue.afficherMacros
    chargerSocle()
      .then((socle) => {
        // ⚠️ RELIRE PUIS ÉTALER, jamais écrire le seul champ qu'on change : `writeDisplay` remplace
        // la ligne entière, et les réglages omis repartiraient au DEFAULT du schéma. Basculer les
        // macros aurait alors désactivé le balayage, en silence.
        writeDisplay(socle.db, { ...readDisplay(socle.db), afficherMacros: suivant })
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
  const facteur = portionsAffichees / (recette.portionsBase > 0 ? recette.portionsBase : 1)
  const mention = mentionOrigine(recette)

  return (
    <article>
      <a
        href={retour.hash}
        className="inline-flex min-h-tactile items-center text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        {retour.libelle}
      </a>

      {/* ⚠️ §4.3 ARCHITECTURE l'impose : une recette utilisateur est « contenu AUTONOME, hors
          garanties du catalogue source : toujours affiché non vérifié ». Les valeurs nutritionnelles
          sont bien calculées depuis CIQUAL — mais les quantités, les temps et les étapes viennent de
          l'utilisateur, et rien ne les a relus. Le dire est la condition pour les afficher.
          ⚠️ LE LIBELLÉ SUIT `sourcePerso`, PAS SEULEMENT LE PRÉFIXE `perso:` DE L'ID (§8.7) : une
          recette IMPORTÉE porte aussi ce préfixe (voir `nouvelIdRecette`) mais « Votre recette » y
          mentirait — elle vient d'ailleurs, personne ici ne l'a écrite ni relue. */}
      {estRecettePerso(recetteId) &&
        (vue.sourcePerso === 'importe' ? (
          <p className="mt-2 rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 py-3 text-[0.9rem] leading-relaxed text-texte-doux">
            Recette importée. Les apports sont calculés depuis ses ingrédients ; le reste — étapes,
            temps, portions — vient de la personne qui l'a partagée et n'a pas été vérifié.
          </p>
        ) : (
          <p className="mt-2 rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 py-3 text-[0.9rem] leading-relaxed text-texte-doux">
            Votre recette. Les apports sont calculés depuis vos ingrédients ; le reste n'a pas été
            vérifié.
          </p>
        ))}

      {/* ⚠️ LA MENTION S'AFFICHE SYSTÉMATIQUEMENT, même quand `sources` porte des références de
          vérification : sans elle, une recette confrontée à Escoffier (type `reference`, jamais
          `provenance`) laissait croire qu'elle en VENAIT. Le bloc `Sources` en bas de fiche porte
          déjà le détail des sources `provenance` — cette phrase n'est qu'une amorce, jamais une
          duplication. Voir docs/SOURCES_RECETTES.md §5.
          PAS pour les recettes perso : leur bandeau ci-dessus dit déjà la même chose, en mieux. */}
      {!estRecettePerso(recetteId) && mention !== null && (
        <p className="mt-2 text-[0.9rem] leading-relaxed text-attenue">{mention}</p>
      )}

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

      {/* « On change 2-3 ingrédients, à peu près comme celui de base » sur une recette DU CATALOGUE ;
          « Modifier ma recette » sur une recette déjà personnelle — l'éditeur reconnaît les deux
          cas au préfixe de `recetteId` (voir data/user-recipe.js#estRecettePerso et l'en-tête de
          editeur-recette.tsx) : jamais les deux liens à la fois. */}
      <a
        href={hashDeLEditeur(recetteId)}
        className="mt-4 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        {estRecettePerso(recetteId) ? 'Modifier ma recette' : 'Adapter cette recette à ma façon'}
      </a>

      <p className="mt-2 text-[1.05rem] leading-relaxed text-texte-doux">{recette.description}</p>
      <p className="mt-3 text-[1rem] text-attenue">
        {recette.tempsPrepMin} min de préparation · {recette.tempsCuissonMin} min de cuisson ·
        difficulté {recette.difficulte}/3
      </p>

      <Origines recette={recette} />

      <SelecteurPortions
        portions={portionsAffichees}
        base={recette.portionsBase}
        onChange={setPortions}
      />

      <h2 className="mt-8 text-[1.5rem] text-texte">Ingrédients</h2>
      {/* ⚠️ `manquants` À `null` QUAND LE GARDE-MANGER EST VIDE, et ce n'est pas un raccourci. Sans
          ce test, un garde-manger vide — le cas de presque tout le monde — marquait CHAQUE ligne
          « à acheter », ce qui n'informe plus de rien et noie la liste. */}
      <ListeIngredients
        ingredients={recette.ingredients}
        quantites={quantites}
        facteur={facteur}
        nomAliment={vue.nomAliment}
        estQuantiteFigee={vue.estQuantiteFigee}
        manquants={vue.gardeManger ? vue.manquants : null}
        // Le retour porte le hash COMPLET de cette fiche, origine comprise : revenir depuis
        // l'aliment doit ramener ici, et le « ← » d'ici doit continuer de désigner la bonne
        // provenance. Un mot-clé ne saurait pas dire de QUELLE recette on vient.
        lienAliment={(foodId) => hashDeLAliment(foodId, hashDeRecette(recetteId, origine))}
      />

      <SectionMateriel equipements={recette.equipements} catalogue={vue.catalogue} />

      <h2 className="mt-8 text-[1.5rem] text-texte">Préparation</h2>

      {/* L'entrée du mode cuisine (§5bis). Ici et pas en tête de fiche : on le lance au moment de
          se mettre aux fourneaux, après avoir lu les ingrédients.

          ⚠️ LES PORTIONS RÉGLÉES ICI VOYAGENT AVEC LE LIEN. Sans elles, régler 6 portions puis
          appuyer sur ce bouton rouvrait la recette à 4 : l'état React de cette fiche meurt au
          démontage, et un hash ne transporte qu'un identifiant. Le mode cuisine les recopie ensuite
          dans sa session (v11), où elles survivent à la fermeture — ce lien ne sert qu'au premier
          lancement, jamais à la reprise. */}
      {recette.etapes.some((e) => e.nature === 'geste') && (
        <a
          href={hashDeLaCuisine(recette.id, portionsAffichees)}
          className="mt-3 flex min-h-tactile items-center justify-center rounded-[--radius-carte] bg-accent-plein px-4 text-[1.08rem] font-semibold text-white"
        >
          Cuisiner pas à pas
        </a>
      )}

      {/* ⚠️ SEULS LES GESTES SONT NUMÉROTÉS. Les 18 mentions sanitaires vivent dans `etapes` faute
          d'un autre endroit où les écrire, mais les numéroter promettait une action de plus alors
          que le plat est déjà servi — chakchouka annonçait « 6 » pour cinq gestes. */}
      <ol className="mt-3 space-y-4">
        {recette.etapes
          .filter((etape) => etape.nature === 'geste')
          .map((etape, index) => (
            <Etape
              key={etape.ordre}
              numero={index + 1}
              etape={etape}
              catalogue={vue.catalogue}
              ingredients={recette.ingredients}
              quantites={quantites}
              facteur={facteur}
            />
          ))}
      </ol>

      {/* Après la préparation, jamais dedans : ce n'est pas une chose à faire, c'est une chose à
          savoir. Jetons `alerte-*` — ambre, jamais rouge (§6.5 : prévenir sans juger). */}
      {recette.etapes
        .filter((etape) => etape.nature === 'avertissement')
        .map((etape) => (
          <p
            key={etape.ordre}
            className="mt-4 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[1.02rem] leading-relaxed text-alerte-texte"
          >
            {etape.texte}
          </p>
        ))}

      {/* ⚠️ RENDU ICI, ET PAS SEULEMENT DÉFINI PLUS BAS. `lireLesSauces` interrogeait le moteur à
          chaque ouverture de fiche depuis le 2026-08-08 et sa réponse partait à la poubelle : le
          composant existait, personne ne l'appelait. Ni le typecheck, ni la suite, ni l'écran ne
          l'ont signalé — quatrième occurrence du piège « un champ déclaré n'est pas un champ
          branché » (CLAUDE.md). Le test qui suit vérifie la PRÉSENCE de la section, pas seulement
          la forme du composant : un composant juste que rien n'appelle reste invisible.

          Avant les valeurs nutritionnelles : la sauce est une décision de repas, l'énergie une
          information qu'on déplie après. */}
      <SaucesAAjouter
        sauces={vue.sauces}
        afficherEnergie={vue.afficherMacros}
        onBasculer={basculerSauce}
      />

      <ValeursNutritionnelles
        affiche={vue.afficherMacros}
        energiePortion={vue.energiePortion}
        onBasculer={basculerMacros}
      />

      <Sources sources={recette.sources} testeLe={recette.testeLe} />
    </article>
  )
}

/**
 * Libellé de la mention d'origine (§ mention systématique, tête de fiche).
 *
 * ⚠️ TABLE TOTALE, PAS UNE CASCADE DE `if` : une `RecipeOrigine` non traitée doit casser la
 * compilation (`_exhaustive: never`), jamais s'afficher silencieusement chez l'utilisateur.
 */
function mentionOrigine(recette: Recipe): string | null {
  switch (recette.origine) {
    case 'maison':
      return recette.testeLe === null
        ? 'Recette écrite pour cette application, non encore testée.'
        : 'Recette écrite pour cette application.'
    case 'domaine_public':
      return "Recette adaptée d'un ouvrage du domaine public."
    case 'libre':
      return "Recette adaptée d'une source libre."
    // `utilisateur` / `partagee` : jamais atteint ici — `estRecettePerso` garde déjà l'appel (le
    // bandeau perso dit la même chose, en mieux) — mais le type les porte quand même (voir le piège
    // documenté sur `RecipeOrigine`, engine/domain/catalog.ts). `null` : pas de texte mort en double.
    case 'utilisateur':
    case 'partagee':
      return null
    default: {
      const _exhaustive: never = recette.origine
      return _exhaustive
    }
  }
}

/**
 * Sources de la recette — EN BAS DE FICHE, comme une bibliographie.
 *
 * ⚠️ Pas en tête, malgré la tentation. Cet écran se lit debout, mains occupées : deux liens avant
 * le titre repousseraient les ingrédients hors de l'écran au moment où on en a besoin. La réserve
 * courte (« non encore testée ») reste en haut parce qu'elle tient sur une ligne ; les références,
 * qu'on consulte avant ou après avoir cuisiné, jamais pendant, descendent ici.
 *
 * ⚠️ LES DEUX TYPES NE SE FORMULENT PAS PAREIL, et c'est tout l'intérêt de les avoir séparés :
 * `provenance` crédite quelqu'un (auteur et licence obligatoires), `reference` ne fait qu'indiquer
 * ce qui a été consulté. Écrire « d'après X » sur une simple référence prêterait à la recette une
 * origine qu'elle n'a pas.
 */
function Sources({
  sources,
  testeLe,
}: {
  readonly sources: readonly RecipeSource[]
  readonly testeLe: string | null
}) {
  if (sources.length === 0 && testeLe === null) return null

  const provenances = sources.filter((s) => s.type === 'provenance')
  const references = sources.filter((s) => s.type === 'reference')

  return (
    <section className="mt-10 border-t border-bordure pt-5">
      <h2 className="text-[1.5rem] text-texte">Sources</h2>

      {testeLe !== null && (
        <p className="mt-3 text-[1rem] text-texte-doux">Recette cuisinée et jugée le {testeLe}.</p>
      )}

      {provenances.length > 0 && (
        <ul className="mt-3 space-y-2">
          {provenances.map((source) => (
            <li key={source.url} className="text-[1rem] leading-relaxed text-texte-doux">
              D'après{' '}
              <a href={source.url} target="_blank" rel="noreferrer" className="text-accent-texte">
                {source.titre}
              </a>
              {source.auteur === null ? null : <> — {source.auteur}</>}
              {source.licence === null ? null : <> · {source.licence}</>}
            </li>
          ))}
        </ul>
      )}

      {references.length > 0 && (
        <>
          <p className="mt-4 text-[0.9rem] text-attenue">Consulté pour vérifier cette recette :</p>
          <ul className="mt-2 space-y-2">
            {references.map((source) => (
              <li key={source.url} className="text-[1rem] leading-relaxed text-texte-doux">
                <a href={source.url} target="_blank" rel="noreferrer" className="text-accent-texte">
                  {source.titre}
                </a>{' '}
                <span className="text-attenue">(lu le {source.consulteLe})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/**
 * Pays d'origine, d'après la facette `cuisine`.
 *
 * ⚠️ Le libellé accompagne toujours le drapeau. Sur Windows les drapeaux ne se rendent pas (le
 * système n'embarque pas les glyphes, le navigateur montre « FR ») ; sans le mot à côté, l'écran y
 * serait muet. C'est aussi ce qu'impose le bloc commun des maquettes pour toute icône.
 */
function Origines({ recette }: { readonly recette: Recipe }) {
  const cuisines = recette.facettes.filter((f) => f.facette === 'cuisine')
  if (cuisines.length === 0) return null

  return (
    <p className="mt-2 flex flex-wrap gap-2 text-[0.95rem] text-texte-doux">
      {cuisines.map((facette) => {
        const origine = origineDeCuisine(facette.valeur)
        return (
          <span
            key={facette.valeur}
            className="flex items-center gap-1 rounded-[0.5rem] bg-accent-doux px-2 py-1"
          >
            {origine.drapeau !== null && <span aria-hidden="true">{origine.drapeau}</span>}
            {origine.libelle}
          </span>
        )
      })}
    </p>
  )
}

/**
 * Une étape, en GROS BLOC NUMÉROTÉ, avec ses gestes techniques ouvrables (§4.6).
 *
 * ⚠️ LE DÉPLIANT LUI-MÊME A ÉMIGRÉ vers `ui/gestes-etape.tsx` — le mode cuisine en a besoin à
 * l'identique. Sa raison d'être (déplié sur place et non en fenêtre, sous peine de faire perdre
 * l'étape qu'on est en train de lire) est écrite là-bas, avec le reste. §4.6 prévoit une animation ;
 * il n'y a pour l'instant que du texte — les 62 fiches du lexique sont écrites, les illustrations
 * promises par §8.5 n'existent pas.
 */
function Etape({
  numero,
  etape,
  catalogue,
  ingredients,
  quantites,
  facteur,
}: {
  readonly numero: number
  readonly etape: RecipeStep
  readonly catalogue: Catalog
  readonly ingredients: Recipe['ingredients']
  /** Grammes DÉJÀ mis à l'échelle des portions affichées, par `foodId`. */
  readonly quantites: ReadonlyMap<string, number>
  readonly facteur: number
}) {
  // ⚠️ MÊME PRÉPARATION QU'EN MODE CUISINE, mêmes entrées — c'est ce qui garantit que la fiche et le
  // fourneau annoncent le même nombre pour le même ingrédient. Voir `preparerTexteEtape`.
  const redaction = preparerTexteEtape({
    texte: etape.texte,
    ingredients,
    foodIds: etape.foodIds,
    quantites,
    facteur,
    formesAliment: (foodId) => formesDeLAliment(catalogue.foods.get(foodId as never), foodId),
    estQuantiteFigee: (foodId) => catalogue.foods.get(foodId as never)?.quantiteFigee === true,
  })

  return (
    <li className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-doux text-[1.1rem] font-semibold text-accent-texte"
        >
          {numero}
        </span>
        <TexteEtape
          segments={redaction.segments}
          className="text-[1.12rem] leading-relaxed text-texte"
        />
      </div>

      {/* Le retrait aligne les pastilles sur le TEXTE de l'étape, pas sur son numéro. Il appartient
          à cette fiche seule : le mode cuisine, qui ne porte pas de pastille numérotée, n'en veut
          pas — c'est pourquoi il est ici et non dans le composant partagé. */}
      <div className="pl-12">
        {/* ⚠️ MÊME COMPOSANT QU'EN MODE CUISINE, pas une recopie — `ui/ingredients-recette.tsx`.
            Ici la liste complète est déjà en haut de page : la ligne évite de remonter, elle ne
            remplace rien. Elle est donc un AJOUT et jamais un filtre — un lien manqué par la
            dérivation (6 % des gestes) laisse l'étape telle qu'elle était, il n'escamote aucun
            ingrédient. C'est la seule objection qui tenait contre la décision 60.

            ⚠️ `foodIds` EST DÉRIVÉ AU BUILD, jamais saisi dans le YAML : une étape qui n'emploie
            aucun ingrédient — « Préchauffer le four » — ne rend rien du tout, pas une ligne vide. */}
        <QuantitesDeLEtape
          ingredients={ingredients}
          foodIds={etape.foodIds}
          quantites={quantites}
          facteur={facteur}
          nomAliment={(foodId) => catalogue.foods.get(foodId as never)?.nom ?? foodId}
          estQuantiteFigee={(foodId) => catalogue.foods.get(foodId as never)?.quantiteFigee === true}
          sauf={redaction.injectes}
        />
        <GestesDeLEtape etape={etape} catalogue={catalogue} />
      </div>
    </li>
  )
}

/**
 * « Matériel » — les ustensiles de la recette, chacun ouvrant sa définition (§4.4 DESIGN).
 *
 * ⚠️ AUCUN NIVEAU N'EST AFFICHÉ, et c'est un choix. `requis` / `accelere` / `informatif` pilotent le
 * moteur ; les montrer ici lirait « il te manque le bon matériel » sur une fiche que l'utilisateur a
 * ouverte exprès. La liste informe de ce qu'il faut sortir du placard, elle ne trie pas les gens
 * entre équipés et non équipés (principe 6). L'ordre suit celui du catalogue, sans regroupement.
 *
 * La section DISPARAÎT entièrement quand la recette ne déclare rien — pas de « aucun matériel
 * particulier », qui occuperait une place pour ne rien dire.
 */
function SectionMateriel({
  equipements,
  catalogue,
}: {
  readonly equipements: Recipe['equipements']
  readonly catalogue: Catalog
}): React.JSX.Element | null {
  const [ouvert, setOuvert] = useState<EquipmentId | null>(null)

  // Un équipement cité mais absent du référentiel n'a ni nom ni définition à montrer : on le saute
  // plutôt que d'afficher son identifiant. Le build refuse déjà ce cas, ceci couvre un `catalog.db`
  // plus ancien que le référentiel.
  const lignes = equipements
    .map((equipement) => catalogue.equipment.get(equipement.equipmentId))
    .filter((equipement): equipement is Equipment => equipement !== undefined)

  if (lignes.length === 0) return null

  const detail = ouvert === null ? undefined : catalogue.equipment.get(ouvert)

  return (
    <section className="mt-8">
      <h2 className="text-[1.5rem] text-texte">Matériel</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {lignes.map((equipement) => (
          <li key={equipement.id}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setOuvert(equipement.id)}
              className="min-h-tactile rounded-[0.7rem] border border-bordure bg-fond px-3 text-[0.95rem] text-texte-doux"
            >
              {equipement.terme}
            </button>
          </li>
        ))}
      </ul>

      {detail !== undefined && (
        <Panneau titre={detail.terme} onFermer={() => setOuvert(null)}>
          <p className="text-[1rem] leading-relaxed text-texte">{detail.definition}</p>
        </Panneau>
      )}
    </section>
  )
}

/**
 * « Valeurs nutritionnelles », dans une fenêtre en superposition, opt-in (§4.6, §6.5 ARCHITECTURE).
 *
 * ⚠️ CE QUI EST INTERDIT ICI, ET QUI NE DOIT JAMAIS Y REVENIR : un compteur de reste quotidien
 * (« il te reste 340 kcal »), un objectif journalier présenté comme cible, un code couleur
 * rouge/vert, un cumul de la journée mis en avant. §6.5 est explicite : c'est le MÉCANISME de
 * restriction qui est proscrit, pas le chiffre. Une valeur par portion, brute et neutre, est
 * autorisée — et l'apport de référence ne peut être cité qu'EN NOTE, jamais comme un but.
 *
 * ⚠️ PLUS DE DÉPLIANT INLINE. Un dépliant poussait la fiche entière vers le bas (voir l'en-tête de
 * ui/panneau.tsx). `afficherMacros` reste le réglage persisté et partagé avec Paramètres — ce n'est
 * pas ici un simple état d'ouverture de fenêtre : tant qu'il est à `false`, la ligne d'ouverture
 * elle-même ne révèle rien (« Non affichées »), exactement comme le dépliant fermé ne révélait rien
 * avant. La fenêtre héberge à la fois la valeur et le bouton qui bascule ce réglage.
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
  const [ouvert, setOuvert] = useState(false)

  const valeur = !affiche
    ? 'Non affichées'
    : energiePortion === null
      ? 'Non renseignées pour cette recette.'
      : `${Math.round(energiePortion)} kcal par portion`

  return (
    <section className="mt-10 border-t border-bordure pt-5">
      <LigneOuvrante libelle="Valeurs nutritionnelles" valeur={valeur} onOuvrir={() => setOuvert(true)} />

      {ouvert && (
        <Panneau titre="Valeurs nutritionnelles" onFermer={() => setOuvert(false)}>
          {affiche ? (
            <>
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
            </>
          ) : (
            <p className="text-[1rem] leading-relaxed text-texte-doux">
              Masquées par choix. Ce réglage se retrouve aussi dans Paramètres.
            </p>
          )}
          <button
            type="button"
            onClick={onBasculer}
            className="mt-4 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-[0.95rem] font-semibold text-texte-doux"
          >
            {affiche ? 'Masquer ces valeurs' : 'Afficher ces valeurs'}
          </button>
        </Panneau>
      )}
    </section>
  )
}

/**
 * « Une sauce avec ça ? » — décision 62 (2026-08-08).
 *
 * ⚠️ LA SECTION DISPARAÎT ENTIÈREMENT quand `proposer` est faux : un dessert, une sauce, ou un plat
 * qui vient déjà avec la sienne n'affichent rien du tout. Ne pas la remplacer par un « aucune sauce
 * proposée » — ce serait annoncer un manque là où il n'y a pas de question.
 *
 * ⚠️ LES CALORIES DES SAUCES SONT SUR LEUR PROPRE LIGNE, JAMAIS ADDITIONNÉES au plat. C'est la
 * demande explicite de l'utilisateur (« ne pas prendre en compte les calories pour les sauces »),
 * rendue de la seule façon compatible avec le principe 3 : on ne CACHE pas le chiffre, on refuse
 * de le fondre dans un total. Une sauce ajoutée après coup n'est pas toujours mangée, et un total
 * qui l'inclurait mentirait aussi souvent qu'il dirait vrai. Côté moteur, rien n'en descend dans
 * `engine/planning` ni dans `checkCalorieFloor` : le plancher calorique continue de ne compter que
 * les plats.
 *
 * ⚠️ AUCUNE SAUCE N'EST « RECOMMANDÉE ». Les attachées viennent du catalogue, les autres sont
 * alphabétiques — pas de score, pas d'ordre de mérite (principe 6).
 */
function SaucesAAjouter({
  sauces,
  afficherEnergie,
  onBasculer,
}: {
  readonly sauces: VueSauces
  readonly afficherEnergie: boolean
  readonly onBasculer: (sauceId: RecipeId, choisie: boolean) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  if (!sauces.proposer) return null

  const total = sauces.attachees.length + sauces.autres.length
  // ⚠️ CE QUE L'UTILISATEUR A CHOISI PASSE DEVANT CE QUE LE CATALOGUE PROPOSE. Sans ça, la ligne
  // repliée dirait « 1 proposée avec ce plat » à quelqu'un qui en a déjà retenu deux : le seul
  // endroit où l'on voit son choix sans ouvrir la fenêtre annoncerait autre chose que son choix.
  const choisies = [...sauces.attachees, ...sauces.autres].filter((s) => s.choisie).length
  const valeur =
    choisies > 0
      ? `${choisies} dans vos courses`
      : total === 0
        ? 'Aucune ne convient à vos réglages'
        : sauces.attachees.length > 0
          ? `${sauces.attachees.length} proposée${sauces.attachees.length > 1 ? 's' : ''} avec ce plat`
          : `${total} au catalogue`

  return (
    <section className="mt-10 border-t border-bordure pt-5">
      <LigneOuvrante libelle="Ajouter une sauce" valeur={valeur} onOuvrir={() => setOuvert(true)} />

      {ouvert && (
        <Panneau titre="Ajouter une sauce" onFermer={() => setOuvert(false)}>
          <p className="text-[0.95rem] leading-relaxed text-texte-doux">
            À préparer à côté et à servir avec. Rien n'est ajouté à la recette ni à ses quantités.
            Une sauce que vous retenez entre dans vos courses chaque fois que ce plat est prévu.
          </p>

          {sauces.attachees.length > 0 && (
            <>
              <h3 className="mt-5 text-[0.85rem] font-semibold uppercase tracking-wide text-attenue">
                Avec ce plat
              </h3>
              <ul className="mt-2">
                {sauces.attachees.map((sauce) => (
                  <LienSauce
                    key={sauce.id}
                    sauce={sauce}
                    afficherEnergie={afficherEnergie}
                    onBasculer={onBasculer}
                  />
                ))}
              </ul>
            </>
          )}

          {sauces.autres.length > 0 && (
            <>
              <h3 className="mt-5 text-[0.85rem] font-semibold uppercase tracking-wide text-attenue">
                {sauces.attachees.length > 0 ? 'Autres sauces' : 'Toutes les sauces'}
              </h3>
              <ul className="mt-2">
                {sauces.autres.map((sauce) => (
                  <LienSauce
                    key={sauce.id}
                    sauce={sauce}
                    afficherEnergie={afficherEnergie}
                    onBasculer={onBasculer}
                  />
                ))}
              </ul>
            </>
          )}

          {total === 0 && (
            <p className="mt-5 text-[1rem] leading-relaxed text-texte">
              Aucune sauce du catalogue ne convient à vos allergies et à votre régime.
            </p>
          )}

          {/* Le nombre écarté se dit TOUJOURS, y compris quand il reste des sauces à l'écran : sans
              lui, une liste amputée par une allergie ressemble à un catalogue pauvre. */}
          {sauces.ecartees > 0 && (
            <p className="mt-4 text-[0.9rem] leading-relaxed text-attenue">
              {sauces.ecartees} sauce{sauces.ecartees > 1 ? 's' : ''} écartée
              {sauces.ecartees > 1 ? 's' : ''} par vos allergies, votre régime ou vos exclusions.
            </p>
          )}
        </Panneau>
      )}
    </section>
  )
}

/**
 * Une sauce dans la liste : son nom, son énergie sur sa PROPRE ligne, le lien vers sa fiche, et le
 * bouton qui la fait entrer dans les courses.
 *
 * ⚠️ DEUX CIBLES DISTINCTES, PAS UNE LIGNE CLIQUABLE À DOUBLE SENS. Aller lire la recette et décider
 * de l'acheter toutes les semaines ne se ressemblent pas assez pour partager un geste, et la seconde
 * est difficile à défaire si on la déclenche par erreur. Le lien reste un lien, le choix est un
 * `<button aria-pressed>` — comme l'étoile des favoris ailleurs dans l'application.
 */
function LienSauce({
  sauce,
  afficherEnergie,
  onBasculer,
}: {
  readonly sauce: LigneSauce
  readonly afficherEnergie: boolean
  readonly onBasculer: (sauceId: RecipeId, choisie: boolean) => void
}) {
  return (
    <li className="border-b border-bordure py-1 last:border-b-0">
      <a
        href={hashDeRecette(sauce.id, 'recettes')}
        className="flex min-h-tactile items-center justify-between gap-3 py-2 text-[1.05rem] text-texte no-underline"
      >
        <span>{sauce.nom}</span>
        {afficherEnergie && sauce.energiePortion !== null && (
          <span className="shrink-0 tabular-nums text-[0.9rem] text-attenue">
            {Math.round(sauce.energiePortion)} kcal / portion
          </span>
        )}
      </a>
      <button
        type="button"
        onClick={() => onBasculer(sauce.id, !sauce.choisie)}
        aria-pressed={sauce.choisie}
        className={
          'mb-1 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-3 text-[0.95rem] font-semibold ' +
          (sauce.choisie
            ? 'border-2 border-accent bg-accent-doux text-accent-texte'
            : 'border border-bordure-forte bg-surface text-texte-doux')
        }
      >
        {sauce.choisie ? '✓ Je la prends toujours avec ce plat' : 'Je la prends toujours avec ce plat'}
      </button>
    </li>
  )
}
