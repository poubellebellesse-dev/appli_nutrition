// engine/cuisine/equipement-partage.ts — quel ustensile deux plats de la session se disputent.
//
// ⛔ CE MODULE N'ORDONNANCE RIEN, ET CE N'EST PAS UN MANQUE. Le niveau 3 du mode cuisine avait été
// écrit comme « la réservation d'équipement » : un four occupé de telle minute à telle minute, que
// les autres plats esquivent comme ils esquivent les mains depuis L2. Cette réservation-là n'est PAS
// livrable, et la mesure le dit sans appel (catalogue du 2026-08-09) :
//
//   - `recipe_equipment` est `(recipe_id, equipment_id, niveau)` — AUCUNE colonne d'étape. Rien n'y
//     dit *quand* le four est occupé, donc aucun créneau n'est déductible. Réserver demanderait
//     d'inventer l'horaire, c'est-à-dire de le deviner.
//   - `equipment` est `(id, code, terme, definition)` — AUCUNE capacité. Rien n'y dit qu'une plaque
//     porte trois feux et un four une seule enfournée.
//   - Sans capacité, une réservation exclusive déclarerait un conflit sur 34 290 des 54 285 paires de
//     recettes, soit 63 %. À tort : `plaque_cuisson` est `requis` sur 260 recettes (79 %) et la
//     plaque est précisément l'ustensile qu'on partage. Un avertissement qui se déclenche deux fois
//     sur trois n'est plus lu.
//
// Ce que ce module fait, à la place : il NOMME. Deux plats qui réclament le même four, on le dit une
// fois, en clair, et on laisse la personne s'organiser. Informer, jamais juger (principe 6).
//
// ⚠️ DETTE ASSUMÉE, ET IL FAUT LA LIRE COMME TELLE. `CODES_INDIVISIBLES` ci-dessous est un jugement
// éditorial posé DANS LE CODE parce que le champ qui devrait le porter n'existe pas au catalogue.
// Le jour où `equipment` gagne une `capacite`, cette constante disparaît et la règle devient
// « capacité < nombre de plats qui le réclament ». Ne pas l'allonger au jugé d'ici là.
//
// Dépendances autorisées : ../domain/index.js, pour les types seuls.

import type { EquipmentId, RecipeEquipment, RecipeId } from '../domain/index.js'

/**
 * Les ustensiles qu'on ne peut PAS faire servir à deux plats en même temps.
 *
 * Le critère n'est pas « deux plats peuvent-ils y toucher » — un mixeur se rince en dix secondes,
 * une râpe aussi — mais « l'ustensile retient-il de la nourriture pendant longtemps, sous un réglage
 * unique ». Deux gratins à 180 °C et 220 °C ne cohabitent pas ; deux casseroles sur deux feux, si.
 *
 * D'où deux entrées seulement, sur les 30 du référentiel. `four` est `requis` sur 82 recettes,
 * `micro_ondes` sur une seule — elle ne coûte rien et elle est aussi vraie que l'autre.
 *
 * ⛔ NE PAS Y AJOUTER `plaque_cuisson`. C'est le premier réflexe et il est faux : 260 recettes la
 * réclament, une plaque a plusieurs feux, et l'avertissement se déclencherait sur presque chaque
 * paire de plats jusqu'à ce que plus personne ne le lise.
 */
export const CODES_INDIVISIBLES: readonly string[] = ['four', 'micro_ondes']

/** Un plat de la session, réduit à ce que ce module regarde. */
export interface PlatEtSonMateriel {
  readonly recipeId: RecipeId
  readonly equipements: readonly RecipeEquipment[]
}

/** Un ustensile indivisible que plusieurs plats de la session réclament. */
export interface EquipementDispute {
  readonly equipmentId: EquipmentId
  /** Au moins deux, triés par `recipeId` croissant — reproductible, comme tout le reste du moteur. */
  readonly recipeIds: readonly RecipeId[]
}

/**
 * Les ustensiles indivisibles que plusieurs plats de la session réclament en `requis`.
 *
 * ⚠️ `requis` SEUL. Les trois niveaux ne disent pas la même chose et un seul est une contrainte :
 * `accelere` veut dire « faisable autrement, plus lentement » et `informatif` n'exclut JAMAIS rien.
 * Avertir sur eux reviendrait à traiter un fouet comme un four.
 *
 * @param plats     les plats en cuisine, dans n'importe quel ordre
 * @param codeDe    résout un `EquipmentId` vers son `code` de référentiel — c'est l'appelant qui
 *                  tient le catalogue, ce module reste pur. Rendre `null` pour un id inconnu.
 * @returns triés par `equipmentId` croissant. Vide quand rien n'est disputé, ce qui est le cas le
 *          plus fréquent et n'a rien d'anormal.
 */
export function equipementsDisputes(
  plats: readonly PlatEtSonMateriel[],
  codeDe: (id: EquipmentId) => string | null,
): readonly EquipementDispute[] {
  const indivisibles = new Set(CODES_INDIVISIBLES)
  const parEquipement = new Map<EquipmentId, Set<RecipeId>>()

  for (const plat of plats) {
    for (const materiel of plat.equipements) {
      if (materiel.niveau !== 'requis') continue
      const code = codeDe(materiel.equipmentId)
      if (code === null || !indivisibles.has(code)) continue

      const dejaVus = parEquipement.get(materiel.equipmentId) ?? new Set<RecipeId>()
      dejaVus.add(plat.recipeId)
      parEquipement.set(materiel.equipmentId, dejaVus)
    }
  }

  return [...parEquipement.entries()]
    .filter(([, recettes]) => recettes.size > 1)
    .map(([equipmentId, recettes]) => ({
      equipmentId,
      recipeIds: [...recettes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    }))
    .sort((a, b) => (a.equipmentId < b.equipmentId ? -1 : a.equipmentId > b.equipmentId ? 1 : 0))
}
