#!/usr/bin/env node
// ============================================================================
// catalog/build.mjs
//
// Compile les sources éditables (catalog/sources, catalog/lexicon,
// catalog/recipes — YAML en clair) en un unique fichier SQLite `catalog.db`
// consommé par le runtime (docs/ARCHITECTURE.md §9, docs/ENGINE.md §9).
//
// "Tout ce qui peut être calculé au build l'est." (docs/ENGINE.md §9.2)
//
// Le build échoue (exit != 0) si :
//   - une recette référence un `food_id` inconnu
//   - une étape référence un `lexicon_ids` code absent du lexique
//   - un mot du lexique banni (docs/ARCHITECTURE.md §6.2) apparaît dans un
//     champ texte de contenu (nom / description / étape / lexique)
//
// Node ESM pur, sans TypeScript (le build n'est pas du code applicatif).
// Utilise le module intégré `node:sqlite` (Node >= 22.5, stable en Node 24).
// ============================================================================

import { readFile, readdir, mkdir } from 'node:fs/promises'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { DatabaseSync } from 'node:sqlite'
import { liensDeLaRecette } from './lien-etape-ingredient.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ----------------------------------------------------------------------------
// 1. Arguments CLI (permet aux tests de pointer vers une fixture isolée sans
//    toucher aux vraies sources ni au vrai catalog.db — voir catalog/build.test.ts)
// ----------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { sources: null, out: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sources') args.sources = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
  }
  return args
}

const cliArgs = parseArgs(process.argv.slice(2))
const SOURCES_DIR = cliArgs.sources
  ? path.resolve(cliArgs.sources)
  : __dirname
const OUT_PATH = cliArgs.out
  ? path.resolve(cliArgs.out)
  : path.join(__dirname, '..', 'app', 'public', 'catalog', 'catalog.db')

// ----------------------------------------------------------------------------
// 2. Référentiels fixes (docs/ARCHITECTURE.md §4.2)
//    Ni les nutriments ni les 14 allergènes UE ne varient d'une recette à
//    l'autre : ce sont des référentiels, pas du contenu éditorial — ils
//    vivent ici plutôt que dans un fichier YAML séparé.
// ----------------------------------------------------------------------------

// Clé = champ utilisé dans sources/foods.yaml (`nutriments.<clé>`).
// vnr_adulte = valeur nutritionnelle de référence adulte, indicative
// (proche des NRV UE — règlement 1169/2011 annexe XIII), utilisée pour
// contextualiser un apport, jamais comme cible à atteindre (§6.5 ARCHITECTURE).
// sens = sens de l'écart pour scoreNutri (docs/ENGINE.md §6.5, engine/domain/catalog.ts
// NutrientSense) : 'cible' pénalise des deux côtés, 'plancher' seulement en dessous (un excès de
// fer/fibres n'est jamais pénalisé), 'plafond' seulement au-dessus (moins de sodium n'est jamais
// pénalisé).
const NUTRIENTS = [
  { key: 'energie_kcal', id: 'energie', code: 'energie', nom: 'Énergie', unite: 'kcal', vnr_adulte: 2000, categorie: 'macronutriment', sens: 'cible' },
  { key: 'proteines_g', id: 'proteines', code: 'proteines', nom: 'Protéines', unite: 'g', vnr_adulte: 50, categorie: 'macronutriment', sens: 'cible' },
  { key: 'lipides_g', id: 'lipides', code: 'lipides', nom: 'Lipides', unite: 'g', vnr_adulte: 70, categorie: 'macronutriment', sens: 'cible' },
  { key: 'glucides_g', id: 'glucides', code: 'glucides', nom: 'Glucides', unite: 'g', vnr_adulte: 260, categorie: 'macronutriment', sens: 'cible' },
  { key: 'fibres_g', id: 'fibres', code: 'fibres', nom: 'Fibres alimentaires', unite: 'g', vnr_adulte: 25, categorie: 'macronutriment', sens: 'plancher' },
  { key: 'fer_mg', id: 'fer', code: 'fer', nom: 'Fer', unite: 'mg', vnr_adulte: 14, categorie: 'mineral', sens: 'plancher' },
  { key: 'calcium_mg', id: 'calcium', code: 'calcium', nom: 'Calcium', unite: 'mg', vnr_adulte: 800, categorie: 'mineral', sens: 'plancher' },
  { key: 'sodium_mg', id: 'sodium', code: 'sodium', nom: 'Sodium', unite: 'mg', vnr_adulte: 2000, categorie: 'mineral', sens: 'plafond' },
  { key: 'vitamine_c_mg', id: 'vitamine_c', code: 'vitamine_c', nom: 'Vitamine C', unite: 'mg', vnr_adulte: 80, categorie: 'vitamine', sens: 'plancher' },
]

// Les 14 allergènes réglementaires UE (règlement 1169/2011 annexe II).
const ALLERGENS = [
  { id: 'gluten', code: 'gluten', nom: 'Céréales contenant du gluten' },
  { id: 'crustaces', code: 'crustaces', nom: 'Crustacés' },
  { id: 'oeufs', code: 'oeufs', nom: 'Œufs' },
  { id: 'poissons', code: 'poissons', nom: 'Poissons' },
  { id: 'arachides', code: 'arachides', nom: 'Arachides' },
  { id: 'soja', code: 'soja', nom: 'Soja' },
  { id: 'lait', code: 'lait', nom: 'Lait' },
  { id: 'fruits_a_coque', code: 'fruits_a_coque', nom: 'Fruits à coque' },
  { id: 'celeri', code: 'celeri', nom: 'Céleri' },
  { id: 'moutarde', code: 'moutarde', nom: 'Moutarde' },
  { id: 'sesame', code: 'sesame', nom: 'Graines de sésame' },
  { id: 'sulfites', code: 'sulfites', nom: 'Anhydride sulfureux et sulfites' },
  { id: 'lupin', code: 'lupin', nom: 'Lupin' },
  { id: 'mollusques', code: 'mollusques', nom: 'Mollusques' },
]

// Lexique banni (docs/ARCHITECTURE.md §6.2) — deux familles, un seul test.
// Exporté : app/src/engine/guards/banned-terms.ts en garde une COPIE (engine/ ne peut pas importer
// ce fichier, §3 ENGINE) ; tests/banned-terms-consistency.test.mjs importe les deux listes depuis
// leurs sources respectives et échoue si elles divergent — voir l'en-tête de banned-terms.ts.
//
// ⚠️ CHAQUE ENTRÉE EST LE RADICAL LE PLUS COURT QUI COUVRE SA FAMILLE, et aucune n'est sous-chaîne
// d'une autre. L'appariement se fait par SOUS-CHAÎNE : allonger une entrée jusqu'à une forme
// conjuguée précise ne la rend pas plus stricte, elle rend la liste plus TROUÉE. Le détail du
// relevé du 2026-08-05 (« guérison », « guérissent », « guéri », « thérapeutique » passaient tous
// les quatre) est en tête de app/src/engine/guards/banned-terms.ts.
export const BANNED_TERMS = [
  // Famille thérapeutique (§6.1)
  'soigne', 'guéri', 'traite', 'prévient', 'remède', 'thérap',
  // Famille jugement (principe 6)
  'malsain', 'mauvais pour', 'à éviter', 'trop gras', 'cheat meal',
  'se rattraper', 'plaisir coupable', 'aliment sain',
]

// ----------------------------------------------------------------------------
// 3. Utilitaires
// ----------------------------------------------------------------------------

class BuildError extends Error {}

/** Normalise pour la comparaison : minuscules, accents retirés. */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
}

// Marques diacritiques combinantes Unicode (U+0300–U+036F) — retirées après
// normalisation NFD pour comparer le texte indépendamment des accents.
const COMBINING_DIACRITICS = /[̀-ͯ]/g

const NORMALIZED_BANNED = BANNED_TERMS.map((term) => ({ term, normalized: normalize(term) }))

/**
 * Cherche les termes bannis dans un champ texte de contenu.
 * Retourne la liste des termes trouvés (vide si rien).
 *
 * ⚠️ EXPORTÉE POUR ÊTRE COMPARÉE, pas pour être appelée d'ailleurs. `BANNED_TERMS` était seule
 * exportée et tests/banned-terms-consistency.test.mjs ne comparait donc que les LISTES — alors que
 * `normalize` et cette fonction-ci sont dupliquées elles aussi dans guards/banned-terms.ts. Une
 * divergence de normalisation entre les deux copies laissait le test parfaitement vert.
 */
export function findBannedTerms(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const normalized = normalize(text)
  return NORMALIZED_BANNED.filter(({ normalized: n }) => normalized.includes(n)).map((m) => m.term)
}

// --- Synonymes d'aliments : miroir de `engine/search/index.ts` -------------------------------
//
// ⚠️ DUPLICATION DÉLIBÉRÉE, ET SON RISQUE EST CONNU. `build.mjs` ne peut pas importer le TypeScript
// du moteur ; les mêmes règles de découpage sont donc réécrites ici, comme `normalize` l'est déjà
// vis-à-vis de `guards/banned-terms.ts`. Si les deux dérivent, un synonyme MORT passerait le build
// sans que rien ne le signale. Ce n'est pas un risque de sécurité — l'aliment garde ses allergènes,
// le garde-fou §5.2 n'est pas traversé — mais du bruit au catalogue. Toucher `motsDe` dans le
// moteur oblige à repasser ici.
const MOTS_VIDES_SYNONYME = new Set(['a', 'au', 'aux', 'd', 'de', 'des', 'du', 'en', 'et', 'l', 'la', 'le', 'les', 'un', 'une'])

/** Découpe en mots comparables — même règle que `motsDe` : normalisé, sans mots vides, singularisé. */
function motsDeTerme(texte) {
  return normalize(texte)
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 0 && !MOTS_VIDES_SYNONYME.has(mot))
    .map((mot) => (mot.length >= 4 && (mot.endsWith('s') || mot.endsWith('x')) ? mot.slice(0, -1) : mot))
}

/**
 * Un synonyme est MORT si le nom de son propre aliment le trouve déjà : `chercherParNom` apparie un
 * mot saisi dès qu'un mot du nom COMMENCE par lui, donc « steak » sur « Bœuf, steak cru » n'ajoute
 * rien. Généralise « identique au nom » — c'est le cas `steak` que la décision 58 demandait de
 * vérifier. « steak haché » sur « Bœuf, haché 5% MG cru » resterait valide : « steak » n'y est pas.
 */
function synonymeDejaCouvertParLeNom(terme, nom) {
  const motsDuTerme = motsDeTerme(terme)
  if (motsDuTerme.length === 0) return false
  const motsDuNom = motsDeTerme(nom)
  return motsDuTerme.every((mot) => motsDuNom.some((m) => m.startsWith(mot)))
}

async function readYamlFile(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return parseYaml(raw)
}

async function readYamlDir(dirPath) {
  if (!existsSync(dirPath)) return []
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
    .map((e) => path.join(dirPath, e.name))
    .sort()
  return Promise.all(files.map(readYamlFile))
}

// ----------------------------------------------------------------------------
// 4. Chargement des sources
// ----------------------------------------------------------------------------

/**
 * Cotes de confiance Ciqual, fichier GENERE par `import-ciqual.mjs --write-confiance` (decision 33).
 *
 * Absent = build sans cotes, pas une erreur : la source ANSES n'est pas versionnee (69 Mo) et un
 * poste qui ne l'a pas doit pouvoir construire le catalogue. Les colonnes valent alors NULL, et
 * l'ecran n'affiche simplement aucune provenance.
 */
async function loadConfiance() {
  const filePath = path.join(SOURCES_DIR, 'sources', 'ciqual-confiance.yaml')
  if (!existsSync(filePath)) return {}
  const data = await readYamlFile(filePath)
  return data?.confiance ?? {}
}

async function loadFoods() {
  const filePath = path.join(SOURCES_DIR, 'sources', 'foods.yaml')
  const data = await readYamlFile(filePath)
  return Array.isArray(data?.foods) ? data.foods : []
}

async function loadLexicon() {
  return readYamlDir(path.join(SOURCES_DIR, 'lexicon'))
}

async function loadRecipes() {
  return readYamlDir(path.join(SOURCES_DIR, 'recipes'))
}

async function loadTips() {
  return readYamlDir(path.join(SOURCES_DIR, 'tips'))
}

// Frontmatter YAML + corps Markdown. Le corps peut être vide, la validation s'en charge ensuite.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

/**
 * Fiches scientifiques — `catalog/evidence/*.md` (§8.2 ARCHITECTURE, §4.7 DESIGN).
 *
 * Markdown à frontmatter et non YAML pur comme le reste du catalogue : c'est ce que prévoit §9
 * ARCHITECTURE, et pour une raison pratique — le corps est un texte rédigé de plusieurs
 * paragraphes (`resume_vulgarise`) qui se relit et se corrige mal une fois noyé dans un champ YAML.
 *
 * `README.md` est le mode d'emploi du dossier, pas une fiche : il est écarté explicitement.
 */
async function loadEvidence() {
  const dirPath = path.join(SOURCES_DIR, 'evidence')
  if (!existsSync(dirPath)) return []
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => path.join(dirPath, e.name))
    .sort()

  return Promise.all(
    files.map(async (filePath) => {
      const fichier = path.basename(filePath)
      const raw = await readFile(filePath, 'utf8')
      const match = raw.match(FRONTMATTER)
      if (!match) throw new BuildError(`Fiche '${fichier}' : frontmatter absent ou mal fermé`)
      const frontmatter = parseYaml(match[1])
      if (frontmatter === null || typeof frontmatter !== 'object') {
        throw new BuildError(`Fiche '${fichier}' : frontmatter vide`)
      }
      return { ...frontmatter, fichier, resume_vulgarise: match[2].trim() }
    })
  )
}

// ----------------------------------------------------------------------------
// 5. Validation — collecte toutes les erreurs avant d'échouer (meilleur
//    diagnostic qu'un exit sur la première erreur trouvée).
// ----------------------------------------------------------------------------

// Les trois categories de §8.4 ARCHITECTURE. Fermee : une categorie inventee passerait sinon
// jusqu'a l'ecran, ou rien ne saurait la presenter.
const TIP_CATEGORIES = new Set(['biologie_aliment', 'nutrition_humaine', 'nutrition_animale'])

// Verification de FORME seulement : le build ne sait pas si l'URL repond, encore moins si elle dit
// ce que le tip pretend. Cela reste au redacteur (catalog/tips/README.md, regle de sourcage).
const URL_HTTP = /^https?:\/\/\S+$/

// Domaines autorises pour l'url d'une source de RECETTE (docs/SOURCES_RECETTES.md §6). Le projet
// refuse de reprendre le travail des blogs culinaires : sans cette liste, une source suffirait a
// faire entrer n'importe quel blog par la bande. Pour etendre, ajouter un suffixe de nom d'hote ici
// — jamais une URL complete, jamais un `includes` sur la chaine (voir isDomaineAutorise).
const DOMAINES_SOURCE_AUTORISES = [
  'gouv.fr', 'gov.uk', 'europa.eu', 'who.int', 'fao.org', 'canada.ca',
  'wikisource.org', 'wikibooks.org', 'wikimedia.org', 'wikipedia.org', 'archive.org',
  'cuisine-libre.org', 'anses.fr', 'inrae.fr', 'efsa.europa.eu', 'nih.gov', 'usda.gov', 'doi.org',
]

// Compare sur le NOM D'HOTE parse, pas sur la chaine complete : `https://evil.com/?x=gouv.fr` ne
// doit pas passer, et le suffixe doit matcher une frontiere de label (`gouv.fr` accepte
// `agriculture.gouv.fr` mais pas `notgouv.fr`).
//
// Rend le `hostname` deja parse plutot qu'un simple booleen : l'appelant en a besoin pour son
// message d'erreur, et reparser `url` avec un second `new URL` hors try/catch relancerait la
// meme exception que celle deja attrapee ici pour une URL malformee — voir l'appel plus bas.
function verifierDomaine(url) {
  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    return { ok: false, hostname: null }
  }
  const ok = DOMAINES_SOURCE_AUTORISES.some(
    (domaine) => hostname === domaine || hostname.endsWith(`.${domaine}`)
  )
  return { ok, hostname }
}

// Vocabulaires fermes des fiches scientifiques — CHECK correspondants en base.
// Les quatre niveaux de §5 DESIGN, les quatre familles de niveau 1 de §6.3, les cibles de §4.2.
const NIVEAUX_PREUVE = new Set(['forte', 'moderee', 'faible', 'preliminaire'])
const EVIDENCE_CATEGORIES = new Set(['nutriments', 'vitamines_mineraux', 'aliments', 'situations'])
const TYPES_ETUDE = new Set([
  'meta_analyse', 'revue_systematique', 'essai_randomise', 'cohorte',
  'rapport_autorite', 'commentaire_critique',
])
const CIBLE_TYPES = new Set(['food', 'nutrient', 'health_topic'])
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/
const DOI_PREFIXE = /^10\.\d{4,9}\//

// Les cuisines du catalogue. Ferme comme les autres vocabulaires, et pour la meme raison qu'eux :
// jusqu'ici seul le NOM de la facette etait verifie, jamais sa valeur — `italienen` serait entre en
// base sans un mot.
//
// ⚠️ L'ECHEC AURAIT ETE SILENCIEUX, ET A DEUX ENDROITS. Une valeur inconnue produit une pastille de
// filtre de plus a l'ecran Recettes (elles sont derivees du catalogue, pas d'une liste), pastille
// qui ne rendrait qu'une recette ; et `ui/drapeaux.ts` ne la trouvant pas dans sa table, elle
// s'afficherait sans drapeau — exactement comme les 7 zones qui n'en ont volontairement pas. Rien
// n'aurait distingue la faute de frappe du choix editorial.
//
// Ajouter une cuisine est donc un geste DELIBERE : une valeur ici, et un drapeau dans
// `ui/drapeaux.ts` si — et seulement si — elle designe un pays.
// Les deux types de source d'une recette — voir le commentaire de CREATE TABLE recipe_source.
// `provenance` revendique une origine, `reference` n'en revendique aucune. Ferme : un troisieme
// type inventé rendrait la distinction illisible, or c'est elle qui empeche le mensonge.
const SOURCE_TYPES = new Set(['provenance', 'reference'])

// D'ou vient le TEXTE de la recette (pas les valeurs nutritionnelles, qui viennent toujours de
// CIQUAL) — distinct de `SOURCE_TYPES` qui dit pourquoi une source est citee. Ferme, meme raison
// que SOURCE_TYPES : une valeur inventee laisserait croire a une provenance qui n'existe pas.
const RECIPE_ORIGINES = new Set(['maison', 'domaine_public', 'libre'])

// Ce qu'une etape EST, pas ce qu'elle dit (docs/CONCEPTION_MODE_CUISINE.md §3). Un avertissement
// sanitaire occupe une ligne d'etape sans etre un geste : le mode cuisine annoncerait « 6 sur 6 »
// et promettrait une action alors que le plat est deja servi. Absent = 'geste', qui est le cas des
// 223 recettes qui n'en portent pas — l'omission n'est donc pas une erreur.
const STEP_NATURES = new Set(['geste', 'avertissement'])

const CUISINES = new Set([
  'francaise', 'provencale', 'bretonne', 'italienne', 'espagnole', 'portugaise', 'grecque',
  'britannique', 'belge', 'suisse', 'scandinave', 'hongroise', 'turque',
  'maghrebine', 'libanaise', 'africaine',
  'indienne', 'chinoise', 'japonaise', 'vietnamienne', 'thai', 'asiatique',
  'mexicaine', 'tex_mex',
  'mediterraneenne', 'internationale',
])

/**
 * Valide les fiches scientifiques (§8.2 ARCHITECTURE).
 *
 * ⚠️ CE BLOC EST UN GARDE-FOU DE SECURITE, pas une commodite. Une fiche porte des affirmations de
 * sante : §4.2 fait de `evidence_sheet_id NOT NULL` sur un critere une contrainte structurelle, et
 * le meme raisonnement s'applique ici — une position qui ne cite aucune source, ou qui cite une
 * source inexistante, ne doit PAS pouvoir atteindre l'ecran. Le build echoue plutot que d'afficher
 * une affirmation non sourcee.
 */
function validateEvidence(evidence, foodIds, nutrientIds) {
  const errors = []
  const codes = new Set()

  for (const fiche of evidence) {
    const nom = fiche.fichier ?? fiche.code ?? '(fichier inconnu)'
    const err = (msg) => errors.push(`Fiche '${nom}' : ${msg}`)

    // Le code EST le nom du fichier : c'est ce qui rend une fiche retrouvable depuis un message
    // d'erreur, et ce qui empeche deux fiches de partager une cle en base.
    if (!fiche.code) err('code manquant')
    else {
      if (fiche.fichier && fiche.code !== path.basename(fiche.fichier, '.md')) {
        err(`code '${fiche.code}' different du nom de fichier`)
      }
      if (codes.has(fiche.code)) err(`code en double : '${fiche.code}'`)
      codes.add(fiche.code)
    }

    // §4.7 : « chapitre = titre-question ». Un titre affirmatif annoncerait une conclusion avant de
    // l'avoir exposee, ce qui est precisement la posture que le produit refuse.
    if (!fiche.titre) err('titre manquant')
    else if (!fiche.titre.includes('?')) err(`le titre n'est pas une question : « ${fiche.titre} »`)

    if (!EVIDENCE_CATEGORIES.has(fiche.categorie)) err(`categorie '${fiche.categorie}' inconnue (§6.3)`)
    if (!NIVEAUX_PREUVE.has(fiche.niveau_preuve)) err(`niveau_preuve '${fiche.niveau_preuve}' inconnu (§5 DESIGN)`)
    if (!DATE_ISO.test(String(fiche.date_revue ?? ''))) err(`date_revue '${fiche.date_revue}' n'est pas au format AAAA-MM-JJ`)
    if (!fiche.resume_vulgarise) err('corps vide (resume_vulgarise)')

    const sourceCodes = new Set()
    for (const source of fiche.sources ?? []) {
      if (!source?.id) { err('source sans id'); continue }
      if (sourceCodes.has(source.id)) err(`source en double : '${source.id}'`)
      sourceCodes.add(source.id)
      if (!source.titre_etude) err(`source '${source.id}' : titre_etude manquant`)
      if (typeof source.annee !== 'number') err(`source '${source.id}' : annee absente ou non numerique`)
      if (!source.revue) err(`source '${source.id}' : revue manquante`)
      if (!source.url) err(`source '${source.id}' : url manquante`)
      if (!TYPES_ETUDE.has(source.type_etude)) err(`source '${source.id}' : type_etude '${source.type_etude}' inconnu`)
      // Regle 5 du README : la date de consultation est ce qui distingue un lien verifie d'un lien
      // recopie. Sans elle, on ne sait pas si la reference a jamais ete ouverte.
      if (!DATE_ISO.test(String(source.consulte_le ?? ''))) {
        err(`source '${source.id}' : consulte_le absente ou mal formee`)
      }
      if (source.doi && !DOI_PREFIXE.test(source.doi)) err(`source '${source.id}' : DOI mal forme — '${source.doi}'`)
    }
    if (sourceCodes.size === 0) err('aucune source')

    const citees = new Set()
    if ((fiche.positions ?? []).length === 0) err('aucune position')
    for (const position of fiche.positions ?? []) {
      if (!position?.id) { err('position sans id'); continue }
      if (!NIVEAUX_PREUVE.has(position.niveau_preuve)) {
        err(`position '${position.id}' : niveau_preuve '${position.niveau_preuve}' inconnu`)
      }
      // porte_par obligatoire : une affirmation de sante sans son auteur redevient une parole de
      // l'application, ce que §6.1 interdit.
      if (!position.porte_par) err(`position '${position.id}' : porte_par manquant`)
      if (!position.affirmation) err(`position '${position.id}' : affirmation manquante`)
      if (!position.detail) err(`position '${position.id}' : detail manquant`)
      if ((position.sources ?? []).length === 0) {
        err(`position '${position.id}' : aucune source — une affirmation non sourcee ne peut pas etre publiee`)
      }
      for (const ref of position.sources ?? []) {
        if (!sourceCodes.has(ref)) err(`position '${position.id}' cite une source inconnue : '${ref}'`)
        citees.add(ref)
      }
    }
    for (const code of sourceCodes) {
      if (!citees.has(code)) err(`source '${code}' declaree mais citee par aucune position`)
    }

    for (const lien of fiche.liens ?? []) {
      if (!CIBLE_TYPES.has(lien?.cible_type)) { err(`lien : cible_type '${lien?.cible_type}' inconnu`); continue }
      if (lien.cible_type === 'nutrient' && !nutrientIds.has(lien.cible_id)) {
        err(`lien : nutriment '${lien.cible_id}' absent du referentiel`)
      }
      if (lien.cible_type === 'food' && !foodIds.has(lien.cible_id)) {
        err(`lien : aliment '${lien.cible_id}' absent du catalogue`)
      }
      // `health_topic` est un cible_type legitime de §4.2, mais la table n'existe pas : un lien qui
      // la vise ne pourrait etre resolu par personne. Refuse tant que les chapitres n'existent pas.
      if (lien.cible_type === 'health_topic') {
        err(`lien : aucun health_topic n'existe encore ('${lien.cible_id}')`)
      }
    }

    // Lint de vocabulaire §6.2 sur TOUT ce qui sera affiche — le corps et chaque position comprises.
    const affiches = [fiche.titre, fiche.resume_vulgarise]
    for (const p of fiche.positions ?? []) affiches.push(p?.affirmation, p?.detail, p?.porte_par)
    for (const texte of affiches) {
      const bannis = findBannedTerms(String(texte ?? ''))
      if (bannis.length > 0) err(`vocabulaire banni (${bannis.join(', ')}) dans « ${String(texte).slice(0, 60)}… »`)
    }
  }

  return errors
}

/**
 * §8.2 regle 4 : « Une fiche de plus de 3 ans est signalee comme a reviser. »
 *
 * AVERTISSEMENT et non erreur : une fiche qui vieillit reste vraie jusqu'a preuve du contraire, et
 * faire echouer le build au passage d'une date rendrait le depot incompilable sans qu'une ligne ait
 * change. Le but est de rappeler la relecture, pas de bloquer.
 */
function evidenceWarnings(evidence, maintenant) {
  const TROIS_ANS_MS = 3 * 365.25 * 24 * 3600 * 1000
  const warnings = []
  for (const fiche of evidence) {
    if (!DATE_ISO.test(String(fiche.date_revue ?? ''))) continue
    const age = maintenant - new Date(fiche.date_revue).getTime()
    if (age > TROIS_ANS_MS) {
      warnings.push(`Fiche '${fiche.code}' : revue le ${fiche.date_revue}, soit il y a plus de 3 ans — a reviser (§8.2)`)
    }
    for (const source of fiche.sources ?? []) {
      // auteurs a null = non verifies (voir EvidenceSource dans engine/domain/catalog.ts).
      if (source?.auteurs === null) {
        warnings.push(`Fiche '${fiche.code}' : source '${source.id}' sans auteurs verifies`)
      }
    }
  }
  return warnings
}

function validateCatalog({ foods, lexicon, recipes, tips, evidence }) {
  const errors = []
  const nutrientKeys = new Set(NUTRIENTS.map((n) => n.key))
  const allergenCodes = new Set(ALLERGENS.map((a) => a.code))

  // --- Aliments ---
  const foodIds = new Set()
  // Quel aliment revendique déjà quel synonyme — un terme, un seul aliment (voir plus bas).
  const proprietaireDuSynonyme = new Map()
  for (const food of foods) {
    if (!food?.id) {
      errors.push(`Aliment sans id : ${JSON.stringify(food)}`)
      continue
    }
    if (foodIds.has(food.id)) errors.push(`Aliment en double : id '${food.id}'`)
    foodIds.add(food.id)

    for (const key of Object.keys(food.nutriments ?? {})) {
      if (!nutrientKeys.has(key)) {
        errors.push(`Aliment '${food.id}' : nutriment inconnu '${key}'`)
      }
    }
    for (const allergene of food.allergenes ?? []) {
      if (!allergenCodes.has(allergene.code)) {
        errors.push(`Aliment '${food.id}' : allergène inconnu '${allergene.code}'`)
      }
      if (!['contient', 'traces'].includes(allergene.certitude)) {
        errors.push(`Aliment '${food.id}' : certitude d'allergène invalide '${allergene.certitude}'`)
      }
    }

    // Synonymes — noms d'usage du MÊME aliment (décision 58, cause 2).
    //
    // ⚠️ LE REFUS « foodId INEXISTANT » N'EST PAS ÉCRIT, PARCE QU'IL EST INEXPRIMABLE. Le synonyme
    // vit SUR l'aliment (`synonymes:` dans son entrée YAML), pas dans une table d'associations à
    // côté : il n'y a pas de `food_id` à se tromper. Même geste que `requiredFoodIds` placé dans
    // `MealContext` plutôt que dans `HardConstraints` — la garantie vient de la forme, pas d'un
    // contrôle. La clé étrangère de `food_synonym` la redouble en base.
    for (const terme of food.synonymes ?? []) {
      if (typeof terme !== 'string' || terme.trim().length === 0) {
        errors.push(`Aliment '${food.id}' : synonyme vide ou non textuel (${JSON.stringify(terme)})`)
        continue
      }
      // 1. Entrée morte : le nom de l'aliment le trouve déjà, le synonyme n'ajoute rien.
      if (synonymeDejaCouvertParLeNom(terme, food.nom ?? '')) {
        errors.push(
          `Aliment '${food.id}' : synonyme '${terme}' déjà couvert par son propre nom '${food.nom}' — entrée morte`
        )
      }
      // 2. Doublon : deux aliments qui revendiquent le même mot rendent la recherche
      //    indépartageable, et l'utilisateur reçoit l'un des deux sans savoir pourquoi. REFUS sec
      //    plutôt qu'un départage arbitraire — si le mot désigne vraiment deux produits, c'est
      //    qu'il faut le préciser des deux côtés (« steak de bœuf », « steak de thon »).
      const cle = motsDeTerme(terme).join(' ')
      const deja = proprietaireDuSynonyme.get(cle)
      if (deja !== undefined && deja !== food.id) {
        errors.push(`Synonyme '${terme}' revendiqué par deux aliments : '${deja}' et '${food.id}'`)
      } else {
        proprietaireDuSynonyme.set(cle, food.id)
      }
    }

    // Saisonnalité (P1b-1, docs/ARCHITECTURE.md §4.2, docs/ENGINE.md §6.5 précision 3).
    // Ni `saison_mois` ni `toute_annee` renseignés n'est PAS une erreur : défaut neutre
    // ([] / false), traité comme « saisonnalité non renseignée » par la couche `season`.
    const saisonMois = food.saison_mois ?? []
    for (const mois of saisonMois) {
      if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
        errors.push(`Aliment '${food.id}' : mois de saison_mois invalide '${mois}' (doit être un entier de 1 à 12)`)
      }
    }
    // `toute_annee` et `saison_mois` sont DEUX DIMENSIONS INDÉPENDANTES, pas un choix
    // exclusif : `toute_annee` dit la DISPONIBILITÉ (rayon, conservation), `saison_mois` dit
    // la PLEINE SAISON (goût, production locale). Une carotte est les deux à la fois — dispo
    // toute l'année ET de pleine saison de septembre à avril. Les cumuler est donc valide et
    // attendu ; c'est la couche `season` qui les combine en crédits (voir
    // engine/selection/scoring/season.ts). Un aliment SANS `saison_mois` est un staple au sens
    // de docs/ENGINE.md §6.5 précision 3 : exclu du calcul de saison.
  }

  // --- Origine animale : le champ doit être REMPLI partout où un allergène le prouve ---
  //
  // ⛔ DÉFAUT TROUVÉ LE 2026-08-06, SUR LA COUCHE 🔒 CRITIQUE `regime`. Dix aliments — dont
  // `nuoc_mam` (sauce de POISSON), `lait_ecreme`, `mayonnaise`, `pesto`, `ossau_iraty` — n'avaient
  // ni `origine_animale` ni `derive_de`. `resolveAnimalOrigin` rendait donc `null` et
  // `regimeExigePar` les déclarait VÉGÉTALIENS. Aucune recette du catalogue ne les employait, mais
  // `regimeExigeParIngredients` est du code de PRODUCTION pour les recettes composées par
  // l'utilisateur (voir l'en-tête de engine/selection/regime.ts) : un plat au nuoc-mâm aurait été
  // proposé à un végétalien.
  //
  // ⚠️ POURQUOI AUCUN TEST NE POUVAIT LE VOIR, et c'est la vraie leçon.
  // `tests/regime-coherence.test.ts` confronte l'étiquette écrite à la main à `regimeExigePar` —
  // qui lit LE MÊME champ manquant. Quand l'origine est absente, les deux côtés répondent
  // « vegetalien » et le test reste vert. Un oracle qui partage la donnée du sujet qu'il vérifie
  // ne vérifie rien. C'est le défaut signature du projet (« un champ déclaré n'est pas un champ
  // rempli ») transposé à l'ORACLE.
  //
  // La règle ci-dessous ne partage pas cette donnée : elle confronte l'origine à l'ALLERGÈNE, qui
  // est écrit indépendamment. `certitude` fait le départ, et c'est elle qui rend la règle sûre
  // sans liste d'exemptions : les algues (`nori`, `wakame`) déclarent `crustaces` en TRACES —
  // contamination à la récolte, pas un ingrédient — et restent végétaliennes, tout comme
  // `chocolat_noir` avec ses traces de lait. Une exemption écrite à la main aurait pourri ; la
  // certitude, elle, est déjà relue pour d'autres raisons.
  const ALLERGENES_STRICTEMENT_ANIMAUX = new Set(['lait', 'oeufs', 'poissons', 'crustaces', 'mollusques'])
  const foodsParId = new Map(foods.filter((f) => f?.id).map((f) => [f.id, f]))
  /** Miroir de `resolveAnimalOrigin` (engine/domain/) : remonte la chaîne `derive_de`. */
  const origineAnimaleResolue = (food, vus = new Set()) => {
    if (!food || vus.has(food.id)) return null
    vus.add(food.id)
    if (food.origine_animale) return food.origine_animale
    if (food.derive_de) return origineAnimaleResolue(foodsParId.get(food.derive_de), vus)
    return null
  }
  for (const food of foods) {
    if (!food?.id) continue
    if (origineAnimaleResolue(food) !== null) continue
    for (const allergene of food.allergenes ?? []) {
      if (!ALLERGENES_STRICTEMENT_ANIMAUX.has(allergene.code)) continue
      if (allergene.certitude !== 'contient') continue
      errors.push(
        `Aliment '${food.id}' : contient l'allergène '${allergene.code}', d'origine strictement ` +
          'animale, mais aucune origine ne se résout — ni `origine_animale`, ni la chaîne ' +
          '`derive_de`. La couche `regime` le déclarerait VÉGÉTALIEN (docs/ARCHITECTURE.md §5.2)'
      )
    }
  }

  // --- Lexique ---
  const lexiconCodes = new Set()
  for (const entry of lexicon) {
    if (!entry?.code) {
      errors.push(`Entrée de lexique sans code : ${JSON.stringify(entry)}`)
      continue
    }
    if (lexiconCodes.has(entry.code)) errors.push(`Entrée de lexique en double : code '${entry.code}'`)
    lexiconCodes.add(entry.code)

    for (const field of [entry.terme, entry.definition]) {
      const hits = findBannedTerms(field)
      if (hits.length > 0) {
        errors.push(`Lexique '${entry.code}' : vocabulaire banni détecté (${hits.join(', ')})`)
      }
    }
  }

  // --- Recettes ---
  const recipeIds = new Set()
  for (const recipe of recipes) {
    if (!recipe?.id) {
      errors.push(`Recette sans id : ${JSON.stringify(recipe)}`)
      continue
    }
    if (recipeIds.has(recipe.id)) errors.push(`Recette en double : id '${recipe.id}'`)
    recipeIds.add(recipe.id)

    // origine dit d'ou vient le TEXTE de la recette — obligatoire, vocabulaire ferme (docs/SOURCES_RECETTES.md).
    if (!RECIPE_ORIGINES.has(recipe.origine)) {
      errors.push(`Recette '${recipe.id}' : origine '${recipe.origine}' inconnue (attendu : maison | domaine_public | libre)`)
    }

    for (const field of [recipe.nom, recipe.description]) {
      const hits = findBannedTerms(field)
      if (hits.length > 0) {
        errors.push(`Recette '${recipe.id}' : vocabulaire banni détecté (${hits.join(', ')})`)
      }
    }

    for (const ingredient of recipe.ingredients ?? []) {
      if (!foodIds.has(ingredient.food_id)) {
        errors.push(`Recette '${recipe.id}' : aliment inconnu '${ingredient.food_id}'`)
      }
    }

    const etapes = recipe.etapes ?? []
    // Les ingrédients de CETTE recette : le seul ensemble dans lequel une étape a le droit de puiser.
    const ingredientsDeLaRecette = new Set((recipe.ingredients ?? []).map((i) => i.food_id))
    for (const etape of etapes) {
      const hits = findBannedTerms(etape.texte)
      if (hits.length > 0) {
        errors.push(`Recette '${recipe.id}', étape ${etape.ordre} : vocabulaire banni détecté (${hits.join(', ')})`)
      }
      for (const code of etape.lexicon_ids ?? []) {
        if (!lexiconCodes.has(code)) {
          errors.push(`Recette '${recipe.id}', étape ${etape.ordre} : geste de lexique inconnu '${code}'`)
        }
      }
      // ⚠️ `food_ids` EST FACULTATIF ET LE RESTERA. Il ne sert qu'à corriger la dérivation là où elle
      // se trompe (~6 % des gestes) ; l'exiger partout remettrait la corvée de 1 350 annotations que
      // la dérivation existe précisément pour supprimer. Voir décision 60 d'ETAT.md §4.
      //
      // Deux règles quand il EST écrit, et c'est la seconde qui compte : elle garantit qu'une
      // quantité est TOUJOURS résolvable depuis l'étape. Sans elle, l'écran pourrait citer un
      // aliment dont il n'a ni `unite_affichage` ni `quantite_g`.
      if (etape.food_ids !== undefined && !Array.isArray(etape.food_ids)) {
        errors.push(`Recette '${recipe.id}', étape ${etape.ordre} : 'food_ids' doit être une liste`)
      }
      for (const foodId of Array.isArray(etape.food_ids) ? etape.food_ids : []) {
        if (!foodIds.has(foodId)) {
          errors.push(`Recette '${recipe.id}', étape ${etape.ordre} : aliment inconnu '${foodId}' dans food_ids`)
        } else if (!ingredientsDeLaRecette.has(foodId)) {
          errors.push(
            `Recette '${recipe.id}', étape ${etape.ordre} : '${foodId}' n'est pas un ingrédient de cette recette`
          )
        }
      }
      if (!STEP_NATURES.has(etape.nature ?? 'geste')) {
        errors.push(
          `Recette '${recipe.id}', étape ${etape.ordre} : nature '${etape.nature}' inconnue (attendu : geste | avertissement)`
        )
      }
    }

    // Un avertissement AILLEURS QU'EN DERNIERE POSITION casserait le compteur du mode cuisine, qui
    // annonce « N etapes » en ne comptant que les gestes, puis affiche l'avertissement une fois la
    // derniere faite. La regle est verifiee sur la POSITION, pas sur `ordre` : elle tient meme si
    // une recette numerote ses etapes autrement.
    const premierAvertissement = etapes.findIndex((e) => e?.nature === 'avertissement')
    if (premierAvertissement !== -1 && premierAvertissement !== etapes.length - 1) {
      errors.push(
        `Recette '${recipe.id}', étape ${etapes[premierAvertissement].ordre} : un avertissement doit être la DERNIÈRE étape (docs/CONCEPTION_MODE_CUISINE.md §3)`
      )
    }

    for (const facette of recipe.facettes ?? []) {
      if (!['cuisine', 'regime', 'occasion', 'style'].includes(facette.facette)) {
        errors.push(`Recette '${recipe.id}' : facette inconnue '${facette.facette}'`)
      }
      if (facette.facette === 'cuisine' && !CUISINES.has(facette.valeur)) {
        errors.push(`Recette '${recipe.id}' : cuisine inconnue '${facette.valeur}'`)
      }
    }

    // Sources — bloc OPTIONNEL (absent = recette non verifiee, cas des 241 du catalogue), mais
    // COMPLET des qu'il est present. Une source a demi renseignee est pire que pas de source : elle
    // a l'air d'une garantie et n'en est pas une.
    const urlsVues = new Set()
    let aUneProvenance = false
    for (const source of recipe.sources ?? []) {
      const ou = `Recette '${recipe.id}', source '${source?.titre ?? source?.url ?? '?'}'`
      if (!SOURCE_TYPES.has(source?.type)) {
        errors.push(`${ou} : type '${source?.type}' inconnu (attendu : provenance | reference)`)
      }
      if (source?.type === 'provenance') aUneProvenance = true
      if (!source?.titre || String(source.titre).trim() === '') errors.push(`${ou} : titre vide`)
      if (!URL_HTTP.test(String(source?.url ?? ''))) {
        errors.push(`${ou} : url absente ou non http(s)`)
      } else {
        if (urlsVues.has(source.url)) errors.push(`${ou} : url en double sur la meme recette`)
        else urlsVues.add(source.url)
        // Liste blanche §6 : le projet refuse de reprendre le travail des blogs culinaires.
        const domaine = verifierDomaine(source.url)
        if (!domaine.ok) {
          const nomHote = domaine.hostname ?? `URL non analysable ('${source.url}')`
          errors.push(
            `${ou} : domaine '${nomHote}' hors liste blanche — les blogs ` +
              'culinaires ne sont pas acceptes comme source (docs/SOURCES_RECETTES.md §6)'
          )
        }
      }
      if (!DATE_ISO.test(String(source?.consulte_le ?? ''))) {
        errors.push(`${ou} : consulte_le absente ou hors format AAAA-MM-JJ`)
      }
      // Une PROVENANCE emprunte le travail de quelqu'un : sans licence ni auteur, le credit est
      // inaffichable et la reutilisation n'est pas couverte. Une REFERENCE n'emprunte rien.
      if (source?.type === 'provenance') {
        if (!source?.licence) errors.push(`${ou} : provenance sans licence`)
        if (!source?.auteur) errors.push(`${ou} : provenance sans auteur`)
      }
    }

    // Coherence origine <-> sources : `maison` contredit une `provenance` (le texte ne peut pas
    // etre a la fois ecrit ici et venir d'ailleurs) ; `domaine_public`/`libre` exige au moins une
    // `provenance` (sinon rien ne justifie l'origine annoncee).
    if (recipe.origine === 'maison' && aUneProvenance) {
      errors.push(`Recette '${recipe.id}' : origine 'maison' ne peut pas porter de source 'provenance'`)
    }
    if ((recipe.origine === 'domaine_public' || recipe.origine === 'libre') && !aUneProvenance) {
      errors.push(`Recette '${recipe.id}' : origine '${recipe.origine}' exige au moins une source 'provenance'`)
    }

    if (recipe.teste_le !== undefined && recipe.teste_le !== null && !DATE_ISO.test(String(recipe.teste_le))) {
      errors.push(`Recette '${recipe.id}' : teste_le hors format AAAA-MM-JJ`)
    }
  }

  const tipCodes = new Set()
  for (const tip of tips) {
    if (!tip?.code) errors.push('Tip sans code')
    else if (tipCodes.has(tip.code)) errors.push(`Tip en double : code '${tip.code}'`)
    else tipCodes.add(tip.code)

    if (!TIP_CATEGORIES.has(tip?.categorie)) {
      errors.push(`Tip '${tip?.code}' : categorie '${tip?.categorie}' inconnue (§8.4)`)
    }
    if (!tip?.texte || String(tip.texte).trim() === '') {
      errors.push(`Tip '${tip?.code}' : texte vide`)
    }
    // Source OBLIGATOIRE (§4.2 : `tip(id, texte, categorie, source_url)`). Le fait qu'un tip soit
    // court ne le dispense pas d'etre verifiable — c'est meme l'inverse : une phrase isolee et
    // affirmative est ce qui se recopie le plus vite.
    if (!tip?.source_url || String(tip.source_url).trim() === '') {
      errors.push(`Tip '${tip?.code}' : source_url manquante`)
    } else if (!URL_HTTP.test(String(tip.source_url).trim())) {
      errors.push(`Tip '${tip?.code}' : source_url doit etre une URL http(s) ('${tip.source_url}')`)
    }
    // Le lint de vocabulaire (§6.2) s'applique au TEXTE des tips comme au reste du contenu :
    // un tip est affiche tel quel a l'utilisateur.
    const bannis = findBannedTerms(String(tip?.texte ?? ''))
    if (bannis.length > 0) {
      errors.push(`Tip '${tip?.code}' : vocabulaire banni (${bannis.join(', ')})`)
    }
  }

  errors.push(...validateEvidence(evidence ?? [], foodIds, new Set(NUTRIENTS.map((n) => n.id))))

  return errors
}

// ----------------------------------------------------------------------------
// 6. Construction de la base SQLite
// ----------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE nutrient (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  unite TEXT NOT NULL,
  vnr_adulte REAL,
  categorie TEXT,
  sens TEXT NOT NULL CHECK (sens IN ('cible', 'plancher', 'plafond'))
);

CREATE TABLE food (
  id TEXT PRIMARY KEY,
  code_ciqual TEXT NOT NULL,
  nom TEXT NOT NULL,
  groupe TEXT NOT NULL,
  -- Sous-famille facultative : regroupe plusieurs aliments qui sont le MEME produit de base
  -- (poulet_blanc + poulet_cuisse -> 'poulet'). NULL quand l'aliment est seul de son espece au
  -- catalogue, ce qui est le cas de la tres grande majorite. Sert a la recence de variety/habit
  -- (section 6.6 quater ENGINE) : sans elle, deux plats de poulet employant deux morceaux
  -- differents ne se rendent pas repetitifs. Ne PAS confondre avec groupe, trop large
  -- ('viandes' melange boeuf, poulet, porc et agneau).
  sous_famille TEXT,
  saison_mois TEXT NOT NULL,
  toute_annee INTEGER NOT NULL DEFAULT 0,
  -- piquant de l'ALIMENT lui-meme, 0 a 4. NULL = non renseigne. Le piquant d'une recette n'en est
  --   PAS la somme : voir recipe.piquant.
  piquant INTEGER CHECK (piquant BETWEEN 0 AND 4),
  -- conditionnement_g : taille du paquet de vente (plaquette 250 g, brique 1000 g, oeuf 60 g).
  --   NULL = vendu au poids. On achete ceil(besoin / conditionnement) paquets — 240 g d'un besoin
  --   donnent une plaquette de 250 g, 260 g en donnent deux. TOUJOURS au-dessus (§7.4 ENGINE).
  -- poids_piece_g : poids MOYEN d'une piece (carotte 120 g, oeuf 60 g). NULL = ne se compte pas a
  --   la piece. PRIME sur conditionnement_g : « 3 carottes » est plus utile que « 350 g ».
  --   Un seul poids, pas petit/moyen/gros : l'utilisateur ne sait pas quelle taille il trouvera.
  poids_piece_g INTEGER CHECK (poids_piece_g > 0),
  -- fond_de_placard : sel, poivre, epices seches. Ecarte de la liste de courses PAR DEFAUT — on ne
  --   les rachete pas chaque semaine, et les lister noierait les vraies lignes.
  fond_de_placard INTEGER NOT NULL DEFAULT 0,
  conditionnement_g INTEGER CHECK (conditionnement_g > 0),
  -- origine_animale : de quel animal l'aliment provient. FACTUEL, pas un regime — la chaine
  --   DIET_CHAIN en deduit ce qu'elle veut, un futur filtre halal/casher lira le meme champ.
  --   NULL = vegetal, mineral, OU derive (l'origine se lit alors sur derive_de).
  origine_animale TEXT CHECK (origine_animale IN ('mammifere','volaille','poisson','fruit_de_mer','insecte')),
  -- derive_de : aliment dont celui-ci est tire (beurre_doux -> lait_entier). L'origine animale se
  --   PROPAGE le long de cette chaine. C'est ce champ qui rattrape les derives que groupe laisse
  --   passer : le beurre est en « matieres grasses », le miel en « produits sucres ».
  -- DEFERRABLE : un derive peut apparaitre AVANT sa source dans foods.yaml (beurre_doux precede
  --   lait_entier). La verification est donc reportee au COMMIT, ou toutes les lignes existent.
  derive_de TEXT REFERENCES food(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE food_nutrient (
  food_id TEXT NOT NULL REFERENCES food(id),
  nutrient_id TEXT NOT NULL REFERENCES nutrient(id),
  valeur_pour_100g REAL NOT NULL,
  -- Cote de confiance ANSES de CETTE valeur (decision 33, 2026-08-05). A = dosee, source francaise
  -- identifiee ; D = calculee, imputee ou empruntee a une table etrangere. NULL = l'ANSES n'en donne
  -- pas, ou l'aliment n'est pas apparie a Ciqual (une recette perso, un aliment ajoute a la main).
  -- ⛔ NE PONDERE AUCUN SCORE, et ce n'est pas un oubli : la decision 33 a ecarte cette piste. Sert
  --    la tracabilite affichee (dire d'ou vient un chiffre), jamais a declasser un aliment.
  code_confiance TEXT CHECK (code_confiance IS NULL OR code_confiance IN ('A','B','C','D')),
  PRIMARY KEY (food_id, nutrient_id)
);

CREATE TABLE allergen (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL
);

CREATE TABLE food_allergen (
  food_id TEXT NOT NULL REFERENCES food(id),
  allergen_id TEXT NOT NULL REFERENCES allergen(id),
  certitude TEXT NOT NULL CHECK (certitude IN ('contient', 'traces')),
  PRIMARY KEY (food_id, allergen_id)
);

-- Noms d'usage supplementaires d'un aliment : « lardon » -> porc_poitrine (decision 58, cause 2).
--
-- ⚠️ CE N'EST NI UN ALIMENT NI UNE SUBSTITUTION. Un synonyme ne porte ni code CIQUAL, ni
-- nutriment, ni allergene : il NOMME une ligne de food qui existe deja et garde les siens. Dire
-- « lardon » ne dit pas « remplace le porc par autre chose », ca dit « c'est le meme produit ».
-- Une equivalence entre deux aliments differents est un tout autre objet — table substitution.
CREATE TABLE food_synonym (
  food_id TEXT NOT NULL REFERENCES food(id),
  terme TEXT NOT NULL,
  PRIMARY KEY (food_id, terme)
);

CREATE TABLE recipe (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  -- origine : d'ou vient le TEXTE de la recette — pas de rapport avec les valeurs nutritionnelles
  --   (toujours CIQUAL). 'maison' = ecrite pour ce projet (241/241 aujourd'hui) ; 'domaine_public'
  --   et 'libre' exigent une source 'provenance' dans recipe_source, cf CHECK applique au build.
  origine TEXT NOT NULL CHECK (origine IN ('maison', 'domaine_public', 'libre')),
  description TEXT NOT NULL,
  temps_prep_min INTEGER NOT NULL,
  temps_cuisson_min INTEGER NOT NULL,
  difficulte INTEGER NOT NULL CHECK (difficulte IN (1, 2, 3)),
  portions_base INTEGER NOT NULL,
  image_path TEXT,
  -- teste_le : date ISO a laquelle la recette a ete REELLEMENT cuisinee et le resultat juge.
  --   NULL = jamais testee, ce qui est le cas des 241 recettes du catalogue. Jamais une date
  --   approchee : c'est le champ qui porte la confiance, une date inventee la detruit.
  teste_le TEXT,
  types_repas TEXT NOT NULL,
  saison_mois TEXT NOT NULL,
  envergure TEXT NOT NULL CHECK (envergure IN ('quotidien', 'convivial', 'fete')),
  conservation_jours INTEGER NOT NULL,
  axe_sucre_sale REAL NOT NULL,
  axe_leger_consistant REAL NOT NULL,
  axe_chaud_froid REAL NOT NULL,
  axe_texture TEXT NOT NULL,
  -- service : TYPE DE RECETTE (entree/plat/accompagnement/fromage/dessert), axe ORTHOGONAL a
  --   types_repas qui dit QUAND. Une puree est un accompagnement servi au dejeuner ET au diner ;
  --   les deux dimensions se cumulent. Ordre de service francais : le fromage precede le dessert.
  --   NULLABLE le temps de l'annotation. Voir docs/ENGINE.md et domain/catalog.ts CourseKind.
  service TEXT CHECK (service IN ('entree', 'plat', 'accompagnement', 'fromage', 'dessert')),
  -- piquant : 0 pas piquant, 1 un peu, 2 moyen, 3 fort, 4 extreme. NULL = non renseigne, jamais
  --   « doux ». EDITORIAL : ne se derive PAS des ingredients (quantite, rapport au plat, mode de
  --   cuisson). NON CABLE — aucune couche ne le lit encore.
  piquant INTEGER CHECK (piquant BETWEEN 0 AND 4)
);

CREATE TABLE recipe_ingredient (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  food_id TEXT NOT NULL REFERENCES food(id),
  quantite_g REAL NOT NULL,
  unite_affichage TEXT NOT NULL,
  optionnel INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recipe_step (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  ordre INTEGER NOT NULL,
  texte TEXT NOT NULL,
  lexicon_ids TEXT NOT NULL,
  timer_s INTEGER,
  timer_type TEXT CHECK (timer_type IN ('cuisson', 'repos') OR timer_type IS NULL),
  -- Un geste se fait ; un avertissement se lit. Les 18 mentions ANSES / ministere de l'Agriculture
  -- occupent une ligne d'etape sans en etre une. Voir docs/CONCEPTION_MODE_CUISINE.md §3.
  nature TEXT NOT NULL DEFAULT 'geste' CHECK (nature IN ('geste', 'avertissement')),
  PRIMARY KEY (recipe_id, ordre)
);

-- Quels ingredients une etape emploie-t-elle. DERIVE du texte au build, jamais saisi a la main :
-- voir catalog/lien-etape-ingredient.mjs pour le pourquoi et les 94 % mesures.
--
-- La colonne origine dit D'OU vient chaque lien, et ce n'est pas de la decoration : les trois
-- valeurs n'ont pas la meme force. « declare » est un humain qui a tranche ; « derive » est un
-- rapprochement dans la phrase meme ; « herite » reprend l'etape precedente sur un pronom (« les
-- blanchir ») et c'est le seul des trois qui peut SUR-ATTRIBUER — l'etape d'avant nommait trois
-- aliments, celle-ci n'en concerne peut-etre qu'un. Un ecran qui ne voudrait afficher que du sur
-- doit pouvoir l'ecarter.
CREATE TABLE recipe_step_ingredient (
  recipe_id TEXT NOT NULL,
  ordre     INTEGER NOT NULL,
  food_id   TEXT NOT NULL REFERENCES food(id),
  origine   TEXT NOT NULL CHECK (origine IN ('declare', 'derive', 'herite')),
  PRIMARY KEY (recipe_id, ordre, food_id),
  FOREIGN KEY (recipe_id, ordre) REFERENCES recipe_step(recipe_id, ordre)
);

CREATE TABLE recipe_facet (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  facette TEXT NOT NULL CHECK (facette IN ('cuisine', 'regime', 'occasion', 'style')),
  valeur TEXT NOT NULL
);

-- Sources d'une recette. UNE recette -> N sources, comme evidence_source pour les fiches.
--
-- ⚠️ DEUX TYPES QUI NE DISENT PAS LA MEME CHOSE, et les confondre serait un mensonge :
--   'provenance' = la recette VIENT de la (import d'une source libre). Revendique une origine.
--   'reference'  = ouverte pour VERIFIER la recette. Ne revendique rien, c'est une bibliographie.
-- Les 241 recettes du catalogue sont ecrites pour ce projet : aucune ne peut porter 'provenance'
-- retroactivement. Leur attacher une source trouvee apres coup fabriquerait une origine — la faute
-- exacte que catalog/tips/README.md interdit. Voir docs/SOURCES_RECETTES.md §1.
--
-- ⚠️ consulte_le N'EST PAS DECORATIF : une reference non ouverte ne se cite pas. La date dit
-- quand elle l'a ete, comme evidence_source.consulte_le.
CREATE TABLE recipe_source (
  recipe_id TEXT NOT NULL REFERENCES recipe(id),
  type TEXT NOT NULL CHECK (type IN ('provenance', 'reference')),
  titre TEXT NOT NULL,
  url TEXT NOT NULL,
  consulte_le TEXT NOT NULL,
  -- Renseignee pour 'provenance' (la licence commande l'affichage du credit), omise sinon : citer
  -- une reference n'emprunte rien, donc rien a crediter.
  licence TEXT,
  auteur TEXT,
  PRIMARY KEY (recipe_id, url)
);

CREATE TABLE tip (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  -- Les trois categories de §8.4. La nutrition animale detonne volontairement : c'est du contenu
  -- CULTUREL, et l'ecran doit la distinguer visuellement des conseils qui s'appliquent a soi.
  categorie TEXT NOT NULL
    CHECK (categorie IN ('biologie_aliment', 'nutrition_humaine', 'nutrition_animale')),
  texte TEXT NOT NULL,
  -- NOT NULL, et c'est le point : §4.2 prevoyait cette colonne des l'origine. Un tip est une
  -- affirmation affichee telle quelle ; sans source, il est indiscernable d'une rumeur bien tournee.
  -- Le format de l'URL est verifie au build (http/https), pas ici.
  source_url TEXT NOT NULL
);

CREATE TABLE lexicon_entry (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  terme TEXT NOT NULL,
  definition TEXT NOT NULL
);

-- Fiches scientifiques (§8.2 ARCHITECTURE, §4.7 DESIGN). Sources editables : catalog/evidence/*.md
--
-- ECART ASSUME AU §4.2 ARCHITECTURE, qui prevoyait UN niveau de preuve par fiche. Exposer plusieurs
-- points de vue impose d'en porter un PAR POSITION : une fiche peut reposer sur un consensus fort
-- tout en presentant une position faible et contestee (voir sodium-tension-arterielle). D'ou
-- evidence_position et sa table de jonction, absentes du document d'origine.
CREATE TABLE evidence_sheet (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  -- Titre-QUESTION (§4.7). La presence du « ? » est verifiee au build, pas ici : SQLite ne sait pas
  -- exprimer cette contrainte lisiblement, et le message d'erreur du build est plus utile.
  titre TEXT NOT NULL,
  categorie TEXT NOT NULL
    CHECK (categorie IN ('nutriments', 'vitamines_mineraux', 'aliments', 'situations')),
  -- Niveau du SOCLE DE CONSENSUS de la fiche, distinct de celui de chaque position.
  niveau_preuve TEXT NOT NULL
    CHECK (niveau_preuve IN ('forte', 'moderee', 'faible', 'preliminaire')),
  date_revue TEXT NOT NULL,
  resume_vulgarise TEXT NOT NULL
);

CREATE TABLE evidence_source (
  sheet_id TEXT NOT NULL REFERENCES evidence_sheet(id),
  -- Identifiant LOCAL a la fiche : deux fiches peuvent citer 'efsa-2019' sans se marcher dessus.
  code TEXT NOT NULL,
  titre_etude TEXT NOT NULL,
  -- NULLABLE A DESSEIN : NULL = auteurs NON VERIFIES (page editeur derriere un compte), alors que
  -- titre, revue, annee et DOI l'ont ete. Une chaine plausible mentirait ; NULL le dit.
  auteurs TEXT,
  annee INTEGER NOT NULL,
  revue TEXT NOT NULL,
  doi TEXT,
  url TEXT NOT NULL,
  type_etude TEXT NOT NULL CHECK (type_etude IN (
    'meta_analyse', 'revue_systematique', 'essai_randomise', 'cohorte',
    'rapport_autorite', 'commentaire_critique'
  )),
  -- effectif : renseigne SEULEMENT s'il a ete verifie a la source (« 95 767 participants »).
  effectif TEXT,
  -- financement : declaration publiee, reproduite telle quelle. C'est ce qui permet au lecteur de
  --   savoir qu'une meta-analyse a ete payee par le secteur qu'elle evalue. Jamais commente ici.
  financement TEXT,
  consulte_le TEXT NOT NULL,
  PRIMARY KEY (sheet_id, code)
);

CREATE TABLE evidence_position (
  sheet_id TEXT NOT NULL REFERENCES evidence_sheet(id),
  ordre INTEGER NOT NULL,
  code TEXT NOT NULL,
  niveau_preuve TEXT NOT NULL
    CHECK (niveau_preuve IN ('forte', 'moderee', 'faible', 'preliminaire')),
  -- porte_par : QUI soutient la position (« OMS, EFSA », « revue Cochrane »). NOT NULL par
  --   securite : sans auteur, une affirmation de sante redevient une parole de l'application (§6.1).
  porte_par TEXT NOT NULL,
  affirmation TEXT NOT NULL,
  detail TEXT NOT NULL,
  PRIMARY KEY (sheet_id, ordre),
  UNIQUE (sheet_id, code)
);

-- Jonction position -> sources. §4.2 rattachait les sources a la FICHE ; les rattacher a la
-- POSITION est ce qui rend verifiable qu'aucune affirmation n'est publiee sans reference.
CREATE TABLE evidence_position_source (
  sheet_id TEXT NOT NULL,
  position_ordre INTEGER NOT NULL,
  source_code TEXT NOT NULL,
  PRIMARY KEY (sheet_id, position_ordre, source_code),
  FOREIGN KEY (sheet_id, position_ordre) REFERENCES evidence_position(sheet_id, ordre),
  FOREIGN KEY (sheet_id, source_code) REFERENCES evidence_source(sheet_id, code)
);

-- cible_id est POLYMORPHE (food | nutrient | health_topic) : aucune cle etrangere possible. Son
-- existence reelle au catalogue est verifiee au build, ou l'erreur est lisible.
CREATE TABLE evidence_link (
  sheet_id TEXT NOT NULL REFERENCES evidence_sheet(id),
  cible_type TEXT NOT NULL CHECK (cible_type IN ('food', 'nutrient', 'health_topic')),
  cible_id TEXT NOT NULL,
  PRIMARY KEY (sheet_id, cible_type, cible_id)
);
`

function buildDatabase({ foods, lexicon, recipes, tips, evidence, confiance = {} }, outPath) {
  if (existsSync(outPath)) rmSync(outPath, { force: true })

  const db = new DatabaseSync(outPath)
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA_SQL)

  db.exec('BEGIN TRANSACTION;')
  try {
    const insertNutrient = db.prepare(
      'INSERT INTO nutrient (id, code, nom, unite, vnr_adulte, categorie, sens) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const n of NUTRIENTS) insertNutrient.run(n.id, n.code, n.nom, n.unite, n.vnr_adulte, n.categorie, n.sens)

    const insertAllergen = db.prepare('INSERT INTO allergen (id, code, nom) VALUES (?, ?, ?)')
    for (const a of ALLERGENS) insertAllergen.run(a.id, a.code, a.nom)

    const insertFood = db.prepare(
      'INSERT INTO food (id, code_ciqual, nom, groupe, sous_famille, saison_mois, toute_annee, piquant, poids_piece_g, fond_de_placard, conditionnement_g, origine_animale, derive_de) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const insertFoodNutrient = db.prepare(
      'INSERT INTO food_nutrient (food_id, nutrient_id, valeur_pour_100g, code_confiance) VALUES (?, ?, ?, ?)'
    )
    const insertFoodAllergen = db.prepare(
      'INSERT INTO food_allergen (food_id, allergen_id, certitude) VALUES (?, ?, ?)'
    )
    const insertFoodSynonym = db.prepare('INSERT INTO food_synonym (food_id, terme) VALUES (?, ?)')
    const nutrientByKey = new Map(NUTRIENTS.map((n) => [n.key, n.id]))
    for (const food of foods) {
      insertFood.run(
        food.id,
        food.code_ciqual,
        food.nom,
        food.groupe,
        food.sous_famille ?? null,
        JSON.stringify(food.saison_mois ?? []),
        food.toute_annee ? 1 : 0,
        food.piquant ?? null,
        food.poids_piece_g ?? null,
        food.fond_de_placard ? 1 : 0,
        food.conditionnement_g ?? null,
        food.origine_animale ?? null,
        food.derive_de ?? null
      )
      const cotesDeCetAliment = confiance[food.id] ?? {}
      for (const [key, valeur] of Object.entries(food.nutriments ?? {})) {
        insertFoodNutrient.run(food.id, nutrientByKey.get(key), valeur, cotesDeCetAliment[key] ?? null)
      }
      for (const allergene of food.allergenes ?? []) {
        insertFoodAllergen.run(food.id, allergene.code, allergene.certitude)
      }
      for (const terme of food.synonymes ?? []) {
        insertFoodSynonym.run(food.id, terme)
      }
    }

    const insertTip = db.prepare(
      'INSERT INTO tip (id, code, categorie, texte, source_url) VALUES (?, ?, ?, ?, ?)'
    )
    for (const tip of tips) {
      insertTip.run(
        tip.code,
        tip.code,
        tip.categorie,
        String(tip.texte).trim(),
        String(tip.source_url).trim()
      )
    }

    const insertLexicon = db.prepare(
      'INSERT INTO lexicon_entry (id, code, terme, definition) VALUES (?, ?, ?, ?)'
    )
    for (const entry of lexicon) {
      insertLexicon.run(entry.code, entry.code, entry.terme, entry.definition)
    }

    const insertRecipe = db.prepare(`
      INSERT INTO recipe (
        id, nom, origine, description, temps_prep_min, temps_cuisson_min, difficulte,
        portions_base, image_path, teste_le, types_repas, saison_mois, envergure,
        conservation_jours, axe_sucre_sale, axe_leger_consistant, axe_chaud_froid, axe_texture,
        service, piquant
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertRecipeSource = db.prepare(`
      INSERT INTO recipe_source (recipe_id, type, titre, url, consulte_le, licence, auteur)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertIngredient = db.prepare(`
      INSERT INTO recipe_ingredient (recipe_id, food_id, quantite_g, unite_affichage, optionnel)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertStep = db.prepare(`
      INSERT INTO recipe_step (recipe_id, ordre, texte, lexicon_ids, timer_s, timer_type, nature)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertFacet = db.prepare('INSERT INTO recipe_facet (recipe_id, facette, valeur) VALUES (?, ?, ?)')
    const insertStepIngredient = db.prepare(`
      INSERT INTO recipe_step_ingredient (recipe_id, ordre, food_id, origine) VALUES (?, ?, ?, ?)
    `)
    // La dérivation lit `groupe` et `synonymes` : elle a besoin de l'aliment ENTIER, pas de son id.
    const alimentsParId = new Map(foods.map((f) => [f.id, f]))

    for (const recipe of recipes) {
      insertRecipe.run(
        recipe.id,
        recipe.nom,
        recipe.origine,
        recipe.description,
        recipe.temps_prep_min,
        recipe.temps_cuisson_min,
        recipe.difficulte,
        recipe.portions_base,
        recipe.image_path ?? null,
        recipe.teste_le ?? null,
        JSON.stringify(recipe.types_repas ?? []),
        JSON.stringify(recipe.saison_mois ?? []),
        recipe.envergure,
        recipe.conservation_jours,
        recipe.axes?.sucre_sale ?? 0,
        recipe.axes?.leger_consistant ?? 0,
        recipe.axes?.chaud_froid ?? 0,
        recipe.axes?.texture ?? '',
        recipe.service ?? null,
        recipe.piquant ?? null
      )
      for (const ing of recipe.ingredients ?? []) {
        insertIngredient.run(recipe.id, ing.food_id, ing.quantite_g, ing.unite_affichage, ing.optionnel ? 1 : 0)
      }
      for (const source of recipe.sources ?? []) {
        insertRecipeSource.run(
          recipe.id,
          source.type,
          source.titre,
          source.url,
          String(source.consulte_le),
          source.licence ?? null,
          source.auteur ?? null
        )
      }
      for (const etape of recipe.etapes ?? []) {
        insertStep.run(
          recipe.id,
          etape.ordre,
          etape.texte,
          JSON.stringify(etape.lexicon_ids ?? []),
          etape.timer_s ?? null,
          etape.timer_type ?? null,
          etape.nature ?? 'geste'
        )
      }
      // ⚠️ APRÈS `recipe_step`, jamais avant : la clé étrangère (recipe_id, ordre) vise une ligne
      // qui doit déjà exister.
      for (const [ordre, lien] of liensDeLaRecette(recipe, alimentsParId)) {
        for (const foodId of lien.ids) {
          insertStepIngredient.run(recipe.id, ordre, foodId, lien.origine)
        }
      }
      for (const facette of recipe.facettes ?? []) {
        insertFacet.run(recipe.id, facette.facette, facette.valeur)
      }
    }

    const insertSheet = db.prepare(`
      INSERT INTO evidence_sheet (id, code, titre, categorie, niveau_preuve, date_revue, resume_vulgarise)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertEvidenceSource = db.prepare(`
      INSERT INTO evidence_source (
        sheet_id, code, titre_etude, auteurs, annee, revue, doi, url, type_etude,
        effectif, financement, consulte_le
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertPosition = db.prepare(`
      INSERT INTO evidence_position (sheet_id, ordre, code, niveau_preuve, porte_par, affirmation, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const insertPositionSource = db.prepare(`
      INSERT INTO evidence_position_source (sheet_id, position_ordre, source_code) VALUES (?, ?, ?)
    `)
    const insertEvidenceLink = db.prepare(
      'INSERT INTO evidence_link (sheet_id, cible_type, cible_id) VALUES (?, ?, ?)'
    )

    for (const fiche of evidence ?? []) {
      insertSheet.run(
        fiche.code,
        fiche.code,
        fiche.titre,
        fiche.categorie,
        fiche.niveau_preuve,
        String(fiche.date_revue),
        fiche.resume_vulgarise
      )
      // Les sources AVANT les positions : la jonction reference les deux, et les cles etrangeres
      // sont verifiees a l'insertion (PRAGMA foreign_keys = ON).
      for (const source of fiche.sources ?? []) {
        insertEvidenceSource.run(
          fiche.code,
          source.id,
          source.titre_etude,
          source.auteurs ?? null,
          source.annee,
          source.revue,
          source.doi ?? null,
          source.url,
          source.type_etude,
          source.effectif ?? null,
          source.financement ?? null,
          String(source.consulte_le)
        )
      }
      // `ordre` vient de la POSITION DANS LE FICHIER : l'ordre des positions est un choix editorial
      // (le consensus d'abord, la lecture croisee en dernier), pas un detail de presentation.
      for (const [ordre, position] of (fiche.positions ?? []).entries()) {
        insertPosition.run(
          fiche.code,
          ordre,
          position.id,
          position.niveau_preuve,
          position.porte_par,
          position.affirmation,
          String(position.detail).trim()
        )
        for (const ref of position.sources ?? []) {
          insertPositionSource.run(fiche.code, ordre, ref)
        }
      }
      for (const lien of fiche.liens ?? []) {
        insertEvidenceLink.run(fiche.code, lien.cible_type, lien.cible_id)
      }
    }

    db.exec('COMMIT;')
  } catch (err) {
    db.exec('ROLLBACK;')
    db.close()
    throw err
  }

  db.close()
}

// ----------------------------------------------------------------------------
// 7. Orchestration
// ----------------------------------------------------------------------------

async function main() {
  const [foods, lexicon, recipes, tips, evidence, confiance] = await Promise.all([
    loadFoods(),
    loadLexicon(),
    loadRecipes(),
    loadTips(),
    loadEvidence(),
    loadConfiance(),
  ])

  const errors = validateCatalog({ foods, lexicon, recipes, tips, evidence })
  if (errors.length > 0) {
    console.error(`Build du catalogue échoué — ${errors.length} erreur(s) :\n`)
    for (const err of errors) console.error(`  - ${err}`)
    throw new BuildError(`${errors.length} erreur(s) de validation`)
  }

  // Affichés APRÈS la validation et AVANT le build : ce sont des rappels de relecture éditoriale,
  // ils ne doivent ni masquer une erreur ni empêcher la génération (§8.2 règle 4).
  for (const avertissement of evidenceWarnings(evidence, Date.now())) {
    console.warn(`  ⚠ ${avertissement}`)
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  buildDatabase({ foods, lexicon, recipes, tips, evidence, confiance }, OUT_PATH)

  const positions = evidence.reduce((total, fiche) => total + (fiche.positions?.length ?? 0), 0)
  const etapesToutes = recipes.flatMap((r) => r.etapes ?? [])
  const avertissements = etapesToutes.filter((e) => e?.nature === 'avertissement').length
  console.log(
    `catalog.db généré : ${foods.length} aliments, ${recipes.length} recettes, ${lexicon.length} gestes de lexique, ${tips.length} tips, ${evidence.length} fiches (${positions} positions).`
  )
  // Le detail des etapes est sorti a part : c'est le compteur qui rendra visible la montee du
  // prerequis A (docs/CONCEPTION_MODE_CUISINE.md §2.4), et deja celle de `nature`.
  console.log(
    `recipe_step : ${etapesToutes.length} étapes dont ${etapesToutes.length - avertissements} gestes et ${avertissements} avertissements.`
  )

  // ⚠️ CE COMPTEUR EST LE SEUL GARDE-FOU DE LA DÉRIVATION, et il ne peut pas être un test. Aucune
  // vérité de terrain n'existe : personne n'a annoté les 1 350 gestes à la main, c'est justement ce
  // qu'on a refusé de faire. Un test ne saurait donc pas dire si un lien est JUSTE. Ce qu'un humain
  // voit, lui, c'est une couverture qui CHUTE — le signe qu'une recette vient d'être écrite d'une
  // façon que le rapprochement ne sait pas lire. Relevé du 2026-08-07 : 94,0 %.
  const gestesToutes = etapesToutes.length - avertissements
  const parOrigine = { declare: 0, derive: 0, herite: 0 }
  let gestesLies = 0
  let lignes = 0
  for (const recipe of recipes) {
    const naturesParOrdre = new Map((recipe.etapes ?? []).map((e) => [e.ordre, e.nature ?? 'geste']))
    for (const [ordre, lien] of liensDeLaRecette(recipe, new Map(foods.map((f) => [f.id, f])))) {
      if (naturesParOrdre.get(ordre) !== 'geste' || lien.ids.length === 0) continue
      gestesLies++
      lignes += lien.ids.length
      parOrigine[lien.origine] += lien.ids.length
    }
  }
  const pourcent = gestesToutes > 0 ? ((gestesLies / gestesToutes) * 100).toFixed(1) : '0.0'
  console.log(
    `recipe_step_ingredient : ${lignes} liens sur ${gestesLies}/${gestesToutes} gestes (${pourcent} %) — ` +
      `${parOrigine.declare} déclarés, ${parOrigine.derive} dérivés, ${parOrigine.herite} hérités.`
  )
  console.log(`→ ${OUT_PATH}`)
}

// N'exécute `main()` que si ce fichier est lancé comme SCRIPT (`node catalog/build.mjs`, ou via
// spawnSync dans catalog/build.test.ts) — jamais quand il est simplement IMPORTÉ pour sa constante
// `BANNED_TERMS` (tests/banned-terms-consistency.test.mjs). Sans cette garde, importer la liste
// déclencherait un build complet (lecture des sources, écriture de catalog.db) comme effet de bord
// non désiré d'une simple lecture de constante.
function isMainModule() {
  if (!process.argv[1]) return false
  const invoked = path.resolve(process.argv[1])
  const thisFile = fileURLToPath(import.meta.url)
  return process.platform === 'win32' ? invoked.toLowerCase() === thisFile.toLowerCase() : invoked === thisFile
}

if (isMainModule()) {
  main().catch((err) => {
    console.error(err instanceof BuildError ? err.message : err)
    process.exitCode = 1
  })
}
