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
  profilCourant,
  type Socle,
} from '../socle.js'
import { hashDeRecette } from '../router.js'

/**
 * « Nombre de repas/jour réglable (1-3) » (§4.2). Le mapping est ici et nulle part ailleurs : quels
 * créneaux se cachent derrière « 2 repas » est une décision produit, pas un détail de rendu.
 */
const CRENEAUX_PAR_NOMBRE: Readonly<Record<number, readonly MealSlot[]>> = {
  1: ['diner'],
  2: ['dejeuner', 'diner'],
  3: ['petit_dejeuner', 'dejeuner', 'diner'],
}

const JOURS_PAR_DEFAUT = 7
const REPAS_PAR_DEFAUT = 2

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
    slots: CRENEAUX_PAR_NOMBRE[reglages.repasParJour] ?? CRENEAUX_PAR_NOMBRE[REPAS_PAR_DEFAUT]!,
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
  savePlan(socle.db, plan)
  return { plan, profil, nomDe: (id) => socle.catalogue.recipes.get(id)?.nom ?? id }
}

/** Reprend le dernier plan enregistré, ou en construit un. */
function reprendreOuPlanifier(socle: Socle, reglages: Reglages): { readonly vue: Vue; readonly reglages: Reglages } {
  const date = aujourdhuiIso()
  const profil = profilCourant(socle.db, date)
  const enregistre = readLatestPlan(socle.db)
  // Le rythme déclaré au premier lancement fixe le défaut ; un plan déjà enregistré prime, parce
  // que l'utilisateur a pu le changer depuis l'écran.
  const rythme = readRythme(socle.db)
  const defauts: Reglages =
    rythme === null ? reglages : { ...reglages, repasParJour: rythme.repasParJour }

  if (enregistre !== null) {
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
  return { vue: planifier(socle, defauts, []), reglages: defauts }
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

  const echouer = useCallback((erreur: unknown) => {
    setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
  }, [])

  // Premier montage : on reprend le plan enregistré s'il existe, et les réglages qui vont avec.
  useEffect(() => {
    if (!premierRendu) return
    let annule = false
    chargerSocle()
      .then((socle) => {
        if (annule) return
        const repris = reprendreOuPlanifier(socle, reglages)
        setReglages(repris.reglages)
        setEtat({ phase: 'pret', vue: repris.vue })
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
          savePlan(socle.db, suivant)
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
          savePlan(socle.db, suivant)
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

  const { plan, nomDe } = etat.vue
  const creneaux = creneauxDuPlan(plan)
  const dates = [...new Set(plan.entries.map((e) => e.slot.date))]

  return (
    <section>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[2.1rem] text-texte">Ma semaine</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-attenue">
            {formaterPlage(dates)} · {plan.entries.filter((e) => e.recipeId !== null).length} repas prévus
          </p>
        </div>
        {/* Action dominante de l'écran (§4.2) : hauteur de CTA, accent plein, blanc dessus. */}
        <button
          type="button"
          onClick={() => replanifier({ ...reglages, graine: reglages.graine + 1 })}
          className="flex min-h-cta items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white"
        >
          Proposer une autre semaine
        </button>
      </header>
      <p className="mt-2 text-[0.9rem] text-attenue">Vos repas gardés ne changeront pas.</p>

      <Reglage
        reglages={reglages}
        onChange={(suivants) => replanifier(suivants)}
      />

      {/* §6.5 ARCHITECTURE — l'avertissement PRÉVIENT, il n'interdit pas : le plan reste utilisable.
          Formulation factuelle, sans jugement ni injonction (§6.2). */}
      {plan.warnings.length > 0 && (
        <div
          role="status"
          className="mt-5 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[0.95rem] leading-relaxed text-alerte-texte"
        >
          <p className="font-semibold">
            {plan.warnings.length === 1 ? 'Une journée apporte' : `${plan.warnings.length} journées apportent`} moins
            d'énergie que la référence habituelle.
          </p>
          <ul className="mt-2 list-inside list-disc">
            {plan.warnings.map((w) => (
              <li key={w.date}>
                {formaterJour(w.date)} — {Math.round(w.kcal)} kcal pour une référence de {w.seuil} kcal
              </li>
            ))}
          </ul>
        </div>
      )}

      <Legende />

      <div className="mt-4 space-y-4">
        {dates.map((date) => (
          <article key={date} className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
            <h2 className="font-titre text-[1.25rem] text-texte">{formaterJour(date)}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {creneaux.map((creneau) => {
                const entry = plan.entries.find((e) => memeCreneau(e, { date, creneau }))
                return entry === undefined ? null : (
                  <Creneau
                    key={creneau}
                    entry={entry}
                    nom={entry.recipeId === null ? null : nomDe(entry.recipeId)}
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
  onGarder,
  onChanger,
}: {
  readonly entry: MealPlanEntry
  readonly nom: string | null
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
          <a href={hashDeRecette(recipeId)} className="text-texte no-underline">
            {nom}
          </a>
        )}
      </p>

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
