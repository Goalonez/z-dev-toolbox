import { Base64Panel } from "./tools/base64-panel";
import { ColorPanel } from "./tools/color-panel";
import { CrontabPanel } from "./tools/crontab-panel";
import { FormatConvertPanel } from "./tools/format-convert-panel";
import { HashPanel } from "./tools/hash-panel";
import { JsonFormatPanel } from "./tools/json-format-panel";
import { SqlFormatPanel } from "./tools/sql-format-panel";
import { XmlFormatPanel } from "./tools/xml-format-panel";
import { QrCodePanel } from "./tools/qr-code-panel";
import { RegexPanel } from "./tools/regex-panel";
import { SnowflakePanel } from "./tools/snowflake-panel";
import { TextDiffPanel } from "./tools/text-diff-panel";
import { TimestampPanel } from "./tools/timestamp-panel";
import { UrlEncodePanel } from "./tools/url-encode-panel";
import type { ToolRegistryEntry } from "./types";

export const toolRegistry: ToolRegistryEntry[] = [
  {
    manifest: {
      id: "json.format",
      name: "JSON 格式化",
      summary: "格式化、压缩并校验 JSON 文本。",
      category: "data",
      keywords: ["json", "format", "minify", "validator"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "JSON Formatter",
          summary: "Format, minify, and validate JSON text.",
          category: "Data",
          keywords: ["json", "format", "minify", "validate"]
        },
        "zh-CN": {
          category: "数据",
          keywords: ["json", "格式化", "压缩", "校验"]
        }
      }
    },
    Panel: JsonFormatPanel
  },
  {
    manifest: {
      id: "xml.format",
      name: "XML 格式化",
      summary: "格式化、压缩并校验 XML 文本。",
      category: "data",
      keywords: ["xml", "format", "formatter", "minify", "validate"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "XML Formatter",
          summary: "Format, minify, and validate XML text.",
          category: "Data",
          keywords: ["xml", "format", "formatter", "minify", "validate"]
        },
        "zh-CN": {
          category: "数据",
          keywords: ["xml", "格式化", "压缩", "校验"]
        }
      }
    },
    Panel: XmlFormatPanel
  },
  {
    manifest: {
      id: "format.convert",
      name: "格式转换",
      summary: "在 JSON、YAML、TOML、XML、CSV、properties、HTML、HTTP 之间互转。",
      category: "data",
      keywords: [
        "format",
        "convert",
        "json",
        "yaml",
        "toml",
        "xml",
        "csv",
        "properties",
        "html",
        "http"
      ],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Format Converter",
          summary: "Convert between JSON, YAML, TOML, XML, CSV, properties, HTML, and HTTP.",
          category: "Data",
          keywords: [
            "format",
            "convert",
            "json",
            "yaml",
            "toml",
            "xml",
            "csv",
            "properties",
            "html",
            "http"
          ]
        },
        "zh-CN": {
          category: "数据",
          keywords: [
            "格式转换",
            "json",
            "yaml",
            "toml",
            "xml",
            "csv",
            "properties",
            "html",
            "http"
          ]
        }
      }
    },
    Panel: FormatConvertPanel
  },
  {
    manifest: {
      id: "base64.codec",
      name: "Base64",
      summary: "支持文本和图片的 Base64 编码、解码。",
      category: "encoding",
      keywords: ["base64", "encode", "decode", "url-safe"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Base64",
          summary: "Encode and decode Base64 for text and images.",
          category: "Encoding",
          keywords: ["base64", "encode", "decode", "url-safe"]
        },
        "zh-CN": {
          category: "编码",
          keywords: ["base64", "编码", "解码", "url-safe"]
        }
      }
    },
    Panel: Base64Panel
  },
  {
    manifest: {
      id: "url.encode",
      name: "URL 编码",
      summary: "处理 URL 编码与解码。",
      category: "encoding",
      keywords: ["url", "encode", "decode", "querystring"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "URL Encode",
          summary: "Encode and decode URLs.",
          category: "Encoding",
          keywords: ["url", "encode", "decode", "querystring"]
        },
        "zh-CN": {
          category: "编码",
          keywords: ["url", "编码", "解码", "querystring"]
        }
      }
    },
    Panel: UrlEncodePanel
  },
  {
    manifest: {
      id: "timestamp.convert",
      name: "时间转换",
      summary: "自动识别时间戳和日期时间并互相转换。",
      category: "time",
      keywords: ["timestamp", "unix", "date", "time"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Time Converter",
          summary: "Convert timestamps and datetime strings automatically.",
          category: "Time",
          keywords: ["timestamp", "unix", "date", "time"]
        },
        "zh-CN": {
          category: "时间",
          keywords: ["时间戳", "unix", "日期", "时间"]
        }
      }
    },
    Panel: TimestampPanel
  },
  {
    manifest: {
      id: "hash.digest",
      name: "哈希",
      summary: "一次生成 MD5、SHA、SM3 等常用哈希。",
      category: "security",
      keywords: ["hash", "sha", "digest", "checksum"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Hash",
          summary: "Generate MD5, SHA, and SM3 hashes in one run.",
          category: "Security",
          keywords: ["hash", "sha", "digest", "checksum"]
        },
        "zh-CN": {
          category: "安全",
          keywords: ["哈希", "sha", "摘要", "校验"]
        }
      }
    },
    Panel: HashPanel
  },
  {
    manifest: {
      id: "regex.playground",
      name: "正则表达式",
      summary: "测试正则匹配、捕获和替换效果。",
      category: "text",
      keywords: ["regex", "regexp", "replace", "match"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Regex",
          summary: "Test matching, captures, and replacement behavior.",
          category: "Text",
          keywords: ["regex", "regexp", "replace", "match"]
        },
        "zh-CN": {
          category: "文本",
          keywords: ["正则", "匹配", "替换", "表达式"]
        }
      }
    },
    Panel: RegexPanel
  },
  {
    manifest: {
      id: "qr.code",
      name: "二维码",
      summary: "本地生成或解析二维码，并支持导出。",
      category: "data",
      keywords: ["qr", "qrcode", "svg", "share"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "QR Code",
          summary: "Generate or parse QR codes locally and export them.",
          category: "Data",
          keywords: ["qr", "qrcode", "svg", "share"]
        },
        "zh-CN": {
          category: "数据",
          keywords: ["二维码", "qr", "svg", "导出"]
        }
      }
    },
    Panel: QrCodePanel
  },
  {
    manifest: {
      id: "text.diff",
      name: "文本对比",
      summary: "逐行或逐词比较两段文本差异。",
      category: "text",
      keywords: ["diff", "compare", "text", "patch"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Text Diff",
          summary: "Compare text by lines or words.",
          category: "Text",
          keywords: ["diff", "compare", "text", "patch"]
        },
        "zh-CN": {
          category: "文本",
          keywords: ["diff", "对比", "文本", "patch"]
        }
      }
    },
    Panel: TextDiffPanel
  },
  {
    manifest: {
      id: "color.convert",
      name: "颜色",
      summary: "解析并转换 HEX、RGB、HSL 颜色值。",
      category: "data",
      keywords: ["color", "hex", "rgb", "hsl"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Color",
          summary: "Parse and convert HEX, RGB, and HSL colors.",
          category: "Data",
          keywords: ["color", "hex", "rgb", "hsl"]
        },
        "zh-CN": {
          category: "数据",
          keywords: ["颜色", "hex", "rgb", "hsl"]
        }
      }
    },
    Panel: ColorPanel
  },
  {
    manifest: {
      id: "crontab.preview",
      name: "Crontab",
      summary: "解析 5 位 / 6 位 crontab，支持生成公式和预览执行时间。",
      category: "time",
      keywords: ["cron", "crontab", "schedule", "time"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Crontab",
          summary: "Parse 5/6-field cron expressions, generate formulas, and preview runs.",
          category: "Time",
          keywords: ["cron", "crontab", "schedule", "time"]
        },
        "zh-CN": {
          category: "时间",
          keywords: ["cron", "crontab", "定时", "调度"]
        }
      }
    },
    Panel: CrontabPanel
  },
  {
    manifest: {
      id: "sql.format",
      name: "SQL 格式化",
      summary: "格式化、压缩 SQL，并支持切换方言与大小写规则。",
      category: "data",
      keywords: ["sql", "format", "formatter", "dialect", "query"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "SQL Formatter",
          summary: "Format and minify SQL with dialect and casing controls.",
          category: "Data",
          keywords: ["sql", "format", "formatter", "dialect", "query"]
        },
        "zh-CN": {
          category: "数据",
          keywords: ["sql", "格式化", "压缩", "方言", "查询"]
        }
      }
    },
    Panel: SqlFormatPanel
  },
  {
    manifest: {
      id: "snowflake.generate",
      name: "雪花 ID",
      summary: "直接生成通用雪花 ID。",
      category: "data",
      keywords: ["snowflake", "id", "generator", "distributed"],
      platforms: ["web", "extension", "desktop"],
      localizations: {
        "en-US": {
          name: "Snowflake",
          summary: "Generate practical snowflake IDs with a common default setup.",
          category: "Data",
          keywords: ["snowflake", "id", "generator", "distributed"]
        },
        "zh-CN": {
          category: "数据",
          keywords: ["雪花", "id", "生成器", "分布式"]
        }
      }
    },
    Panel: SnowflakePanel
  }
];
