// tests/scelles/65a.test.ts — l'examen du lot 65a : le catalogue et le moteur.
//
// 65a = les cinq lots A → B → C′ → D → E de `docs/CONCEPTION_RESERVATION_MATERIEL.md`, sous un seul
// sceau. Le lot E vit dans `65a-ecran.test.tsx` : il lui faut `jsdom`, et l'environnement se choisit
// par fichier.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT.
//
// ⛔ AUCUN TOTAL D'OCCUPATIONS N'EST SCELLÉ ICI, ET C'EST DÉLIBÉRÉ. Les 98 ont été mesurées avec une
// ligne PAR ÉTAPE. Le modèle à portée (`ordre_debut`/`ordre_fin`) ne compte plus le même objet :
// deux étapes détectées qui se rejoignent ne font plus qu'une ligne, et le nombre de continuités
// n'a JAMAIS été mesuré. Sceller « 92 » ou « 93 » serait inventer un chiffre pour avoir l'air
// précis. Ce qui le remplace : **exactement 85 recettes** portent une occupation — un compte connu,
// stable, qu'aucune implémentation générique n'atteint sans faire le travail recette par recette.
//
// ⚠️ CE NOMBRE A ÉTÉ SCELLÉ À 83, ET 83 ÉTAIT FAUX. Corrigé le 2026-08-13 SUR DÉCISION EXPLICITE DE
// L'AUTEUR, jamais de l'implémenteur, et après mesure sur les 330 recettes réelles. 83 est le nombre
// de recettes qui EXIGENT le four ou le micro-ondes (`recipe_equipment.niveau = 'requis'`) ;
// l'assertion, elle, compte celles qui PORTENT une occupation (`recipe_step_equipment`). Les deux
// tables ne décrivent pas le même ensemble, et l'assertion avait été écrite sur la mauvaise :
//
//   82  recettes portent une occupation DÉTECTÉE par `catalog/lien-etape-equipement.mjs`
//   +3  muettes que le lot B déclare : flan_oeufs_caramel (bain-marie à 160 °C), tarte_citron
//       (cuisson à blanc à 180 °C), mug_cake_chocolat (micro-ondes)
//   =85
//
// ⛔ ET L'ÉCART N'EST PAS UN SIMPLE DÉCALAGE DE +2. `moules_gratinees_chapelure` et
// `soupe_oignon_gratinee` passent « sous le gril » sans déclarer `four: requis` : elles portent une
// occupation sans figurer dans les 83. Faire coïncider les deux nombres demanderait de corriger
// leurs équipements — un autre lot, pas celui-ci.
//
// ⚠️ 85 ET « AUCUNE RECETTE MUETTE » SONT LIÉS, et c'est ce lien qui a révélé l'erreur : le test des
// muettes FORCE les trois déclarations, donc force le total au-dessus de 83. Deux assertions
// scellées qui ne pouvaient pas être vraies ensemble. Si l'une des deux rebouge un jour, la seconde
// est à revérifier dans le même mouvement.
//
// ⚠️ LES TESTS DU MOTEUR SONT ÉCRITS POUR RÉSISTER À LA TRICHE. Un `critique` a fait passer la
// version précédente avec trois lignes de faux : `if (plats.length < 2) return []` puis une
// constante en dur. D'où les deux tests NÉGATIFS ci-dessous — un seul plat au four, et une capacité
// illimitée — qui ne peuvent pas être satisfaits par un retour constant.
//
// ⚠️ DES NOMBRES EXACTS ET DES `recipeId` EN DUR, et c'est voulu : un test SCELLÉ est le critère
// d'acceptation d'un lot, pas un test de régression. S'il devient faux parce que le contenu a bougé,
// on le DIT et on s'arrête — on ne le retouche pas pour le faire passer.
//
// ⚠️ MODULES PAS ENCORE ÉCRITS = IMPORT DYNAMIQUE, chemin calculé. Un `import` statique vers un
// fichier absent casserait `npm run typecheck` pour tout l'arbre, y compris pour la session qui
// travaille en parallèle sur les médias.
//
// ⚠️ BUILD VERS UN FICHIER ISOLÉ : `catalog/build.test.ts` reconstruit le `catalog.db` partagé en
// parallèle, et deux builds concurrents se corrompent.

import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..', '..')
const BUILD_SCRIPT = path.join(REPO_ROOT, 'catalog', 'build.mjs')

/** Le trou VRAI : on enfourne, on sort le plat pour poser le poisson, on remet. */
const TROU_VRAI = 'colin_four_fenouil'

/** Le trou FAUX : le bain-marie entre au four à l'étape 1 et n'en ressort pas avant la 5. */
const TROU_FAUX = 'oeufs_cocotte_epinards'

/**
 * Les cinq faux positifs du lot B. ⚠️ ILS ÉTAIENT SIX : `oeufs_cocotte_epinards` étape 1 en est
 * sorti le 2026-08-13 — le détecteur avait raison, c'est la PORTÉE qui manquait, pas la sévérité.
 */
const FAUX_POSITIFS: readonly (readonly [string, number])[] = [
  ['sardines_grillees_tomates', 4],
  ['pommes_terre_four_romarin', 2],
  ['boulgour_pois_chiches_courgettes', 3],
  ['chou_fleur_roti_curcuma', 3],
  ['poireaux_gratines_bechamel', 3],
]

let db: DatabaseSync
let dbPath: string

beforeAll(() => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'nutri-65a-'))
  dbPath = path.join(fixtureDir, 'catalog.db')
  const result = spawnSync(process.execPath, ['--experimental-sqlite', BUILD_SCRIPT, '--out', dbPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  expect(result.status).toBe(0)
  db = new DatabaseSync(dbPath)
})

function schemaDe(nom: string): string | undefined {
  const ligne = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(nom) as { readonly sql: string } | undefined
  return ligne?.sql
}

/** Les occupations de four d'une recette, en portées `[début, fin]`, triées. */
function porteesFourDe(recipeId: string): readonly (readonly [number, number])[] {
  const lignes = db
    .prepare(
      `SELECT rse.ordre_debut, rse.ordre_fin
         FROM recipe_step_equipment rse
         JOIN equipment e ON e.id = rse.equipment_id
        WHERE rse.recipe_id = ? AND e.code = 'four'
        ORDER BY rse.ordre_debut`,
    )
    .all(recipeId) as unknown as readonly { readonly ordre_debut: number; readonly ordre_fin: number }[]
  return lignes.map((l) => [l.ordre_debut, l.ordre_fin] as const)
}

/** Une étape est-elle COUVERTE par une occupation de four ? Portée comprise, pas seulement début. */
function etapeCouverte(recipeId: string, ordre: number): boolean {
  return porteesFourDe(recipeId).some(([debut, fin]) => ordre >= debut && ordre <= fin)
}

// ---------------------------------------------------------------------------------------------
// Lots A et B — le catalogue sait QUAND un ustensile est occupé, et pour combien de temps
// ---------------------------------------------------------------------------------------------

describe('65a · A+B — une occupation porte une portée, pas une étape', () => {
  it('⛔ `recipe_step_equipment` EXISTE, avec un DÉBUT et une FIN d’étape', () => {
    // Sans portée, la table ne sait pas dire « l'eau reste au four pendant qu'on prépare la suite ».
    // Sans l'étape dans la clé, elle redit `recipe_equipment` et le chantier n'a servi à rien.
    const sql = schemaDe('recipe_step_equipment')
    expect(sql, 'la table recipe_step_equipment n’existe pas').toBeDefined()
    expect(sql!).toMatch(/ordre_debut\s+INTEGER\s+NOT NULL/i)
    expect(sql!).toMatch(/ordre_fin\s+INTEGER\s+NOT NULL/i)
    expect(sql!).toMatch(/CHECK\s*\(\s*ordre_fin\s*>=\s*ordre_debut\s*\)/i)
    expect(sql!).toMatch(/PRIMARY KEY\s*\(\s*recipe_id\s*,\s*ordre_debut\s*,\s*equipment_id\s*\)/i)
  })

  it('⛔ `origine` n’a que DEUX valeurs — un ustensile n’hérite de rien', () => {
    // `recipe_step_ingredient` en a trois à cause des pronoms (« les blanchir »). Un ustensile est
    // toujours nommé : « remettre au four » dit le four. Pas de `herite` par symétrie paresseuse.
    const sql = schemaDe('recipe_step_equipment')
    expect(sql).toBeDefined()
    expect(sql!).toMatch(/origine[^,]*CHECK\s*\(\s*origine\s+IN\s*\(\s*'declare'\s*,\s*'derive'\s*\)\s*\)/i)
    expect(sql!).not.toMatch(/'herite'/i)
  })

  it('EXACTEMENT 85 recettes portent une occupation de four ou de micro-ondes', () => {
    // Remplace le total d'occupations, qui n'est plus mesurable sous le modèle à portée. 85 est
    // connu et stable — et c'est un compte qu'aucune constante en dur ne produit par hasard.
    // ⚠️ 83 jusqu'au 2026-08-13 : c'était le compte des recettes qui EXIGENT le four, pas de celles
    // qui portent une occupation. Le détail du calcul est dans l'en-tête du fichier.
    const { n } = db
      .prepare(
        `SELECT COUNT(DISTINCT rse.recipe_id) AS n
           FROM recipe_step_equipment rse
           JOIN equipment e ON e.id = rse.equipment_id
          WHERE e.code IN ('four', 'micro_ondes')`,
      )
      .get() as { readonly n: number }
    expect(n).toBe(85)
  })

  it('⛔ AUCUNE RECETTE MUETTE — celles qui EXIGENT le four en portent une occupation', () => {
    // La moitié du critère qu'on ne peut pas obtenir en trichant : un détecteur qui ne trouverait
    // que les cas faciles ferait un beau total en laissant des recettes sans le moindre créneau.
    // Ce sont celles-là qui rendraient la réservation fausse — elle dirait « libre » à tort.
    const muettes = db
      .prepare(
        `SELECT DISTINCT re.recipe_id
           FROM recipe_equipment re
           JOIN equipment e ON e.id = re.equipment_id
          WHERE re.niveau = 'requis'
            AND e.code IN ('four', 'micro_ondes')
            AND NOT EXISTS (
              SELECT 1 FROM recipe_step_equipment rse
               WHERE rse.recipe_id = re.recipe_id
                 AND rse.equipment_id = re.equipment_id
            )
          ORDER BY re.recipe_id`,
      )
      .all() as unknown as readonly { readonly recipe_id: string }[]

    expect(muettes.map((r) => r.recipe_id)).toEqual([])
  })

  it(`${TROU_VRAI} — DEUX occupations, [2,2] et [4,4], et l’étape 3 LIBRE`, () => {
    // Le trou est vrai : on sort le plat pour poser le poisson. C'est le cas qui interdit de
    // combler les trous automatiquement.
    expect(porteesFourDe(TROU_VRAI)).toEqual([
      [2, 2],
      [4, 4],
    ])
    expect(etapeCouverte(TROU_VRAI, 3)).toBe(false)
  })

  it(`⛔ ${TROU_FAUX} — UNE SEULE occupation [1,5], qui COUVRE les étapes 2, 3 et 4`, () => {
    // Le trou est faux : le plat d'eau entre au four au préchauffage et n'en sort pas. Une ligne par
    // étape aurait déclaré le four LIBRE pendant qu'on fait tomber les épinards.
    // ⛔ Et c'est le sens de l'erreur qui compte : dire « pris » à tort agace, dire « libre » à tort
    // fait rater un plat.
    expect(porteesFourDe(TROU_FAUX)).toEqual([[1, 5]])
    expect(etapeCouverte(TROU_FAUX, 2)).toBe(true)
    expect(etapeCouverte(TROU_FAUX, 3)).toBe(true)
    expect(etapeCouverte(TROU_FAUX, 4)).toBe(true)
  })

  it('⛔ AUCUN DES 5 FAUX POSITIFS n’est couvert par une occupation de four', () => {
    // Relus un par un le 2026-08-11 : on sert, on rince, on mélange, on étale, une phrase
    // d'explication. ⚠️ « couvert », pas « commence ici » : une portée trop large les rattraperait.
    const restants = FAUX_POSITIFS.filter(([recipeId, ordre]) => etapeCouverte(recipeId, ordre))
    expect(restants).toEqual([])
  })

  it('⛔ LA RÈGLE VIT DANS `catalog/`, EN UN SEUL EXEMPLAIRE — pas dans `atelier/`, qui est gitignoré', () => {
    // Remplace la clause qui demandait à `node atelier/mesure-occupation-four.mjs` de retrouver le
    // compte : `atelier/` est gitignoré, donc cette clause n'était vérifiable sur aucun clone.
    const regle = path.join(REPO_ROOT, 'catalog', 'lien-etape-equipement.mjs')
    expect(existsSync(regle), 'catalog/lien-etape-equipement.mjs est absent').toBe(true)
    expect(readFileSync(BUILD_SCRIPT, 'utf8')).toMatch(/from\s+'\.\/lien-etape-equipement\.mjs'/)
  })
})

// ---------------------------------------------------------------------------------------------
// Lot C′ — la capacité, moitié catalogue
// ---------------------------------------------------------------------------------------------

describe('65a · C′ — le catalogue dit ce qui se partage, le moteur ne le juge plus', () => {
  it('⛔ `equipment.partageable` EXISTE, avec ses trois valeurs', () => {
    // Trois états, pas deux : `selon_quantite` permet de nommer la plaque sans encore savoir
    // combien de feux la personne possède. C'est ce qui rend la coupe 65a/65b possible.
    const sql = schemaDe('equipment')
    expect(sql, 'la table equipment n’existe pas').toBeDefined()
    expect(sql!).toMatch(
      /partageable[^,]*CHECK\s*\(\s*partageable\s+IN\s*\(\s*'jamais'\s*,\s*'selon_quantite'\s*,\s*'toujours'\s*\)\s*\)/i,
    )
  })

  it('le four et le micro-ondes sont `jamais`, la plaque est `selon_quantite`', () => {
    const valeurs = db
      .prepare(
        `SELECT code, partageable FROM equipment
          WHERE code IN ('four', 'micro_ondes', 'plaque_cuisson') ORDER BY code`,
      )
      .all() as unknown as readonly { readonly code: string; readonly partageable: string }[]

    expect(valeurs).toEqual([
      { code: 'four', partageable: 'jamais' },
      { code: 'micro_ondes', partageable: 'jamais' },
      { code: 'plaque_cuisson', partageable: 'selon_quantite' },
    ])
  })

  it('⛔ `CODES_INDIVISIBLES` A DISPARU DU MOTEUR', () => {
    // ⚠️ CE TEST SEUL NE SUFFIT PAS, et il faut le savoir : renommer la constante le ferait passer
    // sans rembourser la dette. C'est le test « capacité illimitée » du lot D qui prouve vraiment
    // que la donnée est LUE. Celui-ci ne coûte rien et attrape le cas paresseux.
    const partage = path.join(REPO_ROOT, 'app', 'src', 'engine', 'cuisine', 'equipement-partage.ts')
    expect(existsSync(partage)).toBe(true)
    expect(readFileSync(partage, 'utf8')).not.toMatch(/CODES_INDIVISIBLES/)
  })
})

// ---------------------------------------------------------------------------------------------
// Lot D — le moteur, en intervalles
// ---------------------------------------------------------------------------------------------

interface Conflit {
  readonly equipmentId: string
  readonly recipeIds: readonly string[]
  readonly debutAvantServiceMin: number
  readonly finAvantServiceMin: number
}

/**
 * Le module de réservation, chargé par chemin calculé pour que son absence n'entraîne pas le
 * typecheck de tout l'arbre.
 *
 * `capaciteDe` rend le nombre de choses portées en même temps, ou `null` pour « on ne sait pas » —
 * et `null` ne vaut PAS 1 : un ustensile `selon_quantite` sans réponse se tait.
 */
async function chargerReservation(): Promise<{
  readonly conflitsDEquipement: (
    plats: readonly unknown[],
    capaciteDe: (code: string) => number | null,
  ) => readonly Conflit[]
}> {
  const fichier = path.join(REPO_ROOT, 'app', 'src', 'engine', 'cuisine', 'reservation.ts')
  expect(existsSync(fichier), 'app/src/engine/cuisine/reservation.ts est absent').toBe(true)
  return (await import(/* @vite-ignore */ pathToFileURL(fichier).href)) as never
}

/** Une recette du catalogue réel, par id. */
async function recette(id: string): Promise<unknown> {
  const { loadCatalog } = await import('../../app/src/data/catalog-loader-node.js')
  const trouvee = [...loadCatalog(dbPath).recipes.values()].find((r) => r.id === (id as never))
  expect(trouvee, `${id} est absent du catalogue`).toBeDefined()
  return trouvee
}

/** Une recette qui n'exige NI four NI micro-ondes — pour le test négatif. */
function recetteSansFour(): string {
  const { recipe_id } = db
    .prepare(
      `SELECT r.id AS recipe_id FROM recipe r
        WHERE NOT EXISTS (
          SELECT 1 FROM recipe_equipment re JOIN equipment e ON e.id = re.equipment_id
           WHERE re.recipe_id = r.id AND e.code IN ('four', 'micro_ondes')
        )
        ORDER BY r.id LIMIT 1`,
    )
    .get() as { readonly recipe_id: string }
  return recipe_id
}

/** La première AUTRE recette qui exige le four — aucun id en dur, le partenaire est quelconque. */
function autreRecetteAuFour(): string {
  const { recipe_id } = db
    .prepare(
      `SELECT re.recipe_id FROM recipe_equipment re
         JOIN equipment e ON e.id = re.equipment_id
        WHERE re.niveau = 'requis' AND e.code = 'four' AND re.recipe_id NOT IN (?, ?)
        ORDER BY re.recipe_id LIMIT 1`,
    )
    .get(TROU_VRAI, TROU_FAUX) as { readonly recipe_id: string }
  return recipe_id
}

describe('65a · D — le moteur réserve des intervalles, et LIT la capacité', () => {
  it('⛔ UN PLAT SEUL NE SE DISPUTE PAS AVEC LUI-MÊME — le trou n’est pas un conflit', async () => {
    // Le piège du chantier. `colin_four_fenouil` occupe le four deux fois ; un moteur qui
    // raisonnerait « par recette » verrait deux demandes et crierait au conflit. Il n'y en a aucun :
    // c'est le même plat, l'un après l'autre.
    const { conflitsDEquipement } = await chargerReservation()
    expect(conflitsDEquipement([await recette(TROU_VRAI)], () => 1)).toEqual([])
  })

  it('⛔ DEUX PLATS DONT UN SEUL VA AU FOUR — aucun conflit', async () => {
    // ⚠️ CE TEST EXISTE POUR TUER UNE TRICHE PRÉCISE : `if (plats.length < 2) return []` suivi d'une
    // constante. Deux plats, et pourtant rien à signaler — il faut regarder ce qu'ils occupent.
    const { conflitsDEquipement } = await chargerReservation()
    const plats = [await recette(TROU_VRAI), await recette(recetteSansFour())]
    expect(conflitsDEquipement(plats, () => 1)).toEqual([])
  })

  it('deux plats au four, capacité 1 — UN conflit, qui nomme le four, les deux plats, et une plage', async () => {
    const { conflitsDEquipement } = await chargerReservation()
    const autre = autreRecetteAuFour()
    const conflits = conflitsDEquipement([await recette(TROU_VRAI), await recette(autre)], () => 1)

    expect(conflits.length).toBeGreaterThan(0)
    const conflit = conflits[0]!
    expect(conflit.recipeIds).toEqual([TROU_VRAI, autre].sort())
    // ⚠️ Minutes AVANT le service, jamais une horloge — même discipline que `ordonnancement.ts`.
    // Une fenêtre non vide compte donc à rebours : le début est plus loin du service que la fin.
    expect(conflit.debutAvantServiceMin).toBeGreaterThan(conflit.finAvantServiceMin)
  })

  it('⛔ LES MÊMES DEUX PLATS, CAPACITÉ ILLIMITÉE — aucun conflit', async () => {
    // ⚠️ LE TEST QUI PROUVE QUE `capaciteDe` EST VRAIMENT LU. Sans lui, une liste d'ustensiles codée
    // en dur — même renommée — passe tout le lot C′. Avec lui, elle échoue ici.
    const { conflitsDEquipement } = await chargerReservation()
    const plats = [await recette(TROU_VRAI), await recette(autreRecetteAuFour())]
    expect(conflitsDEquipement(plats, () => Number.POSITIVE_INFINITY)).toEqual([])
  })

  it('⛔ CAPACITÉ INCONNUE (`null`) — le moteur SE TAIT, il ne suppose pas 1', async () => {
    // C'est ce qui rend 65a strictement additif sur la plaque : `selon_quantite` sans réponse ne
    // déclenche rien. Traiter `null` comme 1 rouvrirait les 63 % de fausses alertes.
    const { conflitsDEquipement } = await chargerReservation()
    const plats = [await recette(TROU_VRAI), await recette(autreRecetteAuFour())]
    expect(conflitsDEquipement(plats, () => null)).toEqual([])
  })
})
