// ui/screens/courses.tsx — écran « Courses » (§4.3 DESIGN, §7.4 ENGINE).
//
// Premier écran qui referme une boucle utile de bout en bout : planifier une semaine produit une
// liste de courses. `buildShoppingList` était codé depuis P1c et n'avait jamais été appelé.
//
// ⚠️ LA LISTE SE REDÉRIVE, LE COCHAGE NON. Quantités, unités, rayons, provenance par créneau : tout
// se recalcule depuis le plan, et le recalculer garantit que la liste correspond au plan RÉEL. Le
// seul état qu'aucun calcul ne peut retrouver est ce que l'utilisateur a coché — c'est le seul que
// `user.db` conserve, avec les articles ajoutés à la main.
//
// ⚠️ LES QUANTITÉS NE SUIVENT PAS LE NOMBRE DE CONVIVES, et ça se voit à l'écran. Une recette
// s'achète telle qu'elle est écrite, pour ses `portionsBase` — c'est précisément ce qui produit les
// restes que le planning place ensuite (§7.4 ENGINE). Diviser par les convives ferait acheter de
// quoi cuisiner un demi-plat et supprimerait ces restes. Ne pas « corriger » ça ici.
//
// ✅ L'IMPRESSION ET L'EXPORT SONT LÀ DEPUIS LE 2026-08-10 — voir `BoutonImprimerExporter` en bas de
// fichier, le format dans `ui/export-courses.ts`, et le bloc `@media print` de `theme.css`. Les deux
// s'ouvrent dans une fenêtre plutôt que d'ajouter trois boutons à la barre d'actions.
//
// PÉRIMÈTRE — ce que §4.3 décrit et qui n'est toujours PAS ici : le découpage en deux virées de
// courses (`joursDeCourses`, §7.4).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AllergenId,
  Catalog,
  Food,
  FoodId,
  RecipeId,
  ShoppingList,
  ShoppingListItem,
  SlotRef,
} from '../../engine/domain/index.js'
import { rayonDe, RAYONS_ALIMENTAIRES } from '../../engine/planning/shopping-list.js'
import { chercherParNom, normaliser } from '../../engine/search/index.js'
import {
  addExtraItem,
  readAllergies,
  readLatestPlan,
  readPantryEntries,
  readSaucesChoisies,
  readShoppingList,
  removeExtraItem,
  saveShoppingList,
  setCoche,
  setExtraCoche,
  type StoredExtraItem,
  type StoredPantryEntry,
  type StoredShoppingList,
} from '../../data/user-store.js'
import { LIBELLE_COURT } from '../champs-profil.js'
import { formaterQuantiteAchat } from '../quantites.js'
import {
  LIBELLE_CRENEAU,
  aujourdhuiIso,
  chargerSocle,
  cleCreneau,
  formaterJour,
  profilCourant,
  type Socle,
} from '../socle.js'
import { hashDe, hashDuFrigo } from '../router.js'
import {
  FICHIER_CSV,
  FICHIER_JSON,
  MIME_CSV,
  MIME_JSON,
  telecharger,
  versCsv,
  versJson,
  type LigneCourses,
} from '../export-courses.js'
import { Panneau } from '../panneau.js'
import { LienTutoriel } from '../lien-tutoriel.js'
import { ConfirmerFrigo, alimentsAConfirmer } from '../confirmer-frigo.js'
import { BoutonParcourir, ParcoursAliments } from '../parcours-aliments.js'

/** Les dix rayons de §4.3 — texte libre côté base, liste fermée côté saisie pour rester rangeable. */
const RAYONS_EXTRA: readonly string[] = [
  'hygiène & soin',
  'cheveux, rasage, beauté',
  'nettoyage & maison',
  'lessive & linge',
  'vaisselle & cuisine jetable',
  'maison & bureau',
  'animaux',
  'bébé',
  'pharmacie & premiers soins',
  'vêtements & textile',
]

type Rangement = 'rayon' | 'repas' | 'jour'

const LIBELLE_RANGEMENT: Readonly<Record<Rangement, string>> = {
  rayon: 'Rayon',
  repas: 'Repas',
  jour: 'Jour',
}

/** Un créneau servi par un reste : « mardi · Déjeuner — Ratatouille ». */
interface CreneauCouvert {
  readonly cle: string
  readonly titre: string
  /**
   * Le nom de l'accompagnement du même créneau, `null` s'il n'y en a pas — et il y en a presque
   * toujours un. `planLeftovers` ne remplace que le PLAT : l'accompagnement reste une vraie recette,
   * qui part bel et bien dans les courses. Sans ce champ, la section affirmait « rien à acheter pour
   * ces repas » alors que la moitié de l'assiette était dans la liste.
   */
  readonly accompagnement: string | null
}

interface Vue {
  readonly liste: ShoppingList
  /**
   * Les articles écartés de `liste` parce qu'ils sont déclarés au garde-manger (§4.5, décision 41 c
   * ETAT.md). `buildShoppingList` ne les MARQUE pas, il les RETIRE — voir l'en-tête du fichier
   * `shopping-list.ts` (`if (deja.has(ingredient.foodId)) continue`). Cette liste est donc calculée
   * ICI, par différence avec une liste construite sans l'option, plutôt que lue sur `liste` elle-même.
   */
  readonly dejaChezVous: readonly ShoppingListItem[]
  /**
   * Le garde-manger quand il a trop vieilli pour qu'on s'y fie — VIDE le reste du temps. Non
   * appliqué à `liste` : voir le bloc de `calculerVue` et le bandeau `ConfirmerFrigo`.
   */
  /**
   * Les créneaux que le planning a couverts avec un reste — ils n'ont rien coûté à cette liste.
   *
   * ⚠️ LU SUR `isLeftover`, PAS CALCULÉ PAR DIFFÉRENCE, et c'est l'inverse de `dejaChezVous`
   * juste au-dessus. Le garde-manger n'est marqué nulle part, donc il FAUT le retrouver en
   * comparant deux listes ; un reste, lui, porte son propre drapeau (§7.3 ENGINE). Refaire une
   * différence ici ne donnerait d'ailleurs rien : un reste réutilise LA MÊME recette que son plat
   * source, donc le cuisiner à part n'ajouterait aucun article — ça doublerait des quantités.
   */
  readonly couvertsParUnReste: readonly CreneauCouvert[]
  readonly gardeAConfirmer: readonly FoodId[]
  /** Le garde-manger entier, dates comprises — `ConfirmerFrigo` réécrit la table et en a besoin. */
  readonly entreesFrigo: readonly StoredPantryEntry[]
  /** Pour `ConfirmerFrigo`, qui réécrit `user_pantry` quand l'utilisateur répond. */
  readonly socle: Socle
  readonly enregistree: StoredShoppingList
  readonly nomAliment: (id: FoodId) => string
  /**
   * La quantité telle qu'elle se lit en rayon — « 3 pièces », « 1 kg », « 500 g (2 × 250 g) ».
   *
   * ⚠️ PORTÉE PAR LA VUE, ET C'EST LE POINT. Trois endroits affichent une quantité : la ligne
   * cochable, « Déjà chez vous » et l'EXPORT TEXTE. Les trois concaténaient `${quantiteTotale}
   * ${unite}` chacun de leur côté — trois copies d'une même règle, donc trois occasions de diverger
   * au premier correctif. Le format vit ici, une fois, et l'export texte dit la même chose que
   * l'écran (décision 41).
   */
  readonly quantiteDe: (item: ShoppingListItem) => string
  readonly platDuCreneau: (slot: SlotRef) => string | null
  /** Le nom d'une sauce retenue, pour titrer sa section (voir `grouper`). Repli sur l'identifiant :
   *  une sauce retenue puis retirée du catalogue laisse sa ligne en courses, et une section sans
   *  titre serait pire qu'un titre technique. */
  readonly nomSauce: (id: RecipeId) => string
  /** Le catalogue des aliments, pour la complétion de `FormulaireAjout` et le rayon qu'elle en déduit. */
  readonly foods: ReadonlyMap<FoodId, Food>
  /**
   * La note d'allergène à écrire pour un aliment choisi en complétion (ou `null` s'il n'en porte
   * aucun de déclaré). C'EST LE SEUL CAS COUVERT — voir l'en-tête du fichier : sur un `FoodId` fiable
   * on connaît la liste exacte des allergènes, et un texte libre ne l'offre pas.
   */
  readonly noteAllergeneDe: (food: Food) => string | null
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'sans_plan' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

/**
 * Charge la liste, en la régénérant si le plan a changé.
 *
 * ⚠️ La régénération est AUTOMATIQUE et c'est voulu : afficher les courses d'une semaine qu'on ne
 * cuisinera pas serait une erreur silencieuse, et l'utilisateur ne pourrait la détecter qu'au
 * supermarché. `saveShoppingList` reporte les cases déjà cochées dont l'aliment survit.
 */
async function calculerVue(): Promise<Etat> {
  const socle = await chargerSocle()
  const plan = readLatestPlan(socle.db)
  if (plan === null) return { phase: 'sans_plan' }

  profilCourant(socle.db, aujourdhuiIso())
  let enregistree = readShoppingList(socle.db)
  const entreesFrigo = readPantryEntries(socle.db)
  const pantryFoodIds = entreesFrigo.map((e) => e.foodId)
  // ⚠️ PÉRIMÉ SE JUGE ALIMENT PAR ALIMENT, pas garde-manger par garde-manger : une crème déclarée ce
  // matin reste appliquée même si un oignon traîne depuis trois semaines. Seul l'oignon est remis en
  // question, et seule sa ligne reste dans les courses.
  const aConfirmer = alimentsAConfirmer(entreesFrigo, aujourdhuiIso())

  // ⚠️ UN GARDE-MANGER PÉRIMÉ N'EST PAS APPLIQUÉ ICI, et c'est l'inverse de « Choisir un plat ».
  // Là-bas la question RETIENT les résultats ; ici elle n'empêche rien. La différence n'est pas
  // cosmétique : `pantryFoodIds` ne fait jamais qu'ENLEVER des lignes de cette liste, donc ignorer un
  // garde-manger douteux fait acheter en double, tandis que l'appliquer à tort fait rentrer SANS —
  // et on ne s'en aperçoit qu'au moment de cuisiner. On échoue du côté de la ligne en trop, qui se
  // raye. Même raison que « Déjà chez vous » plus bas : un article qui disparaît en silence est un
  // défaut pire que celui qu'on voit et qu'on barre.
  const applique = pantryFoodIds.filter((id) => !aConfirmer.includes(id))
  // Les sauces retenues (`user_recipe_sauce`, v14) : leurs ingrédients entrent dans la liste chaque
  // fois que leur plat est prévu. Le moteur ne connaît pas `user.db` — sans cette option, aucune
  // sauce n'est achetée, ce qui est exactement le comportement d'avant la v14.
  const saucesParRecette = readSaucesChoisies(socle.db)
  const liste = socle.moteur.buildShoppingList(plan, { pantryFoodIds: applique, saucesParRecette })

  // « Déjà chez vous » — voir l'en-tête de `Vue.dejaChezVous`. Une seule liste de référence
  // (sans l'option) suffit : `pantryFoodIds` n'AJOUTE aucune ligne, il n'en retire.
  //
  // ⚠️ LES SAUCES Y SONT AUSSI. Sans elles, l'échalote d'une sauce retenue disparaîtrait de la liste
  // (déclarée au frigo) sans apparaître dans « Déjà chez vous » : retirée d'un côté, invisible de
  // l'autre — le seul cas où une ligne s'évapore vraiment.
  const dejaChezVous =
    applique.length === 0
      ? []
      : socle.moteur
          .buildShoppingList(plan, { saucesParRecette })
          .items.filter((item) => applique.includes(item.foodId))

  if (enregistree === null || enregistree.planId !== plan.id) {
    saveShoppingList(socle.db, liste)
    enregistree = readShoppingList(socle.db)!
  }

  // ⚠️ LE PLAT, PAS LA DERNIÈRE ENTRÉE DU CRÉNEAU. Un déjeuner porte jusqu'à deux lignes depuis le
  // mode repas (`plan-week.ts`) ; ce `set` en boucle gardait donc la SECONDE, et la liste de courses
  // titrait « lundi · Déjeuner — Ratatouille » à la place du plat. Rien n'aurait planté : le
  // regroupement aurait juste désigné le mauvais repas.
  const platParCreneau = new Map<string, string>()
  for (const entree of plan.entries) {
    if (entree.recipeId === null || entree.service === 'accompagnement') continue
    const nom = socle.catalogue.recipes.get(entree.recipeId)?.nom
    if (nom !== undefined) platParCreneau.set(cleCreneau(entree.slot.date, entree.slot.creneau), nom)
  }

  // Les créneaux servis par un reste — voir l'en-tête de `Vue.couvertsParUnReste`. Un reste porte
  // toujours la recette de son plat source (`plan-leftovers.ts`), donc son nom est celui du plat
  // qu'on retrouvera dans l'assiette.
  //
  // ⚠️ L'ACCOMPAGNEMENT DU CRÉNEAU EST RÉSOLU AUSSI, et ce n'est pas un ornement : `planLeftovers`
  // ne remplace que le plat, l'accompagnement reste une recette à cuisiner et donc à acheter.
  const accompagnementDuCreneau = new Map<string, string>()
  for (const entree of plan.entries) {
    if (entree.service !== 'accompagnement' || entree.recipeId === null || entree.isLeftover) continue
    const nom = socle.catalogue.recipes.get(entree.recipeId)?.nom
    if (nom !== undefined) accompagnementDuCreneau.set(cleCreneau(entree.slot.date, entree.slot.creneau), nom)
  }

  const couvertsParUnReste: CreneauCouvert[] = []
  for (const entree of plan.entries) {
    if (!entree.isLeftover || entree.recipeId === null) continue
    const nom = socle.catalogue.recipes.get(entree.recipeId)?.nom
    if (nom === undefined) continue
    const cle = cleCreneau(entree.slot.date, entree.slot.creneau)
    couvertsParUnReste.push({
      cle,
      titre: `${formaterJour(entree.slot.date)} · ${LIBELLE_CRENEAU[entree.slot.creneau]} — ${nom}`,
      accompagnement: accompagnementDuCreneau.get(cle) ?? null,
    })
  }

  // Mêmes allergies déclarées que le reste de l'appli (`readAllergies`, table `user_allergy`) —
  // aucun chemin dédié : un allergène décoché ailleurs doit l'être ici aussi.
  const allergiesDeclarees = new Set<AllergenId>(readAllergies(socle.db).map((a) => a.allergenId))

  return {
    phase: 'pret',
    vue: {
      liste,
      dejaChezVous,
      couvertsParUnReste,
      gardeAConfirmer: aConfirmer,
      entreesFrigo,
      socle,
      enregistree,
      nomAliment: (id) => socle.catalogue.foods.get(id)?.nom ?? id,
      quantiteDe: (item) =>
        formaterQuantiteAchat(
          item.quantiteTotale,
          item.unite,
          socle.catalogue.foods.get(item.foodId)?.conditionnementG ?? null
        ),
      platDuCreneau: (slot) => platParCreneau.get(cleCreneau(slot.date, slot.creneau)) ?? null,
      nomSauce: (id) => socle.catalogue.recipes.get(id)?.nom ?? id,
      foods: socle.catalogue.foods,
      noteAllergeneDe: (food) => noteAllergene(food, allergiesDeclarees, socle.catalogue.allergens),
    },
  }
}

/**
 * Le texte informatif écrit en base pour un article manuel choisi par complétion (voir l'en-tête du
 * fichier). `null` si l'aliment ne porte aucun allergène parmi ceux déclarés — ni traces ni certain
 * ne sont distingués ici, même choix que le garde-fou du moteur (§5.2 ARCHITECTURE, `allergenes.ts`).
 */
function noteAllergene(
  food: Food,
  allergiesDeclarees: ReadonlySet<AllergenId>,
  allergens: Catalog['allergens']
): string | null {
  const touches = food.allergenes
    .filter((a) => allergiesDeclarees.has(a.allergenId))
    .map((a) => LIBELLE_COURT[a.allergenId] ?? allergens.get(a.allergenId)?.nom ?? a.allergenId)
  if (touches.length === 0) return null
  return `Contient un allergène que vous avez déclaré : ${touches.join(', ')}`
}

/**
 * Sections d'affichage, selon le rangement choisi. Un article peut apparaître dans PLUSIEURS
 * sections — mais jamais DEUX FOIS dans la même.
 *
 * ⚠️ LA DÉDUPLICATION PAR SECTION CORRIGE UN DÉFAUT RÉEL. En rangement « jour », la boucle parcourt
 * `pourSlots` et le titre de section ne retient que la DATE : un ingrédient présent au déjeuner et
 * au dîner du même jour était ajouté deux fois à la même section. `Ligne` étant clé par
 * `item.foodId`, React levait « two children with the same key » — ligne visiblement dupliquée, et
 * surtout deux nœuds de même clé, un cas que React documente comme non supporté et dont il ne
 * garantit pas la mise à jour fidèle (cocher l'une aurait pu ne pas se répercuter sur l'autre).
 *
 * `Map` plutôt qu'un `Set` de contrôle : `set` sur une clé existante conserve la position
 * d'insertion d'origine, donc l'ordre des articles ne dépend pas du nombre de créneaux traversés.
 *
 * ⚠️ LES SAUCES ONT LEUR PROPRE SECTION, ET SANS ELLE UNE LIGNE DISPARAISSAIT. Un ingrédient qui ne
 * vient QUE d'une sauce a `pourSlots` vide — la sauce n'est pas au plan, elle suit son plat. La
 * boucle ci-dessous parcourt `pourSlots` : hors rangement « rayon », la moutarde d'une sauce retenue
 * n'était donc ajoutée à AUCUNE section. Achetée, comptée dans le total, invisible à l'écran.
 *
 * Une section par sauce, jamais sous un repas : la titrer « lundi · Dîner » inventerait une
 * provenance que la donnée ne porte pas — même raison qu'`ArticlesAjoutes`, plus bas. Et l'article
 * mixte (l'échalote du rôti ET de la sauce) apparaît des DEUX côtés : sa quantité est gonflée par la
 * sauce, une ligne gonflée sans provenance visible se lit comme une erreur de calcul.
 */
function grouper(vue: Vue, rangement: Rangement): { titre: string; items: readonly ShoppingListItem[] }[] {
  const sections = new Map<string, Map<FoodId, ShoppingListItem>>()
  const ajouter = (titre: string, item: ShoppingListItem) => {
    const existante = sections.get(titre)
    if (existante === undefined) sections.set(titre, new Map([[item.foodId, item]]))
    else existante.set(item.foodId, item)
  }

  for (const item of vue.liste.items) {
    if (rangement === 'rayon') {
      ajouter(item.rayon, item)
      continue
    }
    // ⚠️ `pourSlots` existe EXACTEMENT pour ça (§7.4) : sans lui, l'agrégation aurait détruit
    // l'information de provenance et « ranger par repas » serait inexprimable.
    for (const slot of item.pourSlots) {
      if (rangement === 'jour') {
        ajouter(formaterJour(slot.date), item)
      } else {
        const plat = vue.platDuCreneau(slot)
        const creneau = `${formaterJour(slot.date)} · ${LIBELLE_CRENEAU[slot.creneau]}`
        ajouter(plat === null ? creneau : `${creneau} — ${plat}`, item)
      }
    }
  }

  // Seconde passe, APRÈS la première : `Map` conserve l'ordre d'insertion, donc les sections de
  // sauce se rangent en pied de liste, là où on va chercher ce qui n'appartient à aucun repas.
  if (rangement !== 'rayon') {
    for (const item of vue.liste.items) {
      // Le nom de la sauce SEUL, sans habillage : « Pour la Sauce au poivre » demanderait un article
      // accordé au nom, et le catalogue en porte déjà (« Vinaigrette à la moutarde »). Les titres de
      // repas contiennent tous un « · », ceux-là jamais — la distinction se lit sans qu'on l'écrive.
      for (const sauceId of item.pourSauces) ajouter(vue.nomSauce(sauceId), item)
    }
  }

  return [...sections.entries()].map(([titre, items]) => ({ titre, items: [...items.values()] }))
}

/**
 * Les lignes telles qu'elles partent dans un fichier — voir l'en-tête d'`export-courses.ts` pour le
 * pourquoi de chaque parti pris (ordre fixe, articles cochés conservés, aucune horloge).
 *
 * ⚠️ L'ORDRE NE VIENT PAS DE `grouper`, ET C'EST VOULU. `grouper` suit le rangement CHOISI à
 * l'écran ; un fichier doit être reproductible, donc il suit `RAYONS_ALIMENTAIRES`, puis le nom.
 * Exporter deux fois la même semaine en ayant touché au bouton « Ranger par » entre les deux doit
 * rendre deux fichiers identiques.
 *
 * ⚠️ ET LA QUANTITÉ PASSE PAR `vue.quantiteDe`, jamais par `${quantiteTotale} ${unite}` : c'est le
 * quatrième lecteur de cette règle (voir le commentaire de `Vue.quantiteDe`), et la recopier ici
 * serait la quatrième occasion de la voir diverger de l'écran.
 */
function lignesExport(vue: Vue): readonly LigneCourses[] {
  const rang = new Map(RAYONS_ALIMENTAIRES.map((rayon, index) => [rayon, index]))
  const duPlan = [...vue.liste.items]
    .sort((a, b) => {
      // Un rayon absent du référentiel se range en fin, jamais au hasard : `rayonDe` a un repli
      // (« autres »), mais une liste enregistrée avant un renommage peut porter autre chose.
      const ra = rang.get(a.rayon) ?? RAYONS_ALIMENTAIRES.length
      const rb = rang.get(b.rayon) ?? RAYONS_ALIMENTAIRES.length
      if (ra !== rb) return ra - rb
      return vue.nomAliment(a.foodId).localeCompare(vue.nomAliment(b.foodId), 'fr')
    })
    .map((item) => ({
      libelle: vue.nomAliment(item.foodId),
      quantite: vue.quantiteDe(item),
      rayon: item.rayon,
      coche: vue.enregistree.coches.has(item.foodId),
      origine: 'plan' as const,
    }))

  // Les ajouts manuels gardent leur ordre de saisie — c'est celui de `user.db`, donc stable d'un
  // export à l'autre, et il porte une information que le tri alphabétique détruirait.
  const ajoutes = vue.enregistree.extras.map((extra) => ({
    libelle: extra.libelle,
    quantite: extra.quantite ?? '',
    rayon: extra.rayon ?? 'Autres',
    coche: extra.coche,
    origine: 'ajout' as const,
  }))

  return [...duPlan, ...ajoutes]
}

export function Courses() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [rangement, setRangement] = useState<Rangement>('rayon')
  const [ajoutOuvert, setAjoutOuvert] = useState(false)

  const rafraichir = useCallback(() => {
    calculerVue()
      .then(setEtat)
      .catch((erreur: unknown) => {
        setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
  }, [])

  useEffect(rafraichir, [rafraichir])

  const basculer = useCallback(
    (foodId: FoodId, coche: boolean) => {
      if (etat.phase !== 'pret') return
      const listId = etat.vue.enregistree.id
      chargerSocle()
        .then((socle) => {
          setCoche(socle.db, listId, foodId, coche)
          rafraichir()
        })
        .catch(() => undefined)
    },
    [etat, rafraichir]
  )

  const basculerExtra = useCallback(
    (id: number, coche: boolean) => {
      chargerSocle()
        .then((socle) => {
          setExtraCoche(socle.db, id, coche)
          rafraichir()
        })
        .catch(() => undefined)
    },
    [rafraichir]
  )

  const supprimerExtra = useCallback(
    (id: number) => {
      chargerSocle()
        .then((socle) => {
          removeExtraItem(socle.db, id)
          rafraichir()
        })
        .catch(() => undefined)
    },
    [rafraichir]
  )

  const ajouter = useCallback(
    (libelle: string, rayon: string | null, quantite: string | null, noteAllergene: string | null) => {
      if (etat.phase !== 'pret') return
      const listId = etat.vue.enregistree.id
      chargerSocle()
        .then((socle) => {
          addExtraItem(socle.db, listId, { libelle, rayon, quantite, noteAllergene })
          setAjoutOuvert(false)
          rafraichir()
        })
        .catch(() => undefined)
    },
    [etat, rafraichir]
  )

  const sections = useMemo(
    () => (etat.phase === 'pret' ? grouper(etat.vue, rangement) : []),
    [etat, rangement]
  )

  if (etat.phase === 'chargement') return <p className="text-attenue">Construction de la liste…</p>
  if (etat.phase === 'sans_plan') {
    return (
      <section>
        <h1 data-visite="titre-courses" className="text-titre-l text-texte">
          Mes courses
        </h1>
        <LienTutoriel parcoursId="courses" />
        <p className="mt-3 text-lecture leading-relaxed text-texte-doux">
          La liste se construit à partir de votre semaine.
        </p>
        <a
          href={hashDe('semaine')}
          className="mt-5 inline-flex min-h-cta items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-lecture font-semibold text-white no-underline"
        >
          Composer ma semaine
        </a>
      </section>
    )
  }
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-lecture font-semibold text-texte">La liste n'a pas pu être construite.</p>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat
  const coches = vue.enregistree.coches
  const extras = vue.enregistree.extras
  const total = vue.liste.items.length + extras.length
  const faits = vue.liste.items.filter((i) => coches.has(i.foodId)).length + extras.filter((e) => e.coche).length

  return (
    <section>
      <h1 data-visite="titre-courses" className="text-titre-l text-texte">
        Mes courses
      </h1>
      {/* Enveloppé plutôt que marqué à la source : `LienTutoriel` sert cinq écrans, et le masquer
          pour tous serait une décision sur des écrans dont personne n'a réglé l'impression. */}
      <div className="sans-impression">
        <LienTutoriel parcoursId="courses" />
      </div>
      {/* La semaine d'abord, le compteur EN DESSOUS et sur sa propre ligne : accolés par un point
          médian, on lisait « du 3 au 9 août · 12 sur 40 » comme une seule information. */}
      <p className="mt-2 text-courant leading-relaxed text-attenue">{plageDuPlan(vue.liste)}</p>
      <p className="mt-1 text-courant leading-relaxed text-attenue">
        {faits} sur {total} cochés
      </p>

      {/* ⚠️ CE BANDEAU N'EST PAS UN MUR, contrairement à celui de « Choisir un plat ». Retenir une
          liste de courses derrière douze cases à cocher pendant que quelqu'un est debout dans le
          magasin coûterait plus cher que les deux lignes en trop qu'elle contient. Il DIT ce qui a
          été fait — rien n'a été retiré — et offre de corriger. L'ignorer laisse l'état sûr. */}
      {vue.gardeAConfirmer.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-courant leading-relaxed text-texte-doux">
            {vue.gardeAConfirmer.length === 1
              ? 'Un aliment de votre garde-manger date trop pour qu’on s’y fie : il est resté sur la liste.'
              : `${vue.gardeAConfirmer.length} aliments de votre garde-manger datent trop pour qu’on s’y fie : ils sont restés sur la liste.`}
          </p>
          <ConfirmerFrigo
            socle={vue.socle}
            entrees={vue.entreesFrigo}
            aujourdhui={aujourdhuiIso()}
            onConfirme={rafraichir}
          />
        </div>
      )}

      {/* ⚠️ LES RESTES N'ÉTAIENT NOMMÉS NULLE PART ICI, alors que cette liste est calculée pour en
          produire : les quantités ne sont PAS divisées par le nombre de convives, exprès (voir
          l'en-tête du fichier), et c'est `planLeftovers` qui place ensuite le surplus sur un repas
          de la semaine. On achetait donc pour des restes que rien n'annonçait. */}
      <p className="mt-3 rounded-[--radius-carte] border border-bordure bg-surface p-3 text-courant leading-relaxed text-texte-doux">
        Les quantités sont celles des recettes entières. Ce qui dépasse d'un repas est replacé sur un
        autre jour —{' '}
        <a href={hashDe('semaine')} className="text-accent-texte">
          visible dans votre semaine
        </a>{' '}
        sous « Reste du plat de la veille ».
      </p>

      {/* ⚠️ `sans-impression` ici et sur la barre d'actions : un choix de rangement et des boutons
          n'ont aucun sens sur une feuille. Ce qui suit — l'avertissement sur les quantités, les
          sections, les cases vides à cocher — s'imprime, LUI. Voir le bloc `@media print` de
          `theme.css` : c'est un opt-out article par article, pas une règle sur `button`. */}
      <fieldset data-visite="ranger-courses" className="sans-impression mt-5">
        <legend className="text-courant text-texte-doux">Ranger par</legend>
        <div className="mt-2 flex gap-2">
          {(['rayon', 'repas', 'jour'] as const).map((valeur) => (
            <button
              key={valeur}
              type="button"
              onClick={() => setRangement(valeur)}
              aria-pressed={rangement === valeur}
              className={
                'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-3 text-courant font-semibold ' +
                (rangement === valeur
                  ? 'border-2 border-accent bg-accent-doux text-accent-texte'
                  : 'border border-bordure-forte bg-surface text-texte-doux')
              }
            >
              {LIBELLE_RANGEMENT[valeur]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="sans-impression mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          data-visite="ajouter-article"
          onClick={() => setAjoutOuvert((ouvert) => !ouvert)}
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] bg-accent-plein px-4 text-lecture font-semibold text-white"
        >
          Ajouter un article
        </button>
        <BoutonPartager vue={vue} coches={coches} />
        <BoutonImprimerExporter vue={vue} />
      </div>

      {ajoutOuvert && (
        <FormulaireAjout
          foods={vue.foods}
          noteAllergeneDe={vue.noteAllergeneDe}
          onAjouter={ajouter}
          onAnnuler={() => setAjoutOuvert(false)}
        />
      )}

      {/* « Chemin inverse » (§4.3) : après des ajouts manuels, proposer d'en faire quelque chose.
          Invite DISCRÈTE et tardive — §4.3 la déclenche à partir de deux ajouts, pour ne pas
          harceler quelqu'un qui a juste noté sa lessive. */}
      {extras.length >= 2 && (
        <a
          href={hashDuFrigo()}
          className="sans-impression mt-3 flex min-h-tactile items-center justify-center rounded-[--radius-carte] border border-bordure-forte bg-surface px-4 text-courant font-semibold text-accent-texte no-underline"
        >
          Que cuisiner avec ?
        </a>
      )}

      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <article key={section.titre}>
            <h2 className="font-titre text-titre-s text-texte">{section.titre}</h2>
            <ul className="mt-2 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
              {section.items.map((item) => (
                <Ligne
                  key={item.foodId}
                  libelle={vue.nomAliment(item.foodId)}
                  quantite={vue.quantiteDe(item)}
                  coche={coches.has(item.foodId)}
                  onBasculer={() => basculer(item.foodId, !coches.has(item.foodId))}
                />
              ))}
            </ul>
          </article>
        ))}

        {extras.length > 0 && (
          <ArticlesAjoutes
            extras={extras}
            rangement={rangement}
            onBasculer={basculerExtra}
            onSupprimer={supprimerExtra}
          />
        )}
      </div>

      {vue.couvertsParUnReste.length > 0 && <CouvertsParUnReste creneaux={vue.couvertsParUnReste} />}

      {vue.dejaChezVous.length > 0 && (
        <DejaChezVous items={vue.dejaChezVous} nomAliment={vue.nomAliment} quantiteDe={vue.quantiteDe} />
      )}
    </section>
  )
}

/**
 * Section « Couverts par un reste » — les repas de la semaine qui n'ont rien coûté à cette liste.
 *
 * ⚠️ C'EST L'EFFET LE PLUS SPECTACULAIRE DU MOTEUR, ET IL ÉTAIT INVISIBLE LÀ OÙ IL SE PRODUIT
 * (décision 50, `ETAT.md`). Les restes font tomber une semaine de courses de 24 à 15 kg (§2
 * ARCHITECTURE) ; l'écran Semaine les montre depuis toujours (`Reste du plat de la veille`), l'écran
 * Courses n'en disait rien — et la question a été posée deux fois de suite pendant l'essai sur
 * téléphone : « où sont rangés les restes de la veille ? comment l'utilisateur peut le voir ? ».
 *
 * ⚠️ AUCUN CHIFFRE DE GAIN N'EST AFFICHÉ, et ce n'est pas une omission. Un reste réutilise LA MÊME
 * recette que son plat source : le contrefactuel « et si ce repas était cuisiné à part ? »
 * n'ajouterait aucun ARTICLE, il doublerait des QUANTITÉS. Un « n articles évités » vaudrait donc
 * zéro en permanence, et un total en poids demanderait d'additionner des grammes, des millilitres et
 * des pièces. On nomme ce qui est couvert ; on ne chiffre pas ce qu'on ne peut pas défendre.
 *
 * Non cochable, comme « Déjà chez vous » : il n'y a rien à acheter ici.
 */
function CouvertsParUnReste({ creneaux }: { readonly creneaux: readonly CreneauCouvert[] }) {
  return (
    <section className="mt-6">
      <h2 className="font-titre text-titre-s text-texte">Couverts par un reste ({creneaux.length})</h2>
      {/* ⚠️ « RIEN À ACHETER POUR EUX » ÉTAIT FAUX, et faux dans le cas NOMINAL — corrigé le
          2026-08-04, deux commits après avoir été écrit. `planLeftovers` ne remplace que le PLAT :
          l'accompagnement du créneau reste une recette entière, qui part dans les courses. Sur un
          plan de sept jours en mode repas, TOUS les créneaux couverts par un reste en portent un. */}
      <p className="mt-1 text-courant leading-relaxed text-attenue">
        Ces repas réutilisent un plat déjà cuisiné : il n’est pas dans votre liste.
      </p>
      {/* Même raison que le lien vers le frigo dans « Déjà chez vous » : nommer un effet sans dire
          où il se voit laisse la question entière. La Semaine porte déjà « Reste du plat de la
          veille » sur le créneau concerné. */}
      <a
        href={hashDe('semaine')}
        className="mt-2 flex min-h-tactile items-center rounded-[0.7rem] text-courant font-semibold text-accent-texte underline"
      >
        Voir ces repas dans ma semaine
      </a>
      <ul className="mt-2 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
        {creneaux.map((creneau) => (
          <li key={creneau.cle} className="px-3 py-2 text-lecture text-texte-doux">
            {creneau.titre}
            {creneau.accompagnement !== null && (
              <span className="block text-mention text-attenue">
                avec {creneau.accompagnement} — à acheter
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Section « Déjà chez vous » — les articles écartés de la liste parce qu'ils sont déclarés au
 * garde-manger. Distincte et nommée exprès : un article qui disparaît en silence est un défaut pire
 * que la ligne en trop qu'on raye (voir `Vue.dejaChezVous`). Non cochable : ce n'est pas une liste à
 * acheter, il n'y a rien à y cocher.
 *
 * ⚠️ ELLE PORTE LE CHEMIN POUR SE CORRIGER, et c'est la moitié qui manquait. Un garde-manger se
 * périme dans la vraie vie — on a mangé les poireaux et on ne l'a dit à personne. Nommer le retrait
 * sans offrir le moyen de le défaire laisse l'utilisateur devant un article manquant qu'il voit,
 * comprend, et ne peut pas récupérer sans deviner par quel écran passer. Le lien va vers « Vider le
 * frigo », qui est l'endroit unique où ce garde-manger se règle (`hashDuFrigo`, §4.5 DESIGN).
 */
function DejaChezVous({
  items,
  nomAliment,
  quantiteDe,
}: {
  readonly items: readonly ShoppingListItem[]
  readonly nomAliment: (id: FoodId) => string
  /** Le même formatage que la liste à acheter — voir `Vue.quantiteDe`. */
  readonly quantiteDe: (item: ShoppingListItem) => string
}) {
  return (
    <section className="mt-6">
      <h2 className="font-titre text-titre-s text-texte">Déjà chez vous ({items.length})</h2>
      <p className="mt-1 text-courant leading-relaxed text-attenue">
        Retirés de la liste parce qu'ils sont dans votre garde-manger.
      </p>
      <a
        href={hashDuFrigo()}
        className="mt-2 flex min-h-tactile items-center rounded-[0.7rem] text-courant font-semibold text-accent-texte underline"
      >
        Vous ne les avez plus ? Modifiez votre garde-manger
      </a>
      <ul className="mt-2 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
        {items.map((item) => (
          <li key={item.foodId} className="flex items-center gap-3 px-3 py-2">
            <span className="flex-1 text-lecture text-texte-doux">{nomAliment(item.foodId)}</span>
            <span className="shrink-0 text-courant tabular-nums text-attenue">
              {quantiteDe(item)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Une ligne cochable.
 *
 * ⚠️ LA LIGNE ENTIÈRE EST LA CIBLE, pas la petite case (§4.3 : « cases à cocher 48 px, ligne
 * entière cliquable »). Viser une case de 16 px est hors de portée d'une main tremblante, et c'est
 * exactement le public que le produit vise.
 *
 * ⚠️ UN ARTICLE COCHÉ RESTE À SA PLACE. Le déplacer en bas de liste ferait sauter les lignes sous
 * le doigt au moment même où l'on coche la suivante.
 */
function Ligne({
  libelle,
  quantite,
  coche,
  onBasculer,
  onSupprimer,
  marqueur,
  noteAllergene,
}: {
  readonly libelle: string
  readonly quantite: string | null
  readonly coche: boolean
  readonly onBasculer: () => void
  readonly onSupprimer?: () => void
  readonly marqueur?: boolean
  readonly noteAllergene?: string | null
}) {
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        onClick={onBasculer}
        aria-pressed={coche}
        className="flex min-h-tactile flex-1 items-center gap-3 px-3 py-2 text-left"
      >
        <span
          aria-hidden="true"
          className={
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.35rem] border-2 text-mention ' +
            (coche ? 'border-accent bg-accent text-white' : 'border-bordure-forte')
          }
        >
          {coche ? '✓' : ''}
        </span>
        <span className="flex flex-1 flex-col">
          <span className={`text-lecture ${coche ? 'text-attenue line-through' : 'text-texte'}`}>
            {/* Marqueur TYPOGRAPHIQUE et non une seconde couleur (§4.3) : la couleur est déjà prise
                par l'accent, et en ajouter une ferait un code couleur là où il n'y a pas de jugement. */}
            {marqueur && <span className="text-attenue">+ </span>}
            {libelle}
          </span>
          {/* ⚠️ Écrite seulement pour les articles choisis en complétion (voir l'en-tête du fichier) —
              texte factuel, pas une alerte : la couleur n'est pas le seul porteur de l'information,
              c'est une ligne de texte à part entière. */}
          {noteAllergene != null && (
            <span className="text-mention text-texte-doux">{noteAllergene}</span>
          )}
        </span>
        {quantite !== null && (
          <span className="shrink-0 text-courant tabular-nums text-attenue">{quantite}</span>
        )}
      </button>
      {onSupprimer !== undefined && (
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Retirer ${libelle}`}
          // Le seul bouton de la ligne qui ne s'imprime pas : celui de la case à cocher, lui, DOIT
          // s'imprimer — c'est la case qu'on coche au stylo (voir `@media print`, `theme.css`).
          className="sans-impression flex min-h-tactile w-12 items-center justify-center text-lecture text-attenue"
        >
          ×
        </button>
      )}
    </li>
  )
}

/**
 * Les articles ajoutés à la main.
 *
 * En vue Rayon ils rejoignent leur rayon de magasin ; en vues Repas et Jour ils vont EN PIED DE
 * LISTE (§4.3), parce qu'ils n'ont aucune origine repas ni jour — les ranger sous un repas
 * inventerait une provenance.
 */
function ArticlesAjoutes({
  extras,
  rangement,
  onBasculer,
  onSupprimer,
}: {
  readonly extras: readonly StoredExtraItem[]
  readonly rangement: Rangement
  readonly onBasculer: (id: number, coche: boolean) => void
  readonly onSupprimer: (id: number) => void
}) {
  const groupes =
    rangement === 'rayon'
      ? [...new Map(extras.map((e) => [e.rayon ?? 'Autres', [] as StoredExtraItem[]]))].map(([titre]) => ({
          titre,
          items: extras.filter((e) => (e.rayon ?? 'Autres') === titre),
        }))
      : [{ titre: 'Ajoutés à la main', items: [...extras] }]

  return (
    <>
      {groupes.map((groupe) => (
        <article key={groupe.titre}>
          <h2 className="font-titre text-titre-s text-texte">{groupe.titre}</h2>
          <ul className="mt-2 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
            {groupe.items.map((article) => (
              <Ligne
                key={article.id}
                libelle={article.libelle}
                quantite={article.quantite}
                coche={article.coche}
                marqueur
                noteAllergene={article.noteAllergene}
                onBasculer={() => onBasculer(article.id, !article.coche)}
                onSupprimer={() => onSupprimer(article.id)}
              />
            ))}
          </ul>
        </article>
      ))}
    </>
  )
}

function FormulaireAjout({
  foods,
  noteAllergeneDe,
  onAjouter,
  onAnnuler,
}: {
  readonly foods: ReadonlyMap<FoodId, Food>
  readonly noteAllergeneDe: (food: Food) => string | null
  readonly onAjouter: (
    libelle: string,
    rayon: string | null,
    quantite: string | null,
    noteAllergene: string | null
  ) => void
  readonly onAnnuler: () => void
}) {
  const [libelle, setLibelle] = useState('')
  const [rayon, setRayon] = useState('')
  const [quantite, setQuantite] = useState('')
  const [propositionsVisibles, setPropositionsVisibles] = useState(false)
  // ⚠️ L'ALIMENT CHOISI, PAS SEULEMENT SON NOM. C'est lui qui porte le `FoodId` fiable dont
  // `noteAllergeneDe` a besoin — retenir juste le libellé rouvrirait la porte à une correspondance
  // textuelle sur du texte libre, exactement ce que l'en-tête du fichier écarte. Remis à `null` dès
  // que le texte est retouché : un libellé modifié n'est plus garanti correspondre à l'aliment choisi.
  const [alimentChoisi, setAlimentChoisi] = useState<Food | null>(null)
  const [parcours, setParcours] = useState(false)

  // Même motif que `editeur-recette.tsx` (« Ajouter un ingrédient ») : une liste maison, pas un
  // `<datalist>`, parce qu'il faut récupérer l'ALIMENT choisi (pour en déduire le rayon), pas
  // seulement le texte de son nom.
  //
  // ⛔ ICI, UNE LISTE VIDE FAIT TAIRE LA NOTE D'ALLERGÈNE, et c'est ce qui distingue cet écran des
  // deux autres. Sans proposition, on saisit du texte libre, `alimentChoisi` reste `null`, et
  // `noteAllergeneDe` — qui exige un `Food` — n'a rien à quoi s'appliquer. Le défaut de rappel ne
  // faisait donc pas qu'agacer : il retirait une information que l'application avait. D'où
  // `chercherParNom` plutôt qu'une sous-chaîne, qui rendait vide dès que la saisie était plus longue
  // que le nom éditorial (« noix de saint-jacques » contre « Coquille Saint-Jacques », décision 58).
  const propositions = useMemo(() => {
    if (!propositionsVisibles) return []
    if (normaliser(libelle.trim()).length < 2) return []
    return chercherParNom([...foods.values()], libelle, 6)
  }, [foods, libelle, propositionsVisibles])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const propre = libelle.trim()
        const quantitePropre = quantite.trim()
        if (propre.length > 0) {
          const noteAllergene = alimentChoisi !== null ? noteAllergeneDe(alimentChoisi) : null
          onAjouter(propre, rayon === '' ? null : rayon, quantitePropre === '' ? null : quantitePropre, noteAllergene)
        }
      }}
      className="sans-impression mt-4 rounded-[--radius-carte] border border-bordure bg-surface p-4"
    >
      <label className="block">
        <span className="text-courant text-texte-doux">Article</span>
        <input
          type="text"
          value={libelle}
          onChange={(e) => {
            setLibelle(e.target.value)
            setPropositionsVisibles(true)
            setAlimentChoisi(null)
          }}
          placeholder="Lessive, pain, croquettes…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-lecture text-texte"
        />
      </label>
      {propositions.length > 0 && (
        <ul className="mt-1 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-fond">
          {propositions.map((aliment) => (
            <li key={aliment.id}>
              <button
                type="button"
                onClick={() => {
                  setLibelle(aliment.nom)
                  setRayon(rayonDe(aliment, foods))
                  setAlimentChoisi(aliment)
                  setPropositionsVisibles(false)
                }}
                className="flex min-h-tactile w-full items-center px-3 text-left text-lecture text-texte"
              >
                {aliment.nom}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* ⚠️ LE PARCOURS FAIT ICI LE MÊME GESTE QUE LA LISTE DE PROPOSITIONS, pas un autre : il
          renseigne le libellé, PRÉSÉLECTIONNE le rayon et retient l'aliment choisi. C'est ce
          dernier point qui compte — sans `alimentChoisi`, `noteAllergeneDe` n'a rien à quoi
          s'appliquer et l'écran perd une information qu'il possédait. */}
      <BoutonParcourir onOuvrir={() => setParcours(true)} />
      {parcours && (
        <ParcoursAliments
          foods={foods}
          onChoisir={(aliment) => {
            setLibelle(aliment.nom)
            setRayon(rayonDe(aliment, foods))
            setAlimentChoisi(aliment)
            setPropositionsVisibles(false)
            setParcours(false)
          }}
          onFermer={() => setParcours(false)}
        />
      )}

      <label className="mt-3 block">
        <span className="text-courant text-texte-doux">Quantité (facultatif)</span>
        <input
          type="text"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          placeholder="2 boîtes, un paquet…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-lecture text-texte"
        />
      </label>
      <label className="mt-3 block">
        {/* Présélectionné par le choix d'un aliment ci-dessus, mais toujours modifiable : « calculé
            par l'appli sauf si l'utilisateur veut rentrer dans un rayon précis ». */}
        <span className="text-courant text-texte-doux">Rayon (facultatif)</span>
        <select
          value={rayon}
          onChange={(e) => setRayon(e.target.value)}
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-lecture text-texte"
        >
          <option value="">Autres</option>
          {RAYONS_ALIMENTAIRES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          {RAYONS_EXTRA.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] bg-accent-plein px-4 text-lecture font-semibold text-white"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-lecture font-semibold text-texte-doux"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

/**
 * « Partager » (§4.3, conservé et visible).
 *
 * ⚠️ Le partage passe par l'API du SYSTÈME (`navigator.share`) : le texte va où l'utilisateur
 * décide, et l'application n'envoie rien nulle part — §6.6 tient. Repli sur le presse-papiers là
 * où l'API n'existe pas, plutôt qu'un bouton mort.
 */
function BoutonPartager({ vue, coches }: { readonly vue: Vue; readonly coches: ReadonlySet<FoodId> }) {
  const [copie, setCopie] = useState(false)

  const texte = useMemo(() => {
    const lignes = vue.liste.items
      .filter((item) => !coches.has(item.foodId))
      .map((item) => `- ${vue.nomAliment(item.foodId)} : ${vue.quantiteDe(item)}`)
    const ajouts = vue.enregistree.extras.filter((e) => !e.coche).map((e) => `- ${e.libelle}`)
    return ['Mes courses', ...lignes, ...ajouts].join('\n')
  }, [vue, coches])

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof navigator !== 'undefined' && navigator.share !== undefined) {
          void navigator.share({ title: 'Mes courses', text: texte }).catch(() => undefined)
          return
        }
        void navigator.clipboard?.writeText(texte).then(
          () => setCopie(true),
          () => undefined
        )
      }}
      className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-lecture font-semibold text-texte-doux"
    >
      {copie ? 'Copié' : 'Partager'}
    </button>
  )
}

/**
 * « Imprimer ou exporter » (§4.3).
 *
 * ⚠️ UNE FENÊTRE, PAS TROIS BOUTONS DE PLUS. La barre en portait déjà deux ; trois actions
 * secondaires supplémentaires auraient poussé « Ajouter un article » — l'action principale — sur une
 * seconde ligne, sur un téléphone. Et c'est la règle verrouillée du produit : hors accueil, ce qui
 * se choisit s'ouvre en fenêtre (`panneau.tsx`), jamais en dépliant. Le déclencheur porte donc
 * `aria-haspopup="dialog"` et jamais `aria-expanded`.
 *
 * ⚠️ RIEN NE SORT DE L'APPAREIL. `window.print` parle à l'imprimante du système, les deux exports
 * fabriquent un `Blob` en mémoire et le donnent au gestionnaire de téléchargement — §6.2 tient, il
 * n'y a pas une requête réseau dans ce composant.
 */
function BoutonImprimerExporter({ vue }: { readonly vue: Vue }) {
  const [ouvert, setOuvert] = useState(false)
  const lignes = useMemo(() => lignesExport(vue), [vue])
  const periode = plageDuPlan(vue.liste)

  const action =
    'flex min-h-cta w-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-lecture font-semibold text-texte-doux'

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOuvert(true)}
        // `basis-full` : sa propre ligne, sous la paire existante. À trois `flex-1` sur un écran de
        // 360 px, chaque libellé se casse en deux — « Ajouter un article », l'action principale,
        // finissait aussi mal lotie que la moins fréquente des trois.
        className="flex min-h-cta basis-full items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-lecture font-semibold text-texte-doux"
      >
        Imprimer ou exporter
      </button>

      {ouvert && (
        <Panneau titre="Imprimer ou exporter" onFermer={() => setOuvert(false)}>
          <p className="text-courant leading-relaxed text-texte-doux">
            La liste part sur votre imprimante ou dans un fichier, sur cet appareil. Rien n'est
            envoyé nulle part.
          </p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => {
                // ⚠️ ON FERME **ET** ON IMPRIME DANS LE MÊME GESTE, et l'ordre n'y change rien :
                // React groupe la mise à jour et ne la rend qu'après le retour du gestionnaire,
                // donc `window.print()` voit encore la fenêtre ouverte. C'est le `@media print` de
                // `theme.css` qui la masque — `[role='dialog']` y figure exactement pour ça.
                setOuvert(false)
                if (typeof window.print === 'function') window.print()
              }}
              className={action}
            >
              Imprimer
            </button>
            <button
              type="button"
              onClick={() => {
                telecharger(versCsv(lignes), FICHIER_CSV, MIME_CSV)
                setOuvert(false)
              }}
              className={action}
            >
              Exporter en CSV (tableur)
            </button>
            <button
              type="button"
              onClick={() => {
                telecharger(versJson(lignes, periode), FICHIER_JSON, MIME_JSON)
                setOuvert(false)
              }}
              className={action}
            >
              Exporter en JSON
            </button>
          </div>
          {/* Dit ce que le fichier contiendra : le compte à l'écran ne parle que du restant, celui-ci
              parle de tout, cases cochées comprises. La différence surprendrait à l'ouverture. */}
          <p className="mt-4 text-courant leading-relaxed text-attenue">
            <span className="tabular-nums">{lignes.length}</span> article
            {lignes.length > 1 ? 's' : ''}, cochés compris.
          </p>
        </Panneau>
      )}
    </>
  )
}

function plageDuPlan(liste: ShoppingList): string {
  const dates = [...new Set(liste.items.flatMap((i) => i.pourSlots.map((s) => s.date)))].sort()
  const premier = dates[0]
  const dernier = dates[dates.length - 1]
  if (premier === undefined || dernier === undefined) return 'Aucun repas planifié'
  return premier === dernier ? formaterJour(premier) : `${formaterJour(premier)} → ${formaterJour(dernier)}`
}
