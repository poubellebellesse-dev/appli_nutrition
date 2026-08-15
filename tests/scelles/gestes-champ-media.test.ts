// ⛔ TEST SCELLÉ — LOT « gestes-champ-media » (lot 1 du chantier des gestes illustrés).
//    Document : docs/CONCEPTION_GESTES_ILLUSTRES.md §5, lot 1.
//    Écrit AVANT le code, depuis le « Fini quand » SEUL. Il DOIT échouer aujourd'hui.
//
// CE QUE CE LOT FAIT, ET RIEN D'AUTRE : il ouvre un point d'accroche pour un média sur le lexique.
// Il n'importe aucun fichier, n'affiche aucun pixel, et laisse les 62 gestes SANS clip. C'est
// volontaire : « un champ déclaré n'est pas un champ branché » a déjà été payé TROIS fois dans ce
// dépôt, dont une sur `Recipe.imagePath` lui-même. Séparer la déclaration de l'import est ce qui
// rend chacune des deux vérifiable.
//
// ⚠️ POURQUOI UN TEST « LE CHAMP EST VIDE » N'EST PAS UN TEST QUI NE TESTE RIEN : il verrouille que
// le lot 1 n'a pas triché en fabriquant des chemins à partir du code du geste. Le seul test qui
// discrimine vraiment est celui du témoin planté à la main, plus bas — sans lui, une implémentation
// qui rendrait `clips: cheminsDevines(entry.code)` passerait tout le reste.

import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { loadCatalog } from '../../app/src/data/catalog-loader-node.js'

const RACINE = join(import.meta.dirname, '..', '..')
const BASE = join(RACINE, 'app', 'public', 'catalog', 'catalog.db')

/** Chemins-témoins : ils ne ressemblent à AUCUNE convention que le code pourrait deviner. */
const TEMOIN = {
  poster: '/catalog/gestes/__temoin-jamais-importe__/poster.jpg',
  av1: '/catalog/gestes/__temoin-jamais-importe__/segment.av1.mp4',
  h264: '/catalog/gestes/__temoin-jamais-importe__/segment.h264.mp4',
  // ⚠️ `moment` porte une valeur LÉGALE, contrairement aux chemins ci-dessus. Toutes les colonnes-
  // énumérations de `build.mjs` portent un `CHECK` (`origine`, `niveau`, `niveau_preuve`) : une
  // chaîne inventée ferait échouer l'INSERT de ce test si le codeur suit la convention du dépôt,
  // et le test punirait le bon réflexe. Ce qui discrimine ici n'est pas l'étrangeté de la valeur
  // mais le fait qu'elle soit FAUSSE POUR SON RANG : au rang 0, un code qui déduirait le nom
  // rendrait « debut ». (Trou relevé par la relecture du 2026-08-14.)
  moment: 'fin',
} as const

const temporaires: string[] = []

afterAll(() => {
  for (const dossier of temporaires) rmSync(dossier, { recursive: true, force: true })
})

/**
 * Copie `catalog.db` dans un dossier temporaire et rend le chemin de la copie.
 *
 * ⛔ NE JAMAIS ÉCRIRE DANS `app/public/catalog/catalog.db` : les tests d'écran chargent CE
 * fichier-là (`ui/test-socle.ts`), et le modifier ferait échouer d'autres fichiers de test sans
 * qu'aucun message ne désigne la cause.
 */
function copieDeLaBase(): string {
  const dossier = mkdtempSync(join(tmpdir(), 'gestes-champ-media-'))
  temporaires.push(dossier)
  const copie = join(dossier, 'catalog.db')
  copyFileSync(BASE, copie)
  return copie
}

describe('lot gestes-champ-media — le lexique gagne un point d’accroche, et rien de plus', () => {
  it('⛔ LA TABLE `lexicon_clip` EXISTE, avec ses colonnes et sa clé composite', () => {
    const db = new DatabaseSync(BASE, { readOnly: true })
    try {
      const table = db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'lexicon_clip'")
        .get() as { sql?: string } | undefined

      expect(table, 'la table `lexicon_clip` n’existe pas dans catalog.db').toBeDefined()

      const sql = (table?.sql ?? '').toLowerCase()
      // Les trois chemins, séparément. Un seul champ « media_path » ne porterait pas la décision
      // D2 (les DEUX formats), et se lirait « il n'en manque qu'un » au moment de l'import.
      //
      // `moment` porte le nom du segment — `debut` / `milieu` / `fin` / `unique`, tels quels dans
      // les fichiers encodés (29 / 23 / 25 / 21). Il ne se déduit PAS de `ordre` : `deglacer` ne
      // porte que `milieu` et `fin`, et la bande de la décision D6 afficherait « 1 » devant un
      // milieu. Une colonne, donc, pas un calcul.
      for (const colonne of ['poster_path', 'av1_path', 'h264_path', 'moment', 'ordre', 'lexicon_entry_id']) {
        expect(sql, `colonne absente : ${colonne}`).toContain(colonne)
      }
      // ⚠️ `NOT NULL` sur les quatre valeurs, pas seulement leur présence. Relecture du
      // 2026-08-14 : un `poster_path` NULL ne lèverait rien à l'insertion, et le chargeur
      // rendrait `moment: null` typé `string` — l'écran planterait au montage, pas ici.
      // Un segment sans son H.264 est inutilisable (décision D2, les DEUX formats).
      for (const colonne of ['poster_path', 'av1_path', 'h264_path', 'moment']) {
        expect(sql, `« ${colonne} » n’est pas NOT NULL`).toMatch(
          new RegExp(`${colonne}\\s+text\\s+not\\s+null`)
        )
      }
      // Un geste porte PLUSIEURS segments (98 pour 51 gestes) : la clé ne peut pas être l'entrée
      // seule, sinon le deuxième segment écrase le premier en silence.
      expect(sql, 'la clé primaire n’est pas composite (entrée + ordre)').toMatch(
        /primary\s+key\s*\(\s*lexicon_entry_id\s*,\s*ordre\s*\)/
      )
      // Toutes les tables filles voisines déclarent la leur (`recipe_equipment`,
      // `recipe_step_ingredient`). Sans elle, un clip peut survivre à la disparition de son
      // geste et n'être plus rattaché à rien — sans qu'aucune erreur se lève.
      // (Trou relevé par la relecture du 2026-08-14 : le test ne lisait que les noms de colonnes.)
      expect(sql, 'la table ne déclare aucune clé étrangère vers `lexicon_entry`').toMatch(
        /references\s+lexicon_entry\s*\(\s*id\s*\)/
      )
    } finally {
      db.close()
    }
  })

  it('⛔ DEUX SEGMENTS NE PEUVENT PAS PARTAGER LE MÊME RANG — la clé tient à l’usage, pas dans le texte', () => {
    // ⚠️ Relecture du 2026-08-14 : le test ci-dessus ne lisait la clé composite que dans le TEXTE
    // du `CREATE TABLE`. Une clé écrite mais neutralisée — colonnes inversées, table recréée
    // ailleurs sans elle — passait la lecture. Ici on l'exerce : le lot 2 importera 98 segments en
    // boucle, et c'est exactement le moment où un rang dupliqué écraserait un segment en silence.
    const copie = copieDeLaBase()
    const db = new DatabaseSync(copie)
    try {
      const cible = (
        db.prepare('SELECT id FROM lexicon_entry ORDER BY code LIMIT 1').get() as { id: string }
      ).id

      const inserer = db.prepare(
        'INSERT INTO lexicon_clip (lexicon_entry_id, ordre, poster_path, av1_path, h264_path, moment) VALUES (?, ?, ?, ?, ?, ?)'
      )
      inserer.run(cible, 0, '/x/0.jpg', '/x/0.av1', '/x/0.h264', 'debut')

      expect(
        () => inserer.run(cible, 0, '/y/0.jpg', '/y/0.av1', '/y/0.h264', 'fin'),
        'un second segment au même rang a été accepté — le premier serait écrasé sans un mot'
      ).toThrow()

      // ⚠️ Et le MÊME rang sur un AUTRE geste doit rester possible : la clé porte sur le couple,
      // pas sur le rang seul. Une clé primaire posée sur `ordre` tout court passerait le refus
      // ci-dessus et casserait ici — les 51 gestes ont tous un segment de rang 0.
      const autre = (
        db.prepare('SELECT id FROM lexicon_entry ORDER BY code LIMIT 1 OFFSET 1').get() as {
          id: string
        }
      ).id
      expect(
        () => inserer.run(autre, 0, '/z/0.jpg', '/z/0.av1', '/z/0.h264', 'unique'),
        'le rang 0 est refusé à un second geste — la clé porte sur le rang seul'
      ).not.toThrow()
    } finally {
      db.close()
    }
  })

  it('⛔ LES 62 FICHES DU LEXIQUE PORTENT `clips`, ET IL EST VIDE — le lot déclare, il n’importe pas', () => {
    // ⚠️ VÉRIFIÉ SUR LA BASE RÉELLE **ET** SUR UNE COPIE, et ce n'est pas une redondance.
    // Relecture du 2026-08-14 : tous les tests qui INSÈRENT travaillent sur une copie en dossier
    // temporaire, et celui-ci lisait la base réelle — deux chemins de fichier différents. Un
    // chargeur qui aurait fait `if (chemin est la base réelle) return []` et lu le SQL partout
    // ailleurs passait les six tests. Faire lire à ce test une copie VIERGE, au même endroit que
    // les autres, retire au tricheur le seul indice dont il disposait : le chemin.
    for (const [ou, chemin] of [
      ['la base réelle', BASE],
      ['une copie vierge', copieDeLaBase()],
    ] as const) {
      const fiches = [...loadCatalog(chemin).lexicon.values()]

      // Garde-fou de non-régression : le lot ne doit RIEN retirer au lexique.
      expect(fiches, `le compte du lexique a bougé (${ou})`).toHaveLength(62)

      for (const fiche of fiches) {
        const clips = (fiche as { clips?: unknown }).clips
        expect(
          Array.isArray(clips),
          `« ${fiche.code} » ne porte pas de tableau \`clips\` (${ou})`
        ).toBe(true)
        expect(clips, `« ${fiche.code} » porte déjà un clip (${ou}) — le lot 1 n’importe rien`).toHaveLength(0)
      }
    }
  })

  it('⛔ LE CHARGEUR REND CE QUI EST EN BASE, IL NE DEVINE AUCUN CHEMIN — le test qui discrimine', () => {
    // C'est le seul test qu'une implémentation tricheuse ne peut pas passer. Sans lui,
    // `clips: [{ posterPath: `/catalog/gestes/${entry.code}/poster.jpg`, … }]` — trois chemins
    // fabriqués à partir du code, sans lire une ligne de SQL — satisferait tout le reste.
    const copie = copieDeLaBase()
    const db = new DatabaseSync(copie)
    let cible: string
    try {
      const premiere = db.prepare('SELECT id, code FROM lexicon_entry ORDER BY code LIMIT 1').get() as {
        id: string
        code: string
      }
      cible = premiere.id

      db.prepare(
        'INSERT INTO lexicon_clip (lexicon_entry_id, ordre, poster_path, av1_path, h264_path, moment) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(cible, 0, TEMOIN.poster, TEMOIN.av1, TEMOIN.h264, TEMOIN.moment)
    } finally {
      db.close()
    }

    const catalogue = loadCatalog(copie)
    const fiche = catalogue.lexicon.get(cible as never)
    expect(fiche, 'le témoin a disparu du catalogue').toBeDefined()

    const clips = (fiche as unknown as { clips: readonly Record<string, string>[] }).clips
    expect(clips, 'le clip planté à la main n’est pas remonté').toHaveLength(1)

    const clip = clips[0]!
    expect(clip.posterPath, 'le chemin du poster a été fabriqué, pas lu').toBe(TEMOIN.poster)
    expect(clip.av1Path, 'le chemin AV1 a été fabriqué, pas lu').toBe(TEMOIN.av1)
    expect(clip.h264Path, 'le chemin H.264 a été fabriqué, pas lu').toBe(TEMOIN.h264)
    expect(clip.moment, 'le nom du moment a été déduit de `ordre`, pas lu').toBe(TEMOIN.moment)
  })

  it('⛔ UN GESTE NE VOIT QUE SES PROPRES CLIPS — le test que la relecture a exigé', () => {
    // ⚠️ CE TEST EXISTE PARCE QUE LES QUATRE AUTRES NE LE COUVRAIENT PAS. Relecture du
    // 2026-08-14 : un chargeur qui ferait `SELECT * FROM lexicon_clip ORDER BY ordre` SANS
    // filtrer par `lexicon_entry_id`, puis collerait le même tableau à TOUTES les fiches,
    // passait les cinq tests précédents — parce qu'aucun n'exerçait deux gestes à la fois.
    // C'est pourtant l'oubli le plus probable d'une première implémentation.
    const copie = copieDeLaBase()
    const db = new DatabaseSync(copie)
    let premier: string
    let second: string
    try {
      const deux = db.prepare('SELECT id FROM lexicon_entry ORDER BY code LIMIT 2').all() as {
        id: string
      }[]
      premier = deux[0]!.id
      second = deux[1]!.id

      const inserer = db.prepare(
        'INSERT INTO lexicon_clip (lexicon_entry_id, ordre, poster_path, av1_path, h264_path, moment) VALUES (?, ?, ?, ?, ?, ?)'
      )
      // Comptes DIFFÉRENTS exprès : 1 clip pour le premier, 2 pour le second. Un tableau
      // partagé entre les fiches rendrait le même compte des deux côtés.
      inserer.run(premier, 0, '/A/0.jpg', '/A/0.av1', '/A/0.h264', 'unique')
      inserer.run(second, 0, '/B/0.jpg', '/B/0.av1', '/B/0.h264', 'debut')
      inserer.run(second, 1, '/B/1.jpg', '/B/1.av1', '/B/1.h264', 'fin')
    } finally {
      db.close()
    }

    const catalogue = loadCatalog(copie)
    const clipsDe = (id: string) =>
      (catalogue.lexicon.get(id as never) as unknown as { clips: readonly { posterPath: string }[] })
        .clips

    expect(clipsDe(premier).map((c) => c.posterPath), 'le premier geste voit des clips qui ne sont pas les siens').toEqual(['/A/0.jpg'])
    expect(clipsDe(second).map((c) => c.posterPath), 'le second geste voit des clips qui ne sont pas les siens').toEqual(['/B/0.jpg', '/B/1.jpg'])

    // Et les 60 autres n'ont rien. C'est la moitié du test qui tue vraiment la triche :
    // sans elle, un chargeur pourrait filtrer correctement les deux cibles par hasard.
    const autres = [...catalogue.lexicon.entries()].filter(([id]) => id !== premier && id !== second)
    expect(autres, 'le lexique n’a pas la taille attendue').toHaveLength(60)
    for (const [, fiche] of autres) {
      const clips = (fiche as unknown as { clips: readonly unknown[] }).clips
      expect(clips, `« ${(fiche as { code: string }).code} » a hérité des clips d’un autre geste`).toHaveLength(0)
    }
  })

  it('⛔ L’ORDRE DES SEGMENTS EST CELUI DE LA COLONNE `ordre`, pas celui de l’insertion', () => {
    // Les 98 segments découpent un geste en début / milieu / fin. Un ordre rendu au hasard des
    // lignes SQL montrerait la fin avant le début, sans qu'aucun test de comptage ne s'en aperçoive.
    const copie = copieDeLaBase()
    const db = new DatabaseSync(copie)
    let cible: string
    try {
      const premiere = db.prepare('SELECT id FROM lexicon_entry ORDER BY code LIMIT 1').get() as {
        id: string
      }
      cible = premiere.id

      const inserer = db.prepare(
        'INSERT INTO lexicon_clip (lexicon_entry_id, ordre, poster_path, av1_path, h264_path, moment) VALUES (?, ?, ?, ?, ?, ?)'
      )
      // Insérés à l'envers EXPRÈS, et les rangs ne se suivent PAS : 0, 2, 10.
      // ⚠️ Les rangs non contigus ont été choisis à la relecture du 2026-08-14 : avec 0/1/2, un
      // tri de `ordre` en CHAÎNE au lieu de nombre rendait le bon résultat par accident. Avec
      // 0/2/10, il rendrait 0, 10, 2.
      // ⚠️ Les moments sont volontairement DÉCALÉS par rapport au rang — le rang 0 porte
      // « milieu », pas « debut ». Un chargeur qui déduirait le nom du rang échouerait ici.
      const LIGNES = [
        { ordre: 2, moment: 'fin' },
        { ordre: 10, moment: 'debut' },
        { ordre: 0, moment: 'milieu' },
      ] as const
      for (const l of LIGNES) {
        inserer.run(cible, l.ordre, `/p/${l.ordre}.jpg`, `/a/${l.ordre}.mp4`, `/h/${l.ordre}.mp4`, l.moment)
      }
    } finally {
      db.close()
    }

    const catalogue = loadCatalog(copie)
    const clips = (
      catalogue.lexicon.get(cible as never) as unknown as {
        clips: readonly { posterPath: string; moment: string }[]
      }
    ).clips

    expect(clips.map((c) => c.posterPath), '`ordre` a été trié en chaîne, pas en nombre').toEqual([
      '/p/0.jpg',
      '/p/2.jpg',
      '/p/10.jpg',
    ])
    expect(clips.map((c) => c.moment), '`moment` a été déduit du rang au lieu d’être lu').toEqual([
      'milieu',
      'fin',
      'debut',
    ])
  })

  it('⛔ RIEN D’AUTRE N’A BOUGÉ DANS LE CATALOGUE — le lot ne touche qu’au lexique', () => {
    // Témoins d'avant, relevés sur l'arbre au moment d'écrire ce test. Si l'un d'eux bouge, c'est
    // que le lot a débordé — et il vaut mieux le voir ici que dans un rapport de fin.
    const catalogue = loadCatalog(BASE)

    // ⚠️ LES SIX COMPTES, PAS TROIS. Relecture du 2026-08-14 : le « Fini quand » promettait
    // « 73 tips, 8 fiches, 1 548 étapes inchangés » et ce test n'en vérifiait aucun — ils
    // n'existaient que dans la sortie console de `build.mjs`, qu'aucune machine ne lit.
    // Un lot qui aurait cassé le chargement des tips serait passé au vert.
    expect(catalogue.foods.size, 'le nombre d’aliments a bougé').toBe(451)
    expect(catalogue.recipes.size, 'le nombre de recettes a bougé').toBe(330)
    expect(catalogue.lexicon.size, 'le nombre de gestes a bougé').toBe(62)
    expect(catalogue.tips.length, 'le nombre de tips a bougé').toBe(73)
    expect(catalogue.evidence.size, 'le nombre de fiches de preuve a bougé').toBe(8)
    expect(catalogue.equipment.size, 'le nombre d’équipements a bougé').toBe(30)

    const etapes = [...catalogue.recipes.values()].reduce((n, r) => n + r.etapes.length, 0)
    expect(etapes, 'le nombre total d’étapes de recette a bougé').toBe(1548)
  })
})
