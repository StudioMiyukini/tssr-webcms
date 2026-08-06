import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';

/**
 * Atelier Réseau & Packet Tracer — assistant multi-étapes à contexte partagé.
 * Îlot React hydraté via RichContent (data-block="network-workshop").
 *
 * Étapes : 1) Contexte  2) Préférences  3) Segmentation (multi-routeurs + attribution
 * automatique des interfaces)  4) Schéma  5) Pools DHCP  6) DNS.
 * Le contexte est persisté dans le navigateur (localStorage) et partagé entre les étapes.
 *
 * NB : les étapes 4-6 sont en cours de construction (placeholders) — le moteur de calcul
 * (computePlan) est déjà central pour les alimenter ensuite.
 */

// ─────────────────────────────────────────── Helpers IP ───────────────────────────────────────────
const ipToStr = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
function strToIp(s: string): number | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1, 5).map(Number);
  if (o.some(x => x > 255)) return null;
  return (((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
}
const maskFromCidr = (c: number) => (c === 0 ? 0 : (0xFFFFFFFF << (32 - c)) >>> 0);
const wildcardFromCidr = (c: number) => (~maskFromCidr(c)) >>> 0;
const hostBitsFor = (need: number) => { let n = 1; while (Math.pow(2, n) - 2 < Math.max(1, need)) n++; return n; };
const clampNum = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────── Modèle (contexte) ───────────────────────────────────────────
export type RouterModel = '2811' | '2911';
export type LinkMedia = 'serial' | 'gig';

// Un réseau de base à découper (on peut en avoir plusieurs, distincts).
export type BaseNet = { id: string; name: string; ip: string; cidr: string };
// Un sous-réseau : 1 routeur = LAN (passerelle), 2+ routeurs = segment d'interconnexion. baseId = bloc d'adresses.
export type Service = { id: string; name: string; hosts: string; routerIds: string[]; hasSwitch: boolean; dhcp: boolean; media?: LinkMedia; baseId?: string };
export type RouterDef = { id: string; name: string; model: RouterModel; mod?: boolean };

export type Ctx = {
  // 1. Contexte
  entreprise: string; domaine: string; mode: 'neuf' | 'extension';
  baseIp: string; baseCidr: string;             // rétro-compat (migré vers bases[0])
  bases: BaseNet[];                              // un ou plusieurs réseaux de base distincts
  services: Service[];
  // 3. Topologie
  routers: RouterDef[];
  // 2. Préférences
  login: string; mdp: string; secret: string;
  gwPos: 'last' | 'first';                 // position IP passerelle (routeur) dans le sous-réseau
  switchPos: 'beforeRouter' | 'firstHost'; // position IP de gestion du switch
  linkCidr: string;                        // masque des liaisons inter-routeurs (/30 par défaut)
  dnsServer: string;
  dhcpServer: string;                      // IP du serveur DHCP (relais ip helper-address)
  leaseDays: string;                       // durée du bail DHCP (jours)
  // Sortie Internet (NAT/PAT) — optionnel
  internetRouterId: string;                // routeur de bordure ('' = pas de NAT)
  wanIf: string;                           // interface WAN (vers le FAI)
  wanIp: string; wanCidr: string;          // adresse WAN
  faiGw: string;                           // passerelle du FAI / de la salle
  webIp: string; webPort: string;          // serveur web à publier (facultatif)
  natOverload: boolean;                     // générer le PAT (overload) — décocher pour du NAT statique seul
  natStatics: { inside: string; pub: string }[]; // NAT statique 1:1 : IP interne -> IP publique
  // Adressage manuel (facultatif — sinon calcul automatique)
  ifaceIps: Record<string, string>;         // IP forcée d'une interface routeur, clé `${routerId}|${iface}`
  hosts: StaticHost[];                       // end-points à IP fixe (serveurs, postes)
};
// Un hôte terminal à adresse fixe rattaché à un sous-réseau.
export type StaticHost = { id: string; name: string; subId: string; ip: string };

let _uid = 0;
// Identifiant unique : compteur + suffixe aléatoire → jamais de collision avec un id par défaut
// (ex. la base 'b1') ni entre sessions (le compteur repart de 0 à chaque chargement de page).
const uid = (p: string) => `${p}${++_uid}_${Math.random().toString(36).slice(2, 6)}`;
// Force des id UNIQUES dans une liste (répare les états sauvegardés avec des id en double).
const dedupeIds = <T extends { id: string }>(arr: T[], p: string): T[] => { const seen = new Set<string>(); return arr.map(x => { let id = x.id; if (!id || seen.has(id)) id = uid(p); seen.add(id); return { ...x, id }; }); };

export const DEFAULT_CTX: Ctx = {
  entreprise: 'Miyukini', domaine: 'miyukini.lan', mode: 'neuf',
  baseIp: '192.168.10.0', baseCidr: '24',
  bases: [{ id: 'b1', name: 'Réseau principal', ip: '192.168.10.0', cidr: '24' }],
  services: [
    { id: 'sA', name: 'Production', hosts: '100', routerIds: ['rA'], hasSwitch: true, dhcp: true, baseId: 'b1' },
    { id: 'sB', name: 'Bureaux', hosts: '50', routerIds: ['rA'], hasSwitch: true, dhcp: true, baseId: 'b1' },
    { id: 'sC', name: 'Wi-Fi', hosts: '20', routerIds: ['rB'], hasSwitch: true, dhcp: true, baseId: 'b1' },
    { id: 'sD', name: 'Dorsale R1-R2', hosts: '2', routerIds: ['rA', 'rB'], hasSwitch: true, dhcp: false, media: 'gig', baseId: 'b1' },
  ],
  routers: [
    { id: 'rA', name: 'R1', model: '2911' },
    { id: 'rB', name: 'R2', model: '2811' },
  ],
  login: 'admin', mdp: 'Azerty77', secret: 'MonSecretEnable',
  gwPos: 'last', switchPos: 'beforeRouter', linkCidr: '30', dnsServer: '192.168.10.11', dhcpServer: '192.168.10.11', leaseDays: '7',
  internetRouterId: '', wanIf: 'GigabitEthernet0/1', wanIp: '', wanCidr: '30', faiGw: '', webIp: '', webPort: '80',
  natOverload: true, natStatics: [],
  ifaceIps: {}, hosts: [],
};

// Normalise un contexte issu du localStorage (tolère les anciens formats :
// services {routerId} → {routerIds}, et anciens links → sous-réseaux d'interconnexion).
export function migrateCtx(raw: unknown): Ctx {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const c = { ...DEFAULT_CTX, ...r } as Ctx;
  delete (c as any).links;
  c.routers = dedupeIds((Array.isArray(c.routers) ? c.routers : DEFAULT_CTX.routers).map((rt: any) => ({ id: rt?.id, name: String(rt?.name ?? 'R'), model: rt?.model === '2811' ? '2811' : '2911', mod: !!rt?.mod } as RouterDef)), 'r');
  c.natStatics = Array.isArray((c as any).natStatics) ? (c as any).natStatics.filter((s: any) => s && typeof s === 'object').map((s: any) => ({ inside: String(s.inside ?? ''), pub: String(s.pub ?? '') })) : [];
  c.natOverload = typeof (c as any).natOverload === 'boolean' ? (c as any).natOverload : true;
  c.ifaceIps = (r.ifaceIps && typeof r.ifaceIps === 'object' && !Array.isArray(r.ifaceIps))
    ? Object.fromEntries(Object.entries(r.ifaceIps).filter(([k, v]) => typeof k === 'string' && typeof v === 'string')) as Record<string, string>
    : {};
  c.hosts = dedupeIds((Array.isArray(r.hosts) ? r.hosts : []).filter((h: any) => h && typeof h === 'object').map((h: any) => ({ id: typeof h.id === 'string' ? h.id : uid('h'), name: String(h.name ?? ''), subId: String(h.subId ?? ''), ip: String(h.ip ?? '') })), 'h');
  // Réseaux de base : depuis bases[] si présent, sinon depuis l'ancien baseIp/baseCidr.
  c.bases = (Array.isArray(r.bases) && r.bases.length ? r.bases : [{ id: 'b1', name: 'Réseau principal', ip: (typeof r.baseIp === 'string' && r.baseIp) || DEFAULT_CTX.baseIp, cidr: String(r.baseCidr ?? DEFAULT_CTX.baseCidr) }])
    .map((b: any, i: number) => ({ id: typeof b?.id === 'string' ? b.id : 'b' + (i + 1), name: typeof b?.name === 'string' ? b.name : `Réseau ${i + 1}`, ip: typeof b?.ip === 'string' ? b.ip : '192.168.10.0', cidr: String(b?.cidr ?? '24') }));
  c.bases = dedupeIds(c.bases, 'b');
  const baseIds = new Set(c.bases.map(b => b.id));
  const firstBase = c.bases[0].id;
  c.services = (Array.isArray(r.services) ? r.services : []).map((s: any) => ({
    id: typeof s?.id === 'string' ? s.id : uid('s'),
    name: typeof s?.name === 'string' ? s.name : 'Sous-réseau',
    hosts: String(s?.hosts ?? '10'),
    routerIds: Array.isArray(s?.routerIds) ? s.routerIds.filter((x: any) => typeof x === 'string') : (typeof s?.routerId === 'string' && s.routerId ? [s.routerId] : []),
    hasSwitch: typeof s?.hasSwitch === 'boolean' ? s.hasSwitch : true,
    dhcp: typeof s?.dhcp === 'boolean' ? s.dhcp : true,
    media: s?.media === 'serial' ? ('serial' as LinkMedia) : undefined,
    baseId: (typeof s?.baseId === 'string' && baseIds.has(s.baseId)) ? s.baseId : firstBase,
  }));
  // Anciens liens inter-routeurs → sous-réseaux d'interconnexion (2+ routeurs).
  for (const l of (Array.isArray(r.links) ? r.links : [])) {
    const rids = (Array.isArray(l?.routerIds) ? l.routerIds : [l?.aId, l?.bId]).filter((x: any) => typeof x === 'string');
    if (rids.length >= 2) c.services.push({ id: typeof l?.id === 'string' ? 'seg' + l.id : uid('s'), name: 'Interconnexion', hosts: '2', routerIds: rids, hasSwitch: typeof l?.hasSwitch === 'boolean' ? l.hasSwitch : true, dhcp: false, media: l?.media === 'serial' ? 'serial' : undefined, baseId: firstBase });
  }
  if (!c.services.length) c.services = DEFAULT_CTX.services;
  c.services = dedupeIds(c.services, 's');
  return c;
}

// ─────────────────────────────────────────── Interfaces Cisco ───────────────────────────────────────────
// Interfaces Ethernet intégrées + module d'extension optionnel (slot 1).
// 2811 : Fa0/0, Fa0/1 intégrées → module = Fa1/0, Fa1/1.
// 2911 : Gig0/0..0/2 intégrées → module = Gig0/3/0, Gig0/3/1.
const ethBuiltin = (m: RouterModel): string[] => (m === '2811' ? ['FastEthernet0/0', 'FastEthernet0/1'] : ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2']);
const ethModule = (m: RouterModel): string[] => (m === '2811' ? ['FastEthernet1/0', 'FastEthernet1/1'] : ['GigabitEthernet0/3/0', 'GigabitEthernet0/3/1']);
const ethSlots = (m: RouterModel, mod?: boolean): string[] => (mod ? [...ethBuiltin(m), ...ethModule(m)] : ethBuiltin(m));
const ethLabel = (m: RouterModel) => (m === '2811' ? 'FastEthernet' : 'GigabitEthernet');
const SER_SLOTS = ['Serial0/0/0', 'Serial0/0/1', 'Serial0/1/0', 'Serial0/1/1'];
// Abréviation courte pour le schéma : GigabitEthernet0/1 → Gig0/1, FastEthernet0/0 → Fa0/0, Serial0/0/0 → Se0/0/0.
const ifAbbr = (s: string) => s.replace('GigabitEthernet', 'Gig').replace('FastEthernet', 'Fa').replace('Serial', 'Se');

// ─────────────────────────────────────────── Moteur (fonction pure) ───────────────────────────────────────────
export type Sub = {
  kind: 'lan' | 'link'; id: string; name: string;
  net: number; first: number; last: number; bc: number; usable: number; mask: number; cidr: number;
  gw: number | null; switchIp: number | null; routerId?: string; dhcp?: boolean; media?: LinkMedia; routerIds?: string[];
};
export type Iface = {
  routerId: string; routerName: string; iface: string; target: string;
  ip: number; mask: number; cidr: number; role: string; clock: boolean;
};
export type BaseSummary = { id: string; name: string; net: number; cidr: number; used: number; total: number };
// Un hôte fixe résolu par le moteur : IP validée + rattachement + éventuel problème.
export type PlacedHost = { id: string; name: string; subId: string; subName: string; ip: number | null; raw: string; ok: boolean; note: string };
export type Plan = {
  ok: boolean; error: string; warnings: string[];
  baseNet: number; baseBc: number; cidr: number; totalAddr: number; used: number;
  bases: BaseSummary[];
  subs: Sub[]; ifaces: Iface[]; hosts: PlacedHost[];
};

export function computePlan(ctx: Ctx): Plan {
  ctx = { ...ctx, services: Array.isArray(ctx.services) ? ctx.services : [], routers: Array.isArray(ctx.routers) ? ctx.routers : [], bases: Array.isArray(ctx.bases) && ctx.bases.length ? ctx.bases : [{ id: 'b1', name: 'Réseau', ip: ctx.baseIp || '192.168.10.0', cidr: ctx.baseCidr || '24' }] };
  const warnings: string[] = [];
  const linkCidr = clampNum(Number(ctx.linkCidr) || 30, 8, 30);

  // Réseaux de base valides (un ou plusieurs blocs distincts).
  type BInfo = { id: string; name: string; net: number; bc: number; cidr: number; ptr: number };
  const binfo: BInfo[] = [];
  for (const b of ctx.bases) {
    const n = strToIp(b.ip); if (n === null) { warnings.push(`Réseau de base « ${b.name || b.ip} » invalide.`); continue; }
    const c = clampNum(Number(b.cidr) || 24, 1, 30);
    const net = (n & maskFromCidr(c)) >>> 0; const bc = (net | wildcardFromCidr(c)) >>> 0;
    binfo.push({ id: b.id, name: b.name || b.ip, net, bc, cidr: c, ptr: net });
  }
  if (!binfo.length) return { ok: false, error: 'Aucun réseau de base valide.', warnings, baseNet: 0, baseBc: 0, cidr: 24, totalAddr: 0, used: 0, bases: [], subs: [], ifaces: [], hosts: [] };
  const binfoById = new Map(binfo.map(b => [b.id, b] as const));
  const firstBaseId = binfo[0].id;

  // Métadonnées par sous-réseau : LAN (1 routeur) ou interconnexion (2+ routeurs).
  type Meta = { s: Service; rs: RouterDef[]; transit: boolean; serial: boolean };
  const meta = new Map<string, Meta>();
  type Item = { id: string; need: number; cidr: number; baseId: string };
  const items: Item[] = [];
  for (const s of ctx.services) {
    const rs = (Array.isArray(s.routerIds) ? s.routerIds : []).map(id => ctx.routers.find(r => r.id === id)).filter((r): r is RouterDef => !!r);
    const transit = rs.length >= 2;
    const serial = transit && s.media === 'serial';
    const hostsNeed = Math.max(1, Number(s.hosts) || 0);
    const need = serial ? 2 : transit ? Math.max(hostsNeed, rs.length + (s.hasSwitch ? 1 : 0)) : hostsNeed;
    const c = serial ? linkCidr : 32 - hostBitsFor(need);
    const baseId = binfoById.has(s.baseId || '') ? (s.baseId as string) : firstBaseId;
    meta.set('svc:' + s.id, { s, rs, transit, serial });
    items.push({ id: 'svc:' + s.id, need, cidr: c, baseId });
  }

  // Allocation VLSM par réseau de base (les plus gros blocs d'abord dans chaque bloc).
  const alloc = new Map<string, { net: number; first: number; last: number; bc: number; usable: number; mask: number; cidr: number }>();
  let error = '';
  for (const b of binfo) {
    const list = items.filter(it => it.baseId === b.id).sort((x, y) => Math.pow(2, 32 - y.cidr) - Math.pow(2, 32 - x.cidr));
    for (const it of list) {
      const size = Math.pow(2, 32 - it.cidr);
      const net = b.ptr >>> 0; const bc = (net + size - 1) >>> 0;
      if (bc > b.bc) { if (!error) error = `Plus de place dans ${ipToStr(b.net)}/${b.cidr} (${b.name}) pour un bloc /${it.cidr}. Réduis les besoins ou élargis ce réseau.`; continue; }
      alloc.set(it.id, { net, first: (net + 1) >>> 0, last: (bc - 1) >>> 0, bc, usable: size - 2, mask: maskFromCidr(it.cidr), cidr: it.cidr });
      b.ptr = (bc + 1) >>> 0;
    }
  }

  const subs: Sub[] = [];
  const ifaces: Iface[] = [];
  const cap = new Map<string, { eth: number; ser: number }>();
  ctx.routers.forEach(r => cap.set(r.id, { eth: 0, ser: 0 }));
  const nextEth = (r: RouterDef): string | null => {
    const c = cap.get(r.id)!; const slots = ethSlots(r.model, r.mod);
    if (c.eth >= slots.length) {
      const hint = r.mod ? '' : ` — active le module (slot 1) pour ajouter ${ifAbbr(ethModule(r.model)[0])}`;
      warnings.push(`${r.name} (${r.model}) : plus d'interface ${ethLabel(r.model)} libre (${slots.length} max)${hint}.`); return null;
    }
    const name = slots[c.eth]; c.eth++; return name;
  };
  const nextSer = (r: RouterDef): string | null => {
    const c = cap.get(r.id)!; if (c.ser >= SER_SLOTS.length) { warnings.push(`${r.name} : plus d'interface série libre.`); return null; }
    const name = SER_SLOTS[c.ser]; c.ser++; return name;
  };
  // IP manuelle d'une interface (si valide et dans le sous-réseau), sinon la valeur calculée.
  const ovIps = ctx.ifaceIps || {};
  const applyOv = (rid: string, iface: string, fallback: number, net: number, bc: number): number => {
    const raw = (ovIps[`${rid}|${iface}`] || '').trim();
    if (!raw) return fallback;
    const n = strToIp(raw);
    if (n === null) { warnings.push(`IP manuelle « ${raw} » sur ${iface} invalide — adresse auto conservée.`); return fallback; }
    if (n <= net || n >= bc) { warnings.push(`IP manuelle ${raw} sur ${iface} hors de ${ipToStr(net)} – ${ipToStr(bc)} — ignorée.`); return fallback; }
    return n >>> 0;
  };

  for (const s of ctx.services) {
    const a = alloc.get('svc:' + s.id); if (!a) continue;
    const m = meta.get('svc:' + s.id)!;
    if (!m.transit) {
      // LAN : 1 routeur passerelle + clients (DHCP)
      const r = m.rs[0];
      let gw = ctx.gwPos === 'last' ? a.last : a.first;
      const switchIp = s.hasSwitch ? (ctx.gwPos === 'last' ? (a.last - 1) >>> 0 : (a.first + 1) >>> 0) : null;
      // Interface (et donc IP de passerelle, éventuellement forcée manuellement)
      let ifc: string | null = null;
      if (r) { ifc = nextEth(r); if (ifc) gw = applyOv(r.id, ifc, gw, a.net, a.bc); }
      subs.push({ kind: 'lan', id: 'svc:' + s.id, name: s.name || 'LAN', net: a.net, first: a.first, last: a.last, bc: a.bc, usable: a.usable, mask: a.mask, cidr: a.cidr, gw, switchIp, routerId: r?.id, routerIds: r ? [r.id] : [], dhcp: s.dhcp });
      if (!r) { warnings.push(`« ${s.name || 'LAN'} » n'a pas de routeur passerelle assigné.`); continue; }
      if (ifc) ifaces.push({ routerId: r.id, routerName: r.name, iface: ifc, target: `LAN ${s.name || ''}`.trim(), ip: gw, mask: a.mask, cidr: a.cidr, role: 'Passerelle LAN', clock: false });
    } else {
      // Interconnexion : 2+ routeurs, une IP par routeur (pas de DHCP)
      const parts = m.serial ? m.rs.slice(0, 2) : m.rs;
      const swIp = s.hasSwitch ? (a.first + parts.length) >>> 0 : null;
      subs.push({ kind: 'link', id: 'svc:' + s.id, name: s.name || 'Interconnexion', net: a.net, first: a.first, last: a.last, bc: a.bc, usable: a.usable, mask: a.mask, cidr: a.cidr, gw: null, switchIp: (swIp !== null && swIp <= a.last) ? swIp : null, media: m.serial ? 'serial' : 'gig', routerIds: parts.map(r => r.id) });
      if (m.serial && m.rs.length > 2) warnings.push(`« ${s.name} » : une liaison série relie exactement 2 routeurs — passe en Ethernet pour en relier davantage.`);
      parts.forEach((r, k) => {
        const ifc = m.serial ? nextSer(r) : nextEth(r);
        if (!ifc) return;
        const ip = applyOv(r.id, ifc, (a.first + k) >>> 0, a.net, a.bc);
        const role = m.serial ? (k === 0 ? 'Liaison série (DCE)' : 'Liaison série (DTE)') : 'Interconnexion';
        ifaces.push({ routerId: r.id, routerName: r.name, iface: ifc, target: s.name || 'Interconnexion', ip, mask: a.mask, cidr: a.cidr, role, clock: m.serial && k === 0 });
      });
    }
  }

  // Hôtes fixes (end-points) : validation + rattachement à leur sous-réseau.
  const subById = new Map(subs.map(s => [s.id, s] as const));
  const hosts: PlacedHost[] = (ctx.hosts || []).map(h => {
    const sub = subById.get(h.subId);
    const raw = (h.ip || '').trim();
    const n = strToIp(raw);
    let ok = true, note = '';
    if (!sub) { ok = false; note = 'sous-réseau introuvable'; }
    else if (!raw) { ok = false; note = 'IP à renseigner'; }
    else if (n === null) { ok = false; note = 'IP invalide'; }
    else if (n <= sub.net || n >= sub.bc) { ok = false; note = `hors de ${ipToStr(sub.net)}/${sub.cidr}`; }
    else if (n === sub.gw) { ok = false; note = 'déjà prise par la passerelle'; }
    else if (sub.switchIp !== null && n === sub.switchIp) { ok = false; note = 'déjà prise par le switch'; }
    return { id: h.id, name: h.name, subId: h.subId, subName: sub?.name || '—', ip: ok ? n : (n ?? null), raw, ok, note };
  });
  // Doublons d'IP entre hôtes du même sous-réseau + collision avec la plage DHCP.
  for (let i = 0; i < hosts.length; i++) {
    const h = hosts[i]; if (!h.ok || h.ip === null) continue;
    if (hosts.some((o, j) => j < i && o.ok && o.subId === h.subId && o.ip === h.ip)) { h.ok = false; h.note = 'IP en doublon'; continue; }
    const sub = subById.get(h.subId);
    if (sub && sub.dhcp) { const cr = clientRange(ctx, sub); if (cr && h.ip >= cr[0] && h.ip <= cr[1]) h.note = 'dans la plage DHCP — à exclure du pool'; }
  }

  const basesSum: BaseSummary[] = binfo.map(b => ({ id: b.id, name: b.name, net: b.net, cidr: b.cidr, used: (b.ptr - b.net) >>> 0, total: (b.bc - b.net + 1) >>> 0 }));
  return { ok: !error, error, warnings, baseNet: binfo[0].net, baseBc: binfo[0].bc, cidr: binfo[0].cidr, totalAddr: basesSum.reduce((a, s) => a + s.total, 0), used: basesSum.reduce((a, s) => a + s.used, 0), bases: basesSum, subs, ifaces, hosts };
}

// Nom de pool DHCP Cisco (majuscules, sans accents ni espaces).
const poolName = (s: string) => (s || 'POOL').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'POOL';

export type DhcpRelay = { routerId: string; routerName: string; text: string; count: number };
export type DhcpPool = { name: string; net: string; mask: string; gw: string; dns: string; domain: string; start: string; end: string; lease: number };
export function buildDhcp(ctx: Ctx, plan: Plan): { relays: DhcpRelay[]; pools: DhcpPool[]; relaysFull: string; server: string } {
  const server = (ctx.dhcpServer || '').trim() || (ctx.dnsServer || '').trim();
  // Relais : ip helper-address sur chaque interface LAN dont les clients sont en DHCP.
  const relays: DhcpRelay[] = [];
  for (const r of ctx.routers) {
    const lans = plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.routerId === r.id && s.gw !== null)
      .map(s => ({ s, ifc: plan.ifaces.find(i => i.routerId === r.id && i.ip === s.gw) }))
      .filter(x => !!x.ifc);
    if (!lans.length) continue;
    const lines = ['configure terminal'];
    for (const { ifc } of lans) lines.push(`interface ${ifc!.iface}`, ` ip helper-address ${server || '<IP_serveur_DHCP>'}`, ' exit');
    lines.push('end', 'write memory');
    relays.push({ routerId: r.id, routerName: r.name, text: lines.join('\n'), count: lans.length });
  }
  // Pools : à configurer sur le serveur DHCP (une étendue par LAN client).
  const lease = clampNum(Number(ctx.leaseDays) || 7, 0, 365);
  const pools: DhcpPool[] = plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.gw !== null).map(s => {
    const cr = clientRange(ctx, s);
    return { name: poolName(s.name), net: ipToStr(s.net), mask: ipToStr(s.mask), gw: ipToStr(s.gw!), dns: (ctx.dnsServer || '').trim() || ipToStr(s.gw!), domain: (ctx.domaine || '').trim(), start: cr ? ipToStr(cr[0]) : '-', end: cr ? ipToStr(cr[1]) : '-', lease };
  });
  return { relays, pools, relaysFull: relays.map(b => b.text).join('\n\n'), server };
}

export type DnsRec = { host: string; fqdn: string; ip: number };
export function buildDns(ctx: Ctx, plan: Plan): { recs: DnsRec[]; domain: string; hostLines: string; zone: string; tests: string[] } {
  const domain = ctx.domaine.trim() || 'lan';
  const recs: DnsRec[] = [];
  const seen = new Set<string>();
  for (const r of ctx.routers) {
    const ifc = plan.ifaces.find(i => i.routerId === r.id);
    if (ifc) { const host = (r.name || 'r').toLowerCase(); recs.push({ host, fqdn: `${host}.${domain}`, ip: ifc.ip }); seen.add(host); }
  }
  const dnsIp = strToIp(ctx.dnsServer.trim());
  if (dnsIp !== null && !seen.has('dns')) recs.push({ host: 'dns', fqdn: `dns.${domain}`, ip: dnsIp });
  // Hôtes fixes (serveurs/postes à IP statique) → enregistrements DNS.
  for (const h of plan.hosts) {
    if (!h.ok || h.ip === null) continue;
    const host = (h.name || 'host').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') || 'host';
    if (seen.has(host)) continue;
    recs.push({ host, fqdn: `${host}.${domain}`, ip: h.ip }); seen.add(host);
  }

  const hostLines = [
    ctx.domaine.trim() ? `ip domain-name ${domain}` : '',
    ctx.dnsServer.trim() ? `ip name-server ${ctx.dnsServer.trim()}` : '',
    ...recs.map(r => `ip host ${r.host} ${ipToStr(r.ip)}`),
  ].filter(Boolean).join('\n');

  const zone = [
    `; Zone directe — ${domain}`,
    `@            NS    ${recs.find(r => r.host === 'dns')?.fqdn || 'dns.' + domain}`,
    ...recs.map(r => `${r.host.padEnd(12)} A     ${ipToStr(r.ip)}`),
    '',
    '; Zone inverse (PTR)',
    ...recs.map(r => `${ipToStr(r.ip).split('.').reverse().join('.')}.in-addr.arpa   PTR   ${r.fqdn}`),
  ].join('\n');

  const tests = [
    ...recs.slice(0, 3).map(r => `ping ${r.fqdn}`),
    ...(recs.length ? [`nslookup ${recs[0].fqdn}`] : []),
  ];
  return { recs, domain, hostLines, zone, tests };
}

// Configuration CLI COMPLÈTE de chaque routeur : sécurité, interfaces (NAT inside + relais DHCP + horloge DCE),
// routage statique (plus court chemin) + route par défaut, NAT/PAT de bordure, et SSH (console/vty).
export type RouterCfg = { routerId: string; routerName: string; text: string; routes: number };
export function buildRouterConfigs(ctx: Ctx, plan: Plan): { byRouter: RouterCfg[]; full: string } {
  // Graphe des routeurs via les sous-réseaux d'interconnexion.
  const edges = new Map<string, { to: string; viaIp: number }[]>();
  ctx.routers.forEach(r => edges.set(r.id, []));
  for (const s of plan.subs) {
    if (s.kind !== 'link' || !s.routerIds) continue;
    // Prochain saut = IP réelle de l'interface du voisin sur cette liaison (respecte les IP manuelles).
    const ipOf = (rid: string) => { const f = plan.ifaces.find(i => i.routerId === rid && i.ip > s.net && i.ip < s.bc); return f ? f.ip : null; };
    s.routerIds.forEach((a) => s.routerIds!.forEach((b) => { if (a !== b) { const via = ipOf(b); if (via !== null) edges.get(a)?.push({ to: b, viaIp: via }); } }));
  }
  const nextHopFrom = (from: string) => {
    const res = new Map<string, number>();
    const seen = new Set<string>([from]);
    const q: { node: string; via: number }[] = [];
    for (const e of edges.get(from) || []) if (!seen.has(e.to)) { seen.add(e.to); res.set(e.to, e.viaIp); q.push({ node: e.to, via: e.viaIp }); }
    while (q.length) { const c = q.shift()!; for (const e of edges.get(c.node) || []) if (!seen.has(e.to)) { seen.add(e.to); res.set(e.to, c.via); q.push({ node: e.to, via: c.via }); } }
    return res;
  };
  const relayServer = (ctx.dhcpServer || '').trim() || (ctx.dnsServer || '').trim();
  const dom = (ctx.domaine || '').trim() || 'lan';
  const byRouter: RouterCfg[] = ctx.routers.map(r => {
    const myIf = plan.ifaces.filter(i => i.routerId === r.id);
    const nh = nextHopFrom(r.id);
    const isBorder = !!ctx.internetRouterId && ctx.internetRouterId === r.id;
    const wanIf = (ctx.wanIf || '').trim() || 'GigabitEthernet0/1';
    // IP de passerelle des LAN en DHCP portés par ce routeur → ip helper-address sur l'interface.
    const dhcpGwIps = new Set(plan.subs.filter(s => s.kind === 'lan' && s.dhcp && s.routerId === r.id && s.gw !== null).map(s => s.gw as number));

    const lines: string[] = ['enable', 'configure terminal', `hostname ${r.name}`];

    // -- Sécurité & accès --
    lines.push('! --- Securite & acces ---', 'service password-encryption');
    if ((ctx.secret || '').trim()) lines.push(`enable secret ${ctx.secret.trim()}`);
    lines.push(`username ${ctx.login || 'admin'} privilege 15 secret ${ctx.mdp || 'MotDePasse'}`);
    lines.push(`ip domain-name ${dom}`);
    if ((ctx.dnsServer || '').trim()) lines.push(`ip name-server ${ctx.dnsServer.trim()}`);

    // -- Interfaces (IP, NAT inside, relais DHCP, horloge DCE) --
    lines.push('! --- Interfaces ---');
    for (const i of myIf) {
      lines.push(`interface ${i.iface}`, ` description ${i.target}`, ` ip address ${ipToStr(i.ip)} ${ipToStr(i.mask)}`);
      if (isBorder && i.iface !== wanIf) lines.push(' ip nat inside');
      if (dhcpGwIps.has(i.ip)) lines.push(` ip helper-address ${relayServer || '<IP_serveur_DHCP>'}`);
      if (i.clock) lines.push(' clock rate 64000');
      lines.push(' no shutdown', ' exit');
    }

    // -- Sortie Internet (NAT/PAT) — routeur de bordure uniquement --
    if (isBorder) {
      const wanCidr = clampNum(Number(ctx.wanCidr) || 30, 1, 32);
      lines.push('! --- Sortie Internet (NAT/PAT) ---');
      lines.push(`interface ${wanIf}`, ` ip address ${(ctx.wanIp || '').trim() || '<IP_WAN>'} ${ipToStr(maskFromCidr(wanCidr))}`, ' ip nat outside', ' no shutdown', ' exit');
      for (const st of (ctx.natStatics || []).filter(s => (s.inside || '').trim() && (s.pub || '').trim()))
        lines.push(`ip nat inside source static ${st.inside.trim()} ${st.pub.trim()}`);
      if (ctx.natOverload) {
        lines.push('ip access-list standard NAT-LAN');
        for (const b of plan.bases) lines.push(` permit ${ipToStr(b.net)} ${ipToStr(wildcardFromCidr(b.cidr))}`);
        lines.push(' exit', `ip nat inside source list NAT-LAN interface ${wanIf} overload`);
      }
      if ((ctx.webIp || '').trim()) {
        const port = (ctx.webPort || '80').trim();
        lines.push(`ip nat inside source static tcp ${ctx.webIp.trim()} ${port} interface ${wanIf} ${port}`);
      }
    }

    // -- Routage statique (+ route par défaut sur la bordure) --
    const routes: string[] = [];
    const seen = new Set<string>();
    for (const s of plan.subs) {
      if ((s.routerIds || []).includes(r.id)) continue;         // directement connecté
      const targets = (s.routerIds && s.routerIds.length) ? s.routerIds : (s.routerId ? [s.routerId] : []);
      let via: number | undefined;
      for (const t of targets) { const v = nh.get(t); if (v !== undefined) { via = v; break; } }
      if (via === undefined) continue;                           // pas de chemin
      const key = `${s.net}/${s.cidr}`;
      if (seen.has(key)) continue; seen.add(key);
      routes.push(`ip route ${ipToStr(s.net)} ${ipToStr(s.mask)} ${ipToStr(via)}`);
    }
    if (routes.length || isBorder) lines.push('! --- Routage ---');
    if (routes.length) lines.push(...routes);
    if (isBorder) lines.push(`ip route 0.0.0.0 0.0.0.0 ${(ctx.faiGw || '').trim() || '<passerelle_FAI>'}`);

    // -- SSH + lignes d'accès (console/vty) --
    lines.push('! --- SSH & lignes ---', 'crypto key generate rsa', '1024', 'ip ssh version 2');
    lines.push('line console 0', ' logging synchronous', ' login local', ' exit');
    lines.push('line vty 0 4', ' transport input ssh', ' login local', ' exit');

    lines.push('end', 'write memory');
    return { routerId: r.id, routerName: r.name, text: lines.join('\n'), routes: routes.length };
  });
  return { byRouter, full: byRouter.map(b => b.text).join('\n\n') };
}

// Configuration SSH pour chaque routeur et chaque switch (avec SVI de gestion).
export type SshCfg = { name: string; ip: string; text: string };
export function buildSsh(ctx: Ctx, plan: Plan): { routers: SshCfg[]; switches: SshCfg[] } {
  const dom = (ctx.domaine || '').trim() || 'lan';
  const base = (host: string, extra: string[]): string => [
    'enable', 'configure terminal',
    `hostname ${host}`,
    `ip domain-name ${dom}`,
    ...extra,
    (ctx.secret || '').trim() ? `enable secret ${ctx.secret.trim()}` : '',
    `username ${ctx.login || 'admin'} privilege 15 secret ${ctx.mdp || 'MotDePasse'}`,
    'crypto key generate rsa',
    '1024',
    'ip ssh version 2',
    'line vty 0 4',
    ' transport input ssh',
    ' login local',
    ' exit',
    'end', 'write memory',
  ].filter(Boolean).join('\n');
  const routers: SshCfg[] = ctx.routers.map(r => ({ name: r.name, ip: '', text: base(r.name, []) }));
  const switches: SshCfg[] = plan.subs.filter(s => s.switchIp !== null).map(s => {
    const host = /sw|switch/i.test(s.name) ? s.name.replace(/\s+/g, '-') : 'SW-' + s.name.replace(/\s+/g, '-');
    const gw = s.gw !== null ? s.gw : s.first;                  // switch de dorsale → 1re IP routeur
    const extra = ['interface vlan 1', ` ip address ${ipToStr(s.switchIp!)} ${ipToStr(s.mask)}`, ' no shutdown', ' exit', `ip default-gateway ${ipToStr(gw)}`];
    return { name: host, ip: ipToStr(s.switchIp!), text: base(host, extra) };
  });
  return { routers, switches };
}

// Étape 0 : réinitialiser un équipement réutilisé (config parasite qui bloque tout).
export function buildReset(): string {
  return [
    'enable',
    'write erase',
    'reload',
  ].join('\n');
}

// Sortie Internet : NAT/PAT (overload) sur le routeur de bordure + route par défaut + publication de port.
export type NatCfg = { text: string; router: string };
export function buildNat(ctx: Ctx, plan: Plan): NatCfg | null {
  const r = ctx.routers.find(x => x.id === ctx.internetRouterId);
  if (!r) return null;
  const wanCidr = clampNum(Number(ctx.wanCidr) || 30, 1, 32);
  const wanMask = ipToStr(maskFromCidr(wanCidr));
  const wanIf = (ctx.wanIf || '').trim() || 'GigabitEthernet0/1';
  const myIf = plan.ifaces.filter(i => i.routerId === r.id);
  const lines: string[] = ['configure terminal'];
  lines.push(`interface ${wanIf}`, ` ip address ${(ctx.wanIp || '').trim() || '<IP_WAN>'} ${wanMask}`, ' ip nat outside', ' no shutdown', ' exit');
  if (myIf.length) for (const i of myIf) lines.push(`interface ${i.iface}`, ' ip nat inside', ' exit');
  const statics = (ctx.natStatics || []).filter(s => (s.inside || '').trim() && (s.pub || '').trim());
  if (statics.length) {
    for (const s of statics) lines.push(`ip nat inside source static ${s.inside.trim()} ${s.pub.trim()}`);
  }
  if (ctx.natOverload) {
    lines.push('ip access-list standard NAT-LAN');
    for (const b of plan.bases) lines.push(` permit ${ipToStr(b.net)} ${ipToStr(wildcardFromCidr(b.cidr))}`);
    lines.push(' exit', `ip nat inside source list NAT-LAN interface ${wanIf} overload`);
  }
  lines.push(`ip route 0.0.0.0 0.0.0.0 ${(ctx.faiGw || '').trim() || '<passerelle_FAI>'}`);
  if ((ctx.webIp || '').trim()) {
    const port = (ctx.webPort || '80').trim();
    lines.push(`ip nat inside source static tcp ${ctx.webIp.trim()} ${port} interface ${wanIf} ${port}`);
  }
  lines.push('end', 'write memory');
  return { text: lines.join('\n'), router: r.name };
}

// Table de NAT PRÉVISIONNELLE (ce que « show ip nat translation » affichera) — pour pré-remplir le dossier du TP.
export type NatRow = { proto: string; localInside: string; localPort: string; globalInside: string; globalPort: string; note: string };
export function buildNatTable(ctx: Ctx, plan: Plan, nat: NatCfg | null): NatRow[] {
  if (!nat) return [];
  const wan = (ctx.wanIp || '').trim() || '<IP_WAN>';
  const rows: NatRow[] = [];
  for (const s of (ctx.natStatics || []).filter(s => (s.inside || '').trim() && (s.pub || '').trim()))
    rows.push({ proto: '---', localInside: s.inside.trim(), localPort: '---', globalInside: s.pub.trim(), globalPort: '---', note: 'NAT statique 1:1 (tous ports)' });
  if ((ctx.webIp || '').trim()) {
    const p = (ctx.webPort || '80').trim();
    rows.push({ proto: 'tcp', localInside: ctx.webIp.trim(), localPort: p, globalInside: wan, globalPort: p, note: 'redirection de port (entrant)' });
  }
  if (ctx.natOverload) {
    const lans = plan.subs.filter(s => s.kind === 'lan').slice(0, 2);
    lans.forEach((s, i) => rows.push({ proto: 'tcp', localInside: ipToStr(s.first), localPort: String(1025 + i), globalInside: wan, globalPort: String(1025 + i), note: 'PAT — exemple (port attribué dynamiquement)' }));
    if (!lans.length) rows.push({ proto: 'tcp', localInside: '192.168.x.y', localPort: '1025', globalInside: wan, globalPort: '1025', note: 'PAT — exemple' });
  }
  return rows;
}

// Plan de tests ping (anneaux) : local → inter-réseaux → Internet.
export type TestSection = { title: string; lines: string[] };
export function buildTests(ctx: Ctx, plan: Plan, nat: NatCfg | null): { sections: TestSection[]; full: string } {
  const lan = plan.subs.filter(s => s.kind === 'lan' && s.gw !== null);
  const sections: TestSection[] = [];
  const a: string[] = [];
  for (const s of lan) {
    a.push(`ping ${ipToStr(s.gw!)}`);
    if (s.switchIp !== null) a.push(`ping ${ipToStr(s.switchIp)}`);
  }
  if (a.length) sections.push({ title: 'A. Dans chaque réseau (liaison locale) — passerelle puis switch de gestion', lines: a });
  const gws = Array.from(new Set(lan.map(s => ipToStr(s.gw!))));
  if (gws.length > 1) sections.push({ title: 'B. Entre les réseaux (routage) — depuis un poste, pinguer les passerelles des autres réseaux (interfaces routeur, répondent toujours)', lines: gws.map(g => `ping ${g}`) });
  if (nat && (ctx.faiGw || '').trim()) {
    sections.push({ title: 'C. Vers le FAI & Internet (via NAT/PAT) — passerelle FAI puis Internet', lines: [`ping ${ctx.faiGw.trim()}`, 'ping 8.8.8.8'] });
  }
  const full = sections.map(s => s.lines.join('\n')).join('\n\n');
  return { sections, full };
}

// ─────────────────────────────────────────── Styles ───────────────────────────────────────────
const field: CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 4 };
const group: CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', background: 'var(--surface-2)', marginBottom: 14 };
const legend: CSSProperties = { fontWeight: 700, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const btn: CSSProperties = { padding: '6px 11px', border: '1px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap' };
const smallBtn: CSSProperties = { ...btn, padding: '3px 9px', fontSize: 12, borderColor: 'var(--border)', color: 'var(--text-soft)' };
const mono: CSSProperties = { fontFamily: 'ui-monospace,monospace' };
const th: CSSProperties = { textAlign: 'left', padding: '7px 9px', borderBottom: '2px solid var(--border)', fontSize: 12, color: 'var(--text-soft)', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '6px 9px', borderBottom: '1px solid var(--border)', fontSize: 12.5, whiteSpace: 'nowrap' };
// Bloc de SORTIE générée (config CLI à coller) : look « terminal » + liseré accent à gauche
// pour le distinguer nettement des champs de saisie (correctif audit B1 : saisie ≠ sortie).
const preStyle: CSSProperties = { background: 'var(--surface-3)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: 8, padding: '11px 13px', overflowX: 'auto', fontSize: 12, lineHeight: 1.55, margin: 0, whiteSpace: 'pre', color: 'var(--text)', ...mono };

const STEPS = [
  { n: 1, icon: '🧾', title: 'Contexte' },
  { n: 2, icon: '⚙️', title: 'Préférences' },
  { n: 3, icon: '🧮', title: 'Segmentation' },
  { n: 4, icon: '🗺️', title: 'Schéma & routeurs' },
  { n: 5, icon: '📶', title: 'DHCP' },
  { n: 6, icon: '🌐', title: 'DNS' },
  { n: 7, icon: '🔑', title: 'SSH' },
  { n: 8, icon: '🔌', title: 'Tests' },
];
const STORAGE_KEY = 'net_workshop_v1';

// ─────────────────────────────────────────── Composant principal ───────────────────────────────────────────
export interface NetworkWorkshopProps {
  /** Contexte contrôlé (mode application/projet). Absent → l'îlot gère son état via localStorage. */
  value?: Ctx;
  onChange?: (next: Ctx) => void;
  /** Étape contrôlée (pilotée par une navigation externe, ex. la sidebar de l'Atelier). */
  step?: number;
  onStep?: (n: number) => void;
  /** Barre d'étapes intégrée (true pour l'îlot ; false quand une sidebar navigue). */
  showStepper?: boolean;
  /** Sous-vue de l'étape 4 (mode app) : 'schema' | 'routeurs' | 'nat'. Absent → tout s'affiche (îlot). */
  section4?: 'schema' | 'routeurs' | 'nat';
}

export function NetworkWorkshop({ value, onChange, step: stepProp, onStep, showStepper = true, section4 }: NetworkWorkshopProps = {}) {
  const ctxControlled = value !== undefined && onChange !== undefined;
  const [internalCtx, setInternalCtx] = useState<Ctx>(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); if (v) return migrateCtx(JSON.parse(v)); } catch { /* */ }
    return DEFAULT_CTX;
  });
  const ctx = ctxControlled ? value! : internalCtx;
  const setCtx = (action: Ctx | ((c: Ctx) => Ctx)) => {
    if (ctxControlled) onChange!(typeof action === 'function' ? (action as (c: Ctx) => Ctx)(value!) : action);
    else setInternalCtx(action);
  };

  const stepControlled = stepProp !== undefined && onStep !== undefined;
  const [internalStep, setInternalStep] = useState(1);
  const step = stepControlled ? stepProp! : internalStep;
  const setStep = (n: number) => { if (stepControlled) onStep!(n); else setInternalStep(n); };

  const [copied, setCopied] = useState('');

  // Persistance locale uniquement en mode autonome (îlot CMS) ; en mode contrôlé,
  // l'état est porté par le projet (serveur).
  useEffect(() => { if (ctxControlled) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(internalCtx)); } catch { /* */ } }, [internalCtx, ctxControlled]);

  const set = (p: Partial<Ctx>) => setCtx(c => ({ ...c, ...p }));
  const plan = useMemo(() => computePlan(ctx), [ctx]);

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1600); }).catch(() => {}); };

  // — réseaux de base —
  const bases = Array.isArray(ctx.bases) && ctx.bases.length ? ctx.bases : [{ id: 'b1', name: 'Réseau principal', ip: ctx.baseIp || '192.168.10.0', cidr: ctx.baseCidr || '24' }];
  const setBase = (id: string, p: Partial<BaseNet>) => set({ bases: bases.map(b => b.id === id ? { ...b, ...p } : b) });
  const addBase = () => set({ bases: [...bases, { id: uid('b'), name: 'Réseau ' + (bases.length + 1), ip: '10.0.0.0', cidr: '24' }] });
  const delBase = (id: string) => { if (bases.length <= 1) return; const rest = bases.filter(b => b.id !== id); const fb = rest[0].id; set({ bases: rest, services: ctx.services.map(s => (s.baseId === id ? { ...s, baseId: fb } : s)) }); };
  // — sous-réseaux —
  const setSvc = (id: string, p: Partial<Service>) => set({ services: ctx.services.map(s => s.id === id ? { ...s, ...p } : s) });
  const addSvc = () => set({ services: [...ctx.services, { id: uid('s'), name: 'Nouveau sous-réseau', hosts: '10', routerIds: ctx.routers[0] ? [ctx.routers[0].id] : [], hasSwitch: true, dhcp: true, baseId: bases[0].id }] });
  const delSvc = (id: string) => set({ services: ctx.services.filter(s => s.id !== id) });
  const toggleSvcRouter = (id: string, rid: string) => set({ services: ctx.services.map(s => s.id === id ? { ...s, routerIds: s.routerIds.includes(rid) ? s.routerIds.filter(x => x !== rid) : [...s.routerIds, rid] } : s) });
  // — routers —
  const setRtr = (id: string, p: Partial<RouterDef>) => set({ routers: ctx.routers.map(r => r.id === id ? { ...r, ...p } : r) });
  const addRtr = () => set({ routers: [...ctx.routers, { id: uid('r'), name: 'R' + (ctx.routers.length + 1), model: '2911' }] });
  const delRtr = (id: string) => set({ routers: ctx.routers.filter(r => r.id !== id), services: ctx.services.map(s => ({ ...s, routerIds: s.routerIds.filter(x => x !== id) })) });
  // Repartir d'un atelier vierge (efface le contexte enregistré dans le navigateur).
  const resetCtx = () => { if (typeof window !== 'undefined' && !window.confirm('Réinitialiser l’atelier ? (réseaux, routeurs et sous-réseaux reviennent aux valeurs par défaut)')) return; if (!ctxControlled) { try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ } } setCtx(DEFAULT_CTX); setStep(1); };
  // — NAT statique (1:1) —
  const setStat = (idx: number, p: Partial<{ inside: string; pub: string }>) => set({ natStatics: (ctx.natStatics || []).map((s, i) => i === idx ? { ...s, ...p } : s) });
  const addStat = () => set({ natStatics: [...(ctx.natStatics || []), { inside: '', pub: '' }] });
  const delStat = (idx: number) => set({ natStatics: (ctx.natStatics || []).filter((_, i) => i !== idx) });
  // Adressage manuel : IP d'interface routeur + hôtes fixes (end-points)
  const setIfaceIp = (key: string, v: string) => { const next = { ...(ctx.ifaceIps || {}) }; if (v.trim()) next[key] = v; else delete next[key]; set({ ifaceIps: next }); };
  const setHost = (idx: number, p: Partial<StaticHost>) => set({ hosts: (ctx.hosts || []).map((h, i) => i === idx ? { ...h, ...p } : h) });
  const addHost = () => set({ hosts: [...(ctx.hosts || []), { id: uid('h'), name: '', subId: (plan.subs.find(s => s.kind === 'lan')?.id) || plan.subs[0]?.id || '', ip: '' }] });
  const delHost = (idx: number) => set({ hosts: (ctx.hosts || []).filter((_, i) => i !== idx) });

  // Texte exportable du plan (étapes 3/4).
  const planText = useMemo(() => {
    if (!plan.subs.length) return '';
    const head = plan.bases.length > 1
      ? 'Reseaux de base :\n' + plan.bases.map(b => `  ${b.name} : ${ipToStr(b.net)}/${b.cidr}  (${b.total} adr., ${b.used} utilisees)`).join('\n')
      : `Reseau de base : ${ipToStr(plan.baseNet)}/${plan.cidr}  (${plan.totalAddr} adresses, ${plan.used} utilisees)`;
    const subLines = plan.subs.map(s => `${s.name}\t${ipToStr(s.net)}/${s.cidr}\t${ipToStr(s.mask)}\t${ipToStr(s.first)} - ${ipToStr(s.last)}\tbc ${ipToStr(s.bc)}\t${s.gw !== null ? 'gw ' + ipToStr(s.gw) : '(lien)'}\t${s.usable} hotes`);
    const ifLines = plan.ifaces.map(i => `${i.routerName}\t${i.iface}\t${i.target}\t${ipToStr(i.ip)}\t${ipToStr(i.mask)}\t${i.role}${i.clock ? '  [clock rate 64000]' : ''}`);
    return [head, '', 'Sous-reseaux :', 'Nom\tReseau/CIDR\tMasque\tPlage utilisable\tBroadcast\tPasserelle\tHotes', ...subLines,
      '', 'Table d adressage des interfaces :', 'Routeur\tInterface\tCible\tIP\tMasque\tRole', ...ifLines].join('\n');
  }, [plan]);

  const dhcp = useMemo(() => buildDhcp(ctx, plan), [ctx, plan]);
  const dns = useMemo(() => buildDns(ctx, plan), [ctx, plan]);
  const routerCfg = useMemo(() => buildRouterConfigs(ctx, plan), [ctx, plan]);
  const ssh = useMemo(() => buildSsh(ctx, plan), [ctx, plan]);
  const nat = useMemo(() => buildNat(ctx, plan), [ctx, plan]);
  const natTable = useMemo(() => buildNatTable(ctx, plan, nat), [ctx, plan, nat]);
  const tests = useMemo(() => buildTests(ctx, plan, nat), [ctx, plan, nat]);
  const resetText = buildReset();
  const lanSubs = plan.subs.filter(s => s.kind === 'lan');
  const linkSubs = plan.subs.filter(s => s.kind === 'link');
  const ifaceFor = (routerId: string, ip: number) => plan.ifaces.find(i => i.routerId === routerId && i.ip === ip);
  // Étape 4 scindée en sous-vues (mode app) ; sans section4 (îlot CMS) tout s'affiche.
  const s4 = (v: 'schema' | 'routeurs' | 'nat') => !section4 || section4 === v;

  return (
    <div style={{ margin: '14px 0' }}>
      {/* Stepper (masqué quand une navigation externe pilote les étapes, ex. sidebar Atelier) */}
      {showStepper && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {STEPS.map(s => {
          const active = step === s.n;
          return (
            <button key={s.n} type="button" onClick={() => setStep(s.n)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)' }}>
              <span style={{ opacity: active ? 1 : .85 }}>{s.icon}</span>
              <span>{s.n}. {s.title}</span>
            </button>
          );
        })}
        <button type="button" onClick={resetCtx} title="Repartir d’un atelier vierge (efface le contexte enregistré)"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-soft)' }}>↺ Réinitialiser</button>
      </div>
      )}

      {/* ── Étape 1 : Contexte ── */}
      {step === 1 && (
        <div>
          <div style={group}>
            <div style={legend}>🧾 Contexte de l’exercice</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div><label style={label}>Nom de l’entreprise</label><input style={field} value={ctx.entreprise} onChange={e => set({ entreprise: e.target.value })} placeholder="Miyukini" /></div>
              <div><label style={label}>Nom de domaine</label><input style={field} value={ctx.domaine} onChange={e => set({ domaine: e.target.value })} placeholder="miyukini.lan" /></div>
              <div>
                <label style={label}>Infrastructure</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['neuf', 'extension'] as const).map(m => (
                    <button key={m} type="button" onClick={() => set({ mode: m })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.mode === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.mode === m ? 'var(--accent)' : 'var(--surface)', color: ctx.mode === m ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>{m === 'neuf' ? '🌱 Neuve' : '🧩 Extension'}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>🌐 Réseaux de base (blocs d’adresses à découper)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 420 }}>
                <thead><tr><th style={th}>Nom</th><th style={th}>Réseau (IP)</th><th style={th}>CIDR</th><th style={th}></th></tr></thead>
                <tbody>
                  {bases.map(b => (
                    <tr key={b.id}>
                      <td style={td}><input style={field} value={b.name} onChange={e => setBase(b.id, { name: e.target.value })} placeholder="Site A" /></td>
                      <td style={td}><input style={{ ...field, ...mono, width: 150 }} value={b.ip} onChange={e => setBase(b.id, { ip: e.target.value })} placeholder="192.168.10.0" /></td>
                      <td style={{ ...td, width: 80 }}><input style={{ ...field, ...mono }} value={b.cidr} onChange={e => setBase(b.id, { cidr: e.target.value.replace(/\D/g, '') })} placeholder="24" /></td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delBase(b.id)} disabled={bases.length <= 1} style={{ ...smallBtn, color: bases.length <= 1 ? 'var(--text-muted)' : '#dc2626', borderColor: 'transparent', opacity: bases.length <= 1 ? .4 : 1 }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addBase} style={{ ...btn, marginTop: 10 }}>+ Ajouter un réseau de base</button>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Ajoute plusieurs blocs distincts (ex. un par site : <code>192.168.10.0/24</code>, <code>10.0.0.0/24</code>…). Chaque sous-réseau est ensuite découpé (VLSM) <strong>dans le bloc que tu lui assignes</strong> ci-dessous.</div>
          </div>

          <div style={group}>
            <div style={legend}>🧩 Sous-réseaux / services (besoin en hôtes)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
                <thead><tr><th style={th}>Service / sous-réseau</th><th style={th}>Hôtes</th>{bases.length > 1 && <th style={th}>Réseau de base</th>}<th style={th}></th></tr></thead>
                <tbody>
                  {ctx.services.map(s => (
                    <tr key={s.id}>
                      <td style={td}><input style={field} value={s.name} onChange={e => setSvc(s.id, { name: e.target.value })} /></td>
                      <td style={{ ...td, width: 90 }}><input style={{ ...field, ...mono }} value={s.hosts} onChange={e => setSvc(s.id, { hosts: e.target.value.replace(/\D/g, '') })} /></td>
                      {bases.length > 1 && <td style={{ ...td, width: 150 }}><select style={field} value={s.baseId || bases[0].id} onChange={e => setSvc(s.id, { baseId: e.target.value })}>{bases.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>}
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delSvc(s.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addSvc} style={{ ...btn, marginTop: 10 }}>+ Ajouter un sous-réseau</button>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Le nombre d’hôtes pilote le découpage VLSM à l’étape 3. La topologie (routeurs, liaisons) et l’attribution se règlent aussi à l’étape 3.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 2 : Préférences ── */}
      {step === 2 && (
        <div>
          <div style={group}>
            <div style={legend}>🔐 Identifiants standards (Cisco)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              <div><label style={label}>Login admin</label><input style={field} value={ctx.login} onChange={e => set({ login: e.target.value })} placeholder="admin" /></div>
              <div><label style={label}>Mot de passe</label><input style={field} value={ctx.mdp} onChange={e => set({ mdp: e.target.value })} placeholder="Azerty77" /></div>
              <div><label style={label}>Enable secret</label><input style={field} value={ctx.secret} onChange={e => set({ secret: e.target.value })} placeholder="MonSecretEnable" /></div>
              <div><label style={label}>Serveur DNS</label><input style={{ ...field, ...mono }} value={ctx.dnsServer} onChange={e => set({ dnsServer: e.target.value })} placeholder="192.168.10.11" /></div>
              <div><label style={label}>Serveur DHCP (relais)</label><input style={{ ...field, ...mono }} value={ctx.dhcpServer} onChange={e => set({ dhcpServer: e.target.value })} placeholder="192.168.10.11" /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Le <strong>serveur DHCP</strong> héberge les étendues ; les routeurs relaieront les requêtes vers cette IP via <code>ip helper-address</code>.</div>
          </div>
          <div style={group}>
            <div style={legend}>📐 Convention d’adressage (pattern IP fixe)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14 }}>
              <div>
                <label style={label}>Passerelle (routeur)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['last', 'Fin de plage'], ['first', 'Début de plage']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ gwPos: v })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.gwPos === v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.gwPos === v ? 'var(--accent)' : 'var(--surface)', color: ctx.gwPos === v ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={label}>IP de gestion du switch</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['beforeRouter', 'Juste avant le routeur'], ['firstHost', 'Début de plage']] as const).map(([v, t]) => (
                    <button key={v} type="button" onClick={() => set({ switchPos: v })} style={{ flex: 1, padding: '7px 8px', border: `1px solid ${ctx.switchPos === v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: ctx.switchPos === v ? 'var(--accent)' : 'var(--surface)', color: ctx.switchPos === v ? '#fff' : 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div><label style={label}>Masque des liaisons inter-routeurs (CIDR)</label><input style={{ ...field, ...mono }} value={ctx.linkCidr} onChange={e => set({ linkCidr: e.target.value.replace(/\D/g, '') })} placeholder="30" /></div>
              <div><label style={label}>Bail DHCP (jours)</label><input style={{ ...field, ...mono }} value={ctx.leaseDays} onChange={e => set({ leaseDays: e.target.value.replace(/\D/g, '') })} placeholder="7" /></div>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 10 }}>Convention appliquée : <strong>clients</strong> en début de plage (DHCP), <strong>switch</strong> puis <strong>routeur</strong> en fin de plage. Les <strong>liaisons série</strong> utilisent un /{clampNum(Number(ctx.linkCidr) || 30, 8, 30)} (2 hôtes) ; les <strong>segments Ethernet</strong> sont dimensionnés au nombre de routeurs qu’ils relient.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 3 : Segmentation ── */}
      {step === 3 && (
        <div>
          <div style={group}>
            <div style={legend}>🧭 Routeurs</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 340 }}>
                <thead><tr><th style={th}>Nom</th><th style={th}>Modèle</th><th style={th}>Interfaces</th><th style={th}></th></tr></thead>
                <tbody>
                  {ctx.routers.map(r => (
                    <tr key={r.id}>
                      <td style={td}><input style={{ ...field, width: 90 }} value={r.name} onChange={e => setRtr(r.id, { name: e.target.value.replace(/\s+/g, '') })} /></td>
                      <td style={td}>
                        <select style={{ ...field, width: 110 }} value={r.model} onChange={e => setRtr(r.id, { model: e.target.value as RouterModel })}>
                          <option value="2911">2911 (Gig)</option>
                          <option value="2811">2811 (Fa)</option>
                        </select>
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }} title={`Ajoute une carte réseau en slot 1 : ${ethModule(r.model).map(ifAbbr).join(', ')}`}>
                            <input type="checkbox" checked={!!r.mod} onChange={e => setRtr(r.id, { mod: e.target.checked })} /> module slot 1 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>(+{ethModule(r.model).map(ifAbbr).join(', ')})</span>
                          </label>
                          <span style={{ fontSize: 11, ...mono }}>{ethSlots(r.model, r.mod).map(ifAbbr).join(' · ')} + série</span>
                        </div>
                      </td>
                      <td style={{ ...td, width: 40 }}><button type="button" onClick={() => delRtr(r.id)} style={{ ...smallBtn, color: '#dc2626', borderColor: 'transparent' }} title="Supprimer">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addRtr} style={{ ...btn, marginTop: 10 }}>+ Ajouter un routeur</button>
          </div>

          <div style={group}>
            <div style={legend}>🔀 Assignation des sous-réseaux</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 12px' }}>Sélectionne les routeurs connectés à chaque sous-réseau : <strong>1 routeur</strong> = LAN (passerelle + DHCP possible) ; <strong>2 routeurs ou plus</strong> = segment d’interconnexion (une IP par routeur, via un switch — comme « Switch 1 »).</div>
            {ctx.services.map(s => {
              const transit = s.routerIds.length >= 2;
              const badge = transit ? { t: `🔗 interconnexion · ${s.routerIds.length} routeurs`, c: 'var(--accent)', bg: 'color-mix(in srgb,var(--accent) 15%,transparent)' }
                : s.routerIds.length === 1 ? { t: '🖥️ LAN', c: 'var(--text-muted)', bg: 'var(--surface-3)' }
                : { t: '⚠ aucun routeur', c: '#dc2626', bg: 'color-mix(in srgb,#dc2626 12%,transparent)' };
              return (
                <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong style={{ fontSize: 13.5 }}>{s.name}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', ...mono }}>{s.hosts} hôtes</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 9px', borderRadius: 999, color: badge.c, background: badge.bg }}>{badge.t}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
                      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={s.hasSwitch} onChange={e => setSvc(s.id, { hasSwitch: e.target.checked })} /> switch</label>
                      <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', cursor: transit ? 'not-allowed' : 'pointer', opacity: transit ? .4 : 1 }} title={transit ? 'Pas de DHCP sur un segment d’interconnexion' : ''}><input type="checkbox" disabled={transit} checked={s.dhcp && !transit} onChange={e => setSvc(s.id, { dhcp: e.target.checked })} /> DHCP</label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ctx.routers.map(r => {
                      const on = s.routerIds.includes(r.id);
                      const ord = s.routerIds.indexOf(r.id);
                      const tag = on && transit && s.media === 'serial' ? (ord === 0 ? 'DCE · ' : 'DTE · ') : '';
                      return <button key={r.id} type="button" onClick={() => toggleSvcRouter(s.id, r.id)} style={{ padding: '4px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>{tag}{r.name}</button>;
                    })}
                    {ctx.routers.length === 0 && <span className="meta" style={{ fontSize: 11.5 }}>Ajoute d’abord des routeurs ci-dessus.</span>}
                    {transit && <select style={{ ...field, width: 165, marginLeft: 6 }} value={s.media || 'gig'} onChange={e => setSvc(s.id, { media: e.target.value as LinkMedia })}>
                      <option value="gig">Ethernet (switch)</option>
                      <option value="serial" disabled={s.routerIds.length !== 2}>Série (2 routeurs)</option>
                    </select>}
                  </div>
                </div>
              );
            })}
            {!ctx.services.length && <div className="meta">Ajoute des sous-réseaux à l’étape 1.</div>}
          </div>

          {/* Résultats */}
          {plan.error && <div style={{ ...group, borderColor: '#dc2626', background: 'color-mix(in srgb,#dc2626 8%,transparent)' }}><strong style={{ color: '#dc2626' }}>⚠ {plan.error}</strong></div>}
          {!!plan.warnings.length && (
            <div style={{ ...group, borderColor: '#ca8a04', background: 'color-mix(in srgb,#ca8a04 8%,transparent)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ À vérifier</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>{plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}

          <div style={group}>
            <div style={legend}>
              📋 Plan d’adressage — {plan.subs.length} sous-réseaux
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{plan.bases.length > 1 ? `${plan.bases.length} réseaux · ${plan.used}/${plan.totalAddr} adr.` : `${ipToStr(plan.baseNet)}/${plan.cidr} · ${plan.used}/${plan.totalAddr} adr.`}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
                <thead><tr><th style={th}>Sous-réseau</th><th style={th}>Réseau/CIDR</th><th style={th}>Masque</th><th style={th}>Plage utilisable</th><th style={th}>Broadcast</th><th style={th}>Passerelle</th><th style={th}>Hôtes</th></tr></thead>
                <tbody>
                  {plan.subs.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 600 }}>{s.kind === 'link' ? '🔗 ' : ''}{s.name}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.net)}/{s.cidr}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.mask)}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.first)} – {ipToStr(s.last)}</td>
                      <td style={{ ...td, ...mono }}>{ipToStr(s.bc)}</td>
                      <td style={{ ...td, ...mono }}>{s.gw !== null ? ipToStr(s.gw) : '—'}</td>
                      <td style={{ ...td, ...mono }}>{s.usable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={group}>
            <div style={legend}>
              🔌 Table d’adressage des interfaces
              <button type="button" onClick={() => copy('plan', planText)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'plan' ? '✓ Copié' : 'Copier le plan'}</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 620 }}>
                <thead><tr><th style={th}>Routeur</th><th style={th}>Interface</th><th style={th}>Cible</th><th style={th}>IP</th><th style={th}>Masque</th><th style={th}>Rôle</th></tr></thead>
                <tbody>
                  {plan.ifaces.map((i, k) => {
                    const key = `${i.routerId}|${i.iface}`;
                    const forced = !!(ctx.ifaceIps || {})[key];
                    return (
                    <tr key={k}>
                      <td style={{ ...td, fontWeight: 600 }}>{i.routerName}</td>
                      <td style={{ ...td, ...mono }}>{i.iface}</td>
                      <td style={td}>{i.target}</td>
                      <td style={td}>
                        <input value={(ctx.ifaceIps || {})[key] ?? ''} onChange={e => setIfaceIp(key, e.target.value)} placeholder={ipToStr(i.ip)}
                          title={forced ? 'IP forcée manuellement' : 'IP automatique — saisis une valeur pour la forcer'}
                          style={{ ...field, ...mono, width: 132, padding: '3px 7px', borderColor: forced ? 'var(--accent)' : 'var(--border)' }} />
                      </td>
                      <td style={{ ...td, ...mono }}>{ipToStr(i.mask)}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{i.role}{i.clock ? ' · clock 64000' : ''}{forced ? ' · ✏️ manuel' : ''}</td>
                    </tr>
                  ); })}
                  {!plan.ifaces.length && <tr><td style={td} colSpan={6}>Ajoute des routeurs et assigne-les aux sous-réseaux.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>✏️ <strong>IP manuelle</strong> : saisis une adresse dans la colonne <em>IP</em> pour la <strong>forcer</strong> (vide = calcul automatique). La <strong>passerelle du LAN</strong>, les <strong>routes statiques</strong>, le <strong>relais DHCP</strong> et le <strong>DNS</strong> suivent automatiquement. Une IP hors du sous-réseau est ignorée (avertissement).</div>
            {ctx.mode === 'extension' && <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>ℹ️ Mode <strong>extension</strong> : vérifie que ces plages ne recouvrent pas l’existant avant de les intégrer.</div>}
          </div>

          <div style={group}>
            <div style={legend}>🖥️ Hôtes fixes (end-points : serveurs, postes)</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Attribue une <strong>IP statique</strong> à une machine terminale (ex. <em>admin</em> en <code>192.168.1.1</code>, serveur web…). L’outil <strong>valide</strong> l’adresse (dans le bon sous-réseau, pas déjà prise) et l’ajoute aux <strong>enregistrements DNS</strong>.</div>
            {(ctx.hosts || []).map((h, idx) => {
              const ph = plan.hosts.find(p => p.id === h.id);
              const bad = ph && !ph.ok;
              return (
                <div key={h.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1.2fr) minmax(140px,1.4fr) minmax(120px,1fr) auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input style={field} value={h.name} onChange={e => setHost(idx, { name: e.target.value })} placeholder="Nom (ex. srv-web)" />
                  <select style={field} value={h.subId} onChange={e => setHost(idx, { subId: e.target.value })}>
                    <option value="">— sous-réseau —</option>
                    {plan.subs.map(s => <option key={s.id} value={s.id}>{s.kind === 'link' ? '🔗 ' : ''}{s.name} ({ipToStr(s.net)}/{s.cidr})</option>)}
                  </select>
                  <input style={{ ...field, ...mono, borderColor: bad ? '#dc2626' : 'var(--border)' }} value={h.ip} onChange={e => setHost(idx, { ip: e.target.value })} placeholder="192.168.1.1" />
                  <button type="button" onClick={() => delHost(idx)} style={smallBtn}>✕</button>
                  {ph && ph.note && <div style={{ gridColumn: '1 / -1', fontSize: 11, marginTop: -2, color: bad ? '#dc2626' : 'var(--text-muted)' }}>{bad ? '⚠ ' : 'ℹ️ '}{ph.name || 'hôte'} : {ph.note}</div>}
                </div>
              );
            })}
            <button type="button" onClick={addHost} style={btn}>+ Hôte fixe</button>
            {!!plan.hosts.filter(h => h.ok).length && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                {plan.hosts.filter(h => h.ok).length} hôte(s) valide(s) — ajoutés au DNS ({ctx.domaine.trim() || 'lan'}).
              </div>
            )}
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 4 : Schéma ── */}
      {step === 4 && (
        <div>
          {s4('schema') && (<>
          {plan.error && <div style={{ ...group, borderColor: '#dc2626' }}><strong style={{ color: '#dc2626' }}>⚠ {plan.error}</strong></div>}
          <div style={group}>
            <div style={legend}>🗺️ Schéma du réseau</div>
            <SchemaSvg ctx={ctx} plan={plan} />
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Vue topologie : une <strong>dorsale</strong> de routeurs reliés par leurs <strong>segments/switches</strong> ; chaque sous-réseau est un <strong>nuage</strong> (switch + machines) rattaché à son routeur-passerelle, avec l’interface, l’idSR/CIDR, la passerelle et l’IP du switch.</div>
          </div>

          <div style={group}>
            <div style={legend}>🧱 Détail par sous-réseau ({lanSubs.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
              {lanSubs.map(s => {
                const cr = clientRange(ctx, s);
                const ifc = s.gw !== null ? ifaceFor(s.routerId || '', s.gw) : undefined;
                return (
                  <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', background: 'var(--surface)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{s.name}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', fontSize: 12.5, ...mono }}>
                      <span style={{ color: 'var(--text-muted)' }}>idSR</span><span>{ipToStr(s.net)}/{s.cidr}</span>
                      <span style={{ color: 'var(--text-muted)' }}>masque</span><span>{ipToStr(s.mask)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>broadcast</span><span>{ipToStr(s.bc)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>passerelle</span><span>{s.gw !== null ? ipToStr(s.gw) : '—'}{ifc ? ` (${ifc.iface})` : ''}</span>
                      {s.switchIp !== null && (<><span style={{ color: 'var(--text-muted)' }}>switch</span><span>{ipToStr(s.switchIp)}</span></>)}
                      <span style={{ color: 'var(--text-muted)' }}>clients</span><span>{cr ? `${ipToStr(cr[0])} – ${ipToStr(cr[1])}` : '—'}</span>
                    </div>
                    {(() => { const hs = plan.hosts.filter(h => h.subId === s.id && h.ip !== null); return hs.length ? (
                      <div style={{ marginTop: 6, borderTop: '1px dashed var(--border)', paddingTop: 5, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: 12, ...mono }}>
                        {hs.map(h => (<Fragment key={h.id}><span style={{ color: h.ok ? 'var(--text-muted)' : '#dc2626' }}>{h.ok ? '📌' : '⚠'} {h.name || 'hôte'}</span><span style={{ color: h.ok ? 'var(--text)' : '#dc2626' }}>{ipToStr(h.ip!)}</span></Fragment>))}
                      </div>
                    ) : null; })()}
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{s.dhcp ? '📶 DHCP' : '📌 statique'} · {ctx.routers.find(r => r.id === s.routerId)?.name || 'sans routeur'}</div>
                  </div>
                );
              })}
              {!lanSubs.length && <div className="meta">Définis des sous-réseaux à l’étape 1 et une topologie à l’étape 3.</div>}
            </div>
          </div>
          </>)}

          {s4('routeurs') && (<>
          <div style={group}>
            <div style={legend}>
              🧨 Étape 0 — Réinitialiser (matériel réutilisé)
              <button type="button" onClick={() => copy('reset', resetText)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'reset' ? '✓ Copié' : 'Copier'}</button>
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 8px' }}>Sur un routeur/switch déjà utilisé, une config parasite (routes, ACL, VLAN) peut tout bloquer. À passer <strong>avant</strong> toute configuration. Aux invites : <em>« Save? [yes/no] »</em> → <code>no</code>, <em>« Proceed with reload? [confirm] »</em> → <kbd>Entrée</kbd>. Sur un switch, faire aussi <code>delete flash:vlan.dat</code> avant le <code>reload</code>.</div>
            <pre style={preStyle}><code>{resetText}</code></pre>
          </div>

          <div style={group}>
            <div style={legend}>
              📟 Configuration complète des routeurs (à coller telle quelle)
              <button type="button" onClick={() => copy('rcfgAll', routerCfg.full)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'rcfgAll' ? '✓ Copié' : 'Tout copier'}</button>
            </div>
            {routerCfg.byRouter.map(b => (
              <div key={b.routerId} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {b.routerName}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>{b.routes} route(s) statique(s)</span>
                  <button type="button" onClick={() => copy('rcfg:' + b.routerId, b.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'rcfg:' + b.routerId ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{b.text}</code></pre>
              </div>
            ))}
            {!routerCfg.byRouter.length && <div className="meta">Ajoute des routeurs à l’étape 3.</div>}
            <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}><strong>Config complète</strong>, à coller telle quelle dans la CLI de chaque routeur : <strong>sécurité</strong> (<code>enable secret</code>, compte privilège 15, <code>service password-encryption</code>), <strong>interfaces</strong> (IP, <code>no shutdown</code>, <code>clock rate</code> DCE, <code>ip nat inside</code>, relais <code>ip helper-address</code>), <strong>routes statiques</strong> (plus court chemin) + route par défaut, <strong>NAT/PAT</strong> sur le routeur de bordure, et <strong>SSH</strong> (clé RSA, lignes vty/console). Le routeur de sortie NAT se choisit à l’onglet <strong>Internet / NAT</strong>.</div>
          </div>
          </>)}

          {s4('nat') && (<>
          <div style={group}>
            <div style={legend}>🌍 Sortie Internet / Firewall — NAT (statique · PAT · redirection de port)</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Choisis le routeur relié à l’extérieur (le « Firewall ») : l’outil génère le <strong>NAT statique (1:1)</strong>, le <strong>PAT (overload)</strong>, la <strong>route par défaut</strong> et la <strong>redirection de port</strong> d’un serveur web — de quoi réaliser un <strong>TP NAT complet</strong> (statique → surchargé → port forward).</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
              <div><label style={label}>Routeur de sortie</label>
                <select value={ctx.internetRouterId} onChange={e => set({ internetRouterId: e.target.value })} style={field}>
                  <option value="">— aucun (pas de NAT) —</option>
                  {ctx.routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div><label style={label}>Interface WAN</label><input value={ctx.wanIf} onChange={e => set({ wanIf: e.target.value })} style={field} placeholder="GigabitEthernet0/1" /></div>
              <div><label style={label}>IP WAN</label><input value={ctx.wanIp} onChange={e => set({ wanIp: e.target.value })} style={field} placeholder="172.16.3.250" /></div>
              <div><label style={label}>CIDR WAN</label><input value={ctx.wanCidr} onChange={e => set({ wanCidr: e.target.value })} style={field} placeholder="24" /></div>
              <div><label style={label}>Passerelle FAI</label><input value={ctx.faiGw} onChange={e => set({ faiGw: e.target.value })} style={field} placeholder="172.16.3.254" /></div>
              <div><label style={label}>Serveur web (option)</label><input value={ctx.webIp} onChange={e => set({ webIp: e.target.value })} style={field} placeholder="192.5.10.12" /></div>
              <div><label style={label}>Port web</label><input value={ctx.webPort} onChange={e => set({ webPort: e.target.value })} style={field} placeholder="8080" /></div>
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer', margin: '2px 0 10px' }}>
              <input type="checkbox" checked={ctx.natOverload} onChange={e => set({ natOverload: e.target.checked })} /> <b>PAT (overload)</b> — traduire tout le LAN derrière l’IP WAN <span className="meta" style={{ fontSize: 11 }}>(décoche pour du NAT statique seul, Partie 1 du TP)</span>
            </label>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>NAT statique (1:1) — IP interne → IP publique</label>
              {(ctx.natStatics || []).map((s, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <input style={{ ...field, ...mono }} value={s.inside} onChange={e => setStat(idx, { inside: e.target.value })} placeholder="192.168.1.1 (interne)" />
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>→</span>
                  <input style={{ ...field, ...mono }} value={s.pub} onChange={e => setStat(idx, { pub: e.target.value })} placeholder="45.25.23.101 (publique)" />
                  <button type="button" onClick={() => delStat(idx)} style={smallBtn}>✕</button>
                </div>
              ))}
              <button type="button" onClick={addStat} style={btn}>+ NAT statique</button>
            </div>
            {nat ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {nat.router}</strong>
                  <button type="button" onClick={() => copy('nat', nat.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'nat' ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{nat.text}</code></pre>
                <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>⚠️ L’<strong>interface WAN</strong> doit être une interface <strong>libre</strong> de ce routeur (non utilisée par un sous-réseau). Le <strong>serveur web</strong> est publié en <code>ip nat inside source static tcp</code> ; le DNS ne portant pas de port, l’accès externe se fait par <code>http://&lt;IP WAN&gt;:{ctx.webPort || '80'}</code>.</div>
              </div>
            ) : <div className="meta">Sélectionne un <strong>routeur de sortie</strong> pour générer la configuration NAT/PAT.</div>}

            {!!natTable.length && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>📋 Table de NAT prévisionnelle</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>— pré-remplit le tableau 3 du dossier (<code>show ip nat translation</code>)</span>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        {['Pro', 'IP local inside', 'Port', 'IP global inside', 'Port', 'Commentaire'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 9px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {natTable.map((r, i) => (
                        <tr key={i} style={{ borderBottom: i < natTable.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '5px 9px', ...mono, color: 'var(--text-muted)' }}>{r.proto}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.localInside}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.localPort}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.globalInside}</td>
                          <td style={{ padding: '5px 9px', ...mono }}>{r.globalPort}</td>
                          <td style={{ padding: '5px 9px', color: 'var(--text-muted)' }}>{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Le NAT statique n’affiche <strong>pas de port</strong> (<code>---</code>) : toute connexion de l’IP est traduite. Les lignes <strong>PAT</strong> sont des <strong>exemples</strong> — les ports réels sont attribués dynamiquement à chaque flux et n’apparaissent qu’après du trafic (ping/HTTP).</div>
              </div>
            )}

            <details style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', background: 'var(--surface-2)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>📝 Rappel — les tableaux du dossier technique</summary>
              <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.55 }}>
                <p style={{ margin: '0 0 8px' }}>Pour chaque partie du TP, renseigne ces tableaux à partir des valeurs générées ci-dessus :</p>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li style={{ marginBottom: 6 }}><strong>Interfaces du Firewall</strong> — <em>Interface · IP · inside/outside · commentaire</em>. Les interfaces LAN sont <code>ip nat inside</code>, l’interface WAN (<code>{ctx.wanIf || 'Gig0/1'}</code>) est <code>ip nat outside</code>.</li>
                  <li style={{ marginBottom: 6 }}><strong>Route(s) statique(s)</strong> — <em>IDSR · MSR · passerelle · commentaire</em>. Ici la route par défaut : IDSR <code>0.0.0.0</code>, MSR <code>0.0.0.0</code>, passerelle = <code>{ctx.faiGw || 'passerelle FAI'}</code>.</li>
                  <li style={{ marginBottom: 6 }}><strong>ACL (réseaux à NAT)</strong> — <em>ACE · autorisation · IDSR · wildcard · commentaire</em>. Uniquement pour le PAT : <code>access-list 1 permit &lt;réseau&gt; &lt;wildcard&gt;</code> (wildcard = masque inversé, ex. <code>/24 → 0.0.0.255</code>).</li>
                  <li><strong>Table de NAT</strong> — <em>IP local inside · port · IP global inside · port · commentaire</em>. → voir la <strong>table prévisionnelle</strong> ci-dessus (relevée réellement avec <code>show ip nat translation</code>).</li>
                </ol>
              </div>
            </details>
          </div>
          </>)}
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 5 : DHCP ── */}
      {step === 5 && (
        <div>
          <div style={group}>
            <div style={legend}>
              📡 Relais DHCP — scripts à coller sur les routeurs
              {!!dhcp.relays.length && <button type="button" onClick={() => copy('relayAll', dhcp.relaysFull)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'relayAll' ? '✓ Copié' : 'Tout copier'}</button>}
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Chaque interface LAN dont les clients sont en DHCP relaie les requêtes vers le serveur <code>{dhcp.server || '(non défini — étape 2)'}</code> via <code>ip helper-address</code>.</div>
            {!dhcp.relays.length && <div className="meta">Aucun LAN « DHCP » assigné à un routeur. Coche « DHCP » sur un sous-réseau LAN à l’étape 3.</div>}
            {dhcp.relays.map(b => (
              <div key={b.routerId} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {b.routerName}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>{b.count} interface(s)</span>
                  <button type="button" onClick={() => copy('relay:' + b.routerId, b.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'relay:' + b.routerId ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{b.text}</code></pre>
              </div>
            ))}
          </div>

          <div style={group}>
            <div style={legend}>🗄️ Étendues à configurer sur le serveur DHCP ({dhcp.pools.length})</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>À saisir dans le service <strong>DHCP</strong> du serveur (Packet Tracer : onglet Services → DHCP ; ou rôle DHCP Windows). Une étendue par LAN client.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
                <thead><tr><th style={th}>Pool</th><th style={th}>Réseau</th><th style={th}>Masque</th><th style={th}>Passerelle</th><th style={th}>DNS</th><th style={th}>Domaine</th><th style={th}>Plage (début – fin)</th><th style={th}>Bail (j)</th></tr></thead>
                <tbody>
                  {dhcp.pools.map((p, k) => (
                    <tr key={k}>
                      <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...td, ...mono }}>{p.net}</td>
                      <td style={{ ...td, ...mono }}>{p.mask}</td>
                      <td style={{ ...td, ...mono }}>{p.gw}</td>
                      <td style={{ ...td, ...mono }}>{p.dns}</td>
                      <td style={td}>{p.domain || '—'}</td>
                      <td style={{ ...td, ...mono }}>{p.start} – {p.end}</td>
                      <td style={{ ...td, ...mono }}>{p.lease}</td>
                    </tr>
                  ))}
                  {!dhcp.pools.length && <tr><td style={td} colSpan={8}>Aucune étendue : coche « DHCP » sur un LAN à l’étape 3.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>💡 Les équipements à <strong>IP fixe</strong> (serveur, WAP, imprimante) : soit une adresse <strong>hors de la plage</strong> distribuée, soit une <strong>réservation DHCP</strong> (association MAC → IP) — jamais une adresse déjà dans le pool, sous peine de conflit.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 6 : DNS ── */}
      {step === 6 && (
        <div>
          <div style={group}>
            <div style={legend}>🌐 Enregistrements DNS — {dns.domain}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 380 }}>
                <thead><tr><th style={th}>Hôte</th><th style={th}>FQDN</th><th style={th}>Type</th><th style={th}>Valeur</th></tr></thead>
                <tbody>
                  {dns.recs.map((r, k) => (
                    <tr key={k}><td style={{ ...td, fontWeight: 600 }}>{r.host}</td><td style={{ ...td, ...mono }}>{r.fqdn}</td><td style={td}>A</td><td style={{ ...td, ...mono }}>{ipToStr(r.ip)}</td></tr>
                  ))}
                  {!dns.recs.length && <tr><td style={td} colSpan={4}>Renseigne un domaine (étape 1) et une topologie (étape 3).</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 8 }}>Les postes clients sont en DHCP (adresses dynamiques) → pas d’enregistrement A statique. Les routeurs (première interface) et le serveur DNS sont proposés ci-dessus.</div>
          </div>

          <div style={group}>
            <div style={legend}>🖥️ Résolution locale sur les routeurs (CLI)<button type="button" onClick={() => copy('dnsHost', dns.hostLines)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'dnsHost' ? '✓ Copié' : 'Copier'}</button></div>
            <pre style={preStyle}><code>{dns.hostLines || '(rien à générer)'}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Permet <code>ping R2</code> par nom depuis la CLI. <code>ip name-server</code> n’apparaît que si un serveur DNS est défini (étape 2).</div>
          </div>

          <div style={group}>
            <div style={legend}>🗂️ Zones (serveur DNS)<button type="button" onClick={() => copy('dnsZone', dns.zone)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'dnsZone' ? '✓ Copié' : 'Copier'}</button></div>
            <pre style={preStyle}><code>{dns.zone}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Sous Packet Tracer, saisis ces enregistrements dans le service <strong>DNS</strong> du serveur (onglet Services → DNS) ; sous Windows Server, crée la zone directe et la zone inversée correspondantes.</div>
          </div>

          <div style={group}>
            <div style={legend}>✅ Tests</div>
            <pre style={preStyle}><code>{dns.tests.join('\n') || '(rien à tester)'}</code></pre>
            <div className="meta" style={{ fontSize: 11.5, marginTop: 6 }}>Depuis un client : <code>nslookup</code> pour vérifier la résolution, <code>ping &lt;fqdn&gt;</code> pour la connectivité. Vérifie que les clients ont bien reçu le <strong>serveur DNS</strong> par DHCP (étape 5).</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 7 : SSH ── */}
      {step === 7 && (
        <div>
          <div style={group}>
            <div style={legend}>🔑 SSH — routeurs ({ssh.routers.length})</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Accès distant chiffré : domaine, clé RSA, compte <code>{ctx.login || 'admin'}</code> en privilège 15, VTY en <code>transport input ssh</code>. À coller dans la CLI de chaque routeur.</div>
            {ssh.routers.map(r => (
              <div key={r.name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🧭 {r.name}</strong>
                  <button type="button" onClick={() => copy('sshr:' + r.name, r.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'sshr:' + r.name ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{r.text}</code></pre>
              </div>
            ))}
            {!ssh.routers.length && <div className="meta">Ajoute des routeurs à l’étape 3.</div>}
          </div>

          <div style={group}>
            <div style={legend}>🔑 SSH — switches ({ssh.switches.length})</div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>Chaque switch reçoit une <strong>IP de gestion (SVI VLAN 1)</strong>, une passerelle par défaut, puis la config SSH. À coller dans la CLI de chaque switch.</div>
            {ssh.switches.map(s => (
              <div key={s.name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <strong style={{ fontSize: 13 }}>🔀 {s.name}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8, ...mono }}>{s.ip}</span>
                  <button type="button" onClick={() => copy('sshs:' + s.name, s.text)} style={{ ...smallBtn, marginLeft: 'auto' }}>{copied === 'sshs:' + s.name ? '✓ Copié' : 'Copier'}</button>
                </div>
                <pre style={preStyle}><code>{s.text}</code></pre>
              </div>
            ))}
            {!ssh.switches.length && <div className="meta">Coche « switch » sur des sous-réseaux à l’étape 3.</div>}
          </div>

          <div style={group}>
            <div style={legend}>🖥️ Se connecter en SSH depuis Windows</div>
            <div className="meta" style={{ fontSize: 12 }}>Le client <code>ssh</code> natif de Windows refuse souvent les algorithmes des vieux IOS (« <em>no matching key exchange method</em> »). Utilise <strong>PuTTY</strong> ou <strong>MobaXterm</strong> (IP de l’équipement, port 22, type SSH). Si la clé est invalide (équipement renommé après sa génération), régénère-la : <code>crypto key zeroize rsa</code> puis <code>crypto key generate rsa</code>.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}

      {/* ── Étape 8 : Tests ── */}
      {step === 8 && (
        <div>
          <div style={group}>
            <div style={legend}>
              🔌 Plan de tests ping (communication réseau)
              {!!tests.full && <button type="button" onClick={() => copy('testsAll', tests.full)} style={{ ...btn, marginLeft: 'auto' }}>{copied === 'testsAll' ? '✓ Copié' : 'Tout copier'}</button>}
            </div>
            <div className="meta" style={{ fontSize: 11.5, margin: '0 0 10px' }}>On valide du plus proche au plus lointain : la <strong>première</strong> commande qui échoue localise la panne. Les <strong>interfaces de routeur</strong> répondent toujours → idéales pour juger le routage sans le pare-feu Windows.</div>
            {tests.sections.map((sec, k) => (
              <div key={k} style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>{sec.title}</strong>
                <pre style={{ ...preStyle, marginTop: 5 }}><code>{sec.lines.join('\n')}</code></pre>
              </div>
            ))}
            {!tests.sections.length && <div className="meta">Définis des sous-réseaux et une topologie (étapes 1 &amp; 3) pour générer les tests.</div>}
            <div className="meta" style={{ fontSize: 11.5, marginTop: 4 }}>Un ping vers un <strong>poste/serveur Windows</strong> peut échouer à cause du <strong>pare-feu</strong> même si le routage est bon → autorise l’ICMP entrant, ou fie-toi aux interfaces de routeur. Pinguer sa <em>propre</em> passerelle réussit même sans passerelle par défaut : ça ne prouve pas le routage.</div>
          </div>
          <StepNav step={step} setStep={setStep} />
        </div>
      )}
    </div>
  );
}

function clientRange(ctx: Ctx, s: Sub): [number, number] | null {
  if (s.gw === null) return null;
  if (ctx.gwPos === 'last') {
    const hi = s.switchIp !== null ? (s.switchIp - 1) >>> 0 : (s.gw - 1) >>> 0;
    return hi >= s.first ? [s.first, hi] : null;
  }
  const lo = s.switchIp !== null ? (s.switchIp + 1) >>> 0 : (s.gw + 1) >>> 0;
  return lo <= s.last ? [lo, s.last] : null;
}

const CLOUD_COLORS = ['#ec4899', '#22c55e', '#eab308', '#38bdf8', '#a855f7', '#f97316', '#14b8a6', '#f43f5e'];

function SchemaSvg({ ctx, plan }: { ctx: Ctx; plan: Plan }) {
  const routers = ctx.routers;
  if (!routers.length) return <div className="meta">Ajoute des routeurs (étape 3) pour afficher le schéma.</div>;
  const lanSubs = plan.subs.filter(s => s.kind === 'lan');
  const linkSubs = plan.subs.filter(s => s.kind === 'link');

  // ── Graphe de placement : nœuds = routeurs + UN switch par interconnexion
  //    Ethernet. Le switch d'une liaison à N routeurs devient un vrai nœud
  //    (au centre de l'étoile) au lieu d'un barycentre qui tomberait sur un
  //    routeur. Les liaisons série (point-à-point) relient 2 routeurs directement.
  const rKey = (id: string) => `r:${id}`;
  const sKey = (s: Sub) => `s:${s.id}`;
  const memberIds = (s: Sub) => (s.routerIds || []).filter(id => routers.some(r => r.id === id));
  const nodeKeys: string[] = routers.map(r => rKey(r.id));
  const adjN = new Map<string, string[]>(nodeKeys.map(k => [k, [] as string[]]));
  const link = (a: string, b: string) => { if (!adjN.get(a)!.includes(b)) adjN.get(a)!.push(b); if (!adjN.get(b)!.includes(a)) adjN.get(b)!.push(a); };
  for (const s of linkSubs) {
    const ids = memberIds(s); if (ids.length < 2) continue;
    if (s.media === 'serial') { link(rKey(ids[0]), rKey(ids[1])); }
    else { const k = sKey(s); adjN.set(k, []); nodeKeys.push(k); for (const id of ids) link(k, rKey(id)); }
  }
  const degN = (k: string) => (adjN.get(k) || []).length;

  // ── Placement RADIAL (arbre BFS depuis le nœud le plus connecté de chaque
  //    composante). Un switch relié à N routeurs se retrouve au centre, ses
  //    routeurs tout autour → gère l'étoile (N connexions), la chaîne et l'arbre.
  const childrenN = new Map<string, string[]>(nodeKeys.map(k => [k, [] as string[]]));
  const seen = new Set<string>();
  const rootsN: string[] = [];
  for (const k0 of [...nodeKeys].sort((a, b) => degN(b) - degN(a))) {
    if (seen.has(k0)) continue;
    rootsN.push(k0); seen.add(k0);
    const q = [k0];
    while (q.length) { const cur = q.shift()!; for (const nb of (adjN.get(cur) || [])) if (!seen.has(nb)) { seen.add(nb); childrenN.get(cur)!.push(nb); q.push(nb); } }
  }
  const leavesN = new Map<string, number>();
  const countLeaves = (k: string): number => { const ch = childrenN.get(k)!; if (!ch.length) { leavesN.set(k, 1); return 1; } let s = 0; for (const c of ch) s += countLeaves(c); leavesN.set(k, s); return s; };
  rootsN.forEach(countLeaves);
  const ANG = new Map<string, number>(), DEP = new Map<string, number>();
  const assign = (k: string, a0: number, a1: number, d: number) => {
    DEP.set(k, d); ANG.set(k, (a0 + a1) / 2);
    const ch = childrenN.get(k)!; if (!ch.length) return;
    const tot = ch.reduce((s, c) => s + leavesN.get(c)!, 0) || 1; let a = a0;
    for (const c of ch) { const span = (a1 - a0) * (leavesN.get(c)! / tot); assign(c, a, a + span, d + 1); a += span; }
  };
  let acc = 0; const totL = rootsN.reduce((s, k) => s + leavesN.get(k)!, 0) || 1;
  for (const root of rootsN) { const span = 2 * Math.PI * (leavesN.get(root)! / totL); assign(root, acc, acc + span, 0); acc += span; }

  const ringGap = 235, cloudDist = 200;
  const rW = 84, rH = 46, cloudRx = 104, cloudRy = 70, segRx = 88, segRy = 50;
  const PXk = (k: string) => Math.cos(ANG.get(k) ?? 0) * (DEP.get(k) ?? 0) * ringGap;
  const PYk = (k: string) => Math.sin(ANG.get(k) ?? 0) * (DEP.get(k) ?? 0) * ringGap;
  const RX = (id: string) => PXk(rKey(id)), RY = (id: string) => PYk(rKey(id));
  // Direction « vers l'extérieur » d'un routeur = plus grand secteur libre entre
  // ses voisins de graphe (switches / routeurs) → on y accroche ses LAN.
  const outAngleR = (id: string): number => {
    const k = rKey(id); const nbs = adjN.get(k) || [];
    if (!nbs.length) return Math.PI / 2;
    const dirs = nbs.map(nb => Math.atan2(PYk(nb) - PYk(k), PXk(nb) - PXk(k))).sort((a, b) => a - b);
    let best = -1, mid = Math.PI / 2;
    for (let i = 0; i < dirs.length; i++) { const a = dirs[i], b = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + 2 * Math.PI; if (b - a > best) { best = b - a; mid = (a + b) / 2; } }
    return mid;
  };

  // ── Positions calculées ──
  const routerNodes = routers.map(r => ({ r, x: RX(r.id), y: RY(r.id) }));
  const lanNodes = routers.flatMap(r => {
    const list = lanSubs.filter(s => s.routerId === r.id);
    const base = outAngleR(r.id), spread = list.length <= 1 ? 0 : Math.min(Math.PI * 0.82, 0.6 * list.length);
    return list.map((s, k) => {
      const a = base - spread / 2 + (list.length <= 1 ? 0 : spread * (k / (list.length - 1)));
      return { s, rid: r.id, rx: RX(r.id), ry: RY(r.id), x: RX(r.id) + Math.cos(a) * cloudDist, y: RY(r.id) + Math.sin(a) * cloudDist, color: CLOUD_COLORS[Math.max(0, lanSubs.indexOf(s)) % CLOUD_COLORS.length] };
    });
  });
  type LinkNode = { s: Sub; serial: boolean; parts: { rid: string; ip: number; x: number; y: number }[]; cx: number; cy: number };
  const linkNodes = linkSubs.map((s): LinkNode | null => {
    const ids = memberIds(s); if (ids.length < 2) return null;
    const parts = ids.map((rid, k) => { const ip = plan.ifaces.find(f => f.routerId === rid && f.ip > s.net && f.ip < s.bc)?.ip ?? ((s.first + k) >>> 0); return { rid, ip, x: RX(rid), y: RY(rid) }; });
    const serial = s.media === 'serial';
    return { s, serial, parts, cx: serial ? (parts[0].x + parts[1].x) / 2 : PXk(sKey(s)), cy: serial ? (parts[0].y + parts[1].y) / 2 : PYk(sKey(s)) };
  }).filter((n): n is LinkNode => !!n);

  // ── Cadre : boîte englobante de tout ce qui est dessiné ──
  const xs: number[] = [], ys: number[] = [];
  routerNodes.forEach(n => { xs.push(n.x - rW / 2, n.x + rW / 2); ys.push(n.y - rH / 2, n.y + rH / 2); });
  lanNodes.forEach(n => { xs.push(n.x - cloudRx, n.x + cloudRx); ys.push(n.y - cloudRy, n.y + cloudRy); });
  linkNodes.forEach(n => { xs.push(n.cx - segRx, n.cx + segRx); ys.push(n.cy - segRy, n.cy + segRy); });
  if (!xs.length) { xs.push(-rW, rW); ys.push(-rH, rH); }
  const pad = 42;
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  const width = Math.max(360, maxX - minX), height = Math.max(240, maxY - minY);

  // Un « nuage » de sous-réseau : ellipse colorée + switch central + 3 machines + libellés.
  const cloud = (cx: number, cy: number, color: string, title: string, subtitle: string, info: string) => (
    <g>
      <ellipse cx={cx} cy={cy} rx={cloudRx} ry={cloudRy} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.4} />
      <text x={cx} y={cy - cloudRy + 16} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--text)">{title}</text>
      <text x={cx} y={cy - cloudRy + 30} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">{subtitle}</text>
      <rect x={cx - 22} y={cy - 12} width={44} height={22} rx={5} fill="var(--surface)" stroke={color} strokeWidth={1.3} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={11}>🔀</text>
      {[-44, 0, 44].map((dx, k) => (
        <g key={k}>
          <line x1={cx} y1={cy + 10} x2={cx + dx} y2={cy + 34} stroke={color} strokeWidth={1} />
          <rect x={cx + dx - 9} y={cy + 34} width={18} height={13} rx={2} fill="var(--surface)" stroke={color} strokeWidth={1} />
        </g>
      ))}
      <text x={cx} y={cy + cloudRy - 8} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{info}</text>
    </g>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} viewBox={`${minX} ${minY} ${width} ${height}`} style={{ maxWidth: 'none', display: 'block' }}>
        {/* Segments inter-routeurs : chaque routeur relié au switch central de la liaison */}
        {linkNodes.map(({ s, parts, cx, cy }) => {
          if (s.media === 'serial') {
            const mx = (parts[0].x + parts[1].x) / 2, my = (parts[0].y + parts[1].y) / 2;
            return (
              <g key={s.id}>
                <line x1={parts[0].x} y1={parts[0].y} x2={parts[1].x} y2={parts[1].y} stroke="var(--accent)" strokeWidth={2.4} strokeDasharray="7 4" />
                <text x={mx} y={my - 8} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--text-muted)">série · {ipToStr(s.net)}/{s.cidr}</text>
                {parts.map((p, k) => <text key={k} x={p.x + (cx - p.x) * 0.3} y={p.y + (cy - p.y) * 0.3 - 4} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">{ipToStr(p.ip)}</text>)}
              </g>
            );
          }
          return (
            <g key={s.id}>
              {parts.map((p, j) => (
                <g key={j}>
                  <line x1={p.x} y1={p.y} x2={cx} y2={cy} stroke="var(--accent)" strokeWidth={1.8} />
                  <text x={p.x + (cx - p.x) * 0.33} y={p.y + (cy - p.y) * 0.33 - 4} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">{ipToStr(p.ip)}</text>
                </g>
              ))}
              <ellipse cx={cx} cy={cy} rx={segRx} ry={segRy} fill="var(--accent)" fillOpacity={0.08} stroke="var(--accent)" strokeWidth={1.3} strokeDasharray="4 4" />
              <text x={cx} y={cy - segRy + 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text)">{s.name}</text>
              <rect x={cx - 20} y={cy - 11} width={40} height={22} rx={5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.3} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11}>🔀</text>
              <text x={cx} y={cy + segRy - 6} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">{ipToStr(s.net)}/{s.cidr}</text>
            </g>
          );
        })}

        {/* LAN : liaison routeur → nuage + nuage */}
        {lanNodes.map(({ s, rid, rx, ry, x, y, color }) => {
          const ifc = s.gw !== null ? plan.ifaces.find(f => f.routerId === rid && f.ip === s.gw) : undefined;
          const info = `gw ${s.gw !== null ? ipToStr(s.gw) : '-'}${s.switchIp !== null ? ' · sw ' + ipToStr(s.switchIp) : ''}${s.dhcp ? ' · DHCP' : ''}`;
          return (
            <g key={s.id}>
              <line x1={rx} y1={ry} x2={x} y2={y} stroke={color} strokeWidth={1.8} />
              {ifc && <text x={rx + (x - rx) * 0.42} y={ry + (y - ry) * 0.42 - 4} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={color}>{ifAbbr(ifc.iface)} · {ipToStr(ifc.ip)}</text>}
              {cloud(x, y, color, s.name, `${ipToStr(s.net)}/${s.cidr} · ${s.usable} h`, info)}
            </g>
          );
        })}

        {/* Routeurs (au-dessus) */}
        {routerNodes.map(({ r, x, y }) => (
          <g key={r.id}>
            <rect x={x - rW / 2} y={y - rH / 2} width={rW} height={rH} rx={9} fill="var(--accent)" />
            <text x={x} y={y - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">🧭 {r.name}</text>
            <text x={x} y={y + 13} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,.85)">{r.model}{r.mod ? ' +mod' : ''}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StepNav({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
      <button type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step <= 1} style={{ ...smallBtn, opacity: step <= 1 ? .4 : 1 }}>← Précédent</button>
      <button type="button" onClick={() => setStep(Math.min(8, step + 1))} disabled={step >= 8} style={{ ...btn, opacity: step >= 8 ? .4 : 1 }}>Suivant →</button>
    </div>
  );
}
