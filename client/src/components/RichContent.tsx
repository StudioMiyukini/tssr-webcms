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
import type { PostsMode } from '@/lib/page-blocks';

/**
 * Rend du HTML (contenu de page/article) et hydrate les blocs dynamiques (îlots React)
 * marqués par data-block, ex. le bloc « derniers articles ».
 */
export function RichContent({ html, className = 'rich' }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
