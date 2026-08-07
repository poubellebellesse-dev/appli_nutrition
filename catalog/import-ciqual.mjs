// catalog/import-ciqual.mjs — import des valeurs nutritionnelles depuis l'export XML Ciqual (ANSES).
//
// POURQUOI CE SCRIPT EXISTE
// Les 76 aliments de `catalog/sources/foods.yaml` portaient jusqu'ici des codes `PROV-000xx` et des
// valeurs « ordres de grandeur usuels, PAS vérifiées » (voir l'en-tête de ce fichier). Pour une
// appli qui affiche un badge de preuve, tourner sur des valeurs inventées n'est pas tenable. Ce
// script remplace ces valeurs par celles de la table Ciqual, aliment par aliment.
//
// ZÉRO DÉPENDANCE. L'export XML de l'ANSES est un dump relationnel très régulier (un enregistrement
// par balise, pas d'attributs sauf `missing`, pas de namespaces, pas de CDATA) : un lecteur par
// expression régulière suffit et évite d'ajouter une bibliothèque XML ou Excel au projet. Le `.xls`
// distribué en parallèle est un binaire BIFF que Node ne sait pas lire — c'est la raison du choix
// du format XML côté source.
//
// L'APPARIEMENT N'EST PAS AUTOMATIQUE, ET C'EST VOULU.
// Les identifiants du catalogue sont des slugs lisibles écrits à la main (`saumon`, `boeuf_hache_5`)
// alors que Ciqual nomme ses 3 484 entrées de façon très fine (« Saumon, cru, élevage » vs « Saumon
// fumé » vs « Saumon, cuit à la vapeur »). Un rapprochement par similarité de nom choisirait
// silencieusement la mauvaise ligne, et une valeur nutritionnelle fausse ne se voit pas — elle se
// propage dans tout le moteur. L'appariement vit donc dans un fichier EXPLICITE et relu,
// `catalog/sources/ciqual-mapping.yaml` (food_id → alim_code). Le mode `--search` sert à le
// construire ; il ne l'écrit jamais tout seul.
//
// USAGE
//   node catalog/import-ciqual.mjs --search "saumon"      → liste les aliments Ciqual correspondants
//   node catalog/import-ciqual.mjs --check                → vérifie le mapping, n'écrit rien
//   node catalog/import-ciqual.mjs --write                → réécrit les nutriments dans foods.yaml
//   node catalog/import-ciqual.mjs --write-confiance      → écrit catalog/sources/ciqual-confiance.yaml
//
// La source ANSES n'est PAS versionnée (69 Mo, dont 67 pour compo). Télécharger l'export XML sur
// https://ciqual.anses.fr/ et le placer dans le dossier passé par `--ciqual` (défaut ci-dessous).

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.join(__dirname, '..')
const DEFAULT_CIQUAL_DIR = path.join(REPO_ROOT, 'documents Ciqual', '2025_11_03')
const FOODS_PATH = path.join(REPO_ROOT, 'catalog', 'sources', 'foods.yaml')
const MAPPING_PATH = path.join(REPO_ROOT, 'catalog', 'sources', 'ciqual-mapping.yaml')
const CONFIANCE_PATH = path.join(REPO_ROOT, 'catalog', 'sources', 'ciqual-confiance.yaml')

// ----------------------------------------------------------------------------
// Les 9 nutriments retenus (décision 25, docs/ETAT.md §4) → code constituant Ciqual.
//
// `energie` = code 328, l'énergie du **Règlement UE 1169/2011** en kcal — celle de l'étiquetage
// réglementaire, PAS le code 333 (« N x facteur Jones, avec fibres ») qui est une autre convention
// de calcul. Les deux coexistent dans la table et donnent des valeurs différentes.
// `proteines` = code 25000, « N x facteur de Jones » (le facteur propre à chaque aliment), pas
// 25003 qui force N x 6.25 pour tous.
// ⚠️ Sodium = 10110 et Calcium = 10200 : les deux codes se ressemblent, ne pas les intervertir.
// ----------------------------------------------------------------------------
const NUTRIENT_CONST_CODES = {
  energie_kcal: '328',
  proteines_g: '25000',
  lipides_g: '40000',
  glucides_g: '31000',
  fibres_g: '34100',
  fer_mg: '10260',
  calcium_mg: '10200',
  sodium_mg: '10110',
  vitamine_c_mg: '55100',
}

class ImportError extends Error {}

// ----------------------------------------------------------------------------
// Lecture XML minimale — voir l'en-tête pour la justification.
// ----------------------------------------------------------------------------

/** Champs d'un enregistrement : `<tag> valeur </tag>` → string trimée, `<tag missing=" "/>` → null. */
function parseFields(block) {
  const fields = {}
  const re = /<(\w+)(?:\s+missing="[^"]*"\s*\/>|\s*>([\s\S]*?)<\/\1>)/g
  let match
  while ((match = re.exec(block)) !== null) {
    const [, name, value] = match
    fields[name] = value === undefined ? null : decodeEntities(value.trim())
  }
  return fields
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function parseRecords(xml, tag) {
  const records = []
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g')
  let match
  while ((match = re.exec(xml)) !== null) records.push(parseFields(match[1]))
  return records
}

/**
 * Teneur Ciqual → nombre. La table n'utilise pas que des nombres : `traces` (présence sous le seuil
 * de quantification), `< 0,5` (borne supérieure), `-` (non déterminé). Conventions retenues, toutes
 * conservatrices et documentées ici parce qu'elles CHANGENT les valeurs importées :
 *   - `traces`  → 0    (quantité négligeable, la traiter comme inconnue ferait disparaître le champ)
 *   - `< X`     → X    (borne haute : ne jamais sous-estimer un nutriment à plafond comme le sodium)
 *   - `-` / vide→ null (non déterminé : le champ est OMIS plutôt que mis à 0, un zéro inventé étant
 *                       indistinguable d'un vrai zéro pour la couche `nutri`)
 * La virgule décimale française est acceptée.
 */
function parseTeneur(raw) {
  if (raw === null || raw === undefined) return null
  const text = raw.trim()
  if (text === '' || text === '-') return null
  if (/^traces$/i.test(text)) return 0
  const numeric = text.replace(/^</, '').replace(',', '.').trim()
  const value = Number(numeric)
  return Number.isFinite(value) ? value : null
}

// ----------------------------------------------------------------------------
// Chargement de la table
// ----------------------------------------------------------------------------

async function loadCiqual(ciqualDir) {
  const alimPath = findFile(ciqualDir, /^alim_.*\.xml$/)
  const compoPath = findFile(ciqualDir, /^compo_.*\.xml$/)

  const alims = parseRecords(await readFile(alimPath, 'utf8'), 'ALIM')
  const foodsByCode = new Map(alims.map((a) => [a.alim_code, a]))

  // `compo` fait ~67 Mo pour 257 816 lignes. On ne retient QUE les 9 constituants voulus : garder
  // les 74 ferait 8 fois plus d'objets en mémoire pour rien.
  const wanted = new Set(Object.values(NUTRIENT_CONST_CODES))
  const compo = new Map() // alim_code → { const_code → teneur }
  // Cotes de confiance ANSES (A→D), décision 33 tranchée le 2026-08-05. Elles étaient JETÉES ici
  // même : la boucle ne retenait que `teneur`. Voir `--write-confiance` pour ce qu'on en fait, et
  // surtout pour ce qu'on n'en fait PAS (aucune pondération de score).
  const confiance = new Map() // alim_code → { const_code → 'A'|'B'|'C'|'D' }
  for (const row of parseRecords(await readFile(compoPath, 'utf8'), 'COMPO')) {
    if (!wanted.has(row.const_code)) continue
    if (!compo.has(row.alim_code)) compo.set(row.alim_code, {})
    compo.get(row.alim_code)[row.const_code] = parseTeneur(row.teneur)
    const cote = (row.code_confiance ?? '').trim()
    if (cote !== '') {
      if (!confiance.has(row.alim_code)) confiance.set(row.alim_code, {})
      confiance.get(row.alim_code)[row.const_code] = cote
    }
  }

  return { foodsByCode, compo, confiance }
}

function findFile(dir, pattern) {
  if (!existsSync(dir)) {
    throw new ImportError(
      `Dossier Ciqual introuvable : ${dir}\n` +
        `Télécharger l'export XML sur https://ciqual.anses.fr/ puis passer --ciqual <dossier>.`
    )
  }
  const found = readdirSync(dir).find((f) => pattern.test(f))
  if (!found) throw new ImportError(`Aucun fichier ${pattern} dans ${dir}`)
  return path.join(dir, found)
}

// ----------------------------------------------------------------------------
// Modes
// ----------------------------------------------------------------------------

function runSearch(foodsByCode, term) {
  const needle = normalize(term)
  const hits = [...foodsByCode.values()].filter((a) => normalize(a.alim_nom_fr ?? '').includes(needle))
  if (hits.length === 0) {
    console.log(`Aucun aliment Ciqual ne contient « ${term} ».`)
    return
  }
  console.log(`${hits.length} résultat(s) pour « ${term} » :`)
  for (const hit of hits) console.log(`  ${hit.alim_code.padStart(6)}  ${hit.alim_nom_fr}`)
}

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Valeurs des 9 nutriments pour un aliment Ciqual — les non déterminés sont OMIS (voir parseTeneur). */
function nutrientsFor(alimCode, compo) {
  const row = compo.get(alimCode)
  if (row === undefined) return null
  const out = {}
  for (const [key, constCode] of Object.entries(NUTRIENT_CONST_CODES)) {
    const value = row[constCode]
    if (value !== null && value !== undefined) out[key] = value
  }
  return out
}

async function loadMapping() {
  if (!existsSync(MAPPING_PATH)) {
    throw new ImportError(
      `Mapping absent : ${MAPPING_PATH}\n` +
        `Le construire avec --search, une ligne par aliment du catalogue (food_id: alim_code).`
    )
  }
  const data = parseYaml(await readFile(MAPPING_PATH, 'utf8'))
  return data?.mapping ?? {}
}

/**
 * Vérifie le mapping avant toute écriture. Collecte TOUTES les erreurs plutôt que d'échouer à la
 * première — même parti pris que catalog/build.mjs, un diagnostic complet vaut mieux qu'un aller-retour
 * par ligne fautive.
 */
function checkMapping({ foods, mapping, foodsByCode, compo }) {
  const errors = []
  const warnings = []

  for (const food of foods) {
    const alimCode = mapping[food.id]
    if (alimCode === undefined) {
      errors.push(`'${food.id}' (${food.nom}) : absent de ciqual-mapping.yaml`)
      continue
    }
    const alim = foodsByCode.get(String(alimCode))
    if (alim === undefined) {
      errors.push(`'${food.id}' : alim_code '${alimCode}' inconnu de la table Ciqual`)
      continue
    }
    const nutrients = nutrientsFor(String(alimCode), compo)
    if (nutrients === null || Object.keys(nutrients).length === 0) {
      errors.push(`'${food.id}' → ${alimCode} (${alim.alim_nom_fr}) : aucune valeur pour les 9 nutriments`)
      continue
    }
    // Décision 29, TRANCHÉE le 2026-07-27 : l'absence d'énergie n'est plus une ERREUR BLOQUANTE.
    //
    // Ce garde-fou refusait tout aliment sans énergie, au motif qu'il contribuerait silencieusement
    // 0 kcal à ses recettes et fausserait le classement de `nutri`. Le motif était juste, la
    // réponse trop brutale : elle FAÇONNAIT LE CATALOGUE SUR CE QUE L'ANSES A DOCUMENTÉ plutôt que
    // sur la cuisine. La ricotta a dû être remplacée à l'écriture des recettes ; les câpres et la
    // ciboulette séchée sont dans le même cas (19585, 11040, 11095 — aucune des quatre conventions
    // d'énergie n'est renseignée). Cette distorsion est invisible et s'aggrave à chaque lot.
    //
    // L'incomplétude est désormais PROPAGÉE et traitée en aval, là où elle nuit :
    // `computeNutrientCoverage` (engine/nutrition/) mesure la part de la masse dont la valeur est
    // connue, `scoreNutri` s'ABSTIENT de noter un nutriment sous `NUTRI_MIN_COVERAGE` au lieu de le
    // noter sur un zéro inventé, et `NutrientSummary.coverage` remonte l'information jusqu'à
    // l'affichage. Le trou de données ne se traduit plus par un chiffre faux.
    //
    // ⚠️ CE QUI RESTE INTERDIT : inventer la valeur, ou la recalculer depuis les macros (4/4/9), et
    // l'écrire dans le même champ que les chiffres ANSES. Ce serait un chiffre maison
    // indistinguable d'un chiffre sourcé — exactement ce que le badge de preuve existe pour
    // empêcher. Une seconde source (USDA, CoFID) reste possible, à condition d'être TRACÉE par
    // valeur ; le vecteur de couverture est justement ce qui rendra ça faisable.
    if (!('energie_kcal' in nutrients)) {
      warnings.push(
        `'${food.id}' → ${alim.alim_nom_fr} : Ciqual ne donne AUCUNE énergie. Aliment accepté, mais ` +
          `ses recettes ne seront pas notées sur l'énergie (couverture insuffisante).`
      )
    }

    const manquants = Object.keys(NUTRIENT_CONST_CODES).filter((k) => !(k in nutrients))
    if (manquants.length > 0) {
      warnings.push(`'${food.id}' → ${alim.alim_nom_fr} : non déterminé pour ${manquants.join(', ')}`)
    }
  }

  const inconnus = Object.keys(mapping).filter((id) => !foods.some((f) => f.id === id))
  for (const id of inconnus) errors.push(`ciqual-mapping.yaml : '${id}' n'est pas un aliment du catalogue`)

  return { errors, warnings }
}

// ----------------------------------------------------------------------------
// Entrée
// ----------------------------------------------------------------------------

async function main(argv) {
  const args = new Map()
  const flags = new Set()
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const name = argv[i].slice(2)
    if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      args.set(name, argv[i + 1])
      i += 1
    } else {
      flags.add(name)
    }
  }

  const ciqualDir = args.get('ciqual') ?? DEFAULT_CIQUAL_DIR
  const { foodsByCode, compo, confiance } = await loadCiqual(ciqualDir)

  if (args.has('search')) {
    runSearch(foodsByCode, args.get('search'))
    return 0
  }

  const foodsDoc = parseYaml(await readFile(FOODS_PATH, 'utf8'))
  const foods = foodsDoc?.foods ?? []
  const mapping = await loadMapping()
  const { errors, warnings } = checkMapping({ foods, mapping, foodsByCode, compo })

  for (const warning of warnings) console.warn(`  ⚠ ${warning}`)

  if (errors.length > 0) {
    console.error(`\nImport Ciqual impossible — ${errors.length} erreur(s) :\n`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }

  if (flags.has('write-confiance')) {
    const { text, count } = renderConfianceYaml(mapping, confiance)
    await writeFile(CONFIANCE_PATH, text, 'utf8')
    console.log(`
✔ ciqual-confiance.yaml écrit : ${count} cote(s) sur ${Object.keys(mapping).length} aliment(s).`)
    return 0
  }

  if (!flags.has('write')) {
    console.log(`\n✔ Mapping valide : ${foods.length} aliment(s) appariés, ${warnings.length} avertissement(s).`)
    console.log('  (--check ne modifie rien ; relancer avec --write pour réécrire foods.yaml)')
    return 0
  }

  const original = await readFile(FOODS_PATH, 'utf8')
  const { text, replaced } = rewriteFoodsYaml(original, mapping, compo)
  await writeFile(FOODS_PATH, text, 'utf8')
  console.log(`\n✔ foods.yaml réécrit : ${replaced} aliment(s), valeurs Ciqual 2025.`)
  return 0
}


/**
 * Rend `catalog/sources/ciqual-confiance.yaml` — décision 33, issue « importer sans pondérer ».
 *
 * ⚠️ UN FICHIER À PART, ET PAS DANS `foods.yaml`, pour deux raisons distinctes. La première est
 * pratique : `foods.yaml` est le fichier le plus disputé du dépôt, et y injecter 4 000 lignes de
 * cotes rendrait tout diff éditorial illisible. La seconde est de fond : une COTE n'est pas une
 * VALEUR. `foods.yaml` dit ce que contient un aliment ; ce fichier-ci dit ce que l'ANSES sait de la
 * façon dont ce chiffre a été obtenu. Les mélanger inviterait à les faire diverger d'un seul côté.
 *
 * ⚠️ GÉNÉRÉ, JAMAIS ÉDITÉ À LA MAIN — contrairement à `ciqual-mapping.yaml`, qui est un jugement
 * humain relu. Ici il n'y a rien à juger : la cote est celle de l'ANSES, on la recopie.
 *
 * ⛔ CE QUE CES COTES NE SERVENT PAS À FAIRE : pondérer un score. La décision 33 a explicitement
 * écarté cette piste. Mesuré le 2026-08-05 sur les 449 aliments appariés — 39 % des valeurs hors
 * énergie sont cotées C ou D, et l'ÉNERGIE est à 434 D sur 449 **par construction** (« Energie,
 * Règlement UE N° 1169/2011 » est calculée depuis les macros, jamais dosée). Pondérer naïvement
 * sortirait l'énergie du scoring pour tout le catalogue, et ferait scorer un aliment plus bas pour
 * une raison de DOCUMENTATION, invisible à l'utilisateur et incontestable par lui.
 */
function renderConfianceYaml(mapping, confiance) {
  const parNutriment = Object.entries(NUTRIENT_CONST_CODES)
  const lignes = [
    '# ============================================================================',
    '# Cotes de confiance ANSES (A → D) des valeurs Ciqual, par aliment et nutriment.',
    '#',
    '# ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.',
    '#     node catalog/import-ciqual.mjs --write-confiance',
    '#',
    '# Définition officielle, CITÉE VERBATIM — ANSES, « Table de composition nutritionnelle des',
    '# aliments Ciqual 2025 — Documentation » (19/11/2025), tableau 6, champ `code_confiance` :',
    '#     « code de confiance, qui indique la fiabilité de la teneur moyenne',
    '#       (de A=très fiable à D=moins fiable) »',
    '# https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025%20doc%20FR_2025_11_19.pdf',
    '#',
    '# ⚠️ CET EN-TÊTE A ÉTÉ CORRIGÉ LE 2026-08-07, APRÈS OUVERTURE DE LA SOURCE. Il affirmait',
    '#    « A = valeur dosée … D = valeur calculée, imputée ou empruntée » et « une cote C ou D ne',
    '#    veut PAS dire douteuse ». Ces phrases n’étaient sourcées nulle part et contredisent la',
    '#    documentation : le code annonce une FIABILITÉ, pas une provenance. Ce qui reste vrai est',
    '#    l’observation faite le 2026-08-05 — les valeurs C/D viennent surtout de la table USDA (451',
    '#    occurrences) et d’un calcul interne Ciqual (368) — mais elle décrit D’OÙ VIENNENT ces',
    '#    valeurs, pas ce que le code SIGNIFIE. ⛔ L’ANSES ne définit QUE les deux bornes : B et C ne',
    '#    doivent recevoir aucun libellé, sous peine d’inventer une source.',
    '#',
    '# ⛔ NE SERT À AUCUNE PONDÉRATION DE SCORE (décision 33). Sert la traçabilité affichée : dire',
    '#    ce que l’ANSES dit de la solidité d’un chiffre, sans le transformer en note ni en couleur.',
    '#    L’énergie porte sa cote comme les autres (434 D sur 449) : elle n’est jamais dosée mais',
    '#    calculée selon le règlement UE n° 1169/2011, et l’écran l’explique au lieu de la masquer.',
    '# ============================================================================',
    '',
    'confiance:',
  ]

  let count = 0
  for (const [foodId, alimCode] of Object.entries(mapping).sort((a, b) => a[0].localeCompare(b[0]))) {
    const cotes = confiance.get(String(alimCode))
    if (cotes === undefined) continue
    const paires = parNutriment
      .filter(([, constCode]) => cotes[constCode] !== undefined)
      .map(([nom, constCode]) => `${nom}: ${cotes[constCode]}`)
    if (paires.length === 0) continue
    lignes.push(`  ${foodId}: { ${paires.join(', ')} }`)
    count += paires.length
  }

  return { text: lignes.join('\n') + '\n', count }
}

/**
 * Réécriture CHIRURGICALE, ligne à ligne : seuls `code_ciqual` et le bloc `nutriments` de chaque
 * aliment sont remplacés.
 *
 * ⚠️ NE PAS remplacer ceci par un `parse` + `stringify` du document YAML, même si c'est plus court :
 * `foods.yaml` contient ~45 lignes de COMMENTAIRES qui justifient les choix éditoriaux de
 * saisonnalité, aliment par aliment (« légume de garde », « poisson d'élevage, pas de saisonnalité
 * de pêche », « bassin de Menton, AOC »…). La bibliothèque `yaml` les perd au parse : un aller-retour
 * détruirait silencieusement le seul endroit où ces décisions sont écrites.
 */
function rewriteFoodsYaml(source, mapping, compo) {
  const lines = source.split(/\r?\n/)
  const out = []
  let currentId = null
  let replaced = 0
  let skippingNutrients = false

  for (const line of lines) {
    const idMatch = /^ {2}- id:\s*(\S+)\s*$/.exec(line)
    if (idMatch) {
      currentId = idMatch[1]
      skippingNutrients = false
      out.push(line)
      continue
    }

    // Fin du bloc `nutriments` : toute ligne moins indentée que ses entrées (6 espaces).
    if (skippingNutrients) {
      if (/^ {6}\S/.test(line)) continue
      skippingNutrients = false
    }

    if (currentId !== null && /^ {4}code_ciqual:/.test(line)) {
      out.push(`    code_ciqual: "${mapping[currentId]}"`)
      continue
    }

    if (currentId !== null && /^ {4}nutriments:\s*$/.test(line)) {
      const values = nutrientsFor(String(mapping[currentId]), compo) ?? {}
      out.push('    nutriments:')
      for (const [key, value] of Object.entries(values)) out.push(`      ${key}: ${value}`)
      skippingNutrients = true
      replaced += 1
      continue
    }

    out.push(line)
  }

  return { text: out.join('\n'), replaced }
}


main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof ImportError ? `\n${error.message}` : error)
    process.exit(1)
  })
