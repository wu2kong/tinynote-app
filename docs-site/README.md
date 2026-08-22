# TinyNote 帮助中心

基于 [VitePress](https://vitepress.dev/) 的文档站。构建结果输出到官网目录 `landing/docs/`，入口为：

- https://tinynote.wu2kong.com/docs/app

没有单独的 `/docs/` 首页；站点图标也指向 `/docs/app`。

## 本地预览

在仓库根目录：

```bash
npm run docs:dev
```

打开终端提示的地址，直接访问 `/docs/app`。

## 构建到官网目录

```bash
npm run docs:build
```

会把静态文件写到 `landing/docs/`。之后按原方式部署整个 `landing/` 目录即可，不必单独部署帮助中心。

`landing/docs` 是生成目录，不要手改；请改 `docs-site/` 里的 Markdown 后再构建。

预览构建结果：

```bash
npm run docs:preview
```

## 服务器注意

`cleanUrls` 已开启，链接是 `/docs/app` 而不是 `/docs/app.html`。

- Cloudflare Pages / GitHub Pages：一般会自动把无后缀 URL 指到对应 `.html`
- Apache：构建时会带上 `landing/docs/.htaccess`
- Caddy 2：在站点块里用 `try_files`（写在 `file_server` 前面）：

```caddy
tinynote.wu2kong.com {
	root * /var/www/tinynote
	encode gzip zstd

	@docsRoot path /docs /docs/
	redir @docsRoot /docs/app 302

	@docsEnRoot path /docs/en /docs/en/
	redir @docsEnRoot /docs/en/app 302

	@docs path /docs/*
	handle @docs {
		try_files {path} {path}.html {path}/ /docs/404.html
		file_server
	}

	handle {
		file_server
	}
}
```

把 `/var/www/tinynote` 换成服务器上 `landing/` 的实际路径。改完后执行 `caddy reload` 或 `systemctl reload caddy`。

- Nginx 需要类似：

```nginx
location = /docs {
  return 302 /docs/app;
}
location = /docs/ {
  return 302 /docs/app;
}
location /docs/ {
  try_files $uri $uri.html $uri/ =404;
}
```

## 文档结构

| 文件 | 线上路径 |
| --- | --- |
| `app.md` | `/docs/app`（入口） |
| `quickstart.md` | `/docs/quickstart` |
| `organize.md` | `/docs/organize` |
| `import-export.md` | `/docs/import-export` |
| `settings.md` | `/docs/settings` |
| `vs-*.md` | `/docs/vs-notion` 等对比文 |
| `sync.md` / `backup.md` | `/docs/sync`、`/docs/backup` |
| `ai.md` / `pro.md` | `/docs/ai`、`/docs/pro` |
| `faq.md` / `changelog.md` | `/docs/faq`、`/docs/changelog` |
| `en/` | `/docs/en/` |
