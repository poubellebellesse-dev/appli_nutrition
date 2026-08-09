// engine/selection/equipement.test.ts — couche d'exclusion `equipement` (docs/ENGINE.md §6.5).
//
// La couche a été INERTE de P1a jusqu'à l'arrivée de la table équipement au catalogue. Les tests
// d'inertie inconditionnelle qui vivaient ici sont donc devenus FAUX PAR CONSTRUCTION, et non
// obsolètes : ils affirmaient « ne rejette jamais aucun candidat », ce qui est exactement ce que la
// couche doit faire maintenant dans un cas précis.
//
// Ce qui est vérifié ici tient en deux points, et le second est le seul qui protège le catalogue :
//  1. `requis` absent → exclusion. `accelere` et `informatif` absents → CONSERVÉS.
//  2. `ownedEquipmentIds === null` (jamais déclaré) → INERTE, distinct de `[]` (déclaré vide).
//
// ⚠️ Fixtures montées à la main, JAMAIS dérivées du YAML du catalogue : un oracle qui partage la
// donnée de son sujet ne vérifie rien (docs/reference/PIEGES.md).

import { describe, expect, it } from 'vitest'
import { equipmentLayer } from './equipement.js'
import {
  asExclusionResult,
  makeCatalog,
  makeEquipment,
  makeRecipe,
  makeRequest,
  requiert,
} from './test-fixtures.js'

/** Un four, un mixeur, un fouet — et trois recettes qui les demandent à des niveaux différents. */
function scene() {
  const gratin = makeRecipe('gratin', { equipements: [requiert('four', 'requis')] })
  const veloute = makeRecipe('veloute', { equipements: [requiert('mixeur', 'accelere')] })
  const salade = makeRecipe('salade', { equipements: [requiert('fouet', 'informatif')] })
  const cru = makeRecipe('cru')
  const catalog = makeCatalog(
    [gratin, veloute, salade, cru],
    [],
    [makeEquipment('four'), makeEquipment('mixeur'), makeEquipment('fouet')],
  )
  return { gratin, veloute, salade, cru, catalog, tous: new Set([gratin.id, veloute.id, salade.id, cru.id]) }
}

describe('selection/equipement — seul `requis` exclut', () => {
  it('exclut la recette dont un équipement `requis` manque, et nomme le motif', () => {
    const { gratin, catalog, tous } = scene()
    const req = makeRequest({ ownedEquipmentIds: ['mixeur', 'fouet'] })

    const result = asExclusionResult(equipmentLayer.apply(tous, equipmentLayer.configure(req, catalog)))

    expect(result.kept.has(gratin.id)).toBe(false)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]?.recipeId).toBe(gratin.id)
    expect(result.rejected[0]?.layerId).toBe('equipement')
  })

  it('conserve la recette dont l’équipement `requis` est déclaré', () => {
    const { gratin, catalog, tous } = scene()
    const req = makeRequest({ ownedEquipmentIds: ['four'] })

    const result = asExclusionResult(equipmentLayer.apply(tous, equipmentLayer.configure(req, catalog)))

    expect(result.kept.has(gratin.id)).toBe(true)
    expect(result.rejected).toEqual([])
  })

  it('⛔ `accelere` et `informatif` absents ne font JAMAIS tomber la recette', () => {
    const { veloute, salade, catalog, tous } = scene()
    // Rien n'est possédé : si la couche lisait les trois niveaux, ces deux-là tomberaient aussi.
    const req = makeRequest({ ownedEquipmentIds: [] })

    const result = asExclusionResult(equipmentLayer.apply(tous, equipmentLayer.configure(req, catalog)))

    expect(result.kept.has(veloute.id)).toBe(true)
    expect(result.kept.has(salade.id)).toBe(true)
  })

  it('conserve une recette qui n’exige aucun matériel', () => {
    const { cru, catalog, tous } = scene()
    const req = makeRequest({ ownedEquipmentIds: [] })

    const result = asExclusionResult(equipmentLayer.apply(tous, equipmentLayer.configure(req, catalog)))

    expect(result.kept.has(cru.id)).toBe(true)
  })

  it('le motif nomme l’ustensile en toutes lettres, pas son identifiant', () => {
    const gratin = makeRecipe('gratin', { equipements: [requiert('four', 'requis')] })
    const catalog = makeCatalog([gratin], [], [{ ...makeEquipment('four'), terme: 'Four' }])
    const req = makeRequest({ ownedEquipmentIds: [] })

    const result = asExclusionResult(equipmentLayer.apply(new Set([gratin.id]), equipmentLayer.configure(req, catalog)))

    expect(result.rejected[0]?.reason).toContain('Four')
  })

  it('cite TOUS les équipements manquants quand la recette en exige plusieurs', () => {
    const paella = makeRecipe('paella', {
      equipements: [requiert('four', 'requis'), requiert('plaque', 'requis')],
    })
    const catalog = makeCatalog([paella], [], [makeEquipment('four'), makeEquipment('plaque')])
    const req = makeRequest({ ownedEquipmentIds: [] })

    const result = asExclusionResult(equipmentLayer.apply(new Set([paella.id]), equipmentLayer.configure(req, catalog)))

    expect(result.rejected[0]?.reason).toContain('four')
    expect(result.rejected[0]?.reason).toContain('plaque')
  })

  it('il suffit qu’UN seul des `requis` manque pour exclure', () => {
    const paella = makeRecipe('paella', {
      equipements: [requiert('four', 'requis'), requiert('plaque', 'requis')],
    })
    const catalog = makeCatalog([paella], [], [makeEquipment('four'), makeEquipment('plaque')])
    const req = makeRequest({ ownedEquipmentIds: ['four'] })

    const result = asExclusionResult(equipmentLayer.apply(new Set([paella.id]), equipmentLayer.configure(req, catalog)))

    expect(result.kept.has(paella.id)).toBe(false)
  })
})

describe('selection/equipement — le tri-état, ce qui protège le catalogue', () => {
  it('⛔ `null` (jamais déclaré) rend la couche INERTE, même sur une recette à `requis`', () => {
    const { gratin, catalog, tous } = scene()
    const req = makeRequest() // ownedEquipmentIds absent → null

    const result = asExclusionResult(equipmentLayer.apply(tous, equipmentLayer.configure(req, catalog)))

    expect(result.kept).toEqual(tous)
    expect(result.rejected).toEqual([])
    expect(result.kept.has(gratin.id)).toBe(true)
  })

  it('⛔ `[]` (déclaré vide) N’EST PAS `null` : les `requis` tombent', () => {
    const { gratin, catalog, tous } = scene()

    const inerte = asExclusionResult(
      equipmentLayer.apply(tous, equipmentLayer.configure(makeRequest({ ownedEquipmentIds: null }), catalog)),
    )
    const declareVide = asExclusionResult(
      equipmentLayer.apply(tous, equipmentLayer.configure(makeRequest({ ownedEquipmentIds: [] }), catalog)),
    )

    // Le même catalogue, les mêmes candidats, deux résultats différents : c'est tout l'intérêt du
    // tri-état. Les confondre coûterait les recettes à source de chaleur à qui n'a rien déclaré.
    expect(inerte.kept.has(gratin.id)).toBe(true)
    expect(declareVide.kept.has(gratin.id)).toBe(false)
  })
})

describe('selection/equipement — contrat', () => {
  it('conserve un ensemble de candidats vide sans planter', () => {
    const catalog = makeCatalog([])
    const req = makeRequest({ ownedEquipmentIds: [] })

    const result = asExclusionResult(equipmentLayer.apply(new Set(), equipmentLayer.configure(req, catalog)))

    expect(result.kept).toEqual(new Set())
    expect(result.rejected).toEqual([])
  })

  it('id/kind/critical conformes au registre (§6.3 ENGINE) — non critique', () => {
    expect(equipmentLayer.id).toBe('equipement')
    expect(equipmentLayer.kind).toBe('exclusion')
    expect(equipmentLayer.critical).toBe(false)
  })
})
