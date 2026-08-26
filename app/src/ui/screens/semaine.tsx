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
import { DEFAULT_PLAN_DAYS, MAX_PLAN_DAYS, MIN_PLAN_DAYS } from '../../engine/planning/plan-week.js'
import { readDisplay, readLatestPlan, readRythme, readUserState, savePlan } from '../../data/user-store.js'
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
import { REPAS_PAR_DEFAUT, creneauxDuRythme } from '../creneau.js'
import { reprogrammerLesRappels } from '../ecrire-plan.js'
import { LienTutoriel } from '../lien-tutoriel.js'
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
          setEtat({ phase: 'pret', vue: planifier(socle, suivants, verrous) })
        })
        .catch(echouer)
    },
    [etat, echouer]
  )

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
      />
    )
  }

  const { plan, nomDe } = etat.vue
  const creneaux = creneauxDuPlan(plan)
  const dates = [...new Set(plan.entries.map((e) => e.slot.date))]

  return (
    <section>
      <h1 data-visite="titre-semaine" className="text-titre-l text-texte">
        Ma semaine
      </h1>
      <LienTutoriel parcoursId="semaine" />
      <p className="mt-2 text-courant leading-relaxed text-attenue">
        {/* ⚠️ DES REPAS, PAS DES ENTRÉES. Compter les lignes du plan doublerait le total depuis que
            le déjeuner porte un plat ET son accompagnement : « 28 repas prévus » pour quatorze
            assiettes. On compte les CRÉNEAUX servis. */}
        {formaterPlage(dates)} · {repasServis(plan)} repas prévus
      </p>

      <Reglage reglages={reglages} onChange={(suivants) => replanifier(suivants)} />

      {/* ⚠️ APRÈS les réglages, et c'est un changement voulu. Le bouton vivait dans l'en-tête, donc
          AVANT les jours / repas / convives qu'il consomme : on relançait un tirage puis on
          découvrait les réglages qu'on aurait voulu changer d'abord. On règle, puis on relance. */}
      <button
        type="button"
        data-visite="autre-semaine"
        onClick={() => replanifier({ ...reglages, graine: reglages.graine + 1 })}
        className="mt-4 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-lecture font-semibold text-white"
      >
        Proposer une autre semaine
      </button>
      <p className="mt-2 text-courant text-attenue">Vos repas gardés ne changeront pas.</p>

      {modeAvance && <AlerteEnergie warnings={plan.warnings} />}

      <Legende />

      <div className="mt-4 space-y-4">
        {dates.map((date) => (
          <article key={date} className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
            <h2 className="font-titre text-titre-s text-texte">{formaterJour(date)}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {creneaux.map((creneau) => {
                // ⚠️ DEUX ENTRÉES POSSIBLES PAR CRÉNEAU depuis le mode repas — `find` seul rendait
                // le plat et faisait DISPARAÎTRE l'accompagnement de l'écran alors qu'il est bien
                // au plan, compté dans l'énergie du jour et acheté dans les courses. Le défaut
                // n'aurait rien cassé : il aurait juste menti.
                const duCreneau = plan.entries.filter((e) => memeCreneau(e, { date, creneau }))
                const entry = duCreneau.find((e) => e.service !== 'accompagnement')
                const accompagnement = duCreneau.find((e) => e.service === 'accompagnement')
                // Ce que le moteur accepterait de servir ici en reste. Vide = pas de bouton : un
                // geste proposé là où il ne peut rien faire se paie en confiance, pas en clics.
                const sourcesReste =
                  socleCharge === null
                    ? []
                    : socleCharge.moteur.sourcesDeReste(plan, { date, creneau }, reglages.convives)
                // ⚠️ LE JOUR DE LA CUISSON, PAS « la veille ». Mesuré : 4 des 13 restes que le moteur
                // pose à 3 repas/jour ont DEUX jours ou plus — la carte annonçait la veille pour tous.
                const cuissonDuReste =
                  entry === undefined || !entry.isLeftover || entry.recipeId === null
                    ? undefined
                    : plan.entries.find(
                        (e) =>
                          e.recipeId === entry.recipeId &&
                          !e.isLeftover &&
                          e.service !== 'accompagnement'
                      )
                return entry === undefined ? null : (
                  <Creneau
                    key={creneau}
                    entry={entry}
                    nom={entry.recipeId === null ? null : nomDe(entry.recipeId)}
                    accompagnement={
                      accompagnement?.recipeId == null
                        ? null
                        : { recipeId: accompagnement.recipeId, nom: nomDe(accompagnement.recipeId) }
                    }
                    onGarder={() => basculerVerrou({ date, creneau })}
                    onChanger={() => changer({ date, creneau })}
                    onChoisir={() => setAChoisir({ date, creneau })}
                    onDehors={() => poserDehors({ date, creneau })}
                    resteDepuis={
                      cuissonDuReste === undefined ? null : formaterJour(cuissonDuReste.slot.date)
                    }
                    onRestes={sourcesReste.length === 0 ? null : () => setPourReste({ date, creneau })}
                    onDefaireReste={
                      gestePrecedent({ date, creneau }) === null
                        ? null
                        : () => defaireReste({ date, creneau })
                    }
                    onDefaire={
                      platDAvant({ date, creneau }) === null
                        ? null
                        : () => defaireDehors({ date, creneau })
                    }
                  />
                )
              })}
            </div>
          </article>
        ))}
      </div>

      {/* ⚠️ MONTÉE AU NIVEAU DE L'ÉCRAN, pas dans la carte du créneau. `Panneau` passe par un portail
          vers `document.body` : la monter dans chaque carte donnerait 21 composants prêts à s'ouvrir
          pour un seul qui s'ouvre jamais à la fois. */}
      {aChoisir !== null && socleCharge !== null && (
        <ChoisirPlat
          socle={socleCharge}
          libelleCreneau={`${formaterJour(aChoisir.date)} · ${LIBELLE_CRENEAU[aChoisir.creneau]}`}
          onPoser={(recipeId) => poser(aChoisir, recipeId)}
          onPoserHorsCatalogue={(libelle) => poserHorsCatalogue(aChoisir, libelle)}
          onFermer={() => setAChoisir(null)}
        />
      )}

      {/* Même raison que ci-dessus : une seule fenêtre montée, jamais une par carte. */}
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
}: {
  readonly reglages: Reglages
  readonly onChange: (suivants: Reglages) => void
  readonly onComposer: () => void
}) {
  return (
    <section>
      <h1 data-visite="titre-semaine" className="text-titre-l text-texte">
        Ma semaine
      </h1>
      <LienTutoriel parcoursId="semaine" />
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

/**
 * Un créneau, dans l'un des QUATRE ÉTATS que §4.2 exige « immédiatement distinguables ».
 *
 * ⚠️ AUCUN ÉTAT N'EST PORTÉ PAR LA SEULE COULEUR. Bordure, épaisseur, trait plein ou pointillé et
 * mention écrite se cumulent : un daltonien, un écran en plein soleil ou un mode sombre mal calibré
 * ne doivent pas faire disparaître l'information. C'est aussi pourquoi la légende affiche une
 * pastille ET son nom.
 *
 * ⚠️ AUCUNE COULEUR DE JUGEMENT (§5 DESIGN, principe 6 ARCHITECTURE) : pas de vert pour « bien »,
 * pas de rouge pour « à changer ». Un plat n'est ni bon ni mauvais — l'accent signale ce que
 * l'utilisateur a décidé, pas ce que l'application en pense.
 */
function Creneau({
  entry,
  nom,
  accompagnement,
  onGarder,
  onChanger,
  onChoisir,
  onDehors,
  onDefaire,
  resteDepuis,
  onRestes,
  onDefaireReste,
}: {
  readonly entry: MealPlanEntry
  readonly nom: string | null
  /** L'accompagnement posé sur le MÊME créneau, ou `null` en mode recette (un plat seul). */
  readonly accompagnement: { readonly recipeId: RecipeId; readonly nom: string } | null
  readonly onGarder: () => void
  /** Tirage : le moteur repropose. */
  readonly onChanger: () => void
  /** Choix : l'utilisateur désigne le plat lui-même (décision 49). */
  readonly onChoisir: () => void
  /** « Je mange dehors » : étiquette le créneau, sans frappe (décision 76). */
  readonly onDehors: () => void
  /** Se raviser. `null` quand plus rien n'est en mémoire — après un rechargement, notamment. */
  readonly onDefaire: (() => void) | null
  /** Le jour où le plat de ce reste a été cuisiné, déjà formaté, ou `null` si on ne le sait pas. */
  readonly resteDepuis: string | null
  /** Ouvrir le choix des restes servables ici. `null` quand aucun plat de la semaine ne l'est. */
  readonly onRestes: (() => void) | null
  /** Défaire le reste posé à la main. `null` quand plus rien n'est en mémoire. */
  readonly onDefaireReste: (() => void) | null
}) {
  // ⚠️ « VIDE » N'EST PLUS « SANS RECETTE » depuis la décision 51. Un plat préparé porte
  // `recipeId: null` ET un libellé : le créneau est REMPLI. S'en tenir à `recipeId === null` lui
  // donnerait le cadre pointillé et le texte « Aucun plat » alors qu'il y a un dîner prévu — et le
  // bouton dirait « Proposer » pour un créneau déjà occupé.
  const horsCatalogue = entry.horsCatalogue
  const vide = entry.recipeId === null && horsCatalogue === null
  const recipeId = entry.recipeId
  const apparence = entry.locked
    ? 'border-2 border-accent bg-accent-doux'
    : vide
      ? 'border border-dashed border-bordure-forte bg-transparent'
      : entry.isLeftover
        ? 'border border-bordure-forte bg-accent-doux'
        : 'border border-bordure-forte bg-surface'

  return (
    <div className={`flex flex-col rounded-[--radius-carte] p-3 ${apparence}`}>
      <p className="text-mention font-semibold uppercase tracking-wide text-attenue">
        {LIBELLE_CRENEAU[entry.slot.creneau]}
      </p>

      <p className="mt-1 font-titre text-lecture leading-snug text-texte">
        {horsCatalogue !== null ? (
          // Pas de lien : il n'y a aucune fiche derrière, et un lien mort se remarque plus tard.
          <span className="text-texte">{horsCatalogue}</span>
        ) : nom === null || recipeId === null ? (
          <span className="text-attenue">Aucun plat</span>
        ) : (
          <a href={hashDeRecette(recipeId, 'semaine')} className="text-texte no-underline">
            {nom}
          </a>
        )}
      </p>

      {/* ⚠️ DIRE POURQUOI L'APPLI SE TAIT SUR CE REPAS, sinon son silence passe pour un oubli.
          C'est la contrepartie visible de la décision 51 : l'alerte de plancher calorique ne se
          déclenche plus sur une journée qui contient ce créneau, et l'utilisateur ne peut pas le
          deviner. Formulé comme un FAIT sur ce que l'application sait, jamais comme un reproche sur
          ce qui est mangé (principe 6 : informer, jamais juger) — ni « non équilibré », ni
          « pensez à », ni code couleur. */}
      {horsCatalogue !== null && (
        <p className="mt-1 text-mention leading-snug text-attenue">
          Repas noté à la main — l’application ne connaît pas ce qu’il apporte.
        </p>
      )}

      {/* ⚠️ « avec » EN TOUTES LETTRES, pas une simple seconde ligne. Deux noms empilés se lisent
          comme deux plats au choix ; le mot dit que c'est UNE assiette. Pas de bouton propre non
          plus : « Changer » rejoue le plat ET son accompagnement (`reroll-slot.ts`), ce qui est le
          comportement attendu — on refuse une assiette, pas une garniture. */}
      {accompagnement !== null && (
        <p className="mt-1 text-courant leading-snug text-texte-doux">
          avec{' '}
          <a href={hashDeRecette(accompagnement.recipeId, 'semaine')} className="text-texte-doux">
            {accompagnement.nom}
          </a>
        </p>
      )}

      {/* Les états se disent AUSSI en toutes lettres — l'emoji seul serait invisible à un lecteur
          d'écran, et le cadenas de la maquette ne suffit pas à expliquer ce qu'il signifie. */}
      {/* ⛔ LES DEUX FAITS, PAS UN CHOIX ENTRE EUX. Cette ligne disait `locked ? 'Gardé' : 'Reste…'` :
          un reste qu'on garde perdait le mot « reste » exactement quand il compte, et la carte ne
          disait plus pourquoi ce repas ne se cuisine pas. ⛔ ET ELLE NE DIT PLUS « la veille » AU
          JUGÉ : le reste d'un plat de dimanche servi mercredi ne vient pas de la veille, et le dire
          fait douter de tout le reste de la carte. */}
      {(entry.locked || entry.isLeftover) && (
        <p className="mt-1 text-mention font-medium text-accent-texte">
          {[
            entry.isLeftover
              ? resteDepuis === null
                ? 'Reste d’un plat déjà cuisiné'
                : `Reste du plat de ${resteDepuis}`
              : null,
            entry.locked ? 'Gardé' : null,
          ]
            .filter((mention) => mention !== null)
            .join(' · ')}
        </p>
      )}

      {/* ⚠️ DEUX BOUTONS PARCE QUE CE SONT DEUX GESTES — décision 49, et c'est la correction d'un
          MENSONGE. Un seul bouton portait les deux : il s'appelait « Choisir » sur un créneau vide
          et appelait `rerollSlot`, donc un TIRAGE. Le libellé promettait un choix et rendait un
          hasard. Même classe de défaut que `note_allergene` ou `Recipe.service` déclaré et jamais
          lu : l'écart entre ce qui est annoncé et ce qui est branché.
          « Proposer » tire, « Choisir » ouvre la fenêtre de sélection. Les mots disent l'acte. */}
      {/* ⛔ L'ANNULATION PASSE EN PREMIER SUR UN CRÉNEAU QU'ON VIENT DE MARQUER, et ce n'est pas
          cosmétique : c'est le geste qu'on cherche quand on regarde cette carte-là. Les trois
          autres boutons continuent de faire ce qu'ils faisaient — « Changer » retire l'étiquette
          en tirant un plat, « Choisir » en désignant le sien. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* ⛔ L'ANNULATION D'ABORD, comme pour « je mange dehors » : c'est le geste qu'on cherche
            quand on regarde cette carte-là. Elle rend le plat ET relâche la cuisson. */}
        {onDefaireReste !== null && entry.isLeftover && (
          <button
            type="button"
            onClick={onDefaireReste}
            className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux"
          >
            Remettre le plat prévu
          </button>
        )}
        {onDefaire !== null && horsCatalogue !== null && (
          <button
            type="button"
            onClick={onDefaire}
            className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux"
          >
            Finalement je mange ici
          </button>
        )}
        <button
          type="button"
          onClick={onChanger}
          disabled={entry.locked}
          className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux disabled:opacity-45"
        >
          {vide ? 'Proposer' : 'Changer'}
        </button>
        <button
          type="button"
          onClick={onChoisir}
          disabled={entry.locked}
          aria-haspopup="dialog"
          className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux disabled:opacity-45"
        >
          Choisir
        </button>
        <button
          type="button"
          onClick={onGarder}
          disabled={vide && !entry.locked}
          aria-pressed={entry.locked}
          className={
            'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-3 text-courant font-semibold disabled:opacity-45 ' +
            (entry.locked
              ? 'border-2 border-accent bg-surface text-accent-texte'
              : 'border border-bordure-forte bg-fond text-texte-doux hover:bg-accent-doux')
          }
        >
          {entry.locked ? 'Relâcher' : 'Garder'}
        </button>
        {/* ⚠️ UN SEUL CLIC, ET LE MOT « DEHORS » EN TOUTES LETTRES. Le geste écrit directement : le
            faire passer par la fenêtre de choix coûterait un clic pour ouvrir et un pour valider,
            et le champ y attend une frappe. Absent d'un créneau déjà marqué — il n'y aurait rien à
            marquer — et d'un créneau gardé, comme les trois autres boutons. */}
        {/* ⚠️ ABSENT QUAND RIEN N'EST SERVABLE, et c'est la moitié du geste. Un bouton toujours là
            qui ouvre une fenêtre vide apprend à ne plus cliquer dessus. Le moteur décide : un plat
            cuisiné plus tôt, encore bon, servi à ce créneau-là, et en quantité suffisante. */}
        {onRestes !== null && (
          <button
            type="button"
            onClick={onRestes}
            aria-haspopup="dialog"
            className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux"
          >
            Manger un reste
          </button>
        )}
        {horsCatalogue === null && (
          <button
            type="button"
            onClick={onDehors}
            disabled={entry.locked}
            className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-courant font-semibold text-texte-doux hover:bg-accent-doux disabled:opacity-45"
          >
            Je mange dehors
          </button>
        )}
      </div>
    </div>
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
