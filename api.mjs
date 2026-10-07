import { parse } from './parser.mjs';
import { check } from './types.mjs';
import { emitBytecode } from './compiler.mjs';
import { VM } from './vm.mjs';
import { fail } from './diagnostic.mjs';
export { AionError } from './diagnostic.mjs';
export function compile(source,{filename='<input>',importTypes={},globalTypes={},returnLastExpression=false}={}){
  const ast=parse(source,filename);
  const pending=[[ast,0]];
  while(pending.length){const [node,depth]=pending.pop();if(depth>180)fail('E_DEPTH','Syntax tree nesting limit exceeded',node.loc);for(const [key,value] of Object.entries(node)){if(key==='loc')continue;if(Array.isArray(value)){for(const item of value){if(item&&typeof item==='object')pending.push([item,depth+1]);}}else if(value&&typeof value==='object')pending.push([value,depth+1]);}}
  const types=check(ast,importTypes,globalTypes);
  if(returnLastExpression&&ast.body.at(-1)?.kind==='expression')ast.body.at(-1).kind='return';
  return emitBytecode(ast,source,filename,types);
}
export function run(source,options={}){
  const module=compile(source,options);if(module.imports.length)fail('E_IMPORT','Use the file-based runner to resolve imports',module.imports[0].loc);
  return new VM(options).execute(module);
}
export function disassemble(module){
  const lines=[`AION bytecode v${module.version} / ${module.filename}`];
  for(const fn of module.functions){lines.push(`\nfn ${fn.name}(${fn.params.join(', ')})`);fn.code.forEach((ins,i)=>lines.push(`${String(i).padStart(4,'0')}  ${ins[0].padEnd(10)} ${ins.slice(1).map(x=>JSON.stringify(x)).join(' ')}  ; line ${fn.locations[i]?.line??'?'}`));}
  return lines.join('\n')+'\n';
}
