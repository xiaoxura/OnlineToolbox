import { createElement, createSection, createTableScroll, createCopyButton } from '../../utils/dom.js'

// X.509 certificate parsing in the browser, without third-party dependencies.
//
// The certificate is decoded straight from its DER bytes: a small tag-length-
// value reader, the TBSCertificate fields, and the three extensions that are
// useful in day-to-day debugging (SAN, BasicConstraints, KeyUsage).
//
// Certificates are small enough that a synchronous implementation is more
// convenient than an async WebCrypto one: `parseCertificate` returns a plain
// object, so callers (and tests) can inspect it without awaiting. SHA-1 and
// SHA-256 are implemented below in plain JS for the same reason; the async
// `computeFingerprints` helper still prefers WebCrypto when it is available.

const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  T61_STRING: 0x14,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  UNIVERSAL_STRING: 0x1c,
  BMP_STRING: 0x1e,
  SEQUENCE: 0x30,
  SET: 0x31
}

const CONTEXT_0 = 0xa0
const CONTEXT_3 = 0xa3
const CONTEXT_DNS = 2
const CONTEXT_EMAIL = 1
const CONTEXT_URI = 6
const CONTEXT_IP = 7

const OID = {
  rsaEncryption: '1.2.840.113549.1.1.1',
  sha1WithRSA: '1.2.840.113549.1.1.5',
  sha256WithRSA: '1.2.840.113549.1.1.11',
  sha384WithRSA: '1.2.840.113549.1.1.12',
  sha512WithRSA: '1.2.840.113549.1.1.13',
  rsassaPss: '1.2.840.113549.1.1.10',
  ecPublicKey: '1.2.840.10045.2.1',
  ecdsaWithSha1: '1.2.840.10045.4.1',
  ecdsaWithSha256: '1.2.840.10045.4.3.2',
  ecdsaWithSha384: '1.2.840.10045.4.3.3',
  ecdsaWithSha512: '1.2.840.10045.4.3.4',
  dsa: '1.2.840.10040.4.1',
  dsaWithSha1: '1.2.840.10040.4.3',
  dsaWithSha256: '2.16.840.1.101.3.4.3.2',
  ed25519: '1.3.101.112',
  ed448: '1.3.101.113',
  x25519: '1.3.101.110',
  x448: '1.3.101.111'
}

const ALGORITHM_NAMES = {
  [OID.rsaEncryption]: 'rsaEncryption',
  [OID.sha1WithRSA]: 'sha1WithRSAEncryption',
  [OID.sha256WithRSA]: 'sha256WithRSAEncryption',
  [OID.sha384WithRSA]: 'sha384WithRSAEncryption',
  [OID.sha512WithRSA]: 'sha512WithRSAEncryption',
  [OID.rsassaPss]: 'RSASSA-PSS',
  [OID.ecPublicKey]: 'id-ecPublicKey',
  [OID.ecdsaWithSha1]: 'ecdsa-with-SHA1',
  [OID.ecdsaWithSha256]: 'ecdsa-with-SHA256',
  [OID.ecdsaWithSha384]: 'ecdsa-with-SHA384',
  [OID.ecdsaWithSha512]: 'ecdsa-with-SHA512',
  [OID.dsa]: 'id-dsa',
  [OID.dsaWithSha1]: 'dsa-with-SHA1',
  [OID.dsaWithSha256]: 'dsa-with-SHA256',
  [OID.ed25519]: 'Ed25519',
  [OID.ed448]: 'Ed448',
  [OID.x25519]: 'X25519',
  [OID.x448]: 'X448'
}

const PUBLIC_KEY_NAMES = {
  [OID.rsaEncryption]: 'RSA',
  [OID.rsassaPss]: 'RSA-PSS',
  [OID.ecPublicKey]: 'EC',
  [OID.dsa]: 'DSA',
  [OID.ed25519]: 'Ed25519',
  [OID.ed448]: 'Ed448',
  [OID.x25519]: 'X25519',
  [OID.x448]: 'X448'
}

const CURVE_BITS = {
  '1.2.840.10045.3.1.7': 256, // P-256
  '1.3.132.0.34': 384, // P-384
  '1.3.132.0.35': 521, // P-521
  '1.3.132.0.10': 256, // secp256k1
  '1.3.132.0.33': 224 // P-224
}

// Short names for the RDN attribute types that show up in certificate names.
const NAME_OIDS = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.9': 'street',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.4': 'SN',
  '2.5.4.5': 'serialNumber',
  '2.5.4.12': 'title',
  '2.5.4.42': 'GN',
  '2.5.4.17': 'postalCode',
  '2.5.4.45': 'x500UniqueIdentifier',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '0.9.2342.19200300.100.1.25': 'DC',
  '0.9.2342.19200300.100.1.1': 'UID'
}

export const NAME_LABELS = {
  CN: '通用名称 (CN)',
  O: '组织 (O)',
  OU: '部门 (OU)',
  C: '国家 (C)',
  ST: '省/州 (ST)',
  L: '城市 (L)',
  street: '街道 (street)',
  SN: '姓氏 (SN)',
  GN: '名字 (GN)',
  title: '头衔 (title)',
  serialNumber: '序列号 (serialNumber)',
  postalCode: '邮编 (postalCode)',
  emailAddress: '邮箱 (emailAddress)',
  DC: '域组件 (DC)',
  UID: '用户 ID (UID)',
  x500UniqueIdentifier: '唯一标识 (x500UniqueIdentifier)'
}

export const KEY_USAGE_NAMES = [
  'digitalSignature',
  'nonRepudiation',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'encipherOnly',
  'decipherOnly'
]

export const KEY_USAGE_LABELS = {
  digitalSignature: '数字签名',
  nonRepudiation: '不可否认',
  keyEncipherment: '密钥加密',
  dataEncipherment: '数据加密',
  keyAgreement: '密钥协商',
  keyCertSign: '证书签名',
  cRLSign: 'CRL 签名',
  encipherOnly: '仅加密',
  decipherOnly: '仅解密'
}

// --- DER ------------------------------------------------------------------

function toBytes(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (Array.isArray(value)) return new Uint8Array(value)
  throw new Error('需要 Uint8Array 形式的二进制数据')
}

function readElement(bytes, offset) {
  if (offset >= bytes.length) throw new Error('DER 数据意外结束')
  let cursor = offset
  const tag = bytes[cursor++]
  if ((tag & 0x1f) === 0x1f) {
    // High-tag-number form. None of the tags below use it, but consuming the
    // continuation bytes keeps the reader in sync for unusual certificates.
    while (cursor < bytes.length && bytes[cursor] & 0x80) cursor++
    cursor++
  }
  if (cursor >= bytes.length) throw new Error('DER 长度字段缺失')
  let length = bytes[cursor++]
  if (length & 0x80) {
    const byteCount = length & 0x7f
    if (byteCount === 0) throw new Error('不支持 DER 不定长编码')
    if (byteCount > 4) throw new Error('DER 长度字段过大')
    length = 0
    for (let index = 0; index < byteCount; index++) {
      if (cursor >= bytes.length) throw new Error('DER 长度字段不完整')
      length = length * 256 + bytes[cursor++]
    }
  }
  const valueStart = cursor
  const end = valueStart + length
  if (end > bytes.length) throw new Error('DER 长度超出数据范围')
  return { tag, start: offset, valueStart, end, length, content: bytes.subarray(valueStart, end) }
}

class DerReader {
  constructor(bytes) {
    this.bytes = bytes
    this.offset = 0
  }

  get done() {
    return this.offset >= this.bytes.length
  }

  peek() {
    return readElement(this.bytes, this.offset)
  }

  read() {
    const element = readElement(this.bytes, this.offset)
    this.offset = element.end
    return element
  }

  readExpected(tag, label) {
    const element = this.read()
    if (element.tag !== tag) {
      throw new Error(`${label}的 DER 标签无效（期望 0x${tag.toString(16)}，实际 0x${element.tag.toString(16)}）`)
    }
    return element
  }
}

function childReader(element) {
  return new DerReader(element.content)
}

function decodeAscii(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return text
}

function decodeUtf8(bytes) {
  return new TextDecoder('utf-8').decode(bytes)
}

function decodeBmp(bytes) {
  let text = ''
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    text += String.fromCharCode((bytes[index] << 8) | bytes[index + 1])
  }
  return text
}

function decodeUniversalString(bytes) {
  let text = ''
  for (let index = 0; index + 3 < bytes.length; index += 4) {
    const codePoint = ((bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3]) >>> 0
    text += String.fromCodePoint(codePoint)
  }
  return text
}

function decodeString(element) {
  switch (element.tag) {
    case TAG.UTF8_STRING:
      return decodeUtf8(element.content)
    case TAG.BMP_STRING:
      return decodeBmp(element.content)
    case TAG.UNIVERSAL_STRING:
      return decodeUniversalString(element.content)
    case TAG.PRINTABLE_STRING:
    case TAG.IA5_STRING:
    case TAG.T61_STRING:
      return decodeAscii(element.content)
    default:
      return decodeUtf8(element.content).replace(/\0+$/, '')
  }
}

function decodeOid(bytes) {
  if (!bytes.length) throw new Error('OID 内容为空')
  const arcs = []
  const first = bytes[0]
  const firstArc = first < 40 ? 0 : first < 80 ? 1 : 2
  arcs.push(firstArc, first - firstArc * 40)
  let value = 0
  for (let index = 1; index < bytes.length; index++) {
    value = value * 128 + (bytes[index] & 0x7f)
    if ((bytes[index] & 0x80) === 0) {
      arcs.push(value)
      value = 0
    }
  }
  return arcs.join('.')
}

function integerBytes(element) {
  const bytes = element.content
  let index = 0
  while (index < bytes.length - 1 && bytes[index] === 0) index++
  return bytes.subarray(index)
}

function hexBytes(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('')
}

function integerToNumber(element) {
  const bytes = integerBytes(element)
  if (bytes.length > 6) throw new Error('DER 整数超出可表示范围')
  let value = 0
  for (const byte of bytes) value = value * 256 + byte
  return value
}

function bitLength(bytes) {
  const value = bytes[0] === 0 ? bytes.subarray(1) : bytes
  if (!value.length) return 0
  let bits = 0
  let high = value[0]
  while (high) {
    bits++
    high >>= 1
  }
  return (value.length - 1) * 8 + bits
}

function isBitSet(bytes, index) {
  const byteIndex = Math.floor(index / 8)
  if (byteIndex >= bytes.length) return false
  return (bytes[byteIndex] & (0x80 >> (index % 8))) !== 0
}

function formatIpAddress(bytes) {
  if (bytes.length === 4) return [...bytes].join('.')
  if (bytes.length === 16) {
    const groups = []
    for (let index = 0; index < 16; index += 2) groups.push(((bytes[index] << 8) | bytes[index + 1]).toString(16))
    // Compress the longest run of zero groups, like RFC 5952.
    let bestStart = -1
    let bestLength = 0
    let runStart = -1
    for (let index = 0; index <= groups.length; index++) {
      if (index < groups.length && groups[index] === '0') {
        if (runStart < 0) runStart = index
      } else if (runStart >= 0) {
        const runLength = index - runStart
        if (runLength > bestLength && runLength > 1) {
          bestStart = runStart
          bestLength = runLength
        }
        runStart = -1
      }
    }
    if (bestStart < 0) return groups.join(':')
    const before = groups.slice(0, bestStart).join(':')
    const after = groups.slice(bestStart + bestLength).join(':')
    return `${before}::${after}`
  }
  return formatFingerprint(bytes)
}

function parseTime(element) {
  const text = decodeAscii(element.content).trim()
  let match
  let year
  let month
  let day
  let hour
  let minute
  let second = 0
  let zone = 'Z'
  if (element.tag === TAG.UTC_TIME) {
    match = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{4})$/.exec(text)
    if (!match) throw new Error(`UTCTime 格式无效：${text}`)
    year = Number(match[1])
    year += year < 50 ? 2000 : 1900
    month = Number(match[2])
    day = Number(match[3])
    hour = Number(match[4])
    minute = Number(match[5])
    second = Number(match[6] ?? 0)
    zone = match[7]
  } else if (element.tag === TAG.GENERALIZED_TIME) {
    match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?(Z|[+-]\d{4})$/.exec(text)
    if (!match) throw new Error(`GeneralizedTime 格式无效：${text}`)
    year = Number(match[1])
    month = Number(match[2])
    day = Number(match[3])
    hour = Number(match[4])
    minute = Number(match[5])
    second = Number(match[6])
    zone = match[7]
  } else {
    throw new Error('有效期使用了不支持的 DER 时间类型')
  }

  let offsetMinutes = 0
  if (zone !== 'Z') {
    const sign = zone[0] === '+' ? 1 : -1
    offsetMinutes = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)))
  }
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60000)
  if (Number.isNaN(date.getTime())) throw new Error(`有效期时间无效：${text}`)
  return date
}

function parseName(element) {
  const reader = childReader(element)
  const values = {}
  const entries = []
  while (!reader.done) {
    const rdn = reader.readExpected(TAG.SET, '相对可分辨名称')
    const rdnReader = childReader(rdn)
    while (!rdnReader.done) {
      const attribute = rdnReader.readExpected(TAG.SEQUENCE, '名称属性')
      const attributeReader = childReader(attribute)
      const oid = decodeOid(attributeReader.readExpected(TAG.OID, '名称属性 OID').content)
      const valueElement = attributeReader.read()
      const value = decodeString(valueElement)
      const key = NAME_OIDS[oid] || oid
      entries.push({ oid, key, value })
      values[key] = values[key] === undefined ? value : `${values[key]}, ${value}`
    }
  }
  const text = entries.map(entry => `${entry.key}=${entry.value}`).join(', ')
  return { values, entries, text }
}

function parseAlgorithmIdentifier(element) {
  const reader = childReader(element)
  const oid = decodeOid(reader.readExpected(TAG.OID, '算法标识符').content)
  let parameters = null
  if (!reader.done) {
    const parameterElement = reader.read()
    parameters = { tag: parameterElement.tag, content: parameterElement.content }
  }
  return {
    oid,
    name: ALGORITHM_NAMES[oid] || oid,
    parameters
  }
}

function parseSubjectPublicKeyInfo(element) {
  const reader = childReader(element)
  const algorithm = parseAlgorithmIdentifier(reader.readExpected(TAG.SEQUENCE, '公钥算法'))
  const keyElement = reader.readExpected(TAG.BIT_STRING, '公钥位串')
  const raw = keyElement.content
  if (!raw.length) throw new Error('公钥位串为空')
  const unusedBits = raw[0]
  if (unusedBits > 7) throw new Error('公钥位串的填充位无效')
  const keyBytes = raw.subarray(1)

  let publicKeyBits = keyBytes.length * 8 - unusedBits
  if (algorithm.oid === OID.rsaEncryption || algorithm.oid === OID.rsassaPss) {
    try {
      // keyBytes is the DER RSAPublicKey SEQUENCE itself; its content starts
      // with the modulus INTEGER.
      const keyReader = childReader(readElement(keyBytes, 0))
      const modulus = keyReader.readExpected(TAG.INTEGER, 'RSA 模数')
      publicKeyBits = bitLength(integerBytes(modulus))
    } catch {
      // Fall back to the bit string length when the RSA structure is unusual.
    }
  } else if (algorithm.oid === OID.ecPublicKey) {
    if (algorithm.parameters?.tag === TAG.OID) {
      const curveOid = decodeOid(algorithm.parameters.content)
      publicKeyBits = CURVE_BITS[curveOid] ?? publicKeyBits
    }
  }

  return {
    publicKeyAlgorithm: PUBLIC_KEY_NAMES[algorithm.oid] || algorithm.name,
    publicKeyAlgorithmOid: algorithm.oid,
    publicKeyBits
  }
}

function parseSanExtension(bytes, target) {
  const reader = new DerReader(bytes)
  const sequence = reader.readExpected(TAG.SEQUENCE, 'SAN 列表')
  const names = childReader(sequence)
  while (!names.done) {
    const name = names.read()
    const tagNumber = name.tag & 0x1f
    if (tagNumber === CONTEXT_DNS) target.dns.push(decodeString(name))
    else if (tagNumber === CONTEXT_EMAIL) target.email.push(decodeString(name))
    else if (tagNumber === CONTEXT_URI) target.uri.push(decodeString(name))
    else if (tagNumber === CONTEXT_IP) target.ip.push(formatIpAddress(name.content))
  }
}

function parseBasicConstraintsExtension(bytes) {
  const reader = new DerReader(bytes)
  const sequence = reader.readExpected(TAG.SEQUENCE, '基本约束')
  const constraints = childReader(sequence)
  let isCA = false
  let pathLenConstraint = null
  if (!constraints.done && constraints.peek().tag === TAG.BOOLEAN) {
    isCA = constraints.read().content.some(byte => byte !== 0)
  }
  if (!constraints.done && constraints.peek().tag === TAG.INTEGER) {
    pathLenConstraint = integerToNumber(constraints.read())
  }
  return { isCA, pathLenConstraint }
}

function parseKeyUsageExtension(bytes) {
  const reader = new DerReader(bytes)
  const bitString = reader.readExpected(TAG.BIT_STRING, '密钥用法')
  const raw = bitString.content
  if (!raw.length) return []
  const unusedBits = raw[0]
  const bits = raw.subarray(1)
  const availableBits = Math.max(0, bits.length * 8 - unusedBits)
  const usage = []
  for (let index = 0; index < KEY_USAGE_NAMES.length; index++) {
    if (index < availableBits && isBitSet(bits, index)) usage.push(KEY_USAGE_NAMES[index])
  }
  return usage
}

function parseExtensions(element) {
  const reader = childReader(element)
  const sequence = reader.readExpected(TAG.SEQUENCE, '扩展列表')
  const extensions = childReader(sequence)
  const result = []
  while (!extensions.done) {
    const extension = extensions.readExpected(TAG.SEQUENCE, '扩展项')
    const extensionReader = childReader(extension)
    const oid = decodeOid(extensionReader.readExpected(TAG.OID, '扩展 OID').content)
    let critical = false
    if (!extensionReader.done && extensionReader.peek().tag === TAG.BOOLEAN) {
      critical = extensionReader.read().content.some(byte => byte !== 0)
    }
    const value = extensionReader.readExpected(TAG.OCTET_STRING, '扩展值').content
    result.push({ oid, critical, value })
  }
  return result
}

function parseTbsCertificate(element) {
  const reader = childReader(element)
  let version = 1
  if (!reader.done && reader.peek().tag === CONTEXT_0) {
    const versionReader = childReader(reader.read())
    version = integerToNumber(versionReader.readExpected(TAG.INTEGER, '版本号')) + 1
  }
  const serialNumber = hexBytes(integerBytes(reader.readExpected(TAG.INTEGER, '序列号')))
  reader.readExpected(TAG.SEQUENCE, '签名算法')
  const issuer = parseName(reader.readExpected(TAG.SEQUENCE, '颁发者'))
  const validityReader = childReader(reader.readExpected(TAG.SEQUENCE, '有效期'))
  const notBefore = parseTime(validityReader.read())
  const notAfter = parseTime(validityReader.read())
  const subject = parseName(reader.readExpected(TAG.SEQUENCE, '主体'))
  const publicKey = parseSubjectPublicKeyInfo(reader.readExpected(TAG.SEQUENCE, '公钥信息'))

  let extensions = []
  while (!reader.done) {
    const extra = reader.read()
    if (extra.tag === CONTEXT_3) extensions = parseExtensions(extra)
  }

  const san = { dns: [], ip: [], email: [], uri: [] }
  let isCA = false
  let pathLenConstraint = null
  let keyUsage = []
  for (const extension of extensions) {
    if (extension.oid === '2.5.29.17') parseSanExtension(extension.value, san)
    else if (extension.oid === '2.5.29.19') {
      const basic = parseBasicConstraintsExtension(extension.value)
      isCA = basic.isCA
      pathLenConstraint = basic.pathLenConstraint
    } else if (extension.oid === '2.5.29.15') {
      keyUsage = parseKeyUsageExtension(extension.value)
    }
  }

  return {
    version,
    serialNumber,
    issuer: issuer.values,
    issuerText: issuer.text,
    subject: subject.values,
    subjectText: subject.text,
    notBefore,
    notAfter,
    ...publicKey,
    san,
    keyUsage,
    isCA,
    pathLenConstraint
  }
}

// --- Public API -----------------------------------------------------------

export function pemToDer(text) {
  if (text instanceof Uint8Array) return text
  if (text instanceof ArrayBuffer) return new Uint8Array(text)
  if (ArrayBuffer.isView(text)) return toBytes(text)
  const value = String(text ?? '').trim()
  if (!value) throw new Error('请输入证书内容')

  let body = value
  if (value.includes('-----BEGIN')) {
    const match = /-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/.exec(value)
    if (!match) throw new Error('PEM 格式不完整，请检查 BEGIN/END 标记是否配对')
    if (!/CERTIFICATE/i.test(match[1])) {
      throw new Error(`不支持该 PEM 类型（${match[1].trim()}），请粘贴 X.509 证书`)
    }
    body = match[2]
  }
  body = body.replace(/\s+/g, '')
  if (!body) throw new Error('PEM 内容为空')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new Error('PEM 的 Base64 内容包含非法字符')

  let binary
  try {
    binary = atob(body)
  } catch {
    throw new Error('PEM 的 Base64 内容无效')
  }
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  if (!bytes.length) throw new Error('证书内容为空')
  if (bytes[0] !== TAG.SEQUENCE) throw new Error('不是有效的 DER 证书：缺少 SEQUENCE 头')
  return bytes
}

export function formatFingerprint(bytes) {
  const value = toBytes(bytes)
  return [...value].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(':')
}

export function parseCertificate(pemOrDer) {
  const der = pemToDer(pemOrDer)
  const rootReader = new DerReader(der)
  const certificate = rootReader.readExpected(TAG.SEQUENCE, '证书')
  const certificateReader = childReader(certificate)
  const tbs = parseTbsCertificate(certificateReader.readExpected(TAG.SEQUENCE, 'TBSCertificate'))
  const signature = parseAlgorithmIdentifier(certificateReader.readExpected(TAG.SEQUENCE, '签名算法'))
  certificateReader.readExpected(TAG.BIT_STRING, '签名值')

  return {
    version: tbs.version,
    versionLabel: `v${tbs.version}`,
    serialNumber: tbs.serialNumber,
    subject: tbs.subject,
    subjectText: tbs.subjectText,
    issuer: tbs.issuer,
    issuerText: tbs.issuerText,
    notBefore: tbs.notBefore,
    notAfter: tbs.notAfter,
    notBeforeISO: tbs.notBefore.toISOString(),
    notAfterISO: tbs.notAfter.toISOString(),
    signatureAlgorithm: signature.name,
    signatureAlgorithmOid: signature.oid,
    publicKeyAlgorithm: tbs.publicKeyAlgorithm,
    publicKeyAlgorithmOid: tbs.publicKeyAlgorithmOid,
    publicKeyBits: tbs.publicKeyBits,
    san: tbs.san,
    keyUsage: tbs.keyUsage,
    isCA: tbs.isCA,
    pathLenConstraint: tbs.pathLenConstraint,
    fingerprintSha1: formatFingerprint(sha1(der)),
    fingerprintSha256: formatFingerprint(sha256(der))
  }
}

// Async variant for callers that would rather use WebCrypto. `parseCertificate`
// stays synchronous, so this is only a convenience helper.
export async function computeFingerprints(pemOrDer) {
  const der = pemToDer(pemOrDer)
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    return { sha1: formatFingerprint(sha1(der)), sha256: formatFingerprint(sha256(der)) }
  }
  const [sha1Buffer, sha256Buffer] = await Promise.all([subtle.digest('SHA-1', der), subtle.digest('SHA-256', der)])
  return {
    sha1: formatFingerprint(new Uint8Array(sha1Buffer)),
    sha256: formatFingerprint(new Uint8Array(sha256Buffer))
  }
}

export function describeCertificateValidity(certificate, now = Date.now()) {
  const before = certificate.notBefore.getTime()
  const after = certificate.notAfter.getTime()
  if (now < before) {
    return {
      status: 'not-yet-valid',
      label: '尚未生效',
      valid: false,
      days: Math.ceil((before - now) / 86400000)
    }
  }
  if (now > after) {
    return {
      status: 'expired',
      label: '已过期',
      valid: false,
      days: Math.floor((now - after) / 86400000)
    }
  }
  return {
    status: 'valid',
    label: '有效',
    valid: true,
    days: Math.ceil((after - now) / 86400000)
  }
}

export function formatCertificateDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const pad = value => String(value).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  )
}

function formatSerial(serial) {
  return serial.replace(/(.{2})(?=.)/g, '$1:')
}

// --- SHA-1 / SHA-256 ------------------------------------------------------
//
// Small synchronous implementations so `parseCertificate` does not need to be
// async. They are verified against OpenSSL fingerprints in the test suite.

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]

function sha256(bytes) {
  const data = toBytes(bytes)
  const bitLength = data.length * 8
  const paddedLength = ((data.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(data)
  padded[data.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const schedule = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const position = offset + index * 4
      schedule[index] = (padded[position] << 24) | (padded[position + 1] << 16) | (padded[position + 2] << 8) | padded[position + 3]
    }
    for (let index = 16; index < 64; index++) {
      const before15 = schedule[index - 15]
      const before2 = schedule[index - 2]
      const s0 = rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3)
      const s1 = rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10)
      schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let index = 0; index < 64; index++) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + SHA256_K[index] + schedule[index]) >>> 0
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  const output = new Uint8Array(32)
  const outputView = new DataView(output.buffer)
  hash.forEach((value, index) => outputView.setUint32(index * 4, value))
  return output
}

function sha1(bytes) {
  const data = toBytes(bytes)
  const bitLength = data.length * 8
  const paddedLength = ((data.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(data)
  padded[data.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  const hash = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
  const schedule = new Uint32Array(80)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const position = offset + index * 4
      schedule[index] = (padded[position] << 24) | (padded[position + 1] << 16) | (padded[position + 2] << 8) | padded[position + 3]
    }
    for (let index = 16; index < 80; index++) {
      schedule[index] = rotateLeft(schedule[index - 3] ^ schedule[index - 8] ^ schedule[index - 14] ^ schedule[index - 16], 1)
    }

    let [a, b, c, d, e] = hash
    for (let index = 0; index < 80; index++) {
      let f
      let k
      if (index < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (index < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = (rotateLeft(a, 5) + f + e + k + schedule[index]) >>> 0
      e = d
      d = c
      c = rotateLeft(b, 30)
      b = a
      a = temp
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
  }

  const output = new Uint8Array(20)
  const outputView = new DataView(output.buffer)
  hash.forEach((value, index) => outputView.setUint32(index * 4, value))
  return output
}

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits))
}

function rotateLeft(value, bits) {
  return (value << bits) | (value >>> (32 - bits))
}

// --- UI -------------------------------------------------------------------

const SAMPLE_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDzDCCArSgAwIBAgIUUEMuqLc9O2cAxNRvwhhesFQAxKAwDQYJKoZIhvcNAQEL
BQAwTzELMAkGA1UEBhMCQ04xFjAUBgNVBAoMDU9ubGluZVRvb2xib3gxCzAJBgNV
BAsMAlFBMRswGQYDVQQDDBJPbmxpbmVUb29sYm94IFRlc3QwHhcNMjQwMTAxMDAw
MDAwWhcNMzQwMTAxMDAwMDAwWjBPMQswCQYDVQQGEwJDTjEWMBQGA1UECgwNT25s
aW5lVG9vbGJveDELMAkGA1UECwwCUUExGzAZBgNVBAMMEk9ubGluZVRvb2xib3gg
VGVzdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANMxgyPU/2uUbx04
RGDlIZqwc+G3sEu7xzxC8Wa42uvbVVGnkITcu1WXxpb5hcXGLpfodfPbgadbodWa
fl2xfChnsL+Ss1dcMpVNtBhPwnzdYzkYmn9LpCCBs6KnkLprr6mcWc0Lkmay9EMy
WCjPoG70vLD/NQG8p6lYbLHRFJSWIaszoN8x3CeJYYrq+B3mcLTg5EAp12Ay0Mzv
caokRnrqhxv/SsbWHSnqNs2xG3j8hbbAI2CSE5pB86YdOPKia9HZu/ub4ROE9SCc
CCmZDRNNl30IH7YIZtQ47ZPVBOeHw4yC7/dkckyNxLG1LtHBWH5ktBNdu5dKUUA5
SA3VsssCAwEAAaOBnzCBnDBaBgNVHREEUzBRggtleGFtcGxlLmNvbYIPd3d3LmV4
YW1wbGUuY29thwR/AAABgRFhZG1pbkBleGFtcGxlLmNvbYYYaHR0cHM6Ly9leGFt
cGxlLmNvbS9jZXJ0MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0G
A1UdDgQWBBSPL7bC9Sqpnc1usp3yGOtMb/IbOTANBgkqhkiG9w0BAQsFAAOCAQEA
WkT0BL4DWIQiV8go8a11p26UIaXX51jKd7+ofbhqWL6QS00f2ySz+cKeqDNa/5+e
QAlKfNiZchYmh2twET7SLrNNWPulPAs8ZZXpVQ/+Q5/wEagDVrf1DfDuo6GVTACJ
VNjsNx3eRZVrwjTIQPQcKfAgFMiX47UThy844XXGHU7AlLORHdIeKl9HXvb+rmmK
k/Axh6O3A4R7IZll9lqDLCBYrhge1xl+ZDXoxMVzYAc+/G043af9xow8whOylqcV
aXKCO8MGueFhFYh4uC6dYXR1aUyYw1F+gNcn2qWADhOvKne2uD1yQHy05K+cWXUH
k6EYrmgKQ6088I51ONfDtQ==
-----END CERTIFICATE-----`

function derToPem(der) {
  let binary = ''
  for (const byte of der) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`
}

function nameRows(name) {
  return Object.entries(name).map(([key, value]) => ({
    label: NAME_LABELS[key] || key,
    value
  }))
}

function keyUsageText(keyUsage) {
  if (!keyUsage.length) return '（未声明）'
  return keyUsage.map(name => KEY_USAGE_LABELS[name] || name).join('、')
}

function sanRows(san) {
  const rows = []
  if (san.dns.length) rows.push({ label: 'DNS 名称', value: san.dns.join('、') })
  if (san.ip.length) rows.push({ label: 'IP 地址', value: san.ip.join('、') })
  if (san.email.length) rows.push({ label: '邮箱地址', value: san.email.join('、') })
  if (san.uri.length) rows.push({ label: 'URI', value: san.uri.join('、') })
  return rows
}

export default {
  render(container) {
    let currentDer = null
    let lastCertificate = null

    const input = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      spellcheck: 'false',
      'aria-label': '证书 PEM 内容',
      placeholder: '-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----'
    })

    const fileInput = createElement('input', {
      className: 'input',
      type: 'file',
      accept: '.pem,.crt,.cer,application/x-pem-file,application/x-x509-ca-cert',
      'aria-label': '上传证书文件'
    })

    const status = createElement('div', { className: 'loading-text', role: 'status', 'aria-live': 'polite' })
    const errorEl = createElement('div', { className: 'error-text' })
    const validity = createElement('div', { className: 'form-hint', role: 'status', 'aria-live': 'polite' })

    const table = createElement('table', { className: 'result-table' }, [
      createElement('thead', {}, [
        createElement('tr', {}, [createElement('th', { textContent: '项目' }), createElement('th', { textContent: '值' })])
      ]),
      createElement('tbody')
    ])
    const tableBody = table.querySelector('tbody')
    const resultSection = createSection('证书详情', createTableScroll(table, '证书解析结果'))
    resultSection.hidden = true

    const copyFingerprintButton = createCopyButton(() => lastCertificate?.fingerprintSha256 ?? '')
    copyFingerprintButton.title = '复制 SHA-256 指纹'
    copyFingerprintButton.setAttribute('aria-label', '复制 SHA-256 指纹')

    const parseButton = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '解析证书',
      onClick: () => {
        runParse()
      }
    })
    const sampleButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = SAMPLE_CERTIFICATE
        currentDer = null
        runParse()
      }
    })
    const clearButton = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        input.value = ''
        currentDer = null
        lastCertificate = null
        errorEl.textContent = ''
        status.textContent = ''
        validity.textContent = ''
        validity.className = 'form-hint'
        tableBody.replaceChildren()
        resultSection.hidden = true
        input.focus()
      }
    })

    function appendGroup(title, rows) {
      if (!rows.length) return
      tableBody.appendChild(
        createElement('tr', { className: 'result-table-group' }, [
          createElement('th', { colSpan: 2, scope: 'colgroup', textContent: title })
        ])
      )
      for (const row of rows) {
        tableBody.appendChild(
          createElement('tr', {}, [
            createElement('th', { scope: 'row', textContent: row.label }),
            createElement('td', { className: 'code-text', textContent: row.value })
          ])
        )
      }
    }

    function renderCertificate(certificate, now = Date.now()) {
      lastCertificate = certificate
      tableBody.replaceChildren()
      appendGroup('基本信息', [
        { label: '版本', value: certificate.versionLabel },
        { label: '序列号', value: formatSerial(certificate.serialNumber) },
        { label: '签名算法', value: certificate.signatureAlgorithm },
        { label: '公钥算法', value: certificate.publicKeyAlgorithm },
        { label: '公钥长度', value: `${certificate.publicKeyBits} 位` }
      ])
      appendGroup('主体', nameRows(certificate.subject))
      appendGroup('颁发者', nameRows(certificate.issuer))
      const state = describeCertificateValidity(certificate, now)
      const statusText =
        state.status === 'valid'
          ? `有效（剩余 ${state.days} 天）`
          : state.status === 'expired'
            ? `已过期（已过期 ${state.days} 天）`
            : `尚未生效（${state.days} 天后生效）`
      appendGroup('有效期', [
        { label: '生效时间', value: formatCertificateDate(certificate.notBefore) },
        { label: '到期时间', value: formatCertificateDate(certificate.notAfter) },
        { label: '状态', value: statusText }
      ])
      const extensionRows = [
        ...sanRows(certificate.san),
        {
          label: '基本约束',
          value: certificate.isCA
            ? `CA:TRUE${certificate.pathLenConstraint === null ? '' : `，路径长度限制 ${certificate.pathLenConstraint}`}`
            : 'CA:FALSE'
        },
        { label: '密钥用法', value: keyUsageText(certificate.keyUsage) }
      ]
      appendGroup('扩展', extensionRows)
      appendGroup('指纹', [
        { label: 'SHA-1', value: certificate.fingerprintSha1 },
        { label: 'SHA-256', value: certificate.fingerprintSha256 }
      ])

      validity.className = `form-hint${state.valid ? '' : ' form-hint-warn'}`
      validity.textContent =
        state.status === 'valid'
          ? `证书当前有效，将于 ${formatCertificateDate(certificate.notAfter)} 到期。`
          : state.status === 'expired'
            ? `证书已于 ${formatCertificateDate(certificate.notAfter)} 过期，请勿继续使用。`
            : `证书尚未生效，将于 ${formatCertificateDate(certificate.notBefore)} 生效。`
      resultSection.hidden = false
    }

    function runParse(source) {
      errorEl.textContent = ''
      status.textContent = ''
      validity.textContent = ''
      validity.className = 'form-hint'
      parseButton.disabled = true
      try {
        const material = source ?? currentDer ?? input.value
        if (source === undefined && !currentDer && !input.value.trim()) throw new Error('请粘贴证书 PEM 内容或上传证书文件')
        const certificate = parseCertificate(material)
        renderCertificate(certificate)
        status.textContent = `已解析证书：${certificate.subject.CN || certificate.subjectText || '（无主体）'}`
      } catch (cause) {
        lastCertificate = null
        resultSection.hidden = true
        tableBody.replaceChildren()
        status.textContent = ''
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      } finally {
        currentDer = null
        parseButton.disabled = false
      }
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      errorEl.textContent = ''
      status.textContent = '正在读取证书文件…'
      validity.textContent = ''
      try {
        const buffer = new Uint8Array(await file.arrayBuffer())
        const text = new TextDecoder('utf-8').decode(buffer)
        if (text.includes('-----BEGIN')) {
          input.value = text.trim()
          currentDer = null
        } else {
          const der = pemToDer(buffer)
          input.value = derToPem(der)
          currentDer = der
        }
        runParse()
      } catch (cause) {
        status.textContent = ''
        errorEl.textContent = `读取证书失败：${cause instanceof Error ? cause.message : String(cause)}`
      } finally {
        fileInput.value = ''
      }
    })

    container.append(
      createElement('div', {
        className: 'privacy-notice',
        textContent: '🔒 证书只在本机浏览器中解析，不会上传到服务器。'
      }),
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '上传证书文件（.pem / .crt / .cer）' }),
        fileInput
      ]),
      createSection('证书 PEM', input),
      createElement('div', { className: 'btn-group' }, [parseButton, sampleButton, clearButton]),
      status,
      errorEl,
      validity,
      resultSection
    )
    resultSection.querySelector('.tool-section-header .btn-group')?.appendChild(copyFingerprintButton)
  }
}
