const FORBIDDEN_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM',
  'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'TEMPLATE',
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href']);

function isSafeUrl(value: string, attr: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('.')) {
    return true;
  }
  if (attr === 'src' && /^data:image\//i.test(trimmed)) {
    return true;
  }
  try {
    const url = new URL(trimmed, 'https://tinynote.local');
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** Keep notebook HTML/CSS, strip scripts, event handlers, and dangerous URLs. */
export function sanitizePreviewHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (FORBIDDEN_TAGS.has(child.tagName)) {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
          child.removeAttribute(attr.name);
          continue;
        }
        if (URL_ATTRS.has(name) && !isSafeUrl(attr.value, name)) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}
