// catalog/gonfler-pour-mesure.mjs — fabrique un `catalog.db` ARTIFICIELLEMENT GROS, pour la seule
// mesure de la décision 61 (`ETAT.md` §4).
//
// ⛔ CE FICHIER NE FAIT PAS PARTIE DU BUILD, ET SON RÉSULTAT NE DOIT JAMAIS ÊTRE COMMITÉ NI EXPÉDIÉ.
// Il duplique des recettes existantes en changeant leur identifiant et leur nom. Le catalogue qu'il
// produit est mensonger sur tout sauf sur une chose : le NOMBRE de cartes que l'écran Recettes doit
// rendre. C'est exactement ce que la 61 demande de mesurer, et rien d'autre.
//
// ⚠️ CE QUE CE CATALOGUE FAUSSE, à ne pas mesurer dessus par accident :
//   - la SIMILARITÉ — des copies conformes sont à 100 % l'une de l'autre, `engine:similarity` et
//     `engine:calibrate-lambda` y rendraient n'importe quoi ;
//   - la NUTRITION et la planification — `planWeek` piocherait des clones ;
//   - les COMPTEURS de facettes, gonflés dans les mêmes proportions.
// Il ne fausse PAS le coût de rendu d'une liste, qui ne dépend que du nombre de lignes.
//
// ⚠️ POURQUOI PAS UN DRAPEAU SUR `catalog/build.mjs` : parce que le vrai build ne doit pas porter,
// même désactivé, un chemin capable de produire un faux catalogue. Ici la séparation est physique —
// ce script part du `.db` DÉJÀ CONSTRUIT et en écrit un autre à côté ; il ne peut structurellement
// pas s'exécuter dans le build.
//
// Usage :
//   node catalog/gonfler-pour-mesure.mjs 500
//   node catalog/gonfler-pour-mesure.mjs 1000
//
// Écrit `app/public/catalog/catalog.db` APRÈS avoir sauvegardé l'original en `catalog.db.vrai`.
// Pour revenir : `node catalog/gonfler-pour-mesure.mjs --restaurer` (ou `npm run build`).

import { DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, '..', 'app', 'public', 'catalog', 'catalog.db')
const SAUVEGARDE = `${DB}.vrai`

/** Marque qui distingue un clone d'une recette réelle, dans l'identifiant comme dans le nom. */
const MARQUE = '__mesure'

function restaurer() {
  if (!existsSync(SAUVEGARDE)) {
    console.error(`Rien à restaurer : ${SAUVEGARDE} n'existe pas. Relancez \`npm run build\`.`)
    process.exitCode = 1
    return
  }
  copyFileSync(SAUVEGARDE, DB)
  unlinkSync(SAUVEGARDE)
  console.log('catalog.db restauré depuis la sauvegarde. Le vrai catalogue est de retour.')
}

function gonfler(cible) {
  if (!Number.isInteger(cible) || cible < 1) {
    console.error(`Cible invalide '${process.argv[2]}' — entier ≥ 1 attendu (nombre de recettes visé).`)
    process.exitCode = 1
    return
  }
  if (!existsSync(DB)) {
    console.error(`${DB} est absent — lancez \`npm run build\` d'abord.`)
    process.exitCode = 1
    return
  }
  // ⚠️ ON NE SAUVEGARDE QU'UNE FOIS. Gonfler deux fois de suite écraserait sinon la sauvegarde avec
  // un catalogue déjà gonflé, et le vrai serait perdu sans un mot.
  if (!existsSync(SAUVEGARDE)) copyFileSync(DB, SAUVEGARDE)

  const db = new DatabaseSync(DB)
  const reel = db.prepare('SELECT COUNT(*) n FROM recipe').get().n
  if (cible <= reel) {
    console.log(`Le catalogue porte déjà ${reel} recettes — rien à faire pour une cible de ${cible}.`)
    db.close()
    return
  }

  // Les tables filles à recopier pour que chaque clone soit une recette COMPLÈTE — une recette sans
  // ingrédient ni étape ne rendrait pas la même carte, et fausserait la mesure par le bas.
  const FILLES = [
    ['recipe_ingredient', 'recipe_id'],
    ['recipe_step', 'recipe_id'],
    ['recipe_facet', 'recipe_id'],
  ]
  const colonnes = (table) =>
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((c) => c.name)

  const colsRecette = colonnes('recipe')
  // ⛔ ON NE CLONE QUE DES ORIGINALES, JAMAIS UN CLONE. Deux raisons, la seconde a coûté un build :
  //   1. un clone de clone porterait un identifiant à double suffixe et un nom à double mention ;
  //   2. surtout, gonfler DEUX FOIS de suite (305 → 500 → 1 000, ce que fait `preparer-mesure-61`)
  //      reprenait les clones comme modèles et regénérait leur identifiant à l'identique —
  //      `UNIQUE constraint failed: recipe.id`. Invisible au premier gonflage.
  const modeles = db.prepare('SELECT * FROM recipe').all().filter((r) => !r.id.includes(MARQUE))

  db.exec('BEGIN')
  let ajoutees = 0
  for (let i = 0; ajoutees < cible - reel; i++) {
    const modele = modeles[i % modeles.length]
    // Le rang GLOBAL de la copie (`reel + i`), et non un numéro de tour : il ne se répète jamais,
    // même entre deux gonflages successifs, et c'est ce qui rend l'identifiant unique par
    // construction plutôt que par hypothèse sur l'état de départ.
    const rang = reel + i
    const nouvelId = `${modele.id}${MARQUE}${rang}`

    const valeurs = colsRecette.map((c) => {
      if (c === 'id') return nouvelId
      if (c === 'nom') return `${modele.nom} (copie de mesure ${rang})`
      return modele[c]
    })
    db.prepare(
      `INSERT INTO recipe (${colsRecette.join(', ')}) VALUES (${colsRecette.map(() => '?').join(', ')})`
    ).run(...valeurs)

    for (const [table, cle] of FILLES) {
      const cols = colonnes(table).filter((c) => c !== 'rowid')
      const lignes = db.prepare(`SELECT * FROM ${table} WHERE ${cle} = ?`).all(modele.id)
      for (const ligne of lignes) {
        const v = cols.map((c) => (c === cle ? nouvelId : ligne[c]))
        db.prepare(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...v)
      }
    }
    ajoutees++
  }
  db.exec('COMMIT')

  const total = db.prepare('SELECT COUNT(*) n FROM recipe').get().n
  db.close()
  console.log(`catalog.db GONFLÉ : ${reel} → ${total} recettes (${ajoutees} clones).`)
  console.log(`Original sauvegardé en ${path.basename(SAUVEGARDE)}.`)
  console.log('⛔ Ne commitez rien tant que ce fichier est en place. Pour revenir : --restaurer')
}

const arg = process.argv[2]
if (arg === '--restaurer') restaurer()
else gonfler(Number(arg))
