// engine/cuisine/ordonnancement.ts — quand lancer chaque plat pour arriver ensemble au service.
//
// On remonte depuis l'heure de service : le plat le plus long démarre en premier, le plus court en
// dernier. C'est la même logique qu'un cuisinier applique de tête pour un repas à plusieurs plats —
// ici formalisée pour être vérifiable et pour départager les égalités sans ambiguïté.
//
// ⚠️ NIVEAU DE FIDÉLITÉ VOLONTAIREMENT LIMITÉ, à ne pas dépasser sans en rediscuter :
//   1. Le calcul porte sur la DURÉE ÉCOULÉE PAR RECETTE, fournie par l'appelant, jamais étape par
//      étape. Le module ne regarde aucune étape individuelle.
//   2. Le module NE CONNAÎT PAS le matériel (casseroles, four, thermomix). Deux plats qui réclament
//      le même four au même instant ne sont pas détectés. ⚠️ La donnée EXISTE désormais
//      (`Recipe.equipements`, 1 473 couples dont 357 `requis`) mais elle est déclarée PAR RECETTE,
//      pas par étape : rien n'y dit *quand* le four est occupé, donc rien ne permet de réserver un
//      créneau. Ne pas conclure de sa présence qu'il ne reste qu'à la lire.
//   3. ✅ LEVÉE DEPUIS L2 : le module distingue temps actif et temps passif, quand l'appelant lui
//      fournit des `segments`. Sans eux, il retombe exactement sur le comportement d'avant — une
//      marinade de deux heures compte comme deux heures pleines.
//
// ⛔ CE QUE LE MODULE NE FAIT JAMAIS : faire partir un plat TROP TARD. `departAvantServiceMin` est
// toujours >= `dureeMin`, et c'est le seul engagement tenable. La fin, elle, n'est pas garantie :
// quand deux plats réclament les mains au même moment, l'un des deux finit forcément avant le
// service, et aucun ordonnancement n'y change quoi que ce soit — c'est une paire de mains, pas le
// modèle, qui manque. Le plat le plus long garde le créneau collé au service, les autres reculent.
//
// ⚠️ NE PAS RÉÉCRIRE CETTE PHRASE EN « aucun plat n'est prêt en avance ». Elle l'a été pendant une
// heure, avec un test qui la « prouvait » : le test lisait `departAvantServiceMin - dureeMin`, qui
// mesure le DÉBUT reculé, et n'avait jamais rien dit de la fin. Un plat d'un seul geste poussé de
// 100 min est prêt 100 min avant le service, et la formule affichait fièrement 0.
//
// ⛔ `dureeMin` EST LA DURÉE ÉCOULÉE, PLUS LA DURÉE ACTIVE — ce module recevait la mauvaise jusqu'au
// 2026-08-09. Il n'avait rien de faux : c'est ce qu'on lui donnait qui l'était. `tempsPrepMin +
// tempsCuissonMin` ne compte AUCUN repos, si bien qu'un coq au vin de 12 h de marinade était annoncé
// « à lancer 115 min avant le service ». La distinction et son calcul vivent dans `./duree.ts` ; s'y
// reporter avant de toucher à ce contrat, elle a un versant qu'il ne faut surtout pas fusionner.
//
// ⚠️ AUCUNE HORLOGE. Tout est en minutes relatives avant le service (`departAvantServiceMin`),
// jamais en horodatages — même discipline que `ui/cuisine-session.ts`. C'est l'écran qui convertit
// avec l'heure de service choisie par l'utilisateur.
//
// Dépendances autorisées : ../domain/index.js, uniquement pour le type `RecipeId`.

import type { RecipeId } from '../domain/index.js'

/**
 * Ce qu'un segment MOBILISE, pas ce qu'il fait.
 *
 * ⚠️ `passif` NE VEUT PAS DIRE « rien ne se passe », mais « personne n'est requis » : une marinade,
 * une pâte qui lève, une crème qui prend au froid. Une cuisson au four est comptée ACTIVE — décision
 * instruite et non un oubli. On ne promet pas du temps libre qu'on n'a pas mesuré : rien au catalogue
 * ne distingue le four qu'on oublie de la poêle qu'on surveille, et se tromper dans ce sens-là fait
 * rater deux plats au lieu d'en retarder un.
 */
export type NatureSegment = 'actif' | 'passif'

/**
 * Une tranche de la recette, dans l'ordre des étapes. Construits par `./segments.ts` depuis une
 * `Recipe` ; ce module ne connaît que la forme, jamais la recette.
 */
export interface SegmentCuisson {
  /** L'`ordre` de l'étape dont il vient — informatif, ne sert pas au calcul. */
  readonly ordre: number
  readonly nature: NatureSegment
  /** Minutes, >= 0, FRACTIONNAIRE AUTORISÉ — un temps réparti ne tombe pas rond. */
  readonly dureeMin: number
}

export interface CuissonAOrdonnancer {
  readonly recipeId: RecipeId
  readonly nom: string
  /**
   * La durée ÉCOULÉE, `dureeEcouleeMin(recette)` — active + repos chiffrés. Entier >= 0.
   *
   * ⛔ PAS `tempsPrepMin + tempsCuissonMin`. Cette somme-là répond à « ai-je le temps ce soir »,
   * pas à « quand dois-je m'y mettre », et la donner ici fait partir en retard de tout le repos.
   */
  readonly dureeMin: number
  /**
   * Le découpage actif/passif de la recette, dans l'ordre des étapes. FACULTATIF.
   *
   * ⚠️ AJOUT STRICT : absent (ou vide), le plat est mis HORS DU JEU d'ordonnancement — il ne réserve
   * aucun créneau et n'en esquive aucun, et son départ vaut exactement `dureeMin`, comme avant L2.
   * Aucun appelant n'a à changer pour que ce module continue de répondre la même chose.
   *
   * ⛔ NE PAS « AMÉLIORER » CE DÉFAUT EN LE TRAITANT COMME UN BLOC ACTIF DE `dureeMin`. C'est ce qui
   * avait été écrit d'abord : trois plats sans segments se poussaient alors les uns les autres et le
   * tri par durée décroissante s'inversait, sur un appel dont pas une ligne n'avait changé.
   *
   * ⛔ LEUR SOMME DOIT VALOIR `dureeMin`. Ce n'est pas une coquetterie : tout le contrat de sortie
   * repose dessus (`departAvantServiceMin === dureeMin + retardMin`). Des segments qui racontent une
   * autre durée que celle annoncée feraient mentir le départ sans que rien ne rougisse — c'est
   * refusé par une exception, comme une durée négative.
   */
  readonly segments?: readonly SegmentCuisson[]
}

export interface DepartCuisson {
  readonly recipeId: RecipeId
  readonly nom: string
  /**
   * 0 = la première à lancer.
   *
   * ⚠️ DEPUIS L2, LE RANG N'EST PLUS L'ORDRE DES DURÉES. Un plat court dont les gestes doivent
   * esquiver ceux d'un plat long peut être poussé à démarrer AVANT lui. Le rang dit « la première à
   * lancer », il suit donc `departAvantServiceMin`, pas `dureeMin`. Sans segments les deux ordres
   * coïncident, ce qui est exactement le cas d'avant L2.
   */
  readonly rang: number
  /** Minutes AVANT le service. Toujours >= 0. Vaut `dureeMin + retardMin`. */
  readonly departAvantServiceMin: number
  readonly dureeMin: number
  /**
   * De combien il a fallu reculer le départ pour que les gestes de ce plat n'en heurtent aucun autre.
   * Entier >= 0, arrondi VERS LE HAUT — commencer une minute trop tôt ne coûte rien, une minute trop
   * tard coûte le plat.
   *
   * ⚠️ VAUT 0 QUAND RIEN N'A BOUGÉ, exactement, jamais « à peu près 0 ». C'est l'invariant qui rend ce
   * lot vérifiable : un plat seul, ou un plat dont tous les voisins reposent pendant qu'il travaille,
   * part à l'heure qu'il aurait eue avant L2.
   */
  readonly retardMin: number
}

export interface Ordonnancement {
  /** Trié par `rang` croissant, donc de la plus longue à la plus courte. */
  readonly departs: readonly DepartCuisson[]
  /** Minutes entre le premier départ et le service. 0 si aucune cuisson. */
  readonly amplitudeMin: number
}

/**
 * Le bruit de calcul qu'on accepte avant de conclure « ça a bougé ».
 *
 * Les durées de segments sont fractionnaires par construction (un temps réparti sur trois étapes
 * tombe en tiers), et les additions flottantes laissent des poussières de l'ordre de 1e-13. Sans ce
 * seuil, un plat que rien n'a déplacé sortirait avec `retardMin: 1` une fois sur mille.
 */
const BRUIT_MIN = 1e-6

/** Un créneau occupé par un geste, en minutes AVANT le service : `debut` > `fin`, l'axe remonte. */
interface CreneauOccupe {
  readonly debut: number
  readonly fin: number
}

/**
 * Ordonnance des cuissons pour un service commun.
 *
 * ⚠️ DEUX ORDRES DIFFÉRENTS, ET LES CONFONDRE CASSE LA REPRODUCTIBILITÉ.
 *
 *   - L'ordre de PLACEMENT est le tri par `dureeMin` décroissant, à égalité par `recipeId` croissant
 *     (comparaison de chaînes, pas `localeCompare`, pour un résultat indépendant de la locale). Le
 *     plat le plus long réserve ses gestes en premier, les autres l'esquivent. C'est ce tri-là qui
 *     rend la sortie reproductible à entrée égale, et il ne doit pas changer.
 *   - L'ordre de SORTIE (`rang`) est le tri par `departAvantServiceMin` décroissant, même départage.
 *     Il répond à « qu'est-ce que je lance en premier », ce qui n'est plus la même question depuis
 *     que reculer un départ est possible.
 *
 * Sans segments, aucun départ ne recule et les deux ordres coïncident.
 *
 * Coût : O(S × C) où S est le nombre de segments et C celui des créneaux déjà réservés — quadratique
 * en théorie, sur une poignée de plats en pratique. Le mode cuisine en porte 2 à 4.
 */
export function ordonnancerCuissons(cuissons: readonly CuissonAOrdonnancer[]): Ordonnancement {
  const vus = new Set<RecipeId>()
  for (const cuisson of cuissons) {
    if (vus.has(cuisson.recipeId)) {
      throw new Error(`ordonnancerCuissons : recipeId en double « ${cuisson.recipeId} »`)
    }
    vus.add(cuisson.recipeId)

    if (!Number.isFinite(cuisson.dureeMin) || cuisson.dureeMin < 0) {
      throw new Error(
        `ordonnancerCuissons : dureeMin invalide (${cuisson.dureeMin}) pour recipeId « ${cuisson.recipeId} »`,
      )
    }

    if (cuisson.segments !== undefined) verifierSegments(cuisson)
  }

  const tries = [...cuissons].sort((a, b) => {
    if (a.dureeMin !== b.dureeMin) return b.dureeMin - a.dureeMin
    return comparerIds(a.recipeId, b.recipeId)
  })

  const occupes: CreneauOccupe[] = []
  const places = tries.map((cuisson) => {
    const retard = placerEtReserver(cuisson, occupes)
    const retardMin = retard <= BRUIT_MIN ? 0 : Math.ceil(retard - BRUIT_MIN)
    return {
      recipeId: cuisson.recipeId,
      nom: cuisson.nom,
      departAvantServiceMin: cuisson.dureeMin + retardMin,
      dureeMin: cuisson.dureeMin,
      retardMin,
    }
  })

  const departs = places
    .sort((a, b) => {
      if (a.departAvantServiceMin !== b.departAvantServiceMin) {
        return b.departAvantServiceMin - a.departAvantServiceMin
      }
      return comparerIds(a.recipeId, b.recipeId)
    })
    .map((depart, rang) => ({ ...depart, rang }))

  const amplitudeMin = departs.length > 0 ? departs[0]!.departAvantServiceMin : 0

  return { departs, amplitudeMin }
}

function comparerIds(a: RecipeId, b: RecipeId): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function verifierSegments(cuisson: CuissonAOrdonnancer): void {
  const segments = cuisson.segments ?? []
  let somme = 0
  for (const segment of segments) {
    if (!Number.isFinite(segment.dureeMin) || segment.dureeMin < 0) {
      throw new Error(
        `ordonnancerCuissons : segment de durée invalide (${segment.dureeMin}) pour recipeId « ${cuisson.recipeId} »`,
      )
    }
    somme += segment.dureeMin
  }

  // La tolérance est d'une minute et pas d'une poussière : `dureeMin` est un entier arrondi
  // (`dureeReposMin` arrondit le total des repos au plus proche, soit 30 s d'écart au pire) alors
  // que les segments gardent leurs fractions. Une minute couvre cet arrondi avec de la marge ;
  // au-delà, les deux ne parlent plus de la même recette et il faut le dire fort.
  if (segments.length > 0 && Math.abs(somme - cuisson.dureeMin) > 1) {
    throw new Error(
      `ordonnancerCuissons : segments incohérents pour recipeId « ${cuisson.recipeId} » — ` +
        `ils totalisent ${somme.toFixed(2)} min alors que dureeMin vaut ${cuisson.dureeMin}`,
    )
  }
}

/**
 * Pose une recette à rebours depuis le service et réserve ses gestes. Rend le retard accumulé.
 *
 * ⚠️ ON REMONTE DEPUIS LA FIN, jamais depuis le début : c'est la fin qui est fixée (le service), le
 * début qui est la variable. Le dernier segment finit à 0, chacun s'appuie sur le précédent.
 *
 * Un segment `passif` ne réserve rien et ne heurte rien — c'est tout l'objet de L2. Un segment
 * `actif` qui tombe sur un créneau déjà pris est reculé jusqu'à passer avant lui, et le trou qu'il
 * laisse derrière est du temps où le plat attend, pas du temps perdu.
 */
function placerEtReserver(
  cuisson: CuissonAOrdonnancer,
  occupes: CreneauOccupe[],
): number {
  // ⛔ SANS DÉCOUPAGE, LE PLAT EST HORS DU JEU : il ne réserve rien et n'esquive rien. C'est le seul
  // choix qui tienne la promesse d'ajout strict, et il a failli être manqué — le traiter comme un
  // unique bloc actif paraissait plus prudent, mais faisait alors se pousser trois plats que le
  // module n'avait jamais déplacés, et le tri par durée décroissante s'inversait. Un appelant qui ne
  // dit pas où sont ses gestes ne reçoit pas d'ordonnancement qu'on aurait inventé pour lui.
  const segments = cuisson.segments
  if (segments === undefined || segments.length === 0) return 0

  let curseur = 0
  let retard = 0

  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i]!
    // Un segment passif ne réserve rien. Un actif de durée nulle non plus : il n'occupe personne, et
    // le réserver poserait un créneau vide que les suivants devraient contourner pour rien.
    if (segment.nature === 'passif' || segment.dureeMin <= BRUIT_MIN) {
      curseur += segment.dureeMin
      continue
    }

    let fin = curseur
    // Chaque recul saute par-dessus UN créneau et fait strictement croître `fin` ; aucun créneau ne
    // peut être sauté deux fois, donc la boucle se termine en au plus `occupes.length` tours.
    for (;;) {
      const heurt = occupes.find((c) => fin < c.debut - BRUIT_MIN && c.fin < fin + segment.dureeMin - BRUIT_MIN)
      if (heurt === undefined) break
      retard += heurt.debut - fin
      fin = heurt.debut
    }

    occupes.push({ debut: fin + segment.dureeMin, fin })
    curseur = fin + segment.dureeMin
  }

  return retard
}
