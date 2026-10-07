import test from 'node:test';import assert from 'node:assert/strict';import {format} from './formatter.mjs';import {run} from './api.mjs';import {lex} from './lexer.mjs';
test('formatter normalizes operator and comma spacing',()=>assert.match(format('let x=[1,2];print(x[0]+x[1])'),/let x = \[1, 2\]; print\(x\[0\] \+ x\[1\]\)/));
test('formatter preserves multiline comment content',()=>{const source='fn main(){\n/* preserve\n    these spaces\n */\nprint(1)\n}';assert.deepEqual(lex(format(source),'x',{comments:true}).filter(t=>t.kind==='comment').map(t=>t.raw),lex(source,'x',{comments:true}).filter(t=>t.kind==='comment').map(t=>t.raw));});
test('return followed by newline still returns null',()=>{const source='fn f(){return\nprint(1)}\nprint(f())';assert.equal(run(format(source)).output,run(source).output);});
test('formatter preserves string spaces and nested interpolation',()=>{const source='let n=3\nprint("  {n+1}  ")';assert.equal(run(format(source)).output,'  4  \n');});
