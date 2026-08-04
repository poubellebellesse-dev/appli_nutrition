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
import { MAX_PLAN_DAYS, MIN_PLAN_DAYS } from '../../engine/planning/plan-week.js'
import { readLatestPlan, readRythme, readUserState, savePlan } from '../../data/user-store.js'
import {
  FENETRE_HISTORIQUE_JOURS,
  LIBELLE_CRENEAU,
  aujourdhuiIso,
  chargerSocle,
  cleCreneau,
  maintenantIso,
  profilCourant,
  type Socle,
} from '../socle.js'
import { hashDeRecette, hashDuFrigo } from '../router.js'
import { Panneau } from '../panneau.js'
import { REPAS_PAR_DEFAUT, creneauxDuRythme } from '../creneau.js'
import { readDisplay, readMealTimes } from '../../data/user-store.js'
import { rappelsDuPlan } from '../rappel.js'
import { reprogrammer, toutAnnuler } from '../notifications.js'
import { LienTutoriel } from '../lien-tutoriel.js'

// Le mapping « nombre de repas → créneaux » a été remonté dans `ui/creneau.ts` quand l'écran
// Aujourd'hui en a eu besoin à son tour : deux copies auraient donné une semaine et un écran du jour
// qui ne parlent pas des mêmes repas.

const JOURS_PAR_DEFAUT = 7

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

/** Créneaux effectivement servis — un créneau compte pour UN repas, plat et accompagnement compris. */
function repasServis(plan: WeekPlan): number {
  const servis = new Set<string>()
  for (const e of plan.entries) {
    if (e.recipeId !== null) servis.add(`${e.slot.date}|${e.slot.creneau}`)
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
  const etat = readUserState(socle.db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: date })

  const brut = socle.moteur.planWeek({
    profile: profil,
    constraints: etat.constraints,
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
 * Repose les rappels de préparation sur l'appareil après un changement de plan.
 *
 * ⚠️ APPELÉ À CHAQUE ÉCRITURE DE PLAN, et sans être attendu. Les rappels sont un CONFORT : si la
 * plateforme refuse, si la permission a été révoquée, ou s'il n'y a pas de conteneur natif, la
 * semaine s'affiche exactement pareil. Attendre la programmation ferait dépendre l'affichage d'un
 * service optionnel.
 *
 * ⚠️ IL FAUT REPROGRAMMER À CHAQUE FOIS. « Proposer une autre semaine » réécrit tout le plan ;
 * laisser les anciens rappels ferait sonner l'appareil pour des plats qui n'y sont plus.
 */
function reprogrammerLesRappels(socle: Socle, plan: WeekPlan): void {
  if (!readDisplay(socle.db).rappelsActifs) {
    void toutAnnuler()
    return
  }
  const rappels = rappelsDuPlan(
    plan,
    socle.catalogue.recipes,
    readMealTimes(socle.db),
    Date.now()
  )
  void reprogrammer(rappels)
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
          const etatUtilisateur = readUserState(socle.db, {
            windowDays: FENETRE_HISTORIQUE_JOURS,
            today: aujourdhuiIso(),
          })
          const suivant = socle.moteur.rerollSlot(
            plan,
            slot,
            {
              profile: profil,
              constraints: etatUtilisateur.constraints,
              history: etatUtilisateur.history,
              activeTopics: etatUtilisateur.activeTopics,
              seed: plan.seed,
            },
            { excludeRecipeIds: dejaRefuses }
          )
          savePlan(socle.db, suivant, maintenantIso())
          setRefus(new Map(refus).set(cle, dejaRefuses))
          setEtat({ phase: 'pret', vue: { ...etat.vue, plan: suivant } })
        })
        .catch(echouer)
    },
    [etat, refus, echouer]
  )

  if (etat.phase === 'chargement') return <p className="text-attenue">Construction de la semaine…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">La semaine n'a pas pu être construite.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
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
      <h1 data-visite="titre-semaine" className="text-[2.1rem] text-texte">
        Ma semaine
      </h1>
      <LienTutoriel parcoursId="semaine" />
      <p className="mt-2 text-[0.95rem] leading-relaxed text-attenue">
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
        className="mt-4 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white"
      >
        Proposer une autre semaine
      </button>
      <p className="mt-2 text-[0.9rem] text-attenue">Vos repas gardés ne changeront pas.</p>

      {modeAvance && <AlerteEnergie warnings={plan.warnings} />}

      <Legende />

      <div className="mt-4 space-y-4">
        {dates.map((date) => (
          <article key={date} className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
            <h2 className="font-titre text-[1.25rem] text-texte">{formaterJour(date)}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {creneaux.map((creneau) => {
                // ⚠️ DEUX ENTRÉES POSSIBLES PAR CRÉNEAU depuis le mode repas — `find` seul rendait
                // le plat et faisait DISPARAÎTRE l'accompagnement de l'écran alors qu'il est bien
                // au plan, compté dans l'énergie du jour et acheté dans les courses. Le défaut
                // n'aurait rien cassé : il aurait juste menti.
                const duCreneau = plan.entries.filter((e) => memeCreneau(e, { date, creneau }))
                const entry = duCreneau.find((e) => e.service !== 'accompagnement')
                const accompagnement = duCreneau.find((e) => e.service === 'accompagnement')
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
                  />
                )
              })}
            </div>
          </article>
        ))}
      </div>
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
      <h1 data-visite="titre-semaine" className="text-[2.1rem] text-texte">
        Ma semaine
      </h1>
      <LienTutoriel parcoursId="semaine" />
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        Rien de prévu pour l'instant. Composez une semaine quand vous voulez — vous pourrez changer
        chaque repas ensuite.
      </p>

      {/* Réglage local : on n'écrit RIEN en base tant que la semaine n'est pas composée. */}
      <Reglage reglages={reglages} onChange={onChange} />

      <button
        type="button"
        data-visite="composer-semaine"
        onClick={onComposer}
        className="mt-4 flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white"
      >
        Composer ma semaine
      </button>

      <a
        href={hashDuFrigo()}
        className="mt-3 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-[0.95rem] font-semibold text-accent-texte no-underline"
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
      className="mt-5 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond text-[0.95rem] leading-relaxed text-alerte-texte"
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
        <span aria-hidden="true" className="shrink-0 text-[0.85rem] font-semibold">
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
    <div className="mt-5 flex flex-wrap gap-4 rounded-[--radius-carte] border border-bordure bg-surface p-4 text-[0.95rem]">
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
    <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.85rem] text-attenue">
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
}: {
  readonly entry: MealPlanEntry
  readonly nom: string | null
  /** L'accompagnement posé sur le MÊME créneau, ou `null` en mode recette (un plat seul). */
  readonly accompagnement: { readonly recipeId: RecipeId; readonly nom: string } | null
  readonly onGarder: () => void
  readonly onChanger: () => void
}) {
  const vide = entry.recipeId === null
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
      <p className="text-[0.8rem] font-semibold uppercase tracking-wide text-attenue">
        {LIBELLE_CRENEAU[entry.slot.creneau]}
      </p>

      <p className="mt-1 font-titre text-[1.1rem] leading-snug text-texte">
        {nom === null || recipeId === null ? (
          <span className="text-attenue">Aucun plat</span>
        ) : (
          <a href={hashDeRecette(recipeId, 'semaine')} className="text-texte no-underline">
            {nom}
          </a>
        )}
      </p>

      {/* ⚠️ « avec » EN TOUTES LETTRES, pas une simple seconde ligne. Deux noms empilés se lisent
          comme deux plats au choix ; le mot dit que c'est UNE assiette. Pas de bouton propre non
          plus : « Changer » rejoue le plat ET son accompagnement (`reroll-slot.ts`), ce qui est le
          comportement attendu — on refuse une assiette, pas une garniture. */}
      {accompagnement !== null && (
        <p className="mt-1 text-[0.95rem] leading-snug text-texte-doux">
          avec{' '}
          <a href={hashDeRecette(accompagnement.recipeId, 'semaine')} className="text-texte-doux">
            {accompagnement.nom}
          </a>
        </p>
      )}

      {/* Les états se disent AUSSI en toutes lettres — l'emoji seul serait invisible à un lecteur
          d'écran, et le cadenas de la maquette ne suffit pas à expliquer ce qu'il signifie. */}
      {(entry.locked || entry.isLeftover) && (
        <p className="mt-1 text-[0.85rem] font-medium text-accent-texte">
          {entry.locked ? 'Gardé' : 'Reste du plat de la veille'}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onChanger}
          disabled={entry.locked}
          className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-[0.9rem] font-semibold text-texte-doux hover:bg-accent-doux disabled:opacity-45"
        >
          {vide ? 'Choisir' : 'Changer'}
        </button>
        <button
          type="button"
          onClick={onGarder}
          disabled={vide && !entry.locked}
          aria-pressed={entry.locked}
          className={
            'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-3 text-[0.9rem] font-semibold disabled:opacity-45 ' +
            (entry.locked
              ? 'border-2 border-accent bg-surface text-accent-texte'
              : 'border border-bordure-forte bg-fond text-texte-doux hover:bg-accent-doux')
          }
        >
          {entry.locked ? 'Relâcher' : 'Garder'}
        </button>
      </div>
    </div>
  )
}

/** « lun. 3 août ». Le fuseau est forcé en UTC : les dates du plan sont des jours, pas des instants. */
function formaterJour(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function formaterPlage(dates: readonly string[]): string {
  const premier = dates[0]
  const dernier = dates[dates.length - 1]
  if (premier === undefined || dernier === undefined) return ''
  return premier === dernier ? formaterJour(premier) : `${formaterJour(premier)} → ${formaterJour(dernier)}`
}
