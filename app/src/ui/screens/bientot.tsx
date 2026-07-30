// ui/screens/bientot.tsx — écran des onglets dont l'implémentation n'existe pas encore.
//
// La barre de navigation porte les cinq onglets dès maintenant (voir `navigation.tsx`) : une barre
// qui grandit de version en version ferait changer la navigation de forme sous les doigts de
// l'utilisateur. La contrepartie est qu'il faut dire clairement, et sans jargon, ce qui se passe
// quand on ouvre un onglet pas encore construit.
//
// ⚠️ NE PAS TRANSFORMER CET ÉCRAN EN TEASER. Pas de « bientôt disponible ! », pas de compte à
// rebours, pas d'inscription à une liste : l'application n'a ni compte ni serveur (§2 ARCHITECTURE),
// et promettre une date qu'on ne tiendra peut-être pas abîme la confiance pour rien.

import type { Onglet } from '../router.js'

const DESCRIPTION: Readonly<Record<string, string>> = {
  courses: 'La liste de courses se construira à partir de votre semaine.',
  recettes: 'La recherche parmi les recettes du catalogue.',
  savoir: 'Les fiches de cuisine et les repères de nutrition.',
}

export function Bientot({ route, titre }: { readonly route: Onglet; readonly titre: string }) {
  return (
    <section className="mx-auto max-w-prose py-10 text-center">
      <h1 className="text-[1.9rem] text-texte">{titre}</h1>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-texte-doux">
        {DESCRIPTION[route] ?? ''}
      </p>
      <p className="mt-2 text-[1.05rem] leading-relaxed text-attenue">
        Cet écran n'est pas encore construit.
      </p>
    </section>
  )
}
