import { fail } from './diagnostic.mjs';
import { runtimeType } from './values.mjs';
export const validType = type => typeof type === 'string' && type.length <= 300 && /^(Any|Int|Float|Bool|String|Void|Map|Fn)(\[\])*$/.test(type);

// Contracts belong to array identities. Every alias, including Any, must honor
// the same constraints. Gather all nested contracts before committing any.
export class RuntimeTypes {
  constructor(charge = () => {}) { this.arrays = new WeakMap(); this.charge = charge; }
  enforce(value, type = 'Any', loc = {}) {
    this.enforceMany(value, [type], loc);
    return value;
  }
  enforceMany(value, types, loc) {
    const planned = new Map(), pending = types.map(type => [value, type, 0]);
    while (pending.length) {
      const [item, type, depth] = pending.pop(); this.charge();
      if (!validType(type)) fail('E_BYTECODE', 'Invalid runtime type contract', loc);
      if (type === 'Any') continue;
      if (depth > 150) fail('E_DEPTH', 'Type contract nesting limit exceeded', loc);
      if (type.endsWith('[]')) {
        if (!Array.isArray(item)) fail('E_TYPE', `Expected ${type}, received ${runtimeType(item)}`, loc);
        const element = type.slice(0, -2), staged = planned.get(item) ?? new Set();
        if (staged.has(element)) continue;
        staged.add(element); planned.set(item, staged);
        for (const child of item) pending.push([child, element, depth + 1]);
      } else if (!(type === 'Void' ? item === null : type === 'Fn' ? ['closure', 'native'].includes(item?.tag) : runtimeType(item) === type || type === 'Float' && runtimeType(item) === 'Int')) {
        fail('E_TYPE', `Expected ${type}, received ${runtimeType(item)}`, loc);
      }
    }
    for (const [array, staged] of planned) {
      const existing = this.arrays.get(array) ?? new Set();
      for (const type of staged) existing.add(type);
      this.arrays.set(array, existing);
    }
  }
  mutation(array, value, loc) {
    this.enforceMany(value, [...(this.arrays.get(array) ?? [])], loc);
  }
}
