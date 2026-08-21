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
// `CONVENTION_DU_CATALOGUE`, qui fige les comptes mesurés — 84 froides, 245 chaudes, 1 neutre.
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
const CONVENTION_DU_CATALOGUE = { froides: 84, neutres: 1, chaudes: 245, total: 330 } as const

/**
 * Taille minimale de la liste que l'écran doit offrir. L'écran en propose 12 aujourd'hui ; la
 * clause en exige 10, pour ne pas rougir si `PROFONDEUR` bouge d'un cran. Le « Fini quand » du
 * document dit le même nombre — les deux ont divergé une fois, relevé par le critique le
 * 2026-08-21.
 */
const PROPOSITIONS_MINIMUM = 10

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
afterEach(cleanup)

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

/** Monte l'écran, active la pastille demandée, referme l'encart, et rend la liste proposée. */
async function propositionsSous(libelle: string): Promise<readonly string[]> {
  await monter()
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
  it('porte 84 recettes strictement froides, 245 strictement chaudes, 1 neutre, 330 en tout', () => {
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
  it('envoie +1 quand on demande « Chaud », et −1 quand on demande « Froid »', async () => {
    await monter()
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

describe('retour-1 — la pastille « Chaud » demande du chaud (ROUGE aujourd’hui)', () => {
  it('propose une liste dont la moyenne est chaude, et au moins 9 plats sur 10 le sont', async () => {
    const plats = await propositionsSous('Chaud')
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 'axe_chaud_froid', 1)
      console.log(`[MESURE] Chaud → moyenne ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} chaudes`)
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeGreaterThan(0)
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.9)
    } finally {
      db.close()
    }
  })

  it('propose du froid quand on demande « Froid », et au moins 6 plats sur 10 le sont', async () => {
    const plats = await propositionsSous('Froid')
    const db = ouvrirCatalogue()
    try {
      const v = verdict(db, plats, 'axe_chaud_froid', -1)
      console.log(`[MESURE] Froid → moyenne ${v.moyenne.toFixed(3)}, ${v.bonCote}/${v.sur} froides`)
      expect(v.sur).toBeGreaterThanOrEqual(PROPOSITIONS_MINIMUM)
      expect(v.moyenne).toBeLessThan(0)
      // ⚠️ 0,6 ET NON 0,9, ET CE N EST PAS UN RELACHEMENT : le catalogue porte 245 recettes
      // chaudes contre 84 froides. Demander du froid rend MECANIQUEMENT une liste plus melangee
      // que demander du chaud. Mesure du 2026-08-21 : 8 froides sur 12, soit 67 %. Exiger 70 %
      // aurait fait rougir la clause APRES la correction — la symetrie des seuils aurait ete
      // une elegance fausse.
      expect(v.bonCote / v.sur).toBeGreaterThanOrEqual(0.6)
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
    await monter()
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
    const legers = await propositionsSous('Léger')
    cleanup()
    const consistants = await propositionsSous('Consistant')
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
    const sales = await propositionsSous('Salé')
    cleanup()
    const sucres = await propositionsSous('Sucré')
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
