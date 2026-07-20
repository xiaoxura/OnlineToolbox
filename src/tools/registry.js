// Lightweight tool metadata registry. Tool implementations are loaded on demand.

export const categories = [
  { id: 'all', name: '全部', description: '按任务查找工具' },
  { id: 'encoding', name: '编码/解码', description: '文本、字节与令牌' },
  { id: 'crypto', name: '哈希/加密', description: '摘要、签名与加密' },
  { id: 'text', name: '文本工具', description: '清理、比较与批处理' },
  { id: 'generator', name: '生成器', description: '随机值与视觉素材' },
  { id: 'converter', name: '转换器', description: '数据格式与单位' },
  { id: 'formatter', name: '格式化', description: '让代码更易读' },
  { id: 'devtool', name: '开发者', description: '规范、参考与校验' },
  { id: 'image', name: '图片工具', description: '压缩、编码与 SVG' },
  { id: 'network', name: '网络工具', description: 'URL、请求与网段' },
  { id: 'math', name: '数学计算', description: '表达式与高精度数字' },
]

export const tools = [
  { id: "base64", name: "Base64 编解码", description: "Base64 编码与解码，支持 UTF-8 中文", category: "encoding", icon: "base64", load: () => import("./encoding/base64.js") },
  { id: "url-encode", name: "URL 编解码", description: "URL 编码与解码，支持组件编码和完整URL编码", category: "encoding", icon: "url-encode", load: () => import("./encoding/url-encode.js") },
  { id: "html-entity", name: "HTML 实体编解码", description: "HTML 实体转义与反转义", category: "encoding", icon: "html-entity", load: () => import("./encoding/html-entity.js") },
  { id: "unicode", name: "Unicode 编解码", description: "文本与 Unicode 编码互相转换", category: "encoding", icon: "unicode", load: () => import("./encoding/unicode.js") },
  { id: "hex", name: "Hex 编解码", description: "文本与十六进制编码互相转换，支持数字进制转换", category: "encoding", icon: "hex", load: () => import("./encoding/hex.js") },
  { id: "jwt", name: "JWT 解析", description: "解析 JWT Token，显示 Header、Payload 和 Signature", category: "encoding", icon: "jwt", load: () => import("./encoding/jwt-decode.js") },
  { id: "base58", name: "Base58 编解码", description: "使用 Bitcoin 字母表进行 Base58 编码与解码", category: "encoding", icon: "base32", load: () => import("./encoding/base58.js") },
  { id: "base32", name: "Base32 编解码", description: "Base32 编码与解码（RFC 4648 字母表: A-Z2-7）", category: "encoding", icon: "base32", load: () => import("./encoding/base32.js") },
  { id: "punycode", name: "Punycode 编解码", description: "Punycode 编解码，用于国际化域名(IDN)转换", category: "encoding", icon: "punycode", load: () => import("./encoding/punycode.js") },
  { id: "data-url", name: "Data URL 生成", description: "将本地文件转换为可嵌入 HTML 或 CSS 的 Data URL", category: "encoding", icon: "img-to-base64", keywords: ["data uri", "文件编码", "base64文件"], load: () => import("./encoding/data-url.js") },
  { id: "md5", name: "MD5 哈希", description: "计算文本的 MD5 哈希值", category: "crypto", icon: "md5", load: () => import("./crypto/md5.js") },
  { id: "sha", name: "SHA 哈希", description: "计算 SHA-1/SHA-256/SHA-512 哈希值", category: "crypto", icon: "sha", load: () => import("./crypto/sha.js") },
  { id: "aes", name: "AES 加解密", description: "AES 对称加密和解密", category: "crypto", icon: "aes", load: () => import("./crypto/aes.js") },
  { id: "des", name: "DES 加解密", description: "DES/3DES 对称加密和解密", category: "crypto", icon: "des", load: () => import("./crypto/des.js") },
  { id: "file-hash", name: "文件哈希计算", description: "在本地计算文件的 SHA-1、SHA-256 或 SHA-512 摘要", category: "crypto", icon: "sha", load: () => import("./crypto/file-hash.js") },
  { id: "hmac", name: "HMAC 生成", description: "生成 HMAC 签名", category: "crypto", icon: "hmac", load: () => import("./crypto/hmac.js") },
  { id: "char-count", name: "字符统计", description: "统计文本的字符数、行数、字节数等", category: "text", icon: "char-count", load: () => import("./text/char-count.js") },
  { id: "text-diff", name: "文本对比", description: "对比两段文本的差异", category: "text", icon: "text-diff", load: () => import("./text/text-diff.js") },
  { id: "case-convert", name: "大小写转换", description: "文本大小写和全角半角转换", category: "text", icon: "case-convert", load: () => import("./text/case-convert.js") },
  { id: "text-dedup", name: "文本去重", description: "去除重复的行", category: "text", icon: "text-dedup", load: () => import("./text/text-dedup.js") },
  { id: "text-sort", name: "文本排序", description: "对文本行进行排序", category: "text", icon: "text-sort", load: () => import("./text/text-sort.js") },
  { id: "regex", name: "正则表达式测试", description: "正则表达式在线测试和匹配", category: "text", icon: "regex", load: () => import("./text/regex-test.js") },
  { id: "text-replace", name: "文本替换", description: "批量查找和替换文本", category: "text", icon: "text-replace", load: () => import("./text/text-replace.js") },
  { id: "escape", name: "转义工具", description: "JSON/JS/HTML 特殊字符转义", category: "text", icon: "escape", load: () => import("./text/escape.js") },
  { id: "markdown", name: "Markdown 预览", description: "实时预览 Markdown 文本", category: "text", icon: "html", load: () => import("./text/markdown.js") },
  { id: "set-operations", name: "文本集合运算", description: "计算两组文本行的交集、并集、差集和对称差集", category: "text", icon: "text-diff", load: () => import("./text/set-operations.js") },
  { id: "text-encrypt", name: "文本加密", description: "使用 AES 加密和解密文本", category: "text", icon: "aes", load: () => import("./text/text-encrypt.js") },
  { id: "slugify", name: "Slug 生成器", description: "将标题或文本转换为 URL 友好的 slug", category: "text", icon: "url-encode", keywords: ["slug", "url路径", "permalink"], load: () => import("./text/slugify.js") },
  { id: "line-endings", name: "换行符转换", description: "在 LF、CRLF 和 CR 换行格式之间转换文本", category: "text", icon: "text-sort", keywords: ["换行", "crlf", "lf", "eol"], load: () => import("./text/line-endings.js") },
  { id: "text-wrap", name: "文本自动换行", description: "按指定列宽自动换行并保留段落结构", category: "text", icon: "lorem", keywords: ["wrap", "列宽", "折行"], load: () => import("./text/text-wrap.js") },
  { id: "markdown-table", name: "Markdown 表格生成", description: "将 CSV、TSV 或竖线分隔数据转换为 Markdown 表格", category: "text", icon: "json-csv", keywords: ["table", "表格", "csv to markdown"], load: () => import("./text/markdown-table.js") },
  { id: "uuid", name: "UUID 生成", description: "生成 UUID v4 随机唯一标识符", category: "generator", icon: "uuid", load: () => import("./generator/uuid.js") },
  { id: "password", name: "随机密码生成", description: "生成安全的随机密码", category: "generator", icon: "password", load: () => import("./generator/password.js") },
  { id: "random", name: "随机数生成", description: "生成随机数和随机字符串", category: "generator", icon: "random", load: () => import("./generator/random.js") },
  { id: "lorem", name: "Lorem ipsum 生成", description: "生成 Lorem ipsum 占位文本", category: "generator", icon: "lorem", load: () => import("./generator/lorem.js") },
  { id: "qrcode", name: "二维码生成", description: "将文本或链接生成二维码", category: "generator", icon: "qrcode", load: () => import("./generator/qrcode.js") },
  { id: "placeholder-img", name: "占位图生成", description: "生成自定义尺寸、颜色和文字的占位图片", category: "generator", icon: "img-to-base64", load: () => import("./generator/placeholder-img.js") },
  { id: "gradient-gen", name: "CSS 渐变生成器", description: "生成线性渐变和径向渐变的 CSS 代码", category: "generator", icon: "color", load: () => import("./generator/gradient-gen.js") },
  { id: "shadow-gen", name: "CSS 阴影生成器", description: "可视化调整并生成 box-shadow CSS 代码", category: "generator", icon: "json", load: () => import("./generator/shadow-gen.js") },
  { id: "palette-gen", name: "调色板生成", description: "基于色彩理论生成互补色、三色组、类似色等配色方案", category: "generator", icon: "color", load: () => import("./generator/palette-gen.js") },
  { id: "ulid", name: "ULID 生成", description: "生成按时间排序、适合分布式系统的 ULID 标识符", category: "generator", icon: "uuid", keywords: ["sortable id", "分布式 id"], load: () => import("./generator/ulid.js") },
  { id: "timestamp", name: "时间戳转换", description: "Unix 时间戳与日期时间相互转换", category: "converter", icon: "timestamp", load: () => import("./converter/timestamp.js") },
  { id: "radix", name: "进制转换", description: "2/8/10/16 进制数相互转换", category: "converter", icon: "radix", load: () => import("./converter/radix.js") },
  { id: "color", name: "颜色转换", description: "HEX/RGB/HSL 颜色格式相互转换", category: "converter", icon: "color", load: () => import("./converter/color.js") },
  { id: "unit", name: "单位转换", description: "长度、重量、温度等单位转换", category: "converter", icon: "unit", load: () => import("./converter/unit.js") },
  { id: "json-yaml", name: "JSON ↔ YAML 转换", description: "JSON 和 YAML 格式相互转换", category: "converter", icon: "json-yaml", load: () => import("./converter/json-yaml.js") },
  { id: "json-xml", name: "JSON ↔ XML 转换", description: "JSON 和 XML 格式相互转换", category: "converter", icon: "json-xml", load: () => import("./converter/json-xml.js") },
  { id: "json-csv", name: "JSON 转 CSV", description: "将 JSON 数组转换为 CSV 格式，支持嵌套对象", category: "converter", icon: "json", load: () => import("./converter/json-csv.js") },
  { id: "csv-json", name: "CSV 转 JSON", description: "将 CSV 格式转换为 JSON 数组，支持自动检测分隔符", category: "converter", icon: "json", load: () => import("./converter/csv-json.js") },
  { id: "json-path", name: "JSONPath 查询", description: "使用 JSONPath 表达式查询 JSON 数据，支持点击 JSON 树节点获取路径", category: "converter", icon: "search", load: () => import("./converter/json-path.js") },
  { id: "md-to-html", name: "Markdown 转 HTML", description: "将 Markdown 文本实时转换为 HTML 代码", category: "converter", icon: "markdown", load: () => import("./converter/md-to-html.js") },
  { id: "html-to-jsx", name: "HTML 转 JSX", description: "将 HTML 代码转换为 React JSX 语法", category: "converter", icon: "html", load: () => import("./converter/html-to-jsx.js") },
  { id: "css-to-js", name: "CSS 转 JS 对象", description: "将 CSS 样式转换为 JavaScript 对象、CSS Modules 或 styled-components", category: "converter", icon: "css", load: () => import("./converter/css-to-js.js") },
  { id: "json-diff", name: "JSON 对比", description: "对比两个 JSON 对象的差异，显示新增、删除和修改的内容", category: "converter", icon: "json-yaml", load: () => import("./converter/json-diff.js") },
  { id: "timezone", name: "时区转换", description: "在不同时区之间转换时间", category: "converter", icon: "timestamp", load: () => import("./converter/timezone.js") },
  { id: "date-calc", name: "日期计算器", description: "计算日期差和日期加减", category: "converter", icon: "timestamp", load: () => import("./converter/date-calc.js") },
  { id: "json-typescript", name: "JSON 转 TypeScript", description: "根据 JSON 自动生成 TypeScript interface 或 type", category: "converter", icon: "json", load: () => import("./converter/json-typescript.js") },
  { id: "amount-cn", name: "中文大写金额", description: "将数字金额转换为中文大写", category: "converter", icon: "radix", load: () => import("./converter/amount-cn.js") },
  { id: "regex-visual", name: "正则表达式可视化", description: "测试和解释正则表达式", category: "converter", icon: "regex", load: () => import("./converter/regex-visual.js") },
  { id: "json-lines", name: "JSONL ↔ JSON 转换", description: "在 JSON Lines 与 JSON 数组之间双向转换和校验", category: "converter", icon: "json", keywords: ["jsonl", "ndjson", "newline json"], load: () => import("./converter/json-lines.js") },
  { id: "json-pointer", name: "JSON Pointer 查询", description: "使用 RFC 6901 JSON Pointer 精确读取 JSON 节点", category: "converter", icon: "json-path", keywords: ["rfc6901", "json path", "节点路径"], load: () => import("./converter/json-pointer.js") },
  { id: "duration-converter", name: "时间长度转换", description: "批量换算毫秒、秒、分钟、小时、天和周", category: "converter", icon: "timestamp", keywords: ["duration", "milliseconds", "ms"], load: () => import("./converter/duration-converter.js") },
  { id: "number-format", name: "数字格式化", description: "按地区格式化数字、货币和百分比", category: "converter", icon: "radix", keywords: ["number format", "currency", "locale"], load: () => import("./converter/number-format.js") },
  { id: "json", name: "JSON 格式化", description: "JSON 美化、压缩和校验", category: "formatter", icon: "json", load: () => import("./formatter/json.js") },
  { id: "css", name: "CSS 格式化", description: "CSS 代码美化和压缩", category: "formatter", icon: "css", load: () => import("./formatter/css.js") },
  { id: "html", name: "HTML 格式化", description: "HTML 代码美化和压缩", category: "formatter", icon: "html", load: () => import("./formatter/html.js") },
  { id: "sql", name: "SQL 格式化", description: "SQL 语句美化", category: "formatter", icon: "sql", load: () => import("./formatter/sql.js") },
  { id: "xml", name: "XML 格式化", description: "XML 代码美化和压缩", category: "formatter", icon: "xml", load: () => import("./formatter/xml.js") },
  { id: "cron", name: "Cron 表达式解析", description: "解析 Cron 表达式，显示各字段含义和下次执行时间", category: "devtool", icon: "timestamp", load: () => import("./devtool/cron.js") },
  { id: "http-status", name: "HTTP 状态码查询", description: "查看所有 HTTP 状态码的含义和分类", category: "devtool", icon: "search", load: () => import("./devtool/http-status.js") },
  { id: "user-agent", name: "User-Agent 解析", description: "解析 User-Agent 字符串，显示浏览器、操作系统和设备信息", category: "devtool", icon: "unicode", load: () => import("./devtool/user-agent.js") },
  { id: "regex-ref", name: "正则表达式速查表", description: "正则表达式语法参考，按分类查看常用模式、描述和示例", category: "devtool", icon: "regex", load: () => import("./devtool/regex-ref.js") },
  { id: "css-unit", name: "CSS 单位转换", description: "在 px、em、rem、vh、vw、%、cm、in、pt 等 CSS 单位之间互相转换", category: "devtool", icon: "unit", load: () => import("./devtool/css-unit.js") },
  { id: "json-schema", name: "JSON Schema 生成", description: "根据 JSON 数据自动推断并生成 JSON Schema (draft-07)", category: "devtool", icon: "json", load: () => import("./devtool/json-schema.js") },
  { id: "mock-data", name: "Mock 数据生成", description: "生成各类模拟数据：姓名、手机号、邮箱、身份证号、地址等", category: "devtool", icon: "random", load: () => import("./devtool/mock-data.js") },
  { id: "git-ref", name: "Git 命令速查", description: "常用 Git 命令参考，按分类查找并快速复制命令", category: "devtool", icon: "search", load: () => import("./devtool/git-ref.js") },
  { id: "linux-ref", name: "Linux 命令速查", description: "常用 Linux 命令参考，按分类查找并快速复制命令", category: "devtool", icon: "search", load: () => import("./devtool/linux-ref.js") },
  { id: "id-card", name: "身份证号校验", description: "校验18位身份证号码，提取省份、生日、性别等信息", category: "devtool", icon: "search", load: () => import("./devtool/id-card.js") },
  { id: "bank-card", name: "银行卡号校验", description: "使用 Luhn 算法校验银行卡号，识别发卡银行和卡类型", category: "devtool", icon: "search", load: () => import("./devtool/bank-card.js") },
  { id: "credit-code", name: "统一社会信用代码校验", description: "校验18位统一社会信用代码，解析登记管理机关和机构类型", category: "devtool", icon: "search", load: () => import("./devtool/credit-code.js") },
  { id: "chmod-calculator", name: "chmod 权限计算器", description: "可视化计算 Linux 文件权限和 chmod 命令", category: "devtool", icon: "search", load: () => import("./devtool/chmod-calculator.js") },
  { id: "sql-in", name: "SQL IN 参数生成", description: "将多行数据转换为 SQL IN 或 NOT IN 条件", category: "devtool", icon: "sql", load: () => import("./devtool/sql-in.js") },
  { id: "format-check", name: "格式校验工具", description: "校验手机号、邮箱、身份证、URL、IP地址、MAC地址、日期等格式", category: "devtool", icon: "regex", load: () => import("./devtool/format-check.js") },
  { id: "color-contrast", name: "WCAG 颜色对比度", description: "计算前景色与背景色对比度，检查 WCAG AA/AAA 标准", category: "devtool", icon: "color", keywords: ["wcag", "contrast", "无障碍", "a11y"], load: () => import("./devtool/color-contrast.js") },
  { id: "semver", name: "SemVer 版本比较", description: "校验、比较和升级语义化版本号", category: "devtool", icon: "json", keywords: ["semantic version", "版本号", "npm"], load: () => import("./devtool/semver.js") },
  { id: "mime-types", name: "MIME 类型查询", description: "按文件扩展名快速查找常用 MIME Content-Type", category: "devtool", icon: "search", keywords: ["content type", "扩展名", "http header"], load: () => import("./devtool/mime-types.js") },
  { id: "image-compress", name: "图片压缩与格式转换", description: "在本地压缩图片、调整尺寸并转换为 JPEG、PNG 或 WebP", category: "image", icon: "base64", load: () => import("./image/image-compress.js") },
  { id: "img-to-base64", name: "图片转 Base64", description: "将图片转换为 Base64 编码字符串", category: "image", icon: "base64", load: () => import("./image/img-to-base64.js") },
  { id: "svg-compress", name: "SVG 压缩", description: "压缩 SVG 代码，移除冗余内容", category: "image", icon: "html", load: () => import("./image/svg-compress.js") },
  { id: "ip-info", name: "IP 地址信息", description: "查询本机 IP 或指定 IP 地址的地理位置和网络信息", category: "network", icon: "unicode", load: () => import("./network/ip-info.js") },
  { id: "port-check", name: "端口说明查询", description: "查询常见网络端口号对应的服务和说明", category: "network", icon: "search", load: () => import("./network/port-check.js") },
  { id: "url-parser", name: "URL 解析器", description: "解析 URL 的各个组成部分", category: "network", icon: "url-encode", load: () => import("./network/url-parser.js") },
  { id: "header-parse", name: "HTTP Headers 解析", description: "解析原始 HTTP 请求/响应头", category: "network", icon: "search", load: () => import("./network/header-parse.js") },
  { id: "cidr-calculator", name: "IPv4/CIDR 计算器", description: "计算 IPv4 网段、子网掩码、广播地址和可用地址范围", category: "network", icon: "unicode", load: () => import("./network/cidr-calculator.js") },
  { id: "curl-generator", name: "CURL 命令生成器", description: "根据请求方法、Headers 和 Body 生成 CURL 命令", category: "network", icon: "url-encode", load: () => import("./network/curl-generator.js") },
  { id: "url-params", name: "URL 参数编辑器", description: "可视化解析、添加、删除和重新生成 URL 查询参数", category: "network", icon: "url-encode", load: () => import("./network/url-params.js") },
  { id: "cookie-viewer", name: "Cookie 查看器", description: "查看当前页面的 Cookie 信息", category: "network", icon: "search", load: () => import("./network/cookie-viewer.js") },
  { id: "query-string", name: "Query String 转换", description: "在 JSON 对象与 URL 查询字符串之间双向转换", category: "network", icon: "url-encode", keywords: ["query params", "url query", "search params"], load: () => import("./network/query-string.js") },
  { id: "calculator", name: "科学计算器", description: "支持科学函数、键盘输入和计算历史的科学计算器", category: "math", icon: "unit", load: () => import("./math/calculator.js") },
  { id: "big-number", name: "大数计算器", description: "大数进制转换和高精度四则运算，支持任意长度整数", category: "math", icon: "radix", load: () => import("./math/big-number.js") },
]

const searchAliases = {
  base64: ['b64', '编码', '解码'], jwt: ['token', '令牌'], timestamp: ['unix', 'epoch', '时间', '日期'],
  json: ['json beautify', '美化', '校验'], regex: ['regexp', '正则'], markdown: ['md', '预览'],
  qrcode: ['qr', '二维码'], uuid: ['guid'], sha: ['sha1', 'sha256', 'sha512'], md5: ['hash', '摘要'],
  'url-encode': ['uri', 'percent encoding'], 'json-yaml': ['yml'], 'img-to-base64': ['image', '图片编码'],
  calculator: ['计算', '科学计算'], cron: ['定时任务'], base58: ['bitcoin', 'btc'],
  'file-hash': ['文件摘要', 'checksum'], 'cidr-calculator': ['子网', '掩码', '网段'], 'chmod-calculator': ['linux权限', '八进制权限'], 'json-typescript': ['json to ts', 'interface', '类型生成'],
  'curl-generator': ['curl', 'api请求'], 'url-params': ['query', '查询参数'], 'sql-in': ['数据库', '批量id'],
  'set-operations': ['交集', '并集', '差集'], 'image-compress': ['图片压缩', 'webp', '图片转换'], 'ip-info': ['公网ip', '地址查询']
}

function matchesSearch(tool, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const searchable = [tool.name, tool.description, tool.id, tool.category, ...(tool.keywords || []), ...(searchAliases[tool.id] || [])].join(' ').toLowerCase()
  return terms.every(term => searchable.includes(term))
}

function scoreTool(tool, query) {
  const normalized = query.toLowerCase()
  const name = tool.name.toLowerCase()
  const id = tool.id.toLowerCase()
  const keyword = [...(tool.keywords || []), ...(searchAliases[tool.id] || [])].join(' ').toLowerCase()
  let score = 0
  if (id === normalized) score += 100
  if (name === normalized) score += 90
  if (name.startsWith(normalized)) score += 55
  if (id.startsWith(normalized)) score += 45
  if (keyword.includes(normalized)) score += 25
  if (tool.description.toLowerCase().includes(normalized)) score += 10
  return score
}

export function searchTools(query) {
  if (!query) return tools
  return tools.filter(tool => matchesSearch(tool, query)).sort((a, b) => scoreTool(b, query) - scoreTool(a, query))
}

export function getToolsByCategory(categoryId) {
  if (categoryId === 'all') return tools
  return tools.filter(tool => tool.category === categoryId)
}

export function getToolsByCategoryAndSearch(categoryId, query) {
  const categoryTools = categoryId === 'all' ? tools : getToolsByCategory(categoryId)
  if (!query) return categoryTools
  return categoryTools.filter(tool => matchesSearch(tool, query)).sort((a, b) => scoreTool(b, query) - scoreTool(a, query))
}

export function getToolById(id) {
  return tools.find(tool => tool.id === id)
}

export async function loadToolById(id) {
  const descriptor = getToolById(id)
  if (!descriptor) return null
  const module = await descriptor.load()
  return module.default
}
