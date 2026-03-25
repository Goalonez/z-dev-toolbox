/* global console, process */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

const readArg = (name, fallback) => {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const walkFiles = (directoryPath) => {
  if (!existsSync(directoryPath)) {
    return [];
  }

  const entries = readdirSync(directoryPath, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }

    files.push(absolutePath);
  }

  return files;
};

const version = readArg("--version");
const tag = readArg("--tag");
const repo = readArg("--repo");
const inputDir = resolve(
  repoRoot,
  readArg("--input-dir", "release-assets/final"),
);
const outputFile = resolve(
  repoRoot,
  readArg("--output-file", "release-assets/final/latest.json"),
);
const notesFile = resolve(
  repoRoot,
  readArg("--notes-file", `release-notes/${tag ?? ""}.md`),
);

if (!version || !tag || !repo) {
  console.error("缺少必要参数：--version、--tag、--repo。");
  process.exit(1);
}

if (!existsSync(notesFile)) {
  console.error(`release notes 文件不存在: ${notesFile}`);
  process.exit(1);
}

const bundleTypeByPlatform = {
  macos: "app",
  windows: "nsis",
  linux: "appimage",
};

const osKeyByPlatform = {
  macos: "darwin",
  windows: "windows",
  linux: "linux",
};

const updaterPattern = new RegExp(
  `^z-dev-toolbox-updater-(macos|windows|linux)-([a-z0-9_]+)-v${escapeRegExp(version)}(\\.app\\.tar\\.gz|\\.exe|\\.AppImage)(\\.sig)?$`,
  "iu",
);

const desktopPattern = new RegExp(
  `^z-dev-toolbox-desktop-(macos|windows|linux)-v${escapeRegExp(version)}(\\.dmg|\\.exe|\\.AppImage)$`,
  "iu",
);

const files = walkFiles(inputDir);
const platforms = new Map();

for (const filePath of files) {
  const fileName = basename(filePath);
  const match = fileName.match(updaterPattern);

  if (!match) {
    continue;
  }

  const [, platformKey, arch, , signatureSuffix] = match;
  const key = `${platformKey}:${arch}`;
  const current = platforms.get(key) ?? {
    platformKey,
    arch,
    asset: null,
    signature: null,
  };

  if (signatureSuffix) {
    current.signature = filePath;
  } else {
    current.asset = filePath;
  }

  platforms.set(key, current);
}

for (const filePath of files) {
  const fileName = basename(filePath);
  const match = fileName.match(desktopPattern);

  if (!match) {
    continue;
  }

  const [, platformKey] = match;

  if (platformKey === "macos") {
    continue;
  }

  for (const entry of platforms.values()) {
    if (entry.platformKey !== platformKey || entry.asset) {
      continue;
    }

    entry.asset = filePath;
  }
}

if (platforms.size === 0) {
  console.error("未找到 updater 产物，无法生成 latest.json。");
  process.exit(1);
}

const notes = readFileSync(notesFile, "utf8").trim();
const versionContent = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {},
};

for (const entry of platforms.values()) {
  if (!entry.asset || !entry.signature) {
    console.error(
      `updater 产物不完整: ${entry.platformKey}/${entry.arch} 缺少安装包或签名文件。`,
    );
    process.exit(1);
  }

  const osKey = osKeyByPlatform[entry.platformKey];
  const bundleType = bundleTypeByPlatform[entry.platformKey];
  const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${basename(entry.asset)}`;
  const signature = readFileSync(entry.signature, "utf8").trim();

  versionContent.platforms[`${osKey}-${entry.arch}`] = {
    signature,
    url,
  };
  versionContent.platforms[`${osKey}-${entry.arch}-${bundleType}`] = {
    signature,
    url,
  };
}

mkdirSync(dirname(outputFile), {
  recursive: true,
});
writeFileSync(outputFile, JSON.stringify(versionContent, null, 2));
console.log(`已生成 updater 清单: ${outputFile}`);
