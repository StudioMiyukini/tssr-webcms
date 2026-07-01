import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, noteSnippet, wordCount, noteTitleOr, relativeTime } from './notes.ts';

test('stripHtml retire les balises et décode les entités', () => {
  assert.equal(stripHtml('<p>Bonjour <b>monde</b></p>'), 'Bonjour monde');
  assert.equal(stripHtml('a&nbsp;&amp;&nbsp;b'), 'a & b');
  assert.equal(stripHtml('<ul><li>un</li><li>deux</li></ul>'), 'un deux');
});

test('noteSnippet tronque au-delà de la limite', () => {
  assert.equal(noteSnippet('<p>court</p>', 140), 'court');
  const long = '<p>' + 'mot '.repeat(60) + '</p>';
  const s = noteSnippet(long, 20);
  assert.ok(s.endsWith('…'));
  assert.ok(s.length <= 21);
});

test('wordCount compte les mots, 0 si vide', () => {
  assert.equal(wordCount(''), 0);
  assert.equal(wordCount('<p>   </p>'), 0);
  assert.equal(wordCount('<p>un deux trois</p>'), 3);
});

test('noteTitleOr applique le repli', () => {
  assert.equal(noteTitleOr('  '), 'Sans titre');
  assert.equal(noteTitleOr('Mon titre'), 'Mon titre');
  assert.equal(noteTitleOr('', 'Vide'), 'Vide');
});

test('relativeTime produit des libellés relatifs', () => {
  const now = Date.parse('2026-06-04T12:00:00Z');
  assert.equal(relativeTime('2026-06-04T11:59:40Z', now), 'à l’instant');
  assert.equal(relativeTime('2026-06-04 11:30:00', now), 'il y a 30 min'); // format SQLite (espace, UTC)
  assert.equal(relativeTime('2026-06-04T09:00:00Z', now), 'il y a 3 h');
  assert.equal(relativeTime('2026-06-03T10:00:00Z', now), 'hier');
  assert.equal(relativeTime('', now), '');
});
