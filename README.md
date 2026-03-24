# Z Dev Toolbox

[简体中文](./README.zh-CN.md)

Z Dev Toolbox is a multi-platform developer toolbox for everyday engineering tasks.  
It runs the same core experience on the web, in a Chrome extension, and in a desktop app, so you can use the same utilities wherever you work.

The current app is local-first: there is no backend service in this repository, and preferences are stored locally in the current platform environment.

## What It Helps With

Z Dev Toolbox currently includes tools for:

- JSON formatting and validation
- Format conversion between JSON, YAML, TOML, XML, CSV, properties, HTML, and HTTP
- Base64 encoding and decoding
- URL encoding and decoding
- Timestamp and datetime conversion
- Hash generation
- Regex testing and replacement
- QR code generation and parsing
- Text diff comparison
- Color value conversion
- Crontab preview
- Snowflake ID generation

## Available Apps

- Web app: run the toolbox in a normal browser tab
- Browser extension: use it as a Chrome/Chromium Manifest V3 extension
- Desktop app: run the same toolbox in a Tauri desktop shell

## Quick Start

The Docker image packages the web app only. Use the browser extension or desktop app when you need those distribution forms.

### Docker Compose

```yaml
services:
  z-dev-toolbox:
    image: goalonez/z-dev-toolbox:latest
    container_name: z-dev-toolbox
    ports:
      - 8080:80
    restart: unless-stopped
```

### Docker Run

```bash
docker run -d \
  --name z-dev-toolbox \
  -p 8080:80 \
  --restart unless-stopped \
  goalonez/z-dev-toolbox:latest
```

Then open `http://localhost:8080`.

If you want a fixed release, replace `latest` with a concrete tag such as `goalonez/z-dev-toolbox:1.0.0`.

## Use From Source

### Requirements

- Node.js `>= 22`
- `pnpm@10`
- Rust toolchain and Tauri prerequisites if you want to run the desktop app

Install dependencies:

```bash
pnpm install
```

### Web App

Start the web development server:

```bash
pnpm dev:web
```

Vite usually serves the app at `http://localhost:5173`.

Build the production web app:

```bash
pnpm build:web
```

The build output is written to `apps/web/dist`.

### Browser Extension

Start the extension development workflow:

```bash
pnpm dev:extension
```

Build a production extension package:

```bash
pnpm --filter @z-dev-toolbox/extension build
```

The unpacked production extension is generated in `apps/extension/build/chrome-mv3-prod`.  
In Chrome or Edge, enable Developer Mode on `chrome://extensions` and load that directory as an unpacked extension.

The extension action opens the toolbox in its options page.

### Desktop App

Start the desktop app in development mode:

```bash
pnpm dev:desktop
```

Build the desktop app:

```bash
pnpm --filter @z-dev-toolbox/desktop tauri:build
```

The desktop app uses Tauri and requires the usual system dependencies for your OS.

## Development Commands

Run all workspace builds:

```bash
pnpm build
```

Run checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Repository Layout

This repository is a `pnpm` workspace managed with Turborepo.

```text
apps/
  web/         Web app
  extension/   Browser extension
  desktop/     Tauri desktop app

packages/
  app-shell/      Shared application shell
  config/         Shared TypeScript and Tailwind config
  core/           Tool logic
  platform/       Clipboard and file/export adapters
  shared/         Shared types
  state/          Zustand state
  storage/        Storage adapters
  tool-registry/  Tool manifests and panels
  ui/             Shared UI components

scripts/
  Build and repository utility scripts
```

## Thanks

Thanks to OpenAI Codex and Claude for supporting implementation, iteration, and documentation work on this project.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
