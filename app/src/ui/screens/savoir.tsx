// ui/screens/savoir.tsx — écran « Savoir » (§4.7 DESIGN).
//
// §4.7 décrit quatre sections, toutes rendues :
//
//   ✅ « Le saviez-vous ? »   — 73 tips, 3 catégories, tous sourcés (voir catalog/tips/README.md)
//   ✅ « Gestes de cuisine »  — 62 fiches
//   ✅ « Comprendre »          — 8 fiches, 33 positions (voir catalog/evidence/README.md)
//   ✅ « Sources et limites » — lien permanent exigé par §4.7
//
// ⚠️ LES TIPS NE SONT QUE DES FAITS, ET C'EST STRUCTUREL. §6.1 fait de l'application une
// bibliothèque consultable, jamais un prescripteur — « la tomate est botaniquement un fruit » est un
// tip, « mangez des tomates » n'en serait pas un. Les tips `nutrition_humaine` sont les plus
// exposés : ils ne rapportent QUE ce qu'une autorité publie (« l'EFSA considère que… »), jamais une
// consigne. Le lint §6.2 du build les bloque s'ils dérapent.
//
// ⚠️ CHAQUE TIP PORTE SA SOURCE, ET ELLE EST AFFICHÉE SUR LUI. `source_url` est `NOT NULL` en base
// et le build refuse un tip sans lien. Le carrousel montre le domaine (« pmc.ncbi.nlm.nih.gov »)
// plutôt qu'un « Source » nu : un fait court et affirmatif est exactement ce qu'on recopie sans
// vérifier, et un lien anonyme ne rassure personne.
//
// ⚠️ `nutrition_animale` DOIT RESTER VISUELLEMENT DISTINCT (§8.4) : c'est du contenu culturel, pas
// un conseil applicable à soi. La mention « À propos des animaux » n'est pas décorative.
//
// ⚠️ LES GESTES SONT DU TEXTE SEUL. §4.7 prévoit « définition simple + animation muette en boucle »
// et §8.5 annonce un lexique illustré : il n'existe ni image ni clip. L'écran ne fait pas semblant.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Catalog,
  EvidenceCategorie,
  EvidencePosition,
  EvidenceSheet,
  EvidenceSource,
  LexiconEntry,
  NiveauPreuve,
  Tip,
  TipCategorie,
  TypeEtude,
} from '../../engine/domain/index.js'
import { normaliser } from '../../engine/search/index.js'
import { chargerSocle } from '../socle.js'
import { LienTutoriel } from '../lien-tutoriel.js'

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

/**
 * Les quatre familles de niveau 1 de « Comprendre » (§6.3 ARCHITECTURE), dans l'ordre du document.
 * Tableau et non objet : l'ORDRE est significatif à l'écran, une `Record` ne le garantit pas.
 */
const FAMILLES: readonly { readonly cle: EvidenceCategorie; readonly libelle: string }[] = [
  { cle: 'nutriments', libelle: 'Les nutriments' },
  { cle: 'vitamines_mineraux', libelle: 'Vitamines et minéraux' },
  { cle: 'aliments', libelle: 'Les aliments' },
  { cle: 'situations', libelle: 'Situations' },
]

/** ⚠️ Formulations NEUTRES — « preuve faible » qualifie la démonstration, pas l'aliment (§5 DESIGN). */
const NIVEAU_LIBELLE: Readonly<Record<NiveauPreuve, string>> = {
  forte: 'preuve forte',
  moderee: 'preuve modérée',
  faible: 'preuve faible',
  preliminaire: 'preuve préliminaire',
}

const TYPE_ETUDE_LIBELLE: Readonly<Record<TypeEtude, string>> = {
  meta_analyse: 'Méta-analyse',
  revue_systematique: 'Revue systématique',
  essai_randomise: 'Essai randomisé',
  cohorte: 'Étude de cohorte',
  rapport_autorite: "Texte d'autorité",
  commentaire_critique: 'Critique publiée',
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
        <p className="text-lecture font-semibold text-texte">Le catalogue n'a pas pu être lu.</p>
        <p className="mt-2 text-courant leading-relaxed text-texte-doux">{etat.message}</p>
      </div>
    )
  }

  return (
    <section>
      {/* `data-visite` : ancre inconditionnelle du parcours de tutoriel — voir `ui/parcours.ts`. */}
      <h1 data-visite="titre-savoir" className="text-titre-l text-texte">
        Savoir
      </h1>
      <LienTutoriel parcoursId="savoir" />

      <LeSaviezVous tips={etat.catalogue.tips} />
      <Gestes lexique={[...etat.catalogue.lexicon.values()]} />
      <Comprendre fiches={[...etat.catalogue.evidence.values()]} />
      <SourcesEtLimites />
    </section>
  )
}

/**
 * Domaine d'une URL, pour étiqueter un lien avant de cliquer dessus.
 *
 * « pmc.ncbi.nlm.nih.gov » ou « efsa.europa.eu » dit à l'utilisateur d'où vient le fait ; un lien
 * « Source » nu ne dit rien et ne rassure personne. Le `www.` est retiré : il n'informe pas.
 *
 * Le build garantit une URL http(s), mais un `catalog.db` peut être plus ancien que ce code — d'où
 * le repli sur l'URL brute plutôt qu'une exception qui ferait tomber tout l'écran.
 */
function domaine(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
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
        <p className="text-lecture leading-relaxed text-attenue">
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
          <p className="mb-2 text-mention font-semibold uppercase tracking-wide text-attenue">
            {mention}
          </p>
        )}
        <p className="text-lecture leading-relaxed text-texte">{tip.texte}</p>
        {/*
          La source est affichée SUR le tip, pas reléguée en pied d'écran. Un fait isolé et
          affirmatif est exactement ce qu'on recopie sans vérifier — le lien doit partir avec lui.
        */}
        <p className="mt-3 border-t border-bordure pt-2 text-mention leading-relaxed text-attenue">
          Source :{' '}
          <a
            href={tip.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-texte-doux underline"
          >
            {domaine(tip.sourceUrl)}
          </a>
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex(index - 1)}
          aria-label="Fait précédent"
          className="flex min-h-tactile w-14 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond text-titre-s text-texte-doux"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setIndex(index + 1)}
          aria-label="Fait suivant"
          className="flex min-h-tactile w-14 items-center justify-center rounded-[0.7rem] border border-bordure-forte bg-fond text-titre-s text-texte-doux"
        >
          →
        </button>
        <span className="text-courant tabular-nums text-attenue">
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
                className="flex min-h-tactile w-full items-center justify-between gap-2 px-3 text-left text-lecture font-semibold text-texte"
              >
                {entree.terme}
                <span aria-hidden="true" className="text-attenue">
                  {deplie ? '−' : '+'}
                </span>
              </button>
              {deplie && (
                <p className="px-3 pb-3 text-lecture leading-relaxed text-texte-doux">
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
 * « Comprendre » — deux niveaux (familles → chapitres), §4.7 DESIGN et §6.3 ARCHITECTURE.
 *
 * ⚠️ AUCUNE AFFIRMATION N'EST AFFICHÉE SANS SON BADGE, SON AUTEUR ET SES SOURCES. C'est la règle
 * qui justifie l'existence de cet écran : §5 DESIGN fait du badge « l'élément le plus surveillé »
 * du produit, et §6.1 interdit que l'application parle de santé en son nom propre. Un rendu qui
 * afficherait `affirmation` seule, sans `portePar` ni les liens, retomberait exactement dans ce que
 * ces deux sections cherchent à empêcher.
 *
 * ⚠️ LE FILTRE MASQUE DES POSITIONS, PAS DES CHAPITRES. « Preuve forte seulement » retire les
 * positions moins solides ; un chapitre qui n'en garde aucune disparaît de la liste plutôt que de
 * s'afficher vide. Le compte des chapitres masqués reste écrit à l'écran : cacher une divergence
 * sans le dire donnerait une image faussement consensuelle de l'état des connaissances.
 */
function Comprendre({ fiches }: { readonly fiches: readonly EvidenceSheet[] }) {
  const [forteSeulement, setForteSeulement] = useState(false)
  const [ouverte, setOuverte] = useState<string | null>(null)

  const retenues = useMemo(() => {
    if (!forteSeulement) return fiches
    return fiches
      .map((fiche) => ({ ...fiche, positions: fiche.positions.filter((p) => p.niveauPreuve === 'forte') }))
      .filter((fiche) => fiche.positions.length > 0)
  }, [fiches, forteSeulement])

  if (fiches.length === 0) {
    return (
      <Bloc titre="Comprendre">
        <p className="text-lecture leading-relaxed text-attenue">
          Aucun chapitre publié pour l'instant.
        </p>
      </Bloc>
    )
  }

  const masques = fiches.length - retenues.length

  return (
    <Bloc titre="Comprendre">
      {/* `data-visite` sur le CADRE et non sur la case : il porte aussi la ligne « N chapitres
          masqués », qui est la conséquence du réglage — la désigner avec lui rend l'effet visible. */}
      <div data-visite="preuve-forte" className="rounded-[--radius-carte] border border-bordure bg-surface p-3">
        <label className="flex min-h-tactile cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={forteSeulement}
            onChange={(e) => setForteSeulement(e.target.checked)}
            className="size-5 shrink-0"
          />
          <span className="text-lecture text-texte">Preuve forte seulement</span>
        </label>
        {masques > 0 && (
          <p className="mt-1 text-courant text-attenue">
            {masques} chapitre{masques > 1 ? 's' : ''} masqué{masques > 1 ? 's' : ''} : aucune de leurs
            positions n'atteint ce niveau.
          </p>
        )}
      </div>

      {FAMILLES.map(({ cle, libelle }) => {
        const dansLaFamille = retenues.filter((fiche) => fiche.categorie === cle)
        if (dansLaFamille.length === 0) return null
        return (
          <section key={cle} className="mt-5">
            <h3 className="text-mention font-semibold uppercase tracking-wide text-attenue">
              {libelle}
            </h3>
            <ul className="mt-2 space-y-2">
              {dansLaFamille.map((fiche) => (
                <li key={fiche.code}>
                  <Chapitre
                    fiche={fiche}
                    deplie={ouverte === fiche.code}
                    onBascule={() => setOuverte(ouverte === fiche.code ? null : fiche.code)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </Bloc>
  )
}

/** Un chapitre : titre-question, puis résumé et positions une fois déplié. */
function Chapitre({
  fiche,
  deplie,
  onBascule,
}: {
  readonly fiche: EvidenceSheet
  readonly deplie: boolean
  readonly onBascule: () => void
}) {
  return (
    <div className="rounded-[--radius-carte] border border-bordure bg-surface">
      <button
        type="button"
        onClick={onBascule}
        aria-expanded={deplie}
        className="flex min-h-tactile w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="text-lecture font-semibold leading-snug text-texte">{fiche.titre}</span>
        <span aria-hidden="true" className="shrink-0 text-attenue">
          {deplie ? '−' : '+'}
        </span>
      </button>

      {deplie && (
        <div className="border-t border-bordure px-3 py-3">
          <p className="text-lecture leading-relaxed text-texte-doux">{fiche.resumeVulgarise}</p>

          <ul className="mt-4 space-y-3">
            {fiche.positions.map((position) => (
              <li key={position.code}>
                <Position position={position} sources={fiche.sources} />
              </li>
            ))}
          </ul>

          <p className="mt-4 text-mention text-attenue">
            Revue le {formaterDate(fiche.dateRevue)}
            {estAReviser(fiche.dateRevue) && ' — à réviser (plus de 3 ans)'}
          </p>
        </div>
      )}
    </div>
  )
}

/** Une position : affirmation + badge + qui la porte, dépliable en détail et sources. */
function Position({
  position,
  sources,
}: {
  readonly position: EvidencePosition
  readonly sources: readonly EvidenceSource[]
}) {
  const [deplie, setDeplie] = useState(false)
  const citees = position.sources
    .map((code) => sources.find((s) => s.code === code))
    .filter((s): s is EvidenceSource => s !== undefined)

  return (
    <div className="rounded-[0.7rem] border border-bordure bg-fond">
      <button
        type="button"
        onClick={() => setDeplie(!deplie)}
        aria-expanded={deplie}
        className="w-full px-3 py-2 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <BadgePreuve niveau={position.niveauPreuve} />
          <span className="text-mention text-attenue">{position.portePar}</span>
        </span>
        <span className="mt-1 block text-lecture leading-relaxed text-texte">
          {position.affirmation}
        </span>
        <span className="mt-1 block text-mention text-texte-doux underline">
          {deplie ? 'Replier' : 'Lire le détail et les sources'}
        </span>
      </button>

      {deplie && (
        <div className="border-t border-bordure px-3 py-3">
          <p className="whitespace-pre-line text-lecture leading-relaxed text-texte-doux">
            {position.detail}
          </p>
          <ul className="mt-3 space-y-2">
            {citees.map((source) => (
              <li key={source.code}>
                <Source source={source} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Une source, avec de quoi la vérifier soi-même.
 *
 * ⚠️ `financement` EST AFFICHÉ QUAND IL EXISTE, et ce n'est pas un détail : une méta-analyse payée
 * par le secteur qu'elle évalue reste citable, à condition que le lecteur le sache. Le champ
 * reproduit la déclaration publiée — l'écran ne la commente pas.
 *
 * ⚠️ `auteurs` à `null` signifie NON VÉRIFIÉ, pas « anonyme » : la mention le dit explicitement
 * plutôt que de laisser un blanc qui passerait pour un oubli.
 */
function Source({ source }: { readonly source: EvidenceSource }) {
  return (
    <div className="text-courant leading-relaxed text-texte-doux">
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer noopener"
        className="font-semibold text-texte underline"
      >
        {source.titreEtude}
      </a>
      <p>
        {source.auteurs ?? 'Auteurs non vérifiés'} · {source.revue} · {source.annee}
      </p>
      <p className="text-attenue">
        {TYPE_ETUDE_LIBELLE[source.typeEtude]}
        {source.effectif !== null && ` · ${source.effectif}`}
      </p>
      {source.financement !== null && (
        <p className="text-attenue">Financement déclaré : {source.financement}</p>
      )}
      <p className="text-attenue">
        {source.doi !== null && `DOI ${source.doi} · `}
        Lien vérifié le {formaterDate(source.consulteLe)}
      </p>
    </div>
  )
}

/**
 * Le badge de niveau de preuve (§5 DESIGN).
 *
 * ⚠️ NEUTRE ET TYPOGRAPHIQUE, JAMAIS COLORÉ. §5 interdit explicitement le rouge/vert, les étoiles
 * et toute hiérarchie de type feu tricolore : le badge qualifie la solidité d'une preuve, il ne
 * note pas un aliment. Ajouter une couleur ici transformerait une information en jugement — c'est
 * la modification la plus tentante et la plus interdite de cet écran.
 */
function BadgePreuve({ niveau }: { readonly niveau: NiveauPreuve }) {
  return (
    <span className="rounded-[0.4rem] border border-bordure-forte px-2 py-[0.15rem] text-mention font-semibold uppercase tracking-[0.06em] text-texte-doux">
      {NIVEAU_LIBELLE[niveau]}
    </span>
  )
}

/** `2026-07-31` → `31/07/2026`. Les fiches stockent la date en ISO, l'écran la lit en français. */
function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-')
  return jour !== undefined ? `${jour}/${mois}/${annee}` : iso
}

/** §8.2 règle 4 : au-delà de 3 ans, une fiche est signalée comme à réviser. */
function estAReviser(dateRevue: string): boolean {
  const TROIS_ANS_MS = 3 * 365.25 * 24 * 3600 * 1000
  return Date.now() - new Date(dateRevue).getTime() > TROIS_ANS_MS
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
