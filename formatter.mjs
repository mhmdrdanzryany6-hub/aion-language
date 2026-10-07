import { lex } from './lexer.mjs';
import { parse } from './parser.mjs';
// Preserve every line boundary: a newline after return changes its meaning.
export function format(source){
  source=source.replace(/\r\n/g,'\n');parse(source);const tokens=lex(source,'<format>',{comments:true}),byLine=new Map(),protectedLines=new Set();let depth=0;
  for(const token of tokens){if(token.kind==='eof')continue;const list=byLine.get(token.line)??[];list.push(token);byLine.set(token.line,list);if(token.kind==='comment'&&token.raw.includes('\n'))for(let line=token.line;line<=token.line+token.raw.split('\n').length-1;line++)protectedLines.add(line);}
  const lines=source.split('\n'),formatted=[];
  for(let index=0;index<lines.length;index++){
    const here=byLine.get(index+1)??[],indent=Math.max(0,depth-(here[0]?.kind==='}'?1:0));
    for(const token of here){if(token.kind==='{')depth++;if(token.kind==='}')depth--;}
    if(protectedLines.has(index+1)){formatted.push(lines[index]);continue;}
    if(!here.length){formatted.push('');continue;}
    let line='  '.repeat(indent),previous=null;
    for(const token of here){
      let space=!!previous;
      if([')',']',',',';',':','.'].includes(token.kind)||['(','[','.'].includes(previous?.kind))space=false;
      if(token.kind==='('&&['id','fn',')',']'].includes(previous?.kind))space=false;
      if(token.kind==='['&&['id',')',']'].includes(previous?.kind))space=false;
      if(token.kind==='}'&&previous?.kind==='{')space=false;
      if(space)line+=' ';line+=token.raw;previous=token;
    }
    formatted.push(line);
  }
  while(formatted.at(-1)==='')formatted.pop();const result=formatted.join('\n')+'\n';
  parse(result);return result;
}
