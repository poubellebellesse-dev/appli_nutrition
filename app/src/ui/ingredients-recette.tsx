// ui/ingredients-recette.tsx — la liste d'ingrédients et son sélecteur de portions, PARTAGÉS.
//
// ⚠️ EXTRAIT DE `screens/detail-recette.tsx`, PAS RECOPIÉ. Le mode cuisine avait besoin de la même
// liste ; en écrire un jumeau aurait ajouté un quatrième cas au motif que `7040c33` a dû réunir —
// trois tables jumelles, dont une avait déjà divergé. La règle d'affichage des quantités est trop
// subtile pour vivre en deux exemplaires : son en-tête (`ui/quantites.ts`) fait quinze lignes et
// raconte un bug déjà payé.
//
// ⚠️ CE FICHIER NE MET RIEN À L'ÉCHELLE. `quantites` lui arrive DÉJÀ calculé par `scaleRecipe` ;
// c'est l'appelant qui décide pour combien de portions, parce que les deux écrans ne tiennent pas
// cette décision au même endroit — la fiche dans un état React éphémère, le mode cuisine dans la
// session persistée (schéma v11).

import type { Recipe } from '../engine/domain/index.js'
import { quantiteAffichee } from './quantites.js'

/**
 * Les ingrédients d'une recette, avec leurs quantités mises à l'échelle des portions demandées.
 *
 * ⚠️ ON AFFICHE LE LIBELLÉ MIS À L'ÉCHELLE, PAS DES GRAMMES. `scaleRecipe` recalcule bien les
 * grammes mais laisse `uniteAffichage` verbatim, à dessein — « 2 carottes » ne se met pas à
 * l'échelle sans réécrire du français. Afficher le libellé brut donnait des quantités qui ne
 * bougeaient jamais ; tout convertir en grammes rendait « 20 cl de crème » en « 206 g ».
 * `quantiteAffichee` tient la règle et ses trois cas.
 */
export function ListeIngredients({
  ingredients,
  quantites,
  facteur,
  nomAliment,
  estFondDePlacard,
  manquants,
  lienAliment,
}: {
  readonly ingredients: Recipe['ingredients']
  /** Grammes DÉJÀ mis à l'échelle, par `foodId`. Repli sur `quantiteG` quand la clé manque. */
  readonly quantites: ReadonlyMap<string, number>
  /** Portions demandées / portions de la recette. */
  readonly facteur: number
  readonly nomAliment: (foodId: string) => string
  readonly estFondDePlacard: (foodId: string) => boolean
  /**
   * `null` = NE RIEN SIGNALER.
   *
   * C'est ce que passe le mode cuisine : on n'annonce pas « à acheter » à quelqu'un qui a déjà la
   * poêle sur le feu. Sur la fiche, `null` couvre aussi le garde-manger vide — sans quoi CHAQUE
   * ligne serait marquée « à acheter », ce qui n'informe plus de rien et noie la liste (§4.6).
   */
  readonly manquants: ReadonlySet<string> | null
  /**
   * Hash de la fiche de l'aliment, ou `undefined` pour n'en poser aucun.
   *
   * ⚠️ OPTIONNELLE, ET LE MODE CUISINE NE LA PASSE PAS — c'est tout l'intérêt de la faire décider
   * par l'appelant. Sur la fiche, ouvrir un ingrédient est une consultation ; en pleine cuisson,
   * c'est un lien plein écran sous un doigt couvert de farine, qui ferait quitter les étapes en
   * cours. Le même composant, deux lectures, comme pour `manquants`.
   */
  readonly lienAliment?: (foodId: string) => string
}) {
  return (
    <ul className="mt-3 space-y-1">
      {ingredients.map((ingredient) => {
        const foodId = ingredient.foodId as string
        const quantite = quantiteAffichee({
          libelle: ingredient.uniteAffichage,
          facteur,
          fondDePlacard: estFondDePlacard(foodId),
          grammes: quantites.get(foodId) ?? ingredient.quantiteG,
        })
        return (
          <li key={foodId} className="flex flex-wrap items-baseline gap-x-2 py-1 text-[1.08rem] text-texte">
            {/* Le LIBELLÉ est mis à l'échelle, pas converti en grammes : il porte déjà la bonne
                unité (pièces, cuillères, centilitres), que le catalogue, lui, ignore. Voir
                ui/quantites.ts pour la règle et ses limites. */}
            <span className="tabular-nums text-texte-doux">{quantite.texte}</span>
            {/* Le nom porte le lien, pas la ligne entière : « à acheter » et « non ajustée » sont
                des mentions du contexte, pas de l'aliment, et les inclure dans la zone cliquable
                ferait un lien dont le libellé lu à voix haute ne désigne plus sa destination. */}
            {lienAliment === undefined ? (
              <span>{nomAliment(foodId)}</span>
            ) : (
              <a href={lienAliment(foodId)} className="text-accent-texte no-underline">
                {nomAliment(foodId)}
              </a>
            )}
            {ingredient.optionnel && <span className="text-[0.9rem] text-attenue">(facultatif)</span>}
            {/* Dire QUAND une quantité ne suit pas les portions, sinon on croit à un bug — c'est
                précisément ce qui a été signalé quand tout partait en grammes. */}
            {quantite.fige && (
              <span className="text-[0.85rem] text-attenue">· quantité au goût, non ajustée</span>
            )}
            {/* « Absents du garde-manger signalés DISCRÈTEMENT » (§4.6) : une mention, pas un
                avertissement — ne rien avoir chez soi est le cas normal, pas un problème. */}
            {manquants?.has(foodId) === true && (
              <span className="text-[0.85rem] text-attenue">· à acheter</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Les quantités des ingrédients employés par UNE étape, sous son texte, en mode cuisine.
 *
 * ⚠️ ELLE AJOUTE, ELLE NE FILTRE PAS. C'est la condition qui rend la dérivation acceptable : la
 * liste complète reste à un tap, donc un ingrédient manqué par le rapprochement ne disparaît de
 * nulle part. Le jour où quelqu'un voudra en faire un filtre, qu'il relise la décision 60 — une
 * étape sur seize afficherait une liste vide, et 5 % des ingrédients ne s'afficheraient jamais.
 *
 * ⚠️ RIEN N'EST RENDU QUAND L'ÉTAPE N'EMPLOIE AUCUN INGRÉDIENT, et c'est fréquent : « Préchauffer
 * le four », « Enfourner », « Couvrir et laisser mijoter ». Un bandeau vide ou un « — » occuperait
 * de la place pour ne rien dire, sur l'écran qui a le moins de place et le plus besoin d'air.
 *
 * ⚠️ PAS DE MENTION « quantité au goût, non ajustée » ICI, contrairement à la liste. Elle y sert à
 * expliquer pourquoi un nombre n'a pas bougé quand on change les portions ; ici il n'y a pas de
 * sélecteur sous les yeux, et « au goût » se suffit. La mention appartient à l'endroit où l'on règle.
 */
export function QuantitesDeLEtape({
  ingredients,
  foodIds,
  quantites,
  facteur,
  nomAliment,
  estFondDePlacard,
}: {
  readonly ingredients: Recipe['ingredients']
  /** `RecipeStep.foodIds` — dérivé au build, sous-ensemble garanti de `ingredients`. */
  readonly foodIds: readonly string[]
  /** Grammes DÉJÀ mis à l'échelle, par `foodId`. */
  readonly quantites: ReadonlyMap<string, number>
  readonly facteur: number
  readonly nomAliment: (foodId: string) => string
  readonly estFondDePlacard: (foodId: string) => boolean
}) {
  const vises = new Set(foodIds)
  // ⚠️ ON PARCOURT `ingredients`, PAS `foodIds` : l'ordre affiché reste celui de la recette, le même
  // que dans la fenêtre. Suivre l'ordre des `foodIds` ferait changer la place d'un ingrédient d'une
  // étape à l'autre, et l'œil devrait le rechercher à chaque fois.
  const employes = ingredients.filter((i) => vises.has(i.foodId as string))
  if (employes.length === 0) return null

  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[1.02rem] text-texte-doux">
      {employes.map((ingredient) => {
        const foodId = ingredient.foodId as string
        const quantite = quantiteAffichee({
          libelle: ingredient.uniteAffichage,
          facteur,
          fondDePlacard: estFondDePlacard(foodId),
          grammes: quantites.get(foodId) ?? ingredient.quantiteG,
        })
        return (
          <span key={foodId} className="whitespace-nowrap">
            <span className="tabular-nums font-semibold text-texte">{quantite.texte}</span>{' '}
            {nomAliment(foodId)}
          </span>
        )
      })}
    </p>
  )
}

/**
 * Sélecteur de portions qui recalcule EN DIRECT (§4.6).
 *
 * ⚠️ Ce n'est pas le même réglage que `convives` de l'écran Semaine ni que `facteurPortion` du
 * profil. Ici on demande « pour combien de personnes je cuisine CE plat, maintenant » — un ajustement
 * ponctuel de lecture, qui n'influence aucune suggestion.
 *
 * ⚠️ SA PERSISTANCE DÉPEND DE L'APPELANT, et les deux réponses sont volontairement différentes. Sur
 * la fiche, rien n'est gardé : la valeur meurt avec l'écran, sinon une recette prévue pour 4
 * s'ouvrirait sur les 8 réglées SUR UNE AUTRE. En mode cuisine elle est écrite dans la session
 * (v11), parce qu'une cuisson en cours n'est pas une lecture — la redemander à la reprise ferait
 * répéter la même réponse les mains dans la farine.
 */
export function SelecteurPortions({
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
