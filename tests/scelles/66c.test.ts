// ⛔ TEST SCELLÉ — LOT 66c. Écrit depuis le « Fini quand » seul, avant toute autre ligne.
//    Document : docs/CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md §8.
//
// ⚠️ CE FICHIER N'EST PAS UN TEST D'ACCEPTATION, ET IL PASSE DÈS LE PREMIER ESSAI — même entorse
// assumée qu'au 66b, et pour la même raison : le lot ne change AUCUNE ligne de production, le type
// livré est déjà juste. Ce qu'on achète est l'impossibilité de le défaire en silence.
// La démonstration que ces tests savent ÉCHOUER est la diagonale de mutations du §8, pas un rouge
// de départ.
//
// ⛔ CE QUE CE LOT CORRIGE DANS LE PRÉCÉDENT : le §7 conclut « il reste une case ». Il en restait
// TROIS. Le modèle « deux champs × deux axes » oubliait un troisième axe — `undefined`, qui sous
// `exactOptionalPropertyTypes: true` n'est ni `null` ni une clé absente. Deux des trois cases
// portent sur des champs que les documents déclaraient clos.
//
// ⛔ POURQUOI UN FICHIER SÉPARÉ DE `66.test.ts` ET DE `66b.test.ts` : tous deux sont SCELLÉS et
// clos. Y ajouter un test, ou ajouter un fichier à l'un de leurs cinq projets de compilation,
// changerait ce qu'un test scellé mesure. On ajoute à côté ; on ne retouche pas un examen passé.
//
// ⚠️ UN PROJET DE COMPILATION PAR SONDE, comme au 66b : les assertions lisent le TEXTE du
// diagnostic. Avec deux sondes dans un même projet, rien ne garantirait que le nom du fichier, la
// valeur rejetée et le type qui la rejette viennent de la MÊME erreur.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const RACINE = join(import.meta.dirname, '..', '..')
const SONDES = join(RACINE, 'tests', 'scelles', 'sondes-66')
const TSC = join(RACINE, 'node_modules', 'typescript', 'bin', 'tsc')

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

/**
 * ⛔ LE GARDE-FOU QUI REND CES TESTS DIFFICILES À TRUQUER, et il ne coûte qu'une ligne.
 *
 * Un test qui n'exige qu'un code de sortie non nul est satisfait par n'importe quelle casse : une
 * faute de frappe dans la sonde, un import qui ne résout plus, un `any` posé sur le chemin. Le
 * trou resterait grand ouvert et le test resterait vert. On exige donc que le projet produise
 * EXACTEMENT UN diagnostic — celui qu'on nomme, et rien d'autre à côté.
 */
function diagnostics(sortie: string): readonly string[] {
  return sortie.split(/\r?\n/).filter((l) => /error TS\d+:/.test(l))
}

/**
 * ⛔ LES SEPT ASSERTIONS ASSUMÉES, GELÉES PAR FICHIER ET PAR NOMBRE — RELEVÉ LE 2026-08-17.
 *
 * Elles sont toutes LÉGITIMES : chacune fabrique volontairement une paire cassée pour vérifier que
 * la résolution l'encaisse. Ce test ne les condamne pas, il les COMPTE — pour que la huitième soit
 * une décision et non une découverte.
 *
 * ⚠️ AUCUN NUMÉRO DE LIGNE ICI, ET C'EST DÉLIBÉRÉ. Les geler rendrait le test rouge au premier
 * ajout de commentaire au-dessus — un test qui crie pour rien finit par être désarmé. On gèle le
 * fichier et le nombre : déplacer une assertion dans son fichier ne dit rien, en AJOUTER une le dit.
 */
const ASSERTIONS_GELEES: Readonly<Record<string, number>> = {
  // Deux `as AnimalSource` (origine seule) + un `as unknown as AnimalSource` (provenance seule).
  'app/src/engine/domain/groupes-animaux.test.ts': 3,
  // Un `as AnimalSource` : une origine sans provenance, pour le filtre de régime.
  'app/src/engine/selection/regime.test.ts': 1,
  // Trois `as unknown as Food`, assumés et signalés en clair dans le test scellé du lot 66.
  'tests/scelles/66.test.ts': 3,
}

/** Les trois formes capables de fabriquer une paire que le type refuse. */
const FABRIQUE_UNE_PAIRE = /as\s+unknown\s+as\s+(?:AnimalSource|Food)\b|as\s+AnimalSource\b/g

const RACINES = ['app/src', 'catalog', 'tests']
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js']

/**
 * ⛔ CE FICHIER S'EXCLUT LUI-MÊME, ET C'EST LE SEUL. Découvert en lançant le test : il s'est
 * attrapé tout seul. Les motifs surveillés apparaissent dans SES titres de test et SES messages
 * d'erreur — `sansCommentaires` retire les commentaires, pas les chaînes de caractères.
 *
 * ⚠️ Pourquoi cette exclusion ne crée pas d'angle mort, et pourquoi c'est le MOINS mauvais choix :
 * ce fichier est **scellé**, donc il ne bougera plus ; l'exclusion porte sur UN chemin nommé, pas
 * sur un motif qui pourrait en avaler d'autres. L'alternative — retirer aussi les chaînes avant de
 * scanner — demande de gérer `'`, `"`, les gabarits et les échappements : un bug là-dedans produit
 * un FAUX NÉGATIF, c'est-à-dire une assertion réelle rendue invisible. On préfère un trou d'un
 * fichier, nommé et scellé, à un trou silencieux de taille inconnue.
 */
const MOI = 'tests/scelles/66c.test.ts'

/**
 * Retire les commentaires d'une source avant de la scanner.
 *
 * ⛔ SANS ÇA, LA LISTE GELÉE SERAIT FAUSSE DÈS LE PREMIER JOUR. `tests/scelles/66.test.ts` ligne 217
 * porte le texte « `as unknown as Food` » DANS UN COMMENTAIRE qui met en garde contre lui. Le
 * compter donnerait 4 au lieu de 3 — un chiffre gelé sur une phrase, pas sur du code.
 */
function sansCommentaires(source: string): string {
  let hors = ''
  let dansBloc = false
  for (const ligne of source.split(/\r?\n/)) {
    let reste = ligne
    let garde = ''
    while (reste.length > 0) {
      if (dansBloc) {
        const fin = reste.indexOf('*/')
        if (fin < 0) { reste = ''; break }
        dansBloc = false
        reste = reste.slice(fin + 2)
        continue
      }
      const bloc = reste.indexOf('/*')
      const ligneComm = reste.indexOf('//')
      if (ligneComm >= 0 && (bloc < 0 || ligneComm < bloc)) { garde += reste.slice(0, ligneComm); break }
      if (bloc >= 0) { garde += reste.slice(0, bloc); reste = reste.slice(bloc + 2); dansBloc = true; continue }
      garde += reste
      break
    }
    hors += `${garde}\n`
  }
  return hors
}

/**
 * Compte les occurrences d'un motif par fichier — chemin relatif à la racine, séparateurs `/`.
 *
 * ⛔ `ouCommentaires` N'EST PAS UN CONFORT, C'EST UNE CORRECTION DE BOGUE. Le test des directives
 * a d'abord été écrit sur la source nettoyée, et il était **incapable de rougir** : une
 * `@ts-expect-error` vit TOUJOURS dans un commentaire, donc `sansCommentaires` l'effaçait avant
 * qu'on la cherche. Trouvé en vérifiant que chaque test sait échouer, jamais en le relisant.
 * ⚠️ Un test qui ne peut pas rougir est pire qu'un test absent : il occupe la place d'une garde.
 */
function scannerMotif(motif: RegExp, ouCommentaires = false): Record<string, number> {
  const trouve: Record<string, number> = {}
  for (const racine of RACINES) {
    for (const entree of readdirSync(join(RACINE, racine), { recursive: true, withFileTypes: true })) {
      if (!entree.isFile() || !EXTENSIONS.some((e) => entree.name.endsWith(e))) continue
      const absolu = join(entree.parentPath, entree.name)
      const relatif = relative(RACINE, absolu).split('\\').join('/')
      if (relatif === MOI) continue
      const source = readFileSync(absolu, 'utf8')
      const lu = ouCommentaires ? source : sansCommentaires(source)
      const n = (lu.match(new RegExp(motif.source, 'g')) ?? []).length
      if (n > 0) trouve[relatif] = n
    }
  }
  return trouve
}

const scannerAssertions = (): Record<string, number> => scannerMotif(FABRIQUE_UNE_PAIRE)

describe('lot 66c — les trois cases que le modèle « deux axes » ne voyait pas', () => {
  it("⛔ UNE PROVENANCE SANS ORIGINE EST REFUSÉE — la case symétrique de `sonde-paire-incomplete`", () => {
    // `sonde-paire-incomplete.ts` (lot 66) écrit `{ origine }` sans `provenance`. Personne n'a
    // jamais écrit l'inverse. Conséquence mesurée : avec `origine?: AnimalOrigin`, les NEUF tests
    // scellés du 66 et du 66b restent VERTS et `{ provenance: 'production' }` compile — une source
    // animale dont on ne sait pas de quel animal elle vient.
    const { code, sortie } = compiler('tsconfig.refuse-origine-absente.json')

    expect(code, `tsc a ACCEPTÉ une provenance sans origine. Sortie :\n${sortie}`).not.toBe(0)
    expect(sortie).toContain('sonde-origine-absente.ts')

    // Le refus porte sur la PROPRIÉTÉ MANQUANTE, nommément — pas sur autre chose qui casserait.
    expect(sortie, "le refus ne porte pas sur une propriété manquante").toContain('TS2741')
    expect(sortie, "le refus ne nomme pas `origine`").toContain("Property 'origine' is missing")

    expect(
      diagnostics(sortie),
      `le projet doit produire UN SEUL diagnostic, sinon le refus peut venir d'ailleurs. Sortie :\n${sortie}`
    ).toHaveLength(1)
  }, 120_000)

  it("⛔ UNE ORIGINE `undefined` EST REFUSÉE — l'axe que le 66b ne connaissait pas", () => {
    // ⛔ CE N'EST PAS UN DOUBLON DE « ORIGINE NULLE ». Sous `exactOptionalPropertyTypes: true`,
    // `undefined` n'est ni `null` ni une clé absente : c'est un TROISIÈME axe. Avec
    // `origine: AnimalOrigin | undefined`, la sonde nulle reste refusée, la sonde absente reste
    // refusée — les deux gardes tiennent — et le trou passe entre elles. Mesuré : 9/9 verts.
    const { code, sortie } = compiler('tsconfig.refuse-origine-indefinie.json')

    expect(code, `tsc a ACCEPTÉ une origine indéfinie. Sortie :\n${sortie}`).not.toBe(0)
    expect(sortie).toContain('sonde-origine-indefinie.ts')
    expect(sortie, "le refus ne porte pas sur la valeur indéfinie").toContain(
      "Type 'undefined' is not assignable"
    )
    expect(sortie, "le refus ne porte pas sur le type de l'origine").toContain('AnimalOrigin')

    expect(
      diagnostics(sortie),
      `le projet doit produire UN SEUL diagnostic. Sortie :\n${sortie}`
    ).toHaveLength(1)
  }, 120_000)

  it('⛔ UNE PROVENANCE `undefined` EST REFUSÉE AUSSI — le jumeau, sur le même axe neuf', () => {
    // ⛔ LA LEÇON A DÉJÀ ÉTÉ PAYÉE TROIS FOIS ET ELLE SE REPAIE ICI : fermer un trou sur un champ
    // ne dit RIEN de son jumeau. Le §7 déclare la provenance close sur les deux axes qu'il
    // connaissait. Sur le troisième, elle était ouverte comme l'origine.
    const { code, sortie } = compiler('tsconfig.refuse-provenance-indefinie.json')

    expect(code, `tsc a ACCEPTÉ une provenance indéfinie. Sortie :\n${sortie}`).not.toBe(0)
    expect(sortie).toContain('sonde-provenance-indefinie.ts')
    expect(sortie, "le refus ne porte pas sur la valeur indéfinie").toContain(
      "Type 'undefined' is not assignable"
    )
    expect(sortie, "le refus ne porte pas sur le type de la provenance").toContain('AnimalProvenance')

    expect(
      diagnostics(sortie),
      `le projet doit produire UN SEUL diagnostic. Sortie :\n${sortie}`
    ).toHaveLength(1)
  }, 120_000)

  it('⛔ ET LA PAIRE COMPLÈTE COMPILE TOUJOURS — sans ça, tout ce qui précède est satisfait par le vide', () => {
    // Trois refus se satisfont parfaitement en rendant la paire carrément inexprimable : tous les
    // aliments à source animale partiraient avec, et les tests ci-dessus resteraient verts. Le
    // projet accepté appartient au lot 66 ; on le LIT, on ne le modifie pas.
    const { code, sortie } = compiler('tsconfig.accepte.json')
    expect(code, `tsc a REFUSÉ une sonde valide. Sortie :\n${sortie}`).toBe(0)
  }, 120_000)

  it("⛔ AUCUNE ASSERTION NEUVE NE FABRIQUE UNE PAIRE — la liste des sept est GELÉE", () => {
    // ⛔ CE TEST EXISTE PARCE QUE LES CINQ AUTRES NE PROUVENT PAS CE QU'ILS ONT L'AIR DE PROUVER.
    // Ils mesurent ce que `tsc` accepte d'un LITTÉRAL HONNÊTE. Une assertion court-circuite le
    // littéral : `{ provenance: 'corps' } as unknown as AnimalSource` compile aujourd'hui, et c'est
    // EXACTEMENT la case 4 que `sonde-origine-absente.ts` rend inexprimable. Le §4 nommait déjà ce
    // trou « connu » ; personne ne le surveillait.
    //
    // Ce que ce test achète : les sept assertions existantes sont assumées et FIGÉES. La huitième
    // fera rougir, et il faudra la justifier — pas la découvrir trois lots plus tard.
    //
    // ⚠️ CE QU'IL NE COUVRE PAS, ET IL FAUT QUE ÇA SOIT ÉCRIT : `satisfies`, une interface étendue
    // localement, un `JSON.parse` non typé, ou un champ tiers de `Food` qui reporterait
    // l'information à côté. **Une énumération qui se déclare exhaustive n'est jamais une preuve
    // d'exhaustivité** — c'est la leçon que ce lot a payée deux fois.
    const inventaire = scannerAssertions()

    expect(
      inventaire,
      "une assertion capable de fabriquer une paire a été ajoutée, déplacée ou retirée.\n" +
        "Si elle est légitime, ajoute-la ici EN L'EXPLIQUANT. Ne la retire pas du décompte en silence."
    ).toEqual(ASSERTIONS_GELEES)
  })

  it("⛔ ET `as any` RESTE À ZÉRO DANS `app/src`, `catalog` ET `tests` — la porte la plus large", () => {
    // Relevé le 2026-08-17 : ces trois racines n'en contiennent AUCUN. C'est un fait rare et il se
    // garde gratuitement — zéro liste blanche à maintenir. `origineAnimale: {} as any` contournerait
    // les six cases d'un coup, sans qu'aucune sonde ne bronche.
    //
    // ⛔ CE TITRE A DIT « DANS TOUT LE DÉPÔT », ET C'ÉTAIT FAUX — corrigé APRÈS le sceau, sur
    // décision explicite de l'auteur (2026-08-17), livraison `e552ca1`. Le scanner n'a JAMAIS
    // parcouru que les trois racines nommées ci-dessus : `atelier/`, `vite.config.ts`,
    // `vitest.config.ts`, `.claude/*.mjs` et la racine du dépôt lui échappent, pour les trois
    // gardes du gel. Le libellé promettait une couverture que le code n'a jamais eue.
    //
    // ⚠️ SEULS LE TITRE ET LE MESSAGE ONT CHANGÉ. L'assertion, le motif et les racines scannées
    // sont identiques au caractère près : le pouvoir de détection est le même qu'au sceau, et le
    // relevé de discrimination reste valide. On corrige un mensonge, pas une mesure.
    //
    // ⚠️ Ce que ça ne répare pas : la couverture. Élargir les racines reste à faire, et ce serait
    // un autre lot. ▶ `ETAT.md` §8.
    expect(
      scannerMotif(/\bas\s+any\b/g),
      "un `as any` est apparu dans `app/src`, `catalog` ou `tests`. Il contourne l'invariant " +
        "origine/provenance en entier, et tout le reste avec. ⚠️ Hors de ces trois racines, ce test " +
        'ne voit rien — voir la 3ᵉ limite du §8.'
    ).toEqual({})
  })

  it('⛔ ET AUCUNE DIRECTIVE NE BÂILLONNE LES SONDES — la garde que le lot 66 demandait en prose', () => {
    // `66.test.ts` porte en en-tête : « NE PAS REMPLACER LES SONDES PAR `@ts-expect-error` ». C'était
    // une phrase. Une directive posée dans une sonde supprimerait le diagnostic que le test lit, et
    // le test resterait vert sur un dossier devenu muet. La phrase devient exécutable.
    // ⛔ `true` = on lit AUSSI les commentaires, et c'est indispensable : une directive n'existe
    // QUE dans un commentaire. Sans ce drapeau, ce test était vert par construction et le serait
    // resté pour toujours. Mesuré : la version sans drapeau ne rougit pas quand on pose le bâillon.
    const bavardes = Object.keys(scannerMotif(/@ts-(?:ignore|expect-error)/g, true))
      .filter((f) => f.startsWith('tests/scelles/sondes-66/'))

    expect(bavardes, 'une directive de suppression a été posée dans une sonde').toEqual([])
  })

  it("⛔ LES SONDES RESTENT HORS DE `npm run typecheck` — et ce lot triple l'enjeu", () => {
    // Le dossier passe de 2 à 5 fichiers écrits pour NE PAS compiler. Si l'exclusion saute, une des
    // quatre commandes qui font foi devient rouge en permanence, et la seule façon de la reverdir
    // est de défaire le lot. Aucun test ne surveillait ça ; le lot qui aggrave le risque le pose.
    const racine = JSON.parse(readFileSync(join(RACINE, 'tsconfig.json'), 'utf8')) as {
      exclude?: readonly string[]
    }
    expect(
      racine.exclude ?? [],
      "`tsconfig.json` à la racine ne doit JAMAIS ramasser les sondes : l'une d'elles est écrite pour échouer"
    ).toContain('tests/scelles/sondes-66')
  })
})
