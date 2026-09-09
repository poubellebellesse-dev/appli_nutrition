// @vitest-environment jsdom
//
// tests/scelles/retour-5d.test.tsx — l'examen du lot `retour-5d` : une clause scellée mesurait
// l'HEURE de la machine, et personne ne le savait.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. `retour-1.test.tsx` monte « Aujourd'hui » sans
// toucher au sélecteur de créneau ; l'écran déduit alors son repas de `new Date().getHours()`
// (`aujourdhui.tsx:246`), et `FIN_DE_CRENEAU.dejeuner` vaut 14. La clause « 6 froides sur 10 »
// rendait donc 12/12 avant 14 h et 7/12 après — la même suite, le même arbre, le même catalogue.
//
// ⚠️ CET ÉCART-LÀ EST REFERMÉ DEPUIS `retour-5e` (2026-09-09, 17 h 24) : le dîner porte maintenant
// 44 recettes froides sur 250 au lieu de 8 sur 214, et la clause rend 12/12 aux deux heures. ⛔ LA
// CAUSE, ELLE, N'EST PAS RÉPARÉE — `retour-1` lit toujours l'horloge, il est simplement devenu
// vert par abondance. C'est exactement pour ça que ce lot existe : un capteur qui a cessé de
// rougir sans qu'on l'ait corrigé est plus dangereux qu'un capteur rouge.
//
// ---------------------------------------------------------------------------------------------
// CE QU'IL GARDE, ET COMMENT IL SE DÉFEND
//
// ⛔ LES PLANCHERS SONT MESURÉS ICI, PAS SEULEMENT EXIGÉS AILLEURS. Ce fichier collecte lui-même
// les listes aux deux créneaux et les confronte au catalogue par SQL DIRECT — le même chemin
// indépendant que `retour-1` s'impose. Si `retour-1` dérivait un jour vers un seul créneau, le
// capteur du dîner vivrait encore ici.
//
// ⛔ ON LIT LE SOURCE DE `retour-1.test.tsx`, COMMENTAIRES RETIRÉS. C'est un lot qui ne livre
// qu'une réécriture de test : il n'y a rien d'autre à observer. Les commentaires sont effacés
// avant lecture, sinon une phrase suffirait à satisfaire chaque clause. ⚠️ Ce n'est PAS la
// pratique interdite par l'en-tête de `retour-1` (« pas d'expression régulière sur
// `aujourdhui.tsx` ») : on ne lit pas le code de PRODUCTION, on lit le test qui est l'objet du lot.
//
// ---------------------------------------------------------------------------------------------
// TROIS IMPLÉMENTATIONS FAUSSES, ET LES CLAUSES QUI LES TUENT
//
// ⛔ FAUSSE N°1 — ÉPINGLER « CE MIDI » PARTOUT. Une ligne, l'arbre vert, et le seul cas dont
// l'utilisateur s'est plaint sur son téléphone sort de la suite. ▶ Tuée par « les deux créneaux » :
// la clause « Froid » doit exister sous « Ce midi » ET sous « Ce soir ».
//
// ⛔ FAUSSE N°2 — DESCENDRE LE PLANCHER À ZÉRO, OU LE RETIRER. Le titre continuerait d'annoncer
// une proportion que plus rien ne vérifie. ▶ Tuée par « les planchers écrits sont ceux qu'on
// mesure » : les deux nombres sont extraits du source de `retour-1` et confrontés à la mesure
// refaite ici, à 0,9 aux DEUX repas.
//
// ⚠️ CE NOMBRE A CHANGÉ APRÈS LE SCEAU, ET C'EST LE BRIEF QUI LE DEMANDAIT : sa clause 3 écrivait
// « un plancher À RE-MESURER APRÈS `retour-5e` ». Le fichier a été scellé à 0,5 pour le soir, sur
// la mesure de 7/12 prise AVANT que `retour-5e` (livré le même jour à 17 h 24) rende au dîner les
// 36 recettes froides que `types_repas` en barrait. Re-mesuré ensuite : 12/12 aux deux créneaux.
// 0,5 aurait scellé une lacune de catalogue comme une norme. ▶ 0,9 validé par l'auteur le
// 2026-09-09, sceau levé pour ça.
//
// ⛔ FAUSSE N°3 — CLIQUER UN BOUTON QUI N'EST PAS LA PASTILLE. Le titre de l'écran porte le MÊME
// texte que la pastille (« Ce soir » deux fois dans le DOM) : viser par le texte seul attrape le
// titre, ne change rien, et laisse l'horloge décider en silence. ▶ Tuée par l'exigence de
// `aria-pressed`, l'idiome que `retour-3.test.tsx:271` a déjà payé.
//
// ⚠️ DEUX FAMILLES DE CLAUSES SONT VERTES AUJOURD'HUI, ET C'EST VOULU : le témoin de la cause
// (l'écran CHANGE de créneau entre 12 h et 20 h) et les planchers par créneau. Elles n'existent
// pas pour rougir maintenant — la première rougira le jour où la cause changera, ce qui doit se
// voir ; la seconde rougira si le classement d'envie se dégrade encore.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeRythme } from '../../app/src/data/user-store.js'
import {
  baseCourante,
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../../app/src/ui/test-socle.js'

vi.mock('../../app/src/ui/catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../../app/src/ui/user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
  octetsDeLaBase: vi.fn(),
  remplacerLeFichier: vi.fn(),
  verifierSauvegarde: vi.fn(),
}))

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CATALOGUE = path.join(RACINE, 'app', 'public', 'catalog', 'catalog.db')
const RETOUR_1 = path.join(RACINE, 'tests', 'scelles', 'retour-1.test.tsx')

/** Les deux repas du rythme à 2 repas/jour, tels que le sélecteur les intitule. */
const CE_MIDI = 'Ce midi'
const CE_SOIR = 'Ce soir'

function ouvrirCatalogue(): DatabaseSync {
  return new DatabaseSync(CATALOGUE, { readOnly: true })
}

/** L'axe chaud/froid d'un plat désigné PAR SON NOM AFFICHÉ. Échoue si le nom n'est pas unique. */
function axeDuPlat(db: DatabaseSync, nom: string): number {
  const lignes = db
    .prepare('SELECT axe_chaud_froid AS v FROM recipe WHERE nom = ?')
    .all(nom) as { v: number }[]
  if (lignes.length !== 1) {
    throw new Error(`« ${nom} » : ${lignes.length} recette(s) de ce nom au catalogue, il en faut 1`)
  }
  return lignes[0]!.v
}

/** Moyenne de l'axe sur une liste, et combien de plats tombent du côté demandé. */
function verdict(
  db: DatabaseSync,
  plats: readonly string[],
  cote: 1 | -1
): { readonly moyenne: number; readonly bonCote: number; readonly sur: number } {
  const valeurs = plats.map((nom) => axeDuPlat(db, nom))
  return {
    moyenne: valeurs.reduce((a, b) => a + b, 0) / valeurs.length,
    bonCote: valeurs.filter((v) => (cote === 1 ? v > 0 : v < 0)).length,
    sur: valeurs.length,
  }
}

// ------------------------------------------------------------------------------------------
// L'écran
// ------------------------------------------------------------------------------------------

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  writeRythme(baseCourante(), { repasParJour: 2, tempsSemaineMin: null, tempsWeekendMin: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/**
 * Fige l'horloge à une heure donnée du 2026-09-09.
 *
 * ⚠️ SEUL `Date` EST SIMULÉ. Feindre les minuteries casserait `await` et le rendu de React ; ici
 * on ne veut qu'une chose, que `new Date().getHours()` réponde ce qu'on lui dit.
 *
 * ⛔ PIÈGE PAYÉ EN ÉCRIVANT CE FICHIER, ET C'EST LE TÉMOIN DE LA CAUSE QUI L'A ATTRAPÉ. Passer
 * `now:` à un DEUXIÈME `useFakeTimers()` dans le même `it` ne déplace pas l'horloge : elle est
 * déjà simulée, et l'option est ignorée. Les deux montages tournaient donc à la même heure, et la
 * clause « la même liste à 9 h et à 20 h » passait sans rien comparer. `setSystemTime` déplace,
 * lui, une horloge déjà simulée.
 */
function figerAHeure(heure: number): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 9, heure, 30, 0))
}

async function monter(): Promise<void> {
  const { Aujourdhui } = await import('../../app/src/ui/screens/aujourdhui.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Aujourdhui />
    </ProvenanceLancerParcours>
  )
  await screen.findByText(/sur \d+$/)
}

const platAffiche = (): string => document.querySelector('article h2')!.textContent!
const titreAffiche = (): string => document.querySelector('h1')!.textContent!
const compteur = (): string => screen.getByText(/^\d+ sur \d+$/).textContent!
const tailleListe = (): number => Number(compteur().split(' sur ')[1])
const bouton = (texte: string | RegExp) =>
  screen.getByText(texte).closest('button') as HTMLButtonElement
const encart = () => screen.queryByText(/Rien n'est obligatoire/)

async function laisserRecalculer(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

/**
 * Clique la pastille du créneau demandé.
 *
 * ⛔ ON VISE `aria-pressed`, PAS LE TEXTE. Le titre de l'écran porte le même libellé que la
 * pastille ; `getByText` en trouve deux et `getAllByText(...)[0]` attrape le titre, qui n'est pas
 * un bouton. C'est exactement la fausse implémentation n°3 de l'en-tête.
 */
async function epingler(titre: string): Promise<void> {
  const pastille = screen
    .queryAllByText(titre)
    .map((n) => n.closest('button'))
    .find((b) => b !== null && b.hasAttribute('aria-pressed'))
  if (pastille === undefined || pastille === null) {
    expect.fail(`la pastille de créneau « ${titre} » est absente de l'écran`)
  }
  fireEvent.click(pastille)
  await screen.findByText(/sur \d+$/)
  await laisserRecalculer()
}

async function ouvrirEncart(): Promise<void> {
  const plafond = tailleListe() * 2
  for (let i = 0; i < plafond && encart() === null; i++) fireEvent.click(bouton(/Suivant/))
  await screen.findByText(/Rien n'est obligatoire/)
}

/** Tous les plats de la liste courante, dans l'ordre du classement, depuis la première carte. */
function collecterListe(): readonly string[] {
  const plafond = tailleListe() * 2
  for (let g = 0; g < plafond && !bouton(/Précédent/).disabled; g++) {
    fireEvent.click(bouton(/Précédent/))
  }
  const n = tailleListe()
  const plats: string[] = [platAffiche()]
  for (let i = 1; i < n; i++) {
    fireEvent.click(bouton(/Suivant/))
    plats.push(platAffiche())
  }
  return plats
}

/** La liste offerte sous une pastille d'envie, à l'heure dite, CRÉNEAU ÉPINGLÉ. */
async function listeEpinglee(
  envie: string,
  creneau: string,
  heure: number
): Promise<{ readonly titre: string; readonly plats: readonly string[] }> {
  figerAHeure(heure)
  await monter()
  await epingler(creneau)
  const titre = titreAffiche()
  await ouvrirEncart()
  fireEvent.click(bouton(envie))
  fireEvent.click(bouton('Masquer'))
  await laisserRecalculer()
  return { titre, plats: collecterListe() }
}

/**
 * La même chose SANS toucher au sélecteur — c'est-à-dire ce que `retour-1` fait aujourd'hui.
 *
 * ⛔ CE CHEMIN EXISTE POUR LE TÉMOIN DE LA CAUSE, ET POUR RIEN D'AUTRE. Il ne doit servir à
 * aucune clause de plancher : une mesure prise sans nommer son créneau ne dit pas ce qu'elle croit.
 */
async function listeSansEpingle(
  envie: string,
  heure: number
): Promise<{ readonly titre: string; readonly plats: readonly string[] }> {
  figerAHeure(heure)
  await monter()
  const titre = titreAffiche()
  await ouvrirEncart()
  fireEvent.click(bouton(envie))
  fireEvent.click(bouton('Masquer'))
  await laisserRecalculer()
  return { titre, plats: collecterListe() }
}

// ------------------------------------------------------------------------------------------
// CLAUSE 6 — la cause, sous témoin (VERTE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-5d — la clause mesurait l’heure (témoin de la décision 82)', () => {
  it('sans épinglage, l’écran change de repas entre 12 h et 20 h — titres ET listes', async () => {
    const midi = await listeSansEpingle('Froid', 12)
    cleanup()
    const soir = await listeSansEpingle('Froid', 20)

    expect(midi.titre, 'à 12 h, deux repas par jour : le déjeuner').toBe(CE_MIDI)
    expect(soir.titre, 'à 20 h : le dîner').toBe(CE_SOIR)
    expect(
      soir.plats,
      'si les deux listes devenaient identiques, la cause de la décision 82 aurait changé'
    ).not.toEqual(midi.plats)
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 5 — épingler suffit : l'écran devient sourd à l'heure (VERTE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-5d — un créneau épinglé rend l’écran sourd à l’heure', () => {
  it.each([CE_MIDI, CE_SOIR])(
    '« %s » épinglé : la même liste à 9 h et à 20 h, et le titre suit la pastille',
    async (creneau) => {
      const matin = await listeEpinglee('Froid', creneau, 9)
      cleanup()
      const soir = await listeEpinglee('Froid', creneau, 20)

      expect(matin.titre, 'le titre doit nommer le créneau épinglé, pas celui de l’horloge').toBe(
        creneau
      )
      expect(soir.titre).toBe(creneau)
      expect(
        soir.plats,
        `« ${creneau} » épinglé, l’heure ne doit plus rien changer à la liste`
      ).toEqual(matin.plats)
    }
  )

  it('les deux créneaux ne rendent PAS la même liste — l’épingle mord', async () => {
    const midi = await listeEpinglee('Froid', CE_MIDI, 9)
    cleanup()
    const soir = await listeEpinglee('Froid', CE_SOIR, 9)
    expect(
      soir.plats,
      'si épingler ne changeait rien, la clause 5 serait vraie sans rien garder'
    ).not.toEqual(midi.plats)
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 3 — les planchers, créneau par créneau (VERTS aujourd'hui, mesurés le 2026-09-09)
// ------------------------------------------------------------------------------------------

/**
 * Ce que la pastille « Froid » doit rendre à chaque repas.
 *
 * ⚠️ UN SEUL NOMBRE POUR LES DEUX REPAS, ET C'EST UN RÉSULTAT, PAS UNE SYMÉTRIE DE FORME. La
 * première version de cette constante portait 0,5 au dîner, sur le relevé de **7/12** pris le
 * matin du 2026-09-09. Ce 7/12 mesurait un RAYON VIDE : le dîner ne portait que 8 recettes froides
 * sur 214 (3,7 %), et le moteur en remontait 7. `retour-5e`, livré le même jour à 17 h 24, y a fait
 * entrer les 36 froides que `types_repas` en barrait → **250 recettes, 44 froides (17,6 %)**, la
 * même densité qu'au déjeuner (44 sur 194). Re-mesuré après : **12/12 froides aux DEUX créneaux.**
 * ⚠️ 0,9 ET NON 1,0 : un plancher au ras de sa mesure rougit au premier plat chaud qui entre dans
 * la liste. La marge est d'un plat sur dix — la même que celle de « Chaud », et la même que celle
 * que le 0,6 d'août prenait sous son 8/12.
 * ⛔ CE PLANCHER NE MESURE PAS QUE LE MOTEUR, et il faut le savoir en le lisant : une proportion
 * dépend du stock du rayon autant que du classement. C'est ce qui l'a fait rougir deux semaines
 * pour une cause qui n'était pas la sienne, puis virer au vert sans qu'une ligne de moteur bouge.
 * La décision ~~71~~ (les filtres RETIRENT) le rendra structurel plutôt que statistique — c'est
 * `retour-6`, débloqué par la décision ~~79~~ le 2026-09-09, pas ce lot.
 */
const PLANCHER_FROID: Readonly<Record<string, number>> = { [CE_MIDI]: 0.9, [CE_SOIR]: 0.9 }
/** Le seuil de « Chaud », inchangé depuis le 2026-08-21 : mesuré 12/12 aux DEUX créneaux. */
const PLANCHER_CHAUD = 0.9
/** Taille minimale de la liste offerte, comme `retour-1` : l'écran en propose 12. */
const PROPOSITIONS_MINIMUM = 10

describe('retour-5d — ce que chaque repas rend sous « Froid » et sous « Chaud »', () => {
  it.each([CE_MIDI, CE_SOIR])('« Froid » à « %s » : une liste froide, et son plancher', async (creneau) => {
    const { plats } = await listeEpinglee('Froid', creneau, 9)
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, -1)
      console.log(
        `[MESURE] Froid / ${creneau} → moyenne ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} froides`
      )
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne, `« ${creneau} » : la liste doit pencher du côté froid`).toBeLessThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(PLANCHER_FROID[creneau]!)
    } finally {
      db.close()
    }
  })

  it.each([CE_MIDI, CE_SOIR])('« Chaud » à « %s » tient le seuil scellé de 0,9', async (creneau) => {
    const { plats } = await listeEpinglee('Chaud', creneau, 9)
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 1)
      console.log(
        `[MESURE] Chaud / ${creneau} → moyenne ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} chaudes`
      )
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeGreaterThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(PLANCHER_CHAUD)
    } finally {
      db.close()
    }
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSES 1, 2, 3-écrits et 4 — ce que `retour-1.test.tsx` doit devenir (ROUGES aujourd'hui)
// ------------------------------------------------------------------------------------------

const BLOCS_DE_COMMENTAIRE = /\/\*[\s\S]*?\*\//g
const FIN_DE_LIGNE = /\/\/.*$/

/**
 * Le source de `retour-1.test.tsx`, COMMENTAIRES RETIRÉS.
 *
 * ⛔ SANS CETTE COUPE, CHAQUE CLAUSE CI-DESSOUS SE SATISFAIT D'UNE PHRASE. Écrire « on épingle
 * bien le créneau, voir aria-pressed » dans un commentaire suffirait. Les blocs sont remplacés par
 * des espaces, pas supprimés : les numéros de ligne restent lisibles dans un message d'échec.
 */
function codeDeRetour1(): string {
  return readFileSync(RETOUR_1, 'utf8')
    .replace(BLOCS_DE_COMMENTAIRE, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(FIN_DE_LIGNE, ''))
    .join('\n')
}

/** Les `it(` du fichier, découpés : titre + corps, pour lire un seuil DANS sa clause. */
function clausesDe(code: string): readonly { readonly titre: string; readonly corps: string }[] {
  const morceaux = code.split(/\n\s*it(?:\.each\([^)]*\))?\(\s*/)
  return morceaux.slice(1).map((corps) => {
    const titre = /^(['"`])([\s\S]*?)\1/.exec(corps)
    return { titre: titre?.[2] ?? '', corps }
  })
}

describe('retour-5d — `retour-1.test.tsx` nomme son repas (ROUGE aujourd’hui)', () => {
  it('ne monte plus jamais l’écran sans dire quel repas il regarde', () => {
    const code = codeDeRetour1()
    const nus = [...code.matchAll(/\bmonter\(\s*\)/g)]
    expect(
      nus.length,
      'chaque montage de « Aujourd’hui » doit recevoir son créneau : `monter()` sans argument' +
        ' laisse `new Date().getHours()` décider, et la clause mesure alors l’heure.'
    ).toBe(0)
  })

  it('vise la pastille par son `aria-pressed`, jamais par son seul texte', () => {
    const code = codeDeRetour1()
    expect(
      /aria-pressed/.test(code),
      'le titre de l’écran porte le MÊME libellé que la pastille : viser le texte seul attrape le' +
        ' titre, ne change rien, et laisse l’horloge décider en silence (fausse n°3).'
    ).toBe(true)
    expect(/fireEvent\.click\(/.test(code)).toBe(true)
  })

  it('examine « Froid » aux DEUX repas, pas au plus favorable', () => {
    const clauses = clausesDe(codeDeRetour1())
    const froid = clauses.filter((c) => /Froid/.test(c.titre))
    const midi = froid.filter((c) => c.titre.includes(CE_MIDI))
    const soir = froid.filter((c) => c.titre.includes(CE_SOIR))
    const pourquoi =
      'épingler « Ce midi » partout rend l’arbre vert en une ligne et retire de la suite le seul' +
      ' cas dont l’utilisateur s’est plaint : le dîner. Il est vert aujourd’hui — 12/12 froides —' +
      ' mais il l’est depuis `retour-5e` seulement, et par ABONDANCE du rayon, pas par correction' +
      ' du classement. Les deux repas doivent porter leur propre clause, et le dire dans leur titre.'
    expect(midi.length, pourquoi).toBe(1)
    expect(soir.length, pourquoi).toBe(1)
  })

  it('écrit les deux planchers, et ce sont ceux que ce fichier mesure', () => {
    const clauses = clausesDe(codeDeRetour1())
    for (const creneau of [CE_MIDI, CE_SOIR]) {
      const clause = clauses.find((c) => /Froid/.test(c.titre) && c.titre.includes(creneau))
      if (clause === undefined) expect.fail(`aucune clause « Froid » pour « ${creneau} »`)
      expect(
        /toBeLessThan\(0\)/.test(clause.corps),
        `« ${creneau} » : la moyenne froide reste exigée`
      ).toBe(true)
      const seuils = [...clause.corps.matchAll(/toBeGreaterThanOrEqual\(([\d.]+)\)/g)].map((m) =>
        Number(m[1])
      )
      expect(
        seuils,
        `« ${creneau} » : le plancher de proportion doit valoir ${PLANCHER_FROID[creneau]!} —` +
          ' un plancher retiré ou descendu laisse le titre annoncer ce que plus rien ne vérifie.'
      ).toContain(PLANCHER_FROID[creneau]!)
    }
  })

  it('n’a rien déplacé d’autre : la convention du catalogue et le seuil de « Chaud » tiennent', () => {
    const code = codeDeRetour1()
    expect(
      /froides:\s*84[\s\S]{0,60}neutres:\s*1[\s\S]{0,60}chaudes:\s*254[\s\S]{0,60}total:\s*339/.test(
        code
      ),
      'CONVENTION_DU_CATALOGUE interdit la correction par retournement des DONNÉES : elle ne bouge pas'
    ).toBe(true)
    const chaud = clausesDe(code).filter((c) => /Chaud/.test(c.titre))
    expect(chaud.length, '« Chaud » doit être examiné aux deux repas lui aussi').toBeGreaterThanOrEqual(
      2
    )
    for (const clause of chaud) {
      const seuils = [...clause.corps.matchAll(/toBeGreaterThanOrEqual\(([\d.]+)\)/g)].map((m) =>
        Number(m[1])
      )
      expect(seuils, `« ${clause.titre} » : le seuil de 0,9 ne bouge pas`).toContain(PLANCHER_CHAUD)
    }
  })

  it('n’a éteint aucun capteur : ni `.skip`, ni `.only`, ni `.todo`, et pas moins de clauses', () => {
    const code = codeDeRetour1()
    expect(/\b(it|describe)\.(skip|only|todo)\b/.test(code), 'aucun capteur mis en veille').toBe(
      false
    )
    // 9 `it(` avant le lot ; « Froid » et « Chaud » se dédoublent par créneau, donc 11 au moins.
    expect(clausesDe(code).length, 'le fichier ne perd aucune clause en chemin').toBeGreaterThanOrEqual(
      11
    )
    for (const attendu of ['Léger', 'Salé', 'renouvelle']) {
      expect(
        clausesDe(code).some((c) => c.titre.includes(attendu)),
        `la clause « ${attendu} » doit survivre au lot`
      ).toBe(true)
    }
  })
})
