import fs from 'node:fs';
import path from 'node:path';
import { compile } from './api.mjs';
import { parse } from './parser.mjs';
import { VM } from './vm.mjs';
import { verifyBundle } from './bytecode.mjs';
import { AionError } from './diagnostic.mjs';
const error=(message,code='E_BYTECODE')=>{throw new AionError(code,message);};
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
export function buildFile(entry,{projectRoot}={}){
  let real;try{real=fs.realpathSync(entry);}catch{error(`Cannot resolve file: ${entry}`,'E_FILE');}
  const root=projectRoot?fs.realpathSync(projectRoot):path.dirname(real), modules=[], visited=new Map(), active=new Set();
  function visit(file){
    if(!inside(root,file))error('Import escapes project root','E_IMPORT');
    try{file=fs.realpathSync(file);}catch{error('Cannot resolve imported file','E_FILE');}
    if(!inside(root,file))error('Import escapes project root','E_IMPORT');
    const id=path.relative(root,file).split(path.sep).join('/');
    if(active.has(id))error(`Import cycle: ${id}`,'E_IMPORT');
    if(visited.has(id))return visited.get(id);
    if(active.size>=100||modules.length>=100)error('Module limit exceeded','E_IMPORT');
    active.add(id);const source=fs.readFileSync(file,'utf8'), ast=parse(source,id), dependencies=Object.create(null), importTypes=Object.create(null);
    for(const node of ast.body.filter(n=>n.kind==='import')){
      if(!node.path.startsWith('./')&&!node.path.startsWith('../'))error('Imports must be relative paths','E_IMPORT');
      const child=visit(path.resolve(path.dirname(file),node.path));dependencies[node.path]=child.id;importTypes[node.path]=child.module.types;
      for(const name of node.names)if(!Object.hasOwn(child.module.types,name))error(`'${name}' is not exported by ${child.id}`,'E_IMPORT');
    }
    const item={id,module:compile(source,{filename:id,importTypes}),dependencies};
    active.delete(id);visited.set(id,item);modules.push(item);return item;
  }
  const first=visit(real);return {format:'aion.bundle',version:2,entry:first.id,modules};
}
export const validateBundle=verifyBundle;
export function runBundle(bundle,options={}){
  validateBundle(bundle);const vm=new VM(options), results=new Map(), active=new Set(), items=new Map(bundle.modules.map(m=>[m.id,m]));
  function execute(id){if(results.has(id))return results.get(id);if(active.has(id))error('Dependency cycle');active.add(id);const item=items.get(id), bindings=Object.create(null);
    for(const imp of item.module.imports){const dep=item.dependencies[imp.path];if(!dep)error('Missing import dependency');const result=execute(dep);for(const name of imp.names){if(!Object.hasOwn(result.exports,name))error('Missing imported export');bindings[name]=result.exports[name];}}
    const result=vm.execute(item.module,bindings,id===bundle.entry&&options.entry!==false);results.set(id,result);active.delete(id);return result;
  }
  const result=execute(bundle.entry);return {...result,vm};
}
export function createFileHost({base=process.cwd(),read=[],write=[]}={}){
  base=fs.realpathSync(base);const roots=list=>list.map(p=>fs.realpathSync(path.resolve(base,p))), reads=roots(read),writes=roots(write);
  function resolve(name,scopes,writing=false){
    if(typeof name!=='string'||name.includes('\0'))error('Invalid file path','E_CAPABILITY');const target=path.resolve(base,name);
    if(!scopes.some(r=>inside(r,target)))error('File outside capability scope','E_CAPABILITY');
    let actual;try{actual=fs.existsSync(target)?fs.realpathSync(target):writing?path.join(fs.realpathSync(path.dirname(target)),path.basename(target)):null;}catch{error('Cannot resolve file capability','E_CAPABILITY');}
    if(!actual||!scopes.some(r=>inside(r,actual)))error('File outside capability scope','E_CAPABILITY');return actual;
  }
  return {readText(name){const file=resolve(name,reads);if(fs.statSync(file).size>2_000_000)error('File exceeds size limit','E_FILE');return fs.readFileSync(file,'utf8');},writeText(name,text){if(text.length>2_000_000)error('File exceeds size limit','E_FILE');fs.writeFileSync(resolve(name,writes,true),text,'utf8');}};
}


