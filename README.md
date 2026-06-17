# 🛠️ 在线工具箱

一个纯静态、轻量级的在线开发者工具箱，提供 50+ 常用编解码、文本处理、格式化、生成器、转换器等实用工具，开箱即用，无需后端服务。

## ✨ 特性

- **52 个实用工具** — 覆盖编码解码、哈希加密、文本处理、生成器、格式化、转换器、开发者参考、图片处理、网络工具、数学计算等 10 大分类
- **纯静态部署** — 构建产物为纯 HTML/CSS/JS，可部署到任意静态托管平台（EdgeOne Pages、GitHub Pages、Vercel、Netlify 等）
- **零服务端依赖** — 所有工具在浏览器本地运行，数据不上传服务器，保护隐私安全
- **响应式设计** — 完美适配桌面端和移动端
- **浅色主题** — 清爽简洁的界面设计，SVG 线条图标
- **即时搜索** — 支持按工具名称和描述快速搜索
- **分类导航** — 顶部横向分类标签，一键切换
- **一键复制** — 所有结果支持一键复制到剪贴板

## 🧰 工具列表

### 编码/解码（8 个）
Base64 编解码 · URL 编解码 · HTML 实体编解码 · Unicode 编解码 · Hex 编解码 · JWT 解析 · Base32 编解码 · Punycode 编解码

### 哈希/加密（5 个）
MD5 哈希 · SHA 哈希（SHA-1/256/512） · AES 加解密 · DES/3DES 加解密 · HMAC 生成

### 文本工具（10 个）
字符统计 · 文本对比 · 大小写转换 · 文本去重 · 文本排序 · 正则表达式测试 · 文本替换 · 转义工具 · Markdown 预览 · 文本加密

### 生成器（5 个）
UUID 生成 · 随机密码生成 · 随机数生成 · Lorem ipsum 生成 · 二维码生成

### 转换器（9 个）
时间戳转换 · 进制转换 · 颜色转换（HEX/RGB/HSL） · 单位转换 · JSON↔YAML · JSON↔XML · JSON↔CSV · CSV↔JSON · JSONPath 查询

### 格式化（5 个）
JSON 格式化 · CSS 格式化 · HTML 格式化 · SQL 格式化 · XML 格式化

### 开发者工具（4 个）
Cron 表达式解析 · HTTP 状态码查询 · User-Agent 解析 · 正则表达式速查表

### 图片工具（2 个）
图片转 Base64 · SVG 压缩

### 网络工具（2 个）
IP 地址信息查询 · 端口说明查询

### 数学计算（2 个）
科学计算器 · 大数计算器

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

访问 http://localhost:3000 预览。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录，可直接部署到静态托管平台。

## 📦 部署

### EdgeOne Pages

1. 执行 `npm run build` 构建项目
2. 将 `dist/` 目录上传到 EdgeOne Pages
3. 完成部署

### GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 在仓库 Settings → Pages 中选择 `dist` 分支或目录
3. 或使用 GitHub Actions 自动构建部署

### Vercel / Netlify

直接关联 Git 仓库，框架预设选择 Vite，构建命令 `npm run build`，输出目录 `dist`。

## 🛠️ 技术栈

- **构建工具**: Vite 6
- **语言**: 原生 JavaScript（ES Modules）
- **路由**: Hash 路由（`#/base64`）
- **样式**: 原生 CSS（CSS Variables 主题系统）
- **第三方库**:
  - [crypto-js](https://github.com/brix/crypto-js) — 哈希和加密算法
  - [qrcode](https://github.com/soldair/node-qrcode) — 二维码生成
  - [js-yaml](https://github.com/nodeca/js-yaml) — YAML 解析
  - [diff](https://github.com/kpdecker/jsdiff) — 文本对比
  - [marked](https://github.com/markedjs/marked) — Markdown 渲染

## 📁 项目结构

```
OnlineToolbox/
├── index.html                # 入口页面
├── package.json
├── vite.config.js            # Vite 配置
├── public/favicon.svg        # 网站图标
└── src/
    ├── main.js               # 入口 + 路由 + 渲染
    ├── router.js             # Hash 路由实现
    ├── icons.js              # SVG 图标集
    ├── styles/               # 样式文件
    │   ├── variables.css     # CSS 变量
    │   ├── base.css          # 全局样式
    │   ├── layout.css        # 布局样式
    │   └── tool.css          # 工具页样式
    ├── utils/                # 工具函数
    │   ├── dom.js            # DOM 辅助
    │   └── clipboard.js      # 剪贴板操作
    └── tools/                # 52 个工具
        ├── registry.js       # 工具注册表
        ├── encoding/         # 编码/解码
        ├── crypto/           # 哈希/加密
        ├── text/             # 文本工具
        ├── generator/        # 生成器
        ├── converter/        # 转换器
        ├── formatter/        # 格式化
        ├── devtool/          # 开发者工具
        ├── image/            # 图片工具
        ├── network/          # 网络工具
        └── math/             # 数学计算
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/my-tool`
3. 提交更改：`git commit -m 'feat: 添加 xxx 工具'`
4. 推送分支：`git push origin feature/my-tool`
5. 提交 Pull Request

### 添加新工具

1. 在对应的 `src/tools/` 分类目录下创建 `.js` 文件
2. 导出标准工具对象：

```js
import { createElement, createSection } from '../../utils/dom.js'

export default {
  id: 'my-tool',
  name: '工具名称',
  description: '工具描述',
  category: '分类ID',
  icon: 'icon-key',
  render(container) {
    // 渲染工具 UI
  }
}
```

3. 在 `src/tools/registry.js` 中导入并注册
4. 在 `src/icons.js` 中添加 SVG 图标（可选，可复用已有图标）

## 📄 开源协议

本项目基于 [MIT 协议](./LICENSE) 开源。
