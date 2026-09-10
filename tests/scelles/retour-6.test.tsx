// @vitest-environment jsdom
//
// tests/scelles/retour-6.test.tsx — l'examen du lot `retour-6` : les trois pastilles d'envie
// cessent de classer et se mettent à RETIRER (décision 71), et quand la pile ne laisse plus rien
// l'écran lâche UN axe, le premier de l'ordre, et le DIT (décision 79).
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Aujourd'hui `craving` est une couche de SCORE :
// cliquer « Froid » remonte les plats froids sans retirer les autres, l'écran rend ses douze
// cartes quoi qu'il arrive, et rien n'est jamais annoncé. Les clauses 1 à 4, la 4 bis, la 7 et la
// moitié de la 6 tombent donc en rouge ; les clauses déclarées « garde » ci-dessous sont vertes
// exprès.
//
// ---------------------------------------------------------------------------------------------
// CE QU'IL MESURE, ET PAR QUEL CHEMIN
//
// ⛔ L'ORACLE EST SQL, PAS LE MOTEUR. Chaque plat affiché est relu PAR SON NOM dans
// `app/public/catalog/catalog.db` — ses trois axes, ses allergènes par jointure
// `recipe_ingredient × food_allergen`. Un test qui redemanderait au moteur ce qu'il vient de
// répondre ne prouverait rien : c'est la « fixture qui redirait la même chose » que le brief
// interdit. Les deux chemins ont été confrontés en écrivant le brief — moteur et SQL rendent les
// MÊMES nombres sur les 64 cases du tableau de conception.
//
// ⛔ LE CRÉNEAU S'ÉPINGLE PAR `aria-pressed`, ET L'HORLOGE EST FIGÉE. Piège payé par `retour-5d` :
// l'écran déduit son repas de `new Date().getHours()` (bascule à 14 h), et le titre porte le même
// libellé que la pastille — viser par le texte seul attrape le titre et ne change rien.
//
// ⛔ `types_repas` SE LIT PAR `json_each`, JAMAIS PAR `LIKE '%dejeuner%'`. Piège payé en écrivant
// ce brief : `LIKE` attrape aussi `petit_dejeuner`, et l'oracle annonçait 4 plats là où le moteur
// en rendait 1. Les trois quarts de l'écart étaient des porridges.
//
// ---------------------------------------------------------------------------------------------
// CINQ IMPLÉMENTATIONS FAUSSES, ET LES CLAUSES QUI LES TUENT
//
// ⛔ FAUSSE N°1 — GARDER `craving` EN COUCHE DE SCORE ET SE CONTENTER DE MONTER SON POIDS. Les
// plats hors filtre descendent au fond de la liste, l'écran a l'air juste, et il rend toujours
// douze cartes. ▶ Tuée par la clause 1 (zéro intrus) ET par la clause 2 : le catalogue ne porte
// qu'UNE recette consistante, froide et sucrée — une liste de douze est fausse par construction.
//
// ⛔ FAUSSE N°2 — RELÂCHER L'AXE QUI RAPPORTE LE PLUS. « On lâche celui qui rend le plus de
// plats » est le réflexe naturel, il donne des listes plus longues, et il contredit la 79.
// ▶ Tuée par la clause 4 : sur `Consistant + Froid + Sucré` en sans-gluten-sans-lait, lâcher
// `sucreSale` rend 7 plats, lâcher `chaudFroid` en rend 1, lâcher `legerConsistant` — le premier
// de l'ordre, le seul juste — en rend 4. Les trois chemins rendent trois nombres différents.
//
// ⛔ FAUSSE N°3 — UNE PHRASE CONSTANTE. « Nous avons élargi votre recherche » passerait une
// clause de présence sans jamais nommer quoi que ce soit. ▶ Tuée par le MODÈLE de la 79, lu en deux
// moitiés : « Aucun plat [demande] — voici des plats [ce qui tient encore] ». Avant « voici », la
// demande entière ; après, les pôles gardés et eux seuls. Les clauses 3 et 4 gardent les deux pôles
// OPPOSÉS du même axe — « chauds » dans l'une, « froids » dans l'autre : aucune constante ne passe
// les deux. ⚠️ La première écriture interdisait tout mot d'axe gardé dans la phrase ENTIÈRE ; or
// l'exemple de la 79 (« aucun plat chaud et léger — voici des plats chauds ») en nomme un. La
// clause contredisait la décision qu'elle scelle — corrigé au tour d'attaque du 2026-09-10.
//
// ⛔ FAUSSE N°4 — FILTRER DANS L'ÉCRAN, APRÈS LE MOTEUR, ET DÉCLARER UNE 8ᵉ COUCHE QUI NE FAIT
// RIEN. Exhibée au tour d'attaque du 2026-09-10 : `suggestMeals` rend ses 194 candidats, l'écran
// jette les intrus à côté du filtre qui écarte déjà les plats simples, et une couche vide gonfle le
// registre à 8. Les clauses 1 à 6 ne regardent que l'écran : elles passaient toutes. ▶ Tuée par la
// clause 7, qui appelle le moteur SANS monter l'écran. L'oracle y reste SQL — c'est le sujet
// mesuré qui change, pas le juge.
//
// ⛔ FAUSSE N°5 — UN SEUL CRAN, CODÉ EN DUR. Exhibée au même tour : sur les quatre profils du
// tableau de conception, lâcher UN axe suffit toujours, donc « lâcher `legerConsistant` et
// s'arrêter » passait tout. ▶ Tuée par la clause 4 bis — fruits à coque + gluten + sulfites,
// « Consistant + Chaud + Sucré » au déjeuner : 0 → 0 → 4. Mesuré par le moteur ET par SQL le
// 2026-09-10, mêmes nombres.
//
// ---------------------------------------------------------------------------------------------
// LES CLAUSES VERTES AUJOURD'HUI, DÉCLARÉES COMME TELLES
//
// ⚠️ CLAUSE 0 (témoin de catalogue) — les huit comptes du tableau de conception. Elle n'existe pas
// pour rougir maintenant : elle existe pour que le jour où le catalogue bougera, l'échec dise
// « le catalogue a changé » au lieu de « le filtre est cassé ». C'est le rebasage que `retour-5c`
// a dû faire à la main sur onze valeurs, rendu lisible d'avance.
//
// ⚠️ CLAUSE 5 (la sécurité ne se relâche jamais) — VERTE aujourd'hui, et c'est exactement ce qu'on
// veut : les allergènes sont déjà durs. Elle rougira le jour où le relâchement mordrait dessus,
// c'est-à-dire le jour où la borne (a) de la 79 serait franchie. Une garde n'est pas un défaut.
//
// ⚠️ CLAUSE 6a (aucune annonce quand rien n'était vide) — VERTE aujourd'hui sur les huit
// combinaisons, parce que l'écran n'annonce rien du tout. Elle garde la borne (b) prise à
// l'envers : le jour où le relâchement s'armerait trop tôt, elle tombe. Ses deux voisines, 6b (les
// huit combinaisons rendent zéro intrus) et 6c (le registre à 8 couches), sont ROUGES.
//
// ⛔ 6a ET 6b SONT DEUX `it` SÉPARÉS, ET CE N'EST PAS DE LA COSMÉTIQUE. Les mêler ferait d'une
// garde et d'un défaut un seul verdict : le fichier rougirait aujourd'hui pour la bonne raison,
// puis, le jour où le relâchement s'armerait à tort, il rougirait exactement pareil. Une garde ne
// vaut que si son échec se lit seul.
//
// ⚠️ 6b RENDRA UN VERT PARASITE SUR « Consistant + Chaud + Salé », ET C'EST MESURÉ : cette
// combinaison porte 124 des 194 recettes du créneau, donc les douze premières y tombent du bon
// côté par pure abondance, sans qu'aucun filtre existe. Les sept autres cases rougissent. C'est le
// rappel que la clause 1 vise la case à 11 recettes et la clause 2 celle à 1 : sur ce catalogue,
// seules les cases pauvres discriminent.
//
// ⚠️ CE QUE CE FICHIER NE COUVRE PAS, ET QUI EST MESURÉ : le profil « végétalien + 5 allergènes »,
// où QUATRE des huit combinaisons sont vides. Son oracle demanderait de rejouer en SQL la cascade
// `derive_de` de l'origine animale — donc de recopier la couche `regime` dans le test. Écarté
// exprès. Le profil « sans gluten + sans lait », lui, s'oracle par une simple jointure.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeAllergies, writeRythme } from '../../app/src/data/user-store.js'
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

// ------------------------------------------------------------------------------------------
// Le vocabulaire du lot
// ------------------------------------------------------------------------------------------

/**
 * Les trois axes, DANS L'ORDRE DE RELÂCHEMENT DE LA DÉCISION 79 — du plus général au plus précis.
 * C'est aussi l'ordre des pastilles à l'écran, et ce n'est pas une coïncidence.
 */
const AXES = ['legerConsistant', 'chaudFroid', 'sucreSale'] as const
type Axe = (typeof AXES)[number]

const COLONNE: Record<Axe, string> = {
  legerConsistant: 'axe_leger_consistant',
  chaudFroid: 'axe_chaud_froid',
  sucreSale: 'axe_sucre_sale',
}

/** Le libellé de chaque pôle, tel que la pastille l'affiche. `-1` à gauche, `+1` à droite. */
const POLE: Record<Axe, Record<'-1' | '1', string>> = {
  legerConsistant: { '-1': 'Léger', '1': 'Consistant' },
  chaudFroid: { '-1': 'Froid', '1': 'Chaud' },
  sucreSale: { '-1': 'Salé', '1': 'Sucré' },
}

type Demande = Partial<Record<Axe, -1 | 1>>

const CE_MIDI = 'Ce midi'
const CE_SOIR = 'Ce soir'
const GLUTEN_ET_LAIT = ['gluten', 'lait'] as const
/** Le profil qui force DEUX crans (tour d'attaque du 2026-09-10) — voir la clause 4 bis. */
const COQUE_GLUTEN_SULFITES = ['fruits_a_coque', 'gluten', 'sulfites'] as const

/**
 * Le mot de chaque pôle tel qu'une phrase le porte, accords compris (« légers », « chaude »,
 * « sucrés »). ⚠️ `sal[ée]` et pas `sal` : « salade » ne doit pas se lire « salé ».
 */
const MOT: Record<Axe, Record<'-1' | '1', RegExp>> = {
  legerConsistant: { '-1': /l[ée]g[eè]r/i, '1': /consistant/i },
  chaudFroid: { '-1': /froid/i, '1': /chaud/i },
  sucreSale: { '-1': /sal[ée]/i, '1': /sucr[ée]/i },
}

// ------------------------------------------------------------------------------------------
// L'oracle — SQL direct, jamais le moteur
// ------------------------------------------------------------------------------------------

function ouvrirCatalogue(): DatabaseSync {
  return new DatabaseSync(CATALOGUE, { readOnly: true })
}

/**
 * Les recettes du catalogue qui répondent à une demande, au créneau dit, hors allergènes donnés.
 *
 * ⛔ `json_each` SUR `types_repas`, PAS `LIKE`. Voir l'en-tête : `LIKE '%dejeuner%'` attrape
 * `petit_dejeuner` et gonfle l'oracle de porridges.
 */
function oracle(
  db: DatabaseSync,
  creneau: 'dejeuner' | 'diner',
  demande: Demande,
  allergenes: readonly string[] = []
): readonly string[] {
  const signes = AXES.filter((a) => demande[a] !== undefined).map(
    (a) => `${COLONNE[a]} ${demande[a]! > 0 ? '>' : '<'} 0`
  )
  const sansAllergene =
    allergenes.length === 0
      ? ''
      : `AND id NOT IN (SELECT ri.recipe_id FROM recipe_ingredient ri
                        JOIN food_allergen fa ON fa.food_id = ri.food_id
                        WHERE fa.allergen_id IN (${allergenes.map(() => '?').join(', ')}))`
  const sql = `SELECT nom FROM recipe
     WHERE EXISTS (SELECT 1 FROM json_each(recipe.types_repas) WHERE value = ?)
       ${signes.length > 0 ? 'AND ' + signes.join(' AND ') : ''}
       ${sansAllergene}
     ORDER BY nom`
  return (db.prepare(sql).all(creneau, ...allergenes) as { nom: string }[]).map((r) => r.nom)
}

/** Les trois axes d'un plat DÉSIGNÉ PAR SON NOM AFFICHÉ. Échoue si le nom n'est pas unique. */
function axesDuPlat(db: DatabaseSync, nom: string): Record<Axe, number> {
  const lignes = db
    .prepare(
      `SELECT ${COLONNE.legerConsistant} AS lc, ${COLONNE.chaudFroid} AS cf, ${COLONNE.sucreSale} AS ss
       FROM recipe WHERE nom = ?`
    )
    .all(nom) as { lc: number; cf: number; ss: number }[]
  if (lignes.length !== 1) {
    throw new Error(`« ${nom} » : ${lignes.length} recette(s) de ce nom au catalogue, il en faut 1`)
  }
  const l = lignes[0]!
  return { legerConsistant: l.lc, chaudFroid: l.cf, sucreSale: l.ss }
}

/** Ce plat porte-t-il l'un des allergènes ? TRACES COMPRISES — le critère de la couche de prod. */
function porteUnAllergene(db: DatabaseSync, nom: string, allergenes: readonly string[]): boolean {
  const trous = allergenes.map(() => '?').join(', ')
  const ligne = db
    .prepare(
      `SELECT COUNT(*) AS n FROM recipe r
         JOIN recipe_ingredient ri ON ri.recipe_id = r.id
         JOIN food_allergen fa ON fa.food_id = ri.food_id
        WHERE r.nom = ? AND fa.allergen_id IN (${trous})`
    )
    .get(nom, ...allergenes) as { n: number }
  return ligne.n > 0
}

/** Les plats de la liste qui tombent du MAUVAIS côté d'un axe demandé. */
function intrus(db: DatabaseSync, plats: readonly string[], demande: Demande): readonly string[] {
  return plats.filter((nom) => {
    const axes = axesDuPlat(db, nom)
    return AXES.some((a) => {
      const voulu = demande[a]
      if (voulu === undefined) return false
      return voulu > 0 ? !(axes[a] > 0) : !(axes[a] < 0)
    })
  })
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

/** Fige l'horloge à midi le 2026-09-09 : `figerAHeure` de `retour-5d`, même piège, même remède. */
function figerLHorloge(): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 9, 12, 30, 0))
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

/** Clique une pastille — celle qui porte `aria-pressed`, jamais le titre qui porte le même mot. */
function cliquerPastille(libelle: string): void {
  const pastille = screen
    .queryAllByText(libelle)
    .map((n) => n.closest('button'))
    .find((b) => b !== null && b.hasAttribute('aria-pressed'))
  if (pastille === undefined || pastille === null) {
    expect.fail(`la pastille « ${libelle} » est absente de l'écran`)
  }
  fireEvent.click(pastille)
}

async function epingler(titre: string): Promise<void> {
  cliquerPastille(titre)
  await screen.findByText(/sur \d+$/)
  await laisserRecalculer()
}

async function ouvrirEncart(): Promise<void> {
  const plafond = tailleListe() * 2
  for (let i = 0; i < plafond && encart() === null; i++) fireEvent.click(bouton(/Suivant/))
  await screen.findByText(/Rien n'est obligatoire/)
}

/** Tous les plats de la liste courante, dans l'ordre, depuis la première carte. */
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
 * L'ANNONCE DE RELÂCHEMENT — le texte de la région `role="status"` de l'écran, ou `null`.
 *
 * ⛔ `role="status"`, PAS UNE `<p>` MUETTE, et pas un bouton. La phrase arrive APRÈS coup, en
 * réponse à un geste : un lecteur d'écran doit l'entendre. L'idiome est déjà posé cinq fois dans
 * l'interface (`mesure-montage.tsx`, `visite.tsx`, `main.tsx`) — ce n'est pas une invention du
 * test. Et la borne (b) de la 79 demande une INFORMATION, pas une commande de plus : une annonce
 * enfermée dans un bouton fait échouer la clause.
 */
function annonce(): string | null {
  const regions = Array.from(document.querySelectorAll('[role="status"]'))
  if (regions.length === 0) return null
  for (const r of regions) {
    expect(r.closest('button'), 'l’annonce de relâchement est enfermée dans un bouton').toBeNull()
  }
  return regions
    .map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim())
    .join(' ')
    .trim()
}

interface Vue {
  readonly plats: readonly string[]
  readonly annonce: string | null
}

/**
 * Monte l'écran, épingle le créneau, pose les pastilles demandées, referme l'encart, et rend la
 * liste ET l'annonce.
 *
 * ⚠️ L'ANNONCE SE LIT AVANT DE PARCOURIR LA LISTE : `collecterListe` clique une trentaine de fois,
 * et un écran a le droit de replier une annonce qu'on a « dépassée ».
 */
async function vueSous(creneau: 'dejeuner' | 'diner', demande: Demande): Promise<Vue> {
  figerLHorloge()
  await monter()
  await epingler(creneau === 'dejeuner' ? CE_MIDI : CE_SOIR)
  await ouvrirEncart()
  for (const a of AXES) {
    const voulu = demande[a]
    if (voulu !== undefined) cliquerPastille(POLE[a][voulu > 0 ? '1' : '-1'])
  }
  fireEvent.click(bouton('Masquer'))
  await laisserRecalculer()
  const lue = annonce()
  return { plats: collecterListe(), annonce: lue }
}

/**
 * Lit l'annonce contre le MODÈLE de la 79 : « Aucun plat [demande] — voici des plats [ce qui tient
 * encore] ». Avant « voici » : chaque pôle demandé. Après : chaque pôle gardé, jamais son contraire,
 * et AUCUN mot d'un axe lâché.
 *
 * ⛔ C'EST LA MOITIÉ APRÈS « voici » QUI TUE LA PHRASE CONSTANTE, et c'est elle qui respecte la
 * lettre de la 79 : son exemple (« aucun plat chaud et léger — voici des plats chauds ») nomme un
 * axe GARDÉ. Interdire ce mot dans la phrase entière contredisait la décision.
 */
function lireAnnonce(texte: string | null, demande: Demande, garde: Demande): void {
  if (texte === null) expect.fail('rien n’est annoncé — un plat hors filtre est rendu en silence')
  const coupure = texte.search(/voici/i)
  expect(
    coupure,
    `l’annonce ne suit pas le modèle de la 79 (« Aucun plat … — voici des plats … ») : « ${texte} »`
  ).toBeGreaterThanOrEqual(0)
  const avant = texte.slice(0, coupure)
  const apres = texte.slice(coupure)
  for (const a of AXES) {
    const voulu = demande[a]
    if (voulu !== undefined) {
      const pole = voulu > 0 ? '1' : '-1'
      expect(avant, `la demande n’est pas nommée : « ${POLE[a][pole]} » manque avant « voici »`).toMatch(
        MOT[a][pole]
      )
    }
    const tenu = garde[a]
    if (tenu === undefined) {
      expect(apres, `après « voici », l’annonce nomme un axe LÂCHÉ (${a})`).not.toMatch(MOT[a]['1'])
      expect(apres, `après « voici », l’annonce nomme un axe LÂCHÉ (${a})`).not.toMatch(MOT[a]['-1'])
    } else {
      const pole = tenu > 0 ? '1' : '-1'
      const contraire = tenu > 0 ? '-1' : '1'
      expect(apres, `après « voici », l’annonce tait un axe qui TIENT : « ${POLE[a][pole]} »`).toMatch(
        MOT[a][pole]
      )
      expect(apres, `après « voici », l’annonce nomme le contraire de « ${POLE[a][pole]} »`).not.toMatch(
        MOT[a][contraire]
      )
    }
  }
}

function declarer(allergenes: readonly string[]): void {
  writeAllergies(
    baseCourante(),
    allergenes.map((id) => ({ allergenId: id as never, severite: null }))
  )
}

function declarerSansGlutenNiLait(): void {
  declarer(GLUTEN_ET_LAIT)
}

/** Les huit combinaisons de signes des trois axes. */
const HUIT: readonly Demande[] = ([-1, 1] as const).flatMap((l) =>
  ([-1, 1] as const).flatMap((c) =>
    ([-1, 1] as const).map((s) => ({ legerConsistant: l, chaudFroid: c, sucreSale: s }))
  )
)

const nomDe = (d: Demande): string =>
  AXES.filter((a) => d[a] !== undefined)
    .map((a) => POLE[a][d[a]! > 0 ? '1' : '-1'])
    .join(' + ')

// ------------------------------------------------------------------------------------------
// CLAUSE 0 — le témoin de catalogue (VERTE aujourd'hui, déclarée telle)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 0 : le catalogue sur lequel le « Fini quand » a été chiffré', () => {
  it('les huit comptes du profil sans contrainte sont ceux du 2026-09-09', () => {
    const db = ouvrirCatalogue()
    try {
      const releve = Object.fromEntries(
        HUIT.map((d) => [
          nomDe(d),
          [oracle(db, 'dejeuner', d).length, oracle(db, 'diner', d).length],
        ])
      )
      expect(releve, 'le catalogue a bougé : rebaser le tableau du document de conception').toEqual({
        'Léger + Froid + Salé': [23, 22],
        'Léger + Froid + Sucré': [6, 7],
        'Léger + Chaud + Salé': [14, 33],
        'Léger + Chaud + Sucré': [2, 5],
        'Consistant + Froid + Salé': [11, 11],
        'Consistant + Froid + Sucré': [1, 1],
        'Consistant + Chaud + Salé': [124, 152],
        'Consistant + Chaud + Sucré': [4, 8],
      })
    } finally {
      db.close()
    }
  })

  it('les quatre cases vides du profil sans gluten ni lait, et ce qu’un cran leur rend', () => {
    const db = ouvrirCatalogue()
    try {
      const all = GLUTEN_ET_LAIT
      // Vides.
      expect(oracle(db, 'dejeuner', { legerConsistant: -1, chaudFroid: 1, sucreSale: 1 }, all)).toEqual([])
      expect(oracle(db, 'diner', { legerConsistant: -1, chaudFroid: 1, sucreSale: 1 }, all)).toEqual([])
      expect(oracle(db, 'dejeuner', { legerConsistant: 1, chaudFroid: -1, sucreSale: 1 }, all)).toEqual([])
      expect(oracle(db, 'diner', { legerConsistant: 1, chaudFroid: -1, sucreSale: 1 }, all)).toEqual([])
      // Le premier axe de l'ordre 79 lâché : non vide, et un seul cran suffit.
      expect(oracle(db, 'dejeuner', { chaudFroid: 1, sucreSale: 1 }, all)).toHaveLength(2)
      expect(oracle(db, 'diner', { chaudFroid: 1, sucreSale: 1 }, all)).toHaveLength(3)
      expect(oracle(db, 'dejeuner', { chaudFroid: -1, sucreSale: 1 }, all)).toHaveLength(4)
      expect(oracle(db, 'diner', { chaudFroid: -1, sucreSale: 1 }, all)).toHaveLength(5)
      // ⛔ LES DEUX AUTRES CHEMINS, CEUX QUE LA 79 REFUSE, RENDENT D'AUTRES NOMBRES. C'est ce qui
      // permet à la clause 4 de distinguer « premier de l'ordre » de « le plus rentable ».
      expect(
        oracle(db, 'dejeuner', { legerConsistant: 1, chaudFroid: -1 }, all),
        'lâcher `sucreSale` — le plus rentable, et le mauvais'
      ).toHaveLength(7)
      expect(
        oracle(db, 'dejeuner', { legerConsistant: 1, sucreSale: 1 }, all),
        'lâcher `chaudFroid` — le milieu de l’ordre, et le mauvais'
      ).toHaveLength(1)
    } finally {
      db.close()
    }
  })

  it('le profil où un cran ne suffit pas : fruits à coque + gluten + sulfites, au déjeuner', () => {
    const db = ouvrirCatalogue()
    try {
      const a = COQUE_GLUTEN_SULFITES
      expect(oracle(db, 'dejeuner', { legerConsistant: 1, chaudFroid: 1, sucreSale: 1 }, a)).toEqual([])
      expect(
        oracle(db, 'dejeuner', { chaudFroid: 1, sucreSale: 1 }, a),
        'le premier cran rend déjà quelque chose : la clause 4 bis ne mesure plus la boucle'
      ).toEqual([])
      expect(oracle(db, 'dejeuner', { sucreSale: 1 }, a), 'le second cran').toHaveLength(4)
      // ⛔ Le chemin faux — lâcher « sucré », l'axe rare — rend 64 : plus que PROFONDEUR, donc douze
      // cartes à l'écran. Le compte de 4 le sépare sans ambiguïté.
      expect(
        oracle(db, 'dejeuner', { legerConsistant: 1, chaudFroid: 1 }, a),
        'lâcher `sucreSale` — le mauvais'
      ).toHaveLength(64)
    } finally {
      db.close()
    }
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 1 — le filtre retire (ROUGE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 1 : les pastilles retirent, elles ne classent plus', () => {
  it('« Consistant + Froid + Salé » au déjeuner ne rend AUCUN intrus', async () => {
    const demande: Demande = { legerConsistant: 1, chaudFroid: -1, sucreSale: -1 }
    const { plats } = await vueSous('dejeuner', demande)
    const db = ouvrirCatalogue()
    try {
      expect(plats.length, 'aucun plat affiché : la clause ne mesure rien').toBeGreaterThan(0)
      expect(
        intrus(db, plats, demande),
        'un plat affiché tombe du mauvais côté d’un axe demandé'
      ).toEqual([])
      expect(
        plats.length,
        'le catalogue n’en porte que 11 : une liste plus longue contient forcément des intrus'
      ).toBeLessThanOrEqual(oracle(db, 'dejeuner', demande).length)
    } finally {
      db.close()
    }
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 2 — la rareté est assumée, jamais comblée (ROUGE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 2 : une liste courte reste courte, et ne s’annonce pas', () => {
  it.each(['dejeuner', 'diner'] as const)(
    '« Consistant + Froid + Sucré » — %s : ce plat-là, lui seul, et aucune annonce',
    async (creneau) => {
      const demande: Demande = { legerConsistant: 1, chaudFroid: -1, sucreSale: 1 }
      const vue = await vueSous(creneau, demande)
      const db = ouvrirCatalogue()
      try {
        expect(oracle(db, creneau, demande), 'témoin : le catalogue n’en porte qu’une').toEqual([
          'Roquefort, poire et noix',
        ])
        // ⚠️ `toEqual`, PAS `≤ 1` : un plafond accepte la liste VIDE, et une liste vide sans phrase
        // est exactement le silence que la 79 interdit. Trou vu au tour d'attaque du 2026-09-10.
        expect(
          vue.plats,
          'l’écran comble une liste courte avec des plats hors filtre — ou la vide'
        ).toEqual(['Roquefort, poire et noix'])
        expect(intrus(db, vue.plats, demande)).toEqual([])
        expect(
          vue.annonce,
          'l’écran relâche alors qu’il restait un plat — la liste n’était pas vide'
        ).toBeNull()
      } finally {
        db.close()
      }
    }
  )
})

// ------------------------------------------------------------------------------------------
// CLAUSE 3 — le relâchement se déclenche, et il se lit (ROUGE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 3 : quand la pile ne laisse rien, l’écran lâche « léger » et le dit', () => {
  it.each([
    ['dejeuner' as const, 2],
    ['diner' as const, 3],
  ])(
    'sans gluten ni lait, « Léger + Chaud + Sucré » — %s : liste non vide et annonce lisible',
    async (creneau, attendu) => {
      declarerSansGlutenNiLait()
      const demande: Demande = { legerConsistant: -1, chaudFroid: 1, sucreSale: 1 }
      const vue = await vueSous(creneau, demande)
      const db = ouvrirCatalogue()
      try {
        expect(
          oracle(db, creneau, demande, GLUTEN_ET_LAIT),
          'témoin : la combinaison demandée est bien vide'
        ).toEqual([])
        expect(vue.plats.length, 'la liste est restée vide : rien n’a été relâché').toBe(attendu)
        lireAnnonce(vue.annonce, demande, { chaudFroid: 1, sucreSale: 1 })
        // Les axes NON lâchés tiennent encore.
        expect(intrus(db, vue.plats, { chaudFroid: 1, sucreSale: 1 })).toEqual([])
      } finally {
        db.close()
      }
    }
  )
})

// ------------------------------------------------------------------------------------------
// CLAUSE 4 — un seul cran, et c'est le PREMIER DE L'ORDRE (ROUGE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 4 : on lâche le premier de l’ordre, pas le plus rentable', () => {
  it.each([
    ['dejeuner' as const, 4],
    ['diner' as const, 5],
  ])(
    'sans gluten ni lait, « Consistant + Froid + Sucré » — %s : c’est « consistant » qui tombe',
    async (creneau, attendu) => {
      declarerSansGlutenNiLait()
      const demande: Demande = { legerConsistant: 1, chaudFroid: -1, sucreSale: 1 }
      const vue = await vueSous(creneau, demande)
      const db = ouvrirCatalogue()
      try {
        expect(
          oracle(db, creneau, demande, GLUTEN_ET_LAIT),
          'témoin : la combinaison demandée est bien vide'
        ).toEqual([])
        expect(
          vue.plats.length,
          'le compte trahit l’axe lâché : 4 (consistant, juste) contre 7 (sucré) ou 1 (froid)'
        ).toBe(attendu)
        lireAnnonce(vue.annonce, demande, { chaudFroid: -1, sucreSale: 1 })
        expect(
          intrus(db, vue.plats, { chaudFroid: -1, sucreSale: 1 }),
          'les axes non lâchés ne tiennent plus : deux crans ont sauté d’un coup'
        ).toEqual([])
      } finally {
        db.close()
      }
    }
  )
})

// ------------------------------------------------------------------------------------------
// CLAUSE 4 bis — un cran ne suffit pas : la boucle en lâche un second (ROUGE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 4 bis : quand un cran ne suffit pas, l’écran en lâche un second', () => {
  it('fruits à coque + gluten + sulfites, « Consistant + Chaud + Sucré » — déjeuner : il ne reste que « sucré »', async () => {
    declarer(COQUE_GLUTEN_SULFITES)
    const demande: Demande = { legerConsistant: 1, chaudFroid: 1, sucreSale: 1 }
    const vue = await vueSous('dejeuner', demande)
    const db = ouvrirCatalogue()
    try {
      expect(
        oracle(db, 'dejeuner', demande, COQUE_GLUTEN_SULFITES),
        'témoin : la combinaison demandée est bien vide'
      ).toEqual([])
      expect(
        vue.plats.length,
        'le compte trahit la boucle : 4 (deux crans, juste) contre douze cartes (« sucré » lâché, 64 au catalogue)'
      ).toBe(4)
      expect(
        intrus(db, vue.plats, { sucreSale: 1 }),
        'le dernier axe de l’ordre a sauté aussi : trois crans d’un coup'
      ).toEqual([])
      expect(
        vue.plats.filter((nom) => porteUnAllergene(db, nom, COQUE_GLUTEN_SULFITES)),
        'le relâchement a franchi la borne (a) de la décision 79'
      ).toEqual([])
      lireAnnonce(vue.annonce, demande, { sucreSale: 1 })
    } finally {
      db.close()
    }
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 5 — la sécurité ne se relâche JAMAIS (VERTE aujourd'hui, déclarée telle)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 5 : le relâchement ne rend jamais un allergène', () => {
  it.each([
    [{ legerConsistant: -1, chaudFroid: 1, sucreSale: 1 } as Demande, 'Léger + Chaud + Sucré'],
    [{ legerConsistant: 1, chaudFroid: -1, sucreSale: 1 } as Demande, 'Consistant + Froid + Sucré'],
  ])('sans gluten ni lait, %#  — aucun plat porteur ne remonte', async (demande) => {
    declarerSansGlutenNiLait()
    const vue = await vueSous('dejeuner', demande)
    const db = ouvrirCatalogue()
    try {
      const porteurs = vue.plats.filter((nom) => porteUnAllergene(db, nom, GLUTEN_ET_LAIT))
      expect(porteurs, 'le relâchement a franchi la borne (a) de la décision 79').toEqual([])
    } finally {
      db.close()
    }
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 6 — rien d'autre ne bouge, et surtout pas en silence
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 6a : aucune annonce quand rien n’était vide (VERTE, garde)', () => {
  it.each(HUIT.map((d) => [nomDe(d), d] as const))(
    'profil sans contrainte, déjeuner, « %s » : l’écran reste muet',
    async (_nom, demande) => {
      const vue = await vueSous('dejeuner', demande)
      const db = ouvrirCatalogue()
      try {
        expect(
          oracle(db, 'dejeuner', demande),
          'témoin : aucune des huit n’est vide sur un profil sans contrainte'
        ).not.toEqual([])
        expect(
          vue.annonce,
          'l’écran annonce un relâchement alors que rien n’était vide — la 79 armée à tort'
        ).toBeNull()
      } finally {
        db.close()
      }
    }
  )
})

describe('retour-6 — clause 6b : les huit combinaisons rendent zéro intrus', () => {
  it.each(HUIT.map((d) => [nomDe(d), d] as const))(
    'profil sans contrainte, déjeuner, « %s » : tout plat affiché est du bon côté des trois axes',
    async (_nom, demande) => {
      const vue = await vueSous('dejeuner', demande)
      const db = ouvrirCatalogue()
      try {
        expect(vue.plats.length, 'aucun plat affiché : la clause ne mesure rien').toBeGreaterThan(0)
        expect(intrus(db, vue.plats, demande)).toEqual([])
      } finally {
        db.close()
      }
    }
  )
})

describe('retour-6 — clause 6c : le registre, et le garde-fou qu’on ne fait pas tomber', () => {
  it('la passe d’exclusion compte 8 couches, `craving` reste une couche de SCORE', async () => {
    const { EXCLUSION_LAYERS } = await import('../../app/src/engine/selection/exclusion-pass.js')
    const { SCORING_LAYERS } = await import('../../app/src/engine/selection/scoring-pass.js')
    const exclusion = EXCLUSION_LAYERS.map((c) => c.id)
    const score = SCORING_LAYERS.map((c) => c.id)

    expect(
      exclusion.length,
      'la 8ᵉ couche d’exclusion — celle qui lit `context.envie` — n’existe pas'
    ).toBe(8)
    expect(
      exclusion.slice(0, 7),
      'les sept couches existantes ont changé d’ordre ou de nom'
    ).toEqual(['allergenes', 'regime', 'exclusions', 'requis', 'temps', 'equipement', 'favoris'])
    expect(
      score,
      '`craving` a quitté les couches de score — `assertScoringLayersNeverExclude` (guards/index.ts:118) est un garde-fou de SÉCURITÉ, il ne se contourne pas pour un confort d’ergonomie'
    ).toContain('craving')
    expect(exclusion, '`craving` a été dupliquée en couche d’exclusion sous son propre nom').not.toContain(
      'craving'
    )
  })
})

// ------------------------------------------------------------------------------------------
// CLAUSE 7 — c'est le MOTEUR qui retire, pas l'écran après coup (ROUGE aujourd'hui)
// ------------------------------------------------------------------------------------------

describe('retour-6 — clause 7 : le moteur seul retire, sans écran monté', () => {
  it('« Consistant + Froid + Salé » au déjeuner, `suggestMeals` nu : les 11 du catalogue, et eux seuls', async () => {
    const { createEngine } = await import('../../app/src/engine/api/index.js')
    const { PROFIL_PAR_DEFAUT } = await import('../../app/src/ui/socle.js')
    const demande: Demande = { legerConsistant: 1, chaudFroid: -1, sucreSale: -1 }
    const catalogue = catalogueDeTest()
    const { suggestions } = createEngine(catalogue).suggestMeals({
      profile: PROFIL_PAR_DEFAUT,
      constraints: { allergies: [], diet: null, excludedFoodIds: [], ownedEquipmentIds: null, admittedFoodIds: [] },
      context: {
        creneau: 'dejeuner',
        date: '2026-09-09',
        tempsDisponibleMin: null,
        envie: { legerConsistant: 1, chaudFroid: -1, sucreSale: -1 },
        pantryFoodIds: [],
        requiredFoodIds: [],
      },
      history: { windowDays: 21, entries: [] },
      preferences: new Map(),
      favoriteRecipeIds: new Set(),
      tolerancePiquant: null,
      activeTopics: [],
      // Bien au-dessus des 194 recettes du créneau : aucune troncature ne peut cacher un intrus.
      limit: 500,
      seed: 1,
    })
    // ⚠️ Aucun des 11 n'est un plat simple (mesuré le 2026-09-10) : le filtre `estPlatSimple` de
    // l'écran ne peut donc pas séparer ce que rend le moteur de ce que ce test attend.
    const plats = suggestions.map((s) => catalogue.recipes.get(s.recipeId)?.nom ?? s.recipeId)
    const db = ouvrirCatalogue()
    try {
      const attendus = oracle(db, 'dejeuner', demande)
      expect(
        plats.length,
        'le moteur rend tout le créneau : le filtre vit ailleurs — dans l’écran, après coup'
      ).toBeLessThanOrEqual(attendus.length)
      expect(intrus(db, plats, demande), 'le moteur rend des plats hors filtre').toEqual([])
      expect([...plats].sort(), 'le moteur ne rend pas exactement les recettes que le SQL désigne').toEqual(
        attendus
      )
    } finally {
      db.close()
    }
  })
})
