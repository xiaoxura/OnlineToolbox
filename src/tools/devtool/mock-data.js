import { createCopyButton, createElement, createSection, createSegmentedGroup } from '../../utils/dom.js'

const SURNAMES = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜', '戚', '谢', '邹', '喻', '柏', '水', '窦', '章', '云', '苏', '潘', '葛', '奚', '范', '彭', '郎', '鲁', '韦', '昌', '马', '苗', '凤', '花', '方', '俞', '任', '袁', '柳', '邓', '鲍', '史', '唐', '费', '廉', '岑', '薛', '雷', '贺', '倪', '汤', '滕', '殷', '罗', '毕', '郝', '邬', '安', '常', '乐', '于', '时', '傅', '皮', '卞', '齐', '康', '伍', '余', '元', '卜', '顾', '孟', '平', '黄', '和', '穆', '萧', '尹', '姚', '邵', '湛', '汪', '祁', '毛', '禹', '狄', '米', '贝', '明', '臧', '计', '伏', '成', '戴', '谈', '宋', '茅', '庞', '熊', '纪', '舒', '屈', '项', '祝', '董', '梁', '杜', '阮', '蓝', '闵', '席', '季', '麻', '强', '贾', '路', '娄', '危', '江', '童', '颜', '郭', '梅', '盛', '林', '刁', '钟', '徐', '邱', '骆', '高', '夏', '蔡', '田', '樊', '胡', '凌', '霍', '虞', '万', '支', '柯', '昝', '管', '卢', '莫', '经', '房', '裘', '缪', '干', '解', '应', '宗', '丁', '宣', '贲', '邓', '郁', '单', '杭', '洪', '包', '诸', '左', '石', '崔', '吉', '钮', '龚', '程', '嵇', '邢', '滑', '裴', '陆', '荣', '翁', '荀', '羊', '於', '惠', '甄', '曲', '家', '封', '芮', '羿', '储', '靳', '汲', '邴', '糜', '松', '井', '段', '富', '巫', '乌', '焦', '巴', '弓', '牧', '隗', '山', '谷', '车', '侯', '宓', '蓬', '全', '郗', '班', '仰', '秋', '仲', '伊', '宫', '宁', '仇', '栾', '暴', '甘', '钭', '厉', '戎', '祖', '武', '符', '刘', '景', '詹', '束', '龙', '叶', '幸', '司', '韶', '郜', '黎', '蓟', '薄', '印', '宿', '白', '怀', '蒲', '邰', '从', '鄂', '索', '咸', '籍', '赖', '卓', '蔺', '屠', '蒙', '池', '乔', '阴', '郁', '胥', '能', '苍', '双', '闻', '莘', '党', '翟', '谭', '贡', '劳', '逄', '姬', '申', '扶', '堵', '冉', '宰', '郦', '雍', '却', '璩', '桑', '桂', '濮', '牛', '寿', '通', '边', '扈', '燕', '冀', '郏', '浦', '尚', '农', '温', '别', '庄', '晏', '柴', '瞿', '阎', '充', '慕', '连', '茹', '习', '宦', '艾', '鱼', '容', '向', '古', '易', '慎', '戈', '廖', '庾', '终', '暨', '居', '衡', '步', '都', '耿', '满', '弘', '匡', '国', '文', '寇', '广', '禄', '阙', '东', '殴', '殳', '沃', '利', '蔚', '越', '夔', '隆', '师', '巩', '厍', '聂', '晁', '勾', '敖', '融', '冷', '訾', '辛', '阚', '那', '简', '饶', '空', '曾', '毋', '沙', '乜', '养', '鞠', '须', '丰', '巢', '关', '蒯', '相', '查', '后', '荆', '红', '游', '竺', '权', '逯', '盖', '益', '桓', '公', '万俟', '司马', '上官', '欧阳', '夏侯', '诸葛', '闻人', '东方', '赫连', '皇甫', '尉迟', '公羊', '澹台', '公冶', '宗政', '濮阳', '淳于', '单于', '太叔', '申屠', '公孙', '仲孙', '轩辕', '令狐', '钟离', '宇文', '长孙', '慕容', '鲜于', '闾丘', '司徒', '司空', '亓官', '司寇', '仉', '督', '子车', '颛孙', '端木', '巫马', '公西', '漆雕', '乐正', '壤驷', '公良', '拓跋', '夹谷', '宰父', '谷梁', '晋', '楚', '闫', '法', '汝', '鄢', '涂', '钦', '岳', '帅', '缑', '亢', '况', '后', '有', '琴', '商', '牟', '佘', '佴', '伯', '赏', '墨', '哈', '谯', '笪', '年', '爱', '阳', '佟']

const MALE_NAMES = ['伟', '强', '磊', '洋', '勇', '军', '杰', '涛', '明', '辉', '鹏', '华', '飞', '刚', '平', '浩', '斌', '博', '超', '波', '峰', '亮', '志', '建', '俊', '鑫', '松', '毅', '翔', '宇', '宁', '龙', '彬', '坤', '锋', '健', '维', '昊', '亮', '然', '林', '睿', '睿哲', '子轩', '子豪', '子涵', '浩然', '浩宇', '雨泽', '皓轩', '致远', '俊驰', '烨磊', '晟睿', '文昊', '修洁', '黎昕', '远航', '旭尧', '鸿涛', '荣轩', '越泽', '浩南', '泽洋', '鑫磊', '昊强', '伟宸', '博超', '君浩', '子骞', '明辉', '鹏涛', '炎彬', '鹤轩', '越彬', '风华', '靖琪', '明哲', '天佑', '正阳', '嘉懿', '煜城', '懿轩', '烨伟', '苑博', '伟泽', '熠彤', '鸿煊', '博涛', '烨霖', '烨华', '煜祺', '智宸', '正豪', '昊然', '志泽', '弘文', '峻熙', '嘉亮', '懿轩']

const FEMALE_NAMES = ['芳', '娜', '敏', '静', '丽', '强', '磊', '洋', '艳', '勇', '军', '杰', '娟', '涛', '明', '秀英', '华', '慧', '巧', '美', '娜', '静', '淑', '惠', '珠', '翠', '雅', '芝', '玉', '萍', '红', '娥', '玲', '芬', '芳', '燕', '彩', '春', '菊', '兰', '凤', '洁', '梅', '琳', '素', '云', '莲', '真', '环', '雪', '荣', '爱', '妹', '霞', '香', '月', '莺', '媛', '艳', '瑞', '凡', '佳', '嘉', '琼', '勤', '珍', '贞', '莉', '桂', '娣', '叶', '璧', '璐', '娅', '琦', '晶', '妍', '茜', '秋', '珊', '莎', '锦', '黛', '青', '倩', '婷', '姣', '婉', '娴', '瑾', '颖', '露', '瑶', '怡', '婵', '雁', '蓓', '纨', '仪', '荷', '丹', '蓉', '眉', '君', '琴', '蕊', '薇', '菁', '梦', '岚', '苑', '婕', '馨', '瑗', '琰', '韵', '融', '园', '艺', '咏', '卿', '聪', '澜', '纯', '毓', '悦', '昭', '冰', '爽', '琬', '茗', '羽', '希', '宁', '欣', '飘', '育', '滢', '馥', '筠', '柔', '竹', '霭', '凝', '晓', '欢', '霄', '枫', '芸', '菲', '寒', '伊', '亚', '宜', '可', '姬', '舒', '影', '荔', '枝', '思', '丽']

const AREAS = ['110000', '120000', '130000', '140000', '150000', '210000', '220000', '230000', '310000', '320000', '330000', '340000', '350000', '360000', '370000', '410000', '420000', '430000', '440000', '450000', '460000', '500000', '510000', '520000', '530000', '540000', '610000', '620000', '630000', '640000', '650000']

const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '重庆', '武汉', '西安', '天津', '苏州', '长沙', '郑州', '青岛', '大连', '宁波', '厦门', '福州', '无锡', '合肥', '昆明', '哈尔滨', '济南', '佛山', '长春', '温州', '石家庄', '南宁', '常州', '泉州', '南昌', '贵阳', '太原', '烟台', '嘉兴', '南通', '金华', '珠海', '惠州', '徐州', '海口', '乌鲁木齐', '绍兴', '中山', '台州', '兰州', '潍坊', '保定', '镇江', '扬州', '桂林', '唐山', '三亚', '湖州', '呼和浩特', '廊坊', '洛阳', '威海', '盐城', '临沂', '江门', '汕头', '泰州', '漳州', '邯郸', '济宁', '芜湖', '淄博', '银川', '柳州', '绵阳', '湛江', '鞍山', '赣州', '大庆', '宜昌', '包头', '咸阳', '秦皇岛', '株州', '莆田', '吉林', '淮安', '肇庆', '宿迁', '荆州', '连云港', '张家口', '遵义', '驻马店', '安庆', '日照', '黄石', '威海', '揭阳', '茂名', '梅州', '邢台', '商丘', '十堰', '新乡', '信阳', '襄阳', '岳阳', '常德']

const COMPANIES_SUFFIX = ['科技有限公司', '信息技术有限公司', '网络科技有限公司', '电子商务有限公司', '软件有限公司', '数据科技有限公司', '智能科技有限公司', '传媒有限公司', '文化有限公司', '贸易有限公司', '实业有限公司', '投资有限公司', '咨询有限公司', '教育科技有限公司', '医疗科技有限公司', '建筑工程有限公司', '物流有限公司', '环保科技有限公司', '新能源科技有限公司', '食品有限公司']

const COMPANY_PREFIXES = ['阿里巴巴', '腾讯', '字节跳动', '美团', '京东', '百度', '小米', '华为', '中兴', '网易', '搜狐', '新浪', '携程', '拼多多', '滴滴', '快手', '哔哩哔哩', '蚂蚁金视', '科大讯飞', '商汤科技', '旷视科技', '寒武纪', '大疆', '海康威视', '联想', '格力', '美的', '海尔', 'TCL', 'OPPO', 'vivo', '荣耀', '一加', '锤子', '魅族', '360', '用友', '金蝶', '浪潮', '紫光', '曙光']

const STREET_NAMES = ['中山路', '人民路', '解放路', '建设路', '和平路', '北京路', '南京路', '长安街', '建国路', '朝阳路', '学院路', '科技路', '高新路', '创业大道', '发展路', '创新路', '文化路', '公园路', '幸福路', '团结路', '胜利路', '光明路', '中华路', '民生路', '民主路', '富强路', '文明路', '和谐路', '振兴路', '创新大道', '金融街', '商业街', '步行街']

const DOMAINS = ['qq.com', '163.com', '126.com', 'gmail.com', 'outlook.com', 'sina.com', 'sohu.com', 'foxmail.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'yeah.net', '139.com', 'wo.cn', '189.cn']

const MOBILE_PREFIXES = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '150', '151', '152', '153', '155', '156', '157', '158', '159', '170', '171', '172', '173', '175', '176', '177', '178', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189', '190', '191', '193', '195', '196', '197', '198', '199']

const BANK_PREFIXES = ['621700', '622200', '622848', '622588', '621660', '621226', '621483', '621485', '621486', '622150', '622151', '622155', '622156', '622158', '622159', '622161', '622163', '622165', '622166', '622168', '622169', '622171', '622172', '622173', '622176', '622177', '622178', '622179', '622180', '622181', '622182', '622183', '622184', '622185', '622186', '622187', '622188', '622189', '622190', '622191', '622192', '622193', '622194', '622195', '622196', '622197', '622198', '622199', '622201', '622202', '622203']

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generatePhone() {
  return randItem(MOBILE_PREFIXES) + String(randInt(10000000, 99999999))
}

function generateName() {
  const surname = randItem(SURNAMES)
  const isMale = Math.random() > 0.5
  const pool = isMale ? MALE_NAMES : FEMALE_NAMES
  const given = Math.random() > 0.3
    ? randItem(pool) + randItem(pool)
    : randItem(pool)
  return surname + given
}

function generateEmail() {
  const name = Math.random().toString(36).substring(2, randInt(6, 12))
  return `${name}@${randItem(DOMAINS)}`
}

function generateIdCard() {
  const area = randItem(AREAS)
  const year = randInt(1960, 2005)
  const month = String(randInt(1, 12)).padStart(2, '0')
  const maxDay = new Date(year, parseInt(month), 0).getDate()
  const day = String(randInt(1, maxDay)).padStart(2, '0')
  const seq = String(randInt(100, 999))
  const base = `${area}${year}${month}${day}${seq}`

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkChars = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(base[i]) * weights[i]
  }
  const check = checkChars[sum % 11]

  return base + check
}

function generateAddress() {
  return `${randItem(CITIES)}市${randItem(['东', '西', '南', '北', '中', '新'])}${randItem(['城', '湖', '山', '江', '海', '安', '平'])}区${randItem(STREET_NAMES)}${randInt(1, 999)}号${randInt(1, 99)}栋${randInt(1, 30)}楼${randInt(1, 4)}室`
}

function generateDate() {
  const year = randInt(2000, 2026)
  const month = String(randInt(1, 12)).padStart(2, '0')
  const day = String(randInt(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateUrl() {
  const protocols = ['https', 'http']
  const domains = ['example.com', 'test.cn', 'demo.org', 'mysite.net', 'sample.io', 'webapp.com', 'datahub.cn', 'cloudapi.net', 'platform.io', 'service.com']
  const paths = ['/api/v1', '/index.html', '/dashboard', '/products', '/about', '/contact', '/blog', '/docs', '/user/profile', '/settings', '/data/report', '/admin', '/home']
  return `${randItem(protocols)}://www.${randItem(domains)}${randItem(paths)}`
}

function generateIP() {
  return `${randInt(1, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`
}

function generateCompany() {
  return randItem(COMPANY_PREFIXES) + randItem(COMPANIES_SUFFIX)
}

function generateBankCard() {
  return randItem(BANK_PREFIXES) + String(randInt(100000000000, 999999999999))
}

const GENERATORS = {
  name: { label: '中文姓名', fn: generateName },
  phone: { label: '手机号', fn: generatePhone },
  email: { label: '邮箱', fn: generateEmail },
  idcard: { label: '身份证号', fn: generateIdCard },
  address: { label: '地址', fn: generateAddress },
  date: { label: '日期', fn: generateDate },
  url: { label: 'URL', fn: generateUrl },
  ip: { label: 'IP地址', fn: generateIP },
  company: { label: '公司名', fn: generateCompany },
  bankcard: { label: '银行卡号', fn: generateBankCard }
}

const GENERATOR_KEYS = Object.keys(GENERATORS)

export default {
  id: 'mock-data',
  name: 'Mock 数据生成',
  description: '生成各类模拟数据：姓名、手机号、邮箱、身份证号、地址等',
  category: 'devtool',
  icon: 'random',
  render(container) {
    const selectedTypes = new Set(['name', 'phone', 'email'])

    const checkboxContainer = createElement('div', { className: 'option-row' })
    GENERATOR_KEYS.forEach(key => {
      const label = createElement('label', { className: 'option-item' })
      const cb = createElement('input', {
        className: 'checkbox',
        type: 'checkbox',
        value: key
      })
      if (selectedTypes.has(key)) cb.checked = true
      cb.addEventListener('change', () => {
        if (cb.checked) selectedTypes.add(key)
        else selectedTypes.delete(key)
      })
      label.appendChild(cb)
      label.appendChild(createElement('span', { textContent: GENERATORS[key].label }))
      checkboxContainer.appendChild(label)
    })

    const countInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '10',
      min: '1',
      max: '100'
    })

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      textContent: '生成',
      onClick: doGenerate
    })

    const inputRow = createElement('div', { className: 'form-row form-action-row' }, [
      createElement('div', { className: 'form-group' }, [
        createElement('label', { className: 'label', textContent: '生成数量 (1-100)' }),
        countInput
      ]),
      generateBtn
    ])

    let currentFormat = 'text'
    const outputEl = createElement('textarea', {
      className: 'textarea',
      readonly: 'readonly',
      rows: '16'
    })

    let generatedData = []

    const tabs = createSegmentedGroup([
      { label: '文本格式', value: 'text' },
      { label: 'JSON格式', value: 'json' },
      { label: 'CSV格式', value: 'csv' }
    ], (val) => {
      currentFormat = val
      renderOutput()
    }, { label: '输出格式' })

    const copyBtn = createCopyButton(() => outputEl.value)

    function renderOutput() {
      if (generatedData.length === 0) {
        outputEl.value = ''
        return
      }

      const types = [...selectedTypes]
      if (currentFormat === 'text') {
        outputEl.value = generatedData.map(row =>
          types.map(t => row[t]).join('  |  ')
        ).join('\n')
      } else if (currentFormat === 'json') {
        outputEl.value = JSON.stringify(generatedData, null, 2)
      } else if (currentFormat === 'csv') {
        const header = types.map(t => GENERATORS[t].label).join(',')
        const rows = generatedData.map(row =>
          types.map(t => `"${row[t]}"`).join(',')
        )
        outputEl.value = header + '\n' + rows.join('\n')
      }
    }

    function doGenerate() {
      const types = [...selectedTypes]
      if (types.length === 0) {
        outputEl.value = '请至少选择一种数据类型'
        return
      }

      const count = Math.min(Math.max(parseInt(countInput.value) || 10, 1), 100)

      generatedData = []
      for (let i = 0; i < count; i++) {
        const row = {}
        for (const key of types) {
          row[key] = GENERATORS[key].fn()
        }
        generatedData.push(row)
      }

      renderOutput()
    }

    doGenerate()

    const typeSection = createSection('数据类型', checkboxContainer)
    const configSection = createSection('配置', inputRow)
    const outputSection = createSection('输出', createElement('div', { className: 'tool-stack' }, [tabs, outputEl]), [copyBtn])

    container.appendChild(typeSection)
    container.appendChild(configSection)
    container.appendChild(outputSection)
  }
}
