# AION language reference — 0.1

## Bindings and types

`let` prevents rebinding. `var` permits assignment. Neither freezes the referenced collection. Types are `Int`, `Float`, `Bool`, `String`, `Map`, `Void`, `Any` and arrays such as `Int[]`. Omitted annotations are inferred where possible; omitted parameters are `Any`. Type checking is gradual, not sound: passing through `Any`, indirect native calls and collection aliases can lose precision. Known incompatible assignments are rejected.

`Int` uses JavaScript safe integers (±9,007,199,254,740,991). Numbers must be finite. Division has static type `Float`; remainder follows JavaScript's signed remainder semantics. There is no implicit string/number arithmetic conversion. `Float` can accept an `Int`. Runtime numeric values are not separately tagged, so `type(2.0)` returns `Int`.

```aion
let label: String = "AION"
var count: Int = 0
count += 1
let data = [1, 2, 3]
data[0] = 9
```

## Functions and control flow

```aion
fn double(n: Int) -> Int { return n * 2 }
let triple = fn(n) { return n * 3 }
for n in range(5) { print(double(n)) }
var i = 0
while i < 3 { i += 1 }
if i == 3 { print("done") } else { print("unexpected") }
```

Conditions must be Boolean. `&&` and `||` short-circuit. Functions capture lexical binding cells, so a closure sees subsequent changes to captured variables. Named functions are hoisted within their block; ordinary bindings are initialized in source order. A `return` followed by a newline returns no value. A function with an explicit non-`Void` return annotation must return on every statically recognized path. Inferred functions with possible fallthrough return `Any` statically.

`main()` is called automatically after entry-module initialization if present. Dependency modules initialize once per execution and do not call their `main`. Top-level code can also be used without `main`.

## Collections and strings

```aion
let profile = {"name": "Ghost", level: 3}
profile.level += 1
print(profile["name"], profile.level)
let name = "world"
print("Hello, {name}! {{literal braces}}")
```

Dictionary keys are strings; missing keys are errors. Array indices must be nonnegative integers inside bounds; writes cannot create holes. Collection equality compares identity, not deep content. Arrays and dictionaries can be cyclic. Single and double quoted strings both support interpolation. Escapes include `\n`, `\t`, escaped quotes and `\uXXXX`. String indices and lengths count UTF-16 code units; string iteration yields Unicode code points.

Line comments use `//`; nested block comments use `/* ... */`. Semicolons are optional. Unicode letters are allowed in identifiers. Property access `obj.key` is shorthand for `obj["key"]`.

## Modules

```aion
// math.ai
export fn square(n: Int) -> Int { return n * n }
// main.ai
import { square } from "./math.ai"
print(square(12))
```

Imports and exports are only permitted at module scope. Only named bindings and functions can be exported. Imports bind exported values immutably; mutable objects remain shared. Paths are relative and confined to the entry project directory. No packages or cyclic imports are supported.

## Standard library

| Area | Functions |
| --- | --- |
| Output/checks | `print(...values)`, `assert(condition, message?)`, `type(value)` |
| Collections | `len`, `range(end)` / `range(start,end,step?)`, `push`, `pop`, `keys`, `values`, `has`, `contains`, `slice(value,start,end?)`, `sort`, `reverse` |
| Higher order | `map(array,fn)`, `filter(array,fn)`, `reduce(array,initial,fn)` |
| Text/conversion | `str`, `int`, `float`, `split`, `join`, `upper`, `lower`, `trim` |
| Math | `abs`, `min`, `max`, `sqrt`, `pow`, `floor`, `ceil`, `round` |
| JSON | `json_parse`, `json_stringify` |
| Host | `read_text(path)`, `write_text(path,text)`, `clock`, `random`, `args` |

`range` excludes the endpoint. `sort` accepts all-number or all-string arrays and returns a copy. `reverse`, `slice`, `map` and `filter` return new arrays. Callbacks receive one element, or accumulator and element for `reduce`. JSON cannot serialize functions or cyclic structures. `random()` is a seeded deterministic generator by default; `clock()` measures host monotonic time in seconds. File functions require explicit host capabilities and are unavailable in the browser.

## Runtime limits

Default fuel is 1,000,000 units; each bytecode instruction costs at least one, and selected native operations also charge work. Default call depth is 256. Cumulative collection allocation is limited to 1,000,000 logical units, with a 100,000-unit limit per allocation. Output is limited to 2,000,000 JavaScript characters. JSON nesting is capped at 150; AST depth is capped before type checking. These are logical accounting limits and do not exactly model CPU time or heap bytes.
