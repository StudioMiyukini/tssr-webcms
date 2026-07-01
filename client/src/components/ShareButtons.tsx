import { useState } from 'react';

/** Boutons de partage social (utilise l'URL courante). */
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'WhatsApp', href: `https://wa.me/?text=${t}%20${u}` },
  ];
  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div className="share">
      <span className="meta">Partager :</span>
      {links.map(l => <a key={l.label} className="share-btn" href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
      <button type="button" className="share-btn" onClick={copy}>{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
    </div>
  );
}
