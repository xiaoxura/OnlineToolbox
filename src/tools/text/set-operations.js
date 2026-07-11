import { createElement, createCopyButton } from '../../utils/dom.js'
export function calculateSetOperation(aText,bText,operation,caseSensitive=true){
  const lines=text=>text.split('\n').map(v=>v.trim()).filter(Boolean)
  const a=lines(aText),b=lines(bText),key=v=>caseSensitive?v:v.toLowerCase(),aMap=new Map(a.map(v=>[key(v),v])),bMap=new Map(b.map(v=>[key(v),v]))
  if(operation==='intersection')return [...aMap].filter(([k])=>bMap.has(k)).map(([,v])=>v)
  if(operation==='union')return [...new Map([...aMap,...bMap]).values()]
  if(operation==='a-b')return [...aMap].filter(([k])=>!bMap.has(k)).map(([,v])=>v)
  if(operation==='b-a')return [...bMap].filter(([k])=>!aMap.has(k)).map(([,v])=>v)
  return [...aMap].filter(([k])=>!bMap.has(k)).map(([,v])=>v).concat([...bMap].filter(([k])=>!aMap.has(k)).map(([,v])=>v))
}
export default{id:'set-operations',name:'文本集合运算',description:'计算两组文本行的交集、并集、差集和对称差集',category:'text',icon:'text-diff',render(container){
  const a=createElement('textarea',{className:'textarea large',placeholder:'集合 A，每行一项'}),b=createElement('textarea',{className:'textarea large',placeholder:'集合 B，每行一项'}),out=createElement('textarea',{className:'textarea large',readOnly:true,'aria-label':'运算结果'})
  const op=createElement('select',{className:'select','aria-label':'集合运算'},[['intersection','交集 A ∩ B'],['union','并集 A ∪ B'],['a-b','差集 A − B'],['b-a','差集 B − A'],['symmetric','对称差集']].map(([value,label])=>createElement('option',{value,textContent:label})))
  const sensitive=createElement('input',{className:'checkbox',type:'checkbox',checked:true}),stats=createElement('div',{className:'stats-row'})
  const run=()=>{const result=calculateSetOperation(a.value,b.value,op.value,sensitive.checked);out.value=result.join('\n');stats.textContent='';[['集合 A',a.value],['集合 B',b.value],['结果',out.value]].forEach(([label,text])=>stats.appendChild(createElement('div',{className:'stat-item'},[createElement('span',{className:'stat-label',textContent:label}),createElement('span',{className:'stat-value',textContent:String(text.split('\n').filter(Boolean).length)})])))}
  container.append(createElement('div',{className:'grid-2'},[createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'集合 A'}),a]),createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'集合 B'}),b])]),createElement('div',{className:'form-row'},[createElement('div',{className:'form-group'},[createElement('label',{className:'label',textContent:'运算方式'}),op]),createElement('label',{className:'option-item'},[sensitive,createElement('span',{textContent:'区分大小写'})])]),createElement('div',{className:'btn-group'},[createElement('button',{className:'btn btn-primary',type:'button',textContent:'计算集合',onClick:run}),createElement('button',{className:'btn btn-secondary',type:'button',textContent:'示例数据',onClick:()=>{a.value='apple\nbanana\norange';b.value='banana\ngrape\norange';run()}})]),stats,createElement('div',{className:'result-box'},[createElement('label',{className:'label',textContent:'运算结果'}),out,createCopyButton(()=>out.value)]))
}}
