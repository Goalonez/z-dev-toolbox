import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

const readArg = (name, fallback) => {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
};

const version = readArg("--version");
const sourceDir = join(repoRoot, readArg("--source-dir", "release-assets/raw"));
const outputDir = join(repoRoot, readArg("--output-dir", "release-assets/final"));

if (!version) {
  console.error("缺少 --version 参数。");
  process.exit(1);
}

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

const pickDesktopSource = (platformKey, files) => {
  const preferenceMap = {
    macos: [/\.dmg$/iu],
    windows: [/-setup\.exe$/iu, /\.exe$/iu, /\.msi$/iu],
    linux: [/\.AppImage$/u, /\.deb$/iu, /\.rpm$/iu],
  };

  const matchers = preferenceMap[platformKey] ?? [];

  for (const matcher of matchers) {
    const matched = files.find((filePath) => matcher.test(filePath));

    if (matched) {
      return matched;
    }
  }

  return null;
};

const copyAsset = (sourceFile, targetFile) => {
  mkdirSync(outputDir, {
    recursive: true,
  });
  copyFileSync(sourceFile, join(outputDir, targetFile));
  console.log(`已整理资产: ${targetFile}`);
};

const allFiles = walkFiles(sourceDir);
const topLevelEntries = existsSync(sourceDir)
  ? readdirSync(sourceDir, {
      withFileTypes: true,
    })
  : [];

const extensionZip =
  allFiles.find((filePath) =>
    filePath.endsWith(`z-dev-toolbox-extension-v${version}.zip`),
  ) ?? allFiles.find((filePath) => filePath.endsWith(".zip"));

if (extensionZip) {
  copyAsset(extensionZip, `z-dev-toolbox-extension-v${version}.zip`);
}

for (const filePath of allFiles) {
  const fileName = basename(filePath);

  if (!fileName.startsWith("z-dev-toolbox-updater-")) {
    continue;
  }

  copyAsset(filePath, fileName);
}

for (const entry of topLevelEntries) {
  if (!entry.isDirectory() || !entry.name.startsWith("desktop-")) {
    continue;
  }

  const platformKey = entry.name.includes("macos")
    ? "macos"
    : entry.name.includes("windows")
      ? "windows"
      : entry.name.includes("linux")
        ? "linux"
        : null;

  if (!platformKey) {
    continue;
  }

  const files = walkFiles(join(sourceDir, entry.name));
  const sourceFile = pickDesktopSource(platformKey, files);

  if (!sourceFile) {
    continue;
  }

  copyAsset(
    sourceFile,
    `z-dev-toolbox-desktop-${platformKey}-v${version}${extname(sourceFile)}`,
  );
}

const finalFiles = walkFiles(outputDir);

if (finalFiles.length === 0) {
  console.log("没有需要整理的发布资产。");
} else {
  console.log(`发布资产整理完成，共 ${finalFiles.length} 个文件。`);
}
