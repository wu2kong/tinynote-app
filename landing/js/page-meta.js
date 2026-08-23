(function () {
  var catalog = window.TINYNOTE_LANDING_I18N = window.TINYNOTE_LANDING_I18N || { messages: {} };
  catalog.messages = catalog.messages || {};

  var titles = {
    'zh-Hans': ['更新日志', '服务条款', '隐私政策', '退款政策', '合作推广', '常见问题', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs 印象笔记', 'TinyNote vs Typora', 'TinyNote vs 苹果备忘录'],
    'zh-Hant': ['更新日誌', '服務條款', '隱私政策', '退款政策', '合作推廣', '常見問題', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    en: ['Changelog', 'Terms of Service', 'Privacy Policy', 'Refund Policy', 'Affiliate Program', 'Frequently Asked Questions', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    ja: ['更新履歴', '利用規約', 'プライバシーポリシー', '返金ポリシー', 'パートナープログラム', 'よくある質問', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    ko: ['업데이트 내역', '서비스 약관', '개인정보 처리방침', '환불 정책', '제휴 프로그램', '자주 묻는 질문', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    de: ['Änderungsprotokoll', 'Nutzungsbedingungen', 'Datenschutzrichtlinie', 'Rückerstattungsrichtlinie', 'Partnerprogramm', 'Häufig gestellte Fragen', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    fr: ['Journal des modifications', 'Conditions d’utilisation', 'Politique de confidentialité', 'Politique de remboursement', 'Programme partenaire', 'Questions fréquentes', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    it: ['Registro modifiche', 'Termini di servizio', 'Informativa sulla privacy', 'Politica di rimborso', 'Programma partner', 'Domande frequenti', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes'],
    ru: ['Журнал изменений', 'Условия обслуживания', 'Политика конфиденциальности', 'Политика возврата', 'Партнёрская программа', 'Частые вопросы', 'TinyNote vs Notion', 'TinyNote vs Obsidian', 'TinyNote vs Evernote', 'TinyNote vs Typora', 'TinyNote vs Apple Notes']
  };
  var pageIds = ['changelog', 'terms', 'privacy', 'refund', 'affiliate', 'faq', 'vs-notion', 'vs-obsidian', 'vs-evernote', 'vs-typora', 'vs-apple-notes'];
  var descriptions = {
    'zh-Hans': 'TinyNote 轻记的官方产品信息、政策说明与使用指南。',
    'zh-Hant': 'TinyNote 輕記的官方產品資訊、政策說明與使用指南。',
    en: 'Official TinyNote product information, policies, guides, and comparisons.',
    ja: 'TinyNote の公式製品情報、ポリシー、ガイド、比較記事。',
    ko: 'TinyNote 공식 제품 정보, 정책, 가이드 및 비교 자료입니다.',
    de: 'Offizielle Produktinformationen, Richtlinien, Anleitungen und Vergleiche zu TinyNote.',
    fr: 'Informations officielles, politiques, guides et comparatifs TinyNote.',
    it: 'Informazioni ufficiali, politiche, guide e confronti di TinyNote.',
    ru: 'Официальная информация TinyNote, правила, руководства и сравнения.'
  };

  Object.keys(titles).forEach(function (locale) {
    var messages = catalog.messages[locale] = catalog.messages[locale] || {};
    pageIds.forEach(function (pageId, index) {
      messages[pageId + '.meta.title'] = titles[locale][index] + ' — TinyNote';
      messages[pageId + '.meta.description'] = descriptions[locale];
    });
  });
})();
