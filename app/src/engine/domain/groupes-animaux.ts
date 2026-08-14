// engine/domain/groupes-animaux.ts — les groupes d'aliments d'origine animale.
//
// TypeScript pur, entrées objets → sorties objets. N'importe ni react, ni sqlite, ni features/.
//
// ⚠️ CE MODULE NE CHOISIT RIEN ET N'EXCLUT RIEN. Il répond à une question factuelle — « quels
// groupes d'origine animale ce catalogue contient-il, et qui est dans chacun ? ». Aucune couche de
// sélection ne l'appelle, aucun score n'en dépend, le registre reste à 16 couches. Même parti que
// `sauces.ts`, voisin de fichier : l'information est exposée, jamais pondérée.
//
// ⚠️ POURQUOI CETTE CORRESPONDANCE VIT ICI ET NULLE PART AILLEURS. « `mammifere` + `production` →
// *lait et produits laitiers* » n'est écrite qu'à un seul endroit, exprès
// (docs/CONCEPTION_REGIME_PERSONNALISE.md §3, lot A). Posée dans un composant React, elle serait
// recopiée au deuxième écran qui en a besoin, et les deux copies divergeraient — c'est le mode de
// défaillance silencieux que `RAYONS_ALIMENTAIRES` (planning/shopping-list.ts) évite déjà en
// dérivant sa liste au lieu de la recopier.
//
// ⚠️ DES LIBELLÉS FRANÇAIS EN SORTIE DE `engine/`, ET C'EST LA PRATIQUE ÉTABLIE ICI. `rayonDe`
// range déjà des aliments en catégories humaines françaises (« crèmerie », « épicerie »), en
// s'appuyant sur la même origine animale. Repousser ces sept libellés dans l'interface au nom de la
// pureté les ferait exister en double le jour du deuxième écran, ce que l'alinéa précédent existe
// pour empêcher.

import type { Food } from './catalog.js'
import { resolveAnimalOrigin, resolveAnimalProvenance } from './catalog.js'
import type { FoodId } from './ids.js'

/**
 * Identifiant stable d'un groupe. Ne dépend d'aucun libellé : c'est lui qui se stocke, pas le mot.
 *
 * ⛔ CHANGER CETTE UNION OBLIGE À UNE MIGRATION DE `user.db`. Ces sept valeurs sont ÉCRITES EN BASE
 * utilisateur — `user_excluded_group.groupe_id` (data/user-schema.ts, v15) — et le dépliage en
 * aliments se fait à la lecture, en cherchant l'id dans la sortie de `groupesAnimaux`. Un
 * `groupe_id` stocké qui ne correspond plus à aucun groupe ne se déplie sur RIEN : il n'exclut plus
 * rien, en silence, et quelqu'un qui avait retiré un groupe le remange sans qu'aucune erreur ne le
 * dise. C'est la seule polarité non sûre de ce mécanisme.
 *
 * Renommer, scinder ou retirer une valeur (la dette `insecte` → *miel*, plus bas, en est le cas
 * prévu) exige donc de RÉÉCRIRE les `groupe_id` déjà stockés dans la même migration. Le `CHECK` posé
 * sur la colonne existe pour rendre cet oubli impossible : il fige les sept valeurs en SQL, si bien
 * qu'ajouter la huitième force une reconstruction de table, donc une migration qu'on ne peut pas ne
 * pas écrire. Il ne protège rien à l'exécution — ⛔ NE PAS LE RETIRER POUR AUTANT, c'est un
 * fil-piège, pas un garde-fou, et son commentaire dans `user-schema.ts` le dit aussi.
 */
export type GroupeAnimalId =
  | 'laitiers'
  | 'oeufs'
  | 'miel'
  | 'viande_mammifere'
  | 'volaille'
  | 'poisson'
  | 'fruits_de_mer'

export interface GroupeAnimal {
  readonly id: GroupeAnimalId
  readonly libelle: string
  /** Les aliments du groupe, triés par nom. JAMAIS vide — voir `groupesAnimaux`. */
  readonly aliments: readonly Food[]
}

/**
 * Les sept groupes, dans l'ordre où ils sortent de `groupesAnimaux`.
 *
 * ⚠️ L'ORDRE EST CELUI DU SENS, PAS CELUI DES COMPTES. Ce que l'animal PRODUIT d'abord (lait, œuf,
 * miel), l'animal lui-même ensuite. Trier par effectif ferait bouger l'écran de réglages à chaque
 * lot de contenu, sur des positions que l'utilisateur aura mémorisées.
 */
const ORDRE: readonly { readonly id: GroupeAnimalId; readonly libelle: string }[] = [
  { id: 'laitiers', libelle: 'Lait et produits laitiers' },
  { id: 'oeufs', libelle: 'Œufs' },
  { id: 'miel', libelle: 'Miel' },
  { id: 'viande_mammifere', libelle: 'Viande de mammifère' },
  { id: 'volaille', libelle: 'Volaille' },
  { id: 'poisson', libelle: 'Poisson' },
  { id: 'fruits_de_mer', libelle: 'Fruits de mer' },
]

/**
 * Le groupe d'un aliment — `null` s'il n'a aucune origine animale résolue (végétal, minéral).
 *
 * Les deux faits se lisent par `resolveAnimalOrigin` / `resolveAnimalProvenance`, qui remontent la
 * chaîne `deriveDe` : le beurre ne déclare rien et tombe dans *lait et produits laitiers* par son
 * ascendant `lait_entier`. ⛔ NE PAS RÉÉCRIRE CETTE REMONTÉE ICI — elle porte une garde anti-cycle
 * et un invariant (« provenance nulle si et seulement si origine nulle ») qu'un second parcours
 * pourrait rompre en s'arrêtant sur un autre ancêtre.
 *
 * ⚠️ LA PROVENANCE N'EST LUE QUE POUR `mammifere` ET `volaille`, exactement comme dans
 * `regimeExigePar` (engine/selection/regime.ts), et pour la même raison : c'est la seule branche où
 * elle discrimine. Un poisson d'élevage et des œufs de lompe sont tous deux du poisson pour qui
 * choisit ce qu'il mange ; la distinction corps/production n'y sépare rien qu'un écran de réglages
 * puisse proposer.
 *
 * ⚠️ UNE PROVENANCE ABSENTE TOMBE DANS LE GROUPE « CORPS », JAMAIS DANS « PRODUCTION ». Même
 * polarité que `regimeExigePar`, qui rend `omnivore` en cas d'ignorance plutôt que `vegetarien` :
 * l'erreur qui retire un aliment de trop est réparable par l'utilisateur, celle qui en laisse passer
 * un ne se voit pas. Le build refuse une origine sans provenance (`catalog/build.mjs`), donc le cas
 * ne vient pas du catalogue, et **depuis le lot 66 le TYPE `Food` ne le laisse plus écrire non
 * plus** : `origineAnimale` est une paire, la moitié de paire est inexprimable.
 *
 * ⛔ CE REPLI RESTE, ET CE N'EST PAS DU CODE MORT. Cette fonction tourne aussi sur des aliments
 * montés à la main — recettes perso, contre un `user.db` qui n'a aucune clé étrangère vers le
 * catalogue — et sur des bases construites ailleurs. Le type garantit ce qu'on ÉCRIT, pas ce qui
 * ARRIVE. `groupes-animaux.test.ts` mesure encore la polarité, par cast explicite et commenté.
 *
 * ⚠️ `insecte` → *miel* NOMME LE SEUL MEMBRE ACTUEL. Le jour où un insecte comestible entre au
 * catalogue en `corps` (farine de grillon), ce libellé devient faux et il faudra scinder le groupe.
 * Aucune garde ne le signalera : c'est une dette, elle est écrite ici.
 */
export function groupeAnimalDe(food: Food, foods: ReadonlyMap<FoodId, Food>): GroupeAnimalId | null {
  const origine = resolveAnimalOrigin(food, foods)
  if (origine === null) return null

  const production = resolveAnimalProvenance(food, foods) === 'production'
  switch (origine) {
    case 'mammifere':
      return production ? 'laitiers' : 'viande_mammifere'
    case 'volaille':
      return production ? 'oeufs' : 'volaille'
    case 'poisson':
      return 'poisson'
    case 'fruit_de_mer':
      return 'fruits_de_mer'
    case 'insecte':
      return 'miel'
  }
}

/**
 * Les groupes d'origine animale présents dans ce catalogue, avec leurs aliments.
 *
 * ⚠️ UN GROUPE VIDE N'EST PAS RENDU. Une case à cocher « Fruits de mer (0) » n'a rien à faire dans
 * un écran de réglages : elle propose de retirer ce qui n'existe pas. La contrepartie est que la
 * LONGUEUR de la sortie décrit le catalogue, pas le type — ne pas parier dessus.
 *
 * Coût : un parcours de chaîne `deriveDe` par aliment (profondeur bornée par le contenu, 2 dans le
 * catalogue réel), puis un tri par groupe.
 */
export function groupesAnimaux(foods: ReadonlyMap<FoodId, Food>): readonly GroupeAnimal[] {
  const parGroupe = new Map<GroupeAnimalId, Food[]>()

  for (const food of foods.values()) {
    const id = groupeAnimalDe(food, foods)
    if (id === null) continue
    const liste = parGroupe.get(id)
    if (liste === undefined) parGroupe.set(id, [food])
    else liste.push(food)
  }

  return ORDRE.flatMap(({ id, libelle }) => {
    const aliments = parGroupe.get(id)
    if (aliments === undefined) return []
    // Même tri que `saucesProposees` (domain/sauces.ts) : `localeCompare('fr')`, sans quoi « Œuf »
    // et « Épaule » partiraient en fin de liste par leur point de code.
    return [{ id, libelle, aliments: [...aliments].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) }]
  })
}

/**
 * Les aliments réellement écartés, à partir de ce que l'utilisateur a COCHÉ.
 *
 *     exclus = ( ⋃ aliments(g) pour g retiré ∪ aliments cochés seuls ) \ ré-admis
 *
 * ⚠️ UNE SEULE ÉCRITURE DE CETTE RÈGLE, et c'est pour cela qu'elle est ici plutôt que dans le
 * magasin. Deux appelants en ont besoin : `readExcludedFoodIdsDeplies` (data/user-store.ts), qui
 * déplie ce qui est EN BASE pour le moteur, et l'écran de réglages, qui doit compter les plats
 * restants sur un état d'écran encore plus récent que la base. Recopier le dépliage dans le second
 * ferait diverger le compteur des suggestions au premier ajustement — et c'est le compteur qui
 * aurait tort sans que rien ne le dise.
 *
 * ⚠️ LE DÉPLIAGE SE FAIT À LA LECTURE, CONTRE `groupes`. Passer les groupes du catalogue DU JOUR est
 * toute la décision du lot B : un aliment ajouté au catalogue après le cochage entre de lui-même
 * dans le groupe déjà coché. `groupes` peut donc être vide sans que ce soit une erreur — c'est le
 * cas quand aucun groupe n'est retiré et que l'appelant s'épargne le parcours du catalogue.
 *
 * ⚠️ UNE RÉ-ADMISSION HORS GROUPE RETIRÉ EST INERTE, PAS FAUSSE. Elle ne retire rien à
 * `alimentsSeuls`, qui n'est pas censé la contenir (les deux tables restent disjointes à
 * l'écriture) ; elle reprend effet telle quelle si le groupe est recoché.
 *
 * Sortie triée — un ordre stable rend les comparaisons de tests lisibles et l'écriture idempotente.
 */
export function deplierGroupesRetires(
  groupes: readonly GroupeAnimal[],
  groupesRetires: ReadonlySet<GroupeAnimalId>,
  alimentsSeuls: Iterable<FoodId>,
  reAdmis: Iterable<FoodId>
): readonly FoodId[] {
  const exclus = new Set<FoodId>(alimentsSeuls)
  for (const groupe of groupes) {
    if (!groupesRetires.has(groupe.id)) continue
    for (const aliment of groupe.aliments) exclus.add(aliment.id)
  }
  for (const foodId of reAdmis) exclus.delete(foodId)
  return [...exclus].sort()
}
