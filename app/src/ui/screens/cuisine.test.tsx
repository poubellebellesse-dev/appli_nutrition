// @vitest-environment jsdom
//
// ui/screens/cuisine.test.tsx — le mode cuisine (§5bis ARCHITECTURE, tests listés en §4.2 de
// CONCEPTION_MODE_CUISINE.md).
//
// ⚠️ CES TESTS ENCODENT DES DÉCISIONS, PAS UN RENDU. Deux d'entre eux valent le détour :
//   - « les étapes n'avancent jamais seules » verrouille le point 2 contre une régression BIEN
//     INTENTIONNÉE. La demande d'origine était « que la recette se lance toute seule » ; elle a été
//     refusée après lecture des essais publiés. Quelqu'un la réimplémentera de bonne foi un jour.
//   - « une session reprise dit la vérité » est le seul test du mode qui porte sur une affirmation
//     de l'appli À PROPOS DE NOURRITURE. Sa règle est testée à part et sans DOM dans
//     `cuisine-session.test.ts` ; ici on vérifie qu'elle atteint bien l'écran.
//
// ⚠️ CE QUI N'EST PAS TESTABLE ICI : le déverrouillage audio (`jsdom` n'implémente pas la politique
// d'autoplay — un vert ne prouverait rien) et le Wake Lock réel. Points de vérification MANUELLE sur
// appareil, §7 du document de conception.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readCuisineSession, writeCuisineSession } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'

vi.mock('../catalog-source.js', () => ({
  chargerCatalogue: () => Promise.resolve(catalogueDeTest()),
  // ⚠️ COTES DE CONFIANCE VIDES, ET C'EST JUSTE ICI. Le mode cuisine n'affiche AUCUNE valeur
  // nutritionnelle, donc aucune provenance à coter — une table vide ne masque rien. C'est aussi ce
  // qui garde ce fichier indépendant du lot « confiance » mené par une autre piste : la clé est
  // fournie pour que `chargerSocle()` ne casse pas, sa valeur n'est lue par personne. À rebrancher
  // sur `confianceDeTest()` le jour où cet écran afficherait une valeur.
  chargerConfiance: () => Promise.resolve(new Map()),
}))
vi.mock('../user-source.js', () => ({
  ouvrirUserDb: () => Promise.resolve(sessionDeTest()),
  surErreurDePersistance: () => undefined,
}))

beforeEach(() => {
  vi.resetModules()
  reinitialiserBase()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const CHAKCHOUKA = 'chakchouka'

async function monter(recetteId = CHAKCHOUKA, portionsDemandees: number | null = null) {
  const { Cuisine } = await import('./cuisine.js')
  const rendu = render(<Cuisine recetteId={recetteId} portionsDemandees={portionsDemandees} />)
  await screen.findByRole('heading', { level: 1 })
  return rendu
}

describe('cuisine — le déroulé', () => {
  // ⛔ LE TEST QUI PROTÈGE LA DÉCISION. `advanceTimersByTime` fait passer dix minutes : le battement
  // de seconde tourne, les décomptes bougent, et l'étape ne doit pas avoir changé d'un pouce.
  it('⛔ les étapes n’avancent JAMAIS seules', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monter()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000)
    })

    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
    expect(screen.getByText(/Émincer l'oignon/)).toBeTruthy()
  })

  // Dépend de L0 : `chakchouka` porte SIX lignes dans `etapes`, dont la dernière est la mention
  // ANSES. Annoncer « 6 » promettrait un geste après que le plat est servi.
  it('⛔ le compteur ignore l’avertissement sanitaire — 5 étapes, pas 6', async () => {
    await monter()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })

  it('l’avertissement s’affiche à la DERNIÈRE étape, et pas avant', async () => {
    await monter()
    const anses = /ne pas consommer d'œufs crus ou peu cuits/

    expect(screen.queryByText(anses)).toBeNull()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))

    expect(screen.getByText(/Étape 5 sur 5/)).toBeTruthy()
    expect(screen.getByText(anses)).toBeTruthy()
  })

  it('avancer et reculer changent l’étape, et « précédente » est inerte sur la première', async () => {
    await monter()
    expect(screen.getByText('← Étape précédente').hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText(/Étape 2 sur 5/)).toBeTruthy()

    fireEvent.click(screen.getByText('← Étape précédente'))
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })
})

describe('cuisine — les minuteurs', () => {
  it('n’en propose un que sur une étape qui en porte un', async () => {
    await monter()
    // Étape 1 : émincer, aucun minuteur au catalogue.
    expect(screen.queryByText(/Lancer le minuteur/)).toBeNull()

    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText('Lancer le minuteur (12:00)')).toBeTruthy()
  })

  // ⛔ Un décompte qui disparaît quand on tourne la page est un décompte qu'on oublie — et il porte
  // le numéro de SON étape, sinon on ne sait plus ce qu'il compte.
  it('⛔ un minuteur SURVIT au changement d’étape, étiqueté par son étape', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Étape suivante →'))

    expect(screen.getByText(/Étape 4 sur 5/)).toBeTruthy()
    const encours = screen.getByRole('heading', { name: 'Minuteurs en cours' }).parentElement
    expect(encours?.textContent).toContain('Étape 2')
    expect(encours?.textContent).toMatch(/il reste/)
  })

  it('⛔ plusieurs décomptes coexistent — une vraie cuisson en fait tourner deux', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (10:00)'))
    fireEvent.click(screen.getByText('Étape suivante →'))

    const encours = screen.getByRole('heading', { name: 'Minuteurs en cours' }).parentElement
    expect(encours?.textContent).toContain('Étape 2')
    expect(encours?.textContent).toContain('Étape 3')
  })

  it('la pause fige le reste, la reprise le relance', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    fireEvent.click(screen.getByText('Mettre en pause'))
    expect(screen.getByText(/en pause à/)).toBeTruthy()

    fireEvent.click(screen.getByText('Reprendre'))
    expect(screen.getByText(/il reste/)).toBeTruthy()
  })

  it('arrêter un minuteur le fait disparaître', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByText('Arrêter'))

    expect(screen.getByText('Lancer le minuteur (12:00)')).toBeTruthy()
  })
})

describe('cuisine — reprendre une cuisson', () => {
  // ⛔ LE TEST LE PLUS IMPORTANT DU LOT. Une échéance dans le passé, c'est exactement ce que produit
  // « fermer l'appli, revenir plus tard ». L'écran doit dire depuis quand c'est fini — jamais
  // afficher un décompte figé, jamais laisser croire que ça vient de sonner.
  it('⛔ une session reprise DIT LA VÉRITÉ sur un minuteur échu', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now() - 40 * 60 * 1000,
      portions: null,
      minuteurs: [{ ordre: 2, finMs: Date.now() - 38 * 60 * 1000, pauseRestantS: null }],
    })

    await monter()

    expect(screen.getByText(/Étape 2 sur 5/)).toBeTruthy()
    expect(screen.getByText(/terminé il y a 38:0\d/)).toBeTruthy()
  })

  it('rouvre à l’étape où l’on s’était arrêté', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 4,
      ouverteLe: Date.now(),
      portions: null,
      minuteurs: [],
    })

    await monter()
    expect(screen.getByText(/Étape 4 sur 5/)).toBeTruthy()
  })

  // ⚠️ L'alarme ne doit PAS retentir pour un minuteur déjà échu à l'ouverture : ce serait le
  // mensonge du point 7 retourné en son contraire sonore.
  it('⛔ ne SONNE PAS pour un minuteur déjà échu au moment où l’on rouvre', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now() - 60 * 60 * 1000,
      portions: null,
      minuteurs: [{ ordre: 2, finMs: Date.now() - 55 * 60 * 1000, pauseRestantS: null }],
    })

    await monter()
    expect(screen.queryByRole('button', { name: 'Arrêter l’alarme' })).toBeNull()
  })

  it('une session d’une AUTRE recette ne se reprend pas ici', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: 'omelette_fines_herbes',
      ordreCourant: 3,
      ouverteLe: Date.now(),
      portions: null,
      minuteurs: [],
    })

    await monter()
    // La cuisson repart à la première étape de CETTE recette, pas à la troisième de l'autre.
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })
})

describe('cuisine — l’alarme', () => {
  it('⛔ sonne à l’échéance et s’arrête sur un appui n’importe où', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    const arret = screen.getByRole('button', { name: 'Arrêter l’alarme' })
    fireEvent.click(arret)
    expect(screen.queryByRole('button', { name: 'Arrêter l’alarme' })).toBeNull()
  })
})

describe('cuisine — garde-fous', () => {
  // `jsdom` n'a pas `navigator.wakeLock` : c'est exactement le cas d'un navigateur sans l'API, ou
  // d'une page servie en `http://`. L'écran doit fonctionner et le DIRE, jamais promettre à vide.
  it('⛔ l’absence de Wake Lock ne casse rien et n’est pas promise', async () => {
    await monter()
    expect(screen.getByText(/L'écran peut s'éteindre/)).toBeTruthy()
    expect(screen.queryByText(/L'écran reste allumé/)).toBeNull()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })

  // Filet du principe 6, comme sur les autres écrans : le score du moteur est un classement RELATIF
  // à la passe, et un nombre sur 100 à côté d'un plat se lit comme une note nutritionnelle.
  it('⛔ n’affiche AUCUN score', async () => {
    const { container } = await monter()
    const texte = container.textContent ?? ''
    expect(texte).not.toMatch(/\/\s*100\b/)
    expect(texte.toLowerCase()).not.toContain('score')
  })

  it('une recette inconnue ne casse pas l’écran', async () => {
    const { Cuisine } = await import('./cuisine.js')
    render(<Cuisine recetteId="recette_qui_n_existe_pas" portionsDemandees={null} />)
    expect(await screen.findByText('Cette recette est introuvable.')).toBeTruthy()
  })
})

// ⚠️ `Panneau` PASSE PAR UN PORTAIL : `screen.getByText` le voit, `container.querySelector` non.
// D'où le `within(screen.getByRole('dialog'))` systématique ci-dessous — piège déjà payé, listé dans
// `docs/reference/PIEGES.md`.
describe('cuisine — les ingrédients sous la main', () => {
  // ⛔ LE MANQUE QUE CE LOT COMBLE. Avant lui, « c'était combien d'ail ? » en pleine cuisson
  // obligeait à QUITTER le mode cuisine pour rouvrir la fiche, en perdant l'étape courante de vue —
  // alors que la recette et ses quantités étaient DÉJÀ chargées dans cet écran.
  it('la fenêtre montre les quantités SANS quitter l’étape courante', async () => {
    await monter()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Voir les ingrédients/ }))

    const fenetre = within(screen.getByRole('dialog'))
    expect(fenetre.getByText('6 œufs')).toBeTruthy()
    expect(fenetre.getByText('2 gousses')).toBeTruthy()
    // L'étape n'a pas bougé : une fenêtre recouvre, elle ne navigue pas.
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })

  // ⚠️ `aria-haspopup="dialog"`, JAMAIS `aria-expanded` : ce bouton n'agrandit rien EN PLACE, il
  // ouvre une fenêtre. Même règle que les filtres et « Parcourir tous les aliments ».
  it('le déclencheur annonce une fenêtre, pas un dépliant', async () => {
    await monter()
    const bouton = screen.getByRole('button', { name: /Voir les ingrédients/ })

    expect(bouton.getAttribute('aria-haspopup')).toBe('dialog')
    expect(bouton.hasAttribute('aria-expanded')).toBe(false)
  })

  it('les portions réglées sur la fiche arrivent avec le lien', async () => {
    await monter(CHAKCHOUKA, 8)
    expect(screen.getByRole('button', { name: /pour 8 portions/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Voir les ingrédients/ }))
    // 6 œufs pour 4 portions → 12 pour 8. C'est le LIBELLÉ qui est mis à l'échelle, pas une
    // conversion en grammes (`ui/quantites.ts`).
    expect(within(screen.getByRole('dialog')).getByText('12 œufs')).toBeTruthy()
  })

  // ⛔ LE TEST QUI JUSTIFIE LA MIGRATION v11. Sans colonne, ce réglage mourait avec l'écran : on
  // répondait « pour combien ? » à chaque reprise, les mains dans la farine.
  it('⛔ changer les portions en cuisine est ÉCRIT dans la session', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: /Voir les ingrédients/ }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Une portion de plus' })
    )

    expect(readCuisineSession(baseCourante())?.portions).toBe(5)
    expect(screen.getByRole('button', { name: /pour 5 portions/ })).toBeTruthy()
  })

  it('⛔ reprendre une cuisson ne RAMÈNE PAS les portions à la valeur de base', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now(),
      portions: 8,
      minuteurs: [],
    })

    // Hash NU, sans `?portions=` : exactement ce que produit le bandeau de reprise.
    await monter()
    expect(screen.getByRole('button', { name: /pour 8 portions/ })).toBeTruthy()
  })

  // `portions = null` est l'état d'une cuisson ouverte AVANT la v11. L'écran ne doit pas afficher un
  // nombre inventé : il retombe sur celui de la recette, seul endroit qui le connaisse.
  it('une cuisson d’avant la v11 retombe sur les portions de la recette', async () => {
    writeCuisineSession(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now(),
      portions: null,
      minuteurs: [],
    })

    await monter()
    expect(screen.getByRole('button', { name: /pour 4 portions/ })).toBeTruthy()
  })

  // ⛔ `Panneau` porte un portail posé APRÈS cet écran dans le DOM. Restée ouverte, la fenêtre
  // recouvrirait la surface « appuyez n'importe où » et l'arrêt de l'alarme deviendrait
  // introuvable — une casserole qui sonne prime sur une liste qu'on lit.
  it('⛔ la sonnerie FERME la fenêtre des ingrédients', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    fireEvent.click(screen.getByRole('button', { name: /Voir les ingrédients/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(13 * 60 * 1000)
    })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Arrêter l’alarme' })).toBeTruthy()
  })
})

// ⚠️ CE BLOC EST LE MIROIR DU PRÉCÉDENT, ET LES DEUX DÉCISIONS SONT OPPOSÉES À DESSEIN. Les
// ingrédients ouvrent une FENÊTRE (`aria-haspopup="dialog"`), les gestes se déplient SUR PLACE
// (`aria-expanded`). Un relecteur pressé « harmonisera » un jour ; ces tests sont là pour l'arrêter.
// La raison tient en une phrase : une liste se consulte à côté de l'étape, une définition se lit
// dedans — et une fenêtre recouvrirait précisément l'étape qu'on cherche à comprendre.
//
// Repères du catalogue réel (`catalog/recipes/chakchouka.yaml`) : étape 1 → `[emincer]`,
// étape 2 → `[]`, étape 5 → `[pocher, parsemer]`.
describe('cuisine — les gestes du lexique', () => {
  // ⛔ LE MANQUE QUE CE LOT COMBLE. Avant lui, « c'est quoi émincer ? » en pleine cuisson obligeait
  // à quitter le mode pour rouvrir la fiche — le même trajet que pour les quantités, et la donnée
  // était déjà chargée ici elle aussi.
  it('déplie la définition SANS quitter l’étape courante', async () => {
    await monter()
    expect(screen.queryByText(/en tranches ou en lamelles fines/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Émincer' }))

    expect(screen.getByText(/en tranches ou en lamelles fines/)).toBeTruthy()
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })

  // ⛔ SUR PLACE, PAS EN FENÊTRE. `aria-expanded` parce que le bouton agrandit réellement un contenu
  // à sa place ; le mettre à `dialog` mentirait aux lecteurs d'écran ET recouvrirait l'étape.
  it('⛔ annonce un dépliant, pas une fenêtre — et n’en ouvre aucune', async () => {
    await monter()
    const bouton = screen.getByRole('button', { name: 'Émincer' })

    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    expect(bouton.hasAttribute('aria-haspopup')).toBe(false)

    fireEvent.click(bouton)
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // Une étape sur deux ne cite aucun geste. Rien ne doit apparaître — pas un titre vide, pas un
  // bloc qui prend de la place pour ne rien dire.
  it('une étape sans `lexicon_ids` n’affiche RIEN', async () => {
    const { container } = await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))

    expect(screen.getByText(/Étape 2 sur 5/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Émincer' })).toBeNull()
    // Aucun dépliant du tout : sur cet écran, `aria-expanded` n'appartient qu'aux gestes.
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(0)
  })

  it('un seul geste ouvert à la fois quand l’étape en cite deux', async () => {
    await monter()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText(/Étape 5 sur 5/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Pocher' }))
    expect(screen.getByText(/dans un liquide frémissant/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Parsemer' }))
    expect(screen.getByText(/sur toute la surface d'un plat/)).toBeTruthy()
    expect(screen.queryByText(/dans un liquide frémissant/)).toBeNull()
  })

  // ⛔ CE TEST VERROUILLE LE `key={etape.ordre}`. Sans lui, l'état « ouvert » survit au changement
  // d'étape : la définition disparaît en apparence — l'étape suivante ne cite pas le geste — puis
  // SE ROUVRE TOUTE SEULE au retour. Un dépliant qui s'ouvre sans qu'on l'ait touché, sur l'écran
  // dont le point 2 dit que rien n'y avance tout seul.
  it('⛔ revenir sur une étape la retrouve REFERMÉE', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: 'Émincer' }))
    expect(screen.getByText(/en tranches ou en lamelles fines/)).toBeTruthy()

    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('← Étape précédente'))

    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
    expect(screen.queryByText(/en tranches ou en lamelles fines/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Émincer' }).getAttribute('aria-expanded')).toBe(
      'false'
    )
  })
})

// ⚠️ CE BLOC PROTÈGE UNE PROPRIÉTÉ, PAS UN RENDU : la ligne de quantités AJOUTE, elle ne filtre
// jamais. C'est ce qui rend acceptable une dérivation à 93,7 % — un ingrédient que le rapprochement
// manque reste à un tap dans la fenêtre, donc il ne disparaît de nulle part. Le jour où quelqu'un
// transformera cette ligne en filtre, le dernier test ci-dessous tombera, et c'est exactement son
// travail (décision 60 d'ETAT.md §4).
//
// `foodIds` est DÉRIVÉ au build (`catalog/lien-etape-ingredient.mjs`) et lu depuis le catalogue
// réel : ces tests décrivent donc la chaîne entière, du texte de la recette jusqu'à l'écran.
describe('cuisine — les quantités sous l’étape', () => {
  // ⛔ LE MANQUE QUE CE LOT COMBLE. « C'était combien d'ail ? » n'ouvre plus rien du tout.
  it('⛔ affiche la quantité des ingrédients de l’étape, SANS ouvrir la fenêtre', async () => {
    await monter()
    expect(screen.queryByRole('dialog')).toBeNull()

    // Étape 1 : « Émincer l'oignon, l'ail et les poivrons en lanières. »
    expect(screen.getByText('2 gousses')).toBeTruthy()
    expect(screen.getByText('1 gros oignon')).toBeTruthy()
    expect(screen.getByText('2 poivrons rouges')).toBeTruthy()
  })

  // ⛔ `sel_fin` n'est PAS nommé par la phrase — elle dit « saler ». C'est la table de verbes de la
  // dérivation qui le retrouve, et c'est le cas que le §2.1 du document de conception donnait comme
  // définitivement hors de portée d'un rapprochement automatique.
  it('⛔ retrouve le sel d’un « saler », que la phrase ne nomme pas', async () => {
    await monter()
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getByText('Étape suivante →'))

    expect(screen.getByText(/Étape 3 sur 5/)).toBeTruthy()
    expect(screen.getByText('Sel fin')).toBeTruthy()
    expect(screen.getByText('au goût')).toBeTruthy()
  })

  // La ligne suit les portions comme la fenêtre : deux affichages du même nombre ne peuvent pas
  // diverger, ils sortent tous deux de `quantiteAffichee`.
  it('les quantités suivent les portions demandées', async () => {
    await monter(CHAKCHOUKA, 8)
    // 2 gousses pour 4 portions → 4 pour 8. Le LIBELLÉ est mis à l'échelle, jamais converti en
    // grammes (`ui/quantites.ts`).
    expect(screen.getByText('4 gousses')).toBeTruthy()
    expect(screen.queryByText('2 gousses')).toBeNull()
  })

  // Une étape sur seize n'emploie réellement aucun ingrédient. Elle ne doit pas afficher un bandeau
  // vide : c'est l'écran qui a le moins de place et le plus besoin d'air.
  it('n’affiche RIEN sous une étape qui n’emploie aucun ingrédient', async () => {
    const { container } = await monter('bananes_roties_chocolat')
    // Étape 1 : « Préchauffer le four à 190 °C. » — aucun aliment dérivé.
    expect(screen.getByText(/Préchauffer le four/)).toBeTruthy()
    const carte = container.querySelector('section')
    expect(carte?.textContent).not.toMatch(/\d+\s*(g|banane|carré)/)
  })

  // ⛔ LE TEST QUI EMPÊCHE LA DÉRIVE VERS UN FILTRE. La ligne montre les 3 ingrédients de l'étape 1 ;
  // la fenêtre continue de montrer les 10 de la recette, coriandre et œufs compris. Si un jour la
  // seconde se met à ne montrer que la première, l'écran ment par omission.
  it('⛔ la ligne AJOUTE — la fenêtre garde TOUS les ingrédients de la recette', async () => {
    await monter()
    fireEvent.click(screen.getByRole('button', { name: /Voir les ingrédients/ }))

    const fenetre = within(screen.getByRole('dialog'))
    // Absents de l'étape 1, présents dans la recette : ils doivent rester listés.
    expect(fenetre.getByText('6 œufs')).toBeTruthy()
    expect(fenetre.getByText('quelques brins')).toBeTruthy()
    expect(fenetre.getByText('6 tomates')).toBeTruthy()
  })
})
