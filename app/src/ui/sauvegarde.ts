// ui/sauvegarde.ts — export et restauration de `user.db` (docs/ARCHITECTURE.md §7, mesures 3, 4, 5).
//
// §7 s'ouvre sur « C'est le point faible identifié de la PWA. Il doit être traité en v1, pas
// après. » Sept mesures y sont posées ; 1 (`storage.persist()`) et 6 (bandeau si la persistance est
// refusée) étaient en place, 3, 4 et 5 ne l'étaient pas. Une application sans compte et sans serveur
// n'a AUCUN chemin de récupération : l'appareil perdu emporte tout, et c'est le prix direct du
// principe 2. Ce module est ce chemin.
//
// ⚠️ LE FICHIER CONTIENT LES OCTETS SQLITE, PAS DU JSON, ET C'EST LE CHOIX STRUCTURANT.
// Une sérialisation table par table serait lisible à l'œil — vrai avantage, et on y renonce. Motif :
// `user-schema.ts` porte 24 tables et en gagne une à chaque fonctionnalité. Une liste écrite à la
// main serait juste le jour où on l'écrit, puis fausse au premier ajout, et son échec serait MUET :
// la sauvegarde marcherait, elle oublierait simplement une table. C'est mot pour mot la classe de
// défaut que ce projet paie en boucle (`note_allergene`, `Recipe.service`, `ratio`/`contexte`,
// `dernier_export_le` lui-même). `sqlite3_js_db_export` ne peut pas oublier une table.
//
// ⚠️ CE QUE ÇA COÛTE, ET C'EST ASSUMÉ : le `.nutri-backup` n'est pas inspectable par la personne qui
// le produit. Elle ne peut pas relire ses données dans un éditeur de texte. Le jour où « exporter mes
// données pour les LIRE » devient un besoin distinct de « sauvegarder pour restaurer », il faudra un
// second format — et surtout pas remplacer celui-ci, qui est le seul qui restaure fidèlement.
//
// ⚠️ CE MODULE NE RECHARGE PAS LA PAGE LUI-MÊME. La restauration remplace le fichier et rend la
// main ; c'est l'écran qui recharge. Cacher un `location.reload()` dans une fonction de données
// rendrait l'ensemble intestable et surprendrait le prochain appelant.

import { readDernierExport, readProfilCreeLe, writeDernierExport } from '../data/user-store.js'
import type { UserDb } from '../data/user-db.js'
import { USER_SCHEMA_VERSION } from '../data/user-schema.js'
import { octetsDeLaBase, remplacerLeFichier, verifierSauvegarde } from './user-source.js'

/** Fixée par §7 mesure 3 : « fichier `.nutri-backup` téléchargeable à tout moment ». */
const EXTENSION = '.nutri-backup'

/**
 * Volontairement générique, pas `application/x-sqlite3` : le type sert au navigateur à décider quoi
 * faire du fichier, et « base de données » inviterait certains systèmes à l'ouvrir avec un outil.
 */
const TYPE_MIME = 'application/octet-stream'

/** §7 mesure 4. Un cycle de courses vaut ~7 jours ; 14 laisse passer une semaine chargée. */
export const SEUIL_RAPPEL_JOURS = 14

/**
 * Au-delà, on refuse le fichier sans l'ouvrir.
 *
 * ⚠️ CE N'EST PAS UNE OPTIMISATION, C'EST UNE BORNE. Restaurer alloue le fichier DEUX fois — une
 * copie dans le tas WASM pour la désérialiser, une seconde pour réexporter la base migrée. Sans
 * plafond, un fichier de plusieurs gigaoctets présenté comme « une sauvegarde » fait tomber l'onglet
 * avant même qu'on ait pu regarder ce qu'il contient. 64 Mo est très large : `user.db` pèse quelques
 * dizaines de kilooctets, et l'en-tête de `user-source.ts` ne prévoit de le revoir qu'à des dizaines
 * de milliers de lignes d'historique.
 */
const TAILLE_MAX_OCTETS = 64 * 1024 * 1024

const MS_PAR_JOUR = 86_400_000

// --- Politique (pur, testable) ------------------------------------------------------------------

/**
 * Nom du fichier produit. Daté, parce qu'on en garde plusieurs.
 *
 * ⚠️ PAS D'HEURE. Deux sauvegardes le même jour portent le même nom et le système ajoutera son
 * « (1) » — ce qui est exactement le comportement attendu. Une heure dans le nom rendrait la liste
 * illisible pour le seul bénéfice de départager un cas rare.
 */
export function nomFichierSauvegarde(dateIso: string): string {
  return `nutrition-${dateIso.slice(0, 10)}${EXTENSION}`
}

/** Jours pleins écoulés entre deux dates ISO. `null` si la première est absente ou illisible. */
export function joursDepuis(dateIso: string | null, maintenantIso: string): number | null {
  if (dateIso === null || dateIso === '') return null
  const debut = Date.parse(dateIso)
  const fin = Date.parse(maintenantIso)
  if (Number.isNaN(debut) || Number.isNaN(fin)) return null
  return Math.max(0, Math.floor((fin - debut) / MS_PAR_JOUR))
}

/**
 * L'ancienneté à laquelle se juge le rappel.
 *
 * ⚠️ « JAMAIS EXPORTÉ » N'EST PAS « IL Y A LONGTEMPS », et confondre les deux réclamerait une
 * sauvegarde au premier lancement, devant une base vide. On se rabat donc sur la date de CRÉATION du
 * profil : ce qui vieillit sans sauvegarde, ce ne sont pas les exports, ce sont les données. Sans
 * profil, il n'y a rien à perdre et rien à demander.
 */
export function ancienneteSauvegarde(
  etat: { readonly dernierExport: string | null; readonly creeLe: string | null },
  maintenantIso: string
): number | null {
  return joursDepuis(etat.dernierExport ?? etat.creeLe, maintenantIso)
}

/** §7 mesure 4. */
export function doitRappeler(
  etat: { readonly dernierExport: string | null; readonly creeLe: string | null },
  maintenantIso: string
): boolean {
  const jours = ancienneteSauvegarde(etat, maintenantIso)
  return jours !== null && jours > SEUIL_RAPPEL_JOURS
}

/**
 * Le résumé affiché sur la ligne « Sauvegarde » des Paramètres.
 *
 * ⚠️ AUCUNE INJONCTION. « Jamais sauvegardé » est un fait ; « pensez à sauvegarder ! » serait une
 * consigne, et ce produit informe (principe 6). Le seul mot qui pousse à agir est « à refaire », posé
 * uniquement passé le seuil, et il qualifie la sauvegarde, pas la personne.
 */
export function resumeSauvegarde(
  etat: { readonly dernierExport: string | null; readonly creeLe: string | null },
  maintenantIso: string
): string {
  if (etat.dernierExport === null || etat.dernierExport === '') return 'Jamais sauvegardé'
  const jours = joursDepuis(etat.dernierExport, maintenantIso)
  if (jours === null) return 'Jamais sauvegardé'
  const age = jours === 0 ? "Aujourd'hui" : jours === 1 ? 'Hier' : `Il y a ${jours} jours`
  return doitRappeler(etat, maintenantIso) ? `${age} — à refaire` : age
}

/** Verdict rendu à l'utilisateur avant tout remplacement. */
export type VerdictSauvegarde =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: string }

/**
 * Cette sauvegarde est-elle restaurable par CETTE version de l'application ?
 *
 * ⚠️ UNE VERSION PLUS RÉCENTE EST REFUSÉE, PAS TENTÉE. Les migrations de ce projet ne vont que vers
 * l'avant (`user-schema.ts`) : une base v11 ouverte par une application v10 ne se dégrade pas, elle
 * porte des colonnes que le code ne connaît pas — et la première écriture sur une table remaniée
 * violerait une contrainte, ou pire, écrirait à côté. Refuser est la seule issue honnête, et le
 * message doit dire quoi faire.
 *
 * Une version PLUS ANCIENNE est acceptée : `migrate` sait la monter, et c'est précisément à ça que
 * sert le versionnage du schéma.
 */
export function jugerVersion(version: number, versionCourante = USER_SCHEMA_VERSION): VerdictSauvegarde {
  if (!Number.isInteger(version) || version < 0) {
    return { ok: false, motif: "Ce fichier n'est pas une sauvegarde de cette application." }
  }
  if (version > versionCourante) {
    return {
      ok: false,
      motif:
        'Cette sauvegarde a été faite avec une version plus récente de l’application. ' +
        "Mettez l'application à jour, puis réessayez.",
    }
  }
  return { ok: true }
}

// --- Export (mesure 3) --------------------------------------------------------------------------

/** Ce qu'il faut savoir pour afficher la section Sauvegarde sans rouvrir la base. */
export interface EtatSauvegarde {
  readonly dernierExport: string | null
  readonly creeLe: string | null
}

export function lireEtatSauvegarde(db: UserDb): EtatSauvegarde {
  return { dernierExport: readDernierExport(db), creeLe: readProfilCreeLe(db) }
}

/**
 * Produit le fichier de sauvegarde, puis date l'export.
 *
 * ⚠️ LA DATE N'EST ÉCRITE QU'APRÈS. Si le partage échoue ou si l'utilisateur l'annule au niveau du
 * système, on ne veut pas avoir fait taire le rappel pour 14 jours au nom d'un fichier inexistant.
 *
 * ⚠️ SILENCIEUX SUR LE PARTAGE, PAS SUR L'EXPORT. Un `navigator.share` refusé n'est pas une erreur —
 * c'est un geste annulé. Une lecture de la base qui échoue, si.
 */
export async function exporterSauvegarde(db: UserDb, maintenantIso: string): Promise<void> {
  const octets = octetsDeLaBase()
  const fichier = nomFichierSauvegarde(maintenantIso)
  const partage = await partagerOuTelecharger(octets, fichier)
  if (partage) writeDernierExport(db, maintenantIso)
}

/** `true` si le fichier est réellement parti (partagé ou téléchargé). */
async function partagerOuTelecharger(octets: Uint8Array<ArrayBuffer>, nom: string): Promise<boolean> {
  // `BlobPart` n'accepte pas un `Uint8Array` générique : on passe par son tampon, qui est bien un
  // `ArrayBuffer` (voir la note de type dans `user-source.ts`).
  const blob = new Blob([octets.buffer], { type: TYPE_MIME })

  if (typeof navigator !== 'undefined' && navigator.share !== undefined) {
    const aPartager = new File([blob], nom, { type: TYPE_MIME })
    if (navigator.canShare?.({ files: [aPartager] }) === true) {
      try {
        await navigator.share({ files: [aPartager], title: 'Sauvegarde' })
        return true
      } catch {
        // Partage annulé ou indisponible : on retombe sur le téléchargement plutôt que de laisser
        // un bouton sans effet. Même principe que `export-recette.ts`.
      }
    }
  }

  telecharger(blob, nom)
  return true
}

function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  URL.revokeObjectURL(url)
}

// --- Restauration (mesure 5) --------------------------------------------------------------------

export type ResultatRestauration =
  | { readonly ok: true; readonly version: number }
  | { readonly ok: false; readonly motif: string }

/**
 * Restaure une sauvegarde. **Remplace toutes les données locales.** L'appelant recharge la page.
 *
 * L'ordre des trois temps est la garantie : on LIT le fichier, on l'OUVRE dans une base jetable pour
 * prouver qu'il s'ouvre et le migrer, et seulement alors on ÉCRASE. Aucun de ces temps ne peut
 * laisser l'utilisateur avec une base à moitié remplacée — le remplacement est la dernière chose qui
 * arrive, et il ne porte que des octets déjà éprouvés.
 */
export async function restaurerSauvegarde(fichier: File): Promise<ResultatRestauration> {
  // Jugé sur la TAILLE DÉCLARÉE, avant de lire quoi que ce soit en mémoire.
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return { ok: false, motif: "Ce fichier est trop volumineux pour être une sauvegarde de l'application." }
  }

  let octets: Uint8Array
  try {
    octets = new Uint8Array(await fichier.arrayBuffer())
  } catch {
    return { ok: false, motif: "Ce fichier n'a pas pu être lu." }
  }
  if (octets.length === 0) return { ok: false, motif: 'Ce fichier est vide.' }

  let verifie: { version: number; migres: Uint8Array<ArrayBuffer> }
  try {
    verifie = verifierSauvegarde(octets)
  } catch {
    // Le message de SQLite (« file is not a database ») ne dit rien à qui vient de choisir un
    // fichier dans une liste. On nomme ce qu'il faut vérifier : le fichier, pas la base.
    return { ok: false, motif: "Ce fichier n'est pas une sauvegarde de cette application." }
  }

  const verdict = jugerVersion(verifie.version)
  if (!verdict.ok) return { ok: false, motif: verdict.motif }

  try {
    await remplacerLeFichier(verifie.migres)
  } catch (erreur) {
    return { ok: false, motif: erreur instanceof Error ? erreur.message : String(erreur) }
  }
  return { ok: true, version: verifie.version }
}
