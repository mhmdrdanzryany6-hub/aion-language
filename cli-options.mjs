import { AionError } from './diagnostic.mjs';
const bad = message => { throw new AionError('E_ARGS', message); };
export function parseArgs(argv) {
  const [command = 'help', ...input] = argv;
  const options = { read: [], write: [], breaks: [], args: [], lang: 'en' }, positional = [];
  const values = new Set(['--fuel', '--depth', '--seed', '--allow-read', '--allow-write', '--break', '--lang', '--output', '-o']);
  const switches = new Set(['--json-errors', '--check', '--interactive', '--trace']);
  for (let i = 0; i < input.length; i++) {
    const flag = input[i];
    if (flag === '--') { const remaining = input.slice(i + 1); if (!positional.length && remaining.length) positional.push(remaining.shift()); options.args = remaining; break; }
    if (!flag.startsWith('-')) { positional.push(flag); continue; }
    if (switches.has(flag)) { options[flag.slice(2)] = true; continue; }
    if (!values.has(flag)) bad(`Unknown option: ${flag}`);
    const value = input[++i]; if (value === undefined || value.startsWith('--') || values.has(value) || switches.has(value)) bad(`Missing value for ${flag}`);
    if (['--fuel', '--depth', '--seed'].includes(flag)) {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < (flag === '--seed' ? 0 : 1)) bad(`Invalid numeric value for ${flag}`);
      options[flag.slice(2)] = Number(value);
    } else if (flag === '--allow-read') options.read.push(value);
    else if (flag === '--allow-write') options.write.push(value);
    else if (flag === '--break') options.breaks.push(value);
    else if (flag === '--lang') { if (!['fa', 'en'].includes(value)) bad('Language must be fa or en'); options.lang = value; }
    else options.output = value;
  }
  if (positional.length > (command === 'build' ? 2 : 1)) bad('Too many file arguments; program arguments follow --');
  if (options.check && command !== 'fmt') bad('--check is only valid for fmt');
  if ((options.interactive || options.trace || options.breaks.length) && command !== 'debug') bad('Debugger options require debug');
  if (options.output && command !== 'build') bad('--output is only valid for build');
  return { command, file: positional[0], output: options.output ?? positional[1], options };
}
