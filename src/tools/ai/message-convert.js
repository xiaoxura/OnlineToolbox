import { createElement, createSegmentedGroup, createCopyButton } from '../../utils/dom.js'
import { chatFormats, convertChat } from './chat-formats.js'

const SAMPLES = {
  openai: JSON.stringify([
    { role: 'system', content: '你是一个天气助手。' },
    { role: 'user', content: '北京今天天气如何？' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"北京"}' } }]
    },
    { role: 'tool', tool_call_id: 'call_1', content: '{"temp":26,"desc":"晴"}' }
  ], null, 2),
  anthropic: JSON.stringify({
    system: '你是一个天气助手。',
    messages: [
      { role: 'user', content: '北京今天天气如何？' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: '北京' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"temp":26,"desc":"晴"}' }] }
    ]
  }, null, 2),
  gemini: JSON.stringify({
    systemInstruction: { parts: [{ text: '你是一个天气助手。' }] },
    contents: [
      { role: 'user', parts: [{ text: '北京今天天气如何？' }] },
      { role: 'model', parts: [{ functionCall: { name: 'get_weather', args: { city: '北京' } } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'get_weather', response: { temp: 26, desc: '晴' } } }] }
    ]
  }, null, 2)
}

const formatOptions = chatFormats.map(format => ({ value: format.id, label: format.label }))

export default {
  id: 'message-convert',
  name: '对话格式互转',
  description: '在 OpenAI、Anthropic、Gemini 三种消息格式之间互转，支持工具调用',
  category: 'ai',
  icon: 'ai-convert',
  render(container) {
    const input = createElement('textarea', {
      className: 'textarea large',
      placeholder: '粘贴源格式的消息 JSON…',
      rows: 14
    })
    const output = createElement('textarea', {
      className: 'textarea large',
      readOnly: true,
      placeholder: '转换结果将显示在此…',
      rows: 14
    })
    const error = createElement('div', { className: 'error-text' })
    const hint = createElement('div', { className: 'form-hint' })

    let sourceId = 'openai'
    let targetId = 'anthropic'

    const sourceGroup = createSegmentedGroup(formatOptions, value => {
      sourceId = value
      // Converting a format into itself is never what the user wants.
      if (targetId === value) {
        targetId = chatFormats.find(format => format.id !== value).id
        targetGroup.setValue(targetId)
      }
      run()
    }, { label: '源格式' })

    const targetGroup = createSegmentedGroup(formatOptions, value => {
      targetId = value
      if (sourceId === value) {
        sourceId = chatFormats.find(format => format.id !== value).id
        sourceGroup.setValue(sourceId)
      }
      run()
    }, { label: '目标格式' })

    function run() {
      error.textContent = ''
      hint.textContent = ''
      if (!input.value.trim()) {
        output.value = ''
        return
      }
      try {
        output.value = JSON.stringify(convertChat(input.value, sourceId, targetId), null, 2)
      } catch (cause) {
        output.value = ''
        error.textContent = cause instanceof Error ? cause.message : String(cause)
      }
    }

    input.addEventListener('input', run)

    const loadSample = () => {
      input.value = SAMPLES[sourceId]
      run()
    }

    container.append(
      createElement('div', { className: 'form-row' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '源格式' }),
          sourceGroup
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '目标格式' }),
          targetGroup
        ])
      ]),
      createElement('div', { className: 'grid-2' }, [
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '源消息' }),
          input
        ]),
        createElement('div', { className: 'form-group' }, [
          createElement('label', { className: 'label', textContent: '转换结果' }),
          output
        ])
      ]),
      createElement('div', { className: 'btn-group form-action-row' }, [
        createElement('button', {
          className: 'btn btn-primary',
          type: 'button',
          textContent: '转换',
          onClick: run
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '示例数据',
          onClick: loadSample
        }),
        createElement('button', {
          className: 'btn btn-secondary',
          type: 'button',
          textContent: '交换方向',
          onClick: () => {
            const previousSource = sourceId
            sourceId = targetId
            targetId = previousSource
            sourceGroup.setValue(sourceId)
            targetGroup.setValue(targetId)
            if (output.value) input.value = output.value
            run()
          }
        }),
        createCopyButton(() => output.value)
      ]),
      error,
      hint
    )
  }
}
