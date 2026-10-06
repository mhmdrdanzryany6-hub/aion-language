import { fail } from './diagnostic.mjs';
export const KEYWORDS = new Set('fn let var if else while for in return break continue true false null import from export'.split(' '));
const letter = c => !!c && /[\p{L}_]/u.test(c);
const digit = c => !!c && /[0-9]/.test(c);
const idchar = c => !!c && /[\p{L}\p{N}_]/u.test(c);
export function lex(source, filename = '<input>', {comments = false} = {}) {
  if (source.length > 2_000_000) fail('E_SIZE', 'Source exceeds 2 MB limit', {filename});
  let i = 0, line = 1, column = 1; const tokens = [];
  const take = () => { const c = source[i++]; if(c === '\n') {line++; column=1;} else column++; return c; };
  const emit = (kind, value, start, sl, sc) => tokens.push({kind,value,raw:source.slice(start,i),start,end:i,line:sl,column:sc,filename});
  while(i < source.length) {
    let c = source[i]; if(/\s/.test(c)) {take(); continue;}
    const start=i, sl=line, sc=column, loc={filename,start,end:start+1,line:sl,column:sc};
    if(c==='/' && source[i+1]==='/') {
      while(i<source.length && source[i]!=='\n') take();
      if(comments) emit('comment',source.slice(start,i),start,sl,sc); continue;
    }
    if(c==='/' && source[i+1]==='*') {
      take(); take(); let depth=1;
      while(i<source.length && depth) {
        if(source[i]==='/' && source[i+1]==='*') {take();take();depth++;}
        else if(source[i]==='*' && source[i+1]==='/') {take();take();depth--;}
        else take();
      }
      if(depth) fail('E_LEX','Unterminated block comment',loc);
      if(comments) emit('comment',source.slice(start,i),start,sl,sc); continue;
    }
    if(letter(c)) {
      take(); while(idchar(source[i])) take(); const value=source.slice(start,i);
      emit(KEYWORDS.has(value)?value:'id',value,start,sl,sc); continue;
    }
    if(digit(c)) {
      take(); while(digit(source[i]) || source[i]==='_') take();
      if(source[i]==='.' && digit(source[i+1])) {take(); while(digit(source[i]) || source[i]==='_') take();}
      if(source[i]==='e' || source[i]==='E') {
        take(); if('+-'.includes(source[i]??'!')) take();
        if(!digit(source[i])) fail('E_LEX','Expected exponent digits',loc);
        while(digit(source[i])) take();
      }
      const raw=source.slice(start,i);
      if(raw.includes('__') || raw.endsWith('_') || raw.includes('_.') || raw.includes('._')) fail('E_LEX','Invalid numeric separator',loc);
      const value=Number(raw.replaceAll('_',''));
      if(!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail('E_NUMBER','Numeric literal is outside the supported range',loc);
      emit('number',value,start,sl,sc); continue;
    }
    if(c==='"' || c==="'") {
      const quote=take(); let value='', closed=false;
      while(i<source.length) {
        c=take(); if(c===quote) {closed=true;break;}
        if(c==='\n' || c==='\r') fail('E_LEX','Unterminated string; use \\n for a newline',loc);
        if(c==='\\') {
          if(i>=source.length) break;
          const escape=take(), map={n:'\n',r:'\r',t:'\t','\\':'\\','"':'"',"'":"'",'0':'\0'};
          if(escape==='u') {
            const hex=source.slice(i,i+4); if(!/^[\da-fA-F]{4}$/.test(hex)) fail('E_LEX','Invalid Unicode escape',loc);
            for(let k=0;k<4;k++) take(); value+=String.fromCharCode(parseInt(hex,16));
          } else if(Object.hasOwn(map,escape)) value+=map[escape];
          else fail('E_LEX',`Unknown escape \\${escape}`,loc);
        } else value+=c;
      }
      if(!closed) fail('E_LEX','Unterminated string',loc);
      emit('string',value,start,sl,sc); continue;
    }
    const two=source.slice(i,i+2);
    if(['==','!=','<=','>=','&&','||','+=','-=','*=','/=','%=','->'].includes(two)) {take();take();emit(two,two,start,sl,sc);continue;}
    if('+-*/%!=<>(){}[],:;.'.includes(c)) {take();emit(c,c,start,sl,sc);continue;}
    fail('E_LEX',`Unexpected character ${JSON.stringify(c)}`,loc);
  }
  tokens.push({kind:'eof',value:null,raw:'',start:i,end:i+1,line,column,filename}); return tokens;
}
