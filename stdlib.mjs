import { fail, AionError } from './diagnostic.mjs';
import { BUILTIN_TYPES } from './types.mjs';
import { display, runtimeType, number, finite, boolean, isMap, makeMap } from './values.mjs';
const array=(x,loc)=>{if(!Array.isArray(x))fail('E_TYPE',`Expected Array, received ${runtimeType(x)}`,loc);return x;};
const string=(x,loc)=>{if(typeof x!=='string')fail('E_TYPE',`Expected String, received ${runtimeType(x)}`,loc);return x;};
const integer=(x,loc)=>{number(x,loc);if(!Number.isSafeInteger(x))fail('E_TYPE','Expected safe Int',loc);return x;};
export function standardLibrary(ctx) {
  const f={
    print:(...xs)=>{ctx.write(xs.map(x=>display(x)).join(' ')+'\n');return null;},
    assert:(condition,message='Assertion failed')=>{if(!boolean(condition,ctx.loc))fail('E_ASSERT',string(message,ctx.loc),ctx.loc);return null;},
    len:x=>{if(isMap(x))return x.entries.size;if(Array.isArray(x)||typeof x==='string')return x.length;fail('E_TYPE','len expects Array, String or Map',ctx.loc);},
    range:(...xs)=>{let start=0,end=xs[0],step=1;if(xs.length>=2)[start,end]=xs;if(xs.length===3)step=xs[2];xs.forEach(x=>integer(x,ctx.loc));if(step===0)fail('E_RANGE','range step cannot be zero',ctx.loc);const length=Math.max(0,Math.ceil((end-start)/step));ctx.allocate(length);ctx.charge(length);return Array.from({length},(_,i)=>finite(start+i*step,ctx.loc));},
    push:(a,x)=>{array(a,ctx.loc);if(a.length>=100000)fail('E_MEMORY','Collection size limit exceeded',ctx.loc);ctx.types.mutation(a,x,ctx.loc);ctx.allocate(1);a.push(x);return null;},
    pop:a=>{array(a,ctx.loc);if(!a.length)fail('E_BOUNDS','Cannot pop an empty array',ctx.loc);return a.pop();},
    keys:x=>{if(!isMap(x))fail('E_TYPE','keys expects Map',ctx.loc);ctx.allocate(x.entries.size);return [...x.entries.keys()];},
    values:x=>{if(!isMap(x))fail('E_TYPE','values expects Map',ctx.loc);ctx.allocate(x.entries.size);return [...x.entries.values()];},
    has:(x,k)=>{if(isMap(x))return x.entries.has(k);if(Array.isArray(x)||typeof x==='string')return Number.isInteger(k)&&k>=0&&k<x.length;fail('E_TYPE','has expects a collection',ctx.loc);},
    str:x=>display(x),
    int:x=>{if(!['number','string','boolean'].includes(typeof x)||typeof x==='string'&&!/^[+-]?\d+(\.\d+)?$/.test(x.trim()))fail('E_TYPE','int expects a numeric value or numeric string',ctx.loc);return finite(Math.trunc(Number(x)),ctx.loc);},
    float:x=>{if(!['number','string','boolean'].includes(typeof x)||typeof x==='string'&&(!x.trim()||!Number.isFinite(Number(x))))fail('E_TYPE','float expects a numeric value or numeric string',ctx.loc);return finite(Number(x),ctx.loc);},
    type:runtimeType,abs:x=>Math.abs(number(x,ctx.loc)),min:(...x)=>Math.min(...x.map(v=>number(v,ctx.loc))),max:(...x)=>Math.max(...x.map(v=>number(v,ctx.loc))),
    sqrt:x=>finite(Math.sqrt(number(x,ctx.loc)),ctx.loc),pow:(a,b)=>finite(Math.pow(number(a,ctx.loc),number(b,ctx.loc)),ctx.loc),floor:x=>finite(Math.floor(number(x,ctx.loc)),ctx.loc),ceil:x=>finite(Math.ceil(number(x,ctx.loc)),ctx.loc),round:x=>finite(Math.round(number(x,ctx.loc)),ctx.loc),
    split:(x,delimiter)=>{const result=string(x,ctx.loc).split(string(delimiter,ctx.loc));ctx.allocate(result.length);return result;},
    join:(x,delimiter)=>array(x,ctx.loc).map(v=>display(v)).join(string(delimiter,ctx.loc)),upper:x=>string(x,ctx.loc).toUpperCase(),lower:x=>string(x,ctx.loc).toLowerCase(),trim:x=>string(x,ctx.loc).trim(),
    contains:(x,value)=>{if(Array.isArray(x)||typeof x==='string')return x.includes(value);if(isMap(x))return x.entries.has(value);fail('E_TYPE','contains expects a collection',ctx.loc);},
    slice:(x,start,end)=>{integer(start,ctx.loc);if(end!==undefined)integer(end,ctx.loc);if(!Array.isArray(x)&&typeof x!=='string')fail('E_TYPE','slice expects Array or String',ctx.loc);const result=x.slice(start,end);ctx.allocate(result.length);return result;},
    sort:x=>{array(x,ctx.loc);ctx.allocate(x.length);ctx.charge(x.length*Math.max(1,Math.ceil(Math.log2(x.length+1))));const result=x.slice();if(x.every(v=>typeof v==='number'))return result.sort((a,b)=>a-b);if(x.every(v=>typeof v==='string'))return result.sort();fail('E_TYPE','sort requires an all-number or all-string array',ctx.loc);},
    reverse:x=>{array(x,ctx.loc);ctx.allocate(x.length);return x.slice().reverse();},
    map:(a,callback)=>{array(a,ctx.loc);ctx.allocate(a.length);return a.map(x=>ctx.invoke(callback,[x]));},
    filter:(a,callback)=>{array(a,ctx.loc);ctx.allocate(a.length);return a.filter(x=>boolean(ctx.invoke(callback,[x]),ctx.loc));},
    reduce:(a,initial,callback)=>array(a,ctx.loc).reduce((acc,x)=>ctx.invoke(callback,[acc,x]),initial),
    json_parse:source=>{string(source,ctx.loc);if(source.length>1_000_000)fail('E_SIZE','JSON input exceeds 1 MB',ctx.loc);try{return fromJSON(JSON.parse(source),ctx);}catch(e){if(e instanceof AionError)throw e;fail('E_JSON','Invalid JSON input',ctx.loc);}},
    json_stringify:value=>{try{return JSON.stringify(toJSON(value,ctx));}catch(e){if(e instanceof AionError)throw e;fail('E_JSON','Cannot serialize this value',ctx.loc);}},
    read_text:path=>{string(path,ctx.loc);if(!ctx.host.readText)fail('E_CAPABILITY','File reading is disabled; grant --allow-read DIRECTORY',ctx.loc);return ctx.host.readText(path);},
    write_text:(path,content)=>{string(path,ctx.loc);string(content,ctx.loc);if(!ctx.host.writeText)fail('E_CAPABILITY','File writing is disabled; grant --allow-write DIRECTORY',ctx.loc);ctx.host.writeText(path,content);return null;},
    clock:()=>performance.now()/1000,random:()=>ctx.random(),args:()=>ctx.args.slice()
  };
  return Object.fromEntries(Object.entries(f).map(([name,body])=>[name,{tag:'native',name,body,signature:BUILTIN_TYPES[name]}]));
}
function fromJSON(value,ctx,depth=0){
  if(depth>150)fail('E_DEPTH','JSON nesting limit exceeded',ctx.loc);
  if(typeof value==='number')return finite(value,ctx.loc);
  if(Array.isArray(value)){ctx.allocate(value.length);return value.map(x=>fromJSON(x,ctx,depth+1));}
  if(value&&typeof value==='object'){const entries=Object.entries(value);ctx.allocate(entries.length);return makeMap(entries.map(([k,v])=>[k,fromJSON(v,ctx,depth+1)]));}
  return value;
}
function toJSON(value,ctx,seen=new Set(),depth=0){
  if(depth>150)fail('E_DEPTH','JSON nesting limit exceeded',ctx.loc);
  if(value===null||['string','number','boolean'].includes(typeof value))return value;
  if(seen.has(value))fail('E_JSON','Cannot serialize cyclic collections',ctx.loc);
  seen.add(value);let result;
  if(Array.isArray(value))result=value.map(x=>toJSON(x,ctx,seen,depth+1));
  else if(isMap(value))result=Object.fromEntries([...value.entries].map(([k,v])=>[k,toJSON(v,ctx,seen,depth+1)]));
  else fail('E_JSON','Functions cannot be serialized',ctx.loc);
  seen.delete(value);return result;
}
