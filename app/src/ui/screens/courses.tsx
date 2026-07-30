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
// PÉRIMÈTRE — ce que §4.3 décrit et qui n'est PAS ici : l'autocomplétion sur les aliments du
// catalogue (un ajout manuel est un article en texte libre, sans `FoodId`), « Que cuisiner avec ? »
// et « Vider le frigo » pré-rempli (l'écran 4.5 n'existe pas), l'impression et l'export CSV/JSON du
// menu discret, et le découpage en deux virées de courses (`joursDeCourses`, §7.4).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FoodId, ShoppingList, ShoppingListItem, SlotRef } from '../../engine/domain/index.js'
import {
  addExtraItem,
  readLatestPlan,
  readShoppingList,
  removeExtraItem,
  saveShoppingList,
  setCoche,
  setExtraCoche,
  type StoredExtraItem,
  type StoredShoppingList,
} from '../../data/user-store.js'
import { LIBELLE_CRENEAU, aujourdhuiIso, chargerSocle, cleCreneau, profilCourant } from '../socle.js'
import { hashDe } from '../router.js'

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

interface Vue {
  readonly liste: ShoppingList
  readonly enregistree: StoredShoppingList
  readonly nomAliment: (id: FoodId) => string
  readonly platDuCreneau: (slot: SlotRef) => string | null
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
  const liste = socle.moteur.buildShoppingList(plan)

  if (enregistree === null || enregistree.planId !== plan.id) {
    saveShoppingList(socle.db, liste)
    enregistree = readShoppingList(socle.db)!
  }

  const platParCreneau = new Map<string, string>()
  for (const entree of plan.entries) {
    if (entree.recipeId === null) continue
    const nom = socle.catalogue.recipes.get(entree.recipeId)?.nom
    if (nom !== undefined) platParCreneau.set(cleCreneau(entree.slot.date, entree.slot.creneau), nom)
  }

  return {
    phase: 'pret',
    vue: {
      liste,
      enregistree,
      nomAliment: (id) => socle.catalogue.foods.get(id)?.nom ?? id,
      platDuCreneau: (slot) => platParCreneau.get(cleCreneau(slot.date, slot.creneau)) ?? null,
    },
  }
}

/** Sections d'affichage, selon le rangement choisi. Un article peut apparaître dans plusieurs. */
function grouper(vue: Vue, rangement: Rangement): { titre: string; items: readonly ShoppingListItem[] }[] {
  const sections = new Map<string, ShoppingListItem[]>()
  const ajouter = (titre: string, item: ShoppingListItem) => {
    const existante = sections.get(titre)
    if (existante === undefined) sections.set(titre, [item])
    else existante.push(item)
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

  return [...sections.entries()].map(([titre, items]) => ({ titre, items }))
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
    (libelle: string, rayon: string | null) => {
      if (etat.phase !== 'pret') return
      const listId = etat.vue.enregistree.id
      chargerSocle()
        .then((socle) => {
          addExtraItem(socle.db, listId, { libelle, rayon })
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
        <h1 className="text-[2.1rem] text-texte">Mes courses</h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
          La liste se construit à partir de votre semaine.
        </p>
        <a
          href={hashDe('semaine')}
          className="mt-5 inline-flex min-h-cta items-center justify-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white no-underline"
        >
          Composer ma semaine
        </a>
      </section>
    )
  }
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">La liste n'a pas pu être construite.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
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
      <h1 className="text-[2.1rem] text-texte">Mes courses</h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-attenue">
        {plageDuPlan(vue.liste)} · {faits} sur {total} cochés
      </p>

      <fieldset className="mt-5">
        <legend className="text-[0.9rem] text-texte-doux">Ranger par</legend>
        <div className="mt-2 flex gap-2">
          {(['rayon', 'repas', 'jour'] as const).map((valeur) => (
            <button
              key={valeur}
              type="button"
              onClick={() => setRangement(valeur)}
              aria-pressed={rangement === valeur}
              className={
                'flex min-h-tactile flex-1 items-center justify-center rounded-[0.7rem] px-3 text-[0.95rem] font-semibold ' +
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAjoutOuvert((ouvert) => !ouvert)}
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] bg-accent-plein px-4 text-[1rem] font-semibold text-white"
        >
          Ajouter un article
        </button>
        <BoutonPartager vue={vue} coches={coches} />
      </div>

      {ajoutOuvert && <FormulaireAjout onAjouter={ajouter} onAnnuler={() => setAjoutOuvert(false)} />}

      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <article key={section.titre}>
            <h2 className="font-titre text-[1.25rem] text-texte">{section.titre}</h2>
            <ul className="mt-2 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
              {section.items.map((item) => (
                <Ligne
                  key={item.foodId}
                  libelle={vue.nomAliment(item.foodId)}
                  quantite={`${item.quantiteTotale} ${item.unite}`}
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
}: {
  readonly libelle: string
  readonly quantite: string | null
  readonly coche: boolean
  readonly onBasculer: () => void
  readonly onSupprimer?: () => void
  readonly marqueur?: boolean
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
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.35rem] border-2 text-[0.8rem] ' +
            (coche ? 'border-accent bg-accent text-white' : 'border-bordure-forte')
          }
        >
          {coche ? '✓' : ''}
        </span>
        <span className={`flex-1 text-[1rem] ${coche ? 'text-attenue line-through' : 'text-texte'}`}>
          {/* Marqueur TYPOGRAPHIQUE et non une seconde couleur (§4.3) : la couleur est déjà prise
              par l'accent, et en ajouter une ferait un code couleur là où il n'y a pas de jugement. */}
          {marqueur && <span className="text-attenue">+ </span>}
          {libelle}
        </span>
        {quantite !== null && (
          <span className="shrink-0 text-[0.9rem] tabular-nums text-attenue">{quantite}</span>
        )}
      </button>
      {onSupprimer !== undefined && (
        <button
          type="button"
          onClick={onSupprimer}
          aria-label={`Retirer ${libelle}`}
          className="flex min-h-tactile w-12 items-center justify-center text-[1.1rem] text-attenue"
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
          <h2 className="font-titre text-[1.25rem] text-texte">{groupe.titre}</h2>
          <ul className="mt-2 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
            {groupe.items.map((article) => (
              <Ligne
                key={article.id}
                libelle={article.libelle}
                quantite={article.quantite}
                coche={article.coche}
                marqueur
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
  onAjouter,
  onAnnuler,
}: {
  readonly onAjouter: (libelle: string, rayon: string | null) => void
  readonly onAnnuler: () => void
}) {
  const [libelle, setLibelle] = useState('')
  const [rayon, setRayon] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const propre = libelle.trim()
        if (propre.length > 0) onAjouter(propre, rayon === '' ? null : rayon)
      }}
      className="mt-4 rounded-[--radius-carte] border border-bordure bg-surface p-4"
    >
      <label className="block">
        <span className="text-[0.95rem] text-texte-doux">Article</span>
        <input
          type="text"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="Lessive, pain, croquettes…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-[1rem] text-texte"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-[0.95rem] text-texte-doux">Rayon (facultatif)</span>
        <select
          value={rayon}
          onChange={(e) => setRayon(e.target.value)}
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-[1rem] text-texte"
        >
          <option value="">Autres</option>
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
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] bg-accent-plein px-4 text-[1rem] font-semibold text-white"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-[1rem] font-semibold text-texte-doux"
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
      .map((item) => `- ${vue.nomAliment(item.foodId)} : ${item.quantiteTotale} ${item.unite}`)
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
      className="flex min-h-cta flex-1 items-center justify-center rounded-[--radius-cta] border border-bordure-forte bg-fond px-4 text-[1rem] font-semibold text-texte-doux"
    >
      {copie ? 'Copié' : 'Partager'}
    </button>
  )
}

/** « lun. 3 août ». UTC forcé : les dates du plan sont des jours, pas des instants. */
function formaterJour(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function plageDuPlan(liste: ShoppingList): string {
  const dates = [...new Set(liste.items.flatMap((i) => i.pourSlots.map((s) => s.date)))].sort()
  const premier = dates[0]
  const dernier = dates[dates.length - 1]
  if (premier === undefined || dernier === undefined) return 'Aucun repas planifié'
  return premier === dernier ? formaterJour(premier) : `${formaterJour(premier)} → ${formaterJour(dernier)}`
}
