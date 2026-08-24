import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINUX_ENTRIES } from './linux-data.ts';
import { normaliser, radical, termes, rechercher } from './linux-recherche.ts';

/* L'outil existe pour répondre quand on ne connaît PAS le nom de la commande.
   Ces tests posent donc de vraies phrases d'élève, et vérifient que la bonne
   fiche remonte — pas seulement qu'il en remonte une. */

/** La commande de la première fiche trouvée, ou '(rien)'. */
const premier = (q: string) => rechercher(LINUX_ENTRIES, q)[0]?.commande ?? '(rien)';
/** Les N premières commandes. */
const tete = (q: string, n = 3) => rechercher(LINUX_ENTRIES, q).slice(0, n).map(e => e.commande);

test('les accents et la casse ne changent rien', () => {
  assert.equal(normaliser('Répertoire'), 'repertoire');
  assert.equal(normaliser('DÉMARRER'), 'demarrer');
});

test('le radical rapproche singulier et pluriel', () => {
  assert.equal(radical('fichiers'), radical('fichier'));
  assert.equal(radical('commandes'), radical('commande'));
  assert.equal(radical('processus'), radical('processus'));
});

test('les mots courts ne sont pas tronqués', () => {
  // Tronquer « ip » ou « ssh » ferait se rejoindre des choses sans rapport.
  assert.equal(radical('ip'), 'ip');
  assert.equal(radical('ssh'), 'ssh');
});

test('LES MOTS VIDES SONT JETÉS', () => {
  // Sans cela, « comment » ou « le » feraient remonter toutes les fiches.
  const t = termes('comment je fais pour voir les fichiers');
  assert.ok(!t.some(x => ['comment', 'je', 'pour', 'les', 'voir'].includes(x.mot)), JSON.stringify(t.map(x => x.mot)));
  // Le terme retenu est le RADICAL de « fichiers », pas le mot entier.
  assert.ok(t.some(x => x.mot === radical('fichier')), JSON.stringify(t.map(x => x.mot)));
});

test('une requête entièrement vide de sens ne filtre rien', () => {
  // « comment faire » ne dit rien : mieux vaut tout montrer que rien.
  assert.equal(termes('comment faire').length, 0);
  assert.equal(rechercher(LINUX_ENTRIES, 'comment faire').length, LINUX_ENTRIES.length);
});

test('LA PHRASE COMPLÈTE TROUVE, LÀ OÙ LE « CONTIENT » ÉCHOUAIT', () => {
  // Le défaut qu'on répare : la version précédente comparait la requête
  // entière au texte, et ne trouvait donc rien à une vraie question.
  assert.equal(premier('comment voir la place qui reste sur le disque'), 'df -h');
  assert.equal(premier('je veux connaitre mon adresse ip'), 'ip -br a');
  assert.ok(tete('trouver les gros fichiers qui prennent de la place').some(c => c.includes('find /')), tete('trouver les gros fichiers qui prennent de la place').join(' | '));
});

test('LES SYNONYMES rattrapent le mot que l’élève emploie', () => {
  // « place » n'apparaît pas dans la fiche de df : c'est « espace ».
  // On n'exige pas la premiere position : « plus de place » appelle
  // legitimement deux reponses — combien il reste, et ce qui l'occupe.
  assert.ok(tete('plus de place', 2).includes('df -h'), tete('plus de place', 2).join(' | '));
  // « tuer » n'est pas le mot de la fiche non plus.
  assert.ok(tete('tuer un programme').some(c => c.startsWith('kill')), tete('tuer un programme').join(' | '));
  // « dossier » et « répertoire » désignent la même chose.
  assert.ok(rechercher(LINUX_ENTRIES, 'creer un repertoire').length > 0);
});

test('les anciennes commandes mènent à la nouvelle', () => {
  assert.equal(premier('ifconfig'), 'ip -br a');
  assert.equal(premier('netstat'), 'sudo ss -tulpn');
});

test('les noms Windows mènent à l’équivalent Linux', () => {
  // Un TSSR arrive presque toujours de ce côté-là.
  assert.equal(premier('ipconfig'), 'ip -br a');
  assert.ok(tete('findstr').length > 0);
});

test('UN SEUL MOT PERDU NE FAIT PAS REMONTER N’IMPORTE QUOI', () => {
  // Il faut la moitié des termes : sans ce seuil, « place disque » sortirait
  // toutes les fiches contenant « disque ».
  const r = rechercher(LINUX_ENTRIES, 'zzzz place disque zzzz');
  assert.ok(r.length > 0, 'les termes utiles doivent quand même trouver');
  assert.equal(rechercher(LINUX_ENTRIES, 'zzzz yyyy xxxx').length, 0, 'du charabia ne trouve rien');
});

test('la catégorie restreint sans casser le classement', () => {
  const tout = rechercher(LINUX_ENTRIES, 'port');
  const reseau = rechercher(LINUX_ENTRIES, 'port', 'reseau');
  assert.ok(reseau.length > 0);
  assert.ok(reseau.length <= tout.length);
  assert.ok(reseau.every(e => e.categorie === 'reseau'));
});

test('la tâche pèse plus lourd qu’une mention de bas de page', () => {
  // « permission denied » est le titre d'une fiche et une note dans d'autres :
  // c'est la fiche dédiée qui doit sortir en tête.
  assert.equal(premier('permission denied'), 'namei -l /srv/compta/budgets/2026.ods');
});

test('chaque fiche est atteignable par sa propre tâche', () => {
  // Un catalogue dont une entrée ne se trouve pas est une entrée morte.
  const introuvables = LINUX_ENTRIES.filter(e => !rechercher(LINUX_ENTRIES, e.tache).includes(e));
  assert.deepEqual(introuvables.map(e => e.tache), []);
});
