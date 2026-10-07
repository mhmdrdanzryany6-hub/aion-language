import readline from 'node:readline';
import { compile } from './api.mjs';
import { VM } from './vm.mjs';
import { fnType } from './types.mjs';
import { display } from './values.mjs';
import { renderDiagnostic } from './diagnostic-locale.mjs';
export async function repl({ lang = 'en', input = process.stdin, output = process.stdout, errors = process.stderr } = {}) {
  let vm, env; const reset = () => { vm = new VM(); env = vm.execute(compile(''), {}, false).globals; }; reset();
  const terminal = !!input.isTTY, lines = readline.createInterface({ input, output, terminal });
  if (terminal) { output.write('AION 0.2 REPL · :help, :reset, :quit\n'); lines.setPrompt('aion> '); lines.prompt(); }
  let source = '';
  for await (const line of lines) {
    if (!source && [':quit', ':q'].includes(line.trim())) break;
    if (!source && line.trim() === ':reset') { reset(); if (terminal) lines.prompt(); continue; }
    if (!source && line.trim() === ':help') { output.write('Expressions print their value. Bindings persist. Multiline blocks accepted. :reset clears state. :quit exits.\n'); if (terminal) lines.prompt(); continue; }
    source += line + '\n';
    const before = vm.output.length;
    try {
      const globalTypes = Object.fromEntries([...env.bindings].map(([name, cell]) => [name, { mutable: cell.mutable, type: cell.value?.tag === 'closure' ? fnType(cell.value.proto.paramTypes, cell.value.proto.returnType) : cell.value?.tag === 'native' ? cell.value.signature : cell.type }]));
      const module = compile(source, { filename: '<repl>', globalTypes, returnLastExpression: true });
      if (module.imports.length) throw new Error('Imports are supported by run FILE, not REPL');
      vm.fuel = vm.initialFuel;
      const result = vm.execute(module, {}, false, env);
      output.write(vm.output.slice(before)); if (result.value !== null) output.write(display(result.value) + '\n');
      source = '';
    } catch (error) {
      if (error.code === 'E_PARSE' && /end of file/.test(error.message)) { if (terminal) { lines.setPrompt('...   '); lines.prompt(); } continue; }
      output.write(vm.output.slice(before)); errors.write(renderDiagnostic(error, source, lang) + '\n'); vm.frames.length = 0; vm.stack.length = 0; source = '';
    }
    if (terminal) { lines.setPrompt('aion> '); lines.prompt(); }
  }
  if (source.trim()) { errors.write('E_PARSE: Incomplete input at end of REPL\n'); process.exitCode = 1; }
  lines.close();
}
