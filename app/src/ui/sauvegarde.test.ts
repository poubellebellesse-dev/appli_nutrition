// ui/sauvegarde.test.ts — export/restauration de `user.db` (docs/ARCHITECTURE.md §7, mesures 3, 4, 5).
//
// ⚠️ `sauvegarde.ts` importe `./user-source.js`, qui parle OPFS et sqlite-wasm et ne tourne pas hors
// navigateur : on le remplace, comme `parametres.test.tsx` le fait pour les mêmes raisons. Les
// fonctions testées ici sont les fonctions PURES (politique de rappel, nom de fichier, verdict de
// version) — `exporterSauvegarde` et `restaurerSauvegarde` orchestrent des I/O déjà mockées ailleurs
// (voir `parametres.test.tsx`), donc ce fichier n'a pas à les rejouer.

import { describe, expect, it, vi } from 'vitest'

vi.mock('./user-source.js', () => ({
  octetsDeLaBase: vi.fn(),
  remplacerLeFichier: vi.fn(),
  verifierSauvegarde: vi.fn(),
}))

import {
  ancienneteSauvegarde,
  doitRappeler,
  jugerVersion,
  joursDepuis,
  lireEtatSauvegarde,
  nomFichierSauvegarde,
  restaurerSauvegarde,
  resumeSauvegarde,
  SEUIL_RAPPEL_JOURS,
} from './sauvegarde.js'
import { verifierSauvegarde } from './user-source.js'
import { USER_SCHEMA_VERSION } from '../data/user-schema.js'
import { writeDernierExport } from '../data/user-store.js'
import { baseCourante, reinitialiserBase } from './test-socle.js'

describe('nomFichierSauvegarde', () => {
  it('date le fichier à partir d’un ISO complet', () => {
    expect(nomFichierSauvegarde('2026-08-06T14:32:00.000Z')).toBe('nutrition-2026-08-06.nutri-backup')
  })

  it('accepte aussi une date seule', () => {
    expect(nomFichierSauvegarde('2026-08-06')).toBe('nutrition-2026-08-06.nutri-backup')
  })
})

describe('joursDepuis', () => {
  it('compte les jours pleins écoulés', () => {
    expect(joursDepuis('2026-08-01', '2026-08-06')).toBe(5)
  })

  it('rend null si la date de départ est null', () => {
    expect(joursDepuis(null, '2026-08-06')).toBeNull()
  })

  it('rend null si la date de départ est vide', () => {
    expect(joursDepuis('', '2026-08-06')).toBeNull()
  })

  it('rend null si la date de départ est illisible', () => {
    expect(joursDepuis('pas-une-date', '2026-08-06')).toBeNull()
  })

  it('ne rend jamais un nombre négatif quand la date est dans le futur', () => {
    expect(joursDepuis('2026-08-10', '2026-08-06')).toBe(0)
  })
})

describe('ancienneteSauvegarde', () => {
  it('se rabat sur la date de création du profil quand aucun export n’a eu lieu', () => {
    const jours = ancienneteSauvegarde({ dernierExport: null, creeLe: '2026-07-20' }, '2026-08-06')
    expect(jours).toBe(17)
  })

  it('rend null quand ni l’export ni la création ne sont connus', () => {
    expect(ancienneteSauvegarde({ dernierExport: null, creeLe: null }, '2026-08-06')).toBeNull()
  })
})

describe('doitRappeler', () => {
  it('est faux exactement au seuil', () => {
    const creeLe = `2026-07-${23}` // 14 jours avant le 2026-08-06
    expect(SEUIL_RAPPEL_JOURS).toBe(14)
    expect(doitRappeler({ dernierExport: null, creeLe }, '2026-08-06')).toBe(false)
  })

  it('est vrai un jour après le seuil', () => {
    expect(doitRappeler({ dernierExport: null, creeLe: '2026-07-22' }, '2026-08-06')).toBe(true)
  })

  it('est faux quand aucune date n’est connue', () => {
    expect(doitRappeler({ dernierExport: null, creeLe: null }, '2026-08-06')).toBe(false)
  })

  it('⭐ réclame une sauvegarde pour un profil créé il y a 30 jours et jamais exporté', () => {
    expect(doitRappeler({ dernierExport: null, creeLe: '2026-07-07' }, '2026-08-06')).toBe(true)
  })
})

describe('resumeSauvegarde', () => {
  it('dit « Jamais sauvegardé » sans export', () => {
    expect(resumeSauvegarde({ dernierExport: null, creeLe: null }, '2026-08-06')).toBe('Jamais sauvegardé')
  })

  it('dit « Aujourd’hui » pour un export du jour même', () => {
    expect(resumeSauvegarde({ dernierExport: '2026-08-06', creeLe: null }, '2026-08-06')).toBe("Aujourd'hui")
  })

  it('dit « Hier » pour un export de la veille', () => {
    expect(resumeSauvegarde({ dernierExport: '2026-08-05', creeLe: null }, '2026-08-06')).toBe('Hier')
  })

  it('compte les jours au-delà de deux', () => {
    expect(resumeSauvegarde({ dernierExport: '2026-08-01', creeLe: null }, '2026-08-06')).toBe('Il y a 5 jours')
  })

  it('ajoute « — à refaire » passé le seuil de rappel', () => {
    expect(resumeSauvegarde({ dernierExport: '2026-07-01', creeLe: null }, '2026-08-06')).toBe(
      'Il y a 36 jours — à refaire'
    )
  })
})

describe('jugerVersion', () => {
  it('accepte une version antérieure — la migration sait la monter', () => {
    expect(jugerVersion(USER_SCHEMA_VERSION - 1, USER_SCHEMA_VERSION)).toEqual({ ok: true })
  })

  it('accepte la version courante', () => {
    expect(jugerVersion(USER_SCHEMA_VERSION, USER_SCHEMA_VERSION)).toEqual({ ok: true })
  })

  it('refuse une version supérieure, avec un motif qui parle de mettre à jour l’application', () => {
    const verdict = jugerVersion(USER_SCHEMA_VERSION + 1, USER_SCHEMA_VERSION)
    expect(verdict.ok).toBe(false)
    expect(!verdict.ok && verdict.motif).toMatch(/mettez l'application à jour/i)
  })

  it('refuse un nombre négatif', () => {
    expect(jugerVersion(-1, USER_SCHEMA_VERSION).ok).toBe(false)
  })

  it('refuse un nombre non entier', () => {
    expect(jugerVersion(1.5, USER_SCHEMA_VERSION).ok).toBe(false)
  })
})

describe('lireEtatSauvegarde', () => {
  it('rend deux dates null sur une base neuve', () => {
    const db = reinitialiserBase()
    expect(lireEtatSauvegarde(db)).toEqual({ dernierExport: null, creeLe: null })
  })

  it('reflète la date écrite par writeDernierExport', () => {
    reinitialiserBase()
    const db = baseCourante()
    writeDernierExport(db, '2026-08-06T10:00:00.000Z')
    expect(lireEtatSauvegarde(db).dernierExport).toBe('2026-08-06T10:00:00.000Z')
  })
})

// ⚠️ AJOUTÉ APRÈS RELECTURE DE SÉCURITÉ (2026-08-06). Restaurer alloue le fichier DEUX fois — une
// copie dans le tas WASM pour le désérialiser, une seconde pour réexporter la base migrée. Sans
// plafond, un fichier de plusieurs gigaoctets présenté comme « une sauvegarde » fait tomber l'onglet
// AVANT qu'on ait pu regarder ce qu'il contient : l'utilisateur n'obtient pas un refus, il obtient
// un plantage, et rien ne lui dit pourquoi.
describe('restaurerSauvegarde — la borne de taille', () => {
  /** Un `File` dont on force la taille déclarée : allouer 64 Mo pour un test serait absurde. */
  function fichierDeTaille(octets: number): File {
    const fichier = new File([new Uint8Array([1, 2, 3])], 'enorme.nutri-backup')
    Object.defineProperty(fichier, 'size', { value: octets })
    return fichier
  }

  it('refuse un fichier trop volumineux SANS jamais l’ouvrir', async () => {
    const resultat = await restaurerSauvegarde(fichierDeTaille(65 * 1024 * 1024))

    expect(resultat.ok).toBe(false)
    // Le point du test : le refus tombe avant la désérialisation, pas après.
    expect(verifierSauvegarde).not.toHaveBeenCalled()
  })

  it('refuse un fichier vide, et le dit autrement qu’un fichier illisible', async () => {
    const resultat = await restaurerSauvegarde(new File([], 'vide.nutri-backup'))

    expect(resultat).toEqual({ ok: false, motif: 'Ce fichier est vide.' })
    expect(verifierSauvegarde).not.toHaveBeenCalled()
  })
})
