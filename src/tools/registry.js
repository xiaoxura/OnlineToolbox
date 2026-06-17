// Tool registry - imports all tools and provides search/filter

// Encoding/Decoding
import base64 from './encoding/base64.js'
import urlEncode from './encoding/url-encode.js'
import htmlEntity from './encoding/html-entity.js'
import unicode from './encoding/unicode.js'
import hex from './encoding/hex.js'
import jwtDecode from './encoding/jwt-decode.js'
import base32 from './encoding/base32.js'
import punycodeTool from './encoding/punycode.js'

// Hash/Crypto
import md5 from './crypto/md5.js'
import sha from './crypto/sha.js'
import aes from './crypto/aes.js'
import des from './crypto/des.js'
import hmac from './crypto/hmac.js'

// Text
import charCount from './text/char-count.js'
import textDiff from './text/text-diff.js'
import caseConvert from './text/case-convert.js'
import textDedup from './text/text-dedup.js'
import textSort from './text/text-sort.js'
import regexTest from './text/regex-test.js'
import textReplace from './text/text-replace.js'
import escapeTool from './text/escape.js'
import markdown from './text/markdown.js'
import textEncrypt from './text/text-encrypt.js'

// Generators
import uuid from './generator/uuid.js'
import password from './generator/password.js'
import random from './generator/random.js'
import lorem from './generator/lorem.js'
import qrcode from './generator/qrcode.js'
import placeholderImg from './generator/placeholder-img.js'
import gradientGen from './generator/gradient-gen.js'
import shadowGen from './generator/shadow-gen.js'
import paletteGen from './generator/palette-gen.js'

// Converters
import timestamp from './converter/timestamp.js'
import radix from './converter/radix.js'
import color from './converter/color.js'
import unit from './converter/unit.js'
import jsonYaml from './converter/json-yaml.js'
import jsonXml from './converter/json-xml.js'
import jsonCsv from './converter/json-csv.js'
import csvJson from './converter/csv-json.js'
import jsonPath from './converter/json-path.js'
import mdToHtml from './converter/md-to-html.js'
import htmlToJsx from './converter/html-to-jsx.js'
import cssToJs from './converter/css-to-js.js'
import jsonDiff from './converter/json-diff.js'
import timezone from './converter/timezone.js'
import dateCalc from './converter/date-calc.js'
import amountCn from './converter/amount-cn.js'
import regexVisual from './converter/regex-visual.js'

// Formatters
import jsonFmt from './formatter/json.js'
import cssFmt from './formatter/css.js'
import htmlFmt from './formatter/html.js'
import sqlFmt from './formatter/sql.js'
import xmlFmt from './formatter/xml.js'

// Developer Tools
import cron from './devtool/cron.js'
import httpStatus from './devtool/http-status.js'
import userAgent from './devtool/user-agent.js'
import regexRef from './devtool/regex-ref.js'
import cssUnit from './devtool/css-unit.js'
import jsonSchema from './devtool/json-schema.js'
import mockData from './devtool/mock-data.js'
import gitRef from './devtool/git-ref.js'
import linuxRef from './devtool/linux-ref.js'
import idCard from './devtool/id-card.js'
import bankCard from './devtool/bank-card.js'
import creditCode from './devtool/credit-code.js'
import formatCheck from './devtool/format-check.js'

// Image Tools
import imgToBase64 from './image/img-to-base64.js'
import svgCompress from './image/svg-compress.js'

// Network Tools
import ipInfo from './network/ip-info.js'
import portCheck from './network/port-check.js'
import urlParser from './network/url-parser.js'
import headerParse from './network/header-parse.js'
import cookieViewer from './network/cookie-viewer.js'

// Math Tools
import calculator from './math/calculator.js'
import bigNumber from './math/big-number.js'

export const categories = [
  { id: 'all', name: '全部' },
  { id: 'encoding', name: '编码/解码' },
  { id: 'crypto', name: '哈希/加密' },
  { id: 'text', name: '文本工具' },
  { id: 'generator', name: '生成器' },
  { id: 'converter', name: '转换器' },
  { id: 'formatter', name: '格式化' },
  { id: 'devtool', name: '开发者' },
  { id: 'image', name: '图片工具' },
  { id: 'network', name: '网络工具' },
  { id: 'math', name: '数学计算' },
]

export const tools = [
  // Encoding/Decoding
  base64, urlEncode, htmlEntity, unicode, hex, jwtDecode, base32, punycodeTool,
  // Hash/Crypto
  md5, sha, aes, des, hmac,
  // Text
  charCount, textDiff, caseConvert, textDedup, textSort, regexTest, textReplace, escapeTool,
  markdown, textEncrypt,
  // Generators
  uuid, password, random, lorem, qrcode, placeholderImg, gradientGen, shadowGen, paletteGen,
  // Converters
  timestamp, radix, color, unit, jsonYaml, jsonXml, jsonCsv, csvJson, jsonPath,
  mdToHtml, htmlToJsx, cssToJs, jsonDiff, timezone, dateCalc, amountCn, regexVisual,
  // Formatters
  jsonFmt, cssFmt, htmlFmt, sqlFmt, xmlFmt,
  // Developer Tools
  cron, httpStatus, userAgent, regexRef, cssUnit, jsonSchema, mockData, gitRef, linuxRef,
  idCard, bankCard, creditCode, formatCheck,
  // Image Tools
  imgToBase64, svgCompress,
  // Network Tools
  ipInfo, portCheck, urlParser, headerParse, cookieViewer,
  // Math Tools
  calculator, bigNumber,
]

export function searchTools(query) {
  if (!query) return tools
  const q = query.toLowerCase()
  return tools.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q)
  )
}

export function getToolsByCategory(categoryId) {
  if (categoryId === 'all') return tools
  return tools.filter(t => t.category === categoryId)
}

export function getToolsByCategoryAndSearch(categoryId, query) {
  let result = categoryId === 'all' ? tools : tools.filter(t => t.category === categoryId)
  if (query) {
    const q = query.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  }
  return result
}

export function getToolById(id) {
  return tools.find(t => t.id === id)
}
