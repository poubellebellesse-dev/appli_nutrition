// ⛔ TEST SCELLÉ — LOT 66. Écrit AVANT le code, depuis le « Fini quand » seul.
//    Document : docs/CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md §4.
//
// Ce fichier est le seul du dépôt qui mesure une garantie de TYPE. Il fallait bien : l'invariant du
// lot 66 — « une origine animale ne va jamais sans sa provenance » — ne se vérifie pas à
// l'exécution. Le catalogue est déjà sain (0 paire incohérente sur 451 aliments) ; ce qui manque
// n'est pas une donnée correcte, c'est l'impossibilité d'en écrire une fausse.
//
// D'où la forme : on lance `tsc` sur trois fichiers-sondes et on regarde ce qu'il accepte.
// `vitest` n'orchestre rien d'autre. C'est lent (deux compilations), et c'est le prix d'une
// garantie qui ne s'exprime pas autrement.
//
// ⚠️ NE PAS REMPLACER LES SONDES PAR `@ts-expect-error`. Cette directive supprime N'IMPORTE QUELLE
// erreur sur la ligne suivante : une faute de frappe la satisferait aussi bien que le lot. Ici on
// lit le MESSAGE de `tsc`, pas seulement son silence.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { loadCatalog } from '../../app/src/data/catalog-loader-node.js'
import { resolveAnimalOrigin, resolveAnimalProvenance } from '../../app/src/engine/domain/index.js'
import type { Food, FoodId } from '../../app/src/engine/domain/index.js'

const RACINE = join(import.meta.dirname, '..', '..')
const SONDES = join(RACINE, 'tests', 'scelles', 'sondes-66')
const TSC = join(RACINE, 'node_modules', 'typescript', 'bin', 'tsc')
const BASE = join(RACINE, 'app', 'public', 'catalog', 'catalog.db')

/** Compile un projet de sondes. Rend le code de sortie et la sortie de `tsc`, jamais une exception. */
function compiler(tsconfig: string): { readonly code: number; readonly sortie: string } {
  try {
    const sortie = execFileSync(process.execPath, [TSC, '--noEmit', '-p', join(SONDES, tsconfig)], {
      cwd: RACINE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, sortie }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('lot 66 — la paire origine/provenance, garantie par la forme', () => {
  it('⛔ LA PAIRE INCOHÉRENTE NE COMPILE PLUS, ET `tsc` DIT POURQUOI', () => {
    const { code, sortie } = compiler('tsconfig.refuse.json')

    // Le refus, d'abord. C'est le cœur du lot : aujourd'hui `tsc` accepte cette sonde sans un mot.
    expect(code, `tsc a ACCEPTÉ la paire interdite. Sortie :\n${sortie}`).not.toBe(0)

    // Puis la RAISON du refus. Un `any` posé sur le chemin, un champ renommé au lieu d'être
    // supprimé, une erreur de syntaxe dans la sonde : tout ça refuserait aussi, et ne prouverait
    // rien. Le message doit nommer le champ qui a disparu.
    expect(sortie).toContain('provenanceAnimale')
  }, 120_000)

  it('⛔ LA PAIRE AMPUTÉE ET L’ORIGINE SEULE SONT REFUSÉES TOUTES LES DEUX', () => {
    // ⛔ AJOUTÉ À LA TROISIÈME RELECTURE, ET C'EST LE TROU LE PLUS PROFOND DES TROIS.
    // Sans ce test, deux implémentations fausses passaient tout le reste :
    //   • `provenance` rendue OPTIONNELLE dans `AnimalSource` — la sonde incohérente est quand même
    //     refusée, mais pour propriété EXCÉDENTAIRE (`provenanceAnimale` n'existe plus), pas pour
    //     l'invariant. Le 1er test passait donc pour une raison qui n'est pas la sienne ;
    //   • le type ÉLARGI en `AnimalOrigin | AnimalSource | null` « pour la compatibilité » — la
    //     paire complète reste un membre valide, et l'origine nue aussi.
    // Dans les deux cas, `provenanceAnimale` avait bien disparu du dépôt, les sondes valides
    // compilaient, le catalogue réel ne montrait rien — et **on pouvait toujours écrire une origine
    // sans provenance**, c'est-à-dire précisément ce que le lot existe pour rendre impossible.
    const { code, sortie } = compiler('tsconfig.refuse-neuve.json')

    expect(code, `tsc a ACCEPTÉ une origine animale sans provenance. Sortie :\n${sortie}`).not.toBe(0)

    // Les DEUX doivent être refusées. Si une seule l'est, un seul nom de fichier apparaît — et
    // c'est exactement la moitié de trou qu'on vient de fermer.
    expect(sortie, "la paire amputée n'a pas été refusée").toContain('sonde-paire-incomplete.ts')
    expect(sortie, "l'origine nue n'a pas été refusée").toContain('sonde-scalaire-nu.ts')

    // Et le refus doit porter sur le membre manquant, pas sur autre chose.
    expect(sortie).toContain('provenance')
  }, 120_000)

  it('⛔ UN ALIMENT VÉGÉTAL ET UN ALIMENT ANIMAL COMPLET COMPILENT TOUS LES DEUX', () => {
    // Sans ce test, le critère se satisfait en rendant les deux champs obligatoires — la paire
    // incohérente devient inexprimable, et les 284 aliments sans source animale avec elle.
    const { code, sortie } = compiler('tsconfig.accepte.json')
    expect(code, `tsc a REFUSÉ une sonde valide. Sortie :\n${sortie}`).toBe(0)
  }, 120_000)

  it('⛔ `provenanceAnimale` A DISPARU DU DÉPÔT, sauf de la sonde qui existe pour le montrer', () => {
    // Laisser le champ « au cas où » ferait passer les deux tests ci-dessus tout en gardant la
    // porte ouverte. On mesure sa disparition, pas seulement son inutilité.
    const restants: string[] = []
    const parcourir = (dossier: string): void => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, e.name)
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue
          parcourir(chemin)
          // `.mjs` compris : `catalog/` en est plein. Ils travaillent en `snake_case` aujourd'hui,
          // mais rien n'empêche un codeur d'y laisser le nom camelCase en passant.
        } else if (/\.(ts|tsx|mjs)$/u.test(e.name)) {
          // Les sondes nomment le champ parce que c'est leur objet. Ce fichier-ci le nomme dans ses
          // commentaires, et se détectait lui-même au premier essai : un test scellé qui ne peut
          // pas passer n'est pas un critère, c'est une impasse.
          if (chemin.startsWith(SONDES) || chemin === import.meta.filename) continue
          if (readFileSync(chemin, 'utf8').includes('provenanceAnimale')) restants.push(chemin)
        }
      }
    }
    parcourir(join(RACINE, 'app', 'src'))
    parcourir(join(RACINE, 'tests'))
    parcourir(join(RACINE, 'catalog'))

    expect(restants, `${restants.length} fichier(s) portent encore le champ`).toEqual([])
  })

  it('⛔ LE CHARGEUR RECOLLE LA PAIRE SANS LA FAUSSER — chaque aliment, contre SA colonne SQL', () => {
    // ⛔ CE TEST A ÉTÉ RÉÉCRIT AVANT LE SCEAU, ET LA PREMIÈRE VERSION ÉTAIT UN LEURRE.
    // Elle réimplémentait la cascade `deriveDe` en SQL brut et n'appelait NI `loadCatalog`, NI
    // `resolveAnimalOrigin`, NI `resolveAnimalProvenance` — alors que le « Fini quand » parle
    // précisément de ces deux fonctions. Un chargeur qui écrivait `provenance: 'production'` en dur
    // pour tout le monde la passait sans broncher : viandes et poissons devenaient des produits
    // laitiers, et ce fichier restait vert. Une relecture indépendante l'a trouvée.
    //
    // ⚠️ D'AUTRES TESTS DU DÉPÔT L'AURAIENT ATTRAPÉE — `tests/regime-coherence.test.ts` exige
    // `'corps'` sur six aliments réels, via le vrai chargeur. Ça ne suffisait pas : un test scellé
    // qui compte sur son voisin pour discriminer ne discrimine pas. Il doit tenir seul.
    expect(existsSync(BASE), `catalog.db absent — lancer 'node catalog/build.mjs'`).toBe(true)

    // La vérité de référence : les colonnes, lues directement, sans passer par le moteur.
    const db = new DatabaseSync(BASE, { readOnly: true })
    type Ligne = { id: string; o: string | null; p: string | null; d: string | null }
    const sql = db
      .prepare('SELECT id, origine_animale o, provenance_animale p, derive_de d FROM food')
      .all() as unknown as readonly Ligne[]
    db.close()

    // Ce que le moteur en fait, en passant par le vrai chemin de production.
    const catalogue = loadCatalog(BASE)

    // (a) Chaque aliment qui DÉCLARE porte SES deux valeurs — pas une constante partagée.
    const fausses: string[] = []
    for (const l of sql) {
      const food = catalogue.foods.get(l.id as string as FoodId)
      expect(food, `${l.id} absent du catalogue chargé`).toBeDefined()
      const o = resolveAnimalOrigin(food, catalogue.foods)
      const p = resolveAnimalProvenance(food, catalogue.foods)
      if (l.o !== null) {
        // Un déclarant : le moteur doit rendre SA ligne, pas une constante.
        if (o !== l.o || p !== l.p) fausses.push(`${l.id} : SQL ${l.o}/${l.p} → moteur ${o}/${p}`)
      } else if (l.d !== null) {
        // Un dérivé : le moteur doit rendre la paire de son ANCÊTRE, retrouvée sans le moteur.
        // ⚠️ Ça ne discrimine pas une cascade figée — les 38 dérivés du catalogue partagent une
        // seule paire, la fixture plus bas est là pour ça. Ça attrape le reste : une cascade qui
        // s'arrête trop tôt, qui rend `null`, ou qui remonte au mauvais aliment.
        const ancetre = sql.find((x) => x.id === l.d)
        if (ancetre?.o != null && (o !== ancetre.o || p !== ancetre.p)) {
          fausses.push(`${l.id} : ancêtre ${l.d} = ${ancetre.o}/${ancetre.p} → moteur ${o}/${p}`)
        }
      }
    }
    expect(fausses, `${fausses.length} aliment(s) recollés de travers`).toEqual([])

    // (b) Les DEUX valeurs de provenance survivent au recollement. Une constante en dur en tuerait
    //     une, et le compte le dirait avant qu'un écran ne le montre.
    const provenances = new Map<string, number>()
    for (const food of catalogue.foods.values()) {
      const p = resolveAnimalProvenance(food, catalogue.foods)
      if (p !== null) provenances.set(p, (provenances.get(p) ?? 0) + 1)
    }
    expect([...provenances.keys()].sort()).toEqual(['corps', 'production'])

    // (c) Les comptes du « Fini quand », résolus par le moteur et non recalculés par le test.
    let origine = 0
    let provenance = 0
    let desaccord = 0
    let parDerivation = 0
    for (const food of catalogue.foods.values()) {
      const o = resolveAnimalOrigin(food, catalogue.foods)
      const p = resolveAnimalProvenance(food, catalogue.foods)
      if (o !== null) origine++
      if (p !== null) provenance++
      if ((o === null) !== (p === null)) desaccord++
      // Obtenue par la CASCADE : le moteur trouve une origine là où la colonne SQL est vide.
      if (o !== null && sql.find((l) => l.id === food.id)?.o === null) parDerivation++
    }

    // ⛔ AUCUN DE CES COMPTES N'EST ÉCRIT EN DUR, ET C'EST UNE RÈGLE DU DÉPÔT, PAS UN GOÛT.
    // Quatre tests ont déjà parié sur la taille du catalogue et un lot de contenu les a cassés
    // (`tests/groupes-animaux-catalogue.test.ts` porte la même consigne en tête). On AFFICHE les
    // effectifs — ils sont lisibles dans la sortie de `npm test` — et on vérifie entre eux des
    // invariants qui survivent à l'ajout d'un aliment.
    // eslint-disable-next-line no-console
    console.log(
      `[66] ${catalogue.foods.size} aliments · origine résolue ${origine} · dont ${parDerivation} par cascade`,
    )

    expect(origine, 'les deux résolutions doivent tomber sur le MÊME nombre').toBe(provenance)
    expect(desaccord, "un aliment a une origine sans provenance, ou l'inverse").toBe(0)
    expect(origine, 'aucun aliment à source animale — le catalogue a fondu').toBeGreaterThan(0)
    expect(parDerivation, 'la cascade `deriveDe` ne résout plus rien').toBeGreaterThan(0)
  })

  it('⛔ LA CASCADE REND LA PAIRE DE L’ANCÊTRE — sur fixture, parce que le catalogue NE PEUT PAS le dire', () => {
    // ⚠️ LE SEUL TEST DE CE FICHIER QUI N'EST PAS ADOSSÉ À `catalog.db`, ET C'EST DÉLIBÉRÉ.
    // Mesuré le 2026-08-13 : les 38 aliments dont l'origine vient de la cascade résolvent TOUS
    // `mammifere` / `production` — ils descendent tous de `lait_entier`. Une cascade qui rendrait
    // cette paire EN DUR pour tout aliment dérivé serait donc juste sur la totalité du catalogue
    // réel. Aucun test contre `catalog.db` ne peut l'attraper : ni celui-ci, ni ceux des autres
    // lots, ni un oracle indépendant — la donnée elle-même ne discrimine pas.
    //
    // C'est un trou de DONNÉE, connu et écrit : `ETAT.md` §3, lot A du chantier régime — « aucune
    // cascade `deriveDe` du côté carné n'existe dans le catalogue ». Il se fermera au premier
    // dérivé carné ajouté. En attendant, la seule façon d'exercer la branche est de la construire.
    //
    // ⚠️ LE `as unknown as Food` CI-DESSOUS EST ASSUMÉ ET IL EST LE SEUL DU LOT. Ces objets sont
    // écrits dans la forme VISÉE, qui n'existe pas encore : sans lui, `npm run typecheck` serait
    // rouge tant que le lot n'est pas codé. La garantie de type, elle, est portée par les sondes —
    // pas par ce test, qui ne mesure que le comportement des résolveurs.
    // ⚠️ LA CHAÎNE FAIT DEUX MAILLONS, ET C'EST MESURÉ, PAS DÉCORATIF. Les 38 cascades du catalogue
    // ont TOUTES la longueur 1 — aucune n'en compte deux. Un résolveur qui ne remonterait qu'un
    // seul niveau serait donc vert sur la totalité du catalogue. Avec un seul maillon ici, cette
    // fixture le serait aussi ; avec deux, elle ne l'est plus.
    const anchois = {
      id: 'anchois' as string as FoodId,
      origineAnimale: { origine: 'poisson', provenance: 'corps' },
      deriveDe: null,
    } as unknown as Food
    const filetsHuile = {
      id: 'anchois_huile' as string as FoodId,
      origineAnimale: null,
      deriveDe: anchois.id,
    } as unknown as Food
    const pateAnchois = {
      id: 'pate_anchois' as string as FoodId,
      origineAnimale: null,
      deriveDe: filetsHuile.id,
    } as unknown as Food
    const foods = new Map<FoodId, Food>([
      [anchois.id, anchois],
      [filetsHuile.id, filetsHuile],
      [pateAnchois.id, pateAnchois],
    ])

    // Deux maillons : le dérivé du dérivé. Rien ne déclare, tout doit remonter jusqu'à l'anchois.
    expect(resolveAnimalOrigin(pateAnchois, foods)).toBe('poisson')
    expect(resolveAnimalProvenance(pateAnchois, foods)).toBe('corps')

    // Un maillon, pour que l'échec dise LEQUEL des deux niveaux a lâché.
    expect(resolveAnimalOrigin(filetsHuile, foods)).toBe('poisson')
    expect(resolveAnimalProvenance(filetsHuile, foods)).toBe('corps')

    // Et le déclarant direct rend les siennes, ce qui distingue « la cascade marche » de « tout le
    // monde reçoit la même chose ».
    expect(resolveAnimalOrigin(anchois, foods)).toBe('poisson')
    expect(resolveAnimalProvenance(anchois, foods)).toBe('corps')
  })
})
