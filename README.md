# AION

**Readable code. Explicit execution.**

AION is an experimental programming language with a lexer, parser, gradual static type checker, runtime type contracts, bytecode compiler and an explicit-frame virtual machine. It runs on Node.js and in a local browser playground, with no package dependencies.

**Learn:** [آموزش کامل فارسی](TUTORIAL.fa.md) · ten runnable lessons at `http://127.0.0.1:4173/tutorial.html` after starting `node serve.mjs`.

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

On Windows, double-click `Start-Lab.cmd`; use `Start-Learn.cmd` for lessons or `Run-Demo.cmd` for the terminal demo. Node.js must be installed (launchers also recognize the owner's bundled Codex Node runtime).

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
- Runtime typed bindings, parameter reassignment, explicit function returns and alias-preserving nested array contracts.
- Reachable stack/scope control-flow validation and dependency validation before executing version 2 bundles.
- Project scaffolding, aion.json configuration, multiline REPL and terminal interactive source breakpoints.

## Tooling

```sh
node cli.mjs fmt hello.ai
node cli.mjs disasm showcase.ai
node cli.mjs debug hello.ai
node cli.mjs test tests.ai
node cli.mjs run showcase.ai --fuel 2000000 --depth 256
node cli.mjs run my-program.ai --allow-read ./input --allow-write ./output
node cli.mjs run my-program.ai -- first second
node cli.mjs init my-app
node cli.mjs repl
node cli.mjs debug hello.ai --break 2 --interactive
node cli.mjs run missing.ai --lang fa --json-errors
node cli.mjs run sales-report.ai --allow-read .
```

`debug` emits instruction traces or source breakpoint snapshots; `--interactive` pauses for `step`, `continue`, `locals` and `quit`. Browser inspection prints snapshots and continues. `fmt` normalizes spacing and indentation while preserving line boundaries and multiline comment content; `fmt FILE --check` never writes. Tests are zero-argument functions whose names begin with `test_`; each test runs with a freshly initialized module graph. A project manifest selects entry and test files when filenames are omitted. REPL bindings persist; failed execution does not roll back preceding mutations.

File capability directories are resolved relative to the entry file. They must exist. Imports must stay inside the manifest project root (or the entry file's directory when a file is supplied directly), including after resolving symbolic links. Circular imports are rejected.

## Status and limits

Version 0.2.0 is a working prototype, not a production language or a security boundary for hostile code. It uses JavaScript-managed memory. `Any` permits values that cannot be verified statically; runtime contracts protect typed bindings and shared arrays but are not an ownership or effect system. Numbers use host numeric representation. Budgets are logical limits, not an OS memory sandbox. Do not accept arbitrary bundles or grant file access to untrusted programs in a privileged host process. Version 1 bytecode must be rebuilt from source.

There is no native backend, WebAssembly backend, ownership checker, async runtime, parallel scheduler, package registry or self-hosted compiler yet. See [ROADMAP.md](ROADMAP.md).

The test suite covers source execution, type contracts, malformed bytecode, module imports, CLI/project workflows and all ten lesson examples. Passing tests demonstrate covered behaviors; they are not a guarantee of zero defects. GitHub Actions runs the suite on Windows and Linux.

Read [LANGUAGE.md](LANGUAGE.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for details. Licensed under MIT.

## فارسی

AION یک زبان آزمایشی واقعی با کامپایلر بایت‌کد، ماشین مجازی، ابزار خط فرمان و محیط آزمایش آفلاین است. نام متغیرها می‌تواند فارسی باشد. برای اجرا، Node.js نسخهٔ ۲۴ یا جدیدتر نصب کن و دستور `node cli.mjs run hello.ai` را بزن. برای محیط گرافیکی، `Start-Lab.cmd` را باز کن.

نسخهٔ ۰٫۲ آموزش فارسی، ده درس قابل اجرا، ساخت پروژه، محیط تعاملی، دیباگر با توقف روی خط، خروجی خطای JSON و بررسی قوی‌تر نوع و بایت‌کد دارد. برای شروع [آموزش فارسی](TUTORIAL.fa.md) را بخوان یا `Start-Learn.cmd` را باز کن.

هدف این نسخه، سادگی کد و قابل بررسی بودن اجرای برنامه است. کامپایل مستقیم به ماشین، سیستم مالکیت حافظه و اجرای موازی هنوز پیاده‌سازی نشده‌اند.

