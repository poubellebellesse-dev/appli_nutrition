#!/usr/bin/env node
// catalog/build-icons.mjs — génère les icônes PNG de l'application.
//
// ⚠️ POURQUOI UN GÉNÉRATEUR ET NON DES FICHIERS BINAIRES COMMITTÉS. Une icône PNG déposée dans le
// dépôt est un artefact opaque : personne ne peut la relire, la corriger, ni savoir d'où sortent ses
// couleurs. Ici le dessin EST le code — changer l'accent dans `theme.css` et relancer ce script
// suffit à régénérer un jeu cohérent. Les PNG produits restent committés (le build de la PWA ne doit
// pas dépendre de ce script), mais ils sont reproductibles à l'octet près.
//
// ⚠️ AUCUNE DÉPENDANCE. L'encodage PNG tient en une trentaine de lignes avec le `zlib` de Node :
// en-tête, IHDR, IDAT compressé, IEND. Ajouter `sharp` ou `canvas` pour dessiner deux cercles
// ferait entrer une chaîne de compilation native dans un projet qui n'en a aucune.
//
// Le motif reprend l'icône de l'onglet « Aujourd'hui » (une assiette vue de dessus) : l'icône de
// l'application et celle de son premier écran racontent la même chose.
//
// Usage : node catalog/build-icons.mjs [--out app/public/icons]

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.join(__dirname, '..')

// --- Couleurs, reprises de app/src/ui/theme.css ------------------------------------------------
const TERRACOTTA = [0xa3, 0x54, 0x2f] // --color-accent-plein
const CREME = [0xfa, 0xf6, 0xef] // --color-fond

// --- Encodage PNG -------------------------------------------------------------------------------

const TABLE_CRC = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (const octet of buf) crc = TABLE_CRC[(crc ^ octet) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function bloc(type, data) {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(data.length)
  const typeEtData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const controle = Buffer.alloc(4)
  controle.writeUInt32BE(crc32(typeEtData))
  return Buffer.concat([longueur, typeEtData, controle])
}

/** RGBA non entrelacé, 8 bits par canal. Chaque ligne est préfixée de son octet de filtre (0). */
function encoderPng(taille, pixels) {
  const brut = Buffer.alloc((taille * 4 + 1) * taille)
  for (let y = 0; y < taille; y++) {
    brut[y * (taille * 4 + 1)] = 0
    pixels.copy(brut, y * (taille * 4 + 1) + 1, y * taille * 4, (y + 1) * taille * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(taille, 0)
  ihdr.writeUInt32BE(taille, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 6 // couleur : RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

// --- Dessin ------------------------------------------------------------------------------------

/** Sur-échantillonnage 4×4 par pixel : sans lui, les cercles crénellent visiblement à 192 px. */
const SUR_ECHANTILLON = 4

function dansCarreArrondi(x, y, taille, rayon) {
  const dx = Math.max(rayon - x, 0, x - (taille - rayon))
  const dy = Math.max(rayon - y, 0, y - (taille - rayon))
  return Math.hypot(dx, dy) <= rayon
}

/**
 * Une assiette vue de dessus : un anneau (le bord) et un disque (le creux).
 *
 * `maskable` change deux choses, et les deux comptent :
 *   - le fond est À FOND PERDU (pas de coins arrondis) : Android applique SON propre masque, et un
 *     carré déjà arrondi donnerait un double arrondi disgracieux ;
 *   - le motif est réduit pour tenir dans la ZONE DE SÉCURITÉ, un cercle de 80 % du côté. Ce qui
 *     déborde peut être rogné selon le masque du constructeur.
 */
function dessiner(taille, maskable) {
  const pixels = Buffer.alloc(taille * taille * 4)
  const centre = taille / 2
  const echelle = maskable ? 0.8 : 1
  const rayonFond = taille * 0.22

  const anneauExterne = taille * 0.36 * echelle
  const anneauInterne = taille * 0.29 * echelle
  const creux = taille * 0.13 * echelle

  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      let couvertureFond = 0
      let couvertureMotif = 0

      for (let sy = 0; sy < SUR_ECHANTILLON; sy++) {
        for (let sx = 0; sx < SUR_ECHANTILLON; sx++) {
          const px = x + (sx + 0.5) / SUR_ECHANTILLON
          const py = y + (sy + 0.5) / SUR_ECHANTILLON
          if (maskable || dansCarreArrondi(px, py, taille, rayonFond)) couvertureFond++
          const d = Math.hypot(px - centre, py - centre)
          if ((d <= anneauExterne && d >= anneauInterne) || d <= creux) couvertureMotif++
        }
      }

      const total = SUR_ECHANTILLON * SUR_ECHANTILLON
      const alpha = couvertureFond / total
      const motif = couvertureMotif / total
      const i = (y * taille + x) * 4
      for (let c = 0; c < 3; c++) {
        pixels[i + c] = Math.round(TERRACOTTA[c] * (1 - motif) + CREME[c] * motif)
      }
      pixels[i + 3] = Math.round(alpha * 255)
    }
  }
  return pixels
}

// --- Sortie --------------------------------------------------------------------------------------

const argOut = process.argv.indexOf('--out')
const dossier = argOut >= 0 ? process.argv[argOut + 1] : path.join(RACINE, 'app', 'public', 'icons')
mkdirSync(dossier, { recursive: true })

// 192 et 512 sont les deux tailles EXIGÉES par Bubblewrap pour empaqueter en TWA ; sans elles,
// l'outil refuse le manifest. La variante maskable évite l'icône « pastille dans un cercle blanc »
// sur Android.
const ICONES = [
  { fichier: 'icone-192.png', taille: 192, maskable: false },
  { fichier: 'icone-512.png', taille: 512, maskable: false },
  { fichier: 'icone-maskable-512.png', taille: 512, maskable: true },
  // Utilisée par iOS pour l'écran d'accueil ; iOS ignore le manifest et lit `apple-touch-icon`.
  { fichier: 'apple-touch-icon.png', taille: 180, maskable: true },
]

for (const { fichier, taille, maskable } of ICONES) {
  const png = encoderPng(taille, dessiner(taille, maskable))
  writeFileSync(path.join(dossier, fichier), png)
  console.log(`${fichier.padEnd(26)} ${String(taille).padStart(3)}px  ${png.length} octets`)
}
