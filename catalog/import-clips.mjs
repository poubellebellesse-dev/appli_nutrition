#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// import-clips.mjs — porte les segments encodés du bac de l'atelier vers le dépôt.
//
// Jumeau de `catalog/import-photos.mjs`, et volontairement de la MÊME forme : il copie les
// fichiers, écrit les chemins dans les YAML du lexique, et régénère un bloc de crédits. Les trois
// gestes vont ensemble — un fichier copié sans sa ligne de crédit, ou un chemin écrit sans son
// fichier, sont exactement les deux pannes silencieuses que ce dépôt a déjà payées.
//
// CE QUI SORT DU BAC, ET RIEN D'AUTRE : le bac (`G:\Claude\Dessinateur\gestes`) est hors dépôt et
// n'existe QUE sur une machine. Les binaires sont donc versionnés (décision D4) : ne pas les
// versionner produirait, sur toute autre machine, un catalogue sans clips SANS lever d'erreur.
//
// ⚠️ DEUX FORMATS PAR SEGMENT, JAMAIS UN (décision D2). Safari ne décode l'AV1 que sur matériel
// récent ; sans repli H.264, un iPhone un peu ancien n'afficherait que le poster sans que
// l'utilisateur sache qu'il manque quelque chose. Un segment amputé d'un format est REFUSÉ ici,
// pas importé à moitié.
//
// ⚠️ `--gestes` N'EST PAS UNE COMMODITÉ DE MISE AU POINT. Chaque segment importé pèse dans
// l'historique git POUR TOUJOURS ; les 98 segments font 22,43 Mo. Restreindre la portée est le seul
// moyen de produire un échantillon montrable sans graver le lot complet avant qu'il soit décidé.
//
// Usage :
//   node catalog/import-clips.mjs                     → tous les gestes décidés « oui »
//   node catalog/import-clips.mjs --gestes reduire,deglacer,emincer
//   node catalog/import-clips.mjs --dry               → n'écrit rien, dit ce qu'il ferait
// ─────────────────────────────────────────────────────────────────────────────

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Le bac de l'atelier, hors dépôt. Même défaut que `import-photos.mjs` pour les photos. */
const BAC = process.env.BAC_GESTES ?? 'G:\\Claude\\Dessinateur\\gestes'
const VIDEOS = path.join(BAC, 'videos')
const DECISIONS = path.join(RACINE, 'atelier', 'gestes', 'etat', 'clips-decisions.json')

const LEXIQUE = path.join(RACINE, 'catalog', 'lexicon')
const SORTIE = path.join(RACINE, 'app', 'public', 'catalog', 'gestes')
const CREDITS = path.join(RACINE, 'catalog', 'CREDITS.md')

/** URL publique, symétrique de `/catalog/images` côté photos. */
const URL_BASE = '/catalog/gestes'

/**
 * Ordre canonique des moments. **C'est lui qui fixe la colonne `ordre` en base**, pas l'ordre du
 * fichier de décisions : la bande de vignettes doit montrer le début avant la fin, toujours.
 * `unique` ne cohabite avec aucun autre — un geste en a un seul, ou n'en a pas.
 */
const ORDRE_MOMENTS = ['debut', 'milieu', 'fin', 'unique']

const MARQUE_DEBUT = '<!-- DÉBUT CLIPS — bloc généré par catalog/import-clips.mjs, ne pas éditer à la main -->'
const MARQUE_FIN = '<!-- FIN CLIPS -->'

class ErreurImport extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Sélection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Des décisions de l'atelier, tire les gestes retenus. **Les moments ne viennent PAS d'ici.**
 *
 * ⛔ LE FICHIER DE DÉCISIONS N'EST PAS UN INDEX DE CE QUI EXISTE, mesuré le 2026-08-16 : sur les
 * 51 gestes décidés « oui », **`emincer` diverge** — la décision porte `debut` + `milieu`, le bac
 * contient un unique `emincer-unique`. Il a été ré-encodé en un seul segment sans que la décision
 * soit reprise. C'est exactement l'écart « 99 décidés / 98 encodés » que la documentation portait
 * comme inexpliqué : ce n'est pas un segment jamais produit, c'est un 2→1 sur ce geste-là.
 *
 * ⇒ La décision dit **si** on importe et **à qui appartient la vidéo** ; le dossier `encode/` dit
 * **ce qui existe**. Les confondre importerait des chemins vers des fichiers absents, et laisserait
 * de côté des fichiers réellement encodés — deux pannes qu'aucun test du catalogue ne verrait.
 *
 * @param {Record<string, {decision?: string, cle?: string, dossierRecolte?: string, segments?: {role: string}[]}>} decisions
 * @param {Set<string>|null} portee gestes à retenir, ou `null` pour tous
 * @returns {{geste: string, cle: string, dossier: string, decides: string[]}[]}
 */
export function choisirGestes(decisions, portee) {
  const retenus = []
  for (const [geste, d] of Object.entries(decisions)) {
    if (d?.decision !== 'oui') continue
    if (portee && !portee.has(geste)) continue
    const decides = (d.segments ?? []).map((s) => s.role).filter((r) => ORDRE_MOMENTS.includes(r))
    retenus.push({ geste, cle: d.cle ?? '', dossier: d.dossierRecolte || geste, decides })
  }
  return retenus.sort((a, b) => a.geste.localeCompare(b.geste))
}

/**
 * Les moments RÉELLEMENT encodés dans le bac, rangés dans l'ordre canonique.
 *
 * On énumère par le fichier AV1 : c'est le format obligatoire de tête (décision D2), et exiger sa
 * présence ici évite de fabriquer un segment à partir d'un poster resté seul.
 *
 * @param {string} encode dossier `encode/` du geste
 * @param {string} geste
 * @returns {string[]}
 */
export function momentsEncodes(encode, geste) {
  const motif = new RegExp(`^${geste}-(${ORDRE_MOMENTS.join('|')})\\.av1\\.mp4$`)
  return readdirSync(encode)
    .map((f) => motif.exec(f)?.[1])
    .filter((m) => m !== undefined)
    .sort((a, b) => ORDRE_MOMENTS.indexOf(a) - ORDRE_MOMENTS.indexOf(b))
}

/**
 * Retrouve, dans la récolte, la fiche du candidat qui a servi à encoder — auteur, licence, page.
 *
 * ⚠️ SANS ELLE ON N'IMPORTE PAS. L'attribution n'est pas décorative : Pexels la demande, et le
 * principe 3 du projet interdit d'embarquer un média dont on ne sait pas dire d'où il vient.
 *
 * @param {string} dossier
 * @param {string} cle
 * @returns {{auteur: string, auteurUrl: string, licence: string, page: string}}
 */
function chargerCredit(dossier, cle) {
  const chemin = path.join(VIDEOS, dossier, 'candidats.json')
  if (!existsSync(chemin)) throw new ErreurImport(`candidats.json introuvable : ${chemin}`)
  const recolte = JSON.parse(readFileSync(chemin, 'utf8'))
  const candidat = (recolte.candidats ?? []).find((c) => c.cle === cle)
  if (!candidat) throw new ErreurImport(`candidat « ${cle} » absent de ${chemin}`)
  return {
    auteur: candidat.auteur ?? '',
    auteurUrl: candidat.auteurUrl ?? '',
    licence: candidat.licence ?? '',
    page: candidat.page ?? '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remplace le bloc `clips:` d'un geste, LIGNE À LIGNE.
 *
 * ⚠️ SURTOUT PAS DE `parse` PUIS `stringify` — même motif que `poserImagePath` dans
 * `import-photos.mjs` : ces 62 fichiers portent des commentaires et une mise en forme choisis à la
 * main, et les relire par la bibliothèque YAML les reformaterait tous en écrasant le travail d'une
 * autre session sans qu'aucun test ne s'en aperçoive.
 *
 * ⚠️ LA FIN DE LIGNE D'ORIGINE EST CONSERVÉE, pour la même raison que côté photos : écrire en LF
 * un fichier CRLF le salit en entier et le fait voir comme modifié alors qu'il ne l'est pas.
 *
 * @param {string} yaml
 * @param {{moment: string, poster: string, av1: string, h264: string}[]} clips vide = efface le bloc
 * @returns {{texte: string, change: boolean}}
 */
export function poserClips(yaml, clips) {
  const crlf = yaml.includes('\r\n')
  const eol = crlf ? '\r\n' : '\n'
  const lignes = yaml.split(/\r?\n/)

  // Retire un bloc `clips:` existant : de sa clé jusqu'à la prochaine clé de premier niveau.
  // Ancré en colonne 0 — une clé `clips` imbriquée ne doit pas être confondue avec elle.
  const debut = lignes.findIndex((l) => /^clips:/.test(l))
  if (debut !== -1) {
    let fin = debut + 1
    while (fin < lignes.length && !/^\S/.test(lignes[fin])) fin += 1
    lignes.splice(debut, fin - debut)
  }

  while (lignes.length > 0 && lignes[lignes.length - 1].trim() === '') lignes.pop()

  if (clips.length > 0) {
    lignes.push('')
    lignes.push('# Segments vidéo — bloc généré par catalog/import-clips.mjs, ne pas éditer à la main.')
    lignes.push('clips:')
    for (const c of clips) {
      lignes.push(`  - moment: ${c.moment}`)
      lignes.push(`    poster_path: ${c.poster}`)
      lignes.push(`    av1_path: ${c.av1}`)
      lignes.push(`    h264_path: ${c.h264}`)
    }
  }

  const texte = lignes.join(eol) + eol
  return { texte, change: texte !== yaml }
}

/**
 * Insère ou remplace le bloc de crédits vidéo dans `CREDITS.md`.
 * Copie conforme de `poserBlocCredits` côté photos — le bloc est régénéré, jamais complété.
 *
 * @param {string} markdown
 * @param {string} bloc
 * @returns {string}
 */
export function poserBlocClips(markdown, bloc) {
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
// Programme
// ─────────────────────────────────────────────────────────────────────────────

const ko = (octets) => `${Math.round(octets / 1024)} Ko`

function main(argv) {
  const blanc = argv.includes('--dry')
  const drapeau = argv.indexOf('--gestes')
  const portee =
    drapeau !== -1 && argv[drapeau + 1]
      ? new Set(argv[drapeau + 1].split(',').map((s) => s.trim()).filter(Boolean))
      : null

  if (!existsSync(DECISIONS)) throw new ErreurImport(`clips-decisions.json introuvable : ${DECISIONS}`)
  if (!existsSync(VIDEOS)) {
    throw new ErreurImport(
      `Le bac de clips est introuvable : ${VIDEOS}\nIl est hors dépôt et n'existe que sur une machine ; poser BAC_GESTES pour le désigner.`
    )
  }

  const decisions = JSON.parse(readFileSync(DECISIONS, 'utf8'))
  const retenus = choisirGestes(decisions, portee)
  if (portee) {
    const absents = [...portee].filter((g) => !retenus.some((r) => r.geste === g))
    if (absents.length > 0) throw new ErreurImport(`gestes demandés mais non décidés « oui » : ${absents.join(', ')}`)
  }

  const connus = new Set(readdirSync(LEXIQUE).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)))

  const lignesCredits = []
  const touches = []
  const problemes = []
  const divergences = []
  let octets = 0
  let segments = 0

  for (const { geste, cle, dossier, decides } of retenus) {
    // ⚠️ LE PIÈGE DU TIRET, DÉJÀ NOMMÉ DANS LA FICHE DE REPRISE : le bac écrit `bain_marie`,
    // `monter_blancs`, `tailler_des` là où le lexique écrit un tiret. Un geste qui ne tombe pas
    // sur son YAML est SIGNALÉ, jamais importé en silence vers un code qui n'existe pas.
    if (!connus.has(geste)) {
      problemes.push(`${geste} : aucun ${geste}.yaml dans catalog/lexicon — code du bac et code du lexique divergent ?`)
      continue
    }

    const encode = path.join(VIDEOS, geste, 'encode')
    if (!existsSync(encode)) {
      problemes.push(`${geste} : aucun dossier encode dans le bac (${encode})`)
      continue
    }

    const moments = momentsEncodes(encode, geste)
    if (moments.length === 0) {
      problemes.push(`${geste} : dossier encode présent mais aucun ${geste}-<moment>.av1.mp4 dedans`)
      continue
    }
    // Divergence décision ↔ bac : signalée, jamais silencieuse. Le bac gagne (voir `choisirGestes`).
    const attendus = [...decides].sort().join('/')
    const reels = [...moments].sort().join('/')
    if (attendus !== reels) {
      divergences.push(`${geste} : décidé « ${attendus || '—'} », encodé « ${reels} » — le bac fait foi`)
    }

    const credit = chargerCredit(dossier, cle)
    const destination = path.join(SORTIE, geste)
    const clips = []
    let complet = true

    for (const moment of moments) {
      const sources = {
        poster: path.join(encode, `${geste}-${moment}.jpg`),
        av1: path.join(encode, `${geste}-${moment}.av1.mp4`),
        h264: path.join(encode, `${geste}-${moment}.h264.mp4`),
      }
      // Les DEUX formats et le poster, ou rien. Un segment à moitié importé se verrait à
      // l'écran comme une image fixe muette, sans qu'aucune erreur ne soit levée.
      const manquants = Object.entries(sources).filter(([, f]) => !existsSync(f)).map(([n]) => n)
      if (manquants.length > 0) {
        problemes.push(`${geste}-${moment} : fichier(s) absent(s) du bac — ${manquants.join(', ')}`)
        complet = false
        continue
      }

      if (!blanc) mkdirSync(destination, { recursive: true })
      for (const [role, source] of Object.entries(sources)) {
        const nom = path.basename(source)
        octets += statSync(source).size
        if (blanc) continue
        copyFileSync(source, path.join(destination, nom))
        void role
      }
      segments += 1
      clips.push({
        moment,
        poster: `${URL_BASE}/${geste}/${geste}-${moment}.jpg`,
        av1: `${URL_BASE}/${geste}/${geste}-${moment}.av1.mp4`,
        h264: `${URL_BASE}/${geste}/${geste}-${moment}.h264.mp4`,
      })
    }

    if (clips.length === 0) continue

    const fichierYaml = path.join(LEXIQUE, `${geste}.yaml`)
    const { texte, change } = poserClips(readFileSync(fichierYaml, 'utf8'), clips)
    if (change && !blanc) {
      writeFileSync(fichierYaml, texte)
      touches.push(path.relative(RACINE, fichierYaml).replace(/\\/g, '/'))
    }

    lignesCredits.push(
      `| \`${geste}\` | ${clips.length}${complet ? '' : ' ⚠'} | ${credit.auteur ? `[${credit.auteur}](${credit.auteurUrl})` : '—'} | ${credit.licence || '—'} | [Pexels](${credit.page}) |`
    )
  }

  // Crédits — le bloc entier est régénéré, jamais complété.
  const entete = [
    '## Clips de gestes',
    '',
    `**${segments} segments vidéo** sur **${lignesCredits.length} gestes**, découpés à 3 s et ré-encodés`,
    "en AV1 et H.264 par `catalog/import-clips.mjs`, plus une image fixe par segment. Les vidéos",
    "d'origine ne sont pas versionnées ; ce tableau et le bloc `clips` de chaque geste sont la seule",
    'trace de leur provenance.',
    '',
    "⚠️ L'attribution ci-dessous est portée **même là où la licence ne l'exige pas**. La licence",
    'Pexels autorise l\'usage sans crédit ; le projet en pose un quand même, parce qu\'un média',
    "embarqué dont on ne sait plus dire d'où il vient ne peut plus être retiré proprement.",
    '',
    '| Geste | Segments | Auteur | Licence | Source |',
    '|---|---|---|---|---|',
  ]
  const bloc = [...entete, ...lignesCredits].join('\n')
  const avant = readFileSync(CREDITS, 'utf8')
  const apres = poserBlocClips(avant, bloc)
  if (apres !== avant && !blanc) {
    writeFileSync(CREDITS, apres)
    touches.push('catalog/CREDITS.md')
  }

  console.log(
    `${blanc ? '[à blanc] ' : ''}clips : ${segments} segments sur ${lignesCredits.length} gestes, ${ko(octets)} copiés vers app/public/catalog/gestes`
  )
  if (portee) {
    console.log(`portée restreinte à ${[...portee].join(', ')} — les autres gestes décidés « oui » n'ont PAS été importés.`)
  }
  if (touches.length > 0) console.log(`fichiers écrits : ${touches.length}`)
  if (divergences.length > 0) {
    console.log(`\n⚠ ${divergences.length} divergence(s) décision ↔ bac :`)
    for (const d of divergences) console.log(`  - ${d}`)
  }
  if (problemes.length > 0) {
    console.log(`\n⚠ ${problemes.length} problème(s) :`)
    for (const p of problemes) console.log(`  - ${p}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main(process.argv.slice(2))
  } catch (erreur) {
    if (erreur instanceof ErreurImport) {
      console.error(`✗ ${erreur.message}`)
      process.exit(1)
    }
    throw erreur
  }
}
