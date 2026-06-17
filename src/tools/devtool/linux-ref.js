import { createElement, createSection, createCopyButton } from '../../utils/dom.js'

const CATEGORIES = [
  {
    label: '文件操作',
    entries: [
      { command: 'ls', desc: '列出目录内容', example: 'ls -la /home' },
      { command: 'ls -l', desc: '以长格式列出文件详情', example: 'ls -lh /var/log' },
      { command: 'ls -a', desc: '列出所有文件（含隐藏文件）', example: 'ls -la ~' },
      { command: 'cp <src> <dst>', desc: '复制文件', example: 'cp file.txt /backup/file.txt' },
      { command: 'cp -r <src> <dst>', desc: '递归复制目录', example: 'cp -r src/ backup/src/' },
      { command: 'mv <src> <dst>', desc: '移动或重命名文件', example: 'mv old.txt new.txt' },
      { command: 'rm <file>', desc: '删除文件', example: 'rm temp.txt' },
      { command: 'rm -rf <dir>', desc: '递归强制删除目录（慎用）', example: 'rm -rf /tmp/build' },
      { command: 'touch <file>', desc: '创建空文件或更新时间戳', example: 'touch newfile.txt' },
      { command: 'ln -s <target> <link>', desc: '创建软链接', example: 'ln -s /usr/bin/python3 /usr/local/bin/python' },
      { command: 'readlink -f <link>', desc: '获取软链接指向的真实路径', example: 'readlink -f /usr/local/bin/python' },
      { command: 'file <path>', desc: '查看文件类型', example: 'file /bin/bash' },
      { command: 'stat <file>', desc: '查看文件详细信息', example: 'stat /etc/passwd' }
    ]
  },
  {
    label: '目录管理',
    entries: [
      { command: 'cd <dir>', desc: '切换工作目录', example: 'cd /var/log' },
      { command: 'cd ~', desc: '切换到用户主目录', example: 'cd ~' },
      { command: 'cd -', desc: '切换到上一次的目录', example: 'cd -' },
      { command: 'pwd', desc: '显示当前工作目录', example: 'pwd' },
      { command: 'mkdir <dir>', desc: '创建目录', example: 'mkdir projects' },
      { command: 'mkdir -p <path>', desc: '递归创建多级目录', example: 'mkdir -p /data/backup/2024' },
      { command: 'rmdir <dir>', desc: '删除空目录', example: 'rmdir empty_dir' },
      { command: 'tree', desc: '以树形结构显示目录', example: 'tree -L 2 /var' },
      { command: 'du -sh <dir>', desc: '查看目录大小', example: 'du -sh /home/user' },
      { command: 'du -h --max-depth=1', desc: '查看当前目录下各子目录大小', example: 'du -h --max-depth=1 /var' },
      { command: 'find <dir> -name <pattern>', desc: '按名称查找文件', example: 'find /home -name "*.log"' },
      { command: 'find <dir> -type f -mtime -7', desc: '查找最近 7 天修改的文件', example: 'find /var/log -type f -mtime -7' },
      { command: 'find <dir> -size +100M', desc: '查找大于指定大小的文件', example: 'find / -size +100M 2>/dev/null' },
      { command: 'locate <pattern>', desc: '快速查找文件（基于数据库）', example: 'locate nginx.conf' },
      { command: 'which <cmd>', desc: '查找命令的路径', example: 'which python3' },
      { command: 'whereis <cmd>', desc: '查找命令、源码和手册的路径', example: 'whereis gcc' }
    ]
  },
  {
    label: '文本处理',
    entries: [
      { command: 'cat <file>', desc: '查看文件内容', example: 'cat /etc/hosts' },
      { command: 'less <file>', desc: '分页查看文件', example: 'less /var/log/syslog' },
      { command: 'head -n <N> <file>', desc: '查看文件前 N 行', example: 'head -n 20 access.log' },
      { command: 'tail -n <N> <file>', desc: '查看文件后 N 行', example: 'tail -n 50 error.log' },
      { command: 'tail -f <file>', desc: '实时追踪文件新增内容', example: 'tail -f /var/log/syslog' },
      { command: 'grep <pattern> <file>', desc: '搜索文件中的文本', example: 'grep "error" /var/log/syslog' },
      { command: 'grep -r <pattern> <dir>', desc: '递归搜索目录中的文本', example: 'grep -r "TODO" ./src' },
      { command: 'grep -i <pattern>', desc: '忽略大小写搜索', example: 'grep -i "warning" log.txt' },
      { command: 'grep -n <pattern>', desc: '显示匹配行的行号', example: 'grep -n "function" app.js' },
      { command: 'grep -c <pattern>', desc: '统计匹配的行数', example: 'grep -c "error" log.txt' },
      { command: 'grep -E <regex>', desc: '使用扩展正则表达式', example: 'grep -E "err|warn" log.txt' },
      { command: 'sed -i \'s/old/new/g\' <file>', desc: '替换文件中的文本', example: 'sed -i \'s/localhost/0.0.0.0/g\' config.yml' },
      { command: 'sed -n \'10,20p\' <file>', desc: '查看文件指定行范围', example: 'sed -n \'10,20p\' data.csv' },
      { command: 'awk \'{print $1}\' <file>', desc: '提取文件中每行的第一列', example: 'awk \'{print $1}\' access.log' },
      { command: 'awk -F: \'{print $1}\' <file>', desc: '以指定分隔符提取列', example: 'awk -F: \'{print $1}\' /etc/passwd' },
      { command: 'sort <file>', desc: '对文件内容排序', example: 'sort names.txt' },
      { command: 'sort -u <file>', desc: '排序并去重', example: 'sort -u names.txt' },
      { command: 'uniq', desc: '去除相邻的重复行', example: 'sort data.txt | uniq -c' },
      { command: 'wc -l <file>', desc: '统计文件行数', example: 'wc -l access.log' },
      { command: 'cut -d: -f1 <file>', desc: '按分隔符截取列', example: 'cut -d: -f1 /etc/passwd' },
      { command: 'tr \'a-z\' \'A-Z\'', desc: '字符转换（如大小写）', example: 'cat file.txt | tr \'a-z\' \'A-Z\'' },
      { command: 'diff <file1> <file2>', desc: '比较两个文件的差异', example: 'diff old.conf new.conf' },
      { command: 'xargs <cmd>', desc: '将标准输入作为命令参数', example: 'find . -name "*.tmp" | xargs rm' }
    ]
  },
  {
    label: '权限管理',
    entries: [
      { command: 'chmod <mode> <file>', desc: '修改文件权限', example: 'chmod 755 script.sh' },
      { command: 'chmod +x <file>', desc: '添加可执行权限', example: 'chmod +x deploy.sh' },
      { command: 'chmod -R <mode> <dir>', desc: '递归修改目录权限', example: 'chmod -R 644 /var/www/html' },
      { command: 'chown <user>:<group> <file>', desc: '修改文件所有者', example: 'chown www-data:www-data index.html' },
      { command: 'chown -R <user>:<group> <dir>', desc: '递归修改目录所有者', example: 'chown -R nginx:nginx /var/www' },
      { command: 'chgrp <group> <file>', desc: '修改文件所属组', example: 'chgrp developers project/' },
      { command: 'umask', desc: '查看默认权限掩码', example: 'umask 022' },
      { command: 'ls -l', desc: '查看文件权限详情', example: 'ls -la /etc/shadow' }
    ]
  },
  {
    label: '进程管理',
    entries: [
      { command: 'ps aux', desc: '查看所有进程', example: 'ps aux' },
      { command: 'ps aux | grep <name>', desc: '查找指定进程', example: 'ps aux | grep nginx' },
      { command: 'top', desc: '实时查看系统进程', example: 'top' },
      { command: 'htop', desc: '交互式进程查看器', example: 'htop' },
      { command: 'kill <pid>', desc: '终止进程（SIGTERM）', example: 'kill 1234' },
      { command: 'kill -9 <pid>', desc: '强制终止进程（SIGKILL）', example: 'kill -9 1234' },
      { command: 'killall <name>', desc: '按名称终止进程', example: 'killall node' },
      { command: 'pkill <pattern>', desc: '按模式终止进程', example: 'pkill -f "python server"' },
      { command: 'nohup <cmd> &', desc: '后台运行命令，不受终端关闭影响', example: 'nohup python app.py &' },
      { command: 'bg', desc: '将挂起的任务放到后台运行', example: 'bg %1' },
      { command: 'fg', desc: '将后台任务调到前台', example: 'fg %1' },
      { command: 'jobs', desc: '查看当前 shell 的后台任务', example: 'jobs -l' },
      { command: 'pgrep <name>', desc: '查找进程 ID', example: 'pgrep nginx' },
      { command: 'pstree', desc: '以树形结构显示进程', example: 'pstree -p' },
      { command: 'lsof -i:<port>', desc: '查看占用端口的进程', example: 'lsof -i:8080' },
      { command: 'systemctl status <service>', desc: '查看系统服务状态', example: 'systemctl status nginx' },
      { command: 'systemctl start <service>', desc: '启动系统服务', example: 'systemctl start nginx' },
      { command: 'systemctl stop <service>', desc: '停止系统服务', example: 'systemctl stop nginx' },
      { command: 'systemctl restart <service>', desc: '重启系统服务', example: 'systemctl restart nginx' },
      { command: 'systemctl enable <service>', desc: '设置服务开机自启', example: 'systemctl enable nginx' },
      { command: 'systemctl disable <service>', desc: '取消服务开机自启', example: 'systemctl disable nginx' },
      { command: 'journalctl -u <service>', desc: '查看服务日志', example: 'journalctl -u nginx -f' }
    ]
  },
  {
    label: '网络工具',
    entries: [
      { command: 'curl <url>', desc: '发送 HTTP 请求', example: 'curl https://api.example.com/data' },
      { command: 'curl -o <file> <url>', desc: '下载文件', example: 'curl -o file.zip https://example.com/file.zip' },
      { command: 'curl -X POST -d <data> <url>', desc: '发送 POST 请求', example: 'curl -X POST -d \'{"key":"val"}\' -H "Content-Type: application/json" http://api.test.com' },
      { command: 'wget <url>', desc: '下载文件', example: 'wget https://example.com/file.tar.gz' },
      { command: 'wget -c <url>', desc: '断点续传下载', example: 'wget -c https://example.com/large.iso' },
      { command: 'ping <host>', desc: '测试网络连通性', example: 'ping google.com' },
      { command: 'ping -c <N> <host>', desc: '发送指定次数的 ping', example: 'ping -c 5 8.8.8.8' },
      { command: 'traceroute <host>', desc: '追踪路由路径', example: 'traceroute google.com' },
      { command: 'nslookup <domain>', desc: '查询 DNS 记录', example: 'nslookup example.com' },
      { command: 'dig <domain>', desc: '详细 DNS 查询', example: 'dig example.com A' },
      { command: 'dig <domain> MX', desc: '查询邮件服务器记录', example: 'dig gmail.com MX' },
      { command: 'netstat -tlnp', desc: '查看监听端口', example: 'netstat -tlnp' },
      { command: 'ss -tlnp', desc: '查看监听端口（新命令）', example: 'ss -tlnp' },
      { command: 'ss -s', desc: '查看 socket 统计', example: 'ss -s' },
      { command: 'ifconfig', desc: '查看网络接口信息', example: 'ifconfig' },
      { command: 'ip addr show', desc: '查看 IP 地址信息', example: 'ip addr show' },
      { command: 'ip route show', desc: '查看路由表', example: 'ip route show' },
      { command: 'ssh <user>@<host>', desc: 'SSH 远程登录', example: 'ssh root@192.168.1.100' },
      { command: 'ssh -p <port> <user>@<host>', desc: '指定端口 SSH 登录', example: 'ssh -p 2222 admin@server.com' },
      { command: 'scp <src> <user>@<host>:<dst>', desc: '安全复制文件到远程', example: 'scp file.tar.gz user@server:/tmp/' },
      { command: 'scp -r <src> <dst>', desc: '递归复制目录到远程', example: 'scp -r ./dist user@server:/var/www/' },
      { command: 'rsync -avz <src> <dst>', desc: '增量同步文件', example: 'rsync -avz ./data/ user@server:/backup/' }
    ]
  },
  {
    label: '压缩解压',
    entries: [
      { command: 'tar -czf <archive> <files>', desc: '创建 gzip 压缩包', example: 'tar -czf backup.tar.gz ./data/' },
      { command: 'tar -xzf <archive>', desc: '解压 gzip 压缩包', example: 'tar -xzf backup.tar.gz' },
      { command: 'tar -xzf <archive> -C <dir>', desc: '解压到指定目录', example: 'tar -xzf backup.tar.gz -C /tmp/restore/' },
      { command: 'tar -cjf <archive> <files>', desc: '创建 bzip2 压缩包', example: 'tar -cjf backup.tar.bz2 ./data/' },
      { command: 'tar -xjf <archive>', desc: '解压 bzip2 压缩包', example: 'tar -xjf backup.tar.bz2' },
      { command: 'tar -tf <archive>', desc: '查看压缩包内容', example: 'tar -tf backup.tar.gz' },
      { command: 'zip -r <archive> <dir>', desc: '创建 zip 压缩包', example: 'zip -r project.zip ./project/' },
      { command: 'unzip <archive>', desc: '解压 zip 文件', example: 'unzip project.zip' },
      { command: 'unzip <archive> -d <dir>', desc: '解压到指定目录', example: 'unzip project.zip -d /tmp/output/' },
      { command: 'gzip <file>', desc: 'gzip 压缩文件', example: 'gzip data.txt' },
      { command: 'gunzip <file>', desc: 'gzip 解压文件', example: 'gunzip data.txt.gz' },
      { command: 'zcat <file>', desc: '查看 gzip 压缩文件内容', example: 'zcat access.log.gz' }
    ]
  },
  {
    label: '系统信息',
    entries: [
      { command: 'uname -a', desc: '查看系统内核信息', example: 'uname -a' },
      { command: 'cat /etc/os-release', desc: '查看操作系统版本', example: 'cat /etc/os-release' },
      { command: 'hostname', desc: '查看主机名', example: 'hostname' },
      { command: 'uptime', desc: '查看系统运行时间和负载', example: 'uptime' },
      { command: 'free -h', desc: '查看内存使用情况', example: 'free -h' },
      { command: 'df -h', desc: '查看磁盘使用情况', example: 'df -h' },
      { command: 'lscpu', desc: '查看 CPU 信息', example: 'lscpu' },
      { command: 'cat /proc/cpuinfo', desc: '查看 CPU 详细信息', example: 'cat /proc/cpuinfo | head -20' },
      { command: 'cat /proc/meminfo', desc: '查看内存详细信息', example: 'cat /proc/meminfo' },
      { command: 'lsblk', desc: '查看块设备信息', example: 'lsblk' },
      { command: 'date', desc: '查看系统日期和时间', example: 'date "+%Y-%m-%d %H:%M:%S"' },
      { command: 'timedatectl', desc: '查看和设置时区', example: 'timedatectl' },
      { command: 'whoami', desc: '显示当前用户名', example: 'whoami' },
      { command: 'id', desc: '显示用户和组 ID', example: 'id' },
      { command: 'last', desc: '查看登录历史', example: 'last -10' },
      { command: 'w', desc: '查看当前登录用户及活动', example: 'w' },
      { command: 'dmesg', desc: '查看内核消息', example: 'dmesg | tail -20' }
    ]
  },
  {
    label: '磁盘管理',
    entries: [
      { command: 'fdisk -l', desc: '查看磁盘分区表', example: 'fdisk -l' },
      { command: 'mount <device> <dir>', desc: '挂载设备', example: 'mount /dev/sdb1 /mnt/usb' },
      { command: 'umount <dir>', desc: '卸载设备', example: 'umount /mnt/usb' },
      { command: 'mount | grep <device>', desc: '查看已挂载的设备', example: 'mount | grep sdb' },
      { command: 'mkfs.ext4 <device>', desc: '格式化为 ext4 文件系统', example: 'mkfs.ext4 /dev/sdb1' },
      { command: 'df -hT', desc: '查看磁盘使用和文件系统类型', example: 'df -hT' },
      { command: 'du -sh <dir>', desc: '查看目录大小', example: 'du -sh /var/log' },
      { command: 'du -h --max-depth=1', desc: '查看当前目录各子项大小', example: 'du -h --max-depth=1' },
      { command: 'iostat', desc: '查看磁盘 I/O 统计', example: 'iostat -x 1' },
      { command: 'blkid', desc: '查看块设备 UUID 和类型', example: 'blkid' },
      { command: 'lsblk -f', desc: '查看块设备文件系统信息', example: 'lsblk -f' }
    ]
  },
  {
    label: '用户管理',
    entries: [
      { command: 'useradd <user>', desc: '创建新用户', example: 'useradd -m deploy' },
      { command: 'useradd -m -s /bin/bash <user>', desc: '创建用户并指定 shell', example: 'useradd -m -s /bin/bash dev' },
      { command: 'userdel <user>', desc: '删除用户', example: 'userdel deploy' },
      { command: 'userdel -r <user>', desc: '删除用户及其主目录', example: 'userdel -r deploy' },
      { command: 'passwd <user>', desc: '修改用户密码', example: 'passwd deploy' },
      { command: 'usermod -aG <group> <user>', desc: '将用户添加到附加组', example: 'usermod -aG sudo deploy' },
      { command: 'groupadd <group>', desc: '创建用户组', example: 'groupadd developers' },
      { command: 'groupdel <group>', desc: '删除用户组', example: 'groupdel developers' },
      { command: 'groups <user>', desc: '查看用户所属的组', example: 'groups deploy' },
      { command: 'cat /etc/passwd', desc: '查看所有用户信息', example: 'cat /etc/passwd' },
      { command: 'cat /etc/group', desc: '查看所有组信息', example: 'cat /etc/group' },
      { command: 'sudo <cmd>', desc: '以管理员权限执行命令', example: 'sudo systemctl restart nginx' },
      { command: 'sudo -u <user> <cmd>', desc: '以指定用户身份执行命令', example: 'sudo -u www-data bash' },
      { command: 'su - <user>', desc: '切换到指定用户', example: 'su - root' },
      { command: 'visudo', desc: '编辑 sudoers 文件', example: 'sudo visudo' }
    ]
  }
]

export default {
  id: 'linux-ref',
  name: 'Linux 命令速查',
  description: '常用 Linux 命令参考，按分类查找并快速复制命令',
  category: 'devtool',
  icon: 'search',
  render(container) {
    const searchInput = createElement('input', {
      className: 'input',
      type: 'text',
      placeholder: '搜索 Linux 命令或描述（如 grep, 权限, 进程, 压缩）...'
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
          createElement('div', { className: 'inline-result', textContent: '没有匹配的 Linux 命令' })
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
