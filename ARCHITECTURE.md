# Architecture

```text
Source → lexer → parser → gradual checker → bytecode compiler
                                                  ↓
CLI / browser worker → explicit-frame VM → standard library
                                                  ↓
                                       optional file capability host
```

`lexer.mjs` produces located tokens. `parser.mjs` produces a Pratt expression AST. `types.mjs` uses lexical scopes and function signatures; `Any` is an explicit escape hatch. `compiler.mjs` emits stack instructions and source location tables. `vm.mjs` maintains its own call frames rather than using host recursion for language function calls. Closure environments hold shared mutable binding cells. `values.mjs` represents dictionaries with `Map`, preventing JavaScript prototype-property lookup through language indexing.

`modules.mjs` resolves a dependency graph and checks exported signatures. `bytecode.mjs` verifies version 2 JSON artifacts: shapes, exact operands, types, locations, references, dependency graphs and reachable control-flow operand-stack/scope heights. This structural verification is not proof of program correctness or an OS security boundary. `runtime-types.mjs` stores array identity contracts in a WeakMap and validates nested constraints before committing them. Binding cells and function prototypes carry runtime contracts.

`stdlib.mjs` exposes a narrow native function interface. It never evaluates source as JavaScript. File access is disabled unless an explicit host is supplied. The Node host confines lexical and resolved paths to permitted directories; this is convenience scoping, not a race-proof filesystem sandbox.

The browser loads the same compiler and VM. Each run starts a fresh module worker, with a five-second UI timeout. The local server binds only to `127.0.0.1` and serves an explicit set of playground files.

The flat source layout is intentional for easy inspection and GitHub browser uploads. Tests are separate from implementation. No build tooling or package installation is required.

`project.mjs` owns initialization and manifest path checks; `cli-options.mjs` parses explicit options; `repl.mjs` reuses a VM lexical environment across submissions. `debugger.mjs` filters source snapshots, with a terminal callback that reads step/continue commands synchronously. The browser uses nonblocking snapshot inspection in its worker. `diagnostic-locale.mjs` adds Persian guidance while retaining original diagnostic codes/messages. `lessons.mjs` supplies both the RTL tutorial UI and executable lesson tests.
