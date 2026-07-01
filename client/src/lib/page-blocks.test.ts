import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePageBlock, renderPageBlocksToHtml, serializePageBlocks, normalizePageBlocks, youTubeId } from './page-blocks.ts';

test('le bloc texte échappe le HTML (anti-XSS)', () => {
  const b = Object.assign(makePageBlock('text'), { text: 'bonjour <script>alert(1)</script>' });
  const html = renderPageBlocksToHtml([b]);
  assert.ok(html.includes('&lt;script&gt;'), 'le <script> doit être échappé');
  assert.ok(!html.includes('<script>'), 'aucun <script> brut');
});

test('le bloc HTML brut insère le HTML tel quel', () => {
  const b = Object.assign(makePageBlock('html'), { html: '<aside>libre</aside>' });
  assert.ok(renderPageBlocksToHtml([b]).includes('<aside>libre</aside>'));
});

test('le bloc cartes rend une grille avec liens', () => {
  const b = Object.assign(makePageBlock('cards'), { items: [{ title: 'CV', text: 'desc', href: '/cv' }] });
  const html = renderPageBlocksToHtml([b]);
  assert.ok(html.includes('class="grid"'));
  assert.ok(html.includes('href="/cv"'));
});

test('le bloc colonnes est responsive (--cols) et imbrique ses enfants', () => {
  const c = makePageBlock('columns');
  c.columns = [[Object.assign(makePageBlock('heading'), { text: 'Gauche' })], [makePageBlock('text')]];
  const html = renderPageBlocksToHtml([c]);
  assert.ok(html.includes('class="pb-columns"'));
  assert.ok(html.includes('--cols:2'));
  assert.ok(html.includes('<h2>Gauche</h2>'));
});

test('round-trip blocs ↔ builder_json (récursif)', () => {
  const blocks = [makePageBlock('hero'), makePageBlock('columns')];
  const back = normalizePageBlocks(serializePageBlocks(blocks));
  assert.equal(back.length, 2);
  assert.equal(back[0].type, 'hero');
  assert.equal(back[1].type, 'columns');
  assert.equal(back[1].columns.length, 2);
});

test('youTubeId extrait l\'identifiant de diverses URL', () => {
  assert.equal(youTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youTubeId('pas une url'), '');
});

test('la galerie ignore les images vides', () => {
  const b = Object.assign(makePageBlock('gallery'), { images: [{ url: '/a.jpg', alt: 'A' }, { url: '', alt: '' }] });
  assert.equal((renderPageBlocksToHtml([b]).match(/pb-gallery-item/g) || []).length, 1);
});

test('la vidéo rend un iframe nocookie, vide si URL invalide', () => {
  const ok = Object.assign(makePageBlock('video'), { videoUrl: 'https://youtu.be/dQw4w9WgXcQ' });
  assert.ok(renderPageBlocksToHtml([ok]).includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  const bad = Object.assign(makePageBlock('video'), { videoUrl: 'nope' });
  assert.equal(renderPageBlocksToHtml([bad]), '');
});

test('accordéon rend des <details> natifs', () => {
  const b = Object.assign(makePageBlock('accordion'), { items: [{ title: 'Q1', text: 'R1', href: '' }] });
  const html = renderPageBlocksToHtml([b]);
  assert.ok(html.includes('<details class="pb-acc"><summary>Q1</summary>'));
});

test('onglets : radios + panneaux, plafonné à 6', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, text: `C${i}`, href: '' }));
  const b = Object.assign(makePageBlock('tabs'), { id: 'TB', items: many });
  const html = renderPageBlocksToHtml([b]);
  assert.equal((html.match(/class="pb-tab-panel"/g) || []).length, 6, 'max 6 onglets');
  assert.ok(html.includes('id="TB-tab-0"') && html.includes('checked'));
});

test('CTA, stats, citation, espaceur rendent correctement', () => {
  const cta = Object.assign(makePageBlock('cta'), { title: 'Rejoignez-nous', label: 'OK', href: '/x' });
  assert.ok(renderPageBlocksToHtml([cta]).includes('class="pb-cta"') && renderPageBlocksToHtml([cta]).includes('href="/x"'));
  const stats = Object.assign(makePageBlock('stats'), { items: [{ title: '99%', text: 'Uptime', href: '' }] });
  assert.ok(renderPageBlocksToHtml([stats]).includes('99%') && renderPageBlocksToHtml([stats]).includes('Uptime'));
  const q = Object.assign(makePageBlock('quote'), { text: 'Bravo', label: 'Client' });
  assert.ok(renderPageBlocksToHtml([q]).includes('<blockquote') && renderPageBlocksToHtml([q]).includes('— Client'));
  const sp = Object.assign(makePageBlock('spacer'), { size: 50 });
  assert.ok(renderPageBlocksToHtml([sp]).includes('height:50px'));
});

test('le bloc réseaux sociaux rend des boutons et ignore les liens vides', () => {
  const b = Object.assign(makePageBlock('social'), {
    links: [{ label: 'x', href: 'https://x.com/moi' }, { label: 'instagram', href: '' }, { label: 'email', href: 'hi@me.com' }],
  });
  const html = renderPageBlocksToHtml([b]);
  assert.ok(html.includes('class="pb-social"'));
  assert.equal((html.match(/pb-social-link/g) || []).length, 2, 'le réseau sans lien est ignoré');
  assert.ok(html.includes('pb-social-x') && html.includes('href="https://x.com/moi"'));
  assert.ok(html.includes('target="_blank"'), 'liens externes en nouvel onglet');
  assert.ok(html.includes('href="mailto:hi@me.com"'), 'email préfixé en mailto:');
});

test('normalizePageBlocks tolère un JSON invalide', () => {
  assert.deepEqual(normalizePageBlocks('pas du json'), []);
  assert.deepEqual(normalizePageBlocks(''), []);
});
