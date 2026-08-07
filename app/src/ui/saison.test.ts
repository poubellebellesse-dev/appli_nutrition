import { describe, expect, it } from 'vitest'
import type { Month } from '../engine/domain/index.js'
import { plagesDeSaison, texteSaison } from './saison.js'

const mois = (...n: number[]): readonly Month[] => n as readonly Month[]

describe('plagesDeSaison', () => {
  it('rend une plage unique pour des mois consécutifs', () => {
    expect(plagesDeSaison(mois(6, 7, 8, 9))).toEqual([{ debut: 6, fin: 9 }])
  })

  it('sépare deux plages disjointes', () => {
    expect(plagesDeSaison(mois(3, 4, 9, 10))).toEqual([
      { debut: 3, fin: 4 },
      { debut: 9, fin: 10 },
    ])
  })

  // Le cœur du fichier : sans le recollement, un légume d'hiver s'affichait en deux morceaux.
  it('recolle la plage qui enjambe décembre', () => {
    expect(plagesDeSaison(mois(1, 2, 3, 11, 12))).toEqual([{ debut: 11, fin: 3 }])
  })

  it('recolle décembre-janvier même réduits à un mois chacun', () => {
    expect(plagesDeSaison(mois(1, 12))).toEqual([{ debut: 12, fin: 1 }])
  })

  it('recolle sans perdre les plages du milieu', () => {
    expect(plagesDeSaison(mois(1, 2, 5, 6, 11, 12))).toEqual([
      { debut: 11, fin: 2 },
      { debut: 5, fin: 6 },
    ])
  })

  it('rend une seule plage pleine pour les douze mois, sans se recoller sur lui-même', () => {
    expect(plagesDeSaison(mois(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toEqual([
      { debut: 1, fin: 12 },
    ])
  })

  it('ne recolle pas une plage qui finit en décembre sans janvier en face', () => {
    expect(plagesDeSaison(mois(9, 10, 11, 12))).toEqual([{ debut: 9, fin: 12 }])
  })

  it('ne recolle pas une plage qui part de janvier sans décembre en face', () => {
    expect(plagesDeSaison(mois(1, 2, 3))).toEqual([{ debut: 1, fin: 3 }])
  })

  it('rend un tableau vide sur une saison non renseignée', () => {
    expect(plagesDeSaison([])).toEqual([])
  })

  // Le catalogue est construit, mais la fonction sert aussi des données importées.
  it('dédoublonne et trie une entrée désordonnée', () => {
    expect(plagesDeSaison(mois(8, 6, 7, 6))).toEqual([{ debut: 6, fin: 8 }])
  })
})

describe('texteSaison', () => {
  it('rend une plage en toutes lettres', () => {
    expect(texteSaison(mois(6, 7, 8, 9))).toBe('de juin à septembre')
  })

  it('rend un mois isolé sans « de … à »', () => {
    expect(texteSaison(mois(5))).toBe('en mai')
  })

  it('rend la plage à cheval sur l’année dans le bon sens', () => {
    expect(texteSaison(mois(1, 2, 3, 11, 12))).toBe('de novembre à mars')
  })

  it('joint deux plages par « et », jamais par une virgule finale', () => {
    expect(texteSaison(mois(3, 4, 9, 10))).toBe('de mars à avril et de septembre à octobre')
  })

  it('joint trois plages par des virgules puis « et »', () => {
    expect(texteSaison(mois(1, 4, 5, 8))).toBe("en janvier, d'avril à mai et en août")
  })

  // « de avril » est passé en revue une fois ; trois mois sur douze commencent par une voyelle.
  it('élide la préposition devant un mois à initiale vocalique', () => {
    expect(texteSaison(mois(8, 9, 10))).toBe("d'août à octobre")
    expect(texteSaison(mois(10, 11))).toBe("d'octobre à novembre")
  })

  it('dit « toute l’année » pour les douze mois', () => {
    expect(texteSaison(mois(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBe("toute l'année")
  })

  // ⚠️ `null`, pas « aucune saison » : le catalogue laisse ce champ vide pour les denrées de fond
  // de placard. L'appelant doit se taire, pas annoncer une absence de saison.
  it('rend null sur une saisonnalité non renseignée', () => {
    expect(texteSaison([])).toBeNull()
  })
})
