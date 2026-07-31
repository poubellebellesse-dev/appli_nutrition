// ui/profil-enregistre.ts — les trois réglages de profil, lus et écrits d'un bloc.
//
// ⚠️ CE MODULE EXISTE POUR EMPÊCHER UNE PERTE DE DONNÉES. Le parcours de premier lancement partait
// d'un `CHOIX_INITIAL` vide et écrivait les trois réglages à la fin. Tant que
// `VERSION_CONSENTEMENT` ne bougeait pas, le défaut restait latent : le parcours ne s'ouvrait qu'une
// fois, sur une base neuve. Mais §6.4 ARCHITECTURE veut qu'un texte de consentement modifié ROUVRE
// le parcours — et là, quelqu'un qui utilise l'application depuis des mois se voyait redemander son
// accord, puis repartait avec `user_allergy` VIDÉE parce que l'écran ne savait pas ce qu'il y avait
// déjà. Sur le seul garde-fou critique du moteur, c'est le pire effacement possible.
//
// D'où la règle, tenue ici et pas dans les écrans : ON RELIT AVANT DE RÉÉCRIRE. Le même module sert
// à l'accueil et à Paramètres — deux copies auraient divergé, et l'une des deux aurait fini par
// réintroduire le défaut.
//
// ⚠️ AUCUN IMPORT NODE ICI NON PLUS (voir `user-db.ts`) : ce module part dans le bundle navigateur.

import type { DietCode } from '../engine/domain/index.js'
import type { AllergenId } from '../engine/domain/index.js'
import type { UserDb } from '../data/user-db.js'
import {
  readAllergies,
  readDiet,
  readRythme,
  writeAllergies,
  writeDiet,
  writeRythme,
  type StoredRythme,
} from '../data/user-store.js'

export interface ChoixProfil {
  readonly allergenes: ReadonlySet<string>
  readonly regime: DietCode | null
  readonly rythme: StoredRythme
}

/**
 * Rythme retenu quand rien n'a jamais été déclaré.
 *
 * ⚠️ UNE SEULE DÉFINITION, partagée par l'accueil et par Paramètres. Deux constantes différentes
 * feraient qu'ouvrir un écran sans rien y toucher CHANGERAIT les suggestions de l'autre.
 */
export const RYTHME_PAR_DEFAUT: StoredRythme = {
  repasParJour: 2,
  tempsSemaineMin: 30,
  tempsWeekendMin: null,
}

/** Ce qui est déjà en base. Base neuve → les défauts, jamais `null` : les écrans veulent un état. */
export function lireChoixProfil(db: UserDb): ChoixProfil {
  return {
    allergenes: new Set(readAllergies(db).map((a) => a.allergenId)),
    regime: readDiet(db),
    rythme: readRythme(db) ?? RYTHME_PAR_DEFAUT,
  }
}

/**
 * Écrit les trois d'un bloc.
 *
 * `writeAllergies` et `writeDiet` REMPLACENT (ils ne complètent pas) : c'est voulu — décocher doit
 * retirer du filtre. C'est aussi précisément pourquoi l'appelant doit être parti de
 * `lireChoixProfil`, et non d'un état vide.
 */
export function ecrireChoixProfil(db: UserDb, choix: ChoixProfil): void {
  writeAllergies(
    db,
    [...choix.allergenes].map((id) => ({ allergenId: id as AllergenId, severite: null }))
  )
  writeDiet(db, choix.regime)
  writeRythme(db, choix.rythme)
}
