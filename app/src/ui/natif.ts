// ui/natif.ts — LE seul signal « on tourne dans le conteneur natif ».
//
// ⚠️ UN SEUL SIGNAL, UN SEUL FICHIER (lot J, clause 3-4 bis) : `Capacitor.isNativePlatform()` n'est
// lu qu'ici. Un second signal bricolé (`window.Capacitor`, `getPlatform`) finirait par diverger du
// premier. Lu à l'appel, jamais mémorisé au chargement du module.

import { Capacitor } from '@capacitor/core'

/** Un conteneur natif est présent. Faux dans tout navigateur, y compris une PWA installée. */
export function enNatif(): boolean {
  return Capacitor.isNativePlatform()
}
