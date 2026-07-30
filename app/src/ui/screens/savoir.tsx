// ui/screens/savoir.tsx — écran « Savoir » (§4.7 DESIGN).
//
// §4.7 décrit quatre sections. Deux existent, deux non, et l'écran le DIT au lieu d'afficher des
// blocs vides :
//
//   ✅ « Le saviez-vous ? »   — 8 tips, tous `biologie_aliment` (voir catalog/tips/README.md)
//   ✅ « Gestes de cuisine »  — 62 fiches
//   ⛔ « Comprendre »          — `HealthTopic` est un type SANS TABLE, marqué v2 par §4.7 elle-même
//   ✅ « Sources et limites » — lien permanent exigé par §4.7
//
// ⚠️ LES TIPS NE SONT QUE DES FAITS, ET C'EST STRUCTUREL. Les huit livrés sont de catégorie
// `biologie_aliment` : aucun ne porte d'affirmation de santé. §6.1 fait de l'application une
// bibliothèque consultable, jamais un prescripteur — « la tomate est botaniquement un fruit » est un
// tip, « mangez des tomates » n'en serait pas un. Le jour où des tips `nutrition_humaine`
// arriveront, ils tomberont sous §6.1 et §6.2, et le lint du build les bloquera s'ils dérapent.
//
// ⚠️ `nutrition_animale` DOIT RESTER VISUELLEMENT DISTINCT (§8.4) : c'est du contenu culturel, pas
// un conseil applicable à soi. Aucun tip de cette catégorie n'existe encore ; la distinction est
// codée d'avance pour qu'on ne l'oublie pas le jour où le premier arrive.
//
// ⚠️ LES GESTES SONT DU TEXTE SEUL. §4.7 prévoit « définition simple + animation muette en boucle »
// et §8.5 annonce un lexique illustré : il n'existe ni image ni clip. L'écran ne fait pas semblant.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Catalog, LexiconEntry, Tip, TipCategorie } from '../../engine/domain/index.js'
import { normaliser } from '../../engine/search/index.js'
import { chargerSocle } from '../socle.js'

/**
 * Mise en forme par catégorie (§8.4).
 *
 * `nutrition_animale` porte une mention explicite : sans elle, un fait sur l'alimentation du chat
 * se lit comme un conseil pour soi.
 */
const CATEGORIE: Readonly<Record<TipCategorie, { readonly mention: string | null }>> = {
  biologie_aliment: { mention: null },
  nutrition_humaine: { mention: null },
  nutrition_animale: { mention: 'À propos des animaux' },
}

type Etat =
  | { readonly phase: 'chargement' }
  | { readonly phase: 'pret'; readonly catalogue: Catalog }
  | { readonly phase: 'erreur'; readonly message: string }

export function Savoir() {
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' })

  useEffect(() => {
    let annule = false
    chargerSocle()
      .then((socle) => {
        if (!annule) setEtat({ phase: 'pret', catalogue: socle.catalogue })
      })
      .catch((erreur: unknown) => {
        if (!annule) {
          setEtat({ phase: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) })
        }
      })
    return () => {
      annule = true
    }
  }, [])

  if (etat.phase === 'chargement') return <p className="text-attenue">Chargement…</p>
  if (etat.phase === 'erreur') {
    return (
      <div role="alert">
        <p className="text-[1.05rem] font-semibold text-texte">Le catalogue n'a pas pu être lu.</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  return (
    <section>
      <h1 className="text-[2.1rem] text-texte">Savoir</h1>

      <LeSaviezVous tips={etat.catalogue.tips} />
      <Gestes lexique={[...etat.catalogue.lexicon.values()]} />
      <Comprendre />
      <SourcesEtLimites />
    </section>
  )
}

/**
 * Carrousel « Le saviez-vous ? » (§4.7).
 *
 * ⚠️ FLÈCHES VISIBLES, pas seulement le glissement. Le bloc commun des maquettes est explicite :
 * « aucune action accessible uniquement par un geste ; tout swipe a un bouton visible ».
 */
function LeSaviezVous({ tips }: { readonly tips: readonly Tip[] }) {
  const [index, setIndex] = useState(0)

  if (tips.length === 0) {
    return (
      <Bloc titre="Le saviez-vous ?">
        <p className="text-[1.02rem] leading-relaxed text-attenue">
          Aucun fait à afficher pour l'instant.
        </p>
      </Bloc>
    )
  }

  // Modulo pour boucler dans les deux sens : arriver au bout d'un carrousel et se retrouver bloqué
  // est le genre d'impasse qu'on ne remarque qu'en l'utilisant.
  const tip = tips[((index % tips.length) + tips.length) % tips.length]!
  const mention = CATEGORIE[tip.categorie].mention

  return (
    <Bloc titre="Le saviez-vous ?">
      <div className="rounded-[--radius-carte] border border-bordure bg-surface p-4">
        {mention !== null && (
          <p className="mb-2 text-[0.82rem] font-semibold uppercase tracking-wide text-attenue">
            {mention}
          </p>
        )}
        <p className="text-[1.08rem] leading-relaxed text-texte">{tip.texte}</p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex(index - 1)}
          aria-label="Fait précédent"
          className="flex min-h-tactile w-14 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond text-[1.2rem] text-texte-doux"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setIndex(index + 1)}
          aria-label="Fait suivant"
          className="flex min-h-tactile w-14 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond text-[1.2rem] text-texte-doux"
        >
          →
        </button>
        <span className="text-[0.9rem] tabular-nums text-attenue">
          {(((index % tips.length) + tips.length) % tips.length) + 1} sur {tips.length}
        </span>
      </div>
    </Bloc>
  )
}

/** Grille des gestes de cuisine, avec recherche et définition dépliable. */
function Gestes({ lexique }: { readonly lexique: readonly LexiconEntry[] }) {
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)

  const trouves = useMemo(() => {
    const cherche = normaliser(recherche.trim())
    if (cherche === '') return lexique
    // Recherche dans le TERME et la DÉFINITION : on cherche parfois « comment on appelle le fait
    // de… » sans connaître le mot, ce qui est précisément l'usage d'un lexique.
    return lexique.filter(
      (e) => normaliser(e.terme).includes(cherche) || normaliser(e.definition).includes(cherche)
    )
  }, [lexique, recherche])

  return (
    <Bloc titre="Gestes de cuisine">
      <label className="block">
        <span className="text-[0.9rem] text-texte-doux">Chercher un geste</span>
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="blanchir, émincer, chemiser…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-[1.05rem] text-texte"
        />
      </label>

      <p className="mt-2 text-[0.9rem] text-attenue">
        {trouves.length} geste{trouves.length > 1 ? 's' : ''}
      </p>

      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {trouves.map((entree) => {
          const deplie = ouvert === entree.id
          return (
            <li key={entree.id} className="rounded-[--radius-carte] border border-bordure bg-surface">
              <button
                type="button"
                onClick={() => setOuvert(deplie ? null : entree.id)}
                aria-expanded={deplie}
                className="flex min-h-tactile w-full items-center justify-between gap-2 px-3 text-left text-[1.05rem] font-semibold text-texte"
              >
                {entree.terme}
                <span aria-hidden="true" className="text-attenue">
                  {deplie ? '−' : '+'}
                </span>
              </button>
              {deplie && (
                <p className="px-3 pb-3 text-[1rem] leading-relaxed text-texte-doux">
                  {entree.definition}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </Bloc>
  )
}

/**
 * « Comprendre » — annoncé comme à venir, pas simulé.
 *
 * ⚠️ NE PAS BRICOLER UNE VERSION MINIMALE. §4.7 exige un badge de niveau de preuve sur chaque
 * affirmation, et §5 DESIGN en fait « l'élément le plus surveillé » du produit. Afficher des
 * affirmations santé sans leurs sources ni leur niveau de preuve serait exactement ce que §6.1
 * cherche à empêcher. `HealthTopic` est un type sans table, et c'est cohérent : le contenu n'existe
 * pas encore.
 */
function Comprendre() {
  return (
    <Bloc titre="Comprendre">
      <p className="text-[1.02rem] leading-relaxed text-texte-doux">
        Les chapitres de fond — ce que dit la recherche, avec ses sources et son niveau de preuve —
        ne sont pas encore écrits.
      </p>
      <p className="mt-2 text-[1.02rem] leading-relaxed text-attenue">
        Ils viendront avec leurs références, ou pas du tout.
      </p>
    </Bloc>
  )
}

/**
 * « Sources et limites » — lien permanent exigé par §4.7.
 *
 * ⚠️ C'EST LA CONTREPARTIE D'UN PRODUIT QUI AFFICHE DES CHIFFRES. Dire d'où viennent les valeurs et
 * ce que l'application ne fait pas coûte un paragraphe ; ne pas le dire laisse croire à une autorité
 * qu'elle n'a pas. §6.1 : bibliothèque consultable, aucune collecte de pathologie, aucun diagnostic.
 */
function SourcesEtLimites() {
  return (
    <Bloc titre="Sources et limites">
      <div className="space-y-3 text-[1.02rem] leading-relaxed text-texte-doux">
        <p>
          Les valeurs nutritionnelles proviennent de la <strong className="text-texte">table
          CIQUAL 2025</strong> de l'ANSES. Elles ne sont jamais saisies à la main : elles sont
          importées telles quelles.
        </p>
        <p>
          <strong className="text-texte">Cette application ne remplace pas un professionnel de
          santé.</strong> Elle ne pose aucun diagnostic, ne recueille aucune pathologie et ne
          formule aucune recommandation médicale.
        </p>
        <p>
          Ce qu'elle ne fait pas : suivre votre poids, compter ce que vous mangez, vous fixer un
          objectif. Les quantités qu'elle affiche décrivent une recette, jamais un budget à tenir.
        </p>
        <p>
          Tout reste sur cet appareil. Aucun compte, aucune donnée envoyée, aucune mesure d'audience
          — y compris anonyme.
        </p>
      </div>
    </Bloc>
  )
}

function Bloc({ titre, children }: { readonly titre: string; readonly children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-titre text-[1.5rem] text-texte">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
