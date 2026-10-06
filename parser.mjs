import { lex } from './lexer.mjs';
import { fail } from './diagnostic.mjs';
const precedence = {'=':1,'+=':1,'-=':1,'*=':1,'/=':1,'%=':1,'||':2,'&&':3,'==':4,'!=':4,'<':5,'>':5,'<=':5,'>=':5,'+':6,'-':6,'*':7,'/':7,'%':7};
export class Parser {
  constructor(tokens) {this.tokens=tokens;this.i=0;this.depth=0;}
  get token() {return this.tokens[this.i];}
  at(kind) {return this.token.kind===kind;}
  take() {return this.tokens[this.i++];}
  match(kind) {if(this.at(kind)) return this.take();return null;}
  expect(kind) {if(!this.at(kind)) fail('E_PARSE',`Expected '${kind}', found '${this.token.raw || 'end of file'}'`,this.token);return this.take();}
  node(kind,at,props={}) {return {kind,loc:at,...props};}
  program() {const body=[];while(!this.at('eof')) {if(this.match(';')) continue;body.push(this.statement());}return {kind:'program',body};}
  statement() {
    const t=this.token;
    if(this.match('export')) {
      const node=this.statement(); if(!['decl','function'].includes(node.kind)) fail('E_EXPORT','Only functions and bindings can be exported',t);
      node.exported=true; return node;
    }
    if(this.match('import')) {
      this.expect('{'); const names=[];
      if(!this.at('}')) do {names.push(this.expect('id').value);} while(this.match(',')&&!this.at('}'));
      this.expect('}');this.expect('from');const path=this.expect('string');this.match(';');
      if(names.length===0) fail('E_IMPORT','An import must name at least one binding',t);
      return this.node('import',t,{names,path:path.value});
    }
    if(this.at('fn') && this.tokens[this.i+1]?.kind==='id') {this.take();const name=this.expect('id').value;return this.functionNode(t,name);}
    if(this.at('let') || this.at('var')) {
      const mutable=this.take().kind==='var'; const name=this.expect('id').value;
      const annotation=this.match(':')?this.type():null; this.expect('=');const value=this.expression();this.match(';');
      return this.node('decl',t,{name,mutable,annotation,value});
    }
    if(this.match('if')) {
      const condition=this.expression();const yes=this.block(); let no=null;
      if(this.match('else')) no=this.at('if')?this.statement():this.block();
      return this.node('if',t,{condition,yes,no});
    }
    if(this.match('while')) {const condition=this.expression();return this.node('while',t,{condition,body:this.block()});}
    if(this.match('for')) {const name=this.expect('id').value;this.expect('in');const iterable=this.expression();return this.node('for',t,{name,iterable,body:this.block()});}
    if(this.match('return')) {
      const value=this.at('}')||this.at(';')||this.at('eof')||this.token.line>t.line?null:this.expression();
      this.match(';');return this.node('return',t,{value});
    }
    if(this.at('break')||this.at('continue')) {const kind=this.take().kind;this.match(';');return this.node(kind,t);}
    if(this.at('{')) return this.block();
    const value=this.expression();this.match(';');return this.node('expression',t,{value});
  }
  type() {
    const t=this.expect('id');let name=t.value;
    if(!['Int','Float','Bool','String','Void','Any','Map'].includes(name)) fail('E_TYPE',`Unknown type '${name}'`,t);
    while(this.match('[')) {this.expect(']');name+='[]';}return name;
  }
  block() {
    const t=this.expect('{'),body=[];
    if(++this.depth>200) fail('E_DEPTH','Syntax nesting limit exceeded',t);
    while(!this.at('}')&&!this.at('eof')) {if(this.match(';')) continue;body.push(this.statement());}
    this.expect('}');this.depth--;return this.node('block',t,{body});
  }
  functionNode(t,name=null) {
    this.expect('(');const params=[];
    if(!this.at(')')) do {
      const p=this.expect('id');const annotation=this.match(':')?this.type():'Any';
      if(params.some(x=>x.name===p.value)) fail('E_NAME',`Duplicate parameter '${p.value}'`,p);
      params.push({name:p.value,type:annotation,loc:p});
    } while(this.match(',')&&!this.at(')'));
    this.expect(')');const returns=this.match('->')?this.type():'Any';const body=this.block();
    return this.node(name?'function':'lambda',t,{name,params,returns,body});
  }
  expression(min=1) {
    if(++this.depth>200) fail('E_DEPTH','Expression nesting limit exceeded',this.token);
    let left=this.prefix();
    while(true) {
      const t=this.token;
      if(this.at('(') && 9>=min) {
        this.take();const args=[];
        if(!this.at(')')) do {args.push(this.expression());} while(this.match(',')&&!this.at(')'));
        this.expect(')');left=this.node('call',t,{callee:left,args});continue;
      }
      if(this.match('[')) {const index=this.expression();this.expect(']');left=this.node('index',t,{object:left,index});continue;}
      if(this.match('.')) {const key=this.expect('id');left=this.node('index',t,{object:left,index:this.node('literal',key,{value:key.value})});continue;}
      const power=precedence[t.kind]; if(power===undefined||power<min) break;
      this.take();const right=this.expression(power===1?power:power+1);
      if(power===1) {
        if(!['name','index'].includes(left.kind)) fail('E_ASSIGN','Invalid assignment target',left.loc);
        left=this.node('assign',t,{target:left,op:t.kind,value:right});
      } else left=this.node('binary',t,{op:t.kind,left,right});
    }
    this.depth--;return left;
  }
  prefix() {
    const t=this.take();
    if(t.kind==='number') return this.node('literal',t,{value:t.value});
    if(t.kind==='string') return this.interpolation(t);
    if(['true','false','null'].includes(t.kind)) return this.node('literal',t,{value:t.kind==='null'?null:t.kind==='true'});
    if(t.kind==='id') return this.node('name',t,{name:t.value});
    if(['-','+','!'].includes(t.kind)) return this.node('unary',t,{op:t.kind,value:this.expression(8)});
    if(t.kind==='(') {const node=this.expression();this.expect(')');return node;}
    if(t.kind==='fn') return this.functionNode(t);
    if(t.kind==='[') {
      const items=[];if(!this.at(']')) do {items.push(this.expression());} while(this.match(',')&&!this.at(']'));
      this.expect(']');return this.node('array',t,{items});
    }
    if(t.kind==='{') {
      const entries=[];
      if(!this.at('}')) do {
        const key=this.take();if(!['id','string'].includes(key.kind)) fail('E_PARSE','Dictionary key must be a string or identifier',key);
        this.expect(':');entries.push([key.value,this.expression()]);
      } while(this.match(',')&&!this.at('}'));
      this.expect('}');return this.node('map',t,{entries});
    }
    fail('E_PARSE',`Expected expression, found '${t.raw||'end of file'}'`,t);
  }
  interpolation(t) {
    let i=0,buffer='',parts=[];const s=t.value;
    while(i<s.length) {
      if(s.slice(i,i+2)==='{{') {buffer+='{';i+=2;continue;}
      if(s.slice(i,i+2)==='}}') {buffer+='}';i+=2;continue;}
      if(s[i]==='}') fail('E_PARSE','Unmatched interpolation brace; use }} for a literal brace',t);
      if(s[i]!=='{') {buffer+=s[i++];continue;}
      if(buffer) {parts.push(buffer);buffer='';}
      const begin=++i;let nesting=1,quote=null;
      while(i<s.length&&nesting) {
        const c=s[i];
        if(quote) {if(c==='\\') i++;else if(c===quote) quote=null;}
        else if(c==='"'||c==="'") quote=c;
        else if(c==='{') nesting++;
        else if(c==='}') nesting--;
        if(nesting) i++;
      }
      if(nesting) fail('E_PARSE','Unterminated string interpolation',t);
      const fragment=s.slice(begin,i++);
      if(!fragment.trim()) fail('E_PARSE','Empty string interpolation',t);
      const parser=new Parser(lex(fragment,t.filename));const expr=parser.expression();parser.expect('eof');
      // Rebase fragment diagnostics to the containing string token.
      const rebase=node=>{if(!node||typeof node!=='object')return;if(node.loc)node.loc={...t};for(const [k,v]of Object.entries(node))if(k!=='loc'){if(Array.isArray(v))v.forEach(rebase);else rebase(v);}};
      rebase(expr);parts.push(expr);
    }
    if(buffer)parts.push(buffer);
    return parts.every(p=>typeof p==='string')?this.node('literal',t,{value:parts.join('')}):this.node('interpolate',t,{parts});
  }
}
export const parse=(source,filename)=>new Parser(lex(source,filename)).program();
