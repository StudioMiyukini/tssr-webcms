import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp, securityHeaders, type SecurityConfig } from './security.ts';

test('buildCsp contient les directives attendues', () => {
  const csp = buildCsp(false);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src 'self' data: https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /img-src 'self' data: blob: https:/);
  assert.match(csp, /frame-src[^;]*youtube-nocookie\.com/);
});

test('buildCsp : frameDeny bascule frame-ancestors', () => {
  assert.match(buildCsp(false), /frame-ancestors 'self'/);
  assert.match(buildCsp(true), /frame-ancestors 'none'/);
});

function run(cfg: SecurityConfig) {
  const headers: Record<string, string> = {};
  const res: any = { setHeader: (k: string, v: string) => { headers[k] = String(v); } };
  let nexted = false;
  securityHeaders(() => cfg)({} as any, res, () => { nexted = true; });
  return { headers, nexted };
}

test('securityHeaders pose les en-têtes de base et appelle next', () => {
  const { headers, nexted } = run({ cspEnabled: true, hstsEnabled: true, frameDeny: false, isProd: true });
  assert.equal(nexted, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.ok(headers['Content-Security-Policy']);
  assert.ok(headers['Strict-Transport-Security'], 'HSTS posé en prod');
});

test('securityHeaders : CSP désactivable, HSTS absent hors prod', () => {
  const off = run({ cspEnabled: false, hstsEnabled: true, frameDeny: true, isProd: false });
  assert.equal(off.headers['Content-Security-Policy'], undefined);
  assert.equal(off.headers['Strict-Transport-Security'], undefined, 'pas de HSTS en dev');
  assert.equal(off.headers['X-Frame-Options'], 'DENY');
});
