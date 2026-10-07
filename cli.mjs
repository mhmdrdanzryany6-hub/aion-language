#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { buildFile, runBundle, createFileHost } from './modules.mjs';
import { disassemble } from './api.mjs';
import { format } from './formatter.mjs';
import { parseArgs } from './cli-options.mjs';
import { initProject, projectFile } from './project.mjs';
import { createDebugger } from './debugger.mjs';
import { diagnosticData, renderDiagnostic } from './diagnostic-locale.mjs';
import { AionError } from './diagnostic.mjs';
import { repl } from './repl.mjs';
const HELP = `AION 0.2.0 · Node 24+\nrun [FILE]       Execute source or project entry\ncheck [FILE]     Check syntax and types\nbuild [FILE] [OUTPUT]  Save a validated version 2 bundle\nexec BUNDLE      Execute bytecode\ndisasm [FILE]    Show instructions\nfmt FILE         Format source (--check never writes)\ntest [FILE]      Run test_ functions or configured tests\ndebug [FILE]     Trace, --break LINE|FILE:LINE, --interactive\ninit DIRECTORY   Create project without overwriting files\nrepl             Persistent interactive language shell\nhelp / --version\nOptions: --fuel N, --depth N, --seed N, --allow-read DIR,\n--allow-write DIR, --lang en|fa, --json-errors, --output FILE.\nProgram arguments follow --. Debugger: step, continue, locals, quit.\nTutorial: TUTORIAL.fa.md or http://127.0.0.1:4173/tutorial.html`;
let parsed;
function requireFile(file) { if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new AionError('E_FILE', `Cannot read ${file ?? '(missing file)'}`); }
function debugCommand() {
  process.stderr.write('debug> '); const bytes = [], byte = Buffer.alloc(1);
  while (fs.readSync(0, byte, 0, 1, null)) { if (byte[0] === 10) break; if (bytes.length > 1000) throw new AionError('E_ARGS', 'Debugger command too long'); bytes.push(byte[0]); }
  return bytes.length ? Buffer.from(bytes).toString('utf8').replace(/\r$/, '') : 'continue';
}
try {
  parsed = parseArgs(process.argv.slice(2));
  const { command, options } = parsed; let file = parsed.file;
  if (['help', '--help'].includes(command)) console.log(HELP);
  else if (command === '--version') console.log('AION 0.2.0');
  else if (command === 'init') { if (!file) throw new AionError('E_ARGS', 'init requires DIRECTORY'); console.log(`Created ${initProject(file)}`); }
  else if (command === 'repl') await repl({ lang: options.lang });
  else if (!['run', 'check', 'build', 'exec', 'disasm', 'fmt', 'test', 'debug'].includes(command)) throw new AionError('E_ARGS', `Unknown command: ${command}`);
  else {
    let projectRoot;
    if (!file && !['exec', 'fmt'].includes(command)) { projectRoot = process.cwd(); file = projectFile(command); }
    parsed.file = file; requireFile(file);
    if (command === 'fmt') {
      const source = fs.readFileSync(file, 'utf8'), formatted = format(source);
      if (options.check) { if (formatted !== source) { console.error(`Needs formatting: ${file}`); process.exitCode = 1; } else console.log('Formatting check passed'); }
      else { fs.writeFileSync(file, formatted); console.log(`Formatted ${file}`); }
    } else {
      let bundle;
      if (command === 'exec') {
        if (fs.statSync(file).size > 20000000) throw new AionError('E_BYTECODE', 'Bundle exceeds size limit');
        try { bundle = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new AionError('E_BYTECODE', 'Invalid bundle JSON'); }
      } else bundle = buildFile(file, { projectRoot });
      if (command === 'check') console.log('Check passed');
      if (command === 'build') { const output = parsed.output ?? file + '.aion.json'; fs.writeFileSync(output, JSON.stringify(bundle)); console.log(`Built ${output}`); }
      if (command === 'disasm') console.log(bundle.modules.map(item => disassemble(item.module)).join('\n'));
      if (['run', 'exec', 'debug', 'test'].includes(command)) {
        const runtime = { ...(options.fuel ? { fuel: options.fuel } : {}), ...(options.depth ? { maxDepth: options.depth } : {}), ...(options.seed !== undefined ? { seed: options.seed } : {}), args: options.args, host: createFileHost({ base: path.dirname(path.resolve(file)), read: options.read, write: options.write }) };
        if (command === 'debug') runtime.onStep = createDebugger({ breaks: options.breaks, interactive: options.interactive, trace: options.trace, emit: line => console.error(line), command: debugCommand });
        if (command === 'test') {
          const initial = runBundle(bundle, { ...runtime, entry: false });
          const names = [...initial.globals.bindings].filter(([name, cell]) => name.startsWith('test_') && cell.value?.tag === 'closure').map(([name]) => name);
          if (!names.length) throw new AionError('E_TEST', 'No test_ functions found');
          let failed = 0;
          for (const name of names) { try { const fresh = runBundle(bundle, { ...runtime, entry: false }); fresh.vm.invoke(fresh.globals.bindings.get(name).value, []); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.code ?? 'E_TEST'} ${error.message}`); } }
          console.log(`${names.length - failed} passed, ${failed} failed`); if (failed) process.exitCode = 1;
        } else process.stdout.write(runBundle(bundle, runtime).output);
      }
    }
  }
} catch (error) {
  if (error.code !== 'E_DEBUG_STOP') {
    const options = parsed?.options ?? { lang: process.argv.includes('fa') ? 'fa' : 'en', 'json-errors': process.argv.includes('--json-errors') }; let source = '';
    if (error.filename && parsed?.file) { try { source = fs.readFileSync(path.resolve(path.dirname(parsed.file), error.filename), 'utf8'); } catch {} }
    console.error(options['json-errors'] ? JSON.stringify(diagnosticData(error, options.lang)) : renderDiagnostic(error, source, options.lang)); process.exitCode = 1;
  }
}
