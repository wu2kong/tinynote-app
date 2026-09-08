import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { isExternalHref, openExternalLink } from '@/utils/openExternalLink';

const pluginKey = new PluginKey('writer-link-open');

function hrefFromPreview(preview: Element): string | null {
  const href = preview.querySelector('a[href]')?.getAttribute('href')?.trim() ?? '';
  return isExternalHref(href) ? href : null;
}

function hrefFromEditorEvent(event: Event): string | null {
  if (!(event.target instanceof Element)) return null;
  const anchor = event.target.closest('a[href]');
  if (!anchor) return null;
  const href = anchor.getAttribute('href')?.trim() ?? '';
  return isExternalHref(href) ? href : null;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.button === 1 || event.metaKey || event.ctrlKey;
}

function isPreviewOpenTarget(target: Element): boolean {
  if (target.closest('.link-edit-button, .link-remove-button')) return false;
  return Boolean(target.closest('a[href], .link-display, .link-icon'));
}

/**
 * Crepe's link bubble uses `<a target="_blank">`, which Tauri does not open
 * in the system browser. Intercept those clicks (and cmd/ctrl/middle-click
 * on in-document links) and route them through the opener plugin.
 */
export const writerLinkOpenPlugin = $prose(
  () =>
    new Plugin({
      key: pluginKey,
      props: {
        handleDOMEvents: {
          click(_view, event) {
            if (event.target instanceof Element && event.target.closest('.milkdown-link-preview')) {
              return false;
            }
            const href = hrefFromEditorEvent(event);
            if (!href || !isModifiedClick(event)) return false;
            event.preventDefault();
            void openExternalLink(href);
            return true;
          },
          auxclick(_view, event) {
            if (event.button !== 1) return false;
            if (event.target instanceof Element && event.target.closest('.milkdown-link-preview')) {
              return false;
            }
            const href = hrefFromEditorEvent(event);
            if (!href) return false;
            event.preventDefault();
            void openExternalLink(href);
            return true;
          },
        },
      },
      view(editorView) {
        const root = editorView.dom.closest('.writer-notebook-body') ?? document;

        const onPreviewClick = (event: MouseEvent) => {
          if (!(event.target instanceof Element)) return;
          const preview = event.target.closest('.milkdown-link-preview');
          if (!preview || !isPreviewOpenTarget(event.target)) return;
          const href = hrefFromPreview(preview);
          if (!href) return;
          event.preventDefault();
          event.stopPropagation();
          void openExternalLink(href);
        };

        root.addEventListener('click', onPreviewClick as EventListener, true);
        root.addEventListener('auxclick', onPreviewClick as EventListener, true);
        return {
          destroy() {
            root.removeEventListener('click', onPreviewClick as EventListener, true);
            root.removeEventListener('auxclick', onPreviewClick as EventListener, true);
          },
        };
      },
    }),
);
