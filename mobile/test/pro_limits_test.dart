import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/constants/app_store_iap.dart';
import 'package:tinynote_mobile/constants/pro.dart';
import 'package:tinynote_mobile/core/types.dart';

void main() {
  test('App Store product IDs match the Mac catalog', () {
    expect(appStoreProductIds, [
      'com.wu2kong.tinynote.app.pro.monthly',
      'com.wu2kong.tinynote.app.pro.yearly',
      'com.wu2kong.tinynote.app.pro.lifetime',
    ]);
    expect(isAppStoreProductId(appStoreLifetimeProductId), isTrue);
    expect(isAppStoreProductId('com.example.other'), isFalse);
  });

  test('article formats are markdown and writer only', () {
    expect(isArticleNotebookFormat(NotebookFormat.markdown), isTrue);
    expect(isArticleNotebookFormat(NotebookFormat.writer), isTrue);
    expect(isArticleNotebookFormat(NotebookFormat.blocks), isFalse);
    expect(isArticleNotebookFormat(NotebookFormat.unsupported), isFalse);
  });

  test('counts notebooks recursively and filters article formats', () {
    final space = Space(
      id: 'space',
      name: 'Work',
      path: '/notes/Work',
      groups: [
        NotebookItem(
          const Notebook(
            id: 'n1',
            name: 'Inbox',
            path: '/notes/Work/Inbox.blk.md',
            noteBlocks: [],
          ),
        ),
        GroupItem(
          Group(
            id: 'g1',
            name: 'Docs',
            path: '/notes/Work/Docs',
            notebookCount: 2,
            children: [
              NotebookItem(
                const Notebook(
                  id: 'n2',
                  name: 'Spec',
                  path: '/notes/Work/Docs/Spec.mk.md',
                  noteBlocks: [],
                  format: NotebookFormat.markdown,
                ),
              ),
              NotebookItem(
                const Notebook(
                  id: 'n3',
                  name: 'Essay',
                  path: '/notes/Work/Docs/Essay.writer.md',
                  noteBlocks: [],
                  format: NotebookFormat.writer,
                ),
              ),
            ],
          ),
        ),
      ],
    );

    expect(countSpaceNotebooks(space), 3);
    expect(collectSpaceArticleNotebooks(space), hasLength(2));
    expect(
      collectSpaceArticleNotebooks(space, format: NotebookFormat.markdown),
      hasLength(1),
    );
    expect(
      collectSpaceArticleNotebooks(space, format: NotebookFormat.writer).single.name,
      'Essay',
    );
  });
}
