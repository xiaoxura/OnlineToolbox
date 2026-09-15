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
  { id: 'ai', name: 'AI 工具', description: '分词、提示词与向量' },
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
  { id: "morse-code", name: "摩尔斯电码", description: "文本与摩尔斯电码互转，支持音频播放与自定义分隔符", category: "encoding", icon: "unicode", keywords: ["morse", "摩尔斯", "电报", "电码"], load: () => import("./encoding/morse-code.js") },
  { id: "md5", name: "MD5 哈希", description: "计算文本的 MD5 哈希值", category: "crypto", icon: "md5", load: () => import("./crypto/md5.js") },
  { id: "sha", name: "SHA 哈希", description: "计算 SHA-1/SHA-256/SHA-512 哈希值", category: "crypto", icon: "sha", load: () => import("./crypto/sha.js") },
  { id: "aes", name: "AES 加解密", description: "AES 对称加密和解密", category: "crypto", icon: "aes", load: () => import("./crypto/aes.js") },
  { id: "des", name: "DES 加解密", description: "DES/3DES 对称加密和解密", category: "crypto", icon: "des", load: () => import("./crypto/des.js") },
  { id: "file-hash", name: "文件哈希计算", description: "在本地计算文件的 SHA-1、SHA-256 或 SHA-512 摘要", category: "crypto", icon: "sha", load: () => import("./crypto/file-hash.js") },
  { id: "hmac", name: "HMAC 生成", description: "生成 HMAC 签名", category: "crypto", icon: "hmac", load: () => import("./crypto/hmac.js") },
  { id: "totp", name: "2FA 验证码", description: "输入 Base32 密钥，在浏览器本地生成 TOTP 动态验证码", category: "crypto", icon: "hmac", keywords: ["2fa", "totp", "otp", "authenticator", "动态口令"], load: () => import("./crypto/totp.js") },
  { id: "crc-calculator", name: "CRC 校验和", description: "计算 CRC-16、CRC-32、CRC-32C 与 Adler-32 校验和，支持文本与十六进制输入", category: "crypto", icon: "crc", keywords: ["crc32", "crc16", "adler", "校验和", "checksum", "modbus"], load: () => import("./crypto/crc-calculator.js") },
  { id: "jwt-sign", name: "JWT 签发与验签", description: "使用 HS256/HS384/HS512 或 RS256/ES256 签发并校验 JWT 令牌", category: "crypto", icon: "jwt", keywords: ["jwt", "jws", "sign", "签发", "验签", "token"], load: () => import("./crypto/jwt-sign.js") },
  { id: "key-pair-generator", name: "密钥对生成", description: "生成 RSA、ECDSA 与 Ed25519 密钥对，导出 PEM 与 JWK", category: "crypto", icon: "password", keywords: ["rsa", "ecdsa", "ed25519", "pem", "jwk", "密钥"], load: () => import("./crypto/key-pair-generator.js") },
  { id: "bcrypt", name: "bcrypt 哈希", description: "生成与校验 bcrypt 密码哈希，可调节计算成本", category: "crypto", icon: "hmac", keywords: ["bcrypt", "密码哈希", "password hash", "cost", "salt"], load: () => import("./crypto/bcrypt.js") },
  { id: "password-strength", name: "密码强度分析", description: "评估密码强度：字符集、熵值、常见模式与预估破解时间", category: "crypto", icon: "password", keywords: ["密码强度", "熵", "entropy", "破解时间", "zxcvbn"], load: () => import("./crypto/password-strength.js") },
  { id: "classic-cipher", name: "经典密码", description: "ROT13、凯撒、维吉尼亚与 Atbash 古典密码加密解密", category: "crypto", icon: "escape", keywords: ["凯撒", "caesar", "rot13", "维吉尼亚", "vigenere", "atbash", "古典密码"], load: () => import("./crypto/classic-cipher.js") },
  { id: "bip39", name: "BIP39 助记词", description: "生成与校验 BIP39 助记词，并推导种子", category: "crypto", icon: "random", keywords: ["bip39", "助记词", "mnemonic", "钱包", "种子", "seed"], load: () => import("./crypto/bip39.js") },
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
  { id: "word-frequency", name: "词频统计", description: "统计文本中词语出现次数、占比并排序", category: "text", icon: "char-count", keywords: ["词频", "word count", "frequency", "分词", "热词"], load: () => import("./text/word-frequency.js") },
  { id: "text-extract", name: "文本提取器", description: "从文本中批量提取邮箱、URL、IP、手机号与话题标签", category: "text", icon: "search", keywords: ["提取", "extract", "邮箱", "url", "手机号", "正则提取"], load: () => import("./text/text-extract.js") },
  { id: "hidden-chars", name: "隐藏字符检测", description: "检测并清除零宽字符、BOM、控制符与易混淆字符", category: "text", icon: "eye", keywords: ["零宽字符", "隐藏字符", "bom", "不可见字符", "同形字", "清洗"], load: () => import("./text/hidden-chars.js") },
  { id: "text-mask", name: "文本脱敏", description: "对邮箱、手机号、身份证、银行卡与密钥进行掩码脱敏", category: "text", icon: "mask", keywords: ["脱敏", "掩码", "mask", "打码", "隐私", "敏感信息"], load: () => import("./text/text-mask.js") },
  { id: "list-tools", name: "列表工具", description: "对文本行进行反转、打乱、分组、轮转、编号与包装", category: "text", icon: "text-sort", keywords: ["列表", "行处理", "反转", "打乱", "分组", "编号"], load: () => import("./text/list-tools.js") },
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
  { id: "uuid-converter", name: "UUID 生成与解析", description: "生成与解析 UUID v1/v3/v4/v5，显示版本、变体与内嵌时间戳", category: "generator", icon: "uuid", keywords: ["uuid", "guid", "v4", "v5", "v1", "唯一标识"], load: () => import("./generator/uuid-converter.js") },
  { id: "barcode", name: "条形码生成", description: "生成 Code128、EAN-13、UPC-A 与 Code39 条形码，可下载 PNG 或 SVG", category: "generator", icon: "barcode", keywords: ["barcode", "条形码", "code128", "ean13", "upc", "code39"], load: () => import("./generator/barcode.js") },
  { id: "wifi-qr", name: "WiFi 二维码", description: "生成包含 SSID 与密码的 WiFi 二维码，扫码即可连接", category: "generator", icon: "wifi", keywords: ["wifi", "二维码", "ssid", "无线网络", "扫码连接"], load: () => import("./generator/wifi-qr.js") },
  { id: "timestamp", name: "时间戳转换", description: "Unix 时间戳与日期时间相互转换", category: "converter", icon: "timestamp", load: () => import("./converter/timestamp.js") },
  { id: "radix", name: "进制转换", description: "2/8/10/16 进制数相互转换", category: "converter", icon: "radix", load: () => import("./converter/radix.js") },
  { id: "color", name: "颜色转换", description: "HEX/RGB/HSL 颜色格式相互转换", category: "converter", icon: "color", load: () => import("./converter/color.js") },
  { id: "unit", name: "单位转换", description: "长度、重量、温度等单位转换", category: "converter", icon: "unit", load: () => import("./converter/unit.js") },
  { id: "json-yaml", name: "JSON ↔ YAML 转换", description: "JSON 和 YAML 格式相互转换", category: "converter", icon: "json-yaml", load: () => import("./converter/json-yaml.js") },
  { id: "codex-credential-converter", name: "CPA ↔ Sub2API 凭证转换", description: "CPA ↔ Sub2API，二者均可导出 auth.json", category: "converter", icon: "json-yaml", keywords: ["cpa", "cliproxyapi", "sub2api", "auth.json", "codex", "oauth"], load: () => import("./converter/codex-credential-converter.js") },
  { id: "toml-json", name: "TOML ↔ JSON 转换", description: "在 TOML 配置与 JSON 对象之间双向转换，支持表和数组表", category: "converter", icon: "json", keywords: ["toml", "toml parser", "配置转换"], load: () => import("./converter/toml-json.js") },
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
  { id: "html-to-markdown", name: "HTML 转 Markdown", description: "将 HTML 转换为 Markdown，支持标题、列表、链接、表格与代码块", category: "converter", icon: "markdown", keywords: ["html2md", "markdown", "转换", "文档"], load: () => import("./converter/html-to-markdown.js") },
  { id: "markdown-toc", name: "Markdown 目录生成", description: "为 Markdown 文档生成带锚点的可跳转目录", category: "converter", icon: "text-sort", keywords: ["toc", "目录", "锚点", "outline"], load: () => import("./converter/markdown-toc.js") },
  { id: "csv-toolbox", name: "CSV 工具箱", description: "CSV 转置、分隔符转换、列的增删与交换", category: "converter", icon: "json-csv", keywords: ["csv", "tsv", "转置", "transpose", "分隔符"], load: () => import("./converter/csv-toolbox.js") },
  { id: "json-to-code", name: "JSON 转代码", description: "将 JSON 转换为 Go、Python、Java、C#、PHP 或 Rust 结构体代码", category: "converter", icon: "json", keywords: ["struct", "pojo", "dataclass", "record", "代码生成", "go", "rust"], load: () => import("./converter/json-to-code.js") },
  { id: "json-flatten", name: "JSON 扁平化", description: "在嵌套 JSON 与点号路径的扁平结构之间双向转换", category: "converter", icon: "json", keywords: ["flatten", "unflatten", "扁平化", "路径", "dot notation", "展开"], load: () => import("./converter/json-flatten.js") },
  { id: "json-sort", name: "JSON 键排序", description: "递归排序 JSON 对象键名，可选保留数组顺序", category: "converter", icon: "json", keywords: ["sort", "排序", "键排序", "key order", "规范化", "diff"], load: () => import("./converter/json-sort.js") },
  { id: "objectid", name: "MongoDB ObjectId", description: "在时间戳与 ObjectId 之间互转并解析其结构", category: "converter", icon: "uuid", keywords: ["mongodb", "objectid", "bson", "_id", "时间戳", "随机数"], load: () => import("./converter/objectid.js") },
  { id: "number-to-words", name: "数字转英文", description: "将数字转换为英文单词、序数词与货币读法", category: "converter", icon: "radix", keywords: ["number", "words", "英文", "序数词", "spell", "货币读法", "中文读法"], load: () => import("./converter/number-to-words.js") },
  { id: "lunar-calendar", name: "农历 ↔ 公历", description: "公历与农历互转，显示天干地支、生肖、节气与星期", category: "converter", icon: "calendar", keywords: ["农历", "公历", "阴历", "阳历", "节气", "干支", "生肖", "lunar"], load: () => import("./converter/lunar-calendar.js") },
  { id: "ieee754", name: "IEEE 754 浮点数", description: "在十进制浮点数与 IEEE 754 二进制、十六进制表示之间转换", category: "converter", icon: "binary", keywords: ["ieee754", "浮点数", "float", "二进制", "阶码", "尾数", "精度"], load: () => import("./converter/ieee754.js") },
  { id: "json-lines", name: "JSONL ↔ JSON 转换", description: "在 JSON Lines 与 JSON 数组之间双向转换和校验", category: "converter", icon: "json", keywords: ["jsonl", "ndjson", "newline json"], load: () => import("./converter/json-lines.js") },
  { id: "json-pointer", name: "JSON Pointer 查询", description: "使用 RFC 6901 JSON Pointer 精确读取 JSON 节点", category: "converter", icon: "json-path", keywords: ["rfc6901", "json path", "节点路径"], load: () => import("./converter/json-pointer.js") },
  { id: "json-patch", name: "JSON Patch 生成", description: "对比两组 JSON，生成符合 RFC 6902 的 add、remove 和 replace 操作", category: "converter", icon: "json", keywords: ["rfc6902", "json patch", "json diff", "接口变更"], load: () => import("./converter/json-patch.js") },
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
  { id: "env-json", name: ".env ↔ JSON", description: "在 dotenv 文件与 JSON 对象之间双向转换", category: "devtool", icon: "json", keywords: ["dotenv", "env", "环境变量", "配置文件"], load: () => import("./devtool/env-json.js") },
  { id: "properties-json", name: ".properties ↔ JSON", description: "Java properties 文件与 JSON 双向转换，支持转义与 Unicode", category: "devtool", icon: "json", keywords: ["properties", "java", "配置", "unicode 转义"], load: () => import("./devtool/properties-json.js") },
  { id: "db-connection-string", name: "数据库连接串", description: "构建与解析 MySQL、PostgreSQL、MongoDB 与 Redis 连接字符串", category: "devtool", icon: "sql", keywords: ["connection string", "dsn", "mysql", "postgres", "mongodb", "redis", "uri"], load: () => import("./devtool/db-connection-string.js") },
  { id: "htpasswd-generator", name: "htpasswd 生成器", description: "生成 Apache htpasswd / HTTP Basic Auth 凭据，支持 bcrypt、SHA1、MD5 与明文格式", category: "devtool", icon: "jwt", keywords: ["htpasswd", "basic auth", "nginx", "apache", "apr1"], load: () => import("./devtool/htpasswd-generator.js") },
  { id: "iban-validator", name: "IBAN 校验", description: "校验国际银行账号（IBAN）并解析国家、校验位与账号结构", category: "devtool", icon: "search", keywords: ["iban", "银行账号", "mod97", "swift", "国际汇款"], load: () => import("./devtool/iban-validator.js") },
  { id: "docker-compose-converter", name: "Docker Run ↔ Compose", description: "在 docker run 命令与 docker-compose.yml 之间双向转换", category: "devtool", icon: "wrench", keywords: ["docker", "compose", "docker run", "容器", "yaml"], load: () => import("./devtool/docker-compose-converter.js") },
  { id: "gitignore-generator", name: ".gitignore 生成器", description: "按语言、框架、编辑器与操作系统勾选生成 .gitignore 文件", category: "devtool", icon: "text-sort", keywords: ["gitignore", "git", "忽略文件", "模板"], load: () => import("./devtool/gitignore-generator.js") },
  { id: "cron-builder", name: "Cron 表达式构建器", description: "可视化构建 cron 表达式并生成人类可读的中文描述", category: "devtool", icon: "cron", keywords: ["cron", "定时任务", "crontab", "调度", "表达式"], load: () => import("./devtool/cron-builder.js") },
  { id: "csp-generator", name: "CSP 生成器", description: "勾选指令生成 Content-Security-Policy 响应头", category: "devtool", icon: "shield-link", keywords: ["csp", "content security policy", "安全响应头", "xss"], load: () => import("./devtool/csp-generator.js") },
  { id: "xpath-tester", name: "XPath 测试器", description: "在 HTML 或 XML 上实时测试 XPath 表达式并高亮匹配结果", category: "devtool", icon: "json-path", keywords: ["xpath", "xml", "html", "选择器", "解析"], load: () => import("./devtool/xpath-tester.js") },
  { id: "image-compress", name: "图片压缩与格式转换", description: "在本地压缩图片、调整尺寸并转换为 JPEG、PNG 或 WebP", category: "image", icon: "base64", load: () => import("./image/image-compress.js") },
  { id: "img-to-base64", name: "图片转 Base64", description: "将图片转换为 Base64 编码字符串", category: "image", icon: "base64", load: () => import("./image/img-to-base64.js") },
  { id: "svg-compress", name: "SVG 压缩", description: "压缩 SVG 代码，移除冗余内容", category: "image", icon: "html", load: () => import("./image/svg-compress.js") },
  { id: "favicon-generator", name: "Favicon 生成", description: "将图片转换为多尺寸 favicon PNG 与 ICO，并生成引用代码", category: "image", icon: "favicon", keywords: ["favicon", "ico", "图标", "网站图标", "manifest"], load: () => import("./image/favicon-generator.js") },
  { id: "exif", name: "图片 EXIF", description: "查看图片的拍摄参数与 GPS 信息，并可一键清除元数据", category: "image", icon: "camera", keywords: ["exif", "元数据", "metadata", "gps", "隐私", "清除元数据"], load: () => import("./image/exif.js") },
  { id: "ip-info", name: "IP 地址信息", description: "查询本机 IP 或指定 IP 地址的地理位置和网络信息", category: "network", icon: "unicode", load: () => import("./network/ip-info.js") },
  { id: "port-check", name: "端口说明查询", description: "查询常见网络端口号对应的服务和说明", category: "network", icon: "search", load: () => import("./network/port-check.js") },
  { id: "url-parser", name: "URL 解析器", description: "解析 URL 的各个组成部分", category: "network", icon: "url-encode", load: () => import("./network/url-parser.js") },
  { id: "header-parse", name: "HTTP Headers 解析", description: "解析原始 HTTP 请求/响应头", category: "network", icon: "search", load: () => import("./network/header-parse.js") },
  { id: "cidr-calculator", name: "IPv4/CIDR 计算器", description: "计算 IPv4 网段、子网掩码、广播地址和可用地址范围", category: "network", icon: "unicode", load: () => import("./network/cidr-calculator.js") },
  { id: "ipv6-calculator", name: "IPv6 地址解析", description: "解析 IPv6 地址并生成压缩、展开格式，支持 IPv4 尾段和 CIDR 前缀", category: "network", icon: "unicode", keywords: ["IPv6", "IP v6", "地址压缩", "地址展开"], load: () => import("./network/ipv6-calculator.js") },
  { id: "curl-generator", name: "CURL 命令生成器", description: "根据请求方法、Headers 和 Body 生成 CURL 命令", category: "network", icon: "url-encode", load: () => import("./network/curl-generator.js") },
  { id: "url-params", name: "URL 参数编辑器", description: "可视化解析、添加、删除和重新生成 URL 查询参数", category: "network", icon: "url-encode", load: () => import("./network/url-params.js") },
  { id: "cookie-viewer", name: "Cookie 查看器", description: "查看当前页面的 Cookie 信息", category: "network", icon: "search", load: () => import("./network/cookie-viewer.js") },
  { id: "query-string", name: "Query String 转换", description: "在 JSON 对象与 URL 查询字符串之间双向转换", category: "network", icon: "url-encode", keywords: ["query params", "url query", "search params"], load: () => import("./network/query-string.js") },
  { id: "url-defang", name: "URL 去毒化", description: "将链接、域名、IP 与邮箱转换为不可点击的安全形式（defang/refang）", category: "network", icon: "shield-link", keywords: ["defang", "refang", "去毒", "安全分享", "ioc", "威胁情报"], load: () => import("./network/url-defang.js") },
  { id: "utm-builder", name: "UTM 链接构建器", description: "可视化拼装带 UTM 跟踪参数的投放链接", category: "network", icon: "url-encode", keywords: ["utm", "campaign", "投放链接", "跟踪参数", "marketing"], load: () => import("./network/utm-builder.js") },
  { id: "calculator", name: "科学计算器", description: "支持科学函数、键盘输入和计算历史的科学计算器", category: "math", icon: "unit", load: () => import("./math/calculator.js") },
  { id: "big-number", name: "大数计算器", description: "大数进制转换和高精度四则运算，支持任意长度整数", category: "math", icon: "radix", load: () => import("./math/big-number.js") },
  { id: "percentage", name: "百分比计算器", description: "计算百分比、增减幅度、占比与折扣", category: "math", icon: "percent", keywords: ["百分比", "percent", "折扣", "占比", "百分点"], load: () => import("./math/percentage.js") },
  { id: "statistics", name: "统计计算器", description: "计算均值、中位数、众数、方差、标准差、分位数与离群值", category: "math", icon: "statistics", keywords: ["统计", "均值", "中位数", "方差", "标准差", "分位数", "离群值"], load: () => import("./math/statistics.js") },
  { id: "token-counter", name: "Token 计数器", description: "按 BPE 分词器精确计算文本或对话消息的 token 数", category: "ai", icon: "ai-token", keywords: ["token", "分词", "bpe", "tiktoken", "上下文"], load: () => import("./ai/token-counter.js") },
  { id: "llm-cost", name: "大模型成本估算", description: "按 token 用量和模型单价估算 API 调用成本，支持缓存计价", category: "ai", icon: "ai-cost", keywords: ["cost", "价格", "费用", "计费", "caching"], load: () => import("./ai/llm-cost.js") },
  { id: "llm-models", name: "大模型对照表", description: "对比主流大模型的上下文窗口与每百万 token 价格", category: "ai", icon: "ai-model", keywords: ["模型价格", "上下文窗口", "context window", "pricing"], load: () => import("./ai/llm-models.js") },
  { id: "prompt-template", name: "Prompt 模板填充", description: "用 JSON 变量填充 {{占位符}}，并列出未填充的变量", category: "ai", icon: "ai-prompt", keywords: ["prompt", "模板", "变量", "占位符"], load: () => import("./ai/prompt-template.js") },
  { id: "chat-builder", name: "对话消息组装器", description: "可视化拼装 system / user / assistant 消息，导出为各家 API 的消息格式", category: "ai", icon: "ai-chat", keywords: ["chat", "messages", "对话", "system prompt"], load: () => import("./ai/chat-builder.js") },
  { id: "message-convert", name: "对话格式互转", description: "在 OpenAI、Anthropic、Gemini 三种消息格式之间互转，支持工具调用", category: "ai", icon: "ai-convert", keywords: ["messages", "tool_calls", "function call", "格式转换"], load: () => import("./ai/message-convert.js") },
  { id: "tool-schema", name: "Function Schema 生成", description: "根据参数示例 JSON 生成 OpenAI 或 Anthropic 的工具调用 Schema", category: "ai", icon: "ai-tool-schema", keywords: ["function calling", "tools", "json schema", "工具调用"], load: () => import("./ai/tool-schema.js") },
  { id: "llm-json-repair", name: "LLM 输出 JSON 修复", description: "从模型回复中提取 JSON，修复尾随逗号、单引号等常见错误", category: "ai", icon: "ai-json", keywords: ["json 修复", "parse", "markdown 代码块", "提取"], load: () => import("./ai/json-repair.js") },
  { id: "text-chunker", name: "文本分块器", description: "把长文本按字符或 token 切成带重叠的片段，用于 RAG 索引", category: "ai", icon: "ai-chunk", keywords: ["chunk", "分块", "rag", "重叠", "overlap"], load: () => import("./ai/text-chunker.js") },
  { id: "vector-similarity", name: "向量相似度计算", description: "计算两个 embedding 向量的余弦相似度、点积和欧氏距离", category: "ai", icon: "ai-vector", keywords: ["embedding", "cosine", "向量", "相似度"], load: () => import("./ai/vector-similarity.js") },
]

const searchAliases = {
  base64: ['b64', '编码', '解码'], jwt: ['token', '令牌'], timestamp: ['unix', 'epoch', '时间', '日期'],
  json: ['json beautify', '美化', '校验'], regex: ['regexp', '正则'], markdown: ['md', '预览'],
  qrcode: ['qr', '二维码'], uuid: ['guid'], sha: ['sha1', 'sha256', 'sha512'], md5: ['hash', '摘要'],
  'url-encode': ['uri', 'percent encoding'], 'json-yaml': ['yml'], 'img-to-base64': ['image', '图片编码'],
  calculator: ['计算', '科学计算'], cron: ['定时任务'], base58: ['bitcoin', 'btc'],
  'file-hash': ['文件摘要', 'checksum'], 'cidr-calculator': ['子网', '掩码', '网段'], 'chmod-calculator': ['linux权限', '八进制权限'], 'json-typescript': ['json to ts', 'interface', '类型生成'],
  'curl-generator': ['curl', 'api请求'], 'url-params': ['query', '查询参数'], 'sql-in': ['数据库', '批量id'],
  'set-operations': ['交集', '并集', '差集'], 'image-compress': ['图片压缩', 'webp', '图片转换'], 'ip-info': ['公网ip', '地址查询'],
  'token-counter': ['token 计数', '分词器', '上下文长度', 'context length'], 'llm-cost': ['api 费用', 'token 价格', '计费'],
  'llm-models': ['模型列表', '模型对比', '窗口大小'], 'prompt-template': ['提示词', 'prompt 变量', '占位符填充'],
  'chat-builder': ['消息拼接', 'prompt 组装', 'system prompt'], 'message-convert': ['消息格式', 'openai 转 anthropic', 'gemini 格式'],
  'tool-schema': ['函数调用', 'tool use', 'tools 定义'], 'llm-json-repair': ['json 提取', '模型输出解析', '代码块提取'],
  'text-chunker': ['文本切分', 'rag 分块', 'chunking'], 'vector-similarity': ['余弦相似度', 'embedding 对比', 'cosine']
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
