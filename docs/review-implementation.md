# review.md 落地记录

本文件记录 `review.md` 中每一项的落地方式、涉及文件与已评估但暂缓的事项。
当前基线：**180 个工具 / 11 个分类**；lint、单测、覆盖率、构建、E2E 全部通过。

## 一、P0

| 项 | 落地 |
| --- | --- |
| SW 运行时缓存从不清理 | `scripts/build-sw.mjs` 在每次构建后把构建哈希注入 `dist/sw.js`，并生成 `dist/asset-manifest.json`。缓存名带哈希；`activate` 保留当前与上一版本（避免部署时仍打开的旧页面加载不到旧 chunk），清理更旧缓存，并按清单清理当前版本中的过期 `/assets/*` 条目。新 Worker 接管时页面自动刷新一次。 |
| 离线只能用打开过的工具 | Worker `activate` 后以 4 个并发在后台预缓存清单中所有 ≤512 KB 的 chunk（大词典、Prettier/Terser 等按需下载），`Save-Data` 时跳过。E2E 覆盖“未访问过的 YAML 工具离线打开”。 |
| 刷新/跳转后输入丢失 | `src/app/draft.js` 按工具 id 写入 `sessionStorage`，400 ms 防抖 + `pagehide` 兜底；恢复时提示“已恢复上次输入”并可一键清除。密码、JWT、AES、助记词等 13 个敏感工具默认关闭。 |
| 文件哈希读入整文件 | `src/utils/hash.js` 使用 `@noble/hashes` 增量 API 按 4 MB 分块计算；`src/tools/crypto/file-hash.worker.js` 在 Worker 中处理 >8 MB 文件，带进度条；新增 MD5。 |

## 二、P1

- **Web Worker**：`src/utils/worker.js` 提供通用 `runInWorker()`；bcrypt、Token 计数、图片压缩、大型 JSON 对比均改为 Worker（各自有降级路径）。
- **拼音搜索**：`scripts/generate-search-index.mjs` 构建期用 `pinyin-pro` 生成全拼/首字母索引（`src/tools/search-index.js`），运行时不引入拼音依赖。`sjc` → 时间戳、`zhengze` → 正则；完全匹配不到时用编辑距离（1–2）给出拼写纠错建议。
- **全局命令面板**：`src/app/command-palette.js` + `src/app/tool-picker.js`，任意页面 Ctrl/⌘+K 打开浮层，支持方向键、Enter、Esc、拼音与模糊搜索。
- **相关工具**：`registry.js` 增加 `RELATED` 手工映射与关键词重合度回退，JSON 格式化不再推荐 CSS 格式化。
- **工具串联**：结果工具栏新增“发送到其他工具”，通过 `src/app/handoff.js` 把输出写入 `sessionStorage`，目标工具挂载后自动填入第一个文本输入框。
- **图标重复**：`src/icons.js` 新增 27 个专用图标；`json` 从 15 次降到 7 次、`search` 从 14 次降到 1 次，并重映射 24 个工具。

## 三、P2

- **重复工具明确区分**：UUID、正则、Markdown、AES/文本加密、Cron、图片 Base64/Data URL 的描述互相指路，并加入相关工具映射；保留原有路由，避免破坏书签与 SEO。
- **cookie-viewer 重做**：改为 Cookie / Set-Cookie 字符串解析器，支持 Expires 中的逗号、属性、多行 Set-Cookie、`document.cookie` 读取。
- **格式化器**：`src/utils/format.js` 懒加载 Prettier（HTML/CSS）与 sql-formatter（SQL，5 种方言）；失败时回退到原有容错实现。XML 仍为手写，因为 Prettier 没有 XML parser。
- **移除 crypto-js**：MD5/SHA/HMAC/UUID/htpasswd 改用 `@noble/hashes`；AES 改用 `@noble/ciphers`；DES/3DES 自研（`src/utils/des.js`，已用标准向量与 crypto-js 交叉验证）；文本加密保留 OpenSSL `Salted__` 兼容格式（`src/utils/openssl-aes.js`）。
- **价格数据日期**：`llm-models`、`llm-cost`、`embedding-cost` 页面显示数据日期；`scripts/check-data-freshness.mjs` 在 CI 中检查，>60 天警告、>90 天失败。
- **依赖更新**：marked 18.1.2、papaparse 5.7.0、otpauth 9.5.2、gpt-tokenizer 4.1.0 已升级。
- **测试提速**：Vitest 使用 `pool: 'threads'`。未采用 `vmThreads`（当前 Vitest/jsdom 组合下 WebCrypto 与 CJS 默认导出会失效），也未开启 `isolate: false`（跨文件会残留路由监听与存储状态）。

### 已评估但暂缓

- **js-yaml 5**：升级后不再提供默认导出，且 `YAMLException` 的行列信息变化，会影响 `json-yaml`、`docker-compose-converter` 与 YAML 工具的错误提示。需要同时改 3 处导入与相关断言，收益有限，暂保持 `^4.2.0`。
- **ESLint 10**：需要同步升级 `@eslint/js` 并复核 flat config/插件兼容性；ESLint 9 仍在维护，暂缓。

## 四、新增工具（23 个）

| 分类 | 工具 | 文件 |
| --- | --- | --- |
| formatter | JavaScript / TypeScript 格式化 | `src/tools/formatter/javascript.js` |
| formatter | YAML 格式化与校验 | `src/tools/formatter/yaml.js` |
| formatter | TOML 格式化与校验 | `src/tools/formatter/toml.js` |
| devtool | Nginx 配置生成器 | `src/tools/devtool/nginx-config.js` |
| devtool | crontab ↔ systemd 定时器 | `src/tools/devtool/crontab-systemd.js` |
| devtool | JSON Schema 校验 | `src/tools/devtool/json-schema-validator.js` |
| devtool | Open Graph 标签生成 | `src/tools/devtool/og-meta.js` |
| crypto | X.509 证书解析 | `src/tools/crypto/x509.js` |
| image | 二维码识别 | `src/tools/image/qr-scanner.js` |
| image | 图片裁剪、旋转与水印 | `src/tools/image/image-editor.js` |
| image | 图片取色与主色调 | `src/tools/image/image-palette.js` |
| image | SVG 转 PNG / JSX / Data URI | `src/tools/image/svg-converter.js` |
| converter | SQL ↔ JSON / CSV | `src/tools/converter/sql-json.js` |
| converter | CSV / JSON 表格查看器 | `src/tools/converter/data-table.js` |
| text | UTF-8 字节截断 | `src/tools/text/byte-truncate.js` |
| text | 简繁转换 | `src/tools/text/zh-convert.js` |
| text | 中文转拼音 | `src/tools/text/pinyin.js` |
| generator | Cubic Bezier 缓动编辑器 | `src/tools/generator/cubic-bezier.js` |
| generator | CSS clamp() 字号生成 | `src/tools/generator/clamp-generator.js` |
| ai | Embedding 维度与成本 | `src/tools/ai/embedding-cost.js` |
| ai | 上下文窗口可视化 | `src/tools/ai/context-window.js` |
| ai | SSE 流式响应解析 | `src/tools/ai/sse-parser.js` |
| ai | System Prompt 安全检查 | `src/tools/ai/prompt-security.js` |

每个工具都有独立的纯函数测试与 DOM 交互测试，见 `tests/new-tools-review-{a..e}.test.js`。

## 五、验证

```bash
npm run lint
npm run readme:check
npm run search:index:check
npm run data:check
npm run test:coverage
npm run build
npm run test:e2e
```

`npm run check` 已把前五项串起来；`npm run build` 会执行 SW 注入、SEO 页面生成与构建校验（含 chunk 预算、清单完整性、SW 版本哈希）。

## 六、已知边界

- X.509 只解析、不验证证书链与签名；一张 PEM 只取第一张证书。
- JSON Schema 不加载远程 `$ref`，保持完全离线。
- 二维码识别真实解码依赖浏览器 `BarcodeDetector` 或 jsQR + Canvas，jsdom 中只测试内容分类与错误分支。
- 简繁转换首次使用需下载 OpenCC 词典（约 0.5 MB gzip），pinyin-pro 按需加载。
- SW 后台预缓存约 255 个小 chunk（数 MB），在首次访问后空闲时进行；大词典与格式化器仍按需下载。
