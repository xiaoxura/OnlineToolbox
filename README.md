# 🛠️ 在线工具箱

一个纯静态、轻量级的在线开发者工具箱，提供 86 个常用编解码、文本处理、格式化、生成器、转换器等实用工具。无需账号或后端服务，绝大多数数据只在浏览器本地处理。

## ✨ 特性

- **86 个实用工具** — 覆盖编码解码、哈希加密、文本处理、生成器、格式化、转换器、开发者参考、图片处理、网络工具、数学计算等 10 大分类
- **工具按需加载** — 首页只加载工具元数据，进入工具后再下载对应实现及依赖，降低首屏 JS 体积
- **纯静态部署** — 构建产物可部署到 EdgeOne Pages、GitHub Pages、Vercel、Netlify 等静态托管平台
- **本地优先与隐私提示** — 绝大多数功能完全在本地运行；IP 查询仅在用户主动点击后请求第三方服务
- **SEO 友好** — 构建时为每个工具生成独立静态落地页，并生成 `sitemap.xml` 与 `robots.txt`
- **深浅色主题** — 支持手动切换、偏好持久化及跟随系统主题
- **响应式与无障碍** — 适配桌面端和移动端，提供语义化结构、表单标签、键盘操作和焦点样式
- **即时搜索与分类导航** — 支持按工具名称、描述及分类快速筛选
- **一键复制** — 常用结果支持复制到剪贴板

## 🧰 工具列表

### 编码/解码（9 个）
Base64 编解码 · URL 编解码 · HTML 实体编解码 · Unicode 编解码 · Hex 编解码 · JWT 解析 · Base32 编解码 · Base58 编解码 · Punycode 编解码

### 哈希/加密（6 个）
MD5 哈希 · SHA 哈希（SHA-1/256/512） · AES 加解密 · DES/3DES 加解密 · HMAC 生成 · 文件哈希计算

### 文本工具（11 个）
字符统计 · 文本对比 · 大小写转换 · 文本去重 · 文本排序 · 正则表达式测试 · 文本替换 · 转义工具 · Markdown 预览 · 文本加密 · 文本集合运算

### 生成器（9 个）
UUID 生成 · 随机密码生成 · 随机数生成 · Lorem ipsum 生成 · 二维码生成 · 占位图生成 · CSS 渐变生成器 · CSS 阴影生成器 · 调色板生成

### 转换器（18 个）
时间戳转换 · 进制转换 · 颜色转换 · 单位转换 · JSON↔YAML · JSON↔XML · JSON 转 CSV · CSV 转 JSON · JSONPath 查询 · Markdown 转 HTML · HTML 转 JSX · CSS 转 JS 对象 · JSON 对比 · 时区转换 · 日期计算器 · 中文大写金额 · 正则表达式可视化 · JSON 转 TypeScript

### 格式化（5 个）
JSON 格式化 · CSS 格式化 · HTML 格式化 · SQL 格式化 · XML 格式化

### 开发者工具（15 个）
Cron 表达式解析 · HTTP 状态码查询 · User-Agent 解析 · 正则表达式速查表 · CSS 单位转换 · JSON Schema 生成 · Mock 数据生成 · Git 命令速查 · Linux 命令速查 · 身份证号校验 · 银行卡号校验 · 统一社会信用代码校验 · 格式校验工具 · chmod 权限计算器 · SQL IN 参数生成

### 图片工具（3 个）
图片转 Base64 · SVG 压缩 · 图片压缩与格式转换

### 网络工具（8 个）
IP 地址信息查询 · 端口说明查询 · URL 解析器 · HTTP Headers 解析 · Cookie 查看器 · IPv4/CIDR 计算器 · CURL 命令生成器 · URL 参数编辑器

### 数学计算（2 个）
科学计算器 · 大数计算器

## 🚀 快速开始

### 环境要求

- Node.js >= 20.19 或 >= 22.12
- npm >= 9

### 安装与开发

```bash
npm install
npm run dev
```

访问 <http://localhost:3000> 预览。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/`。除 Vite 应用资源外，构建脚本还会生成：

- `dist/tools/{tool-id}/index.html`：86 个工具的独立 SEO 落地页
- `dist/sitemap.xml`：首页及全部工具页的网站地图
- `dist/robots.txt`：爬虫规则和网站地图地址

默认站点地址为 `https://xiaoxura.github.io/OnlineToolbox/`。部署到其他域名时，请通过 `SITE_URL` 传入包含部署子路径的完整公开地址：

```bash
SITE_URL=https://example.com/ npm run build
# 子目录部署示例：SITE_URL=https://example.com/toolbox/ npm run build
```

该地址会用于 canonical、Open Graph、Schema.org、sitemap 和 robots 元数据。

### 代码检查与测试

```bash
npm run lint        # ESLint 静态检查
npm test            # Vitest 单次测试
npm run test:watch  # Vitest 监听模式
npm run check       # 依次执行 lint、测试和生产构建
```

测试覆盖工具注册表、全部 86 个工具的渲染冒烟测试、表单可访问名称、核心工具行为、Markdown XSS 防护、路由懒加载和主题偏好持久化。

## 🔒 隐私与联网说明

除 IP 地址信息查询外，工具输入默认只在当前浏览器内处理，不会上传到项目服务器。

IP 查询采用用户主动触发、超时取消和失败回退机制：

- 公网 IP：优先 `api64.ipify.org`，失败后回退到 `api.ipify.org`
- IP 地理信息：优先 `ipapi.co`，失败后回退到 `ipwho.is`

使用 IP 查询即表示浏览器会直接请求相应第三方服务，相关数据处理受第三方服务隐私政策约束。

## 📦 部署

### EdgeOne Pages

1. 设置正确的 `SITE_URL` 并执行 `npm run build`
2. 将 `dist/` 目录上传到 EdgeOne Pages
3. 完成部署

### GitHub Pages

项目默认 SEO 地址已适配 `https://xiaoxura.github.io/OnlineToolbox/`。运行 `npm run build` 后部署 `dist/`，也可使用 GitHub Actions 自动构建和发布。

### Vercel / Netlify

关联 Git 仓库，框架预设选择 Vite，构建命令设为 `npm run build`，输出目录设为 `dist`，并配置生产环境变量 `SITE_URL`。

## 🛠️ 技术栈

- **构建工具**：Vite 8
- **语言**：原生 JavaScript（ES Modules）
- **路由**：Hash 路由（如 `#/base64`）
- **样式**：原生 CSS、CSS Variables 深浅色主题
- **代码质量**：ESLint 9
- **测试**：Vitest、jsdom
- **安全渲染**：DOMPurify
- **功能依赖**：crypto-js、qrcode、js-yaml、diff、marked

## 📁 项目结构

```text
OnlineToolbox/
├── index.html                    # SPA 入口与基础 SEO 元数据
├── package.json
├── vite.config.js                # Vite 配置
├── vitest.config.js              # Vitest 配置
├── eslint.config.js              # ESLint 配置
├── public/
│   ├── favicon.svg               # 网站图标
│   └── site.webmanifest          # Web App Manifest
├── scripts/
│   └── generate-seo-pages.mjs    # SEO 页面、sitemap、robots 生成脚本
├── tests/                        # 注册表、冒烟、安全、路由及核心行为测试
└── src/
    ├── main.js                   # 入口、异步工具加载与页面渲染
    ├── router.js                 # Hash 路由实现
    ├── icons.js                  # SVG 图标集
    ├── styles/                   # 全局、布局、工具及主题样式
    ├── utils/
    │   ├── dom.js                # DOM、Tab 和无障碍辅助
    │   └── clipboard.js          # 剪贴板操作
    └── tools/
        ├── registry.js           # 轻量元数据与动态 import 注册表
        ├── encoding/
        ├── crypto/
        ├── text/
        ├── generator/
        ├── converter/
        ├── formatter/
        ├── devtool/
        ├── image/
        ├── network/
        └── math/
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

### 添加新工具

1. 在对应的 `src/tools/` 分类目录下创建 `.js` 文件并默认导出工具对象。
2. 在 `src/tools/registry.js` 添加工具的轻量元数据，以及指向实现文件的动态 `import()`。
3. 如需新图标，在 `src/icons.js` 添加 SVG 图标；也可以复用现有图标。
4. 运行 `npm run check`，确认静态检查、86+ 工具测试和生产构建均通过。

注册表示例：

```js
{
  id: 'my-tool',
  name: '工具名称',
  description: '工具描述',
  category: 'converter',
  icon: 'my-tool',
  load: () => import('./converter/my-tool.js')
}
```

工具模块示例：

```js
export default {
  id: 'my-tool',
  name: '工具名称',
  description: '工具描述',
  category: 'converter',
  icon: 'my-tool',
  render(container) {
    // 渲染工具 UI
  }
}
```

## 📄 开源协议

本项目基于 [MIT 协议](./LICENSE) 开源。
