#!/usr/bin/env bash

# 本地开发启动
local-rundev:
	codegraph sync
	bun run tauri dev

# 修复本地依赖
fix-local:
	bun install

# 预览落地页
landing-preview:
	npx serve landing

# 将landing页面上传到服务器
deploy-landing:
	npm run docs:build
# scp -r landing lihao@100.66.1.4:/Users/lihao/var/www/tinynote-app/
	scp -r landing lihao-macmini.local:/Users/lihao/var/www/tinynote-app/
# 	scp -r landing lihao-macmini.link:/Users/lihao/var/www/tinynote-app/
one-click-deploy-landing: deploy-landing
