// ui/texte-consentement.test.ts
//
// Le texte du premier lancement est la seule prose que TOUT le monde lit, et la seule qui engage
// juridiquement (§6 ARCHITECTURE, section contraignante). Il mérite les mêmes gardes que le contenu
// du catalogue — lequel casse le build au premier mot banni (`catalog/build.mjs`), alors que rien ne
// surveillait celui-ci.

import { describe, expect, it } from 'vitest'
import { findBannedTerms } from '../engine/guards/banned-terms.js'
import { POINTS_CONSENTEMENT, VERSION_CONSENTEMENT } from './texte-consentement.js'

const TOUTES_LES_PHRASES: readonly string[] = POINTS_CONSENTEMENT.flatMap((p) => [
  p.resume,
  ...p.detail,
])

describe('ui/texte-consentement — vocabulaire', () => {
  it('n’emploie AUCUN terme banni (§6.2 ARCHITECTURE)', () => {
    // Le piège que ce test attrape : « soigner » est banni. Une formule aussi naturelle que
    // « une aide pour cuisiner, pas pour vous soigner » aurait passé la relecture humaine.
    for (const phrase of TOUTES_LES_PHRASES) {
      expect(findBannedTerms(phrase), `terme banni dans : ${phrase}`).toEqual([])
    }
  })

  it('ne promet aucun effet sur la santé', () => {
    // Famille thérapeutique de §6.1, au-delà de la liste littérale : le texte doit décrire ce que
    // l'application FAIT, jamais ce qu'elle apporterait à un corps.
    for (const phrase of TOUTES_LES_PHRASES) {
      expect(phrase.toLowerCase()).not.toMatch(/\baméliore (votre|ta) santé|fait maigrir|perdre du poids/)
    }
  })
})

describe('ui/texte-consentement — structure', () => {
  it('couvre les quatre engagements attendus', () => {
    // Un point retiré par mégarde ne casserait aucun rendu : l'écran afficherait simplement une
    // carte de moins, et une promesse cesserait d'être faite sans que personne le remarque.
    const resumes = POINTS_CONSENTEMENT.map((p) => p.resume.toLowerCase())
    expect(resumes.some((r) => r.includes('appareil'))).toBe(true) // vie privée
    expect(resumes.some((r) => r.includes('médical'))).toBe(true) // santé — non supprimable
    expect(resumes.some((r) => r.includes('gratuite'))).toBe(true) // modèle économique
    expect(resumes.some((r) => r.includes('seule personne'))).toBe(true) // qui est derrière
    expect(POINTS_CONSENTEMENT).toHaveLength(4)
  })

  it('donne à chaque point un résumé COURT et un détail non vide', () => {
    for (const point of POINTS_CONSENTEMENT) {
      // Un résumé qui déborde n'est plus un résumé : la carte repliée redevient un pavé.
      expect(point.resume.length, `résumé trop long : ${point.resume}`).toBeLessThanOrEqual(60)
      expect(point.resume.endsWith('.'), `résumé sans point final : ${point.resume}`).toBe(true)
      // Un détail vide ferait un bouton « Lire » qui n'ouvre rien.
      expect(point.detail.length).toBeGreaterThan(0)
      for (const paragraphe of point.detail) expect(paragraphe.trim()).not.toBe('')
    }
  })

  it('porte une version datée, qu’il faut changer avec le texte', () => {
    expect(VERSION_CONSENTEMENT).toMatch(/^accueil-\d{4}-\d{2}-\d{2}$/)
  })
})
