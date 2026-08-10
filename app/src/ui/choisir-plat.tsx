// ui/choisir-plat.tsx — la fenêtre « poser soi-même un plat sur un créneau » (ETAT §4, décision 49).
//
// ⚠️ CE QUE CET ÉCRAN CORRIGE, ET C'EST D'ABORD UN MENSONGE. Sur un créneau vide, le bouton
// s'intitulait « Choisir » et appelait `rerollSlot` — un TIRAGE. Le libellé promettait un choix et
// rendait un hasard. C'est la classe de défaut que ce projet rencontre en boucle sous d'autres
// formes (`note_allergene`, filtre d'allergènes sur liste vide, `Recipe.service` déclaré mais jamais
// lu) : l'écart entre ce qui est ANNONCÉ et ce qui est BRANCHÉ.
//
// ⚠️ TROIS SOURCES, UN SEUL GESTE. Les deux demandes du lot du 2026-08-01 — « rajouter en manuel la
// recette directement » et « faire une recette avec les restes du frigo directement » — sont le même
// geste : remplir CE créneau, depuis deux points de départ. Deux boutons séparés auraient fait deux
// fonctionnalités là où il y en a une. Le plat PRÉPARÉ (décision 51, 2026-08-05) est le troisième
// point de départ du même geste, et il entre ici pour la même raison : « j'ai un dîner prévu et ce
// n'est pas une recette » est une façon de remplir un créneau, pas une fonctionnalité à part.
//
// ⚠️ CE TROISIÈME ONGLET NE DEMANDE NI CALORIES NI QUANTITÉ, et c'est l'arbitrage de la décision 51,
// pas un manque. Un champ « combien de kcal ? » ferait entrer dans l'application un nombre sans
// provenance, mélangé aux valeurs CIQUAL dans les mêmes totaux (principe 3) ; un champ « quantité
// mangée » est nommément interdit par §6.5 ARCHITECTURE. Le créneau sort du calcul, il n'y entre
// pas approximativement.
//
// ⚠️ LES GARDE-FOUS NE SAUTENT PAS PARCE QUE LE GESTE EST MANUEL. Les deux sources passent par le
// moteur — `browseRecipes` et `searchByPantry` appliquent les MÊMES couches d'exclusion que la
// suggestion : un allergène déclaré n'apparaît pas ici non plus. Et `setSlotRecipe` fait repasser
// `checkCalorieFloor` sur le plan entier. Aucun chemin manuel ne contourne §6.5 ni §5.2.
//
// ⚠️ AUCUN CLASSEMENT PAR GOÛT dans l'onglet catalogue, et c'est `browseRecipes` qui le garantit :
// quand on cherche un plat précis, le voir passer derrière trois autres « mieux notés » est
// déroutant. L'onglet frigo, lui, classe par COUVERTURE — ce n'est pas un goût, c'est un fait sur
// ce qu'on a chez soi.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FoodId, HardConstraints, RecipeId } from '../engine/domain/index.js'
import { readPantryEntries, readUserState, type StoredPantryEntry } from '../data/user-store.js'
import { Panneau } from './panneau.js'
import { ConfirmerFrigo, alimentsAConfirmer } from './confirmer-frigo.js'
import { FENETRE_HISTORIQUE_JOURS, aujourdhuiIso, type Socle } from './socle.js'

/** Combien de résultats on montre. Au-delà, on demande de préciser plutôt que de dérouler 200 lignes. */
const MAX_RESULTATS = 40

type Onglet = 'catalogue' | 'frigo' | 'prepare'

interface Ligne {
  readonly recipeId: RecipeId
  readonly nom: string
  /** Onglet frigo uniquement : ce qu'il manque pour la réaliser. Vide = réalisable maintenant. */
  readonly manquants: readonly string[]
  /** Onglet frigo uniquement : part de la masse déjà disponible, 0 à 1. */
  readonly couverture: number | null
}

export function ChoisirPlat({
  socle,
  libelleCreneau,
  onPoser,
  onPoserHorsCatalogue,
  onFermer,
}: {
  readonly socle: Socle
  /** « lundi · Déjeuner » — le titre doit dire OÙ le plat va se poser, sinon le geste est aveugle. */
  readonly libelleCreneau: string
  readonly onPoser: (recipeId: RecipeId) => void
  /** Décision 51 : un plat que l'application ne sait pas mesurer, désigné par son seul libellé. */
  readonly onPoserHorsCatalogue: (libelle: string) => void
  readonly onFermer: () => void
}) {
  const [onglet, setOnglet] = useState<Onglet>('catalogue')
  const [texte, setTexte] = useState('')
  const [entrees, setEntrees] = useState<readonly StoredPantryEntry[]>([])
  const garde = useMemo(() => entrees.map((e) => e.foodId), [entrees])
  /** Passe à vrai dès que l'utilisateur a répondu — la question ne se repose pas dans la session. */
  const [frigoConfirme, setFrigoConfirme] = useState(false)
  const [contraintes, setContraintes] = useState<HardConstraints | null>(null)

  // Lus UNE fois à l'ouverture. Cette fenêtre ne modifie NI le garde-manger NI les contraintes,
  // elle s'en sert : « vider le frigo » reste l'écran Frigo et les allergies restent les Réglages.
  // Dupliquer une saisie ici ferait deux endroits où déclarer la même chose, donc deux vérités.
  //
  // ⚠️ LES CONTRAINTES SONT RELUES, PAS HÉRITÉES DE L'ÉCRAN. Une allergie cochée pendant que la
  // semaine était affichée doit s'appliquer ICI — c'est le seul endroit du produit où l'utilisateur
  // désigne un plat à la main, donc le seul où un filtre périmé se traduirait par une assiette
  // dangereuse posée de sa propre main.
  useEffect(() => {
    setEntrees(readPantryEntries(socle.db))
    setContraintes(
      readUserState(socle.db, { windowDays: FENETRE_HISTORIQUE_JOURS, today: aujourdhuiIso() }).constraints
    )
  }, [socle])

  const lignes = useMemo((): readonly Ligne[] => {
    if (contraintes === null) return [] // pas encore lues : ne RIEN proposer plutôt que du non filtré
    if (onglet === 'prepare') return [] // rien à proposer : l'utilisateur a déjà son plat
    const nomDe = (id: RecipeId): string => socle.catalogue.recipes.get(id)?.nom ?? id

    if (onglet === 'frigo') {
      // Tant que la confirmation n'a pas été donnée, on ne propose RIEN : une recette fondée sur un
      // garde-manger périmé est plus nuisible que pas de recette du tout.
      if (garde.length === 0 || alimentsAConfirmer(entrees, aujourdhuiIso()).length > 0) {
        if (!frigoConfirme) return []
      }
      const res = socle.moteur.searchByPantry({ constraints: contraintes, pantryFoodIds: garde })
      return res.matches.slice(0, MAX_RESULTATS).map((m) => ({
        recipeId: m.recipeId,
        nom: nomDe(m.recipeId),
        manquants: m.manquants.map((f) => socle.catalogue.foods.get(f)?.nom ?? f),
        couverture: m.couverture,
      }))
    }

    const res = socle.moteur.browseRecipes({
      constraints: contraintes,
      ...(texte.trim() === '' ? {} : { texte: texte.trim() }),
    })
    return res.recipeIds.slice(0, MAX_RESULTATS).map((id) => ({
      recipeId: id,
      nom: nomDe(id),
      manquants: [],
      couverture: null,
    }))
  }, [socle, onglet, texte, garde, entrees, contraintes, frigoConfirme])

  const poser = useCallback((recipeId: RecipeId) => onPoser(recipeId), [onPoser])

  /** Onglet « plat préparé » : le libellé libre, seule chose que l'application saura de ce repas. */
  const [libellePrepare, setLibellePrepare] = useState('')

  /** Le garde-manger a vieilli et l'utilisateur n'a pas encore répondu — voir `confirmer-frigo.tsx`. */
  const aConfirmer =
    onglet === 'frigo' && !frigoConfirme && alimentsAConfirmer(entrees, aujourdhuiIso()).length > 0

  return (
    <Panneau titre={`Choisir un plat — ${libelleCreneau}`} onFermer={onFermer}>
      {/* Les trois sources. `role="tablist"` plutôt que des boutons libres : un lecteur d'écran doit
          entendre qu'il s'agit d'un choix EXCLUSIF entre plusieurs vues du même geste. */}
      <div role="tablist" aria-label="D’où partir" className="flex flex-wrap gap-2">
        <OngletBouton actif={onglet === 'catalogue'} onClick={() => setOnglet('catalogue')}>
          Chercher une recette
        </OngletBouton>
        <OngletBouton actif={onglet === 'frigo'} onClick={() => setOnglet('frigo')}>
          Avec ce que j’ai
        </OngletBouton>
        <OngletBouton actif={onglet === 'prepare'} onClick={() => setOnglet('prepare')}>
          Un plat préparé
        </OngletBouton>
      </div>

      {onglet === 'prepare' ? (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            const propre = libellePrepare.trim()
            if (propre !== '') onPoserHorsCatalogue(propre)
          }}
        >
          <label className="block">
            <span className="text-courant text-texte-doux">
              Ce que vous mangez — « Lasagnes surgelées », « Restaurant italien », « Chez mes parents »
            </span>
            <input
              type="text"
              value={libellePrepare}
              onChange={(e) => setLibellePrepare(e.target.value)}
              className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-lecture text-texte"
            />
          </label>

          {/* ⚠️ DIT AVANT LE GESTE, pas découvert après. Poser ce plat éteint l'avertissement de
              plancher calorique sur toute la journée — une conséquence de sécurité qu'on ne peut pas
              laisser l'utilisateur constater lui-même. Énoncé comme un fait sur ce que
              l'application sait, sans reproche ni prescription (principe 6). */}
          <p className="mt-3 text-courant leading-relaxed text-texte-doux">
            L’application ne connaîtra pas ce que ce repas apporte. Elle n’en tiendra donc aucun
            compte dans les repères nutritionnels de cette journée, et n’inventera rien à sa place.
          </p>

          <button
            type="submit"
            disabled={libellePrepare.trim() === ''}
            className="mt-4 min-h-tactile w-full rounded-[0.7rem] bg-accent-plein px-3 text-lecture font-semibold text-white disabled:opacity-45"
          >
            Poser ce plat
          </button>
        </form>
      ) : onglet === 'catalogue' ? (
        <label className="mt-4 block">
          <span className="text-courant text-texte-doux">Nom, ingrédient, cuisine…</span>
          <input
            type="search"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-fond px-3 text-lecture text-texte"
          />
        </label>
      ) : aConfirmer ? (
        // ⚠️ LA CONFIRMATION PASSE AVANT LES RÉSULTATS, elle ne s'affiche pas à côté. Proposer des
        // recettes ET demander si la donnée est juste, en même temps, laisserait croire que les
        // recettes tiennent. Elles ne tiennent pas tant qu'on n'a pas répondu.
        <div className="mt-4">
          <ConfirmerFrigo
            socle={socle}
            entrees={entrees}
            aujourdhui={aujourdhuiIso()}
            onConfirme={() => {
              // Relu en base plutôt que reconstruit ici : `ConfirmerFrigo` vient de réécrire la
              // table avec les dates par ligne, et c'est elle qui fait foi.
              setEntrees(readPantryEntries(socle.db))
              setFrigoConfirme(true)
            }}
          />
        </div>
      ) : (
        <p className="mt-4 text-courant leading-relaxed text-texte-doux">
          {garde.length === 0
            ? 'Vous n’avez rien déclaré dans le frigo. L’écran Frigo sert à dire ce que vous avez ; cette liste s’en servira.'
            : `D’après les ${garde.length} aliment${garde.length > 1 ? 's' : ''} déclaré${garde.length > 1 ? 's' : ''} au frigo, du mieux couvert au moins couvert.`}
        </p>
      )}

      {onglet === 'prepare' || aConfirmer ? null : lignes.length === 0 ? (
        // ⚠️ NE DIT JAMAIS « aucun résultat » TOUT COURT. Une liste vide après une recherche a deux
        // causes très différentes — le mot cherché, ou les contraintes déclarées — et l'utilisateur
        // ne peut pas les distinguer seul.
        <p className="mt-4 text-courant leading-relaxed text-attenue">
          {onglet === 'frigo' && garde.length === 0
            ? ''
            : 'Rien ne correspond. Vos allergies et votre régime écartent aussi des recettes — l’écran Recettes montre lesquelles et pourquoi.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {lignes.map((l) => (
            <li key={l.recipeId}>
              <button
                type="button"
                onClick={() => poser(l.recipeId)}
                className="min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 py-2 text-left text-lecture text-texte hover:bg-accent-doux"
              >
                <span className="font-titre">{l.nom}</span>
                {/* ⚠️ « il vous manque » EST UN FAIT, pas un reproche, et surtout PAS un pourcentage.
                    Afficher « couverture 62 % » à côté d'un plat se lirait comme une note — le
                    jugement interdit par le principe 6, exactement comme le score du moteur. */}
                {l.couverture !== null && (
                  <span className="mt-0.5 block text-mention text-texte-doux">
                    {l.manquants.length === 0
                      ? 'Vous avez tout ce qu’il faut.'
                      : `Il vous manque : ${l.manquants.slice(0, 4).join(', ')}${l.manquants.length > 4 ? '…' : ''}`}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panneau>
  )
}

function OngletBouton({
  actif,
  onClick,
  children,
}: {
  readonly actif: boolean
  readonly onClick: () => void
  readonly children: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={`min-h-tactile flex-1 rounded-[0.7rem] border px-3 text-courant font-semibold ${
        actif ? 'border-accent bg-accent-doux text-accent-texte' : 'border-bordure-forte bg-fond text-texte-doux'
      }`}
    >
      {children}
    </button>
  )
}
