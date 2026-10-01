// ui/screens/semaine.tsx — écran « Semaine » (§4.2 DESIGN, §7 ENGINE).
//
// Le premier écran qui ÉCRIT une structure dans `user.db` : un plan survit au rechargement, avec
// ses verrous et ses restes. C'est aussi le premier à faire travailler `planWeek`, `rerollSlot` et
// `planLeftovers`, codés depuis P3 et jamais appelés.
//
// ⚠️ LES AVERTISSEMENTS SONT TOUJOURS RECALCULÉS, JAMAIS RELUS. `readPlan` rend `warnings: []` par
// construction (voir son en-tête) : un avertissement de plancher calorique dépend du PROFIL, et le
// figer en base le ferait mentir dès que le profil change. Tout plan restauré passe donc par
// `moteur.checkPlan` — sans quoi l'alerte de §6.5 disparaîtrait au rechargement de la page.
//
// PÉRIMÈTRE — ce que §4.2 décrit et qui n'est PAS ici, volontairement : le carrousel plein écran
// (« Changer » est un bouton, pas une galerie), la vue comparative « 3 propositions », « écarter »
// comme exclusion éphémère de session, le pouce-bas vers `user_signal`, et le bouton « Créer ma
// liste de courses » (l'écran Courses n'existe pas — pas de bouton mort).

import { useCallback, useEffect, useState } from 'react'
import type {
  MealPlanEntry,
  MealSlot,
  RecipeId,
  SlotRef,
  UserProfile,
  WeekPlan,
} from '../../engine/domain/index.js'
import { DEFAULT_PLAN_DAYS, MAX_PLAN_DAYS, MIN_PLAN_DAYS, addDays } from '../../engine/planning/plan-week.js'
import {
  cleSansDecalage,
  readDisplay,
  readLatestPlan,
  readRythme,
  readSansDecalage,
  readUserState,
  savePlan,
  writeSansDecalage,
} from '../../data/user-store.js'
import {
  FENETRE_HISTORIQUE_JOURS,
  LIBELLE_CRENEAU,
  aujourdhuiIso,
  chargerSocle,
  cleCreneau,
  formaterJour,
  maintenantIso,
  profilCourant,
  type Socle,
} from '../socle.js'
import { hashDeRecette, hashDuFrigo } from '../router.js'
import { Panneau } from '../panneau.js'
import { epure } from '../epure.js'
import { couleurDeRecette, initialeDeRecette } from '../vignette.js'
import { REPAS_PAR_DEFAUT, creneauxDuRythme, estPasse } from '../creneau.js'
import { reprogrammerLesRappels } from '../ecrire-plan.js'
import { phraseDuMotif } from '../motif-vide.js'
import { LIBELLE_DEHORS, oublierLePlat, platDAvant, retenirLePlat } from '../dehors.js'
import {
  gestePrecedent,
  oublierLeGeste,
  oublierTousLesGestes,
  retenirLeGeste,
} from '../restes.js'
import type { SourceDeReste } from '../../engine/planning/set-slot-leftover.js'
import { ChoisirPlat } from '../choisir-plat.js'

// Le mapping « nombre de repas → créneaux » a été remonté dans `ui/creneau.ts` quand l'écran
// Aujourd'hui en a eu besoin à son tour : deux copies auraient donné une semaine et un écran du jour
// qui ne parlent pas des mêmes repas.

// L'horizon par défaut vit à côté de ses bornes, dans `plan-week.ts` : l'écran de réglages en a
// besoin lui aussi pour dire « moins que la semaine n'en demande », et une deuxième constante de 7
// aurait fini par avertir sur un horizon que le planificateur n'utilise plus.
const JOURS_PAR_DEFAUT = DEFAULT_PLAN_DAYS

interface Reglages {
  readonly jours: number
  readonly repasParJour: number
  /**
   * Assiettes servies par repas — indispensable à `planLeftovers` : une recette de 4 portions ne
   * laisse un reste que si l'on sait combien en sont mangées sur le coup.
   *
   * ⚠️ AJOUT à §4.2, qui ne prévoit pas ce réglage. Sans lui, les restes apparaîtraient sans que
   * rien à l'écran n'explique d'où ils viennent — un réglage caché qui change le résultat est pire
   * qu'un réglage de plus. À ne pas confondre avec `UserProfile.facteurPortion`, qui est un appétit.
   */
  readonly convives: number
  readonly graine: number
}

interface Vue {
  readonly plan: WeekPlan
  readonly profil: UserProfile
  readonly nomDe: (id: RecipeId) => string
}

type Etat =
  | { readonly phase: 'chargement' }
  /**
   * Aucune semaine composée. C'EST L'ÉTAT DE DÉPART, et c'en est un à part entière.
   *
   * ⚠️ L'ÉCRAN GÉNÉRAIT ET ENREGISTRAIT une semaine complète à la première visite. On atterrissait
   * donc sur sept jours de repas qu'on n'avait pas demandés — et `savePlan` les gravait aussitôt en
   * base, si bien que « je n'ai rien planifié » devenait inexprimable. Une application qui décide à
   * la place de l'utilisateur avant qu'il ait rien dit n'est pas ce que ce projet veut être.
   */
  | { readonly phase: 'vide' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

function memeCreneau(entry: MealPlanEntry, slot: SlotRef): boolean {
  return entry.slot.date === slot.date && entry.slot.creneau === slot.creneau
}

/** Créneaux d'un plan restauré, dans l'ordre des repas — `readPlan` les rend déjà triés ainsi. */
function creneauxDuPlan(plan: WeekPlan): readonly MealSlot[] {
  const vus: MealSlot[] = []
  for (const entry of plan.entries) {
    if (!vus.includes(entry.slot.creneau)) vus.push(entry.slot.creneau)
  }
  return vus
}

/**
 * Créneaux effectivement servis — un créneau compte pour UN repas, plat et accompagnement compris.
 *
 * ⚠️ UN PLAT PRÉPARÉ COMPTE (décision 51). Le test `recipeId !== null` seul l'aurait ignoré :
 * l'en-tête aurait annoncé « 2 repas prévus » sous une semaine qui en affiche trois. Ce compte dit
 * ce qui est PRÉVU, pas ce que l'application sait mesurer — les deux questions sont distinctes, et
 * c'est seulement la seconde qui écarte le hors-catalogue (voir `checkCalorieFloor`).
 */
function repasServis(plan: WeekPlan): number {
  const servis = new Set<string>()
  for (const e of plan.entries) {
    if (e.recipeId !== null || e.horsCatalogue !== null) servis.add(`${e.slot.date}|${e.slot.creneau}`)
  }
  return servis.size
}

function nombreDeRepas(plan: WeekPlan): number {
  const compte = creneauxDuPlan(plan).length
  return compte >= 1 && compte <= 3 ? compte : REPAS_PAR_DEFAUT
}

/** Construit un plan neuf, en conservant les créneaux gardés, et l'enregistre. */
function planifier(socle: Socle, reglages: Reglages, verrous: readonly MealPlanEntry[]): Vue {
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const etat = readUserState(socle.db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: date }, socle.catalogue.foods)

  const brut = socle.moteur.planWeek({
    profile: profil,
    constraints: etat.constraints,
    tolerancePiquant: etat.tolerancePiquant,
    startDate: date,
    days: reglages.jours,
    slots: creneauxDuRythme(reglages.repasParJour),
    history: etat.history,
    activeTopics: etat.activeTopics,
    convives: reglages.convives,
    // ⚠️ C'EST CE CHAMP qui tient la promesse « vos repas gardés ne changeront pas ». Réécrire les
    // verrous APRÈS coup casserait `placedRecipeIds` : la nouvelle semaine pourrait replacer
    // ailleurs le plat réimposé, et le même dîner apparaîtrait deux fois.
    lockedEntries: verrous,
    seed: reglages.graine,
  })

  // Les restes REMPLACENT un plat prévu (§7.3) ; `planLeftovers` ne touche pas aux créneaux gardés
  // et recalcule les avertissements, les totaux du jour ayant changé.
  const plan = socle.moteur.planLeftovers(brut, profil, reglages.convives)
  savePlan(socle.db, plan, maintenantIso())
  reprogrammerLesRappels(socle, plan)
  return { plan, profil, nomDe: (id) => socle.catalogue.recipes.get(id)?.nom ?? id }
}

/** Une case vide que l'utilisateur remplira lui-même (lot F2) : ni plat, ni motif de tirage. */
function caseARemplir(slot: SlotRef): MealPlanEntry {
  return {
    slot,
    recipeId: null,
    horsCatalogue: null,
    motifVide: 'a_remplir',
    portions: 0,
    locked: false,
    isLeftover: false,
    service: null,
  }
}

/**
 * « Je la remplis moi-même » (lot F2) : jours × repas, chaque créneau vide, et rien d'autre.
 *
 * ⚠️ LE MOTEUR N'EST PAS APPELÉ, c'est la porte. L'identifiant suit la forme de `planWeek`
 * (`plan-<début>-<jours>`) : une semaine manuelle et une semaine composée sur la même fenêtre sont
 * le même planning, et `savePlan` le réécrit par `ON CONFLICT`, sans cascade.
 */
function semaineVierge(socle: Socle, reglages: Reglages): Vue {
  const date = aujourdhuiIso()
  const creneaux = creneauxDuRythme(reglages.repasParJour)
  const entries: MealPlanEntry[] = []
  for (let jour = 0; jour < reglages.jours; jour++) {
    for (const creneau of creneaux) entries.push(caseARemplir({ date: addDays(date, jour), creneau }))
  }
  const plan: WeekPlan = {
    id: `plan-${date}-${reglages.jours}`,
    startDate: date,
    days: reglages.jours,
    seed: reglages.graine,
    entries,
    warnings: [],
  }
  savePlan(socle.db, plan, maintenantIso())
  reprogrammerLesRappels(socle, plan)
  return { plan, profil: profilCourant(socle.db, date), nomDe: (id) => socle.catalogue.recipes.get(id)?.nom ?? id }
}

/**
 * « Vider la semaine » (lot F2) : MÊME plan, mêmes créneaux, tous vides — repas gardés compris.
 *
 * ⚠️ RÉÉCRIRE, JAMAIS SUPPRIMER. `shopping_list.plan_id` est en `ON DELETE CASCADE` : supprimer le
 * plan emporterait la liste de courses. Les accompagnements partent avec leur plat — une case vide
 * n'a qu'une ligne.
 */
function vider(plan: WeekPlan): WeekPlan {
  const vus = new Set<string>()
  const entries: MealPlanEntry[] = []
  for (const e of plan.entries) {
    const cle = `${e.slot.date}|${e.slot.creneau}`
    if (vus.has(cle)) continue
    vus.add(cle)
    entries.push(caseARemplir(e.slot))
  }
  return { ...plan, entries, warnings: [] }
}

/**
 * Reprend le dernier plan enregistré — et RIEN d'autre s'il n'y en a pas.
 *
 * ⚠️ NE PLANIFIE PLUS À LA PLACE DE L'UTILISATEUR. Cette fonction terminait par
 * `planifier(socle, defauts, [])` : une première visite produisait sept jours de repas et les
 * ENREGISTRAIT. Composer une semaine est désormais un geste, jamais un effet de bord de la
 * navigation.
 */
function reprendre(
  socle: Socle,
  reglages: Reglages
): { readonly vue: Vue | null; readonly reglages: Reglages } {
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const enregistre = readLatestPlan(socle.db)
  // Le rythme déclaré au premier lancement fixe le défaut ; un plan déjà enregistré prime, parce
  // que l'utilisateur a pu le changer depuis l'écran.
  const rythme = readRythme(socle.db)
  const defauts: Reglages =
    rythme === null ? reglages : { ...reglages, repasParJour: rythme.repasParJour }

  if (enregistre === null) return { vue: null, reglages: defauts }
  // ⚠️ UNE SEMAINE VIDÉE, OU OUVERTE À LA MAIN ET LAISSÉE TELLE QUELLE, EST L'ÉCRAN DE DÉPART (lot
  // F2). Ses jours et ses repas restent les réglages proposés.
  // ⛔ « TOUTES À REMPLIR », PAS « AUCUN REPAS » : une semaine que le moteur n'a pu remplir nulle
  // part est vide AUSSI, mais chacune de ses cases dit pourquoi (`retour-5b`) — les deux portes
  // effaceraient ces motifs.
  if (enregistre.entries.every((e) => e.motifVide === 'a_remplir')) {
    return { vue: null, reglages: { ...defauts, jours: enregistre.days, repasParJour: nombreDeRepas(enregistre) } }
  }

  return {
    // `warnings` est vide à la lecture — on le reconstitue ici, sinon l'alerte de §6.5
    // disparaîtrait silencieusement d'un rechargement à l'autre.
    vue: {
      plan: { ...enregistre, warnings: socle.moteur.checkPlan(enregistre, profil) },
      profil,
      nomDe: (id) => socle.catalogue.recipes.get(id)?.nom ?? id,
    },
    reglages: { ...defauts, jours: enregistre.days, repasParJour: nombreDeRepas(enregistre), graine: enregistre.seed },
  }
}

export function Semaine() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [reglages, setReglages] = useState<Reglages>({
    jours: JOURS_PAR_DEFAUT,
    repasParJour: REPAS_PAR_DEFAUT,
    convives: 1,
    graine: 1,
  })
  /** Plats refusés créneau par créneau — §7.2 : c'est ce qui rend le refus RÉPÉTÉ possible. */
  const [refus, setRefus] = useState<ReadonlyMap<string, readonly RecipeId[]>>(new Map())
  /** Le créneau dont la fenêtre « Choisir un plat » est ouverte, ou `null`. */
  const [aChoisir, setAChoisir] = useState<SlotRef | null>(null)
  /** Le créneau dont la fenêtre « Manger un reste » est ouverte, ou `null` (décision 78). */
  const [pourReste, setPourReste] = useState<SlotRef | null>(null)
  /** Le socle, gardé pour la fenêtre de choix — elle interroge le moteur à chaque frappe. */
  const [socleCharge, setSocleCharge] = useState<Socle | null>(null)
  const [premierRendu, setPremierRendu] = useState(true)
  /** Mode avancé (Paramètres, `afficher_macros`) : gouverne aussi l'avertissement de plancher — §6.5 ARCHITECTURE. */
  const [modeAvance, setModeAvance] = useState(false)
  /** « Non » à « Décaler ce plat ? » sur le plan affiché, relu de `user.db` (lot `retour-8`). */
  const [sansDecalage, setSansDecalage] = useState<ReadonlySet<string>>(new Set())
  /** Le créneau dont la fenêtre des gestes est ouverte, ou `null` (lot F1). */
  const [ouvert, setOuvert] = useState<SlotRef | null>(null)
  /** La fenêtre ⚙ : jours, repas, convives et légende (lot F1). */
  const [reglagesOuverts, setReglagesOuverts] = useState(false)
  /** La confirmation de « Vider la semaine » (lot F2). */
  const [aVider, setAVider] = useState(false)

  const echouer = useCallback((erreur: unknown) => {
    setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
  }, [])

  // Premier montage : on reprend le plan enregistré s'il existe. Sinon on reste VIDE et on attend.
  useEffect(() => {
    if (!premierRendu) return
    let annule = false
    chargerSocle()
      .then((socle) => {
        if (annule) return
        const repris = reprendre(socle, reglages)
        setReglages(repris.reglages)
        setSocleCharge(socle)
        setModeAvance(readDisplay(socle.db).afficherMacros)
        setSansDecalage(repris.vue === null ? new Set() : readSansDecalage(socle.db, repris.vue.plan.id))
        setEtat(repris.vue === null ? { phase: 'vide' } : { phase: 'pret', vue: repris.vue })
        setPremierRendu(false)
      })
      .catch((erreur: unknown) => {
        if (!annule) echouer(erreur)
      })
    return () => {
      annule = true
    }
  }, [premierRendu, reglages, echouer])

  /** Replanifie en gardant les créneaux verrouillés. `graineNeuve` = « Proposer une autre semaine ». */
  const replanifier = useCallback(
    (suivants: Reglages) => {
      const verrous = etat.phase === 'pret' ? etat.vue.plan.entries.filter((e) => e.locked) : []
      chargerSocle()
        .then((socle) => {
          setReglages(suivants)
          setRefus(new Map())
          // ⚠️ LA MÉMOIRE DES RESTES POSÉS À LA MAIN MEURT ICI, et c'est délibéré. Elle retient le
          // plat qu'un créneau portait AVANT le geste ; après une recomposition ce plat est
          // ailleurs dans la semaine, et le rendre le poserait deux fois. Le reste survit — ses
          // deux créneaux sont gardés —, seul le raccourci pour le défaire disparaît.
          oublierTousLesGestes()
          const vue = planifier(socle, suivants, verrous)
          // Le « Non » est rangé par planning : un autre nombre de jours est un autre planning.
          setSansDecalage(readSansDecalage(socle.db, vue.plan.id))
          setEtat({ phase: 'pret', vue })
        })
        .catch(echouer)
    },
    [etat, echouer]
  )

  /** « Je la remplis moi-même » : la frise vide s'affiche, un ＋ par case (lot F2). */
  const remplirSoiMeme = useCallback(
    (suivants: Reglages) => {
      chargerSocle()
        .then((socle) => {
          setReglages(suivants)
          setRefus(new Map())
          oublierTousLesGestes()
          const vue = semaineVierge(socle, suivants)
          setSansDecalage(readSansDecalage(socle.db, vue.plan.id))
          setEtat({ phase: 'pret', vue })
        })
        .catch(echouer)
    },
    [echouer]
  )

  /** « Vider la semaine », confirmé : retour aux deux portes (lot F2). */
  const viderLaSemaine = useCallback(() => {
    if (etat.phase !== 'pret') return
    const suivant = vider(etat.vue.plan)
    chargerSocle()
      .then((socle) => {
        savePlan(socle.db, suivant, maintenantIso())
        reprogrammerLesRappels(socle, suivant)
        setRefus(new Map())
        oublierTousLesGestes()
        setAVider(false)
        setEtat({ phase: 'vide' })
      })
      .catch(echouer)
  }, [etat, echouer])

  /** Garder / relâcher un créneau. La composition ne change pas : les avertissements non plus. */
  const basculerVerrou = useCallback(
    (slot: SlotRef) => {
      if (etat.phase !== 'pret') return
      const plan = etat.vue.plan
      const suivant: WeekPlan = {
        ...plan,
        entries: plan.entries.map((e) => (memeCreneau(e, slot) ? { ...e, locked: !e.locked } : e)),
      }
      chargerSocle()
        .then((socle) => {
          savePlan(socle.db, suivant, maintenantIso())
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, echouer]
  )

  /** « Changer » — repropose UN créneau, en accumulant les refus précédents (§7.2). */
  const changer = useCallback(
    (slot: SlotRef) => {
      if (etat.phase !== 'pret') return
      const { plan, profil } = etat.vue
      const cle = cleCreneau(slot.date, slot.creneau)
      const refuse = plan.entries.find((e) => memeCreneau(e, slot))?.recipeId ?? null
      const dejaRefuses = [...(refus.get(cle) ?? []), ...(refuse === null ? [] : [refuse])]

      chargerSocle()
        .then((socle) => {
          const etatUtilisateur = readUserState(
            socle.db,
            { windowDays: FENETRE_HISTORIQUE_JOURS, today: aujourdhuiIso() },
            socle.catalogue.foods
          )
          const suivant = socle.moteur.rerollSlot(
            plan,
            slot,
            {
              profile: profil,
              constraints: etatUtilisateur.constraints,
              tolerancePiquant: etatUtilisateur.tolerancePiquant,
              history: etatUtilisateur.history,
              activeTopics: etatUtilisateur.activeTopics,
              seed: plan.seed,
            },
            { excludeRecipeIds: dejaRefuses }
          )
          savePlan(socle.db, suivant, maintenantIso())
          // Le créneau porte un autre plat : la mémoire du « dehors » n'a plus d'objet.
          oublierLePlat(slot)
          oublierLeGeste(slot)
          setRefus(new Map(refus).set(cle, dejaRefuses))
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, refus, echouer]
  )

  /**
   * « Choisir » — pose sur un créneau le plat que l'utilisateur a désigné (décision 49).
   *
   * ⚠️ CE N'EST PAS `changer` AVEC UN ARGUMENT, et c'est tout le sujet de la décision 49 : `changer`
   * TIRE (il exclut ce qui est déjà au plan, il accumule les refus), celui-ci POSE. Refuser à
   * quelqu'un le plat qu'il vient de désigner parce qu'il figure déjà mercredi serait absurde.
   *
   * On efface les refus accumulés sur ce créneau au passage : ils étaient la mémoire d'un tirage,
   * et l'utilisateur vient de trancher lui-même.
   */
  const poser = useCallback(
    (slot: SlotRef, recipeId: RecipeId) => {
      if (etat.phase !== 'pret') return
      const { plan, profil } = etat.vue

      chargerSocle()
        .then((socle) => {
          const etatUtilisateur = readUserState(
            socle.db,
            { windowDays: FENETRE_HISTORIQUE_JOURS, today: aujourdhuiIso() },
            socle.catalogue.foods
          )
          const suivant = socle.moteur.setSlotRecipe(plan, slot, recipeId, {
            profile: profil,
            constraints: etatUtilisateur.constraints,
            tolerancePiquant: etatUtilisateur.tolerancePiquant,
            history: etatUtilisateur.history,
            activeTopics: etatUtilisateur.activeTopics,
            seed: plan.seed,
          })
          savePlan(socle.db, suivant, maintenantIso())
          // ⚠️ LES RAPPELS SUIVENT LE PLAT, sinon l'appareil sonne pour un plat qu'on a remplacé.
          reprogrammerLesRappels(socle, suivant)
          const refusSuivants = new Map(refus)
          refusSuivants.delete(cleCreneau(slot.date, slot.creneau))
          setRefus(refusSuivants)
          // L'utilisateur a désigné un plat : plus rien à défaire.
          oublierLePlat(slot)
          oublierLeGeste(slot)
          setAChoisir(null)
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, refus, echouer]
  )

  /**
   * Pose un plat PRÉPARÉ sur un créneau (décision 51, issue « (a) »).
   *
   * ⚠️ MÊME CHEMIN D'ÉCRITURE QUE `poser`, DÉLIBÉRÉMENT : `setSlotHorsCatalogue` puis `savePlan`
   * puis `reprogrammerLesRappels`. Ce créneau-ci ne produira AUCUN rappel — `rappelsDuPlan` saute
   * les entrées sans recette (`ui/rappel.ts`), et c'est correct : un rappel dit « commence à
   * cuisiner, ça prend 45 min », ce qu'un plat préparé n'a pas. Mais le plan a CHANGÉ, et les
   * rappels des AUTRES créneaux doivent suivre — sans cet appel, l'appareil sonnerait encore pour
   * le plat que celui-ci vient de remplacer.
   *
   * Le moteur RECALCULE les avertissements au passage : c'est ce recalcul qui RETIRE l'alerte de
   * plancher de cette journée, et non l'écran qui la masquerait.
   */
  const poserHorsCatalogue = useCallback(
    (slot: SlotRef, libelle: string) => {
      if (etat.phase !== 'pret') return
      const { plan, profil } = etat.vue

      chargerSocle()
        .then((socle) => {
          const suivant = socle.moteur.setSlotHorsCatalogue(plan, slot, libelle, profil)
          savePlan(socle.db, suivant, maintenantIso())
          reprogrammerLesRappels(socle, suivant)
          const refusSuivants = new Map(refus)
          refusSuivants.delete(cleCreneau(slot.date, slot.creneau))
          setRefus(refusSuivants)
          setAChoisir(null)
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, refus, echouer]
  )

  /**
   * « Je mange dehors » — UN clic, aucune frappe (décision 76, lot `retour-3`).
   *
   * ⚠️ MÊME CHEMIN D'ÉCRITURE QUE L'ONGLET « UN PLAT PRÉPARÉ », à un détail près : le libellé est
   * fourni au lieu d'être demandé. Le créneau n'est ni supprimé ni recalculé — il est ÉTIQUETÉ, ce
   * qui est la décision 76 en toutes lettres. La journée reste au plan, les autres créneaux ne
   * bougent pas, et le moteur retire de lui-même l'alerte de plancher de cette journée-là.
   *
   * On retient le plat remplacé AVANT d'écrire, sinon il n'y a plus rien à retenir après.
   */
  const poserDehors = useCallback(
    (slot: SlotRef) => {
      if (etat.phase !== 'pret') return
      const entree = etat.vue.plan.entries.find((e) => memeCreneau(e, slot))
      retenirLePlat(slot, entree)
      poserHorsCatalogue(slot, LIBELLE_DEHORS)
    },
    [etat, poserHorsCatalogue]
  )

  /**
   * Se raviser : le créneau retrouve le plat exact qu'il portait, accompagnement compris.
   *
   * ⚠️ LE BOUTON N'EXISTE QUE SI LE RETOUR EST EXACT. Un créneau qui portait un RESTE n'est pas
   * retenu (voir `ui/dehors.ts`) : il n'y a donc rien à rendre, et rien n'est proposé. Mieux vaut
   * pas de bouton qu'un bouton qui rend autre chose que ce qu'il annonce.
   *
   * ⚠️ PAR LE MOTEUR, PAS À LA MAIN. `poser` appelle `setSlotRecipe`, qui repose le créneau avec
   * les portions du catalogue et lui rend son accompagnement. Rétablir `recipeId` et effacer
   * l'étiquette soi-même laisserait un plat à ZÉRO portion — visible nulle part, et pourtant plus
   * un seul ingrédient sur la liste de courses.
   */
  /**
   * « Manger un reste » — l'utilisateur décide QUEL plat déjà cuisiné se resert ici (décision 78).
   *
   * ⚠️ CE N'EST PAS `planLeftovers` AVEC UN ARGUMENT. Le placement automatique distribue les
   * portions restantes tout seul, et §7.3 dit pourquoi ; ce geste-ci DÉPLACE une décision déjà
   * prise — mesuré, une semaine fraîchement composée n'offre plus aucune portion non distribuée.
   * C'est la réponse au retour d'essai « trop compliqué à gérer » : la machine décidait seule.
   *
   * ⚠️ LA MÉMOIRE SE PREND AVANT L'ÉCRITURE. Après, le créneau porte le reste et le créneau de
   * cuisson porte un verrou dont plus rien ne dit qui l'a posé — voir `ui/restes.ts`.
   */
  const poserReste = useCallback(
    (slot: SlotRef, recipeId: RecipeId) => {
      if (etat.phase !== 'pret') return
      const { plan, profil } = etat.vue
      const cible = plan.entries.find((e) => memeCreneau(e, slot) && e.service !== 'accompagnement')
      const cuisson = plan.entries.find(
        (e) => e.recipeId === recipeId && !e.isLeftover && e.service !== 'accompagnement'
      )
      if (cible === undefined || cuisson === undefined) return

      chargerSocle()
        .then((socle) => {
          const suivant = socle.moteur.setSlotLeftover(plan, slot, recipeId, profil, reglages.convives)
          // Le moteur refuse en rendant le plan tel quel : rien à enregistrer, rien à mémoriser.
          if (suivant === plan) {
            setPourReste(null)
            return
          }
          retenirLeGeste(slot, { cible, cuisson })
          savePlan(socle.db, suivant, maintenantIso())
          // ⚠️ LES RAPPELS SUIVENT LE PLAT, comme pour « Choisir » : l'appareil sonnerait encore
          // pour le plat que ce reste vient de remplacer.
          reprogrammerLesRappels(socle, suivant)
          const refusSuivants = new Map(refus)
          refusSuivants.delete(cleCreneau(slot.date, slot.creneau))
          setRefus(refusSuivants)
          // Le créneau porte un autre plat : la mémoire du « dehors » n'a plus d'objet.
          oublierLePlat(slot)
          setPourReste(null)
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, refus, reglages.convives, echouer]
  )

  /**
   * Se raviser : le créneau retrouve son plat, et le créneau de la CUISSON son verrou d'avant.
   *
   * ⚠️ LES DEUX CÔTÉS, PAS SEULEMENT LA CIBLE. Poser un reste verrouille aussi la cuisson pour
   * qu'une recomposition continue de l'ordonner ; rendre le plat sans relâcher ce verrou
   * laisserait figé un créneau que personne n'a demandé à garder.
   */
  const defaireReste = useCallback(
    (slot: SlotRef) => {
      if (etat.phase !== 'pret') return
      const memoire = gestePrecedent(slot)
      if (memoire === null) return
      const { plan, profil } = etat.vue

      chargerSocle()
        .then((socle) => {
          const suivant = socle.moteur.unsetSlotLeftover(plan, slot, memoire, profil)
          if (suivant === plan) return
          oublierLeGeste(slot)
          savePlan(socle.db, suivant, maintenantIso())
          reprogrammerLesRappels(socle, suivant)
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, echouer]
  )

  const defaireDehors = useCallback(
    (slot: SlotRef) => {
      const precedent = platDAvant(slot)
      if (precedent !== null) poser(slot, precedent)
    },
    [poser]
  )

  /**
   * « Décaler ce plat ? » → Décaler (décision 75, lot `retour-8`) : le plat prend la place de son
   * premier reste à venir. Un seul geste, écrit en base comme tous les autres.
   *
   * ⚠️ L'HEURE SE LIT AU CLIC, pas au rendu : une carte affichée à 13 h 59 et cliquée à 14 h 01 doit
   * décider avec l'heure du geste.
   */
  const decaler = useCallback(
    (slot: SlotRef) => {
      if (etat.phase !== 'pret') return
      const { plan, profil } = etat.vue
      const maintenant = new Date()

      chargerSocle()
        .then((socle) => {
          const suivant = socle.moteur.decalerPlat(plan, slot, (s) => estPasse(s, maintenant), profil)
          if (suivant === plan) return
          savePlan(socle.db, suivant, maintenantIso())
          // ⚠️ LES RAPPELS SUIVENT LE PLAT, comme pour « Choisir » : il a changé de jour.
          reprogrammerLesRappels(socle, suivant)
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, echouer]
  )

  /**
   * « Non » : RIEN ne change au planning, rien n'est enregistré sur ce qui a été mangé. La question
   * ne revient plus pour ce repas — et seulement pour lui.
   */
  const refuserDecalage = useCallback(
    (slot: SlotRef) => {
      if (etat.phase !== 'pret') return
      const { plan } = etat.vue
      const recipeId = plan.entries.find((e) => memeCreneau(e, slot) && e.service !== 'accompagnement')?.recipeId
      if (recipeId === undefined || recipeId === null) return

      chargerSocle()
        .then((socle) => {
          // ⚠️ EN BASE, PAS DANS L'ÉTAT DE L'ÉCRAN : la question ne doit revenir ni au rechargement,
          // ni le lendemain.
          writeSansDecalage(socle.db, plan.id, slot, recipeId)
          setSansDecalage((avant) => new Set(avant).add(cleSansDecalage(slot, recipeId)))
        })
        .catch(echouer)
    },
    [etat, echouer]
  )

  if (etat.phase === 'chargement') return <p className="text-attenue">Construction de la semaine…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-lecture font-semibold text-texte">La semaine n'a pas pu être construite.</p>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }
  if (etat.phase === 'vide') {
    return (
      <SemaineVide
        reglages={reglages}
        onChange={setReglages}
        onComposer={() => replanifier(reglages)}
        onRemplir={() => remplirSoiMeme(reglages)}
      />
    )
  }

  const { plan, nomDe } = etat.vue
  const creneaux = creneauxDuPlan(plan)
  const dates = [...new Set(plan.entries.map((e) => e.slot.date))]
  const maintenant = new Date()
  const passe = (s: SlotRef): boolean => estPasse(s, maintenant)

  /** Tout ce que la case ET sa fenêtre montrent d'un créneau — calculé à un seul endroit. */
  const decrire = (slot: SlotRef): Description | null => {
    // ⚠️ DEUX ENTRÉES POSSIBLES PAR CRÉNEAU depuis le mode repas — `find` seul rendait le plat et
    // faisait DISPARAÎTRE l'accompagnement de l'écran alors qu'il est bien au plan, compté dans
    // l'énergie du jour et acheté dans les courses. Le défaut n'aurait rien cassé : il aurait menti.
    const duCreneau = plan.entries.filter((e) => memeCreneau(e, slot))
    const entry = duCreneau.find((e) => e.service !== 'accompagnement')
    if (entry === undefined) return null
    const accompagnement = duCreneau.find((e) => e.service === 'accompagnement')
    // ⚠️ LE JOUR DE LA CUISSON, PAS « la veille ». Mesuré : 4 des 13 restes que le moteur pose à
    // 3 repas/jour ont DEUX jours ou plus — la carte annonçait la veille pour tous.
    const cuissonDuReste =
      !entry.isLeftover || entry.recipeId === null
        ? undefined
        : plan.entries.find(
            (e) => e.recipeId === entry.recipeId && !e.isLeftover && e.service !== 'accompagnement'
          )
    return {
      entry,
      nom: entry.recipeId === null ? null : nomDe(entry.recipeId),
      photo:
        entry.recipeId === null || socleCharge === null
          ? null
          : socleCharge.catalogue.recipes.get(entry.recipeId)?.imagePath || null,
      accompagnement:
        accompagnement?.recipeId == null
          ? null
          : { recipeId: accompagnement.recipeId, nom: nomDe(accompagnement.recipeId) },
      resteDepuis: cuissonDuReste === undefined ? null : formaterJour(cuissonDuReste.slot.date),
      // Ce que le moteur accepterait de servir ici en reste. Vide = pas de bouton : un geste
      // proposé là où il ne peut rien faire se paie en confiance, pas en clics.
      sourcesReste:
        socleCharge === null ? [] : socleCharge.moteur.sourcesDeReste(plan, slot, reglages.convives),
      // « Décaler ce plat ? » — la QUESTION est écrite dans la case (décision 75) ; ses réponses
      // vivent dans la fenêtre que l'utilisateur ouvre lui-même. Rien ne s'ouvre seul.
      question:
        socleCharge !== null &&
        entry.recipeId !== null &&
        !sansDecalage.has(cleSansDecalage(slot, entry.recipeId)) &&
        socleCharge.moteur.peutDecaler(plan, slot, passe),
    }
  }

  const descriptionOuverte = ouvert === null ? null : decrire(ouvert)
  /** Un geste de la fenêtre la referme TOUJOURS d'abord : jamais deux fenêtres empilées. */
  const puis = (geste: () => void) => () => {
    setOuvert(null)
    geste()
  }

  return (
    <section>
      <h1 data-visite="titre-semaine" className="text-titre-l text-texte">
        Ma semaine
      </h1>
      <p className="mt-2 text-courant leading-relaxed text-attenue">
        {/* ⚠️ DES REPAS, PAS DES ENTRÉES. Compter les lignes du plan doublerait le total depuis que
            le déjeuner porte un plat ET son accompagnement : « 28 repas prévus » pour quatorze
            assiettes. On compte les CRÉNEAUX servis. */}
        {formaterPlage(dates)} · {repasServis(plan)} repas prévus
      </p>

      {/* ⚠️ L'EN-TÊTE TIENT EN UNE LIGNE (lot F1). Jours, repas, convives et la légende occupaient
          le haut de l'écran en permanence pour des réglages qu'on touche une fois : ils passent
          derrière ⚙, et la semaine monte d'autant. */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          data-visite="autre-semaine"
          onClick={() => replanifier({ ...reglages, graine: reglages.graine + 1 })}
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-lecture font-semibold text-white"
        >
          Proposer une autre semaine
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Réglages de la semaine"
          onClick={() => setReglagesOuverts(true)}
          className="flex min-h-cta items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-surface px-4 text-titre-s text-texte-doux hover:bg-accent-doux"
        >
          ⚙
        </button>
      </div>
      {epure.phrasesRassurantes && (
        <p className="mt-2 text-courant text-attenue">Vos repas gardés ne changeront pas.</p>
      )}

      {/* ⛔ L'ALERTE D'ÉNERGIE NE PART PAS AVEC L'ÉPURE. Ce n'est pas de la réassurance : §6.5
          ARCHITECTURE veut qu'un plan qui sous-alimente le dise. Elle a déjà son propre réglage
          (`alertes_discretes`), et même discrète elle ne disparaît jamais. */}
      {modeAvance && <AlerteEnergie warnings={plan.warnings} />}

      {/* LA FRISE : une ligne par jour, les repas du matin au soir. Chaque case est une vignette
          qu'on touche ; les gestes vivent dans la fenêtre qu'elle ouvre (lot F1). */}
      <div className="mt-4 space-y-3">
        {dates.map((date) => (
          <article key={date} className="rounded-[--radius-carte] border border-bordure bg-surface p-3">
            <h2 className="font-titre text-titre-s text-texte">{formaterJour(date)}</h2>
            <div className={`mt-2 grid gap-2 ${COLONNES[creneaux.length] ?? 'grid-cols-3'}`}>
              {creneaux.map((creneau) => {
                const description = decrire({ date, creneau })
                return description === null ? null : (
                  <Creneau
                    key={creneau}
                    description={description}
                    onOuvrir={() => setOuvert({ date, creneau })}
                    onChoisir={() => setAChoisir({ date, creneau })}
                  />
                )
              })}
            </div>
          </article>
        ))}
      </div>

      {reglagesOuverts && (
        <Panneau titre="Réglages de la semaine" onFermer={() => setReglagesOuverts(false)}>
          <Reglage reglages={reglages} onChange={(suivants) => replanifier(suivants)} />
          <Legende />
          {/* ⚠️ LA FENÊTRE SE FERME AVANT LA CONFIRMATION : jamais deux fenêtres empilées. */}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setReglagesOuverts(false)
              setAVider(true)
            }}
            className="mt-5 flex min-h-tactile w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-surface px-4 text-courant font-semibold text-texte"
          >
            Vider la semaine
          </button>
        </Panneau>
      )}

      {aVider && (
        <Panneau titre="Vider la semaine ?" onFermer={() => setAVider(false)}>
          {/* Le compte vient du plan : plat du catalogue ou plat préparé, un créneau = un repas. */}
          <p className="text-lecture leading-relaxed text-texte">
            {repasServis(plan)} repas prévus seront retirés, repas gardés compris. Les cases restent,
            vides, à remplir.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setAVider(false)}
              className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-surface px-4 text-lecture font-semibold text-texte"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={viderLaSemaine}
              className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] bg-accent-plein px-4 text-lecture font-semibold text-white"
            >
              Vider
            </button>
          </div>
        </Panneau>
      )}

      {/* ⚠️ MONTÉES AU NIVEAU DE L'ÉCRAN, pas dans la case. `Panneau` passe par un portail vers
          `document.body` : une par case donnerait 21 composants prêts à s'ouvrir pour un seul qui
          s'ouvre jamais à la fois. */}
      {ouvert !== null && descriptionOuverte !== null && (
        <GestesDuRepas
          titre={`${formaterJour(ouvert.date)} · ${LIBELLE_CRENEAU[ouvert.creneau]}`}
          description={descriptionOuverte}
          onFermer={() => setOuvert(null)}
          onGarder={puis(() => basculerVerrou(ouvert))}
          onChanger={puis(() => changer(ouvert))}
          onChoisir={puis(() => setAChoisir(ouvert))}
          onDehors={puis(() => poserDehors(ouvert))}
          onRestes={
            descriptionOuverte.sourcesReste.length === 0 ? null : puis(() => setPourReste(ouvert))
          }
          onDefaireReste={gestePrecedent(ouvert) === null ? null : puis(() => defaireReste(ouvert))}
          onDefaire={platDAvant(ouvert) === null ? null : puis(() => defaireDehors(ouvert))}
          question={
            descriptionOuverte.question
              ? { onDecaler: puis(() => decaler(ouvert)), onNon: puis(() => refuserDecalage(ouvert)) }
              : null
          }
        />
      )}

      {aChoisir !== null && socleCharge !== null && (
        <ChoisirPlat
          socle={socleCharge}
          date={aChoisir.date}
          creneau={aChoisir.creneau}
          libelleCreneau={`${formaterJour(aChoisir.date)} · ${LIBELLE_CRENEAU[aChoisir.creneau]}`}
          onPoser={(recipeId) => poser(aChoisir, recipeId)}
          onPoserHorsCatalogue={(libelle) => poserHorsCatalogue(aChoisir, libelle)}
          onFermer={() => setAChoisir(null)}
        />
      )}

      {pourReste !== null && socleCharge !== null && (
        <ChoisirUnReste
          libelleCreneau={`${formaterJour(pourReste.date)} · ${LIBELLE_CRENEAU[pourReste.creneau]}`}
          sources={socleCharge.moteur.sourcesDeReste(plan, pourReste, reglages.convives)}
          nomDe={nomDe}
          onPoser={(recipeId) => poserReste(pourReste, recipeId)}
          onFermer={() => setPourReste(null)}
        />
      )}
    </section>
  )
}

/**
 * L'écran tant qu'aucune semaine n'a été composée.
 *
 * Les réglages sont là AVANT le bouton, pour la même raison qu'ils passent avant « Proposer une
 * autre semaine » : on choisit combien de jours et pour combien de personnes, puis on lance.
 */
function SemaineVide({
  reglages,
  onChange,
  onComposer,
  onRemplir,
}: {
  readonly reglages: Reglages
  readonly onChange: (suivants: Reglages) => void
  readonly onComposer: () => void
  /** La seconde porte (lot F2) : une frise vide, sans le moteur. */
  readonly onRemplir: () => void
}) {
  return (
    <section>
      <h1 data-visite="titre-semaine" className="text-titre-l text-texte">
        Ma semaine
      </h1>
      <p className="mt-3 text-lecture leading-relaxed text-texte-doux">
        Rien de prévu pour l'instant. Composez une semaine quand vous voulez — vous pourrez changer
        chaque repas ensuite.
      </p>

      {/* Réglage local : on n'écrit RIEN en base tant que la semaine n'est pas composée. */}
      <Reglage reglages={reglages} onChange={onChange} />

      <button
        type="button"
        data-visite="composer-semaine"
        onClick={onComposer}
        className="mt-4 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-lecture font-semibold text-white"
      >
        Composer ma semaine
      </button>

      <button
        type="button"
        onClick={onRemplir}
        className="mt-3 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-surface px-5 text-lecture font-semibold text-texte"
      >
        Je la remplis moi-même
      </button>

      <a
        href={hashDuFrigo()}
        className="mt-3 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-courant font-semibold text-accent-texte no-underline"
      >
        Ou partir de ce que j'ai dans le frigo
      </a>
    </section>
  )
}

/**
 * L'avertissement de plancher calorique — §6.5 ARCHITECTURE.
 *
 * ⚠️ AMENDEMENT du 2026-08-02 : ce composant n'est monté QUE si le mode avancé est actif
 * (`afficher_macros`, case « Afficher plus de détails » du panneau Réglages d'affichage).
 * L'avertissement n'est plus affiché par défaut — `checkCalorieFloor` continue de tourner à chaque
 * plan et `WeekPlan.warnings` reste toujours peuplé, seul l'affichage est devenu conditionnel. Voir
 * `parent (Semaine)` pour la condition de montage, et ARCHITECTURE.md §6.5 pour le raisonnement.
 *
 * Le réglage « version courte » (`alertes_discretes`) a disparu avec cet amendement : il n'avait de
 * sens que pour raccourcir un texte visible par défaut, et n'a donc plus d'objet. Le libellé
 * conservé est le long (« … apporte(nt) moins d'énergie que la référence habituelle. »).
 *
 * ⚠️ LE MARQUEUR RESTE TOUJOURS VISIBLE UNE FOIS MONTÉ, LE DÉTAIL PART EN FENÊTRE. Le bloc listait
 * autrefois chaque journée en clair, en permanence : sur une semaine un peu légère, sept lignes
 * rouges accueillaient l'utilisateur à chaque visite. Une version dépliante EN PLACE a suivi, mais
 * un dépliant pousse tout ce qui suit vers le bas au tap — précisément ce que `Panneau` existe pour
 * éviter (voir son en-tête). Le marqueur (icône + résumé) reste dans le flux de l'écran ; le détail
 * (une ligne par jour) s'ouvre désormais dans une fenêtre en superposition, et la semaine en
 * dessous ne bouge plus.
 */
function AlerteEnergie({ warnings }: { readonly warnings: WeekPlan['warnings'] }) {
  const [panneauOuvert, setPanneauOuvert] = useState(false)
  if (warnings.length === 0) return null

  // ⚠️ « LES REPAS PRÉVUS », JAMAIS « LA JOURNÉE ». Le texte disait « une journée apporte moins
  // d'énergie que la référence habituelle » : deux erreurs dans une phrase de dix mots. Ce qui est
  // additionné, ce sont les recettes POSÉES AU PLAN — pas le pain sur la table, pas le yaourt, pas
  // un repas pris dehors, et pas le petit-déjeuner quand le plan n'a que deux créneaux, ce qui est
  // le DÉFAUT de cet écran. Et 1 200 kcal n'est pas « la référence habituelle » (≈ 2 000 pour une
  // femme active) mais le SEUIL DE VIGILANCE de §6.5. Annoncer à quelqu'un qu'il mange 830 kcal par
  // jour quand on n'en sait rien est précisément ce qu'une application à garde-fous TCA ne doit pas
  // produire.
  const resume =
    warnings.length === 1
      ? 'Sur une journée, les repas prévus restent sous le seuil de vigilance.'
      : `Sur ${warnings.length} journées, les repas prévus restent sous le seuil de vigilance.`

  return (
    <div
      role="status"
      className="mt-5 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond text-courant leading-relaxed text-alerte-texte"
    >
      <button
        type="button"
        onClick={() => setPanneauOuvert(true)}
        // ⚠️ `aria-haspopup="dialog"` ET NON `aria-expanded` — même raisonnement que dans
        // `filtres-recettes.tsx` (voir son en-tête) : ce bouton n'agrandit plus rien EN PLACE, il
        // ouvre une fenêtre. Annoncer « replié / déplié » laisserait attendre un texte qui s'allonge
        // sous lui, alors que le focus part ailleurs.
        aria-haspopup="dialog"
        className="flex min-h-tactile w-full items-center gap-3 px-4 py-2 text-left"
      >
        {/* Le marqueur. `aria-hidden` : le texte qui suit dit déjà tout, l'annoncer deux fois
            alourdirait la lecture d'écran sans rien ajouter. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="7.5" x2="12" y2="13" />
          <line x1="12" y1="16.3" x2="12" y2="16.4" />
        </svg>
        <span className="flex-1 font-semibold">{resume}</span>
        <span aria-hidden="true" className="shrink-0 text-mention font-semibold">
          Détail
        </span>
      </button>

      {panneauOuvert && (
        <Panneau titre="Journées à surveiller" onFermer={() => setPanneauOuvert(false)}>
          <ul className="list-inside list-disc">
            {warnings.map((w) => (
              <li key={w.date}>
                {formaterJour(w.date)} — {w.repasComptes} repas prévus, {Math.round(w.kcal)} kcal au total.
                Seuil de vigilance : {w.seuil} kcal pour une journée entière.
              </li>
            ))}
          </ul>
          {/* ⚠️ CE PARAGRAPHE EST LA MOITIÉ UTILE DU PANNEAU, pas une précaution de forme. Sans lui,
              les chiffres ci-dessus se lisent comme un journal alimentaire — ce que §6.5 interdit
              explicitement. Il dit ce qui n'est PAS compté, et il ne prescrit rien : ni « mangez
              plus », ni « ajoutez un plat ». On informe, on ne juge pas (principe 6). */}
          <p className="mt-3">
            Ce total ne compte que les recettes de votre plan. Le pain, un yaourt, un fruit, un repas
            pris ailleurs — rien de tout cela n'y figure, et le petit-déjeuner non plus s'il n'est pas
            au plan.
          </p>
        </Panneau>
      )}
    </div>
  )
}

function Reglage({
  reglages,
  onChange,
}: {
  readonly reglages: Reglages
  readonly onChange: (suivants: Reglages) => void
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-4 rounded-[--radius-carte] border border-bordure bg-surface p-4 text-courant">
      <label className="flex items-center gap-2">
        <span className="text-texte-doux">Jours</span>
        <ChampJours valeur={reglages.jours} onValider={(jours) => onChange({ ...reglages, jours })} />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-texte-doux">Repas par jour</span>
        <select
          value={reglages.repasParJour}
          onChange={(e) => onChange({ ...reglages, repasParJour: Number(e.target.value) })}
          className="min-h-tactile rounded-[0.6rem] border border-bordure-forte bg-fond px-3 text-texte"
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-texte-doux">Convives</span>
        <select
          value={reglages.convives}
          onChange={(e) => onChange({ ...reglages, convives: Number(e.target.value) })}
          className="min-h-tactile rounded-[0.6rem] border border-bordure-forte bg-fond px-3 text-texte"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/**
 * Champ « Jours », avec une SAISIE LOCALE validée à la sortie.
 *
 * ⚠️ RÉGRESSION D'UN BUG RÉEL. La version précédente n'appelait `onChange` que si la valeur était
 * déjà dans [2, 14] — et le champ était contrôlé sur l'état parent. Pour taper « 14 » il fallait
 * passer par « 1 », rejeté, et React restaurait aussitôt l'ancienne valeur : la frappe était
 * IMPOSSIBLE, seules les flèches fonctionnaient. Pire, chaque frappe valide replanifiait toute la
 * semaine.
 *
 * D'où la séparation : on tape librement, on ne replanifie qu'à la validation (sortie du champ ou
 * touche Entrée), et une saisie hors bornes revient à la dernière valeur valable plutôt que de
 * lever — `planWeek` refuse une fenêtre hors de §7.1, et un écran d'erreur pour une frappe en cours
 * serait absurde.
 */
function ChampJours({
  valeur,
  onValider,
}: {
  readonly valeur: number
  readonly onValider: (jours: number) => void
}) {
  const [saisie, setSaisie] = useState(String(valeur))

  // Le parent peut changer la valeur sans nous (reprise d'un plan enregistré) : on suit.
  useEffect(() => setSaisie(String(valeur)), [valeur])

  const valider = () => {
    const jours = Number(saisie)
    if (Number.isInteger(jours) && jours >= MIN_PLAN_DAYS && jours <= MAX_PLAN_DAYS) {
      if (jours !== valeur) onValider(jours)
      return
    }
    setSaisie(String(valeur))
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN_PLAN_DAYS}
      max={MAX_PLAN_DAYS}
      value={saisie}
      onChange={(e) => setSaisie(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      aria-label={`Nombre de jours, entre ${MIN_PLAN_DAYS} et ${MAX_PLAN_DAYS}`}
      className="min-h-tactile w-20 rounded-[0.6rem] border border-bordure-forte bg-fond px-3 tabular-nums text-texte"
    />
  )
}

/**
 * Légende des quatre états (§4.2 : « quatre états immédiatement distinguables, AVEC légende »).
 *
 * ⚠️ Aucune couleur de jugement (§5 DESIGN, principe 6 ARCHITECTURE) : la distinction est
 * typographique et par bordure, jamais un feu tricolore. Un plat n'est ni bon ni mauvais.
 */
function Legende() {
  return (
    <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-mention text-attenue">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-4 rounded-[0.3rem] border border-bordure-forte bg-surface" />
        Proposé
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-4 rounded-[0.3rem] border-2 border-accent bg-accent-doux" />
        Gardé
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-4 rounded-[0.3rem] border border-bordure-forte bg-accent-doux" />
        Reste
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-4 rounded-[0.3rem] border border-dashed border-bordure-forte" />
        Vide
      </li>
    </ul>
  )
}

/** Ce que la case ET sa fenêtre montrent d'un créneau. */
interface Description {
  readonly entry: MealPlanEntry
  readonly nom: string | null
  /** Le chemin de la photo, LU dans le catalogue — jamais fabriqué. `null` : l'aplat prend la place. */
  readonly photo: string | null
  /** L'accompagnement posé sur le MÊME créneau, ou `null` en mode recette (un plat seul). */
  readonly accompagnement: { readonly recipeId: RecipeId; readonly nom: string } | null
  /** Le jour où le plat de ce reste a été cuisiné, déjà formaté, ou `null` si on ne le sait pas. */
  readonly resteDepuis: string | null
  readonly sourcesReste: readonly SourceDeReste[]
  /** Ce repas porte « Décaler ce plat ? » (décision 75). */
  readonly question: boolean
}

/** Une colonne par repas : la ligne du jour se lit du matin au soir, sans retour à la ligne. */
const COLONNES: Readonly<Record<number, string>> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
}

/** Le mot « dehors » posé par le geste en un clic — c'est lui, et lui seul, qui porte 🚶. */
const estDehors = (entry: MealPlanEntry): boolean => entry.horsCatalogue === LIBELLE_DEHORS

/**
 * Une case de la frise : une VIGNETTE, dans l'un des QUATRE ÉTATS que §4.2 exige « immédiatement
 * distinguables ».
 *
 * ⛔ UN SEUL CONTRÔLE, qui ouvre la fenêtre des gestes (lot F1). La case portait jusqu'à six
 * boutons : à 3 repas × 7 jours, la semaine se lisait comme un formulaire. Le bouton recouvre la
 * case entière — on touche le repas, pas une zone de trois millimètres.
 * ⛔ LE NOM, LES MARQUES, LE MOTIF ET LA QUESTION SONT DU TEXTE DE LA CASE, HORS DU BOUTON : des
 * clauses scellées (`retour-4`, `retour-5b`) retirent les contrôles avant de lire les mentions.
 *
 * ⚠️ AUCUN ÉTAT N'EST PORTÉ PAR LA SEULE COULEUR. Bordure, épaisseur, trait plein ou pointillé,
 * signe et mention écrite se cumulent : un daltonien, un écran en plein soleil ou un mode sombre mal
 * calibré ne doivent pas faire disparaître l'information. Le signe (📌 ↺ 🚶) est `aria-hidden` :
 * c'est le mot qui le suit qui parle au lecteur d'écran.
 *
 * ⚠️ AUCUNE COULEUR DE JUGEMENT (§5 DESIGN, principe 6 ARCHITECTURE) : l'accent signale ce que
 * l'utilisateur a décidé, pas ce que l'application pense du plat.
 */
function Creneau({
  description,
  onOuvrir,
  onChoisir,
}: {
  readonly description: Description
  readonly onOuvrir: () => void
  /** Case vide : le ＋ ouvre « Choisir un plat » directement (lot F2). */
  readonly onChoisir: () => void
}) {
  const { entry, nom, photo, resteDepuis, question } = description
  // ⚠️ « VIDE » N'EST PAS « SANS RECETTE » depuis la décision 51. Un plat préparé porte
  // `recipeId: null` ET un libellé : le créneau est REMPLI.
  const horsCatalogue = entry.horsCatalogue
  const vide = entry.recipeId === null && horsCatalogue === null
  const apparence = entry.locked
    ? 'border-2 border-accent bg-accent-doux'
    : vide
      ? 'border border-dashed border-bordure-forte bg-transparent'
      : entry.isLeftover
        ? 'border border-bordure-forte bg-accent-doux'
        : 'border border-bordure-forte bg-surface'

  return (
    <div className={`relative flex min-w-0 flex-col rounded-[--radius-carte] p-2 ${apparence}`}>
      <p className="text-mention font-semibold uppercase tracking-wide text-attenue">
        {LIBELLE_CRENEAU[entry.slot.creneau]}
      </p>

      {/* ⛔ LE `src` SE LIT, IL NE SE FABRIQUE PAS (même règle que la fiche recette). Sans photo,
          l'aplat et l'initiale — un motif, pas une fausse photo. */}
      {photo !== null ? (
        <img
          src={photo}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="mt-1 aspect-[4/3] w-full rounded-[0.6rem] object-cover"
        />
      ) : entry.recipeId !== null ? (
        <div
          aria-hidden="true"
          style={{ backgroundColor: couleurDeRecette(entry.recipeId) }}
          className="mt-1 flex aspect-[4/3] w-full items-center justify-center rounded-[0.6rem]"
        >
          <span className="font-titre text-titre-l leading-none text-white/70">
            {initialeDeRecette(nom ?? '')}
          </span>
        </div>
      ) : null}

      <p className="mt-1 line-clamp-2 break-words font-titre text-courant leading-snug text-texte">
        {horsCatalogue !== null ? (
          <>
            {estDehors(entry) && <span aria-hidden="true">🚶 </span>}
            {horsCatalogue}
          </>
        ) : nom === null ? (
          <span className="text-attenue">Aucun plat</span>
        ) : (
          nom
        )}
      </p>

      {/* ⚠️ LA CASE VIDE DIT POURQUOI ELLE EST VIDE (lot `retour-5b`) — constaté par le moteur au
          tirage, relu tel quel (`engine/planning/motif-vide.ts`). */}
      {vide && phraseDuMotif(entry.motifVide) !== null && (
        <p className="mt-1 text-mention leading-snug text-attenue">{phraseDuMotif(entry.motifVide)}</p>
      )}

      {/* ⛔ LES DEUX FAITS, PAS UN CHOIX ENTRE EUX : un reste qu'on garde reste un reste. ⛔ ET JAMAIS
          « la veille » AU JUGÉ : le jour de la cuisson, lu dans le plan. */}
      {entry.isLeftover && (
        <p className="mt-1 text-mention font-medium text-accent-texte">
          <span aria-hidden="true">↺ </span>
          {resteDepuis === null ? 'Reste d’un plat déjà cuisiné' : `Reste du plat de ${resteDepuis}`}
        </p>
      )}
      {entry.locked && (
        <p className="mt-1 text-mention font-medium text-accent-texte">
          <span aria-hidden="true">📌 </span>
          Gardé
        </p>
      )}

      {/* ⛔ UNE QUESTION DE PLANNING, PAS DE REPAS (décision 75) : aucun mot sur ce qui a été mangé,
          et rien ne s'ouvre seul. Les réponses sont dans la fenêtre que l'on ouvre soi-même. */}
      {question && <p className="mt-1 text-mention font-semibold text-texte">Décaler ce plat ?</p>}

      {/* ⚠️ UNE CASE VIDE N'A QU'UN GESTE QUI VAILLE : la remplir (lot F2). Son ＋ ouvre « Choisir un
          plat » sans passer par la fenêtre des gestes — toujours UN seul contrôle par case. */}
      {vide ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onChoisir}
          className="absolute inset-0 flex items-center justify-center rounded-[--radius-carte] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span aria-hidden="true" className="text-titre-l leading-none text-texte-doux">
            ＋
          </span>
          <span className="sr-only">Choisir un plat pour ce repas</span>
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOuvrir}
          className="absolute inset-0 rounded-[--radius-carte] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="sr-only">Voir les gestes de ce repas</span>
        </button>
      )}
    </div>
  )
}

/**
 * La fenêtre d'un repas : tout ce qu'on peut faire de cette case, et rien d'autre (lot F1).
 *
 * ⛔ CHAQUE GESTE REFERME LA FENÊTRE AVANT D'AGIR — y compris ceux qui en ouvrent une autre
 * (« Choisir moi-même », « Manger un reste ») : jamais deux fenêtres empilées.
 */
function GestesDuRepas({
  titre,
  description,
  onFermer,
  onGarder,
  onChanger,
  onChoisir,
  onDehors,
  onDefaire,
  onRestes,
  onDefaireReste,
  question,
}: {
  readonly titre: string
  readonly description: Description
  readonly onFermer: () => void
  readonly onGarder: () => void
  /** Tirage : le moteur repropose. */
  readonly onChanger: () => void
  /** Choix : l'utilisateur désigne le plat lui-même (décision 49). */
  readonly onChoisir: () => void
  /** « Je mange dehors » : étiquette le créneau, sans frappe (décision 76). */
  readonly onDehors: () => void
  /** Se raviser. `null` quand plus rien n'est en mémoire — après un rechargement, notamment. */
  readonly onDefaire: (() => void) | null
  /** Ouvrir le choix des restes servables ici. `null` quand aucun plat de la semaine ne l'est. */
  readonly onRestes: (() => void) | null
  /** Défaire le reste posé à la main. `null` quand plus rien n'est en mémoire. */
  readonly onDefaireReste: (() => void) | null
  /** Les deux réponses à « Décaler ce plat ? », ou `null` quand ce repas ne porte pas la question. */
  readonly question: { readonly onDecaler: () => void; readonly onNon: () => void } | null
}) {
  const { entry, nom, accompagnement } = description
  const horsCatalogue = entry.horsCatalogue
  const vide = entry.recipeId === null && horsCatalogue === null
  const bouton =
    'flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux disabled:opacity-45'

  return (
    <Panneau titre={titre} onFermer={onFermer}>
      <p className="font-titre text-lecture leading-snug text-texte">
        {horsCatalogue ?? nom ?? <span className="text-attenue">Aucun plat</span>}
      </p>
      {/* ⚠️ « avec » EN TOUTES LETTRES : deux noms empilés se liraient comme deux plats au choix.
          « Changer » rejoue le plat ET son accompagnement (`reroll-slot.ts`) — on refuse une
          assiette, pas une garniture. */}
      {accompagnement !== null && (
        <p className="mt-1 text-courant leading-snug text-texte-doux">
          avec{' '}
          <a href={hashDeRecette(accompagnement.recipeId, 'semaine')} className="text-texte-doux">
            {accompagnement.nom}
          </a>
        </p>
      )}
      {/* ⚠️ DIRE POURQUOI L'APPLI SE TAIT SUR CE REPAS (décision 51) — un FAIT sur ce qu'elle sait,
          jamais un reproche sur ce qui est mangé (principe 6). */}
      {horsCatalogue !== null && (
        <p className="mt-1 text-mention leading-snug text-attenue">
          Repas noté à la main — l’application ne connaît pas ce qu’il apporte.
        </p>
      )}
      {entry.recipeId !== null && (
        <a
          href={hashDeRecette(entry.recipeId, 'semaine')}
          className="mt-3 flex min-h-tactile items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-courant font-semibold text-accent-texte no-underline"
        >
          Voir la recette
        </a>
      )}

      {question !== null && (
        <div className="mt-4 rounded-[0.7rem] border border-bordure-forte bg-fond p-3">
          <p className="text-courant leading-snug text-texte">
            Ce plat peut prendre la place de son prochain reste.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={question.onDecaler}
              className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] bg-accent-plein px-3 text-courant font-semibold text-white"
            >
              Décaler
            </button>
            <button type="button" onClick={question.onNon} className={`${bouton} flex-1`}>
              Non
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {/* ⛔ L'ANNULATION D'ABORD : c'est le geste qu'on cherche quand on vient de marquer ce repas. */}
        {onDefaireReste !== null && entry.isLeftover && (
          <button type="button" onClick={onDefaireReste} className={bouton}>
            Remettre le plat prévu
          </button>
        )}
        {onDefaire !== null && horsCatalogue !== null && (
          <button type="button" onClick={onDefaire} className={bouton}>
            Finalement je mange ici
          </button>
        )}
        {/* ⚠️ DEUX BOUTONS PARCE QUE CE SONT DEUX GESTES (décision 49) : « Changer » tire,
            « Choisir moi-même » ouvre la sélection. Les mots disent l'acte. */}
        <button type="button" onClick={onChanger} disabled={entry.locked} className={bouton}>
          {vide ? 'Proposer' : 'Changer'}
        </button>
        <button
          type="button"
          onClick={onChoisir}
          disabled={entry.locked}
          aria-haspopup="dialog"
          className={bouton}
        >
          Choisir moi-même
        </button>
        <button
          type="button"
          onClick={onGarder}
          disabled={vide && !entry.locked}
          aria-pressed={entry.locked}
          className={
            entry.locked
              ? 'flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border-2 border-accent bg-surface px-3 text-courant font-semibold text-accent-texte'
              : bouton
          }
        >
          {entry.locked ? 'Relâcher' : 'Garder'}
        </button>
        {/* ⚠️ ABSENT QUAND RIEN N'EST SERVABLE : un bouton qui ouvre une fenêtre vide apprend à ne
            plus cliquer dessus. */}
        {onRestes !== null && (
          <button type="button" onClick={onRestes} aria-haspopup="dialog" className={bouton}>
            Manger un reste
          </button>
        )}
        {/* ⚠️ UN SEUL CLIC, ET LE MOT « DEHORS » EN TOUTES LETTRES (décision 76). */}
        {horsCatalogue === null && (
          <button type="button" onClick={onDehors} disabled={entry.locked} className={bouton}>
            Je mange dehors
          </button>
        )}
      </div>
    </Panneau>
  )
}

/**
 * Les restes servables sur un créneau, un par ligne — décision 78.
 *
 * ⚠️ CHAQUE LIGNE DIT LE JOUR DE LA CUISSON. Sans lui, deux plats se ressemblent et le choix se
 * fait au hasard : « le curry » ne veut rien dire, « le curry de lundi » se décide.
 *
 * ⚠️ AUCUN CHIFFRE DE PORTIONS RESTANTES. Le moteur compte en repas entiers pour le nombre de
 * convives du plan ; afficher « 2 portions » inviterait à une arithmétique que l'application ne
 * refait pas dans l'assiette de l'utilisateur.
 */
function ChoisirUnReste({
  libelleCreneau,
  sources,
  nomDe,
  onPoser,
  onFermer,
}: {
  readonly libelleCreneau: string
  readonly sources: readonly SourceDeReste[]
  readonly nomDe: (id: RecipeId) => string
  readonly onPoser: (recipeId: RecipeId) => void
  readonly onFermer: () => void
}) {
  return (
    <Panneau titre={`Manger un reste — ${libelleCreneau}`} onFermer={onFermer}>
      <p className="text-courant leading-relaxed text-texte-doux">
        Ces plats sont cuisinés plus tôt dans la semaine, en quantité suffisante, et se gardent
        jusque-là. Le repas prévu ici sera remplacé, et le jour de la cuisson sera gardé.
      </p>
      <ul className="mt-4 space-y-2">
        {sources.map((source) => (
          <li key={`${source.slot.date}|${source.slot.creneau}`}>
            <button
              type="button"
              onClick={() => onPoser(source.recipeId)}
              className="flex min-h-cta w-full flex-col items-start justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 py-2 text-left"
            >
              <span className="text-lecture font-semibold text-texte">{nomDe(source.recipeId)}</span>
              <span className="text-mention text-attenue">
                cuisiné {formaterJour(source.slot.date)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panneau>
  )
}

function formaterPlage(dates: readonly string[]): string {
  const premier = dates[0]
  const dernier = dates[dates.length - 1]
  if (premier === undefined || dernier === undefined) return ''
  return premier === dernier ? formaterJour(premier) : `${formaterJour(premier)} → ${formaterJour(dernier)}`
}
