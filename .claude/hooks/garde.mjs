#!/usr/bin/env node
/**
 * garde.mjs — la mécanique qui applique ce que CLAUDE.md se contente d'écrire.
 *
 * Trois modes, branchés en hooks Claude Code :
 *   pre   (PreToolUse)  — refuse d'écrire dans un fichier protégé, scellé,
 *                         ou hors d'un lot déclaré.
 *   post  (PostToolUse) — note ce qui a été modifié et quelle commande de
 *                         vérification a réellement tourné.
 *   stop  (Stop)        — refuse de conclure si les commandes qui font foi
 *                         n'ont pas été relancées depuis la dernière modif.
 *
 * Et les commandes utilitaires, appelées par les slash-commands :
 *   lot <id>   — ouvre un lot          sceau      — scelle les tests du lot
 *   fin        — ferme le lot          libre|strict — coupe/rallume la garde
 *   etape <nom> [lot] — note une étape amont (idee, brief, attaque) au journal
 *   reprise    (UserPromptSubmit) — l'auteur a répondu, la voie n'attend plus
 *
 * ÉTAT : `etat.voies[session]` — UNE VOIE PAR TERMINAL. Chaque terminal a son
 * lot, son sceau, ses modifs, ses vérifs et son mode. Ce qui reste commun :
 *   - les instruments protégés (globaux par nature) ;
 *   - le SCEAU, qui protège l'artefact et vaut donc pour toutes les voies.
 * Ce qui est par voie : le droit d'écrire du code de prod (c'est TON lot qui
 * l'ouvre), le blocage de fin, et /libre — un terminal ne désarme pas les autres.
 *
 * Le journal `.claude/journal-lots.jsonl` n'existe que pour être AFFICHÉ
 * (voir .claude/tableau.mjs). Il ne décide rien, et son échec ne bloque rien.
 *
 * PRINCIPE : en cas de doute ou d'erreur interne, la garde LAISSE PASSER.
 * Un garde qui bloque à tort coûte plus cher que le défaut qu'il attrape.
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

// Le journal est relu en boucle par le tableau : on le borne ici, sinon il
// grossit sans fin. 2 000 lignes couvrent des mois d'historique de lots.
const JOURNAL_MAX_OCTETS = 1_000_000;
const JOURNAL_LIGNES_GARDEES = 2000;

const MODE = process.argv[2] ?? 'pre';
const ARG = process.argv[3] ?? '';
const ARG2 = process.argv[4] ?? '';

const norm = (p) => String(p ?? '').replace(/\\/g, '/').toLowerCase();

// ── mini-glob : ** = n'importe quoi, * = pas de slash ────────────────────────
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
// Le journal est un affichage, pas une source de vérité : il échoue en silence.
function journaliser(racine, evt) {
  try {
    const f = join(racine, '.claude', 'journal-lots.jsonl');
    mkdirSync(dirname(f), { recursive: true });
    try {
      if (statSync(f).size > JOURNAL_MAX_OCTETS) {
        const lignes = readFileSync(f, 'utf8').split('\n').filter(Boolean);
        writeFileSync(f, lignes.slice(-JOURNAL_LIGNES_GARDEES).join('\n') + '\n');
      }
    } catch { /* pas encore de fichier, ou stat impossible */ }
    appendFileSync(f, JSON.stringify(evt) + '\n');
  } catch { /* rien à bloquer pour ça */ }
}


// ── M4 : ce que la campagne de mutations a laissé vivant ─────────────────────
// La garde LIT un rapport déposé par `scripts/rapport_mutations.py`. Elle ne
// joue rien : une mutation coûte un `pytest` complet, la clôture est bornée à
// deux secondes.
//
// 🔴 TROIS ÉTATS, TROIS PHRASES QUI NE SE RESSEMBLENT PAS. « 0 survivante » et
// « je n'ai rien mesuré » ont la même tête, et la seconde a l'apparence exacte
// d'une bonne nouvelle. Elles ne doivent jamais s'écrire pareil. Idem pour un
// module dont l'énumérateur ne tire rien : hors de portée, pas protégé.
//
// Elle N'ARRÊTE RIEN. Une survivante est un trou de test, pas un lot raté —
// et bloquer là-dessus rendrait la mesure coûteuse à porter, donc absente.
// M5 — le plancher de vraisemblance. Il vit ICI et pas dans `calibration.py`,
// qui est un instrument du moteur relationnel : y poser un seuil d'outillage
// mélangerait deux choses que la garde interdit justement de mélanger.
//
// 200 ms par mutation, et c'est choisi BAS exprès : jouer une mutation coûte
// un `pytest` complet, dont le seul démarrage de l'interpréteur dépasse déjà
// la centaine de millisecondes. Ce seuil n'accuse donc que l'arithmétiquement
// impossible. Un garde-fou qui accuse un honnête est un garde-fou contourné.
const MS_MIN_PAR_MUTATION = 200;

// 🔴 CE QUE LA GARDE PEUT DIRE DU TEXTE, ET RIEN DE PLUS.
// Elle parcourt les CLÉS d'`empreintes` — jamais `module`, qui est un champ
// libre où deux chemins peuvent tenir dans une phrase. Elle hache les OCTETS :
// ce dépôt est en CRLF sur disque et en LF dans git, et une empreinte prise
// sur du texte relu déclarerait « c'est le même fichier » d'un fichier dont
// toutes les fins de ligne ont changé.
//
// Quatre états, et « pas lisible » n'est PAS « ça a changé » : un fichier
// introuvable est le cas ordinaire d'une clôture lancée hors de la racine.
function provenance(racine, r) {
  const e = r.empreintes;
  // Un tableau a des clés (« 0 ») : sans contrôle de TYPE, une liste entrerait
  // dans la boucle et retirerait la bonne nouvelle par accident, pas par
  // décision. C'est le défaut de M4 du 22/08, une échelle plus bas.
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { etat: 'NON_ETABLIE' };

  const cles = Object.keys(e);
  // « toutes concordantes » sur zéro entrée est vrai et ne dit rien du texte.
  if (cles.length === 0) return { etat: 'NON_ETABLIE' };

  const differents = [], illisibles = [];
  for (const cle of cles) {
    // La clé sert de chemin TELLE QUELLE — pas de `norm()`, qui minuscule et
    // ferait collisionner deux fichiers là où le système les distingue.
    const p = String(cle).replace(/\\/g, '/');
    if (/^([a-zA-Z]:)?\//.test(p) || p.split('/').includes('..')) { illisibles.push(cle); continue; }
    let vu;
    try { vu = createHash('sha256').update(readFileSync(join(racine, p))).digest('hex'); }
    catch { illisibles.push(cle); continue; }
    if (vu !== String(e[cle]).toLowerCase()) differents.push(cle);
  }
  if (differents.length) return { etat: 'AUTRE_TEXTE', differents, illisibles };
  if (illisibles.length) return { etat: 'NON_VERIFIABLE', illisibles };
  return { etat: 'ETABLIE' };
}

function rapportMutations(racine, idLot, modifs) {
  const f = join(racine, '.claude', 'mutations', `${idLot}.json`);
  let brut;
  try { brut = readFileSync(f, 'utf8'); }
  catch { return `Mutations — aucune mesure déposée pour « ${idLot} ». Tous les lots ne sont pas énumérables.`; }

  let r;
  try { r = JSON.parse(brut); } catch { r = null; }
  // Un rapport qui n'a pas la FORME d'un rapport n'est PAS « 0 survivante » :
  // c'est une absence de mesure. Sans ce controle, une liste cassee en `null`
  // s'affichait comme une bonne nouvelle -- trouve le 22/08 a l'attaque.
  // M6 : `production` recoit le MEME controle. ABSENT reste licite -- les
  // rapports deposes avant ce lot n'ont pas ce champ et se lisent comme
  // avant -- mais present-et-pas-une-liste est une absence de mesure, pas
  // une liste vide. C'est le defaut de M4.Y et de M5.X, une troisieme fois.
  if (!r || typeof r !== 'object' || typeof r.total !== 'number'
      || typeof r.tuees !== 'number' || typeof r.erreurs !== 'number'
      || !Array.isArray(r.survivantes)
      || (r.production !== undefined && !Array.isArray(r.production)))
    return `Mutations — le rapport de « ${idLot} » est illisible. Aucune mesure.`;

  // Le nom du fichier ne dit pas de quoi il parle : un rapport copié depuis un
  // autre lot porterait des survivantes qui ne concernent pas celui-ci.
  if (r.lot !== idLot)
    return `Mutations — le rapport trouvé pour « ${idLot} » dit porter sur « ${r.lot} ». Ignoré, aucune mesure.`;

  // M5 — les deux questions qui décident si une bonne nouvelle a le droit de
  // s'imprimer. Elles se posent AVANT, parce qu'elles ne portent pas sur le
  // même objet : l'une sur le texte, l'autre sur l'arithmétique.
  const prov = provenance(racine, r);
  const duree = Number(r.duree_ms);
  // Une durée qui n'est pas un nombre fini strictement positif n'est PAS une
  // durée nulle : c'est une durée non déclarée. Tous les rapports d'avant M5
  // sont dans ce cas et aucun ne doit être accusé.
  const dureeDeclaree = Number.isFinite(duree) && duree > 0;
  // Une DIVISION, pas un seuil : un plancher comparé à la durée absolue
  // laisserait passer 2 000 mutations en 10 secondes.
  const invraisemblable = dureeDeclaree && r.total > 0
    && duree / r.total < MS_MIN_PAR_MUTATION;

  const lignes = [];
  if (r.total === 0) {
    lignes.push(`Mutations — ${idLot} : 0 mutation tirée sur ${r.module || 'ce module'}.`);
    lignes.push(`Ce module est HORS DE PORTÉE de l'énumérateur — ce n'est pas « aucune survivante ».`);
  } else {
    const d = new Date(r.mesure_le);
    const p2 = (n) => String(n).padStart(2, '0');
    const quand = Number.isFinite(r.mesure_le)
      ? ` (mesuré le ${p2(d.getDate())}/${p2(d.getMonth() + 1)} à ${p2(d.getHours())}:${p2(d.getMinutes())})`
      : '';
    const noms = r.survivantes;  // deja verifie tableau plus haut
    // Les erreurs sont comptées À PART : un mutant ni tué ni survivant est une
    // mesure ratée, et la noyer dans « tuées » remet la panne qu'on supprime.
    const erreurs = Number(r.erreurs) > 0 ? `, ${r.erreurs} en ERREUR` : '';
    if (noms.length === 0) {
      // 🔴 La ligne rassurante est REMPLACÉE, pas annotée. Une bonne nouvelle
      // suivie d'un avertissement se lit comme une bonne nouvelle.
      if (prov.etat === 'ETABLIE' && !invraisemblable)
        lignes.push(`Mutations — ${idLot} : ${r.total} jouées, 0 survivante${erreurs}${quand}.`);
      else
        lignes.push(`Mutations — ${idLot} : le rapport ANNONCE ${r.total} jouées et aucun survivant${erreurs}${quand}.`);
    } else {
      lignes.push(`Mutations — ${idLot} : ${r.total} jouées, ${r.tuees} tuées, ${noms.length} SURVIVANTE${noms.length > 1 ? 'S' : ''}${erreurs}${quand}.`);
      // Un nom par ligne : 73 noms collés sur une ligne ne se lisent pas.
      for (const n of noms) lignes.push(`  - ${n}`);
      lignes.push(`La clôture n'est pas bloquée. Une survivante est un trou de test, pas un lot raté.`);
    }
  }

  // M5 — les refus. Ils s'ajoutent aux mauvaises nouvelles, ils n'en effacent
  // aucune : ce lot supprime des bonnes nouvelles, pas des survivantes.
  // Les deux causes se disent ENSEMBLE — la première trouvée ne fait pas taire
  // la seconde, sans quoi l'auteur redécouvrirait le fait à la remesure.
  if (prov.etat === 'NON_ETABLIE') {
    lignes.push(`⛔ Provenance NON ÉTABLIE — ce rapport ne dit pas sur quel texte il porte.`);
  } else if (prov.etat === 'AUTRE_TEXTE') {
    lignes.push(`⛔ Cette mesure porte sur un AUTRE TEXTE que celui présent sur disque :`);
    for (const f of prov.differents) lignes.push(`  ≠ ${f}`);
    for (const f of prov.illisibles || []) lignes.push(`  ? ${f} — pas relu`);
  } else if (prov.etat === 'NON_VERIFIABLE') {
    // Un fichier introuvable n'a pas « changé » : la clôture tourne peut-être
    // hors de la racine, et crier au changement rendrait le vrai changement
    // indiscernable du cas ordinaire.
    lignes.push(`⛔ Provenance NON VÉRIFIABLE — ces fichiers n'ont pas pu être relus :`);
    for (const f of prov.illisibles) lignes.push(`  ? ${f}`);
  }
  if (invraisemblable) {
    const par = Math.round(duree / r.total);
    lignes.push(`⛔ Campagne INVRAISEMBLABLE : ${r.total} mutations en ${duree} ms, soit ${par} ms chacune. Jouer une mutation coûte un pytest complet.`);
  }

  // Fraîcheur — comparée aux fichiers que le RAPPORT nomme, pas à tout ce que
  // la voie a touché : un journal de bord qui bouge ne change aucun résultat.
  // Et si `modifs` ne porte aucun de ces fichiers, on ne conclut RIEN : depuis
  // T-58, un fichier écrit par un script n'est vu par personne.
  const vises = [
    r.module,
    ...(Array.isArray(r.production) ? r.production : []),
    ...(Array.isArray(r.tests) ? r.tests : []),
  ].filter(Boolean).map(norm);
  const vus = Object.entries(modifs || {})
    .filter(([k]) => vises.includes(norm(k)))
    .map(([, t]) => Number(t))
    .filter(Number.isFinite);
  if (vus.length && Number(r.mesure_le) < Math.max(...vus))
    lignes.push(`⚠️ Cette mesure est ANTÉRIEURE à ta dernière modification — elle porte sur un autre texte.`);

  return lignes.join('\n');
}

// ── entrée ───────────────────────────────────────────────────────────────────
let entree = {};
try {
  const brut = readFileSync(0, 'utf8');
  if (brut.trim()) entree = JSON.parse(brut);
} catch { /* laisser passer */ }

const RACINE = entree.cwd || process.cwd();
const CFG = lire(join(RACINE, '.claude', 'garde.config.json'), null);
const ETAT_F = join(RACINE, '.claude', 'etat-garde.json');
const etat = lire(ETAT_F, {});

// ── les VOIES : un terminal = une voie ───────────────────────────────────────
// Les hooks reçoivent `session_id`, les slash-commands lisent la variable
// d'environnement. Vérifié le 13/08 : les deux portent la MÊME valeur.
// Un sous-agent partage la session ET le PID de son terminal parent — il écrit
// donc dans la voie de celui-ci, et c'est voulu : l'unité qui écrit, c'est le
// terminal.
const SESSION = entree.session_id || process.env.CLAUDE_CODE_SESSION_ID || 'inconnue';

// Ancien état à emplacement unique -> une voie, celle de l'appelant. Sans ça,
// changer la forme de l'état perdrait un lot scellé en cours.
function migrer(e) {
  if (e.voies) {
    // Reliquats d'un ancien format : les laisser traîner ferait croire à un
    // second état, alors qu'ils ne sont plus lus par personne.
    delete e.lot; delete e.modifs; delete e.verifs; delete e.pouls;
    return e;
  }
  e.voies = {
    [SESSION]: {
      etiquette: 't1',
      lot: e.lot ?? null,
      modifs: e.modifs ?? {},
      verifs: e.verifs ?? {},
      pouls: e.pouls ?? null,
      mode: e.mode ?? 'strict',
      pid: Number(process.env.CLAUDE_PID) || null,
    },
  };
  delete e.lot; delete e.modifs; delete e.verifs; delete e.pouls;
  e.mode = 'strict';          // ne reste que comme défaut des voies à venir
  return e;
}
migrer(etat);

// « t1 », « t2 »… : un UUID de session ne se lit pas. L'étiquette est attribuée
// une fois et ne bouge plus, sinon les lignes du tableau dansent.
function prochaineEtiquette() {
  const pris = Object.values(etat.voies)
    .map((v) => Number(String(v.etiquette ?? '').slice(1)))
    .filter((n) => Number.isFinite(n));
  return 't' + (Math.max(0, ...pris) + 1);
}

function voie(creer) {
  if (!etat.voies[SESSION] && creer)
    etat.voies[SESSION] = {
      etiquette: prochaineEtiquette(),
      lot: null, modifs: {}, verifs: {}, pouls: null,
      mode: etat.mode ?? 'strict',
      pid: Number(process.env.CLAUDE_PID) || null,
    };
  return etat.voies[SESSION] ?? null;
}

const sortir = (o) => { if (o) process.stdout.write(JSON.stringify(o)); process.exit(0); };
const refus = (raison) => sortir({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: raison,
  },
});

try {
  // ── commandes utilitaires ─────────────────────────────────────────────────
  // UserPromptSubmit. Tu viens de parler : la voie n'attend plus. N'imprime
  // RIEN — la sortie d'un hook de prompt serait injectée dans le tour.
  if (MODE === 'reprise') {
    const v = voie(true);
    v.pouls = { t: Date.now(), outil: 'message' };
    ecrire(ETAT_F, etat);
    journaliser(RACINE, {
      t: Date.now(), etape: 'reprise', lot: v.lot?.id ?? null,
      session: SESSION, etiquette: v.etiquette,
    });
    process.exit(0);
  }
  if (MODE === 'etape') {
    const v = voie(true);
    ecrire(ETAT_F, etat);                        // la voie doit exister au tableau
    journaliser(RACINE, {
      t: Date.now(), etape: ARG, lot: ARG2 || v.lot?.id || null,
      session: SESSION, etiquette: v.etiquette,
    });
    console.log(`Étape « ${ARG} » notée${ARG2 ? ` — ${ARG2}` : ''} (${v.etiquette}).`);
    process.exit(0);
  }
  if (MODE === 'lot') {
    const v = voie(true);
    v.lot = { id: ARG, ouvert: Date.now(), scelle: false };
    v.modifs = {}; v.verifs = {};
    ecrire(ETAT_F, etat);
    journaliser(RACINE, {
      t: v.lot.ouvert, etape: 'scelle', lot: ARG,
      session: SESSION, etiquette: v.etiquette,
    });
    console.log(`Lot « ${ARG} » ouvert sur la voie ${v.etiquette}. La garde est active.`);
    process.exit(0);
  }
  if (MODE === 'sceau') {
    const v = voie(false);
    if (v?.lot) { v.lot.scelle = true; ecrire(ETAT_F, etat); }
    console.log('Tests scellés. Toute écriture dedans sera refusée.');
    process.exit(0);
  }
  if (MODE === 'fin') {
    const v = voie(false);
    if (v?.lot)
      journaliser(RACINE, {
        t: Date.now(), etape: 'fin', lot: v.lot.id, ouvert: v.lot.ouvert,
        session: SESSION, etiquette: v.etiquette,
      });
    // L'ORDRE COMPTE : on ferme d'abord, on lit le rapport ensuite. Si la
    // lecture explose, le lot est déjà fermé et rien n'est perdu.
    const idLot = v?.lot?.id ?? null;
    const modifs = v?.modifs ?? {};
    if (v) { v.lot = null; v.modifs = {}; v.verifs = {}; ecrire(ETAT_F, etat); }
    console.log('Lot fermé.');
    if (idLot) {
      try { console.log(rapportMutations(RACINE, idLot, modifs)); }
      catch { /* la garde LAISSE PASSER : le lot est fermé, c'est l'essentiel */ }
    }
    process.exit(0);
  }
  if (MODE === 'libre' && ARG === 'sceau') {
    const v = voie(false);
    if (v?.lot) { v.lot.scelle = false; ecrire(ETAT_F, etat); }
    console.log('Sceau LEVÉ. Le reste de la garde tient toujours debout.');
    process.exit(0);
  }
  if (MODE === 'libre' || MODE === 'strict') {
    // Par voie, et seulement la sienne : un terminal ne désarme pas les autres.
    const v = voie(true);
    v.mode = MODE;
    if (MODE === 'strict' && v.lot) v.lot.scelle = true;
    ecrire(ETAT_F, etat);
    console.log(MODE === 'libre'
      ? `Garde COUPÉE sur la voie ${v.etiquette} — instruments, sceau, blocage de fin.\n`
        + `Les autres terminaux ne sont pas touchés. Pense à /strict.`
      : `Garde rallumée sur la voie ${v.etiquette}, sceau remis.`);
    process.exit(0);
  }

  if (!CFG || voie(false)?.mode === 'libre') sortir(null);

  const racineN = norm(RACINE).replace(/\/$/, '');
  const relatif = (abs) => {
    const a = norm(abs);
    return a.startsWith(racineN + '/') ? a.slice(racineN.length + 1) : a;
  };

  // ── PRE : le seul endroit qui dit non ─────────────────────────────────────
  if (MODE === 'pre') {
    const outil = entree.tool_name ?? '';

    // Bash : le shell est la porte dérobée. Un `echo > fichier` contourne Edit/
    // Write. On refuse toute commande qui nomme un chemin protégé (ou du code de
    // prod sans lot) avec un geste d'écriture — sauf une commande de vérification
    // déclarée, seul chemin légitime pour produire un rapport.
    if (outil === 'Bash') {
      const cmd = String(entree.tool_input?.command ?? '');
      const estVerif = (CFG.verifications ?? []).some((v) => v.motifs.some((m) => cmd.includes(m)));
      if (estVerif) sortir(null);
      const ecrit = /(^|[^<])>|\b(tee|cp|mv|rm|del|copy|move|touch|dd)\b|Set-Content|Out-File|Add-Content|Remove-Item|Move-Item|Copy-Item|New-Item|sed\s+-i|python3?\s+-c|node\s+-e/i.test(cmd);
      if (!ecrit) sortir(null);
      const jetons = cmd.split(/[\s"'`|;&()]+/).map((t) => relatif(t.replace(/^\.[\/\\]/, '')).replace(/\\/g, '/')).filter(Boolean);
      for (const m of CFG.proteges ?? []) {
        const t = jetons.find((j) => match(j, m));
        if (t) refus(`La commande shell écrit vers « ${t} », un INSTRUMENT.\n` +
                     `Le shell n'est pas une porte dérobée : un rapport sort d'une commande de ` +
                     `vérification déclarée, ou il n'existe pas. Sinon : demande à l'auteur, /libre.`);
      }
      const scelleurB = Object.values(etat.voies).find((v) => v.lot?.scelle);
      if (scelleurB) {
        for (const m of CFG.scelles ?? []) {
          const t = jetons.find((j) => match(j, m));
          if (t) refus(`La commande shell écrit vers « ${t} », un test SCELLÉ du lot ${scelleurB.lot.id}.\n` +
                       `Écrit avant le code, depuis le brief. Le modifier pour le faire passer, c'est truquer l'examen. ` +
                       `Si le test est FAUX, c'est une décision de l'auteur : dis-le et arrête-toi.`);
        }
      }
      for (const f of Object.keys(CFG.plafonds ?? {})) {
        const t = jetons.find((j) => match(j, f));
        if (t) refus(`« ${t} » est plafonné à ${CFG.plafonds[f]} lignes : il s'édite avec Edit/Write, ` +
                     `jamais par le shell (impossible de compter ce qu'un \`>>\` produit).`);
      }
      const mienB = voie(false);
      if (!mienB?.lot) {
        for (const m of CFG.source ?? []) {
          const t = jetons.find((j) => match(j, m));
          if (t) refus(`La commande shell écrit vers « ${t} » et aucun lot n'est ouvert sur ce terminal.\n` +
                       `Ouvre d'abord : ${CFG.ouvrir ?? '/brief <id-du-lot>'}.`);
        }
      }
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

    const mien = voie(false);                    // la voie de CE terminal

    // Le sceau protège l'ARTEFACT, pas la voie : n'importe quelle voie qui a
    // scellé ferme le fichier pour tout le monde. Sinon le terminal 2 pourrait
    // « corriger » les tests scellés du terminal 1, ce qui est exactement le
    // trucage que le sceau existe pour empêcher.
    const scelleur = Object.values(etat.voies).find((v) => v.lot?.scelle);
    if (scelleur) {
      for (const m of CFG.scelles ?? []) {
        if (match(rel, m))
          refus(`« ${rel} » fait partie des tests SCELLÉS du lot ${scelleur.lot.id}`
                + `${scelleur === mien ? '' : ` (voie ${scelleur.etiquette}, pas la tienne)`}.\n`
                + `Ils ont été écrits avant le code, depuis la spec. Les modifier `
                + `pour les faire passer, c'est truquer l'examen.\n`
                + `Si le test est FAUX, c'est une décision de l'auteur, pas la tienne : `
                + `dis-le et arrête-toi.`);
      }
    }

    // Celui-ci reste par voie : c'est TON lot qui t'ouvre le code, pas celui du
    // voisin.
    // Plafond : l'état se réécrit, il ne se rallonge pas. On compte le résultat.
    for (const f of Object.keys(CFG.plafonds ?? {})) {
      if (!match(rel, f)) continue;
      const max = Number(CFG.plafonds[f]);
      const compter = (s) => String(s).split(/\r?\n/).filter((l, i, a) => i < a.length - 1 || l !== '').length;
      let futur = null;
      const ti = entree.tool_input ?? {};
      if (outil === 'Write') futur = compter(ti.content ?? '');
      else if (outil === 'Edit' || outil === 'MultiEdit') {
        let s;
        try { s = readFileSync(ti.file_path, 'utf8'); } catch { break; }   // fichier neuf : on laisse
        const edits = outil === 'Edit' ? [ti] : (ti.edits ?? []);
        for (const e of edits) {
          if (!e.old_string) continue;
          s = e.replace_all ? s.split(e.old_string).join(e.new_string ?? '')
                            : s.replace(e.old_string, () => e.new_string ?? '');
        }
        futur = compter(s);
      }
      if (futur !== null && futur > max)
        refus(`« ${rel} » ferait ${futur} lignes, plafond ${max}.\n` +
              `L'état se réécrit, il ne se rallonge pas : condense, ou sors l'histoire vers ` +
              `docs/archive/ ou journal/. Le plafond est dans .claude/garde.config.json.`);
    }

    const estSource = (CFG.source ?? []).some((m) => match(rel, m));
    if (estSource && !mien?.lot) {
      const autres = Object.values(etat.voies).filter((v) => v.lot);
      refus(`Aucun lot n'est ouvert sur ce terminal, et « ${rel} » est du code de production.\n`
            + `Ouvre d'abord : ${CFG.ouvrir ?? '/brief <id-du-lot>'}.\n`
            + `Critère de sortie AVANT le code — c'est ce qui évite les allers-retours.`
            + (autres.length
                ? `\n\nÀ noter : ${autres.map((v) => `${v.etiquette} tient le lot ${v.lot.id}`).join(', ')}. `
                  + `Le lot d'un autre terminal ne t'ouvre pas le code.`
                : ''));
    }

    sortir(null);
  }

  // ── POST : on note, on ne juge pas ────────────────────────────────────────
  if (MODE === 'post') {
    const outil = entree.tool_name ?? '';
    // `true` : la première activité d'un terminal lui ouvre sa voie. C'est ce
    // qui le fait apparaître au tableau sans qu'il ait à se déclarer.
    const mien = voie(true);
    if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(outil)) {
      const rel = relatif(entree.tool_input?.file_path ?? '');
      if ((CFG.source ?? []).some((m) => match(rel, m)))
        mien.modifs[rel] = Date.now();
    } else if (outil === 'Bash') {
      const cmd = String(entree.tool_input?.command ?? '');
      const echec = entree.tool_response?.exit_code ?? entree.tool_response?.exitCode;
      for (const v of CFG.verifications ?? []) {
        if (v.motifs.some((m) => cmd.includes(m)))
          mien.verifs[v.nom] = { t: Date.now(), code: echec ?? 0 };
      }
    }
    // Battement de cœur : c'est lui qui distingue « terminal en train de
    // travailler » de « terminal ouvert et inerte » dans le tableau.
    mien.pouls = { t: Date.now(), outil };
    ecrire(ETAT_F, etat);
    sortir(null);
  }

  // ── STOP : « c'est fini » n'est pas une opinion ───────────────────────────
  if (MODE === 'stop') {
    // Par voie : on ne réclame à ce terminal que SES modifications. Lui coller
    // celles du voisin le bloquerait sur un travail qu'il n'a pas fait.
    const mien = voie(false);

    // Ne pas bloquer, c'est rendre la main à l'auteur. C'est le seul instant où
    // la machine CONSTATE qu'un terminal attend une réponse — le modèle ne le
    // déclare pas, il l'oublierait, et une étape déclarée ment.
    const attendre = () => {
      if (mien)
        journaliser(RACINE, {
          t: Date.now(), etape: 'attente', lot: mien.lot?.id ?? null,
          session: SESSION, etiquette: mien.etiquette,
        });
      sortir(null);
    };

    if (entree.stop_hook_active) attendre();            // anti-boucle
    const derniereModif = Math.max(0, ...Object.values(mien?.modifs ?? {}));
    if (!derniereModif) attendre();

    const manquantes = [];
    for (const v of CFG.verifications ?? []) {
      const e = mien.verifs?.[v.nom];
      if (!e || e.t < derniereModif) manquantes.push(v.nom);
      else if (e.code && e.code !== 0) manquantes.push(`${v.nom} (ROUGE)`);
    }
    // Bloqué = le travail continue, donc pas d'attente : rien au journal.
    if (!manquantes.length) attendre();

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
  sortir(null);   // fail-open, toujours
}
sortir(null);
