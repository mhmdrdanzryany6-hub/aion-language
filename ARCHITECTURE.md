# Architecture

```text
Source → lexer → parser → gradual checker → bytecode compiler
                                                  ↓
CLI / browser worker → explicit-frame VM → standard library
                                                  ↓
                                       optional file capability host
```

`lexer.mjs` produces located tokens. `parser.mjs` produces a Pratt expression AST. `types.mjs` uses lexical scopes and function signatures; `Any` is an explicit escape hatch. `compiler.mjs` emits stack instructions and source location tables. `vm.mjs` maintains its own call frames rather than using host recursion for language function calls. Closure environments hold shared mutable binding cells. `values.mjs` represents dictionaries with `Map`, preventing JavaScript prototype-property lookup through language indexing.

`modules.mjs` resolves a dependency graph, checks exported signatures, bundles modules in JSON and validates basic artifact structure before execution. Validation does not prove bytecode correctness through complete control-flow analysis. Runtime checks and budgets handle invalid stack operations and runaway execution. Bundles are intended as project artifacts, not an untrusted executable distribution format.

`stdlib.mjs` exposes a narrow native function interface. It never evaluates source as JavaScript. File access is disabled unless an explicit host is supplied. The Node host confines lexical and resolved paths to permitted directories; this is convenience scoping, not a race-proof filesystem sandbox.

The browser loads the same compiler and VM. Each run starts a fresh module worker, with a five-second UI timeout. The local server binds only to `127.0.0.1` and serves an explicit set of playground files.

The flat source layout is intentional for easy inspection and GitHub browser uploads. Tests are separate from implementation. No build tooling or package installation is required.
