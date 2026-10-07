import fs from 'node:fs';
import path from 'node:path';
import { AionError } from './diagnostic.mjs';
const bad = message => { throw new AionError('E_PROJECT', message); };
export function initProject(target) {
  const directory = path.resolve(target);
  if (fs.existsSync(directory) && (!fs.statSync(directory).isDirectory() || fs.readdirSync(directory).length)) bad('Target directory must be empty; existing files will not be overwritten');
  fs.mkdirSync(directory, { recursive: true });
  const files = {
    'aion.json': JSON.stringify({ name: path.basename(directory), version: '0.1.0', entry: 'main.ai', tests: 'tests.ai' }, null, 2) + '\n',
    'main.ai': 'fn main() {\n  print("Hello from AION!")\n}\n',
    'tests.ai': 'fn test_first() {\n  assert(2 + 2 == 4)\n}\n',
    '.gitignore': '*.aion.json\n*.log\n',
    'README.md': '# My AION project\n\nRun: `aion run`\nTest: `aion test`\n\nWithout an installed CLI, use `node /path/to/AION/cli.mjs run` from this directory.\n'
  };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content, { encoding: 'utf8', flag: 'wx' });
  return directory;
}
export function projectFile(command, directory = process.cwd()) {
  const manifest = path.join(directory, 'aion.json');
  if (!fs.existsSync(manifest)) bad('No aion.json found; supply a file or use init DIRECTORY');
  if (fs.statSync(manifest).size > 64000) bad('Project manifest exceeds size limit');
  let config; try { config = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch { bad('Invalid aion.json'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) bad('Invalid project manifest');
  const selected = command === 'test' ? config.tests : config.entry;
  if (typeof selected !== 'string' || !selected || !selected.endsWith('.ai') || path.isAbsolute(selected)) bad('Project entry/tests must be a relative .ai path');
  const target = path.resolve(directory, selected), relative = path.relative(directory, target);
  if (relative === '..' || relative.startsWith('..' + path.sep)) bad('Project entry escapes root');
  if (fs.existsSync(target)) {
    const actual = path.relative(fs.realpathSync(directory), fs.realpathSync(target));
    if (actual === '..' || actual.startsWith('..' + path.sep) || path.isAbsolute(actual)) bad('Project entry resolves outside root');
  }
  return target;
}
