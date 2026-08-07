// @vitest-environment jsdom
//
// ui/screens/aliment.test.tsx — la fiche d'un aliment (décision 33).
//
// ⚠️ CE FICHIER EXISTE POUR EMPÊCHER LE DÉFAUT SIGNATURE DU PROJET DE SE REFERMER. Les cotes de
// confiance ANSES ont été importées, stockées, chargées jusqu'au `Socle` — et lues par personne
// pendant deux jours (§8 ETAT, « rempli et jamais lu », quatre occurrences déjà payées avant
// celle-ci). Un test qui monterait l'écran sans jamais vérifier qu'une COTE RÉELLE arrive à
// l'écran rejouerait exactement la même panne, en vert.
//
// ⚠️ LES VALEURS ASSERTÉES SONT CELLES DU CATALOGUE DU DÉPÔT, pas des fixtures inventées :
// `confianceDeTest()` lit `app/public/catalog/catalog.db`. Si le catalogue change, ces tests
// doivent changer avec lui — c'est le but. Une fixture maison passerait au vert même avec un
// pipeline d'import cassé.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { readDisplay, writeDisplay } from '../../data/user-store.js'
import {
  baseCourante,
  catalogueDeTest,
  confianceDeTest,
  reinitialiserBase,
  sessionDeTest,
} from '../test-socle.js'
import { hashDe, hashDeRecette } from '../router.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  chargerConfiance: () => Promise.resolve(confianceDeTest()),
}))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(cleanup)

/** Le réglage « Afficher plus de détails » — faux par défaut (§6.5 ARCHITECTURE). */
function activerLesDetails() {
  const db = baseCourante()
  writeDisplay(db, { ...readDisplay(db), afficherMacros: true })
}

async function monter(alimentId: string, retour = '') {
  const { Aliment } = await import('./aliment.js')
  const resultat = render(<Aliment alimentId={alimentId} retour={retour} />)
  await screen.findByRole('heading', { level: 1 })
  return resultat
}

describe('ui/screens/aliment — les faits du catalogue', () => {
  it('titre l’écran du nom de l’aliment et donne son groupe', async () => {
    await monter('carotte')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Carotte, crue')
    expect(screen.getByText('légumes')).toBeTruthy()
  })

  it('recolle la saison qui enjambe l’année plutôt que de la couper en deux', async () => {
    // `carotte` porte [9,10,11,12,1,2,3,4] : sans recollement, « de janvier à avril et de septembre
    // à décembre ». Voir ui/saison.ts.
    await monter('carotte')
    expect(screen.getByText('de septembre à avril')).toBeTruthy()
  })

  it('résout l’origine animale le long de la chaîne `deriveDe`, et dit par où', async () => {
    // ⚠️ `beurre_doux.origineAnimale` vaut `null` — lire ce champ seul déclarerait le beurre
    // végétal. C'est la cascade `deriveDe` → `lait_entier` → mammifère qui fait foi.
    await monter('beurre_doux')
    expect(screen.getByText(/d'un mammifère/)).toBeTruthy()
    expect(screen.getByText(/Lait entier, UHT/)).toBeTruthy()
  })

  it('nomme les allergènes en toutes lettres, avec leur certitude', async () => {
    await monter('beurre_doux')
    expect(screen.getByText(/Lait \(en contient\)/)).toBeTruthy()
  })

  it('dit explicitement quand aucun allergène n’est déclaré, au lieu de se taire', async () => {
    // Se taire laisserait croire à une information manquante là où le catalogue affirme une absence.
    await monter('carotte')
    expect(screen.getByText(/aucun des quatorze allergènes réglementaires/)).toBeTruthy()
  })

  it('annonce le fond de placard et sa conséquence sur les courses', async () => {
    await monter('sel_fin')
    expect(screen.getByText(/écarté de la liste de courses par défaut/)).toBeTruthy()
  })

  it('ne parle pas de disponibilité toute l’année quand le catalogue ne la déclare pas', async () => {
    await monter('endive') // `toute_annee` = 0
    expect(screen.queryByText(/toute l'année \(rayon/)).toBeNull()
    expect(screen.getByText("d'octobre à mars")).toBeTruthy()
  })
})

describe('ui/screens/aliment — les teneurs et leur provenance', () => {
  it('⛔ ne montre AUCUNE teneur tant que « Afficher plus de détails » est décoché', async () => {
    // §6.5 : `afficher_macros` vaut false par défaut, et c'est le SEUL interrupteur du mode avancé.
    await monter('carotte')
    expect(screen.queryByText('0,78 g')).toBeNull()
    expect(screen.getByText(/Afficher plus de détails/)).toBeTruthy()
  })

  it('affiche la teneur réelle du catalogue une fois le réglage coché', async () => {
    activerLesDetails()
    await monter('carotte')
    expect(screen.getByText('Protéines')).toBeTruthy()
    expect(screen.getByText('0,78 g')).toBeTruthy()
    expect(screen.getByText('2,9 g')).toBeTruthy() // fibres
  })

  // LE test de la décision 33 : une cote RÉELLE, venue de `catalog.db`, arrive à l'écran.
  it('rattache à chaque teneur sa cote de confiance ANSES', async () => {
    activerLesDetails()
    await monter('carotte') // toutes ses valeurs hors énergie sont cotées A
    const proteines = screen.getByText('Protéines').closest('li')
    expect(proteines).not.toBeNull()
    expect(within(proteines as HTMLElement).getByText('· confiance A')).toBeTruthy()
  })

  // ⚠️ L'ÉNERGIE PORTE SA COTE COMME LES AUTRES depuis le 2026-08-07. Elle en était exemptée au
  // motif qu'une cote constante est du bruit — motif tombé avec la lecture de la source : la cote
  // annonce une FIABILITÉ, et masquer « moins fiable » sur un chiffre est une décision éditoriale
  // qu'on ne peut pas prendre à la place de l'utilisateur.
  it('n’exempte pas l’énergie de sa cote, et explique pourquoi elle est presque toujours D', async () => {
    activerLesDetails()
    await monter('carotte')
    const energie = screen.getByText('Énergie').closest('li')
    expect(energie).not.toBeNull()
    expect(within(energie as HTMLElement).getByText('30,2 kcal')).toBeTruthy()
    expect(within(energie as HTMLElement).getByText('· confiance D')).toBeTruthy()
    expect(screen.getByText(/règlement UE n° 1169\/2011/)).toBeTruthy()
  })

  // ⛔ LE GARDE-FOU DU VOCABULAIRE. La cote se lit TELLE QUE PUBLIÉE — une lettre — et rien dans
  // la liste ne l'habille d'une phrase. Une version précédente de cet écran affichait « valeur
  // dosée » / « valeur calculée ou imputée » : quatre formules **fabriquées**, contredites par la
  // documentation ANSES qui ne définit que ses deux bornes. Ce test tombe si elles reviennent.
  it('⛔ n’habille aucune cote d’un libellé inventé', async () => {
    activerLesDetails()
    // `artichaut` porte des B ET des C — les deux cotes que l'ANSES ne définit nulle part, donc
    // celles qu'on serait le plus tenté de paraphraser.
    await monter('artichaut')
    const lignes = [...screen.getByText('Fibres alimentaires').closest('ul')!.querySelectorAll('li')]
      .map((li) => (li.textContent ?? '').toLowerCase())
      .join(' ')
    for (const interdit of ['dosée', 'imputée', 'empruntée', 'estimée', 'provenance', 'fiab']) {
      expect(lignes).not.toContain(interdit)
    }
  })

  // Chaque cote affichée est une lettre de l'échelle ANSES, et rien d'autre. Ensemble fermé :
  // une cinquième forme — un mot, un chiffre, un pictogramme — fait tomber ce test.
  it('n’affiche la cote que sous la forme d’une lettre A à D', async () => {
    activerLesDetails()
    for (const aliment of ['carotte', 'amande_effilee', 'artichaut', 'beurre_doux']) {
      cleanup()
      await monter(aliment)
      const cotes = [...screen.getByText('Protéines').closest('ul')!.querySelectorAll('li span')]
        .map((s) => s.textContent ?? '')
        .filter((t) => t.startsWith('· confiance '))
        .map((t) => t.replace('· confiance ', ''))
      expect(cotes.length).toBeGreaterThan(0)
      for (const cote of cotes) expect(['A', 'B', 'C', 'D']).toContain(cote)
    }
  })

  // ⚠️ SANS CETTE PHRASE, une colonne de A et de D se lit comme une note attribuée aux ALIMENTS.
  // C'est elle, et elle seule, qui sépare cet affichage du jugement interdit par le principe 6.
  it('dit que la cote qualifie la donnée et non l’aliment, en citant l’ANSES', async () => {
    activerLesDetails()
    await monter('carotte')
    expect(screen.getByText(/table Ciqual \(ANSES\)/)).toBeTruthy()
    // La définition est citée VERBATIM : ce test la verrouille mot pour mot.
    expect(
      screen.getByText(
        /indique la fiabilité de la teneur moyenne \(de A=très fiable à D=moins fiable\)/
      )
    ).toBeTruthy()
    expect(screen.getByText(/qualifie la donnée publiée, pas l’aliment/)).toBeTruthy()
  })
})

describe('ui/screens/aliment — navigation', () => {
  it('ramène à la recette d’où l’on vient, en la nommant', async () => {
    const catalogue = catalogueDeTest()
    const recette = [...catalogue.recipes.values()][0]
    expect(recette).toBeDefined()
    const retour = hashDeRecette(recette?.id ?? '', 'semaine')
    await monter('carotte', retour)
    const lien = screen.getByRole('link', { name: `← ${recette?.nom}` })
    expect(lien.getAttribute('href')).toBe(retour)
  })

  it('ne ment pas sur la provenance quand le hash n’en porte aucune', async () => {
    // Lien collé, signet : mieux vaut « ← Aujourd'hui » qu'un « ← Toutes les recettes » faux.
    await monter('carotte')
    expect(screen.getByRole('link', { name: "← Aujourd'hui" }).getAttribute('href')).toBe(
      hashDe('aujourdhui')
    )
  })

  it('nomme l’onglet quand on vient d’un onglet', async () => {
    await monter('carotte', hashDe('courses'))
    expect(screen.getByRole('link', { name: '← Ma liste de courses' })).toBeTruthy()
  })

  it('liste les recettes qui emploient l’aliment', async () => {
    await monter('endive') // 4 recettes : pas de troncature
    const section = screen.getByRole('heading', { name: 'Où il sert' }).parentElement
    expect(section).not.toBeNull()
    expect(screen.queryByText(/autres? recettes?\./)).toBeNull()
  })

  // `sel_fin` sert 163 fois : sans plafond, la fiche devient un mur de liens — et le coût de montage
  // croît avec le catalogue (décision 61).
  //
  // ⚠️ LE RESTE EST CALCULÉ DEPUIS LE CATALOGUE, PAS ÉCRIT EN DUR. La première version attendait
  // « et 48 autres » ; le catalogue a gagné deux recettes au beurre dans la même journée et le test
  // est tombé — pour une raison qui n'avait rien à voir avec ce qu'il vérifie. Un compte figé sur
  // un catalogue en chantier est une fausse alerte programmée.
  it('plafonne la liste et annonce le reste au lieu de le taire', async () => {
    const attendues = [...catalogueDeTest().recipes.values()].filter((r) =>
      r.ingredients.some((i) => (i.foodId as string) === 'beurre_doux')
    ).length
    expect(attendues).toBeGreaterThan(12)

    await monter('beurre_doux')
    const liens = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('#/recette/'))
    expect(liens).toHaveLength(12)
    expect(screen.getByText(new RegExp(`et ${attendues - 12} autres recettes\.`))).toBeTruthy()
  })

  it('rend un aliment inconnu sans écran blanc', async () => {
    const { Aliment } = await import('./aliment.js')
    render(<Aliment alimentId="cet-aliment-nexiste-pas" retour="" />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Aliment introuvable')
  })
})
