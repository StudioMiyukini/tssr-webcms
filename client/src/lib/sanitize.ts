/*
 * @id     tssr.webSanitize
 * @do     assainir_html
 * @role   securite
 * @layer  outil
 * @human  Assainit le HTML riche avant rendu (DOMPurify) : retire scripts et gestionnaires d'événements, ne garde que les iframes de confiance, force rel="noopener" sur les liens _blank.
 */
import DOMPurify from 'dompurify';

// Hôtes d'embed autorisés (le CMS insère des lecteurs YouTube/Vimeo).
const IFRAME_OK = /^https:\/\/(www\.)?(youtube-nocookie\.com|youtube\.com|player\.vimeo\.com)\//i;

let hooked = false;
function installHooks() {
  if (hooked) return;
  hooked = true;
  // Retire toute iframe dont la source n'est pas sur liste blanche.
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const src = (node as Element).getAttribute?.('src') || '';
      if (!IFRAME_OK.test(src)) node.parentNode?.removeChild(node);
    }
  });
  // Durcit les liens ouvrant un nouvel onglet contre le tabnabbing.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/** Nettoie une chaîne HTML pour un rendu sûr via dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string | null | undefined): string {
  installHooks();
  return DOMPurify.sanitize(html ?? '', {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'loading', 'target'],
    // Les attributs data-* (îlots data-block) et standards sont conservés par défaut.
  });
}
