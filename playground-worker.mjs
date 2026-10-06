import { compile,run,disassemble } from './api.mjs';
import { format } from './formatter.mjs';
self.onmessage=({data:{action,source}})=>{try{let text,formatted;if(action==='run')text=run(source).output;else if(action==='bytecode')text=disassemble(compile(source));else if(action==='format'){formatted=format(source);text='Formatting complete.';}else {compile(source);text='Syntax and type checks passed.';}self.postMessage({ok:true,text,formatted});}catch(error){self.postMessage({ok:false,text:error.render?error.render(source):error.message});}};
