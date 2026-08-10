// @vitest-environment jsdom
//
// ui/export-courses.test.ts — le format d'export, mesuré octet par octet.
//
// ⚠️ CE FICHIER TESTE DES CHAÎNES, PAS UN ÉCRAN. Le câblage (quel bouton, quel fichier) est vérifié
// dans `screens/courses.test.tsx` ; ici on ne regarde que ce qui part sur le disque. C'est la seule
// façon de verrouiller un format : un test qui passe par le rendu ne verrait pas une BOM manquante
// ni un CRLF devenu LF, et ce sont exactement les deux défauts qui ne se découvrent que chez
// quelqu'un d'autre, à l'ouverture du fichier.

import { describe, expect, it, vi } from 'vitest'
import {
  FICHIER_CSV,
  MIME_CSV,
  telecharger,
  versCsv,
  versJson,
  type LigneCourses,
} from './export-courses.js'

const LIGNES: readonly LigneCourses[] = [
  { libelle: 'Échalote', quantite: '3 pièces', rayon: 'fruits & légumes', coche: false, origine: 'plan' },
  { libelle: 'Crème fraîche', quantite: '250 g', rayon: 'crèmerie', coche: true, origine: 'plan' },
  { libelle: 'Lessive', quantite: '', rayon: 'lessive & linge', coche: false, origine: 'ajout' },
]

describe('export-courses — CSV', () => {
  it('écrit l’en-tête, une ligne par article, et l’état de chaque case', () => {
    const csv = versCsv(LIGNES)
    const lignes = csv.split('\r\n')

    expect(lignes[0]).toBe('\uFEFFRayon;Article;Quantité;Coché;Origine')
    expect(lignes[1]).toBe('fruits & légumes;Échalote;3 pièces;non;plan')
    expect(lignes[2]).toBe('crèmerie;Crème fraîche;250 g;oui;plan')
    expect(lignes[3]).toBe('lessive & linge;Lessive;;non;ajout')
  })

  it('⛔ COMMENCE PAR UNE BOM ET FINIT PAR UN CRLF — les deux se perdent sans qu’on le voie', () => {
    // Sans BOM, un tableur francophone affiche « Ã‰chalote » ; sans CRLF final, certains lecteurs
    // avalent la dernière ligne. Aucun des deux ne se remarque à la relecture du code.
    const csv = versCsv(LIGNES)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.includes('\n\r')).toBe(false)
    // Et AUCUN saut de ligne nu : un LF seul signerait un CRLF cassé en deux.
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('⛔ LE SÉPARATEUR EST LE POINT-VIRGULE, pas la virgule', () => {
    // Un tableur francophone lit le séparateur de sa locale : une virgule y produit UNE colonne.
    // Le catalogue porte des noms à virgule (« Sel, fin ») — la mesure ci-dessous les couvrirait.
    const csv = versCsv([LIGNES[0]!])
    expect(csv).toContain('fruits & légumes;Échalote')
  })

  it('encadre et double les guillemets d’un libellé qui porte un séparateur ou un guillemet', () => {
    const csv = versCsv([
      { libelle: 'Riz "long grain"; bio', quantite: '1 kg', rayon: 'épicerie', coche: false, origine: 'ajout' },
    ])
    expect(csv).toContain('épicerie;"Riz ""long grain""; bio";1 kg;non;ajout')
    // Le champ échappé n'a pas cassé le compte de lignes : en-tête + article + fin.
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('encadre un libellé qui contient un saut de ligne, sans ajouter de ligne au fichier', () => {
    // Cas réel : un article ajouté à la main est du texte libre, collé depuis n'importe où.
    const csv = versCsv([
      { libelle: 'Pain\nde mie', quantite: '', rayon: 'boulangerie', coche: false, origine: 'ajout' },
    ])
    expect(csv).toContain('"Pain\nde mie"')
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('une liste vide reste un CSV valide — l’en-tête seul', () => {
    expect(versCsv([])).toBe('\uFEFFRayon;Article;Quantité;Coché;Origine\r\n')
  })

  it('⛔ DEUX APPELS RENDENT EXACTEMENT LA MÊME CHAÎNE — aucune horloge dans le fichier', () => {
    // C'est ce qui rend deux semaines comparables au `diff`. Une date de génération le briserait.
    expect(versCsv(LIGNES)).toBe(versCsv(LIGNES))
  })
})

describe('export-courses — JSON', () => {
  it('porte son format, sa version et la période du plan', () => {
    const objet = JSON.parse(versJson(LIGNES, 'du 3 au 9 août'))
    expect(objet.format).toBe('courses')
    expect(objet.version).toBe(1)
    expect(objet.periode).toBe('du 3 au 9 août')
    expect(objet.articles).toHaveLength(3)
    expect(objet.articles[1]).toEqual({
      libelle: 'Crème fraîche',
      quantite: '250 g',
      rayon: 'crèmerie',
      coche: true,
      origine: 'plan',
    })
  })

  it('⛔ NE PORTE AUCUNE DATE DE GÉNÉRATION', () => {
    // La version DIT quelque chose à un futur lecteur ; un horodatage ne dirait que « ce n'est pas
    // le même fichier », ce qui est faux et rendrait tout `diff` illisible.
    const objet = JSON.parse(versJson(LIGNES, 'du 3 au 9 août'))
    expect(Object.keys(objet).sort()).toEqual(['articles', 'format', 'periode', 'version'])
    expect(versJson(LIGNES, 'du 3 au 9 août')).toBe(versJson(LIGNES, 'du 3 au 9 août'))
  })

  it('une liste vide donne un tableau vide, pas une absence de champ', () => {
    const objet = JSON.parse(versJson([], 'Aucun repas planifié'))
    expect(objet.articles).toEqual([])
  })
})

describe('export-courses — téléchargement', () => {
  it('fabrique le fichier en mémoire, clique le lien, puis relâche l’URL', () => {
    // ⚠️ jsdom n'implémente NI `createObjectURL` NI `revokeObjectURL` : sans ces doublures, la
    // fonction lèverait. Le test vérifie donc le protocole (créer → cliquer → révoquer), pas le
    // contenu du blob, que jsdom ne relit pas.
    const cree = vi.fn(() => 'blob:test')
    const revoque = vi.fn()
    Object.assign(URL, { createObjectURL: cree, revokeObjectURL: revoque })
    const clics: string[] = []
    const vraiCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((nom: string) => {
      const el = vraiCreateElement(nom) as HTMLElement
      if (nom === 'a') el.click = () => clics.push((el as HTMLAnchorElement).download)
      return el
    })

    telecharger('contenu', FICHIER_CSV, MIME_CSV)

    expect(cree).toHaveBeenCalledTimes(1)
    expect(clics).toEqual([FICHIER_CSV])
    expect(revoque).toHaveBeenCalledWith('blob:test')
    // ⛔ ET LE LIEN NE RESTE PAS DANS LE DOCUMENT : il n'est là que le temps du clic.
    expect(document.querySelector('a[download]')).toBeNull()

    vi.restoreAllMocks()
  })
})
