// catalog/audit-mapping.mjs — balayage id ⇄ nom Ciqual réel, sur les 450 mappings.
//
//   node catalog/audit-mapping.mjs [--ciqual <dossier>]
//
// ⚠️ CE N'EST PAS UN TEST ET ÇA NE PEUT PAS EN DEVENIR UN. `documents Ciqual/` est gitignoré : le
// balayage n'est rejouable que par qui possède l'export XML en local. C'est un AUDIT MANUEL, à
// relancer après tout lot de contenu — pas un garde-fou qui rougira tout seul en CI.
//
// ⚠️ POURQUOI IL EXISTE. `ciqual-mapping.yaml` est écrit et relu à la main. Un identifiant qui
// CONTREDIT sa ligne Ciqual ne produit aucune erreur : ni au build, ni au type, ni au test, ni à
// l'écran — c'est le défaut signature du projet appliqué aux DONNÉES. Deux cas trouvés au premier
// passage, le 2026-08-05 :
//   - `canard_magret` → 36201 « Canard, viande crue » au lieu de 36206 « Canard, magret cru ».
//     127 kcal et 5,95 g de lipides au lieu de 337 et 29,4 : × 4,9 sur le gras, sur une recette
//     qui s'appelle `magret-canard-miel`. CORRIGÉ.
//   - `jambon_blanc` → 28700 « Jambon de porc à cuire ou jambon à rôtir », un rôti CRU. Le jambon
//     blanc est 28900/28925, absents du catalogue. NON corrigé : demande un lot de contenu.
//
// ⚠️ SOUS-PRODUIT INATTENDU, ET IL VAUT LE DÉTOUR. Les identifiants sont un VOCABULAIRE COURANT
// écrit par un humain décrivant le produit ; ils divergent des noms Ciqual exactement là où les
// utilisateurs divergeront. Ce balayage a ainsi rendu des échecs de recherche MESURÉS, pas devinés
// — « maïzena » ne rendait rien, « crème liquide » rendait de la crème de marron. Sans télémétrie
// (principe 2), c'est la seule source de signal dont on dispose pour la décision 58.
//
// La règle : chaque MOT de l'identifiant doit se retrouver dans le nom Ciqual RÉEL (lu dans
// alim_*.xml, pas dans le commentaire du mapping — un commentaire peut être aussi faux que l'id)
// ou dans le nom éditorial. Un mot absent des deux = CANDIDAT à relire à la main. Faux positifs
// attendus et assumés — 8 sur 10 au premier passage. C'est une liste de lecture, pas un verdict.

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const argCiqual = process.argv.indexOf('--ciqual')
const CIQUAL_DIR =
  argCiqual !== -1 && process.argv[argCiqual + 1] !== undefined
    ? process.argv[argCiqual + 1]
    : path.join(REPO, 'documents Ciqual', '2025_11_03')

function parseFields(bloc) {
  const champs = {}
  for (const m of bloc.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) champs[m[1]] = m[2].trim()
  return champs
}

function normaliser(t) {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
}

/** Mots comparables : normalisés, sans mots vides, tronqués au radical grossier. */
const VIDES = new Set(['a', 'au', 'aux', 'de', 'des', 'du', 'en', 'et', 'la', 'le', 'les', 'ou', 'un', 'une', 'sans', 'avec'])
function mots(t) {
  return normaliser(t)
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 1 && !VIDES.has(m))
    .map((m) => (m.length >= 5 ? m.slice(0, m.length - 1) : m)) // pluriels/genres : cuit/cuite, rape/rapee
}

const fichiers = await readdir(CIQUAL_DIR)
const alimFile = fichiers.find((f) => /^alim_.*\.xml$/.test(f))
const xml = await readFile(path.join(CIQUAL_DIR, alimFile), 'utf8')

const nomParCode = new Map()
for (const m of xml.matchAll(/<ALIM>([\s\S]*?)<\/ALIM>/g)) {
  const f = parseFields(m[1])
  if (f.alim_code) nomParCode.set(f.alim_code, f.alim_nom_fr ?? '')
}

// Le mapping, lu à la ligne : `  id: code  # commentaire`
const mapping = await readFile(path.join(REPO, 'catalog/sources/ciqual-mapping.yaml'), 'utf8')
// Le nom éditorial, lu dans foods.yaml
const foodsSrc = await readFile(path.join(REPO, 'catalog/sources/foods.yaml'), 'utf8')
const nomEditorial = new Map()
{
  let id = null
  for (const ligne of foodsSrc.split(/\r?\n/)) {
    const mId = /^ {2}- id:\s*(\S+)\s*$/.exec(ligne)
    if (mId) { id = mId[1]; continue }
    const mNom = /^ {4}nom:\s*"(.*)"\s*$/.exec(ligne)
    if (mNom && id) { nomEditorial.set(id, mNom[1]); id = null }
  }
}

const suspects = []
let total = 0
for (const ligne of mapping.split(/\r?\n/)) {
  const m = /^ {2}([a-z0-9_]+):\s*(\d+)\s*(?:#\s*(.*))?$/.exec(ligne)
  if (!m) continue
  const [, id, code, commentaire] = m
  total += 1
  const nomReel = nomParCode.get(code)
  if (nomReel === undefined) {
    suspects.push({ id, code, nomReel: '(CODE INTROUVABLE AU CIQUAL)', manquants: ['?'], nomEdito: nomEditorial.get(id) ?? '' })
    continue
  }
  // On compare l'id au nom Ciqual RÉEL **et** au nom éditorial : un mot présent dans l'un des deux
  // est justifié. C'est ce qui écarte les faux positifs de transcription (`fromage_emmental_rape`
  // → « Emmental râpé », où « fromage » est légitime et absent des deux ? non : absent des deux,
  // donc il sortira — et c'est bien, on veut le relire).
  const vocabulaire = new Set([...mots(nomReel), ...mots(nomEditorial.get(id) ?? '')])
  const manquants = mots(id).filter((mot) => ![...vocabulaire].some((v) => v.startsWith(mot) || mot.startsWith(v)))
  if (manquants.length > 0) {
    suspects.push({ id, code, nomReel, manquants, nomEdito: nomEditorial.get(id) ?? '', commentaire: commentaire ?? '' })
  }
}

const lignes = [
  `${total} mappings balayés — ${suspects.length} candidats à relire`,
  '',
  ...suspects.map(
    (s) =>
      `${s.id.padEnd(26)} ${s.code.padStart(6)}  mot(s) absent(s): ${s.manquants.join(', ').padEnd(22)}\n` +
      `${' '.repeat(28)}Ciqual   : ${s.nomReel}\n` +
      `${' '.repeat(28)}éditorial: ${s.nomEdito}`
  ),
]
console.log(lignes.join('\n'))
