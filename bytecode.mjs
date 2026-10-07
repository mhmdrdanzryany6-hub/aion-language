import { AionError } from './diagnostic.mjs';
import { OPCODES } from './compiler.mjs';
import { validType } from './runtime-types.mjs';
const bad = message => { throw new AionError('E_BYTECODE', message); };
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 100000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (instruction, length) => { if (instruction.length !== length) bad('Invalid instruction operand count'); };

export function validateModule(module) {
  if (!object(module) || module.format !== 'aion.module' || module.version !== 2) bad('Unsupported module version; rebuild from source');
  if (!text(module.filename) || typeof module.source !== 'string' || module.source.length > 2000000 || !Array.isArray(module.constants) || module.constants.length > 100000 || !Array.isArray(module.functions) || !module.functions.length || module.functions.length > 10000 || !Array.isArray(module.exports) || !Array.isArray(module.imports)) bad('Invalid module structure');
  for (const value of module.constants) if (value !== null && !['number', 'boolean', 'string'].includes(typeof value) || typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value)) || typeof value === 'string' && value.length > 2000000) bad('Invalid constant');
  if (module.exports.some(name => !text(name)) || new Set(module.exports).size !== module.exports.length) bad('Invalid export names');
  for (const imp of module.imports) if (!object(imp) || !text(imp.path) || !Array.isArray(imp.names) || !imp.names.length || imp.names.some(name => !text(name)) || new Set(imp.names).size !== imp.names.length) bad('Invalid import structure');
  let total = 0;
  for (const fn of module.functions) {
    if (!object(fn) || !text(fn.name) || !Array.isArray(fn.params) || fn.params.length > 1000 || fn.params.some(name => !text(name)) || new Set(fn.params).size !== fn.params.length || !Array.isArray(fn.paramTypes) || fn.paramTypes.length !== fn.params.length || fn.paramTypes.some(type => !validType(type)) || !validType(fn.returnType) || !Array.isArray(fn.code) || !fn.code.length || fn.code.length > 200000 || !Array.isArray(fn.locations) || fn.locations.length !== fn.code.length) bad('Invalid function or parameter type');
    total += fn.code.length; if (total > 500000) bad('Module instruction limit exceeded');
    for (const loc of fn.locations) if (!object(loc) || !text(loc.filename) || !Number.isSafeInteger(loc.line) || loc.line < 1 || loc.line > module.source.length + 1 || !Number.isSafeInteger(loc.column) || loc.column < 1 || loc.column > module.source.length + 1 || !Number.isSafeInteger(loc.start) || !Number.isSafeInteger(loc.end) || loc.start < 0 || loc.end < loc.start || loc.end > Math.max(1, module.source.length)) bad('Invalid source location');
    for (const ins of fn.code) {
      if (!Array.isArray(ins) || !OPCODES.has(ins[0])) bad('Unknown opcode');
      const [op, a, b, type] = ins;
      if (['LOAD', 'STORE'].includes(op)) { exact(ins, 2); if (!text(a)) bad('Invalid binding operand'); }
      else if (op === 'DECL') { exact(ins, 4); if (!text(a) || typeof b !== 'boolean' || !validType(type)) bad('Invalid declaration operand'); }
      else if (['CONST', 'CLOSURE', 'CALL', 'ARRAY', 'CONCAT'].includes(op)) { exact(ins, 2); if (!count(a) || op === 'CONST' && a >= module.constants.length || op === 'CLOSURE' && a >= module.functions.length) bad('Invalid bytecode reference or count'); }
      else if (['JUMP', 'JFALSE', 'JTRUE', 'ITER_NEXT'].includes(op)) { exact(ins, op === 'ITER_NEXT' ? 3 : 2); const jump = op === 'ITER_NEXT' ? b : a; if (!Number.isSafeInteger(jump) || jump < 0 || jump >= fn.code.length || op === 'ITER_NEXT' && !text(a)) bad('Invalid jump destination'); }
      else if (op === 'MAP') { exact(ins, 2); if (!Array.isArray(a) || a.length > 100000 || a.some(key => typeof key !== 'string') || new Set(a).size !== a.length) bad('Invalid map operand'); }
      else if (op === 'UNARY') { exact(ins, 2); if (!['!', '+', '-'].includes(a)) bad('Invalid unary operator'); }
      else if (op === 'BINARY') { exact(ins, 2); if (!['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>='].includes(a)) bad('Invalid binary operator'); }
      else exact(ins, 1);
    }
    validateFlow(fn);
  }
  if (module.functions[0].name !== '<module>' || module.functions[0].params.length || module.functions.slice(1).some(fn => fn.name === '<module>')) bad('Invalid module entry function');
  return module;
}

function validateFlow(fn) {
  const states = new Map(), pending = [[0, 0, 0]];
  const add = (ip, stack, scope) => {
    if (ip >= fn.code.length) bad('Function falls through without RETURN');
    pending.push([ip, stack, scope]);
  };
  while (pending.length) {
    const [ip, stack, scope] = pending.pop();
    if (states.has(ip)) { const prior = states.get(ip); if (prior[0] !== stack || prior[1] !== scope) bad('Inconsistent branch stack or scope height'); continue; }
    states.set(ip, [stack, scope]); const [op, a, b] = fn.code[ip];
    let need = 0, delta = 0, scopes = scope;
    if (['CONST', 'LOAD', 'CLOSURE'].includes(op)) delta = 1;
    if (['DECL', 'POP', 'JFALSE', 'JTRUE', 'RETURN'].includes(op)) { need = 1; delta = -1; }
    if (['STORE', 'UNARY', 'BOOL', 'ITER'].includes(op)) need = 1;
    if (op === 'DUP') { need = 1; delta = 1; }
    if (op === 'DUP2') { need = 2; delta = 2; }
    if (['BINARY', 'GET'].includes(op)) { need = 2; delta = -1; }
    if (op === 'SET') { need = 3; delta = -2; }
    if (op === 'CALL') { need = a + 1; delta = -a; }
    if (['ARRAY', 'CONCAT', 'MAP'].includes(op)) { need = op === 'MAP' ? a.length : a; delta = 1 - need; }
    if (stack < need) bad(`Operand stack underflow at ${fn.name}:${ip}`);
    if (op === 'ENTER') scopes++;
    if (op === 'LEAVE') { if (!scope) bad('Root environment escape'); scopes--; }
    if (op === 'RETURN') { if (stack !== 1) bad('Invalid return stack height'); continue; }
    if (op === 'JUMP') { add(a, stack, scopes); continue; }
    if (op === 'ITER_NEXT') { add(b, stack, scopes); add(ip + 1, stack + 1, scopes); continue; }
    if (['JFALSE', 'JTRUE'].includes(op)) add(a, stack + delta, scopes);
    add(ip + 1, stack + delta, scopes);
  }
}

export function verifyBundle(bundle) {
  if (!object(bundle) || bundle.format !== 'aion.bundle' || bundle.version !== 2) bad('Unsupported bytecode bundle version; rebuild from source');
  if (!Array.isArray(bundle.modules) || !bundle.modules.length || bundle.modules.length > 100 || !text(bundle.entry)) bad('Invalid bytecode bundle');
  const items = new Map(); let totalSource = 0;
  for (const item of bundle.modules) {
    if (!object(item) || !text(item.id) || items.has(item.id) || !object(item.dependencies)) bad('Invalid or duplicate module id');
    validateModule(item.module); items.set(item.id, item); totalSource += item.module.source.length;
    if (totalSource > 10000000) bad('Bundle source limit exceeded');
  }
  if (!items.has(bundle.entry)) bad('Missing entry module');
  for (const item of items.values()) {
    for (const dep of Object.values(item.dependencies)) if (!text(dep) || !items.has(dep)) bad('Missing dependency');
    for (const imp of item.module.imports) {
      if (!Object.hasOwn(item.dependencies, imp.path)) bad('Missing import dependency');
      const target = items.get(item.dependencies[imp.path]);
      for (const name of imp.names) if (!target.module.exports.includes(name)) bad('Missing imported export');
    }
  }
  const visited = new Set(), active = new Set();
  function visit(id) { if (active.has(id)) bad('Dependency cycle'); if (visited.has(id)) return; active.add(id); for (const dep of Object.values(items.get(id).dependencies)) visit(dep); active.delete(id); visited.add(id); }
  for (const id of items.keys()) visit(id);
  return bundle;
}
