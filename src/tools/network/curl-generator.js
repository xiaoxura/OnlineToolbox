import { createElement, createCopyButton } from '../../utils/dom.js'
const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`
export function generateCurl({ url, method = 'GET', headers = '', body = '', auth = '' }) {
  if (!url.trim()) throw new Error('请输入请求 URL')
  try { new URL(url) } catch { throw new Error('请输入包含协议的有效 URL') }
  const parts = ['curl', '-X', method.toUpperCase(), quote(url.trim())]
  if (auth.trim()) parts.push('\\\n  -H', quote(`Authorization: Bearer ${auth.trim()}`))
  headers.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    if (!line.includes(':')) throw new Error(`Header 格式错误：${line}`)
    parts.push('\\\n  -H', quote(line))
  })
  if (body.trim()) parts.push('\\\n  --data-raw', quote(body.trim()))
  return parts.join(' ')
}
export default {
  id: 'curl-generator', name: 'CURL 命令生成器', description: '根据请求方法、Headers 和 Body 生成 CURL 命令', category: 'network', icon: 'url-encode',
  render(container) {
    const url = createElement('input', { className: 'input', placeholder: 'https://api.example.com/users' })
    const method = createElement('select', { className: 'select', 'aria-label': 'HTTP 方法' }, ['GET','POST','PUT','PATCH','DELETE'].map(v => createElement('option', { value: v, textContent: v })))
    const auth = createElement('input', { className: 'input', type: 'password', autocomplete: 'off', placeholder: '可选 Bearer Token' })
    const headers = createElement('textarea', { className: 'textarea', rows: 5, placeholder: 'Content-Type: application/json\nAccept: application/json' })
    const body = createElement('textarea', { className: 'textarea', rows: 6, placeholder: '{"name":"Alice"}' })
    const output = createElement('textarea', { className: 'textarea large', readOnly: true, placeholder: 'CURL 命令…' })
    const error = createElement('div', { className: 'error-text' })
    const run = () => { error.textContent=''; try { output.value=generateCurl({url:url.value,method:method.value,headers:headers.value,body:body.value,auth:auth.value}) } catch(e) { output.value='';error.textContent=e.message } }
    container.append(createElement('div',{className:'form-row'},[createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'请求 URL'}),url]),createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'请求方法'}),method])]),createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'Bearer Token（不会保存）'}),auth]),createElement('div',{className:'grid-2'},[createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'Headers（每行一个）'}),headers]),createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'请求 Body'}),body])]),error,createElement('div',{className:'btn-group'},[createElement('button',{className:'btn btn-primary',type:'button',textContent:'生成 CURL',onClick:run}),createElement('button',{className:'btn btn-secondary',type:'button',textContent:'示例数据',onClick:()=>{url.value='https://api.example.com/users';method.value='POST';headers.value='Content-Type: application/json';body.value='{"name":"Alice"}';run()}})]),createElement('div',{className:'result-box'},[createElement('label',{className:'label',textContent:'生成结果'}),output,createCopyButton(()=>output.value)]))
  }
}
