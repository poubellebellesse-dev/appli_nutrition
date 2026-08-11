// ui/screens/parametres.tsx — réglages et « À propos ».
//
// ⚠️ CET ÉCRAN COMBLE UN DÉFAUT DE SÉCURITÉ, pas un manque de confort. `writeAllergies`,
// `writeDiet` et `writeRythme` n'étaient appelés QUE par l'accueil : passé le premier lancement,
// les allergies devenaient IMMUABLES. Une case cochée par erreur l'était pour toujours, une allergie
// découverte plus tard n'était pas déclarable — alors que l'accueil promet noir sur blanc qu'on
// pourra les modifier, et que §5.2 ARCHITECTURE qualifie ce filtre de « seul garde-fou CRITIQUE et
// incontournable » du moteur. Un garde-fou qu'on ne peut pas corriger n'en est plus tout à fait un.
//
// ⚠️ ÉCRITURE IMMÉDIATE À CHAQUE CHANGEMENT, sans bouton « Enregistrer ». Sur des réglages de
// sécurité, un formulaire qu'on peut quitter à moitié rempli laisse l'utilisateur croire qu'il a
// déclaré une allergie alors que rien n'est parti en base. Le geste est le contrat. Ouvrir une
// fenêtre en superposition (`Panneau`) et la refermer via « ← Retour » NE CHANGE RIEN à cette
// règle : le panneau n'a pas d'état à lui, il lit et écrit directement `vue` — fermer n'annule
// jamais une modification, exactement comme naviguer ailleurs ne l'annulait pas avant.
//
// ⚠️ PLUS DE MENUS DÉROULANTS. Chaque réglage vit derrière une `LigneOuvrante` (libellé + valeur
// courante + chevron) regroupée par thème (« Options nutrition », « Affichage », « Rappels de
// préparation ») ; ouvrir un réglage affiche un `Panneau` plein écran plutôt que de déplier du
// contenu sur place. Voir `ui/panneau.tsx` pour le pourquoi : un dépliant pousse tout ce qui le
// suit et fait perdre l'utilisateur, une fenêtre recouvre sans rien déplacer.
//
// ⚠️ CE N'EST PAS UN SIXIÈME ONGLET (§2 DESIGN, cinq onglets stables) — on y arrive par l'engrenage
// de l'en-tête, présent sur tous les écrans. Voir `router.tsx`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AllergenId,
  Catalog,
  DietCode,
  EquipmentId,
  EtatDuCreneau,
  Food,
  FoodId,
  GroupeAnimal,
  GroupeAnimalId,
  HardConstraints,
  MealSlot,
  PiquantTolerance,
  PlatsDuCreneau,
} from '../../engine/domain/index.js'
import { deplierGroupesRetires, groupesAnimaux, platsParCreneau } from '../../engine/domain/index.js'
import type { Engine } from '../../engine/api/index.js'
import { DEFAULT_PLAN_DAYS } from '../../engine/planning/plan-week.js'
import { DIET_CHAIN, regimeExigePar } from '../../engine/selection/index.js'
import {
  readAdmittedFoodIds,
  readDisplay,
  readExcludedFoodIds,
  readExcludedGroupIds,
  readGroupExceptionFoodIds,
  readMealTimes,
  readOwnedEquipmentIds,
  writeAdmittedFoodIds,
  writeAllergies,
  writeDiet,
  writeExcludedFoodIds,
  writeExcludedGroupIds,
  writeGroupExceptionFoodIds,
  writeTolerancePiquant,
  readTolerancePiquant,
  writeDisplay,
  writeMealTime,
  writeRythme,
  type HeuresDeRepas,
  type StoredDisplay,
} from '../../data/user-store.js'
import { chargerSocle, maintenantIso } from '../socle.js'
import type { EtatVerrou } from '../user-source.js'
import {
  exporterSauvegarde,
  lireEtatSauvegarde,
  restaurerSauvegarde,
  resumeSauvegarde,
  type EtatSauvegarde,
} from '../sauvegarde.js'
import {
  Case,
  ChoixAllergenes,
  ChoixRegime,
  ChoixRythme,
  LIBELLE_COURT,
  LIBELLE_REGIME,
} from '../champs-profil.js'
import { lireChoixProfil, type ChoixProfil } from '../profil-enregistre.js'
import { LIBELLE_CRENEAU } from '../socle.js'
import { creneauxDuRythme } from '../creneau.js'
import { demanderAutorisation, etatNotifications, type EtatNotifications } from '../notifications.js'
import type { StoredRythme } from '../../data/user-store.js'
import { LigneOuvrante, Panneau } from '../panneau.js'
import { ChoixPiquant } from '../champs-profil.js'
import { PARCOURS } from '../parcours.js'
import { useLancerParcours } from '../lancer-parcours.js'
import { LienTutoriel } from '../lien-tutoriel.js'

/**
 * ⚠️ LA VUE RÉUTILISE `ChoixProfil`, elle n'en redéclare pas une variante. Cet écran portait sa
 * propre constante de rythme par défaut, dupliquée de l'accueil : deux valeurs différentes auraient
 * fait qu'ouvrir Paramètres sans rien toucher CHANGE les suggestions. Une seule définition, dans
 * `ui/profil-enregistre.ts`, avec la lecture et l'écriture qui vont avec.
 */
interface Vue extends ChoixProfil {
  readonly catalogue: Catalog
  /**
   * Le moteur, pour le SEUL compteur « il reste N plats » — jamais pour suggérer quoi que ce soit.
   *
   * ⚠️ ON INTERROGE LE MOTEUR PLUTÔT QUE DE RECOMPTER. Un écran qui refiltrerait le catalogue
   * lui-même annoncerait un nombre que les suggestions ne confirment pas : `browseRecipes` applique
   * exactement les couches d'exclusion de `suggestMeals`, ce qu'aucune réécriture ici ne garantirait.
   */
  readonly moteur: Engine
  /**
   * Le matériel déclaré, lu UNE FOIS — cet écran ne le règle pas encore, mais il pèse sur le compte
   * de plats restants. `null` = jamais déclaré, la couche `equipement` reste inerte (tri-état).
   */
  readonly equipement: readonly EquipmentId[] | null
  readonly affichage: StoredDisplay
  readonly heures: HeuresDeRepas
  /** Décision 35. `null` = jamais déclarée — la couche `piquant` du moteur reste alors inerte. */
  readonly tolerancePiquant: PiquantTolerance | null
  readonly sauvegarde: EtatSauvegarde
  /** Un onglet en `'partage'` n'enregistre rien : il ne peut pas non plus restaurer. */
  readonly verrou: EtatVerrou
  /**
   * « Aliments que je ne veux pas », dans la forme EXACTE où c'est stocké — trois ensembles bruts,
   * jamais le résultat déplié.
   *
   * ⚠️ L'ÉCRAN NE TIENT PAS LA LISTE DÉPLIÉE, ET C'EST STRUCTUREL. Cocher « Œufs » enregistre LE
   * GROUPE ; les aliments qu'il contient se calculent à la lecture, contre le catalogue du jour
   * (`readExcludedFoodIdsDeplies`). Recopier ici les membres du groupe reviendrait à figer le
   * catalogue au moment du geste — le huitième œuf ajouté le mois prochain serait servi à quelqu'un
   * qui avait justement coché « Œufs », sans erreur ni test rouge.
   */
  readonly groupesRetires: ReadonlySet<GroupeAnimalId>
  /** Aliments cochés SEULS, hors de tout groupe retiré. */
  readonly alimentsRetires: ReadonlySet<FoodId>
  /** Aliments ré-admis À L'INTÉRIEUR d'un groupe retiré — le végétarien qui reprend le roquefort. */
  readonly exceptions: ReadonlySet<FoodId>
  /**
   * « Mes exceptions » — les aliments admis MALGRÉ le régime déclaré (`user_admitted_food`, v16).
   *
   * ⛔ RIEN À VOIR AVEC `exceptions` CI-DESSUS, malgré le nom, et les deux sont à trois lignes l'une
   * de l'autre : `exceptions` RESTREINT un retrait de groupe (couche `exclusions`), celle-ci
   * ASSOUPLIT le régime (couche `regime`). Le tableau des deux vit au-dessus de la migration 16
   * (`data/user-schema.ts`). Seule celle-ci peut faire proposer un produit animal à un végétalien.
   */
  readonly admissions: ReadonlySet<FoodId>
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

/** Le panneau actuellement ouvert, ou aucun. Un seul à la fois — c'est une fenêtre plein écran. */
type PanneauId =
  | 'allergies'
  | 'regime'
  | 'aliments-ecartes'
  | 'exceptions-regime'
  | 'piquant'
  | 'rythme'
  | 'affichage'
  | 'rappels'
  | 'sauvegarde'
  | 'tutoriels'
  | 'apropos'

async function lireVue(): Promise<Vue> {
  const socle = await chargerSocle()
  return {
    ...lireChoixProfil(socle.db),
    tolerancePiquant: readTolerancePiquant(socle.db),
    catalogue: socle.catalogue,
    moteur: socle.moteur,
    equipement: readOwnedEquipmentIds(socle.db),
    affichage: readDisplay(socle.db),
    heures: readMealTimes(socle.db),
    sauvegarde: lireEtatSauvegarde(socle.db),
    verrou: socle.verrou,
    groupesRetires: new Set(readExcludedGroupIds(socle.db)),
    alimentsRetires: new Set(readExcludedFoodIds(socle.db)),
    exceptions: new Set(readGroupExceptionFoodIds(socle.db)),
    admissions: new Set(readAdmittedFoodIds(socle.db)),
  }
}

// --- Résumés affichés sur les lignes ouvrantes -----------------------------------------------------
//
// ⚠️ LES LIBELLÉS VIENNENT DE `champs-profil.tsx`, ILS NE SONT PAS RECOPIÉS ICI. Ce fichier en a
// d'abord tenu une copie — identique au caractère près, donc invisible à la relecture, et destinée
// à diverger au premier libellé retouché. C'est exactement ce que l'extraction de `champs-profil`
// avait pour but d'empêcher : les deux écrans règlent les mêmes champs, ils doivent les NOMMER
// pareil. Les tables y sont désormais exportées.

function resumeAllergenes(catalogue: Catalog, allergenes: ReadonlySet<string>): string {
  if (allergenes.size === 0) return 'Aucune'
  return [...allergenes]
    .map((id) => LIBELLE_COURT[id] ?? catalogue.allergens.get(id as AllergenId)?.nom ?? id)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .join(', ')
}

/**
 * ⚠️ LE RÉGIME DÉCLARÉ PORTE SES EXCEPTIONS PARTOUT OÙ IL S'AFFICHE. « Végétalien » tout court,
 * alors qu'une exception court depuis trois mois, est la seule façon dont ce chantier pouvait
 * tromper son propriétaire — un libellé net qui masque une entorse qu'on a soi-même posée, puis
 * oubliée. Énoncer un fait ne juge personne : le principe 6 reste entier.
 *
 * ⚠️ ZÉRO EXCEPTION ⇒ LE LIBELLÉ NE CHANGE PAS. Pas de « végétalien, sauf 0 » : une mention qui
 * apparaît toujours cesse d'être lue, et c'est exactement ce qu'on cherche à éviter ici.
 *
 * ⚠️ ON COMPTE LES EXCEPTIONS QUI AGISSENT, PAS LES LIGNES EN BASE. Une admission sur un aliment
 * que le régime déclaré n'écarte pas — ou qu'une allergie écarte de toute façon — ne change RIEN aux
 * suggestions ; l'annoncer ferait mentir le libellé dans l'autre sens. Le compte est exactement
 * celui des cases cochées et actives du panneau (`admissionsEffectives`).
 */
function resumeRegime(regime: DietCode | null, exceptions: number): string {
  if (regime === null) return 'Aucun'
  const libelle = LIBELLE_REGIME[regime] ?? regime
  return exceptions === 0 ? libelle : `${libelle}, sauf ${exceptions}`
}

/**
 * ⚠️ ON NOMME LES ALIMENTS, ON NE LES COMPTE PAS — à la différence de « Aliments que je ne veux
 * pas », qui résume des GROUPES cochés. Ici le geste est déjà par aliment et il est rare par nature :
 * « Miel » dit ce qu'on a fait, « 1 aliment » oblige à ouvrir le panneau pour le savoir.
 */
function resumeExceptions(noms: readonly string[]): string {
  return noms.length === 0 ? 'Aucune' : noms.join(', ')
}

/**
 * ⚠️ ON RÉSUME CE QUI EST STOCKÉ, PAS CE QUE ÇA RETIRE. « Œufs, Miel » et non « 34 aliments
 * écartés » : un décompte d'aliments serait faux dès la mise à jour suivante du catalogue, et un
 * décompte de plats restants est un autre lot (l'avertissement de planning vide). Ici, la ligne dit
 * la DÉCISION de l'utilisateur, pas sa conséquence.
 */
function resumeAlimentsEcartes(vue: Vue, groupes: readonly GroupeAnimal[]): string {
  const libelles = groupes.filter((g) => vue.groupesRetires.has(g.id)).map((g) => g.libelle)
  const seuls = vue.alimentsRetires.size
  if (libelles.length === 0 && seuls === 0) return 'Aucun'
  const morceaux = [...libelles]
  if (seuls > 0) morceaux.push(`${seuls} aliment${seuls === 1 ? '' : 's'}`)
  return morceaux.join(', ')
}

function resumeRythme(rythme: StoredRythme): string {
  return `${rythme.repasParJour} repas par jour`
}

/**
 * ⚠️ « Non renseigné » ET NON « J'aime le piquant ». Les deux se comportent pareil pour le moteur,
 * mais afficher une position que personne n'a choisie prêterait un choix à l'utilisateur — c'est la
 * même règle que `Recipe.piquant`, dont l'absence ne vaut jamais « doux ».
 */
function resumePiquant(tolerance: PiquantTolerance | null): string {
  if (tolerance === 'aucun') return "Je n'en mange pas"
  if (tolerance === 'un_peu') return 'Un peu, ça va'
  if (tolerance === 'tout') return "J'aime le piquant"
  return 'Non renseigné'
}

function resumeAffichage(affichage: StoredDisplay): string {
  const reglages = [affichage.gestesBalayage, affichage.afficherMacros]
  const actifs = reglages.filter(Boolean).length
  return `${actifs} activé${actifs === 1 ? '' : 's'} sur ${reglages.length}`
}

function resumeRappels(actifs: boolean): string {
  return actifs ? 'Activés' : 'Désactivés'
}

export function Parametres() {
  const lancerParcours = useLancerParcours()
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })
  const [panneauOuvert, setPanneauOuvert] = useState<PanneauId | null>(null)

  useEffect(() => {
    let annule = false
    lireVue()
      .then((vue) => {
        if (!annule) setEtat({ phase: 'pret', vue })
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({
            phase: 'erreur',
            message: erreur instanceof Error ? erreur.message : String(erreur),
          })
        }
      })
    return () => {
      annule = true
    }
  }, [])

  /**
   * Applique un changement : état d'écran d'abord, base ensuite.
   *
   * L'ordre compte pour la réactivité — une case qui n'a l'air cochée qu'après un aller-retour en
   * base paraît cassée. En revanche l'écriture n'est PAS optimiste sur son résultat : si elle
   * échoue, on bascule en erreur plutôt que de laisser une case cochée qui ne protège de rien.
   */
  const appliquer = useCallback(
    (suivante: Vue, ecrire: (db: Awaited<ReturnType<typeof chargerSocle>>['db']) => void) => {
      setEtat({ phase: 'pret', vue: suivante })
      chargerSocle()
        .then((socle) => ecrire(socle.db))
        .catch((erreur: unknown) => {
          setEtat({
            phase: 'erreur',
            message: erreur instanceof Error ? erreur.message : String(erreur),
          })
        })
    },
    []
  )

  // Dérivé du catalogue, jamais stocké : les groupes suivent le contenu livré. `useMemo` parce que
  // `groupesAnimaux` parcourt les 451 aliments et que ce composant se rend à chaque case cochée.
  // Appelé AVANT les retours anticipés — l'ordre des hooks ne se discute pas.
  const catalogue = etat.phase === 'pret' ? etat.vue.catalogue : null
  const groupes = useMemo(
    () => (catalogue === null ? [] : groupesAnimaux(catalogue.foods)),
    [catalogue]
  )

  /**
   * « Il reste N plats », créneau par créneau.
   *
   * ⚠️ LE COÛT EST MESURÉ, PAS SUPPOSÉ : **0,6 ms par appel** sur le catalogue réel (330 recettes,
   * 200 appels, régime végétarien), **0,98 ms** avec 120 aliments exclus — `createEngine` a déjà
   * construit le catalogue enrichi, `browseRecipes` ne fait que la passe d'exclusion. Le recalcul à
   * chaque case cochée ne coûte donc rien de visible, et le `useMemo` n'est PAS ce qui rend l'écran
   * tenable : il évite seulement de rejouer la passe aux rendus déclenchés par les autres réglages
   * de la page. Les dépendances sont exactement ce qui change le résultat — les trois ensembles de
   * cases, le régime, les allergies, le matériel, et le rythme qui décide des créneaux affichés.
   *
   * ⚠️ UN SEUL APPEL À `browseRecipes` POUR TOUS LES CRÉNEAUX. L'intersection avec `recipesBySlot`
   * suffit — un axe « créneaux » dans `BrowseRequest` coûterait quatre passes de couches pour le
   * même nombre. `platsParCreneau` porte le détail.
   */
  const vueCourante = etat.phase === 'pret' ? etat.vue : null

  // La MÊME règle de dépliage que `readExcludedFoodIdsDeplies`, appelée sur l'état d'écran — qui est
  // en avance sur la base, `appliquer` écrivant après avoir posé l'état. Sortie du mémo du compteur
  // parce que « Mes exceptions » en a besoin aussi : deux appels donneraient deux vérités le jour où
  // l'un des deux oublierait un argument.
  const exclus = useMemo<readonly FoodId[]>(
    () =>
      vueCourante === null
        ? []
        : deplierGroupesRetires(
            groupes,
            vueCourante.groupesRetires,
            vueCourante.alimentsRetires,
            vueCourante.exceptions
          ),
    [groupes, vueCourante?.groupesRetires, vueCourante?.alimentsRetires, vueCourante?.exceptions]
  )

  /**
   * Ce que « Mes exceptions » peut proposer, et le compte que le libellé du régime affiche.
   *
   * ⚠️ `useMemo` POUR LA MÊME RAISON QUE `groupes` JUSTE AU-DESSUS : ce composant se rend à chaque
   * case cochée, et `groupesAdmissibles` appelle `regimeExigePar` sur les 167 aliments d'origine
   * animale — dont chacun peut remonter une chaîne `deriveDe`. Le coût est petit, le rendu est
   * fréquent, et le mémo est gratuit ici puisque ses dépendances sont déjà toutes des références
   * stables entre deux rendus non concernés.
   */
  const admissibles = useMemo(
    () =>
      vueCourante === null || catalogue === null
        ? []
        : groupesAdmissibles(
            groupes,
            catalogue.foods,
            vueCourante.regime,
            vueCourante.allergenes,
            new Set(exclus)
          ),
    [groupes, catalogue, vueCourante?.regime, vueCourante?.allergenes, exclus]
  )
  const effectives = useMemo(
    () => (vueCourante === null ? [] : admissionsEffectives(admissibles, vueCourante.admissions)),
    [admissibles, vueCourante?.admissions]
  )

  const comptes = useMemo<readonly PlatsDuCreneau[]>(() => {
    if (vueCourante === null || catalogue === null) return []
    const contraintes: HardConstraints = {
      // `ChoixProfil.allergenes` est un ensemble de `string` — même conversion que
      // `ecrireChoixProfil` (ui/profil-enregistre.ts), qui fait le chemin inverse.
      allergies: [...vueCourante.allergenes].map((id) => id as AllergenId),
      diet: vueCourante.regime,
      excludedFoodIds: exclus,
      ownedEquipmentIds: vueCourante.equipement,
      // ⚠️ TOUTES LES ADMISSIONS, PAS SEULEMENT CELLES QUI AGISSENT (`effectives`) — c'est ce que
      // `readConstraints` envoie en production, et le compteur doit annoncer ce que les suggestions
      // feront, pas une variante plus propre. Une admission inerte l'est déjà pour le moteur : la
      // couche `allergenes` ou `exclusions` écarte le plat de toute façon.
      // ⚠️ CE `[]` EN DUR ÉTAIT JUSTE TANT QUE PERSONNE NE POUVAIT COCHER. Le panneau existe
      // maintenant : le laisser aurait affiché « il reste N plats » sous les cases qui le
      // démentaient, sur le même écran. Verrouillé par un test qui coche et lit le compte.
      admittedFoodIds: [...vueCourante.admissions],
    }
    return platsParCreneau(
      vueCourante.moteur.browseRecipes({ constraints: contraintes }).recipeIds,
      catalogue.indexes.recipesBySlot,
      creneauxDuRythme(vueCourante.rythme.repasParJour),
      DEFAULT_PLAN_DAYS
    )
  }, [
    catalogue,
    exclus,
    vueCourante?.moteur,
    vueCourante?.allergenes,
    vueCourante?.regime,
    vueCourante?.admissions,
    vueCourante?.equipement,
    vueCourante?.rythme.repasParJour,
  ])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-lecture font-semibold text-texte">
          Les réglages n'ont pas pu être enregistrés.
        </p>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat
  const fermer = () => setPanneauOuvert(null)

  return (
    <section>
      <h1 data-visite="titre-parametres" className="text-titre-l text-texte">
        Paramètres
      </h1>
      <LienTutoriel parcoursId="reglages" />
      <p className="mt-2 text-courant leading-relaxed text-attenue">
        Tout se modifie à tout moment. Rien n'est envoyé nulle part.
      </p>

      <Section titre="Options nutrition">
        <div className="space-y-2">
          <LigneOuvrante
            libelle="Mes allergies"
            valeur={resumeAllergenes(vue.catalogue, vue.allergenes)}
            onOuvrir={() => setPanneauOuvert('allergies')}
            dataVisite="allergies"
          />
          <LigneOuvrante
            libelle="Mon régime"
            valeur={resumeRegime(vue.regime, effectives.length)}
            onOuvrir={() => setPanneauOuvert('regime')}
          />
          {/* ⚠️ LA LIGNE N'EXISTE QUE SI LE RÉGIME DÉCLARÉ ÉCARTE QUELQUE CHOSE. Un omnivore — ou
              quelqu'un sans régime — n'a AUCUNE exception à poser : le panneau s'ouvrirait sur une
              liste vide, c'est-à-dire sur un réglage qui ne règle rien. ⛔ Ce n'est pas le même cas
              que « Aliments que je ne veux pas », qui affiche les groupes déjà écartés plutôt que de
              les masquer : là-bas, cacher aurait tu CE QUI FILTRE les suggestions ; ici il n'y a rien
              à taire, il n'y a rien à régler. */}
          {admissibles.length > 0 && (
            <LigneOuvrante
              libelle="Mes exceptions"
              valeur={resumeExceptions(effectives.map((f) => f.nom))}
              onOuvrir={() => setPanneauOuvert('exceptions-regime')}
            />
          )}
          <LigneOuvrante
            libelle="Aliments que je ne veux pas"
            valeur={resumeAlimentsEcartes(vue, groupes)}
            onOuvrir={() => setPanneauOuvert('aliments-ecartes')}
          />
          <LigneOuvrante
            libelle="Le piquant"
            valeur={resumePiquant(vue.tolerancePiquant)}
            onOuvrir={() => setPanneauOuvert('piquant')}
          />
          <LigneOuvrante
            libelle="Mon rythme"
            valeur={resumeRythme(vue.rythme)}
            onOuvrir={() => setPanneauOuvert('rythme')}
          />
        </div>
      </Section>

      <Section titre="Affichage">
        <div className="space-y-2">
          <LigneOuvrante
            libelle="Réglages d'affichage"
            valeur={resumeAffichage(vue.affichage)}
            onOuvrir={() => setPanneauOuvert('affichage')}
            dataVisite="reglages-affichage"
          />
        </div>
      </Section>

      <Section titre="Rappels de préparation">
        <div className="space-y-2">
          <LigneOuvrante
            libelle="Rappels"
            valeur={resumeRappels(vue.affichage.rappelsActifs)}
            onOuvrir={() => setPanneauOuvert('rappels')}
          />
        </div>
      </Section>

      {/* §7 ARCHITECTURE mesures 3, 4 et 5. Placée AVANT « Aide » : c'est un réglage de données,
          pas de l'assistance. Le résumé porte le rappel des 14 jours — il n'existe nulle part
          ailleurs, ni bandeau, ni notification, ni badge (décision du 2026-08-06). */}
      <Section titre="Sauvegarde">
        <div className="space-y-2">
          <LigneOuvrante
            libelle="Sauvegarder mes données"
            valeur={resumeSauvegarde(vue.sauvegarde, maintenantIso())}
            onOuvrir={() => setPanneauOuvert('sauvegarde')}
          />
        </div>
      </Section>

      <Section titre="Aide">
        <div className="space-y-2">
          {/* Rejouable : `visite_proposee` ne dit que « on l'a déjà proposée une fois », jamais
              « déjà terminé » (voir `ui/parcours.ts`) — cette ligne ouvre la liste des HUIT
              parcours, dérivée de `PARCOURS`, jamais recopiée ici. */}
          <LigneOuvrante
            libelle="Revoir un tutoriel"
            valeur="Redécouvrez un écran, pas à pas."
            onOuvrir={() => setPanneauOuvert('tutoriels')}
          />
        </div>
      </Section>

      <div className="mt-8">
        <LigneOuvrante libelle="À propos" valeur="" onOuvrir={() => setPanneauOuvert('apropos')} />
      </div>

      {panneauOuvert === 'allergies' && (
        <Panneau titre="Mes allergies" onFermer={fermer}>
          <p className="mb-3 text-courant leading-relaxed text-texte-doux">
            Ces aliments sont écartés systématiquement, sans exception et sans pondération.
          </p>
          <ChoixAllergenes
            catalogue={vue.catalogue}
            choisies={vue.allergenes}
            onChange={(allergenes) =>
              appliquer({ ...vue, allergenes }, (db) =>
                writeAllergies(
                  db,
                  [...allergenes].map((id) => ({ allergenId: id as AllergenId, severite: null }))
                )
              )
            }
          />
        </Panneau>
      )}

      {panneauOuvert === 'regime' && (
        <Panneau titre="Mon régime" onFermer={fermer}>
          <ChoixRegime
            catalogue={vue.catalogue}
            choisi={vue.regime}
            onChange={(regime) => appliquer({ ...vue, regime }, (db) => writeDiet(db, regime))}
          />
          {/* ⚠️ ICI LES EXCEPTIONS SONT NOMMÉES, PAS COMPTÉES. La ligne du dessous dit « sauf 1 »
              parce qu'elle tient sur une ligne ; l'écran du régime, lui, est le seul endroit où on
              vient VÉRIFIER ce qu'on a déclaré — un compte y laisserait la question ouverte. ⛔ Aucune
              case ici : on se contente de rappeler, le geste vit dans « Mes exceptions ». */}
          {effectives.length > 0 && (
            <p className="mt-3 rounded-[--radius-carte] border border-bordure bg-fond px-4 py-3 text-courant leading-relaxed text-texte-doux">
              Vous acceptez malgré ce régime :{' '}
              <span className="text-texte">{effectives.map((f) => f.nom).join(', ')}</span>. Ça se
              modifie dans « Mes exceptions ».
            </p>
          )}
        </Panneau>
      )}

      {panneauOuvert === 'aliments-ecartes' && (
        <Panneau titre="Aliments que je ne veux pas" onFermer={fermer}>
          <AlimentsEcartes
            groupes={groupes}
            foods={vue.catalogue.foods}
            regime={vue.regime}
            groupesRetires={vue.groupesRetires}
            alimentsRetires={vue.alimentsRetires}
            exceptions={vue.exceptions}
            comptes={comptes}
            onPreselection={(ajouts) => {
              // ⛔ UNE PRÉSÉLECTION AJOUTE, ELLE NE DÉCOCHE JAMAIS. Même polarité que partout dans ce
              // mécanisme (`regimeExigePar` rend `omnivore` en cas d'ignorance) : l'erreur qui
              // retire un aliment de trop se voit et se répare, celle qui en réadmet un en silence
              // ne se voit pas. Contrepartie assumée : se tromper de présélection ne s'annule pas
              // d'un clic, il faut décocher soi-même. C'est le prix, il est payé sciemment — et ⛔
              // surtout pas compensé par un « annuler » qui rouvrirait la direction interdite.
              const groupesRetires = new Set(vue.groupesRetires)
              for (const groupeId of ajouts) groupesRetires.add(groupeId)
              appliquer({ ...vue, groupesRetires }, (db) =>
                writeExcludedGroupIds(db, [...groupesRetires])
              )
            }}
            onGroupe={(groupeId, retire) => {
              const groupesRetires = new Set(vue.groupesRetires)
              if (retire) groupesRetires.add(groupeId)
              else groupesRetires.delete(groupeId)
              appliquer({ ...vue, groupesRetires }, (db) =>
                writeExcludedGroupIds(db, [...groupesRetires])
              )
            }}
            onAliment={(foodId, retire, groupeRetire) => {
              // ⚠️ LES DEUX TABLES D'ALIMENTS RESTENT DISJOINTES À L'ÉCRITURE. Selon que le groupe
              // est retiré ou non, le MÊME geste s'enregistre dans l'une ou dans l'autre : dans un
              // groupe retiré, décocher un aliment est une RÉ-ADMISSION ; hors groupe retiré, le
              // cocher est un retrait. Laisser une ligne dans les deux tables ferait réapparaître
              // l'aliment comme exclu le jour où l'utilisateur décoche le groupe, alors qu'il venait
              // justement de le reprendre.
              const alimentsRetires = new Set(vue.alimentsRetires)
              const exceptions = new Set(vue.exceptions)
              if (groupeRetire) {
                alimentsRetires.delete(foodId)
                if (retire) exceptions.delete(foodId)
                else exceptions.add(foodId)
              } else {
                exceptions.delete(foodId)
                if (retire) alimentsRetires.add(foodId)
                else alimentsRetires.delete(foodId)
              }
              appliquer({ ...vue, alimentsRetires, exceptions }, (db) => {
                writeExcludedFoodIds(db, [...alimentsRetires])
                writeGroupExceptionFoodIds(db, [...exceptions])
              })
            }}
          />
        </Panneau>
      )}

      {panneauOuvert === 'exceptions-regime' && (
        <Panneau titre="Mes exceptions" onFermer={fermer}>
          <ExceptionsRegime
            groupes={admissibles}
            regime={vue.regime}
            admissions={vue.admissions}
            comptes={comptes}
            onAliment={(foodId, admis) => {
              // « Le geste est le contrat » : on écrit AU CLIC, jamais à la fermeture du panneau.
              const admissions = new Set(vue.admissions)
              if (admis) admissions.add(foodId)
              else admissions.delete(foodId)
              appliquer({ ...vue, admissions }, (db) => writeAdmittedFoodIds(db, [...admissions]))
            }}
          />
        </Panneau>
      )}

      {panneauOuvert === 'piquant' && (
        <Panneau titre="Le piquant" onFermer={fermer}>
          <ChoixPiquant
            choisi={vue.tolerancePiquant}
            onChange={(tolerancePiquant) =>
              appliquer({ ...vue, tolerancePiquant }, (db) => writeTolerancePiquant(db, tolerancePiquant))
            }
          />
        </Panneau>
      )}

      {panneauOuvert === 'rythme' && (
        <Panneau titre="Mon rythme" onFermer={fermer}>
          <ChoixRythme
            rythme={vue.rythme}
            onChange={(rythme) => appliquer({ ...vue, rythme }, (db) => writeRythme(db, rythme))}
          />
        </Panneau>
      )}

      {panneauOuvert === 'affichage' && (
        <Panneau titre="Réglages d'affichage" onFermer={fermer}>
          <div className="space-y-2">
            {/* ⚠️ `readDisplay` PUIS étalement dans chaque écriture : `writeDisplay` remplace la
                ligne entière, un champ omis repartirait au défaut du schéma. */}
            <Case
              libelle="Changer de plat en balayant l'écran"
              description="Les flèches restent là dans tous les cas."
              cochee={vue.affichage.gestesBalayage}
              onBasculer={() => {
                const affichage = { ...vue.affichage, gestesBalayage: !vue.affichage.gestesBalayage }
                appliquer({ ...vue, affichage }, (db) => writeDisplay(db, affichage))
              }}
              dataVisite="geste-balayage"
            />
            <Case
              libelle="Afficher plus de détails"
              description="Les valeurs nutritionnelles sur la fiche d'une recette, et l'avertissement d'énergie sur la semaine."
              cochee={vue.affichage.afficherMacros}
              onBasculer={() => {
                const affichage = { ...vue.affichage, afficherMacros: !vue.affichage.afficherMacros }
                appliquer({ ...vue, affichage }, (db) => writeDisplay(db, affichage))
              }}
            />
          </div>
        </Panneau>
      )}

      {panneauOuvert === 'rappels' && (
        <Panneau titre="Rappels de préparation" onFermer={fermer}>
          <Rappels
            rythme={vue.rythme}
            actifs={vue.affichage.rappelsActifs}
            heures={vue.heures}
            onActifs={(rappelsActifs) => {
              const affichage = { ...vue.affichage, rappelsActifs }
              appliquer({ ...vue, affichage }, (db) => writeDisplay(db, affichage))
            }}
            onHeure={(creneau, heureMin) => {
              const heures = new Map(vue.heures)
              if (heureMin === null) heures.delete(creneau)
              else heures.set(creneau, heureMin)
              appliquer({ ...vue, heures }, (db) => writeMealTime(db, creneau, heureMin))
            }}
          />
        </Panneau>
      )}

      {panneauOuvert === 'tutoriels' && (
        <Panneau titre="Revoir un tutoriel" onFermer={fermer}>
          {/* Dérivée de `PARCOURS`, jamais recopiée : un neuvième parcours ajouté à la table
              apparaît ici tout seul (voir `ui/parcours.ts`). Choisir une ligne lance le parcours ET
              referme la fenêtre — si son écran n'est pas celui-ci, `lancerParcours` navigue d'abord
              (voir `ui/main.tsx`). */}
          <ul className="space-y-2">
            {PARCOURS.map((parcours) => (
              <li key={parcours.id}>
                <LigneOuvrante
                  libelle={parcours.titre}
                  valeur=""
                  onOuvrir={() => {
                    lancerParcours(parcours.id)
                    fermer()
                  }}
                />
              </li>
            ))}
          </ul>
        </Panneau>
      )}

      {panneauOuvert === 'sauvegarde' && (
        <Panneau titre="Sauvegarder mes données" onFermer={fermer}>
          <Sauvegarde
            etat={vue.sauvegarde}
            verrou={vue.verrou}
            onExporte={(dateIso) =>
              setEtat({ phase: 'pret', vue: { ...vue, sauvegarde: { ...vue.sauvegarde, dernierExport: dateIso } } })
            }
          />
        </Panneau>
      )}

      {panneauOuvert === 'apropos' && (
        <Panneau titre="À propos" onFermer={fermer}>
          <APropos />
        </Panneau>
      )}
    </section>
  )
}

/**
 * Les rappels de préparation.
 *
 * ⚠️ CE BLOC DIT LA VÉRITÉ SUR CE QUI EST POSSIBLE. Dans un navigateur — y compris une PWA
 * installée — aucune notification programmée n'existe : l'API qui l'aurait permis a été abandonnée,
 * et le push exigerait un serveur. Plutôt qu'un interrupteur qui ne ferait rien, on explique. Une
 * promesse non tenue coûte plus cher qu'une fonctionnalité absente.
 *
 * ⚠️ LES HEURES RESTENT RÉGLABLES même sans conteneur natif : elles décrivent l'utilisateur, pas la
 * plateforme, et elles seront là le jour de l'installation depuis le store.
 *
 * Rendu à l'intérieur d'un `Panneau` : pas de titre ici, le panneau le porte déjà dans son en-tête.
 */
function Rappels({
  rythme,
  actifs,
  heures,
  onActifs,
  onHeure,
}: {
  readonly rythme: StoredRythme
  readonly actifs: boolean
  readonly heures: HeuresDeRepas
  readonly onActifs: (actifs: boolean) => void
  readonly onHeure: (creneau: MealSlot, heureMin: number | null) => void
}) {
  const [etat, setEtat] = useState<EtatNotifications | null>(null)

  useEffect(() => {
    let annule = false
    etatNotifications().then(
      (e) => {
        if (!annule) setEtat(e)
      },
      () => undefined
    )
    return () => {
      annule = true
    }
  }, [])

  const basculer = () => {
    if (actifs) {
      onActifs(false)
      return
    }
    // ⚠️ LA PERMISSION EST DEMANDÉE SUR CE GESTE, jamais au démarrage : une invite qui surgit avant
    // qu'on ait rien demandé se solde par un refus, et un refus ne se redemande pas.
    void demanderAutorisation().then((accorde) => {
      setEtat((e) => (e === null ? e : { ...e, autorise: accorde }))
      onActifs(accorde)
    })
  }

  return (
    <>
      {etat?.disponible === false && (
        <p className="mb-3 rounded-[--radius-carte] border border-bordure bg-surface p-3 text-courant leading-relaxed text-texte-doux">
          Les rappels demandent l'application installée depuis le store. Dans un navigateur, aucune
          notification ne peut être programmée à l'avance — vos heures sont tout de même enregistrées.
        </p>
      )}

      <Case
        libelle="Me prévenir quand il est temps de commencer"
        description="Calculé depuis l'heure du repas et le temps de la recette prévue."
        cochee={actifs}
        onBasculer={basculer}
      />

      <p className="mt-4 text-courant text-texte-doux">À quelle heure mangez-vous ?</p>
      <div className="mt-2 space-y-2">
        {creneauxDuRythme(rythme.repasParJour).map((creneau) => (
          <label
            key={creneau}
            className="flex min-h-tactile items-center justify-between gap-3 rounded-[--radius-carte] border border-bordure bg-surface px-4"
          >
            <span className="text-lecture text-texte">{LIBELLE_CRENEAU[creneau]}</span>
            <input
              type="time"
              value={enTexte(heures.get(creneau))}
              onChange={(e) => onHeure(creneau, enMinutes(e.target.value))}
              className="min-h-tactile rounded-[0.6rem] border border-bordure-forte bg-fond px-2 text-lecture text-texte"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-mention leading-relaxed text-attenue">
        Un repas sans heure n'est jamais rappelé. Rien n'est obligatoire.
      </p>
    </>
  )
}

/** Minutes depuis minuit → « HH:MM » pour `<input type="time">`. Vide si non déclaré. */
function enTexte(heureMin: number | undefined): string {
  if (heureMin === undefined) return ''
  return `${String(Math.floor(heureMin / 60)).padStart(2, '0')}:${String(heureMin % 60).padStart(2, '0')}`
}

/** « HH:MM » → minutes depuis minuit. Champ vidé → `null`, ce qui EFFACE l'heure. */
function enMinutes(texte: string): number | null {
  const trouve = /^(\d{2}):(\d{2})$/.exec(texte)
  if (trouve === null) return null
  return Number(trouve[1]) * 60 + Number(trouve[2])
}

/** Un groupe de lignes ouvrantes, sous un même titre de thème. */
/**
 * La sauvegarde et la restauration — §7 ARCHITECTURE mesures 3 et 5.
 *
 * ⚠️ LA RESTAURATION EST LE SEUL GESTE DESTRUCTIF DE TOUTE L'APPLICATION. Partout ailleurs on ajoute,
 * on décoche, on remplace une ligne ; ici on écrase l'intégralité de ce que la personne a saisi
 * depuis le premier jour, sans corbeille et sans annulation — le fichier OPFS est réécrit. D'où les
 * trois garde-fous, dans cet ordre : le fichier est ÉPROUVÉ avant que quoi que ce soit ne bouge
 * (`restaurerSauvegarde`), la confirmation dit ce qui disparaît au lieu de demander « êtes-vous
 * sûr ? », et l'export de l'état courant est proposé DANS l'écran de confirmation, à portée de doigt,
 * plutôt que laissé à la prévoyance de qui est en train de restaurer.
 *
 * ⚠️ AUCUNE CONFIRMATION SUR L'EXPORT, et c'est volontaire : produire un fichier n'abîme rien.
 * Multiplier les « êtes-vous sûr ? » sur les gestes inoffensifs apprend à les traverser sans lire,
 * et le jour où il y en a un qui compte, il est traversé aussi.
 */
function Sauvegarde({
  etat,
  verrou,
  onExporte,
  onRestaure = () => window.location.reload(),
}: {
  readonly etat: EtatSauvegarde
  /**
   * ⚠️ LA RESTAURATION EST REFUSÉE DEPUIS UN ONGLET QUI N'ENREGISTRE PAS, et ce n'est pas une
   * précaution de confort. `remplacerLeFichier` écrirait bel et bien le fichier — puis l'onglet
   * détenteur du verrou, qui ne sait rien de cette restauration, l'écraserait à sa modification
   * suivante avec SA base en mémoire. La restauration paraîtrait avoir marché, puis se déferait
   * seule. Le refus dur vit dans `user-source.ts` ; ce qui suit ne fait que le dire AVANT le geste,
   * plutôt qu'après la fenêtre de confirmation.
   */
  readonly verrou: EtatVerrou
  readonly onExporte: (dateIso: string) => void
  /**
   * Ce qui suit une restauration réussie. Par défaut, un rechargement complet — les écrans tiennent
   * des copies en état local, et un affichage à moitié à jour sur des ALLERGÈNES serait un défaut de
   * sécurité, pas un défaut visuel. Injectable pour que le chemin nominal reste testable : jsdom ne
   * sait pas naviguer.
   */
  readonly onRestaure?: () => void
}) {
  /**
   * ⚠️ « CE QU'ON REGARDE » ET « UNE OPÉRATION EST EN COURS » SONT DEUX ÉTATS SÉPARÉS, et les avoir
   * confondus était un défaut : « Sauvegarder d'abord ce qui est sur cet appareil » s'offre DEPUIS
   * l'écran de confirmation. Un état unique faisait disparaître cette confirmation au premier clic —
   * on proposait un filet de sécurité dont l'usage annulait la décision en cours.
   */
  const [phase, setPhase] = useState<
    | { readonly type: 'repos' }
    | { readonly type: 'confirmation'; readonly fichier: File }
    | { readonly type: 'erreur'; readonly motif: string }
  >({ type: 'repos' })
  const [occupe, setOccupe] = useState(false)

  const echouer = (erreur: unknown) => {
    setOccupe(false)
    setPhase({ type: 'erreur', motif: erreur instanceof Error ? erreur.message : String(erreur) })
  }

  const exporter = () => {
    setOccupe(true)
    const date = maintenantIso()
    chargerSocle()
      .then((socle) => exporterSauvegarde(socle.db, date))
      .then(() => {
        onExporte(date)
        setOccupe(false)
      })
      .catch(echouer)
  }

  const restaurer = (fichier: File) => {
    setOccupe(true)
    restaurerSauvegarde(fichier)
      .then((resultat) => {
        // Pas de `setOccupe(false)` sur le succès : `onRestaure` recharge la page, et rendre les
        // boutons à nouveau cliquables pendant ce laps inviterait à relancer une restauration.
        if (resultat.ok) onRestaure()
        else {
          setOccupe(false)
          setPhase({ type: 'erreur', motif: resultat.motif })
        }
      })
      .catch(echouer)
  }

  if (phase.type === 'confirmation') {
    return (
      <div>
        <p className="text-lecture font-semibold text-texte">
          Restaurer remplacera toutes vos données actuelles.
        </p>
        {/* Ce qui disparaît est ÉNUMÉRÉ, pas résumé en « vos données » : personne ne peut évaluer un
            risque qu'on lui décrit en deux mots. */}
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">
          Votre profil, vos allergies, votre régime, vos goûts, votre semaine, vos courses et vos
          recettes personnelles seront remplacés par ceux du fichier « {phase.fichier.name} ». Ce qui
          est sur cet appareil aujourd'hui ne pourra pas être récupéré.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={exporter}
            disabled={occupe}
            className="flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-courant font-semibold text-texte-doux disabled:opacity-60"
          >
            Sauvegarder d'abord ce qui est sur cet appareil
          </button>
          <button
            type="button"
            onClick={() => restaurer(phase.fichier)}
            disabled={occupe}
            className="flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-courant font-semibold text-texte disabled:opacity-60"
          >
            Remplacer mes données
          </button>
          <button
            type="button"
            onClick={() => setPhase({ type: 'repos' })}
            className="flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] px-3 text-courant font-medium text-attenue"
          >
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-courant leading-relaxed text-texte-doux">
        Vos données ne sont que sur cet appareil : aucun serveur n'en garde de copie. Une sauvegarde
        est un fichier que vous rangez où vous voulez — elle contient tout, y compris vos allergies et
        votre régime.
      </p>
      {etat.dernierExport === null && (
        <p className="mt-2 text-courant leading-relaxed text-attenue">
          Vous n'avez encore jamais sauvegardé.
        </p>
      )}

      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={exporter}
          disabled={occupe}
          className="flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-courant font-semibold text-texte disabled:opacity-60"
        >
          Créer une sauvegarde
        </button>

        {/* ⚠️ SAUVEGARDER RESTE POSSIBLE DEPUIS UN ONGLET QUI N'ENREGISTRE PAS, restaurer non. Ce
            n'est pas une inconséquence : exporter ne fait que LIRE la base en mémoire, qui est
            valide — c'est même le geste qu'on veut laisser à portée dans cette situation. */}
        {verrou === 'partage' ? (
          <p className="rounded-[0.7rem] border border-bordure bg-surface px-3 py-3 text-courant leading-relaxed text-texte-doux">
            Restaurer une sauvegarde n'est pas possible depuis cet onglet : l'application est ouverte
            dans un autre onglet, et c'est lui qui enregistre. Fermez-le, rechargez cette page, puis
            recommencez.
          </p>
        ) : (
          /* Le champ de fichier natif est masqué et porté par un `label` : c'est le motif déjà
             employé par l'import de recette (`recettes.tsx`), et le seul qui donne une cible tactile
             correcte sans réimplémenter un sélecteur de fichiers. */
          <label className="flex min-h-tactile w-full cursor-pointer items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-courant font-semibold text-texte-doux">
            Restaurer une sauvegarde
            <input
              type="file"
              accept=".nutri-backup,application/octet-stream"
              aria-label="Restaurer une sauvegarde (.nutri-backup)"
              className="sr-only"
              onChange={(e) => {
                const fichier = e.target.files?.[0]
                // Vidé tout de suite : sans ça, rechoisir LE MÊME fichier après une erreur ne
                // déclencherait aucun `change`.
                e.target.value = ''
                if (fichier !== undefined) setPhase({ type: 'confirmation', fichier })
              }}
            />
          </label>
        )}
      </div>

      {phase.type === 'erreur' && (
        <p role="alert" className="mt-4 text-courant leading-relaxed text-texte">
          {phase.motif}
        </p>
      )}
    </div>
  )
}

function Section({ titre, children }: { readonly titre: string; readonly children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-titre text-titre-m text-texte">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/**
 * « À propos » — §6 STRATEGIE_DISTRIBUTION.
 *
 * ⚠️ AUCUNE SOLLICITATION, et c'est une décision, pas un oubli : « pas de page de don, pas de
 * Ko-fi/Liberapay, aucune sollicitation. L'appli est gratuite, point. » Ce bloc informe, ne débloque
 * rien et ne demande rien.
 *
 * ⚠️ ADRESSE DE PROJET, JAMAIS PERSONNELLE. Play publie le contact du développeur en clair sur la
 * fiche du store ; une adresse personnelle sur une page publique ne se reprend pas.
 *
 * Rendu à l'intérieur d'un `Panneau` : pas de titre ici, le panneau le porte déjà dans son en-tête.
 */
function APropos() {
  return (
    <div className="space-y-3 rounded-[--radius-carte] border border-bordure bg-surface p-4 text-courant leading-relaxed text-texte-doux">
      <p>
        Application gratuite, sans publicité, sans compte et sans mesure d'audience. Aucune recette
        n'est sponsorisée ni placée par une marque.
      </p>
      <p>
        Elle est écrite par un développeur indépendant, seul, qui fait passer les gens qui l'utilisent
        avant le reste.
      </p>
      <p className="text-texte">
        Une remarque, un bug, une recette qui cloche :{' '}
        <a href={`mailto:${CONTACT}`} className="text-accent-texte underline">
          {CONTACT}
        </a>
      </p>
    </div>
  )
}

/**
 * ⚠️ À REMPLACER PAR UNE VRAIE ADRESSE DE PROJET AVANT PUBLICATION. Laissée en évidence plutôt que
 * masquée : une adresse d'exemple qui part sur le Play Store est un contact que personne ne relève.
 */
const CONTACT = 'contact@example.org'
/**
 * « Aliments que je ne veux pas » — les sept groupes d'origine animale, dépliables jusqu'à l'aliment.
 *
 * ⚠️ CE N'EST PAS UN ÉCRAN D'ALLERGIES ET IL NE DOIT JAMAIS LE DEVENIR. Un régime est une
 * préférence, une allergie un fait médical : « Mes allergies » vit à part, se lit dans une autre
 * table et n'est jamais pondérée (§5.2 ARCHITECTURE). Mélanger les deux ferait déclarer une allergie
 * à quelqu'un qui n'aime simplement pas ça, et réciproquement.
 *
 * ⚠️ COCHER ENREGISTRE LE GROUPE, PAS SES ALIMENTS. C'est la décision structurante du lot : un
 * aliment ajouté au catalogue APRÈS le cochage entre dans le groupe déjà coché. Le défaut évité est
 * silencieux — enregistrer les sept œufs d'aujourd'hui aurait servi le huitième, ajouté le mois
 * prochain, à quelqu'un qui avait justement coché « Œufs ». Le dépliage vit dans
 * `readExcludedFoodIdsDeplies` (data/user-store.ts), jamais ici.
 *
 * ⚠️ LES GROUPES DÉJÀ ÉCARTÉS PAR LE RÉGIME DÉCLARÉ SONT AFFICHÉS, PAS MASQUÉS. Un végétarien doit
 * VOIR que « Viande de mammifère » est écarté, et par quoi — sinon l'écran ment par omission sur ce
 * qui filtre ses suggestions. Ils sont montrés comme déjà écartés, sans case : les ré-admettre
 * toucherait la couche `regime`, qui reste 🔒 critique, et c'est un autre lot.
 *
 * ⚠️ LE DÉCOMPTE DE PLATS RESTANTS EST UN CARDINAL, JAMAIS UNE NOTE. « 38 plats » se lit ; un score
 * du moteur à côté d'un choix de l'utilisateur se lirait comme un jugement (principe 6). Il informe
 * et ⛔ ne bloque RIEN : aucune case n'est refusée, aucune n'est grisée par le compte. L'utilisateur
 * a le droit de se mettre dans une impasse ; il a le droit de le savoir avant.
 *
 * Rendu à l'intérieur d'un `Panneau` : pas de titre ici, le panneau le porte déjà dans son en-tête.
 */
function AlimentsEcartes({
  groupes,
  foods,
  regime,
  groupesRetires,
  alimentsRetires,
  exceptions,
  comptes,
  onPreselection,
  onGroupe,
  onAliment,
}: {
  readonly groupes: readonly GroupeAnimal[]
  readonly foods: ReadonlyMap<FoodId, Food>
  readonly regime: DietCode | null
  readonly groupesRetires: ReadonlySet<GroupeAnimalId>
  readonly alimentsRetires: ReadonlySet<FoodId>
  readonly exceptions: ReadonlySet<FoodId>
  readonly comptes: readonly PlatsDuCreneau[]
  readonly onPreselection: (ajouts: readonly GroupeAnimalId[]) => void
  readonly onGroupe: (groupeId: GroupeAnimalId, retire: boolean) => void
  readonly onAliment: (foodId: FoodId, retire: boolean, groupeRetire: boolean) => void
}) {
  const [deplie, setDeplie] = useState<GroupeAnimalId | null>(null)
  const preselections = regime === null ? [] : (PRESELECTIONS[regime] ?? [])

  return (
    <>
      <p className="mb-3 text-courant leading-relaxed text-texte-doux">
        Ces aliments ne vous seront plus proposés. Cochez un groupe entier, ou dépliez-le pour n'en
        retirer qu'une partie. Une allergie se déclare ailleurs, dans « Mes allergies ».
      </p>

      {preselections.length > 0 && (
        <div className="mb-3 space-y-2">
          {preselections.map((preselection) => (
            <button
              key={preselection.libelle}
              type="button"
              onClick={() => onPreselection(preselection.groupes)}
              className="flex min-h-tactile w-full flex-col items-start justify-center rounded-[--radius-carte] border border-bordure-forte bg-fond px-4 py-2 text-left"
            >
              <span className="text-lecture font-semibold text-texte">{preselection.libelle}</span>
              <span className="text-mention leading-snug text-attenue">
                {preselection.explication} Ce bouton coche, il ne décoche jamais.
              </span>
            </button>
          ))}
        </div>
      )}

      <ComptesParCreneau comptes={comptes} />

      <div className="space-y-2">
        {groupes.map((groupe) => {
          const parLeRegime = ecarteParLeRegime(groupe, foods, regime)
          const retire = groupesRetires.has(groupe.id)
          const ouvert = deplie === groupe.id
          const libelle = `${groupe.libelle} (${groupe.aliments.length})`

          return (
            <div key={groupe.id}>
              {parLeRegime ? (
                <p className="rounded-[--radius-carte] border border-bordure bg-fond px-4 py-3 text-lecture text-texte-doux">
                  {libelle}
                  <span className="block text-mention leading-snug text-attenue">
                    Déjà écarté par votre régime : {LIBELLE_REGIME[regime as DietCode] ?? regime}.
                  </span>
                </p>
              ) : (
                <Case
                  libelle={libelle}
                  cochee={retire}
                  onBasculer={() => onGroupe(groupe.id, !retire)}
                />
              )}

              {/* Dépliant INTERNE au panneau, pas un menu : `aria-expanded` est ici légitime, il
                  décrit une liste qui pousse le contenu, pas l'ouverture d'une fenêtre. Même forme
                  que « Voir les allergènes réglementaires » juste à côté. */}
              <button
                type="button"
                onClick={() => setDeplie(ouvert ? null : groupe.id)}
                aria-expanded={ouvert}
                className="mt-1 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-courant font-semibold text-texte-doux"
              >
                {ouvert ? 'Masquer le détail' : `Voir les ${groupe.aliments.length} aliments`}
              </button>

              {ouvert && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {groupe.aliments.map((aliment) =>
                    parLeRegime ? (
                      <p
                        key={aliment.id}
                        className="rounded-[--radius-carte] border border-bordure bg-fond px-4 py-2 text-lecture text-attenue"
                      >
                        {aliment.nom}
                      </p>
                    ) : (
                      <Case
                        key={aliment.id}
                        libelle={aliment.nom}
                        cochee={retire ? !exceptions.has(aliment.id) : alimentsRetires.has(aliment.id)}
                        onBasculer={() =>
                          onAliment(
                            aliment.id,
                            retire ? exceptions.has(aliment.id) : !alimentsRetires.has(aliment.id),
                            retire
                          )
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/**
 * « Mes exceptions » — les aliments admis MALGRÉ le régime déclaré (lot D3).
 *
 * ⛔ UN SECOND PANNEAU, SÉPARÉ DE « ALIMENTS QUE JE NE VEUX PAS », ET C'EST STRUCTUREL. Décision
 * utilisateur : le même écran qui laisse RÉADMETTRE le miel ne doit jamais laisser réadmettre
 * l'arachide. Les deux panneaux vont en sens inverse — l'un retire, l'autre reprend — et fusionner
 * deux directions opposées dans une liste de cases rendrait la confusion plus dure à défaire qu'une
 * vigilance. C'est le garde-fou 1 (« les allergènes ne passent jamais par ces écrans ») rendu
 * structurel plutôt que rappelé.
 *
 * ⛔ AUCUNE CASE DE GROUPE, ET LE SCHÉMA L'A DÉCIDÉ AVANT L'ÉCRAN : `user_admitted_food` stocke un
 * `food_id`, il n'existe aucune table d'admission par groupe. Le groupe ne sert qu'à NAVIGUER.
 *
 * ⛔ AUCUNE CASE SANS EFFET. Deux causes, deux motifs affichés, jamais une case grisée qui promettrait
 * quelque chose : l'allergène (garde-fou 1, P4 du lot D1) et le retrait personnel (préséance tranchée
 * en D2). ⚠️ ON AFFICHE PLUTÔT QUE DE MASQUER — même parti que le panneau voisin : quelqu'un qui
 * cherche « Miel » et ne le trouve nulle part conclut à un bug ; le lire « déjà écarté par votre
 * allergie » lui dit ce qui filtre et OÙ ça se règle.
 *
 * ⚠️ LE COMPTEUR EST RAPPELÉ ICI, et il monte au lieu de descendre — c'est le seul panneau où cocher
 * AJOUTE des plats. Il reste un cardinal, jamais une note (principe 6).
 *
 * Rendu à l'intérieur d'un `Panneau` : pas de titre ici, le panneau le porte déjà dans son en-tête.
 */
function ExceptionsRegime({
  groupes,
  regime,
  admissions,
  comptes,
  onAliment,
}: {
  readonly groupes: readonly GroupeAdmissible[]
  readonly regime: DietCode | null
  readonly admissions: ReadonlySet<FoodId>
  readonly comptes: readonly PlatsDuCreneau[]
  readonly onAliment: (foodId: FoodId, admis: boolean) => void
}) {
  const [deplie, setDeplie] = useState<GroupeAnimalId | null>(null)

  return (
    <>
      <p className="mb-3 text-courant leading-relaxed text-texte-doux">
        Ces aliments-là vous seront proposés malgré votre régime
        {regime === null ? '' : ` (${LIBELLE_REGIME[regime] ?? regime})`}. Dépliez un groupe et cochez
        aliment par aliment. Une allergie ne se reprend pas ici : elle se règle dans « Mes allergies ».
      </p>

      <ComptesParCreneau comptes={comptes} />

      <div className="space-y-2">
        {groupes.map((groupe) => {
          const ouvert = deplie === groupe.id
          const admis = groupe.aliments.filter((a) => a.blocage === null && admissions.has(a.food.id))

          return (
            <div key={groupe.id}>
              {/* ⚠️ UN INTITULÉ, PAS UNE CASE. Le groupe n'est pas cochable, il ouvre. */}
              <p className="rounded-[--radius-carte] border border-bordure bg-fond px-4 py-3 text-lecture text-texte">
                {groupe.libelle} ({groupe.aliments.length})
                {admis.length > 0 && (
                  <span className="block text-mention leading-snug text-attenue">
                    Vous acceptez : {admis.map((a) => a.food.nom).join(', ')}.
                  </span>
                )}
              </p>

              {/* Dépliant INTERNE au panneau, pas un menu : `aria-expanded` est légitime ici, il
                  décrit une liste qui pousse le contenu. Même forme que le panneau voisin. */}
              <button
                type="button"
                onClick={() => setDeplie(ouvert ? null : groupe.id)}
                aria-expanded={ouvert}
                className="mt-1 flex min-h-tactile w-full items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond px-4 text-courant font-semibold text-texte-doux"
              >
                {ouvert ? 'Masquer le détail' : `Voir les ${groupe.aliments.length} aliments`}
              </button>

              {ouvert && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {groupe.aliments.map(({ food, blocage }) =>
                    blocage === null ? (
                      <Case
                        key={food.id}
                        libelle={food.nom}
                        cochee={admissions.has(food.id)}
                        onBasculer={() => onAliment(food.id, !admissions.has(food.id))}
                      />
                    ) : (
                      <p
                        key={food.id}
                        className="rounded-[--radius-carte] border border-bordure bg-fond px-4 py-2 text-lecture text-attenue"
                      >
                        {food.nom}
                        <span className="block text-mention leading-snug">
                          {blocage === 'allergene'
                            ? 'Écarté par une allergie que vous avez déclarée. Ça se règle dans « Mes allergies ».'
                            : 'Vous l’avez retiré dans « Aliments que je ne veux pas ».'}
                        </span>
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/**
 * Ce groupe est-il DÉJÀ écarté en entier par le régime déclaré ?
 *
 * ⚠️ AUCUNE RÈGLE DE RÉGIME N'EST RÉÉCRITE ICI : on compose `regimeExigePar` et `DIET_CHAIN`, les
 * deux exports du moteur qui la portent. Une deuxième version de « le poisson n'est pas végétarien »
 * dans un composant React divergerait de la première au premier ajustement, et c'est l'écran qui
 * aurait tort sans que rien ne le dise.
 *
 * ⚠️ `every`, PAS `some`, et la polarité est délibérée. Un groupe dont un seul aliment reste
 * proposable garde sa case : mieux vaut afficher une case qui ne retire presque rien que d'en
 * désactiver une qui aurait encore un effet.
 */
function ecarteParLeRegime(
  groupe: GroupeAnimal,
  foods: ReadonlyMap<FoodId, Food>,
  regime: DietCode | null
): boolean {
  return groupe.aliments.every((f) => alimentEcarteParLeRegime(f, foods, regime))
}

/**
 * Le même test, POUR UN SEUL ALIMENT — c'est lui qui décide ce que « Mes exceptions » propose.
 *
 * ⚠️ EXTRAIT DE `ecarteParLeRegime`, PAS RÉÉCRIT À CÔTÉ. Les deux répondent à la même question à
 * deux granularités ; en écrire deux versions les aurait fait diverger au premier ajustement, et
 * l'un des deux écrans aurait eu tort sans que rien ne le dise. La règle elle-même reste dans le
 * moteur (`regimeExigePar` + `DIET_CHAIN`), on ne fait que la composer.
 */
function alimentEcarteParLeRegime(
  food: Food,
  foods: ReadonlyMap<FoodId, Food>,
  regime: DietCode | null
): boolean {
  if (regime === null) return false
  const rangDemande = DIET_CHAIN.indexOf(regime)
  if (rangDemande < 0) return false
  return DIET_CHAIN.indexOf(regimeExigePar(food, foods)) > rangDemande
}

/**
 * Pourquoi cet aliment n'est PAS proposé à l'admission, quand il ne l'est pas.
 *
 * ⛔ `'allergene'` NE DONNE JAMAIS DE CASE. Garde-fou 1 : les allergènes ne passent pas par cet
 * écran, sous aucune forme. P4 (lot D1) garantit qu'admettre n'atteint pas la couche `allergenes` —
 * une case cochable ici promettrait donc quelque chose qu'elle ne tient pas, ce qui est pire que son
 * absence. Elle se règle dans « Mes allergies », et la ligne le dit.
 *
 * ⛔ `'ecarte'` NON PLUS. D2 a tranché la préséance `exclusion personnelle > admission`, et
 * DÉLIBÉRÉMENT sans arbitrage à la lecture — le moteur reçoit les deux listes pour que P4 reste
 * testable. Côté écran, la conséquence est qu'une case y serait sans effet.
 */
type BlocageException = 'allergene' | 'ecarte' | null

function blocageDe(
  food: Food,
  allergenesDeclares: ReadonlySet<string>,
  exclus: ReadonlySet<FoodId>
): BlocageException {
  // L'ordre compte : un aliment à la fois allergène et écarté se nomme par le motif le plus fort.
  // ⚠️ `certitude` N'EST PAS CONSULTÉE, et c'est la couche `allergenes` qui l'a décidé : « traces »
  // exclut au même titre que « contient ». Lire ce champ ici rouvrirait l'écart entre l'écran et le
  // moteur que ce fichier passe son temps à éviter.
  if (food.allergenes.some((a) => allergenesDeclares.has(a.allergenId))) return 'allergene'
  if (exclus.has(food.id)) return 'ecarte'
  return null
}

/** Un aliment de « Mes exceptions », avec la raison de son absence de case s'il y en a une. */
interface AlimentAdmissible {
  readonly food: Food
  readonly blocage: BlocageException
}

/** Un groupe de « Mes exceptions » — mêmes libellés que « Aliments que je ne veux pas ». */
interface GroupeAdmissible {
  readonly id: GroupeAnimalId
  readonly libelle: string
  readonly aliments: readonly AlimentAdmissible[]
}

/**
 * Ce que « Mes exceptions » a le droit de montrer : les aliments que le RÉGIME DÉCLARÉ écarte, et
 * eux seuls, regroupés comme dans le panneau voisin.
 *
 * ⛔ LE GROUPE NE SERT QU'À NAVIGUER. Il n'y a pas de case de groupe et il n'y en aura pas : le
 * schéma l'a déjà décidé — `user_admitted_food` stocke un `food_id`, il n'existe aucune table
 * d'admission par groupe. « Admettre tous les produits laitiers » ferait d'un végétalien autre chose
 * qu'un végétalien ; ça ne s'appelle pas une exception, ça s'appelle changer de régime, et « Mon
 * régime » est là pour ça. 167 cases à plat sont illisibles, 7 groupes dépliables sont un écran.
 *
 * ⚠️ UN GROUPE PARTIELLEMENT ÉCARTÉ NE GARDE QUE SES ALIMENTS ÉCARTÉS. Le filtre est par aliment,
 * pas par groupe : un pescétarien voit les viandes, pas les poissons, et la question ne se pose même
 * pas pour un groupe où tout reste proposable — il disparaît de la liste.
 */
function groupesAdmissibles(
  groupes: readonly GroupeAnimal[],
  foods: ReadonlyMap<FoodId, Food>,
  regime: DietCode | null,
  allergenesDeclares: ReadonlySet<string>,
  exclus: ReadonlySet<FoodId>
): readonly GroupeAdmissible[] {
  return groupes.flatMap((groupe) => {
    const aliments = groupe.aliments
      .filter((food) => alimentEcarteParLeRegime(food, foods, regime))
      .map((food) => ({ food, blocage: blocageDe(food, allergenesDeclares, exclus) }))
    return aliments.length === 0 ? [] : [{ id: groupe.id, libelle: groupe.libelle, aliments }]
  })
}

/**
 * Les admissions qui AGISSENT — celles dont la case existe et est cochée.
 *
 * ⚠️ CE N'EST PAS `vue.admissions`. Une ligne en base peut survivre à un changement de régime, à une
 * allergie déclarée après coup ou à un retrait dans « Aliments que je ne veux pas » ; elle est alors
 * inerte, et c'est voulu (rien n'est effacé dans le dos de l'utilisateur — décocher « végétalien »
 * puis le recocher retrouve ses exceptions). Mais l'annoncer dans le libellé du régime le ferait
 * mentir. Ce que le moteur reçoit reste `vue.admissions`, en entier : ici on ne fait qu'AFFICHER.
 */
function admissionsEffectives(
  admissibles: readonly GroupeAdmissible[],
  admissions: ReadonlySet<FoodId>
): readonly Food[] {
  return admissibles.flatMap((groupe) =>
    groupe.aliments.filter((a) => a.blocage === null && admissions.has(a.food.id)).map((a) => a.food)
  )
}

/**
 * Un raccourci nommé : les groupes qu'il COCHE, et rien d'autre.
 *
 * ⛔ RIEN NE PERSISTE LE NOM. Ce qui part en base reste `user_excluded_group`, inchangé — un nom
 * stocké se désynchroniserait des cases dès le premier cochage manuel, et l'écran afficherait
 * « lacto-végétarien » à quelqu'un qui a repris les œufs. Le nom ne vit que le temps du clic.
 */
interface Preselection {
  readonly libelle: string
  readonly explication: string
  readonly groupes: readonly GroupeAnimalId[]
}

/**
 * ⚠️ UNE PRÉSÉLECTION N'EST OFFERTE QUE SOUS LE RÉGIME QUI LA REND SENSÉE. « Lacto-végétarien » ne
 * veut rien dire pour un omnivore : le proposer ouvrirait un SECOND chemin vers un état que la
 * couche `regime` porte déjà, avec deux écrans qui décrivent la même chose sans se parler. ⛔ On ne
 * propose donc pas « devenir végétarien » par ces cases — ça se déclare dans « Mon régime ».
 *
 * ⚠️ `vegetalien` ET `omnivore` N'EN ONT AUCUNE, ET C'EST UNE ABSENCE RAISONNÉE, pas un oubli. Le
 * végétalien a déjà tout écarté ; l'omnivore n'a rien à raccourcir qui ne soit un régime déclaré.
 *
 * 📌 PAS DE BOUTON « OVO-LACTO-VÉGÉTARIEN », contrairement à ce que listait
 * `docs/CONCEPTION_REGIME_PERSONNALISE.md` (corrigé dans le même lot). Sous la règle ci-dessus,
 * c'est l'état PAR DÉFAUT de `vegetarien` : un bouton qui ne cocherait rien, donc un bouton dont le
 * clic ne produit aucun changement visible — la pire forme de commande.
 *
 * Clé `string` parce que `DietCode` en est un (vocabulaire ouvert, `domain/catalog.ts`) ; un régime
 * inconnu retombe sur « aucune présélection », ce qui est le bon défaut.
 */
const PRESELECTIONS: Readonly<Record<string, readonly Preselection[]>> = {
  vegetarien: [
    {
      libelle: 'Lacto-végétarien',
      explication: 'Les produits laitiers restent, les œufs partent.',
      groupes: ['oeufs'],
    },
    {
      libelle: 'Ovo-végétarien',
      explication: 'Les œufs restent, les produits laitiers partent.',
      groupes: ['laitiers'],
    },
  ],
  pescetarien: [
    {
      libelle: 'Sans fruits de mer',
      explication: 'Le poisson reste, coquillages et crustacés partent.',
      groupes: ['fruits_de_mer'],
    },
  ],
}

/**
 * ⚠️ LES DEUX SEUILS NE DISENT PAS LA MÊME CHOSE, ET « IMPOSSIBLE » EST PLUS FORT QUE LE FAIT.
 * Vérifié dans le moteur, pas déduit — voir `EtatDuCreneau` (engine/domain/plats-par-creneau.ts) :
 *
 * - à 0, `suggestMeals` LÈVE et le créneau ne peut réellement pas être rempli ;
 * - en dessous d'une semaine, `planWeek` ne répète PAS — `pickForSlot` écarte tout plat déjà placé
 *   dans ses deux passes, puis rend `null`. Les jours en trop ressortent VIDES. Écrire « votre
 *   planning sera répétitif » serait faux, et « impossible » le serait aussi, dans le sens qui fait
 *   peur : la couche `variety` pénalise la répétition, elle ne l'interdit pas.
 */
const AVERTISSEMENT_CRENEAU: Readonly<Record<Exclude<EtatDuCreneau, 'suffisant'>, string>> = {
  vide: 'Aucun plat ne reste pour ce repas : il ne pourra pas être proposé, et un planning laissera sa case vide.',
  court: `Moins de plats que les ${DEFAULT_PLAN_DAYS} jours d'une semaine n'en demandent. Un planning ne sert jamais deux fois le même plat : les jours en trop resteront vides.`,
}

/**
 * « Il reste, avec vos choix » — un compte PAR CRÉNEAU, jamais un total.
 *
 * ⚠️ UN TOTAL GLOBAL PEUT ÊTRE VERT PENDANT QU'UN CRÉNEAU EST DÉJÀ VIDE. Le banc a mesuré cette
 * panne exacte : « végétalien + sans gluten », 28 plats pour 28 créneaux, marge zéro — une exclusion
 * de plus vidait un créneau sans que le total le montre.
 *
 * ⚠️ SEULS LES CRÉNEAUX QUE L'UTILISATEUR PLANIFIE sont comptés (`creneauxDuRythme`) : afficher le
 * goûter à qui mange deux fois par jour est du bruit, et un avertissement de bruit ne se lit plus.
 *
 * ⚠️ NI COULEUR, NI SCORE, NI BLOCAGE. Le nombre est un cardinal, l'avertissement une phrase ; rien
 * n'est rouge, rien n'est grisé, aucune case n'est refusée (principes 1 et 6).
 */
function ComptesParCreneau({ comptes }: { readonly comptes: readonly PlatsDuCreneau[] }) {
  if (comptes.length === 0) return null

  return (
    <div className="mb-3 rounded-[--radius-carte] border border-bordure bg-fond px-4 py-3">
      <p className="text-courant font-semibold text-texte">Il reste, avec vos choix :</p>
      <ul className="mt-2 space-y-2">
        {comptes.map(({ creneau, plats, etat }) => (
          <li key={creneau} className="text-lecture text-texte-doux">
            <span className="font-semibold text-texte">{LIBELLE_CRENEAU[creneau]}</span> {plats}{' '}
            plat{plats === 1 ? '' : 's'}
            {etat !== 'suffisant' && (
              <span className="mt-1 block text-mention leading-snug text-texte-doux">
                {AVERTISSEMENT_CRENEAU[etat]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
