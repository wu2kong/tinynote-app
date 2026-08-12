import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { Node } from '@milkdown/kit/prose/model';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

const pluginKey = new PluginKey('writer-list-continuation');

/** Decorate text after Shift+Enter (`hardbreak`) inside list items. */
function buildListContinuationDecorations(doc: Node): DecorationSet {
  const decorations: ReturnType<typeof Decoration.inline>[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== 'list_item') return;

    node.forEach((child, offset) => {
      if (child.type.name !== 'paragraph') return;

      const paragraphPos = pos + 1 + offset;
      let afterHardBreak = false;

      child.forEach((inline, inlineOffset) => {
        if (inline.type.name === 'hardbreak') {
          afterHardBreak = true;
          return;
        }
        if (!afterHardBreak || !inline.isText || !inline.text) return;

        const from = paragraphPos + 1 + inlineOffset;
        decorations.push(
          Decoration.inline(from, from + inline.nodeSize, {
            class: 'writer-list-continuation',
          }),
        );
      });
    });
  });

  return DecorationSet.create(doc, decorations);
}

export const writerListContinuationPlugin = $prose(
  () =>
    new Plugin({
      key: pluginKey,
      props: {
        decorations(state) {
          return buildListContinuationDecorations(state.doc);
        },
      },
    }),
);
