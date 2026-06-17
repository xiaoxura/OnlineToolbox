import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

const CATEGORIES = [
  {
    label: '仓库配置',
    entries: [
      { command: 'git init', desc: '初始化一个新的 Git 仓库', example: 'git init my-project' },
      { command: 'git clone <url>', desc: '克隆远程仓库', example: 'git clone https://github.com/user/repo.git' },
      { command: 'git config --global user.name', desc: '设置全局用户名', example: 'git config --global user.name "Your Name"' },
      { command: 'git config --global user.email', desc: '设置全局邮箱', example: 'git config --global user.email "you@example.com"' },
      { command: 'git config --list', desc: '查看所有 Git 配置', example: 'git config --list' },
      { command: 'git config --edit', desc: '编辑 Git 配置文件', example: 'git config --global --edit' },
      { command: 'git alias <name> <cmd>', desc: '设置 Git 命令别名', example: 'git config --global alias.st status' }
    ]
  },
  {
    label: '分支管理',
    entries: [
      { command: 'git branch', desc: '查看本地分支', example: 'git branch' },
      { command: 'git branch -a', desc: '查看所有分支（含远程）', example: 'git branch -a' },
      { command: 'git branch <name>', desc: '创建新分支', example: 'git branch feature/login' },
      { command: 'git checkout -b <name>', desc: '创建并切换到新分支', example: 'git checkout -b feature/login' },
      { command: 'git switch -c <name>', desc: '创建并切换到新分支（新命令）', example: 'git switch -c feature/login' },
      { command: 'git branch -d <name>', desc: '删除已合并的分支', example: 'git branch -d feature/old' },
      { command: 'git branch -D <name>', desc: '强制删除分支', example: 'git branch -D feature/old' },
      { command: 'git merge <branch>', desc: '合并指定分支到当前分支', example: 'git merge feature/login' },
      { command: 'git rebase <branch>', desc: '变基当前分支到指定分支', example: 'git rebase main' },
      { command: 'git branch -m <old> <new>', desc: '重命名分支', example: 'git branch -m old-name new-name' },
      { command: 'git switch <branch>', desc: '切换分支（新命令）', example: 'git switch main' },
      { command: 'git checkout <branch>', desc: '切换分支', example: 'git checkout main' }
    ]
  },
  {
    label: '提交操作',
    entries: [
      { command: 'git add <file>', desc: '添加文件到暂存区', example: 'git add src/index.js' },
      { command: 'git add .', desc: '添加所有变更到暂存区', example: 'git add .' },
      { command: 'git add -p', desc: '交互式选择要暂存的代码块', example: 'git add -p' },
      { command: 'git commit -m <msg>', desc: '提交暂存区的内容', example: 'git commit -m "feat: add login page"' },
      { command: 'git commit -am <msg>', desc: '添加并提交所有已跟踪文件的变更', example: 'git commit -am "fix: bug fix"' },
      { command: 'git commit --amend', desc: '修改最近一次提交', example: 'git commit --amend -m "new message"' },
      { command: 'git commit --amend --no-edit', desc: '将暂存内容追加到上一次提交', example: 'git commit --amend --no-edit' },
      { command: 'git stash', desc: '暂存当前工作区的修改', example: 'git stash' },
      { command: 'git stash pop', desc: '恢复最近一次暂存的修改', example: 'git stash pop' },
      { command: 'git stash list', desc: '查看所有暂存记录', example: 'git stash list' },
      { command: 'git stash drop', desc: '删除最近一次暂存', example: 'git stash drop' },
      { command: 'git stash clear', desc: '清空所有暂存记录', example: 'git stash clear' }
    ]
  },
  {
    label: '远程操作',
    entries: [
      { command: 'git remote -v', desc: '查看远程仓库信息', example: 'git remote -v' },
      { command: 'git remote add <name> <url>', desc: '添加远程仓库', example: 'git remote add origin https://github.com/user/repo.git' },
      { command: 'git remote remove <name>', desc: '移除远程仓库', example: 'git remote remove origin' },
      { command: 'git push', desc: '推送到远程仓库', example: 'git push origin main' },
      { command: 'git push -u origin <branch>', desc: '推送并设置上游分支', example: 'git push -u origin main' },
      { command: 'git push --force', desc: '强制推送（慎用）', example: 'git push --force origin main' },
      { command: 'git push --force-with-lease', desc: '安全的强制推送', example: 'git push --force-with-lease origin main' },
      { command: 'git pull', desc: '拉取并合并远程更新', example: 'git pull origin main' },
      { command: 'git pull --rebase', desc: '拉取并变基远程更新', example: 'git pull --rebase origin main' },
      { command: 'git fetch', desc: '获取远程更新（不合并）', example: 'git fetch origin' },
      { command: 'git fetch --all', desc: '获取所有远程仓库更新', example: 'git fetch --all --prune' }
    ]
  },
  {
    label: '撤销操作',
    entries: [
      { command: 'git checkout -- <file>', desc: '丢弃工作区的修改', example: 'git checkout -- src/index.js' },
      { command: 'git restore <file>', desc: '丢弃工作区的修改（新命令）', example: 'git restore src/index.js' },
      { command: 'git restore --staged <file>', desc: '取消暂存文件', example: 'git restore --staged src/index.js' },
      { command: 'git reset HEAD <file>', desc: '取消暂存文件', example: 'git reset HEAD src/index.js' },
      { command: 'git reset --soft HEAD~1', desc: '撤销提交，保留修改在暂存区', example: 'git reset --soft HEAD~1' },
      { command: 'git reset --mixed HEAD~1', desc: '撤销提交，保留修改在工作区', example: 'git reset --mixed HEAD~1' },
      { command: 'git reset --hard HEAD~1', desc: '彻底撤销最近一次提交（慎用）', example: 'git reset --hard HEAD~1' },
      { command: 'git revert <commit>', desc: '创建一个新提交来撤销指定提交', example: 'git revert abc1234' },
      { command: 'git clean -fd', desc: '删除未跟踪的文件和目录', example: 'git clean -fd' }
    ]
  },
  {
    label: '日志查看',
    entries: [
      { command: 'git log', desc: '查看提交历史', example: 'git log' },
      { command: 'git log --oneline', desc: '简洁格式查看提交历史', example: 'git log --oneline' },
      { command: 'git log --graph', desc: '图形化查看分支合并历史', example: 'git log --oneline --graph --all' },
      { command: 'git log --author=<name>', desc: '按作者过滤提交', example: 'git log --author="zhangsan"' },
      { command: 'git log --since=<date>', desc: '查看指定日期后的提交', example: 'git log --since="2024-01-01"' },
      { command: 'git log -p', desc: '查看提交历史及每次提交的差异', example: 'git log -p -5' },
      { command: 'git log --stat', desc: '查看每次提交的文件变更统计', example: 'git log --stat' },
      { command: 'git diff', desc: '查看未暂存的修改', example: 'git diff' },
      { command: 'git diff --staged', desc: '查看已暂存的修改', example: 'git diff --staged' },
      { command: 'git diff <branch1> <branch2>', desc: '比较两个分支的差异', example: 'git diff main feature' },
      { command: 'git blame <file>', desc: '查看文件每一行的最后修改信息', example: 'git blame src/index.js' },
      { command: 'git shortlog -sn', desc: '按提交次数统计贡献者', example: 'git shortlog -sn' }
    ]
  },
  {
    label: '标签管理',
    entries: [
      { command: 'git tag', desc: '查看所有标签', example: 'git tag' },
      { command: 'git tag <name>', desc: '创建轻量标签', example: 'git tag v1.0.0' },
      { command: 'git tag -a <name> -m <msg>', desc: '创建附注标签', example: 'git tag -a v1.0.0 -m "First release"' },
      { command: 'git tag -d <name>', desc: '删除本地标签', example: 'git tag -d v1.0.0' },
      { command: 'git push origin <tag>', desc: '推送标签到远程', example: 'git push origin v1.0.0' },
      { command: 'git push origin --tags', desc: '推送所有标签到远程', example: 'git push origin --tags' },
      { command: 'git push origin --delete <tag>', desc: '删除远程标签', example: 'git push origin --delete v1.0.0' },
      { command: 'git checkout <tag>', desc: '检出指定标签', example: 'git checkout v1.0.0' }
    ]
  },
  {
    label: '子模块',
    entries: [
      { command: 'git submodule add <url> <path>', desc: '添加子模块', example: 'git submodule add https://github.com/lib/lib.git libs/lib' },
      { command: 'git submodule init', desc: '初始化子模块', example: 'git submodule init' },
      { command: 'git submodule update', desc: '更新子模块', example: 'git submodule update' },
      { command: 'git submodule update --init --recursive', desc: '递归初始化并更新子模块', example: 'git submodule update --init --recursive' },
      { command: 'git submodule foreach <cmd>', desc: '在每个子模块中执行命令', example: 'git submodule foreach git pull' },
      { command: 'git submodule deinit <path>', desc: '取消初始化子模块', example: 'git submodule deinit libs/lib' },
      { command: 'git submodule status', desc: '查看子模块状态', example: 'git submodule status' }
    ]
  }
]

export default {
  id: 'git-ref',
  name: 'Git 命令速查',
  description: '常用 Git 命令参考，按分类查找并快速复制命令',
  category: 'devtool',
  icon: 'search',
  render(container) {
    const searchInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '搜索 Git 命令或描述（如 clone, merge, 暂存, 回退）...'
    })

    const searchRow = createElement('div', { className: 'form-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '搜索' }),
        searchInput
      ])
    ])

    const contentEl = createElement('div', {})

    function renderContent() {
      const query = searchInput.value.trim().toLowerCase()
      contentEl.innerHTML = ''

      CATEGORIES.forEach(cat => {
        const filtered = cat.entries.filter(entry => {
          if (!query) return true
          return entry.command.toLowerCase().includes(query) ||
            entry.desc.toLowerCase().includes(query) ||
            entry.example.toLowerCase().includes(query) ||
            cat.label.toLowerCase().includes(query)
        })

        if (filtered.length === 0) return

        const tabLabel = `${cat.label} (${filtered.length})`
        const listEl = createElement('div', { className: 'result-box' })

        filtered.forEach(entry => {
          const item = createElement('div', { className: 'stat-item' }, [
            createElement('span', { className: 'stat-value', textContent: entry.command }),
            createElement('span', { className: 'stat-label', textContent: entry.desc }),
            createElement('span', { className: 'stat-label', textContent: entry.example }),
            createCopyButton(entry.command)
          ])
          listEl.appendChild(item)
        })

        const section = createSection(tabLabel, listEl)
        contentEl.appendChild(section)
      })

      if (contentEl.children.length === 0) {
        contentEl.appendChild(
          createElement('div', { className: 'inline-result', textContent: '没有匹配的 Git 命令' })
        )
      }
    }

    searchInput.addEventListener('input', renderContent)
    renderContent()

    const searchSection = createSection('搜索', searchRow)

    container.appendChild(searchSection)
    container.appendChild(contentEl)
  }
}
