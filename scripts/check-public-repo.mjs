import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

const BLOCKED_PATH_RULES = [
  {
    pattern: /(^|\/)AGENTS\.md$/u,
    reason: "AI 协作说明文件不应进入开源仓库。",
  },
  {
    pattern: /(^|\/)CLAUDE\.md$/u,
    reason: "AI 协作说明文件不应进入开源仓库。",
  },
  {
    pattern: /(^|\/)\.idea\//u,
    reason: "IDE 本地配置不应进入仓库。",
  },
  {
    pattern: /(^|\/)\.vscode\//u,
    reason: "IDE 本地配置不应进入仓库。",
  },
  {
    pattern: /(^|\/)\.pnpm-store\//u,
    reason: "pnpm 本地缓存不应进入仓库。",
  },
  {
    pattern: /(^|\/)\.turbo\//u,
    reason: "Turbo 本地缓存不应进入仓库。",
  },
  {
    pattern: /(^|\/)node_modules\//u,
    reason: "依赖目录不应进入仓库。",
  },
  {
    pattern: /(^|\/)\.DS_Store$/u,
    reason: "macOS 本地文件不应进入仓库。",
  },
  {
    pattern: /^apps\/web\/dist\//u,
    reason: "Web 构建产物不应进入仓库。",
  },
  {
    pattern: /^apps\/extension\/build\//u,
    reason: "插件构建产物不应进入仓库。",
  },
  {
    pattern: /^apps\/extension\/\.plasmo\//u,
    reason: "Plasmo 生成目录不应进入仓库。",
  },
  {
    pattern: /^apps\/desktop\/dist\//u,
    reason: "桌面端前端构建产物不应进入仓库。",
  },
  {
    pattern: /^apps\/desktop\/src-tauri\/target\//u,
    reason: "Tauri/Rust 构建产物不应进入仓库。",
  },
  {
    pattern: /^release\//u,
    reason: "本地发布产物不应进入仓库。",
  },
  {
    pattern: /(^|\/)\.env(?:\.[^/]+)?$/u,
    reason: "环境变量文件不应直接进入仓库。",
    allow: (filePath) =>
      /(^|\/)\.env\.(example|sample|template)$/u.test(filePath),
  },
  {
    pattern: /\.(pem|key|crt|p12|mobileprovision|jks|keystore)$/iu,
    reason: "证书、密钥和签名文件不应进入仓库。",
  },
];

const CONTENT_RULES = [
  {
    pattern: /ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}/u,
    reason: "疑似 GitHub Token。",
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/u,
    reason: "疑似 AWS Access Key。",
  },
  {
    pattern: /AIza[0-9A-Za-z\-_]{20,}/u,
    reason: "疑似 Google API Key。",
  },
  {
    pattern: /sk-[A-Za-z0-9]{20,}/u,
    reason: "疑似通用 API Secret。",
  },
  {
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/u,
    reason: "疑似 Slack Token。",
  },
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
    reason: "疑似私钥内容。",
  },
  {
    pattern:
      /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s"'`]+/u,
    reason: "疑似数据库连接串。",
  },
  {
    pattern: /(?:^|[\s"'`])(TOKEN|SECRET|PASSWORD)\s*=\s*.+/mu,
    reason: "疑似明文敏感配置。",
  },
  {
    pattern: /\/Users\/[^\s"'`]+|[A-Za-z]:\\Users\\[^\s"'`]+/u,
    reason: "疑似本机绝对路径。",
  },
];

const LARGE_FILE_LIMIT = 2 * 1024 * 1024;
const LARGE_FILE_ALLOWLIST = new Set(["assets/branding/logo-source.png"]);

const runGit = (args) => {
  const output = execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return output
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const listCandidatePaths = () => {
  const tracked = runGit(["ls-files", "-z"]);
  const others = runGit(["ls-files", "--others", "--exclude-standard", "-z"]);

  return [...new Set([...tracked, ...others])].sort();
};

const isTextBuffer = (buffer) => !buffer.includes(0);

const candidatePaths = listCandidatePaths();
const blockedFindings = [];
const largeFileFindings = [];
const contentFindings = [];

for (const filePath of candidatePaths) {
  const matchedPathRule = BLOCKED_PATH_RULES.find(
    (rule) => rule.pattern.test(filePath) && !rule.allow?.(filePath),
  );

  if (matchedPathRule) {
    blockedFindings.push(`${filePath}: ${matchedPathRule.reason}`);
    continue;
  }

  const absolutePath = join(repoRoot, filePath);
  const stats = statSync(absolutePath);

  if (
    stats.size > LARGE_FILE_LIMIT &&
    !LARGE_FILE_ALLOWLIST.has(filePath)
  ) {
    largeFileFindings.push(
      `${filePath}: 文件大小 ${Math.ceil(stats.size / 1024 / 1024)} MB，超出审计阈值 2 MB。`,
    );
  }

  if (!stats.isFile() || stats.size === 0) {
    continue;
  }

  const buffer = readFileSync(absolutePath);

  if (!isTextBuffer(buffer)) {
    continue;
  }

  const content = buffer.toString("utf8");
  const matchedContentRule = CONTENT_RULES.find((rule) =>
    rule.pattern.test(content),
  );

  if (matchedContentRule) {
    contentFindings.push(`${filePath}: ${matchedContentRule.reason}`);
  }
}

if (
  blockedFindings.length === 0 &&
  largeFileFindings.length === 0 &&
  contentFindings.length === 0
) {
  console.log("仓库公开化审计通过。");
  process.exit(0);
}

console.error("仓库公开化审计未通过。");

if (blockedFindings.length > 0) {
  console.error("\n[禁止入库的文件或路径]");
  for (const finding of blockedFindings) {
    console.error(`- ${finding}`);
  }
}

if (largeFileFindings.length > 0) {
  console.error("\n[超大文件]");
  for (const finding of largeFileFindings) {
    console.error(`- ${finding}`);
  }
}

if (contentFindings.length > 0) {
  console.error("\n[疑似敏感内容]");
  for (const finding of contentFindings) {
    console.error(`- ${finding}`);
  }
}

process.exit(1);
