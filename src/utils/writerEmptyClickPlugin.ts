import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

const pluginKey = new PluginKey('writer-empty-click');

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        '.cm-editor',
        '.milkdown-code-block',
        'button',
        'input',
        'select',
        'textarea',
        'a',
        'label',
        '[contenteditable="false"]',
      ].join(','),
    ),
  );
}

function isClickBelowContent(view: EditorView, clientY: number): boolean {
  const last = view.dom.lastElementChild;
  if (!(last instanceof HTMLElement)) return true;
  return clientY > last.getBoundingClientRect().bottom + 1;
}

function focusAtDocumentEnd(view: EditorView): void {
  const selection = TextSelection.atEnd(view.state.doc);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
}

/**
 * Clicking the empty area below article content (or the editor chrome outside
 * ProseMirror) should place the caret at the end of the document — especially
 * important for newly created notes that are mostly blank.
 */
export const writerEmptyClickPlugin = $prose(
  () =>
    new Plugin({
      key: pluginKey,
      props: {
        handleDOMEvents: {
          mousedown(view, event) {
            if (event.button !== 0 || isInteractiveTarget(event.target)) return false;

            const onRoot = event.target === view.dom;
            const below = isClickBelowContent(view, event.clientY);
            if (!onRoot && !below) return false;

            const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (onRoot || hit == null || below) {
              focusAtDocumentEnd(view);
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
            return false;
          },
        },
      },
      view(editorView) {
        const container =
          editorView.dom.closest('.writer-notebook-body')
          ?? editorView.dom.parentElement;

        const onContainerMouseDown = (event: Event) => {
          const mouseEvent = event as MouseEvent;
          if (mouseEvent.button !== 0 || isInteractiveTarget(mouseEvent.target)) return;
          const target = mouseEvent.target;
          if (!(target instanceof Node)) return;

          // Inside ProseMirror content: handled by handleDOMEvents / ProseMirror.
          if (editorView.dom.contains(target)) return;

          focusAtDocumentEnd(editorView);
          mouseEvent.preventDefault();
        };

        container?.addEventListener('mousedown', onContainerMouseDown);
        return {
          destroy() {
            container?.removeEventListener('mousedown', onContainerMouseDown);
          },
        };
      },
    }),
);
