# AION

**Readable code. Explicit execution.**

AION is an experimental programming language with a lexer, parser, gradual static type checker, bytecode compiler and an explicit-frame virtual machine. It runs on Node.js and in a local browser playground, with no package dependencies.

```aion
fn counter(start: Int) {
  var value = start
  return fn() { value += 1 return value }
}

let next = counter(40)
print(next(), next()) // 41 42
```

## Quick start

Install Node.js 24 or newer, then:

```sh
node cli.mjs run showcase.ai
node cli.mjs check modules-demo.ai
node cli.mjs build modules-demo.ai demo.aion.json
node cli.mjs exec demo.aion.json
npm test
node serve.mjs
```

Open `http://127.0.0.1:4173` for the offline language lab. The browser executes programs in a worker and can show bytecode, check types and format source. No external fonts, scripts or services are required.

On Windows, double-click `Start-Lab.cmd`; use `Run-Demo.cmd` for the terminal demo. Node.js must be installed.

## What works

- Lexical closures, first-class functions and recursion.
- Mutable variables, immutable bindings, arrays and dictionaries.
- `if`, `while`, `for`, `break`, `continue` and automatic `main()` entry.
- Unicode identifiers, string interpolation and source diagnostics.
- Gradual type checking, typed function arguments and explicit numeric rules.
- Relative module imports, isolated module globals and exported bindings.
- JSON bytecode bundles, disassembly, instruction traces and language tests.
- Standard library for collections, JSON, strings, math and scoped file access.
- Fuel, call-depth, allocation and output budgets.

## Tooling

```sh
node cli.mjs fmt hello.ai
node cli.mjs disasm showcase.ai
node cli.mjs debug hello.ai
node cli.mjs test tests.ai
node cli.mjs run showcase.ai --fuel 2000000 --depth 256
node cli.mjs run my-program.ai --allow-read ./input --allow-write ./output
node cli.mjs run my-program.ai -- first second
```

`debug` emits an instruction trace with source lines and operand stacks. `fmt` is deliberately conservative: it normalizes indentation and trailing whitespace without changing line boundaries. Tests are zero-argument functions whose names begin with `test_`; each test runs with a freshly initialized module graph.

File capability directories are resolved relative to the entry file. They must exist. Imports must stay inside the entry file's directory tree, including after resolving symbolic links. Circular imports are rejected.

## Status and limits

Version 0.1.0 is a working prototype, not a production language or a security boundary for hostile code. It uses JavaScript-managed memory. `Any` intentionally permits values that cannot be verified statically; annotations are not a sound ownership or runtime binding enforcement system. Builtin argument checks and typed function parameter checks still run at execution time. Budgets are logical limits, not an OS memory sandbox. Do not accept arbitrary bundles or grant file access to untrusted programs in a privileged host process.

There is no native backend, WebAssembly backend, ownership checker, async runtime, parallel scheduler, package registry or self-hosted compiler yet. See [ROADMAP.md](ROADMAP.md).

The project contains 69 automated tests as of this release. Passing tests demonstrate those covered behaviors; they are not a guarantee of zero defects.

Read [LANGUAGE.md](LANGUAGE.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for details. Licensed under MIT.

## فارسی

AION یک زبان آزمایشی واقعی با کامپایلر بایت‌کد، ماشین مجازی، ابزار خط فرمان و محیط آزمایش آفلاین است. نام متغیرها می‌تواند فارسی باشد. برای اجرا، Node.js نسخهٔ ۲۴ یا جدیدتر نصب کن و دستور `node cli.mjs run hello.ai` را بزن. برای محیط گرافیکی، `Start-Lab.cmd` را باز کن.

هدف این نسخه، سادگی کد و قابل بررسی بودن اجرای برنامه است. کامپایل مستقیم به ماشین، سیستم مالکیت حافظه و اجرای موازی هنوز پیاده‌سازی نشده‌اند.

