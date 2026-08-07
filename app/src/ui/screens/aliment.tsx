// ui/screens/aliment.tsx — ce que le catalogue sait d'UN aliment (décision 33).
//
// ⚠️ CET ÉCRAN EXISTE POUR UNE RAISON PRÉCISE, et ce n'est pas « il manquait une page ». Les 3 907
// cotes de confiance ANSES étaient importées, stockées et chargées jusqu'au `Socle` — et lues par
// personne (§8 ETAT, « rempli et jamais lu »). Elles ne discriminent qu'au niveau de l'ALIMENT :
// la fiche recette n'affiche que l'ÉNERGIE, cotée D sur 434 aliments sur 449 PAR CONSTRUCTION
// (« Energie, Règlement UE N° 1169/2011 » est calculée depuis les macros, jamais dosée). Une
// mention de provenance constante sur 97 % du catalogue serait du bruit, pas de la traçabilité.
//
// ⚠️ LES VALEURS POUR 100 g SONT DERRIÈRE « Afficher plus de détails ». §6.5 ARCHITECTURE est
// catégorique : « UN SEUL INTERRUPTEUR, ET IL LE RESTE — tout ce qui relève du mode avancé passe
// par `afficher_macros` ». Ne pas ajouter ici un second réglage « mais celui-ci est de la
// traçabilité, pas des macros » : c'est exactement le raisonnement que ce paragraphe interdit.
//
// ⚠️ AUCUN POURCENTAGE D'APPORT DE RÉFÉRENCE, VOLONTAIREMENT ABSENT. §6.5 l'autorise (« apport de
// référence cité en note ») et `Nutrient.vnrAdulte` est rempli — mais un « 45 % » à côté de chaque
// ligne se lit comme une jauge à remplir, et la jauge est le mécanisme même que ce paragraphe
// proscrit. La valeur brute et sa provenance suffisent à l'objet de cet écran.
//
// ⛔ NE JAMAIS transformer une cote en couleur, en tri ou en note sur 100. La cote reste affichée
// TELLE QUE L'ANSES LA PUBLIE — une lettre — avec sa définition citée juste en dessous.
//
// ⚠️ CE QUE LA COTE SIGNIFIE A ÉTÉ CORRIGÉ LE 2026-08-07, APRÈS LECTURE DE LA SOURCE, et il faut le
// savoir avant de toucher à ce fichier. La décision 33 et l'en-tête de
// `catalog/sources/ciqual-confiance.yaml` affirmaient qu'une cote C ou D « ne veut PAS dire
// douteuse » mais « calculée plutôt que dosée ». **C'est faux, et ce n'était sourcé nulle part.**
// La documentation officielle de l'export réellement importé dit, mot pour mot : « code de
// confiance, qui indique la FIABILITÉ de la teneur moyenne (de A=très fiable à D=moins fiable) ».
// L'observation du dépôt — les valeurs C/D viennent surtout de l'USDA (451) et d'un calcul interne
// Ciqual (368) — reste vraie, mais elle décrit d'où viennent ces valeurs, pas ce que le code veut
// dire. **Ne pas réintroduire de libellé « provenance » par lettre : B et C ne sont définies nulle
// part par l'ANSES, les habiller de mots serait inventer une source.**

import { useCallback, useEffect, useState } from 'react'
import type {
  AnimalOrigin,
  Catalog,
  Food,
  FoodId,
  Nutrient,
  NutrientId,
  Recipe,
  RecipeId,
} from '../../engine/domain/index.js'
import { resolveAnimalOrigin } from '../../engine/domain/index.js'
import type { CoteConfiance } from '../../data/catalog-loader.js'
import { readDisplay } from '../../data/user-store.js'
import { chargerSocle } from '../socle.js'
import { hashDe, hashDeRecette, hashDuFrigo, routeDepuisHash, type Onglet } from '../router.js'
import { texteSaison } from '../saison.js'

/**
 * La définition du code de confiance, CITÉE VERBATIM.
 *
 * ⛔ NE PAS LA REFORMULER, ET SURTOUT NE PAS INVENTER UN LIBELLÉ PAR LETTRE. Une première version
 * de cet écran affichait « valeur dosée » / « valeur calculée ou imputée » — quatre phrases
 * **fabriquées**, jamais lues nulle part. L'ANSES ne définit QUE les deux bornes, et elle les
 * définit en termes de FIABILITÉ, pas de provenance. B et C ne sont détaillées nulle part dans la
 * documentation officielle : les habiller de mots serait inventer une source.
 *
 * Source ouverte et lue le 2026-08-07 : ANSES, *Table de composition nutritionnelle des aliments
 * Ciqual 2025 — Documentation* (19/11/2025), tableau 6, description de `code_confiance`.
 * https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025%20doc%20FR_2025_11_19.pdf
 * C'est la documentation de l'export réellement importé — `catalog/import-ciqual.mjs` lit
 * `documents Ciqual/2025_11_03`, soit les fichiers `compo_2025_11_03.xml` que décrit ce tableau.
 */
const DEFINITION_CONFIANCE =
  'code de confiance, qui indique la fiabilité de la teneur moyenne (de A=très fiable à D=moins fiable)'

/**
 * ⚠️ CE QUE LA COTE QUALIFIE : LE CHIFFRE, PAS L'ALIMENT. C'est la seule chose qui sépare cet
 * affichage du jugement interdit par le principe 6. « Moins fiable » ne dit rien de la carotte,
 * il dit que la teneur publiée repose sur des données moins solides. La phrase doit rester
 * explicite — sans elle, une colonne de A et de D se lit comme une note attribuée aux aliments.
 */
const NOTE_CONFIANCE =
  'Chaque teneur porte le code de confiance de la table Ciqual (ANSES), « ' +
  DEFINITION_CONFIANCE +
  ' ». Il qualifie la donnée publiée, pas l’aliment.'

/**
 * ⚠️ POURQUOI L'ÉNERGIE EST PRESQUE TOUJOURS COTÉE D — mesuré : 434 aliments sur 449. Ce n'est pas
 * un défaut d'import, c'est la méthode : l'énergie n'est pas dosée, elle est CALCULÉE depuis les
 * autres teneurs selon le règlement UE n° 1169/2011 (même documentation ANSES, §3.3). Le dire
 * transforme une mention constante — donc du bruit — en explication.
 */
const NOTE_ENERGIE =
  'L’énergie n’est jamais dosée : elle est calculée à partir des autres teneurs, selon le ' +
  'règlement UE n° 1169/2011. C’est pourquoi elle porte presque toujours la cote D.'

/** Retour vers l'onglet correspondant, quand on ne vient pas d'une recette précise. */
const LIBELLE_ONGLET: Readonly<Record<Onglet, string>> = {
  aujourdhui: "← Aujourd'hui",
  semaine: '← Cette semaine',
  courses: '← Ma liste de courses',
  recettes: '← Toutes les recettes',
  savoir: '← Savoir',
}

const LIBELLE_ORIGINE: Readonly<Record<AnimalOrigin, string>> = {
  mammifere: "d'un mammifère",
  volaille: "d'une volaille",
  poisson: "d'un poisson",
  fruit_de_mer: "d'un fruit de mer",
  insecte: "d'un insecte",
}

/** Au-delà, la liste des recettes cesse d'informer et devient un mur — `sel_fin` en compte 163. */
const RECETTES_LISTEES = 12

interface LigneNutriment {
  readonly nom: string
  readonly texte: string
  /** `null` = le catalogue ne porte aucune cote pour ce couple aliment × nutriment. */
  readonly cote: CoteConfiance | null
}

interface Vue {
  readonly aliment: Food
  readonly saison: string | null
  readonly allergenes: readonly { readonly nom: string; readonly certitude: string }[]
  readonly origine: AnimalOrigin | null
  /** Nom de l'aliment d'où l'origine animale a été héritée — `null` quand elle est déclarée ici. */
  readonly origineHeriteeDe: string | null
  readonly nutriments: readonly LigneNutriment[]
  readonly afficherMacros: boolean
  readonly recettes: readonly { readonly id: RecipeId; readonly nom: string }[]
  readonly recettesEnTrop: number
  readonly retour: { readonly hash: string; readonly libelle: string }
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'introuvable' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

/**
 * Nombre → texte français pour une TENEUR.
 *
 * ⚠️ PAS `formaterNombre` DE `quantites.ts` : celui-là rend les fractions courantes en caractères
 * (« ½ »), ce qui est juste pour « ½ oignon » et absurde pour « ½ g de lipides ». Deux décimales au
 * plus, parce que Ciqual en donne parfois cinq et qu'un dixième de milligramme n'aide personne.
 */
function formaterTeneur(valeur: number): string {
  const arrondi = Math.round(valeur * 100) / 100
  return Number.isInteger(arrondi) ? String(arrondi) : String(arrondi).replace('.', ',')
}

/**
 * Les teneurs pour 100 g, dans l'ordre du catalogue, avec leur cote de confiance.
 *
 * ⚠️ L'ÉNERGIE N'EST PLUS L'EXCEPTION — c'était le cas jusqu'au 2026-08-07, au motif qu'une cote
 * constante sur 97 % du catalogue est du bruit. Le motif tombe avec la lecture de la source : la
 * cote annonce une FIABILITÉ, et masquer « moins fiable » sur un chiffre revient à décider que
 * l'utilisateur n'a pas à le savoir. `NOTE_ENERGIE` explique la constance au lieu de la cacher.
 */
function lignesNutriments(
  aliment: Food,
  nutriments: readonly Nutrient[],
  cotes: ReadonlyMap<NutrientId, CoteConfiance> | undefined
): readonly LigneNutriment[] {
  const lignes: LigneNutriment[] = []
  for (const nutriment of nutriments) {
    const valeur = aliment.nutrimentsPour100g.get(nutriment.id)
    if (valeur === undefined) continue
    lignes.push({
      nom: nutriment.nom,
      texte: `${formaterTeneur(valeur)} ${nutriment.unite}`,
      cote: cotes?.get(nutriment.id) ?? null,
    })
  }
  return lignes
}

/**
 * Le lien « ← » du haut, dérivé du hash d'où l'on vient.
 *
 * ⚠️ LE LIBELLÉ NE DOIT JAMAIS MENTIR. Un retour inconnu (`''` — lien collé, signet) ramène à
 * l'accueil en le disant, plutôt que d'annoncer « ← Toutes les recettes » à quelqu'un qui n'en
 * vient pas. Le hash est déjà validé par le routeur (`retourDepuisRequete`) : il commence par `#/`.
 */
function retourLisible(retour: string, catalogue: Catalog): { hash: string; libelle: string } {
  if (retour === '') return { hash: hashDe('aujourdhui'), libelle: "← Aujourd'hui" }
  const route = routeDepuisHash(retour)
  if (route.sousVue.type === 'recette') {
    const nom = catalogue.recipes.get(route.sousVue.id as RecipeId)?.nom
    return { hash: retour, libelle: nom === undefined ? '← La recette' : `← ${nom}` }
  }
  if (route.sousVue.type === 'frigo') return { hash: hashDuFrigo(), libelle: '← Vider le frigo' }
  return { hash: retour, libelle: LIBELLE_ONGLET[route.onglet] }
}

/**
 * Les recettes qui emploient cet aliment.
 *
 * Balayage linéaire du catalogue plutôt qu'un index : il n'existe pas de `recipesByFood` (§ index
 * ENGINE), et 282 recettes × ~8 ingrédients se parcourent une fois à l'ouverture de l'écran. En
 * créer un obligerait à le maintenir pour un seul appelant.
 */
function recettesAvec(foodId: FoodId, recipes: ReadonlyMap<RecipeId, Recipe>) {
  const trouvees: { readonly id: RecipeId; readonly nom: string }[] = []
  for (const recette of recipes.values()) {
    if (recette.ingredients.some((i) => i.foodId === foodId)) {
      trouvees.push({ id: recette.id, nom: recette.nom })
    }
  }
  trouvees.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  return trouvees
}

export function Aliment({
  alimentId,
  retour,
}: {
  readonly alimentId: string
  readonly retour: string
}) {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

  const charger = useCallback(() => {
    chargerSocle()
      .then((socle) => {
        const id = alimentId as FoodId
        const aliment = socle.catalogue.foods.get(id)
        if (aliment === undefined) {
          setEtat({ phase: 'introuvable' })
          return
        }
        // ⚠️ `resolveAnimalOrigin`, jamais `aliment.origineAnimale` seul : le beurre porte `null` et
        // vient pourtant d'un mammifère, par la chaîne `deriveDe`.
        const origine = resolveAnimalOrigin(aliment, socle.catalogue.foods)
        const trouvees = recettesAvec(id, socle.catalogue.recipes)
        setEtat({
          phase: 'pret',
          vue: {
            aliment,
            saison: texteSaison(aliment.saisonMois),
            allergenes: aliment.allergenes.map((a) => ({
              nom: socle.catalogue.allergens.get(a.allergenId)?.nom ?? a.allergenId,
              certitude: a.certitude === 'traces' ? 'traces éventuelles' : 'en contient',
            })),
            origine,
            origineHeriteeDe:
              origine !== null && aliment.origineAnimale === null && aliment.deriveDe !== null
                ? (socle.catalogue.foods.get(aliment.deriveDe)?.nom ?? null)
                : null,
            nutriments: lignesNutriments(
              aliment,
              socle.catalogue.nutrients,
              socle.confiance.get(id)
            ),
            afficherMacros: readDisplay(socle.db).afficherMacros,
            recettes: trouvees.slice(0, RECETTES_LISTEES),
            recettesEnTrop: Math.max(0, trouvees.length - RECETTES_LISTEES),
            retour: retourLisible(retour, socle.catalogue),
          },
        })
      })
      .catch((erreur: unknown) => {
        setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
      })
  }, [alimentId, retour])

  useEffect(charger, [charger])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'introuvable') {
    return (
      <section>
        <h1 className="text-[1.9rem] text-texte">Aliment introuvable</h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
          Il a peut-être disparu d'une mise à jour du catalogue.
        </p>
        <a
          href={hashDe('recettes')}
          className="mt-5 inline-flex min-h-cta items-center rounded-[--radius-cta] bg-accent-plein px-5 text-[1rem] font-semibold text-white no-underline"
        >
          Voir toutes les recettes
        </a>
      </section>
    )
  }
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">L'aliment n'a pas pu être lu.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat
  const { aliment } = vue

  return (
    <article>
      <a
        href={vue.retour.hash}
        className="inline-flex min-h-tactile items-center text-[0.95rem] font-semibold text-accent-texte no-underline"
      >
        {vue.retour.libelle}
      </a>

      <h1 className="mt-2 text-[2.2rem] leading-tight text-texte">{aliment.nom}</h1>
      <p className="mt-1 text-[1.02rem] text-texte-doux">{aliment.groupe}</p>
      {/* Les synonymes sont des noms d'USAGE — « lardon », « gambas ». Les dire évite de croire que
          l'aliment cherché manque au catalogue parce qu'il y porte un autre nom. */}
      {aliment.synonymes.length > 0 && (
        <p className="mt-1 text-[0.95rem] text-attenue">
          Aussi appelé : {aliment.synonymes.join(', ')}
        </p>
      )}

      <dl className="mt-6 space-y-3">
        {vue.saison !== null && <Fait terme="Pleine saison" valeur={vue.saison} />}
        {aliment.touteAnnee && (
          <Fait
            terme="Disponibilité"
            valeur="toute l'année (rayon ou conservation longue)"
          />
        )}
        <Fait
          terme="Origine"
          valeur={
            vue.origine === null
              ? 'végétale ou minérale'
              : `${LIBELLE_ORIGINE[vue.origine]}${vue.origineHeriteeDe !== null ? ` (dérivé de : ${vue.origineHeriteeDe})` : ''}`
          }
        />
        {/* Les allergènes se disent en toutes lettres, jamais par un pictogramme seul : le bloc
            commun des maquettes impose qu'une icône soit toujours accompagnée de son libellé. */}
        <Fait
          terme="Allergènes"
          valeur={
            vue.allergenes.length === 0
              ? 'aucun des quatorze allergènes réglementaires déclaré'
              : vue.allergenes.map((a) => `${a.nom} (${a.certitude})`).join(' · ')
          }
        />
        {aliment.poidsPieceG !== null && (
          <Fait terme="Une pièce" valeur={`environ ${formaterTeneur(aliment.poidsPieceG)} g`} />
        )}
        {aliment.conditionnementG !== null && (
          <Fait
            terme="Conditionnement courant"
            valeur={`${formaterTeneur(aliment.conditionnementG)} g`}
          />
        )}
        {aliment.fondDePlacard && (
          <Fait
            terme="Fond de placard"
            valeur="écarté de la liste de courses par défaut — on ne le rachète pas chaque semaine"
          />
        )}
      </dl>

      <h2 className="mt-8 text-[1.5rem] text-texte">Pour 100 g</h2>
      {!vue.afficherMacros ? (
        <p className="mt-2 text-[1rem] leading-relaxed text-texte-doux">
          Les teneurs et leur provenance s'affichent si vous cochez « Afficher plus de détails »
          dans les Paramètres.
        </p>
      ) : vue.nutriments.length === 0 ? (
        <p className="mt-2 text-[1rem] leading-relaxed text-texte-doux">
          Le catalogue ne porte aucune teneur pour cet aliment.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-bordure border-y border-bordure">
            {vue.nutriments.map((ligne) => (
              <li
                key={ligne.nom}
                className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
              >
                <span className="text-[1.05rem] text-texte">{ligne.nom}</span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums text-[1.05rem] text-texte">{ligne.texte}</span>
                  {/* La LETTRE seule, jamais habillée d'une phrase : l'ANSES ne définit que les
                      deux bornes de son échelle, et elle les donne dans la note ci-dessous. */}
                  {ligne.cote !== null && (
                    <span className="text-[0.85rem] text-attenue">· confiance {ligne.cote}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-attenue">{NOTE_CONFIANCE}</p>
          <p className="mt-2 text-[0.9rem] leading-relaxed text-attenue">{NOTE_ENERGIE}</p>
        </>
      )}

      {vue.recettes.length > 0 && (
        <>
          <h2 className="mt-8 text-[1.5rem] text-texte">Où il sert</h2>
          <ul className="mt-3 space-y-1">
            {vue.recettes.map((recette) => (
              <li key={recette.id}>
                <a
                  href={hashDeRecette(recette.id)}
                  className="inline-flex min-h-tactile items-center text-[1.05rem] text-accent-texte no-underline"
                >
                  {recette.nom}
                </a>
              </li>
            ))}
          </ul>
          {vue.recettesEnTrop > 0 && (
            <p className="mt-2 text-[0.95rem] text-attenue">
              et {vue.recettesEnTrop} autre{vue.recettesEnTrop > 1 ? 's' : ''} recette
              {vue.recettesEnTrop > 1 ? 's' : ''}.
            </p>
          )}
        </>
      )}
    </article>
  )
}

/** Un fait du catalogue, en `<dt>`/`<dd>` : c'est une liste de définitions, pas un tableau. */
function Fait({ terme, valeur }: { readonly terme: string; readonly valeur: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <dt className="text-[0.95rem] font-semibold text-texte-doux">{terme}</dt>
      <dd className="text-[1.02rem] text-texte">{valeur}</dd>
    </div>
  )
}
