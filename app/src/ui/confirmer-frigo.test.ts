// ui/confirmer-frigo.test.ts — la règle de péremption du garde-manger.
//
// ⚠️ CE QUE CES TESTS GARDENT. Le grief n°1 des utilisateurs d'applications à garde-manger n'est pas
// la qualité des recettes, c'est que l'inventaire DÉRIVE : on le remplit une semaine, puis plus
// jamais, et un inventaire à moitié à jour est PIRE que pas d'inventaire — on cesse d'y croire, mais
// l'appli, elle, continue d'y croire pour nous. Voir `reference/CONCURRENCE_ET_ATTENTES.md`.

import { describe, expect, it } from 'vitest'
import type { FoodId } from '../engine/domain/index.js'
import type { StoredPantryEntry } from '../data/user-store.js'
import {
  PEREMPTION_FRIGO_JOURS,
  alimentsAConfirmer,
  depuisQuand,
  frigoAConfirmer,
} from './confirmer-frigo.js'

const AUJOURDHUI = '2026-08-04'

const entree = (foodId: string, declareLe?: string): StoredPantryEntry => ({
  foodId: foodId as FoodId,
  quantiteApprox: null,
  ...(declareLe === undefined ? {} : { declareLe }),
})

describe('ui/confirmer-frigo — quand redemander', () => {
  it('ne demande RIEN sur un garde-manger vide — il n’y a rien à confirmer', () => {
    expect(frigoAConfirmer(null, AUJOURDHUI, 0)).toBe(false)
    expect(frigoAConfirmer('2020-01-01', AUJOURDHUI, 0)).toBe(false)
  })

  it('ne demande rien en deçà du seuil — une déclaration fraîche n’est pas suspecte', () => {
    // Le produit s'interdit de réclamer quoi que ce soit (§4.3 : « l'appli ne demande rien »).
    // Questionner une saisie de ce matin serait du bruit pur.
    expect(frigoAConfirmer(AUJOURDHUI, AUJOURDHUI, 5)).toBe(false)
    expect(frigoAConfirmer('2026-07-29', AUJOURDHUI, 5)).toBe(false) // 6 jours
    expect(frigoAConfirmer('2026-07-28', AUJOURDHUI, 5)).toBe(false) // 7 jours pile, la limite
  })

  it('demande au-delà du seuil', () => {
    expect(frigoAConfirmer('2026-07-27', AUJOURDHUI, 5)).toBe(true) // 8 jours
    expect(frigoAConfirmer('2026-05-01', AUJOURDHUI, 5)).toBe(true)
    expect(PEREMPTION_FRIGO_JOURS).toBe(7)
  })

  it('⛔ UNE DATE INCONNUE COMPTE COMME PÉRIMÉE, jamais comme fraîche', () => {
    // Les lignes d'avant la migration v8 n'ont pas d'horodatage : elles peuvent dater de six mois.
    // Les traiter comme récentes serait exactement l'erreur que la colonne existe pour empêcher —
    // l'absence d'information n'est pas une information (§5.1 bis ENGINE).
    expect(frigoAConfirmer(null, AUJOURDHUI, 5)).toBe(true)
  })

  it('une date ILLISIBLE ou dans le futur ne blanchit pas le garde-manger', () => {
    // Une horloge d'appareil reculée, un import bricolé : le cas est rare et la bonne réponse est
    // de demander, pas de faire confiance à un calcul dont on sait qu'il est faux.
    expect(frigoAConfirmer('pas-une-date', AUJOURDHUI, 5)).toBe(true)
  })
})

describe('ui/confirmer-frigo — la question porte sur l’ALIMENT, pas sur le garde-manger', () => {
  it('ne retient que les lignes périmées — une déclaration de ce matin n’est pas questionnée', () => {
    const garde = [entree('creme', '2026-07-01'), entree('riz', AUJOURDHUI), entree('oeuf', '2026-08-01')]
    expect(alimentsAConfirmer(garde, AUJOURDHUI)).toEqual(['creme'])
  })

  it('⛔ UNE LIGNE SANS DATE EST QUESTIONNÉE — les rescapées de la base v7 ne se blanchissent pas', () => {
    const garde = [entree('creme'), entree('riz', AUJOURDHUI)]
    expect(alimentsAConfirmer(garde, AUJOURDHUI)).toEqual(['creme'])
  })

  it('garde-manger entièrement frais : rien à demander', () => {
    expect(alimentsAConfirmer([entree('riz', '2026-07-30')], AUJOURDHUI)).toEqual([])
    expect(alimentsAConfirmer([], AUJOURDHUI)).toEqual([])
  })
})

describe('ui/confirmer-frigo — dire depuis quand, sans reprocher', () => {
  it('compte en jours sous deux semaines, en semaines au-delà', () => {
    expect(depuisQuand('2026-08-03', AUJOURDHUI)).toBe('il y a 1 jour')
    expect(depuisQuand('2026-07-26', AUJOURDHUI)).toBe('il y a 9 jours')
    expect(depuisQuand('2026-07-14', AUJOURDHUI)).toBe('il y a 3 semaines')
  })

  it('dit l’ignorance plutôt que d’inventer une date', () => {
    expect(depuisQuand(null, AUJOURDHUI)).toContain('n’a pas gardée')
    expect(depuisQuand('2026-12-25', AUJOURDHUI)).toContain('n’a pas gardée')
  })

  it('⛔ NE CULPABILISE PAS — aucun vocabulaire de reproche ni d’injonction', () => {
    // §6.2 ARCHITECTURE, et §4.3 : le garde-manger n'est PAS un inventaire à tenir. « Vous n'avez
    // pas mis à jour votre frigo » reprocherait un entretien que l'appli s'interdit d'exiger.
    for (const date of ['2026-07-14', '2026-08-03', null]) {
      const texte = depuisQuand(date, AUJOURDHUI).toLowerCase()
      for (const interdit of ['oubli', 'devriez', 'il faut', 'pensez à', 'négligé', 'pas à jour']) {
        expect(texte).not.toContain(interdit)
      }
    }
  })
})
