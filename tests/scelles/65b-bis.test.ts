// tests/scelles/65b-bis.test.ts — l'examen du lot 65b-bis : l'interrupteur survit à la fermeture.
//
// Dette du lot 65b, inscrite le 2026-08-18 sur décision de l'auteur. Plan :
// `docs/CONCEPTION_RESERVATION_MATERIEL.md` § « Lot 65b-bis ».
//
// ---------------------------------------------------------------------------------------------
// ⛔ CE FICHIER EST VERT LE JOUR OÙ ON L'ÉCRIT, ET C'EST ASSUMÉ.
//
// La règle du dépôt — « un test scellé doit être rouge le jour où on l'écrit » — ne s'applique pas
// ici, et le maquiller pour qu'il rougisse serait pire que de le dire. Le code livré par le 65b est
// DÉJÀ juste : mesuré le 2026-08-18, fichier écrit, fermé, rouvert, `user_equipment_filter` contient
// `{id: 1, actif: 1}`. Ce n'est pas un test d'acceptation, c'est un GARDE DE RÉGRESSION.
//
// ⚠️ CE QUI REMPLACE LE ROUGE : LA MUTATION. Un garde qui ne rougit pas quand on casse le code ne
// garde rien. La faille que ce fichier existe pour interdire a été nommée par une relecture
// indépendante du 65b, et elle passait les VINGT tests scellés d'alors :
//
//     const cache = new WeakMap<UserDb, boolean>()      // clé = l'OBJET db, jamais la table SQL
//     readFiltreEquipement  = (db) => cache.get(db) ?? false
//     writeFiltreEquipement = (db, actif) => cache.set(db, actif)
//
// En production, l'utilisateur retrouverait son filtre éteint à chaque lancement PENDANT QUE SON
// MATÉRIEL, LUI, SURVIVRAIT. C'est cette asymétrie que les clauses ci-dessous rendent impossible.
//
// ---------------------------------------------------------------------------------------------
// ⛔ UN VRAI FICHIER, JAMAIS `:memory:`. Une base en mémoire meurt avec sa connexion : la rouvrir
// rend une base VIDE, et le test passerait pour de mauvaises raisons — ou échouerait pour de
// mauvaises raisons. Tout ce fichier repose sur le fait que les deux sessions parlent du MÊME
// fichier sur disque.
//
// ⛔ ET ON LIT LA TABLE EN SQL BRUT, sans passer par le store. Vérifier la persistance avec la
// fonction qu'on soupçonne de ne pas persister n'établit rien.
//
// ⚠️ AUCUN CODE DE PRODUCTION N'EST TOUCHÉ PAR CE LOT. Pas une ligne. Si ce fichier devient rouge un
// jour, c'est qu'un AUTRE lot a cassé la persistance — c'est exactement ce qu'il est là pour dire.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { openUserDb, type OpenedUserDb } from '../../app/src/data/user-store-node.js'
import {
  readConstraints,
  readFiltreEquipement,
  readOwnedEquipmentIds,
  writeFiltreEquipement,
  writeOwnedEquipmentIds,
} from '../../app/src/data/user-store.js'
import type { EquipmentId, Food, FoodId } from '../../app/src/engine/domain/index.js'

/** `readConstraints` ne lit le catalogue que pour déplier les groupes retirés — aucun ici. */
const SANS_CATALOGUE: ReadonlyMap<FoodId, Food> = new Map()

const FOUR = 'four' as EquipmentId

let dossier: string
let fichier: string

beforeEach(() => {
  dossier = mkdtempSync(path.join(tmpdir(), 'scelle-65b-bis-'))
  fichier = path.join(dossier, 'user.db')
})
afterEach(() => {
  rmSync(dossier, { recursive: true, force: true })
})

/** Une session, refermée quoi qu'il arrive — un fichier laissé ouvert bloque le nettoyage. */
function session<T>(travail: (ouverte: OpenedUserDb) => T): T {
  const ouverte = openUserDb(fichier)
  try {
    return travail(ouverte)
  } finally {
    ouverte.close()
  }
}

/** Ce que la table contient VRAIMENT, par un chemin qui n'emprunte pas le store. */
function lignesBrutes(): readonly { readonly id: number; readonly actif: number }[] {
  const sqlite = new DatabaseSync(fichier, { readOnly: true })
  try {
    return sqlite
      .prepare('SELECT id, actif FROM user_equipment_filter ORDER BY id')
      .all() as unknown as readonly { readonly id: number; readonly actif: number }[]
  } finally {
    sqlite.close()
  }
}

// ==============================================================================================

describe('65b-bis — le réglage traverse la fermeture de l’application', () => {
  it('1. allumé puis rouvert : toujours allumé', () => {
    session(({ db }) => {
      writeFiltreEquipement(db, true)
      expect(readFiltreEquipement(db)).toBe(true)
    })

    // ⛔ NOUVELLE SESSION, NOUVEL OBJET `UserDb`, MÊME FICHIER. C'est ici que la fausse
    // implémentation à `WeakMap` tombe : son cache est indexé par l'objet, qui vient de mourir.
    session(({ db }) => {
      expect(readFiltreEquipement(db)).toBe(true)
    })
  })

  it('2. éteint EXPLICITEMENT puis rouvert : toujours éteint, et pas par défaut', () => {
    session(({ db }) => {
      writeFiltreEquipement(db, true)
      writeFiltreEquipement(db, false)
    })

    session(({ db }) => {
      expect(readFiltreEquipement(db)).toBe(false)
      // La distinction se lit dans la TABLE : la ligne existe et porte 0. Un défaut de lecture
      // rendrait `false` sans qu'aucune ligne n'ait jamais été écrite — ce n'est pas la même chose.
      expect(lignesBrutes()).toEqual([{ id: 1, actif: 0 }])
    })
  })

  it('3. la table porte réellement la ligne, lue sans le store', () => {
    session(({ db }) => {
      writeFiltreEquipement(db, true)
    })
    expect(lignesBrutes()).toEqual([{ id: 1, actif: 1 }])
  })

  it('4. la chaîne ENTIÈRE survit : après réouverture, le moteur revoit la liste', () => {
    session(({ db }) => {
      writeOwnedEquipmentIds(db, [FOUR])
      writeFiltreEquipement(db, true)
    })

    session(({ db }) => {
      // ⛔ LES DEUX ENSEMBLE, ET C'EST TOUT L'INTÉRÊT DE LA CLAUSE. Le défaut redouté est
      // ASYMÉTRIQUE : le matériel survit, le filtre non. Vérifier le drapeau seul le manquerait.
      expect(readOwnedEquipmentIds(db)).toEqual([FOUR])
      expect(readFiltreEquipement(db)).toBe(true)
      expect(readConstraints(db, SANS_CATALOGUE).ownedEquipmentIds).toEqual([FOUR])
    })
  })

  it('5. une base JAMAIS réglée n’a aucune ligne — « n’a rien dit » n’est pas « a dit non »', () => {
    // ⛔ SANS CETTE CLAUSE, ÉCRIRE `actif = 0` AU DÉMARRAGE PASSERAIT LES QUATRE AUTRES. Tout le lot
    // 65b a été construit pour distinguer l'absence de réponse d'une réponse négative ; une écriture
    // au premier lancement effacerait cette distinction sans qu'aucun test ne bronche.
    session(({ db }) => {
      expect(readFiltreEquipement(db)).toBe(false)
    })
    expect(lignesBrutes()).toEqual([])

    session(({ db }) => {
      expect(readConstraints(db, SANS_CATALOGUE).ownedEquipmentIds).toBeNull()
    })
    expect(lignesBrutes()).toEqual([])
  })
})
