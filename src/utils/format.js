// Lazily loaded formatters.
//
// The hand-written CSS/HTML/SQL formatters could not handle nested markup or
// complex SQL, and they were the last reason to keep a parser in the main
// bundle. These loaders pull Prettier / sql-formatter only when a formatting
// button is pressed, so the tool chunks stay lazy and the home bundle is
// untouched.

let prettierPromise = null
const pluginCache = new Map()

const PLUGIN_LOADERS = {
  html: () => import('prettier/plugins/html'),
  postcss: () => import('prettier/plugins/postcss'),
  babel: () => import('prettier/plugins/babel'),
  estree: () => import('prettier/plugins/estree'),
  typescript: () => import('prettier/plugins/typescript')
}

const PARSER_PLUGINS = {
  html: ['html'],
  css: ['postcss'],
  scss: ['postcss'],
  less: ['postcss'],
  babel: ['babel', 'estree'],
  typescript: ['typescript', 'estree']
}

function loadPrettier() {
  if (!prettierPromise) {
    prettierPromise = import('prettier/standalone').then(module => module.default)
  }
  return prettierPromise
}

async function loadPlugins(names) {
  return Promise.all(names.map(async name => {
    if (!pluginCache.has(name)) {
      pluginCache.set(name, PLUGIN_LOADERS[name]().then(module => module.default || module))
    }
    return pluginCache.get(name)
  }))
}

export async function formatWithPrettier(code, parser = 'html', options = {}) {
  const plugins = PARSER_PLUGINS[parser]
  if (!plugins) throw new Error(`不支持的格式化解析器：${parser}`)
  const [prettier, loaded] = await Promise.all([loadPrettier(), loadPlugins(plugins)])
  return prettier.format(code, { parser, plugins: loaded, ...options })
}

export async function formatSql(code, language = 'sql') {
  const { format } = await import('sql-formatter')
  return format(code, {
    language,
    keywordCase: 'upper',
    tabWidth: 2,
    linesBetweenQueries: 1
  })
}

// Exposed for the SQL dialect picker and its tests.
export const SQL_DIALECTS = [
  { value: 'sql', label: '标准 SQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'transactsql', label: 'SQL Server (T-SQL)' }
]
