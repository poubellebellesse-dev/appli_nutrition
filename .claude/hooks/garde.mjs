#!/usr/bin/env node
/**
 * garde.mjs — la mécanique qui applique ce que CLAUDE.md se contente d'écrire.
 *
 * Hooks Claude Code :
 *   pre   (PreToolUse)  — refuse d'écrire dans un instrument, un test scellé,
 *                         ou dans le code de production hors d'un lot ouvert.
 *   post  (PostToolUse) — note les modifs et les vérifications réellement lancées.
 *   stop  (Stop)        — refuse de conclure si les commandes qui font foi
 *                         n'ont pas été relancées depuis la dernière modif.
 *
 * Commandes (appelées par les slash-commands) :
 *   etape <nom> [lot]   — où on en est. Lu par le tableau de suivi.
 *   file <a,b,c>        — les lots qui viennent après, dans l'ordre.
 *   lot <id>            — ouvre le lot (débloque le code de production)
 *   sceau               — ferme les tests scellés
 *   fin                 — clôt le lot, l'archive dans l'historique
 *   libre [sceau]       — lève tout, ou seulement le sceau
 *   strict              — rallume tout et remet le sceau
 *
 * PRINCIPE : en cas de doute ou d'erreur interne, la garde LAISSE PASSER.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const MODE = process.argv[2] ?? 'pre';
const ARG = process.argv[3] ?? '';
const ARG2 = process.argv[4] ?? '';

const ETAPES = ['IDÉE', 'BRIEF', 'ATTAQUE', 'SCELLÉ', 'CODE', 'VÉRIF', 'FIN'];
const norm = (p) => String(p ?? '').replace(/\\/g, '/').toLowerCase();

function match(rel, motif) {
  const re = new RegExp('^' + norm(motif)
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*') + '$');
  return re.test(rel);
}

function lire(f, defaut) {
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return defaut; }
}
function ecrire(f, o) {
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(o, null, 2) + '\n');
}

let entree = {};
try {
  const brut = readFileSync(0, 'utf8');
  if (brut.trim()) entree = JSON.parse(brut);
} catch { /* laisser passer */ }

const RACINE = entree.cwd || process.cwd();
const CFG = lire(join(RACINE, '.claude', 'garde.config.json'), null);
const ETAT_F = join(RACINE, '.claude', 'etat-garde.json');
const etat = lire(ETAT_F, {
  mode: 'strict', lot: null, modifs: {}, verifs: {},
  etape: null, lot_id: null, titre: null, depuis: null,
  file: [], historique: [],
});

const sortir = (o) => { if (o) process.stdout.write(JSON.stringify(o)); process.exit(0); };
const refus = (raison) => sortir({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: raison,
  },
});

try {
  // ── suivi : où on en est ──────────────────────────────────────────────────
  if (MODE === 'etape') {
    const e = ARG.toUpperCase();
    etat.etape = ETAPES.includes(e) ? e : ARG;
    if (ARG2) etat.lot_id = ARG2;
    etat.depuis = Date.now();
    ecrire(ETAT_F, etat);
    console.log(`Étape : ${etat.etape}${etat.lot_id ? ' — lot ' + etat.lot_id : ''}`);
    process.exit(0);
  }
  if (MODE === 'file') {
    etat.file = ARG.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    ecrire(ETAT_F, etat);
    console.log(`File : ${etat.file.join(' · ') || '(vide)'}`);
    process.exit(0);
  }
  if (MODE === 'titre') {
    etat.titre = [ARG, ARG2].filter(Boolean).join(' ');
    ecrire(ETAT_F, etat);
    process.exit(0);
  }

  // ── cycle du lot ──────────────────────────────────────────────────────────
  if (MODE === 'lot') {
    etat.lot = { id: ARG, ouvert: Date.now(), scelle: false };
    etat.lot_id = ARG;
    etat.modifs = {}; etat.verifs = {};
    ecrire(ETAT_F, etat);
    console.log(`Lot « ${ARG} » ouvert. La garde est active.`);
    process.exit(0);
  }
  if (MODE === 'sceau') {
    if (etat.lot) etat.lot.scelle = true;
    etat.etape = 'SCELLÉ'; etat.depuis = Date.now();
    ecrire(ETAT_F, etat);
    console.log('Tests scellés. Toute écriture dedans sera refusée.');
    process.exit(0);
  }
  if (MODE === 'fin') {
    if (etat.lot_id) {
      etat.historique = (etat.historique ?? []).concat([{ id: etat.lot_id, t: Date.now() }]).slice(-30);
      etat.file = (etat.file ?? []).filter((x) => x !== etat.lot_id);
    }
    etat.lot = null; etat.lot_id = null; etat.titre = null;
    etat.etape = null; etat.depuis = Date.now();
    etat.modifs = {}; etat.verifs = {};
    ecrire(ETAT_F, etat);
    console.log('Lot fermé.');
    process.exit(0);
  }

  // ── verrou ────────────────────────────────────────────────────────────────
  if (MODE === 'libre' && ARG === 'sceau') {
    if (etat.lot) { etat.lot.scelle = false; ecrire(ETAT_F, etat); }
    console.log('Sceau LEVÉ. Le reste de la garde tient toujours debout.');
    process.exit(0);
  }
  if (MODE === 'libre' || MODE === 'strict') {
    etat.mode = MODE;
    if (MODE === 'strict' && etat.lot) etat.lot.scelle = true;
    ecrire(ETAT_F, etat);
    console.log(MODE === 'libre'
      ? 'Garde COUPÉE EN ENTIER — instruments, sceau, blocage de fin. Pense à /strict.'
      : 'Garde rallumée, sceau remis.');
    process.exit(0);
  }

  if (!CFG || etat.mode === 'libre') sortir(null);

  const racineN = norm(RACINE).replace(/\/$/, '');
  const relatif = (abs) => {
    const a = norm(abs);
    return a.startsWith(racineN + '/') ? a.slice(racineN.length + 1) : a;
  };

  // ── Le shell écrit aussi, et la garde ne le voyait pas ────────────────────
  //
  // ⛔ TROU CONSTATÉ EN CONDITIONS RÉELLES (2026-08-21, dette §8) : la garde n'interceptait que
  // `Edit|Write|MultiEdit|NotebookEdit`. Un sous-agent qui n'a que `Bash` — et le critique du
  // round 2 en était un — écrivait dans `tests/scelles/` sans être vu. Elle protégeait donc un lot
  // scellé de l'étourderie, pas de l'outil.
  //
  // ⚠️ ON NE PARSE PAS LE SHELL, ON RECONNAÎT DEUX FORMES ET RIEN D'AUTRE : une redirection dont la
  // CIBLE tombe dans une zone protégée, et un verbe qui écrit dans le même segment qu'un chemin
  // protégé. Tout le reste passe. Un faux refus coûte plus cher qu'un trou résiduel — la parade
  // d'un refus est d'utiliser `Edit`, que la garde sait lire, donc elle ne bloque aucun travail.
  const prefixeDe = (motif) => norm(motif).split('*')[0].replace(/\/+$/, '');
  const VERBES_QUI_ECRIVENT =
    /(?:^|[\s(])(?:tee|cp|mv|rm|truncate|dd|patch|install|touch)\b|\bsed\b[^]*?\s-[a-z]*i|\bperl\b[^]*?\s-[a-z]*i|\bgit\s+(?:checkout|restore|apply|mv|rm)\b/;

  function ecritureShellInterdite(cmd) {
    const zones = [
      { motifs: CFG.proteges ?? [], actif: true, quoi: 'un INSTRUMENT (instantané daté)' },
      { motifs: CFG.scelles ?? [], actif: Boolean(etat.lot?.scelle), quoi: 'un test SCELLÉ' },
      { motifs: CFG.source ?? [], actif: !etat.lot, quoi: 'du code de PRODUCTION, hors lot' },
    ].filter((z) => z.actif);
    if (zones.length === 0) return null;

    for (const segment of String(cmd).split(/[;&|\n]+/)) {
      const jetons = segment.match(/[^\s'"<>;&|()]+/g) ?? [];
      const cibles = [...segment.matchAll(/(?:^|[^0-9<>])>>?\s*(['"]?)([^\s'";&|]+)\1/g)].map(
        (m) => m[2]
      );
      const verbe = VERBES_QUI_ECRIVENT.test(segment);

      for (const zone of zones) {
        for (const motif of zone.motifs) {
          const prefixe = prefixeDe(motif);
          if (!prefixe) continue;
          const touche = (p) => norm(p).includes(prefixe + '/');
          const coupable = cibles.find(touche) ?? (verbe ? jetons.find(touche) : undefined);
          if (coupable !== undefined) return { chemin: coupable, quoi: zone.quoi };
        }
      }
    }
    return null;
  }

  // ── PRE : le seul endroit qui dit non ─────────────────────────────────────
  if (MODE === 'pre') {
    const outil = entree.tool_name ?? '';

    if (outil === 'Bash') {
      const faute = ecritureShellInterdite(entree.tool_input?.command ?? '');
      if (faute)
        refus(`Cette commande écrit dans « ${faute.chemin} », qui est ${faute.quoi}.\n` +
              `Le shell contourne la garde ; ce n'est pas une porte de service.\n` +
              `Si l'écriture est légitime, passe par Edit/Write : la garde sait les lire, ` +
              `et te dira précisément ce qu'elle refuse.\n` +
              `Si c'est vraiment le sujet de la tâche : demande à l'auteur, il lancera /libre.`);
      sortir(null);
    }

    if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(outil)) sortir(null);
    const rel = relatif(entree.tool_input?.file_path ?? '');
    if (!rel) sortir(null);

    for (const m of CFG.proteges ?? []) {
      if (match(rel, m))
        refus(`« ${rel} » est un INSTRUMENT, pas un fichier de travail.\n` +
              `Le modifier détruit la mesure qu'il porte (CLAUDE.md le dit).\n` +
              `Si c'est vraiment le sujet de la tâche : demande à l'auteur, ` +
              `il lancera /libre.`);
    }

    if (etat.lot?.scelle) {
      for (const m of CFG.scelles ?? []) {
        if (match(rel, m))
          refus(`« ${rel} » fait partie des tests SCELLÉS du lot ${etat.lot.id}.\n` +
                `Ils ont été écrits avant le code, depuis la spec. Les modifier ` +
                `pour les faire passer, c'est truquer l'examen.\n` +
                `Si le test est FAUX, c'est une décision de l'auteur, pas la tienne : ` +
                `dis-le et arrête-toi.`);
      }
    }

    const estSource = (CFG.source ?? []).some((m) => match(rel, m));
    if (estSource && !etat.lot)
      refus(`Aucun lot n'est ouvert, et « ${rel} » est du code de production.\n` +
            `Écris d'abord le brief : /brief <id-du-lot>.\n` +
            `Critère de sortie AVANT le code — c'est ce qui évite les allers-retours.`);

    sortir(null);
  }

  // ── POST : on note, on ne juge pas ────────────────────────────────────────
  if (MODE === 'post') {
    const outil = entree.tool_name ?? '';
    if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(outil)) {
      const rel = relatif(entree.tool_input?.file_path ?? '');
      if ((CFG.source ?? []).some((m) => match(rel, m))) {
        etat.modifs[rel] = Date.now();
        if (etat.lot && etat.etape !== 'CODE') { etat.etape = 'CODE'; etat.depuis = Date.now(); }
      }
    } else if (outil === 'Bash') {
      const cmd = String(entree.tool_input?.command ?? '');
      const echec = entree.tool_response?.exit_code ?? entree.tool_response?.exitCode;
      for (const v of CFG.verifications ?? []) {
        if (v.motifs.some((m) => cmd.includes(m))) {
          etat.verifs[v.nom] = { t: Date.now(), code: echec ?? 0 };
          if (etat.etape === 'CODE') { etat.etape = 'VÉRIF'; etat.depuis = Date.now(); }
        }
      }
    }
    ecrire(ETAT_F, etat);
    sortir(null);
  }

  // ── STOP : « c'est fini » n'est pas une opinion ───────────────────────────
  if (MODE === 'stop') {
    if (entree.stop_hook_active) sortir(null);
    const derniereModif = Math.max(0, ...Object.values(etat.modifs ?? {}));
    if (!derniereModif) sortir(null);

    const manquantes = [];
    for (const v of CFG.verifications ?? []) {
      const e = etat.verifs?.[v.nom];
      if (!e || e.t < derniereModif) manquantes.push(v.nom);
      else if (e.code && e.code !== 0) manquantes.push(`${v.nom} (ROUGE)`);
    }
    if (!manquantes.length) sortir(null);

    sortir({
      decision: 'block',
      reason:
        `Tu as modifié du code de production et tu n'as pas relancé :\n` +
        manquantes.map((m) => `  - ${m}`).join('\n') +
        `\n\nCLAUDE.md : « une tâche n'est finie que quand ces commandes sont ` +
        `vertes et que la sortie est collée ». Lance-les, colle la sortie réelle, ` +
        `puis conclus. Pas « ça devrait passer ».`,
    });
  }
} catch {
  sortir(null);
}
sortir(null);
