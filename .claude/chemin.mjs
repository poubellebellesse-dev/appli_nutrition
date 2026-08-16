#!/usr/bin/env node
/**
 * chemin.mjs — le chemin des lots, dans le navigateur.
 *
 * Une page locale qui montre les lots comme une route qu'on suit : ce qui est
 * derrière, où on en est, ce qui reste. Rien d'autre. Pas le brief d'un lot,
 * pas ses tests, pas ses fichiers — juste l'identifiant et le titre.
 *
 *   node .claude/chemin.mjs [--port 7845] [--sans-navigateur]
 *
 * ── CE QU'IL LIT ────────────────────────────────────────────────────────────
 *   .claude/lots.json        l'index des lots. CACHE DÉRIVÉ : la vérité est
 *                            dans les documents de conception. Relu à CHAQUE
 *                            requête, donc un /plan ou un /fin se voit sans
 *                            relancer le serveur.
 *   .claude/etat-garde.json  le lot ouvert par /sceller sur un terminal.
 *                            LU, JAMAIS ÉCRIT — voir ci-dessous.
 *
 * ── CE QU'IL ÉCRIT ──────────────────────────────────────────────────────────
 *   .claude/chemin.json      et rien d'autre. Un seul champ utile : le lot que
 *                            TU as désigné à la main. Effaçable sans dommage.
 *
 * ⛔ CE PROGRAMME N'ÉCRIT PAS DANS etat-garde.json, ET C'EST VOULU.
 *    Le lot ouvert appartient à la garde, et il s'ouvre par /sceller — une
 *    cérémonie qui fige les tests d'acceptation AVANT le code. Le déplacer
 *    depuis une page web contournerait le sceau sans laisser de trace. La page
 *    affiche donc le lot de la garde à côté du sien, et le dit quand les deux
 *    divergent.
 *
 * ── LE LOT COURANT ──────────────────────────────────────────────────────────
 *    Par défaut il est CALCULÉ, jamais saisi : le premier lot `en_cours`, et à
 *    défaut le premier lot ni fait ni abandonné, dans l'ordre du chemin. Un
 *    clic pose un repère manuel qui gagne sur le calcul ; « suivre le plan »
 *    le retire. Un repère posé sur un lot qui disparaît de l'index est ignoré,
 *    pas ressuscité.
 *
 * ── L'ORDRE DU CHEMIN ───────────────────────────────────────────────────────
 *    C'est l'ordre de `lots.json`, qui est celui des documents — donc la
 *    priorisation du plan. Une seule correction : un lot qui en bloque un autre
 *    passe devant lui. Tri stable, et un cycle laisse l'ordre du fichier intact
 *    plutôt que d'inventer une priorité.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const ICI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ICI, '..');
const F_LOTS = join(ICI, 'lots.json');
const F_GARDE = join(ICI, 'etat-garde.json');
const F_MOI = join(ICI, 'chemin.json');

const PORT_DEFAUT = 7845;
const ETATS_CLOS = new Set(['fait', 'abandonne']);

// Une couleur par dépôt : deux fenêtres ouvertes côte à côte ne se confondent
// pas. Un dépôt inconnu prend le bleu neutre plutôt qu'aucune couleur.
const COULEURS = {
  'ai-writing-assistant': ['#4B3F8F', '#EDEAF7', '#ABA0EC', '#262341'],
  'appli_nutrition': ['#3B6647', '#E5EFE7', '#86C295', '#1D2E22'],
  _defaut: ['#3E5A78', '#E7EDF3', '#8FB3D4', '#1D2833'],
};

// ── arguments ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const drapeau = (nom, defaut) => {
  const i = argv.indexOf(nom);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : defaut;
};
const PORT = Number(drapeau('--port', PORT_DEFAUT)) || PORT_DEFAUT;
const OUVRIR = !argv.includes('--sans-navigateur');

// ── lecture ──────────────────────────────────────────────────────────────────
function lireJson(f) {
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
}

/** L'index. Un fichier illisible n'est pas un index vide : on le dit. */
function lireLots() {
  if (!existsSync(F_LOTS))
    return { erreur: '.claude/lots.json est absent — ce dépôt n\'a pas d\'index de lots.', lots: [] };
  try {
    const o = JSON.parse(readFileSync(F_LOTS, 'utf8'));
    return {
      genere_le: o.genere_le ?? null,
      sources: Array.isArray(o.sources) ? o.sources : [],
      lots: (Array.isArray(o.lots) ? o.lots : []).filter((l) => l && l.id),
    };
  } catch (e) {
    return { erreur: `.claude/lots.json est illisible (${e.message}).`, lots: [] };
  }
}

/**
 * Le ou les lots ouverts dans la garde. Deux formes existent selon les dépôts :
 * par voie (un terminal = une voie) et à plat. On lit les deux, et on rend
 * TOUTES les voies ouvertes — n'en afficher qu'une serait un mensonge quand
 * deux terminaux travaillent.
 */
function lotsDeLaGarde() {
  const e = lireJson(F_GARDE);
  if (!e) return [];
  const out = [];
  if (e.voies && typeof e.voies === 'object') {
    for (const [sid, v] of Object.entries(e.voies)) {
      const id = v?.lot?.id ?? v?.lot_id ?? null;
      if (id) out.push({ id, terminal: v.etiquette ?? sid.slice(0, 6) });
    }
  }
  const plat = e.lot?.id ?? e.lot_id ?? null;
  if (plat && !out.some((o) => o.id === plat)) out.push({ id: plat, terminal: null });
  return out;
}

const lireMoi = () => lireJson(F_MOI) ?? {};
function ecrireMoi(o) {
  writeFileSync(F_MOI, JSON.stringify({
    avertissement: 'Écrit par .claude/chemin.mjs. Effaçable sans dommage : '
                 + 'le lot courant se recalcule depuis lots.json.',
    ...o,
  }, null, 2) + '\n');
}

// ── le chemin ────────────────────────────────────────────────────────────────
/**
 * Ordre stable, corrigé par les dépendances : un lot passe après celui qui le
 * bloque. Une dépendance vers un lot inconnu, ou vers un autre chantier, ne
 * déplace rien — elle est affichée, pas devinée.
 */
function ordonner(lots) {
  const parId = new Map(lots.map((l) => [l.id, l]));
  const pose = new Set();
  const pile = new Set();
  const sortie = [];
  const poser = (l) => {
    if (pose.has(l.id) || pile.has(l.id)) return; // cycle : on garde l'ordre du fichier
    pile.add(l.id);
    const dep = l.bloque_par ? parId.get(l.bloque_par) : null;
    if (dep && dep.chantier === l.chantier) poser(dep);
    pile.delete(l.id);
    if (pose.has(l.id)) return;
    pose.add(l.id);
    sortie.push(l);
  };
  lots.forEach(poser);
  return sortie;
}

/** Groupé par chantier, dans l'ordre d'apparition du chantier dans l'index. */
function chemin(lots) {
  const noms = [];
  for (const l of lots) {
    const c = l.chantier || 'sans chantier';
    if (!noms.includes(c)) noms.push(c);
  }
  return noms.map((nom) => ({
    nom,
    lots: ordonner(lots.filter((l) => (l.chantier || 'sans chantier') === nom)),
  }));
}

const aplatir = (groupes) => groupes.flatMap((g) => g.lots);

/** Le lot où on en est, quand personne ne l'a désigné. */
const courantCalcule = (plat) =>
  plat.find((l) => l.etat === 'en_cours')?.id
  ?? plat.find((l) => !ETATS_CLOS.has(l.etat))?.id
  ?? null;

function etat() {
  const idx = lireLots();
  const groupes = chemin(idx.lots);
  const plat = aplatir(groupes);
  const auto = courantCalcule(plat);

  // Un repère posé sur un lot qui n'existe plus retombe sur le calcul.
  const pose = lireMoi().courant ?? null;
  const manuel = pose && plat.some((l) => l.id === pose) ? pose : null;

  return {
    depot: basename(REPO),
    erreur: idx.erreur ?? null,
    genere_le: idx.genere_le ?? null,
    sources: idx.sources ?? [],
    lu_le: new Date().toISOString(),
    groupes: groupes.map((g) => ({
      nom: g.nom,
      lots: g.lots.map((l) => ({
        id: l.id, titre: l.titre ?? '', etat: l.etat ?? 'a_faire',
        bloque_par: l.bloque_par ?? null, optionnel: !!l.optionnel,
        le: l.le ?? null, commit: l.commit ?? null,
      })),
    })),
    courant: manuel ?? auto,
    auto,
    manuel,
    garde: lotsDeLaGarde(),
    total: plat.length,
    faits: plat.filter((l) => l.etat === 'fait').length,
  };
}

// ── actions ──────────────────────────────────────────────────────────────────
function poserCourant(id) {
  const plat = aplatir(chemin(lireLots().lots));
  if (!plat.some((l) => l.id === id))
    return { ok: false, message: `Lot « ${id} » absent de l'index. Rien n'a été écrit.` };
  ecrireMoi({ courant: id, pose_le: new Date().toISOString() });
  return { ok: true };
}

const suivreLePlan = () => (ecrireMoi({ courant: null }), { ok: true });

/** Remonter le chemin : un cran en arrière, tous chantiers confondus. */
function reculer() {
  const e = etat();
  const plat = aplatir(e.groupes);
  const i = plat.findIndex((l) => l.id === e.courant);
  if (i < 0) return { ok: false, message: "Aucun lot n'est repéré — il n'y a rien à remonter." };
  if (i === 0) return { ok: false, message: 'On est déjà au premier lot du chemin.' };
  return poserCourant(plat[i - 1].id);
}

// ── les mêmes actions, en texte ──────────────────────────────────────────────
// Un coup d'œil sans ouvrir le navigateur — et c'est par là que le programme se
// vérifie, la page n'étant qu'une autre façon d'appeler les mêmes fonctions.
//   --etat            imprimer le chemin et sortir
//   --poser <id>      poser le repère    --reculer    remonter d'un cran
//   --plan            revenir au calcul automatique
const MARQUEURS = { fait: '[x]', en_cours: '[>]', a_faire: '[ ]', bloque: '[~]', abandonne: '[-]' };

function imprimer(e) {
  const l = console.log;
  l(`\n  Le chemin des lots — ${e.depot}`);
  if (e.erreur) l(`  /!\\ ${e.erreur}`);
  l(`  ${e.total} lots · ${e.faits} faits · ${e.total - e.faits} devant`
    + ` · index généré le ${e.genere_le ? String(e.genere_le).slice(0, 10) : '—'}`);
  if (e.manuel) l(`  repère posé à la main sur ${e.manuel} (le plan en est à ${e.auto ?? '—'})`);
  for (const g of e.garde) l(`  la garde a ${g.id} ouvert${g.terminal ? ` sur ${g.terminal}` : ''}`);

  for (const groupe of e.groupes) {
    const faits = groupe.lots.filter((x) => x.etat === 'fait').length;
    l(`\n  ${groupe.nom.toUpperCase()}  ${faits}/${groupe.lots.length}`);
    for (const x of groupe.lots) {
      const ici = x.id === e.courant;
      l(`    ${ici ? '[>]' : MARQUEURS[x.etat] ?? '[ ]'} ${x.id.padEnd(9)} ${x.titre}`
        + (ici ? '   <-- ICI' : '')
        + (!ici && x.bloque_par && x.etat !== 'fait' ? `   (après ${x.bloque_par})` : ''));
    }
  }
  l('');
}

if (['--etat', '--poser', '--reculer', '--plan'].some((v) => argv.includes(v))) {
  const rapporte = (r) => { if (r.ok === false) console.error(`  /!\\ ${r.message}`); };
  if (argv.includes('--poser')) rapporte(poserCourant(drapeau('--poser', '')));
  if (argv.includes('--reculer')) rapporte(reculer());
  if (argv.includes('--plan')) rapporte(suivreLePlan());
  imprimer(etat());
  process.exit(0);
}

// ── le résumé ────────────────────────────────────────────────────────────────
/**
 * Le texte du panneau vient des DOCUMENTS, jamais d'ici. Rien n'est rédigé, rien
 * n'est résumé par un modèle : on retrouve le titre du lot dans les fichiers que
 * `lots.json` déclare sous `sources` — il en est recopié mot pour mot — puis on
 * rend ce qui l'entoure. Un lot introuvable reste sans texte : la page le dit.
 *
 * Deux formes de documents, deux façons de lire :
 *   tableau — la description est DANS la cellule, il n'y a rien « après ».
 *   section — le titre est seul sur sa ligne, le texte est au bloc suivant.
 */
const NETTOYER = (s) => s
  .replace(/`([^`]*)`/g, '$1')                 // code
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')   // liens
  .replace(/[*_~]{2,3}/g, '')                  // gras, barré
  .replace(/<[^>]+>/g, '')                     // html
  .replace(/^\s*[>#\-+]+\s*/gm, '')            // citation, titre, puce
  .replace(/\s+/g, ' ')
  .trim();

// Comparaison indulgente : ni la casse, ni la ponctuation, ni un accent oublié
// ne doivent décider qu'un titre n'est pas le sien. L'index écrit « deja clos »
// là où le document écrit « déjà clos » — un lot y perdait son texte.
const CLE = (s) => NETTOYER(s).toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function couper(s, max = 460) {
  if (s.length <= max) return s;
  const bout = s.slice(0, max);
  const fin = Math.max(bout.lastIndexOf('. '), bout.lastIndexOf(' — '), bout.lastIndexOf(' · '));
  return (fin > max * 0.55 ? bout.slice(0, fin + 1) : bout).trim() + ' […]';
}

/**
 * Découpe un bloc en articles de liste. Une liste numérotée n'a pas de ligne
 * vide entre ses points : sans cette descente, sept étapes d'affilée rendent
 * toutes le même texte — celui de la première. C'est arrivé.
 */
function articles(bloc) {
  const out = [];
  for (const l of bloc.split(/\r?\n/)) {
    if (!out.length || /^[ \t]{0,3}(\d+[.)]|[-*+])\s/.test(l)) out.push(l);
    else out[out.length - 1] += '\n' + l;
  }
  return out;
}

function chercherDansTexte(texte, titre, cible) {
  const blocs = texte.split(/\r?\n[ \t]*\r?\n/);

  for (let i = 0; i < blocs.length; i++) {
    if (!CLE(blocs[i]).includes(cible)) continue;
    const brut = blocs[i].trim();

    // Un encadré ASCII récapitule TOUS les lots d'un document : il contient donc
    // le titre cherché sans rien en dire. Cinq lots y ont pris le même texte.
    if (/[┌┐└┘│├┤┬┴┼─═║╔╗╚╝]/.test(brut) || brut.startsWith('```')) continue;

    if (brut.startsWith('|')) {
      const ligne = blocs[i].split(/\r?\n/).find((l) => CLE(l).includes(cible));
      const cellules = (ligne ?? '').split('|').map(NETTOYER)
        .filter((c) => c.length > 2).sort((a, b) => b.length - a.length);
      let t = cellules[0];
      // La plus longue cellule est parfois le titre lui-même. Seul, il ne dit
      // rien de plus que la ligne déjà lue à gauche : on lui adjoint la suivante.
      if (t && CLE(t) === cible && cellules[1] && cellules[1].length > 15)
        t += ' — ' + cellules[1];
      if (t) return t;
    }

    const items = articles(blocs[i]);
    if (items.length > 1) {
      const item = items.find((a) => CLE(a).includes(cible));
      // Le « 6. » en tête numérote la liste, pas le lot.
      const t = item ? NETTOYER(item).replace(/^\d+[.)]\s*/, '') : '';
      if (t.length > 40) return t;
    }

    const propre = NETTOYER(brut);
    const seul = /^#{1,6}\s/.test(brut) || propre.length < NETTOYER(titre).length + 60;
    if (seul) {
      for (let j = i + 1; j < blocs.length && j <= i + 3; j++) {
        const suivant = blocs[j].trim();
        if (suivant.startsWith('|') || /^#{1,6}\s/.test(suivant)) continue;
        const s = NETTOYER(suivant);
        if (s.length > 40) return s;
      }
    }
    if (propre.length > 40) return propre;
  }
  return null;
}

function calculerResumes(index) {
  const fichiers = [];
  for (const rel of index.sources) {
    if (!/\.md$/i.test(rel)) continue;      // l'état de la garde n'est pas de la prose
    try { fichiers.push([rel, readFileSync(join(REPO, rel), 'utf8')]); } catch { /* absent */ }
  }
  const out = {};
  for (const l of index.lots) {
    if (!l.titre) continue;
    // Deux clés, de la plus sûre à la moins sûre. « LOT 1 — la table » se
    // reconnaît par la paire ; « la table » seul matcherait n'importe quelle
    // phrase du document. Le titre seul ne sert que s'il est assez long pour
    // ne désigner qu'un lot.
    const cles = [CLE(l.id + ' ' + l.titre)];
    if (CLE(l.titre).length >= 10) cles.push(CLE(l.titre));

    chercher: for (const cle of cles) {
      for (const [rel, texte] of fichiers) {
        const t = chercherDansTexte(texte, l.titre, cle);
        if (t) { out[l.id] = { texte: couper(t), source: rel }; break chercher; }
      }
    }
  }
  return out;
}

// Relire 300 Ko de documents à chaque battement de la page serait absurde : ils
// ne bougent qu'à l'écriture. L'empreinte, ce sont les dates de modification.
let cacheResumes = null;
function resumes() {
  const index = lireLots();
  const empreinte = [F_LOTS, ...index.sources.map((r) => join(REPO, r))]
    .map((f) => { try { return statSync(f).mtimeMs; } catch { return 0; } }).join('|');
  if (cacheResumes?.empreinte === empreinte) return cacheResumes.valeur;
  const valeur = { resumes: calculerResumes(index), sources: index.sources };
  cacheResumes = { empreinte, valeur };
  return valeur;
}

// ── la page ──────────────────────────────────────────────────────────────────
// Le code client construit ses nœuds à la main (createElement) : ça évite
// d'imbriquer des gabarits de chaîne dans celui-ci, où ils se marcheraient
// dessus. Toutes les données viennent de /api/etat.
const GABARIT = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Le chemin des lots</title>
<style>
  :root {
    --fond: #F7F8F6; --carte: #FFFFFF; --encre: #171A18; --gris: #6A736D;
    --pale: #99A19B; --trait: #E1E5DF; --trait-fort: #C6CCC4;
    --accent: __A_CLAIR__; --accent-pale: __A_CLAIR_PALE__;
    --alerte: #8A5A16; --alerte-pale: #F7EEE0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fond: #121513; --carte: #1A1E1B; --encre: #E7EBE5; --gris: #98A29B;
      --pale: #6E7872; --trait: #2C322D; --trait-fort: #3E453F;
      --accent: __A_SOMBRE__; --accent-pale: __A_SOMBRE_PALE__;
      --alerte: #D9A85E; --alerte-pale: #322818;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 24px 80px; background: var(--fond); color: var(--encre);
    font: 15px/1.55 "Segoe UI", system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .page { max-width: 1140px; margin: 0 auto; }
  .duo { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 32px; align-items: start; }

  /* ── en-tête ── */
  header { padding: 34px 0 4px; }
  .depot {
    font: 700 12px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
    letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px;
  }
  h1 { font-size: 27px; font-weight: 600; letter-spacing: -.01em; margin: 0 0 10px; }
  .compte { color: var(--gris); font-size: 14px; font-variant-numeric: tabular-nums; }
  .barre { height: 4px; background: var(--trait); border-radius: 2px; margin-top: 12px; overflow: hidden; }
  .barre > i { display: block; height: 100%; background: var(--accent); transition: width .3s ease; }

  /* ── commandes ── */
  .cmds { display: flex; flex-wrap: wrap; gap: 8px; padding: 18px 0 2px; }
  button {
    font: inherit; font-size: 13.5px; color: var(--encre); background: var(--carte);
    border: 1px solid var(--trait-fort); border-radius: 3px; padding: 7px 13px; cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  button:disabled { opacity: .45; cursor: default; color: var(--gris); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .cmds .info {
    margin-left: auto; align-self: center; color: var(--pale);
    font: 12px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
  }

  /* ── bandeaux ── */
  .mot {
    padding: 10px 14px; border-radius: 3px; font-size: 13.5px; margin-top: 10px;
    border-left: 3px solid var(--alerte); background: var(--alerte-pale); color: var(--encre);
  }
  .mot.calme { border-left-color: var(--trait-fort); background: var(--carte); color: var(--gris); }

  /* ── chantier ── */
  section { margin-top: 32px; }
  h2 {
    font: 700 11.5px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
    letter-spacing: .13em; text-transform: uppercase; color: var(--gris);
    margin: 0 0 6px; display: flex; gap: 10px; align-items: baseline;
  }
  h2 em { font-style: normal; color: var(--pale); font-weight: 400; letter-spacing: .04em; }

  /* ── le chemin ── */
  ol { list-style: none; margin: 0; padding: 0; }
  .lot {
    display: grid; grid-template-columns: 34px 66px 1fr auto; align-items: stretch;
    column-gap: 12px; width: 100%; min-height: 32px; text-align: left;
    background: none; border: 0; border-radius: 3px; padding: 4px 10px 4px 0;
    cursor: pointer; color: inherit; font-size: 14.5px;
  }
  .lot > .num, .lot > .titre, .lot > .marque { align-self: center; }
  .lot:hover { background: var(--carte); }
  .lot:hover .titre { color: var(--encre); }

  /* la voie : un trait continu qui relie les pastilles */
  .voie { position: relative; display: flex; align-items: center; justify-content: center; }
  .voie::before, .voie::after {
    content: ""; position: absolute; left: 50%; width: 2px;
    transform: translateX(-50%); background: var(--trait-fort);
  }
  .voie::before { top: 0; bottom: 50%; }
  .voie::after { top: 50%; bottom: 0; }
  li:first-child .voie::before, li:last-child .voie::after { display: none; }
  li.futur .voie::before, li.futur .voie::after { background: var(--trait); }

  .pastille {
    position: relative; z-index: 1; width: 11px; height: 11px; border-radius: 50%;
    border: 2px solid var(--trait-fort); background: var(--fond);
  }
  li.fait .pastille { background: var(--trait-fort); }
  li.bloque .pastille { border-style: dashed; }
  li.abandonne .pastille { background: none; border-color: var(--trait); }

  .num {
    font: 600 12.5px/1.3 ui-monospace, "Cascadia Mono", Consolas, monospace;
    color: var(--gris); font-variant-numeric: tabular-nums;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .titre { color: var(--gris); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .marque {
    font: 600 10px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
    letter-spacing: .08em; text-transform: uppercase; color: var(--pale);
    border: 1px solid var(--trait); border-radius: 2px; padding: 3px 6px; white-space: nowrap;
  }
  .marque.bloc { color: var(--alerte); border-color: var(--alerte); }
  .marque.repere { color: var(--accent); border-color: var(--accent); background: var(--accent-pale); }

  li.fait .titre, li.fait .num { color: var(--pale); }
  li.abandonne .titre, li.abandonne .num { color: var(--pale); text-decoration: line-through; }

  /* le lot où on en est */
  li.ici .lot { background: var(--accent-pale); box-shadow: inset 3px 0 0 var(--accent); }
  li.ici .pastille {
    width: 15px; height: 15px; border-color: var(--accent); background: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-pale);
  }
  li.ici .num { color: var(--accent); font-size: 13.5px; }
  li.ici .titre { color: var(--encre); font-weight: 600; white-space: normal; }
  li.ici .voie::before, li.ici .voie::after { background: var(--accent); }

  /* ── le panneau : ce que disent les documents, jamais autre chose ── */
  .fiche {
    position: sticky; top: 28px; margin-top: 34px;
    background: var(--carte); border: 1px solid var(--trait); border-radius: 5px;
    padding: 17px 19px 19px;
  }
  .fiche .oeil {
    font: 700 11px/1 ui-monospace, "Cascadia Mono", Consolas, monospace;
    letter-spacing: .13em; text-transform: uppercase; color: var(--pale);
  }
  .fiche .cle {
    margin-top: 13px; word-break: break-word; color: var(--accent);
    font: 600 13px/1.4 ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  .fiche h3 { margin: 5px 0 0; font-size: 16px; font-weight: 600; line-height: 1.42; }
  .fiche .puces { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .fiche .puce {
    font-size: 11.5px; padding: 3px 9px; border-radius: 20px;
    border: 1px solid var(--trait-fort); color: var(--gris); white-space: nowrap;
  }
  .fiche .puce.vif { border-color: var(--accent); color: var(--accent); background: var(--accent-pale); }
  .fiche .puce.mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; }
  .fiche p { margin: 14px 0 0; font-size: 14px; line-height: 1.62; }
  .fiche p.muet { color: var(--gris); font-style: italic; }
  .fiche .doc {
    margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--trait); word-break: break-all;
    font: 11.5px/1.55 ui-monospace, "Cascadia Mono", Consolas, monospace; color: var(--pale);
  }

  footer {
    margin-top: 44px; padding-top: 16px; border-top: 1px solid var(--trait);
    font: 12px/1.7 ui-monospace, "Cascadia Mono", Consolas, monospace; color: var(--pale);
  }
  @media (max-width: 900px) {
    .duo { grid-template-columns: 1fr; gap: 0; }
    .fiche { position: static; margin: 28px 0 0; }
  }
  @media (max-width: 520px) {
    .lot { grid-template-columns: 30px 56px 1fr; }
    .marque { display: none; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="duo">
    <div>
      <header>
        <div class="depot" id="depot">…</div>
        <h1>Le chemin des lots</h1>
        <div class="compte" id="compte"></div>
        <div class="barre"><i id="jauge" style="width:0%"></i></div>
        <div class="cmds">
          <button id="b-refresh" title="Relire .claude/lots.json maintenant">Rafraîchir</button>
          <button id="b-reculer" title="Déplacer le repère d'un cran en arrière">&larr; Revenir en arrière</button>
          <button id="b-plan" title="Laisser le plan décider où on en est">Suivre le plan</button>
          <span class="info" id="pouls"></span>
        </div>
        <div id="mots"></div>
      </header>
      <main id="chemin"></main>
      <footer id="pied"></footer>
    </div>
    <aside class="fiche" id="fiche"></aside>
  </div>
</div>
<script>
'use strict';

var ETIQUETTES = {
  fait: 'fait', en_cours: 'en cours', a_faire: 'à faire',
  bloque: 'bloqué', abandonne: 'abandonné'
};

function el(balise, classe, texte) {
  var n = document.createElement(balise);
  if (classe) n.className = classe;
  if (texte !== undefined && texte !== null) n.textContent = texte;
  return n;
}

function ajouterMot(hote, texte, calme) {
  hote.appendChild(el('div', calme ? 'mot calme' : 'mot', texte));
}

function ageEnClair(iso) {
  if (!iso) return 'jamais réconcilié';
  var j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (isNaN(j)) return String(iso);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  return 'il y a ' + j + ' jours';
}

function ligne(lot, courant) {
  var ici = lot.id === courant;
  var classes = lot.etat;
  if (ici) classes += ' ici';
  else if (lot.etat !== 'fait' && lot.etat !== 'en_cours') classes += ' futur';
  var li = el('li', classes);

  var b = el('button', 'lot');
  b.type = 'button';
  b.title = 'Poser le repère sur ' + lot.id;

  var voie = el('div', 'voie');
  voie.appendChild(el('div', 'pastille'));
  b.appendChild(voie);
  b.appendChild(el('div', 'num', lot.id));
  b.appendChild(el('div', 'titre', (lot.titre || '—') + (lot.optionnel ? '  (optionnel)' : '')));

  var marque;
  if (ici) marque = el('div', 'marque repere', 'ici');
  else if (lot.bloque_par && lot.etat !== 'fait') marque = el('div', 'marque bloc', 'après ' + lot.bloque_par);
  else if (lot.etat === 'fait' && lot.le) marque = el('div', 'marque', lot.le.slice(5));
  else marque = el('div', 'marque', ETIQUETTES[lot.etat] || lot.etat);
  b.appendChild(marque);

  b.addEventListener('click', function () { poser(lot.id); });
  // Le survol LIT, le clic DÉPLACE. Sans ça on ne pourrait pas consulter un lot
  // sans y poser son repère. Le focus fait la même chose pour le clavier.
  b.addEventListener('mouseenter', function () { montrer(lot.id); });
  b.addEventListener('focus', function () { montrer(lot.id); });
  li.appendChild(b);
  return li;
}

// ── le panneau ───────────────────────────────────────────────────────────────
var RESUMES = {};      // id -> { texte, source }, lu depuis les documents
var LOTS = {};         // id -> lot, reconstruit à chaque dessin
var VU = null;         // le lot affiché à droite
var COURANT = null;    // le lot où en est le chemin
var GENERE = false;    // dernier genere_le vu : les documents n'ont bougé que s'il change

function montrer(id) {
  if (!LOTS[id]) return;
  VU = id;
  fiche();
}

function puce(hote, texte, vif, mono) {
  var p = el('span', 'puce' + (vif ? ' vif' : '') + (mono ? ' mono' : ''), texte);
  hote.appendChild(p);
}

function fiche() {
  var hote = document.getElementById('fiche');
  hote.textContent = '';
  var lot = LOTS[VU];
  if (!lot) {
    hote.appendChild(el('div', 'oeil', 'le lot'));
    hote.appendChild(el('p', 'muet', 'Aucun lot à montrer.'));
    return;
  }

  // ⚠️ Guillemets DOUBLES pour toute chaîne client portant une apostrophe. Tout
  // ce bloc vit dans un gabarit de chaîne du serveur : une apostrophe échappée
  // y redevient une apostrophe nue et referme la chaîne côté navigateur. Le
  // script entier meurt alors, et la page ne dessine plus un seul lot.
  // Aucun backtick ici non plus, pour la même raison.
  hote.appendChild(el('div', 'oeil', VU === COURANT ? "où j'en suis" : 'le lot'));
  hote.appendChild(el('div', 'cle', lot.id));
  hote.appendChild(el('h3', null, lot.titre || '—'));

  var puces = el('div', 'puces');
  puce(puces, ETIQUETTES[lot.etat] || lot.etat, lot.etat === 'en_cours' || VU === COURANT);
  if (lot.optionnel) puce(puces, 'optionnel');
  if (lot.bloque_par && lot.etat !== 'fait') puce(puces, 'après ' + lot.bloque_par);
  if (lot.le) puce(puces, lot.le, false, true);
  if (lot.commit) puce(puces, lot.commit, false, true);
  hote.appendChild(puces);

  var r = RESUMES[lot.id];
  if (r && r.texte) {
    hote.appendChild(el('p', null, r.texte));
    hote.appendChild(el('div', 'doc', r.source));
  } else {
    hote.appendChild(el('p', 'muet',
      "Aucun texte trouvé pour ce lot dans les documents. Rien n'est inventé ici : "
      + "tout ce qui s'affiche est recopié d'un fichier."));
  }
}

function dessiner(e) {
  // Le panneau suit le repère tant qu'on n'a rien survolé, et lâche prise dès
  // qu'un lot disparaît de l'index plutôt que d'afficher un fantôme.
  var avant = COURANT;
  COURANT = e.courant;
  LOTS = {};
  for (var q = 0; q < e.groupes.length; q++)
    for (var w = 0; w < e.groupes[q].lots.length; w++)
      LOTS[e.groupes[q].lots[w].id] = e.groupes[q].lots[w];
  if (!VU || !LOTS[VU] || VU === avant) VU = e.courant;

  if (e.genere_le !== GENERE) { GENERE = e.genere_le; chargerResumes(); }

  document.getElementById('depot').textContent = e.depot;
  document.getElementById('compte').textContent =
    e.total + ' lots · ' + e.faits + ' faits · ' + (e.total - e.faits) + ' devant';
  document.getElementById('jauge').style.width =
    (e.total ? Math.round((e.faits / e.total) * 100) : 0) + '%';

  var mots = document.getElementById('mots');
  mots.textContent = '';
  if (e.erreur) ajouterMot(mots, e.erreur);
  if (e.manuel)
    ajouterMot(mots, 'Repère posé à la main sur ' + e.manuel + '.'
      + (e.auto && e.auto !== e.manuel ? ' Le plan, lui, en est à ' + e.auto + '.' : ''));
  for (var i = 0; i < e.garde.length; i++) {
    var g = e.garde[i];
    var ou = g.terminal ? ' sur le terminal ' + g.terminal : '';
    if (g.id === e.courant) ajouterMot(mots, 'Lot ' + g.id + ' ouvert dans la garde' + ou + '.', true);
    else ajouterMot(mots, 'La garde a le lot ' + g.id + ' ouvert' + ou
      + ', pas celui-ci. Le sceau ne se déplace que par /sceller.');
  }

  var hote = document.getElementById('chemin');
  hote.textContent = '';
  for (var c = 0; c < e.groupes.length; c++) {
    var groupe = e.groupes[c];
    var faits = 0;
    for (var k = 0; k < groupe.lots.length; k++) if (groupe.lots[k].etat === 'fait') faits++;

    var sec = el('section');
    var h = el('h2');
    h.appendChild(el('span', null, groupe.nom));
    h.appendChild(el('em', null, faits + ' / ' + groupe.lots.length));
    sec.appendChild(h);

    var liste = el('ol');
    for (var j = 0; j < groupe.lots.length; j++)
      liste.appendChild(ligne(groupe.lots[j], e.courant));
    sec.appendChild(liste);
    hote.appendChild(sec);
  }

  var plat = [];
  for (var q = 0; q < e.groupes.length; q++) plat = plat.concat(e.groupes[q].lots);
  var pos = -1;
  for (var p = 0; p < plat.length; p++) if (plat[p].id === e.courant) pos = p;
  document.getElementById('b-reculer').disabled = pos <= 0;
  document.getElementById('b-plan').disabled = !e.manuel;

  var pied = document.getElementById('pied');
  pied.textContent = '';
  pied.appendChild(el('div', null, 'index généré ' + ageEnClair(e.genere_le)
    + (e.genere_le ? ' (' + String(e.genere_le).slice(0, 10) + ')' : '')
    + ' — un /plan le réconcilie avec les documents'));
  for (var s = 0; s < e.sources.length; s++) pied.appendChild(el('div', null, '· ' + e.sources[s]));
  pied.appendChild(el('div', null,
    "le repère vit dans .claude/chemin.json — etat-garde.json n'est jamais écrit ici"));

  document.getElementById('pouls').textContent = 'relu à ' + new Date(e.lu_le)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  fiche();
}

function charger() {
  return fetch('/api/etat', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(dessiner)
    .catch(function () { document.getElementById('pouls').textContent = 'serveur arrêté'; });
}

// Les documents pèsent des centaines de Ko et ne bougent qu'à l'écriture : on ne
// les relit pas au rythme de la page, seulement quand l'index a été régénéré ou
// qu'on a cliqué « Rafraîchir ».
function chargerResumes() {
  return fetch('/api/resumes', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (r) { RESUMES = (r && r.resumes) || {}; fiche(); })
    .catch(function () { /* le chemin reste lisible sans les résumés */ });
}

function agir(chemin) {
  return fetch(chemin, { method: 'POST' })
    .then(function (r) { return r.json(); })
    .then(function (r) { if (r && r.ok === false && r.message) alert(r.message); })
    .then(charger);
}

function poser(id) { agir('/api/courant?id=' + encodeURIComponent(id)); }

document.getElementById('b-refresh')
  .addEventListener('click', function () { GENERE = false; charger(); });
document.getElementById('b-reculer').addEventListener('click', function () { agir('/api/reculer'); });
document.getElementById('b-plan').addEventListener('click', function () { agir('/api/plan'); });

charger();
setInterval(charger, 5000);
</script>
</body>
</html>
`;

const [A1, A2, A3, A4] = COULEURS[basename(REPO)] ?? COULEURS._defaut;
const PAGE = GABARIT
  .replace('__A_CLAIR__', A1).replace('__A_CLAIR_PALE__', A2)
  .replace('__A_SOMBRE__', A3).replace('__A_SOMBRE_PALE__', A4);

// ── serveur ──────────────────────────────────────────────────────────────────
const serveur = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (o, code = 200) => {
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    });
    res.end(JSON.stringify(o));
  };

  try {
    if (url.pathname === '/api/etat') return json(etat());
    if (url.pathname === '/api/resumes') return json(resumes());
    if (req.method === 'POST' && url.pathname === '/api/courant')
      return json(poserCourant(url.searchParams.get('id') ?? ''));
    if (req.method === 'POST' && url.pathname === '/api/plan') return json(suivreLePlan());
    if (req.method === 'POST' && url.pathname === '/api/reculer') return json(reculer());
    if (url.pathname === '/') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      });
      return res.end(PAGE);
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('rien ici');
  } catch (e) {
    json({ ok: false, message: String(e?.message ?? e) }, 500);
  }
});

// Le succès s'annonce UNE fois, et depuis le port réellement obtenu.
// `listen(port, host, cb)` pose cb en `once('listening')` — mais un EADDRINUSE
// ne le retire pas. Un cb par tentative, et le jour où un port finit par
// répondre ils partent TOUS : deux bannières, deux navigateurs, dont un sur le
// port du voisin. C'est ce qui a ouvert les lots d'un dépôt dans l'onglet de
// l'autre.
serveur.on('listening', () => {
  const adresse = `http://127.0.0.1:${serveur.address().port}/`;
  console.log(`\n  Le chemin des lots — ${basename(REPO)}`);
  console.log(`  ${adresse}\n`);
  console.log('  Ctrl+C pour arrêter.\n');
  if (!OUVRIR) return;
  if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', adresse], () => {});
  else if (process.platform === 'darwin') execFile('open', [adresse], () => {});
});

function ecouter(port, restants) {
  serveur.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && restants > 0) {
      console.log(`  port ${port} occupé, j'essaie ${port + 1}…`);
      return ecouter(port + 1, restants - 1);
    }
    console.error(`Impossible d'ouvrir le port ${port} : ${e.message}`);
    process.exit(1);
  });
  serveur.listen(port, '127.0.0.1');
}

ecouter(PORT, 10);
