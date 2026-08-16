#!/usr/bin/env node
/**
 * lots.mjs — l'index des lots, côté écriture MÉCANIQUE.
 *
 * ⚠️ `.claude/lots.json` est un CACHE DÉRIVÉ. La vérité vit dans les documents
 * de conception — ceux que le fichier lui-même déclare sous `sources`
 * (`instruction/specs/SUIVI_*.md` ici, `docs/CONCEPTION_*.md` ailleurs). Ce
 * fichier existe pour être lu par une machine — le tableau, le chemin des lots,
 * un script — jamais pour décider quoi que ce soit.
 *
 * ⚠️ CE FICHIER EST LE MÊME DANS ai-writing-assistant ET DANS appli_nutrition.
 * Rien ici ne doit dépendre d'un dépôt en particulier : la seule différence
 * connue entre les deux est la forme d'`etat-garde.json`, traitée dans
 * `lotCourant()`. Une modification se recopie dans l'autre dépôt.
 *
 * Deux façons de l'écrire, et une seule est complète :
 *   /plan          — RÉCONCILIATION : relit les documents et régénère tout le
 *                    fichier. C'est elle seule qui pose `genere_le`.
 *   ce script      — INCRÉMENT : une seule case bouge, parce qu'une commande
 *                    vient de se terminer (/idee, /sceller, /fin).
 *
 * Un incrément ne touche pas `genere_le` : la date reste celle de la dernière
 * lecture des documents. Un `genere_le` vieux et des états récents, c'est
 * exactement ce que /plan doit venir réconcilier — pas une incohérence à
 * masquer.
 *
 *   node .claude/lots.mjs ajouter <id> --chantier <c> --titre "<t>"
 *                                      [--bloque-par <id>] [--optionnel]
 *                                      [--source <chemin>]
 *   node .claude/lots.mjs etat <id|courant> <a_faire|en_cours|fait|bloque|abandonne>
 *   node .claude/lots.mjs voir [<id>]
 *
 * `courant` = le lot ouvert sur CE terminal, lu dans `etat-garde.json`. C'est ce
 * que /fin emploie : l'id ne se retape pas, donc il ne se trompe pas.
 *
 * `ajouter` n'écrase JAMAIS l'état d'un lot déjà connu, et refuse un lot sans
 * titre : un titre inventé par un modèle vaut moins qu'une case vide, parce
 * qu'il a l'air d'une information.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ICI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ICI, '..');
const F = join(ICI, 'lots.json');

const ETATS = ['a_faire', 'en_cours', 'fait', 'bloque', 'abandonne'];

const AVERTISSEMENT =
  'CACHE DÉRIVÉ, jamais une source. La vérité est dans les fichiers listés '
  + 'sous « sources ». Toute édition à la main sera écrasée à la prochaine '
  + 'réconciliation (/plan). « genere_le » date la dernière lecture des '
  + 'documents ; les états ont pu bouger depuis, par /sceller ou /fin.';

// ── sortie ───────────────────────────────────────────────────────────────────
const mourir = (m) => { console.error(m); process.exit(1); };

// ── fichier ──────────────────────────────────────────────────────────────────
function charger() {
  if (!existsSync(F))
    return { avertissement: AVERTISSEMENT, genere_le: null, sources: [], lots: [] };
  try {
    const o = JSON.parse(readFileSync(F, 'utf8'));
    o.lots ??= []; o.sources ??= [];
    return o;
  } catch (e) {
    // Ne pas repartir d'un fichier vide : on effacerait un index entier sur une
    // virgule en trop.
    mourir(`.claude/lots.json est illisible (${e.message}).\n`
         + `Répare-le ou supprime-le, puis relance /plan. Rien n'a été écrit.`);
  }
}

// Ordre de clés fixe : un diff de ce fichier doit se lire.
function ranger(l) {
  const o = { id: l.id, chantier: l.chantier, titre: l.titre, etat: l.etat };
  if (l.le) o.le = l.le;
  if (l.commit) o.commit = l.commit;
  if (l.bloque_par) o.bloque_par = l.bloque_par;
  if (l.optionnel) o.optionnel = true;
  return o;
}

function sauver(o) {
  mkdirSync(dirname(F), { recursive: true });
  o.avertissement = AVERTISSEMENT;
  writeFileSync(F, JSON.stringify({
    avertissement: o.avertissement,
    genere_le: o.genere_le ?? null,
    sources: o.sources,
    lots: o.lots.map(ranger),
  }, null, 2) + '\n');
}

// ── git : lu, jamais écrit ───────────────────────────────────────────────────
function git(...args) {
  try {
    // stderr ignoré : hors dépôt git, on veut « pas de hash », pas un fatal.
    return execFileSync('git', args, {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return ''; }
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-`
       + `${String(d.getDate()).padStart(2, '0')}`;
}

// ── arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const VERBE = argv[0] ?? '';
const libres = argv.slice(1).filter((a, i, t) => !a.startsWith('--')
  && !(i > 0 && ['--chantier', '--titre', '--bloque-par', '--source'].includes(t[i - 1])));
const drapeau = (nom) => {
  const i = argv.indexOf(nom);
  return i >= 0 ? argv[i + 1] : null;
};
const present = (nom) => argv.includes(nom);

const o = charger();
const trouver = (id) => o.lots.find((l) => l.id === id);

// ── ajouter ──────────────────────────────────────────────────────────────────
if (VERBE === 'ajouter') {
  const id = libres[0];
  const titre = drapeau('--titre');
  const chantier = drapeau('--chantier');
  if (!id) mourir('Il manque l\'identifiant du lot.');
  if (!chantier) mourir(`Lot ${id} : --chantier est obligatoire.`);
  if (!titre || !titre.trim())
    mourir(`Lot ${id} : --titre est obligatoire, et il se RECOPIE du document.\n`
         + `Si le lot n'a pas de titre dans le document, ne l'invente pas : `
         + `demande-le à l'auteur.`);

  const deja = trouver(id);
  if (deja) {
    // L'identité se met à jour, l'état non : lui, il vient de l'avancement.
    deja.chantier = chantier;
    deja.titre = titre.trim();
    if (drapeau('--bloque-par')) deja.bloque_par = drapeau('--bloque-par');
    if (present('--optionnel')) deja.optionnel = true;
    console.log(`Lot ${id} : titre et chantier mis à jour. État inchangé (${deja.etat}).`);
  } else {
    const l = { id, chantier, titre: titre.trim(), etat: 'a_faire' };
    if (drapeau('--bloque-par')) l.bloque_par = drapeau('--bloque-par');
    if (present('--optionnel')) l.optionnel = true;
    o.lots.push(l);
    console.log(`Lot ${id} ajouté (${chantier}) — a_faire.`);
  }

  const src = drapeau('--source');
  if (src) {
    const rel = src.replace(/\\/g, '/');
    if (!o.sources.includes(rel)) {
      o.sources.push(rel);
      console.log(`Source déclarée : ${rel}`);
    }
  }

  // Une dépendance vers un lot inconnu n'est pas bloquante ici — c'est /plan
  // qui la signale. Mais la taire serait pire.
  const dep = trouver(id)?.bloque_par;
  if (dep && !trouver(dep))
    console.log(`⚠️  ${id} dit dépendre de ${dep}, qui n'est pas dans l'index.`);

  sauver(o);
  process.exit(0);
}

// ── etat ─────────────────────────────────────────────────────────────────────
// Le lot ouvert sur CE terminal. Deux formes d'`etat-garde.json` existent, et
// on lit les deux pour que le MÊME fichier tourne dans les deux dépôts :
//   par VOIES — un terminal = une voie (ai-writing-assistant). Même clé de
//               session que la garde : vérifié le 13/08, CLAUDE_CODE_SESSION_ID
//               et le `session_id` des hooks sont la même valeur.
//   à PLAT    — un seul lot pour tout l'arbre (appli_nutrition).
// La forme par voies gagne dès qu'elle existe : elle est plus précise, et se
// rabattre sur le plat masquerait le lot d'un AUTRE terminal.
// Sans lot ouvert, on refuse : deviner serait pire que s'arrêter.
function lotCourant() {
  const e = lire2(join(ICI, 'etat-garde.json'));
  const sid = process.env.CLAUDE_CODE_SESSION_ID;

  if (e?.voies) {
    const v = sid ? e.voies[sid] : null;
    const id = v?.lot?.id ?? v?.lot_id ?? null;
    if (id) return id;
    mourir(sid
      ? `Aucun lot n'est ouvert sur ce terminal — « courant » ne désigne rien.\n`
        + `Donne l'identifiant en clair, ou ouvre le lot avec /sceller.`
      : `CLAUDE_CODE_SESSION_ID est absent : impossible de savoir quel terminal `
        + `parle.\nDonne l'identifiant du lot en clair.`);
  }

  const plat = e?.lot?.id ?? e?.lot_id ?? null;
  if (plat) return plat;
  mourir(`Aucun lot n'est ouvert dans .claude/etat-garde.json — « courant » ne `
       + `désigne rien.\nDonne l'identifiant en clair, ou ouvre le lot avec /sceller.`);
}
function lire2(f) {
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
}

if (VERBE === 'etat') {
  let [id, etat] = libres;
  if (!id || !etat) mourir('Usage : lots.mjs etat <id|courant> <' + ETATS.join('|') + '>');
  if (id === 'courant') id = lotCourant();
  if (!ETATS.includes(etat)) mourir(`État inconnu « ${etat} ». Au choix : ${ETATS.join(', ')}.`);

  const l = trouver(id);
  if (!l)
    mourir(`Lot « ${id} » absent de l'index.\n`
         + `Il n'est donc pas dans les documents non plus, ou l'index est en retard.\n`
         + `Lance /plan pour réconcilier — je n'invente pas une ligne.`);

  const avant = l.etat;
  l.etat = etat;

  if (etat === 'fait') {
    l.le = aujourdhui();
    const h = git('rev-parse', '--short', 'HEAD');
    if (h) l.commit = h;
    const sale = git('status', '--porcelain').split('\n').filter(Boolean).length;
    if (sale)
      console.log(`⚠️  ${sale} fichier(s) non commités : « ${l.commit ?? '?'} » est le HEAD `
                + `d'AVANT la livraison, pas la livraison. Commite, puis relance cette ligne.`);
  } else {
    // Une date de livraison sur un lot qui n'est plus livré, c'est un mensonge
    // qui survit longtemps.
    delete l.le; delete l.commit;
  }

  sauver(o);
  console.log(`Lot ${id} : ${avant} → ${etat}${l.le ? ` (${l.le}, ${l.commit ?? 'sans commit'})` : ''}.`);
  process.exit(0);
}

// ── voir ─────────────────────────────────────────────────────────────────────
if (VERBE === 'voir') {
  const id = libres[0];
  const liste = id ? o.lots.filter((l) => l.id === id) : o.lots;
  if (!liste.length) mourir(id ? `Lot « ${id} » inconnu.` : 'Index vide.');
  console.log(`généré le ${o.genere_le ?? '—'} · ${o.sources.length} source(s) · ${o.lots.length} lot(s)`);
  for (const l of liste)
    console.log(`  ${l.etat.padEnd(10)} ${String(l.id).padEnd(8)} ${l.chantier.padEnd(14)} ${l.titre}`);
  process.exit(0);
}

mourir(`Verbe inconnu « ${VERBE} ». Au choix : ajouter, etat, voir.`);
