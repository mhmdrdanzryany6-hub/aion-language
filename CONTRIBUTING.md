# Contributing

Use Node.js 24 or newer. Run `npm test` and `node cli.mjs run showcase.ai` before submitting a change. Add a failing behavior test before fixing a language bug. Keep diagnostics as `AionError` with a stable code and source location. Do not introduce `eval`, JavaScript source compilation or implicit file/network capabilities.

Syntax and behavior changes need corresponding updates to `LANGUAGE.md`. Claims in the README must describe working, verified features. Include the failing program and expected behavior when reporting a defect.
