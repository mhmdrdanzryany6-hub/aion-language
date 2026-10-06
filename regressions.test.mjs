import test from 'node:test';import assert from 'node:assert/strict';import {run,compile} from './api.mjs';
test('compound division checks result type',()=>assert.throws(()=>compile('var x: Int=1 x/=2'),e=>e.code==='E_TYPE'));
test('typed push rejects incompatible elements',()=>assert.throws(()=>compile('let a: Int[]=[1] push(a,"oops")'),e=>e.code==='E_TYPE'));
test('inferred return with fallthrough stays gradual',()=>assert.equal(compile('export fn f(x: Bool) { if x { return 1 } }').types.f.result,'Any'));
test('prototype names remain exports',()=>assert.deepEqual(compile('export let __proto__=1').exports,['__proto__']));
test('nested export is rejected statically',()=>assert.throws(()=>compile('if true { export let n=1 }'),e=>e.code==='E_EXPORT'));
test('dictionary growth consumes allocation budget',()=>assert.throws(()=>run('let m={} m.a=1 m.b=2',{maxAllocation:1}),e=>e.code==='E_MEMORY'));
test('long expression gets controlled depth error',()=>assert.throws(()=>compile('print('+Array(10000).fill('1').join('+')+')'),e=>e.code==='E_DEPTH'));
test('reduce uses array initial callback order',()=>assert.equal(run('print(reduce([1,2,3],0,fn(a,b){return a+b}))').output,'6\n'));
