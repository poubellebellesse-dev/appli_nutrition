// ⛔ TEST SCELLÉ — LOT 66b. Écrit depuis le « Fini quand » seul, avant toute autre ligne.
//    Document : docs/CONCEPTION_INVARIANT_ORIGINE_ANIMALE.md §7.
//
// ⚠️ CE FICHIER N'EST PAS UN TEST D'ACCEPTATION, ET IL PASSE DÈS LE PREMIER ESSAI. C'est la seule
// entorse à la règle « un test scellé doit échouer le jour où on l'écrit », et elle est assumée :
// le lot 66b ne change AUCUNE ligne de code de production. Le type livré est déjà juste. Ce qu'on
// achète ici n'est pas une correction, c'est **l'impossibilité de la défaire en silence**.
//
// Un test d'acceptation qui passe avant que le code existe ne prouve rien — c'est pourquoi la règle
// existe. Un garde-fou de régression qui passe tout de suite prouve exactement ce qu'il annonce :
// que l'état qu'il surveille est bon MAINTENANT. Les deux sondes ajoutées à la troisième relecture
// du lot 66 sont de la même famille, et leur README le dit déjà.
//
// ⛔ POURQUOI UN FICHIER SÉPARÉ DE `66.test.ts` : celui-là est SCELLÉ et clos. Y ajouter un test,
// ou ajouter un fichier à l'un de ses trois projets de compilation, changerait ce qu'un test scellé
// mesure. On ajoute à côté ; on ne retouche pas un examen déjà passé.
//
// ⚠️ UN PROJET DE COMPILATION PAR SONDE, ET C'EST L'INVERSE DU CHOIX DU LOT 66 — pour une raison
// opposée, pas par inadvertance. Le 66 groupe deux sondes dans `tsconfig.refuse-neuve.json` parce
// que son test exige que les DEUX noms apparaissent dans la sortie. Ici les assertions lisent le
// TEXTE du diagnostic ; avec deux sondes dans un même projet, rien ne garantirait que « le fichier »,
// « la valeur rejetée » et « le type qui la rejette » viennent de la MÊME erreur. Une sonde, un
// projet, une erreur — l'assertion ne peut pas être satisfaite par coïncidence.

import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
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

describe('lot 66b — la provenance ne peut pas être présente ET nulle', () => {
  it('⛔ UNE PROVENANCE NULLE EST REFUSÉE, ET LE REFUS PORTE SUR LA VALEUR, PAS SUR LA CLÉ', () => {
    // Le trou que les six tests scellés du 66 ne voient pas : ils mesurent tous la PRÉSENCE de la
    // clé, jamais sa VALEUR. TypeScript exige une clé requise même quand son type inclut `null`,
    // donc `provenance: AnimalProvenance | null` les laisserait TOUS les six verts.
    const { code, sortie } = compiler('tsconfig.refuse-nullable.json')

    expect(code, `tsc a ACCEPTÉ une provenance nulle. Sortie :\n${sortie}`).not.toBe(0)

    // La sonde, nommément. Un refus venu d'ailleurs ne prouverait rien.
    expect(sortie).toContain('sonde-provenance-nulle.ts')

    // ⛔ ET LA RAISON EXACTE, EN DEUX MORCEAUX. Une faute de frappe dans la sonde, un import cassé
    // ou un `any` posé sur le chemin refuseraient aussi — et laisseraient le trou grand ouvert.
    // On lit que c'est `null` qui est rejeté, et qu'il est rejeté PAR le type de la provenance.
    expect(sortie, "le refus ne porte pas sur la valeur nulle").toContain(
      "Type 'null' is not assignable"
    )
    expect(sortie, "le refus ne porte pas sur le type de la provenance").toContain(
      'AnimalProvenance'
    )
  }, 120_000)

  it('⛔ UNE ORIGINE NULLE EST REFUSÉE AUSSI — la moitié symétrique, qui a failli être oubliée', () => {
    // ⛔ AJOUTÉ APRÈS L'ATTAQUE DU BRIEF, ET C'EST LE TROU LE PLUS INSTRUCTIF DES DEUX.
    // Le lot 66b ne portait d'abord que la provenance. Une relecture indépendante a demandé « reste-
    // t-il une quatrième façon de rouvrir le trou ? » — et il en restait une, exactement symétrique :
    //
    //     readonly origine: AnimalOrigin | null
    //
    // ⚠️ MESURÉ, PAS DÉDUIT : avec ce type posé dans `catalog.ts`, les HUIT tests d'alors — les six
    // scellés du 66 et les deux premiers d'ici — sont restés VERTS, pendant que
    // `{ origine: null, provenance: 'corps' }` redevenait écrivable partout. Les six sondes
    // exerçaient la clé `provenance` et la forme entière, jamais la VALEUR de `origine`.
    //
    // ⛔ LA LEÇON DÉPASSE CE LOT : fermer un trou sur un champ ne dit rien de son jumeau. Une paire
    // se teste des DEUX côtés, ou elle n'est testée qu'à moitié.
    const { code, sortie } = compiler('tsconfig.refuse-origine-nulle.json')

    expect(code, `tsc a ACCEPTÉ une origine nulle. Sortie :\n${sortie}`).not.toBe(0)
    expect(sortie).toContain('sonde-origine-nulle.ts')
    expect(sortie, "le refus ne porte pas sur la valeur nulle").toContain(
      "Type 'null' is not assignable"
    )
    expect(sortie, "le refus ne porte pas sur le type de l'origine").toContain('AnimalOrigin')
  }, 120_000)

  it('⛔ ET LA PAIRE COMPLÈTE COMPILE TOUJOURS — ce test ne s’appuie sur aucun voisin', () => {
    // ⚠️ LA LEÇON EST ÉCRITE DANS `66.test.ts` ET ELLE S'APPLIQUE ICI AUSSI : « un test scellé qui
    // compte sur son voisin pour discriminer ne discrimine pas ». Sans cette moitié, le critère se
    // satisfait en rendant la provenance carrément inexprimable — la sonde nulle serait refusée, et
    // les aliments animaux avec elle. Le projet accepté appartient au lot 66 ; on le LIT, on ne le
    // modifie pas.
    const { code, sortie } = compiler('tsconfig.accepte.json')
    expect(code, `tsc a REFUSÉ une sonde valide. Sortie :\n${sortie}`).toBe(0)
  }, 120_000)
})
