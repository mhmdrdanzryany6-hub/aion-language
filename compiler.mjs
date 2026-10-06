export const OPCODES=new Set('CONST LOAD DECL STORE POP DUP DUP2 UNARY BINARY BOOL JUMP JFALSE JTRUE ENTER LEAVE CLOSURE CALL RETURN ARRAY MAP GET SET CONCAT ITER ITER_NEXT'.split(' '));
export function emitBytecode(ast,source,filename,types={}) {
  const module={format:'aion.module',version:1,filename,source,constants:[],functions:[],imports:[],exports:Object.keys(types.exports??{}),types:types.exports??{}};
  class Compiler {
    constructor(name,params=[]){this.fn={name,params:params.map(p=>p.name),paramTypes:params.map(p=>p.type),code:[],locations:[]};this.index=module.functions.length;module.functions.push(this.fn);this.depth=0;this.loops=[];this.unique=0;}
    emit(op,...args){const i=this.fn.code.length;this.fn.code.push([op,...args]);this.fn.locations.push(this.loc??{filename,line:1,column:1,start:0,end:1});return i;}
    patch(i,target){this.fn.code[i][this.fn.code[i].length-1]=target;}
    constant(value){let index=module.constants.findIndex(v=>v===value);if(index<0){index=module.constants.length;module.constants.push(value);}this.emit('CONST',index);}
    closure(n){const child=new Compiler(n.name??'<lambda>',n.params);child.statement(n.body);child.constant(null);child.emit('RETURN');this.emit('CLOSURE',child.index);}
    body(nodes){for(const n of nodes)if(n.kind==='function'){this.loc=n.loc;this.closure(n);this.emit('DECL',n.name,false);}
      for(const n of nodes)if(n.kind!=='function')this.statement(n);}
    statement(n){this.loc=n.loc;
      switch(n.kind){
        case 'import':module.imports.push({names:n.names,path:n.path,loc:n.loc});break;
        case 'decl':this.expression(n.value);this.emit('DECL',n.name,n.mutable);break;
        case 'expression':this.expression(n.value);this.emit('POP');break;
        case 'block':this.emit('ENTER');this.depth++;this.body(n.body);this.emit('LEAVE');this.depth--;break;
        case 'return':if(n.value)this.expression(n.value);else this.constant(null);this.emit('RETURN');break;
        case 'if': {this.expression(n.condition);const no=this.emit('JFALSE',0);this.statement(n.yes);if(n.no){const end=this.emit('JUMP',0);this.patch(no,this.fn.code.length);this.statement(n.no);this.patch(end,this.fn.code.length);}else this.patch(no,this.fn.code.length);break;}
        case 'while': {const start=this.fn.code.length;this.expression(n.condition);const end=this.emit('JFALSE',0);const loop={depth:this.depth,start,breaks:[]};this.loops.push(loop);this.statement(n.body);this.emit('JUMP',start);const finish=this.fn.code.length;this.patch(end,finish);loop.breaks.forEach(i=>this.patch(i,finish));this.loops.pop();break;}
        case 'for': {this.emit('ENTER');this.depth++;const iterator=`$iter${this.unique++}`;this.expression(n.iterable);this.emit('ITER');this.emit('DECL',iterator,false);const start=this.fn.code.length;const end=this.emit('ITER_NEXT',iterator,0);this.emit('ENTER');this.depth++;this.emit('DECL',n.name,false);
          const loop={depth:this.depth-1,start,breaks:[]};this.loops.push(loop);this.statement(n.body);this.emit('LEAVE');this.depth--;this.emit('JUMP',start);const finish=this.fn.code.length;this.patch(end,finish);loop.breaks.forEach(i=>this.patch(i,finish));this.loops.pop();this.emit('LEAVE');this.depth--;break;}
        case 'break':case 'continue':{const loop=this.loops.at(-1);for(let i=this.depth;i>loop.depth;i--)this.emit('LEAVE');if(n.kind==='break')loop.breaks.push(this.emit('JUMP',0));else this.emit('JUMP',loop.start);break;}
      }
    }
    expression(n){this.loc=n.loc;
      switch(n.kind){
        case 'literal':this.constant(n.value);break;
        case 'name':this.emit('LOAD',n.name);break;
        case 'lambda':this.closure(n);break;
        case 'array':n.items.forEach(x=>this.expression(x));this.emit('ARRAY',n.items.length);break;
        case 'map':n.entries.forEach(([,v])=>this.expression(v));this.emit('MAP',n.entries.map(([k])=>k));break;
        case 'interpolate':n.parts.forEach(x=>typeof x==='string'?this.constant(x):this.expression(x));this.emit('CONCAT',n.parts.length);break;
        case 'unary':this.expression(n.value);this.emit('UNARY',n.op);break;
        case 'binary':{
          this.expression(n.left);
          if(['&&','||'].includes(n.op)){this.emit('DUP');const jump=this.emit(n.op==='&&'?'JFALSE':'JTRUE',0);this.emit('POP');this.expression(n.right);this.emit('BOOL');this.patch(jump,this.fn.code.length);}
          else {this.expression(n.right);this.loc=n.loc;this.emit('BINARY',n.op);}break;
        }
        case 'call':this.expression(n.callee);n.args.forEach(x=>this.expression(x));this.loc=n.loc;this.emit('CALL',n.args.length);break;
        case 'index':this.expression(n.object);this.expression(n.index);this.emit('GET');break;
        case 'assign':{
          if(n.target.kind==='name'){if(n.op!=='=')this.emit('LOAD',n.target.name);this.expression(n.value);if(n.op!=='=')this.emit('BINARY',n.op[0]);this.emit('STORE',n.target.name);}
          else {this.expression(n.target.object);this.expression(n.target.index);if(n.op!=='='){this.emit('DUP2');this.emit('GET');}this.expression(n.value);if(n.op!=='=')this.emit('BINARY',n.op[0]);this.emit('SET');}break;
        }
      }
    }
  }
  const root=new Compiler('<module>');root.body(ast.body);root.constant(null);root.emit('RETURN');return module;
}
