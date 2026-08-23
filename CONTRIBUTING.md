# Contributing to TinyNote

Thanks for helping improve TinyNote. This project is a local-first desktop note app built with React, TypeScript, Tauri, and Rust.

## Good First Contributions

Good starting points include:

- Fixing UI copy or translations
- Improving documentation and screenshots
- Adding small import/export improvements
- Improving keyboard shortcuts and accessibility
- Writing tests for utility functions
- Reporting bugs with clear reproduction steps

## Local Development

Install dependencies:

```bash
npm install
```

Start the web frontend:

```bash
npm run dev
```

Start the Tauri desktop app:

```bash
npm run tauri dev
```

Run tests:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

Build desktop packages:

```bash
npm run tauri build
```

## Pull Requests

Before opening a pull request:

1. Keep the change focused.
2. Match the existing code style.
3. Add or update tests when changing behavior.
4. Run `npm test` and `npm run build`.
5. Include screenshots or screen recordings for UI changes.

## Bug Reports

Useful bug reports include:

- Operating system and TinyNote version
- What you expected to happen
- What actually happened
- Reproduction steps
- Screenshots, logs, or sample notes if relevant

Please remove private note content before sharing logs, screenshots, or sample files.
