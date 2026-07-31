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
// déclaré une allergie alors que rien n'est parti en base. Le geste est le contrat.
//
// ⚠️ CE N'EST PAS UN SIXIÈME ONGLET (§2 DESIGN, cinq onglets stables) — on y arrive par l'engrenage
// de l'en-tête, présent sur tous les écrans. Voir `router.tsx`.

import { useCallback, useEffect, useState } from 'react'
import type { AllergenId, Catalog } from '../../engine/domain/index.js'
import {
  readDisplay,
  writeAllergies,
  writeDiet,
  writeDisplay,
  writeRythme,
  type StoredDisplay,
} from '../../data/user-store.js'
import { chargerSocle } from '../socle.js'
import { Case, ChoixAllergenes, ChoixRegime, ChoixRythme } from '../champs-profil.js'
import { lireChoixProfil, type ChoixProfil } from '../profil-enregistre.js'

/**
 * ⚠️ LA VUE RÉUTILISE `ChoixProfil`, elle n'en redéclare pas une variante. Cet écran portait sa
 * propre constante de rythme par défaut, dupliquée de l'accueil : deux valeurs différentes auraient
 * fait qu'ouvrir Paramètres sans rien toucher CHANGE les suggestions. Une seule définition, dans
 * `ui/profil-enregistre.ts`, avec la lecture et l'écriture qui vont avec.
 */
interface Vue extends ChoixProfil {
  readonly catalogue: Catalog
  readonly affichage: StoredDisplay
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly vue: Vue }
  | { readonly phase: 'erreur'; readonly message: string }

async function lireVue(): Promise<Vue> {
  const socle = await chargerSocle()
  return {
    ...lireChoixProfil(socle.db),
    catalogue: socle.catalogue,
    affichage: readDisplay(socle.db),
  }
}

export function Parametres() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

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

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">
          Les réglages n'ont pas pu être enregistrés.
        </p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  const { vue } = etat

  return (
    <section>
      <h1 className="text-[2.1rem] text-texte">Paramètres</h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-attenue">
        Tout se modifie à tout moment. Rien n'est envoyé nulle part.
      </p>

      <Section titre="Mes allergies">
        <p className="mb-3 text-[0.95rem] leading-relaxed text-texte-doux">
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
      </Section>

      <Section titre="Mon régime">
        <ChoixRegime
          catalogue={vue.catalogue}
          choisi={vue.regime}
          onChange={(regime) => appliquer({ ...vue, regime }, (db) => writeDiet(db, regime))}
        />
      </Section>

      <Section titre="Mon rythme">
        <ChoixRythme
          rythme={vue.rythme}
          onChange={(rythme) => appliquer({ ...vue, rythme }, (db) => writeRythme(db, rythme))}
        />
      </Section>

      <Section titre="Affichage">
        <div className="space-y-2">
          {/* ⚠️ `readDisplay` PUIS étalement dans chaque écriture : `writeDisplay` remplace la ligne
              entière, un champ omis repartirait au défaut du schéma. */}
          <Case
            libelle="Changer de plat en balayant l'écran"
            description="Les flèches restent là dans tous les cas."
            cochee={vue.affichage.gestesBalayage}
            onBasculer={() => {
              const affichage = { ...vue.affichage, gestesBalayage: !vue.affichage.gestesBalayage }
              appliquer({ ...vue, affichage }, (db) => writeDisplay(db, affichage))
            }}
          />
          <Case
            libelle="Alertes de la semaine en version courte"
            description="Le repère reste visible ; seul le détail jour par jour se replie."
            cochee={vue.affichage.alertesDiscretes}
            onBasculer={() => {
              const affichage = {
                ...vue.affichage,
                alertesDiscretes: !vue.affichage.alertesDiscretes,
              }
              appliquer({ ...vue, affichage }, (db) => writeDisplay(db, affichage))
            }}
          />
          <Case
            libelle="Afficher les valeurs nutritionnelles détaillées"
            description="Sur la fiche d'une recette, pour cette portion."
            cochee={vue.affichage.afficherMacros}
            onBasculer={() => {
              const affichage = { ...vue.affichage, afficherMacros: !vue.affichage.afficherMacros }
              appliquer({ ...vue, affichage }, (db) => writeDisplay(db, affichage))
            }}
          />
        </div>
      </Section>

      <APropos />
    </section>
  )
}

function Section({ titre, children }: { readonly titre: string; readonly children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-titre text-[1.4rem] text-texte">{titre}</h2>
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
 */
function APropos() {
  return (
    <section className="mt-8">
      <h2 className="font-titre text-[1.4rem] text-texte">À propos</h2>
      <div className="mt-3 space-y-3 rounded-[--radius-carte] border border-bordure bg-surface p-4 text-[0.98rem] leading-relaxed text-texte-doux">
        <p>
          Application gratuite, sans publicité, sans compte et sans mesure d'audience. Aucune recette
          n'est sponsorisée ni placée par une marque.
        </p>
        <p>
          Elle est écrite par un développeur indépendant, seul, qui fait passer les gens qui
          l'utilisent avant le reste.
        </p>
        <p className="text-texte">
          Une remarque, un bug, une recette qui cloche :{' '}
          <a href={`mailto:${CONTACT}`} className="text-accent-texte underline">
            {CONTACT}
          </a>
        </p>
      </div>
    </section>
  )
}

/**
 * ⚠️ À REMPLACER PAR UNE VRAIE ADRESSE DE PROJET AVANT PUBLICATION. Laissée en évidence plutôt que
 * masquée : une adresse d'exemple qui part sur le Play Store est un contact que personne ne relève.
 */
const CONTACT = 'contact@example.org'
