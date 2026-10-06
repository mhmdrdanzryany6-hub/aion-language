export class AionError extends Error {
  constructor(code, message, location = {}, notes = []) {
    super(message); this.name = 'AionError'; this.code = code;
    this.filename = location.filename ?? '<input>'; this.line = location.line ?? 1;
    this.column = location.column ?? 1; this.start = location.start ?? 0;
    this.end = location.end ?? this.start + 1; this.notes = notes; this.frames = [];
  }
  render(source = '') {
    const lines = source.split(/\r?\n/), line = lines[this.line - 1] ?? '';
    const width = Math.max(1, Math.min(this.end - this.start, Math.max(1, line.length - this.column + 1)));
    return `${this.filename}:${this.line}:${this.column} ${this.code}: ${this.message}\n` +
      ` ${this.line} │ ${line}\n   │ ${' '.repeat(Math.max(0, this.column - 1))}${'^'.repeat(width)}\n` +
      this.notes.map(n => `  help: ${n}\n`).join('') + this.frames.map(f => `  at ${f}\n`).join('');
  }
}
export const fail = (code, message, location, notes) => { throw new AionError(code, message, location, notes); };
