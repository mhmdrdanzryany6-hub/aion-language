import { fail, AionError } from './diagnostic.mjs';
import { binary, boolean, number, finite, makeMap, indexGet, indexSet, display, runtimeType } from './values.mjs';
import { standardLibrary } from './stdlib.mjs';
class Environment {
  constructor(parent=null){this.parent=parent;this.bindings=new Map();}
  cell(name,loc){if(this.bindings.has(name))return this.bindings.get(name);if(this.parent)return this.parent.cell(name,loc);fail('E_NAME',`Binding '${name}' was used before initialization`,loc);}
  declare(name,value,mutable,loc){if(this.bindings.has(name))fail('E_NAME',`Duplicate binding '${name}'`,loc);this.bindings.set(name,{value,mutable});}
}
export class VM {
  constructor(options={}){
    this.fuel=options.fuel??1_000_000;this.maxDepth=options.maxDepth??256;this.maxAllocation=options.maxAllocation??1_000_000;
    if(!Number.isSafeInteger(this.fuel)||this.fuel<1||!Number.isSafeInteger(this.maxDepth)||this.maxDepth<1||!Number.isSafeInteger(this.maxAllocation)||this.maxAllocation<1)throw new AionError('E_CONFIG','Runtime limits must be positive safe integers');
    this.allocated=0;this.stack=[];this.frames=[];this.output='';this.args=options.args??[];this.seed=(options.seed??123456789)>>>0;
    this.modules=new Map();this.onStep=options.onStep;this.host=options.host??{};this.loc={};this.result=null;
    this.builtins=new Environment();for(const[name,value]of Object.entries(standardLibrary(this)))this.builtins.declare(name,value,false,{});
  }
  charge(amount=1){this.fuel-=amount;if(this.fuel<0)fail('E_FUEL','Instruction budget exhausted',this.loc,['Increase --fuel for trusted programs.']);}
  allocate(amount){if(!Number.isSafeInteger(amount)||amount<0||amount>100_000||this.allocated+amount>this.maxAllocation)fail('E_MEMORY','Collection/allocation limit exceeded',this.loc);this.allocated+=amount;}
  write(text){if(this.output.length+text.length>2_000_000)fail('E_OUTPUT','Output exceeds 2 MB limit',this.loc);this.output+=text;}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  execute(module,imports={},entry=true){
    const env=new Environment(this.builtins);for(const[name,value]of Object.entries(imports))env.declare(name,value,false,{});
    const closure={tag:'closure',name:'<module>',module,proto:module.functions[0],env};
    this.invoke(closure,[]);
    const exports=Object.create(null);for(const name of module.exports)exports[name]=env.cell(name,this.loc).value;
    if(entry&&env.bindings.has('main'))this.result=this.invoke(env.cell('main',this.loc).value,[]);
    return {output:this.output,value:this.result,exports,globals:env,steps:this.fuel};
  }
  invoke(callee,args){const depth=this.frames.length;this.call(callee,args);while(this.frames.length>depth)this.step();return this.stack.pop();}
  call(callee,args){
    if(!callee||!['closure','native'].includes(callee.tag))fail('E_CALL',`Cannot call ${runtimeType(callee)}`,this.loc);
    const signature=callee.tag==='native'?callee.signature:{min:callee.proto.params.length,max:callee.proto.params.length,params:callee.proto.paramTypes};
    if(args.length<signature.min||args.length>signature.max)fail('E_ARITY',`${callee.name} received ${args.length} arguments; expected ${signature.min}${signature.min===signature.max?'':`..${signature.max}`}`,this.loc);
    args.forEach((value,i)=>{const t=signature.params[Math.min(i,signature.params.length-1)]??'Any';if(!matches(value,t))fail('E_TYPE',`${callee.name}: expected ${t}, received ${runtimeType(value)}`,this.loc);});
    if(callee.tag==='native'){
      this.charge(args.length+1);
      try{const value=callee.body(...args);if(typeof value==='string')this.allocate(Math.min(value.length,100001));this.stack.push(value??null);}
      catch(e){if(e instanceof AionError)throw e;fail('E_HOST',e.message||'Host operation failed',this.loc);}return;
    }
    if(this.frames.length>=this.maxDepth)fail('E_DEPTH','Call depth limit exceeded',this.loc);
    const env=callee.name==='<module>'?callee.env:new Environment(callee.env);
    args.forEach((value,i)=>env.declare(callee.proto.params[i],value,true,this.loc));
    this.frames.push({callee,env,ip:0,base:this.stack.length,callLoc:this.loc});
  }
  step(){
    const frame=this.frames.at(-1);if(!frame)return false;
    const {proto,module}=frame.callee;this.loc=proto.locations[frame.ip]??{filename:module.filename};
    this.charge();const instruction=proto.code[frame.ip++];if(!instruction)fail('E_BYTECODE','Instruction pointer escaped function',this.loc);
    if(this.onStep)this.onStep({function:proto.name,ip:frame.ip-1,instruction,location:this.loc,depth:this.frames.length,stack:this.stack.slice(frame.base).map(x=>display(x)),locals:Object.fromEntries([...frame.env.bindings].map(([k,c])=>[k,display(c.value)]))});
    const[op,a,b]=instruction;const pop=()=>{if(this.stack.length<=frame.base)fail('E_BYTECODE','Operand stack underflow',this.loc);return this.stack.pop();};
    try{
      switch(op){
        case 'CONST':this.stack.push(module.constants[a]);break;
        case 'LOAD':this.stack.push(frame.env.cell(a,this.loc).value);break;
        case 'DECL':frame.env.declare(a,pop(),b,this.loc);break;
        case 'STORE':{const cell=frame.env.cell(a,this.loc);if(!cell.mutable)fail('E_IMMUTABLE',`Binding '${a}' is immutable`,this.loc);cell.value=this.stack.at(-1);break;}
        case 'POP':pop();break;
        case 'DUP':{const v=pop();this.stack.push(v,v);break;}
        case 'DUP2':{const y=pop(),x=pop();this.stack.push(x,y,x,y);break;}
        case 'UNARY':{const v=pop();this.stack.push(a==='!'?!boolean(v,this.loc):finite(a==='-'?-number(v,this.loc):number(v,this.loc),this.loc));break;}
        case 'BINARY':{const right=pop(),left=pop();const v=binary(a,left,right,this.loc);if(typeof v==='string')this.allocate(v.length);this.stack.push(v);break;}
        case 'BOOL':this.stack.push(boolean(pop(),this.loc));break;
        case 'JUMP':frame.ip=a;break;
        case 'JFALSE':if(!boolean(pop(),this.loc))frame.ip=a;break;
        case 'JTRUE':if(boolean(pop(),this.loc))frame.ip=a;break;
        case 'ENTER':frame.env=new Environment(frame.env);break;
        case 'LEAVE':if(!frame.env.parent)fail('E_BYTECODE','Cannot leave root environment',this.loc);frame.env=frame.env.parent;break;
        case 'CLOSURE':this.stack.push({tag:'closure',name:module.functions[a].name,module,proto:module.functions[a],env:frame.env});break;
        case 'CALL':{const args=[];for(let i=0;i<a;i++)args.unshift(pop());const fn=pop();this.call(fn,args);break;}
        case 'RETURN':{const result=pop();this.stack.length=frame.base;this.frames.pop();this.stack.push(result);break;}
        case 'ARRAY':{this.allocate(a);const values=[];for(let i=0;i<a;i++)values.unshift(pop());this.stack.push(values);break;}
        case 'MAP':{this.allocate(a.length);const values=[];for(let i=a.length-1;i>=0;i--)values.unshift([a[i],pop()]);this.stack.push(makeMap(values));break;}
        case 'GET':{const key=pop(),obj=pop();this.stack.push(indexGet(obj,key,this.loc));break;}
        case 'SET':{const value=pop(),key=pop(),obj=pop();if(obj?.tag==='map'&&!obj.entries.has(key))this.allocate(1);this.stack.push(indexSet(obj,key,value,this.loc));break;}
        case 'CONCAT':{const parts=[];for(let i=0;i<a;i++)parts.unshift(display(pop()));const v=parts.join('');this.allocate(v.length);this.stack.push(v);break;}
        case 'ITER':{const obj=pop();let values;if(Array.isArray(obj))values=obj;else if(typeof obj==='string')values=[...obj];else if(obj?.tag==='map')values=[...obj.entries.keys()];else fail('E_TYPE','Value is not iterable',this.loc);this.stack.push({tag:'iterator',values,index:0});break;}
        case 'ITER_NEXT':{const iter=frame.env.cell(a,this.loc).value;if(iter.index>=iter.values.length)frame.ip=b;else this.stack.push(iter.values[iter.index++]);break;}
        default:fail('E_BYTECODE',`Unknown opcode ${op}`,this.loc);
      }
    }catch(e){if(e instanceof AionError){if(!e.frames.length)e.frames=this.frames.slice().reverse().map(f=>`${f.callee.name} (${f.callLoc?.filename??module.filename}:${f.callLoc?.line??1})`);throw e;}fail('E_VM',e.message||'Virtual machine error',this.loc);}
    return true;
  }
}
function matches(value,type){
  if(type==='Any')return true;if(type==='Void')return value===null;
  if(typeof type==='object')return ['closure','native'].includes(value?.tag);
  if(type.endsWith('[]'))return Array.isArray(value)&&value.every(v=>matches(v,type.slice(0,-2)));
  return runtimeType(value)===type||(type==='Float'&&runtimeType(value)==='Int');
}
