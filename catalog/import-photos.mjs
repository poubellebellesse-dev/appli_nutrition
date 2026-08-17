#!/usr/bin/env node
// catalog/import-photos.mjs — fait entrer dans l'application les photos validées à l'atelier.
//
// POURQUOI CE SCRIPT EXISTE
// La chaîne de la photo était branchée de bout en bout depuis longtemps — `catalog/recipes/*.yaml`
// → colonne `image_path` (`build.mjs`) → `catalog-loader.ts` → `Recipe.imagePath` — et il n'y
// manquait qu'une VALEUR : les 308 recettes portaient `image_path: null`. Le tri, lui, avait
// tranché 88 photos. Ce script est le pont, et il n'existe que pour ça.
//
// ⚠️ LE CHAMP `image_path` EST ÉCRIT PAR CE SCRIPT, JAMAIS À LA MAIN. C'est la seule façon de
// garantir que le chemin dans le YAML, le fichier dans `app/public/` et la ligne de crédit
// désignent la même photo. Une valeur tapée à la main survivrait au retrait de son fichier.
//
// ⚠️ IL FAUT RÉ-ENCODER, ET LA MESURE QUI DIT LE CONTRAIRE A ÉTÉ FAITE SUR LE MAUVAIS CRITÈRE.
// Les 88 photos retenues pèsent 19,9 Mo brut, médiane 189 Ko, et 2 sur 88 tiennent dans le budget
// de 40 Ko/image du critère de sortie P6. Le poids « à stocker » n'est pas le budget « à
// expédier » : `bundle < 15 Mo` et `40 Ko/image` sont la même contrainte dite deux fois
// (308 × 40 Ko = 12,3 Mo). Au réglage ci-dessous, les 88 rendent 3,1 Mo, médiane 30 Ko.
//
// POURQUOI AVIF ET NON WEBP — décidé sur PSNR, pas sur le numéro de qualité. Les deux échelles de
// `quality` ne sont pas comparables entre formats ; les comparer directement est un piège. À
// qualité PERÇUE égale, mesuré sur un échantillon des photos retenues :
//     ~34,3 dB   avif q45 27,8 Ko  contre  webp q55 37,9 Ko   -27 %
//     ~35,5 dB   avif ~q49 ~33 Ko  contre  webp q75 49,4 Ko   -33 %
//     ~37,9 dB   avif q65 57,9 Ko  contre  webp q85 77,0 Ko   -25 %
//
// ⚠️ ON LIT LES OCTETS, PAS L'EXTENSION. Sur les 88 retenues, 86 sont réellement du JPEG, 1 du PNG
// et 1 du WEBP — et les deux dernières portent `.jpg`. `sharp` reconnaît le format à l'en-tête,
// c'est pour cette raison qu'on ne construit jamais de décodeur à partir du nom de fichier.
//
// ⚠️ CE SCRIPT N'EST PAS UNE DÉPENDANCE DE BUILD. Comme `build-icons.mjs`, il produit des artefacts
// COMMITTÉS ; `npm run build` et `vite build` ne l'appellent jamais et n'ont pas besoin de `sharp`.
// C'est ce qui permet à un clone frais de construire l'application sans le bac de photos, qui vit
// hors du dépôt.
//
// ⚠️ LE BAC EST HORS DU DÉPÔT. `atelier/photos/` est gitignoré et les images vivent dans
// `BAC_PHOTOS` (défaut ci-dessous). Sur une machine sans ce dossier, ce script ne peut pas tourner
// — et c'est sans conséquence, puisque ce qu'il produit est versionné.
//
// USAGE
//   node catalog/import-photos.mjs --dry      → mesure et rapporte, N'ÉCRIT RIEN
//   node catalog/import-photos.mjs            → encode, écrit les YAML, régénère les crédits
//   node catalog/import-photos.mjs --prune    → en plus, supprime les images devenues orphelines
//
// Idempotent : deux exécutions de suite laissent l'arbre identique.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const RACINE = path.join(__dirname, '..')

/** Le bac de l'atelier, hors dépôt. Même défaut que `atelier/photos/donnees.mjs`. */
const BAC = process.env.BAC_PHOTOS ?? 'G:\\Claude\\Dessinateur\\recettes'
const PHOTOS = path.join(BAC, 'photos')
const DECISIONS = path.join(RACINE, 'atelier', 'photos', 'etat', 'decisions.json')

const RECETTES = path.join(RACINE, 'catalog', 'recipes')
const SORTIE = path.join(RACINE, 'app', 'public', 'catalog', 'images')
const CREDITS = path.join(RACINE, 'catalog', 'CREDITS.md')

/** URL publique, symétrique de `/catalog/catalog.db` (`app/src/ui/catalog-source.ts`). */
const URL_BASE = '/catalog/images'

/**
 * Réglage d'encodage, FIXÉ PAR MESURE sur les 88 photos retenues — voir l'en-tête.
 * 1 024 px : la source médiane fait déjà cette largeur, et `withoutEnlargement` interdit
 * d'agrandir les quelques-unes qui sont plus petites.
 */
export const ENCODAGE = { largeurMax: 1024, qualite: 45, effort: 6, extension: 'avif' }

const MARQUE_DEBUT = '<!-- DÉBUT PHOTOS — bloc généré par catalog/import-photos.mjs, ne pas éditer à la main -->'
const MARQUE_FIN = '<!-- FIN PHOTOS -->'

class ErreurImport extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Sélection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Des décisions de l'atelier, tire UNE photo par recette.
 *
 * ⚠️ CINQ RECETTES PORTENT DEUX `oui`. La règle « le dernier par horodatage gagne » est celle
 * proposée au récap du 2026-08-09 ; elle n'a jamais été arbitrée. Elle est relue à chaque
 * exécution, donc entièrement réversible : corriger `decisions.json` et relancer suffit.
 *
 * Les verdicts `hors-catalogue` portent `recette: null` — ils désignent un plat qu'aucune recette
 * ne nomme et n'ont rien à faire ici.
 *
 * @param {Record<string, {decision: string, recette: string|null, horodatage: string}>} decisions
 * @returns {Map<string, string>} id de recette → clé de l'image (`b/<groupe>/<fichier>`)
 */
export function choisirPhotos(decisions) {
  /** @type {Map<string, {cle: string, horodatage: string}>} */
  const retenues = new Map()
  for (const [cle, verdict] of Object.entries(decisions)) {
    if (verdict.decision !== 'oui' || !verdict.recette) continue
    const precedente = retenues.get(verdict.recette)
    if (!precedente || String(verdict.horodatage) > String(precedente.horodatage)) {
      retenues.set(verdict.recette, { cle, horodatage: String(verdict.horodatage) })
    }
  }
  // Trié par identifiant : le rapport et le bloc de crédits doivent être stables d'une exécution à
  // l'autre, sinon le diff git bruite à chaque lot sans qu'aucune photo n'ait changé.
  return new Map([...retenues].sort(([a], [b]) => a.localeCompare(b)).map(([id, v]) => [id, v.cle]))
}

/**
 * Le rectangle à extraire d'une photo, en pixels, depuis le cadre posé à l'atelier.
 *
 * ⚠️ LE CADRE EST EN FRACTIONS, PAS EN PIXELS, et c'est ce qui le rend robuste : `{x, y, w, h}` sont
 * des parts de la largeur et de la hauteur, donc valables quelle que soit la résolution du fichier
 * source. Le champ `source` que l'atelier écrit à côté est INFORMATIF — il dit sur quelle taille le
 * cadre a été posé, il ne sert pas au calcul. S'y fier ferait échouer le recadrage le jour où le bac
 * fournirait la même photo dans une autre définition.
 *
 * ⚠️ ON BORNE, ON NE FAIT PAS CONFIANCE. `sharp.extract` lève si le rectangle sort de l'image ne
 * serait-ce que d'un pixel, et un arrondi suffit à le faire sortir. Le cadre est donc ramené dans
 * l'image, et un rectangle qui n'aurait plus de surface rend `null` — l'appelant recadre alors
 * comme avant, il ne produit pas une image vide.
 *
 * @param {{x: number, y: number, w: number, h: number} | null | undefined} cadre
 * @param {number} largeur  largeur de l'image APRÈS application de l'orientation EXIF
 * @param {number} hauteur  hauteur de l'image APRÈS application de l'orientation EXIF
 * @returns {{left: number, top: number, width: number, height: number} | null}
 */
export function rectangleDuCadre(cadre, largeur, hauteur) {
  if (!cadre) return null
  const { x, y, w, h } = cadre
  if (![x, y, w, h].every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  if (!(largeur > 0) || !(hauteur > 0)) return null

  const left = Math.max(0, Math.min(largeur - 1, Math.round(x * largeur)))
  const top = Math.max(0, Math.min(hauteur - 1, Math.round(y * hauteur)))
  const width = Math.max(0, Math.min(largeur - left, Math.round(w * largeur)))
  const height = Math.max(0, Math.min(hauteur - top, Math.round(h * hauteur)))

  if (width < 1 || height < 1) return null
  // Un cadre qui couvre toute l'image ne recadre rien : autant ne pas appeler `extract`, la sortie
  // serait identique à l'octet et l'appel n'ajouterait qu'un mode d'échec.
  if (left === 0 && top === 0 && width === largeur && height === hauteur) return null
  return { left, top, width, height }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crédits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ramène les libellés de licence des trois banques à une forme unique, avec son lien.
 *
 * ⚠️ CE N'EST PAS DE LA COSMÉTIQUE. Les trois banques écrivent la même licence de trois façons
 * (`CC BY-SA 3.0`, `by-sa 2.0`, `cc0 1.0`) ; 66 des 88 photos sont sous CC BY ou CC BY-SA, où
 * l'attribution et le lien vers la licence sont une OBLIGATION, pas une politesse.
 *
 * @param {string} brut
 * @returns {{nom: string, url: string|null}}
 */
export function normaliserLicence(brut) {
  const t = String(brut ?? '').trim()
  const bas = t.toLowerCase().replace(/^cc[\s-]+/, '')

  if (bas.startsWith('cc0') || bas === 'zero' || bas.startsWith('publicdomain')) {
    return { nom: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' }
  }
  if (bas.startsWith('pdm') || bas.includes('public domain mark')) {
    return { nom: 'Public Domain Mark 1.0', url: 'https://creativecommons.org/publicdomain/mark/1.0/' }
  }
  if (bas.includes('pexels')) return { nom: 'Pexels License', url: 'https://www.pexels.com/license/' }
  if (bas.includes('unsplash')) return { nom: 'Unsplash License', url: 'https://unsplash.com/license' }

  const cc = bas.match(/^(by(?:-nc)?(?:-sa|-nd)?)\s*([\d.]+)?$/)
  if (cc) {
    const code = cc[1]
    const version = cc[2] ?? '4.0'
    return { nom: `CC ${code.toUpperCase()} ${version}`, url: `https://creativecommons.org/licenses/${code}/${version}/` }
  }
  // Inconnue : on la recopie telle quelle plutôt que de deviner. Une licence mal nommée dans le
  // fichier de crédits se voit ; une licence inventée, non.
  return { nom: t || 'licence inconnue', url: null }
}

/**
 * Crédits de la récolte, clé `<groupe>/<fichier>`.
 *
 * ⚠️ Le CSV est écrit sans échappement (`atelier/photos/donnees.mjs`) : un champ ne peut pas
 * contenir de `;`, et on découpe donc sans état d'âme — mais on ne peut pas non plus se fier à un
 * parseur CSV strict, qui buterait sur les guillemets non appariés des titres de banque.
 */
function chargerCredits() {
  const chemin = path.join(PHOTOS, 'credits.csv')
  if (!existsSync(chemin)) throw new ErreurImport(`credits.csv introuvable : ${chemin}`)
  const credits = new Map()
  for (const ligne of readFileSync(chemin, 'utf8').split(/\r?\n/).slice(1)) {
    const champs = ligne.split(';')
    if (!champs[0]) continue
    credits.set(champs[0], {
      source: champs[2] ?? '',
      auteur: (champs[3] ?? '').trim(),
      licence: champs[4] ?? '',
      url: (champs[5] ?? '').trim(),
    })
  }
  return credits
}

/**
 * Réécrit le bloc de crédits photo entre ses deux marques, sans toucher au reste du fichier.
 * Si les marques sont absentes, insère la section AVANT « À compléter avant publication ».
 *
 * @param {string} markdown
 * @param {string} bloc
 * @returns {string}
 */
export function poserBlocCredits(markdown, bloc) {
  const complet = `${MARQUE_DEBUT}\n\n${bloc}\n\n${MARQUE_FIN}`
  const debut = markdown.indexOf(MARQUE_DEBUT)
  const fin = markdown.indexOf(MARQUE_FIN)
  if (debut !== -1 && fin !== -1) {
    return markdown.slice(0, debut) + complet + markdown.slice(fin + MARQUE_FIN.length)
  }
  const ancre = markdown.indexOf('## À compléter avant publication')
  if (ancre === -1) return `${markdown.trimEnd()}\n\n---\n\n${complet}\n`
  return `${markdown.slice(0, ancre)}${complet}\n\n---\n\n${markdown.slice(ancre)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remplace la valeur de `image_path` dans une recette, LIGNE À LIGNE.
 *
 * ⚠️ SURTOUT PAS DE `parse` PUIS `stringify`. Ces 308 fichiers appartiennent à la lane Référence
 * et portent des commentaires, un ordre de clés et une mise en forme choisis à la main : les
 * relire et les réécrire par la bibliothèque YAML les reformaterait tous, et écraserait le travail
 * d'une autre session sans qu'aucun test ne s'en aperçoive. Même motif que `import-ciqual.mjs`.
 *
 * ⚠️ LA FIN DE LIGNE D'ORIGINE EST CONSERVÉE. 297 des 308 recettes sont en CRLF, 11 en LF. Écrire
 * la ligne neuve sans son `\r` produirait un fichier à fins de ligne mixtes, et surtout : les
 * 220 recettes déjà à `null` seraient toutes vues comme « à corriger », soit 209 fichiers de la
 * lane Référence salis par un import qui n'avait rien à y changer. Attrapé au passage à blanc.
 *
 * @param {string} yaml
 * @param {string|null} valeur chemin public, ou `null` pour effacer
 * @returns {{texte: string, remplacee: boolean, presente: boolean}}
 */
export function poserImagePath(yaml, valeur) {
  const lignes = yaml.split('\n')
  let presente = false
  let remplacee = false
  for (let i = 0; i < lignes.length; i += 1) {
    // Ancrée en colonne 0 : `image_path` est une clé de premier niveau, et une clé de même nom
    // imbriquée dans un bloc ne doit pas être confondue avec elle.
    if (!/^image_path:/.test(lignes[i])) continue
    presente = true
    const finDeLigne = lignes[i].endsWith('\r') ? '\r' : ''
    const attendue = `image_path: ${valeur ?? 'null'}${finDeLigne}`
    if (lignes[i] !== attendue) {
      lignes[i] = attendue
      remplacee = true
    }
    break
  }
  return { texte: lignes.join('\n'), remplacee, presente }
}

// ─────────────────────────────────────────────────────────────────────────────
// Programme
// ─────────────────────────────────────────────────────────────────────────────

const ko = (octets) => `${Math.round(octets / 1024)} Ko`

async function main(argv) {
  const blanc = argv.includes('--dry')
  const elaguer = argv.includes('--prune')

  if (!existsSync(DECISIONS)) throw new ErreurImport(`decisions.json introuvable : ${DECISIONS}\nLe bac de l'atelier est hors du dépôt ; poser BAC_PHOTOS si besoin.`)
  if (!existsSync(PHOTOS)) throw new ErreurImport(`Le bac de photos est introuvable : ${PHOTOS}\nPoser BAC_PHOTOS pour le désigner.`)

  // Gardé en variable, et plus consommé à la volée : le CADRE de chaque photo se relit ici, à la
  // clé de l'image. `choisirPhotos` n'a pas à changer de signature pour ça — elle répond à « quelle
  // photo pour quelle recette », le cadrage est une autre question posée à la même donnée.
  const decisions = JSON.parse(readFileSync(DECISIONS, 'utf8'))
  const choisies = choisirPhotos(decisions)
  const credits = chargerCredits()
  const connues = new Set(readdirSync(RECETTES).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)))

  console.log(`atelier   : ${choisies.size} recettes avec une photo tranchée`)
  console.log(`catalogue : ${connues.size} recettes`)
  console.log(`encodage  : AVIF ${ENCODAGE.largeurMax} px max, quality ${ENCODAGE.qualite}, effort ${ENCODAGE.effort}${blanc ? '   [--dry : rien ne sera écrit]' : ''}\n`)

  if (!blanc) mkdirSync(SORTIE, { recursive: true })

  const touches = []
  const lignesCredits = []
  const tailles = []
  const problemes = []
  const attendus = new Set()

  for (const [recette, cle] of choisies) {
    const relatif = cle.replace(/^b\//, '')
    const source = path.join(PHOTOS, relatif)

    if (!connues.has(recette)) {
      problemes.push(`${recette} : aucune recette de ce nom dans catalog/recipes/`)
      continue
    }
    if (!existsSync(source)) {
      problemes.push(`${recette} : image absente du bac — ${relatif}`)
      continue
    }
    const credit = credits.get(relatif)
    if (!credit || !credit.url) {
      // Une photo sans crédit ne peut pas être publiée : 66 des 88 sont sous CC BY ou BY-SA.
      problemes.push(`${recette} : aucun crédit pour ${relatif} — photo NON importée`)
      continue
    }

    const nom = `${recette}.${ENCODAGE.extension}`
    const destination = path.join(SORTIE, nom)
    attendus.add(nom)

    // ⚠️ L'ORIENTATION EXIF D'ABORD, LE CADRE ENSUITE — et l'ordre n'est pas négociable. Le cadre a
    // été posé sur l'image TELLE QU'ELLE S'AFFICHE, donc déjà redressée. L'extraire avant la
    // rotation découperait dans une image couchée : un cadrage juste à l'écran, faux dans le
    // fichier, et rien ne le signalerait. `.rotate()` appelé avant `.extract()` garantit cet ordre.
    const meta = await sharp(source).metadata()
    // Les orientations EXIF 5 à 8 sont les quarts de tour : après redressement, largeur et hauteur
    // ont échangé. Le cadre étant en fractions de l'image REDRESSÉE, c'est sur ces valeurs-là qu'il
    // se calcule.
    const quartDeTour = (meta.orientation ?? 1) >= 5
    const largeurVue = quartDeTour ? meta.height : meta.width
    const hauteurVue = quartDeTour ? meta.width : meta.height

    const cadre = decisions[cle]?.cadre ?? null
    const rectangle = rectangleDuCadre(cadre, largeurVue, hauteurVue)
    if (cadre && rectangle === null) {
      // Un cadre posé à la main qui ne produit aucun rectangle est une ANOMALIE, pas un cas normal :
      // quelqu'un a passé du temps à le poser. On importe quand même — une photo non recadrée vaut
      // mieux que pas de photo — mais on le dit.
      problemes.push(`${recette} : cadre posé mais inexploitable — photo importée SANS recadrage`)
    }

    // `.rotate()` sans argument applique l'orientation EXIF puis laisse `sharp` jeter les
    // métadonnées — dont les coordonnées GPS, que personne n'a demandé à embarquer (principe 2).
    let pipeline = sharp(source).rotate()
    if (rectangle) pipeline = pipeline.extract(rectangle)
    const encodee = await pipeline
      .resize({ width: ENCODAGE.largeurMax, withoutEnlargement: true })
      .avif({ quality: ENCODAGE.qualite, effort: ENCODAGE.effort })
      .toBuffer()

    tailles.push(encodee.length)

    const identique = existsSync(destination) && readFileSync(destination).equals(encodee)
    if (!identique && !blanc) {
      writeFileSync(destination, encodee)
      touches.push(path.relative(RACINE, destination).replace(/\\/g, '/'))
    }

    const fichierYaml = path.join(RECETTES, `${recette}.yaml`)
    const { texte, remplacee, presente } = poserImagePath(readFileSync(fichierYaml, 'utf8'), `${URL_BASE}/${nom}`)
    if (!presente) {
      problemes.push(`${recette} : aucune clé image_path dans son YAML — champ jamais posé ?`)
    } else if (remplacee && !blanc) {
      writeFileSync(fichierYaml, texte)
      touches.push(path.relative(RACINE, fichierYaml).replace(/\\/g, '/'))
    }

    const licence = normaliserLicence(credit.licence)
    lignesCredits.push(
      `| \`${recette}\` | ${credit.auteur || '—'} | ${licence.url ? `[${licence.nom}](${licence.url})` : licence.nom} | [${credit.source}](${credit.url}) |`
    )
  }

  // Les recettes sans photo doivent porter `null`, y compris celles qui en avaient une avant : ce
  // script est la seule autorité sur ce champ, et un chemin resté derrière désignerait un fichier
  // supprimé.
  let effaces = 0
  for (const recette of connues) {
    if (choisies.has(recette)) continue
    const fichierYaml = path.join(RECETTES, `${recette}.yaml`)
    const { texte, remplacee } = poserImagePath(readFileSync(fichierYaml, 'utf8'), null)
    if (!remplacee) continue
    effaces += 1
    if (!blanc) {
      writeFileSync(fichierYaml, texte)
      touches.push(path.relative(RACINE, fichierYaml).replace(/\\/g, '/'))
    }
  }

  // Crédits — le bloc entier est régénéré, jamais complété.
  const entete = [
    '## Photos de recettes',
    '',
    `**${lignesCredits.length} photos**, une par recette, ré-encodées en AVIF (${ENCODAGE.largeurMax} px au plus) par`,
    '`catalog/import-photos.mjs`. Les originaux ne sont pas versionnés ; ce tableau et le champ',
    '`image_path` de chaque recette sont la seule trace de leur provenance.',
    '',
    "⚠️ La majorité de ces photos sont sous licence Creative Commons **BY** ou **BY-SA** :",
    "l'attribution ci-dessous est une **obligation de la licence**, et elle doit suivre l'image",
    'partout où elle est redistribuée — y compris dans un partage `.nutri-recipe`.',
    '',
    '| Recette | Auteur | Licence | Source |',
    '|---|---|---|---|',
  ]
  const bloc = [...entete, ...lignesCredits].join('\n')
  const avant = readFileSync(CREDITS, 'utf8')
  const apres = poserBlocCredits(avant, bloc)
  if (apres !== avant && !blanc) {
    writeFileSync(CREDITS, apres)
    touches.push('catalog/CREDITS.md')
  }

  // Images orphelines — signalées par défaut, supprimées seulement sur demande explicite.
  const orphelines = existsSync(SORTIE)
    ? readdirSync(SORTIE).filter((f) => f.endsWith(`.${ENCODAGE.extension}`) && !attendus.has(f))
    : []
  for (const orpheline of orphelines) {
    if (elaguer && !blanc) {
      unlinkSync(path.join(SORTIE, orpheline))
      touches.push(`app/public/catalog/images/${orpheline} (supprimée)`)
    }
  }

  // ── Rapport
  tailles.sort((a, b) => a - b)
  const total = tailles.reduce((a, b) => a + b, 0)
  console.log(`importées : ${tailles.length} photos`)
  if (tailles.length > 0) {
    console.log(`poids     : ${(total / 1048576).toFixed(2)} Mo · médiane ${ko(tailles[tailles.length >> 1])} · p90 ${ko(tailles[Math.floor(tailles.length * 0.9)])} · max ${ko(tailles[tailles.length - 1])}`)
    console.log(`            ${tailles.filter((o) => o <= 40960).length}/${tailles.length} sous le budget de 40 Ko`)
  }
  console.log(`image_path: ${lignesCredits.length} recettes servies, ${connues.size - lignesCredits.length} à null${effaces > 0 ? ` (dont ${effaces} remises à null)` : ''}`)

  if (orphelines.length > 0) {
    console.log(`\n⚠️ ${orphelines.length} image(s) orpheline(s) dans app/public/catalog/images/ :`)
    for (const o of orphelines) console.log(`   ${o}`)
    if (!elaguer) console.log('   → relancer avec --prune pour les supprimer.')
  }

  if (problemes.length > 0) {
    console.log(`\n⚠️ ${problemes.length} problème(s) :`)
    for (const p of problemes) console.log(`   ${p}`)
  }

  if (blanc) {
    console.log('\n[--dry] aucun fichier écrit.')
  } else if (touches.length === 0) {
    console.log('\nAucun fichier modifié — l’arbre était déjà à jour.')
  } else {
    console.log(`\n${touches.length} fichier(s) écrit(s). À passer à git add, un par un :`)
    for (const t of touches) console.log(`   ${t}`)
  }

  return problemes.length > 0 ? 1 : 0
}

// Ne s'exécute que lancé directement : les tests importent les fonctions pures sans déclencher
// l'import, qui a besoin d'un bac hors dépôt.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((erreur) => {
      console.error(erreur instanceof ErreurImport ? `\n${erreur.message}` : erreur)
      process.exit(1)
    })
}
