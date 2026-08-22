import { defineConfig } from 'vitepress'

const GITHUB_REPO = 'https://github.com/wu2kong/tinynote-app'
const DOWNLOAD = 'https://tinynote.wu2kong.com/download.html'
const HOMEPAGE = 'https://tinynote.wu2kong.com/'
const SITE_URL = 'https://tinynote.wu2kong.com'
const BASE = '/docs/'

export default defineConfig({
  title: 'TinyNote 轻记帮助文档',
  titleTemplate: ':title | TinyNote 轻记',
  description: 'TinyNote 轻记帮助文档：安装、组织笔记、同步备份与高级功能说明。',
  base: BASE,
  outDir: '../landing/docs',
  srcExclude: ['README.md'],
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: `${BASE}favicon.png` }],
    ['meta', { name: 'theme-color', content: '#3d8fd4' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'TinyNote 轻记' }],
    ['meta', { property: 'og:image', content: `${BASE}icon.png` }],
  ],
  transformHead({ page }) {
    if (!page || page === '404.md') return
    const route = page.replace(/\.md$/, '').replace(/\/index$/, '')
    const canonical = `${SITE_URL}${BASE}${route}`
    const isEnglish = route.startsWith('en/')
    const localizedRoute = isEnglish ? route.slice(3) : route
    const chineseUrl = `${SITE_URL}${BASE}${localizedRoute}`
    const englishUrl = `${SITE_URL}${BASE}en/${localizedRoute}`
    return [
      ['link', { rel: 'canonical', href: canonical }],
      ['meta', { property: 'og:url', content: canonical }],
      ['link', { rel: 'alternate', hreflang: 'zh-CN', href: chineseUrl }],
      ['link', { rel: 'alternate', hreflang: 'en', href: englishUrl }],
      ['link', { rel: 'alternate', hreflang: 'x-default', href: chineseUrl }],
    ]
  },
  themeConfig: {
    logo: { src: '/favicon.png', alt: 'TinyNote' },
    logoLink: '/docs/app',
    search: {
      provider: 'local',
      options: {
        detailedView: false,
        translations: {
          button: { buttonText: 'Search', buttonAriaLabel: 'Search documentation' },
          modal: {
            noResultsText: 'No results found',
            resetButtonTitle: 'Clear search',
            backButtonTitle: 'Close search',
            footer: { selectText: 'to select', navigateText: 'to navigate', closeText: 'to close' },
          },
        },
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '没有找到相关结果',
                resetButtonTitle: '清空搜索',
                backButtonTitle: '关闭搜索',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
        },
      },
    },
    externalLinkIcon: true,
    socialLinks: [{ icon: 'github', link: GITHUB_REPO }],
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      description: 'TinyNote 轻记帮助中心：安装、组织笔记、同步备份与高级功能说明。',
      themeConfig: {
        nav: [
          { text: '快速上手', link: '/quickstart' },
          { text: '设置手册', link: '/settings' },
          { text: '下载', link: DOWNLOAD },
          { text: '产品主页', link: HOMEPAGE },
        ],
        outline: { level: [2, 3], label: '本页目录' },
        sidebar: [
          { text: '应用概述', link: '/app' },
          {
            text: '快速上手',
            link: '/quickstart',
            items: [
              { text: '下载安装', link: '/quickstart#下载安装' },
              { text: '首次启动', link: '/quickstart#首次启动' },
              { text: '创建第一条笔记', link: '/quickstart#创建第一条笔记' },
            ],
          },
          {
            text: '使用指南',
            collapsed: false,
            items: [
              { text: '组织与笔记', link: '/organize' },
              { text: '导入与导出', link: '/import-export' },
              { text: '设置手册', link: '/settings' },
              { text: 'Git 同步', link: '/sync' },
              { text: '本地备份', link: '/backup' },
              { text: 'AI 问答', link: '/ai' },
              { text: '高级版', link: '/pro' },
            ],
          },
          {
            text: '对比评测',
            collapsed: false,
            items: [
              { text: 'vs Notion', link: '/vs-notion' },
              { text: 'vs Obsidian', link: '/vs-obsidian' },
              { text: 'vs 印象笔记', link: '/vs-evernote' },
              { text: 'vs Typora', link: '/vs-typora' },
              { text: 'vs 苹果备忘录', link: '/vs-apple-notes' },
            ],
          },
          { text: '常见问题', link: '/faq' },
          { text: '更新日志', link: '/changelog' },
        ],
        editLink: {
          pattern: `${GITHUB_REPO}/edit/main/docs-site/:path`,
          text: '在 GitHub 上编辑此页',
        },
        lastUpdated: {
          text: '最后更新',
          formatOptions: { dateStyle: 'medium', timeStyle: 'short' },
        },
        docFooter: { prev: '上一页', next: '下一页' },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
        skipToContentLabel: '跳转到正文',
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2026-present 悟二空',
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      description: 'TinyNote help center: install, organize notes, sync, backup, and Pro features.',
      themeConfig: {
        logoLink: '/docs/en/app',
        nav: [
          { text: 'Quick Start', link: '/en/quickstart' },
          { text: 'Settings', link: '/en/settings' },
          { text: 'Download', link: DOWNLOAD },
          { text: 'Website', link: HOMEPAGE },
        ],
        outline: { level: [2, 3], label: 'On this page' },
        sidebar: [
          { text: 'Overview', link: '/en/app' },
          {
            text: 'Quick Start',
            link: '/en/quickstart',
            items: [
              { text: 'Install', link: '/en/quickstart#install' },
              { text: 'First launch', link: '/en/quickstart#first-launch' },
              { text: 'Create a note', link: '/en/quickstart#create-your-first-note' },
            ],
          },
          {
            text: 'Guides',
            collapsed: false,
            items: [
              { text: 'Organize notes', link: '/en/organize' },
              { text: 'Import and export', link: '/en/import-export' },
              { text: 'Settings', link: '/en/settings' },
              { text: 'Git sync', link: '/en/sync' },
              { text: 'Backup', link: '/en/backup' },
              { text: 'AI chat', link: '/en/ai' },
              { text: 'Pro', link: '/en/pro' },
            ],
          },
          {
            text: 'Comparisons',
            collapsed: false,
            items: [
              { text: 'vs Notion', link: '/en/vs-notion' },
              { text: 'vs Obsidian', link: '/en/vs-obsidian' },
              { text: 'vs Evernote', link: '/en/vs-evernote' },
              { text: 'vs Typora', link: '/en/vs-typora' },
              { text: 'vs Apple Notes', link: '/en/vs-apple-notes' },
            ],
          },
          { text: 'FAQ', link: '/en/faq' },
          { text: 'Changelog', link: '/en/changelog' },
        ],
        editLink: {
          pattern: `${GITHUB_REPO}/edit/main/docs-site/:path`,
          text: 'Edit this page on GitHub',
        },
        lastUpdated: {
          text: 'Last updated',
          formatOptions: { dateStyle: 'medium', timeStyle: 'short' },
        },
        docFooter: { prev: 'Previous page', next: 'Next page' },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2026-present wu2kong',
        },
      },
    },
  },
})
