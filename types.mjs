import { fail } from './diagnostic.mjs';
export const fnType=(params,result='Any',min=params.length,max=params.length)=>({kind:'Fn',params,result,min,max});
export const typeName=t=>typeof t==='string'?t:`fn(${t.params.map(typeName).join(', ')}) -> ${typeName(t.result)}`;
export const compatible=(expected,actual)=>expected==='Any'||actual==='Any'||expected===actual||(expected==='Float'&&actual==='Int')||(typeof expected==='object'&&typeof actual==='object')||(typeof expected==='string'&&typeof actual==='string'&&expected.endsWith('[]')&&actual.endsWith('[]')&&compatible(expected.slice(0,-2),actual.slice(0,-2)));
export const BUILTIN_TYPES={
  print:fnType(['Any'],'Void',0,Infinity),assert:fnType(['Bool','String'],'Void',1,2),
  len:fnType(['Any'],'Int'),range:fnType(['Int','Int','Int'],'Int[]',1,3),
  push:fnType(['Any','Any'],'Void'),pop:fnType(['Any'],'Any'),keys:fnType(['Map'],'String[]'),values:fnType(['Map'],'Any[]'),has:fnType(['Any','Any'],'Bool'),
  str:fnType(['Any'],'String'),int:fnType(['Any'],'Int'),float:fnType(['Any'],'Float'),type:fnType(['Any'],'String'),
  abs:fnType(['Float'],'Float'),min:fnType(['Float'],'Float',1,Infinity),max:fnType(['Float'],'Float',1,Infinity),sqrt:fnType(['Float'],'Float'),pow:fnType(['Float','Float'],'Float'),floor:fnType(['Float'],'Int'),ceil:fnType(['Float'],'Int'),round:fnType(['Float'],'Int'),
  split:fnType(['String','String'],'String[]'),join:fnType(['Any','String'],'String'),upper:fnType(['String'],'String'),lower:fnType(['String'],'String'),trim:fnType(['String'],'String'),contains:fnType(['Any','Any'],'Bool'),slice:fnType(['Any','Int','Int'],'Any',2,3),
  sort:fnType(['Any'],'Any'),reverse:fnType(['Any'],'Any'),map:fnType(['Any','Any'],'Any[]'),filter:fnType(['Any','Any'],'Any[]'),reduce:fnType(['Any','Any','Any'],'Any'),
  json_parse:fnType(['String'],'Any'),json_stringify:fnType(['Any'],'String'),read_text:fnType(['String'],'String'),write_text:fnType(['String','String'],'Void'),
  clock:fnType([],'Float'),random:fnType([],'Float'),args:fnType([],'String[]')
};
class Scope {
  constructor(parent=null){this.parent=parent;this.names=new Map();}
  get(name,loc){if(this.names.has(name))return this.names.get(name);if(this.parent)return this.parent.get(name,loc);fail('E_NAME',`Unknown name '${name}'`,loc);}
  define(name,type,mutable,loc){if(this.names.has(name))fail('E_NAME',`Duplicate binding '${name}'`,loc);const info={type,mutable};this.names.set(name,info);return info;}
}
export function check(ast, imports={}, globals={}) {
  const builtins=new Scope();for(const[name,type]of Object.entries(BUILTIN_TYPES))builtins.define(name,type,false,{});
  let scope=new Scope(builtins),loop=0,current=null;const root=scope,exports=Object.create(null);
  for(const [name,info] of Object.entries(globals))scope.define(name,info.type,info.mutable,{});
  const expect=(expected,actual,loc)=>{if(!compatible(expected,actual))fail('E_TYPE',`Expected ${typeName(expected)}, received ${typeName(actual)}`,loc);};
  const bool=(type,loc)=>expect('Bool',type,loc);
  const numeric=(type,loc)=>{if(!['Any','Int','Float'].includes(type))fail('E_TYPE',`Expected number, received ${typeName(type)}`,loc);};
  function statements(body){
    for(const n of body)if(n.kind==='function')scope.define(n.name,fnType(n.params.map(p=>p.type),n.returns),false,n.loc);
    for(const n of body)statement(n);
  }
  function child(callback){const parent=scope;scope=new Scope(parent);try{return callback();}finally{scope=parent;}}
  function functionBody(n,signature){
    const prior=current,priorLoop=loop;current={declared:n.returns,returns:[]};loop=0;
    child(()=>{for(const p of n.params)scope.define(p.name,p.type,true,p.loc);statement(n.body);});
    const returns=current.returns;
    if(n.returns==='Any') signature.result=returns.length?(alwaysReturns(n.body)?returns.reduce((a,b)=>compatible(a,b)&&compatible(b,a)?a:'Any'):'Any'): 'Void';
    else if(n.returns!=='Void'&&!alwaysReturns(n.body))fail('E_RETURN',`Function '${n.name??'<lambda>'}' must return ${n.returns} on every path`,n.loc);
    current=prior;loop=priorLoop;return signature;
  }
  function statement(n){
    if((n.exported||n.kind==='import')&&scope!==root)fail(n.exported?'E_EXPORT':'E_IMPORT','Imports and exports must be at module scope',n.loc);
    switch(n.kind){
      case 'import': for(const name of n.names)scope.define(name,imports[n.path]?.[name]??'Any',false,n.loc);break;
      case 'function': {const info=scope.get(n.name,n.loc);functionBody(n,info.type);if(n.exported)exports[n.name]=info.type;break;}
      case 'decl': {const actual=expr(n.value);const type=n.annotation??actual;expect(type,actual,n.loc);n.checkedType=typeof type==='string'?type:'Fn';scope.define(n.name,type,n.mutable,n.loc);if(n.exported)exports[n.name]=type;break;}
      case 'expression': expr(n.value);break;
      case 'block': child(()=>statements(n.body));break;
      case 'if': bool(expr(n.condition),n.condition.loc);statement(n.yes);if(n.no)statement(n.no);break;
      case 'while': bool(expr(n.condition),n.condition.loc);loop++;statement(n.body);loop--;break;
      case 'for': {const t=expr(n.iterable);if(typeof t!=='string'||(!t.endsWith('[]')&&!['String','Map','Any'].includes(t)))fail('E_TYPE',`Type ${typeName(t)} is not iterable`,n.loc);loop++;child(()=>{scope.define(n.name,t.endsWith('[]')?t.slice(0,-2):t==='String'?'String':'Any',false,n.loc);statement(n.body);});loop--;break;}
      case 'return': if(!current)fail('E_RETURN','return is only valid inside a function',n.loc);{const t=n.value?expr(n.value):'Void';expect(current.declared,t,n.loc);current.returns.push(t);}break;
      case 'break': case 'continue': if(!loop)fail('E_LOOP',`${n.kind} is only valid inside a loop`,n.loc);break;
    }
  }
  function expr(n){
    switch(n.kind){
      case 'literal': return n.value===null?'Any':typeof n.value==='number'?(Number.isInteger(n.value)?'Int':'Float'):typeof n.value==='boolean'?'Bool':'String';
      case 'name':return scope.get(n.name,n.loc).type;
      case 'array': {const types=n.items.map(expr);const joined=types.length?types.reduce((a,b)=>a===b?a:['Int','Float'].includes(a)&&['Int','Float'].includes(b)?'Float':'Any'):'Any';return (typeof joined==='string'?joined:'Any')+'[]';}
      case 'map': n.entries.forEach(([,v])=>expr(v));return 'Map';
      case 'interpolate': n.parts.forEach(p=>{if(typeof p!=='string')expr(p);});return 'String';
      case 'lambda': return functionBody(n,fnType(n.params.map(p=>p.type),n.returns));
      case 'unary': {const t=expr(n.value);if(n.op==='!'){bool(t,n.loc);return 'Bool';}numeric(t,n.loc);return t;}
      case 'binary': {const a=expr(n.left),b=expr(n.right);
        if(['&&','||'].includes(n.op)){bool(a,n.loc);bool(b,n.loc);return 'Bool';}
        if(['==','!='].includes(n.op))return 'Bool';
        if(n.op==='+'&&a==='String'&&b==='String')return 'String';
        if(['<','>','<=','>='].includes(n.op)&&a==='String'&&b==='String')return 'Bool';
        numeric(a,n.loc);numeric(b,n.loc);
        return ['<','>','<=','>='].includes(n.op)?'Bool':n.op==='/'||a==='Float'||b==='Float'?'Float':a==='Any'||b==='Any'?'Any':'Int';
      }
      case 'call': {const callee=expr(n.callee),actual=n.args.map(expr);
        if(n.callee.kind==='name'&&n.callee.name==='push'&&scope.get('push',n.loc).type===BUILTIN_TYPES.push&&typeof actual[0]==='string'&&actual[0].endsWith('[]'))expect(actual[0].slice(0,-2),actual[1]??'Void',n.loc);
        if(callee==='Any')return 'Any';
        if(typeof callee!=='object')fail('E_TYPE',`Cannot call ${typeName(callee)}`,n.loc);
        if(actual.length<callee.min||actual.length>callee.max)fail('E_ARITY',`Expected ${callee.min===callee.max?callee.min:`${callee.min}..${callee.max}`} arguments, received ${actual.length}`,n.loc);
        actual.forEach((t,i)=>expect(callee.params[Math.min(i,callee.params.length-1)]??'Any',t,n.args[i].loc));
        return callee.result;
      }
      case 'index': {const t=expr(n.object),key=expr(n.index);
        if(typeof t==='string'&&t.endsWith('[]')){expect('Int',key,n.loc);return t.slice(0,-2);}
        if(t==='String'){expect('Int',key,n.loc);return 'String';}
        if(t==='Map'){expect('String',key,n.loc);return 'Any';}
        if(t==='Any')return 'Any';fail('E_TYPE',`Cannot index ${typeName(t)}`,n.loc);
      }
      case 'assign': {
        const t=expr(n.target),value=expr(n.value);
        if(n.target.kind==='name'&&!scope.get(n.target.name,n.loc).mutable)fail('E_IMMUTABLE',`Binding '${n.target.name}' is immutable; use var instead of let`,n.loc);
        if(n.target.kind==='index'&&expr(n.target.object)==='String')fail('E_IMMUTABLE','Strings cannot be mutated',n.loc);
        if(n.op!=='='&&!(n.op==='+='&&t==='String'&&value==='String')){numeric(t,n.loc);numeric(value,n.loc);}
        const result=n.op==='='?value:n.op==='/='||t==='Float'||value==='Float'?'Float':value;
        expect(t,result,n.loc);return t;
      }
    }
    fail('E_INTERNAL',`Unsupported AST node ${n.kind}`,n.loc);
  }
  statements(ast.body);return {exports};
}
function alwaysReturns(n){
  if(n.kind==='return')return true;
  if(n.kind==='block')return n.body.some(alwaysReturns);
  if(n.kind==='if')return !!n.no&&alwaysReturns(n.yes)&&alwaysReturns(n.no);
  return false;
}
