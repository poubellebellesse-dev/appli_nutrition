// ui/alarme.ts — la sonnerie de fin de minuteur (§5bis points 5 et 6 ARCHITECTURE).
//
// ⚠️ ELLE NE SONNE QU'AU PREMIER PLAN, ET C'EST UNE DÉCISION, PAS UNE LIMITE SUBIE. Les quatre voies
// vers une alarme en arrière-plan sur Android ont été instruites et refusées
// (`CONCEPTION_MODE_CUISINE.md` §5). Ce qui les remplace est la reprise : au retour, l'appli ne
// sonne pas, mais elle ne ment pas non plus (`cuisine-session.ts`).
//
// ⚠️ L'AUDIO SE DÉVERROUILLE SUR LE GESTE, PAS À L'EXPIRATION. La politique d'autoplay des
// navigateurs refuse un son qu'aucune action n'a demandé — et elle le refuse SANS LEVER D'ERREUR.
// `preparer()` doit donc être appelée depuis le gestionnaire d'un appui réel (« Lancer le
// minuteur »). Vérifié sur appareil le 2026-08-05 : un contexte déverrouillé le reste, il sonne
// encore plusieurs minutes après l'appui.
//
// ⚠️ LA VIBRATION EST UN BONUS, PAS UN CANAL. `navigator.vibrate` n'a rien produit sur l'appareil
// d'essai, ni immédiatement ni en différé. Rien de ce module ne doit en dépendre : le son et le
// signal visuel portent l'information, la vibration s'ajoute si elle veut bien.
//
// ⚠️ CE FICHIER NE FAIT AUCUN RENDU. Le signal visuel — l'inversion de l'écran, retenue à l'essai
// contre quatre autres variantes — appartient à l'écran, qui sait ce qu'il doit inverser.

/** Au-delà, l'alarme s'arrête seule. Une sonnerie qu'on ne peut pas faire taire est une nuisance. */
export const ARRET_AUTO_MS = 5 * 60 * 1000

/** Période entre deux salves. ~2,6 s : assez espacé pour ne pas saturer, assez proche pour alerter. */
const PERIODE_MS = 2600

export type RaisonArret = 'utilisateur' | 'delai'

export interface Alarme {
  /** À appeler DEPUIS un gestionnaire d'événement utilisateur. Idempotent. */
  preparer(): void
  /** Sonne jusqu'à `arreter()` ou `ARRET_AUTO_MS`. Un second appel pendant la sonnerie ne fait rien. */
  sonner(surArret: (raison: RaisonArret) => void): void
  arreter(): void
  enCours(): boolean
}

interface FabriqueContexte {
  new (): AudioContext
}

function fabriqueAudio(): FabriqueContexte | null {
  const w = window as Window & { webkitAudioContext?: FabriqueContexte }
  return (window.AudioContext as FabriqueContexte | undefined) ?? w.webkitAudioContext ?? null
}

/**
 * Une salve : deux notes brèves. Les enveloppes montent et descendent en douceur — un créneau brut
 * produit un clic à l'attaque, qui s'entend plus que la note.
 */
function salve(contexte: AudioContext): void {
  const debut = contexte.currentTime
  for (const [rang, frequence] of [880, 1170].entries()) {
    const oscillateur = contexte.createOscillator()
    const gain = contexte.createGain()
    const a = debut + rang * 0.22
    oscillateur.frequency.value = frequence
    gain.gain.setValueAtTime(0.0001, a)
    gain.gain.exponentialRampToValueAtTime(0.28, a + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, a + 0.19)
    oscillateur.connect(gain)
    gain.connect(contexte.destination)
    oscillateur.start(a)
    oscillateur.stop(a + 0.2)
  }
}

function vibrer(): void {
  // Bonus, jamais un canal. Absente sur bureau, muette sur l'appareil d'essai.
  const api = navigator as Navigator & { vibrate?: (motif: number | readonly number[]) => boolean }
  try {
    api.vibrate?.([180, 120, 180])
  } catch {
    /* certaines plateformes lèvent hors geste utilisateur — sans conséquence */
  }
}

export function creerAlarme(): Alarme {
  let contexte: AudioContext | null = null
  let boucle: ReturnType<typeof setInterval> | null = null
  let echeance: ReturnType<typeof setTimeout> | null = null
  let rappel: ((raison: RaisonArret) => void) | null = null

  const arreterAvec = (raison: RaisonArret): void => {
    if (boucle !== null) clearInterval(boucle)
    if (echeance !== null) clearTimeout(echeance)
    boucle = null
    echeance = null
    const surArret = rappel
    rappel = null
    surArret?.(raison)
  }

  return {
    preparer(): void {
      const Fabrique = fabriqueAudio()
      if (Fabrique === null) return
      try {
        contexte ??= new Fabrique()
        // Un contexte créé hors geste naît `suspended` ; `resume()` sur le geste est ce qui le
        // déverrouille. L'échec ne remonte pas — il n'y a rien à faire de plus.
        void contexte.resume?.()
      } catch {
        contexte = null
      }
    },

    sonner(surArret: (raison: RaisonArret) => void): void {
      if (boucle !== null) return
      rappel = surArret

      const salveComplete = (): void => {
        if (contexte !== null) {
          try {
            salve(contexte)
          } catch {
            /* contexte fermé par le système : le visuel et la vibration restent */
          }
        }
        vibrer()
      }

      salveComplete()
      boucle = setInterval(salveComplete, PERIODE_MS)
      echeance = setTimeout(() => arreterAvec('delai'), ARRET_AUTO_MS)
    },

    arreter(): void {
      if (boucle === null) return
      arreterAvec('utilisateur')
    },

    enCours(): boolean {
      return boucle !== null
    },
  }
}
