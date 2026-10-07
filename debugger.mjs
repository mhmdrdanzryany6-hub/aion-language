import { AionError } from './diagnostic.mjs';
export function createDebugger({ breaks = [], interactive = false, trace = false, emit = () => {}, command = () => 'continue' } = {}) {
  if (breaks.length > 100) throw new AionError('E_ARGS', 'Too many breakpoints');
  const points = breaks.map(point => { const match = /^(?:(.*):)?([1-9]\d*)$/.exec(String(point)); if (!match || !Number.isSafeInteger(Number(match[2]))) throw new AionError('E_ARGS', 'Breakpoint must be LINE or FILE:LINE'); return { file: match[1], line: Number(match[2]) }; });
  let previous = '', stepping = interactive, count = 0;
  return snapshot => {
    const key = `${snapshot.location.filename}:${snapshot.location.line}:${snapshot.depth}:${snapshot.function}`;
    const changed = key !== previous; previous = key;
    const hit = changed && (stepping || points.some(point => point.line === snapshot.location.line && (!point.file || point.file === snapshot.location.filename)));
    if (trace || (!interactive && !points.length)) {
      if (++count > 5000) throw new AionError('E_OUTPUT', 'Debugger trace limit exceeded');
      emit(`${snapshot.location.filename}:${snapshot.location.line} ${snapshot.function} #${snapshot.ip} ${snapshot.instruction.join(' ')} [${snapshot.stack.join(', ')}]`);
    }
    if (!hit) return;
    if (++count > 5000) throw new AionError('E_OUTPUT', 'Debugger stop limit exceeded');
    emit(`BREAK ${snapshot.location.filename}:${snapshot.location.line} ${snapshot.function}\nlocals: ${JSON.stringify(snapshot.locals)}\nstack: ${JSON.stringify(snapshot.stack)}`);
    if (!interactive) return;
    while (true) {
      const action = command().trim().toLowerCase();
      if (['c', 'continue'].includes(action)) { stepping = false; return; }
      if (['s', 'step', ''].includes(action)) { stepping = true; return; }
      if (['q', 'quit'].includes(action)) throw new AionError('E_DEBUG_STOP', 'Debugger stopped by user');
      if (['l', 'locals'].includes(action)) emit(JSON.stringify(snapshot.locals, null, 2));
      else emit('Commands: step (s), continue (c), locals (l), quit (q)');
    }
  };
}
