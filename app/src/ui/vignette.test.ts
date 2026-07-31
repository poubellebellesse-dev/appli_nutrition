import { describe, expect, it } from 'vitest'
import { couleurDeRecette, initialeDeRecette } from './vignette.js'

describe('ui/vignette — couleur', () => {
  it('rend TOUJOURS une couleur valide, jamais undefined', () => {
    // Le défaut que ce test attrape : un hachage qui déborde en entier signé rend un nombre
    // négatif, dont le modulo reste négatif en JavaScript — donc un index hors tableau, et une
    // carte sans fond. Il ne se manifesterait que sur CERTAINS identifiants.
    const identifiants = [
      '',
      'a',
      'blanquette-de-veau',
      'tarte-aux-pommes-de-ma-grand-mere-avec-un-nom-tres-long',
      'plat-étrange-àéîöû',
      '🍲',
      'x'.repeat(500),
    ]
    for (const id of identifiants) {
      expect(couleurDeRecette(id), `couleur absente pour « ${id} »`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('est DÉTERMINISTE — la même recette garde sa couleur', () => {
    // Une carte qui change de teinte à chaque rendu se lit comme un autre plat.
    for (const id of ['risotto-champignons', 'curry-pois-chiches']) {
      expect(couleurDeRecette(id)).toBe(couleurDeRecette(id))
    }
  })

  it('ne donne pas la même couleur à tout le monde', () => {
    // Six teintes pour 241 recettes : les collisions sont normales et voulues. Ce qui ne le serait
    // pas, c'est un hachage effondré qui rendrait une seule teinte — l'écran paraîtrait figé.
    const ids = Array.from({ length: 60 }, (_, i) => `recette-${i}`)
    expect(new Set(ids.map(couleurDeRecette)).size).toBeGreaterThan(3)
  })
})

describe('ui/vignette — initiale', () => {
  it('prend la première lettre, en majuscule', () => {
    expect(initialeDeRecette('risotto aux champignons')).toBe('R')
    expect(initialeDeRecette('  œufs au plat')).toBe('Œ')
  })

  it('ne coupe pas un caractère en deux', () => {
    // `nom[0]` sur un emoji rendrait une demi-paire de substitution — un losange noir à l'écran.
    expect(initialeDeRecette('🍲 soupe')).toBe('🍲')
  })

  it('rend un caractère de repli plutôt que rien sur un nom vide', () => {
    expect(initialeDeRecette('')).toBe('?')
    expect(initialeDeRecette('   ')).toBe('?')
  })
})
