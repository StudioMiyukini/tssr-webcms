import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query';
import { LatestPosts } from './LatestPosts';
import { LatestEvents } from './LatestEvents';
import { PublicNoteBlock } from './PublicNoteBlock';
import { Glossary } from './Glossary';
import { PlanningEmbed } from './PlanningEmbed';
import { VmConfigurator } from './VmConfigurator';
import { AdConfigurator } from './AdConfigurator';
import { AdBulkConfigurator } from './AdBulkConfigurator';
import { NetDiagnostic } from './NetDiagnostic';
import { SubnetTrainer } from './SubnetTrainer';
import { AgdlpBuilder } from './AgdlpBuilder';
import { GLOSSARY, glossarySlug } from '@/lib/glossary-data';
import type { PostsMode } from '@/lib/page-blocks';

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
    el.querySelectorAll('[data-block="latest-posts"]').forEach(node => {
      const count = Number(node.getAttribute('data-count')) || 3;
      const category = node.getAttribute('data-category') || '';
      const title = node.getAttribute('data-title') || '';
      const mode = (node.getAttribute('data-mode') || 'latest') as PostsMode;
      const slugs = (node.getAttribute('data-slugs') || '').split(',').map(s => s.trim()).filter(Boolean);
      const root = createRoot(node);
      root.render(
        <QueryClientProvider client={queryClient}>
          <LatestPosts count={count} category={category} title={title} mode={mode} slugs={slugs} />
        </QueryClientProvider>,
      );
      roots.push(root);
    });
    el.querySelectorAll('[data-block="events"]').forEach(node => {
      const count = Number(node.getAttribute('data-count')) || 3;
      const title = node.getAttribute('data-title') || '';
      const root = createRoot(node);
      root.render(
        <QueryClientProvider client={queryClient}>
          <LatestEvents count={count} title={title} />
        </QueryClientProvider>,
      );
      roots.push(root);
    });
    el.querySelectorAll('[data-block="planning"]').forEach(node => {
      const slug = node.getAttribute('data-slug') || '';
      const root = createRoot(node);
      root.render(<QueryClientProvider client={queryClient}><PlanningEmbed slug={slug} /></QueryClientProvider>);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="glossaire"]').forEach(node => {
      const root = createRoot(node);
      root.render(<QueryClientProvider client={queryClient}><Glossary /></QueryClientProvider>);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="vm-configurator"]').forEach(node => {
      const root = createRoot(node);
      root.render(<VmConfigurator />);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="ad-configurator"]').forEach(node => {
      const root = createRoot(node);
      root.render(<AdConfigurator />);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="ad-bulk-configurator"]').forEach(node => {
      const root = createRoot(node);
      root.render(<AdBulkConfigurator />);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="net-diagnostic"]').forEach(node => {
      const root = createRoot(node);
      root.render(<NetDiagnostic />);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="subnet-trainer"]').forEach(node => {
      const root = createRoot(node);
      root.render(<SubnetTrainer />);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="agdlp-builder"]').forEach(node => {
      const root = createRoot(node);
      root.render(<AgdlpBuilder />);
      roots.push(root);
    });
    el.querySelectorAll('[data-block="note"]').forEach(node => {
      const noteId = Number(node.getAttribute('data-note-id')) || 0;
      const title = node.getAttribute('data-title') || '';
      const root = createRoot(node);
      root.render(
        <QueryClientProvider client={queryClient}>
          <PublicNoteBlock noteId={noteId} title={title} />
        </QueryClientProvider>,
      );
      roots.push(root);
    });
    // Démontage différé pour éviter un unmount synchrone pendant le rendu de React.
    return () => { roots.forEach(r => setTimeout(() => { try { r.unmount(); } catch { /* ignore */ } }, 0)); };
  }, [html]);

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
