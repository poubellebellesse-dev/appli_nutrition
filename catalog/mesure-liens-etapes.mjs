// catalog/mesure-liens-etapes.mjs — combien de gestes le rapprochement couvre-t-il, et où rate-t-il ?
//
// ⚠️ HORS DU BUILD, comme `catalog/audit-mapping.mjs` dont il partage la nature : un script qu'on
// lance À LA MAIN. `build.mjs` ne l'appelle pas et ne doit jamais l'appeler — il ne produit aucune
// donnée, il produit un CHIFFRE pour décider. Il ne modifie aucun fichier.
//
// ⚠️ IL VIT ICI ET NON DANS `atelier/`, QUI EST GITIGNORÉ (.gitignore:35). Une sonde qu'on ne
// committe pas ne prouve rien à personne d'autre : la décision 60 s'est jouée sur ses chiffres, ils
// doivent pouvoir être rejoués par quelqu'un qui n'était pas là.
//
// ⚠️ IL N'IMPLÉMENTE RIEN. Toute la logique vit dans `lien-etape-ingredient.mjs`, celle-là même que
// le build exécute. C'est la condition pour que la mesure décrive ce qui est RÉELLEMENT écrit dans
// `recipe_step_ingredient` : une seconde implémentation dériverait, et le chiffre cesserait
// silencieusement de vouloir dire quelque chose.
//
// CE QU'IL RÉPOND, ET CE QU'IL NE RÉPOND PAS
//
// Il répond : « en partant des ingrédients de LA recette, combien de gestes trouvent au moins un
// ingrédient, combien n'en trouvent aucun, par quel mécanisme ? »
//
// Il NE répond PAS : « le rapprochement est-il JUSTE ? » Aucune vérité de terrain n'existe — la
// fabriquer, c'est l'annotation manuelle des 1 350 gestes que la décision 60 a refusée. D'où les
// échantillons imprimés en fin : le verdict se prend à l'œil, sur des cas réels, jamais sur un
// pourcentage.
//
// ⚠️ LE RISQUE À CHIFFRER N'EST PAS « CONFONDRE L'AIL ET LA TOMATE ». Sur un ensemble fermé de ~7
// candidats, cette confusion n'arrive pas. C'est l'OUBLI SILENCIEUX qui compte : une étape cite le
// cumin, le rapprochement le manque. Tant que l'écran AJOUTE une information sans en retrancher, cet
// oubli est sans conséquence — la liste complète reste sous les yeux (L1bis). Le jour où quelqu'un
// voudra FILTRER, c'est cette colonne-là qu'il devra regarder d'abord.
//
//   node catalog/mesure-liens-etapes.mjs           → les compteurs
//   node catalog/mesure-liens-etapes.mjs --detail  → + les étapes sans lien et les ingrédients muets

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { liensDeLaRecette, rapprocherEtape } from './lien-etape-ingredient.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const FOODS = path.join(ICI, 'sources', 'foods.yaml')
const RECETTES = path.join(ICI, 'recipes')

const detail = process.argv.includes('--detail')

const aliments = new Map((parseYaml(await readFile(FOODS, 'utf8')).foods ?? []).map((a) => [a.id, a]))
const fichiers = (await readdir(RECETTES)).filter((f) => f.endsWith('.yaml'))

let gestes = 0
let avecLien = 0
let sansLien = 0
let ambigus = 0
let liensPoses = 0
let ingredientsTotal = 0
const parVerdict = { complet: 0, tete: 0, verbe: 0, groupe: 0, herite: 0 }
const sansLienExemples = []
const jamaisCites = []

for (const fichier of fichiers) {
  const recette = parseYaml(await readFile(path.join(RECETTES, fichier), 'utf8'))
  const candidats = (recette.ingredients ?? [])
    .map((i) => aliments.get(i.food_id))
    .filter((a) => a !== undefined)

  // Ce que le BUILD écrira. C'est la source du compte — pas une approximation à côté.
  const liens = liensDeLaRecette(recette, aliments)
  const vus = new Set()

  for (const etape of recette.etapes ?? []) {
    if ((etape.nature ?? 'geste') !== 'geste') continue
    gestes++
    const lien = liens.get(etape.ordre) ?? { ids: [], origine: 'derive' }

    if (lien.ids.length === 0) {
      sansLien++
      if (sansLienExemples.length < 40) sansLienExemples.push(`${recette.id} #${etape.ordre} — ${etape.texte}`)
    } else {
      avecLien++
      liensPoses += lien.ids.length
      for (const id of lien.ids) vus.add(id)
    }

    // Le DÉTAIL des mécanismes n'intéresse pas le build, qui n'a besoin que du résultat : on rejoue
    // le rapprochement pour l'obtenir, sans jamais le réimplémenter.
    if (lien.origine === 'herite') {
      parVerdict.herite += lien.ids.length
    } else if (lien.origine === 'derive') {
      const { trouves, ambigus: amb } = rapprocherEtape(etape.texte, candidats)
      for (const t of trouves) parVerdict[t.verdict]++
      if (amb.length > 0) ambigus++
    }
  }

  ingredientsTotal += candidats.length
  for (const a of candidats) if (!vus.has(a.id)) jamaisCites.push(`${recette.id} : ${a.id}`)
}

const pc = (n, sur) => (sur > 0 ? ((n / sur) * 100).toFixed(1) + ' %' : '—')

console.log(`\n  RAPPROCHEMENT ÉTAPE → INGRÉDIENT`)
console.log(`  Candidats : les ingrédients de LA recette, jamais les 450 du catalogue.\n`)
console.log(`  Recettes lues .................. ${fichiers.length}`)
console.log(`  Gestes analysés ................ ${gestes}`)
console.log(`  ├─ au moins un ingrédient ...... ${avecLien}  (${pc(avecLien, gestes)})`)
console.log(`  └─ AUCUN ingrédient trouvé ..... ${sansLien}  (${pc(sansLien, gestes)})`)
console.log(`  Étapes portant une ambiguïté ... ${ambigus}  (${pc(ambigus, gestes)})`)
console.log(`\n  Liens posés .................... ${liensPoses}  (${(liensPoses / gestes).toFixed(2)} par geste)`)
console.log(`  ├─ forme complète .............. ${parVerdict.complet}`)
console.log(`  ├─ mot de tête seul ............ ${parVerdict.tete}`)
console.log(`  ├─ par un verbe ................ ${parVerdict.verbe}`)
console.log(`  ├─ par hyperonyme → groupe ..... ${parVerdict.groupe}`)
console.log(`  └─ hérité du pronom ............ ${parVerdict.herite}`)
console.log(
  `\n  Ingrédients jamais cités par aucune étape : ${jamaisCites.length} / ${ingredientsTotal}  (${pc(jamaisCites.length, ingredientsTotal)})`
)
console.log(`  ⚠️ Ce nombre MÊLE deux choses : le sel, l'huile et le poivre qui échappent`)
console.log(`     légitimement au fil des étapes, et les vrais oublis. Seul l'œil les sépare.\n`)

if (detail) {
  console.log(`  ── Étapes sans aucun lien (40 premières) ──────────────────────────────────────`)
  for (const e of sansLienExemples) console.log(`  · ${e}`)
  console.log(`\n  ── Ingrédients jamais cités (40 premiers) ─────────────────────────────────────`)
  for (const e of jamaisCites.slice(0, 40)) console.log(`  · ${e}`)
  console.log()
}
