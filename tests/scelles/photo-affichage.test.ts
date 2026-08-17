// tests/scelles/photo-affichage.test.ts — l'examen du lot « photo-affichage », écrit AVANT la
// première ligne de code.
//
// Écrit depuis le seul « Fini quand » de `docs/CONCEPTION_PHOTOS_RECETTES.md` (lot 1), et depuis
// rien d'autre. ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Un test d'acceptation qui passe avant
// que le code existe ne prouve rien du tout.
//
// ⚠️ DES NOMBRES EXACTS ICI, ET C'EST VOULU. 129 est le compte rendu par
// `node catalog/import-photos.mjs --dry` le 2026-08-13 — les photos tranchées `oui` à l'atelier ET
// importables (recette connue, fichier présent au bac, crédit disponible). S'il devient faux parce
// qu'une décision de tri a bougé, on le dit et on s'arrête — on ne le retouche pas pour le faire
// passer.
//
// ⚠️ CE FICHIER NE LIT JAMAIS `atelier/`, QUI EST GITIGNORÉ (`.gitignore:43`). Un critère
// d'acceptation qui ne se rejoue sur aucun clone n'est pas un critère — c'est la leçon retenue de
// `65a-A.test.ts`. Tout ce qui suit se vérifie sur des artefacts VERSIONNÉS : la base construite,
// les fichiers de `app/public/catalog/images/`, et la source des écrans. La production de ces
// artefacts, elle, exige le bac et se lance à la main : `node catalog/import-photos.mjs`.
//
// ⚠️ BUILD VERS UN FICHIER ISOLÉ, jamais vers le `catalog.db` partagé : `catalog/build.test.ts` le
// reconstruit en parallèle et deux builds concurrents se corrompent.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')
const IMAGES = path.join(REPO_ROOT, 'app', 'public', 'catalog', 'images')

/** Le compte rendu par `import-photos.mjs --dry` le 2026-08-13. */
const PHOTOS_ATTENDUES = 129

/** La seule des 129 à porter un cadre carré posé à la main, et la raison d'être de la moitié « cadrage ». */
const CADREE = 'hareng-pommes-terre-tiedes'

/** Un témoin SANS cadre : il doit garder le ratio de sa source, donc ne PAS devenir carré. */
const NON_CADREE = 'blanquette-veau'

let db: DatabaseSync

beforeAll(() => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-photo-affichage-'))
  const dbPath = path.join(fixtureDir, 'catalog.db')
  const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  expect(result.status).toBe(0)
  db = new DatabaseSync(dbPath)
})

describe('photo-affichage — les photos tranchées sont servies', () => {
  it(`⛔ ${PHOTOS_ATTENDUES} recettes portent un \`image_path\` non nul`, () => {
    // Le test qui échouera en premier aujourd'hui : la base en porte 116. Les 13 manquantes sont
    // décidées depuis l'atelier et n'attendent que le passage de l'import.
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM recipe WHERE image_path IS NOT NULL AND image_path <> ''")
      .get() as { readonly n: number }

    expect(n).toBe(PHOTOS_ATTENDUES)
  })

  it('⛔ CHAQUE `image_path` DÉSIGNE UN FICHIER QUI EXISTE — un chemin en base sans fichier est un carré vide à l’écran', () => {
    // C'est la moitié du critère qu'on ne peut pas obtenir en trichant : poser 129 chemins est
    // trivial, les faire tous atterrir sur un fichier réel ne l'est pas.
    const lignes = db
      .prepare("SELECT id, image_path FROM recipe WHERE image_path IS NOT NULL AND image_path <> '' ORDER BY id")
      .all() as unknown as readonly { readonly id: string; readonly image_path: string }[]

    const absents = lignes
      .filter(({ image_path }) => !existsSync(path.join(REPO_ROOT, 'app', 'public', image_path.replace(/^\//, ''))))
      .map((l) => l.id)

    expect(absents).toEqual([])
  })

  it('AUCUNE IMAGE ORPHELINE — un `.avif` que plus aucune recette ne nomme pèse dans le paquet pour rien', () => {
    const nommees = new Set(
      (
        db
          .prepare("SELECT image_path FROM recipe WHERE image_path IS NOT NULL AND image_path <> ''")
          .all() as unknown as readonly { readonly image_path: string }[]
      ).map((l) => path.basename(l.image_path)),
    )

    const surDisque = readdirSync(IMAGES).filter((f) => f.endsWith('.avif'))
    expect(surDisque.filter((f) => !nommees.has(f))).toEqual([])
  })
})

describe('photo-affichage — le cadre posé à l’atelier est honoré', () => {
  it(`⛔ \`${CADREE}\` SORT CARRÉ — le cadre a été posé à la main, il doit se voir`, async () => {
    // La raison d'être de cette moitié du lot, réduite à une assertion. Aujourd'hui le fichier
    // n'existe même pas : cette photo fait partie des 13 jamais importées.
    const fichier = path.join(IMAGES, `${CADREE}.avif`)
    expect(existsSync(fichier), `${CADREE}.avif est absent de app/public/catalog/images/`).toBe(true)

    const { width, height } = await sharp(fichier).metadata()
    expect(width).toBe(height)
  })

  it(`\`${NON_CADREE}\` GARDE LE RATIO DE SA SOURCE — le carré n’est pas appliqué par défaut`, async () => {
    // Le garde-fou de la moitié précédente. Un recadrage centré automatique ferait passer le test
    // du dessus tout en coupant l'assiette de 128 photos que personne n'a regardées — c'est
    // l'option (b) explicitement écartée au document de conception.
    const fichier = path.join(IMAGES, `${NON_CADREE}.avif`)
    expect(existsSync(fichier)).toBe(true)

    const { width, height } = await sharp(fichier).metadata()
    expect(width).not.toBe(height)
  })
})

describe('photo-affichage — l’écran lit enfin le champ', () => {
  it('⛔ `aujourdhui.tsx` REND UNE BALISE `<img>` À PARTIR DE `imagePath`', () => {
    // Assertion de source, comme `65a-A.test.ts` pour la localisation de sa règle : le rendu réel
    // se vérifie dans `app/src/ui/screens/aujourdhui.test.tsx`, qui monte l'écran — mais ce
    // fichier-ci passe par une FIXTURE de catalogue, et un test scellé ne se prononce pas sur une
    // fixture. Ce qu'on verrouille ici est le fait brut : le champ a cessé d'être mort.
    const source = readFileSync(path.join(REPO_ROOT, 'app', 'src', 'ui', 'screens', 'aujourdhui.tsx'), 'utf8')

    expect(source, 'aucune lecture de imagePath').toMatch(/imagePath/)
    expect(source, 'aucune balise img').toMatch(/<img\b/)
  })

  it('⛔ L’APLAT RESTE — il est le repli des 201 recettes sans photo, il ne disparaît pas', () => {
    // Le lot remplace le cas UNIQUE par un cas de REPLI. Supprimer `vignette.ts` ferait passer le
    // test du dessus et casserait les deux tiers du catalogue.
    const source = readFileSync(path.join(REPO_ROOT, 'app', 'src', 'ui', 'screens', 'aujourdhui.tsx'), 'utf8')

    expect(source).toMatch(/couleurDeRecette/)
    expect(source).toMatch(/initialeDeRecette/)
    expect(existsSync(path.join(REPO_ROOT, 'app', 'src', 'ui', 'vignette.ts'))).toBe(true)
  })
})
