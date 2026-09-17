// @vitest-environment jsdom
//
// tests/scelles/lot-B.test.tsx — l'examen du lot B : « épurer, les quatre interrupteurs ».
// Écrit depuis le « Fini quand » de docs/CONCEPTION_RETOURS_APK.md, AVANT la première ligne de code.
//
// CE QUE CE FICHIER MESURE, ET POURQUOI DE CETTE FAÇON :
//
// ⭐ L'ABSENCE SE LIT DANS `document.body.textContent`, PAS DANS `queryByText`. C'est la leçon du
//    lot A transposée : une clause qui cherche mollement applaudit un correctif qui ne change rien.
//    `queryByText('Rien n’est envoyé nulle part')` rend `null` dès que la phrase est coupée en deux
//    `<span>` — et un œil humain, lui, la lit toujours. `textContent` recolle ce que le DOM sépare,
//    et il ignore la feuille de style : un texte « masqué » en CSS (`hidden`, hauteur nulle,
//    `sr-only`) y reste, donc une épure de façade rougit ici.
//
// ⭐ LA PREUVE QUE RIEN N'A ÉTÉ SUPPRIMÉ EST UN ALLER-RETOUR, PAS UNE LECTURE DE SOURCE. Le lot dit
//    « masquer, jamais supprimer » (décision 2.c). Une implémentation qui EFFACE les explications du
//    moteur ferait passer toutes les clauses d'absence. Seule la clause qui coche le réglage et
//    redemande le texte la distingue d'une vraie mise en interrupteur.
//
// ⭐ LES QUATRE INTERRUPTEURS SE RETOURNENT À L'EXÉCUTION, ET C'EST LE CŒUR DU FICHIER.
//    Corrigé au premier tour d'attaque (2026-09-13). La version précédente ne vérifiait, pour les
//    interrupteurs 2, 3 et 4, que la DÉCLARATION du nom dans `ui/epure.ts` et sa CITATION dans le
//    fichier de l'écran. Le critique a exhibé une implémentation qui passait les 25 clauses en
//    EFFAÇANT les textes en dur et en laissant `epure.ts` mort : quatre constantes que personne ne
//    lit, citées par un commentaire. Trois des quatre interrupteurs du lot ne reposaient sur rien.
//    → `epure` est donc un objet de quatre `boolean` MUTABLES, que les clauses 5c/5d/8e/8f
//      retournent avant de monter l'écran. Un texte effacé en dur ne revient pas : elles rougissent.
//    ⛔ NE PAS le figer (`Object.freeze`) ni le rendre `readonly` : ces clauses sont sa raison d'être.
//
// ⛔ CE QUE CE FICHIER NE PROUVE TOUJOURS PAS. Que chaque interrupteur commande EXACTEMENT le bloc
//    qui lui a été assigné, et lui seul. Un écran qui masquerait ses phrases de réassurance derrière
//    `explicationsMoteur` au lieu de `phrasesRassurantes` ferait rougir les clauses d'absence, donc
//    la confusion se voit — mais deux interrupteurs câblés au même bloc, aucune clause ne les
//    sépare. Ça se relit sur le diff, pas au vert.
//
// ⚠️ SEPT CLAUSES SONT VERTES LE JOUR OÙ ON LES ÉCRIT, ET C'EST DÉCLARÉ, PAS SUBI :
//    - `garde A/B/C` — elles ne décrivent aucun défaut. Elles disent ce qu'un correctif trop large
//      casserait (principe 1, et l'avertissement de liste coupée du frigo).
//    - `clause 1b` — « aucun AUTRE fichier ne redéclare un interrupteur ». Vraie par vacuité tant
//      qu'`epure.ts` n'existe pas ; elle ne mord qu'après.
//    - `clauses 5 / 5b / 8b` — des clauses de RETOUR appariées à 4a/4b/4c/8a. Chacune ne discrimine
//      qu'une fois sa jumelle d'absence devenue verte. Prises seules elles ne prouvent rien ; prises
//      en paire elles séparent « masqué » de « supprimé ».
//      (Les quatre autres retours — 5c/5d/8e/8f — sont ROUGES aujourd'hui : elles importent
//      `ui/epure.ts`, qui n'existe pas encore.)
//
// ⚠️ HORLOGE FIGÉE (`toFake: ['Date']` ET RIEN D'AUTRE — figer `setTimeout` fait pendre `findBy*`).
//    L'écran « Aujourd'hui » déduit son créneau de `new Date().getHours()` et le moteur classe à
//    graine reproductible : sans horloge figée, ce fichier mesurerait la machine, pas le code. C'est
//    le défaut que `retour-5d` a payé.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { FoodId, Recipe, RecipeId } from '../../app/src/engine/domain/index.js'
import { EXPLANATION_LABELS } from '../../app/src/engine/selection/explain.js'
import { MIGRATIONS, USER_SCHEMA_VERSION } from '../../app/src/data/user-schema.js'
import {
  readDisplay,
  recordMeal,
  writeDisplay,
  writePantry,
  writeRythme,
} from '../../app/src/data/user-store.js'
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

/** Mardi, midi : créneau « déjeuner » (bascule à 14 h), jour ouvré, hors des bornes de saison. */
const INSTANT = '2026-09-15T12:00:00.000Z'

// --- Lecture des sources -------------------------------------------------------------------------

/**
 * ⚠️ `process.cwd()` ET PAS `import.meta.url`. Sous l'environnement jsdom, `import.meta.url` n'est
 * pas une URL `file:` et `fileURLToPath` lève — piège payé en écrivant `lot-A.test.tsx`.
 * `vitest.config.ts` ne pose PAS `root: 'app'` (volontairement), donc le cwd est la racine du dépôt.
 */
const RACINE_SRC = process.cwd().replace(/\\/g, '/').replace(/\/$/, '') + '/app/src/'

const CHEMIN_EPURE = RACINE_SRC + 'ui/epure.ts'

const lireSource = (cheminRelatif: string): string =>
  readFileSync(RACINE_SRC + cheminRelatif, 'utf8')

/** Tous les `.ts`/`.tsx` de `app/src`, récursivement, chemins relatifs à `app/src/`. */
function fichiersDuCode(dossier = ''): readonly string[] {
  const entrees = readdirSync(RACINE_SRC + dossier, { withFileTypes: true })
  return entrees.flatMap((entree) => {
    const chemin = dossier === '' ? entree.name : `${dossier}/${entree.name}`
    if (entree.isDirectory()) return fichiersDuCode(chemin)
    return /\.tsx?$/.test(entree.name) ? [chemin] : []
  })
}

const INTERRUPTEURS = [
  'explicationsMoteur',
  'phrasesRassurantes',
  'valeursNutritionnelles',
  'jaugesEtCompteurs',
] as const

/** Quel écran doit NOMMER quel interrupteur — point 2 du « Fini quand ». */
const ECRANS_PAR_INTERRUPTEUR: Readonly<Record<(typeof INTERRUPTEURS)[number], readonly string[]>> = {
  explicationsMoteur: ['ui/screens/aujourdhui.tsx', 'ui/screens/frigo.tsx'],
  phrasesRassurantes: [
    'ui/screens/parametres.tsx',
    'ui/screens/cuisine.tsx',
    'ui/screens/semaine.tsx',
    'ui/screens/detail-recette.tsx',
    'ui/screens/frigo.tsx',
    'ui/screens/aujourdhui.tsx',
  ],
  valeursNutritionnelles: ['ui/screens/detail-recette.tsx'],
  jaugesEtCompteurs: ['ui/screens/frigo.tsx'],
}

/**
 * L'objet des interrupteurs, relu APRÈS le `vi.resetModules()` du `beforeEach` — donc la MÊME
 * instance de module que celle que l'écran lira, puisque les écrans sont eux aussi importés
 * dynamiquement, et TOUJOURS après cet appel.
 *
 * ⭐ C'EST CE QUI REND LES INTERRUPTEURS 2, 3 ET 4 DÉMONTRABLES. Sans ce retour à l'exécution, une
 *    clause ne peut que relire le source, et une SUPPRESSION pure assortie d'une citation
 *    décorative dans le fichier de l'écran passe. C'est l'implémentation fausse qu'on a payée au
 *    premier tour d'attaque.
 *
 * ⚠️ TOUJOURS RETOURNER AVANT DE MONTER L'ÉCRAN. Si l'écran copiait la valeur au chargement de son
 *    module plutôt qu'au rendu, un retour tardif ne serait pas vu.
 */
async function interrupteurs(): Promise<Record<(typeof INTERRUPTEURS)[number], boolean>> {
  const module = await moduleDeSrc('ui/epure.js')
  return module.epure as Record<(typeof INTERRUPTEURS)[number], boolean>
}

/**
 * Importe un module de `app/src` par un spécificateur **calculé**, et non littéral.
 *
 * ⛔ PIÈGE PAYÉ LE 2026-09-13, ET IL COÛTAIT LE FICHIER ENTIER. Avec un `await import('…/epure.js')`
 *    écrit en clair, l'analyse statique de Vite résout l'import AU MOMENT DE LA TRANSFORMATION :
 *    tant que `ui/epure.ts` n'existe pas, la suite tombe sur « Failed to resolve import » et
 *    **aucune des vingt-neuf clauses ne s'exécute** — « Tests: no tests ». Un fichier qui ne
 *    s'exécute pas ne mesure rien : l'absence d'`epure.ts` doit rougir UNE clause, pas les rendre
 *    toutes muettes. Le tableau de chaînes et le `@vite-ignore` repoussent la résolution à
 *    l'exécution.
 */
async function moduleDeSrc(cheminRelatif: string): Promise<Record<string, unknown>> {
  const specificateur = ['..', '..', 'app', 'src', cheminRelatif].join('/')
  return (await import(/* @vite-ignore */ specificateur)) as Record<string, unknown>
}

// --- Lecture du rendu ----------------------------------------------------------------------------

/** Le texte que l'écran DONNE À LIRE, blancs normalisés. Voir l'en-tête : c'est la mesure du lot. */
const texteAffiche = (): string => (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()

/** Assertion nommée : le message d'échec dit la phrase, pas « expected false to be true ». */
function absentDeLEcran(fragment: string, ou: string): void {
  expect(texteAffiche().includes(fragment), `« ${fragment} » se lit encore sur ${ou}`).toBe(false)
}

function presentSurLEcran(fragment: string, ou: string): void {
  expect(texteAffiche().includes(fragment), `« ${fragment} » a disparu de ${ou}`).toBe(true)
}

/** Les sept libellés d'explication que le moteur sait produire (les `null` sont déjà muets). */
const LIBELLES_EXPLICATION: readonly string[] = Object.values(EXPLANATION_LABELS).filter(
  (libelle): libelle is string => libelle !== null
)

const libellesLus = (): readonly string[] =>
  LIBELLES_EXPLICATION.filter((libelle) => texteAffiche().includes(libelle))

// --- Semis ---------------------------------------------------------------------------------------

/**
 * Deux repas retenus dans les jours qui précèdent l'instant figé.
 *
 * ⚠️ SANS CE SEMIS, LE COMPTEUR D'HISTORIQUE N'EST PAS RENDU DU TOUT (`vue.nbRetenus > 0`) : une
 * clause d'absence serait verte sur une base neuve sans que le lot ait rien fait. Ce semis est ce
 * qui rend la clause capable d'échouer.
 */
function semerHistorique(): void {
  const ids = [...catalogueDeTest().recipes.keys()].slice(0, 2)
  recordMeal(baseCourante(), {
    date: '2026-09-14',
    creneau: 'dejeuner',
    recipeId: ids[0] as RecipeId,
    origine: 'choisi',
  })
  recordMeal(baseCourante(), {
    date: '2026-09-13',
    creneau: 'diner',
    recipeId: ids[1] as RecipeId,
    origine: 'choisi',
  })
}

/** Les `n` aliments les plus présents au catalogue — de quoi couvrir beaucoup de recettes. */
function alimentsLesPlusCourants(n: number): readonly FoodId[] {
  const compte = new Map<string, number>()
  for (const recette of catalogueDeTest().recipes.values())
    for (const ingredient of recette.ingredients)
      compte.set(ingredient.foodId, (compte.get(ingredient.foodId) ?? 0) + 1)
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([foodId]) => foodId as FoodId)
}

function semerGardeManger(n = 12): void {
  writePantry(
    baseCourante(),
    alimentsLesPlusCourants(n).map((foodId) => ({ foodId, quantiteApprox: null })),
    INSTANT
  )
}

/**
 * Une recette du catalogue réel qui porte la mention d'origine « maison, non encore testée ».
 * Cherchée, jamais nommée en dur : le catalogue est un chantier en cours (§8.2).
 */
function recetteMaisonNonTestee(): Recipe {
  const recette = [...catalogueDeTest().recipes.values()].find(
    (r) => r.origine === 'maison' && r.testeLe === null
  )
  if (recette === undefined)
    throw new Error('aucune recette « maison, non testée » au catalogue : la clause ne mesure rien')
  return recette
}

/** Une recette du catalogue qui porte une énergie par portion — pour la fenêtre des macros. */
function recetteAvecEnergie(): Recipe {
  const recette = [...catalogueDeTest().recipes.values()].find((r) => r.ingredients.length > 0)
  if (recette === undefined) throw new Error('catalogue vide')
  return recette
}

// --- Montages ------------------------------------------------------------------------------------

async function monterAujourdhui(): Promise<void> {
  const { Aujourdhui } = await import('../../app/src/ui/screens/aujourdhui.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Aujourdhui />
    </ProvenanceLancerParcours>
  )
  await screen.findByText(/sur \d+$/)
}

async function monterFrigo(): Promise<void> {
  const { Frigo } = await import('../../app/src/ui/screens/frigo.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Frigo />
    </ProvenanceLancerParcours>
  )
  await screen.findByRole('heading', { level: 1, name: /avez-vous sous la main/ })
}

async function monterSemaine(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Composer ma semaine')
  fireEvent.click(screen.getByText('Composer ma semaine'))
  await screen.findByText('Proposer une autre semaine')
}

async function monterParametres(): Promise<void> {
  const { Parametres } = await import('../../app/src/ui/screens/parametres.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Parametres />
    </ProvenanceLancerParcours>
  )
  await waitFor(() => {
    if (document.querySelector('h1') === null) throw new Error('écran pas encore monté')
  })
}

async function monterCuisine(recetteId = 'chakchouka'): Promise<void> {
  const { Cuisine } = await import('../../app/src/ui/screens/cuisine.js')
  render(<Cuisine plats={[{ id: recetteId, portions: null }]} />)
  await screen.findByRole('heading', { level: 1 })
}

async function monterRecette(recetteId: string): Promise<void> {
  const { DetailRecette } = await import('../../app/src/ui/screens/detail-recette.js')
  render(<DetailRecette recetteId={recetteId} origine="recettes" />)
  await screen.findByRole('heading', { level: 1 })
}

async function monterSavoir(): Promise<void> {
  const { Savoir } = await import('../../app/src/ui/screens/savoir.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Savoir />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Gestes de cuisine')
}

/**
 * Pilote l'écran « Aujourd'hui » DÉJÀ MONTÉ jusqu'à l'encart d'envie DÉPLIÉ.
 *
 * ⛔ PIÈGE PAYÉ EN ÉCRIVANT CE FICHIER. « Dites-moi ce que vous cherchez » est porté par DEUX
 *    éléments : le BOUTON qui ouvre l'encart (aujourdhui.tsx:738) et le TITRE de l'encart ouvert
 *    (:1047). Une boucle qui s'arrête au premier texte trouvé s'arrête sur le bouton, l'encart
 *    n'est jamais ouvert, et la clause d'absence est VERTE avant tout code. On attend donc une
 *    légende qui n'existe QUE dans l'encart déplié.
 *
 * On pilote jusqu'au CONTENU de l'encart, jamais jusqu'à la phrase qu'on veut voir disparaître :
 * sinon la boucle ne s'arrêterait plus une fois le lot livré. Même raison que
 * `ouvrirEncartParIndecision` dans `aujourdhui.test.tsx`.
 */
async function ouvrirEncartEnvie(): Promise<void> {
  const total = Number(screen.getByText(/^\d+ sur \d+$/).textContent!.split(' sur ')[1])
  for (let i = 0; i < total * 2; i++) {
    const declencheur = screen.queryByText('Dites-moi ce que vous cherchez')
    if (declencheur !== null && declencheur.tagName === 'BUTTON') {
      fireEvent.click(declencheur)
      break
    }
    fireEvent.click(screen.getByText(/Suivant/).closest('button')!)
  }
  await screen.findByText('Combien de temps devant vous ?')
}

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // ⚠️ `toFake: ['Date']` ET RIEN D'AUTRE : figer `setTimeout` ferait pendre `findBy*`.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(INSTANT))
  writeRythme(baseCourante(), { repasParJour: 2, tempsSemaineMin: null, tempsWeekendMin: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// =================================================================================================
// 1 et 2 — les quatre interrupteurs, et les écrans qui les nomment
// =================================================================================================

describe('lot B — les quatre interrupteurs vivent au même endroit', () => {
  it('clause 1 — `ui/epure.ts` déclare EXACTEMENT quatre interrupteurs, tous à `false`', () => {
    expect(
      existsSync(CHEMIN_EPURE),
      'app/src/ui/epure.ts n’existe pas : les interrupteurs sont dispersés ou absents'
    ).toBe(true)

    const source = readFileSync(CHEMIN_EPURE, 'utf8')

    for (const nom of INTERRUPTEURS) {
      const declaration = new RegExp(`^\\s*${nom}:\\s*false,?\\s*$`, 'm')
      expect(
        declaration.test(source),
        `« ${nom} » n’est pas déclaré à \`false\` sur une ligne à lui dans ui/epure.ts — ` +
          'le rallumer doit tenir en une ligne'
      ).toBe(true)
    }

    // Exactement quatre : un cinquième drapeau qui s'ajouterait ici sans passer par le brief
    // déplacerait la définition de l'épure sans que personne l'ait décidé.
    const declarations = source.match(/^\s*\w+:\s*(?:false|true),?\s*$/gm) ?? []
    expect(
      declarations.length,
      `ui/epure.ts déclare ${declarations.length} interrupteur(s) au lieu de 4 : ` +
        declarations.map((l) => l.trim()).join(' | ')
    ).toBe(4)
  })

  it('clause 1b — aucun autre fichier de `app/src` ne déclare un interrupteur d’épure', () => {
    const coupables: string[] = []
    for (const fichier of fichiersDuCode()) {
      if (fichier === 'ui/epure.ts') continue
      const source = lireSource(fichier)
      for (const nom of INTERRUPTEURS)
        if (new RegExp(`\\b${nom}\\s*[:=]\\s*(?:false|true)\\b`).test(source))
          coupables.push(`${fichier} (${nom})`)
    }
    expect(coupables, `un interrupteur est redéclaré hors de ui/epure.ts : ${coupables.join(', ')}`)
      .toEqual([])
  })

  it('clause 2 — chaque écran concerné NOMME l’interrupteur qui le commande', () => {
    // Un écran qui masque sans citer son interrupteur n'est pas réversible en une ligne : c'est
    // exactement ce que la décision 2.c interdit (« pas vingt conditions dispersées »).
    const manquants: string[] = []
    for (const nom of INTERRUPTEURS)
      for (const fichier of ECRANS_PAR_INTERRUPTEUR[nom])
        if (!lireSource(fichier).includes(nom)) manquants.push(`${fichier} ne cite pas ${nom}`)
    expect(manquants, manquants.join(' · ')).toEqual([])
  })
})

// =================================================================================================
// 3 — les six phrases de réassurance
// =================================================================================================

describe('lot B — les phrases de réassurance ne se lisent plus', () => {
  it('clause 3a — Paramètres ne dit plus « Rien n’est envoyé nulle part »', async () => {
    await monterParametres()
    absentDeLEcran('Tout se modifie à tout moment.', 'l’écran Paramètres')
    // ⚠️ APOSTROPHE DROITE (U+0027), c'est celle du source. Une apostrophe typographique ici rendrait
    // la clause VERTE avant tout code — elle ne chercherait rien qui existe.
    absentDeLEcran("Rien n'est envoyé nulle part.", 'l’écran Paramètres')
  })

  it('clause 3b — le mode cuisine ne parle plus de l’écran allumé', async () => {
    // ⚠️ LES TROIS BRANCHES DU MÊME `<p>`, PAS SEULEMENT LA PREMIÈRE. Sous jsdom, `ecranTenu` est
    // faux : c'est la variante « L'écran peut s'éteindre… » qui s'affiche. Une clause qui ne
    // chercherait que « L'écran reste allumé » serait VERTE aujourd'hui, avant tout code.
    await monterCuisine()
    expect(
      /L.écran (reste allumé|peut s.éteindre)/.test(texteAffiche()),
      'le mode cuisine parle encore de l’écran allumé'
    ).toBe(false)
  })

  it('clause 3c — la semaine ne dit plus « Vos repas gardés ne changeront pas »', async () => {
    await monterSemaine()
    absentDeLEcran('Vos repas gardés ne changeront pas.', 'l’écran Semaine')
  })

  it('clause 3d — la fiche recette ne porte plus sa mention d’origine', async () => {
    const recette = recetteMaisonNonTestee()
    await monterRecette(recette.id)
    absentDeLEcran('Recette écrite pour cette application', 'la fiche recette')
  })

  it('clause 3e — le frigo ne dit plus « Ajoutez ce qu’il vous reste »', async () => {
    await monterFrigo()
    absentDeLEcran("Ajoutez ce qu'il vous reste.", 'l’écran Vider le frigo')
    absentDeLEcran('On cherche des plats à faire avec.', 'l’écran Vider le frigo')
  })

  it('clause 3f — l’encart d’envie ne dit plus « Rien n’est obligatoire »', async () => {
    // ⚠️ DEUX FICHIERS PORTENT CES TROIS MOTS, ET UN SEUL EST VISÉ. Celui-ci vit dans
    //    `aujourdhui.tsx:1049`. L'AUTRE est dans `parametres.tsx:969`, collé à « Un repas sans heure
    //    n'est jamais rappelé. » — c'est une règle de fonctionnement, pas de la réassurance, et
    //    `garde C` refuse qu'on l'emporte. Ne pas chercher la phrase dans tout le dépôt.
    await monterAujourdhui()
    await ouvrirEncartEnvie()
    absentDeLEcran("Rien n'est obligatoire.", 'l’encart d’envie')
  })

  it(
    'clause 5c — INTERRUPTEUR 2 ALLUMÉ, les phrases REVIENNENT (Paramètres, cuisine, frigo)',
    async () => {
      // ⭐ LA CLAUSE QUI SÉPARE « MASQUÉ » DE « SUPPRIMÉ » POUR L'INTERRUPTEUR 2. Les clauses 3a à 3f
      //    sont toutes vertes sur une implémentation qui a effacé les six phrases en dur. Celle-ci
      //    retourne l'interrupteur et redemande le texte : un effacement ne revient pas.
      const commutateurs = await interrupteurs()
      commutateurs.phrasesRassurantes = true

      await monterParametres()
      presentSurLEcran('Tout se modifie à tout moment.', 'l’écran Paramètres')
      presentSurLEcran("Rien n'est envoyé nulle part.", 'l’écran Paramètres')
      cleanup()

      await monterCuisine()
      expect(
        /L.écran (reste allumé|peut s.éteindre)/.test(texteAffiche()),
        'interrupteur allumé, le mode cuisine ne reparle pas de l’écran : le texte a été supprimé'
      ).toBe(true)
      cleanup()

      await monterFrigo()
      presentSurLEcran("Ajoutez ce qu'il vous reste.", 'l’écran Vider le frigo')
    },
    20_000
  )

  it(
    'clause 5d — INTERRUPTEUR 2 ALLUMÉ, les phrases REVIENNENT (semaine, fiche, encart d’envie)',
    async () => {
      const commutateurs = await interrupteurs()
      commutateurs.phrasesRassurantes = true

      await monterSemaine()
      presentSurLEcran('Vos repas gardés ne changeront pas.', 'l’écran Semaine')
      cleanup()

      await monterRecette(recetteMaisonNonTestee().id)
      presentSurLEcran('Recette écrite pour cette application', 'la fiche recette')
      cleanup()

      await monterAujourdhui()
      await ouvrirEncartEnvie()
      presentSurLEcran("Rien n'est obligatoire.", 'l’encart d’envie')
    },
    20_000
  )
})

// =================================================================================================
// 4 et 5 — les explications du moteur, et la preuve qu'elles n'ont pas été supprimées
// =================================================================================================

describe('lot B — les explications du moteur sont éteintes, et rallumables', () => {
  it('clause 4a — « Aujourd’hui » ne cite AUCUN libellé d’explication', async () => {
    await monterAujourdhui()
    expect(
      libellesLus(),
      `l’écran cite encore des explications : ${libellesLus().join(' · ')}`
    ).toEqual([])
  })

  it('clause 4b — le compteur d’historique se tait, MALGRÉ deux repas retenus', async () => {
    semerHistorique()
    await monterAujourdhui()
    expect(
      /retenus? ces \d+ derniers jours/.test(texteAffiche()),
      'le compteur d’historique est encore affiché'
    ).toBe(false)
  })

  it('clause 4c — le frigo ne dit plus combien d’ingrédients il a reconnus', async () => {
    semerGardeManger()
    await monterFrigo()
    absentDeLEcran('déjà chez vous', 'l’écran Vider le frigo')
    absentDeLEcran('du poids du plat', 'l’écran Vider le frigo')
  })

  it('clause 5 — RÉGLAGE COCHÉ, les explications et le compteur REVIENNENT', async () => {
    // ⭐ LA CLAUSE QUI DISTINGUE « MASQUER » DE « SUPPRIMER ». Toutes les clauses d'absence
    //    ci-dessus seraient vertes sur une implémentation qui aurait effacé les phrases. Celle-ci,
    //    non : elle rend le réglage à l'utilisateur et redemande le texte.
    semerHistorique()
    writeDisplay(baseCourante(), { ...readDisplay(baseCourante()), afficherExplications: true })
    await monterAujourdhui()

    expect(
      libellesLus().length,
      'réglage coché, l’écran ne cite toujours aucune explication : elles ont été supprimées, ' +
        'pas masquées'
    ).toBeGreaterThan(0)
    expect(
      /retenus? ces \d+ derniers jours/.test(texteAffiche()),
      'réglage coché, le compteur d’historique ne revient pas'
    ).toBe(true)
  })

  it('clause 5b — RÉGLAGE COCHÉ, le frigo redit ce qu’il a reconnu', async () => {
    semerGardeManger()
    writeDisplay(baseCourante(), { ...readDisplay(baseCourante()), afficherExplications: true })
    await monterFrigo()
    presentSurLEcran('déjà chez vous', 'l’écran Vider le frigo')
  })
})

// =================================================================================================
// 6 et 7 — le réglage persisté, et sa case
// =================================================================================================

describe('lot B — le réglage « afficher les explications »', () => {
  it('clause 6a — décoché à l’installation, et lu par `readDisplay`', () => {
    expect(readDisplay(baseCourante()).afficherExplications).toBe(false)
  })

  it('clause 6b — l’écrire ne touche pas au réglage voisin `afficherMacros`', () => {
    // ⚠️ Le piège déjà payé sur ce projet : `writeDisplay` REMPLACE la ligne entière. Un appelant
    // qui passe un objet partiel éteint silencieusement les autres réglages.
    const db = baseCourante()
    writeDisplay(db, { ...readDisplay(db), afficherMacros: true })
    writeDisplay(db, { ...readDisplay(db), afficherExplications: true })

    const relu = readDisplay(db)
    expect(relu.afficherExplications).toBe(true)
    expect(relu.afficherMacros, 'écrire un réglage en a éteint un autre').toBe(true)
  })

  it('clause 6c — la v21 AJOUTE une colonne, elle ne réécrit aucune table', () => {
    expect(USER_SCHEMA_VERSION).toBe(21)
    const v21 = MIGRATIONS.find((m) => m.version === 21)
    expect(v21, 'aucune migration v21 déclarée dans MIGRATIONS').toBeDefined()

    const ordres = (v21?.statements ?? []).join('\n')
    expect(
      /ALTER TABLE\s+user_display\s+ADD COLUMN\s+afficher_explications/i.test(ordres),
      'la v21 n’ajoute pas la colonne `afficher_explications` à `user_display`'
    ).toBe(true)
    // ⛔ Les données de l'utilisateur ne se recréent pas pour un réglage d'affichage. La v19 a eu
    //    besoin d'une recréation de table à cause d'un `CHECK` ; ici il n'y a rien à reprendre.
    expect(
      /\b(DROP TABLE|CREATE TABLE|DELETE FROM)\b/i.test(ordres),
      'la v21 détruit ou recrée une table pour ajouter un booléen'
    ).toBe(false)
  })

  it('clause 7 — la case est dans « Réglages d’affichage » et écrit en base', async () => {
    await monterParametres()
    fireEvent.click(screen.getByText("Réglages d'affichage"))
    const panneau = within(screen.getByRole('dialog'))

    // ⚠️ LIBELLÉ EXACT, PAS `getByText(/explications/i)`. Le panneau contient déjà « Les valeurs
    //    nutritionnelles sur la fiche d'une recette… » ; une recherche floue tomberait sur un
    //    « multiple elements found » dès que le codeur écrit une description, et l'échec ne
    //    parlerait plus du lot. Le libellé est fixé par le « Fini quand », il ne se devine pas.
    const case_ = panneau.getByRole('button', {
      name: /^Afficher les explications sous chaque plat/,
    })
    expect(case_.getAttribute('aria-pressed'), 'la case ne part pas décochée').toBe('false')

    fireEvent.click(case_)
    await waitFor(() => expect(readDisplay(baseCourante()).afficherExplications).toBe(true))
    // La case REFLÈTE le réglage : une case qui écrit sans se cocher n'est pas un réglage.
    expect(case_.getAttribute('aria-pressed'), 'la case n’a pas suivi ce qu’elle a écrit').toBe('true')
    // Le réglage voisin n'a pas bougé sous le clic.
    expect(readDisplay(baseCourante()).afficherMacros).toBe(false)
  })
})

// =================================================================================================
// 8 — la ligne des valeurs nutritionnelles, les jauges, et les garde-fous
// =================================================================================================

describe('lot B — la ligne « Valeurs nutritionnelles »', () => {
  it('clause 8a — absente tant que les macros sont décochées', async () => {
    await monterRecette(recetteAvecEnergie().id)
    absentDeLEcran('Valeurs nutritionnelles', 'la fiche recette')
    absentDeLEcran('Non affichées', 'la fiche recette')
  })

  it('clause 8b — MACROS COCHÉES, la ligne revient', async () => {
    // ⛔ Sans cette clause, une épure qui retire la ligne DANS LES DEUX CAS rendrait les macros
    //    inatteignables depuis la fiche : le réglage existerait sans rien commander de visible.
    writeDisplay(baseCourante(), { ...readDisplay(baseCourante()), afficherMacros: true })
    await monterRecette(recetteAvecEnergie().id)
    presentSurLEcran('Valeurs nutritionnelles', 'la fiche recette')
  })

  it('clause 8e — INTERRUPTEUR 3 ALLUMÉ, la ligne revient MÊME macros décochées', async () => {
    // ⭐ LA CLAUSE QUI SÉPARE L'INTERRUPTEUR 3 DU RÉGLAGE `afficherMacros`, QUI EXISTAIT AVANT LE
    //    LOT. Sans elle, 8a et 8b sont toutes deux vertes sur une implémentation qui a simplement
    //    enveloppé la ligne dans `{afficherMacros && …}` sans jamais lire `valeursNutritionnelles` :
    //    le lot aurait alors livré un interrupteur qui ne commande rien. Les trois clauses prises
    //    ensemble épuisent la table de vérité : (off, off) absent · (off, on) présent · (on, off)
    //    présent — et c'est la troisième ligne qui n'est vraie que si l'interrupteur est branché.
    const commutateurs = await interrupteurs()
    commutateurs.valeursNutritionnelles = true

    expect(readDisplay(baseCourante()).afficherMacros, 'le semis est faux : macros déjà cochées')
      .toBe(false)
    await monterRecette(recetteAvecEnergie().id)
    presentSurLEcran('Valeurs nutritionnelles', 'la fiche recette')
    presentSurLEcran('Non affichées', 'la fiche recette')
  })
})

describe('lot B — les jauges et les compteurs du frigo', () => {
  it('clause 8c — plus de barre de couverture', async () => {
    semerGardeManger()
    await monterFrigo()
    const jauges = [...document.querySelectorAll('[role="img"]')].filter((el) =>
      (el.getAttribute('aria-label') ?? '').endsWith('% du poids du plat')
    )
    expect(jauges.length, `${jauges.length} barre(s) de couverture encore rendue(s)`).toBe(0)
  })

  it('clause 8d — plus de compte brut de recettes, et aucune ligne qui commence par un tiret', async () => {
    semerGardeManger()
    await monterFrigo()
    // ⛔ PIÈGE PAYÉ EN ÉCRIVANT CE FICHIER. `textContent` ne met AUCUN blanc entre deux éléments
    //    voisins : l'écran rend « …Plus de filtres›255 recettes — les 30 mieux couvertes… ». Une
    //    clause qui exigeait un blanc devant le nombre était VERTE avant tout code.
    expect(
      /\d+ recettes? /.test(texteAffiche()),
      'le nombre brut de recettes trouvées est encore affiché'
    ).toBe(false)
    const orphelines = [...document.querySelectorAll('p')].filter((p) =>
      (p.textContent ?? '').trim().startsWith('—')
    )
    expect(orphelines.length, 'une ligne commence par un tiret devenu orphelin').toBe(0)
  })

  it('clause 8f — INTERRUPTEUR 4 ALLUMÉ, la jauge et le compte REVIENNENT', async () => {
    // ⭐ LA CLAUSE QUI SÉPARE « MASQUÉ » DE « SUPPRIMÉ » POUR L'INTERRUPTEUR 4. 8c et 8d sont vertes
    //    sur une implémentation qui a effacé la barre et le nombre en dur.
    const commutateurs = await interrupteurs()
    commutateurs.jaugesEtCompteurs = true

    semerGardeManger()
    await monterFrigo()

    const jauges = [...document.querySelectorAll('[role="img"]')].filter((el) =>
      (el.getAttribute('aria-label') ?? '').endsWith('% du poids du plat')
    )
    expect(
      jauges.length,
      'interrupteur allumé, aucune barre de couverture ne revient : elles ont été supprimées'
    ).toBeGreaterThan(0)
    expect(
      /\d+ recettes? /.test(texteAffiche()),
      'interrupteur allumé, le compte de recettes ne revient pas'
    ).toBe(true)
  })
})

describe('lot B — GARDES : ce que l’épure ne doit PAS emporter', () => {
  // ⚠️ CES TROIS CLAUSES SONT VERTES AUJOURD'HUI, ET C'EST LEUR RÔLE. Elles ne décrivent pas un
  //    défaut à corriger : elles décrivent ce qu'un correctif trop large casserait. Le principe 1
  //    (sécurité de l'utilisateur) passe avant l'épure.

  it('garde A — « Savoir » garde ses avertissements sanitaires et de souveraineté', async () => {
    await monterSavoir()
    presentSurLEcran('ne remplace pas un professionnel de santé', 'l’écran Savoir')
    presentSurLEcran('Tout reste sur cet appareil.', 'l’écran Savoir')
  })

  it('garde B — le frigo dit toujours que sa liste est coupée', async () => {
    semerGardeManger()
    await monterFrigo()
    presentSurLEcran('mieux couvertes sont affichées', 'l’écran Vider le frigo')
  })

  it('garde C — Paramètres garde la règle des rappels sans heure', async () => {
    await monterParametres()
    fireEvent.click(screen.getByText('Rappels'))
    const panneau = within(screen.getByRole('dialog'))
    expect(
      panneau.getByText(/Un repas sans heure n.est jamais rappelé/),
      'la règle de fonctionnement des rappels est partie avec la réassurance'
    ).toBeDefined()
  })
})
