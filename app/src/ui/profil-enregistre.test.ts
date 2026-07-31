// ui/profil-enregistre.test.ts
//
// Ces tests gardent une PERTE DE DONNÉES, pas une commodité. Incrémenter `VERSION_CONSENTEMENT`
// rouvre le parcours de premier lancement pour quelqu'un qui utilise déjà l'application (§6.4
// ARCHITECTURE). Si cet écran repart d'un état vide, il ressort en ayant effacé `user_allergy` —
// et l'utilisateur se retrouve sans le seul garde-fou incontournable du moteur, sans rien avoir
// vu passer.

import { beforeEach, describe, expect, it } from 'vitest'
import type { AllergenId } from '../engine/domain/index.js'
import { openUserDb, type OpenedUserDb } from '../data/user-store-node.js'
import type { UserDb } from '../data/user-db.js'
import { readAllergies, readDiet, readRythme, writeAllergies, writeDiet } from '../data/user-store.js'
import { RYTHME_PAR_DEFAUT, ecrireChoixProfil, lireChoixProfil } from './profil-enregistre.js'

let ouverte: OpenedUserDb
let db: UserDb

beforeEach(() => {
  ouverte = openUserDb(':memory:')
  db = ouverte.db
})

describe('ui/profil-enregistre — lecture', () => {
  it('rend les défauts sur une base neuve, jamais null', () => {
    expect(lireChoixProfil(db)).toEqual({
      allergenes: new Set(),
      regime: null,
      rythme: RYTHME_PAR_DEFAUT,
    })
  })

  it('relit ce qui est déjà déclaré', () => {
    writeAllergies(db, [
      { allergenId: 'gluten' as AllergenId, severite: null },
      { allergenId: 'lait' as AllergenId, severite: null },
    ])
    writeDiet(db, 'vegetarien')

    const choix = lireChoixProfil(db)
    expect([...choix.allergenes].sort()).toEqual(['gluten', 'lait'])
    expect(choix.regime).toBe('vegetarien')
  })
})

describe('ui/profil-enregistre — le parcours rouvert n’efface RIEN', () => {
  it('conserve les allergies quand on retraverse l’accueil sans y toucher', () => {
    // ⚠️ LE SCÉNARIO EXACT DU DÉFAUT. L'utilisateur déclare ses allergies, puis une nouvelle version
    // du texte de consentement rouvre le parcours. Il fait « Continuer, Continuer, C'est parti »
    // sans rien changer. Avant ce module, il ressortait sans aucune allergie.
    writeAllergies(db, [{ allergenId: 'arachides' as AllergenId, severite: null }])
    writeDiet(db, 'pescetarien')

    // Ce que fait l'écran : partir de l'existant, puis réécrire à la fin.
    const repris = lireChoixProfil(db)
    ecrireChoixProfil(db, repris)

    expect(readAllergies(db).map((a) => a.allergenId)).toEqual(['arachides'])
    expect(readDiet(db)).toBe('pescetarien')
  })

  it('conserve le rythme déjà déclaré au lieu de le remettre au défaut', () => {
    ecrireChoixProfil(db, {
      allergenes: new Set(),
      regime: null,
      rythme: { repasParJour: 3, tempsSemaineMin: 20, tempsWeekendMin: 45 },
    })
    ecrireChoixProfil(db, lireChoixProfil(db))
    expect(readRythme(db)).toEqual({ repasParJour: 3, tempsSemaineMin: 20, tempsWeekendMin: 45 })
  })

  it('laisse quand même RETIRER une allergie — remplacer, pas compléter', () => {
    // Le pendant du test précédent : reprendre l'existant ne doit pas rendre les choix indélébiles.
    writeAllergies(db, [
      { allergenId: 'gluten' as AllergenId, severite: null },
      { allergenId: 'soja' as AllergenId, severite: null },
    ])
    const sansGluten = new Set(lireChoixProfil(db).allergenes)
    sansGluten.delete('gluten')
    ecrireChoixProfil(db, { ...lireChoixProfil(db), allergenes: sansGluten })

    expect(readAllergies(db).map((a) => a.allergenId)).toEqual(['soja'])
  })
})
