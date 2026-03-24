# Release Notes

该目录用于存放 GitHub Release 说明文件，文件名必须与 tag 完全一致。

## 文件命名

- `release-notes/v0.1.0.md`
- `release-notes/v0.1.0-web.md`
- `release-notes/v0.1.0-extension.md`
- `release-notes/v0.1.0-desktop.md`

## 编写规则

- 所有正式 tag 都必须提供对应文件，包括全量和单渠道 tag。
- 内容建议中英双语，保持简洁，通常控制在 2 到 6 条。
- `-web` 版本重点说明镜像或 Web 端变化。
- `-extension` 版本重点说明插件变化。
- `-desktop` 版本重点说明桌面端变化和平台差异。

## 模板

```md
## 中文
- 更新点 1
- 更新点 2

## English
- Update 1
- Update 2
```
