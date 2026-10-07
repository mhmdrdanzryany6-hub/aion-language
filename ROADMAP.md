# Roadmap

## Next: reliability

Expand property-based fuzzing, define tagged numeric values, improve inferred function contracts and source maps, add formatter reflow rules and richer debugger lexical inspection. Version 0.2 already provides reachable bytecode flow checks, runtime array contracts, Persian guidance, project configuration, REPL and interactive breakpoints. Add persistent module caches only after their semantics are specified.

## Later: tooling

Language Server Protocol, editor integration, package/dependency resolution, source maps, reproducible benchmarks and compatibility suites. Project manifests are already available; a package registry is not.

## Research goals

Native and WebAssembly backends, algebraic data types, generics, effect tracking, ownership, structured concurrency and self-hosting. These require deliberate language design and substantial new implementation. They are not available in v0.1. No timeline or performance promise is implied.
