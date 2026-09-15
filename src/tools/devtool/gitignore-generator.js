import { createElement, createSection } from '../../utils/dom.js'

// Built-in .gitignore template library. Every template is a plain list of
// patterns; grouping drives the checkbox layout and the section order of the
// generated file. Sources follow the well-known GitHub/gitignore patterns.

export const GROUPS = [
  { id: 'language', label: '语言 / 运行时' },
  { id: 'framework', label: '框架' },
  { id: 'editor', label: '编辑器 / IDE' },
  { id: 'os', label: '操作系统' }
]

export const TEMPLATES = {
  // --- 语言 / 运行时 ---
  node: {
    label: 'Node.js',
    group: 'language',
    lines: [
      'node_modules/', 'bower_components/', 'jspm_packages/', '.npm/', '.pnpm-store/', '.yarn/cache',
      '.yarn/build-state.yml', '.node_repl_history', 'npm-debug.log*', 'yarn-debug.log*',
      'yarn-error.log*', 'pnpm-debug.log*', 'lerna-debug.log*', '.eslintcache', 'coverage/',
      '.nyc_output/', 'dist/', 'build/', '.cache/'
    ]
  },
  python: {
    label: 'Python',
    group: 'language',
    lines: [
      '__pycache__/', '*.py[cod]', '*$py.class', '*.so', '.Python', '.venv/', 'venv/', 'env/', 'ENV/',
      'build/', 'develop-eggs/', 'dist/', 'downloads/', 'eggs/', '.eggs/', 'sdist/', 'wheels/',
      '*.egg-info/', '*.egg', '.installed.cfg', '.mypy_cache/', '.pytest_cache/', '.ruff_cache/',
      '.coverage', '.coverage.*', 'htmlcov/', '.tox/', '.nox/', 'pip-log.txt', 'pip-delete-this-directory.txt'
    ]
  },
  java: {
    label: 'Java',
    group: 'language',
    lines: [
      '*.class', '*.jar', '*.war', '*.ear', '*.nar', 'target/', 'build/', 'out/', '.gradle/',
      'gradle-app.setting', '.gradletasknamecache', '.mtj.tmp/', 'hs_err_pid*', 'replay_pid*'
    ]
  },
  go: {
    label: 'Go',
    group: 'language',
    lines: [
      '*.exe', '*.exe~', '*.dll', '*.so', '*.dylib', '*.test', '*.out', 'bin/', 'vendor/',
      'go.work', 'go.work.sum', '.idea/', '*.prof'
    ]
  },
  rust: {
    label: 'Rust',
    group: 'language',
    lines: ['target/', '**/*.rs.bk', '*.pdb', '*.profraw', '.cargo/']
  },
  cpp: {
    label: 'C / C++',
    group: 'language',
    lines: [
      '*.o', '*.obj', '*.lo', '*.slo', '*.ko', '*.a', '*.lib', '*.so', '*.so.*', '*.dylib', '*.dll',
      '*.exe', '*.out', '*.app', '*.i', '*.ii', 'CMakeCache.txt', 'CMakeFiles/', 'CMakeScripts/',
      'cmake_install.cmake', 'compile_commands.json', 'build/', '.deps/', '*.gcda', '*.gcno', '*.gcov'
    ]
  },
  php: {
    label: 'PHP',
    group: 'language',
    lines: [
      '/vendor/', 'build/', 'coverage/', '*.log', '*.cache', '.phpunit.result.cache',
      '.php-cs-fixer.cache', 'composer.phar', 'php_errors.log'
    ]
  },
  ruby: {
    label: 'Ruby',
    group: 'language',
    lines: [
      '*.gem', '*.rbc', '/.bundle/', '/.yardoc/', '/_yardoc/', '/coverage/', '/doc/', '/pkg/',
      '/spec/reports/', '/tmp/', '/log/', '*.log', 'vendor/bundle/', '.rspec_status', '.ruby-lsp/'
    ]
  },
  swift: {
    label: 'Swift',
    group: 'language',
    lines: [
      '.build/', '.swiftpm/', 'DerivedData/', 'Packages/', 'xcuserdata/', '*.xcuserstate',
      '*.moved-aside', '*.pbxuser', '!default.pbxuser', '*.mode1v3', '!default.mode1v3',
      '*.mode2v3', '!default.mode2v3', '*.perspectivev3', '!default.perspectivev3'
    ]
  },
  kotlin: {
    label: 'Kotlin',
    group: 'language',
    lines: [
      '*.class', '*.jar', '*.war', 'build/', 'out/', '.gradle/', '.kotlin/', 'captures/',
      '.externalNativeBuild/', '.cxx/', 'local.properties', '*.hprof'
    ]
  },

  // --- 框架 ---
  react: {
    label: 'React',
    group: 'framework',
    lines: [
      'build/', '.env.local', '.env.development.local', '.env.test.local', '.env.production.local',
      '.eslintcache', 'coverage/'
    ]
  },
  vue: {
    label: 'Vue',
    group: 'framework',
    lines: ['dist/', 'dist-ssr/', '*.local', '.vite/', 'coverage/', '.eslintcache']
  },
  nextjs: {
    label: 'Next.js',
    group: 'framework',
    lines: ['/.next/', '/out/', '.vercel', 'next-env.d.ts', '.swc/', '.turbo/']
  },
  django: {
    label: 'Django',
    group: 'framework',
    lines: [
      '*.log', '*.pot', '*.pyc', '__pycache__/', 'db.sqlite3', 'db.sqlite3-journal', 'media/',
      'staticfiles/', '.env', 'local_settings.py'
    ]
  },
  flask: {
    label: 'Flask',
    group: 'framework',
    lines: ['instance/', '.env', '*.pyc', '__pycache__/', '.webassets-cache', 'app.db', '.flaskenv']
  },
  laravel: {
    label: 'Laravel',
    group: 'framework',
    lines: [
      '/vendor/', '/node_modules/', '/public/build/', '/public/hot', '/public/storage', '.env',
      '.env.backup', '.phpunit.result.cache', 'Homestead.json', 'Homestead.yaml', 'npm-debug.log',
      'yarn-error.log'
    ]
  },
  spring: {
    label: 'Spring',
    group: 'framework',
    lines: [
      'target/', 'build/', 'bin/', '!**/src/main/**/target/', '!**/src/test/**/target/',
      '.mvn/timing.properties', '.sts4-cache', '.apt_generated', '*.class'
    ]
  },

  // --- 编辑器 / IDE ---
  vscode: {
    label: 'VS Code',
    group: 'editor',
    lines: [
      '.vscode/*', '!.vscode/settings.json', '!.vscode/tasks.json', '!.vscode/launch.json',
      '!.vscode/extensions.json', '*.code-workspace', '.history/'
    ]
  },
  jetbrains: {
    label: 'JetBrains',
    group: 'editor',
    lines: ['.idea/', '*.iml', '*.iws', '*.ipr', 'out/', '.fleet/']
  },
  vim: {
    label: 'Vim',
    group: 'editor',
    lines: ['*.swp', '*.swo', '*.swn', '*~', '.vim/', 'tags', 'Session.vim', '.netrwhist']
  },
  sublime: {
    label: 'Sublime Text',
    group: 'editor',
    lines: ['*.sublime-workspace', '*.sublime-project', 'sftp-config.json']
  },

  // --- 操作系统 ---
  macos: {
    label: 'macOS',
    group: 'os',
    lines: [
      '.DS_Store', '.AppleDouble', '.LSOverride', '._*', '.Spotlight-V100', '.Trashes',
      '.fseventsd', '.DocumentRevisions-V100', '.TemporaryItems', '.VolumeIcon.icns',
      '.com.apple.timemachine.donotpresent'
    ]
  },
  windows: {
    label: 'Windows',
    group: 'os',
    lines: [
      'Thumbs.db', 'Thumbs.db:encryptable', 'ehthumbs.db', 'ehthumbs_vista.db', 'Desktop.ini',
      '$RECYCLE.BIN/', '*.lnk', '*.stackdump'
    ]
  },
  linux: {
    label: 'Linux',
    group: 'os',
    lines: ['*~', '.fuse_hidden*', '.directory', '.Trash-*', '.nfs*']
  }
}

// 合并选中的模板：按分组顺序输出，重复模式只保留第一次出现，并加上分节注释。
export function buildGitignore(selectedKeys) {
  const keys = Array.isArray(selectedKeys) ? selectedKeys : []
  const seen = new Set()
  const blocks = []

  for (const group of GROUPS) {
    const groupKeys = keys.filter(key => TEMPLATES[key]?.group === group.id)
    for (const key of groupKeys) {
      const template = TEMPLATES[key]
      const lines = []
      for (const line of template.lines) {
        const pattern = String(line).trim()
        if (!pattern || pattern.startsWith('#')) continue
        if (seen.has(pattern)) continue
        seen.add(pattern)
        lines.push(pattern)
      }
      if (!lines.length) continue
      blocks.push(`# ===== ${template.label} =====\n${lines.join('\n')}`)
    }
  }

  return blocks.join('\n\n')
}

// 语言/框架/编辑器/系统 → 模板 key 列表（导出给测试与界面复用）
export function keysByGroup(groupId) {
  return Object.keys(TEMPLATES).filter(key => TEMPLATES[key].group === groupId)
}

const SAMPLE_KEYS = ['node', 'react', 'vscode', 'macos', 'windows', 'linux']

export default {
  id: 'gitignore-generator',
  name: '.gitignore 生成器',
  description: '按语言、框架、编辑器与操作系统勾选生成 .gitignore 文件',
  category: 'devtool',
  icon: 'text-sort',
  keywords: ['git', 'gitignore', 'ignore', '版本控制'],
  render(container) {
    const checkboxes = new Map()
    const errorEl = createElement('div', { className: 'error-text' })
    const output = createElement('textarea', {
      className: 'textarea',
      rows: 16,
      readOnly: true,
      placeholder: '勾选左侧模板后，这里会生成 .gitignore 内容…'
    })

    const selectedKeys = () => [...checkboxes.entries()].filter(([, box]) => box.checked).map(([key]) => key)

    function update() {
      const keys = selectedKeys()
      errorEl.textContent = keys.length ? '' : '请至少选择一个模板'
      output.value = buildGitignore(keys)
    }

    const groups = GROUPS.map(group => {
      const items = keysByGroup(group.id).map(key => {
        const template = TEMPLATES[key]
        const box = createElement('input', { className: 'checkbox', type: 'checkbox' })
        box.addEventListener('change', update)
        checkboxes.set(key, box)
        return createElement('label', { className: 'option-item' }, [
          box,
          createElement('span', { textContent: template.label })
        ])
      })
      return createElement('div', { className: 'form-group' }, [
        createElement('div', { className: 'label', textContent: group.label }),
        createElement('div', { className: 'grid-3' }, items)
      ])
    })

    const selectAllBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '全选',
      onClick: () => {
        for (const box of checkboxes.values()) box.checked = true
        update()
      }
    })

    const clearBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '清空',
      onClick: () => {
        for (const box of checkboxes.values()) box.checked = false
        update()
      }
    })

    const sampleBtn = createElement('button', {
      className: 'btn btn-secondary',
      type: 'button',
      textContent: '示例数据',
      onClick: () => {
        for (const [key, box] of checkboxes) box.checked = SAMPLE_KEYS.includes(key)
        update()
      }
    })

    container.append(
      ...groups,
      createElement('div', { className: 'btn-group' }, [selectAllBtn, clearBtn, sampleBtn]),
      errorEl,
      createSection('.gitignore 预览', output)
    )

    update()
  }
}
