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
import { readCuissons, writeCuisson } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest } from '../test-socle.js'
import { hashDeRecette } from '../router.js'
import type { RecipeId } from '../../engine/domain/index.js'
import { dureeEcouleeMin } from '../../engine/cuisine/duree.js'

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
  const rendu = render(<Cuisine plats={[{ id: recetteId, portions: portionsDemandees }]} />)
  await screen.findByRole('heading', { level: 1 })
  return rendu
}

/** Plusieurs plats d'un coup — l'écran les affiche dans l'ordre de départ, pas dans celui-ci. */
async function monterPlusieurs(...ids: readonly string[]) {
  const { Cuisine } = await import('./cuisine.js')
  const rendu = render(<Cuisine plats={ids.map((id) => ({ id, portions: null }))} />)
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
    // ⚠️ « 1 gros oignon » ET NON « l'oignon » : la quantité est posée DANS la phrase au rendu
    // (`ui/texte-etape.ts`), le YAML dit toujours « Émincer l'oignon ». Ce test ne parle pas de
    // cette règle-là — il vérifie que l'étape n'a pas bougé — mais il en lit la sortie.
    //
    // ⚠️ `textContent` ET NON `getByText`, et ce n'est pas interchangeable ici : la quantité est
    // dans un `<strong>`, or `getByText` ne lit que les nœuds texte DIRECTS d'un élément. La phrase
    // entière n'appartient à aucun nœud unique — la chercher par `getByText` échoue toujours.
    expect(document.body.textContent).toContain('Émincer 1 gros oignon')
  })

  // ⛔ LE TEST QUI PROTÈGE `sauf`. La quantité passe dans la phrase ET la ligne de badges existe
  // toujours : sans le retrait, l'étape annoncerait « 1 gros oignon » deux fois à deux centimètres
  // d'écart. C'est le seul endroit où le câblage des deux composants se vérifie — chacun pris
  // isolément est correct.
  it('⛔ ne répète PAS en badge la quantité déjà posée dans la phrase', async () => {
    await monter()
    const texte = document.body.textContent ?? ''
    expect(texte.split('1 gros oignon')).toHaveLength(2)
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

  // ⛔ LE DÉFAUT SE LISAIT À L'ÉCRAN, SUR DU CONTENU COMMITÉ. `coq-au-vin` fait mariner 43 200 s
  // (« la veille de préférence ») : en `mm:ss`, ce bouton annonçait « Lancer le minuteur (720:00) »
  // et le décompte affichait « 719:59 » en 2,2 rem. 22 recettes du catalogue portent un minuteur de
  // plus d'une heure — ce n'était pas un cas limite. La règle de format est testée à part dans
  // `cuisine-session.test.ts` ; ici on vérifie qu'elle atteint bien l'écran, sur une vraie recette.
  it('⛔ un minuteur de douze heures s’annonce en heures, jamais en « 720:00 »', async () => {
    await monter('coq_au_vin')

    expect(screen.getByText('Lancer le minuteur (12 h 00)')).toBeTruthy()
    expect(screen.queryByText(/720:00/)).toBeNull()
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
    writeCuisson(baseCourante(), {
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
    writeCuisson(baseCourante(), {
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
    writeCuisson(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now() - 60 * 60 * 1000,
      portions: null,
      minuteurs: [{ ordre: 2, finMs: Date.now() - 55 * 60 * 1000, pauseRestantS: null }],
    })

    await monter()
    expect(screen.queryByRole('button', { name: 'Arrêter l’alarme' })).toBeNull()
  })

  // ⛔ LE TROU SYMÉTRIQUE DU PRÉCÉDENT, ET IL ÉTAIT SILENCIEUX. Le garde-fou d'origine semait un
  // `Set` des minuteurs échus AU MONTAGE : il supprimait donc la sonnerie de TOUT minuteur déjà
  // échu, y compris celui qui venait d'aboutir pendant qu'on posait le téléphone. Le seuil qui
  // sépare les deux cas est l'arrêt automatique de l'alarme (`sonnerieEncoreJuste`).
  it('⛔ SONNE pour un minuteur qui vient d’aboutir, même à l’ouverture', async () => {
    writeCuisson(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 2,
      ouverteLe: Date.now() - 20 * 60 * 1000,
      portions: null,
      minuteurs: [{ ordre: 2, finMs: Date.now() - 30 * 1000, pauseRestantS: null }],
    })

    await monter()
    expect(await screen.findByRole('button', { name: 'Arrêter l’alarme' })).toBeTruthy()
  })

  // ⛔ « ÉTAPE 0 » S'AFFICHAIT. Une recette modifiée pendant sa cuisson — l'éditeur de recette
  // existe — ou renumérotée par une mise à jour de catalogue laisse un minuteur qui ne pointe plus
  // aucun geste : `findIndex` rend `-1` et la ligne annonçait « Étape 0 — il reste 4:12 ».
  // ⚠️ Le décompte doit RESTER : le faire disparaître serait pire, c'est un décompte qu'on oublie.
  it('⛔ un minuteur dont l’étape a disparu perd son numéro, jamais son décompte', async () => {
    writeCuisson(baseCourante(), {
      recetteId: CHAKCHOUKA,
      ordreCourant: 1,
      ouverteLe: Date.now(),
      portions: null,
      minuteurs: [{ ordre: 99, finMs: Date.now() + 5 * 60 * 1000, pauseRestantS: null }],
    })

    await monter()

    const encours = screen.getByRole('heading', { name: 'Minuteurs en cours' }).parentElement
    expect(encours?.textContent).toMatch(/il reste/)
    expect(encours?.textContent).not.toContain('Étape 0')
  })

  it('une session d’une AUTRE recette ne se reprend pas ici', async () => {
    writeCuisson(baseCourante(), {
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

describe('cuisine — terminer', () => {
  // ⛔ LE CAS N'A RIEN D'EXOTIQUE : la dernière étape d'un plat est souvent un repos, on lance son
  // minuteur, et le bouton qui clôt le déroulé est juste à côté. La fermeture emportait la
  // ligne ET ses enfants, sans un mot.
  it('⛔ ne jette pas un minuteur en cours sans le dire', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Étape suivante →'))

    fireEvent.click(screen.getByText('Terminer la cuisson'))

    expect(within(screen.getByRole('dialog')).getByText(/minuteur tourne encore/)).toBeTruthy()
    // ⚠️ CE QUI COMPTE : rien n'a encore été effacé. Une fenêtre qui s'ouvre APRÈS la destruction
    // serait une politesse, pas un garde-fou.
    expect((readCuissons(baseCourante())[0] ?? null)).not.toBeNull()
  })

  // ⚠️ Une confirmation systématique est une confirmation qu'on cesse de lire au troisième plat —
  // elle aurait alors coûté la seule chose qu'elle protège.
  it('sans minuteur en cours, termine sans rien demander', async () => {
    await monter()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))

    fireEvent.click(screen.getByText('Terminer la cuisson'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect((readCuissons(baseCourante())[0] ?? null)).toBeNull()
  })

  it('« Terminer quand même » va au bout', async () => {
    await monter()
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Étape suivante →'))

    fireEvent.click(screen.getByText('Terminer la cuisson'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Terminer quand même'))

    expect((readCuissons(baseCourante())[0] ?? null)).toBeNull()
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
    render(<Cuisine plats={[{ id: 'recette_qui_n_existe_pas', portions: null }]} />)
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

    expect((readCuissons(baseCourante())[0] ?? null)?.portions).toBe(5)
    expect(screen.getByRole('button', { name: /pour 5 portions/ })).toBeTruthy()
  })

  it('⛔ reprendre une cuisson ne RAMÈNE PAS les portions à la valeur de base', async () => {
    writeCuisson(baseCourante(), {
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
    writeCuisson(baseCourante(), {
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

// ⚠️ CE BLOC TESTE LE PASSAGE D'UNE RECETTE À PLUSIEURS. `chakchouka` (45 min) et `coq_au_vin`
// (115 min) sont choisis parce qu'ils portent tous deux CINQ étapes « geste » et un minuteur au
// même `ordre` (3) — exactement le terrain où `cleMinuteur` doit empêcher la confusion.
describe('cuisine — la barre d’onglets (plusieurs plats)', () => {
  it('un seul plat : aucune barre d’onglets', async () => {
    await monter()
    // Un onglet unique n'offre aucun choix, il mangerait de la hauteur pour ne rien dire.
    expect(screen.queryByRole('navigation', { name: 'Plats en cours' })).toBeNull()
  })

  it('deux plats : la barre porte les deux noms, un seul onglet porte aria-current', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    expect(within(nav).getByText('Chakchouka')).toBeTruthy()
    expect(within(nav).getByText('Coq au vin')).toBeTruthy()

    const actifs = within(nav)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-current') === 'true')
    expect(actifs).toHaveLength(1)
    // Chakchouka est premier dans le lien : c'est lui l'onglet actif.
    expect(actifs[0]?.textContent).toContain('Chakchouka')
  })

  it('⛔ l’ordre des onglets vient du MOTEUR, pas de l’ordre du lien', async () => {
    // Les durées sont LUES au catalogue, pas codées en dur : un lot de contenu qui les changerait ne
    // doit pas faire mentir ce test, il doit le faire échouer franchement s'il égalise les deux.
    const cat = catalogueDeTest()
    const chak = cat.recipes.get(CHAKCHOUKA as RecipeId)
    const coq = cat.recipes.get('coq_au_vin' as RecipeId)
    if (chak === undefined || coq === undefined) throw new Error('recettes de test introuvables')
    const duree = (r: typeof chak): number => r.tempsPrepMin + r.tempsCuissonMin
    const [court, long] = duree(chak) <= duree(coq) ? [chak, coq] : [coq, chak]
    expect(duree(long)).toBeGreaterThan(duree(court))

    await monterPlusieurs(court.id, long.id) // la plus courte en premier dans le LIEN
    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    const boutons = within(nav).getAllByRole('button')
    expect(boutons[0]?.textContent).toContain(long.nom)
    expect(boutons[1]?.textContent).toContain(court.nom)
  })

  it('⛔ L’ORDRE SUIT LA DURÉE ÉCOULÉE, PAS LA DURÉE ACTIVE — le défaut que L1 répare', async () => {
    // ⚠️ CE TEST EST LE SEUL DE CE FICHIER OÙ LES DEUX DURÉES DONNENT DES RÉPONSES CONTRAIRES, et
    // c'est tout son intérêt. Le test précédent compare Chakchouka et Coq au vin : le coq est le
    // plus long des deux dans les DEUX comptes, il resterait vert avec le calcul fautif.
    //
    // Ici le pudding de chia demande 6 min de travail et 8 h de prise au froid ; la chakchouka
    // demande 45 min et aucun repos. Avec `tempsPrepMin + tempsCuissonMin`, la chakchouka passait
    // devant et le pudding était annoncé « à lancer 6 min avant le service » — servi liquide.
    const cat = catalogueDeTest()
    const pudding = cat.recipes.get('pudding_chia_cacao_poire' as RecipeId)
    const chak = cat.recipes.get(CHAKCHOUKA as RecipeId)
    if (pudding === undefined || chak === undefined) throw new Error('recettes de test introuvables')

    // Les deux prémisses sont VÉRIFIÉES, pas supposées : un lot de contenu qui chiffrerait la prise
    // du pudding autrement doit faire échouer ce test franchement, pas le rendre vide de sens.
    const actif = (r: typeof chak): number => r.tempsPrepMin + r.tempsCuissonMin
    expect(actif(pudding)).toBeLessThan(actif(chak))
    expect(dureeEcouleeMin(pudding)).toBeGreaterThan(dureeEcouleeMin(chak))

    await monterPlusieurs(chak.id, pudding.id)
    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    const boutons = within(nav).getAllByRole('button')
    expect(boutons[0]?.textContent).toContain(pudding.nom)
    expect(boutons[1]?.textContent).toContain(chak.nom)
  })

  it('⛔ L’ORDRE N’EST PLUS « LE PLUS LONG D’ABORD » — deux plats tout actifs s’inversent (L2)', async () => {
    // Chakchouka : 45 min de gestes, aucun repos. Fromage blanc, fruits rouges et miel : 5 min de
    // gestes, aucun repos. Une seule paire de mains ne peut pas faire les deux en même temps : la
    // chakchouka garde le créneau collé au service, et le fromage blanc — 5 min — doit être monté
    // AVANT elle, donc lancé en premier. C'est contraire à l'ordre des durées, et c'est juste.
    //
    // ⚠️ CE TEST TOMBE LE JOUR OÙ L'ÉCRAN RETRIE PAR DURÉE « pour remettre de l'ordre ». Il ne lit
    // aucune minute : rien n'affiche d'heure de départ à ce stade du mode cuisine, seule la barre
    // d'onglets porte le résultat de l'ordonnancement.
    const cat = catalogueDeTest()
    const chak = cat.recipes.get(CHAKCHOUKA as RecipeId)
    const fromage = cat.recipes.get('fromage_blanc_fruits_miel' as RecipeId)
    if (chak === undefined || fromage === undefined) throw new Error('recettes de test introuvables')

    // Prémisses VÉRIFIÉES : le fromage blanc est le plus court des deux, et ni l'un ni l'autre ne
    // porte de repos — sans quoi le test parlerait d'autre chose que de ce qu'il annonce.
    expect(dureeEcouleeMin(fromage)).toBeLessThan(dureeEcouleeMin(chak))
    expect(dureeEcouleeMin(fromage)).toBe(fromage.tempsPrepMin + fromage.tempsCuissonMin)
    expect(dureeEcouleeMin(chak)).toBe(chak.tempsPrepMin + chak.tempsCuissonMin)

    await monterPlusieurs(chak.id, fromage.id)
    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    const boutons = within(nav).getAllByRole('button')
    expect(boutons[0]?.textContent).toContain(fromage.nom)
    expect(boutons[1]?.textContent).toContain(chak.nom)
  })

  it('deux plats au four : l’écran le NOMME, sans rien déplacer (L3)', async () => {
    const cat = catalogueDeTest()
    const peches = cat.recipes.get('peches_sirop_erable' as RecipeId)
    const chevre = cat.recipes.get('chevre_chaud_miel_thym' as RecipeId)
    if (peches === undefined || chevre === undefined) throw new Error('recettes de test introuvables')

    // Prémisse VÉRIFIÉE : les deux exigent bien le four, et en `requis`. Un lot de contenu qui
    // rétrograderait l'un des deux en `informatif` doit faire échouer ce test franchement.
    const exigeLeFour = (r: typeof chevre): boolean =>
      r.equipements.some((e) => (e.equipmentId as string) === 'four' && e.niveau === 'requis')
    expect(exigeLeFour(peches)).toBe(true)
    expect(exigeLeFour(chevre)).toBe(true)

    await monterPlusieurs(peches.id, chevre.id)
    const constat = screen.getByRole('status')
    expect(constat.textContent).toContain('Four')
    expect(constat.textContent).toContain(peches.nom)
    expect(constat.textContent).toContain(chevre.nom)
  })

  it('⛔ DEUX PLATS SUR LA PLAQUE NE DÉCLENCHENT RIEN — sinon le constat parlerait tout le temps', () => {
    // 260 recettes sur 330 déclarent la plaque `requis` : la signaler reviendrait à afficher ce bloc
    // à presque chaque cuisson à deux plats, ce qui est la façon la plus sûre de le rendre invisible.
    const cat = catalogueDeTest()
    const chak = cat.recipes.get(CHAKCHOUKA as RecipeId)!
    const fromage = cat.recipes.get('fromage_blanc_fruits_miel' as RecipeId)!
    const codes = (r: typeof chak): readonly string[] =>
      r.equipements.filter((e) => e.niveau === 'requis').map((e) => e.equipmentId as string)

    // Prémisse : ces deux-là partagent bien un `requis`, et c'est la plaque — sans quoi le test
    // passerait pour une bonne raison qui n'est pas la sienne.
    expect(codes(chak)).toContain('plaque_cuisson')
    expect(codes(fromage)).toContain('plaque_cuisson')
    expect(codes(chak).filter((c) => codes(fromage).includes(c))).toEqual(['plaque_cuisson'])
  })

  it('et l’écran reste muet sur cette paire-là', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'fromage_blanc_fruits_miel')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('le plat AFFICHÉ est celui du lien, même s’il n’est pas premier dans la barre', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    // Coq au vin part en premier dans la barre (plus long) ; Chakchouka, demandé en premier dans le
    // lien, reste le plat affiché — appuyer sur « Cuisiner pas à pas » depuis la sauce doit montrer
    // la sauce.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chakchouka')
  })

  it('taper un onglet change le plat affiché', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Coq au vin')
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()
  })
})

describe('cuisine — l’isolement entre plats', () => {
  it('avancer l’étape d’un plat ne bouge pas l’autre, et l’avancement survit au retour', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText(/Étape 3 sur 5/)).toBeTruthy()

    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))
    expect(screen.getByText(/Étape 1 sur 5/)).toBeTruthy()

    fireEvent.click(within(nav).getByText('Chakchouka'))
    expect(screen.getByText(/Étape 3 sur 5/)).toBeTruthy()
  })

  it('« Terminer ce plat » ferme UN plat sans quitter le mode — l’autre reste en base', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText('Terminer ce plat')).toBeTruthy()

    fireEvent.click(screen.getByText('Terminer ce plat'))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Coq au vin')
    // Le point : fermer la sauce ne sort pas le rôti du four.
    const restantes = readCuissons(baseCourante())
    expect(restantes.map((c) => c.recetteId)).toEqual(['coq_au_vin'])
  })

  it('terminer le DERNIER plat quitte le mode cuisine — plus aucune cuisson en base', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Terminer ce plat')) // ferme Chakchouka

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Étape suivante →'))
    // Un seul plat restant : le libellé n'est plus « ce plat ».
    fireEvent.click(screen.getByText('Terminer la cuisson'))

    expect(readCuissons(baseCourante())).toEqual([])
    expect(window.location.hash).toBe(hashDeRecette('coq_au_vin'))
  })
})

describe('cuisine — les minuteurs entre plusieurs plats', () => {
  // ⛔ LE TEST LE PLUS IMPORTANT DU LOT. Les deux recettes portent un minuteur au même `ordre` (3) :
  // c'est exactement le terrain où deux minuteurs indexés sur `ordre` seul se confondraient.
  it('⛔ même numéro d’étape sur deux plats : deux minuteurs distincts, indépendants', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText(/Étape 3 sur 5/)).toBeTruthy()
    fireEvent.click(screen.getByText('Lancer le minuteur (10:00)'))

    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Étape suivante →'))
    expect(screen.getByText(/Étape 3 sur 5/)).toBeTruthy()
    fireEvent.click(screen.getByText('Lancer le minuteur (15:00)'))

    const cuissons = readCuissons(baseCourante())
    const chak = cuissons.find((c) => c.recetteId === CHAKCHOUKA)
    const coq = cuissons.find((c) => c.recetteId === 'coq_au_vin')
    expect(chak?.minuteurs).toHaveLength(1)
    expect(coq?.minuteurs).toHaveLength(1)
    expect(chak?.minuteurs[0]?.finMs).not.toBe(coq?.minuteurs[0]?.finMs)

    // Arrêter celui de Coq au vin (affiché) laisse celui de Chakchouka intact.
    fireEvent.click(screen.getByText('Arrêter'))
    const apres = readCuissons(baseCourante())
    expect(apres.find((c) => c.recetteId === 'coq_au_vin')?.minuteurs).toHaveLength(0)
    expect(apres.find((c) => c.recetteId === CHAKCHOUKA)?.minuteurs).toHaveLength(1)
  })

  it('l’onglet d’un plat SANS minuteur n’affiche aucun décompte, celui d’un plat AVEC en affiche un', async () => {
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    const onglet = (nom: string) =>
      within(screen.getByRole('navigation', { name: 'Plats en cours' })).getByText(nom).closest('button')

    expect(onglet('Chakchouka')?.textContent).not.toMatch(/\d+:\d{2}/)
    expect(onglet('Coq au vin')?.textContent).not.toMatch(/\d+:\d{2}/)

    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    expect(onglet('Chakchouka')?.textContent).toMatch(/\d+:\d{2}/)
    expect(onglet('Coq au vin')?.textContent).not.toMatch(/\d+:\d{2}/)
  })
})

// ⚠️ « SI UN MINUTEUR SONNE → FENÊTRE QUI PASSE DEVANT LA RECETTE EN COURS, AVEC UN RENVOI » —
// demandé nommément par l'utilisateur, écrit dans `cuisine.tsx` (`alarmeSur`, `aiguillage`,
// `stopperAlarme`, la fenêtre « Changer de plat ? ») et jusqu'ici jamais touché par un test. Non
// testée, cette fonctionnalité est indiscernable d'une fonctionnalité déclarée mais pas branchée.
describe('cuisine — l’alarme entre plusieurs plats', () => {
  it('un minuteur qui sonne sur le plat NON affiché nomme ce plat sur la surface d’alarme', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Coq au vin')

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    const arret = screen.getByRole('button', { name: 'Arrêter l’alarme' })
    expect(arret.textContent).toContain('Chakchouka')
  })

  // Le contraste avec le test précédent est le point : le même minuteur, regardé depuis SON plat,
  // ne se nomme pas — « minuteur terminé » sur l'écran du gratin alors que c'est lui qui sonne.
  it('un minuteur qui sonne sur le plat déjà AFFICHÉ ne se nomme pas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    // On reste sur Chakchouka, le plat affiché.

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    const arret = screen.getByRole('button', { name: 'Arrêter l’alarme' })
    expect(arret.textContent).not.toContain('Chakchouka')
    expect(arret.textContent).not.toContain('Coq au vin')
  })

  // ⛔ LE TEST LE PLUS IMPORTANT DU LOT. La claque à l'aveugle qui coupe la sonnerie — le geste pour
  // lequel cette surface existe — ne doit jamais déplacer, sous peine de faire perdre l'étape en
  // cours sur l'autre plat.
  it('⛔ l’appui qui tait l’alarme NE CHANGE PAS de recette affichée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Arrêter l’alarme' }))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Coq au vin')
  })

  it('le renvoi se propose APRÈS l’arrêt, dans une fenêtre — « Rester ici » ne bouge pas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Arrêter l’alarme' }))

    const dialogue = within(screen.getByRole('dialog'))
    expect(dialogue.getByText(/Le minuteur de « Chakchouka » a sonné/)).toBeTruthy()
    expect(dialogue.getByText('Rester ici')).toBeTruthy()

    fireEvent.click(dialogue.getByText('Rester ici'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Coq au vin')
  })

  it('« Aller à … » bascule le plat affiché sur celui qui a sonné', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))

    const nav = screen.getByRole('navigation', { name: 'Plats en cours' })
    fireEvent.click(within(nav).getByText('Coq au vin'))

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Arrêter l’alarme' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByText(/Aller à Chakchouka/))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chakchouka')
  })

  // Sonner sur le plat déjà affiché ne laisse nulle part où renvoyer : la fenêtre ne doit pas
  // apparaître, le comportement reste celui d'avant le multi-recettes.
  it('aucune fenêtre de renvoi quand le minuteur sonne sur le plat DÉJÀ affiché', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await monterPlusieurs(CHAKCHOUKA, 'coq_au_vin')
    fireEvent.click(screen.getByText('Étape suivante →'))
    fireEvent.click(screen.getByText('Lancer le minuteur (12:00)'))
    // On reste sur Chakchouka : rien où aller.

    await act(async () => {
      vi.advanceTimersByTime(12 * 60 * 1000 + 2000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Arrêter l’alarme' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chakchouka')
  })
})
