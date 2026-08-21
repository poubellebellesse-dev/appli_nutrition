// ui/visite.tsx — LE MÉCANISME des tutoriels guidés : des bulles qui désignent un élément réel de
// l'écran et, pour la plupart des étapes, EXIGENT un geste avant d'avancer.
//
// ⚠️ CE FICHIER NE CONNAÎT AUCUN PARCOURS PAR SON NOM. La table des huit parcours (« menus »,
// « aujourdhui »…), leurs étapes et leurs textes vivent dans `ui/parcours.ts` — voir son en-tête
// pour pourquoi la séparation est délibérée. `Visite` reçoit un `readonly EtapeVisite[]`, rien de
// plus, et n'a aucune raison de savoir à quel écran il appartient.
//
// ⚠️ CE N'EST PLUS UNE VISITE PUREMENT INFORMATIVE. La version précédente affichait quatre bulles
// qu'on lisait puis qu'on passait avec « Suivant » — l'utilisateur ne touchait jamais l'application
// pendant qu'on la lui présentait. Le retour d'essai est explicite : « on lui dit les menus → il
// clique sur les menus pour changer », « ne doit pas que informer mais inciter l'utilisateur à
// utiliser l'appli ». D'où `EtapeAttendu` : une étape peut exiger un CLIC sur la vraie cible ou une
// ARRIVÉE sur une vraie route, et dans ces deux cas le bouton « Suivant » disparaît — on ne peut pas
// passer l'étape sans avoir fait le geste.
//
// ⚠️ INSPIRÉ DE `panneau.tsx` (portail vers `document.body`, Échap, focus rendu, défilement bloqué),
// SANS LE RÉUTILISER — voir l'historique de ce fichier : un panneau est plein écran et REMPLACE le
// contenu, une visite doit laisser voir ce qu'elle désigne.
//
// ⚠️ LE FOND NE CAPTE LES CLICS QUE POUR UNE ÉTAPE « lecture ». Le fond assombri interceptait avant
// TOUT clic, sur toute étape — cohérent tant qu'aucune étape n'attendait d'action réelle sur
// l'application. Une étape « clic » ou « route » a l'effet inverse : il FAUT que le clic sur la vraie
// cible (un onglet, un bouton) atteigne l'application en dessous, sinon l'exigence de geste ne peut
// jamais être remplie. `pointer-events-none` sur tout le calque (fond + éventuel contour) résout ça —
// `pointer-events` est une propriété HÉRITÉE, la bulle elle-même reprend explicitement
// `pointer-events-auto` pour que « Passer » reste cliquable.
//
// ⚠️ CIBLE INTROUVABLE : DEUX CAS, ET LE LOT `retour-1b` A DÛ LES SÉPARER. Une cible absente est
// jugée sur `document.querySelector(...) !== null` uniquement (jamais une dimension mesurée, nulle
// sous jsdom et avant la première peinture) — mais l'absence ne veut pas dire la même chose partout :
//
//   • HORS TRANSITION D'ÉCRAN, l'étape est SAUTÉE, comme depuis toujours. Sa cible n'existe pas sur
//     ce compte-là (Courses sans liste, semaine non composée) et n'existera pas : `ui/parcours.ts`
//     écrit que ces sauts sont voulus. Si plus aucune étape n'est valide, la visite se termine.
//   • APRÈS UNE TRANSITION D'ÉCRAN, l'étape est ATTENDUE, jamais sautée. ⛔ CHAQUE ÉCRAN DE CE
//     DÉPÔT DÉMARRE EN `phase: 'chargement'` et n'affiche qu'un « Chargement… » : son ancre
//     `data-visite` n'arrive qu'après une promesse. Sauter à l'instant de l'arrivée écartait donc
//     TOUTES les étapes de l'écran d'un coup — mesuré le 2026-08-21 : le tutoriel de première
//     ouverture traversait cinq écrans en n'en montrant qu'un, et s'éteignait en silence sur le
//     dernier. Ce n'est pas un artefact de jsdom : sur téléphone le chargement est plus lent.
//     L'étape qui suit une transition est TOUJOURS l'étape d'ouverture de l'écran, inconditionnelle
//     par la règle 1 de `ui/parcours.ts` et verrouillée par `parcours.test.tsx` : l'attendre est donc
//     sûr par construction, pas par pari.
//
// ⛔ PENDANT L'ATTENTE, RIEN NE S'AFFICHE. Une bulle posée sur une cible absente est exactement le
// « tutoriel fantôme » que `premierIndexValide` existe pour empêcher : le calque revient dès que la
// cible paraît, pas avant.
//
// ⚠️ LE TUTORIEL VIT AU-DESSUS DU ROUTEUR — c'est le point structurant d'une étape « route » : une
// étape « touchez l'onglet Recettes » fait CHANGER D'ÉCRAN, et un tutoriel monté DANS un écran serait
// démonté au moment même où il réussit. `Visite` est donc monté par `main.tsx` en dehors de l'arbre
// qui dépend de la route (voir `Coquille`), et il observe la route courante avec `useRoute()` —
// EXACTEMENT le hook que `router.tsx` expose déjà pour ça, pas un second écouteur `hashchange`.
//
// ⚠️ « Passer » EST TOUJOURS LÀ, sur CHAQUE étape, y compris les étapes qui attendent un geste — un
// tutoriel qui exige une action et dont on ne peut pas sortir est un piège, pas un guide, en
// particulier sur la contrainte d'âge de ce produit (§4 CLAUDE.md).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { hashDe, useRoute } from './router.js'
// Note : aucun import de `./parcours.js` ici — voir l'en-tête, ce fichier ignore délibérément ce
// qu'est un parcours.

/**
 * Ce qu'il faut faire pour quitter l'étape.
 *
 * `lecture` : on lit, on appuie sur « Suivant » — seul mode qui existait avant. `clic` : il faut
 * cliquer la cible RÉELLE dans l'application (pas un bouton de la bulle) ; `route` : il faut ARRIVER
 * sur cet écran (utile quand le geste attendu est un lien natif, pas un clic intercepté ici — voir
 * l'en-tête). Dans les deux derniers cas, il n'y a pas de « Suivant » : c'est tout l'intérêt.
 */
export type EtapeAttendu =
  | { readonly type: 'lecture' }
  | { readonly type: 'clic'; readonly cible: string }
  | { readonly type: 'route'; readonly hash: string }

export interface EtapeVisite {
  readonly cible: string
  readonly titre: string
  readonly texte: string
  readonly attendu: EtapeAttendu
}

/** Premier index ≥ `depart` dont la cible existe dans le DOM, ou `null` s'il n'en reste aucune. */
export function premierIndexValide(etapes: readonly EtapeVisite[], depart: number): number | null {
  for (let i = depart; i < etapes.length; i++) {
    const etape = etapes[i]
    if (etape !== undefined && document.querySelector(etape.cible) !== null) return i
  }
  return null
}

/**
 * Combien de temps la visite attend une cible qui doit paraître, avant de renoncer et de sauter.
 *
 * ⚠️ C'EST UN GARDE-FOU, PAS UN DÉLAI D'USAGE. En marche normale l'ancre de l'écran arrive en
 * quelques dizaines de millisecondes et l'attente se termine sur le `MutationObserver`, jamais sur
 * ce compte à rebours. Il ne sert qu'au cas où l'écran d'arrivée tombe en erreur et n'affiche donc
 * jamais son ancre : sans lui, le tutoriel resterait invisible pour toujours au lieu de reprendre.
 */
export const ATTENTE_CIBLE_MS = 4000

/** Marge, en pixels, entre la bulle (ou le contour) et le bord de l'écran ou de la cible. */
const MARGE_PX = 16

/**
 * Au-dessus si la cible est dans la moitié basse de l'écran, en dessous sinon — c'est ce qui évite
 * que la bulle recouvre l'élément qu'elle désigne. Largeur pleine (moins la marge) plutôt qu'un
 * calage horizontal sur la cible : cela évite de mesurer la bulle elle-même pour la garder dans
 * l'écran, et correspond à la maquette (§2) où la bulle occupe l'essentiel de la largeur.
 */
function stylePositionBulle(rect: DOMRect | null): CSSProperties {
  if (rect === null) return { top: MARGE_PX, left: MARGE_PX, right: MARGE_PX }
  const cibleEnBas = rect.top + rect.height / 2 > window.innerHeight / 2
  return cibleEnBas
    ? { bottom: Math.max(window.innerHeight - rect.top + MARGE_PX, MARGE_PX), left: MARGE_PX, right: MARGE_PX }
    : { top: Math.max(rect.bottom + MARGE_PX, MARGE_PX), left: MARGE_PX, right: MARGE_PX }
}

export function Visite({
  etapes,
  onTerminer,
}: {
  readonly etapes: readonly EtapeVisite[]
  readonly onTerminer: () => void
}): JSX.Element | null {
  const [etapeIndex, setEtapeIndex] = useState<number | null>(() => premierIndexValide(etapes, 0))
  const [rect, setRect] = useState<DOMRect | null>(null)
  /**
   * La cible de l'étape courante est-elle dans le DOM ? Tant qu'elle n'y est pas, la visite se tait
   * et guette — voir l'en-tête, deuxième cas.
   *
   * ⚠️ VRAI PAR DÉFAUT, ET C'EST VOULU : hors transition d'écran, `premierIndexValide` a déjà
   * garanti la présence avant de poser l'index. Le chemin rapide ci-dessous ne coûte alors qu'un
   * `querySelector`, et aucun observateur n'est créé.
   */
  const [ciblePresente, setCiblePresente] = useState(true)
  /**
   * La première étape RÉELLEMENT affichée, figée au montage — c'est elle qui porte le bandeau
   * « TUTORIEL ».
   *
   * ⚠️ UNE RÉFÉRENCE, PAS UN CALCUL À CHAQUE RENDU. `premierIndexValide` interroge le DOM : le
   * rappeler plus tard rendrait un autre index dès que la cible de la première étape disparaît
   * de l'écran, et le bandeau se rallumerait au milieu du parcours. Il est vrai une fois, au
   * montage, et il le reste.
   */
  const premiereAffichee = useRef(premierIndexValide(etapes, 0))
  const bulle = useRef<HTMLDivElement>(null)
  // La route courante, pour les étapes « route » — même hook que `main.tsx` : pas de second
  // écouteur `hashchange` (voir l'en-tête).
  const route = useRoute()

  /**
   * La route au moment où l'étape courante s'est affichée.
   *
   * ⛔ UNE ÉTAPE « route » NE DOIT PAS SE VALIDER TOUTE SEULE. Son contrat est « il faut ARRIVER sur
   * cet écran » — y être déjà n'est pas y arriver. Le tutoriel de première ouverture démarre SUR
   * Aujourd'hui (`ROUTE_PAR_DEFAUT`, `router.tsx:371`) et sa deuxième étape demande de toucher
   * Aujourd'hui : sans ce repère, elle s'évanouirait dans le même souffle, avant que personne ne
   * l'ait lue. Ce qui la valide alors, c'est le TOUCHER de sa cible (voir l'effet de clic).
   *
   * ⚠️ MIS À JOUR PENDANT LE RENDU, PAS DANS UN EFFET : un effet passerait APRÈS celui qui teste la
   * route, et le repère vaudrait encore celui de l'étape précédente. `<StrictMode>` double le rendu
   * sans dommage — au second passage l'index n'a pas bougé, donc rien n'est réécrit.
   */
  const routeALArrivee = useRef(route)
  const indexMesure = useRef(etapeIndex)
  if (indexMesure.current !== etapeIndex) {
    indexMesure.current = etapeIndex
    routeALArrivee.current = route
  }

  // Plus aucune étape valide — au montage comme après un « Suivant » qui vide la liste : on prévient
  // l'appelant plutôt que de rester affiché sur rien.
  useEffect(() => {
    if (etapeIndex === null) onTerminer()
  }, [etapeIndex, onTerminer])

  // Mesure la cible courante, recalcule sur `resize` et à chaque changement d'étape.
  useEffect(() => {
    if (etapeIndex === null) return
    const etape = etapes[etapeIndex]
    if (etape === undefined) return
    const recalculer = () => {
      const cible = document.querySelector(etape.cible)
      setRect(cible === null ? null : cible.getBoundingClientRect())
    }
    // ⛔ AMENER LA CIBLE À L'ÉCRAN AVANT DE LA MESURER — sinon la visite désigne un bouton que
    // personne ne voit. Le défilement du fond étant bloqué à l'utilisateur (`overflow: hidden`
    // plus bas), il ne peut PAS y aller lui-même : signalé sur téléphone, corrigé le 2026-08-21
    // (lot `retour-1`). `overflow: hidden` interdit le geste, jamais le défilement par script.
    // ⚠️ INSTANTANÉ, PAS `smooth` : un défilement animé rendrait la mesure qui suit fausse d'un
    // écran entier, et le halo se poserait à côté de la cible.
    // ⚠️ APPEL OPTIONNEL : jsdom n'implémente pas `scrollIntoView`, et les tests d'écran de ce
    // dépôt tournent tous dessus.
    // ⛔ ON NE DÉFILE QUE SI LA CIBLE EST DEHORS, et ce garde-fou a été ajouté après coup : la
    // première étape du parcours d'accueil désigne la barre d'onglets, qui est `position: fixed`
    // en bas d'écran. `scrollIntoView` la « centrerait » en faisant défiler la page — la barre ne
    // bougerait pas d'un pixel, mais tout le reste sauterait, à l'instant même où le tutoriel
    // s'ouvre. Défiler vers quelque chose de déjà visible n'aide personne.
    const aAmener = document.querySelector(etape.cible)
    if (aAmener !== null) {
      const boite = aAmener.getBoundingClientRect()
      const dehors = boite.bottom < 0 || boite.top > window.innerHeight
      if (dehors) aAmener.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    }
    recalculer()
    window.addEventListener('resize', recalculer)
    return () => window.removeEventListener('resize', recalculer)
    // ⚠️ `ciblePresente` EST UNE DÉPENDANCE, PAS UN OUBLI : sans elle, une cible attendue serait
    //    mesurée une seule fois, quand elle n'existait pas encore, et le halo ne se poserait jamais.
  }, [etapeIndex, etapes, ciblePresente])

  // Le focus entre dans la bulle à chaque étape — c'est aussi ce qui annonce le changement d'étape
  // aux lecteurs d'écran (dialogue nommé par `aria-label`, focus déplacé dedans).
  useEffect(() => {
    bulle.current?.focus()
  }, [etapeIndex])

  // Le focus REVIENT d'où il venait quand la visite se démonte — même raisonnement que `panneau.tsx`.
  useEffect(() => {
    const origine = document.activeElement as HTMLElement | null
    return () => origine?.focus?.()
  }, [])

  // Défilement du fond bloqué pendant la visite : sinon un doigt qui glisse sur la bulle fait
  // défiler l'écran qu'elle est censée figer pour la présenter.
  useEffect(() => {
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedent
    }
  }, [])

  // Échap = « Passer ».
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onTerminer()
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [onTerminer])

  /**
   * Avance à l'étape suivante. `depuis` rend l'appel IDEMPOTENT pour une étape donnée.
   *
   * ⚠️ SANS CE GARDE, UNE ÉTAPE « route » EN SAUTERAIT UNE. Depuis ce lot elle avance sur DEUX
   * signaux — le toucher de sa cible et l'arrivée sur l'écran — et un lien d'onglet produit les deux
   * dans le même lot React. Deux `surSuivant()` en forme fonctionnelle avancent deux fois ; passer
   * l'index d'où l'on part fait ignorer le second.
   *
   * ⛔ UN `useRef` COMME DRAPEAU NE CONVIENDRAIT PAS : `<StrictMode>` invoque l'updater DEUX FOIS,
   * et le second passage trouverait le drapeau déjà levé — il ANNULERAIT l'avancée au lieu de la
   * protéger. Comparer l'index est idempotent, donc insensible au nombre d'invocations.
   */
  const surSuivant = useCallback(
    (depuis?: number, sansSauter = false) => {
      setEtapeIndex((i) => {
        if (i === null || (depuis !== undefined && i !== depuis)) return i
        // ⛔ `sansSauter` : on vient de CHANGER D'ÉCRAN. L'étape suivante est l'ouverture de l'écran
        //    d'arrivée, qui n'a pas encore fini de charger — la mesurer maintenant l'écarterait, elle
        //    et tout son bloc. On y va quand même, et l'effet d'attente ci-dessous la fait paraître.
        if (sansSauter) return i + 1 < etapes.length ? i + 1 : null
        return premierIndexValide(etapes, i + 1)
      })
    },
    [etapes]
  )

  const etape = etapeIndex === null ? undefined : etapes[etapeIndex]

  useEffect(() => {
    if (etape === undefined) return
    const laVoit = () => document.querySelector(etape.cible) !== null
    if (laVoit()) {
      setCiblePresente(true)
      return
    }
    setCiblePresente(false)

    // ⚠️ UN OBSERVATEUR, PAS UN SONDAGE : l'ancre paraît quand la promesse de l'écran se résout,
    //    et `MutationObserver` le voit à la micro-tâche près — y compris sous jsdom, où aucun
    //    `requestAnimationFrame` n'est garanti.
    const observateur = new MutationObserver(() => {
      if (!laVoit()) return
      observateur.disconnect()
      setCiblePresente(true)
    })
    observateur.observe(document.body, { childList: true, subtree: true })

    const renoncer = window.setTimeout(() => {
      observateur.disconnect()
      // L'écran ne montrera jamais son ancre (erreur de chargement) : on reprend la règle ordinaire
      // à partir d'ICI, ce qui saute cette étape-là et, s'il n'en reste aucune, termine la visite.
      setEtapeIndex((i) => (i === null ? null : premierIndexValide(etapes, i)))
    }, ATTENTE_CIBLE_MS)

    return () => {
      observateur.disconnect()
      window.clearTimeout(renoncer)
    }
  }, [etape, etapes])

  // Étape « clic » : avance quand la VRAIE cible est cliquée à travers le calque (voir l'en-tête —
  // le calque ne capte plus les clics pour ce type d'étape). Capture, pas bulle : on veut réagir
  // même si la cible arrête elle-même la propagation dans son propre gestionnaire.
  useEffect(() => {
    if (etape === undefined || etape.attendu.type === 'lecture') return
    // ⛔ « route » PASSE PAR ICI AUSSI DEPUIS LE LOT `retour-1b`. Une étape qui demande de toucher
    //    l'onglet où l'on se trouve DÉJÀ ne verrait jamais la route changer ; son seul signal est le
    //    toucher. Sa cible est celle qu'elle DÉSIGNE (`etape.cible`, le lien de la barre), là où une
    //    étape « clic » nomme la sienne séparément.
    const cible = etape.attendu.type === 'clic' ? etape.attendu.cible : etape.cible
    const surClic = (evenement: MouseEvent) => {
      if (!(evenement.target instanceof Element) || evenement.target.closest(cible) === null) return
      // ⛔ SI LE TOUCHER VA CHANGER D'ÉCRAN, ON NE BOUGE PAS ENCORE — c'est l'ARRIVÉE qui valide.
      //    Avancer dès le clic écarterait toutes les étapes de l'écran visé : il n'est pas monté à
      //    cet instant, donc `premierIndexValide` ne trouve aucune de ses cibles et la visite
      //    s'arrête en silence. C'est le mode de défaillance décrit en tête de `ui/parcours.ts`, et
      //    le lot `retour-1b` l'a rencontré pour de vrai : 7 clauses sur 10 passaient, le tutoriel
      //    s'arrêtait après le bloc « Aujourd'hui » et n'atteignait jamais « Semaine ».
      if (etape.attendu.type === 'route' && hashDe(route.onglet) !== etape.attendu.hash) return
      surSuivant(etapeIndex ?? undefined)
    }
    document.addEventListener('click', surClic, true)
    return () => document.removeEventListener('click', surClic, true)
  }, [etape, etapeIndex, route, surSuivant])

  // Étape « route » : avance dès que la route RÉELLE correspond à celle attendue — jamais avant.
  useEffect(() => {
    if (etape === undefined || etape.attendu.type !== 'route') return
    // Y ÊTRE DÉJÀ N'EST PAS Y ARRIVER : sans ce test, l'étape se validerait à son propre affichage.
    if (route === routeALArrivee.current) return
    // `true` : on ARRIVE sur l'écran, il charge encore. Voir `surSuivant` et l'en-tête.
    if (hashDe(route.onglet) === etape.attendu.hash) surSuivant(etapeIndex ?? undefined, true)
  }, [etape, etapeIndex, route, surSuivant])

  // ⛔ PAS DE BULLE SUR UNE CIBLE ABSENTE — la visite n'est pas finie pour autant : `onTerminer`
  //    ne part que sur `etapeIndex === null`. Elle se tait, elle attend, elle revient.
  if (etapeIndex === null || etape === undefined || !ciblePresente) return null

  // Une étape qui attend un geste (clic ou route) n'a pas de « Suivant » : le geste EST le seul
  // moyen d'avancer, hors « Passer ». C'est aussi elle qui décide si le calque bloque les clics.
  const attendGeste = etape.attendu.type !== 'lecture'

  return createPortal(
    <div className={'fixed inset-0 z-50 ' + (attendGeste ? 'pointer-events-none' : '')}>
      {/* ⛔ PLUS AUCUN VOILE ICI. Un `bg-black/60` couvrait l'écran : le tutoriel noircissait
          précisément ce qu'il était censé montrer, au point que le texte présenté devenait
          illisible. Signalé sur téléphone, retiré le 2026-08-21 (lot `retour-1`). Ce qui désigne
          la cible, c'est le HALO ci-dessous, et lui seul.
          ⚠️ Le voile ne servait pas à capter les clics : pour une étape « lecture », c'est le
          conteneur parent qui les capte, faute de `pointer-events-none`. Le remettre « pour la
          sécurité du clic » redirait donc le défaut sans rien gagner. */}
      {rect !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[--radius-carte]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            outline: '3px solid var(--color-accent-texte)',
            outlineOffset: '3px',
          }}
        />
      )}

      <div
        role="dialog"
        aria-modal={attendGeste ? undefined : 'true'}
        aria-label={etape.titre}
        ref={bulle}
        tabIndex={-1}
        // `pointer-events-auto` EXPLICITE : le calque parent passe à `pointer-events-none` pour les
        // étapes « clic »/« route », une propriété HÉRITÉE — sans ce contre-ordre, « Passer »
        // deviendrait lui aussi incliquable.
        className="pointer-events-auto absolute max-w-prose rounded-[--radius-carte] border border-bordure bg-surface p-4 shadow-lg outline-none"
        style={stylePositionBulle(rect)}
      >
        {/* ⛔ DIRE CE QUE C'EST, ET LE DIRE EN GRAND. Sur téléphone, la bulle arrivait sans se
            nommer : on ne savait pas si c'était un tutoriel, une alerte ou un message de l'appli.
            Ajouté le 2026-08-21 (lot `retour-1`).
            ⚠️ SUR LA PREMIÈRE ÉTAPE AFFICHÉE, PAS SUR L'INDEX 0 : `premierIndexValide` saute les
            étapes dont la cible est absente de l'écran, donc la première VUE n'est pas toujours la
            première du tableau.
            ⚠️ Majuscules par le CSS et non dans le texte : un lecteur d'écran épellerait « T-U-T-O ».
            ⚠️ `text-titre-m` — un pas au-dessus du titre d'étape (`text-titre-s`), pris dans
            l'échelle déclarée. Pas de taille littérale : `ui/echelle-typo.test.ts` les refuse. */}
        {etapeIndex === premiereAffichee.current && (
          <p className="mb-2 font-titre text-titre-m font-bold uppercase tracking-wide text-accent-texte">
            Tutoriel
          </p>
        )}
        {/* Lisible en texte, pas seulement en pastilles, et ANNONCÉ (`role="status"`) à chaque
            changement d'étape — même mécanisme que le bandeau de persistance dans `main.tsx`. */}
        <p role="status" className="text-mention font-medium text-attenue">
          Étape {etapeIndex + 1} sur {etapes.length}
        </p>
        <h2 className="mt-1 font-titre text-titre-s text-texte">{etape.titre}</h2>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etape.texte}</p>

        <div aria-hidden="true" className="mt-3 flex gap-1.5">
          {/* Index en clé, pas `e.cible` : deux étapes d'un même parcours peuvent légitimement
              partager une cible (voir `ETAPES_FRIGO`, `ui/parcours.ts`) — la liste est statique pour
              la durée du montage, l'ordre ne bouge jamais. */}
          {etapes.map((_e, i) => (
            <span
              key={i}
              className={'h-2 w-2 rounded-full ' + (i === etapeIndex ? 'bg-accent-plein' : 'bg-bordure-forte')}
            />
          ))}
        </div>

        {/* ⚠️ « Passer » N'EST JAMAIS PLUS DISCRET QUE « Suivant » — même gabarit, même cible
            tactile : on doit pouvoir sortir aussi facilement qu'avancer. */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onTerminer}
            className="flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-courant font-semibold text-texte-doux"
          >
            Passer
          </button>
          {/* Absent pour une étape « clic »/« route » : voir `attendGeste` ci-dessus, c'est tout
              l'intérêt de ces deux types. */}
          {!attendGeste && (
            <button
              type="button"
              onClick={() => surSuivant()}
              className="flex min-h-tactile flex-1 items-center justify-center gap-2 rounded-[0.7rem] bg-accent-plein px-4 text-courant font-semibold text-white"
            >
              Suivant
              <span aria-hidden="true">›</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
