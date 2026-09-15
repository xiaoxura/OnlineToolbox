import yaml from 'js-yaml'
import { createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

// docker run ↔ docker-compose.yml. Only a well-known flag set is translated;
// anything we cannot express is reported instead of being dropped silently.

// docker run flag (any spelling) → compose service key.
const FLAG_ALIASES = new Map([
  ['-d', 'detach'],
  ['--detach', 'detach'],
  ['--name', 'container_name'],
  ['-p', 'ports'],
  ['--publish', 'ports'],
  ['-v', 'volumes'],
  ['--volume', 'volumes'],
  ['-e', 'environment'],
  ['--env', 'environment'],
  ['--env-file', 'env_file'],
  ['--restart', 'restart'],
  ['--network', 'network_mode'],
  ['--hostname', 'hostname'],
  ['-w', 'working_dir'],
  ['--workdir', 'working_dir'],
  ['-u', 'user'],
  ['--user', 'user'],
  ['--entrypoint', 'entrypoint'],
  ['--rm', 'rm'],
  ['--privileged', 'privileged'],
  ['--cap-add', 'cap_add'],
  ['--cap-drop', 'cap_drop'],
  ['--label', 'labels'],
  ['--health-cmd', 'healthcheck'],
  ['-m', 'mem_limit'],
  ['--memory', 'mem_limit'],
  ['--cpus', 'cpus']
])

// Flags without a value.
const BOOLEAN_KEYS = new Set(['detach', 'rm', 'privileged'])
// Flags that may repeat — they become YAML lists.
const LIST_KEYS = new Set(['ports', 'volumes', 'environment', 'env_file', 'cap_add', 'cap_drop', 'labels'])
// Short flags that may carry their value inline (e.g. -p8080:80, -eFOO=bar).
const SHORT_VALUE_FLAGS = new Set(['-p', '-v', '-e', '-w', '-u', '-m'])

// Stable key order for the emitted service, so the same command always renders
// the same YAML.
const SERVICE_KEY_ORDER = [
  'image',
  'container_name',
  'attach',
  'ports',
  'volumes',
  'environment',
  'env_file',
  'restart',
  'network_mode',
  'hostname',
  'working_dir',
  'user',
  'entrypoint',
  'privileged',
  'cap_add',
  'cap_drop',
  'labels',
  'healthcheck',
  'mem_limit',
  'cpus',
  'command'
]

// Compose keys this converter knows how to turn back into docker run flags.
const COMPOSE_KEYS = new Set([
  'image', 'container_name', 'attach', 'ports', 'volumes', 'environment',
  'env_file', 'restart', 'network_mode', 'hostname', 'working_dir', 'user',
  'entrypoint', 'privileged', 'cap_add', 'cap_drop', 'labels', 'healthcheck',
  'mem_limit', 'cpus', 'command'
])

// Split a command line into tokens, honouring single/double quotes.
export function tokenizeCommand(command) {
  const text = String(command ?? '')
  const tokens = []
  let current = ''
  let quote = null
  let started = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === quote) {
        quote = null
        continue
      }
      // Inside double quotes only \" and \\ are escapes; single quotes are literal.
      if (char === '\\' && quote === '"' && i + 1 < text.length && ['"', '\\', '$', '`'].includes(text[i + 1])) {
        current += text[++i]
        continue
      }
      current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      started = true
      continue
    }
    if (char === '\\' && i + 1 < text.length) {
      current += text[++i]
      started = true
      continue
    }
    if (/\s/.test(char)) {
      if (started || current) {
        tokens.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += char
    started = true
  }
  if (quote) throw new Error('引号未闭合：请检查命令中的引号是否成对出现')
  if (started || current) tokens.push(current)
  return tokens
}

// Quote a value so the generated command can be pasted into a shell as-is.
export function shellQuote(value) {
  const text = String(value ?? '')
  if (!text) return "''"
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(text)) return text
  return `'${text.replace(/'/g, "'\\''")}'`
}

function reorderService(service) {
  const ordered = {}
  for (const key of SERVICE_KEY_ORDER) {
    if (service[key] !== undefined) ordered[key] = service[key]
  }
  for (const [key, value] of Object.entries(service)) {
    if (!(key in ordered)) ordered[key] = value
  }
  return ordered
}

// docker run … → { image, command, service, notices }
export function parseDockerRun(command) {
  const tokens = tokenizeCommand(String(command ?? '').trim())
  if (!tokens.length) throw new Error('请输入 docker run 命令')

  let index = 0
  if (tokens[0] !== 'docker') throw new Error('命令必须以 docker 开头，例如 docker run -p 80:80 nginx')
  index = 1
  if (tokens[index] === 'container') index++
  if (tokens[index] !== 'run') throw new Error('仅支持 docker run 命令')
  index++

  const service = {}
  const notices = []
  const args = []
  let image = null

  const pushList = (key, value) => {
    if (!service[key]) service[key] = []
    service[key].push(value)
  }

  const applyBoolean = key => {
    if (key === 'detach') {
      // compose 没有 detach 键，attach: false 是等价的“后台运行”写法。
      service.attach = false
      return
    }
    if (key === 'rm') {
      notices.push('--rm 是 docker run 的运行时参数，compose 无法表达，已从结果中省略（可用 docker compose run --rm 达到同样效果）')
      return
    }
    service[key] = true
  }

  const applyValue = (key, value) => {
    if (LIST_KEYS.has(key)) {
      pushList(key, value)
      return
    }
    if (key === 'healthcheck') {
      service.healthcheck = { test: ['CMD-SHELL', value] }
      return
    }
    // cpus accepts a number in compose; keep memory as text ("512m").
    if (key === 'cpus' && /^\d+(\.\d+)?$/.test(value)) {
      service.cpus = Number(value)
      return
    }
    service[key] = value
  }

  while (index < tokens.length) {
    const token = tokens[index]

    if (token === '--') {
      const rest = tokens.slice(index + 1)
      if (!rest.length) throw new Error('“--” 之后缺少镜像名称')
      image = rest[0]
      args.push(...rest.slice(1))
      break
    }

    // The first bare token is the image; everything after it is the command.
    if (!token.startsWith('-') || token === '-') {
      image = token
      args.push(...tokens.slice(index + 1))
      break
    }

    let flagName = token
    let inlineValue = null
    const equals = token.startsWith('--') ? token.indexOf('=') : -1
    if (equals > 0) {
      flagName = token.slice(0, equals)
      inlineValue = token.slice(equals + 1)
    } else if (token.length > 2 && SHORT_VALUE_FLAGS.has(token.slice(0, 2))) {
      // -p8080:80 / -eFOO=bar style
      flagName = token.slice(0, 2)
      inlineValue = token.slice(2)
    }

    const key = FLAG_ALIASES.get(flagName)
    if (!key) {
      throw new Error(`不支持的参数 ${flagName}：无法转换为 compose 配置，请手动处理（仅支持常用参数）`)
    }

    if (BOOLEAN_KEYS.has(key)) {
      if (inlineValue !== null) throw new Error(`参数 ${flagName} 不接受取值`)
      applyBoolean(key)
      index++
      continue
    }

    let value = inlineValue
    if (value === null) {
      value = tokens[index + 1]
      if (value === undefined) throw new Error(`参数 ${flagName} 缺少取值`)
      index++
    }
    applyValue(key, value)
    index++
  }

  if (!image) throw new Error('缺少镜像名称，例如 docker run nginx')

  const full = { image, ...service }
  if (args.length) full.command = args

  return {
    image,
    command: args,
    service: reorderService(full),
    notices
  }
}

export function serviceToComposeYaml(service) {
  const name = service.container_name ? String(service.container_name) : 'app'
  const body = reorderService({ ...service })
  return yaml.dump(
    { services: { [name]: body } },
    { noRefs: true, lineWidth: -1, sortKeys: false, quotingType: '"' }
  )
}

// docker run … → docker-compose.yml 文本
export function dockerRunToCompose(command) {
  const { service } = parseDockerRun(command)
  return serviceToComposeYaml(service)
}

function stringifyCommand(command) {
  if (command === undefined || command === null) return []
  if (Array.isArray(command)) return command.map(item => shellQuote(item))
  const text = String(command).trim()
  if (!text) return []
  // A shell-form command is already a command line; keep it verbatim.
  return [text]
}

function healthTestToCommand(healthcheck) {
  if (!healthcheck || typeof healthcheck !== 'object') return null
  const test = healthcheck.test
  if (typeof test === 'string') return test
  if (!Array.isArray(test) || !test.length) return null
  const [mode, ...rest] = test
  if (['CMD', 'CMD-SHELL', 'NONE'].includes(String(mode).toUpperCase())) {
    return rest.join(' ')
  }
  return test.join(' ')
}

// docker-compose.yml 文本 → { command, unknown }（unknown 为无法翻译的字段名）
export function composeToDockerRunWithNotices(source) {
  let document
  try {
    document = yaml.load(String(source ?? ''))
  } catch (cause) {
    throw new Error('YAML 解析失败：' + (cause instanceof Error ? cause.message.split('\n')[0] : String(cause)))
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('YAML 内容为空或格式不正确')
  }
  const services = document.services
  if (!services || typeof services !== 'object' || Array.isArray(services)) {
    throw new Error('未找到 services 配置，请提供 docker-compose.yml 内容')
  }
  const names = Object.keys(services)
  if (!names.length) throw new Error('services 中没有任何服务')
  if (names.length > 1) {
    throw new Error(`暂不支持包含多个服务的 compose 文件（当前有 ${names.length} 个服务），请只保留一个服务`)
  }
  const [name, service] = [names[0], services[names[0]]]
  if (!service || typeof service !== 'object') throw new Error(`服务 ${name} 的配置无效`)

  const parts = ['docker run']
  const unknown = Object.keys(service).filter(key => !COMPOSE_KEYS.has(key))

  if (service.attach === false) parts.push('-d')
  if (service.container_name) parts.push('--name', shellQuote(service.container_name))
  if (Array.isArray(service.ports)) {
    for (const port of service.ports) parts.push('-p', shellQuote(port))
  }
  if (Array.isArray(service.volumes)) {
    for (const volume of service.volumes) {
      // 长语法对象（type/source/target）无法压成 -v 一行，明确报错。
      if (volume && typeof volume === 'object') {
        throw new Error('volumes 中的长语法（type/source/target）暂不支持转换为 -v')
      }
      parts.push('-v', shellQuote(volume))
    }
  }
  if (Array.isArray(service.environment)) {
    for (const entry of service.environment) parts.push('-e', shellQuote(entry))
  } else if (service.environment && typeof service.environment === 'object') {
    for (const [key, value] of Object.entries(service.environment)) {
      parts.push('-e', shellQuote(value === null || value === undefined ? key : `${key}=${value}`))
    }
  }
  if (Array.isArray(service.env_file)) {
    for (const file of service.env_file) parts.push('--env-file', shellQuote(file))
  } else if (typeof service.env_file === 'string') {
    parts.push('--env-file', shellQuote(service.env_file))
  }
  if (service.restart) parts.push('--restart', shellQuote(service.restart))
  if (service.network_mode) parts.push('--network', shellQuote(service.network_mode))
  if (service.hostname) parts.push('--hostname', shellQuote(service.hostname))
  if (service.working_dir) parts.push('-w', shellQuote(service.working_dir))
  if (service.user) parts.push('-u', shellQuote(service.user))
  if (service.entrypoint !== undefined && service.entrypoint !== null) {
    const entrypoint = Array.isArray(service.entrypoint)
      ? service.entrypoint.map(item => shellQuote(item)).join(' ')
      : shellQuote(service.entrypoint)
    parts.push('--entrypoint', entrypoint)
  }
  if (service.privileged) parts.push('--privileged')
  if (Array.isArray(service.cap_add)) {
    for (const capability of service.cap_add) parts.push('--cap-add', shellQuote(capability))
  }
  if (Array.isArray(service.cap_drop)) {
    for (const capability of service.cap_drop) parts.push('--cap-drop', shellQuote(capability))
  }
  if (Array.isArray(service.labels)) {
    for (const label of service.labels) parts.push('--label', shellQuote(label))
  } else if (service.labels && typeof service.labels === 'object') {
    for (const [key, value] of Object.entries(service.labels)) parts.push('--label', shellQuote(`${key}=${value}`))
  }
  const healthCommand = healthTestToCommand(service.healthcheck)
  if (healthCommand) parts.push('--health-cmd', shellQuote(healthCommand))
  if (service.mem_limit) parts.push('-m', shellQuote(service.mem_limit))
  if (service.cpus !== undefined && service.cpus !== null) parts.push('--cpus', shellQuote(service.cpus))

  if (!service.image) throw new Error(`服务 ${name} 缺少 image 字段`)
  parts.push(shellQuote(service.image))
  parts.push(...stringifyCommand(service.command))

  // `unknown` is not fatal: a compose file legitimately carries keys docker run
  // has no equivalent for. Report them so nothing looks silently dropped.
  return { command: parts.join(' '), unknown }
}

// docker-compose.yml 文本 → docker run 命令
export function composeToDockerRun(source) {
  return composeToDockerRunWithNotices(source).command
}

const SAMPLE_RUN = 'docker run -d --name web -p 8080:80 -p 443:443 -v /data/www:/usr/share/nginx/html:ro -e TZ=Asia/Shanghai --env-file .env --restart unless-stopped --network mynet --hostname web01 -w /app -u 1000:1000 --cap-add NET_ADMIN --cap-drop ALL --label env=prod -m 512m --cpus 1.5 --health-cmd "curl -f http://localhost/" nginx:1.27 nginx -g "daemon off;"'

const SAMPLE_COMPOSE = [
  'services:',
  '  web:',
  '    image: nginx:1.27',
  '    container_name: web',
  '    attach: false',
  '    ports:',
  "      - '8080:80'",
  "      - '443:443'",
  '    volumes:',
  '      - /data/www:/usr/share/nginx/html:ro',
  '    environment:',
  '      - TZ=Asia/Shanghai',
  '    restart: unless-stopped',
  '    network_mode: mynet',
  '    mem_limit: 512m',
  '    cpus: 1.5',
  '    command:',
  '      - nginx',
  '      - -g',
  '      - daemon off;'
].join('\n')

export default {
  id: 'docker-compose-converter',
  name: 'Docker Run ↔ Compose',
  description: '在 docker run 命令与 docker-compose.yml 之间双向转换',
  category: 'devtool',
  icon: 'wrench',
  keywords: ['docker', 'compose', 'docker run', 'docker-compose.yml', '容器'],
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      placeholder: '粘贴 docker run 命令…'
    })
    const output = createElement('textarea', {
      className: 'textarea',
      rows: 10,
      readOnly: true,
      placeholder: '转换结果将显示在此…'
    })
    const errorEl = createElement('div', { className: 'error-text' })
    const noticeEl = createElement('div', { className: 'form-hint form-hint-warn' })

    // Section headings follow the direction, so they are patched on every switch.
    const inputSection = createSection('docker run 命令', input)
    const outputSection = createSection('docker-compose.yml', output)
    const inputTitle = inputSection.querySelector('h2')
    const outputTitle = outputSection.querySelector('h2')

    const toCompose = () => mode.getValue() === 'to-compose'

    const mode = createSegmentedGroup([
      { value: 'to-compose', label: 'docker run → compose' },
      { value: 'to-run', label: 'compose → docker run' }
    ], () => {
      const compose = toCompose()
      input.value = ''
      output.value = ''
      errorEl.textContent = ''
      noticeEl.textContent = ''
      input.placeholder = compose ? '粘贴 docker run 命令…' : '粘贴 docker-compose.yml 内容…'
      inputTitle.textContent = compose ? 'docker run 命令' : 'docker-compose.yml'
      outputTitle.textContent = compose ? 'docker-compose.yml' : 'docker run 命令'
    })

    function run() {
      errorEl.textContent = ''
      noticeEl.textContent = ''
      output.value = ''
      const text = input.value.trim()
      if (!text) {
        errorEl.textContent = toCompose() ? '请输入 docker run 命令' : '请输入 docker-compose.yml 内容'
        return
      }
      try {
        if (toCompose()) {
          const parsed = parseDockerRun(text)
          output.value = serviceToComposeYaml(parsed.service)
          if (parsed.notices.length) noticeEl.textContent = parsed.notices.join('；')
        } else {
          const result = composeToDockerRunWithNotices(text)
          output.value = result.command
          if (result.unknown.length) {
            noticeEl.textContent = `以下 compose 字段没有对应的 docker run 参数，已跳过：${result.unknown.join('、')}`
          }
        }
      } catch (cause) {
        errorEl.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    const convertBtn = createElement('button', {
      className: 'btn btn-primary',
      type: 'button',
      textContent: '转换',
      onClick: run
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        input.value = toCompose() ? SAMPLE_RUN : SAMPLE_COMPOSE
        run()
      }
    })

    input.addEventListener('input', () => {
      errorEl.textContent = ''
    })

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('div', { className: 'label', textContent: '转换方向' }),
          mode
        ])
      ]),
      createElement('div', { className: 'btn-group' }, [convertBtn, sampleBtn]),
      errorEl,
      inputSection,
      outputSection,
      noticeEl
    )
  }
}
