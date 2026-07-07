import { useEffect, useRef, lazy, Suspense, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query';
import { GLOSSARY, glossarySlug } from '@/lib/glossary-data';

// Îlots chargés à la demande (code-splitting) : seul l'îlot réellement présent sur la
// page est téléchargé, au lieu d'embarquer tous les configurateurs sur chaque page.
type BlockDef = { load: () => Promise<{ default: ComponentType<any> }>; query?: boolean; props?: (node: Element) => Record<string, unknown> };
const named = (p: Promise<Record<string, any>>, key: string) => p.then(m => ({ default: m[key] as ComponentType<any> }));
const BLOCKS: Record<string, BlockDef> = {
  'latest-posts': { query: true, load: () => named(import('./LatestPosts'), 'LatestPosts'), props: n => ({ count: Number(n.getAttribute('data-count')) || 3, category: n.getAttribute('data-category') || '', title: n.getAttribute('data-title') || '', mode: n.getAttribute('data-mode') || 'latest', slugs: (n.getAttribute('data-slugs') || '').split(',').map(s => s.trim()).filter(Boolean) }) },
  'events': { query: true, load: () => named(import('./LatestEvents'), 'LatestEvents'), props: n => ({ count: Number(n.getAttribute('data-count')) || 3, title: n.getAttribute('data-title') || '' }) },
  'planning': { query: true, load: () => named(import('./PlanningEmbed'), 'PlanningEmbed'), props: n => ({ slug: n.getAttribute('data-slug') || '' }) },
  'glossaire': { query: true, load: () => named(import('./Glossary'), 'Glossary') },
  'note': { query: true, load: () => named(import('./PublicNoteBlock'), 'PublicNoteBlock'), props: n => ({ noteId: Number(n.getAttribute('data-note-id')) || 0, title: n.getAttribute('data-title') || '' }) },
  'vm-configurator': { load: () => named(import('./VmConfigurator'), 'VmConfigurator') },
  'ad-configurator': { load: () => named(import('./AdConfigurator'), 'AdConfigurator') },
  'ad-bulk-configurator': { load: () => named(import('./AdBulkConfigurator'), 'AdBulkConfigurator') },
  'net-diagnostic': { load: () => named(import('./NetDiagnostic'), 'NetDiagnostic') },
  'subnet-trainer': { load: () => named(import('./SubnetTrainer'), 'SubnetTrainer') },
  'agdlp-builder': { load: () => named(import('./AgdlpBuilder'), 'AgdlpBuilder') },
  'router-configurator': { load: () => named(import('./RouterConfigurator'), 'RouterConfigurator') },
  'subnet-planner': { load: () => named(import('./SubnetPlanner'), 'SubnetPlanner') },
  'dhcp-configurator': { load: () => named(import('./DhcpConfigurator'), 'DhcpConfigurator') },
  'static-route-generator': { load: () => named(import('./StaticRouteGenerator'), 'StaticRouteGenerator') },
  'ssh-configurator': { load: () => named(import('./SshConfigurator'), 'SshConfigurator') },
  'network-workshop': { load: () => named(import('./NetworkWorkshop'), 'NetworkWorkshop') },
};
const LAZY: Record<string, ComponentType<any>> = Object.fromEntries(Object.entries(BLOCKS).map(([k, d]) => [k, lazy(d.load)]));

// --- Auto-liens vers le glossaire : acronymes « en majuscules » (2 à 6 car., + / optionnel). ---
const GLOSS_MAP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const t of GLOSSARY) {
    const a = t.acronym.trim();
    if (/^[A-Z0-9]{2,6}(\/[A-Z0-9]{1,6})?$/.test(a)) m[a] = glossarySlug(a);
  }
  return m;
})();
const GLOSS_KEYS = Object.keys(GLOSS_MAP).sort((a, b) => b.length - a.length);
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const GLOSS_SRC = GLOSS_KEYS.length ? `(?<![\\w/])(${GLOSS_KEYS.map(escRe).join('|')})(?![\\w])` : '';
const SKIP_TAGS = new Set(['A', 'CODE', 'PRE', 'KBD', 'MARK', 'BUTTON', 'SELECT', 'TEXTAREA', 'OPTION', 'SCRIPT', 'STYLE']);
const SVG_NS = 'http://www.w3.org/2000/svg';
const BLOCK_SEL = 'p,li,td,th,dd,dt,figcaption,caption,h1,h2,h3,h4,h5,h6,blockquote,summary,aside,div';

/** Transforme la 1re occurrence par bloc de chaque acronyme connu en lien vers sa définition. */
function linkifyAcronyms(root: HTMLElement) {
  if (!GLOSS_SRC) return;
  let probe: RegExp;
  try { probe = new RegExp(GLOSS_SRC); } catch { return; } // lookbehind non supporté → on renonce sans casser
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p) {
        if (p.namespaceURI === SVG_NS || SKIP_TAGS.has(p.tagName) || p.hasAttribute('data-block') || p.classList.contains('gloss') || p.classList.contains('gloss-ref')) return NodeFilter.FILTER_REJECT;
        if (p === root) break;
        p = p.parentElement;
      }
      return probe.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const targets: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) targets.push(n as Text);
  const re = new RegExp(GLOSS_SRC, 'g');
  const seen = new Map<Element, Set<string>>(); // portée par bloc (1 lien par acronyme et par bloc)
  for (const tn of targets) {
    const block = (tn.parentElement && tn.parentElement.closest(BLOCK_SEL)) || tn.parentElement || root;
    let linked = seen.get(block); if (!linked) { linked = new Set(); seen.set(block, linked); }
    const text = tn.nodeValue || '';
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, changed = false, m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const acr = m[1];
      if (linked.has(acr)) continue;
      linked.add(acr);
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = document.createElement('a');
      a.className = 'gloss-ref'; a.href = `/glossaire#gt-${GLOSS_MAP[acr]}`; a.title = `${acr} — voir la définition`;
      a.textContent = acr;
      frag.appendChild(a);
      last = m.index + acr.length;
      changed = true;
    }
    if (changed) {
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      tn.parentNode?.replaceChild(frag, tn);
    }
  }
}

/**
 * Rend du HTML (contenu de page/article) et hydrate les blocs dynamiques (îlots React)
 * marqués par data-block, ex. le bloc « derniers articles ».
 */
export function RichContent({ html, className = 'rich' }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    linkifyAcronyms(el); // acronymes → liens vers le glossaire (avant le montage des îlots)
    const roots: Root[] = [];
    for (const [name, def] of Object.entries(BLOCKS)) {
      const nodes = el.querySelectorAll(`[data-block="${name}"]`);
      if (!nodes.length) continue;
      const Lazy = LAZY[name];
      nodes.forEach(node => {
        const props = def.props ? def.props(node) : {};
        const root = createRoot(node);
        const content = <Suspense fallback={<span className="meta" style={{ fontSize: 12 }}>Chargement…</span>}><Lazy {...props} /></Suspense>;
        root.render(def.query ? <QueryClientProvider client={queryClient}>{content}</QueryClientProvider> : content);
        roots.push(root);
      });
    }
    // Démontage différé pour éviter un unmount synchrone pendant le rendu de React.
    return () => { roots.forEach(r => setTimeout(() => { try { r.unmount(); } catch { /* ignore */ } }, 0)); };
  }, [html]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
