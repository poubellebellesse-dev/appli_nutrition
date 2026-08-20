// tests/scelles/65c.test.ts — l'examen du lot 65c : les feux du dessus.
//
// Plan : `docs/CONCEPTION_RESERVATION_MATERIEL.md` § « Lot 65c ».
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Aujourd'hui `recipe_step_equipment` ne porte AUCUNE
// occupation de plaque — le détecteur du build s'appelle `etapeOccupeLeFour` et ne fait que ça —,
// `user_equipment` n'a pas de colonne de quantité, et `capaciteDepuisPartage` rend `null` pour
// `selon_quantite`. Les seize clauses échouent donc toutes les seize.
//
// ---------------------------------------------------------------------------------------------
// ⛔ CE FICHIER A ÉTÉ RÉÉCRIT LE 2026-08-20 APRÈS UNE ATTAQUE QUI L'A TRAVERSÉ. Sa première version
// scellait un total (166 recettes) et cinq points nommés. Un critique a produit en trois lignes une
// implémentation qui posait les occupations AU HASARD sur 161 recettes, sans lire un seul mot de
// texte, et qui passait les dix clauses. Il a produit une seconde triche qui calculait les conflits
// en comptant les recettes DISTINCTES sans jamais regarder QUAND les plats se font — la régression
// même que le 65a a payé 63 % de fausses alertes pour éliminer. Les deux passaient 10/10.
//
// Ce que la réécriture change, et pourquoi :
//
//   • ON NE SCELLE PLUS UN TOTAL, ON SCELLE LA RÈGLE, DANS LES DEUX SENS. Clause 2 : aucune
//     occupation ne se pose sur une étape qui ne porte pas un des seize gestes — un placement au
//     hasard meurt là. Clause 3 : aucune étape à geste sûr, libre du four, ne reste sans occupation
//     — un détecteur qui n'en pose qu'une par recette meurt là. Les 161 recettes anonymes cessent
//     d'être un angle mort sans qu'on ait à les nommer une par une.
//
//   • ON TESTE LE NON-RECOUVREMENT, PAS SEULEMENT LE RECOUVREMENT. Clauses 14 et 15 : deux plats qui
//     tiennent la plaque à des moments DIFFÉRENTS ne se disputent rien, et sur trois plats le
//     conflit ne nomme que les deux qui se chevauchent. Un comptage global rend « conflit » dans les
//     deux cas ; le vrai balayage d'intervalles est le seul à passer.
//
//   • LA QUANTITÉ RELUE VARIE. Le seul nombre jamais écrit était 3 : `() => 3` suffisait. On écrit
//     maintenant 4, puis 1, et sur deux ustensiles distincts.
//
//   • ON EXERCE LE CHEMIN QUI EFFACE. `writeOwnedEquipmentIds` fait `DELETE FROM user_equipment`
//     puis réinsère — l'écran de matériel du 65b l'appelle à chaque cochage. Sans la clause 11, le
//     lot livrait une quantité que le prochain clic sur une case effaçait en silence. C'est le piège
//     `INSERT OR REPLACE` de `CLAUDE.md`, sous un autre nom.
//
// ---------------------------------------------------------------------------------------------
// ⛔ LE COMPTE SCELLÉ EST CELUI DES RECETTES — 166 —, PAS CELUI DES LIGNES, ET C'EST LA LEÇON DU
// 65a, PAYÉE. Les 285 occupations sont mesurées PAR ÉTAPE ; le modèle à portée
// (`ordre_debut`/`ordre_fin`) ne compte plus le même objet dès que deux occupations se rejoignent.
// Sceller 285 serait écrire un chiffre pour avoir l'air précis — c'est ainsi qu'un 83 faux a été
// scellé au 65a. Les clauses 2 et 3 rendent ce total secondaire : elles portent la règle elle-même,
// et elles ne dépendent d'aucun modèle de fusion.
//
// ⛔ `dorer` EST LE PIÈGE, ET LA CLAUSE 4 EST SA SERRURE. 23 de ses 64 étapes sont au four, mais la
// vingt-troisième — `pommes_terre_four_romarin` #5 — ne le dit PAS dans son propre texte : c'est
// l'étape #4 qui enfourne, MESURÉ le 2026-08-19. Une règle qui lit l'étape seule lui pose une
// occupation de plaque. La règle de report, posée par l'auteur le 2026-08-19, est ce qui l'en
// empêche.
//
// ⚠️ MODULES ET COLONNES PAS ENCORE ÉCRITS = IMPORT DYNAMIQUE ET LECTURE SQL DÉFENSIVE. Un `import`
// statique vers un symbole absent casserait `npm run typecheck` pour tout l'arbre.
//
// ⚠️ BUILD VERS UN FICHIER ISOLÉ : `catalog/build.test.ts` reconstruit le `catalog.db` partagé en
// parallèle, et deux builds concurrents se corrompent.
//
// ⚠️ VRAI FICHIER `user.db`, JAMAIS `:memory:`, pour les clauses 9 à 11 — une base en mémoire meurt
// avec sa connexion et ne prouverait rien sur la survie à la fermeture. C'est la leçon du 65b-bis,
// appliquée d'emblée plutôt qu'en dette.

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

const PLAQUE = 'plaque_cuisson'

/** Le compte mesuré le 2026-08-19 sur les 330 recettes réelles. Voir l'en-tête pour le motif. */
const RECETTES_AVEC_PLAQUE = 166

/**
 * Les quinze gestes du lexique qui ne se font QUE sur un feu du dessus. Aucun n'a rendu de faux
 * positif à la mesure du 2026-08-19.
 *
 * ⚠️ `vapeur` N'EN EST PAS. Ses deux étapes décrivent un risque et ne commandent rien — « entassés,
 * ils cuiraient à la vapeur ». C'est le piège de `poireaux_gratines_bechamel`, payé au lot B du 65a.
 */
const GESTES_SURS: readonly string[] = [
  'revenir',
  'suer',
  'saisir',
  'sauter',
  'poeler',
  'mijoter',
  'fremir',
  'reduire',
  'deglacer',
  'mouiller',
  'blanchir',
  'pocher',
  'carameliser',
  'braiser',
  'bain_marie',
]

/** Le seizième, et le seul qui se fasse des deux côtés. 23 de ses 64 étapes sont au four. */
const GESTE_AMBIGU = 'dorer'

const TOUS_LES_GESTES: ReadonlySet<string> = new Set([...GESTES_SURS, GESTE_AMBIGU])
const SURS: ReadonlySet<string> = new Set(GESTES_SURS)

/**
 * Le faux positif que seule la règle de report attrape : rien dans le texte de l'étape 5 ne dit le
 * four, c'est l'étape 4 qui y a mis les pommes de terre.
 */
const DORER_AU_FOUR_PAR_REPORT: readonly [string, number] = ['pommes_terre_four_romarin', 5]

/**
 * Deux des onze `dorer` que RIEN ne tranche — ni leur texte, ni les quatre étapes qui précèdent.
 * ⛔ La règle ne devine pas : elle les laisse dehors. « Griller les tranches de pain complet » est
 * probablement un grille-pain, et personne ne l'a écrit.
 */
const DORER_INDECIS: readonly (readonly [string, number])[] = [
  ['tartine_sardine_citron_echalote', 4],
  ['riz_pilaf_amandes', 1],
]

/** Deux gestes qui ne se font QUE sur le feu — la clause qui vérifie que la règle attrape. */
const PLAQUE_SURE: readonly (readonly [string, number])[] = [
  ['boeuf_bourguignon', 1],
  ['blanquette_veau', 1],
]

interface Etape {
  readonly recipe_id: string
  readonly ordre: number
  readonly lexicon_ids: string | null
}

interface OccupationLue {
  readonly recipe_id: string
  readonly ordre_debut: number
  readonly ordre_fin: number
  readonly code: string
}

let db: DatabaseSync
let dbPath: string
let etapes: readonly Etape[] = []
let occupations: readonly OccupationLue[] = []

beforeAll(() => {
  const dossier = mkdtempSync(path.join(tmpdir(), 'nutri-65c-'))
  dbPath = path.join(dossier, 'catalog.db')
  const build = spawnSync(
    process.execPath,
    ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
  expect(build.status).toBe(0)
  db = new DatabaseSync(dbPath)

  etapes = db
    .prepare(
      `SELECT recipe_id, ordre, lexicon_ids FROM recipe_step
        WHERE nature = 'geste' OR nature IS NULL
        ORDER BY recipe_id, ordre`,
    )
    .all() as unknown as readonly Etape[]

  occupations = db
    .prepare(
      `SELECT rse.recipe_id, rse.ordre_debut, rse.ordre_fin, e.code
         FROM recipe_step_equipment rse
         JOIN equipment e ON e.id = rse.equipment_id`,
    )
    .all() as unknown as readonly OccupationLue[]
})

/** Les gestes du lexique portés par une étape. Une colonne illisible vaut « aucun ». */
function gestesDe(etape: Etape): readonly string[] {
  try {
    const lus: unknown = JSON.parse(etape.lexicon_ids ?? '[]')
    return Array.isArray(lus) ? (lus as readonly string[]) : []
  } catch {
    return []
  }
}

/** Les portées d'un ustensile pour une recette, triées. Vide si la recette n'en porte aucune. */
function porteesDe(recipeId: string, code: string): readonly (readonly [number, number])[] {
  return occupations
    .filter((o) => o.recipe_id === recipeId && o.code === code)
    .map((o) => [o.ordre_debut, o.ordre_fin] as const)
    .sort((a, b) => a[0] - b[0])
}

/** L'étape est-elle COUVERTE par une occupation de cet ustensile ? Portée comprise. */
const couverte = (recipeId: string, ordre: number, code: string): boolean =>
  porteesDe(recipeId, code).some(([debut, fin]) => ordre >= debut && ordre <= fin)

/**
 * ⛔ LA PRÉCONDITION QUI REND LES CLAUSES NÉGATIVES HONNÊTES. Sans elle, « cette étape ne porte
 * aucune occupation de plaque » est vrai aujourd'hui pour la pire des raisons : AUCUNE étape n'en
 * porte. Un test d'acceptation qui passe avant que le code existe ne prouve rien — la règle du
 * dépôt, et elle s'applique aussi aux assertions en négatif.
 */
function laPlaqueExisteAuCatalogue(): void {
  const n = occupations.filter((o) => o.code === PLAQUE).length
  expect(
    n,
    'aucune occupation de plaque au catalogue — la clause suivante ne mesurerait rien',
  ).toBeGreaterThan(0)
}

// ══════════════════════════════════════ MOITIÉ A — LE CATALOGUE ══════════════════════════════════

describe('65c — la plaque de cuisson entre au catalogue', () => {
  it('1. exactement 166 recettes portent une occupation de plaque', () => {
    const recettes = new Set(occupations.filter((o) => o.code === PLAQUE).map((o) => o.recipe_id))
    expect(recettes.size).toBe(RECETTES_AVEC_PLAQUE)
  })

  it('2. ⛔ AUCUNE OCCUPATION INVENTÉE — chacune couvre une étape qui porte un des seize gestes', () => {
    // ⛔ LA CLAUSE QUI TUE LE PLACEMENT AU HASARD. Sans elle, une implémentation qui pose une
    // occupation sur n'importe quelle étape libre de 166 recettes atteint le compte de la clause 1
    // sans avoir lu un seul mot de texte. Ici, il lui faut tomber juste 285 fois de suite.
    laPlaqueExisteAuCatalogue()

    const parRecette = new Map<string, Etape[]>()
    for (const e of etapes) {
      const liste = parRecette.get(e.recipe_id) ?? []
      liste.push(e)
      parRecette.set(e.recipe_id, liste)
    }

    const inventees = occupations
      .filter((o) => o.code === PLAQUE)
      .filter((o) => {
        const dans = (parRecette.get(o.recipe_id) ?? []).filter(
          (e) => e.ordre >= o.ordre_debut && e.ordre <= o.ordre_fin,
        )
        return !dans.some((e) => gestesDe(e).some((g) => TOUS_LES_GESTES.has(g)))
      })
      .map((o) => `${o.recipe_id} #${o.ordre_debut}-${o.ordre_fin}`)

    expect(inventees, 'occupations de plaque posées sur des étapes sans geste de feu').toEqual([])
  })

  it('3. ⛔ AUCUNE OCCUPATION OMISE — toute étape à geste sûr, libre du four, en porte une', () => {
    // ⛔ LA CLAUSE QUI TUE « une occupation par recette ». La clause 1 se satisfait de 166 lignes ;
    // celle-ci en exige une par étape qui la mérite, sans nommer une seule recette. Les 267 étapes à
    // geste sûr y passent toutes.
    laPlaqueExisteAuCatalogue()

    const dejaPrises = new Set<string>()
    for (const o of occupations) {
      if (o.code !== 'four' && o.code !== 'micro_ondes') continue
      for (let i = o.ordre_debut; i <= o.ordre_fin; i += 1) dejaPrises.add(`${o.recipe_id}#${i}`)
    }

    const oubliees = etapes
      .filter((e) => gestesDe(e).some((g) => SURS.has(g)))
      .filter((e) => !dejaPrises.has(`${e.recipe_id}#${e.ordre}`))
      .filter((e) => !couverte(e.recipe_id, e.ordre, PLAQUE))
      .map((e) => `${e.recipe_id} #${e.ordre}`)

    expect(oubliees, 'étapes à geste sûr laissées sans occupation de plaque').toEqual([])
  })

  it('4. ⛔ « dorer » APRÈS un enfournement n’occupe pas la plaque — le report, ou rien', () => {
    laPlaqueExisteAuCatalogue()
    const [recette, ordre] = DORER_AU_FOUR_PAR_REPORT

    // Le contexte, mesuré le 2026-08-19 : l'étape 4 enfourne, l'étape 5 « poursuit jusqu'à ce
    // qu'ils soient dorés ». Le mot « four » n'apparaît pas à l'étape 5.
    expect(couverte(recette, 4, 'four'), 'l’étape 4 enfourne').toBe(true)

    // ⛔ CE QUE LE LOT DOIT EMPÊCHER : que l'étape 5 se retrouve sur la plaque.
    expect(couverte(recette, ordre, PLAQUE)).toBe(false)
  })

  it('5. ⚠️ et le four ne la revendique pas non plus — écart nommé, hors périmètre', () => {
    laPlaqueExisteAuCatalogue()
    const [recette, ordre] = DORER_AU_FOUR_PAR_REPORT
    // La portée de four s'arrête à l'étape 4 : l'étape 5 n'appartient à AUCUN ustensile. C'est
    // exact aujourd'hui, ce lot ne le change pas, et le sceau l'écrit pour que personne ne croie
    // que le report a réparé la portée du four. Étendre les portées est un autre lot.
    expect(couverte(recette, ordre, 'four')).toBe(false)
  })

  it('6. ⛔ les « dorer » qu’aucun indice ne tranche restent dehors', () => {
    laPlaqueExisteAuCatalogue()
    for (const [recette, ordre] of DORER_INDECIS) {
      expect(
        couverte(recette, ordre, PLAQUE),
        `${recette} #${ordre} ne doit porter aucune occupation de plaque`,
      ).toBe(false)
    }
  })

  it('7. les gestes qui ne se font que sur le feu sont bien attrapés', () => {
    for (const [recette, ordre] of PLAQUE_SURE) {
      expect(
        couverte(recette, ordre, PLAQUE),
        `${recette} #${ordre} doit porter une occupation de plaque`,
      ).toBe(true)
    }
  })

  it('8. ⛔ aucune étape n’est à la fois au four et sur la plaque', () => {
    laPlaqueExisteAuCatalogue()
    const collisions = occupations
      .filter((a) => a.code === PLAQUE)
      .filter((a) =>
        occupations.some(
          (b) =>
            b.recipe_id === a.recipe_id &&
            (b.code === 'four' || b.code === 'micro_ondes') &&
            a.ordre_debut <= b.ordre_fin &&
            b.ordre_debut <= a.ordre_fin,
        ),
      )
      .map((a) => `${a.recipe_id} #${a.ordre_debut}-${a.ordre_fin}`)
    expect(collisions).toEqual([])
  })
})

// ══════════════════════════════════════ MOITIÉ B — LE RÉGLAGE ═══════════════════════════════════

describe('65c — la quantité de feux, déclarée puis lue', () => {
  let dossier: string
  let fichier: string

  const ouvrir = async (): Promise<{
    readonly userDb: unknown
    readonly close: () => void
  }> => {
    const store = await import('../../app/src/data/user-store-node.js')
    const ouverte = store.openUserDb(fichier)
    return { userDb: ouverte.db, close: () => ouverte.close() }
  }

  const magasin = async (): Promise<Record<string, unknown>> =>
    (await import('../../app/src/data/user-store.js')) as Record<string, unknown>

  const ecrireQuantite = async (): Promise<(db: unknown, id: string, n: number) => void> => {
    const fn = (await magasin()).writeEquipmentQuantite as
      | ((db: unknown, id: string, n: number) => void)
      | undefined
    expect(fn, 'writeEquipmentQuantite doit exister').toBeTypeOf('function')
    return fn as (db: unknown, id: string, n: number) => void
  }

  const lireQuantite = async (): Promise<(db: unknown, id: string) => number | null> => {
    const fn = (await magasin()).readEquipmentQuantite as
      | ((db: unknown, id: string) => number | null)
      | undefined
    expect(fn, 'readEquipmentQuantite doit exister').toBeTypeOf('function')
    return fn as (db: unknown, id: string) => number | null
  }

  afterEach(() => {
    if (dossier) rmSync(dossier, { recursive: true, force: true })
  })

  const preparer = (): void => {
    dossier = mkdtempSync(path.join(tmpdir(), 'scelle-65c-'))
    fichier = path.join(dossier, 'user.db')
  }

  it('9. ⛔ la quantité déclarée survit à la fermeture de l’application', async () => {
    preparer()
    const ecrire = await ecrireQuantite()
    const lire = await lireQuantite()

    const un = await ouvrir()
    ecrire(un.userDb, PLAQUE, 3)
    un.close()

    // ⛔ NOUVELLE SESSION, MÊME FICHIER. C'est ici qu'un cache en mémoire tomberait.
    const deux = await ouvrir()
    expect(lire(deux.userDb, PLAQUE)).toBe(3)
    deux.close()

    // Et la table le porte vraiment, lue sans passer par le magasin qu'on teste.
    const brut = new DatabaseSync(fichier, { readOnly: true })
    const ligne = brut
      .prepare('SELECT quantite FROM user_equipment WHERE equipment_id = ?')
      .get(PLAQUE) as { readonly quantite: number } | undefined
    brut.close()
    expect(ligne?.quantite).toBe(3)
  })

  it('10. ⛔ la quantité relue est CELLE QU’ON A ÉCRITE, et deux ustensiles ne se marchent pas dessus', async () => {
    // ⛔ LA CLAUSE QUI TUE `readEquipmentQuantite = () => 3`. Tant que 3 était le seul nombre jamais
    // écrit dans toute la suite, une constante passait. On en écrit trois, dont deux sur le même
    // ustensile, et un sur un autre.
    preparer()
    const ecrire = await ecrireQuantite()
    const lire = await lireQuantite()

    const session = await ouvrir()
    ecrire(session.userDb, PLAQUE, 4)
    ecrire(session.userDb, 'four', 2)
    expect(lire(session.userDb, PLAQUE), 'quatre feux déclarés, quatre feux relus').toBe(4)
    expect(lire(session.userDb, 'four'), 'l’autre ustensile porte SA quantité').toBe(2)

    // Réécrire n'empile pas : une déclaration remplace la précédente.
    ecrire(session.userDb, PLAQUE, 1)
    expect(lire(session.userDb, PLAQUE)).toBe(1)
    expect(lire(session.userDb, 'four'), 'et le voisin n’a pas bougé').toBe(2)

    // Un ustensile dont personne n'a rien dit ne rend pas un nombre inventé.
    expect(lire(session.userDb, 'micro_ondes'), 'jamais déclaré ⇒ inconnu, pas 1').toBeNull()
    session.close()
  })

  it('11. ⛔ resauver la liste du matériel N’EFFACE PAS la quantité déjà déclarée', async () => {
    // ⛔ LE TROU QUE L'ATTAQUE DU 2026-08-20 A TROUVÉ, ET LE PLUS DANGEREUX DES CINQ.
    // `writeOwnedEquipmentIds` fait `DELETE FROM user_equipment` puis réinsère sans quantité, et
    // l'écran de matériel du 65b l'appelle À CHAQUE COCHAGE. Sans cette clause, le lot livre une
    // quantité que le prochain clic sur une case efface en silence : aucune erreur, aucun type
    // fâché, aucun test rouge. C'est le piège `INSERT OR REPLACE` de `CLAUDE.md`, sous un autre nom.
    preparer()
    const ecrire = await ecrireQuantite()
    const lire = await lireQuantite()
    const store = await magasin()
    const ecrireListe = store.writeOwnedEquipmentIds as (db: unknown, ids: readonly string[]) => void

    const session = await ouvrir()
    ecrireListe(session.userDb, [PLAQUE, 'four'])
    ecrire(session.userDb, PLAQUE, 4)

    // La personne coche une case de plus. L'écran resauve TOUTE la liste, comme il le fait déjà.
    ecrireListe(session.userDb, [PLAQUE, 'four', 'micro_ondes'])

    expect(lire(session.userDb, PLAQUE), 'les quatre feux déclarés ont disparu au cochage').toBe(4)
    session.close()

    // Et après fermeture, toujours là — la même exigence qu'à la clause 9.
    const deux = await ouvrir()
    expect(lire(deux.userDb, PLAQUE)).toBe(4)
    deux.close()
  })

  it('12. la capacité cesse de se taire quand la quantité est connue', async () => {
    const { capaciteDepuisPartage } = await import('../../app/src/engine/cuisine/reservation.js')
    const capacite = capaciteDepuisPartage as unknown as (
      partageable: string | null,
      quantiteDeclaree?: number | null,
    ) => number | null

    expect(capacite('selon_quantite', 4)).toBe(4)
    // ⛔ CLAUSE 16 EN NÉGATIF, ET C'EST LA PLUS IMPORTANTE DU LOT : sans quantité déclarée, le
    // moteur se TAIT. C'est la propriété que le 65a a payée pour éteindre 63 % de fausses alertes.
    expect(capacite('selon_quantite', null)).toBeNull()
    expect(capacite('selon_quantite')).toBeNull()
    // Les deux autres états ne bougent pas d'un iota.
    expect(capacite('jamais', 4)).toBe(1)
    expect(capacite('toujours', 1)).toBe(Number.POSITIVE_INFINITY)
  })
})

// ══════════════════ MOITIÉ B (suite) — LE MOTEUR, ET LE TEMPS QU'IL DOIT REGARDER ════════════════

interface Conflit {
  readonly equipmentId: string
  readonly recipeIds: readonly string[]
}

type Conflits = (
  plats: readonly unknown[],
  capaciteDe: (code: string) => number | null,
) => readonly Conflit[]

/**
 * ⚠️ LA SIGNATURE EST CELLE DE LA PRODUCTION, ET ELLE NE CHANGE PAS : `cuisine.tsx` appelle
 * `conflitsDEquipement(plats, capaciteDe)` avec une FONCTION, pas une table. La première version de
 * ce fichier lui passait un `Map` et fabriquait des plats à la main — elle ne testait donc pas le
 * chemin réel. Ici les plats sont des recettes du catalogue, entières.
 */
async function chargerConflits(): Promise<Conflits> {
  const module = (await import('../../app/src/engine/cuisine/reservation.js')) as Record<
    string,
    unknown
  >
  const fn = module.conflitsDEquipement as Conflits | undefined
  expect(fn, 'conflitsDEquipement doit exister').toBeTypeOf('function')
  return fn as Conflits
}

interface Candidate {
  readonly id: string
  readonly plat: unknown
}

/**
 * Les recettes du catalogue qui occupent la plaque, par id croissant. Vide tant que le lot n'a rien
 * posé — ce qui rend toutes les clauses de ce bloc rouges aujourd'hui.
 */
async function recettesAPlaque(combien: number): Promise<readonly Candidate[]> {
  const { loadCatalog } = await import('../../app/src/data/catalog-loader-node.js')
  const toutes = [...loadCatalog(dbPath).recipes.values()] as readonly {
    readonly id: string
    readonly occupations: readonly { readonly equipmentId: string }[]
  }[]
  return toutes
    .filter((r) => r.occupations.some((o) => o.equipmentId === PLAQUE))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .slice(0, combien)
    .map((r) => ({ id: r.id, plat: r as unknown }))
}

/** Un feu, et rien d'autre : les autres ustensiles se taisent, donc seule la plaque peut parler. */
const unSeulFeu = (code: string): number | null => (code === PLAQUE ? 1 : null)
const quatreFeux = (code: string): number | null => (code === PLAQUE ? 4 : null)

const seDisputent = (conflits: Conflits, a: unknown, b: unknown): boolean =>
  conflits([a, b], unSeulFeu).some((c) => c.equipmentId === PLAQUE)

describe('65c — un feu occupé n’est pas un feu occupé EN MÊME TEMPS', () => {
  /**
   * ⛔ TOUT CE BLOC EXISTE POUR TUER UNE TRICHE PRÉCISE, TROUVÉE PAR L'ATTAQUE DU 2026-08-20 :
   *
   *     compter les recettes DISTINCTES qui demandent l'ustensile ; si le compte dépasse la
   *     capacité, annoncer un conflit.
   *
   * Trois lignes, aucune notion de temps, et elle passait l'ancienne clause 8 — parce que les deux
   * plats du test se recouvraient. Elle réintroduit exactement la régression que le 65a a payé 63 %
   * de fausses alertes pour éliminer. Les paires sont donc CHERCHÉES dans le catalogue : il en faut
   * une qui se dispute la plaque et une qui ne se la dispute pas, sur la même donnée et à la même
   * capacité. ⛔ UN COMPTAGE GLOBAL NE PEUT PAS PRODUIRE LES DEUX — il rend « conflit » partout.
   */
  async function paires(): Promise<{
    readonly conflits: Conflits
    readonly quiSeRecouvre: readonly [string, unknown, string, unknown]
    readonly disjointe: readonly [string, unknown, string, unknown]
  }> {
    const conflits = await chargerConflits()
    const candidates = await recettesAPlaque(24)
    expect(
      candidates.length,
      'aucune recette n’occupe la plaque — rien à disputer, la clause ne mesurerait rien',
    ).toBeGreaterThan(1)

    let quiSeRecouvre: readonly [string, unknown, string, unknown] | null = null
    let disjointe: readonly [string, unknown, string, unknown] | null = null

    for (const a of candidates) {
      for (const b of candidates) {
        if (a.id >= b.id) continue
        if (quiSeRecouvre !== null && disjointe !== null) break
        const trouve = seDisputent(conflits, a.plat, b.plat)
        if (trouve && quiSeRecouvre === null) quiSeRecouvre = [a.id, a.plat, b.id, b.plat]
        if (!trouve && disjointe === null) disjointe = [a.id, a.plat, b.id, b.plat]
      }
    }

    expect(
      quiSeRecouvre,
      'aucune paire de plats ne se dispute le feu unique — le moteur ne voit rien',
    ).not.toBeNull()
    expect(
      disjointe,
      '⛔ TOUTES les paires se disputent le feu : le moteur compte les plats sans regarder QUAND',
    ).not.toBeNull()

    return {
      conflits,
      quiSeRecouvre: quiSeRecouvre as readonly [string, unknown, string, unknown],
      disjointe: disjointe as readonly [string, unknown, string, unknown],
    }
  }

  it('13. un feu pour deux plats qui se chevauchent est un conflit ; quatre feux, non', async () => {
    const { conflits, quiSeRecouvre } = await paires()
    const [idA, platA, idB, platB] = quiSeRecouvre

    const nomme = conflits([platA, platB], unSeulFeu).find((c) => c.equipmentId === PLAQUE)
    expect(nomme, `${idA} et ${idB} se disputent le feu`).toBeDefined()
    expect([...(nomme?.recipeIds ?? [])].sort()).toEqual([idA, idB].sort())

    // ⛔ MÊME MONTAGE, SEULE LA CAPACITÉ CHANGE. Un retour constant ne peut pas satisfaire les deux.
    expect(conflits([platA, platB], quatreFeux).map((c) => c.equipmentId)).not.toContain(PLAQUE)
  })

  it('14. ⛔ deux plats qui tiennent le feu à des MOMENTS DIFFÉRENTS ne se disputent rien', async () => {
    // La clause qui tue le comptage global. Les deux plats occupent la plaque, il n'y a qu'un feu,
    // et pourtant il n'y a rien à signaler : ils ne s'en servent pas en même temps.
    const { conflits, disjointe } = await paires()
    const [idA, platA, idB, platB] = disjointe
    expect(
      conflits([platA, platB], unSeulFeu).filter((c) => c.equipmentId === PLAQUE),
      `${idA} et ${idB} n’occupent pas le feu en même temps`,
    ).toEqual([])
  })

  it('15. ⛔ trois plats, deux qui se chevauchent : le conflit ne nomme que ces deux-là', async () => {
    // ⛔ UN COMPTAGE GLOBAL NOMMERAIT LES TROIS. Le troisième plat occupe bien la plaque, il est
    // bien dans le repas, et il n'a rien à voir avec la dispute.
    const { conflits, quiSeRecouvre } = await paires()
    const [idA, platA, idB, platB] = quiSeRecouvre

    const candidates = await recettesAPlaque(24)
    const tiers = candidates.find(
      (c) =>
        c.id !== idA &&
        c.id !== idB &&
        !seDisputent(conflits, platA, c.plat) &&
        !seDisputent(conflits, platB, c.plat),
    )
    expect(
      tiers,
      'aucun troisième plat étranger à la dispute — la clause ne mesurerait rien',
    ).toBeDefined()

    const trois = conflits([platA, platB, tiers?.plat], unSeulFeu).filter(
      (c) => c.equipmentId === PLAQUE,
    )
    expect(trois.length, 'la dispute existe toujours à trois').toBeGreaterThan(0)
    for (const c of trois) {
      expect(c.recipeIds, `${tiers?.id} est nommé alors qu’il n’y est pour rien`).not.toContain(
        tiers?.id,
      )
    }
  })

  it('16. ⛔ sans quantité déclarée, aucun conflit de plaque n’est jamais prononcé', async () => {
    // La propriété que le 65a a payée pour obtenir. Un lot qui la casse en croyant bien faire est un
    // lot raté, et cette clause est là pour le dire.
    const { conflits, quiSeRecouvre } = await paires()
    const [, platA, , platB] = quiSeRecouvre
    expect(conflits([platA, platB], () => null).map((c) => c.equipmentId)).not.toContain(PLAQUE)
  })
})
