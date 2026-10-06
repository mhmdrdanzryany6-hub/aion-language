import { fail } from './diagnostic.mjs';
export const isMap=value=>value!==null&&typeof value==='object'&&value.tag==='map';
export const makeMap=entries=>({tag:'map',entries:new Map(entries)});
export const runtimeType=value=>value===null?'Null':Array.isArray(value)?'Array':isMap(value)?'Map':typeof value==='object'&&['closure','native'].includes(value?.tag)?'Fn':typeof value==='number'?(Number.isInteger(value)?'Int':'Float'):typeof value==='string'?'String':typeof value==='boolean'?'Bool':'Internal';
export function display(value,seen=new Set()) {
  if(value===null)return 'null';if(typeof value==='string')return value;
  if(['number','boolean'].includes(typeof value))return String(value);
  if(value?.tag==='closure'||value?.tag==='native')return `<fn ${value.name}>`;
  if(seen.has(value))return '<cycle>';
  seen.add(value);let result;
  if(Array.isArray(value))result='['+value.map(x=>display(x,seen)).join(', ')+']';
  else if(isMap(value))result='{'+[...value.entries].map(([k,v])=>`${k}: ${display(v,seen)}`).join(', ')+'}';
  else result='<internal>';
  seen.delete(value);return result;
}
export function number(value,loc){if(typeof value!=='number'||!Number.isFinite(value))fail('E_TYPE',`Expected number, received ${runtimeType(value)}`,loc);return value;}
export function finite(value,loc){if(!Number.isFinite(value)||(Number.isInteger(value)&&!Number.isSafeInteger(value)))fail('E_NUMBER','Numeric result exceeds the supported finite/safe range',loc);return value;}
export function boolean(value,loc){if(typeof value!=='boolean')fail('E_TYPE',`Expected Bool, received ${runtimeType(value)}`,loc);return value;}
export function binary(op,a,b,loc){
  if(op==='==')return a===b;if(op==='!=')return a!==b;
  if(op==='+'&&typeof a==='string'&&typeof b==='string')return a+b;
  if(['<','>','<=','>='].includes(op)&&typeof a==='string'&&typeof b==='string')return { '<':()=>a<b,'>':()=>a>b,'<=':()=>a<=b,'>=':()=>a>=b}[op]();
  number(a,loc);number(b,loc);
  if((op==='/'||op==='%')&&b===0)fail('E_ZERO','Division or remainder by zero',loc);
  if(['<','>','<=','>='].includes(op))return {'<':()=>a<b,'>':()=>a>b,'<=':()=>a<=b,'>=':()=>a>=b}[op]();
  const result={'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'%':()=>a%b}[op];
  if(!result)fail('E_BYTECODE',`Unknown binary operator '${op}'`,loc);return finite(result(),loc);
}
export function indexGet(object,key,loc){
  if(isMap(object)){if(typeof key!=='string')fail('E_TYPE','Dictionary index must be String',loc);if(!object.entries.has(key))fail('E_KEY',`Missing dictionary key '${key}'`,loc);return object.entries.get(key);}
  if(Array.isArray(object)||typeof object==='string'){if(!Number.isInteger(key)||key<0||key>=object.length)fail('E_BOUNDS',`Index ${display(key)} is out of bounds (length ${object.length})`,loc);return object[key];}
  fail('E_TYPE',`Cannot index ${runtimeType(object)}`,loc);
}
export function indexSet(object,key,value,loc){
  if(isMap(object)){if(typeof key!=='string')fail('E_TYPE','Dictionary index must be String',loc);object.entries.set(key,value);return value;}
  if(Array.isArray(object)){indexGet(object,key,loc);object[key]=value;return value;}
  fail('E_TYPE','Only arrays and dictionaries can be mutated',loc);
}
