// @vitest-environment jsdom
//
// ui/screens/aujourdhui.test.tsx — la carte plein écran, ses flèches et son encart d'aide.
//
// ⚠️ CE FICHIER GARDE UN DÉFAUT TROUVÉ EN PILOTANT UN NAVIGATEUR, pas en relisant. L'encart
// « Dites-moi ce que vous cherchez » s'affichait tant que `changements >= SEUIL` ; choisir une
// pastille remettait ce compteur à zéro — pour ne pas re-proposer de l'aide juste après en avoir
// donné — et l'encart DISPARAISSAIT sous le doigt, entre la première pastille et la deuxième.
//
// Le test qui suit clique une pastille et vérifie que l'encart est toujours là. C'est exactement ce
// qu'aucun test unitaire ne pouvait voir.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { writeRythme } from '../../data/user-store.js'
import { baseCourante, catalogueDeTest, reinitialiserBase, sessionDeTest, confianceDeTest} from '../test-socle.js'

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
  // Deux repas par jour : déjeuner + dîner, comme le défaut du premier lancement.
  writeRythme(baseCourante(), { repasParJour: 2, tempsSemaineMin: null, tempsWeekendMin: null })
})
afterEach(cleanup)

/**
 * Monte l'écran et attend la première carte.
 *
 * ⚠️ `ProvenanceLancerParcours` IMPORTÉ DYNAMIQUEMENT, PAS EN TÊTE DE FICHIER — `beforeEach` appelle
 * `vi.resetModules()` : un import statique figerait un `Context` React d'AVANT la réinitialisation,
 * distinct de celui que `Aujourdhui` (importé dynamiquement) utilise réellement dans
 * `<LienTutoriel>` — `useLancerParcours()` lèverait malgré un provider bel et bien monté au-dessus.
 */
async function monter() {
  const { Aujourdhui } = await import('./aujourdhui.js')
  const { ProvenanceLancerParcours } = await import('../lancer-parcours.js')
  render(
    <ProvenanceLancerParcours value={() => undefined}>
      <Aujourdhui />
    </ProvenanceLancerParcours>
  )
  await screen.findByText(/sur \d+$/)
}

const platAffiche = (): string => document.querySelector('article h2')!.textContent!
const compteur = (): string => screen.getByText(/^\d+ sur \d+$/).textContent!
const bouton = (texte: string | RegExp) => screen.getByText(texte).closest('button') as HTMLButtonElement
const encart = () => screen.queryByText(/Rien n'est obligatoire/)
/** Nombre de suggestions annoncé par « X sur N ». */
const tailleListe = (): number => Number(compteur().split(' sur ')[1])

/**
 * Clique « Suivant » jusqu'à ce que l'encart d'aide s'ouvre, et échoue s'il ne s'ouvre pas.
 *
 * ⛔ NE PAS REVENIR À UN NOMBRE FIXE DE CLICS — c'est le défaut que ce helper corrige, et il a
 * fait rougir `main` le 2026-08-07. L'encart s'ouvre à `vues.size - 1 >= SEUIL_INDECISION`, donc
 * il faut **11 recettes DISTINCTES** ; la liste en compte **12**. Écrire « 10 clics » ne laissait
 * qu'**UNE recette de marge**, et un simple lot de contenu (`e3bc94c`, cinq recettes classiques)
 * l'a mangée : le classement a changé, et après un choix il fallait 11 clics au lieu de 10.
 *
 * ⚠️ Le test échouait alors qu'AUCUN comportement n'avait bougé. Un test d'écran doit **piloter
 * jusqu'à l'état qu'il veut vérifier**, jamais parier sur la taille du catalogue — celui-ci est
 * un chantier explicitement en cours (§8.2). Même famille que l'exemption de `semaine.test.tsx`.
 */
async function ouvrirEncartParIndecision() {
  const plafond = tailleListe() * 2 // un tour complet de la liste suffit largement
  for (let i = 0; i < plafond && encart() === null; i++) fireEvent.click(bouton(/Suivant/))
  await screen.findByText(/Rien n'est obligatoire/)
}

/** L'image de la carte, ou `null` si c'est l'aplat qui tient la place. Enfants DIRECTS de la carte. */
const imageDeLaCarte = () => document.querySelector('article > img') as HTMLImageElement | null
const aplatDeLaCarte = () => document.querySelector('article > div[aria-hidden]') as HTMLElement | null

/**
 * Ce que le CATALOGUE annonce pour le plat affiché : son `imagePath`, ou `null`.
 *
 * ⚠️ On interroge le catalogue réel, pas le DOM — c'est ce qui rend le test capable de dire que
 * l'écran affiche autre chose que ce que la donnée contient.
 */
function photoAttendue(): string | null {
  const nom = platAffiche()
  for (const r of catalogueDeTest().recipes.values()) if (r.nom === nom) return r.imagePath
  throw new Error(`plat affiché introuvable au catalogue : ${nom}`)
}

/**
 * Fait défiler jusqu'à un plat dont la photo satisfait `veut`, et ÉCHOUE si la liste n'en contient
 * aucun.
 *
 * ⛔ NE PAS REMPLACER PAR UN INDICE FIXE. Quel plat porte une photo dépend du CONTENU (129 recettes
 * sur 330 au 2026-08-13) et du classement du moteur — deux choses qui bougent à chaque lot. Le test
 * qui vivait ici lisait la PREMIÈRE carte et supposait qu'elle n'avait pas de photo : il passait par
 * coïncidence, et serait devenu rouge le jour où le moteur aurait proposé un plat photographié en
 * tête. Même famille que `ouvrirEncartParIndecision` ci-dessus.
 */
function allerVersPlat(veut: (photo: string | null) => boolean): void {
  const n = tailleListe()
  for (let i = 0; i < n; i++) {
    if (veut(photoAttendue())) return
    if (i < n - 1) fireEvent.click(bouton(/Suivant/))
  }
  throw new Error('aucun plat de la liste du créneau ne satisfait le critère demandé')
}

/** Parcourt la liste du créneau courant en entier et rend les plats dans l'ordre affiché. */
function listeDuCreneau(): readonly string[] {
  const plats = [platAffiche()]
  for (let i = 1; i < tailleListe(); i++) {
    fireEvent.click(bouton(/Suivant/))
    plats.push(platAffiche())
  }
  return plats
}

describe('aujourdhui — la carte', () => {
  it('titre l’écran d’après l’heure et le rythme, jamais « Ce soir » en dur', async () => {
    await monter()
    // Le titre vient de `TITRE_CRENEAU` ; à deux repas, c'est « Ce midi » ou « Ce soir » selon
    // l'heure de la machine. Ce qui compte est qu'il appartienne au vocabulaire, pas qu'il soit figé.
    const titre = screen.getByRole('heading', { level: 1 }).textContent
    expect(['Ce matin', 'Ce midi', 'Ce soir', 'Pour le goûter']).toContain(titre)
  })

  it('affiche un aplat de couleur et l’annonce comme un bouche-trou, sur un plat SANS photo', async () => {
    await monter()
    allerVersPlat((photo) => photo === null)

    const aplat = aplatDeLaCarte()
    expect(aplat).not.toBeNull()
    expect(aplat!.style.backgroundColor).not.toBe('')
    expect(screen.getByText('Photo à venir')).toBeDefined()
    expect(imageDeLaCarte()).toBeNull()
  })

  it('affiche la VRAIE photo quand la recette en porte une — et retire « Photo à venir »', async () => {
    await monter()
    allerVersPlat((photo) => photo !== null)

    const img = imageDeLaCarte()
    expect(img, 'aucune image sur un plat qui porte pourtant un imagePath').not.toBeNull()
    expect(img!.getAttribute('src')).toBe(photoAttendue())
    // `alt` VIDE et non descriptif : le nom du plat est le `<h2>` juste dessous. Un `alt` qui le
    // répéterait le ferait annoncer deux fois par un lecteur d'écran.
    expect(img!.getAttribute('alt')).toBe('')
    expect(aplatDeLaCarte(), 'l’aplat cohabite avec la photo').toBeNull()
    expect(screen.queryByText('Photo à venir'), '« Photo à venir » au-dessus d’une vraie photo').toBeNull()
  })

  it('⛔ JAMAIS LES DEUX, JAMAIS AUCUN — sur TOUTE la liste, l’écran suit ce que dit le catalogue', async () => {
    // L'invariant qui ne dépend d'aucun contenu : quelle que soit la liste du jour, chaque carte
    // montre exactement une chose, et c'est celle que la donnée annonce. C'est ce test qui
    // attraperait un `photoDe` branché sur le mauvais champ, ou un repli qui ne se déclenche plus.
    await monter()
    const n = tailleListe()

    for (let i = 0; i < n; i++) {
      const attendue = photoAttendue()
      const img = imageDeLaCarte()
      const aplat = aplatDeLaCarte()

      expect(img === null, `${platAffiche()} : ni photo ni aplat`).not.toBe(aplat === null)
      if (attendue === null) expect(img, `${platAffiche()} : photo affichée sans imagePath`).toBeNull()
      else expect(img?.getAttribute('src'), `${platAffiche()} : mauvaise source`).toBe(attendue)

      if (i < n - 1) fireEvent.click(bouton(/Suivant/))
    }
  })

  it('désactive « Précédent » sur la première carte, jamais « Suivant »', async () => {
    await monter()
    expect(bouton(/Précédent/).disabled).toBe(true)
    expect(bouton(/Suivant/).disabled).toBe(false)
  })
})

describe('aujourdhui — les flèches', () => {
  it('change de plat et fait avancer le compteur', async () => {
    await monter()
    const premier = platAffiche()
    expect(compteur()).toMatch(/^1 sur /)

    fireEvent.click(bouton(/Suivant/))
    await waitFor(() => expect(compteur()).toMatch(/^2 sur /))
    expect(platAffiche()).not.toBe(premier)

    fireEvent.click(bouton(/Précédent/))
    await waitFor(() => expect(compteur()).toMatch(/^1 sur /))
    expect(platAffiche()).toBe(premier)
  })
})

describe('aujourdhui — l’encart d’aide', () => {
  it('reste fermé au départ — « détecter l’indécision PUIS proposer »', async () => {
    await monter()
    expect(screen.queryByText(/Rien n'est obligatoire/)).toBeNull()
  })

  it('s’ouvre quand on a vu assez de plats distincts sans en choisir aucun', async () => {
    await monter()
    await ouvrirEncartParIndecision()
    expect(screen.getByText('Plutôt léger ou consistant ?')).toBeDefined()
  })

  it('⛔ NE SE REFERME PAS quand on choisit une pastille', async () => {
    // LE DÉFAUT QUE CE TEST GARDE. Régler une envie remettait le compteur d'indécision à zéro, ce
    // qui rendait la condition d'affichage de l'encart fausse : il disparaissait entre la première
    // pastille et la deuxième.
    await monter()
    await ouvrirEncartParIndecision()

    fireEvent.click(screen.getByText('Léger'))
    await waitFor(() => expect(screen.getByText('Léger').getAttribute('aria-pressed')).toBe('true'))

    // L'encart est toujours là…
    expect(screen.queryByText(/Rien n'est obligatoire/)).not.toBeNull()
    // …et on peut en choisir une seconde, ce qui était impossible.
    fireEvent.click(screen.getByText('20 min'))
    await waitFor(() => expect(screen.getByText('20 min').getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByText('Léger').getAttribute('aria-pressed')).toBe('true')
  })

  it('ne s’ouvre PAS après un aller-retour répété entre les deux mêmes plats', async () => {
    // C'est quelqu'un qui compare deux plats, pas quelqu'un de perdu : `vues` ne grossit pas au-delà
    // des deux recettes distinctes visitées, même après beaucoup de gestes.
    await monter()
    for (let i = 0; i < 10; i++) {
      fireEvent.click(bouton(/Suivant/))
      await waitFor(() => expect(compteur()).toMatch(/^2 sur /))
      fireEvent.click(bouton(/Précédent/))
      await waitFor(() => expect(compteur()).toMatch(/^1 sur /))
    }
    expect(screen.queryByText(/^Dites-moi ce que vous cherchez$/)).not.toBeNull()
    expect(screen.queryByText(/Rien n'est obligatoire/)).toBeNull()
  })

  it('choisir un plat remet le compteur d’indécision à zéro', async () => {
    await monter()
    await ouvrirEncartParIndecision()

    fireEvent.click(bouton(/J'ai choisi ce plat/))
    await waitFor(() => expect(encart()).toBeNull())

    // Revoir assez de plats distincts après le choix redéclenche l'encart : la remise à zéro
    // n'est pas définitive.
    await ouvrirEncartParIndecision()
  })

  it('ne propose QUE des axes que le moteur sait lire', async () => {
    // Une pastille qui ne piloterait aucune couche donnerait le sentiment d'avoir été écouté sans
    // l'être. Les trois axes sont exactement ceux de `CravingAxes`.
    await monter()
    fireEvent.click(screen.getByText('Dites-moi ce que vous cherchez'))
    await screen.findByText(/Rien n'est obligatoire/)
    const questions = [...document.querySelectorAll('legend')].map((l) => l.textContent)
    expect(questions).toEqual([
      'Combien de temps devant vous ?',
      'Plutôt léger ou consistant ?',
      'Chaud ou froid ?',
      'Salé ou sucré ?',
    ])
  })
})

describe('aujourdhui — l’ordre des blocs', () => {
  it('« Dites-moi ce que vous cherchez » précède la carte de recette dans le document', async () => {
    await monter()
    const boutonEnvie = screen.getByText(/^Dites-moi ce que vous cherchez$/)
    const carte = document.querySelector('article[data-visite="carte-plat"]') as HTMLElement
    expect(carte).not.toBeNull()
    // DOCUMENT_POSITION_FOLLOWING sur `carte` = `carte` vient APRÈS `boutonEnvie`.
    expect(
      boutonEnvie.compareDocumentPosition(carte) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})

describe('aujourdhui — proposer autre chose', () => {
  it('change effectivement la liste et remet la position à 0', async () => {
    await monter()

    // Toutes les recettes de la 1ère liste (pas seulement le 1er plat) : on avance jusqu'au bout.
    const premiereListe: string[] = [platAffiche()]
    let position = 1
    while (!bouton(/Suivant/).disabled) {
      fireEvent.click(bouton(/Suivant/))
      position++
      await waitFor(() => expect(compteur()).toMatch(new RegExp(`^${position} sur `)))
      premiereListe.push(platAffiche())
    }

    fireEvent.click(bouton(/Proposer autre chose/))
    await waitFor(() => expect(compteur()).toMatch(/^1 sur /))

    const secondeListe: string[] = [platAffiche()]
    position = 1
    while (!bouton(/Suivant/).disabled) {
      fireEvent.click(bouton(/Suivant/))
      position++
      await waitFor(() => expect(compteur()).toMatch(new RegExp(`^${position} sur `)))
      secondeListe.push(platAffiche())
    }

    expect(secondeListe).not.toEqual(premiereListe)
  })
})

describe('aujourdhui — les plats proches', () => {
  it('propose d’autres plats, tous différents de celui qu’on regarde', async () => {
    await monter()
    await screen.findByText('Dans le même esprit')

    // ⛔ COMPARÉ SUR L'IDENTIFIANT, PAS SUR LE TEXTE — corrigé le 2026-08-09, et le défaut était
    // DANS CE TEST. Il lisait le `textContent` des liens et vérifiait qu'aucun ne CONTENAIT le nom
    // du plat affiché. « Dahl de lentilles corail » est un préfixe exact de « Dahl de lentilles
    // corail aux épinards » : deux recettes bel et bien distinctes, que la sous-chaîne déclarait
    // identiques. Le test n'a rien vu tant que le tirage ne tombait pas sur ce couple — c'est un lot
    // de contenu qui l'a réveillé, pas une régression de l'écran.
    //
    // Le `href` porte l'identifiant de la recette ; c'est le seul oracle qui ne peut pas se tromper
    // de plat. Le texte, lui, ne distingue même pas deux recettes homonymes.
    const courante = screen.getByText('Voir la recette').closest('a')!.getAttribute('href')
    const proches = [...document.querySelectorAll('section ul li a')].map((a) => a.getAttribute('href'))
    expect(proches.length).toBeGreaterThan(0)
    for (const proche of proches) expect(proche).not.toBe(courante)
    // Et pas deux fois le même plat dans la liste : la carte le montrerait deux fois côte à côte.
    expect(new Set(proches).size).toBe(proches.length)
  })
})

describe('aujourdhui — le frigo', () => {
  it('offre l’entrée « Vider le frigo », que §4.5 réclamait depuis le début, une seule fois', async () => {
    await monter()
    // ⚠️ « une seule fois » : deux liens identiques feraient douter qu'ils fassent la même chose.
    expect(screen.getAllByText(/Vider le frigo/)).toHaveLength(1)
    expect(document.querySelector('a[href="#/frigo"]')).not.toBeNull()
  })
})

describe('aujourdhui — changer de créneau', () => {
  it('propose exactement les créneaux du rythme déclaré, deux repas', async () => {
    // `beforeEach` règle déjà 2 repas/jour : déjeuner + dîner.
    await monter()
    expect(screen.getByRole('button', { name: 'Ce midi' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Ce soir' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Ce matin' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pour le goûter' })).toBeNull()
  })

  it('n’affiche aucun sélecteur à un seul repas par jour', async () => {
    writeRythme(baseCourante(), { repasParJour: 1, tempsSemaineMin: null, tempsWeekendMin: null })
    await monter()
    // Un seul créneau ('diner') → rien à choisir : ni « Ce soir » ni aucun autre bouton de créneau.
    expect(screen.queryByRole('button', { name: /^Ce (matin|midi)$|^Pour le goûter$|^Ce soir$/ })).toBeNull()
  })

  it('choisir un autre créneau change les suggestions et remet la position à 1 sur N', async () => {
    // ⛔ CE TEST COMPARAIT LE PLAT N°1 DU NOUVEAU CRÉNEAU AU PLAT N°2 DE L'ANCIEN — deux positions
    // différentes, donc une comparaison qui ne prouvait rien. Elle a tenu par coïncidence de
    // classement jusqu'au 2026-08-07, où « Pizza maison tomate-mozzarella » s'est retrouvée en
    // tête d'un créneau et en deuxième de l'autre. ⚠️ Et « le plat du midi diffère de celui du
    // soir » N'EST PAS une promesse du produit : presque tous les plats portent
    // `types_repas: [dejeuner, diner]`, rien n'interdit au moteur de classer le même en tête.
    // Ce qui EST vrai et vérifiable, c'est que la LISTE change : mesuré le 2026-08-07, les deux
    // créneaux partagent 1 plat sur 12. On compare donc les listes, pas un plat contre un autre.
    await monter()
    const titreDepart = screen.getByRole('heading', { level: 1 }).textContent
    const autre = titreDepart === 'Ce midi' ? 'Ce soir' : 'Ce midi'
    const listeAvant = listeDuCreneau()

    fireEvent.click(screen.getByRole('button', { name: autre }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(autre))
    expect(compteur()).toMatch(/^1 sur /)
    expect(screen.getByRole('button', { name: autre }).getAttribute('aria-pressed')).toBe('true')
    expect(listeDuCreneau()).not.toEqual(listeAvant)
  })
})
