import { compile,run,disassemble } from './api.mjs';
import { format } from './formatter.mjs';
import {createDebugger} from './debugger.mjs';
import {renderDiagnostic} from './diagnostic-locale.mjs';
self.onmessage=({data:{action,source,lang='en',breakLine=1}})=>{try{let text,formatted;if(action==='run')text=run(source).output;else if(action==='debug'){const lines=[];const result=run(source,{onStep:createDebugger({breaks:[String(breakLine)],emit:line=>lines.push(line)})});text=lines.join('\n')+'\n\nOUTPUT\n'+result.output;}else if(action==='bytecode')text=disassemble(compile(source));else if(action==='format'){formatted=format(source);text='Formatting complete.';}else {compile(source);text='Syntax and type checks passed.';}self.postMessage({ok:true,text,formatted});}catch(error){self.postMessage({ok:false,text:renderDiagnostic(error,source,lang)});}};
