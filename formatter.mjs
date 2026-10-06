import { lex } from './lexer.mjs';
import { parse } from './parser.mjs';
// Only leading indentation and trailing whitespace change. Newlines are semantic
// after return, so this conservative formatter preserves every line boundary.
export function format(source){
  parse(source);const tokens=lex(source,'<format>',{comments:true});let depth=0;
  const lines=source.replace(/\r\n/g,'\n').split('\n');
  const result=lines.map((line,index)=>{const here=tokens.filter(t=>t.line===index+1&&t.kind!=='eof');const first=here[0];const indent=Math.max(0,depth-(first?.kind==='}'?1:0));for(const t of here){if(t.kind==='{')depth++;if(t.kind==='}')depth--;}
    return line.trim()? '  '.repeat(indent)+line.trim():'';}).join('\n').trimEnd()+'\n';
  parse(result);return result;
}
