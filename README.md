# Z Dev Toolbox

[简体中文](./README.zh-CN.md)

Z Dev Toolbox is a local-first developer toolbox for everyday engineering tasks.
It runs on the web, as a Chrome/Chromium extension, and as a desktop app, so you can keep the same set of utilities available wherever you work.

There is no backend service in this repository. Preferences stay in the current platform environment.

## Screenshots

| JSON Formatter | Regex |
| --- | --- |
| ![JSON Formatter](./assets/readme/json-formatter.png) | ![Regex](./assets/readme/regex.png) |
| Format, inspect, and clean JSON before moving on to downstream conversions or debugging. | Test patterns, inspect matches, and preview replacements before you edit real files. |

| QR Code | Time Converter |
| --- | --- |
| ![QR Code](./assets/readme/qr-code.png) | ![Time Converter](./assets/readme/time-converter.png) |
| Generate or parse QR codes without leaving the toolbox. | Parse timestamps and datetime strings instantly across local time and UTC. |

## Highlights

- Local-first. No account, no hosted service, no repository-side backend.
- Same toolbox across web, browser extension, and desktop.
- Focused on practical utilities instead of a large plugin surface.
- Designed for quick engineering workflows: paste, inspect, convert, copy, move on.

## Included Tools

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

## Get It

### Web

The Docker image packages the web app only.

#### Docker Compose

```yaml
services:
  z-dev-toolbox:
    image: goalonez/z-dev-toolbox:latest
    container_name: z-dev-toolbox
    ports:
      - 8080:80
    restart: unless-stopped
```

#### Docker Run

```bash
docker run -d \
  --name z-dev-toolbox \
  -p 8080:80 \
  --restart unless-stopped \
  goalonez/z-dev-toolbox:latest
```

Then open `http://localhost:8080`.

If you want a fixed image tag, replace `latest` with a concrete release such as `goalonez/z-dev-toolbox:1.0.3`.

### Browser Extension

The browser extension is available on the [Chrome Web Store](https://chromewebstore.google.com/detail/z-dev-toolbox/pbilldenadmdoiccepjobgopdlefpnoc). Install it directly from the store.

### Desktop

Desktop release assets for macOS, Windows, and Linux are also published on [GitHub Releases](https://github.com/Goalonez/z-dev-toolbox/releases).

The current macOS build is not yet signed or notarized by Apple, so the first launch may show “app is damaged” or “developer cannot be verified”.
If you trust that the app was downloaded from this project's release page, run the following command in Terminal and then open it again:

```bash
sudo xattr -d com.apple.quarantine "/Applications/Z Dev Toolbox.app"
```

## Run From Source

### Requirements

- Node.js `24.14.0`
- `pnpm@10`
- Rust toolchain and Tauri prerequisites if you want to run the desktop app

The repository keeps Node.js aligned with [`.nvmrc`](./.nvmrc), which is also used by GitHub Actions.

Install dependencies:

```bash
pnpm install
```

### Development

```bash
pnpm dev:web
pnpm dev:extension
pnpm dev:desktop
```

### Build

```bash
pnpm build:web
pnpm --filter @z-dev-toolbox/extension build
pnpm --filter @z-dev-toolbox/desktop tauri:build
```

### Verification

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
```

## Thanks

Thanks to OpenAI Codex and Claude for supporting implementation, iteration, and documentation work on this project.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).
