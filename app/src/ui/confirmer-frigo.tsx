// ui/confirmer-frigo.tsx — « vous aviez déclaré ça il y a trois semaines. Vous l'avez toujours ? »
//
// ⚠️ POURQUOI CE COMPOSANT EXISTE, et il vient d'une mesure faite ailleurs. Le grief n°1 des
// utilisateurs d'applications à garde-manger, tous produits confondus, n'est pas la qualité des
// recettes : c'est que l'inventaire DÉRIVE (`reference/CONCURRENCE_ET_ATTENTES.md`). On le remplit
// avec entrain une semaine, puis une fois, puis plus jamais — et **un inventaire à moitié à jour est
// pire que pas d'inventaire, parce qu'on cesse d'y croire**.
//
// Deux écrans de ce produit AFFIRMENT des choses à partir de `user_pantry`, et se trompent en
// silence quand il a vieilli :
//   - Courses RETIRE de la liste ce qu'on est censé avoir. Un garde-manger périmé fait rentrer sans
//     crème. C'est le cas le plus coûteux : on ne s'en aperçoit qu'au moment de cuisiner.
//   - « Choisir un plat » propose des recettes réalisables avec. Là au moins l'erreur se voit tout
//     de suite, devant le frigo ouvert.
//
// ⚠️ LES DEUX APPELANTS NE S'EN SERVENT PAS PAREIL, ET IL NE FAUT PAS UNIFORMISER. `choisir-plat.tsx`
// RETIENT ses résultats tant qu'on n'a pas répondu — un garde-manger périmé y rend la proposition
// FAUSSE. `courses.tsx` n'attend rien : là-bas le garde-manger ne fait qu'ENLEVER des lignes, donc
// un garde-manger douteux n'est simplement pas appliqué, la liste sort entière et ce composant
// s'affiche en bandeau. Ce qui sépare les deux n'est pas l'écran mais le SENS de l'erreur : l'un
// devient faux, l'autre seulement trop long. Voir décision 57 (`ETAT.md`).
//
// ⚠️ CE N'EST PAS UN RAPPEL, ET LA DISTINCTION EST LA RÈGLE DU PRODUIT. §4.3 ARCHITECTURE pose que
// le garde-manger est « FACULTATIF ET PONCTUEL, jamais un inventaire à tenir : l'appli ne demande
// rien ». On ne relance donc personne, on ne notifie pas, on n'affiche aucun badge. La question est
// posée UNIQUEMENT au moment où la donnée va SERVIR à affirmer quelque chose — et c'est une
// vérification, pas une corvée d'entretien. Déplacer cet appel vers un écran d'accueil ou une
// notification transformerait le produit en gestionnaire de stock, ce qu'il refuse d'être.
//
// ⚠️ TOUT EST COCHÉ PAR DÉFAUT, et c'est délibéré. Faire recocher douze cases pour confirmer qu'on
// n'a rien perdu serait la corvée que la recherche décrit ; l'effort ne doit porter que sur ce qui a
// CHANGÉ. Le risque assumé en échange : quelqu'un valide sans lire. On l'accepte parce que
// l'alternative — ne rien demander — est mesurément pire.

import { useMemo, useState } from 'react'
import type { FoodId } from '../engine/domain/index.js'
import { writePantry, type StoredPantryEntry } from '../data/user-store.js'
import type { Socle } from './socle.js'

/**
 * Au-delà de combien de jours on repose la question.
 *
 * Sept jours = un cycle de courses. En deçà, la déclaration a de bonnes chances d'être encore
 * vraie et demander confirmation serait du bruit ; au-delà, la donnée a réellement pu bouger.
 * ⚠️ Une date INCONNUE (garde-manger d'avant la migration v8) compte comme périmée : on ne sait pas,
 * donc on demande. L'absence d'information n'est pas une information.
 */
export const PEREMPTION_FRIGO_JOURS = 7

const MS_PAR_JOUR = 86_400_000

/**
 * Faut-il demander confirmation ? `declareLe` à `null` = date inconnue → oui, dès qu'il y a quelque
 * chose à confirmer. Fonction PURE : `aujourdhui` est injecté, ce module ne lit pas l'horloge.
 */
export function frigoAConfirmer(
  declareLe: string | null,
  aujourdhui: string,
  nombreDAliments: number
): boolean {
  if (nombreDAliments === 0) return false
  if (declareLe === null) return true
  const ecartJours = (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${declareLe}T00:00:00Z`)) / MS_PAR_JOUR
  return !Number.isFinite(ecartJours) || ecartJours > PEREMPTION_FRIGO_JOURS
}

/**
 * Les aliments du garde-manger qui ont dépassé le seuil — les autres ne sont PAS questionnés.
 *
 * ⚠️ LA QUESTION EST PAR ALIMENT, PAS PAR GARDE-MANGER, depuis que chaque ligne porte sa date.
 * Faire cocher une crème déclarée ce matin parce qu'un oignon traîne depuis trois semaines serait
 * exactement le bruit que §4.3 interdit : « l'appli ne demande rien ». On ne demande que sur ce dont
 * on ne répond plus.
 */
export function alimentsAConfirmer(
  entrees: readonly StoredPantryEntry[],
  aujourdhui: string
): readonly FoodId[] {
  return entrees
    .filter((entree) => frigoAConfirmer(entree.declareLe ?? null, aujourdhui, 1))
    .map((entree) => entree.foodId)
}

/**
 * La date à citer pour un GROUPE d'aliments : la plus ancienne, et `null` dès que l'une manque —
 * on ne dit pas « il y a 9 jours » quand une ligne peut dater de six mois.
 */
function plusAncienne(entrees: readonly StoredPantryEntry[]): string | null {
  let minimum: string | null = null
  for (const entree of entrees) {
    if (entree.declareLe === undefined) return null
    if (minimum === null || entree.declareLe < minimum) minimum = entree.declareLe
  }
  return minimum
}

/** « il y a 3 semaines », « il y a 9 jours », ou « à une date inconnue ». */
export function depuisQuand(declareLe: string | null, aujourdhui: string): string {
  if (declareLe === null) return 'à une date que l’application n’a pas gardée'
  const jours = Math.floor(
    (Date.parse(`${aujourdhui}T00:00:00Z`) - Date.parse(`${declareLe}T00:00:00Z`)) / MS_PAR_JOUR
  )
  if (!Number.isFinite(jours) || jours < 0) return 'à une date que l’application n’a pas gardée'
  if (jours < 14) return `il y a ${jours} jour${jours > 1 ? 's' : ''}`
  const semaines = Math.floor(jours / 7)
  return `il y a ${semaines} semaines`
}

export function ConfirmerFrigo({
  socle,
  entrees,
  aujourdhui,
  onConfirme,
}: {
  readonly socle: Socle
  /** Le garde-manger ENTIER, dates comprises — pas seulement les lignes périmées : voir `valider`. */
  readonly entrees: readonly StoredPantryEntry[]
  readonly aujourdhui: string
  /** Reçoit la liste retenue — l'appelant s'en sert pour relancer sa recherche. */
  readonly onConfirme: (garde: readonly FoodId[]) => void
}) {
  const garde = useMemo(() => alimentsAConfirmer(entrees, aujourdhui), [entrees, aujourdhui])
  const [coches, setCoches] = useState<ReadonlySet<FoodId>>(() => new Set(garde))
  const declareLe = useMemo(
    () => plusAncienne(entrees.filter((e) => garde.includes(e.foodId))),
    [entrees, garde]
  )

  const noms = useMemo(
    () => new Map(garde.map((id) => [id, socle.catalogue.foods.get(id)?.nom ?? id])),
    [garde, socle]
  )

  const basculer = (foodId: FoodId): void => {
    const suivant = new Set(coches)
    if (suivant.has(foodId)) suivant.delete(foodId)
    else suivant.add(foodId)
    setCoches(suivant)
  }

  const valider = (): void => {
    // ⚠️ DÉCOCHER RETIRE POUR DE BON (décision utilisateur du 2026-08-04). Ne l'ignorer que pour la
    // recherche en cours reposerait la même question à l'identique la fois suivante : on
    // contournerait la dérive au lieu de la corriger, ce qui est exactement le défaut visé.
    //
    // ⚠️ ON RÉÉCRIT LE GARDE-MANGER ENTIER, PAS LA SEULE LISTE AFFICHÉE. `writePantry` remplace la
    // table : ne lui passer que les lignes questionnées effacerait en silence tout ce qui était
    // encore frais. Et les lignes fraîches CONSERVENT leur date — les redater d'aujourd'hui
    // rejouerait le défaut qu'on vient de corriger, à l'envers.
    const suivant: readonly StoredPantryEntry[] = entrees
      .filter((entree) => !garde.includes(entree.foodId) || coches.has(entree.foodId))
      .map((entree) =>
        garde.includes(entree.foodId) ? { ...entree, declareLe: aujourdhui } : entree
      )
    writePantry(socle.db, suivant, aujourdhui)
    onConfirme(suivant.map((entree) => entree.foodId))
  }

  return (
    <div className="rounded-[--radius-carte] border border-bordure-forte bg-surface p-3">
      {/* ⚠️ UN FAIT, PAS UN REPROCHE. « Vous n'avez pas mis à jour votre frigo » culpabiliserait pour
          un entretien que l'appli s'interdit précisément d'exiger. On dit la date, on pose la
          question, on n'en tire aucune conclusion sur la personne. */}
      <p className="text-[0.95rem] leading-relaxed text-texte">
        Vous aviez déclaré {garde.length} aliment{garde.length > 1 ? 's' : ''}{' '}
        {depuisQuand(declareLe, aujourdhui)}. Vous les avez toujours&nbsp;?
      </p>

      <ul className="mt-3 space-y-1">
        {garde.map((foodId) => (
          <li key={foodId}>
            <label className="flex min-h-tactile items-center gap-3 text-[1rem] text-texte">
              <input
                type="checkbox"
                checked={coches.has(foodId)}
                onChange={() => basculer(foodId)}
                className="h-5 w-5 shrink-0"
              />
              <span>{noms.get(foodId)}</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={valider}
        className="mt-3 min-h-tactile w-full rounded-[0.7rem] border-2 border-accent bg-accent-doux px-3 text-[0.95rem] font-semibold text-accent-texte"
      >
        {coches.size === garde.length
          ? 'Oui, tout est là'
          : `Continuer avec ${coches.size} aliment${coches.size > 1 ? 's' : ''}`}
      </button>
    </div>
  )
}
