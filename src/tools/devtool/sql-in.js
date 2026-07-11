import { createElement, createCopyButton } from '../../utils/dom.js'

export function generateSqlIn(text, { field = '', not = false, quote = 'auto', dedupe = true, sort = false } = {}) {
  let values = text.split(/[\n,;\t]+/).map(v => v.trim()).filter(Boolean)
  if (dedupe) values = [...new Set(values)]
  if (sort) values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
  if (!values.length) throw new Error('请输入至少一个值')
  const escaped = values.map(value => {
    const shouldQuote = quote === 'string' || (quote === 'auto' && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value))
    return shouldQuote ? `'${value.replace(/'/g,"''")}'` : value
  })
  return `${field.trim() ? `${field.trim()} ` : ''}${not ? 'NOT IN' : 'IN'} (${escaped.join(', ')})`
}
export default {
  id:'sql-in',name:'SQL IN 参数生成',description:'将多行数据转换为 SQL IN 或 NOT IN 条件',category:'devtool',icon:'sql',
  render(container){
    const input=createElement('textarea',{className:'textarea large',placeholder:'每行一个值，也支持逗号、分号或 Tab 分隔'})
    const output=createElement('textarea',{className:'textarea large',readOnly:true})
    const field=createElement('input',{className:'input',placeholder:'字段名（可选），例如 user_id'})
    const quote=createElement('select',{className:'select','aria-label':'引号模式'},[createElement('option',{value:'auto',textContent:'自动判断类型'}),createElement('option',{value:'string',textContent:'全部作为字符串'}),createElement('option',{value:'number',textContent:'全部不加引号'})])
    const not=createElement('input',{type:'checkbox',className:'checkbox'}),dedupe=createElement('input',{type:'checkbox',className:'checkbox',checked:true}),sort=createElement('input',{type:'checkbox',className:'checkbox'})
    const error=createElement('div',{className:'error-text'})
    const run=()=>{error.textContent='';try{output.value=generateSqlIn(input.value,{field:field.value,not:not.checked,quote:quote.value,dedupe:dedupe.checked,sort:sort.checked})}catch(e){output.value='';error.textContent=e.message}}
    const option=(box,text)=>createElement('label',{className:'option-item'},[box,createElement('span',{textContent:text})])
    container.append(createElement('div',{className:'grid-2'},[createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'原始数据'}),input]),createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'SQL 条件'}),output])]),createElement('div',{className:'form-row'},[createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'字段名'}),field]),createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'值类型'}),quote])]),createElement('div',{className:'option-row'},[option(not,'生成 NOT IN'),option(dedupe,'去除重复值'),option(sort,'自动排序')]),error,createElement('div',{className:'btn-group'},[createElement('button',{className:'btn btn-primary',type:'button',textContent:'生成 SQL',onClick:run}),createElement('button',{className:'btn btn-secondary',type:'button',textContent:'示例数据',onClick:()=>{input.value="1001\n1002\nO'Reilly\n1001";field.value='user_id';run()}}),createCopyButton(()=>output.value)]))
  }
}
