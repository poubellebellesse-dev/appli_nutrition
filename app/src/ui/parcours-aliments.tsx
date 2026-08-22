// ui/parcours-aliments.tsx — parcourir TOUT le catalogue d'aliments, sans rien avoir à taper.
//
// ⚠️ CE FICHIER EXISTE PARCE QUE 352 ALIMENTS SUR 450 ÉTAIENT INJOIGNABLES (mesuré le 2026-08-05,
// décision 58). Le seul pont entre le mot de l'utilisateur et le catalogue était `chercherParNom` :
// six résultats, et seulement pour qui savait déjà comment l'aliment s'appelle. L'« Ajout rapide »
// de l'écran Frigo n'y changeait rien — il écarte tout aliment qu'aucune recette n'utilise (250 à
// lui seul) puis coupe à huit par famille, soit 98 atteignables. Et les 250 écartés sont les plus
// RÉCENTS, donc les moins connus, donc précisément ceux qu'on cherche sans savoir les nommer :
// `coppa`, `harissa` et `saucisse_toulouse` en font partie.
//
// ⚠️ CE COMPOSANT NE PROPOSE JAMAIS « L'ALIMENT LE PLUS PROCHE », ET C'EST UNE RÈGLE DE SÉCURITÉ.
// Laisser choisir un cousin quand le bon manque revient à la piste (b) de la décision 58 : quelqu'un
// qui a de la nduja et coche « chorizo » se voit appliquer LES ALLERGÈNES DU CHORIZO. Le problème
// n'est pas qu'il approxime — c'est qu'une fois écrit, `user_pantry.food_id` ne garde aucune trace
// de l'à-peu-près, et le garde-fou §5.2 ne peut plus faire la différence. Quand l'aliment n'y est
// pas, on le DIT.
//
// ⚠️ LES FAMILLES SONT DÉRIVÉES DU CATALOGUE, jamais écrites à la main — même raison que
// `valeursDeFacette` : une liste codée en dur survit à la disparition de son contenu et rend une
// section vide sans que rien n'explique pourquoi.

import { useMemo, useState } from 'react'
import type { Food, FoodId } from '../engine/domain/index.js'
import { Panneau } from './panneau.js'

/** Tout ce dont ce composant a besoin. Prendre un `Catalog` entier le coupleraient aux recettes,
 *  aux fiches et au reste, alors qu'il ne lit que des noms et des groupes — et `courses.tsx` ne
 *  dispose de toute façon que de cette Map. */
type Aliments = ReadonlyMap<FoodId, Food>

export interface Famille {
  readonly groupe: string
  readonly aliments: readonly Food[]
}

/**
 * Les familles du catalogue, la plus fournie d'abord, chacune triée par NOM.
 *
 * ⛔ EXPORTÉE, ET C'EST TOUT CE QUI DEVAIT ARRIVER (lot `retour-2`). Le panneau « Aliments que je
 * ne veux pas » avait besoin du même regroupement ; en réécrire un second aurait mis deux
 * découpages du catalogue dans la même application, qui divergent au premier aliment ajouté.
 * Ce composant reste le seul appelant du `Panneau` — c'est la FONCTION qui se partage, pas l'écran.
 *
 * ⚠️ ALPHABÉTIQUE À L'INTÉRIEUR, PAS PAR FRÉQUENCE. On parcourt en balayant des yeux : un ordre de
 * popularité oblige à lire toute la liste pour savoir qu'un nom n'y est pas. L'ordre de fréquence
 * sert le raccourci (« Ajout rapide »), pas la recherche exhaustive — les deux gestes coexistent.
 *
 * `localeCompare('fr')` et pas `<` : sans lui « Œuf » et « Épinard » partent en fin de liste.
 */
export function famillesDuCatalogue(foods: Aliments, deja: readonly string[]): readonly Famille[] {
  const parGroupe = new Map<string, Food[]>()
  for (const aliment of foods.values()) {
    if (deja.includes(aliment.id)) continue
    const liste = parGroupe.get(aliment.groupe)
    if (liste === undefined) parGroupe.set(aliment.groupe, [aliment])
    else liste.push(aliment)
  }

  return [...parGroupe.entries()]
    .map(([groupe, aliments]) => ({
      groupe,
      aliments: [...aliments].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    }))
    .sort((a, b) => b.aliments.length - a.aliments.length || a.groupe.localeCompare(b.groupe, 'fr'))
}

/**
 * La fenêtre « Tous les aliments ».
 *
 * @param deja     aliments déjà retenus par l'appelant, retirés des listes. Vide par défaut : sur
 *                 l'écran Courses, le même aliment peut légitimement revenir deux fois.
 * @param onChoisir reçoit l'ALIMENT entier, pas son id — `courses.tsx` en déduit le rayon et la note
 *                 d'allergène, ce qu'un identifiant seul ne permettrait pas.
 */
export function ParcoursAliments({
  foods,
  deja = [],
  onChoisir,
  onFermer,
}: {
  readonly foods: Aliments
  /** `string` et non `FoodId` : l'éditeur de recette manipule des ids non marqués, et ce composant
   *  ne fait qu'un `includes` — exiger la marque forcerait un cast chez l'appelant, ce qui ne
   *  prouverait rien de plus et masquerait une vraie erreur le jour où il s'en glisse une. */
  readonly deja?: readonly string[]
  readonly onChoisir: (aliment: Food) => void
  readonly onFermer: () => void
}) {
  const familles = useMemo(() => famillesDuCatalogue(foods, deja), [foods, deja])
  const [ouverte, setOuverte] = useState(0)
  const famille = familles[ouverte] ?? familles[0]

  return (
    <Panneau titre="Tous les aliments" onFermer={onFermer}>
      {/* Défilement horizontal, même choix que l'« Ajout rapide » : quatorze familles ne tiennent
          pas sur la largeur d'un téléphone, et les replier derrière un menu contredirait la règle
          « plus aucun menu déroulant hors de l'accueil ». */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {familles.map((f, index) => (
          <button
            key={f.groupe}
            type="button"
            onClick={() => setOuverte(index)}
            aria-pressed={f.groupe === famille?.groupe}
            className={
              'flex min-h-tactile shrink-0 items-center gap-1.5 rounded-[0.7rem] px-3 text-courant font-semibold ' +
              (f.groupe === famille?.groupe
                ? 'border-2 border-accent bg-accent-doux text-accent-texte'
                : 'border border-bordure-forte bg-surface text-texte-doux')
            }
          >
            {f.groupe}
            {/* Le compte annonce la longueur AVANT d'ouvrir : « condiments 58 » prévient qu'il
                faudra faire défiler, « œufs 4 » qu'un coup d'œil suffit. */}
            <span className="text-mention font-normal text-attenue">{f.aliments.length}</span>
          </button>
        ))}
      </div>

      {famille === undefined ? (
        <p className="mt-4 text-lecture leading-relaxed text-attenue">
          Vous avez déjà retenu tous les aliments du catalogue.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-bordure rounded-[--radius-carte] border border-bordure bg-surface">
          {famille.aliments.map((aliment) => (
            <li key={aliment.id}>
              <button
                type="button"
                onClick={() => onChoisir(aliment)}
                className="flex min-h-tactile w-full items-center px-4 text-left text-lecture leading-snug text-texte"
              >
                {aliment.nom}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ CETTE NOTE N'EST PAS UN ORNEMENT — c'est la seule réponse honnête à la cause (3) de la
          décision 58. Sans elle, quelqu'un qui ne trouve pas son aliment cherchera de lui-même « le
          plus proche », et personne ne lui aura dit ce que ça coûte. */}
      <p className="mt-6 text-courant leading-relaxed text-attenue">
        Votre aliment n'y est pas ? Nous ne l'avons pas encore. Ne prenez pas un aliment voisin à sa
        place : l'application lui appliquerait les allergènes et les valeurs de celui que vous avez
        coché, pas les siens.
      </p>
    </Panneau>
  )
}

/**
 * Le déclencheur, pour que les trois écrans ouvrent la fenêtre de la même façon.
 *
 * ⚠️ `aria-haspopup="dialog"`, JAMAIS `aria-expanded` : le bouton n'est pas un dépliant, il ouvre
 * une fenêtre. Les tests lisent la présence du dialogue, pas un attribut porté par le bouton.
 */
export function BoutonParcourir({ onOuvrir }: { readonly onOuvrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-haspopup="dialog"
      data-visite="parcourir-aliments"
      className="mt-2 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-courant font-semibold text-texte-doux"
    >
      Parcourir tous les aliments
    </button>
  )
}
