import { createElement, createCopyButton } from '../../utils/dom.js'

export function updateUrlParams(rawUrl, params) {
  const url = new URL(rawUrl)
  url.search = ''
  params.filter(([key]) => key !== '').forEach(([key, value]) => url.searchParams.append(key, value))
  return url.toString()
}

export default {
  id: 'url-params', name: 'URL 参数编辑器', description: '可视化解析、添加、删除和重新生成 URL 查询参数', category: 'network', icon: 'url-encode',
  render(container) {
    const urlInput = createElement('input', { className: 'input', placeholder: 'https://example.com/search?q=tool&page=1' })
    const rows = createElement('div', { className: 'param-rows' })
    const output = createElement('textarea', { className: 'textarea', rows: 4, readOnly: true, 'aria-label': '生成的 URL' })
    const error = createElement('div', { className: 'error-text' })
    const getParams = () => [...rows.querySelectorAll('.param-row')].map(row => [...row.querySelectorAll('input')].map(input => input.value))
    const generate = () => { error.textContent=''; try { output.value=updateUrlParams(urlInput.value,getParams()) } catch { output.value='';error.textContent='请输入包含协议的有效 URL' } }
    const addRow = (key='', value='') => {
      const row=createElement('div',{className:'param-row'})
      const keyInput=createElement('input',{className:'input',value:key,placeholder:'参数名','aria-label':'参数名'})
      const valueInput=createElement('input',{className:'input',value,placeholder:'参数值','aria-label':'参数值'})
      row.append(keyInput,valueInput,createElement('button',{className:'btn-icon param-remove',type:'button',title:'删除参数','aria-label':'删除参数',textContent:'×',onClick:()=>{row.remove();generate()}}))
      ;[keyInput,valueInput].forEach(input=>input.addEventListener('input',generate));rows.appendChild(row)
    }
    const parse = () => { error.textContent='';try{const url=new URL(urlInput.value);rows.innerHTML='';url.searchParams.forEach((value,key)=>addRow(key,value));if(!rows.children.length)addRow();generate()}catch{error.textContent='请输入包含协议的有效 URL'} }
    container.append(createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'完整 URL'}),urlInput]),createElement('div',{className:'btn-group'},[createElement('button',{className:'btn btn-primary',type:'button',textContent:'解析 URL',onClick:parse}),createElement('button',{className:'btn btn-secondary',type:'button',textContent:'添加参数',onClick:()=>addRow()}),createElement('button',{className:'btn btn-secondary',type:'button',textContent:'示例数据',onClick:()=>{urlInput.value='https://example.com/search?q=online+tools&page=1';parse()}})]),error,createElement('div',{className:'param-heading'},[createElement('span',{textContent:'参数名'}),createElement('span',{textContent:'参数值'})]),rows,createElement('div',{className:'result-box'},[createElement('label',{className:'label',textContent:'生成的 URL'}),output,createCopyButton(()=>output.value)]))
    addRow()
  }
}
