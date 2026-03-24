# Z Dev Toolbox

[English](./README.md)

Z Dev Toolbox 是一个面向日常开发场景的多端开发者工具箱。  
它把同一套核心体验同时做成了 Web、浏览器插件和桌面端，方便你在不同工作环境里使用同一套小工具。

当前实现是本地优先的：这个仓库里没有后端服务，偏好设置也会保存在当前平台的本地环境中。

## 能做什么

目前内置的工具包括：

- JSON 格式化与校验
- JSON、YAML、TOML、XML、CSV、properties、HTML、HTTP 之间的格式转换
- Base64 编码与解码
- URL 编码与解码
- 时间戳与日期时间转换
- 哈希生成
- 正则测试与替换
- 二维码生成与解析
- 文本差异对比
- 颜色值转换
- Crontab 预览
- 雪花 ID 生成

## 可用端形态

- Web：在浏览器标签页里直接使用
- Browser Extension：作为 Chrome / Chromium Manifest V3 插件使用
- Desktop：作为 Tauri 桌面应用使用

## 快速部署

Docker 镜像只包含 Web 端。如果你需要浏览器插件或桌面端，请使用对应产物或源码构建方式。

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

启动后直接打开 `http://localhost:8080`。

如果你希望固定版本部署，把 `latest` 替换成具体版本号，例如 `goalonez/z-dev-toolbox:1.0.0`。

## 从源码运行

### 环境要求

- Node.js `>= 22`
- `pnpm@10`
- 如果你要运行桌面端，还需要 Rust 工具链和 Tauri 运行前置依赖

安装依赖：

```bash
pnpm install
```

### Web

启动 Web 开发环境：

```bash
pnpm dev:web
```

Vite 默认通常会在 `http://localhost:5173` 提供访问。

构建 Web 生产版本：

```bash
pnpm build:web
```

构建产物会输出到 `apps/web/dist`。

### 浏览器插件

启动插件开发流程：

```bash
pnpm dev:extension
```

构建生产插件：

```bash
pnpm --filter @z-dev-toolbox/extension build
```

解包后的生产插件目录位于 `apps/extension/build/chrome-mv3-prod`。  
在 Chrome 或 Edge 中打开 `chrome://extensions`，开启开发者模式后即可加载这个目录。

点击插件图标时，会打开工具箱的 options 页面。

### 桌面端

启动桌面端开发环境：

```bash
pnpm dev:desktop
```

构建桌面端：

```bash
pnpm --filter @z-dev-toolbox/desktop tauri:build
```

桌面端基于 Tauri，因此仍然依赖你当前操作系统对应的 Tauri 前置环境。

## 常用开发命令

执行整个工作区的构建：

```bash
pnpm build
```

执行检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## 仓库结构

这个仓库使用 `pnpm` workspace 和 Turborepo 管理。

```text
apps/
  web/         Web 应用
  extension/   浏览器插件
  desktop/     Tauri 桌面应用

packages/
  app-shell/      共享应用壳层
  config/         共享 TypeScript 与 Tailwind 配置
  core/           工具逻辑
  platform/       剪贴板、文件导出等平台适配
  shared/         公共类型
  state/          Zustand 状态
  storage/        存储适配
  tool-registry/  工具清单与面板实现
  ui/             共享 UI 组件

scripts/
  构建与仓库辅助脚本
```

## 感谢支持

感谢 OpenAI Codex 和 Claude 在实现、迭代与文档整理过程中提供的支持。

## 许可证

本项目使用 Apache License 2.0，详见 [LICENSE](./LICENSE)。
