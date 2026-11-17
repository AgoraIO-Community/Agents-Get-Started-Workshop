const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'DIV', 'SPAN', 'HR', 'SECTION', 'DL', 'DT', 'DD']);
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON']);

export function sanitizeNotes(html, document) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  function clean(parent) {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1 || DROP_TAGS.has(child.tagName)) { child.remove(); continue; }
      clean(child);
      if (!ALLOWED_TAGS.has(child.tagName)) { child.replaceWith(...child.childNodes); continue; }
      const href = child.getAttribute('href');
      const cue = child.classList.contains('demo-script');
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (cue) child.className = 'demo-script';
      if (child.tagName === 'A' && href && /^(https?:\/\/|mailto:)/i.test(href.trim())) {
        child.setAttribute('href', href.trim());
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }
  clean(template.content);
  return template.content;
}

export function isPresenterSnapshot(value) {
  return Boolean(value && value.version === 1 && typeof value.slideId === 'string' && value.slideId.length <= 160 && typeof value.title === 'string' && value.title.length <= 1000
    && typeof value.notesHtml === 'string' && value.notesHtml.length <= 100000 && Number.isInteger(value.position) && value.position > 0
    && Number.isInteger(value.total) && value.total >= value.position && value.total <= 1000);
}
