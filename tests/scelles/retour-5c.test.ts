// tests/scelles/retour-5c.test.ts — l'examen du lot retour-5c : rebaser les compteurs que les
// neuf bases nues de `retour-5` font mentir.
//
// retour-5c = « les onze valeurs scellées qui comptent le catalogue valent ce que le catalogue
// compte, et aucun capteur n'a disparu en chemin ». Brief et « Fini quand » complets dans
// `docs/CONCEPTION_RETOURS_TEST.md`, section « Lot retour-5c », écrits le 2026-08-28.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT — 2026-09-09. Les onze valeurs disent encore le
// catalogue de 330 recettes ; il en porte 339 depuis `retour-5` (`d0dd712`).
//
// ---------------------------------------------------------------------------------------------
// CE QUE CE FICHIER GARDE, ET POURQUOI IL LIT DU TEXTE PLUTÔT QUE D'EXÉCUTER
//
// Ce lot ne touche à aucun code de production : il modifie SIX FICHIERS DE TEST. Un examen qui se
// contenterait de relancer la suite ne prouverait rien de plus qu'elle, et surtout il ne saurait
// pas dire POURQUOI elle est verte. Une valeur peut être rendue verte de trois façons, et deux
// sont des fraudes :
//
//   1. en la rebasant sur la mesure          ← la seule voulue
//   2. en la DÉRIVANT du catalogue           ← `toBe(catalogue.recipes.size)` est une tautologie :
//                                              elle passera toujours, y compris le jour où le
//                                              catalogue se casse. Le capteur est mort et personne
//                                              ne le voit. Sortie ÉCARTÉE par l'auteur le
//                                              2026-08-27 ; la clause 3 la rend inexprimable.
//   3. en SUPPRIMANT l'assertion             ← ou en la neutralisant (`.skip`), ou en la VIDANT :
//                                              `toEqual([])` devenu `toBeDefined()` garde le
//                                              compte et perd tout pouvoir. Triche exhibée par
//                                              `/attaquer` le 2026-09-09. Clause 2, moitié
//                                              EMPREINTE.
//
// D'où la forme : ce fichier lit le TEXTE SOURCE des six fichiers et le confronte à une mesure
// refaite ici. Il ne les importe pas, il ne les exécute pas. Devant lui, les fraudes 2 et 3 ne
// sont pas « interdites », elles sont INEXPRIMABLES — la garantie vient de la forme.
//
// ⚠️ LA MESURE EST REFAITE, JAMAIS RECOPIÉE DU BRIEF. Le tableau du brief date du 2026-08-28 ; le
// recopier ferait de ce fichier un perroquet. Si le catalogue rebouge un jour, ce fichier suit et
// les six autres redeviennent rouges : c'est exactement ce qu'on attend de compteurs.
//
// ⚠️ SQL BRUT, PAS LE LOADER DU MOTEUR. Cinq des six fichiers mesurent par `catalog-loader-node`.
// Mesurer ici par le même chemin comparerait une valeur à elle-même.
//
// ---------------------------------------------------------------------------------------------
// ⛔ TROIS MOITIÉS DU « FINI QUAND » QUE CE FICHIER NE DÉMONTRE PAS
//
// C'est la leçon du lot D3, et le brief la porte déjà : une clause que rien ne mesure se DÉCLARE,
// elle ne se sous-entend pas.
//
//   • clause 4, moitié PROSE — un test ne sait pas juger si un commentaire cite `166` comme un
//     souvenir daté ou comme la valeur du jour. Automatisé ici : le CODE et les titres de `it`,
//     où le nombre ne peut être qu'une affirmation d'aujourd'hui.
//   • clause 6 — « `npm test` rend zéro rouge ». Un test ne peut pas relancer la suite qui le
//     contient. Se lit au relevé de `/fin`, et nulle part ailleurs.
//   • clause 7, moitié GIT — « rien hors des six fichiers n'a changé », par `git diff
//     --name-only` au `/fin`. Automatisé ici : les DIX TÉMOINS du catalogue qui ne doivent pas
//     bouger, qui attrapent un débordement dans `catalog/` sans dépendre de l'état de l'index git.
//
// ---------------------------------------------------------------------------------------------
// ⚠️ DEUX DES ONZE VALEURS SONT INVISIBLES DANS `npm test` AUJOURD'HUI, ET C'EST LE PIÈGE DU LOT.
// Vitest abandonne un `it` à la PREMIÈRE assertion fausse : `etapes = 1548` et `SANS_PHOTO = 201`
// ne sont jamais atteintes, donc jamais rouges. Un lot qui ne corrigerait que les dix rouges
// visibles ferait APPARAÎTRE deux rouges neufs au relevé de fin. Ce fichier les lit dans le
// source, pas dans la sortie de vitest : devant lui, les onze sont visibles d'emblée. C'est sa
// deuxième raison d'exister.

import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const CATALOGUE = path.join(REPO_ROOT, 'app', 'public', 'catalog', 'catalog.db')

const source = (fichier: string): string =>
  readFileSync(path.join(__dirname, fichier), 'utf8')

// ══════════════════════════════════════ LA MESURE, PAR SQL ══════════════════════════════════════

const db = new DatabaseSync(CATALOGUE, { readOnly: true })

/** Un seul nombre, lu sur le catalogue réel. Aucune valeur de ce fichier n'est écrite à la main. */
function compte(sql: string): number {
  const ligne = db.prepare(sql).get() as Record<string, unknown> | undefined
  const valeur = ligne === undefined ? undefined : Object.values(ligne)[0]
  expect(typeof valeur, `la mesure « ${sql} » n'a rien rendu`).toBe('number')
  return valeur as number
}

const MESURE = {
  /** 1, 6, 9, 11 — le total des recettes. */
  recettes: compte('SELECT COUNT(*) AS n FROM recipe'),
  /** 2, 4 — recettes portant au moins un ustensile `requis` : écartées, filtre allumé à vide. */
  ecarteesSansRien: compte(
    "SELECT COUNT(DISTINCT recipe_id) AS n FROM recipe_equipment WHERE niveau = 'requis'",
  ),
  /** 3 — recettes portant un `requis` AUTRE que le four : écartées, filtre allumé, four coché. */
  ecarteesAvecLeFour: compte(
    "SELECT COUNT(DISTINCT recipe_id) AS n FROM recipe_equipment" +
      " WHERE niveau = 'requis' AND equipment_id <> 'four'",
  ),
  /** 5 — recettes portant au moins une occupation de plaque. */
  avecPlaque: compte(
    'SELECT COUNT(DISTINCT rse.recipe_id) AS n FROM recipe_step_equipment rse' +
      " JOIN equipment e ON e.id = rse.equipment_id WHERE e.code = 'plaque_cuisson'",
  ),
  /** 7 — le total des étapes de recette. */
  etapes: compte('SELECT COUNT(*) AS n FROM recipe_step'),
  /** 8 — recettes sans photo. */
  sansPhoto: compte('SELECT COUNT(*) AS n FROM recipe WHERE image_path IS NULL'),
  /** 10 — recettes strictement chaudes. */
  chaudes: compte('SELECT COUNT(*) AS n FROM recipe WHERE axe_chaud_froid > 0'),
} as const

// ═══════════════════════════ LES ONZE ANCRES : OÙ VIT CHAQUE VALEUR ═══════════════════════════
//
// ⚠️ CHAQUE MOTIF CAPTURE L'EXPRESSION ENTIÈRE, PAS SEULEMENT DES CHIFFRES — et c'est délibéré.
// Un motif en `(\d+)` ne matcherait tout simplement PAS une valeur dérivée : l'ancre serait
// déclarée introuvable, et le message d'échec parlerait d'un fichier restructuré au lieu de
// dénoncer la tautologie. En capturant `([^\n]+?)`, la clause 3 peut dire ce qu'elle a trouvé.

interface Ancre {
  /** Numéro dans le tableau du brief — pour que l'échec se lise à côté du document. */
  readonly n: number
  readonly fichier: string
  readonly quoi: string
  readonly motif: RegExp
  readonly attendu: number
  /** `true` quand l'assertion est MASQUÉE aujourd'hui par celle qui la précède (clause 5). */
  readonly masquee?: true
}

const ANCRES: readonly Ancre[] = [
  {
    n: 1,
    fichier: '65b.test.ts',
    quoi: 'RECETTES_TOTAL',
    motif: /const RECETTES_TOTAL\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.recettes,
  },
  {
    n: 2,
    fichier: '65b.test.ts',
    quoi: 'ECARTEES_SANS_RIEN',
    motif: /const ECARTEES_SANS_RIEN\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.ecarteesSansRien,
  },
  {
    n: 3,
    fichier: '65b.test.ts',
    quoi: 'ECARTEES_AVEC_LE_FOUR',
    motif: /const ECARTEES_AVEC_LE_FOUR\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.ecarteesAvecLeFour,
  },
  {
    n: 4,
    fichier: '65b-ecran.test.tsx',
    quoi: 'ECARTEES_SANS_RIEN',
    motif: /const ECARTEES_SANS_RIEN\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.ecarteesSansRien,
  },
  {
    n: 5,
    fichier: '65c.test.ts',
    quoi: 'RECETTES_AVEC_PLAQUE',
    motif: /const RECETTES_AVEC_PLAQUE\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.avecPlaque,
  },
  {
    n: 6,
    fichier: 'gestes-champ-media.test.ts',
    quoi: 'catalogue.recipes.size',
    motif: /catalogue\.recipes\.size\s*,[^\n]*?\)\s*\.toBe\(([^)\n]+?)\)/,
    attendu: MESURE.recettes,
  },
  {
    n: 7,
    fichier: 'gestes-champ-media.test.ts',
    quoi: 'total des étapes',
    motif: /expect\(\s*etapes\s*,[^\n]*?\)\s*\.toBe\(([^)\n]+?)\)/,
    attendu: MESURE.etapes,
    masquee: true,
  },
  {
    n: 8,
    fichier: 'photo-fiche-detail.test.tsx',
    quoi: 'SANS_PHOTO',
    motif: /const SANS_PHOTO\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.sansPhoto,
    masquee: true,
  },
  {
    n: 9,
    fichier: 'photo-fiche-detail.test.tsx',
    quoi: 'TOTAL',
    motif: /const TOTAL\s*=\s*([^\n]+?)\s*$/m,
    attendu: MESURE.recettes,
  },
  {
    n: 10,
    fichier: 'retour-1.test.tsx',
    quoi: 'CONVENTION_DU_CATALOGUE.chaudes',
    motif: /CONVENTION_DU_CATALOGUE\s*=\s*\{[^}]*?\bchaudes\s*:\s*([^,}\n]+?)\s*[,}]/,
    attendu: MESURE.chaudes,
  },
  {
    n: 11,
    fichier: 'retour-1.test.tsx',
    quoi: 'CONVENTION_DU_CATALOGUE.total',
    motif: /CONVENTION_DU_CATALOGUE\s*=\s*\{[^}]*?\btotal\s*:\s*([^,}\n]+?)\s*[,}]/,
    attendu: MESURE.recettes,
  },
]

const FICHIERS = [...new Set(ANCRES.map((a) => a.fichier))]

/** L'expression écrite dans le source, à l'ancre. Échoue si l'ancre a disparu. */
function expression(a: Ancre): string {
  const ecrit = a.motif.exec(source(a.fichier))?.[1]
  // ⚠️ `expect.fail` et non `expect(…).not.toBeNull()` : le second n'apprend rien au type, et
  // il faudrait le forcer par un `as` — un cast qui mentirait le jour où l'ancre disparaît.
  if (ecrit === undefined) {
    expect.fail(
      `ancre ${a.n} introuvable : « ${a.quoi} » dans ${a.fichier}. Le fichier a été restructuré,` +
        ` ou la valeur ne s'écrit plus sous la forme que le brief a relevée.`,
    )
  }
  return ecrit.trim()
}

// ══════════════════════════════════ CLAUSE 1 — LES ONZE VALEURS ══════════════════════════════════

describe('retour-5c — clause 1 : les onze valeurs valent ce que le catalogue compte', () => {
  it.each(ANCRES)(
    'valeur $n — $quoi ($fichier)',
    (a) => {
      expect(
        Number(expression(a)),
        `${a.fichier} › ${a.quoi} : le source dit « ${expression(a)} », le catalogue compte` +
          ` ${a.attendu}.`,
      ).toBe(a.attendu)
    },
  )
})

// Un bloc de commentaire, sur une ou plusieurs lignes. Les sauts de ligne y survivent.
const BLOCS_DE_COMMENTAIRE = /\/\*[\s\S]*?\*\//g
/** Le commentaire de fin de ligne. */
const FIN_DE_LIGNE = /\/\/.*$/

// Les lignes de CODE, et rien d'autre : blocs de commentaire et fins de ligne retirés, numéros de
// ligne préservés pour que le message d'échec reste cliquable.
//
// ⚠️ UN JSDOC N'EST PAS DU CODE, et c'est une correction payée à l'écriture de ce fichier :
// `65c.test.ts:77` documente sa constante par « le compte mesuré le 2026-08-19 sur les 330
// recettes réelles ». C'est de la prose datée : elle relève de la moitié MANUELLE de la clause 4.
// La compter ici aurait fait passer ce fichier pour plus rigoureux qu'il n'est.
//
// ⚠️ VÉRIFIÉ AVANT D'ÉCRIRE CECI : aucun des six fichiers ne contient la séquence deux-points
// double-oblique. Retirer les fins de ligne sans analyser les chaînes ne tronque donc rien. Si
// l'un d'eux gagne une URL un jour, ce découpage devient faux — en silence, vers le FAUX NÉGATIF.
const lignesDeCode = (texte: string): readonly { readonly no: number; readonly t: string }[] =>
  texte
    .replace(BLOCS_DE_COMMENTAIRE, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((t, i) => ({ no: i + 1, t: t.replace(FIN_DE_LIGNE, '') }))
    .filter((l) => l.t.trim() !== '')

// ═════════════════════ CLAUSE 2 — AUCUN CAPTEUR N'A DISPARU EN CHEMIN ═════════════════════
//
// ⛔ LES COMPTES CI-DESSOUS SONT RELEVÉS LE 2026-09-09, AVANT LE LOT, ET C'EST TOUT LEUR INTÉRÊT.
// Ils ne décrivent pas un idéal : ils photographient l'existant pour que le lot ne puisse pas le
// réduire. Un `it` supprimé, un `expect` commenté, et ce fichier le dit.
// ⚠️ Un lot ULTÉRIEUR qui ajoute légitimement un capteur à l'un de ces six fichiers rendra ce test
// rouge. C'est voulu : ce sont des fichiers SCELLÉS, on n'y ajoute rien sans rouvrir un brief.

const CAPTEURS_AVANT: Readonly<Record<string, { readonly it: number; readonly expect: number }>> = {
  '65b.test.ts': { it: 13, expect: 34 },
  '65b-ecran.test.tsx': { it: 7, expect: 14 },
  '65c.test.ts': { it: 16, expect: 39 },
  'gestes-champ-media.test.ts': { it: 7, expect: 28 },
  'photo-fiche-detail.test.tsx': { it: 8, expect: 16 },
  'retour-1.test.tsx': { it: 9, expect: 23 },
}

/** `it(` et `expect(` en position d'appel — jamais `.it(`, jamais `unIt(`. */
const compter = (texte: string, mot: string): number =>
  (texte.match(new RegExp(`(?<![A-Za-z0-9_.$])${mot}\\s*\\(`, 'g')) ?? []).length


// ⛔ L'EMPREINTE : LE SQUELETTE DU FICHIER, CHIFFRES EFFACÉS.
// Commentaires retirés, indentation normalisée, toute suite de chiffres remplacée par « # ».
// Ce que ça dit : le lot a le droit de changer des NOMBRES et de la PROSE, rien d'autre. Une
// assertion réécrite, un `it` déplacé, une ligne ajoutée changent le squelette et rougissent.
// ⚠️ AUCUNE DES SEPT VALEURS NE CHANGE DE LARGEUR (330→339, 1548→1575, 271→280…) : le rebasage
// ne peut donc pas provoquer de repli de ligne, et l'empreinte reste tenable.
const squelette = (texte: string): readonly string[] =>
  lignesDeCode(texte).map((l) => l.t.trim().replace(/\s+/g, ' ').replace(/\d+/g, '#'))

const empreinte = (texte: string): string =>
  createHash('sha256').update(squelette(texte).join('\n')).digest('hex').slice(0, 16)

/** Relevées le 2026-09-09, avant le lot. `lignes` double l'empreinte : elle, au moins, se lit. */
const EMPREINTES: Readonly<Record<string, { readonly sha: string; readonly lignes: number }>> = {
  '65b.test.ts': { sha: '2b2b1aa2b4af9e73', lignes: 205 },
  '65b-ecran.test.tsx': { sha: '20f6ca9626e29b2a', lignes: 133 },
  '65c.test.ts': { sha: 'a042d94e87d4243c', lignes: 403 },
  'gestes-champ-media.test.ts': { sha: '510462e15469e98d', lignes: 216 },
  'photo-fiche-detail.test.tsx': { sha: '8df69f711b1f66fe', lignes: 144 },
  'retour-1.test.tsx': { sha: '90ed6b6054243dd8', lignes: 270 },
}

describe('retour-5c — clause 2 : aucun capteur n’a disparu', () => {
  it.each(FICHIERS)('%s porte toujours autant de `it(` et d’`expect(`', (fichier) => {
    const texte = source(fichier)
    const avant = CAPTEURS_AVANT[fichier]
    if (avant === undefined) expect.fail(`aucun relevé d'avant pour ${fichier}`)
    expect(compter(texte, 'it'), `${fichier} : des \`it(\` ont disparu ou sont apparus`).toBe(
      avant.it,
    )
    expect(
      compter(texte, 'expect'),
      `${fichier} : des \`expect(\` ont disparu ou sont apparus`,
    ).toBe(avant.expect)
  })

  it.each(FICHIERS)('%s ne neutralise aucun test (.skip / .only / .todo)', (fichier) => {
    const neutralises = source(fichier).match(/\b(it|describe|test)\.(skip|only|todo)\b/g) ?? []
    expect(neutralises, `${fichier} : un test a été neutralisé au lieu d’être rebasé`).toEqual([])
  })

  // ⛔ LA CLAUSE 2 SANS CECI COMPTE LES CAPTEURS SANS LES LIRE — trou trouvé par `/attaquer` le
  // 2026-09-09, et c'est le seul qui rouvrait le brief. Les six fichiers portent 154 `expect(`,
  // dont ONZE seulement sont tenus par une ancre. Remplacer `expect(ecartees).toEqual([])` par
  // `expect(ecartees).toBeDefined()` laisse le compte intact, laisse l'arbre entier VERT, et tue
  // le capteur en silence. Un compte n'est pas une couverture.
  it.each(FICHIERS)('%s : rien n’a bougé hors des chiffres', (fichier) => {
    const attendue = EMPREINTES[fichier]
    if (attendue === undefined) expect.fail(`aucune empreinte d'avant pour ${fichier}`)
    const vu = squelette(source(fichier))
    const dommage =
      `${fichier} : une ligne de code a changé AUTREMENT QUE PAR SES CHIFFRES. Ce lot ne rebase` +
      ` que des nombres — toute autre édition (assertion affaiblie, constante déplacée, titre` +
      ` reformulé, ligne ajoutée ou retirée) est hors périmètre et doit être défaite.`
    expect(vu.length, `${dommage} Lignes de code : ${vu.length} contre ${attendue.lignes}.`).toBe(
      attendue.lignes,
    )
    expect(empreinte(source(fichier)), dommage).toBe(attendue.sha)
  })
})

// ═══════════════ CLAUSE 3 — LES COMPTEURS RESTENT ABSOLUS, JAMAIS DÉRIVÉS ═══════════════

describe('retour-5c — clause 3 : les onze valeurs restent des littéraux', () => {
  it.each(ANCRES)('valeur $n — $quoi est un nombre écrit, pas une lecture du catalogue', (a) => {
    const ecrit = expression(a)
    expect(
      /^\d+$/.test(ecrit),
      `${a.fichier} › ${a.quoi} vaut « ${ecrit} ». ⛔ Un compteur dérivé du catalogue est une` +
        ` tautologie : il passerait même sur un catalogue cassé. Écrire le nombre.`,
    ).toBe(true)
  })
})

// ═══════════ CLAUSE 4 (moitié automatisable) — LES ANCIENNES VALEURS NE SURVIVENT PAS ═══════════
//
// ⚠️ PORTÉE VOLONTAIREMENT LIMITÉE AU CODE ET AUX TITRES. Une ligne de commentaire peut citer 330
// comme un fait daté (« mesuré le 2026-08-18 »), et c'est légitime. Une ligne de CODE ou un titre
// de `it` qui porte 330, non : là, le nombre affirme le catalogue d'aujourd'hui.

const ANCIENNES = [330, 271, 264, 166, 1548, 201, 245] as const

describe('retour-5c — clause 4 : les anciennes valeurs ne survivent nulle part comme valeur du jour', () => {
  it.each(FICHIERS)('%s : aucune ancienne valeur dans une ligne de code', (fichier) => {
    const coupables = lignesDeCode(source(fichier))
      .filter((l) => ANCIENNES.some((n) => new RegExp(`(?<![\\w.,])${n}(?![\\w.,])`).test(l.t)))
      .map((l) => `${fichier}:${l.no} → ${l.t.trim()}`)
    expect(coupables, 'ancienne valeur du catalogue laissée dans du code').toEqual([])
  })

  it.each(FICHIERS)('%s : aucune ancienne valeur dans un titre de `it` ou de `describe`', (fichier) => {
    const titres = source(fichier).match(/(?<![A-Za-z0-9_.$])(?:it|describe)\s*\(\s*(['"`])(?:\\.|(?!\1).)*\1/gs) ?? []
    const coupables = titres.filter((t) =>
      ANCIENNES.some((n) => new RegExp(`(?<![\\w.,])${n}(?![\\w.,])`).test(t)),
    )
    expect(coupables, 'ancienne valeur du catalogue laissée dans un titre de test').toEqual([])
  })
})

// ═══════════════════ CLAUSE 5 — LES DEUX ASSERTIONS MASQUÉES SONT ATTEINTES ═══════════════════
//
// Une assertion n'est atteinte que si TOUT ce qui la précède dans le même `it` est vrai. Ici, les
// deux masqueuses sont les ancres 6 et 9 — les vérifier justes, c'est prouver que 7 et 8 sont
// exécutées. Le faire par la sortie de vitest serait impossible : un test vert et un test jamais
// atteint se ressemblent trait pour trait.

describe('retour-5c — clause 5 : les deux assertions masquées s’exécutent', () => {
  it('l’assertion sur les étapes (ancre 7) n’est plus masquée par le total des recettes', () => {
    const masqueuse = ANCRES.find((a) => a.n === 6) as Ancre
    const masquee = ANCRES.find((a) => a.n === 7) as Ancre
    expect(Number(expression(masqueuse)), 'la masqueuse est fausse : l’ancre 7 reste morte').toBe(
      masqueuse.attendu,
    )
    expect(Number(expression(masquee))).toBe(masquee.attendu)
  })

  it('l’assertion sur les recettes sans photo (ancre 8) n’est plus masquée par le total', () => {
    const masqueuse = ANCRES.find((a) => a.n === 9) as Ancre
    const masquee = ANCRES.find((a) => a.n === 8) as Ancre
    expect(Number(expression(masqueuse)), 'la masqueuse est fausse : l’ancre 8 reste morte').toBe(
      masqueuse.attendu,
    )
    expect(Number(expression(masquee))).toBe(masquee.attendu)
  })
})

// ═════════ CLAUSE 7 (moitié automatisable) — RIEN DU CATALOGUE N'A DÉBORDÉ ═════════
//
// Les dix témoins du brief : ce qui ne bouge PAS quand seules neuf bases nues entrent. Les deux
// derniers sont les restes de la tenaille du 65b — 59 survivantes à vide, 66 avec le seul four —
// identiques à ceux de 330 recettes parce que les neuf tombent entières du même côté. Un lot qui
// ferait bouger l'un de ces dix nombres aurait débordé, et ce fichier le dit avant le `/fin`.

describe('retour-5c — clause 7 : les dix témoins du catalogue n’ont pas bougé', () => {
  it('451 aliments, 62 gestes, 73 tips, 8 fiches, 30 équipements, 129 recettes pourvues', () => {
    expect(compte('SELECT COUNT(*) AS n FROM food')).toBe(451)
    expect(compte('SELECT COUNT(*) AS n FROM lexicon_entry')).toBe(62)
    expect(compte('SELECT COUNT(*) AS n FROM tip')).toBe(73)
    expect(compte('SELECT COUNT(*) AS n FROM evidence_sheet')).toBe(8)
    expect(compte('SELECT COUNT(*) AS n FROM equipment')).toBe(30)
    expect(compte('SELECT COUNT(*) AS n FROM recipe WHERE image_path IS NOT NULL')).toBe(129)
  })

  it('84 recettes strictement froides, 1 neutre — les neuf bases sont toutes chaudes', () => {
    expect(compte('SELECT COUNT(*) AS n FROM recipe WHERE axe_chaud_froid < 0')).toBe(84)
    expect(compte('SELECT COUNT(*) AS n FROM recipe WHERE axe_chaud_froid = 0')).toBe(1)
  })

  it('59 survivantes à vide et 66 avec le seul four — les deux restes de la tenaille du 65b', () => {
    expect(MESURE.recettes - MESURE.ecarteesSansRien).toBe(59)
    expect(MESURE.recettes - MESURE.ecarteesAvecLeFour).toBe(66)
  })
})
