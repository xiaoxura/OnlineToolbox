import { createElement, createCopyButton, createSection, createSegmentedGroup } from '../../utils/dom.js'

export default {
  id: 'lorem',
  name: 'Lorem ipsum 生成',
  description: '生成 Lorem ipsum 占位文本',
  category: 'generator',
  icon: 'lorem',
  render(container) {
    let currentTab = 'paragraph'

    // Latin word bank (~100 words)
    const WORDS = [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
      'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
      'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
      'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
      'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
      'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'semper', 'risus',
      'viverra', 'maecenas', 'accumsan', 'lacus', 'vel', 'facilisis', 'volutpat',
      'vitae', 'sapien', 'pellentesque', 'habitant', 'morbi', 'tristique', 'senectus',
      'netus', 'malesuada', 'fames', 'ac', 'turpis', 'egestas', 'integer', 'feugiat',
      'scelerisque', 'varius', 'nibh', 'nunc', 'faucibus', 'a', 'pellentesque',
      'suspendisse', 'potenti', 'nullam', 'arcu', 'blandit', 'cursus', 'risus',
      'at', 'ultrices', 'mi', 'tempus', 'imperdiet', 'elementum', 'euismod'
    ]

    function getRandomWord() {
      const array = new Uint32Array(1)
      crypto.getRandomValues(array)
      return WORDS[array[0] % WORDS.length]
    }

    function capitalize(word) {
      return word.charAt(0).toUpperCase() + word.slice(1)
    }

    function generateSentence() {
      const array = new Uint32Array(1)
      crypto.getRandomValues(array)
      const length = 8 + (array[0] % 12) // 8-19 words per sentence
      const words = []
      for (let i = 0; i < length; i++) {
        words.push(getRandomWord())
      }
      words[0] = capitalize(words[0])
      return words.join(' ') + '.'
    }

    function generateParagraph() {
      const array = new Uint32Array(1)
      crypto.getRandomValues(array)
      const sentenceCount = 3 + (array[0] % 5) // 3-7 sentences per paragraph
      const sentences = []
      for (let i = 0; i < sentenceCount; i++) {
        sentences.push(generateSentence())
      }
      return sentences.join(' ')
    }

    function generate() {
      const count = Math.max(1, Math.min(50, parseInt(countInput.value) || 1))
      const results = []

      if (currentTab === 'paragraph') {
        for (let i = 0; i < count; i++) {
          results.push(generateParagraph())
        }
        outputTextarea.value = results.join('\n\n')
      } else if (currentTab === 'sentence') {
        for (let i = 0; i < count; i++) {
          results.push(generateSentence())
        }
        outputTextarea.value = results.join(' ')
      } else {
        for (let i = 0; i < count; i++) {
          results.push(getRandomWord())
        }
        outputTextarea.value = results.join(' ')
      }
    }

    // Tabs
    const tabs = createSegmentedGroup([
      { label: '段落', value: 'paragraph' },
      { label: '句子', value: 'sentence' },
      { label: '单词', value: 'word' }
    ], (value) => {
      currentTab = value
    })

    // Count input
    const countLabel = createElement('label', { className: 'label' }, ['数量'])
    const countInput = createElement('input', {
      className: 'input',
      type: 'number',
      value: '3',
      min: '1',
      max: '50'
    })
    const countGroup = createElement('div', { className: 'form-group' }, [countLabel, countInput])

    // Output
    const outputTextarea = createElement('textarea', {
      className: 'textarea',
      placeholder: '点击"生成"按钮生成 Lorem ipsum 文本...',
      rows: 12,
      readOnly: true
    })

    const copyBtn = createCopyButton(() => outputTextarea.value)

    const generateBtn = createElement('button', {
      className: 'btn btn-primary',
      onClick: generate
    }, ['生成'])

    const btnGroup = createElement('div', { className: 'btn-group' }, [generateBtn])
    const outputSection = createSection('生成结果', outputTextarea, [copyBtn])

    container.appendChild(tabs)
    container.appendChild(countGroup)
    container.appendChild(btnGroup)
    container.appendChild(outputSection)
  }
}
