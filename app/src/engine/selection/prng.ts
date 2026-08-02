// engine/selection/prng.ts — PRNG pur à graine explicite (§1/§3 ENGINE : jamais `Math.random()`,
// aucun état global, aucune horloge). Sert le tirage seedé de `rankScoredCandidates` (scoring-pass.ts).
//
// `mulberry32` : générateur pur, état capturé en fermeture (pas de variable module-level partagée
// entre appels — deux générateurs créés séparément sont indépendants). Rend un flottant dans [0, 1),
// même contrat qu'un `Math.random()` classique, mais REPRODUCTIBLE à graine égale.
//
// `derive` : dérive un entier 32 bits à partir d'un seed et d'une clé de créneau (`slotKey`,
// plan-week.ts). Nécessaire pour que les 14 créneaux d'une semaine ne partagent pas le même flux de
// tirage — sans ça, `rankScoredCandidates` ferait le même choix relatif à chaque créneau (même
// premier tirage de `alea()`), ce qui ne casse rien de logique mais réduit la variété obtenue.
// FNV-1a, 32 bits : simple, pas cryptographique (aucun besoin ici), bonne dispersion pour des clés
// courtes comme `"2026-08-03|dejeuner"`.

/** Générateur mulberry32 — état `a` capturé en fermeture, jamais partagé entre deux appels de cette fonction. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Dérive un entier 32 bits stable à partir de `seed` et `cle` — hash FNV-1a sur `seed:cle`. */
export function derive(seed: number, cle: string): number {
  const chaine = `${seed}:${cle}`
  let hash = 0x811c9dc5
  for (let i = 0; i < chaine.length; i++) {
    hash ^= chaine.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
