// engine/cuisine/equipement-partage.ts — REMPLACÉ PAR `./reservation.ts` (lot 65a, 2026-08-13).
//
// Ce fichier ne porte plus de code. Il reste parce que ce qu'il a coûté mérite d'être lisible à
// l'endroit où on viendrait le rechercher.
//
// ---------------------------------------------------------------------------------------------
// CE QU'IL FAISAIT, ET POURQUOI ÇA NE SUFFISAIT PAS
//
// Il exportait `equipementsDisputes(plats, codeDe)`, qui répondait : « le four est utilisé par le
// colin et le gratin ». Un NOM et une LISTE — jamais un moment. Deux plats qui passent au four,
// l'un au début et l'autre à la fin, étaient déclarés en conflit alors qu'ils ne se croisent
// jamais. Mesuré : **63 % de fausses alertes**. Un avertissement faux deux fois sur trois n'est plus
// lu, et c'est pire que pas d'avertissement du tout — il occupe la place sans rendre le service.
//
// ⛔ ET IL PORTAIT UNE LISTE EN DUR : `« codes indivisibles » = ['four', 'micro_ondes']`. Un jugement de
// moteur sur des objets du catalogue, écrit en TypeScript, que personne ne pouvait corriger en
// éditant du YAML. La dette était assumée et documentée ; elle est remboursée par
// `equipment.partageable`, une colonne à trois valeurs — `jamais`, `selon_quantite`, `toujours`.
//
// ⚠️ LA TROISIÈME VALEUR EST TOUTE LA DIFFÉRENCE. L'ancien commentaire disait : « NE PAS Y AJOUTER
// `plaque_cuisson`, 260 recettes la réclament et l'avertissement se déclencherait sur presque chaque
// paire ». Il avait raison, et il n'avait pas de troisième case où la ranger. `selon_quantite` la
// nomme sans y répondre : le catalogue sait qu'une plaque a plusieurs feux, il ne sait pas combien
// la personne en possède. Le moteur se tait tant qu'il ne sait pas.
//
// ---------------------------------------------------------------------------------------------
// OÙ EST PASSÉ QUOI
//
//   `equipementsDisputes`  → `./reservation.ts`, `conflitsDEquipement(plats, capaciteDe)`, qui rend
//                            des FENÊTRES en minutes avant le service, pas des listes de noms.
//   la liste en dur      → `equipment.partageable` au catalogue, lu par `capaciteDepuisPartage`.
//   l'affichage            → `ui/screens/cuisine.tsx`, `MaterielPartage` : « Four — pris de 19h43 à
//                            19h57 ». Un fait et une plage, jamais un jugement (principe 6).
//
// ⚠️ `equipement-partage.test.ts` A ÉTÉ SUPPRIMÉ AVEC LA FONCTION : il ne testait qu'elle. Ce qui le
// remplace est `tests/scelles/65a.test.ts` (lot D) et `tests/scelles/65a-ecran.test.tsx` (lot E).

export {}
