// @vitest-environment jsdom
//
// tests/scelles/retour-1.test.tsx — l'examen du lot `retour-1` : ce que la pastille DEMANDE
// vraiment au moteur, et OÙ la correction a le droit d'atterrir.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. `ui/screens/aujourdhui.tsx:95` déclare
// `{ cle: 'chaudFroid', bas: 'Chaud', haut: 'Froid' }` et la ligne 728 envoie −1 pour `bas` : la
// pastille « Chaud » demande donc `chaudFroid = −1`, c'est-à-dire FROID. Le catalogue est formel
// (`domain/catalog.ts:352-357` : « -1 (froid) … +1 (chaud) ») et le banc du dépôt aussi
// (`cli/try-engine.ts:89-90` : `chaud → +1`). L'écran est le seul des trois à dire l'inverse.
//
// ---------------------------------------------------------------------------------------------
// CE QU'IL GARDE, ET COMMENT IL SE DÉFEND
//
// ⛔ ON LIT LE CATALOGUE PAR SQL DIRECT, JAMAIS PAR LE CHARGEUR QUE L'ÉCRAN UTILISE. Si la
// correction consistait à retourner la convention des DONNÉES au lieu de celle de l'écran, un test
// qui relit par le même chemin ne verrait rien : les deux erreurs s'annuleraient. D'où
// `CONVENTION_DU_CATALOGUE`, qui fige les comptes mesurés — 84 froides, 254 chaudes, 1 neutre.
//
// ⛔ ON NE LIT PAS LE SOURCE DU FICHIER. Pas d'expression régulière sur `aujourdhui.tsx` : un
// `critique` a déjà fait passer le sceau du lot E en ajoutant un `import` jamais appelé.
//
// ⚠️ LES CLAUSES DES AXES `legerConsistant` ET `sucreSale` SONT VERTES AUJOURD'HUI, ET C'EST VOULU.
// Ces deux axes-là sont branchés dans le bon sens. Elles n'existent pas pour rougir maintenant,
// elles existent pour rougir si la correction déborde et retourne les trois d'un coup — la
// deuxième façon la plus probable de « réparer » ce défaut de travers.
//
// ---------------------------------------------------------------------------------------------
// TROIS IMPLÉMENTATIONS FAUSSES ONT ÉTÉ TROUVÉES LE 2026-08-21, ET TROIS CLAUSES LES TUENT
//
// ⚠️ LA TROISIÈME N'EST APPARUE QU'APRÈS CORRECTION DES DEUX PREMIÈRES. Un examen corrigé n'est pas
// un examen sûr : chaque clause ajoutée déplace la triche ailleurs. La n°3 est décrite au-dessus de
// l'interception du moteur, plus haut dans ce fichier.
//
// ⛔ FAUSSE N°1 — DEUX LISTES EN DUR, UNE PAR BRANCHE. « Une constante ne peut pas satisfaire Chaud
// ET Froid à la fois » était un raisonnement, pas une mesure : DEUX constantes le peuvent, douze
// recettes figées par pastille, et les quatre autres clauses restent vertes en passant par le vrai
// classement. ▶ Tuée par « renouvelle la liste sans cesser d'être chaude » : une table figée ne
// bouge pas quand la graine du tirage bouge.
//
// ⛔ FAUSSE N°2 — CORRIGER LE MOTEUR AU LIEU DE L'ÉCRAN. Inverser le signe du seul axe `chaudFroid`
// dans `scoring/craving.ts:44` fait passer toutes les clauses d'écran à l'identique — et casse
// SILENCIEUSEMENT `cli/try-engine.ts:89-90`, qui mappe déjà `chaud → +1` correctement. Le périmètre
// « ce lot ne touche pas `engine/` » était une phrase dans un document, que rien ne vérifiait.
// ▶ Tuée par le `describe` « le moteur note déjà dans le bon sens » : il appelle `scoreCraving`
// SANS écran, et rougit si quiconque touche à la couche.
//
// ⛔ CE FICHIER NE COUVRE PAS LA MOITIÉ VISUELLE DU LOT. Les réparations d'affichage (cases
// d'ustensile invisibles, voile du tutoriel, flèches du « Le saviez-vous », bouton de sortie du
// mode cuisine…) ne sont PAS observables en jsdom, qui ne calcule aucune mise en page. Leur
// vérification est une passe à l'œil sur le téléphone, dont le protocole est écrit dans
// `docs/CONCEPTION_RETOURS_TEST.md` §3. C'est le même prix que le lot 65c a payé.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DatabaseSync } from 'node:sqlite'
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

// ------------------------------------------------------------------------------------------
// L'OREILLE POSÉE SUR LE FIL ÉCRAN → MOTEUR.
//
// ⛔ TROISIÈME IMPLÉMENTATION FAUSSE, TROUVÉE LE 2026-08-21 : reclasser la liste APRÈS coup dans
// `calculerVue`, sur l'axe réel, sans toucher au signe envoyé. Toutes les clauses d'affichage
// passent — moyennes, proportions, graine, moteur intact — pendant que `context.envie.chaudFroid`
// reste faux, donc que la SÉLECTION des candidats et la diversification ont tourné à l'envers.
// Un tri d'après-coup ne réordonne que les douze plats déjà retenus par la mauvaise envie.
//
// ▶ D'où cette interception : on n'observe plus ce que l'écran MONTRE, on observe ce qu'il
// DEMANDE. Le vrai moteur tourne quand même — on ne fait qu'écouter au passage.
// ------------------------------------------------------------------------------------------

const observe = vi.hoisted(() => ({ requetes: [] as { context?: { envie?: Record<string, unknown> | null } }[] }))

vi.mock('../../app/src/engine/api/index.js', async (importOriginal) => {
  const vrai = await importOriginal<typeof import('../../app/src/engine/api/index.js')>()
  return {
    ...vrai,
    createEngine: (...args: Parameters<typeof vrai.createEngine>) => {
      const moteur = vrai.createEngine(...args)
      return {
        ...moteur,
        suggestMeals: (req: Parameters<typeof moteur.suggestMeals>[0]) => {
          observe.requetes.push(req as never)
          return moteur.suggestMeals(req)
        },
      }
    },
  }
})

// ------------------------------------------------------------------------------------------
// Le catalogue, lu par SQL — chemin INDÉPENDANT de celui de l'écran (voir l'en-tête).
// ------------------------------------------------------------------------------------------

const CATALOGUE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'app',
  'public',
  'catalog',
  'catalog.db'
)

/**
 * Comptes mesurés le 2026-08-21 sur `catalog.db` réel. Ils ne décorent pas : ils interdisent la
 * correction par retournement des DONNÉES, qui les ferait basculer.
 */
const CONVENTION_DU_CATALOGUE = { froides: 84, neutres: 1, chaudes: 254, total: 339 } as const

/**
 * Taille minimale de la liste que l'écran doit offrir. L'écran en propose 12 aujourd'hui ; la
 * clause en exige 10, pour ne pas rougir si `PROFONDEUR` bouge d'un cran. Le « Fini quand » du
 * document dit le même nombre — les deux ont divergé une fois, relevé par le critique le
 * 2026-08-21.
 */
const PROPOSITIONS_MINIMUM = 10

/**
 * Les deux repas de la journée, tels que l'écran les nomme sous `repasParJour: 2`.
 *
 * ⛔ AJOUTÉS PAR `retour-5d` (2026-09-09), ET C'EST TOUT L'OBJET DE CE LOT. Avant lui, aucune
 * clause de ce fichier ne disait quel repas elle mesurait : `Aujourdhui` déduisait son créneau de
 * `new Date().getHours()` (`aujourdhui.tsx:246`, bascule à 14 h — `FIN_DE_CRENEAU.dejeuner`), donc
 * la même clause rendait 12/12 froides à midi et 7/12 à 14 h. Elle mesurait l'heure de la machine.
 * ▶ Décision 82.
 */
const CE_MIDI = 'Ce midi'
const CE_SOIR = 'Ce soir'

/**
 * L'heure à laquelle ce fichier relève ses mesures.
 *
 * ⚠️ ELLE NE DEVRAIT PLUS RIEN CHANGER, et c'est justement pour ça qu'on la fige. Le créneau est
 * épinglé à la pastille dans chaque clause ; `retour-5d` prouve séparément qu'un créneau épinglé
 * rend l'écran sourd à l'horloge. Figer ici n'est donc pas la correction — c'est la ceinture :
 * si l'épingle cessait un jour de mordre, on ne veut pas que ce fichier redevienne silencieusement
 * une mesure de l'heure qu'il est. 9 h, comme `retour-5d`, pour que les deux relèvent la même chose.
 */
const HEURE_DU_RELEVE = 9

type Axe = 'axe_chaud_froid' | 'axe_leger_consistant' | 'axe_sucre_sale'

function ouvrirCatalogue(): DatabaseSync {
  return new DatabaseSync(CATALOGUE, { readOnly: true })
}

/** L'axe demandé, pour un plat désigné PAR SON NOM AFFICHÉ. Échoue si le nom n'est pas unique. */
function axeDuPlat(db: DatabaseSync, nom: string, axe: Axe): number {
  const lignes = db.prepare(`SELECT ${axe} AS v FROM recipe WHERE nom = ?`).all(nom) as { v: number }[]
  if (lignes.length !== 1) {
    throw new Error(`« ${nom} » : ${lignes.length} recette(s) de ce nom au catalogue, il en faut 1`)
  }
  return lignes[0]!.v
}

/** Le verdict d'un classement sur un axe : moyenne, et combien de plats tombent du bon côté. */
function verdict(
  db: DatabaseSync,
  plats: readonly string[],
  axe: Axe,
  cote: 1 | -1
): { readonly moyenne: number; readonly bonCote: number; readonly sur: number } {
  const valeurs = plats.map((nom) => axeDuPlat(db, nom, axe))
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length
  const bonCote = valeurs.filter((v) => (cote === 1 ? v > 0 : v < 0)).length
  return { moyenne, bonCote, sur: valeurs.length }
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
 */
function figerAHeure(heure: number): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 9, heure, 30, 0))
}

/**
 * Monte « Aujourd'hui » ET ÉPINGLE SON REPAS. Il n'existe pas de version sans créneau.
 *
 * ⛔ LE PARAMÈTRE EST OBLIGATOIRE, ET C'EST LA CORRECTION DU LOT `retour-5d`. Une signature à
 * argument facultatif rouvrirait exactement le trou : un appelant qui l'omet ne produit aucune
 * erreur — ni au type, ni au test, ni à l'écran — et sa clause se remet à mesurer l'heure sans que
 * personne ne le voie. C'est le piège « un champ déclaré n'est pas un champ branché », payé trois
 * fois sur ce dépôt.
 */
async function monter(creneau: string): Promise<void> {
  figerAHeure(HEURE_DU_RELEVE)
  const { Aujourdhui } = await import('../../app/src/ui/screens/aujourdhui.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Aujourdhui />
    </ProvenanceLancerParcours>
  )
  await screen.findByText(/sur \d+$/)
  await epingler(creneau)
}

/**
 * Clique la pastille du créneau demandé.
 *
 * ⛔ ON VISE `aria-pressed`, PAS LE TEXTE. Le titre de l'écran porte le MÊME libellé que la
 * pastille ; `getByText` en trouve deux et le premier est le titre, qui n'est pas un bouton —
 * cliquer dessus ne change rien et laisse l'horloge décider en silence. C'est la fausse
 * implémentation n°3 de l'en-tête, prise par un autre bout.
 */
async function epingler(creneau: string): Promise<void> {
  const pastille = screen
    .queryAllByText(creneau)
    .map((n) => n.closest('button'))
    .find((b) => b !== null && b.hasAttribute('aria-pressed'))
  if (pastille === undefined || pastille === null) {
    expect.fail(`la pastille de créneau « ${creneau} » est absente de l'écran`)
  }
  fireEvent.click(pastille)
  await screen.findByText(/sur \d+$/)
  await laisserRecalculer()
}

const platAffiche = (): string => document.querySelector('article h2')!.textContent!
const titreAffiche = (): string => document.querySelector('h1')!.textContent!
const compteur = (): string => screen.getByText(/^\d+ sur \d+$/).textContent!
const tailleListe = (): number => Number(compteur().split(' sur ')[1])
const bouton = (texte: string | RegExp) => screen.getByText(texte).closest('button') as HTMLButtonElement
const encart = () => screen.queryByText(/Rien n'est obligatoire/)

/**
 * Laisse React finir le recalcul de la liste.
 *
 * ⛔ PIÈGE PAYÉ EN ÉCRIVANT CE FICHIER. `calculerVue` est ASYNCHRONE (`await chargerSocle()`,
 * `aujourdhui.tsx:167`). Sans ce flush, on lit la liste d'AVANT la pastille : le premier jet
 * mesurait des listes IDENTIQUES sous « Léger » et « Consistant » et allait conclure à tort que
 * la pastille n'était branchée à rien.
 */
async function laisserRecalculer(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

/**
 * Ouvre l'encart d'aide en faisant défiler, comme un indécis.
 *
 * ⛔ PAS DE NOMBRE FIXE DE CLICS — même piège que `aujourdhui.test.tsx`, qui a fait rougir `main`
 * le 2026-08-07 : l'encart s'ouvre à la 11ᵉ carte sur 12, et un lot de contenu a mangé la marge.
 */
async function ouvrirEncart(): Promise<void> {
  const plafond = tailleListe() * 2
  for (let i = 0; i < plafond && encart() === null; i++) fireEvent.click(bouton(/Suivant/))
  await screen.findByText(/Rien n'est obligatoire/)
}

/**
 * Tous les plats de la liste courante, dans l'ordre du classement.
 *
 * ⛔ ON REMONTE D'ABORD EN TÊTE. `ouvrirEncart` laisse la position en 11ᵉ carte et
 * `aujourdhui.tsx:474` coupe « Suivant » en butée : partir d'où l'on est collectait douze fois le
 * dernier plat. Les deux flèches portent `disabled` (`aujourdhui.tsx:662`), qui dit où l'on est.
 */
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

/**
 * Monte l'écran SUR UN REPAS NOMMÉ, active la pastille d'envie, referme l'encart, rend la liste.
 *
 * ⛔ LA VÉRIFICATION DU TITRE N'EST PAS DÉCORATIVE. `epingler` échoue si la pastille est absente,
 * mais pas si elle est présente et inerte : sans ce contrôle, une pastille débranchée laisserait
 * la mesure se faire sur le créneau de l'horloge tout en portant le nom de l'autre.
 */
async function propositionsSous(libelle: string, creneau: string): Promise<readonly string[]> {
  await monter(creneau)
  expect(titreAffiche(), `l’écran doit afficher « ${creneau} », pas le repas de l’horloge`).toBe(
    creneau
  )
  await ouvrirEncart()
  fireEvent.click(bouton(libelle))
  fireEvent.click(bouton('Masquer'))
  await laisserRecalculer()
  return collecterListe()
}

// ------------------------------------------------------------------------------------------
// Les clauses
// ------------------------------------------------------------------------------------------

describe('retour-1 — la convention du catalogue, figée pour interdire la fausse correction', () => {
  it('porte 84 recettes strictement froides, 254 strictement chaudes, 1 neutre, 339 en tout', () => {
    const db = ouvrirCatalogue()
    try {
      const l = (sql: string) => (db.prepare(sql).get() as { n: number }).n
      expect({
        froides: l('SELECT COUNT(*) n FROM recipe WHERE axe_chaud_froid < 0'),
        neutres: l('SELECT COUNT(*) n FROM recipe WHERE axe_chaud_froid = 0'),
        chaudes: l('SELECT COUNT(*) n FROM recipe WHERE axe_chaud_froid > 0'),
        total: l('SELECT COUNT(*) n FROM recipe'),
      }).toEqual(CONVENTION_DU_CATALOGUE)
    } finally {
      db.close()
    }
  })

  it('range du côté FROID les plats qu’on mange froids, et du côté CHAUD ceux qu’on mange chauds', () => {
    const db = ouvrirCatalogue()
    try {
      // Deux repères du catalogue, choisis parce qu'aucun humain n'hésite sur leur température.
      expect(axeDuPlat(db, 'Gaspacho de tomates et concombre', 'axe_chaud_froid')).toBeLessThan(0)
      expect(axeDuPlat(db, 'Blanquette de veau', 'axe_chaud_froid')).toBeGreaterThan(0)
    } finally {
      db.close()
    }
  })
})

describe('retour-1 — le moteur note déjà dans le bon sens, et il ne doit PAS bouger', () => {
  /**
   * ⛔ CETTE CLAUSE EST VERTE AUJOURD'HUI, ET C'EST TOUT SON INTÉRÊT. Elle enferme la correction
   * dans l'ÉCRAN. Inverser le signe de `chaudFroid` dans `scoring/craving.ts:44` ferait passer
   * toutes les clauses d'écran ci-dessous à l'identique tout en cassant `cli/try-engine.ts:89-90`,
   * qui est déjà juste. Ici, aucun écran : on appelle la fonction de score nue.
   */
  it('note une recette chaude au-dessus d’une froide quand l’envie demandée est chaude', async () => {
    const { scoreCraving } = await import('../../app/src/engine/selection/scoring/craving.js')
    const chaude = { sucreSale: -0.5, legerConsistant: 0.5, chaudFroid: 0.9, texture: 'fondant' }
    const froide = { ...chaude, chaudFroid: -0.9 }

    const envieChaude = { sucreSale: null, legerConsistant: null, chaudFroid: 1 }
    expect(scoreCraving(chaude, envieChaude)).toBeGreaterThan(scoreCraving(froide, envieChaude))

    const envieFroide = { sucreSale: null, legerConsistant: null, chaudFroid: -1 }
    expect(scoreCraving(froide, envieFroide)).toBeGreaterThan(scoreCraving(chaude, envieFroide))
  })
})

/** Le signe d'envie porté par la DERNIÈRE requête reçue par le moteur. */
const envieEnvoyee = (): unknown => observe.requetes.at(-1)?.context?.envie?.chaudFroid

describe('retour-1 — ce que l’écran DEMANDE au moteur (ROUGE aujourd’hui)', () => {
  /**
   * ⛔ LA CLAUSE QUI FERME LE TRI D'APRÈS-COUP (voir l'en-tête, fausse n°3). Elle ne regarde
   * aucune liste : elle regarde le nombre qui part vers le moteur. Reclasser après l'appel ne
   * peut pas la satisfaire, parce qu'à ce moment-là l'appel a déjà eu lieu avec le mauvais signe.
   */
  // ⚠️ LE TITRE DIT « le chaud » ET NON « Chaud », ET CE N'EST PAS UN CAPRICE DE STYLE.
  // `retour-5d` exige que TOUTE clause dont le titre porte « Chaud » écrive le seuil de 0,9 —
  // garde contre un plancher qu'on retirerait en laissant le titre le promettre. Cette clause-ci
  // ne mesure aucune proportion : elle écoute le SIGNE envoyé au moteur. Lui coller un 0,9
  // n'aurait rien vérifié ; la minuscule dit qu'on parle de la température, pas de la pastille.
  it('envoie +1 quand on demande le chaud, et −1 quand on demande le froid', async () => {
    await monter(CE_MIDI)
    await ouvrirEncart()

    observe.requetes.length = 0
    fireEvent.click(bouton('Chaud'))
    await laisserRecalculer()
    await laisserRecalculer()
    expect(observe.requetes.length).toBeGreaterThan(0) // sinon c'est le harnais qui a lâché
    expect(envieEnvoyee()).toBe(1)

    fireEvent.click(bouton('Chaud')) // on relâche la pastille
    await laisserRecalculer()

    observe.requetes.length = 0
    fireEvent.click(bouton('Froid'))
    await laisserRecalculer()
    await laisserRecalculer()
    expect(observe.requetes.length).toBeGreaterThan(0)
    expect(envieEnvoyee()).toBe(-1)
  })
})

/**
 * ⛔ QUATRE CLAUSES LÀ OÙ IL Y EN AVAIT DEUX, UNE PAR PASTILLE ET PAR REPAS — c'est la livraison
 * de `retour-5d`. Les deux clauses d'avant ne disaient pas quel repas elles regardaient : elles
 * héritaient de `new Date().getHours()`, donc du moment où la suite tournait. La même clause a
 * rendu 12/12 froides à 12 h et 7/12 à 14 h le 2026-09-09, et deux relevés d'août ont attribué
 * l'écart à la croissance du catalogue : ils comparaient deux heures sans le savoir.
 *
 * ⛔ LE PLANCHER DU FROID PASSE DE 0,6 À 0,9 AUX DEUX REPAS, ET CE N'EST PAS UN DURCISSEMENT
 * DÉCORATIF — c'est le re-mesurage que le brief du lot exigeait « APRÈS `retour-5e` ». Le 0,6
 * datait du 2026-08-21 et se justifiait par le rayon : 254 recettes chaudes contre 84 froides, et
 * un dîner qui n'en portait que **8 sur 214**. `retour-5e` (2026-09-09) a rendu au dîner les 36
 * froides que `types_repas` en barrait → **250 recettes, 44 froides**, la même densité qu'au
 * déjeuner (44 sur 194). Mesure du jour : **12/12 froides aux DEUX créneaux**.
 * ⚠️ 0,9 ET NON 1,0 : un plancher au ras de sa mesure rougit au premier plat chaud qui entre dans
 * la liste. La marge est d'un plat sur dix — la même que celle du seuil de « Chaud », et la même
 * que celle que le 0,6 prenait sous son 8/12 d'août. La symétrie des deux seuils était une
 * « élégance fausse » tant que le rayon ne la portait pas ; elle est maintenant un RÉSULTAT.
 */
describe('retour-1 — chaque pastille tient sa promesse, à chaque repas (ROUGE aujourd’hui)', () => {
  it('« Froid » à « Ce midi » : la liste penche froid, et 9 plats sur 10 le sont', async () => {
    const plats = await propositionsSous('Froid', CE_MIDI)
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 'axe_chaud_froid', -1)
      console.log(`[MESURE] Froid / ${CE_MIDI} → ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} froides`)
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeLessThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.9)
    } finally {
      db.close()
    }
  })

  it('« Froid » à « Ce soir » : la liste penche froid, et 9 plats sur 10 le sont', async () => {
    const plats = await propositionsSous('Froid', CE_SOIR)
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 'axe_chaud_froid', -1)
      console.log(`[MESURE] Froid / ${CE_SOIR} → ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} froides`)
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeLessThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.9)
    } finally {
      db.close()
    }
  })

  it('« Chaud » à « Ce midi » : la liste penche chaud, et 9 plats sur 10 le sont', async () => {
    const plats = await propositionsSous('Chaud', CE_MIDI)
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 'axe_chaud_froid', 1)
      console.log(`[MESURE] Chaud / ${CE_MIDI} → ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} chaudes`)
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeGreaterThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.9)
    } finally {
      db.close()
    }
  })

  it('« Chaud » à « Ce soir » : la liste penche chaud, et 9 plats sur 10 le sont', async () => {
    const plats = await propositionsSous('Chaud', CE_SOIR)
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 'axe_chaud_froid', 1)
      console.log(`[MESURE] Chaud / ${CE_SOIR} → ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} chaudes`)
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeGreaterThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.9)
    } finally {
      db.close()
    }
  })

  /**
   * ⛔ LA CLAUSE QUI TUE LA TABLE FIGÉE. Deux listes en dur, une par pastille, satisferaient les
   * deux clauses ci-dessus. Elles ne survivent pas à un changement de graine : « Proposer autre
   * chose » renouvelle le tirage, la liste doit CHANGER et rester chaude.
   */
  it('renouvelle la liste sans cesser d’être chaude — une table figée ne le peut pas', async () => {
    await monter(CE_MIDI)
    await ouvrirEncart()
    fireEvent.click(bouton('Chaud'))
    fireEvent.click(bouton('Masquer'))
    await laisserRecalculer()
    const premiere = collecterListe()

    fireEvent.click(bouton('Proposer autre chose'))
    await laisserRecalculer()
    const seconde = collecterListe()

    expect(seconde).not.toEqual(premiere)

    const db = ouvrirCatalogue()
    try {
      for (const [rang, liste] of [
        ['1re', premiere],
        ['2e', seconde],
      ] as const) {
        const v = verdict(db, liste, 'axe_chaud_froid', 1)
        console.log(`[MESURE] Chaud, graine ${rang} → ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur}`)
        expect(v.moyenne).toBeGreaterThan(0)
        expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.9)
      }
    } finally {
      db.close()
    }
  })
})

describe('retour-1 — les deux axes justes le restent (VERTS aujourd’hui, témoins de débordement)', () => {
  it('« Léger » reste léger et « Consistant » reste consistant', async () => {
    const legers = await propositionsSous('Léger', CE_MIDI)
    cleanup()
    const consistants = await propositionsSous('Consistant', CE_MIDI)
    const db = ouvrirCatalogue()
    try {
      const a = verdict(db, legers, 'axe_leger_consistant', -1)
      const b = verdict(db, consistants, 'axe_leger_consistant', 1)
      console.log(`[MESURE] Léger → ${a.moyenne.toFixed(3)} · Consistant → ${b.moyenne.toFixed(3)}`)
      expect(a.moyenne).toBeLessThan(b.moyenne)
      expect(a.moyenne).toBeLessThan(0)
      expect(b.moyenne).toBeGreaterThan(0)
    } finally {
      db.close()
    }
  })

  it('« Salé » reste salé et « Sucré » reste sucré', async () => {
    const sales = await propositionsSous('Salé', CE_MIDI)
    cleanup()
    const sucres = await propositionsSous('Sucré', CE_MIDI)
    const db = ouvrirCatalogue()
    try {
      const a = verdict(db, sales, 'axe_sucre_sale', -1)
      const b = verdict(db, sucres, 'axe_sucre_sale', 1)
      console.log(`[MESURE] Salé → ${a.moyenne.toFixed(3)} · Sucré → ${b.moyenne.toFixed(3)}`)
      expect(a.moyenne).toBeLessThan(b.moyenne)
      expect(a.moyenne).toBeLessThan(0)
    } finally {
      db.close()
    }
  })
})
