/* global console, process */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
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

const getNamePreference = (filePath) => {
  const fileName = basename(filePath);

  if (fileName.startsWith("Z Dev Toolbox")) {
    return 0;
  }

  if (fileName.startsWith("z-dev-toolbox")) {
    return 1;
  }

  return 2;
};

const compareCandidates = (left, right) => {
  const preferenceDiff = getNamePreference(left) - getNamePreference(right);

  if (preferenceDiff !== 0) {
    return preferenceDiff;
  }

  return basename(left).localeCompare(basename(right));
};

const pickFile = (files, matchers) => {
  const sortedFiles = [...files].sort(compareCandidates);

  for (const matcher of matchers) {
    const matched = sortedFiles.find((filePath) => matcher.test(basename(filePath)));

    if (matched) {
      return matched;
    }
  }

  return null;
};

const mapArch = (value) => {
  const normalized = value.toLowerCase();

  if (["x64", "x86_64", "amd64"].includes(normalized)) {
    return "x86_64";
  }

  if (["arm64", "aarch64"].includes(normalized)) {
    return "aarch64";
  }

  if (["ia32", "x86", "i686"].includes(normalized)) {
    return "i686";
  }

  if (["arm", "armv7", "armhf"].includes(normalized)) {
    return "armv7";
  }

  return null;
};

const inferTargetArch = (filePaths) => {
  for (const filePath of filePaths) {
    if (!filePath) {
      continue;
    }

    const fileName = basename(filePath);
    const match = fileName.match(/(?:^|[_\-. ])(aarch64|arm64|x86_64|amd64|x64|i686|ia32|armv7|armhf)(?:[_\-. ]|$)/iu);
    const mapped = match?.[1] ? mapArch(match[1]) : null;

    if (mapped) {
      return mapped;
    }
  }

  return mapArch(process.arch);
};

const getOutputExtension = (filePath) => {
  const fileName = basename(filePath);

  if (fileName.endsWith(".app.tar.gz")) {
    return ".app.tar.gz";
  }

  return extname(fileName);
};

const copyAsset = (sourceFile, targetFile) => {
  const outputFile = resolve(repoRoot, targetFile);
  mkdirSync(dirname(outputFile), {
    recursive: true,
  });
  copyFileSync(sourceFile, outputFile);
  console.log(`已准备发布资产: ${targetFile}`);
};

const describeFiles = (files) =>
  files.length === 0
    ? "  (none)"
    : files
        .sort(compareCandidates)
        .map((filePath) => `  - ${filePath}`)
        .join("\n");

const platformConfigs = {
  "macos-latest": {
    platformKey: "macos",
    sourceDirPattern: /[\\/]dmg[\\/]/iu,
    sourceMatchers: [/\.dmg$/iu],
    updaterDirPattern: /[\\/]macos[\\/]/iu,
    updaterMatchers: [/\.app\.tar\.gz$/iu],
  },
  "windows-latest": {
    platformKey: "windows",
    sourceDirPattern: /[\\/]nsis[\\/]/iu,
    sourceMatchers: [/-setup\.exe$/iu, /\.exe$/iu, /\.msi$/iu],
    updaterFromSource: true,
  },
  "ubuntu-22.04": {
    platformKey: "linux",
    sourceDirPattern: /[\\/]appimage[\\/]/u,
    sourceMatchers: [/\.AppImage$/u],
    updaterFromSource: true,
  },
};

const runner = readArg("--runner");
const version = readArg("--version");
const bundleDir = resolve(
  repoRoot,
  readArg("--bundle-dir", "apps/desktop/src-tauri/target/release/bundle"),
);
const outputRoot = readArg("--output-dir", "release-assets");

if (!runner || !version) {
  console.error("缺少必要参数：--runner、--version。");
  process.exit(1);
}

const platformConfig = platformConfigs[runner];

if (!platformConfig) {
  console.error(`不支持的 runner: ${runner}`);
  process.exit(1);
}

const allFiles = walkFiles(bundleDir);
const sourceFiles = allFiles.filter((filePath) =>
  platformConfig.sourceDirPattern.test(filePath),
);
const sourceFile = pickFile(sourceFiles, platformConfig.sourceMatchers);

if (!sourceFile) {
  console.error(
    [
      `未找到 ${platformConfig.platformKey} 的桌面安装包。`,
      "候选文件：",
      describeFiles(sourceFiles),
    ].join("\n"),
  );
  process.exit(1);
}

let updaterFile = null;

if (platformConfig.updaterFromSource) {
  updaterFile = sourceFile;
} else {
  const updaterFiles = allFiles.filter((filePath) =>
    platformConfig.updaterDirPattern.test(filePath),
  );

  updaterFile = pickFile(updaterFiles, platformConfig.updaterMatchers);

  if (!updaterFile) {
    console.error(
      [
        `未找到 ${platformConfig.platformKey} 的 updater 安装包。`,
        "候选文件：",
        describeFiles(updaterFiles),
      ].join("\n"),
    );
    process.exit(1);
  }
}

const updaterSignature = `${updaterFile}.sig`;

if (!existsSync(updaterSignature)) {
  console.error(
    [
      `未找到 ${platformConfig.platformKey} 的 updater 签名文件。`,
      `期待路径: ${updaterSignature}`,
      "bundle 目录文件：",
      describeFiles(allFiles),
    ].join("\n"),
  );
  process.exit(1);
}

const targetArch = inferTargetArch([sourceFile, updaterFile]);

if (!targetArch) {
  console.error(
    `无法从产物文件名或当前架构推断 ${platformConfig.platformKey} 的目标架构。`,
  );
  process.exit(1);
}

const outputDir = `${outputRoot}/desktop-${platformConfig.platformKey}`;
const desktopExtension = getOutputExtension(sourceFile);
const updaterExtension = getOutputExtension(updaterFile);

copyAsset(
  sourceFile,
  `${outputDir}/z-dev-toolbox-desktop-${platformConfig.platformKey}-v${version}${desktopExtension}`,
);
copyAsset(
  updaterFile,
  `${outputDir}/z-dev-toolbox-updater-${platformConfig.platformKey}-${targetArch}-v${version}${updaterExtension}`,
);
copyAsset(
  updaterSignature,
  `${outputDir}/z-dev-toolbox-updater-${platformConfig.platformKey}-${targetArch}-v${version}${updaterExtension}.sig`,
);
