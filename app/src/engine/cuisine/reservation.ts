// engine/cuisine/reservation.ts — deux plats se disputent-ils un ustensile, et QUAND ?
//
// À quoi ça sert : `equipement-partage.ts` savait dire « le four est utilisé par le colin et le
// gratin ». Il ne savait pas dire QUAND, et c'est la seule chose dont on ait besoin pour s'organiser.
// Nommer sans dater produisait 63 % de fausses alertes — deux plats qui « se disputent » le four
// alors que l'un y passe au début et l'autre à la fin ne se disputent rien du tout.
//
// ---------------------------------------------------------------------------------------------
// TROIS CHOSES QU'IL FAUT AVOIR LUES AVANT DE TOUCHER À CE FICHIER
//
// ⛔ 1. DEUX OCCUPATIONS DU MÊME PLAT NE SONT JAMAIS UN CONFLIT. `colin_four_fenouil` enfourne le
// fenouil seul, SORT LE PLAT, pose le poisson, remet : deux occupations du four, l'une après
// l'autre. Un moteur qui compterait les occupations verrait deux demandes et crierait. On compte
// donc des RECETTES DISTINCTES, jamais des occupations.
//
// ⛔ 2. `null` NE VAUT PAS 1. `capaciteDe` rend `null` pour « on ne sait pas » — c'est l'état d'un
// ustensile `selon_quantite` dont la personne n'a pas dit combien elle en possède. Le supposer à 1
// rouvrirait exactement les fausses alertes que ce chantier ferme : une plaque à 4 feux signalerait
// un conflit dès la deuxième casserole. **Sans réponse, le moteur se tait.** C'est aussi ce qui rend
// 65a strictement additif : la plaque entre au catalogue sans rien déclencher, et 65b l'allumera.
//
// ⛔ 3. L'AXE REMONTE. Comme dans `ordonnancement.ts`, tout se compte en MINUTES AVANT LE SERVICE,
// jamais en heures d'horloge — le mode cuisine ne sait pas à quelle heure on mange, il sait combien
// de temps avant. Une fenêtre non vide a donc `debut > fin` : le début est plus LOIN du service.
// Écrire `debut < fin` par réflexe d'axe croissant produit des fenêtres vides et un moteur muet.
//
// ---------------------------------------------------------------------------------------------
// LE MODÈLE DE TEMPS, ET CE QU'IL SUPPOSE
//
// Tous les plats d'un repas sont servis ENSEMBLE : la dernière étape de chacun tombe au service. La
// fenêtre d'une occupation se calcule donc à rebours depuis la fin de la recette, en additionnant
// les durées de `segmentsDeLaRecette`.
//
// ⚠️ CE MODÈLE NE DÉCALE PAS LES PLATS. `ordonnancerCuissons` sait reculer un départ pour que les
// GESTES ne se heurtent pas ; ici on répond à une autre question — « l'ustensile est-il pris deux
// fois ? » — et y répondre sur des départs déjà décalés dirait « pas de conflit » parce que
// l'ordonnanceur l'a évité, pas parce qu'il n'existait pas. Les deux modules se lisent côte à côte,
// ils ne s'empilent pas.
//
// Dépendances autorisées : ../domain/index.js pour les types, ./segments.js pour le découpage.

import type { EquipmentId, EquipmentSharing, Recipe, RecipeId } from '../domain/index.js'
import { segmentsDeLaRecette } from './segments.js'

/**
 * Combien de plats un ustensile porte en même temps, d'après ce que le CATALOGUE dit de lui.
 *
 * ⚠️ `selon_quantite` SANS QUANTITÉ REND `null`, ET C'EST TOUT L'INTÉRÊT DE LA TROISIÈME VALEUR. La
 * plaque est nommée sans être répondue : le catalogue sait qu'une plaque a plusieurs feux, il ne
 * sait pas combien la personne en possède. `null` fait taire le moteur, et c'est ce qui rend 65a
 * strictement additif — la plaque entre au catalogue sans déclencher une seule alerte.
 *
 * ⭐ DEPUIS LE LOT 65c, LA PERSONNE PEUT RÉPONDRE. `quantiteDeclaree` vient de `user_equipment`
 * (`readEquipmentQuantite`) et l'appelant la passe ; le moteur, lui, ne lit aucune base. ⛔ L'ARGUMENT
 * RESTE OPTIONNEL, et pas par commodité : un appelant qui ne le passe pas retrouve exactement le
 * comportement d'avant, donc ajouter la quantité ne peut allumer aucune alerte ailleurs.
 *
 * ⛔ NE PAS REPLIER `null` SUR 1 « en attendant ». 260 recettes réclament la plaque : l'avertissement
 * se déclencherait sur presque chaque paire de plats jusqu'à ce que plus personne ne le lise. C'est
 * l'erreur que `CODES_INDIVISIBLES` évitait par une liste en dur, et que ceci remplace par une
 * donnée.
 *
 * @param partageable ce que le référentiel dit de l'ustensile, ou `null` s'il est inconnu
 */
export function capaciteDepuisPartage(
  partageable: EquipmentSharing | null,
  quantiteDeclaree?: number | null,
): number | null {
  if (partageable === 'jamais') return 1
  if (partageable === 'toujours') return Number.POSITIVE_INFINITY
  // ⭐ LOT 65c : la personne a répondu à la question que le catalogue ne pouvait pas trancher.
  if (partageable === 'selon_quantite' && typeof quantiteDeclaree === 'number' && quantiteDeclaree > 0) {
    return quantiteDeclaree
  }
  // `selon_quantite` sans réponse, et l'ustensile inconnu : on ne sait pas, donc on se tait.
  return null
}

/**
 * Un ustensile demandé par plus de plats à la fois qu'il n'en supporte, et la fenêtre pendant
 * laquelle ça arrive.
 */
export interface Conflit {
  readonly equipmentId: EquipmentId
  /** Les recettes en cause, triées par id — reproductible à entrée égale. */
  readonly recipeIds: readonly RecipeId[]
  /** Minutes avant le service, au DÉBUT de la fenêtre. Plus grand que `finAvantServiceMin`. */
  readonly debutAvantServiceMin: number
  readonly finAvantServiceMin: number
}

/** Une occupation posée sur l'axe du temps. `debut > fin`, l'axe remonte vers le passé. */
interface Fenetre {
  readonly equipmentId: EquipmentId
  readonly recipeId: RecipeId
  readonly debut: number
  readonly fin: number
}

/**
 * Le bruit sous lequel deux bornes sont la même. Les durées de segments sont fractionnaires par
 * construction (un budget réparti sur trois étapes tombe en tiers) et les additions flottantes
 * laissent des poussières. Même seuil et même raison que `BRUIT_MIN` dans `ordonnancement.ts`.
 */
const BRUIT_MIN = 1e-6

/**
 * Les fenêtres d'occupation d'une recette, en minutes avant le service.
 *
 * ⚠️ LES ÉTAPES `avertissement` NE SONT PAS DES SEGMENTS — elles se lisent, elles ne prennent pas de
 * temps. Une occupation ne peut pas en porter une : le build ne la dérive que sur des gestes.
 */
function fenetresDuPlat(recette: Recipe): readonly Fenetre[] {
  const segments = segmentsDeLaRecette(recette)

  // Minutes restantes AVANT le service au moment où chaque étape COMMENCE, et où elle se termine.
  const debutParOrdre = new Map<number, number>()
  const finParOrdre = new Map<number, number>()
  let restant = segments.reduce((somme, s) => somme + s.dureeMin, 0)
  for (const segment of segments) {
    debutParOrdre.set(segment.ordre, restant)
    restant -= segment.dureeMin
    finParOrdre.set(segment.ordre, restant)
  }

  const fenetres: Fenetre[] = []
  for (const occupation of recette.occupations) {
    const debut = debutParOrdre.get(occupation.ordreDebut)
    const fin = finParOrdre.get(occupation.ordreFin)
    // Une occupation dont l'étape n'a pas de segment ne se place pas sur l'axe. Le cas n'existe pas
    // au catalogue ; on l'ignore plutôt que d'inventer une position, parce qu'une fenêtre inventée
    // ferait signaler un conflit qui n'a jamais eu lieu.
    if (debut === undefined || fin === undefined || debut - fin <= BRUIT_MIN) continue
    fenetres.push({ equipmentId: occupation.equipmentId, recipeId: recette.id, debut, fin })
  }
  return fenetres
}

/**
 * Les ustensiles demandés par trop de plats à la fois, avec la fenêtre en cause.
 *
 * @param plats les recettes du repas, servies ensemble
 * @param capaciteDe combien de plats l'ustensile porte EN MÊME TEMPS, par `code` d'ustensile.
 *                   `null` = on ne sait pas, et le moteur se tait. `Infinity` = aucune limite.
 * @returns un conflit par fenêtre, trié par ustensile puis par début décroissant (le plus tôt
 *          d'abord). Vide quand rien ne se dispute.
 *
 * ⚠️ AUCUN SCORE, AUCUNE COULEUR, AUCUN CLASSEMENT. Le retour est un FAIT : cet ustensile, ces
 * plats, cette fenêtre. La personne a choisi ces plats ; l'appli l'aide à s'organiser, elle ne juge
 * pas son menu (principe 6).
 *
 * Coût : O(F² ) où F est le nombre de fenêtres — quelques unités en pratique, le mode cuisine porte
 * 2 à 4 plats.
 */
export function conflitsDEquipement(
  plats: readonly Recipe[],
  capaciteDe: (code: string) => number | null,
): readonly Conflit[] {
  const parUstensile = new Map<EquipmentId, Fenetre[]>()
  for (const plat of plats) {
    for (const fenetre of fenetresDuPlat(plat)) {
      const liste = parUstensile.get(fenetre.equipmentId)
      if (liste === undefined) parUstensile.set(fenetre.equipmentId, [fenetre])
      else liste.push(fenetre)
    }
  }

  const conflits: Conflit[] = []
  for (const [equipmentId, fenetres] of [...parUstensile].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const capacite = capaciteDe(equipmentId)
    // `null` = inconnu, `Infinity` = illimité : dans les deux cas il n'y a rien à annoncer. Le test
    // scellé du lot D vérifie les deux séparément — ce ne sont pas la même chose, et les confondre
    // ferait taire un ustensile qu'on sait pourtant sans limite.
    if (capacite === null || !Number.isFinite(capacite)) continue
    conflits.push(...conflitsDUnUstensile(equipmentId, fenetres, capacite))
  }
  return conflits
}

/**
 * Balayage des bornes : sur chaque tranche élémentaire, combien de RECETTES DISTINCTES occupent
 * l'ustensile ? Les tranches consécutives au-dessus de la capacité sont fusionnées en une fenêtre.
 */
function conflitsDUnUstensile(
  equipmentId: EquipmentId,
  fenetres: readonly Fenetre[],
  capacite: number,
): readonly Conflit[] {
  const bornes = [...new Set(fenetres.flatMap((f) => [f.fin, f.debut]))].sort((a, b) => a - b)

  const conflits: Conflit[] = []
  let courant: { debut: number; fin: number; recipeIds: Set<RecipeId> } | null = null

  for (let i = 0; i < bornes.length - 1; i++) {
    const bas = bornes[i]!
    const haut = bornes[i + 1]!
    if (haut - bas <= BRUIT_MIN) continue

    // ⚠️ DISTINCTES : c'est ici que `colin_four_fenouil` cesse d'être un conflit avec lui-même.
    const presentes = new Set(
      fenetres.filter((f) => f.fin <= bas + BRUIT_MIN && f.debut >= haut - BRUIT_MIN).map((f) => f.recipeId),
    )

    if (presentes.size > capacite) {
      if (courant === null) courant = { debut: haut, fin: bas, recipeIds: presentes }
      else {
        courant.debut = Math.max(courant.debut, haut)
        for (const id of presentes) courant.recipeIds.add(id)
      }
      continue
    }
    if (courant !== null) {
      conflits.push(enConflit(equipmentId, courant))
      courant = null
    }
  }
  if (courant !== null) conflits.push(enConflit(equipmentId, courant))

  return conflits.sort((a, b) => b.debutAvantServiceMin - a.debutAvantServiceMin)
}

/**
 * ⚠️ ON ÉLARGIT LA FENÊTRE À L'ARRONDI, jamais on ne la rétrécit : début vers le haut (plus tôt),
 * fin vers le bas (plus tard). Annoncer le four pris une minute de trop agace ; l'annoncer libre une
 * minute de trop fait rater un plat. Et comme `debut > fin` strictement, l'élargissement conserve
 * l'inégalité — la fenêtre ne peut pas s'effondrer en un point.
 */
function enConflit(
  equipmentId: EquipmentId,
  brut: { readonly debut: number; readonly fin: number; readonly recipeIds: ReadonlySet<RecipeId> },
): Conflit {
  return {
    equipmentId,
    recipeIds: [...brut.recipeIds].sort(),
    debutAvantServiceMin: Math.ceil(brut.debut),
    finAvantServiceMin: Math.floor(brut.fin),
  }
}
