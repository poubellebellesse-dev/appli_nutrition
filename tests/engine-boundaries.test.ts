// tests/engine-boundaries.test.ts
//
// Barrière de build (docs/ENGINE.md §3) : engine/ n'importe JAMAIS react/sqlite/data/features/ui.
// Ce n'est pas une convention, c'est un test qui échoue. Vérifié :
//   - modules interdits : react, react-dom (et sous-chemins), node:sqlite, better-sqlite3,
//     sql.js, @sqlite.org/* (docs/ARCHITECTURE.md §3, docs/ENGINE.md §3)
//   - chemins relatifs qui remontent vers data/, features/ ou ui/ une fois résolus
//
// Deux volets :
//   1. Le scan réel de app/src/engine/**/*.ts doit être PROPRE (aucune violation).
//   2. Le détecteur lui-même est prouvé capable de repérer chaque catégorie d'import interdit,
//      sur des extraits de code SYNTHÉTIQUES (chaînes en mémoire) — jamais en écrivant un
//      fichier cassé dans le dépôt.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENGINE_DIR = path.join(__dirname, '..', 'app', 'src', 'engine')

// ----------------------------------------------------------------------------
// Détection — pure, testable indépendamment du système de fichiers réel.
// ----------------------------------------------------------------------------

const FORBIDDEN_EXACT_MODULES = new Set(['react', 'react-dom', 'node:sqlite', 'better-sqlite3', 'sql.js'])
const FORBIDDEN_MODULE_PREFIXES = ['react/', 'react-dom/', '@sqlite.org/']
const FORBIDDEN_PATH_SEGMENTS = new Set(['data', 'features', 'ui'])

/** Extrait tous les spécificateurs de module d'un source (import/export/dynamic import/require). */
function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const match of source.matchAll(re)) {
      const specifier = match[1]
      if (specifier) specifiers.push(specifier)
    }
  }
  return specifiers
}

function isForbiddenModule(specifier: string): boolean {
  if (FORBIDDEN_EXACT_MODULES.has(specifier)) return true
  return FORBIDDEN_MODULE_PREFIXES.some((prefix) => specifier.startsWith(prefix))
}

/** Résout un import relatif depuis `fileAbsPath` et vérifie s'il traverse data/, features/ ou ui/. */
function resolvesIntoForbiddenLayer(fileAbsPath: string, specifier: string): boolean {
  if (!specifier.startsWith('.')) return false
  const fromDir = path.posix.dirname(fileAbsPath.split(path.sep).join('/'))
  const resolved = path.posix.normalize(path.posix.join(fromDir, specifier))
  return resolved.split('/').some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))
}

export interface ForbiddenImport {
  readonly specifier: string
  readonly reason: string
}

/** Retourne les imports interdits d'un fichier source (chemin fictif ou réel). */
function findForbiddenImports(fileAbsPath: string, source: string): ForbiddenImport[] {
  const violations: ForbiddenImport[] = []
  for (const specifier of extractSpecifiers(source)) {
    if (isForbiddenModule(specifier)) {
      violations.push({ specifier, reason: `module interdit dans engine/ (§3 ENGINE) : '${specifier}'` })
    } else if (resolvesIntoForbiddenLayer(fileAbsPath, specifier)) {
      violations.push({
        specifier,
        reason: `import remontant vers data/, features/ ou ui/ (§3 ENGINE) : '${specifier}'`,
      })
    }
  }
  return violations
}

function listTsFilesRecursively(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...listTsFilesRecursively(full))
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

// ----------------------------------------------------------------------------
// 1. Le scan réel de engine/ doit être propre.
// ----------------------------------------------------------------------------

describe('engine/ — barrière de dépendance (docs/ENGINE.md §3)', () => {
  it("n'importe jamais react, sqlite, data/, features/ ou ui/", () => {
    const files = listTsFilesRecursively(ENGINE_DIR)
    expect(files.length).toBeGreaterThan(0) // garde-fou : le test ne doit pas passer "par vide"

    const allViolations: { file: string; violations: ForbiddenImport[] }[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const violations = findForbiddenImports(file, source)
      if (violations.length > 0) allViolations.push({ file: path.relative(ENGINE_DIR, file), violations })
    }

    expect(allViolations).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// 2. Preuve que le détecteur repère bien chaque catégorie d'import interdit — sur des extraits
//    synthétiques, sans jamais écrire de fichier cassé dans le dépôt.
// ----------------------------------------------------------------------------

describe('engine/ — le détecteur repère chaque catégorie interdite (fixtures en mémoire)', () => {
  // Chemin fictif plausible, jamais écrit sur disque — seulement utilisé pour la résolution
  // relative dans resolvesIntoForbiddenLayer.
  const FAKE_FILE = path.join(ENGINE_DIR, 'selection', 'fixture-not-written-to-disk.ts')

  it('détecte un import de react', () => {
    const violations = findForbiddenImports(FAKE_FILE, `import { useState } from 'react'\n`)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.specifier).toBe('react')
  })

  it('détecte un import de sous-chemin react/react-dom', () => {
    const violations = findForbiddenImports(FAKE_FILE, `import { createRoot } from 'react-dom/client'\n`)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.specifier).toBe('react-dom/client')
  })

  it('détecte un import de node:sqlite', () => {
    const violations = findForbiddenImports(FAKE_FILE, `import { DatabaseSync } from 'node:sqlite'\n`)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.specifier).toBe('node:sqlite')
  })

  it('détecte un import de better-sqlite3 et sql.js', () => {
    const source = `import Database from 'better-sqlite3'\nimport initSqlJs from 'sql.js'\n`
    const violations = findForbiddenImports(FAKE_FILE, source)
    expect(violations.map((v) => v.specifier).sort()).toEqual(['better-sqlite3', 'sql.js'])
  })

  it('détecte un import de @sqlite.org/*', () => {
    const violations = findForbiddenImports(FAKE_FILE, `import sqlite3InitModule from '@sqlite.org/sqlite-wasm'\n`)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.specifier).toBe('@sqlite.org/sqlite-wasm')
  })

  it('détecte un import relatif remontant vers data/', () => {
    // Depuis app/src/engine/selection/, '../../data/x.js' résout vers app/src/data/x.js.
    const violations = findForbiddenImports(FAKE_FILE, `import { openCatalog } from '../../data/db.js'\n`)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.specifier).toBe('../../data/db.js')
  })

  it('détecte un import relatif remontant vers features/ ou ui/', () => {
    const source = `import { Screen } from '../../features/today/Screen.js'\nimport { Button } from '../../ui/Button.js'\n`
    const violations = findForbiddenImports(FAKE_FILE, source)
    expect(violations.map((v) => v.specifier).sort()).toEqual([
      '../../features/today/Screen.js',
      '../../ui/Button.js',
    ])
  })

  it("n'accuse pas à tort un import interne à engine/", () => {
    const source = `import type { Catalog } from '../domain/index.js'\nimport type { SelectionLayer } from './index.js'\n`
    expect(findForbiddenImports(FAKE_FILE, source)).toEqual([])
  })
})
