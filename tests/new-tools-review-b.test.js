import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import x509Tool, {
  computeFingerprints,
  describeCertificateValidity,
  formatCertificateDate,
  formatFingerprint,
  parseCertificate,
  pemToDer
} from '../src/tools/crypto/x509.js'
import schemaValidatorTool, { validateJsonSchema } from '../src/tools/devtool/json-schema-validator.js'
import qrScannerTool, { decodeQr, describeQrPayload } from '../src/tools/image/qr-scanner.js'
import sqlJsonTool, { jsonToInsert, parseInsertStatements, sqlToCsv, sqlToJson } from '../src/tools/converter/sql-json.js'
import { enhanceFormAccessibility } from '../src/utils/dom.js'

// Generated once with:
//   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 \
//     -not_before 20240101000000Z -not_after 20340101000000Z \
//     -subj "/C=CN/O=OnlineToolbox/OU=QA/CN=OnlineToolbox Test" \
//     -addext "subjectAltName=DNS:example.com,DNS:www.example.com,IP:127.0.0.1,email:admin@example.com,URI:https://example.com/cert" \
//     -addext "basicConstraints=critical,CA:TRUE" \
//     -addext "keyUsage=critical,digitalSignature,keyCertSign,cRLSign"
const CERT_PEM = `-----BEGIN CERTIFICATE-----
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

const CERT_SHA1 = '8E:C3:23:16:8E:A8:C0:59:A8:7E:28:76:82:3C:E7:60:0F:FC:58:57'
const CERT_SHA256 = '2B:24:F6:82:48:B6:44:98:95:A6:F7:A7:D5:94:B2:BE:15:57:77:13:C7:FF:12:09:86:DA:1C:65:A6:9B:84:D5'

let root

beforeEach(() => {
  root = document.createElement('main')
  document.body.replaceChildren(root)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Mirrors the app's render pipeline closely enough to exercise the same
// label/table wiring the smoke tests check.
function mount(tool) {
  tool.render(root)
  enhanceFormAccessibility(root)
  return root
}

function setValue(element, value) {
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function clickText(text) {
  const button = [...root.querySelectorAll('button')].find(item => item.textContent.includes(text))
  if (!button) throw new Error(`button not found: ${text}`)
  button.click()
  return button
}

function outputValue(index = 0) {
  return [...root.querySelectorAll('textarea[readonly]')][index]?.value ?? ''
}

function editableTextareas() {
  return [...root.querySelectorAll('textarea:not([readonly])')]
}

function errorText() {
  return [...root.querySelectorAll('.error-text')]
    .map(element => element.textContent)
    .filter(Boolean)
    .join(' | ')
}

function expectToolContract(id) {
  expect(root.childElementCount).toBeGreaterThan(0)
  for (const control of root.querySelectorAll('input, textarea, select')) {
    const hasName = control.labels?.length || control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')
    expect(Boolean(hasName), `${id}: unnamed ${control.tagName}`).toBe(true)
  }
  expect(root.querySelector('select.input'), `${id}: select uses text-input styling`).toBeNull()
  expect(root.querySelector('button[class="btn"]'), `${id}: button has no visual variant`).toBeNull()
  expect(root.querySelector('.tool-section .tool-section, .result-box .tool-section, .tool-section.result-box')).toBeNull()
  for (const table of root.querySelectorAll('table.result-table')) {
    expect(table.parentElement?.classList.contains('table-scroll'), `${id}: table is not scrollable`).toBe(true)
  }
  for (const group of root.querySelectorAll('[role="radiogroup"]')) {
    expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1)
  }
}

describe('X.509 证书解析', () => {
  it('parses a self-signed certificate from PEM and DER with exact fields', async () => {
    const der = pemToDer(CERT_PEM)
    expect(der).toBeInstanceOf(Uint8Array)
    expect(der[0]).toBe(0x30)
    expect(der.length).toBeGreaterThan(900)
    expect([...pemToDer(der)]).toEqual([...der])

    const certificate = parseCertificate(CERT_PEM)
    expect(certificate.version).toBe(3)
    expect(certificate.versionLabel).toBe('v3')
    expect(certificate.serialNumber).toBe('50432EA8B73D3B6700C4D46FC2185EB05400C4A0')
    expect(certificate.subject).toMatchObject({
      C: 'CN',
      O: 'OnlineToolbox',
      OU: 'QA',
      CN: 'OnlineToolbox Test'
    })
    expect(certificate.issuer).toEqual(certificate.subject)
    expect(certificate.subjectText).toBe('C=CN, O=OnlineToolbox, OU=QA, CN=OnlineToolbox Test')
    expect(certificate.notBefore.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    expect(certificate.notAfter.toISOString()).toBe('2034-01-01T00:00:00.000Z')
    expect(certificate.notBeforeISO).toBe('2024-01-01T00:00:00.000Z')
    expect(certificate.signatureAlgorithm).toBe('sha256WithRSAEncryption')
    expect(certificate.publicKeyAlgorithm).toBe('RSA')
    expect(certificate.publicKeyBits).toBe(2048)
    expect(certificate.san).toEqual({
      dns: ['example.com', 'www.example.com'],
      ip: ['127.0.0.1'],
      email: ['admin@example.com'],
      uri: ['https://example.com/cert']
    })
    expect(certificate.keyUsage).toEqual(['digitalSignature', 'keyCertSign', 'cRLSign'])
    expect(certificate.isCA).toBe(true)
    expect(certificate.pathLenConstraint).toBeNull()
    expect(certificate.fingerprintSha1).toBe(CERT_SHA1)
    expect(certificate.fingerprintSha256).toBe(CERT_SHA256)
    expect(certificate.fingerprintSha1.split(':')).toHaveLength(20)
    expect(certificate.fingerprintSha256.split(':')).toHaveLength(32)

    const fromDer = parseCertificate(der)
    expect(fromDer.subject.CN).toBe('OnlineToolbox Test')
    expect(fromDer.fingerprintSha256).toBe(CERT_SHA256)

    expect(formatFingerprint(new Uint8Array([0, 10, 255]))).toBe('00:0A:FF')
    expect(formatFingerprint([1, 2])).toBe('01:02')
    await expect(computeFingerprints(CERT_PEM)).resolves.toEqual({
      sha1: CERT_SHA1,
      sha256: CERT_SHA256
    })
  })

  it('flags expired and not-yet-valid certificates and rejects malformed input', () => {
    const certificate = parseCertificate(CERT_PEM)
    expect(describeCertificateValidity(certificate, Date.UTC(2026, 0, 1))).toMatchObject({
      status: 'valid',
      valid: true
    })
    expect(describeCertificateValidity(certificate, Date.UTC(2035, 0, 1))).toMatchObject({
      status: 'expired',
      valid: false
    })
    expect(describeCertificateValidity(certificate, Date.UTC(2023, 0, 1))).toMatchObject({
      status: 'not-yet-valid',
      valid: false
    })
    expect(formatCertificateDate(certificate.notAfter)).toBe('2034-01-01 00:00:00 UTC')

    expect(() => parseCertificate('')).toThrow(/请输入证书内容/)
    expect(() => pemToDer('not a certificate')).toThrow(/DER 证书/)
    expect(() => parseCertificate('-----BEGIN PRIVATE KEY-----\nAQID\n-----END PRIVATE KEY-----')).toThrow(/X\.509/)
    expect(() => pemToDer('-----BEGIN CERTIFICATE-----\n@@@@\n-----END CERTIFICATE-----')).toThrow(/非法字符/)
  })

  it('renders the UI, parses a pasted certificate and reports errors', async () => {
    mount(x509Tool)
    expectToolContract('x509')

    const input = root.querySelector('textarea')
    setValue(input, CERT_PEM)
    clickText('解析证书')

    await vi.waitFor(() => expect(root.querySelectorAll('.result-table tbody tr').length).toBeGreaterThan(10))
    const tableText = root.querySelector('.result-table').textContent
    expect(tableText).toContain('OnlineToolbox Test')
    expect(tableText).toContain('example.com')
    expect(tableText).toContain('admin@example.com')
    expect(tableText).toContain(CERT_SHA256)
    expect(tableText).toContain('CA:TRUE')

    const validity = [...root.querySelectorAll('.form-hint')].find(element => element.textContent.includes('证书'))
    expect(validity.textContent).toContain('当前有效')

    const copyButton = [...root.querySelectorAll('button')].find(button => button.title === '复制 SHA-256 指纹')
    expect(copyButton).not.toBeUndefined()
    copyButton.click()
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CERT_SHA256))

    clickText('清空')
    expect(input.value).toBe('')
    expect(root.querySelector('.result-table tbody').textContent).toBe('')

    setValue(input, 'not a certificate')
    clickText('解析证书')
    expect(errorText()).toContain('证书')
  })
})

describe('JSON Schema 校验', () => {
  const schema = JSON.stringify({
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['name', 'age', 'email'],
    properties: {
      name: { type: 'string', minLength: 2 },
      age: { type: 'integer', minimum: 0 },
      email: { type: 'string', format: 'email' },
      tags: { type: 'array', items: { type: 'string' }, uniqueItems: true }
    },
    additionalProperties: false
  })

  it('validates data and returns exact error objects', async () => {
    await expect(
      validateJsonSchema(
        schema,
        JSON.stringify({
          name: '张三',
          age: 28,
          email: 'zhangsan@example.com',
          tags: ['developer']
        })
      )
    ).resolves.toEqual({ valid: true, errors: [], schemaError: '' })

    const result = await validateJsonSchema(
      schema,
      JSON.stringify({
        name: 'A',
        age: -1,
        email: 'not-an-email',
        tags: ['a', 'a'],
        extra: true
      })
    )
    expect(result.valid).toBe(false)
    expect(result.schemaError).toBe('')

    expect(result.errors).toContainEqual({
      instancePath: '/name',
      message: '长度不能少于 2 个字符',
      keyword: 'minLength'
    })
    expect(result.errors).toContainEqual({
      instancePath: '/age',
      message: '值不能小于 0',
      keyword: 'minimum'
    })
    expect(result.errors).toContainEqual({
      instancePath: '/email',
      message: '格式不符合 email',
      keyword: 'format'
    })
    expect(result.errors).toContainEqual({
      instancePath: '',
      message: '不允许额外属性：extra',
      keyword: 'additionalProperties'
    })
    expect(result.errors.every(error => typeof error.instancePath === 'string')).toBe(true)

    const missing = await validateJsonSchema(schema, JSON.stringify({ age: 20 }))
    expect(missing.valid).toBe(false)
    expect(missing.errors).toEqual(
      expect.arrayContaining([
        { instancePath: '', message: '缺少必填属性：name', keyword: 'required' },
        { instancePath: '', message: '缺少必填属性：email', keyword: 'required' }
      ])
    )
  })

  it('reports JSON parse errors and supports 2020-12 schemas', async () => {
    await expect(validateJsonSchema('', '{}')).resolves.toMatchObject({
      valid: false,
      schemaError: '请输入 JSON Schema'
    })
    await expect(validateJsonSchema('{bad', '{}')).resolves.toMatchObject({
      valid: false,
      schemaError: expect.stringContaining('Schema 不是合法的 JSON')
    })
    const dataParseError = await validateJsonSchema('{"type":"object"}', '{bad')
    expect(dataParseError.valid).toBe(false)
    expect(dataParseError.schemaError).toBe('')
    expect(dataParseError.errors).toEqual([
      expect.objectContaining({ keyword: 'parse', message: expect.stringContaining('数据不是合法的 JSON') })
    ])

    const schema2020 = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['value'],
      properties: { value: { type: 'string' } }
    })
    const result = await validateJsonSchema(schema2020, JSON.stringify({ value: 1 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual({
      instancePath: '/value',
      message: '类型应为 string',
      keyword: 'type'
    })
  })

  it('renders the UI, shows a green result and lists validation errors', async () => {
    mount(schemaValidatorTool)
    expectToolContract('json-schema-validator')

    const [schemaInput, dataInput] = editableTextareas()
    setValue(schemaInput, schema)
    setValue(dataInput, JSON.stringify({ name: '张三', age: 28, email: 'zhangsan@example.com' }))
    clickText('校验')

    await vi.waitFor(() => expect(root.querySelector('.schema-validator-status.valid')).not.toBeNull())
    expect(root.querySelector('.schema-validator-status').textContent).toContain('校验通过')

    setValue(dataInput, JSON.stringify({ name: 'A', age: -1, email: 'bad', extra: true }))
    clickText('校验')
    await vi.waitFor(() => expect(root.querySelector('.schema-validator-status.invalid')).not.toBeNull())
    expect(root.querySelector('.schema-validator-status').textContent).toContain('校验未通过')
    const rows = [...root.querySelectorAll('.result-table tbody tr')]
    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(root.querySelector('.result-table').textContent).toContain('minLength')

    setValue(dataInput, '{bad')
    clickText('校验')
    await vi.waitFor(() => expect(errorText()).toContain('数据不是合法的 JSON'))
    expect(root.querySelector('.schema-validator-status').textContent).toBe('')
  })
})

describe('二维码识别', () => {
  it('classifies URL, Wi-Fi, vCard, mailto, tel, JSON and text payloads', () => {
    expect(describeQrPayload('https://example.com/path?q=1#top')).toEqual({
      type: 'url',
      label: '网址',
      fields: {
        url: 'https://example.com/path?q=1#top',
        protocol: 'https',
        host: 'example.com',
        path: '/path',
        query: 'q=1',
        hash: 'top'
      }
    })

    expect(describeQrPayload('WIFI:T:WPA;S:MyNet;P:p@ss;H:true;;')).toEqual({
      type: 'wifi',
      label: 'Wi-Fi 网络',
      fields: { ssid: 'MyNet', security: 'WPA', password: 'p@ss', hidden: true }
    })
    expect(describeQrPayload('WIFI:S:My\\;Net;T:WPA;P:a\\:b;;')).toMatchObject({
      type: 'wifi',
      fields: { ssid: 'My;Net', password: 'a:b', hidden: false }
    })
    expect(describeQrPayload('WIFI:S:Guest;;')).toMatchObject({
      type: 'wifi',
      fields: { ssid: 'Guest', security: 'nopass', password: '', hidden: false }
    })

    expect(
      describeQrPayload(
        [
          'BEGIN:VCARD',
          'VERSION:3.0',
          'FN:张三',
          'ORG:OnlineToolbox',
          'TITLE:工程师',
          'TEL:+8613800000000',
          'EMAIL:zhang@example.com',
          'URL:https://example.com',
          'END:VCARD'
        ].join('\n')
      )
    ).toEqual({
      type: 'vcard',
      label: '联系人名片',
      fields: {
        name: '张三',
        org: 'OnlineToolbox',
        title: '工程师',
        phone: '+8613800000000',
        email: 'zhang@example.com',
        url: 'https://example.com'
      }
    })

    expect(describeQrPayload('mailto:test@example.com?subject=Hello%20World&body=Hi')).toEqual({
      type: 'mailto',
      label: '电子邮件',
      fields: { email: 'test@example.com', subject: 'Hello World', body: 'Hi' }
    })
    expect(describeQrPayload('tel:+8613800000000')).toEqual({
      type: 'tel',
      label: '电话号码',
      fields: { phone: '+8613800000000' }
    })
    expect(describeQrPayload('{"name":"张三","age":28}')).toEqual({
      type: 'json',
      label: 'JSON 数据',
      fields: { kind: '对象', keys: ['name', 'age'] }
    })
    expect(describeQrPayload('[1,2,3]')).toEqual({
      type: 'json',
      label: 'JSON 数据',
      fields: { kind: '数组', count: 3 }
    })
    expect(describeQrPayload('  hello 二维码  ')).toEqual({
      type: 'text',
      label: '纯文本',
      fields: { text: 'hello 二维码', length: 9 }
    })
    expect(describeQrPayload('')).toEqual({ type: 'empty', label: '空内容', fields: {} })
    expect(describeQrPayload('{not json')).toMatchObject({ type: 'text' })
  })

  it('rejects invalid image data without loading a decoder', async () => {
    await expect(decodeQr(null)).rejects.toThrow(/像素数据/)
    await expect(decodeQr({ data: new Uint8ClampedArray(4), width: 0, height: 0 })).rejects.toThrow(/像素数据/)
  })

  it('renders the UI, accepts a selected image and reports the missing-file branch', () => {
    mount(qrScannerTool)
    expectToolContract('qr-scanner')

    const fileInput = root.querySelector('input[type="file"]')
    expect(fileInput.accept).toBe('image/*')
    expect(root.querySelector('.img-preview').getAttribute('alt')).toBe('所选二维码图片预览')
    expect(root.querySelector('textarea[readonly]')).not.toBeNull()

    clickText('识别二维码')
    expect(errorText()).toContain('请先选择或粘贴二维码图片')

    const file = new File([new Uint8Array([1, 2, 3])], 'qr.png', { type: 'image/png' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fileInput.dispatchEvent(new Event('change'))

    expect(root.querySelector('.img-preview').classList.contains('hidden')).toBe(false)
    expect(root.querySelector('.loading-text').textContent).toContain('已选择')
    expect(() => root.dispatchEvent(new Event('paste', { bubbles: true }))).not.toThrow()
    expect(root.querySelector('.result-table').closest('.tool-section').hidden).toBe(true)
  })
})

describe('SQL 与 JSON 转换', () => {
  const sql = `-- 用户数据
INSERT INTO \`users\` (\`id\`, "name", email) VALUES
  (1, 'O''Brien', NULL),
  (2, '张三', 'a@example.com');
/* 日志数据 */
INSERT INTO logs (id, created_at, active, score)
VALUES (3, NOW(), TRUE, -1.5);`

  it('parses INSERT statements, comments, quotes, NULL and functions', () => {
    expect(parseInsertStatements(sql)).toEqual([
      {
        table: 'users',
        columns: ['id', 'name', 'email'],
        rows: [
          [1, "O'Brien", null],
          [2, '张三', 'a@example.com']
        ]
      },
      {
        table: 'logs',
        columns: ['id', 'created_at', 'active', 'score'],
        rows: [[3, 'NOW()', true, -1.5]]
      }
    ])

    expect(() => parseInsertStatements('')).toThrow(/请输入 SQL 语句/)
    expect(() => parseInsertStatements('SELECT 1')).toThrow(/仅支持 INSERT 语句/)
    expect(() => parseInsertStatements('INSERT INTO t (a, b) VALUES (1)')).toThrow(/列数/)
    expect(() => parseInsertStatements('INSERT INTO t (a) VALUES (1')).toThrow(/SQL 解析失败/)
  })

  it('converts to JSON/CSV and back to INSERT statements', () => {
    expect(sqlToJson(sql, { pretty: false })).toBe(
      '[{"id":1,"name":"O\'Brien","email":null},{"id":2,"name":"张三","email":"a@example.com"},' +
        '{"id":3,"created_at":"NOW()","active":true,"score":-1.5}]'
    )
    expect(JSON.parse(sqlToJson(sql))).toHaveLength(3)

    expect(sqlToCsv("INSERT INTO t (a, b) VALUES (1, 'x,y'), (2, NULL)")).toBe('a,b\n1,"x,y"\n2,')

    expect(
      jsonToInsert(
        JSON.stringify([
          { id: 1, name: "O'Brien", email: null },
          { id: 2, name: '张三', email: 'a@example.com' }
        ]),
        'users'
      )
    ).toBe('INSERT INTO "users" ("id", "name", "email") VALUES\n' + "  (1, 'O''Brien', NULL),\n" + "  (2, '张三', 'a@example.com');")
    expect(jsonToInsert(JSON.stringify({ id: 1, name: 'Alice' }), 'app.users')).toBe(
      'INSERT INTO "app"."users" ("id", "name") VALUES (1, \'Alice\');'
    )

    expect(() => jsonToInsert('{bad', 'users')).toThrow(/JSON 解析失败/)
    expect(() => jsonToInsert('[]', 'users')).toThrow(/不能为空/)
    expect(() => jsonToInsert('{}', '')).toThrow(/表名格式无效/)
    expect(() => jsonToInsert('[{"id":1}, 2]', 'users')).toThrow(/不是对象/)
  })

  it('renders the UI and switches between SQL → JSON, SQL → CSV and JSON → SQL', () => {
    mount(sqlJsonTool)
    expectToolContract('sql-json')

    expect(root.querySelector('.segmented-group [aria-checked="true"]').textContent).toBe('SQL → JSON')
    const input = editableTextareas()[0]

    setValue(input, "INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob')")
    clickText('转换')
    expect(JSON.parse(outputValue())).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ])
    expect(root.querySelector('.form-hint').textContent).toContain('2 行')

    root.querySelector('.segmented-btn[data-value="sql-csv"]').click()
    clickText('转换')
    expect(outputValue()).toBe('id,name\n1,Alice\n2,Bob')

    root.querySelector('.segmented-btn[data-value="json-sql"]').click()
    const tableNameInput = root.querySelector('input[type="text"]')
    expect(tableNameInput.closest('.form-group').hidden).toBe(false)
    setValue(input, JSON.stringify([{ id: 1, name: "O'Brien" }]))
    setValue(tableNameInput, 'people')
    clickText('转换')
    expect(outputValue()).toBe('INSERT INTO "people" ("id", "name") VALUES (1, \'O\'\'Brien\');')

    root.querySelector('.segmented-btn[data-value="sql-json"]').click()
    setValue(input, 'SELECT 1')
    clickText('转换')
    expect(errorText()).toContain('仅支持 INSERT 语句')
    expect(outputValue()).toBe('')
  })
})
