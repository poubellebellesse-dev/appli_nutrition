// ui/echelle-typo.test.ts — l'échelle de texte reste à six pas.
//
// ⚠️ CE FICHIER EXISTE PARCE QU'UNE ÉCHELLE NE TIENT PAS TOUTE SEULE. Le 2026-08-10, `app/src`
// portait **30 tailles distinctes** sur 421 occurrences de `text-[…rem]` : 0,72 · 0,80 · 0,8125 ·
// 0,82 · 0,85 · 0,88 · 0,90 · 0,92 · 0,95 · 0,98 · 1,00 · 1,02 · 1,05 · 1,08 · 1,10 · 1,12 · 1,15 ·
// 1,20 · 1,25 · 1,30 · 1,35 · 1,40 · 1,50 · 1,60 · 1,90 · 2,00 · 2,10 · 2,20 · 2,40 · 5,00. Aucune
// n'était fautive prise seule ; c'est l'ensemble qui ne se tenait plus. Elles sont arrivées une par
// une, chacune choisie au jugé à côté d'une voisine, sur des écrans écrits à des semaines d'écart.
//
// ⛔ REFAIRE LE MÉNAGE NE SERT À RIEN SANS CE TEST. C'est exactement le mécanisme qui produit une
// 31ᵉ taille : quelqu'un écrit un écran, hésite entre deux pas, et tranche par un nombre entre les
// deux. Rien ne l'en empêche, rien ne le signale, et la revue de code ne voit qu'une ligne de
// classes parmi trente.
//
// ⚠️ ON LIT LES SOURCES, PAS UN RENDU. Une taille se pose dans le JSX ; c'est là qu'il faut la
// refuser. Un test qui monterait les écrans ne verrait que ceux qu'il monte.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RACINE = path.join(process.cwd(), 'app/src')

/**
 * Les six pas déclarés dans `@theme` (`ui/theme.css`). Lus DEPUIS LE FICHIER, jamais recopiés ici :
 * deux listes finiraient par diverger, et c'est le défaut même que ce test combat.
 */
function pasDeclares(): readonly string[] {
  const theme = readFileSync(path.join(RACINE, 'ui/theme.css'), 'utf8')
  return [...theme.matchAll(/--text-([a-z-]+):\s*([0-9.]+)rem/g)].map((m) => m[1]!)
}

/**
 * ⛔ LA SEULE EXCEPTION, et elle est nommée fichier par fichier. Une exception anonyme (« les
 * grandes tailles sont tolérées ») rouvrirait la porte en grand.
 *
 * `aujourdhui.tsx` : l'initiale d'une vignette sans photo — `aria-hidden`, un aplat de couleur, pas
 * du texte. 242 recettes sur 330 n'ont pas d'image ; cette lettre est ce qui tient la place.
 */
const EXCEPTIONS: Readonly<Record<string, readonly string[]>> = {
  'ui/screens/aujourdhui.tsx': ['5rem'],
  // ⚠️ `cuisine.tsx` N'EST PAS UNE EXCEPTION DE PRINCIPE, c'est un fichier qui appartenait à une
  // autre lane le jour du balayage (28 occurrences). Il doit passer à l'échelle au prochain lot qui
  // le touche — cette ligne est une DETTE, pas une dispense, et c'est pour ça qu'elle est datée.
  'ui/screens/cuisine.tsx': [
    '0.9rem', '0.95rem', '1rem', '1.02rem', '1.05rem', '1.1rem', '1.35rem', '1.6rem', '2.2rem',
  ],
}

/** Tous les `.ts`/`.tsx` sous `app/src`, tests exclus. */
function sources(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, entree.name)
    if (entree.isDirectory()) sources(complet, acc)
    else if (/\.tsx?$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name)) acc.push(complet)
  }
  return acc
}

const relatif = (fichier: string) => path.relative(RACINE, fichier).split(path.sep).join('/')

describe('ui — l’échelle typographique', () => {
  it('déclare exactement six pas, tous en rem', () => {
    const theme = readFileSync(path.join(RACINE, 'ui/theme.css'), 'utf8')
    expect(pasDeclares()).toEqual(['mention', 'courant', 'lecture', 'titre-s', 'titre-m', 'titre-l'])
    // ⛔ AUCUN PAS EN PIXELS. La taille de base appartient à l'utilisateur (voir la règle sur `html`
    // dans `theme.css`) ; un pas en px la lui confisquerait et l'agrandissement à 150 % exigé par le
    // bloc commun ne suivrait plus.
    expect(theme).not.toMatch(/--text-[a-z-]+:\s*[0-9.]+px/)
  })

  it('⛔ AUCUNE TAILLE LITTÉRALE DANS LES SOURCES, hors les exceptions nommées', () => {
    const fautives: string[] = []
    for (const fichier of sources(RACINE)) {
      const cle = relatif(fichier)
      const tolerees = EXCEPTIONS[cle] ?? []
      for (const m of readFileSync(fichier, 'utf8').matchAll(/text-\[([0-9.]+rem)\]/g)) {
        if (!tolerees.includes(m[1]!)) fautives.push(`${cle} → text-[${m[1]}]`)
      }
    }
    // Le message d'échec nomme le fichier ET la valeur : quelqu'un qui casse ce test doit lire quel
    // pas prendre, pas partir en fouille.
    expect(fautives).toEqual([])
  })

  it('⛔ UNE EXCEPTION QUI NE SERT PLUS EST UNE EXCEPTION QUI S’ÉLARGIT', () => {
    // Une liste d'exceptions ne se relit jamais d'elle-même. Si une valeur tolérée disparaît du
    // fichier qu'elle couvre, elle doit disparaître d'ici — sinon la porte reste ouverte pour la
    // prochaine, et personne ne saura qu'elle avait été refermée.
    for (const [cle, valeurs] of Object.entries(EXCEPTIONS)) {
      const source = readFileSync(path.join(RACINE, cle), 'utf8')
      const presentes = [...source.matchAll(/text-\[([0-9.]+rem)\]/g)].map((m) => m[1]!)
      for (const valeur of valeurs) {
        expect(presentes, `${cle} ne porte plus text-[${valeur}] — retirer l’exception`).toContain(valeur)
      }
    }
  })

  it('les six pas sont réellement utilisés — un pas que personne ne prend n’est pas un pas', () => {
    const utilises = new Set<string>()
    for (const fichier of sources(RACINE)) {
      for (const m of readFileSync(fichier, 'utf8').matchAll(/\btext-(mention|courant|lecture|titre-[sml])\b/g)) {
        utilises.add(m[1]!)
      }
    }
    expect([...utilises].sort()).toEqual(['courant', 'lecture', 'mention', 'titre-l', 'titre-m', 'titre-s'])
  })
})
