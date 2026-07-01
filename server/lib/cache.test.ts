import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicCache, clearPublicCache, cacheStats, type CacheConfig } from './cache.ts';

function makeRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    sent: undefined as unknown,
    ended: false,
    finishCbs: [] as Array<() => void>,
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = String(v); },
    getHeader(k: string) { return headers[k.toLowerCase()]; },
    headers,
    status(code: number) { res.statusCode = code; return res; },
    type(t: string) { headers['content-type'] = t; return res; },
    send(body: unknown) { res.sent = body; return res; },
    end() { res.ended = true; return res; },
    on(ev: string, cb: () => void) { if (ev === 'finish') res.finishCbs.push(cb); return res; },
  };
  return res;
}
const makeReq = (url: string, ifNoneMatch?: string) =>
  ({ method: 'GET', originalUrl: url, headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {} } as any);

const cfg: CacheConfig = { enabled: true, ttlMs: 1000 };

test('cache : MISS puis HIT sur la même URL', () => {
  clearPublicCache();
  const mw = publicCache(() => cfg);

  // 1er appel : MISS, le handler répond, on mémorise.
  const res1 = makeRes();
  let nextCalled = false;
  mw(makeReq('/api/public/pages/accueil'), res1, () => {
    nextCalled = true;
    res1.statusCode = 200;
    res1.setHeader('Content-Type', 'application/json');
    res1.send('{"ok":true}');
  });
  assert.equal(nextCalled, true);
  assert.equal(res1.getHeader('x-cache'), 'MISS');
  assert.equal(res1.sent, '{"ok":true}');

  // 2e appel : HIT, servi sans next().
  const res2 = makeRes();
  let next2 = false;
  mw(makeReq('/api/public/pages/accueil'), res2, () => { next2 = true; });
  assert.equal(next2, false, 'le handler ne doit pas être rappelé');
  assert.equal(res2.getHeader('x-cache'), 'HIT');
  assert.equal(res2.sent, '{"ok":true}');
  assert.ok(res2.getHeader('etag'), 'un ETag est posé');
});

test('cache : 304 quand If-None-Match correspond', () => {
  clearPublicCache();
  const mw = publicCache(() => cfg);
  const res1 = makeRes();
  mw(makeReq('/api/public/menus'), res1, () => {
    res1.setHeader('Content-Type', 'application/json');
    res1.send('[1,2,3]');
  });
  const etag = res1.getHeader('etag');
  assert.ok(etag);

  const res2 = makeRes();
  mw(makeReq('/api/public/menus', etag), res2, () => { throw new Error('ne doit pas être appelé'); });
  assert.equal(res2.statusCode, 304);
  assert.equal(res2.ended, true);
});

test('cache : désactivé → toujours next(), aucune mémorisation', () => {
  clearPublicCache();
  const mw = publicCache(() => ({ enabled: false, ttlMs: 1000 }));
  for (let i = 0; i < 2; i++) {
    const res = makeRes();
    let called = false;
    mw(makeReq('/api/public/theme'), res, () => { called = true; res.send('{}'); });
    assert.equal(called, true);
  }
  assert.equal(cacheStats({ enabled: false, ttlMs: 1000 }).entries, 0);
});

test('cache : ne mémorise pas les réponses non-200', () => {
  clearPublicCache();
  const mw = publicCache(() => cfg);
  const res = makeRes();
  mw(makeReq('/api/public/pages/inconnue'), res, () => {
    res.statusCode = 404;
    res.send('{"error":"x"}');
  });
  const res2 = makeRes();
  let called = false;
  mw(makeReq('/api/public/pages/inconnue'), res2, () => { called = true; });
  assert.equal(called, true, '404 non mis en cache → handler rappelé');
});

test('clearPublicCache vide les entrées', () => {
  clearPublicCache();
  const mw = publicCache(() => cfg);
  const res = makeRes();
  mw(makeReq('/api/public/x'), res, () => { res.send('data'); });
  assert.equal(cacheStats(cfg).entries, 1);
  clearPublicCache();
  assert.equal(cacheStats(cfg).entries, 0);
});
