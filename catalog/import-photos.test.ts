// Tests des fonctions PURES de `catalog/import-photos.mjs`.
//
// Le script lui-même ne peut pas être joué ici : il lit le bac de l'atelier, qui vit HORS du dépôt
// (`BAC_PHOTOS`) et n'existe sur aucune machine de passage. Ce qui est testé, c'est tout ce qui
// décide — la sélection d'une photo par recette, la normalisation des licences, et les deux
// réécritures de fichier. C'est là que sont les pièges, pas dans l'appel à `sharp`.
//
// ⚠️ L'IMPORT NE DOIT RIEN EXÉCUTER. Le module ne lance `main()` que si on l'invoque directement
// (garde sur `process.argv[1]`) ; si cette garde saute, ces tests se mettront à encoder 88 photos.

import { describe, expect, it } from 'vitest'
// @ts-expect-error — module .mjs sans déclaration de types, importé pour ses fonctions pures.
import { choisirPhotos, normaliserLicence, poserImagePath, poserBlocCredits, rectangleDuCadre } from './import-photos.mjs'

describe('choisirPhotos', () => {
  it('ne retient que les `oui` rattachés à une recette', () => {
    // `hors-catalogue` porte `recette: null` : la photo désigne un plat qu'aucune recette ne nomme.
    const choix = choisirPhotos({
      'b/a/1.jpg': { decision: 'oui', recette: 'ratatouille', horodatage: '2026-08-01T00:00:00Z' },
      'b/a/2.jpg': { decision: 'non', recette: 'taboule', horodatage: '2026-08-02T00:00:00Z' },
      'b/a/3.jpg': { decision: 'mauvais-plat', recette: null, horodatage: '2026-08-03T00:00:00Z' },
      'b/a/4.jpg': { decision: 'oui', recette: null, horodatage: '2026-08-04T00:00:00Z' },
    })
    expect([...choix.keys()]).toEqual(['ratatouille'])
  })

  it('garde le DERNIER `oui` par horodatage quand une recette en a deux', () => {
    // Cinq recettes sont dans ce cas. La règle n'a jamais été arbitrée — si elle change, c'est ce
    // test qui doit changer d'abord.
    const choix = choisirPhotos({
      'b/a/vieille.jpg': { decision: 'oui', recette: 'taboule', horodatage: '2026-08-01T10:00:00Z' },
      'b/b/recente.jpg': { decision: 'oui', recette: 'taboule', horodatage: '2026-08-09T10:00:00Z' },
    })
    expect(choix.get('taboule')).toBe('b/b/recente.jpg')
  })

  it('rend un ordre stable, indépendant de l’ordre du journal', () => {
    // Sans cela, le bloc de crédits et le rapport bougeraient à chaque exécution et pollueraient le
    // diff git sans qu'aucune photo n'ait changé.
    const a = { decision: 'oui', recette: 'avocat', horodatage: '2026-08-01T00:00:00Z' }
    const b = { decision: 'oui', recette: 'boulgour', horodatage: '2026-08-02T00:00:00Z' }
    expect([...choisirPhotos({ 'b/x/1.jpg': b, 'b/x/2.jpg': a }).keys()]).toEqual(['avocat', 'boulgour'])
  })
})

describe('normaliserLicence', () => {
  it('ramène les trois écritures des banques à une seule', () => {
    // Commons dit « CC BY-SA 3.0 », Openverse dit « by-sa 2.0 » : c'est la même famille.
    expect(normaliserLicence('CC BY-SA 3.0').nom).toBe('CC BY-SA 3.0')
    expect(normaliserLicence('by-sa 2.0').nom).toBe('CC BY-SA 2.0')
    expect(normaliserLicence('by 2.0').nom).toBe('CC BY 2.0')
    expect(normaliserLicence('by 4.0').url).toBe('https://creativecommons.org/licenses/by/4.0/')
  })

  it('reconnaît CC0 sous ses deux écritures', () => {
    expect(normaliserLicence('CC0').nom).toBe('CC0 1.0')
    expect(normaliserLicence('cc0 1.0').nom).toBe('CC0 1.0')
  })

  it('reconnaît la licence Pexels, qui n’est pas une Creative Commons', () => {
    expect(normaliserLicence('Pexels License').url).toBe('https://www.pexels.com/license/')
  })

  it('recopie une licence inconnue au lieu d’en inventer une', () => {
    // Une licence mal nommée dans CREDITS.md se voit ; une licence devinée, non.
    expect(normaliserLicence('Licence maison v3')).toEqual({ nom: 'Licence maison v3', url: null })
    expect(normaliserLicence('').nom).toBe('licence inconnue')
  })
})

describe('poserImagePath', () => {
  const YAML = ['id: ratatouille', 'titre: Ratatouille', 'image_path: null', 'portions_base: 4'].join('\n')

  it('remplace la valeur sans toucher au reste du fichier', () => {
    const { texte, remplacee, presente } = poserImagePath(YAML, '/catalog/images/ratatouille.avif')
    expect(remplacee).toBe(true)
    expect(presente).toBe(true)
    expect(texte.split('\n')).toEqual([
      'id: ratatouille',
      'titre: Ratatouille',
      'image_path: /catalog/images/ratatouille.avif',
      'portions_base: 4',
    ])
  })

  it('est idempotent : repasser la même valeur ne réécrit rien', () => {
    // C'est ce qui permet de relancer l'import sans salir `git status`.
    const une = poserImagePath(YAML, '/catalog/images/ratatouille.avif').texte
    expect(poserImagePath(une, '/catalog/images/ratatouille.avif')).toMatchObject({ texte: une, remplacee: false })
  })

  it('remet à null, pour une recette qui perd sa photo', () => {
    const servie = poserImagePath(YAML, '/catalog/images/ratatouille.avif').texte
    expect(poserImagePath(servie, null).texte).toBe(YAML)
  })

  it('signale un YAML sans clé image_path au lieu de l’ajouter en silence', () => {
    // Piège maison : un champ déclaré n'est pas un champ branché. Si la clé disparaît d'un gabarit
    // de recette, il faut que ça se voie ici et non trois lots plus tard à l'écran.
    expect(poserImagePath('id: x\ntitre: X', '/a.avif')).toMatchObject({ presente: false, remplacee: false })
  })

  it('conserve la fin de ligne CRLF, et ne réécrit pas un fichier déjà juste', () => {
    // 297 des 308 recettes sont en CRLF. Sans cette conservation, l'import voyait 209 recettes
    // déjà à `null` comme « à corriger » et salissait autant de fichiers d'une autre lane —
    // c'est le défaut qu'a attrapé le passage à blanc, pas un test écrit après coup.
    const crlf = 'id: ratatouille\r\nimage_path: null\r\nportions_base: 4\r\n'
    expect(poserImagePath(crlf, null)).toMatchObject({ texte: crlf, remplacee: false, presente: true })

    const servie = poserImagePath(crlf, '/catalog/images/ratatouille.avif')
    expect(servie.texte).toBe('id: ratatouille\r\nimage_path: /catalog/images/ratatouille.avif\r\nportions_base: 4\r\n')
    expect(poserImagePath(servie.texte, '/catalog/images/ratatouille.avif').remplacee).toBe(false)
  })

  it('ignore une clé image_path imbriquée', () => {
    // Ancrage en colonne 0 : une clé de même nom sous un bloc n'est pas la clé de premier niveau.
    const imbrique = 'id: x\nvariante:\n  image_path: null\nimage_path: null'
    const { texte } = poserImagePath(imbrique, '/a.avif')
    expect(texte).toBe('id: x\nvariante:\n  image_path: null\nimage_path: /a.avif')
  })
})

describe('poserBlocCredits', () => {
  const DEBUT = '<!-- DÉBUT PHOTOS — bloc généré par catalog/import-photos.mjs, ne pas éditer à la main -->'
  const FIN = '<!-- FIN PHOTOS -->'

  it('insère la section avant « À compléter avant publication » à la première exécution', () => {
    const md = '# Crédits\n\n## Polices\n\ntexte\n\n---\n\n## À compléter avant publication\n\n- reste\n'
    const sortie = poserBlocCredits(md, 'BLOC')
    expect(sortie).toContain('BLOC')
    expect(sortie.indexOf('BLOC')).toBeLessThan(sortie.indexOf('## À compléter'))
    expect(sortie).toContain('## Polices')
  })

  it('remplace le bloc existant sans toucher à ce qui l’entoure', () => {
    const md = `avant\n\n${DEBUT}\n\nANCIEN\n\n${FIN}\n\napres\n`
    const sortie = poserBlocCredits(md, 'NOUVEAU')
    expect(sortie).toContain('NOUVEAU')
    expect(sortie).not.toContain('ANCIEN')
    expect(sortie.startsWith('avant')).toBe(true)
    expect(sortie.endsWith('apres\n')).toBe(true)
  })

  it('est idempotent', () => {
    const md = '# Crédits\n\n## À compléter avant publication\n\n- reste\n'
    const une = poserBlocCredits(md, 'BLOC')
    expect(poserBlocCredits(une, 'BLOC')).toBe(une)
  })
})

describe('rectangleDuCadre', () => {
  it('convertit les fractions en pixels, sur les dimensions REDRESSÉES', () => {
    // Le cadre réel de `hareng-pommes-terre-tiedes`, seul posé à la main au 2026-08-13 : un carré
    // de 894 px pris dans une source 1280×960.
    const cadre = { x: 0.12861200586455976, y: 0.06888054913794597, w: 0.6983395881465405, h: 0.931119450862054 }
    expect(rectangleDuCadre(cadre, 1280, 960)).toEqual({ left: 165, top: 66, width: 894, height: 894 })
  })

  it('⛔ EST INDÉPENDANT DE LA RÉSOLUTION — les fractions, pas les pixels du bac', () => {
    // La même photo fournie deux fois plus grande doit rendre le MÊME cadrage, à l'échelle. C'est
    // ce qui interdit de se fier au champ `source` que l'atelier écrit à côté du cadre.
    const cadre = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
    expect(rectangleDuCadre(cadre, 1000, 800)).toEqual({ left: 250, top: 200, width: 500, height: 400 })
    expect(rectangleDuCadre(cadre, 2000, 1600)).toEqual({ left: 500, top: 400, width: 1000, height: 800 })
  })

  it('ramène dans l’image un cadre qui déborde — `sharp.extract` lève pour un seul pixel de trop', () => {
    const rect = rectangleDuCadre({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 1000, 1000)
    expect(rect).not.toBeNull()
    expect(rect.left + rect.width).toBeLessThanOrEqual(1000)
    expect(rect.top + rect.height).toBeLessThanOrEqual(1000)
  })

  it('rend `null` quand il n’y a rien à recadrer — pas de cadre, cadre vide, ou cadre plein', () => {
    expect(rectangleDuCadre(null, 800, 600)).toBeNull()
    expect(rectangleDuCadre(undefined, 800, 600)).toBeNull()
    // Plein cadre : recadrer rendrait la même image, l'appel n'ajouterait qu'un mode d'échec.
    expect(rectangleDuCadre({ x: 0, y: 0, w: 1, h: 1 }, 800, 600)).toBeNull()
    // Surface nulle après arrondi.
    expect(rectangleDuCadre({ x: 0.5, y: 0.5, w: 0, h: 0.4 }, 800, 600)).toBeNull()
  })

  it('rend `null` sur une entrée abîmée plutôt que de calculer n’importe quoi', () => {
    expect(rectangleDuCadre({ x: 0.1, y: 0.1, w: 'oui', h: 0.5 }, 800, 600)).toBeNull()
    expect(rectangleDuCadre({ x: NaN, y: 0.1, w: 0.5, h: 0.5 }, 800, 600)).toBeNull()
    expect(rectangleDuCadre({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, 0, 600)).toBeNull()
  })
})
