// engine/domain/groupes-animaux.test.ts — les cas LIMITES, sur des fixtures montées à la main.
//
// ⚠️ CE FICHIER NE PROUVE PAS QUE LE CATALOGUE EST BIEN RANGÉ, et ne peut pas le prouver : il
// construit ses propres `Food` puis constate qu'ils se rangent comme il l'a prévu — soit la
// cohérence de la fonction avec elle-même. C'est `tests/groupes-animaux-catalogue.test.ts`, à la
// racine, qui la confronte à une donnée qu'elle n'a pas écrite. Les deux sont nécessaires : ici les
// cascades, les cycles et les champs absents, que le catalogue réel ne contient pas.

import { describe, expect, it } from 'vitest'
import { groupeAnimalDe, groupesAnimaux, type GroupeAnimalId } from './groupes-animaux.js'
import { makeFood } from '../selection/test-fixtures.js'
import type { AnimalOrigin, AnimalProvenance, Food, FoodId } from './index.js'

interface OptsAliment {
  readonly nom?: string
  readonly origine?: AnimalOrigin | null
  readonly provenance?: AnimalProvenance | null
  readonly deriveDe?: string | null
}

/** `makeFood` ne permet pas de surcharger `nom` — on le pose après coup, comme `sauces.test.ts`. */
function aliment(id: string, opts: OptsAliment = {}): Food {
  const base = makeFood(id, [], {
    origineAnimale: opts.origine ?? null,
    provenanceAnimale: opts.provenance ?? null,
    deriveDe: opts.deriveDe ?? null,
  })
  return opts.nom === undefined ? base : { ...base, nom: opts.nom }
}

function catalogue(...aliments: readonly Food[]): ReadonlyMap<FoodId, Food> {
  return new Map(aliments.map((f) => [f.id, f]))
}

/** Le groupe d'un aliment, résolu contre un catalogue qui le contient lui et ses ascendants. */
function groupeDe(cible: Food, ...autres: readonly Food[]): GroupeAnimalId | null {
  return groupeAnimalDe(cible, catalogue(cible, ...autres))
}

describe('domain/groupes-animaux — le croisement origine × provenance', () => {
  it('mammifère : la provenance sépare le lait de la viande', () => {
    expect(groupeDe(aliment('lait', { origine: 'mammifere', provenance: 'production' }))).toBe('laitiers')
    expect(groupeDe(aliment('steak', { origine: 'mammifere', provenance: 'corps' }))).toBe('viande_mammifere')
  })

  it('volaille : la provenance sépare l’œuf de la chair', () => {
    expect(groupeDe(aliment('oeuf', { origine: 'volaille', provenance: 'production' }))).toBe('oeufs')
    expect(groupeDe(aliment('poulet', { origine: 'volaille', provenance: 'corps' }))).toBe('volaille')
  })

  it('poisson et fruits de mer : la provenance ne sépare RIEN', () => {
    // Les œufs de lompe sont une `production` au sens du fait déclaré ; ils restent du poisson pour
    // qui choisit ce qu'il mange. Si ce test rougit, c'est qu'un huitième groupe est apparu sans
    // que personne ne l'ait décidé.
    expect(groupeDe(aliment('cabillaud', { origine: 'poisson', provenance: 'corps' }))).toBe('poisson')
    expect(groupeDe(aliment('lump', { origine: 'poisson', provenance: 'production' }))).toBe('poisson')
    expect(groupeDe(aliment('moule', { origine: 'fruit_de_mer', provenance: 'corps' }))).toBe('fruits_de_mer')
    expect(groupeDe(aliment('perle', { origine: 'fruit_de_mer', provenance: 'production' }))).toBe('fruits_de_mer')
  })

  it('insecte → miel', () => {
    expect(groupeDe(aliment('miel', { origine: 'insecte', provenance: 'production' }))).toBe('miel')
  })

  it('aucune origine animale → aucun groupe', () => {
    expect(groupeDe(aliment('carotte'))).toBeNull()
    expect(groupeDe(aliment('sel', { provenance: 'corps' }))).toBeNull() // provenance orpheline : ignorée
  })
})

describe('domain/groupes-animaux — la cascade `deriveDe`', () => {
  it('⛔ UN DÉRIVÉ TOMBE DANS LE GROUPE DE SON ANCÊTRE, pas ailleurs', () => {
    // Le beurre ne déclare NI origine NI provenance : les deux se lisent sur `lait_entier`.
    const lait = aliment('lait_entier', { origine: 'mammifere', provenance: 'production' })
    const beurre = aliment('beurre_doux', { deriveDe: 'lait_entier' })
    expect(groupeDe(beurre, lait)).toBe('laitiers')

    // Et la même cascade du côté « corps » : un extrait de viande n'est pas un produit laitier.
    const boeuf = aliment('boeuf_paleron', { origine: 'mammifere', provenance: 'corps' })
    const fond = aliment('fond_de_boeuf', { deriveDe: 'boeuf_paleron' })
    expect(groupeDe(fond, boeuf)).toBe('viande_mammifere')
  })

  it('la cascade traverse plusieurs maillons', () => {
    const lait = aliment('lait', { origine: 'mammifere', provenance: 'production' })
    const creme = aliment('creme', { deriveDe: 'lait' })
    const beurre = aliment('beurre', { deriveDe: 'creme' })
    expect(groupeDe(beurre, creme, lait)).toBe('laitiers')
  })

  it('un `deriveDe` qui pointe dans le vide ne classe rien — et ne jette pas', () => {
    expect(groupeDe(aliment('orphelin', { deriveDe: 'jamais_defini' }))).toBeNull()
  })

  it('un cycle `deriveDe` termine, et ne classe rien', () => {
    // La garde vit dans `resolveAnimalOrigin` ; ce test vérifie qu'on ne l'a pas contournée en
    // réécrivant la remontée ici. Sans elle, la suite entière part en boucle infinie.
    const a = aliment('a', { deriveDe: 'b' })
    const b = aliment('b', { deriveDe: 'a' })
    expect(groupeDe(a, b)).toBeNull()
  })

  it('un cycle qui PASSE par une origine déclarée la trouve quand même', () => {
    const a = aliment('a', { deriveDe: 'b' })
    const b = aliment('b', { origine: 'volaille', provenance: 'corps', deriveDe: 'a' })
    expect(groupeDe(a, b)).toBe('volaille')
  })
})

describe('domain/groupes-animaux — la polarité d’une provenance absente', () => {
  it('⚠️ ORIGINE SANS PROVENANCE → LE GROUPE « CORPS », jamais « production »', () => {
    // Même parti que `regimeExigePar`, qui rend `omnivore` plutôt que `vegetarien` en cas
    // d'ignorance. Le build refuse cette forme au catalogue ; le TYPE `Food` ne l'interdit pas.
    expect(groupeDe(aliment('inconnu_m', { origine: 'mammifere' }))).toBe('viande_mammifere')
    expect(groupeDe(aliment('inconnu_v', { origine: 'volaille' }))).toBe('volaille')
  })
})

describe('domain/groupes-animaux — groupesAnimaux', () => {
  const CATALOGUE = catalogue(
    aliment('carotte', { nom: 'Carotte' }),
    aliment('lait', { nom: 'Lait entier', origine: 'mammifere', provenance: 'production' }),
    aliment('beurre', { nom: 'Beurre doux', deriveDe: 'lait' }),
    aliment('steak', { nom: 'Steak', origine: 'mammifere', provenance: 'corps' }),
    aliment('oeuf', { nom: 'Œuf', origine: 'volaille', provenance: 'production' }),
    aliment('poulet', { nom: 'Poulet', origine: 'volaille', provenance: 'corps' }),
    aliment('cabillaud', { nom: 'Cabillaud', origine: 'poisson', provenance: 'corps' })
  )

  it('rend un groupe par combinaison présente, et AUCUN groupe vide', () => {
    const groupes = groupesAnimaux(CATALOGUE)
    expect(groupes.map((g) => g.id)).toEqual(['laitiers', 'oeufs', 'viande_mammifere', 'volaille', 'poisson'])
    expect(groupes.every((g) => g.aliments.length > 0)).toBe(true)
  })

  it('l’ordre est celui de la table, pas celui des effectifs', () => {
    // `laitiers` (2 aliments) sort AVANT `oeufs` (1) : trier par compte ferait bouger l'écran de
    // réglages à chaque lot de contenu, sur des positions que l'utilisateur aura mémorisées.
    const ids = groupesAnimaux(CATALOGUE).map((g) => g.id)
    expect(ids.indexOf('laitiers')).toBeLessThan(ids.indexOf('oeufs'))
    expect(ids.indexOf('oeufs')).toBeLessThan(ids.indexOf('viande_mammifere'))
  })

  it('chaque groupe porte un libellé non vide, et deux groupes n’en partagent pas', () => {
    const libelles = groupesAnimaux(CATALOGUE).map((g) => g.libelle)
    expect(libelles.every((l) => l.trim().length > 0)).toBe(true)
    expect(new Set(libelles).size).toBe(libelles.length)
  })

  it('les aliments d’un groupe sont triés par nom, accents compris', () => {
    const foods = catalogue(
      aliment('e1', { nom: 'Épaule', origine: 'mammifere', provenance: 'corps' }),
      aliment('c1', { nom: 'Côtelette', origine: 'mammifere', provenance: 'corps' }),
      aliment('b1', { nom: 'Bavette', origine: 'mammifere', provenance: 'corps' })
    )
    const viandes = groupesAnimaux(foods).find((g) => g.id === 'viande_mammifere')
    // En points de code, « Épaule » (É = U+00C9) passerait APRÈS tout le reste.
    expect(viandes?.aliments.map((f) => f.nom)).toEqual(['Bavette', 'Côtelette', 'Épaule'])
  })

  it('⛔ AUCUN ALIMENT SANS ORIGINE RÉSOLUE N’APPARAÎT DANS UN GROUPE', () => {
    const dedans = groupesAnimaux(CATALOGUE).flatMap((g) => g.aliments.map((f) => f.id))
    expect(dedans).not.toContain('carotte')
  })

  it('⛔ CHAQUE ALIMENT CLASSÉ APPARAÎT DANS EXACTEMENT UN GROUPE', () => {
    const dedans = groupesAnimaux(CATALOGUE).flatMap((g) => g.aliments.map((f) => f.id))
    expect(new Set(dedans).size).toBe(dedans.length)
  })

  it('la somme des groupes = le nombre d’aliments à origine résolue', () => {
    const classes = [...CATALOGUE.values()].filter((f) => groupeAnimalDe(f, CATALOGUE) !== null)
    const somme = groupesAnimaux(CATALOGUE).reduce((n, g) => n + g.aliments.length, 0)
    expect(somme).toBe(classes.length)
  })

  it('un catalogue sans aucun aliment animal rend une liste VIDE, pas sept groupes à zéro', () => {
    expect(groupesAnimaux(catalogue(aliment('carotte'), aliment('sel')))).toEqual([])
  })

  it('ne modifie pas le catalogue qu’on lui passe', () => {
    const avant = [...CATALOGUE.values()].map((f) => f.id)
    groupesAnimaux(CATALOGUE)
    expect([...CATALOGUE.values()].map((f) => f.id)).toEqual(avant)
  })
})
