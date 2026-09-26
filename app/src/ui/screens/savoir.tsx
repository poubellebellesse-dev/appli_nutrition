// ui/screens/savoir.tsx — écran « Gestes » (§4.7 DESIGN). L'identifiant interne reste `savoir`
// (route `#/savoir`, parcours `savoir`) : seul le libellé a changé, au lot I du 2026-09-26.
//
// L'onglet ne garde que deux sections :
//
//   ✅ « Gestes de cuisine »  — 62 fiches, recherche et définition dépliable
//   ✅ « Sources et limites » — lien permanent exigé par §4.7
//
// ⚠️ LES FAITS COURTS ET LES FICHES DE SYNTHÈSE ONT QUITTÉ L'ÉCRAN, PAS LE CATALOGUE. Décision de
// l'auteur du 2026-09-26 : épurer, et ne plus publier un contenu santé qui attendait une relecture
// par un tiers. Les données restent dans `catalog.db` et dans le type `Catalog` ; seul leur rendu
// est retiré. Les réafficher est un lot, pas un correctif.
//
// ⚠️ « SOURCES ET LIMITES » RESTE, ET C'EST LE PRINCIPE 1 : dire d'où viennent les valeurs et ce que
// l'application ne fait pas ne dépend d'aucune des sections retirées.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  Catalog,
  LexiconClip,
  LexiconClipMoment,
  LexiconEntry,
} from '../../engine/domain/index.js'
import { normaliser } from '../../engine/search/index.js'
import { chargerSocle } from '../socle.js'
import { LienTutoriel } from '../lien-tutoriel.js'

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
        <p className="text-lecture font-semibold text-texte">Le catalogue n'a pas pu être lu.</p>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  return (
    <section>
      {/* `data-visite` : ancre inconditionnelle du parcours de tutoriel — voir `ui/parcours.ts`. */}
      <h1 data-visite="titre-savoir" className="text-titre-l text-texte">
        Gestes
      </h1>
      <LienTutoriel parcoursId="savoir" />

      <Gestes lexique={[...etat.catalogue.lexicon.values()]} />
      <SourcesEtLimites />
    </section>
  )
}

/**
 * Le nom lisible d'un moment. La bande NOMME ce qu'elle montre au lieu de numéroter : `deglacer`
 * ne porte que `milieu` et `fin`, et « 1 » devant un milieu serait faux (décision D6).
 */
const NOM_MOMENT: Record<LexiconClipMoment, string> = {
  debut: 'Début',
  milieu: 'Milieu',
  fin: 'Fin',
  unique: 'Le geste',
}

/**
 * Le cadre vidéo d'un geste, plus sa bande de moments — variante D de la décision D6.
 *
 * ⚠️ LECTURE AU CLIC, JAMAIS EN AUTOMATIQUE. Un écran de lexique qui démarre seul six vidéos dès
 * qu'on le déplie consomme la batterie et surprend ; le poster tient lieu d'aperçu jusqu'au clic.
 *
 * ⚠️ NI CONTRÔLES NATIFS NI TÉLÉCHARGEMENT (`controlsList="nodownload"`, pas de `controls`). C'est
 * la contrepartie explicite de la décision 69 : on embarque des médias sous licence Pexels, et le
 * produit n'offre aucun bouton pour les ressortir. ⛔ Ne pas ajouter `controls` « pour le confort » :
 * le menu natif rouvre exactement la porte que cette ligne ferme.
 *
 * ⚠️ `play()` PEUT ÉCHOUER, ET CE N'EST PAS UN CAS D'ÉCOLE : jsdom ne l'implémente pas du tout, et
 * un navigateur refuse la lecture hors d'un geste utilisateur. La promesse est donc avalée — un
 * refus laisse le poster à l'écran, ce qui est un repli correct, pas une panne.
 */
function CadreClip({ clips, terme }: { readonly clips: readonly LexiconClip[]; readonly terme: string }) {
  const [index, setIndex] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const clip = clips[index] ?? clips[0]!

  const lire = () => {
    try {
      void video.current?.play()?.catch(() => {})
    } catch {
      /* jsdom, ou lecture refusée : le poster reste, et c'est le bon repli. */
    }
  }

  return (
    <div className="px-3 pb-3">
      {/* `key` sur le chemin : changer de segment doit REMONTER l'élément, sinon le navigateur
          garde la source précédente et la bande semble ne rien faire. */}
      <button
        type="button"
        onClick={lire}
        aria-label={`Lire le geste « ${terme} » — ${NOM_MOMENT[clip.moment]}`}
        className="block w-full overflow-hidden rounded-[--radius-carte] border border-bordure bg-fond"
      >
        <video
          key={clip.av1Path}
          ref={video}
          poster={clip.posterPath}
          muted
          loop
          playsInline
          preload="none"
          controlsList="nodownload"
          disablePictureInPicture
          className="block w-full"
        >
          <source src={clip.av1Path} type="video/mp4; codecs=av01.0.05M.08" />
          <source src={clip.h264Path} type="video/mp4; codecs=avc1.42E01E" />
        </video>
      </button>

      {/* ⛔ PAS DE BANDE À UN SEUL ÉLÉMENT — 22 des 51 gestes illustrés n'ont qu'un segment, et une
          bande qui ne distingue rien n'est que du bruit sous le cadre (décision D6). */}
      {clips.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {clips.map((c, i) => (
            <li key={c.posterPath}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                className={`flex min-h-tactile items-center gap-2 rounded-[0.6rem] border px-2 text-courant ${
                  i === index ? 'border-bordure-forte text-texte' : 'border-bordure text-texte-doux'
                }`}
              >
                <img src={c.posterPath} alt="" aria-hidden="true" className="size-8 rounded-[0.35rem] object-cover" />
                {NOM_MOMENT[c.moment]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      {/* `data-visite` sur le LABEL et non sur l'`input` : le contour de la visite doit englober
          l'intitulé, sinon la bulle désigne un rectangle vide sans dire ce qu'on y écrit. */}
      <label data-visite="recherche-gestes" className="block">
        <span className="text-courant text-texte-doux">Chercher un geste</span>
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="blanchir, émincer, chemiser…"
          className="mt-1 min-h-tactile w-full rounded-[0.7rem] border border-bordure-forte bg-surface px-3 text-lecture text-texte"
        />
      </label>

      <p className="mt-2 text-courant text-attenue">
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
                className="flex min-h-tactile w-full items-center gap-2 px-3 text-left text-lecture font-semibold text-texte"
              >
                {/* ⛔ LA VIGNETTE N'EST PAS UNE CIBLE CLIQUABLE DISTINCTE — elle vit DANS le bouton
                    du rang (décision D6). Un second bouton imbriqué serait du HTML invalide et
                    donnerait deux cibles pour une seule intention.
                    ⚠️ Les gestes sans clip portent un carré VIDE, pas rien : c'est le coût nommé de
                    la variante C, accepté au moment du choix. Sans lui, les termes ne s'alignent
                    plus d'une ligne à l'autre. */}
                {entree.clips.length > 0 ? (
                  <img
                    src={entree.clips[0]!.posterPath}
                    alt=""
                    aria-hidden="true"
                    className="size-tactile shrink-0 rounded-[0.4rem] object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="size-tactile shrink-0 rounded-[0.4rem] bg-fond" />
                )}
                <span className="grow">{entree.terme}</span>
                <span aria-hidden="true" className="text-attenue">
                  {deplie ? '−' : '+'}
                </span>
              </button>
              {deplie && (
                <>
                  <p className="px-3 pb-3 text-lecture leading-relaxed text-texte-doux">
                    {entree.definition}
                  </p>
                  {/* Un geste SANS média se déplie exactement comme avant : ni cadre, ni bande, ni
                      trou. Le composant n'est pas monté du tout. */}
                  {entree.clips.length > 0 && (
                    <CadreClip clips={entree.clips} terme={entree.terme} />
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
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
    <Bloc titre="Sources et limites" dataVisite="sources-limites">
      <div className="space-y-3 text-lecture leading-relaxed text-texte-doux">
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

/** `dataVisite` : cible facultative pour le tutoriel (`ui/parcours.ts`). Posée ICI plutôt qu'en
 *  enveloppant le `Bloc` d'un `div` chez l'appelant — un conteneur de plus décalerait le contour que
 *  la visite dessine autour de l'élément. */
function Bloc({
  titre,
  dataVisite,
  children,
}: {
  readonly titre: string
  readonly dataVisite?: string
  readonly children: ReactNode
}) {
  return (
    <section data-visite={dataVisite} className="mt-8">
      <h2 className="font-titre text-titre-m text-texte">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
