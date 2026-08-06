import { useRef, useState } from 'react';

/**
 * Bouton « Télécharger en PDF » réutilisable pour n'importe quelle page/procédure.
 * Ouvre une vue d'impression propre (uniquement le contenu de l'article, styles réinjectés,
 * couleurs conservées, images résolues via <base>) dans une iframe cachée, puis lance
 * l'impression → l'utilisateur choisit « Enregistrer en PDF ». Fonctionne hors-ligne
 * (et dans l'app desktop Electron). Îlot hydraté via RichContent (data-block="pdf-download").
 */

// Feuille de style d'impression : variables (thème clair), typographie, encadrés pb-note,
// tableaux, code. Les styles d'étape (step-banner, proc-cmd…) voyagent déjà dans le contenu.
const PRINT_CSS = `
:root{--border:#d0d5dd;--surface:#ffffff;--surface-2:#f5f7fa;--surface-3:#eceff3;--text:#111827;--text-soft:#374151;--text-muted:#6b7280;--muted:#6b7280;--accent:#2563eb;--accent-light:#e8effd;--accent-soft:#eaf1fe}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{margin:15mm 14mm}
html,body{margin:0;padding:0}
body{font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--text);font-size:11.5pt;line-height:1.5;background:#fff;padding:0 2mm}
h1{font-size:22pt;margin:0 0 4pt;line-height:1.15}
h2{font-size:15pt;margin:20pt 0 6pt;padding-bottom:3pt;border-bottom:1px solid var(--border)}
h3{font-size:12.5pt;margin:12pt 0 4pt}
p{margin:6pt 0}
a{color:var(--accent);text-decoration:none}
ul,ol{margin:6pt 0;padding-left:20pt}
li{margin:3pt 0}
code,kbd{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:10.5pt;background:var(--surface-3);padding:1px 5px;border-radius:4px}
pre{white-space:pre-wrap;overflow:visible}
img{max-width:100%;height:auto}
table{border-collapse:collapse;width:100%;font-size:10.5pt;margin:6pt 0}
th,td{border:1px solid var(--border);padding:5pt 7pt;text-align:left;vertical-align:top}
th{background:var(--surface-2)}
figure{margin:8pt 0;text-align:center}
figcaption{font-size:9.5pt;color:var(--text-muted);margin-top:3pt}
/* Encadrés (repris de la feuille globale du site) */
.pb-note{margin:10pt 0;padding:9pt 12pt;border-radius:8px;border:1px solid var(--border);border-left:4px solid var(--accent);background:var(--surface-2);break-inside:avoid}
.pb-note-title{font-weight:700;margin:0 0 5pt}
.pb-note-yellow{border-left-color:#dba617;background:color-mix(in srgb,#dba617 10%,var(--surface))}
.pb-note-green{border-left-color:#00a32a;background:color-mix(in srgb,#00a32a 9%,var(--surface))}
.pb-note-blue{border-left-color:#2271b1;background:color-mix(in srgb,#2271b1 9%,var(--surface))}
.pb-note-pink{border-left-color:#db2777;background:color-mix(in srgb,#db2777 9%,var(--surface))}
.pb-note-purple{border-left-color:#7c3aed;background:color-mix(in srgb,#7c3aed 9%,var(--surface))}
.pb-note-orange{border-left-color:#d97706;background:color-mix(in srgb,#d97706 10%,var(--surface))}
.pb-note-gray{border-left-color:#6b7280;background:color-mix(in srgb,#6b7280 9%,var(--surface))}
/* Hero (bandeau de titre) : version imprimable compacte */
.hero{padding:0 0 6pt;margin:0 0 8pt;border-bottom:2px solid var(--accent)}
.hero .pill,.pill{display:inline-block;font-size:9pt;font-weight:600;color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:1px 9px;margin-bottom:4pt}
.hero h1{margin:2pt 0}
/* Éviter les coupures moches */
.step-banner,figure,tr{break-inside:avoid}
h2,h3{break-after:avoid}
/* Ne jamais imprimer les îlots interactifs ni le bouton PDF */
[data-block]{display:none}
/* …sauf le lecteur de pages : on imprime toutes ses pages, sans sa barre de navigation */
[data-block="doc-pager"]{display:block!important}
.dp-page{display:block!important;padding:0!important}
.wzp{border:0!important;margin:0!important}
.wzp-nav,.wzp-head{display:none!important}
.dp-break{display:none}
.proc-cmd{break-inside:avoid}
`;

export function PrintPdfButton({ title = '', label = 'Télécharger en PDF' }: { title?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const makePdf = () => {
    const article = ref.current?.closest('.rich') as HTMLElement | null;
    if (!article) { window.print(); return; }
    setBusy(true);
    const clone = article.cloneNode(true) as HTMLElement;
    // Retire les îlots interactifs (bouton PDF, entraîneurs, émulateur…) mais garde les <style>,
    // le contenu, et le lecteur de pages « doc-pager » (dont on imprime TOUTES les pages).
    clone.querySelectorAll('[data-block]:not([data-block="doc-pager"])').forEach(e => e.remove());
    // Force le chargement immédiat des images (sinon les images « lazy » restent blanches
    // dans une iframe hors-écran) et resout les URLs relatives en absolu.
    clone.querySelectorAll('img').forEach(img => {
      img.removeAttribute('loading'); img.setAttribute('decoding', 'sync');
      const src = img.getAttribute('src'); if (src) img.setAttribute('src', new URL(src, location.href).href);
    });
    const docTitle = (title || document.title || 'document').replace(/[<>]/g, '');

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // Hors-écran mais avec une taille réelle : indispensable pour que les images se chargent/décodent.
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;height:1160px;border:0;opacity:0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { setBusy(false); iframe.remove(); window.print(); return; }
    doc.open();
    doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><base href="${location.origin}/"><title>${docTitle}</title><style>${PRINT_CSS}</style></head><body>${clone.innerHTML}</body></html>`);
    doc.close();

    const go = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* */ }
      setTimeout(() => { iframe.remove(); setBusy(false); }, 1500);
    };
    // Laisse le temps aux images (uploads) de charger.
    const imgs = Array.from(doc.images);
    if (!imgs.length) { setTimeout(go, 250); return; }
    let left = imgs.length; let fired = false;
    const one = () => { if (--left <= 0 && !fired) { fired = true; go(); } };
    imgs.forEach(img => { if (img.complete) one(); else { img.addEventListener('load', one); img.addEventListener('error', one); } });
    setTimeout(() => { if (!fired) { fired = true; go(); } }, 2500); // filet de sécurité
  };

  return (
    <div ref={ref} style={{ margin: '10px 0 18px' }}>
      <button type="button" onClick={makePdf} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: '1px solid var(--accent)', borderRadius: 9, background: busy ? 'var(--surface-2)' : 'var(--accent)', color: busy ? 'var(--text-soft)' : '#fff', fontWeight: 700, fontSize: 13.5, cursor: busy ? 'default' : 'pointer' }}>
        <span style={{ fontSize: 15 }}>📄</span> {busy ? 'Préparation…' : label}
      </button>
      <span className="meta" style={{ fontSize: 11.5, marginLeft: 10 }}>→ dans la fenêtre d’impression, choisis « <strong>Enregistrer en PDF</strong> ».</span>
    </div>
  );
}
