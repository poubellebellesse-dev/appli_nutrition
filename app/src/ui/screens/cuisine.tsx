// ui/screens/cuisine.tsx — le mode cuisine, UNE OU PLUSIEURS recettes (§5bis ARCHITECTURE, L1 puis L4).
//
// Sept points tiennent cet écran. Quatre méritent d'être relus avant d'y toucher :
//
// ⚠️ TOUTE CLÉ DE MINUTEUR PORTE LA RECETTE, jamais le seul `ordre`. C'est le piège propre au
// multi-recettes, et il est silencieux : l'étape 3 du gratin et l'étape 3 du rôti portent le MÊME
// `ordre`. Indexés dessus seul, `dejaSonnes` et `alarmeSur` confondaient les deux — sonner pour l'un
// interdisait à l'autre de sonner, et l'arrêt de l'alarme éteignait le mauvais décompte. D'où
// `cleMinuteur()` et pas un nombre nu.
//
// ⚠️ RIEN N'AVANCE TOUT SEUL (point 2). C'est la demande d'origine — « que la recette se lance toute
// seule » — et c'est ce qui a été refusé après lecture des essais publiés : l'avancement automatique
// fait perdre la vue d'ensemble et reprend la main au mauvais moment. L'étape ne change QUE sur un
// appui. Un test le verrouille en avançant les minuteurs de plusieurs minutes.
//
// ⚠️ LES MINUTEURS SONT DES ÉCHÉANCES ABSOLUES, JAMAIS DES RESTANTS (point 7). Toute la logique
// d'affirmation vit dans `cuisine-session.ts`, pur et testé sans navigateur — c'est le seul endroit
// du mode où une erreur porterait sur de la nourriture.
//
// ⚠️ L'ALARME NE SONNE QU'AU PREMIER PLAN (point 5), par décision instruite et non par oubli : les
// quatre voies Android ont été refusées (`CONCEPTION_MODE_CUISINE.md` §5). Ce qui les remplace, c'est
// que l'écran ne ment pas au retour.
//
// PÉRIMÈTRE — ce qui n'est PAS ici et où c'est écrit : l'heure de service et la frise des départs
// (niveau 1 de `ordonnancement.ts`, lot suivant), l'entrelacement actif/passif et la réservation
// d'équipement (niveaux 2 et 3, non décidés — voir `CONCEPTION_MODE_CUISINE.md`).
//
// ⚠️ L'ORDRE DES ONGLETS VIENT DU MOTEUR, PAS DE L'ORDRE OÙ ON A CHOISI LES PLATS.
// `ordonnancerCuissons` place le plat le plus long en premier — c'est la seule réponse à « on ne va
// pas faire la sauce depuis le début, mais à la fin ». Cet écran ne trie rien lui-même : il lit.
//
// ✅ LES GESTES DU LEXIQUE Y SONT DEPUIS L1ter. Ils en étaient exclus « parce que les dupliquer
// demanderait d'extraire le composant » — l'extraction a été faite (`ui/gestes-etape.tsx`), le motif
// tombe. C'était le dernier manque de cet écran qui ne réclamait AUCUNE donnée nouvelle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Catalog, Recipe, RecipeId, RecipeStep } from '../../engine/domain/index.js'
import type { UserDb } from '../../data/user-db.js'
import {
  clearCuisson,
  clearToutesLesCuissons,
  readCuissons,
  writeCuisson,
  type StoredCuisineSession,
  type StoredCuisineTimer,
} from '../../data/user-store.js'
import { ordonnancerCuissons } from '../../engine/cuisine/ordonnancement.js'
import { dureeEcouleeMin } from '../../engine/cuisine/duree.js'
import { chargerSocle } from '../socle.js'
import type { PlatACuisiner } from '../router.js'
import { hashDeRecette } from '../router.js'
import { creerAlarme, type Alarme } from '../alarme.js'
import { garderEcranAllume, veillePossible } from '../ecran-allume.js'
import {
  etatMinuteur,
  formaterDuree,
  libelleMinuteur,
  sonnerieEncoreJuste,
} from '../cuisine-session.js'
import { GestesDeLEtape } from '../gestes-etape.js'
import {
  ListeIngredients,
  QuantitesDeLEtape,
  SelecteurPortions,
  TexteEtape,
  preparerTexteEtape,
} from '../ingredients-recette.js'
import { formesDeLAliment } from '../texte-etape.js'
import { Panneau } from '../panneau.js'

/** Une recette en cours de cuisson, résolue et prête à afficher. */
interface PlatEnCuisine {
  readonly recette: Recipe
  /** Grammes mis à l'échelle, par `foodId`. Fermeture sur `scaleRecipe` — voir §4.6 et
   *  `ui/quantites.ts` : c'est le moteur qui calcule, jamais cet écran. */
  readonly quantitePour: (portions: number) => ReadonlyMap<string, number>
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'introuvable' }
  | {
      readonly phase: 'pret'
      readonly db: UserDb
      readonly catalogue: Catalog
      /**
       * Dans l'ordre de DÉPART décidé par `ordonnancerCuissons`, jamais dans l'ordre d'arrivée.
       *
       * Le tuple dit « au moins un » DANS LE TYPE, et ça évite la garde qui suivrait chaque lecture :
       * une cuisine à zéro plat n'est pas un état à rendre, c'est `introuvable`.
       */
      readonly plats: readonly [PlatEnCuisine, ...PlatEnCuisine[]]
    }

/** Les étapes qu'on FAIT. Les avertissements se lisent à la fin, ils ne comptent pas (L0). */
function gestesDe(recette: Recipe): readonly RecipeStep[] {
  return recette.etapes.filter((e) => e.nature === 'geste')
}

/**
 * L'identité d'un minuteur À TRAVERS TOUTE LA CUISSON, et pas seulement dans sa recette.
 *
 * ⛔ NE JAMAIS REVENIR À `ordre` SEUL. Les `ordre` sont numérotés par recette : deux plats en même
 * temps en ont autant en double. `dejaSonnes` marquait alors l'étape 3 « déjà sonnée » pour les deux
 * plats dès que l'un d'eux sonnait, et l'appui qui arrête l'alarme visait le mauvais décompte. Ni le
 * type ni le test ne le disaient : les deux valeurs sont des `number` parfaitement valides.
 */
function cleMinuteur(recetteId: string, ordre: number): string {
  return `${recetteId}#${ordre}`
}

// ⛔ `dureeTotaleMin` A ÉTÉ RETIRÉE D'ICI, elle rendait `tempsPrepMin + tempsCuissonMin` et cet
// écran la passait à `ordonnancerCuissons` : le coq au vin partait 115 min avant le service au lieu
// de 12 h 55. Ce qu'il faut ici est `dureeEcouleeMin` (`engine/cuisine/duree.ts`), qui ajoute les
// repos chiffrés. ⚠️ NE PAS LA RÉÉCRIRE À CÔTÉ : l'autre durée existe encore et sert ailleurs, elle
// est juste sans objet pour décider d'une heure de départ.

/** Le minuteur qui sonne, ou qui vient de sonner. Porte SA recette — voir `cleMinuteur`. */
interface MinuteurVise {
  readonly recetteId: string
  readonly ordre: number
}

export function Cuisine({
  plats,
}: {
  /** Les plats du lien, jamais vide (garanti par `lireRoute`). Le premier est celui qu'on vient
   *  d'ouvrir : c'est lui qu'on affiche, quel que soit l'ordre de départ décidé par le moteur.
   *  `portions` à `null` = aucun choix exprimé, PAS une valeur par défaut déguisée. */
  readonly plats: readonly PlatACuisiner[]
}) {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [cuissons, setCuissons] = useState<readonly StoredCuisineSession[]>([])
  /** L'onglet affiché, par `recetteId`. */
  const [actif, setActif] = useState<string>(plats[0]?.id ?? '')
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [ecranTenu, setEcranTenu] = useState(false)
  const [alarmeSur, setAlarmeSur] = useState<MinuteurVise | null>(null)
  /** Le renvoi proposé APRÈS l'arrêt d'une alarme venue d'un autre plat. Voir `stopperAlarme`. */
  const [aiguillage, setAiguillage] = useState<MinuteurVise | null>(null)
  const [ingredientsOuverts, setIngredientsOuverts] = useState(false)
  const [finAConfirmer, setFinAConfirmer] = useState(false)

  // L'alarme survit aux rendus : la recréer relâcherait le contexte audio déverrouillé sur le geste.
  const alarme = useRef<Alarme | null>(null)
  alarme.current ??= creerAlarme()

  /**
   * Les minuteurs dont le sort est déjà réglé : ils ont sonné, ou il était trop tard pour sonner.
   *
   * ⚠️ CE `Set` NE DÉCIDE PLUS DE RIEN, IL SE CONTENTE DE NE PAS RÉPÉTER. C'est `sonnerieEncoreJuste`
   * qui tranche, sur l'ANCIENNETÉ de l'échéance et non sur le fait qu'on vienne de monter l'écran —
   * un semis au montage ne voyait ni le retour d'arrière-plan sans démontage (ça sonnait pour un plat
   * sorti du feu depuis quarante minutes) ni la réouverture trois secondes après l'échéance (ça se
   * taisait alors que ça venait d'arriver). Le raisonnement complet est sur `sonnerieEncoreJuste`.
   */
  const dejaSonnes = useRef<Set<string>>(new Set())

  /**
   * La signature du lien. C'est ELLE qui relance l'effet, pas le tableau `plats` : deux liens
   * différents doivent rouvrir, deux rendus du même lien non. Sur le seul écran conçu pour rester
   * allumé une heure, un tableau reconstruit à chaque battement de seconde ferait réécrire les
   * sessions 3 600 fois — et chaque écriture repasse les minuteurs par un DELETE/INSERT.
   */
  const demande = plats.map((p) => `${p.id}:${p.portions ?? ''}`).join(',')

  useEffect(() => {
    let vivant = true
    chargerSocle()
      .then((socle) => {
        if (!vivant) return
        if (socle.catalogue.recipes.get((plats[0]?.id ?? '') as RecipeId) === undefined) {
          setEtat({ phase: 'introuvable' })
          return
        }

        // ⚠️ LE LIEN S'AJOUTE AUX CUISSONS DÉJÀ OUVERTES, IL NE LES REMPLACE PLUS. En v1 il n'y avait
        // qu'une ligne (`id = 1`) : ouvrir le mode sur une autre recette écrasait la précédente, rôti
        // au four compris. Décider de faire aussi une sauce ne doit pas éteindre ce qui mijote.
        const sessions = new Map<string, StoredCuisineSession>(
          readCuissons(socle.db).map((c) => [c.recetteId, c])
        )

        for (const voulu of plats) {
          const recette = socle.catalogue.recipes.get(voulu.id as RecipeId)
          if (recette === undefined) continue
          const existante = sessions.get(voulu.id)
          // ⚠️ LE LIEN GAGNE SUR LA SESSION, MAIS SEULEMENT S'IL PORTE UNE VALEUR. La fiche recette
          // n'en met une qu'au moment où l'on appuie sur « Cuisiner pas à pas » — c'est un choix qu'on
          // vient de faire, il doit primer. Le bandeau de reprise, lui, produit un hash NU : la session
          // garde alors son nombre, sinon reprendre une cuisson la ramènerait aux portions de base et
          // effacerait en silence un réglage fait la veille.
          const courante: StoredCuisineSession =
            existante !== undefined
              ? { ...existante, portions: voulu.portions ?? existante.portions }
              : {
                  recetteId: voulu.id,
                  ordreCourant: gestesDe(recette)[0]?.ordre ?? 1,
                  ouverteLe: Date.now(),
                  portions: voulu.portions,
                  minuteurs: [],
                }
          // Une session neuve s'écrit toujours ; une reprise SEULEMENT si le lien a changé les
          // portions. Réécrire à chaque ouverture ferait repasser les minuteurs par un DELETE/INSERT
          // sans aucune raison.
          if (existante === undefined || courante.portions !== existante.portions) {
            writeCuisson(socle.db, courante)
          }
          sessions.set(voulu.id, courante)
        }

        // ⚠️ UNE CUISSON DONT LA RECETTE A DISPARU DU CATALOGUE EST ÉCARTÉE DE L'AFFICHAGE, PAS DE LA
        // BASE. Une mise à jour de catalogue peut retirer une recette sous une cuisson ouverte ; on
        // ne sait alors ni l'afficher ni la nommer, mais l'effacer emporterait ses minuteurs.
        const enCuisine: PlatEnCuisine[] = []
        for (const c of sessions.values()) {
          const recette = socle.catalogue.recipes.get(c.recetteId as RecipeId)
          if (recette === undefined) continue
          enCuisine.push({
            recette,
            // ⚠️ ON LIT `quantiteG`, PAS `uniteAffichage` : `scaleRecipe` recalcule les grammes et
            // laisse le libellé verbatim, à dessein. Même fermeture que sur la fiche recette, et le
            // rendu est le même composant — voir `ui/ingredients-recette.tsx`.
            quantitePour: (n) =>
              new Map(
                socle.moteur
                  .scaleRecipe(c.recetteId as RecipeId, n)
                  .ingredients.map((i) => [i.foodId as string, i.quantiteG])
              ),
          })
        }

        // L'ordre de DÉPART, décidé par le moteur : le plat le plus long d'abord. Cet écran ne trie
        // rien lui-même — il rend `departs` dans l'ordre où il les reçoit.
        const parId = new Map(enCuisine.map((p) => [p.recette.id as string, p]))
        const ordre = ordonnancerCuissons(
          enCuisine.map((p) => ({
            recipeId: p.recette.id,
            nom: p.recette.nom,
            dureeMin: dureeEcouleeMin(p.recette),
          }))
        )
        const tries = ordre.departs.flatMap((d) => {
          const plat = parId.get(d.recipeId as string)
          return plat === undefined ? [] : [plat]
        })

        const premier = tries[0]
        if (premier === undefined) {
          setEtat({ phase: 'introuvable' })
          return
        }
        setCuissons([...sessions.values()].filter((c) => parId.has(c.recetteId)))
        // On affiche le plat qu'on vient d'OUVRIR, pas celui qui part en premier : appuyer sur
        // « Cuisiner pas à pas » depuis la fiche de la sauce doit montrer la sauce.
        setActif(plats[0]?.id ?? premier.recette.id)
        setEtat({
          phase: 'pret',
          db: socle.db,
          catalogue: socle.catalogue,
          plats: [premier, ...tries.slice(1)],
        })
      })
      .catch(() => {
        if (vivant) setEtat({ phase: 'introuvable' })
      })
    return () => {
      vivant = false
    }
    // Dépendance unique et volontaire : `demande` résume `plats`. Voir son commentaire.
  }, [demande])

  // Le battement de seconde ne fait QUE rafraîchir l'affichage des décomptes. Il ne touche jamais à
  // l'étape courante — c'est ce que vérifie le test « les étapes n'avancent jamais seules ».
  useEffect(() => {
    const battement = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(battement)
  }, [])

  useEffect(() => (etat.phase === 'pret' ? garderEcranAllume(setEcranTenu) : undefined), [etat.phase])

  // Relâche l'alarme si l'écran est démonté en pleine sonnerie.
  useEffect(() => () => alarme.current?.arreter(), [])

  const enregistrer = useCallback(
    (suivante: StoredCuisineSession) => {
      setCuissons((cs) => cs.map((c) => (c.recetteId === suivante.recetteId ? suivante : c)))
      if (etat.phase === 'pret') writeCuisson(etat.db, suivante)
    },
    [etat]
  )

  const cuisson = cuissons.find((c) => c.recetteId === actif) ?? null

  const majMinuteurs = useCallback(
    (transformer: (minuteurs: readonly StoredCuisineTimer[]) => readonly StoredCuisineTimer[]) => {
      if (cuisson === null) return
      enregistrer({ ...cuisson, minuteurs: transformer(cuisson.minuteurs) })
    },
    [enregistrer, cuisson]
  )

  // Sonner à l'échéance, une fois par minuteur. Se déclenche sur le battement de seconde.
  //
  // ⚠️ SUR TOUS LES PLATS, PAS SEULEMENT CELUI QU'ON REGARDE. C'est tout l'intérêt de la barre
  // d'onglets : le gratin sonne pendant qu'on lit la sauce. Ne parcourir que la cuisson active
  // aurait rendu les minuteurs des autres plats parfaitement muets.
  useEffect(() => {
    if (alarme.current === null) return
    for (const cuissonT of cuissons) {
      for (const t of cuissonT.minuteurs) {
        const cle = cleMinuteur(cuissonT.recetteId, t.ordre)
        if (dejaSonnes.current.has(cle)) continue
        const etatT = etatMinuteur(t, maintenant)
        if (etatT.mode !== 'termine') continue
        // Marqué AVANT le tri : un minuteur trop vieux est réglé une fois pour toutes, il ne doit pas
        // être réexaminé à chaque battement de seconde pendant toute la cuisson.
        dejaSonnes.current.add(cle)
        // ⛔ ON NE SONNE QUE POUR CE QUI VIENT D'ARRIVER. Reprendre une cuisson — ou revenir
        // d'arrière-plan sans que l'écran ait été démonté — ne doit pas déclencher l'alarme pour un
        // plat sorti du feu depuis quarante minutes. Le seuil et son raisonnement sont sur
        // `sonnerieEncoreJuste` ; l'écran, lui, dit la vérité dans tous les cas (« terminé il y a N »).
        if (!sonnerieEncoreJuste(etatT.depuisS)) continue
        // ⚠️ TOUTE FENÊTRE SE FERME À LA SONNERIE. `Panneau` passe par un portail posé après cet
        // écran : ouverte, elle recouvrirait la surface « appuyez n'importe où » et l'arrêt de
        // l'alarme deviendrait introuvable. Une casserole qui sonne prime sur ce qu'on était en train
        // de lire — et ça vaut pour la confirmation de fin autant que pour les ingrédients.
        setIngredientsOuverts(false)
        setFinAConfirmer(false)
        setAiguillage(null)
        setAlarmeSur({ recetteId: cuissonT.recetteId, ordre: t.ordre })
        alarme.current.sonner(() => setAlarmeSur(null))
      }
    }
  }, [maintenant, cuissons])

  /** Le plat affiché. Se replie sur le premier départ quand l'onglet actif vient de se fermer. */
  const platCourant =
    etat.phase === 'pret' ? (etat.plats.find((p) => p.recette.id === actif) ?? etat.plats[0]) : undefined

  // `null` en session = AUCUN CHOIX EXPRIMÉ (schéma v11), pas « 4 » : on retombe alors sur les
  // portions de la recette. C'est ici, et seulement ici, que la recette a le dernier mot — ni le
  // routeur ni le store ne connaissent `portionsBase`.
  const portions = cuisson?.portions ?? platCourant?.recette.portionsBase ?? 0

  /**
   * ⚠️ MÉMOÏSÉ, ET CE N'EST PAS UN CONFORT D'ÉCRITURE. `quantitePour` RAPPELLE `scaleRecipe` à chaque
   * appel, il y en a deux par rendu (la ligne sous l'étape, la fenêtre), et le battement de seconde
   * re-rend cet écran 3 600 fois par heure. Sur le seul écran de l'appli conçu pour rester allumé
   * pendant toute une cuisson, c'était 7 200 passes moteur et 7 200 `Map` neuves par heure pour une
   * valeur qui ne bouge qu'au changement de portions — et autant de rendus forcés chez les enfants,
   * l'identité de la `Map` changeant à chaque seconde.
   *
   * ⚠️ AU-DESSUS DES RETOURS ANTICIPÉS, COMME TOUT HOOK. D'où le `portions` hissé juste avant et son
   * repli à `0` hors de la phase `pret` : la valeur n'est alors lue par personne.
   */
  const quantites = useMemo(
    () => platCourant?.quantitePour(portions) ?? new Map<string, number>(),
    [platCourant, portions]
  )

  if (etat.phase === 'chargement') return <p className="p-6 text-texte-doux">Chargement…</p>
  if (etat.phase === 'introuvable') {
    return (
      <div className="p-6">
        <p className="text-texte">Cette recette est introuvable.</p>
        <a
          className="mt-4 inline-block text-accent-texte underline"
          href={hashDeRecette(plats[0]?.id ?? '')}
        >
          ← Retour à la fiche
        </a>
      </div>
    )
  }

  const { catalogue } = etat
  // Le tuple garantit `plats[0]` : `platCourant` n'est `undefined` que hors de la phase `pret`.
  const plat = platCourant ?? etat.plats[0]
  const recette = plat.recette
  const gestes = gestesDe(recette)
  const avertissements = recette.etapes.filter((e) => e.nature === 'avertissement')
  const facteur = portions / (recette.portionsBase > 0 ? recette.portionsBase : 1)

  const changerPortions = (n: number): void => {
    if (cuisson === null) return
    enregistrer({ ...cuisson, portions: n })
  }
  const rang = Math.max(
    0,
    gestes.findIndex((e) => e.ordre === (cuisson?.ordreCourant ?? gestes[0]?.ordre))
  )
  const etape = gestes[rang]
  const derniere = rang >= gestes.length - 1

  // La quantité DANS la phrase, et la liste de ce qu'elle a servi — pour ne pas le répéter en badge
  // juste en dessous. Les deux sortent du même appel : voir `preparerTexteEtape`.
  const redaction =
    etape === undefined
      ? null
      : preparerTexteEtape({
          texte: etape.texte,
          ingredients: recette.ingredients,
          foodIds: etape.foodIds,
          quantites,
          facteur,
          formesAliment: (foodId) => formesDeLAliment(catalogue.foods.get(foodId as never), foodId),
          estQuantiteFigee: (foodId) => catalogue.foods.get(foodId as never)?.quantiteFigee === true,
        })

  const allerA = (nouveauRang: number): void => {
    const cible = gestes[nouveauRang]
    if (cible === undefined || cuisson === null) return
    enregistrer({ ...cuisson, ordreCourant: cible.ordre })
  }

  const minuteurDe = (ordre: number): StoredCuisineTimer | undefined =>
    cuisson?.minuteurs.find((t) => t.ordre === ordre)

  const lancer = (ordre: number, dureeS: number): void => {
    // ⚠️ ICI, ET PAS À L'EXPIRATION. Le déverrouillage audio n'est accordé qu'au sein d'un
    // gestionnaire d'appui réel — et son refus ne lève aucune erreur.
    alarme.current?.preparer()
    dejaSonnes.current.delete(cleMinuteur(recette.id, ordre))
    majMinuteurs((ts) => [
      ...ts.filter((t) => t.ordre !== ordre),
      { ordre, finMs: Date.now() + dureeS * 1000, pauseRestantS: null },
    ])
  }

  const basculerPause = (ordre: number): void => {
    const t = minuteurDe(ordre)
    if (t === undefined) return
    const etatT = etatMinuteur(t, Date.now())
    const remplacant: StoredCuisineTimer =
      t.pauseRestantS !== null
        ? { ordre, finMs: Date.now() + t.pauseRestantS * 1000, pauseRestantS: null }
        : { ordre, finMs: null, pauseRestantS: etatT.mode === 'marche' ? etatT.restantS : 0 }
    majMinuteurs((ts) => ts.map((autre) => (autre.ordre === ordre ? remplacant : autre)))
  }

  const arreterMinuteur = (ordre: number): void => {
    dejaSonnes.current.add(cleMinuteur(recette.id, ordre))
    majMinuteurs((ts) => ts.filter((t) => t.ordre !== ordre))
  }

  /**
   * Fermer LE PLAT COURANT. On ne quitte le mode cuisine que quand il ne reste plus rien.
   *
   * ⚠️ FERMER LA SAUCE NE DOIT PAS SORTIR LE RÔTI DU FOUR. C'est la raison d'être de
   * `clearCuisson` face à `clearToutesLesCuissons` : le premier ne touche qu'une recette et ses
   * minuteurs, le second vide aussi l'heure de service parce que plus personne ne la sert.
   */
  const terminer = (): void => {
    alarme.current?.arreter()
    const restants = etat.plats.filter((p) => p.recette.id !== recette.id)
    const suivant = restants[0]
    if (suivant === undefined) {
      clearToutesLesCuissons(etat.db)
      window.location.hash = hashDeRecette(recette.id)
      return
    }
    clearCuisson(etat.db, recette.id)
    setCuissons((cs) => cs.filter((c) => c.recetteId !== recette.id))
    setEtat({ ...etat, plats: [suivant, ...restants.slice(1)] })
    setActif(suivant.recette.id)
    setFinAConfirmer(false)
  }

  /**
   * ⛔ « TERMINER » EFFAÇAIT DES MINUTEURS EN COURS SANS UN MOT, et le cas n'a rien d'exotique : la
   * dernière étape d'un plat est souvent un repos (« laisser reposer 10 min »), on lance son
   * minuteur, et le bouton qui clôt le déroulé est juste à côté. La fermeture emporte la
   * ligne et ses enfants — le décompte disparaît sans trace.
   *
   * ⚠️ ON NE DEMANDE RIEN QUAND IL N'Y A RIEN À PERDRE. Une confirmation systématique est une
   * confirmation qu'on cesse de lire au troisième plat, et elle aurait alors coûté la seule chose
   * qu'elle protège. Un minuteur `termine` ne compte pas : il n'a plus rien à décompter.
   */
  const minuteursVivants = (cuisson?.minuteurs ?? []).filter(
    (t) => etatMinuteur(t, maintenant).mode !== 'termine'
  )

  const demanderFin = (): void => {
    if (minuteursVivants.length === 0) terminer()
    else setFinAConfirmer(true)
  }

  const nomDe = (id: string): string =>
    etat.plats.find((p) => p.recette.id === id)?.recette.nom ?? id

  /**
   * L'arrêt de l'alarme en DEUX TEMPS quand elle vient d'un autre plat.
   *
   * ⛔ L'APPUI N'IMPORTE OÙ NE CHANGE JAMAIS DE RECETTE, et c'est la maquette qui a fait apparaître
   * le défaut. Poser « aller au gratin » sur la surface `fixed inset-0` aurait suffi : la claque à
   * l'aveugle qui fait taire la sonnerie — le geste pour lequel cette surface existe — vous aurait
   * déplacé de recette et fait perdre votre étape. Le premier appui fait donc UNIQUEMENT taire ;
   * le renvoi se propose ensuite, dans une fenêtre où l'on vise.
   */
  const stopperAlarme = (): void => {
    alarme.current?.arreter()
    if (alarmeSur !== null && alarmeSur.recetteId !== recette.id) setAiguillage(alarmeSur)
    setAlarmeSur(null)
  }

  return (
    <article
      className="mx-auto max-w-2xl p-4 pb-24"
      // Le signal visuel porte sur TOUTE la surface : la vision périphérique voit le mouvement et la
      // luminance, pas un pictogramme. Voir `theme.css`, bloc « signal visuel d'alarme ».
      data-alarme={alarmeSur !== null ? 'oui' : undefined}
    >
      <a className="text-accent-texte underline" href={hashDeRecette(recette.id)}>
        ← Quitter le mode cuisine
      </a>

      {/* ⚠️ LA BARRE N'APPARAÎT QU'À PARTIR DE DEUX PLATS. Un seul onglet n'offre aucun choix : il
          prendrait de la hauteur sur le seul écran qu'on lit à un mètre, pour ne rien dire. */}
      {etat.plats.length > 1 && (
        <BarreDePlats
          plats={etat.plats}
          cuissons={cuissons}
          actif={recette.id}
          maintenant={maintenant}
          onChoisir={setActif}
        />
      )}

      <h1 className="mt-3 font-titre text-[1.6rem] leading-tight text-texte">{recette.nom}</h1>

      <p className="mt-1 text-[0.95rem] text-attenue">
        {ecranTenu
          ? "L'écran reste allumé pendant la cuisson."
          : veillePossible()
            ? "L'écran peut s'éteindre : cet appareil n'a pas accordé le maintien."
            : "L'écran peut s'éteindre : cet appareil ne sait pas le maintenir allumé."}
      </p>

      {/* ⚠️ LES INGRÉDIENTS SONT ICI, ET C'EST TOUT L'OBJET DE CE LOT. Sans eux, « c'était combien
          d'ail ? » en pleine cuisson obligeait à QUITTER le mode cuisine pour rouvrir la fiche, en
          perdant l'étape courante de vue. La donnée était pourtant déjà chargée dans cet écran.

          Une FENÊTRE et pas un dépliant : elle recouvre, on revient, l'écran n'a pas bougé — un
          dépliant aurait poussé l'étape et les minuteurs vers le bas (`ui/panneau.tsx`).

          ⚠️ `aria-haspopup="dialog"`, JAMAIS `aria-expanded` : ce bouton n'agrandit rien en place. */}
      <button
        type="button"
        onClick={() => setIngredientsOuverts(true)}
        aria-haspopup="dialog"
        className="mt-4 flex min-h-tactile w-full items-center justify-between gap-3 rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-left text-[1.05rem] font-semibold text-accent-texte"
      >
        <span>Voir les ingrédients</span>
        {/* La valeur courante sur la ligne, comme `LigneOuvrante` : sans elle, connaître le nombre de
            portions demanderait d'ouvrir la fenêtre rien que pour le lire. */}
        <span className="text-[0.95rem] font-normal text-attenue">
          pour {portions} portion{portions > 1 ? 's' : ''}
        </span>
      </button>

      {ingredientsOuverts && (
        <Panneau titre={`Ingrédients — ${recette.nom}`} onFermer={() => setIngredientsOuverts(false)}>
          <SelecteurPortions
            portions={portions}
            base={recette.portionsBase}
            onChange={changerPortions}
          />
          {/* ⚠️ `manquants` À `null`, DÉLIBÉRÉMENT. On ne dit pas « à acheter » à quelqu'un qui a
              déjà la poêle sur le feu : la mention appartient à la fiche, où l'on décide de
              cuisiner, pas au fourneau où il est trop tard pour en tenir compte. */}
          <ListeIngredients
            ingredients={recette.ingredients}
            quantites={quantites}
            facteur={facteur}
            nomAliment={(foodId) => catalogue.foods.get(foodId as never)?.nom ?? foodId}
            estQuantiteFigee={(foodId) => catalogue.foods.get(foodId as never)?.quantiteFigee === true}
            manquants={null}
          />
        </Panneau>
      )}

      {etape !== undefined && (
        <section className="mt-6 rounded-[--radius-carte] border border-bordure bg-surface p-5">
          <p className="text-[0.95rem] font-semibold uppercase tracking-wide text-attenue">
            Étape {rang + 1} sur {gestes.length}
          </p>
          {/* ⚠️ LA QUANTITÉ EST DANS LA PHRASE, PAS SEULEMENT SOUS ELLE : « Faire fondre 50 g de
              beurre ». Le nombre suit le sélecteur de portions parce qu'il vient de
              `quantiteAffichee` — le YAML, lui, n'est pas touché. Voir `ui/texte-etape.ts`. */}
          <TexteEtape
            segments={redaction?.segments ?? [{ type: 'texte', contenu: etape.texte }]}
            className="mt-3 text-[1.35rem] leading-relaxed text-texte"
          />

          {/* ⚠️ LA QUANTITÉ LÀ OÙ ON SE LA DEMANDE. « C'était combien d'ail ? » n'ouvre plus rien :
              c'est déjà sous la phrase, mis à l'échelle des portions courantes. La fenêtre reste,
              et c'est ce qui rend la chose sûre — voir l'en-tête de `QuantitesDeLEtape`.

              ⚠️ `sauf` RETIRE CE QUE LA PHRASE VIENT DE DIRE, et rien d'autre : trois quarts des
              gestes n'y laissent plus de badge, le quart restant (pronoms, hyperonymes, « au
              goût ») le garde. L'union des deux couvre toujours `foodIds`.

              ⚠️ `foodIds` EST DÉRIVÉ AU BUILD (93,7 % des gestes), jamais saisi à la main. Une étape
              qui n'emploie aucun ingrédient — « Préchauffer le four » — ne rend rien du tout. */}
          <QuantitesDeLEtape
            ingredients={recette.ingredients}
            foodIds={etape.foodIds}
            quantites={quantites}
            facteur={facteur}
            nomAliment={(foodId) => catalogue.foods.get(foodId as never)?.nom ?? foodId}
            estQuantiteFigee={(foodId) => catalogue.foods.get(foodId as never)?.quantiteFigee === true}
            sauf={redaction?.injectes}
          />

          {/* ⚠️ SUR PLACE ET SOUS L'ÉTAPE, pas en fenêtre — l'inverse du choix fait pour les
              ingrédients, et pour la raison inverse : une définition se lit DANS l'étape, une
              fenêtre la recouvrirait. Le raisonnement complet est en tête de `ui/gestes-etape.tsx`.

              ⚠️ CELUI-CI NE SE FERME PAS À LA SONNERIE, contrairement à la fenêtre des ingrédients.
              Il n'a pas à le faire : il ne passe par aucun portail, donc la surface « appuyez
              n'importe où » (`fixed inset-0 z-50`) le recouvre au lieu d'être recouverte par lui.

              ⚠️ `key={etape.ordre}` — sinon un geste ouvert resterait déplié en changeant d'étape
              dès que deux étapes consécutives citent le même terme. */}
          <GestesDeLEtape key={etape.ordre} etape={etape} catalogue={catalogue} />

          {etape.timerS !== null && (
            <CarteMinuteur
              dureeS={etape.timerS}
              minuteur={minuteurDe(etape.ordre)}
              maintenant={maintenant}
              surLancer={() => lancer(etape.ordre, etape.timerS ?? 0)}
              surPause={() => basculerPause(etape.ordre)}
              surArret={() => arreterMinuteur(etape.ordre)}
            />
          )}
        </section>
      )}

      {/* ⚠️ LES MINUTEURS DES AUTRES ÉTAPES RESTENT VISIBLES. Une cuisson réelle en fait tourner
          plusieurs à la fois, et un décompte qui disparaît quand on tourne la page est un décompte
          qu'on oublie. Chacun porte le numéro de son étape, sinon on ne sait plus ce qu'il compte. */}
      {cuisson !== null && cuisson.minuteurs.filter((t) => t.ordre !== etape?.ordre).length > 0 && (
        <section className="mt-4">
          <h2 className="text-[1rem] font-semibold text-texte-doux">Minuteurs en cours</h2>
          <ul className="mt-2 space-y-2">
            {cuisson.minuteurs
              .filter((t) => t.ordre !== etape?.ordre)
              .map((t) => {
                // ⚠️ `-1` EST POSSIBLE, ET IL AFFICHAIT « Étape 0 ». Une recette modifiée pendant sa
                // cuisson — l'éditeur de recette existe — ou renumérotée par une mise à jour de
                // catalogue laisse un minuteur qui ne pointe plus aucun geste. On préfère alors une
                // ligne SANS numéro : le décompte reste là, il ne ment simplement plus sur son
                // origine. Le faire disparaître serait pire — c'est un décompte qu'on oublie.
                const rangT = gestes.findIndex((e) => e.ordre === t.ordre)
                return (
                  <li
                    key={t.ordre}
                    className="flex items-center justify-between rounded-[--radius-carte] border border-bordure bg-surface px-4 py-2"
                  >
                    <span className="text-[1.02rem] text-texte">
                      {rangT >= 0 && `Étape ${rangT + 1} — `}
                      {libelleMinuteur(etatMinuteur(t, maintenant))}
                    </span>
                    <button
                      type="button"
                      onClick={() => arreterMinuteur(t.ordre)}
                      className="min-h-tactile px-3 text-[0.95rem] font-semibold text-accent-texte underline"
                    >
                      Arrêter
                    </button>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      {derniere &&
        avertissements.map((a) => (
          <p
            key={a.ordre}
            className="mt-4 rounded-[--radius-carte] border border-alerte-bordure bg-alerte-fond p-4 text-[1.02rem] leading-relaxed text-alerte-texte"
          >
            {a.texte}
          </p>
        ))}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => allerA(rang - 1)}
          disabled={rang === 0}
          className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-4 text-[1.05rem] font-semibold text-accent-texte disabled:opacity-40"
        >
          ← Étape précédente
        </button>
        {derniere ? (
          <button
            type="button"
            onClick={demanderFin}
            // ⚠️ `aria-haspopup` CONDITIONNEL, et c'est la seule forme honnête : ce bouton n'ouvre une
            // fenêtre que s'il y a un minuteur à perdre. L'annoncer toujours mentirait une fois sur
            // deux, ne l'annoncer jamais mentirait l'autre fois.
            aria-haspopup={minuteursVivants.length > 0 ? 'dialog' : undefined}
            className="min-h-tactile flex-1 rounded-[--radius-carte] bg-accent-plein px-4 text-[1.05rem] font-semibold text-white"
          >
            {/* « Ce plat » quand il en reste d'autres : « Terminer la cuisson » ferait croire qu'on
                sort du mode, alors qu'on ferme un onglet et qu'on retombe sur le suivant. */}
            {etat.plats.length > 1 ? 'Terminer ce plat' : 'Terminer la cuisson'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => allerA(rang + 1)}
            className="min-h-tactile flex-1 rounded-[--radius-carte] bg-accent-plein px-4 text-[1.05rem] font-semibold text-white"
          >
            Étape suivante →
          </button>
        )}
      </div>

      {finAConfirmer && (
        <Panneau
          titre={etat.plats.length > 1 ? `Terminer « ${recette.nom} » ?` : 'Terminer la cuisson ?'}
          onFermer={() => setFinAConfirmer(false)}
        >
          {/* On dit CE QU'ON PERD, pas « êtes-vous sûr ». La question générique n'apprend rien à
              quelqu'un qui a les mains occupées ; le nombre de décomptes en cours, si. */}
          <p className="text-[1.05rem] leading-relaxed text-texte">
            {/* On nomme ce qu'on ferme quand il y a plusieurs plats : « la cuisson » laisserait
                croire qu'on perd aussi les minuteurs du gratin, qui eux ne bougent pas. */}
            {minuteursVivants.length === 1
              ? `Un minuteur tourne encore. Terminer ${etat.plats.length > 1 ? 'ce plat' : 'la cuisson'} l’efface.`
              : `${minuteursVivants.length} minuteurs tournent encore. Terminer ${etat.plats.length > 1 ? 'ce plat' : 'la cuisson'} les efface.`}
          </p>
          <div className="mt-5 flex gap-3">
            {/* Le retour en arrière d'abord, et en premier au clavier : c'est le choix sans risque. */}
            <button
              type="button"
              onClick={() => setFinAConfirmer(false)}
              className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-4 text-[1.05rem] font-semibold text-accent-texte"
            >
              Continuer la cuisson
            </button>
            <button
              type="button"
              onClick={terminer}
              className="min-h-tactile flex-1 rounded-[--radius-carte] bg-accent-plein px-4 text-[1.05rem] font-semibold text-white"
            >
              Terminer quand même
            </button>
          </div>
        </Panneau>
      )}

      {/* ⚠️ ARRÊT PAR APPUI N'IMPORTE OÙ, validé à l'essai. Un bouton précis à viser demande de
          regarder l'écran — c'est-à-dire exactement ce qu'on ne fait pas les mains occupées. */}
      {alarmeSur !== null && (
        <button
          type="button"
          onClick={stopperAlarme}
          aria-label="Arrêter l’alarme"
          className="fixed inset-0 z-50 flex items-end justify-center bg-transparent p-10 text-[1.1rem] font-semibold text-texte"
        >
          <span className="rounded-[--radius-carte] border border-bordure-forte bg-surface px-5 py-3">
            {/* Le plat est NOMMÉ dès qu'il n'est pas celui qu'on regarde : « minuteur terminé » sur
                l'écran du rôti, alors que c'est le gratin qui sonne, envoie ouvrir le mauvais four. */}
            {alarmeSur.recetteId === recette.id
              ? 'Minuteur terminé — appuyez n’importe où'
              : `${nomDe(alarmeSur.recetteId)} — minuteur terminé — appuyez n’importe où`}
          </span>
        </button>
      )}

      {aiguillage !== null && (
        <Panneau titre="Changer de plat ?" onFermer={() => setAiguillage(null)}>
          <p className="text-[1.05rem] leading-relaxed text-texte">
            Le minuteur de « {nomDe(aiguillage.recetteId)} » a sonné. Vous êtes sur «&nbsp;
            {recette.nom} ».
          </p>
          <div className="mt-5 flex gap-3">
            {/* Rester d'abord, et en premier au clavier : c'est le choix qui ne perd pas l'étape. */}
            <button
              type="button"
              onClick={() => setAiguillage(null)}
              className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-4 text-[1.05rem] font-semibold text-accent-texte"
            >
              Rester ici
            </button>
            <button
              type="button"
              onClick={() => {
                setActif(aiguillage.recetteId)
                setAiguillage(null)
              }}
              className="min-h-tactile flex-1 rounded-[--radius-carte] bg-accent-plein px-4 text-[1.05rem] font-semibold text-white"
            >
              Aller à {nomDe(aiguillage.recetteId)}
            </button>
          </div>
        </Panneau>
      )}

      <p aria-live="polite" className="sr-only">
        {alarmeSur === null
          ? ''
          : alarmeSur.recetteId === recette.id
            ? 'Minuteur terminé.'
            : `Minuteur terminé pour ${nomDe(alarmeSur.recetteId)}.`}
      </p>
    </article>
  )
}

/**
 * Le décompte à montrer sur l'onglet d'un plat : LE PLUS URGENT, ou rien.
 *
 * ⚠️ `null` QUAND LE PLAT N'A AUCUN MINUTEUR, et l'onglet n'affiche alors pas de seconde ligne.
 * Écrire « — » ou « aucun minuteur » remplirait la barre de mots qui ne disent rien, sur l'écran
 * qu'on lit de loin et de biais. C'est ce que la maquette a tranché.
 *
 * L'ordre d'urgence : ce qui a sonné passe devant ce qui tourne, qui passe devant ce qui est en
 * pause. Un plat sorti du feu réclame la main tout de suite ; un décompte en pause n'attend rien.
 */
function decompteDeLOnglet(
  cuisson: StoredCuisineSession | undefined,
  maintenant: number
): string | null {
  let marche: number | null = null
  let pause: number | null = null
  for (const t of cuisson?.minuteurs ?? []) {
    const etat = etatMinuteur(t, maintenant)
    if (etat.mode === 'termine') return 'terminé'
    if (etat.mode === 'marche') marche = marche === null ? etat.restantS : Math.min(marche, etat.restantS)
    else pause = pause === null ? etat.restantS : Math.min(pause, etat.restantS)
  }
  if (marche !== null) return formaterDuree(marche)
  return pause === null ? null : `${formaterDuree(pause)} en pause`
}

/**
 * Les onglets des plats en cours, dans l'ordre de départ décidé par le moteur.
 *
 * ⚠️ HAUTEUR FIXE ET CONTENU CENTRÉ, pas un simple empilement. Les onglets n'ont pas tous une ligne
 * de décompte — c'est voulu, voir `decompteDeLOnglet` — et sans hauteur imposée la barre se
 * déformait à chaque fois qu'un minuteur démarrait ou s'arrêtait, sous les doigts de quelqu'un qui
 * vise un onglet.
 */
function BarreDePlats({
  plats,
  cuissons,
  actif,
  maintenant,
  onChoisir,
}: {
  readonly plats: readonly PlatEnCuisine[]
  readonly cuissons: readonly StoredCuisineSession[]
  readonly actif: string
  readonly maintenant: number
  readonly onChoisir: (recetteId: string) => void
}) {
  return (
    <nav aria-label="Plats en cours" className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-1">
      {plats.map((plat) => {
        const estActif = plat.recette.id === actif
        const decompte = decompteDeLOnglet(
          cuissons.find((c) => c.recetteId === plat.recette.id),
          maintenant
        )
        return (
          <button
            key={plat.recette.id}
            type="button"
            onClick={() => onChoisir(plat.recette.id)}
            // `aria-current="true"` et non `aria-selected` : ce ne sont pas des onglets ARIA (pas de
            // `tabpanel` associé), c'est une navigation entre plats.
            aria-current={estActif ? 'true' : undefined}
            className={`flex min-h-[2.7rem] shrink-0 flex-col justify-center rounded-[--radius-carte] border px-4 py-1.5 text-left ${
              estActif
                ? 'border-accent bg-accent-doux text-accent-texte'
                : 'border-bordure bg-surface text-texte-doux'
            }`}
          >
            <span className="text-[1rem] font-semibold leading-tight">{plat.recette.nom}</span>
            {decompte !== null && (
              <span className="text-[0.9rem] tabular-nums leading-tight text-attenue">{decompte}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * Le minuteur de l'étape affichée. Trois régimes, jamais deux à la fois : pas lancé, en marche ou en
 * pause, terminé.
 */
function CarteMinuteur({
  dureeS,
  minuteur,
  maintenant,
  surLancer,
  surPause,
  surArret,
}: {
  readonly dureeS: number
  readonly minuteur: StoredCuisineTimer | undefined
  readonly maintenant: number
  readonly surLancer: () => void
  readonly surPause: () => void
  readonly surArret: () => void
}) {
  if (minuteur === undefined) {
    return (
      <button
        type="button"
        onClick={surLancer}
        className="mt-5 min-h-tactile w-full rounded-[--radius-carte] border border-accent bg-accent-doux px-4 text-[1.1rem] font-semibold text-accent-texte"
      >
        Lancer le minuteur ({formaterDuree(dureeS)})
      </button>
    )
  }

  const etat = etatMinuteur(minuteur, maintenant)
  return (
    <div className="mt-5 rounded-[--radius-carte] border border-accent bg-accent-doux p-4">
      <p className="text-center text-[2.2rem] font-semibold tabular-nums text-accent-texte">
        {etat.mode === 'termine' ? formaterDuree(etat.depuisS) : formaterDuree(etat.restantS)}
      </p>
      <p className="text-center text-[0.95rem] text-accent-texte">{libelleMinuteur(etat)}</p>
      <div className="mt-3 flex gap-3">
        {etat.mode !== 'termine' && (
          <button
            type="button"
            onClick={surPause}
            className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-3 text-[1rem] font-semibold text-accent-texte"
          >
            {etat.mode === 'pause' ? 'Reprendre' : 'Mettre en pause'}
          </button>
        )}
        <button
          type="button"
          onClick={surArret}
          className="min-h-tactile flex-1 rounded-[--radius-carte] border border-bordure-forte bg-fond px-3 text-[1rem] font-semibold text-accent-texte"
        >
          {etat.mode === 'termine' ? 'Effacer' : 'Arrêter'}
        </button>
      </div>
    </div>
  )
}
