// @vitest-environment jsdom
//
// ui/export-recette.test.ts — le fichier `.nutri-recipe` reste réimportable (JSON + `schemaVersion`),
// et le repli téléchargement fonctionne quand `navigator.share` n'existe pas (voir l'en-tête du
// module pour le pourquoi de chaque bascule).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredUserRecipe } from '../data/user-recipe.js'
import { exporterRecette, serialiserRecette } from './export-recette.js'

function recetteDeTest(): StoredUserRecipe {
  return {
    schemaVersion: 1,
    id: 'perso:abc-123',
    source: 'perso',
    baseRecipeId: null,
    nom: 'Ma tarte aux poireaux',
    tempsPrepMin: 15,
    tempsCuissonMin: 30,
    portionsBase: 4,
    difficulte: 2,
    typesRepas: ['diner'],
    envergure: 'quotidien',
    conservationJours: 2,
    axes: { sucreSale: -1, legerConsistant: 0, chaudFroid: 1, texture: 'moelleux' },
    ingredients: [{ foodId: 'poireau', quantiteG: 300, uniteAffichage: '2 poireaux', optionnel: false }],
    etapes: ['Couper les poireaux.', 'Cuire au four.'],
    facettesHeritees: [],
    service: null,
    piquant: null,
  }
}

describe('serialiserRecette', () => {
  it('produit un JSON qui reparse, avec schemaVersion et le nom de la recette', () => {
    const recette = recetteDeTest()
    const json = serialiserRecette(recette)
    const relue = JSON.parse(json) as StoredUserRecipe

    expect(relue.schemaVersion).toBe(1)
    expect(relue.nom).toBe('Ma tarte aux poireaux')
    expect(relue.id).toBe(recette.id)
  })
})

describe('exporterRecette', () => {
  const original = { ...navigator }
  let clic: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
    // jsdom tente une VRAIE navigation sur `<a>.click()` : on neutralise le clic pour n'observer que
    // l'intention (l'élément a bien été créé et cliqué), pas la navigation qu'il déclencherait.
    clic = vi.fn()
    const lienOriginal = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = lienOriginal(tag)
      if (tag === 'a') element.click = clic
      return element
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'share', { value: original.share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: original.canShare, configurable: true })
  })

  it('bascule sur le téléchargement quand navigator.share est absent', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })

    await exporterRecette(recetteDeTest())

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(clic).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('partage un fichier quand navigator.share et canShare l’acceptent', async () => {
    const share = vi.fn(() => Promise.resolve())
    const canShare = vi.fn(() => true)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })

    await exporterRecette(recetteDeTest())

    expect(canShare).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('retombe sur le téléchargement si canShare refuse les fichiers', async () => {
    const share = vi.fn(() => Promise.resolve())
    const canShare = vi.fn(() => false)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })

    await exporterRecette(recetteDeTest())

    expect(share).not.toHaveBeenCalled()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })
})
