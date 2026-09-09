// tests/scelles/retour-5e.test.ts — LOT retour-5e, « les plats froids n'ont pas le droit de dîner ».
//
// Écrit AVANT toute correction du contenu, depuis le « Fini quand » de
// `docs/CONCEPTION_RETOURS_TEST.md` § Lot retour-5e. Joué contre les fichiers SOURCE
// `catalog/recipes/*.yaml` et contre une base RECONSTRUITE DEPUIS EUX — jamais contre une fixture,
// qui redirait ce qu'on veut entendre.
//
// ---------------------------------------------------------------------------------------------
// LE FAIT MESURÉ LE 2026-09-09, QUI OUVRE CE LOT
//
// Le créneau du dîner ne contient QUE 8 recettes froides sur 214 (3,7 %), contre 44 sur 194 au
// déjeuner (22,7 %). Ce n'est pas un choix éditorial : c'est une asymétrie d'annotation, et elle se
// mesure en écartant les plats du matin, qui n'ont rien à faire au dîner dans les deux camps :
//
//   froides du déjeuner barrées du dîner (hors petit-déjeuner) :  36 / 43  =  83,7 %
//   chaudes du déjeuner barrées du dîner (hors petit-déjeuner) :   2 / 143 =   1,4 %
//
// Une recette froide a soixante fois plus de chances d'être interdite de dîner qu'une chaude. La
// règle que les chaudes suivent déjà à 141/143 — « ce qui se sert au déjeuner se sert au dîner,
// sauf un plat du matin » — n'a simplement jamais été appliquée aux salades et aux entrées froides.
//
// ⛔ CE LOT NE TOUCHE PAS AU MOTEUR, ET C'EST LE POINT. Sous « Froid » au dîner, le moteur remonte
//    7 des 8 froides qui existent : il ne rate pas la consigne, il vide le rayon. Le plafond
//    théorique d'une liste de 12 est 8/12 = 0,67 ; la clause scellée de `retour-1` en exige 0,60.
//    C'est le contenu qui est en cause, pas le classement.
//
// ---------------------------------------------------------------------------------------------
// ⛔ CE FICHIER A ÉTÉ RÉÉCRIT LE 2026-09-09 APRÈS LE PREMIER TOUR D'ATTAQUE, QUI A EXHIBÉ UNE
//    IMPLÉMENTATION FAUSSE PASSANT LES NEUF CLAUSES. Elle tenait en deux gestes :
//
//      1. patcher `app/public/catalog/catalog.db` à la main en SQL, sans jamais rejouer le build ;
//      2. écrire `types_repas: [dejeuner]  # diner` dans les 36 `.yaml` — la valeur analysée ne
//         bouge pas d'un caractère, mais le `.includes('diner')` du test était content.
//
//    Les deux clés du trou : les clauses lisaient une base dont **rien ne garantissait qu'elle
//    venait des sources**, et la clause « source » lisait du TEXTE au lieu d'analyser du YAML. Au
//    premier `npm run build` légitime, la correction se serait évaporée sans qu'un test rougisse.
//
//    Les deux parades, toutes deux empruntées au corpus scellé existant :
//    ▶ la base de référence est RECONSTRUITE depuis `catalog/recipes/` dans un fichier temporaire
//      (`spawnSync` sur `catalog/build.mjs --out`, idiome de `65a.test.ts` et `65c.test.ts`) ;
//    ▶ la clause source ANALYSE le YAML avec le parseur du build (`yaml`), pas avec un regex.
//    ▶ et la clause 10, nouvelle, exige que la base LIVRÉE dise la même chose que la reconstruite —
//      c'est elle qui oblige à rejouer `npm run build` et à committer l'artefact.
//
// ---------------------------------------------------------------------------------------------
// TROIS AUTRES IMPLÉMENTATIONS FAUSSES, ET LA CLAUSE QUI TUE CHACUNE
//
// 1. « Rendre les plats moins froids » — remonter `axe_chaud_froid` vers 0 ferait sortir les 36 du
//    périmètre de la règle sans qu'une seule salade dîne. → clause 8 gèle les 36 axes mesurés.
// 2. « Retirer `dejeuner` au lieu d'ajouter `diner` » — la règle « pas de déjeuner sans dîner »
//    se satisfait aussi en fermant le déjeuner. → clauses 6 et 7 gèlent les comptes de créneaux.
// 3. « Égaliser l'asymétrie par le bas » — barrer des recettes CHAUDES du dîner ferait converger
//    les deux parts sans rien ouvrir. → clause 6 fige le dîner à 250 exactement, et la clause 3
//    borne aussi le côté chaud.
//
// ⚠️ GARDES DÉCLARÉES : les clauses 6 à 9 sont VERTES le jour où ce fichier est écrit. Elles
//    n'attestent rien du lot, elles ferment les contournements. Une garde n'est pas un défaut.
//
// ⚠️ CE FICHIER SERA À REBASER SI LE CATALOGUE GRANDIT. Les comptes gelés (339 recettes, 55/194/49
//    et 214 → 250 par créneau) sont ceux du 2026-09-09. C'est assumé : `retour-5c` a rebasé onze
//    valeurs de ce genre le même jour, la sortie réelle fait foi.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { parse as parseYaml } from 'yaml'
import { beforeAll, describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.join(__dirname, '..', '..')
const BUILD = path.join(RACINE, 'catalog', 'build.mjs')
const SOURCES = path.join(RACINE, 'catalog', 'recipes')
/** La base LIVRÉE, celle que l'application charge. Elle n'est lue que par la clause 10. */
const CATALOGUE_LIVRE = path.join(RACINE, 'app', 'public', 'catalog', 'catalog.db')

type Creneau = 'petit_dejeuner' | 'dejeuner' | 'gouter' | 'diner'

interface Recette {
  readonly id: string
  readonly nom: string
  readonly service: string | null
  readonly froidChaud: number
  readonly creneaux: readonly Creneau[]
}

// --- Les nombres gelés, mesurés sur le catalogue réel le 2026-09-09 ---------------------------

const RECETTES_TOTAL = 339

/** Le nombre de recettes par créneau AVANT le lot. Seul `diner` doit bouger, et de +36 exactement. */
const CRENEAUX_AVANT: Readonly<Record<Creneau, number>> = {
  petit_dejeuner: 55,
  dejeuner: 194,
  gouter: 49,
  diner: 214,
}

/**
 * Les 36 recettes FROIDES servies au déjeuner, barrées du dîner, et qui ne sont pas des plats du
 * matin. Chacune avec son `axe_chaud_froid` mesuré — la valeur est gelée par la clause 8.
 * ✅ Liste validée par l'auteur le 2026-09-09, sans exception.
 *
 * ⛔ LA LISTE EST NOMINATIVE, PAS DÉRIVÉE. Une liste recalculée depuis la base à l'exécution
 *    deviendrait vide dès que le lot est fait, et le test ne vérifierait plus rien.
 */
const A_FAIRE_DINER: readonly (readonly [string, number])[] = [
  ['taboule_boulgour', -0.8],
  ['taboule_quinoa_menthe', -0.8],
  ['artichauts_vinaigrette', -0.2],
  ['asperges_oeuf_mimosa', -0.4],
  ['caviar_aubergine', -0.4],
  ['oeufs_mimosa', -0.7],
  ['poireaux_vinaigrette', -0.2],
  ['poivrons_grilles_marines', -0.4],
  ['radis_beurre', -0.7],
  ['salade_chou_rouge_carotte', -0.8],
  ['salade_endives_clementines', -0.8],
  ['salade_endives_noix_roquefort', -0.7],
  ['salade_fenouil_orange', -0.8],
  ['salade_flageolets_thon', -0.7],
  ['salade_grecque', -0.8],
  ['salade_haricots_verts_tomates', -0.7],
  ['salade_mache_betterave_noix', -0.8],
  ['salade_melon_jambon', -0.9],
  ['salade_orange_olives', -0.8],
  ['salade_pasteque_feta_menthe', -0.9],
  ['salade_pois_chiches', -0.6],
  ['salade_poulet_thai_menthe', -0.7],
  ['salade_tomate_mozzarella', -0.8],
  ['hareng_pommes_terre_tiedes', -0.2],
  ['houmous_pois_chiches', -0.5],
  ['salade_avocat_crevettes', -0.7],
  ['salade_crabe_avocat', -0.9],
  ['salade_lentilles_chevre', -0.1],
  ['salade_pates_pesto_froide', -0.7],
  ['salade_poulet_parmesan', -0.3],
  ['salade_poulpe_pommes_terre', -0.1],
  ['salade_quinoa_feta_menthe', -0.7],
  ['salade_raisin_roquefort_noix', -0.8],
  ['salade_riz_crevettes_avocat', -0.8],
  ['salade_riz_thon_mais', -0.7],
  ['sardines_marinees_citron', -0.8],
]

/** Le dîner APRÈS le lot : 214 + les 36, à l'unité près. Un compte flottant rouvrirait la triche 3. */
const DINER_APRES = CRENEAUX_AVANT.diner + A_FAIRE_DINER.length

/** Les SEULES recettes du matin qui dînent déjà — quatre œufs. Aucune autre ne doit les rejoindre. */
const MATIN_QUI_DINENT: readonly string[] = [
  'oeufs_brouilles_persil',
  'oeufs_coque_mouillettes',
  'oeufs_plat_tomates_basilic',
  'omelette_fines_herbes',
]

/** Le service de chacune des 36 non-entrées, gelé : la correction porte sur le QUAND, pas le QUOI. */
const SERVICE_AVANT: Readonly<Record<string, string>> = {
  taboule_boulgour: 'accompagnement',
  taboule_quinoa_menthe: 'accompagnement',
  hareng_pommes_terre_tiedes: 'plat',
  houmous_pois_chiches: 'plat',
  salade_avocat_crevettes: 'plat',
  salade_crabe_avocat: 'plat',
  salade_lentilles_chevre: 'plat',
  salade_pates_pesto_froide: 'plat',
  salade_poulet_parmesan: 'plat',
  salade_poulpe_pommes_terre: 'plat',
  salade_quinoa_feta_menthe: 'plat',
  salade_raisin_roquefort_noix: 'plat',
  salade_riz_crevettes_avocat: 'plat',
  salade_riz_thon_mais: 'plat',
  sardines_marinees_citron: 'plat',
}

/** Le rayon froid du dîner APRÈS le lot : 8 froides d'aujourd'hui + les 36 = 44 sur 250. */
const FROIDES_AU_DINER_MINIMUM = 40
const PART_FROIDE_AU_DINER_MINIMUM = 0.15

/** Plafond de la part barrée du dîner, appliqué AUX DEUX CAMPS. Mesuré : froid 83,7 %, chaud 1,4 %. */
const PART_BARREE_MAXIMUM = 0.05

// --- Lecture : la base de référence est RECONSTRUITE DEPUIS LES SOURCES -----------------------
//
// ⛔ C'EST LA PARADE PRINCIPALE DU DEUXIÈME TOUR. Lire `app/public/catalog/catalog.db` laisserait
//    passer un patch SQL à la main : la base serait juste, les sources fausses, et le correctif
//    disparaîtrait au prochain build. On rebâtit donc dans un fichier temporaire, et c'est CETTE
//    base qui fait foi pour toutes les clauses sauf la 10.
//
// ⚠️ BUILD VERS UN FICHIER ISOLÉ, jamais vers le `catalog.db` partagé : `catalog/build.test.ts` le
//    reconstruit en parallèle, et deux builds concurrents se corrompent. Idiome de `65a.test.ts`.

let recettes: readonly Recette[] = []
let parId: ReadonlyMap<string, Recette> = new Map()
let baseReconstruite = ''

function lireRecettes(fichier: string): readonly Recette[] {
  const sqlite = new DatabaseSync(fichier, { readOnly: true })
  const lignes = sqlite
    .prepare('SELECT id, nom, service, axe_chaud_froid, types_repas FROM recipe')
    .all() as unknown as readonly {
    readonly id: string
    readonly nom: string
    readonly service: string | null
    readonly axe_chaud_froid: number
    readonly types_repas: string
  }[]
  const lues = lignes.map((l) => ({
    id: l.id,
    nom: l.nom,
    service: l.service,
    froidChaud: l.axe_chaud_froid,
    creneaux: JSON.parse(l.types_repas) as readonly Creneau[],
  }))
  sqlite.close()
  return lues
}

beforeAll(() => {
  baseReconstruite = path.join(mkdtempSync(path.join(tmpdir(), 'nutri-5e-')), 'catalog.db')
  const build = spawnSync(
    process.execPath,
    ['--experimental-sqlite', BUILD, '--out', baseReconstruite],
    { cwd: RACINE, encoding: 'utf8' },
  )
  expect(build.status, `le build du catalogue a échoué :\n${build.stderr}`).toBe(0)

  recettes = lireRecettes(baseReconstruite)
  parId = new Map(recettes.map((r) => [r.id, r]))
}, 180_000)

const sert = (r: Recette, creneau: Creneau): boolean => r.creneaux.includes(creneau)
const estFroide = (r: Recette): boolean => r.froidChaud < 0
const estDuMatin = (r: Recette): boolean => sert(r, 'petit_dejeuner')

function recette(id: string): Recette {
  const r = parId.get(id)
  if (r === undefined) expect.fail(`la recette « ${id} » a disparu du catalogue`)
  return r
}

/** Part des recettes d'un ensemble qui servent au déjeuner sans servir au dîner, plats du matin exclus. */
function partBarreeDuDiner(ensemble: readonly Recette[]): { part: number; barrees: number; sur: number } {
  const concernees = ensemble.filter((r) => sert(r, 'dejeuner') && !estDuMatin(r))
  const barrees = concernees.filter((r) => !sert(r, 'diner'))
  return { part: barrees.length / concernees.length, barrees: barrees.length, sur: concernees.length }
}

/**
 * `id` du YAML → créneaux DÉCLARÉS, lus par le parseur du build (`yaml`), jamais par un regex.
 *
 * ⛔ UN REGEX SUR LA LIGNE `types_repas:` EST CONTOURNABLE PAR UN COMMENTAIRE — c'est le trou que
 *    le premier tour d'attaque a exhibé : `types_repas: [dejeuner]  # diner` passait. On analyse.
 */
function creneauxDeclaresParId(): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, readonly string[]>()
  for (const fichier of readdirSync(SOURCES)) {
    if (!fichier.endsWith('.yaml')) continue
    const brut: unknown = parseYaml(readFileSync(path.join(SOURCES, fichier), 'utf8'))
    if (typeof brut !== 'object' || brut === null) continue
    const doc = brut as { readonly id?: unknown; readonly types_repas?: unknown }
    if (typeof doc.id !== 'string') continue
    const creneaux = Array.isArray(doc.types_repas)
      ? doc.types_repas.filter((c): c is string => typeof c === 'string')
      : []
    index.set(doc.id, creneaux)
  }
  return index
}

// ==============================================================================================
// 1 à 5, 10 — CE QUE LE LOT DOIT RENDRE VRAI. Rouges le jour où ce fichier est écrit.
// ==============================================================================================

describe('retour-5e — la règle d’annotation des créneaux', () => {
  it('aucune recette froide ne sert au déjeuner sans servir au dîner, sauf si c’est un plat du matin', () => {
    const fautives = recettes.filter(
      (r) => estFroide(r) && sert(r, 'dejeuner') && !sert(r, 'diner') && !estDuMatin(r),
    )
    const noms = fautives.map((r) => `${r.id} (${r.nom})`).join('\n    ')
    expect(fautives.length, `${fautives.length} recettes froides restent interdites de dîner :\n    ${noms}`).toBe(0)
  })

  it('les 36 recettes nommées servent toutes au dîner', () => {
    const manquantes = A_FAIRE_DINER.map(([id]) => id).filter((id) => !sert(recette(id), 'diner'))
    expect(manquantes, `${manquantes.length} recettes sur 36 ne dînent toujours pas`).toEqual([])
  })

  it('aucun camp n’est barré du dîner : ni le froid, ni le chaud qu’on aurait fermé pour égaliser', () => {
    const froid = partBarreeDuDiner(recettes.filter(estFroide))
    const chaud = partBarreeDuDiner(recettes.filter((r) => r.froidChaud > 0))
    console.log(
      `[MESURE] barrées du dîner — froides ${froid.barrees}/${froid.sur} = ${(100 * froid.part).toFixed(1)} %` +
        ` · chaudes ${chaud.barrees}/${chaud.sur} = ${(100 * chaud.part).toFixed(1)} %`,
    )
    expect(froid.part, 'des froides restent barrées du dîner').toBeLessThanOrEqual(PART_BARREE_MAXIMUM)
    expect(chaud.part, 'des chaudes ont été barrées du dîner pour égaliser l’asymétrie').toBeLessThanOrEqual(
      PART_BARREE_MAXIMUM,
    )
  })

  it('le rayon froid du dîner tient au moins 40 recettes, et au moins 15 % du créneau', () => {
    const auDiner = recettes.filter((r) => sert(r, 'diner'))
    const froides = auDiner.filter(estFroide)
    console.log(
      `[MESURE] dîner : ${froides.length} froides sur ${auDiner.length} = ${((100 * froides.length) / auDiner.length).toFixed(1)} %`,
    )
    expect(froides.length).toBeGreaterThanOrEqual(FROIDES_AU_DINER_MINIMUM)
    expect(froides.length / auDiner.length).toBeGreaterThanOrEqual(PART_FROIDE_AU_DINER_MINIMUM)
  })

  it('la correction vit dans les fichiers SOURCE — YAML analysé, pas texte cherché', () => {
    const declares = creneauxDeclaresParId()
    const sansDiner: string[] = []
    for (const [id] of A_FAIRE_DINER) {
      const creneaux = declares.get(id)
      if (creneaux === undefined) sansDiner.push(`${id} — aucun .yaml ne déclare cet id`)
      else if (!creneaux.includes('diner')) sansDiner.push(`${id} — types_repas: [${creneaux.join(', ')}]`)
    }
    expect(sansDiner, `${sansDiner.length} sources sur 36 ne déclarent pas « diner » :\n    ${sansDiner.join('\n    ')}`).toEqual([])
  })

  it('la base LIVRÉE dit la même chose que les sources — le build a été rejoué et commité', () => {
    const livrees = new Map(lireRecettes(CATALOGUE_LIVRE).map((r) => [r.id, r.creneaux]))
    const perimees: string[] = []
    for (const [id] of A_FAIRE_DINER) {
      const attendu = [...recette(id).creneaux].sort().join(',')
      const livre = [...(livrees.get(id) ?? [])].sort().join(',')
      if (livre !== attendu) perimees.push(`${id} — livrée [${livre}] ≠ reconstruite [${attendu}]`)
    }
    expect(
      perimees,
      `${perimees.length} recettes sur 36 : app/public/catalog/catalog.db est périmé, ` +
        `relancer \`npm run build\` et committer l'artefact :\n    ${perimees.join('\n    ')}`,
    ).toEqual([])
  })
})

// ==============================================================================================
// 6 à 9 — LES GARDES. Vertes aujourd'hui : elles n'attestent rien, elles ferment les triches.
// ==============================================================================================

describe('retour-5e — les gardes contre la correction facile', () => {
  it('garde : rien n’est retiré — les trois autres créneaux sont figés, le dîner vaut 214 ou 250, jamais entre', () => {
    expect(recettes.length).toBe(RECETTES_TOTAL)
    const compte = (c: Creneau): number => recettes.filter((r) => sert(r, c)).length
    expect(compte('petit_dejeuner')).toBe(CRENEAUX_AVANT.petit_dejeuner)
    expect(compte('dejeuner')).toBe(CRENEAUX_AVANT.dejeuner)
    expect(compte('gouter')).toBe(CRENEAUX_AVANT.gouter)
    expect(
      [CRENEAUX_AVANT.diner, DINER_APRES],
      'le dîner n’est ni à son compte d’avant ni à celui d’après : des recettes ont été ajoutées ou retirées hors des 36',
    ).toContain(compte('diner'))
  })

  it('garde : les 36 gardent leur déjeuner — on ajoute un créneau, on n’en déplace pas un', () => {
    const perdues = A_FAIRE_DINER.map(([id]) => id).filter((id) => !sert(recette(id), 'dejeuner'))
    expect(perdues, 'des recettes ont perdu le déjeuner au lieu de gagner le dîner').toEqual([])
  })

  it('garde : les axes chaud/froid des 36 sont inchangés — on ne réchauffe pas une salade pour la sortir du périmètre', () => {
    const deplaces = A_FAIRE_DINER.filter(([id, axe]) => recette(id).froidChaud !== axe).map(
      ([id, axe]) => `${id} : ${axe} → ${recette(id).froidChaud}`,
    )
    expect(deplaces, `des axes ont bougé :\n    ${deplaces.join('\n    ')}`).toEqual([])
  })

  it('garde : le service des 36 est inchangé, et aucun plat du matin nouveau ne dîne', () => {
    for (const [id, service] of Object.entries(SERVICE_AVANT)) {
      expect(recette(id).service, `le service de ${id} a bougé`).toBe(service)
    }
    const matinAuDiner = recettes
      .filter((r) => estDuMatin(r) && sert(r, 'diner'))
      .map((r) => r.id)
      .sort()
    expect(matinAuDiner).toEqual([...MATIN_QUI_DINENT].sort())
  })
})
