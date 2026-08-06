// ui/screens/cuisine.tsx — le mode cuisine, une recette à la fois (§5bis ARCHITECTURE, lot L1).
//
// Sept points tiennent cet écran. Trois méritent d'être relus avant d'y toucher :
//
// ⚠️ RIEN N'AVANCE TOUT SEUL (point 2). C'est la demande d'origine — « que la recette se lance toute
// seule » — et c'est ce qui a été refusé après lecture des essais publiés : l'avancement automatique
// fait perdre la vue d'ensemble et reprend la main au mauvais moment. L'étape ne change QUE sur un
// appui. Un test le verrouille en avançant les minuteurs de plusieurs minutes.
//
// ⚠️ LES MINUTEURS SONT DES ÉCHÉANCES ABSOLUES, JAMAIS DES RESTANTS (point 7). Toute la logique
// d'affirmation vit dans `cuisine-session.ts`, pur et testé sans navigateur — c'est le seul endroit
// du mode où une erreur porterait sur de la nourriture.
//
// ⚠️ L'ALARME NE SONNE QU'AU PREMIER PLAN (point 5), par décision instruite et non par oubli : les
// quatre voies Android ont été refusées (`CONCEPTION_MODE_CUISINE.md` §5). Ce qui les remplace, c'est
// que l'écran ne ment pas au retour.
//
// PÉRIMÈTRE — ce qui n'est PAS ici et où c'est écrit : la quantité au tap sur un ingrédient (lot L3,
// il manque le lien étape → ingrédient), la synchronisation multi-recettes (L4/v1.5), les gestes du
// lexique dépliés (ils vivent sur la fiche recette ; les dupliquer ici demanderait d'extraire le
// composant, ce qui n'est pas dans les sept points).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Catalog, Recipe, RecipeId, RecipeStep } from '../../engine/domain/index.js'
import type { UserDb } from '../../data/user-db.js'
import {
  clearCuisineSession,
  readCuisineSession,
  writeCuisineSession,
  type StoredCuisineSession,
  type StoredCuisineTimer,
} from '../../data/user-store.js'
import { chargerSocle } from '../socle.js'
import { hashDeRecette } from '../router.js'
import { creerAlarme, type Alarme } from '../alarme.js'
import { garderEcranAllume, veillePossible } from '../ecran-allume.js'
import { etatMinuteur, formaterDuree, libelleMinuteur } from '../cuisine-session.js'
import { ListeIngredients, SelecteurPortions } from '../ingredients-recette.js'
import { Panneau } from '../panneau.js'

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'introuvable' }
  | {
      readonly phase: 'pret'
      readonly recette: Recipe
      readonly db: UserDb
      readonly catalogue: Catalog
      /** Grammes mis à l'échelle, par `foodId`. Fermeture sur `scaleRecipe` — voir §4.6 et
       *  `ui/quantites.ts` : c'est le moteur qui calcule, jamais cet écran. */
      readonly quantitePour: (portions: number) => ReadonlyMap<string, number>
    }

/** Les étapes qu'on FAIT. Les avertissements se lisent à la fin, ils ne comptent pas (L0). */
function gestesDe(recette: Recipe): readonly RecipeStep[] {
  return recette.etapes.filter((e) => e.nature === 'geste')
}

export function Cuisine({
  recetteId,
  portionsDemandees,
}: {
  readonly recetteId: string
  /** Portions portées par le lien (`?portions=`), ou `null` = aucun choix exprimé. Voir
   *  `router.tsx#portionsDepuisRequete` : `null` n'est PAS une valeur par défaut déguisée. */
  readonly portionsDemandees: number | null
}) {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [session, setSession] = useState<StoredCuisineSession | null>(null)
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [ecranTenu, setEcranTenu] = useState(false)
  const [alarmeSur, setAlarmeSur] = useState<number | null>(null)
  const [ingredientsOuverts, setIngredientsOuverts] = useState(false)

  // L'alarme survit aux rendus : la recréer relâcherait le contexte audio déverrouillé sur le geste.
  const alarme = useRef<Alarme | null>(null)
  alarme.current ??= creerAlarme()

  /**
   * Les minuteurs déjà échus au MOMENT DE L'OUVERTURE ne sonnent pas.
   *
   * ⚠️ SANS CE GARDE-FOU, reprendre une cuisson déclencherait l'alarme pour un plat sorti du feu
   * depuis quarante minutes — le mensonge exact que le point 7 existe pour empêcher, retourné en
   * son contraire sonore.
   */
  const dejaSonnes = useRef<Set<number>>(new Set())

  useEffect(() => {
    let vivant = true
    chargerSocle()
      .then((socle) => {
        if (!vivant) return
        const recette = socle.catalogue.recipes.get(recetteId as RecipeId)
        if (recette === undefined) {
          setEtat({ phase: 'introuvable' })
          return
        }
        const gestes = gestesDe(recette)
        const existante = readCuisineSession(socle.db)
        // ⚠️ UNE SEULE CUISSON À LA FOIS (v1 mono-recette, `user_cuisine_session.id = 1`). Ouvrir le
        // mode sur une AUTRE recette remplace la précédente. La v1.5 fera sauter la contrainte.
        const reprise = existante !== null && existante.recetteId === recetteId
        // ⚠️ LE LIEN GAGNE SUR LA SESSION, MAIS SEULEMENT S'IL PORTE UNE VALEUR. La fiche recette
        // n'en met une qu'au moment où l'on appuie sur « Cuisiner pas à pas » — c'est un choix qu'on
        // vient de faire, il doit primer. Le bandeau de reprise, lui, produit un hash NU : la session
        // garde alors son nombre, sinon reprendre une cuisson la ramènerait aux portions de base et
        // effacerait en silence un réglage fait la veille.
        const courante: StoredCuisineSession = reprise
          ? { ...existante, portions: portionsDemandees ?? existante.portions }
          : {
              recetteId,
              ordreCourant: gestes[0]?.ordre ?? 1,
              ouverteLe: Date.now(),
              portions: portionsDemandees,
              minuteurs: [],
            }
        if (reprise) {
          for (const t of courante.minuteurs) {
            if (etatMinuteur(t, Date.now()).mode === 'termine') dejaSonnes.current.add(t.ordre)
          }
        }
        // Une session neuve s'écrit toujours ; une reprise SEULEMENT si le lien a changé les
        // portions. Réécrire à chaque ouverture ferait repasser les minuteurs par un DELETE/INSERT
        // sans aucune raison.
        if (!reprise || courante.portions !== existante?.portions) {
          writeCuisineSession(socle.db, courante)
        }
        setSession(courante)
        setEtat({
          phase: 'pret',
          recette,
          db: socle.db,
          catalogue: socle.catalogue,
          // ⚠️ ON LIT `quantiteG`, PAS `uniteAffichage` : `scaleRecipe` recalcule les grammes et
          // laisse le libellé verbatim, à dessein. Même fermeture que sur la fiche recette, et le
          // rendu est le même composant — voir `ui/ingredients-recette.tsx`.
          quantitePour: (n) =>
            new Map(
              socle.moteur
                .scaleRecipe(recetteId as RecipeId, n)
                .ingredients.map((i) => [i.foodId as string, i.quantiteG])
            ),
        })
      })
      .catch(() => {
        if (vivant) setEtat({ phase: 'introuvable' })
      })
    return () => {
      vivant = false
    }
  }, [recetteId, portionsDemandees])

  // Le battement de seconde ne fait QUE rafraîchir l'affichage des décomptes. Il ne touche jamais à
  // l'étape courante — c'est ce que vérifie le test « les étapes n'avancent jamais seules ».
  useEffect(() => {
    const battement = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(battement)
  }, [])

  useEffect(() => (etat.phase === 'pret' ? garderEcranAllume(setEcranTenu) : undefined), [etat.phase])

  // Relâche l'alarme si l'écran est démonté en pleine sonnerie.
  useEffect(() => () => alarme.current?.arreter(), [])

  const enregistrer = useCallback(
    (suivante: StoredCuisineSession) => {
      setSession(suivante)
      if (etat.phase === 'pret') writeCuisineSession(etat.db, suivante)
    },
    [etat]
  )

  const majMinuteurs = useCallback(
    (transformer: (minuteurs: readonly StoredCuisineTimer[]) => readonly StoredCuisineTimer[]) => {
      if (session === null) return
      enregistrer({ ...session, minuteurs: transformer(session.minuteurs) })
    },
    [enregistrer, session]
  )

  // Sonner à l'échéance, une fois par minuteur. Se déclenche sur le battement de seconde.
  useEffect(() => {
    if (session === null || alarme.current === null) return
    for (const t of session.minuteurs) {
      if (dejaSonnes.current.has(t.ordre)) continue
      if (etatMinuteur(t, maintenant).mode !== 'termine') continue
      dejaSonnes.current.add(t.ordre)
      // ⚠️ LA FENÊTRE DES INGRÉDIENTS SE FERME À LA SONNERIE. `Panneau` passe par un portail posé
      // après cet écran : ouverte, elle recouvrirait la surface « appuyez n'importe où » et l'arrêt
      // de l'alarme deviendrait introuvable. Une casserole qui sonne prime sur une liste qu'on lit.
      setIngredientsOuverts(false)
      setAlarmeSur(t.ordre)
      alarme.current.sonner(() => setAlarmeSur(null))
    }
  }, [maintenant, session])

  if (etat.phase === 'chargement') return <p className="p-6 text-texte-doux">Chargement…</p>
  if (etat.phase === 'introuvable') {
    return (
      <div className="p-6">
        <p className="text-texte">Cette recette est introuvable.</p>
        <a className="mt-4 inline-block text-accent-texte underline" href={hashDeRecette(recetteId)}>
          ← Retour à la fiche
        </a>
      </div>
    )
  }

  const { recette, catalogue, quantitePour } = etat
  const gestes = gestesDe(recette)
  const avertissements = recette.etapes.filter((e) => e.nature === 'avertissement')

  // `null` en session = AUCUN CHOIX EXPRIMÉ (schéma v11), pas « 4 » : on retombe alors sur les
  // portions de la recette. C'est ici, et seulement ici, que la recette a le dernier mot — ni le
  // routeur ni le store ne connaissent `portionsBase`.
  const portions = session?.portions ?? recette.portionsBase
  const facteur = portions / (recette.portionsBase > 0 ? recette.portionsBase : 1)

  const changerPortions = (n: number): void => {
    if (session === null) return
    enregistrer({ ...session, portions: n })
  }
  const rang = Math.max(
    0,
    gestes.findIndex((e) => e.ordre === (session?.ordreCourant ?? gestes[0]?.ordre))
  )
  const etape = gestes[rang]
  const derniere = rang >= gestes.length - 1

  const allerA = (nouveauRang: number): void => {
    const cible = gestes[nouveauRang]
    if (cible === undefined || session === null) return
    enregistrer({ ...session, ordreCourant: cible.ordre })
  }

  const minuteurDe = (ordre: number): StoredCuisineTimer | undefined =>
    session?.minuteurs.find((t) => t.ordre === ordre)

  const lancer = (ordre: number, dureeS: number): void => {
    // ⚠️ ICI, ET PAS À L'EXPIRATION. Le déverrouillage audio n'est accordé qu'au sein d'un
    // gestionnaire d'appui réel — et son refus ne lève aucune erreur.
    alarme.current?.preparer()
    dejaSonnes.current.delete(ordre)
    majMinuteurs((ts) => [
      ...ts.filter((t) => t.ordre !== ordre),
      { ordre, finMs: Date.now() + dureeS * 1000, pauseRestantS: null },
    ])
  }

  const basculerPause = (ordre: number): void => {
    const t = minuteurDe(ordre)
    if (t === undefined) return
    const etatT = etatMinuteur(t, Date.now())
    const remplacant: StoredCuisineTimer =
      t.pauseRestantS !== null
        ? { ordre, finMs: Date.now() + t.pauseRestantS * 1000, pauseRestantS: null }
        : { ordre, finMs: null, pauseRestantS: etatT.mode === 'marche' ? etatT.restantS : 0 }
    majMinuteurs((ts) => ts.map((autre) => (autre.ordre === ordre ? remplacant : autre)))
  }

  const arreterMinuteur = (ordre: number): void => {
    dejaSonnes.current.add(ordre)
    majMinuteurs((ts) => ts.filter((t) => t.ordre !== ordre))
  }

  const terminer = (): void => {
    alarme.current?.arreter()
    clearCuisineSession(etat.db)
    window.location.hash = hashDeRecette(recetteId)
  }

  const stopperAlarme = (): void => {
    alarme.current?.arreter()
    setAlarmeSur(null)
  }

  return (
    <article
      className="mx-auto max-w-2xl p-4 pb-24"
      // Le signal visuel porte sur TOUTE la surface : la vision périphérique voit le mouvement et la
      // luminance, pas un pictogramme. Voir `theme.css`, bloc « signal visuel d'alarme ».
      data-alarme={alarmeSur !== null ? 'oui' : undefined}
    >
      <a className="text-accent-texte underline" href={hashDeRecette(recetteId)}>
        ← Quitter le mode cuisine
      </a>

      <h1 className="mt-3 font-titre text-[1.6rem] leading-tight text-texte">{recette.nom}</h1>

      <p className="mt-1 text-[0.95rem] text-attenue">
        {ecranTenu
          ? "L'écran reste allumé pendant la cuisson."
          : veillePossible()
            ? "L'écran peut s'éteindre : cet appareil n'a pas accordé le maintien."
            : "L'écran peut s'éteindre : cet appareil ne sait pas le maintenir allumé."}
      </p>

      {/* ⚠️ LES INGRÉDIENTS SONT ICI, ET C'EST TOUT L'OBJET DE CE LOT. Sans eux, « c'était combien
          d'ail ? » en pleine cuisson obligeait à QUITTER le mode cuisine pour rouvrir la fiche, en
          perdant l'étape courante de vue. La donnée était pourtant déjà chargée dans cet écran.

          Une FENÊTRE et pas un dépliant : elle recouvre, on revient, l'écran n'a pas bougé — un
          dépliant aurait poussé l'étape et les minuteurs vers le bas (`ui/panneau.tsx`).

          ⚠️ `aria-haspopup="dialog"`, JAMAIS `aria-expanded` : ce bouton n'agrandit rien en place. */}
      <button
        type="button"
        onClick={() => setIngredientsOuverts(true)}
        aria-haspopup="dialog"
        className="mt-4 flex min-h-tactile w-full items-center justify-between gap-3 rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-left text-[1.05rem] font-semibold text-accent-texte"
      >
        <span>Voir les ingrédients</span>
        {/* La valeur courante sur la ligne, comme `LigneOuvrante` : sans elle, connaître le nombre de
            portions demanderait d'ouvrir la fenêtre rien que pour le lire. */}
        <span className="text-[0.95rem] font-normal text-attenue">
          pour {portions} portion{portions > 1 ? 's' : ''}
        </span>
      </button>

      {ingredientsOuverts && (
        <Panneau titre={`Ingrédients — ${recette.nom}`} onFermer={() => setIngredientsOuverts(false)}>
          <SelecteurPortions
            portions={portions}
            base={recette.portionsBase}
            onChange={changerPortions}
          />
          {/* ⚠️ `manquants` À `null`, DÉLIBÉRÉMENT. On ne dit pas « à acheter » à quelqu'un qui a
              déjà la poêle sur le feu : la mention appartient à la fiche, où l'on décide de
              cuisiner, pas au fourneau où il est trop tard pour en tenir compte. */}
          <ListeIngredients
            ingredients={recette.ingredients}
            quantites={quantitePour(portions)}
            facteur={facteur}
            nomAliment={(foodId) => catalogue.foods.get(foodId as never)?.nom ?? foodId}
            estFondDePlacard={(foodId) => catalogue.foods.get(foodId as never)?.fondDePlacard === true}
            manquants={null}
          />
        </Panneau>
      )}

      {etape !== undefined && (
        <section className="mt-6 rounded-[--radius-carte] border border-bordure bg-surface p-5">
          <p className="text-[0.95rem] font-semibold uppercase tracking-wide text-attenue">
            Étape {rang + 1} sur {gestes.length}
          </p>
          <p className="mt-3 text-[1.35rem] leading-relaxed text-texte">{etape.texte}</p>

          {etape.timerS !== null && (
            <CarteMinuteur
              dureeS={etape.timerS}
              minuteur={minuteurDe(etape.ordre)}
              maintenant={maintenant}
              surLancer={() => lancer(etape.ordre, etape.timerS ?? 0)}
              surPause={() => basculerPause(etape.ordre)}
              surArret={() => arreterMinuteur(etape.ordre)}
            />
          )}
        </section>
      )}

      {/* ⚠️ LES MINUTEURS DES AUTRES ÉTAPES RESTENT VISIBLES. Une cuisson réelle en fait tourner
          plusieurs à la fois, et un décompte qui disparaît quand on tourne la page est un décompte
          qu'on oublie. Chacun porte le numéro de son étape, sinon on ne sait plus ce qu'il compte. */}
      {session !== null && session.minuteurs.filter((t) => t.ordre !== etape?.ordre).length > 0 && (
        <section className="mt-4">
          <h2 className="text-[1rem] font-semibold text-texte-doux">Minuteurs en cours</h2>
          <ul className="mt-2 space-y-2">
            {session.minuteurs
              .filter((t) => t.ordre !== etape?.ordre)
              .map((t) => {
                const rangT = gestes.findIndex((e) => e.ordre === t.ordre)
                return (
                  <li
                    key={t.ordre}
                    className="flex items-center justify-between rounded-[--radius-carte] border border-bordure bg-surface px-4 py-2"
                  >
                    <span className="text-[1.02rem] text-texte">
                      Étape {rangT + 1} — {libelleMinuteur(etatMinuteur(t, maintenant))}
                    </span>
                    <button
                      type="button"
                      onClick={() => arreterMinuteur(t.ordre)}
                      className="min-h-tactile px-3 text-[0.95rem] font-semibold text-accent-texte underline"
                    >
                      Arrêter
                    </button>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      {derniere &&
        avertissements.map((a) => (
          <p
            key={a.ordre}
            className="mt-4 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[1.02rem] leading-relaxed text-alerte-texte"
          >
            {a.texte}
          </p>
        ))}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => allerA(rang - 1)}
          disabled={rang === 0}
          className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-4 text-[1.05rem] font-semibold text-accent-texte disabled:opacity-40"
        >
          ← Étape précédente
        </button>
        {derniere ? (
          <button
            type="button"
            onClick={terminer}
            className="min-h-tactile flex-1 rounded-[--radius-carte] bg-accent-plein px-4 text-[1.05rem] font-semibold text-white"
          >
            Terminer la cuisson
          </button>
        ) : (
          <button
            type="button"
            onClick={() => allerA(rang + 1)}
            className="min-h-tactile flex-1 rounded-[--radius-carte] bg-accent-plein px-4 text-[1.05rem] font-semibold text-white"
          >
            Étape suivante →
          </button>
        )}
      </div>

      {/* ⚠️ ARRÊT PAR APPUI N'IMPORTE OÙ, validé à l'essai. Un bouton précis à viser demande de
          regarder l'écran — c'est-à-dire exactement ce qu'on ne fait pas les mains occupées. */}
      {alarmeSur !== null && (
        <button
          type="button"
          onClick={stopperAlarme}
          aria-label="Arrêter l’alarme"
          className="fixed inset-0 z-50 flex items-end justify-center bg-transparent p-10 text-[1.1rem] font-semibold text-texte"
        >
          <span className="rounded-[--radius-carte] border border-bordure-forte bg-surface px-5 py-3">
            Minuteur terminé — appuyez n’importe où
          </span>
        </button>
      )}

      <p aria-live="polite" className="sr-only">
        {alarmeSur !== null ? 'Minuteur terminé.' : ''}
      </p>
    </article>
  )
}

/**
 * Le minuteur de l'étape affichée. Trois régimes, jamais deux à la fois : pas lancé, en marche ou en
 * pause, terminé.
 */
function CarteMinuteur({
  dureeS,
  minuteur,
  maintenant,
  surLancer,
  surPause,
  surArret,
}: {
  readonly dureeS: number
  readonly minuteur: StoredCuisineTimer | undefined
  readonly maintenant: number
  readonly surLancer: () => void
  readonly surPause: () => void
  readonly surArret: () => void
}) {
  if (minuteur === undefined) {
    return (
      <button
        type="button"
        onClick={surLancer}
        className="mt-5 min-h-tactile w-full rounded-[--radius-carte] border border-accent bg-accent-doux px-4 text-[1.1rem] font-semibold text-accent-texte"
      >
        Lancer le minuteur ({formaterDuree(dureeS)})
      </button>
    )
  }

  const etat = etatMinuteur(minuteur, maintenant)
  return (
    <div className="mt-5 rounded-[--radius-carte] border border-accent bg-accent-doux p-4">
      <p className="text-center text-[2.2rem] font-semibold tabular-nums text-accent-texte">
        {etat.mode === 'termine' ? formaterDuree(etat.depuisS) : formaterDuree(etat.restantS)}
      </p>
      <p className="text-center text-[0.95rem] text-accent-texte">{libelleMinuteur(etat)}</p>
      <div className="mt-3 flex gap-3">
        {etat.mode !== 'termine' && (
          <button
            type="button"
            onClick={surPause}
            className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-3 text-[1rem] font-semibold text-accent-texte"
          >
            {etat.mode === 'pause' ? 'Reprendre' : 'Mettre en pause'}
          </button>
        )}
        <button
          type="button"
          onClick={surArret}
          className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-3 text-[1rem] font-semibold text-accent-texte"
        >
          {etat.mode === 'termine' ? 'Effacer' : 'Arrêter'}
        </button>
      </div>
    </div>
  )
}
