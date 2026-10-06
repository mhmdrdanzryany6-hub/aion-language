#!/usr/bin/env node
import fs from 'node:fs';
import { buildFile,runBundle,createFileHost } from './modules.mjs';
import path from 'node:path';
import { disassemble } from './api.mjs';
import { format } from './formatter.mjs';
const [command='help',file,...rest]=process.argv.slice(2);
try{
  if(command==='help'||command==='--help')console.log('AION 0.1.0\nrun FILE    Execute a program\ncheck FILE  Check syntax and types\nbuild FILE  Save a bytecode bundle\nexec FILE   Execute a bundle\ndisasm FILE Show bytecode\nfmt FILE    Format source');
  else if(command==='--version')console.log('AION 0.1.0');
  else if(!['run','check','build','exec','disasm','fmt','test','debug'].includes(command))throw new Error(`Unknown command: ${command}`);
  else {
    if(!file||!fs.existsSync(file))throw new Error(`E_FILE: Cannot read ${file??'(missing file)'}`);
    if(command==='fmt'){fs.writeFileSync(file,format(fs.readFileSync(file,'utf8')));console.log(`Formatted ${file}`);}
    else {const bundle=command==='exec'?JSON.parse(fs.readFileSync(file,'utf8')):buildFile(file);
      if(command==='check')console.log('Check passed');
      if(['run','exec','debug','test'].includes(command)){
        const fuelAt=rest.indexOf('--fuel'),depthAt=rest.indexOf('--depth'),argsAt=rest.indexOf('--');
        const permissions=flag=>rest.flatMap((x,i)=>x===flag?[rest[i+1]]:[]);
        const options={...(fuelAt>=0?{fuel:Number(rest[fuelAt+1])}:{}),...(depthAt>=0?{maxDepth:Number(rest[depthAt+1])}:{}),args:argsAt>=0?rest.slice(argsAt+1):[],host:createFileHost({base:path.dirname(path.resolve(file)),read:permissions('--allow-read'),write:permissions('--allow-write')})};
        if(command==='debug')options.onStep=s=>console.error(`${s.location.filename}:${s.location.line} ${s.function} #${s.ip} ${s.instruction.join(' ')} [${s.stack.join(', ')}]`);
        if(command==='test'){
          const initial=runBundle(bundle,{...options,entry:false});const names=[...initial.globals.bindings].filter(([name,cell])=>name.startsWith('test_')&&cell.value?.tag==='closure').map(([name])=>name);
          if(!names.length)throw new Error('No test_ functions found');
          let failed=0;for(const name of names){try{const fresh=runBundle(bundle,{...options,entry:false});fresh.vm.invoke(fresh.globals.bindings.get(name).value,[]);console.log(`PASS ${name}`);}catch(e){failed++;console.error(`FAIL ${name}: ${e.code??'E_TEST'} ${e.message}`);}}
          console.log(`${names.length-failed} passed, ${failed} failed`);if(failed)process.exitCode=1;
        }else process.stdout.write(runBundle(bundle,options).output);
      }
      if(command==='build'){const output=rest[0]??file+'.aion.json';fs.writeFileSync(output,JSON.stringify(bundle));console.log(`Built ${output}`);}
      if(command==='disasm')console.log(bundle.modules.map(item=>disassemble(item.module)).join('\n'));
    }
  }
}catch(error){let source='';if(error.filename&&error.filename!=='<input>'&&file){try{source=fs.readFileSync(path.resolve(path.dirname(file),error.filename),'utf8');}catch{}}console.error(error.render?error.render(source):`${error.code??'E_CLI'}: ${error.message}`);process.exitCode=1;}
