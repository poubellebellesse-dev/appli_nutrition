// @vitest-environment jsdom
//
// tests/scelles/retour-3.test.tsx — l'examen du lot `retour-3` : « je mange dehors » ÉTIQUETTE le
// créneau (décision 76), depuis la Semaine ET depuis Aujourd'hui, sans une seule frappe.
//
// ⛔ IL DOIT ÊTRE ROUGE LE JOUR OÙ ON L'ÉCRIT. Ce qui a été MESURÉ le 2026-08-22 sur `6aad49c` :
//   · le mot « dehors » n'apparaît dans AUCUN texte affiché de l'application. Une seule occurrence
//     dans tout `app/src/` — un commentaire de `semaine.tsx`.
//   · le seul chemin existant vers l'état hors-catalogue est `Choisir` → onglet « Un plat préparé »
//     → TAPER un libellé → valider. Trois clics ET une frappe, sur le seul écran Semaine.
//   · `aujourdhui.tsx` NE CONNAÎT PAS LA SEMAINE : `readPlan`, `readLatestPlan` et `savePlan` y ont
//     zéro occurrence. Aucun geste de cet écran ne peut donc toucher au plan aujourd'hui.
//   · rien ne défait le geste — `setSlotHorsCatalogue` n'a aucune réciproque à l'écran.
//
// ---------------------------------------------------------------------------------------------
// COMMENT CE FICHIER SE DÉFEND
//
// ⛔ IL NE PRESCRIT AUCUN LIBELLÉ, AUCUN EMPLACEMENT, AUCUN COMPOSANT. Le « Fini quand » borne le
// COÛT du geste, pas sa forme : le fichier CHERCHE un chemin d'au plus 2 clics parmi les contrôles
// VISIBLES, en remontant l'écran à neuf entre chaque sonde. Un quatrième bouton sur la carte, une
// entrée de fenêtre, un appui long transformé en bouton — tout passe, tant que ça coûte deux clics.
// Ce qui est imposé, et c'est la décision 76 en toutes lettres, c'est que le mot « dehors » soit
// AFFICHÉ sur le chemin : sans lui, le geste existe mais personne ne le trouve.
//
// ⛔ LA MESURE SE FAIT EN BASE, JAMAIS DANS L'ÉTAT REACT NI DANS LE DOM. Chaque clause relit
// `readLatestPlan(baseCourante())`. Un écran qui afficherait « dehors » sans rien écrire passerait
// n'importe quel `getByText` ; il ne passe pas une relecture de `user.db`.
//
// ⛔ LA CLAUSE 3 EST LE PIÈGE PRINCIPAL, ET IL EST TENDU EXPRÈS. Une implémentation qui fabriquerait
// l'entrée à la main puis appellerait `savePlan` — sans passer par `setSlotHorsCatalogue` — LAISSE
// L'ACCOMPAGNEMENT sur le créneau. Les 14 créneaux du plan de test en portent un (mesuré). La
// clause exige donc UNE SEULE entrée après le geste : c'est le témoin que l'écriture est passée par
// le moteur, et aucun raccourci ne le produit par accident.
//
// ⛔ LE LIBELLÉ STOCKÉ EST CELUI QU'ON LIT À L'ÉCRAN, AU CARACTÈRE PRÈS — fermeture d'une triche
// trouvée par la relecture adverse du 2026-08-22. Aucune migration n'étant permise (clause 8), il
// n'y a pas de colonne où ranger « quel plat il y avait avant » ; la tentation est d'encoder l'id
// DANS le libellé (`« Dehors§poulet_curry »` en base, `« Dehors »` à l'écran) et de le redécouper
// pour annuler. `hors_catalogue` est un texte LIBRE ÉCRIT ET RELU PAR L'UTILISATEUR : y cacher un
// identifiant en fait un canal de stockage technique qui ressortira le jour où un autre écran
// l'affichera brut. La clause 1 relit donc l'écran Semaine et exige d'y retrouver la valeur EXACTE
// de la base.
//
// ⛔ LA CLAUSE 4 REFUSE LE FAUX ANNULER. « Choisir » → cliquer le nom du plat d'origine dans la
// liste RESTAURE bel et bien `recipeId` en deux clics — et ce n'est pas un annuler, c'est demander
// à l'utilisateur de se souvenir de ce qu'il avait. Le chemin trouvé sur le premier créneau est
// donc REJOUÉ À L'IDENTIQUE, étiquette par étiquette, sur deux autres créneaux d'autres journées
// portant d'autres plats. Un chemin qui nomme un plat ne survit pas au rejeu.
// ⛔ ET ELLE NE SE CONTENTE PAS DE DEUX CHAMPS — seconde fermeture du 2026-08-22. Rendre
// `recipeId` et remettre `horsCatalogue` à `null` à la main, sans repasser par le moteur, laisse
// `portions: 0` (`setSlotHorsCatalogue` l'a mis à zéro) : le plat « restauré » ne produit alors
// AUCUNE portion, donc aucun ingrédient à acheter et aucun reste. Invisible pour qui ne regarde
// que deux champs, immédiat à l'usage. La clause exige donc les `portions` que le catalogue
// annonce pour cette recette, et la cohérence entre `service` et le nombre d'entrées —
// l'invariant que `reposerLeCreneau` maintient lui-même (« `'plat'` seulement s'il y a bien une
// seconde entrée derrière »).
//
// ⛔ LA CLAUSE 3 RELIT LA FORME ENTIÈRE DE L'ENTRÉE MARQUÉE, PAS DEUX CHAMPS — troisième
// fermeture, seconde relecture adverse du 2026-08-22. VÉRIFIÉ : aucune des neuf clauses ne relisait
// `portions` sur le chemin ALLER. Une écriture à la main pouvait retirer l'accompagnement, vider
// `recipeId`, poser le libellé — et laisser `portions` à 4. Personne ne l'aurait vu : la liste de
// courses filtre sur `recipeId === null`, le plancher calorique lit `horsCatalogue`, et l'annuler de
// la clause 4 rétablit `portionsBase`, soit la même valeur. Le trou se refermait tout seul au
// retour. `portions`, `isLeftover`, `locked`, `recipeId` et le libellé sont donc tous relus à
// l'aller — la clause 4 fait déjà la même chose au retour.
//
// ⛔ LA CLAUSE 8 GARDE LA LECTURE A DE LA DÉCISION 76, CELLE QUI A ÉTÉ ÉCARTÉE. Étiqueter un
// créneau NE DOIT NI écrire dans `meal_history` (« ce plat a été retenu », jamais « voici ce que tu
// as mangé »), NI demander une migration : la version de schéma reste celle d'avant, et la
// contrainte de la v9 continue de refuser un créneau qui porterait un plat ET une étiquette.
//
// ⚠️ LES RÉGLAGES PERSISTANTS QUE CES DEUX ÉCRANS LISENT SONT NOMMÉS ICI, ET NON DEVINÉS — c'est la
// dette ouverte par `retour-2` (`ETAT.md` §8). `user_rythme.repasParJour` DÉCIDE QUELS CRÉNEAUX
// EXISTENT : la clause 1 le fait donc varier entre 2 et 3, SUR LES DEUX ÉCRANS. ⚠️ Le brief disait
// « entre 2 et 4 » ; MESURÉ le 2026-08-22, la base en refuse 4 — `user_rythme` porte
// `CHECK (repas_par_jour BETWEEN 1 AND 3)` (`user-schema.ts:356`), et `creneauxDuRythme` retombe
// silencieusement sur 2 hors de cette plage. 2 et 3 sont donc les DEUX SEULES valeurs qui changent
// la liste des créneaux : 3 ajoute le goûter. `user_meal_time`
// décide des rappels (clause 6), `user_profile` du plancher calorique (clause 7). L'horloge est
// FIGÉE : `aujourdhui.tsx` lit `new Date().getHours()` pour choisir le repas du moment, et
// `aujourdhuiIso()` lit la date du jour — sans horloge fixe, ce fichier changerait de créneau selon
// l'heure d'exécution, et de journée à minuit.
//
// ⚠️ AUCUN IDENTIFIANT DE RECETTE, AUCUN EFFECTIF ÉCRIT EN DUR. Les créneaux visés sont DÉDUITS du
// plan que le moteur compose sur le `catalog.db` réel. Si le catalogue change au point de ne plus
// fournir de créneau candidat, le message le dit — et dit que c'est le semis, pas la clause.
//
// ⚠️ CE QU'AUCUNE DE CES NEUF CLAUSES NE DÉMONTRERA : que le geste se TROUVE sur un téléphone. Un
// contrôle atteignable en deux clics par `querySelectorAll` peut être illisible, hors écran ou
// perdu au fond d'une fenêtre. Cela rejoint la passe à l'œil de `CONCEPTION_RETOURS_TEST.md` §3.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type {
  FoodId,
  MealPlanEntry,
  MealSlot,
  RecipeId,
  SlotRef,
  WeekPlan,
} from '../../app/src/engine/domain/index.js'
import { createEngine } from '../../app/src/engine/api/index.js'
import { USER_SCHEMA_VERSION } from '../../app/src/data/user-schema.js'
import {
  readLatestPlan,
  readMealTimes,
  readUserState,
  savePlan,
  writeMealTime,
  writeRythme,
} from '../../app/src/data/user-store.js'
import { rappelsDuPlan } from '../../app/src/ui/rappel.js'
import { TITRE_CRENEAU, creneauxDuRythme } from '../../app/src/ui/creneau.js'
import {
  FENETRE_HISTORIQUE_JOURS,
  LIBELLE_CRENEAU,
  PROFIL_PAR_DEFAUT,
  formaterJour,
} from '../../app/src/ui/socle.js'
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
}))

/** Le jour du test. Choisi, pas tiré : tout le fichier en dépend. */
const JOUR0 = '2026-03-10'
/** Midi UTC — assez loin de minuit pour qu'aucun fuseau ne fasse changer `aujourdhuiIso()` de jour. */
const INSTANT = '2026-03-10T12:00:00Z'

/** Heures de repas déclarées, pour que la clause 6 ait des rappels à comparer. */
const HEURES: Readonly<Record<MealSlot, number>> = {
  petit_dejeuner: 8 * 60,
  dejeuner: 12 * 60,
  gouter: 16 * 60,
  diner: 19 * 60,
}

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
  // ⚠️ `toFake: ['Date']` ET RIEN D'AUTRE. Figer `setTimeout` ferait pendre `findBy*`, qui sonde le
  // DOM sur une vraie boucle d'événements. Seule l'horloge murale doit s'arrêter.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(INSTANT))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// --- Le semis ---------------------------------------------------------------------------------

const cleDe = (slot: SlotRef): string => `${slot.date}|${slot.creneau}`

/**
 * Écrit dans `user.db` un plan que l'écran Semaine aurait pu composer lui-même — mêmes appels, même
 * ordre, graine fixe. Passer par le semis plutôt que par « Composer ma semaine » rend chaque
 * remontage instantané : ce fichier en fait des dizaines.
 */
function semer(repasParJour: number): WeekPlan {
  const db = baseCourante()
  const creneaux = creneauxDuRythme(repasParJour)
  writeRythme(db, { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
  for (const creneau of creneaux) writeMealTime(db, creneau, HEURES[creneau])

  const cat = catalogueDeTest()
  const moteur = createEngine(cat)
  const etat = readUserState(db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: JOUR0 }, cat.foods)
  const brut = moteur.planWeek({
    profile: PROFIL_PAR_DEFAUT,
    constraints: etat.constraints,
    tolerancePiquant: etat.tolerancePiquant,
    startDate: JOUR0,
    days: 7,
    slots: creneaux,
    history: etat.history,
    activeTopics: etat.activeTopics,
    convives: 1,
    seed: 1,
  })
  const plan = moteur.planLeftovers(brut, PROFIL_PAR_DEFAUT, 1)
  savePlan(db, plan, INSTANT)
  return plan
}

function planEnBase(): WeekPlan {
  const plan = readLatestPlan(baseCourante())
  if (plan === null) {
    throw new Error('retour-3 · le semis n’a écrit aucun plan — ce n’est pas la clause qui échoue.')
  }
  return plan
}

const duCreneau = (plan: WeekPlan, slot: SlotRef): readonly MealPlanEntry[] =>
  plan.entries.filter((e) => cleDe(e.slot) === cleDe(slot))

const principale = (plan: WeekPlan, slot: SlotRef): MealPlanEntry | undefined =>
  duCreneau(plan, slot).find((e) => e.service !== 'accompagnement')

interface Cible {
  readonly slot: SlotRef
  readonly recipeId: RecipeId
}

/**
 * Les créneaux sur lesquels le geste a un sens : un PLAT posé (pas un reste — l'annuler de la
 * clause 4 ne peut pas rendre un reste), non verrouillé, et ACCOMPAGNÉ, sans quoi la clause 3 ne
 * mesurerait rien.
 */
function ciblesDe(plan: WeekPlan): readonly Cible[] {
  const accompagnes = new Set(
    plan.entries.filter((e) => e.service === 'accompagnement').map((e) => cleDe(e.slot))
  )
  return plan.entries
    .filter(
      (e) =>
        e.service === 'plat' &&
        !e.isLeftover &&
        !e.locked &&
        e.recipeId !== null &&
        accompagnes.has(cleDe(e.slot))
    )
    .map((e) => ({ slot: e.slot, recipeId: e.recipeId as RecipeId }))
}

function exigerCibles(plan: WeekPlan, combien: number, journeesDistinctes: boolean): readonly Cible[] {
  const toutes = ciblesDe(plan)
  const retenues = journeesDistinctes
    ? toutes.filter((c, i) => toutes.findIndex((a) => a.slot.date === c.slot.date) === i)
    : toutes
  if (retenues.length < combien) {
    throw new Error(
      `retour-3 · SEMIS INSUFFISANT, PAS CLAUSE FAUSSE : le plan composé sur le catalogue réel ne ` +
        `fournit que ${retenues.length} créneau(x) candidat(s)` +
        `${journeesDistinctes ? ' sur des journées distinctes' : ''}, il en faut ${combien}. ` +
        `Un créneau candidat porte un plat non-reste, non verrouillé et accompagné.`
    )
  }
  return retenues.slice(0, combien)
}

// --- Monter les écrans ------------------------------------------------------------------------

/**
 * ⚠️ IMPORTS DYNAMIQUES, APRÈS `vi.resetModules()` — un import statique figerait un contexte React
 * distinct de celui que l'écran utilise dans son lien de tutoriel.
 */
async function monterSemaine(): Promise<void> {
  const { Semaine } = await import('../../app/src/ui/screens/semaine.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Semaine />
    </ProvenanceLancerParcours>
  )
  await screen.findByText('Proposer une autre semaine')
}

async function monterAujourdhui(creneau: MealSlot | null): Promise<void> {
  const { Aujourdhui } = await import('../../app/src/ui/screens/aujourdhui.js')
  const { ProvenanceLancerParcours } = await import('../../app/src/ui/lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Aujourdhui />
    </ProvenanceLancerParcours>
  )
  await screen.findByText(/sur \d+$/)
  if (creneau === null) return
  // Choisir le repas affiché est de la NAVIGATION, pas le geste : ce clic n'entre pas au budget.
  // La pastille se distingue du titre de l'écran, qui porte le même texte, par son `aria-pressed`.
  const pastille = screen
    .queryAllByText(TITRE_CRENEAU[creneau])
    .map((n) => n.closest('button'))
    .find((b) => b !== null && b.hasAttribute('aria-pressed'))
  if (pastille) {
    fireEvent.click(pastille)
    await screen.findByText(/sur \d+$/)
  }
}

/** La carte d'un créneau sur l'écran Semaine : le libellé du repas en est un enfant direct. */
function carteDuCreneau(slot: SlotRef): HTMLElement {
  const journee = screen.getByText(formaterJour(slot.date)).closest('article')
  if (journee === null) throw new Error(`retour-3 · journée ${slot.date} introuvable à l’écran.`)
  const etiquette = within(journee).getAllByText(LIBELLE_CRENEAU[slot.creneau])[0]
  const carte = etiquette?.parentElement
  if (!carte) throw new Error(`retour-3 · carte ${cleDe(slot)} introuvable à l’écran.`)
  return carte
}

// --- La recherche de chemin -------------------------------------------------------------------

/** Ce qui se clique. Les liens sont EXCLUS : ils naviguent, ils n'agissent pas. */
const CLIQUABLE = 'button, [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"]'

/**
 * Combien de contrôles apparus au premier clic sont sondés au second. Cité en cas d'échec.
 *
 * ⚠️ **Cette borne produit un faux NÉGATIF, pas un faux positif** : une implémentation correcte
 * dont le bon bouton arrive au-delà du rang serait déclarée introuvable. Le brief ne prescrit aucun
 * ordre de rendu, donc rien ne l'en protège. Portée de 12 à 30 le 2026-08-22 après relecture
 * adverse : **zéro troncature aujourd'hui** (le message d'échec la citerait), la hausse ne coûte
 * donc rien tant qu'aucune fenêtre n'ouvre trente contrôles d'un coup.
 */
const LARGEUR_MAX = 30

const DEHORS = /dehors/i

function etiquetteDe(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function controles(racine: ParentNode): HTMLElement[] {
  return [...racine.querySelectorAll<HTMLElement>(CLIQUABLE)].filter(
    (el) => !(el as HTMLButtonElement).disabled && etiquetteDe(el) !== ''
  )
}

async function tick(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

interface Sonde {
  /** Remonte l'écran à neuf sur l'état de départ et rend la racine où le geste doit vivre. */
  readonly racine: () => Promise<HTMLElement>
  readonly ecran: string
  /** Vrai quand l'état visé est atteint EN BASE. Jamais dans le DOM. */
  readonly atteint: () => boolean
  /** Mot que le chemin doit afficher, ou `null` si le lot n'en impose aucun. */
  readonly mot: RegExp | null
}

type Resultat =
  | { readonly ok: true; readonly clics: readonly string[] }
  | { readonly ok: false; readonly essayes: readonly string[]; readonly tronque: boolean }

/**
 * Cherche une suite d'AU PLUS DEUX clics sur des contrôles visibles qui amène `atteint()` à vrai.
 * L'écran est remonté à neuf avant chaque sonde : un clic exploratoire ne pollue jamais le suivant.
 */
async function chercherChemin(sonde: Sonde): Promise<Resultat> {
  const essayes: string[] = []
  let tronque = false
  const premiers = controles(await sonde.racine()).map(etiquetteDe)

  for (const e1 of premiers) {
    const racine = await sonde.racine()
    const avant = controles(document.body).map(etiquetteDe)
    const c1 = controles(racine).find((x) => etiquetteDe(x) === e1)
    if (c1 === undefined) continue
    essayes.push(e1)
    fireEvent.click(c1)
    await tick()
    if (sonde.atteint()) return { ok: true, clics: [e1] }

    // Le second clic ne se cherche que parmi ce que le premier a FAIT APPARAÎTRE — une fenêtre
    // passe par un portail vers `document.body`, d'où la recherche sur tout le document.
    const apparus = controles(document.body).filter((x) => !avant.includes(etiquetteDe(x)))
    const mot = sonde.mot
    const candidats =
      mot !== null && !mot.test(e1) ? apparus.filter((x) => mot.test(etiquetteDe(x))) : apparus
    if (candidats.length > LARGEUR_MAX) tronque = true

    for (const e2 of candidats.slice(0, LARGEUR_MAX).map(etiquetteDe)) {
      const r2 = await sonde.racine()
      const a = controles(r2).find((x) => etiquetteDe(x) === e1)
      if (a === undefined) break
      fireEvent.click(a)
      await tick()
      const b = controles(document.body).find((x) => etiquetteDe(x) === e2)
      if (b === undefined) continue
      essayes.push(`${e1} › ${e2}`)
      fireEvent.click(b)
      await tick()
      if (sonde.atteint()) return { ok: true, clics: [e1, e2] }
    }
  }
  return { ok: false, essayes, tronque }
}

/** Rejoue un chemin déjà trouvé, étiquette par étiquette. Rend `false` si une étiquette manque. */
async function rejouer(
  clics: readonly string[],
  racine: () => Promise<HTMLElement>
): Promise<boolean> {
  const depart = await racine()
  for (const [rang, etiquette] of clics.entries()) {
    const ou = rang === 0 ? depart : document.body
    const cible = controles(ou).find((x) => etiquetteDe(x) === etiquette)
    if (cible === undefined) return false
    fireEvent.click(cible)
    await tick()
  }
  return true
}

function exigerChemin(sujet: string, sonde: Sonde, resultat: Resultat): readonly string[] {
  if (resultat.ok) return resultat.clics
  throw new Error(
    `retour-3 · ${sujet} : AUCUN chemin d’au plus 2 clics` +
      `${sonde.mot === null ? '' : ' affichant « dehors »'} n’atteint l’état visé depuis ` +
      `${sonde.ecran}. ${resultat.essayes.length} chemin(s) sondé(s)` +
      `${resultat.tronque ? ` (largeur bornée à ${LARGEUR_MAX} au 2ᵉ clic)` : ''} : ` +
      `${resultat.essayes.join(' | ') || '(aucun contrôle visible)'}`
  )
}

// --- Poser le geste, une fois pour toutes les clauses d'effet ---------------------------------

interface Pose {
  readonly avant: WeekPlan
  readonly apres: WeekPlan
  readonly clics: readonly string[]
}

/**
 * Pose « dehors » sur `cible` depuis l'écran Semaine, par le chemin le moins cher qui existe, et
 * rend le plan AVANT et APRÈS, relus en base.
 *
 * ⚠️ Aucune frappe : `fireEvent.change` n'est appelé nulle part dans ce fichier. Un libellé non vide
 * en base après un chemin qui n'a que des clics EST la preuve que l'application l'a fourni.
 */
async function poserDehorsDepuisSemaine(
  sujet: string,
  cible: Cible,
  pristine: WeekPlan
): Promise<Pose> {
  const sonde: Sonde = {
    ecran: `l’écran Semaine, sur le créneau ${cleDe(cible.slot)}`,
    mot: DEHORS,
    racine: async () => {
      cleanup()
      savePlan(baseCourante(), pristine, INSTANT)
      await monterSemaine()
      return carteDuCreneau(cible.slot)
    },
    atteint: () => {
      const e = principale(planEnBase(), cible.slot)
      return e !== undefined && e.recipeId === null && (e.horsCatalogue ?? '') !== ''
    },
  }
  const clics = exigerChemin(sujet, sonde, await chercherChemin(sonde))
  return { avant: pristine, apres: planEnBase(), clics }
}

/**
 * Exige que le libellé écrit en base soit LISIBLE À L'ÉCRAN, au caractère près.
 *
 * ⚠️ La comparaison est un CONTIENT, pas un égale : la carte a le droit d'entourer le libellé de
 * ce qu'elle veut. Ce qu'elle n'a pas le droit de faire, c'est en montrer une PARTIE — et c'est
 * exactement ce que produirait un identifiant caché dans le champ.
 */
async function exigerLibelleAffiche(slot: SlotRef, sujet: string): Promise<void> {
  const entree = principale(planEnBase(), slot)!
  const libelle = entree.horsCatalogue ?? ''
  cleanup()
  await monterSemaine()
  const carte = carteDuCreneau(slot)
  const lisible = [...carte.querySelectorAll<HTMLElement>('*')].some((n) =>
    (n.textContent ?? '').includes(libelle)
  )
  expect(
    lisible,
    `${sujet} : la base porte « ${libelle} » mais la carte ${cleDe(slot)} ne l'affiche pas tel quel. ` +
      `\`hors_catalogue\` est un texte que l'utilisateur écrit et relit — il ne sert pas à ranger un ` +
      `identifiant de recette derrière le mot qu'on lui montre.`
  ).toBe(true)
}

// =============================================================================================
// Clause 1 — le geste existe sur les DEUX écrans, sans une seule frappe
// =============================================================================================

describe.each([2, 3])('retour-3 · clause 1 — le geste, à %i repas par jour', (repasParJour) => {
  it('⛔ depuis la Semaine : au plus 2 clics, aucune frappe, et le mot « dehors » sur le chemin', async () => {
    const pristine = semer(repasParJour)
    const [cible] = exigerCibles(pristine, 1, false)
    const pose = await poserDehorsDepuisSemaine(
      `clause 1 (Semaine, ${repasParJour} repas/jour)`,
      cible!,
      pristine
    )
    const entree = principale(pose.apres, cible!.slot)!
    expect(entree.recipeId).toBeNull()
    expect(entree.horsCatalogue).not.toBe('')
    expect(pose.clics.length).toBeLessThanOrEqual(2)
    expect(pose.clics.some((c) => DEHORS.test(c))).toBe(true)
    await exigerLibelleAffiche(cible!.slot, `clause 1 (Semaine, ${repasParJour} repas/jour)`)
  })

  it('⛔ depuis Aujourd’hui : au plus 2 clics, aucune frappe, et le mot « dehors » sur le chemin', async () => {
    const pristine = semer(repasParJour)
    const creneaux = creneauxDuRythme(repasParJour)
    // Le repas du jour, sur la journée qu'Aujourd'hui affiche — donc `JOUR0`, horloge figée.
    // ⚠️ `ciblesDe`, PAS `exigerCibles(…, 1, …)` : celui-là tronque à un candidat AVANT le filtre,
    // et le filtre ne trouverait alors que ce que le hasard de l'ordre aurait laissé.
    const cible = ciblesDe(pristine).find((c) => c.slot.date === JOUR0)
    if (cible === undefined) {
      throw new Error(
        `retour-3 · SEMIS INSUFFISANT : aucun créneau candidat le ${JOUR0}, parmi ${creneaux.join(', ')}.`
      )
    }
    const sonde: Sonde = {
      ecran: `l’écran Aujourd’hui (${TITRE_CRENEAU[cible.slot.creneau]}, ${repasParJour} repas/jour)`,
      mot: DEHORS,
      racine: async () => {
        cleanup()
        savePlan(baseCourante(), pristine, INSTANT)
        await monterAujourdhui(cible.slot.creneau)
        return document.body
      },
      atteint: () => {
        const e = principale(planEnBase(), cible.slot)
        return e !== undefined && e.recipeId === null && (e.horsCatalogue ?? '') !== ''
      },
    }
    const clics = exigerChemin(
      `clause 1 (Aujourd’hui, ${repasParJour} repas/jour)`,
      sonde,
      await chercherChemin(sonde)
    )
    expect(clics.length).toBeLessThanOrEqual(2)
    expect(clics.some((c) => DEHORS.test(c))).toBe(true)
    await exigerLibelleAffiche(cible.slot, `clause 1 (Aujourd’hui, ${repasParJour} repas/jour)`)
  })
})

// =============================================================================================
// Clauses 2 à 7 — ce que le geste fait, et ce qu'il ne fait pas
// =============================================================================================

describe('retour-3 · ce que le geste fait au plan', () => {
  it('⛔ clause 2 — ni trou ni recalcul : tous les autres créneaux sont mot pour mot les mêmes', async () => {
    const pristine = semer(2)
    const [cible] = exigerCibles(pristine, 1, false)
    const { avant, apres } = await poserDehorsDepuisSemaine(
      'clause 2 — ni trou ni recalcul',
      cible!,
      pristine
    )

    const creneauxAvant = [...new Set(avant.entries.map((e) => cleDe(e.slot)))].sort()
    const creneauxApres = [...new Set(apres.entries.map((e) => cleDe(e.slot)))].sort()
    expect(creneauxApres, 'clause 2 : le geste ne crée ni ne supprime aucun créneau').toEqual(
      creneauxAvant
    )

    const empreinte = (plan: WeekPlan) =>
      plan.entries
        .filter((e) => e.service !== 'accompagnement' && cleDe(e.slot) !== cleDe(cible!.slot))
        .map(
          (e) =>
            `${cleDe(e.slot)}=${e.recipeId ?? '∅'}/${e.locked ? 'V' : '-'}/${e.isLeftover ? 'R' : '-'}`
        )
        .sort()
    expect(
      empreinte(apres),
      'clause 2 : aucun AUTRE créneau ne change de plat, de verrou ni de statut de reste'
    ).toEqual(empreinte(avant))

    expect(duCreneau(apres, cible!.slot).filter((e) => e.service !== 'accompagnement')).toHaveLength(
      duCreneau(avant, cible!.slot).filter((e) => e.service !== 'accompagnement').length
    )
  })

  it('⛔ clause 3 — l’écriture passe par le moteur : l’accompagnement est parti', async () => {
    const pristine = semer(2)
    const [cible] = exigerCibles(pristine, 1, false)
    expect(
      duCreneau(pristine, cible!.slot).filter((e) => e.service === 'accompagnement'),
      'clause 3 : le créneau visé doit porter un accompagnement AVANT, sinon la clause ne mesure rien'
    ).toHaveLength(1)

    const { apres } = await poserDehorsDepuisSemaine(
      'clause 3 — l’écriture passe par le moteur',
      cible!,
      pristine
    )
    expect(
      duCreneau(apres, cible!.slot),
      'clause 3 : un créneau « dehors » porte UNE entrée — un accompagnement resté sur place ' +
        'dénonce une écriture fabriquée à la main plutôt que passée par le moteur'
    ).toHaveLength(1)
    const marque = duCreneau(apres, cible!.slot)[0]!
    expect(marque.service).toBeNull()

    // ⛔ LA FORME ENTIÈRE, PAS DEUX CHAMPS — fermeture d'une triche trouvée par la seconde
    // relecture adverse du 2026-08-22, et vérifiée : AUCUNE des neuf clauses ne relisait
    // `portions` sur le chemin ALLER. Une écriture fabriquée à la main pouvait donc retirer
    // l'accompagnement, vider `recipeId`, poser le libellé — et LAISSER `portions` à 4. Ni la
    // liste de courses (elle filtre sur `recipeId === null`), ni le plancher calorique (il lit
    // `horsCatalogue`), ni l'annuler de la clause 4 (il rétablit `portionsBase`, soit la même
    // valeur) ne l'auraient vu. `setSlotHorsCatalogue` documente pourtant l'invariant en toutes
    // lettres — « ZÉRO PORTION, et ce n'est pas "zéro assiette" ». On le relit donc ici.
    expect(
      marque.portions,
      `clause 3 : ${cleDe(cible!.slot)} est marqué « dehors » mais annonce encore ` +
        `${marque.portions} portion(s). Un créneau où l'on ne cuisine pas n'en produit aucune ` +
        `— une valeur restée à celle du plat d'avant dénonce une écriture qui n'est pas ` +
        `passée par le moteur.`
    ).toBe(0)
    expect(marque.isLeftover, 'clause 3 : marquer « dehors » ne fabrique pas un reste').toBe(false)
    expect(marque.locked, 'clause 3 : marquer « dehors » ne verrouille pas le créneau').toBe(false)
    expect(marque.recipeId, 'clause 3 : plus aucun plat sur un créneau « dehors »').toBeNull()
    expect((marque.horsCatalogue ?? '').trim()).not.toBe('')
  })

  it('⛔ clause 4 — le geste se défait, et le MÊME chemin rend le plat exact sur 3 journées', async () => {
    const pristine = semer(2)
    const trois = exigerCibles(pristine, 3, true)

    // 1. Trouver l'annuler sur le premier créneau, sans imposer son libellé.
    const premier = trois[0]!
    const sonde: Sonde = {
      ecran: `l’écran Semaine, sur le créneau ${cleDe(premier.slot)} déjà marqué « dehors »`,
      mot: null,
      racine: async () => {
        cleanup()
        savePlan(baseCourante(), pristine, INSTANT)
        await monterSemaine()
        const pose = await poserDehorsDepuisSemaine(
          'clause 4 — le geste se défait',
          premier,
          pristine
        )
        expect(principale(pose.apres, premier.slot)!.horsCatalogue).not.toBeNull()
        cleanup()
        await monterSemaine()
        return carteDuCreneau(premier.slot)
      },
      atteint: () => {
        const e = principale(planEnBase(), premier.slot)
        return e !== undefined && e.recipeId === premier.recipeId && e.horsCatalogue === null
      },
    }
    const clics = exigerChemin('clause 4 — le geste se défait', sonde, await chercherChemin(sonde))
    expect(clics.length).toBeLessThanOrEqual(2)

    // 2. Le REJOUER à l'identique sur deux autres journées, sur d'autres plats. Un chemin qui
    //    nommait le plat d'origine ne survit pas à ce rejeu — c'est tout l'objet de l'étape.
    for (const cible of trois.slice(1)) {
      await poserDehorsDepuisSemaine('clause 4 — le geste se défait (rejeu)', cible, pristine)
      cleanup()
      await monterSemaine()
      const rejoue = await rejouer(clics, async () => carteDuCreneau(cible.slot))
      expect(
        rejoue,
        `clause 4 : le chemin « ${clics.join(' › ')} » n’existe plus sur ${cleDe(cible.slot)} — ` +
          `un annuler dont le libellé change avec le plat n’est pas un annuler, c’est un choix.`
      ).toBe(true)
      const apres = planEnBase()
      const rendu = principale(apres, cible.slot)!
      expect(rendu.recipeId, `clause 4 : ${cleDe(cible.slot)} n’a pas retrouvé son plat`).toBe(
        cible.recipeId
      )
      expect(rendu.horsCatalogue).toBeNull()

      // ⛔ CE QUI SUIT TUE L'ANNULER ÉCRIT À LA MAIN. Rendre les deux champs ci-dessus et s'arrêter
      // là laisse `portions` à zéro : le plat revient à l'écran mais ne produit plus rien — ni
      // ingrédient à acheter, ni reste. Seul le moteur repose le créneau avec les portions que le
      // catalogue annonce pour cette recette.
      const portionsAttendues = catalogueDeTest().recipes.get(cible.recipeId)?.portionsBase ?? 0
      expect(portionsAttendues, 'clause 4 : recette sans portionsBase — c’est le semis, pas la clause')
        .toBeGreaterThan(0)
      expect(
        rendu.portions,
        `clause 4 : ${cleDe(cible.slot)} est revenu à son plat mais pour ${rendu.portions} portion(s) ` +
          `au lieu de ${portionsAttendues}. Un plat à zéro portion ne remplit ni la liste de courses ` +
          `ni les restes : le créneau n’a pas été reposé par le moteur, il a été rapiécé.`
      ).toBe(portionsAttendues)
      expect(rendu.isLeftover, 'clause 4 : annuler ne fabrique pas un reste').toBe(false)
      expect(rendu.locked).toBe(false)

      // L'invariant que `reposerLeCreneau` maintient lui-même : `service` vaut `'plat'` SI ET
      // SEULEMENT SI une seconde entrée suit. ⚠️ L'accompagnement rendu peut DIFFÉRER de celui
      // d'avant — il se recalcule avec le plat — donc on exige la cohérence, pas l'identité.
      const surLeCreneau = duCreneau(apres, cible.slot)
      expect(
        surLeCreneau.length,
        `clause 4 : ${cleDe(cible.slot)} porte ${surLeCreneau.length} entrée(s) pour un service ` +
          `« ${rendu.service ?? 'null'} » — les deux ne peuvent pas être vrais en même temps.`
      ).toBe(rendu.service === 'plat' ? 2 : 1)
      for (const complement of surLeCreneau.filter((e) => e.service === 'accompagnement')) {
        expect(complement.horsCatalogue).toBeNull()
        expect(complement.portions).toBeGreaterThan(0)
      }
    }
  })

  it('⛔ clause 5 — la liste de courses BAISSE, et aucune ligne ne monte', async () => {
    const pristine = semer(2)
    const [cible] = exigerCibles(pristine, 1, false)
    const { avant, apres } = await poserDehorsDepuisSemaine(
      'clause 5 — la liste de courses baisse',
      cible!,
      pristine
    )
    const moteur = createEngine(catalogueDeTest())
    const grammes = (plan: WeekPlan): ReadonlyMap<FoodId, number> =>
      new Map(moteur.buildShoppingList(plan).items.map((i) => [i.foodId, i.quantiteTotale]))

    const g0 = grammes(avant)
    const g1 = grammes(apres)
    const monte = [...g1.entries()].filter(([id, q]) => q > (g0.get(id) ?? 0))
    expect(
      monte.map(([id, q]) => `${id} ${g0.get(id) ?? 0}→${q}`),
      'clause 5 : marquer un repas « dehors » n’a le droit de faire monter AUCUNE ligne'
    ).toEqual([])
    const baisse = [...g0.entries()].filter(([id, q]) => (g1.get(id) ?? 0) < q)
    expect(
      baisse.length,
      'clause 5 : un repas de moins à cuisiner, c’est au moins un ingrédient de moins à acheter'
    ).toBeGreaterThan(0)
  })

  it('⛔ clause 6 — aucun rappel pour ce créneau, et les autres survivent intacts', async () => {
    const pristine = semer(2)
    // Un créneau à VENIR : un rappel déjà passé ne serait pas posé, et la clause ne prouverait rien.
    const cible = ciblesDe(pristine).find((c) => c.slot.date > JOUR0)
    if (cible === undefined) {
      throw new Error('retour-3 · SEMIS INSUFFISANT : aucun créneau candidat après le premier jour.')
    }

    const recettes = catalogueDeTest().recipes
    const heures = readMealTimes(baseCourante())
    const maintenant = Date.parse(INSTANT)
    const avantRappels = rappelsDuPlan(pristine, recettes, heures, maintenant)
    expect(
      avantRappels.some((r) => cleDe({ date: r.date, creneau: r.creneau }) === cleDe(cible.slot)),
      'clause 6 : le créneau visé doit porter un rappel AVANT, sinon la clause ne mesure rien'
    ).toBe(true)

    const { apres } = await poserDehorsDepuisSemaine(
      'clause 6 — aucun rappel pour ce créneau',
      cible,
      pristine
    )
    const apresRappels = rappelsDuPlan(apres, recettes, heures, maintenant)

    expect(
      apresRappels.filter((r) => cleDe({ date: r.date, creneau: r.creneau }) === cleDe(cible.slot)),
      'clause 6 : on ne rappelle pas de cuisiner un repas qu’on prend dehors'
    ).toEqual([])
    const autres = (rs: typeof avantRappels) =>
      rs
        .filter((r) => cleDe({ date: r.date, creneau: r.creneau }) !== cleDe(cible.slot))
        .map((r) => `${r.date}|${r.creneau}|${r.recipeId}|${r.quandMs}`)
        .sort()
    expect(
      autres(apresRappels),
      'clause 6 : les rappels des AUTRES créneaux ne bougent ni d’heure ni de plat'
    ).toEqual(autres(avantRappels))
  })

  it('⛔ clause 7 — aucune journée ne GAGNE d’avertissement de plancher calorique', async () => {
    const pristine = semer(2)
    const [cible] = exigerCibles(pristine, 1, false)
    const { avant, apres } = await poserDehorsDepuisSemaine(
      'clause 7 — aucune journée ne gagne d’avertissement',
      cible!,
      pristine
    )
    const moteur = createEngine(catalogueDeTest())
    const jours = (plan: WeekPlan) =>
      new Set(moteur.checkPlan(plan, PROFIL_PAR_DEFAUT).map((w) => w.date))
    const av = jours(avant)
    const ap = jours(apres)
    expect(
      [...ap].filter((d) => !av.has(d)),
      'clause 7 : un repas pris dehors ne doit JAMAIS déclencher l’alerte de plancher calorique — ' +
        'le plan ne sait pas ce qu’il apporte, et ce qu’il ignore ne se compte pas comme un manque'
    ).toEqual([])
  })
})

// =============================================================================================
// Clauses 8 et 9 — ce que le lot n'a pas le droit de toucher
// =============================================================================================

describe('retour-3 · ce que le lot ne touche pas', () => {
  it('⛔ clause 8 — rien dans l’historique, rien à migrer, la contrainte tient toujours', async () => {
    const pristine = semer(2)
    const db = baseCourante()
    const compteHistorique = () =>
      db.all<{ readonly n: number }>('SELECT count(*) AS n FROM meal_history')[0]?.n ?? -1
    expect(compteHistorique()).toBe(0)

    const [cible] = exigerCibles(pristine, 1, false)
    await poserDehorsDepuisSemaine('clause 8 — rien dans l’historique', cible!, pristine)

    expect(
      compteHistorique(),
      'clause 8 : « je mange dehors » n’est pas « ce plat a été retenu » — l’historique ne bouge pas'
    ).toBe(0)

    expect(USER_SCHEMA_VERSION, 'clause 8 : étiqueter un créneau ne demande AUCUNE migration').toBe(
      18
    )
    expect(
      db.all<{ readonly schema_version: number }>(
        'SELECT schema_version FROM app_meta WHERE id = 1'
      )[0]?.schema_version
    ).toBe(USER_SCHEMA_VERSION)

    // La contrainte de la v9 : un créneau porte un plat, OU une étiquette. Jamais les deux.
    expect(
      () =>
        db.run(
          `INSERT INTO meal_plan_entry
             (plan_id, date, creneau, service, recipe_id, portions, verrouille, est_reste, hors_catalogue)
           VALUES (?, '2099-01-01', 'diner', NULL, ?, 1, 0, 0, 'Restaurant')`,
          [pristine.id, cible!.recipeId]
        ),
      'clause 8 : la base doit REFUSER un créneau qui porte un plat ET une étiquette — c’est la ' +
        'lecture A de la décision 76, celle qui a été écartée'
    ).toThrow()
  })

  it.each([2, 3])(
    '⛔ clause 9 — sans semaine composée (%i repas/jour), le geste n’invente aucun plan',
    async (repasParJour) => {
      const db = baseCourante()
      writeRythme(db, { repasParJour, tempsSemaineMin: null, tempsWeekendMin: null })
      expect(readLatestPlan(db)).toBeNull()

      const sonde: Sonde = {
        ecran: `l’écran Aujourd’hui sur un compte neuf (${repasParJour} repas/jour)`,
        mot: DEHORS,
        racine: async () => {
          cleanup()
          await monterAujourdhui(null)
          return document.body
        },
        // Rien n'est « atteint » : on veut que la recherche PARCOURE tout le chemin possible.
        atteint: () => false,
      }
      const resultat = await chercherChemin(sonde)
      expect(resultat.ok).toBe(false)
      expect(
        readLatestPlan(db),
        'clause 9 : aucun clic sur le chemin « dehors » ne doit fabriquer une semaine qui n’existe pas'
      ).toBeNull()
      expect(
        screen.queryAllByText(/sur \d+$/).length,
        'clause 9 : l’écran doit rester debout après toute la séquence de clics'
      ).toBeGreaterThan(0)
    }
  )
})
