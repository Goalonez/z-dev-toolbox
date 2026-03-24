import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
);
const version = packageJson.version;
const releaseRoot = process.env.Z_DEV_TOOLBOX_RELEASE_ROOT
  ? resolve(repoRoot, process.env.Z_DEV_TOOLBOX_RELEASE_ROOT)
  : join(repoRoot, "release", `v${version}`);
const cliArgs = process.argv.slice(2);
const replaceExisting = cliArgs.includes("--replace");
const positionalArgs = cliArgs.filter((arg) => arg !== "--replace");
const target = positionalArgs[0] ?? "all";
const archMap = {
  arm64: "aarch64",
  x64: "x64",
};
const arch = archMap[process.arch] ?? process.arch;

const releaseNames = {
  web: `z-dev-toolbox-web-v${version}`,
  extension: `z-dev-toolbox-extension-v${version}`,
};

const run = (command, args, cwd = repoRoot) => {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const ensureReleaseRoot = () => {
  mkdirSync(releaseRoot, {
    recursive: true,
  });
};

const prepareDestination = (path) => {
  if (!existsSync(path)) {
    return;
  }

  if (!replaceExisting) {
    throw new Error(`发布产物已存在，请先手动处理后再重试: ${path}`);
  }

  rmSync(path, {
    force: true,
    recursive: true,
  });
};

const copyDirectory = (source, destination) => {
  prepareDestination(destination);
  cpSync(source, destination, {
    recursive: true,
  });
};

const copyFile = (source, destination) => {
  prepareDestination(destination);
  cpSync(source, destination);
};

const zipDirectory = (directoryPath, zipPath, options = {}) => {
  const { keepParent = true } = options;
  prepareDestination(zipPath);

  if (process.platform === "darwin" && keepParent) {
    run("ditto", ["-c", "-k", "--norsrc", "--keepParent", directoryPath, zipPath]);
    return;
  }

  const zipInputs = keepParent ? [basename(directoryPath)] : readdirSync(directoryPath);

  if (zipInputs.length === 0) {
    throw new Error(`目录为空，无法生成压缩包: ${directoryPath}`);
  }

  // When keepParent is disabled, zip the directory contents directly so
  // extracting the archive yields extension files immediately.
  run(
    "zip",
    ["-rq", zipPath, ...zipInputs],
    keepParent ? dirname(directoryPath) : directoryPath,
  );
};

const findLatestMatchingFile = (directoryPath, matcher) => {
  const entries = readdirSync(directoryPath)
    .filter((entry) => matcher(entry))
    .map((entry) => ({
      entry,
      mtimeMs: statSync(join(directoryPath, entry)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (entries.length === 0) {
    throw new Error(`未找到符合条件的文件: ${directoryPath}`);
  }

  return join(directoryPath, entries[0].entry);
};

const packageWeb = () => {
  run("pnpm", ["build:web"]);

  const sourceDir = join(repoRoot, "apps", "web", "dist");
  const targetDir = join(releaseRoot, releaseNames.web);
  const targetZip = join(releaseRoot, `${releaseNames.web}.zip`);

  copyDirectory(sourceDir, targetDir);
  zipDirectory(targetDir, targetZip);
};

const packageExtension = () => {
  run("pnpm", ["--filter", "@z-dev-toolbox/extension", "build"]);

  const sourceDir = join(
    repoRoot,
    "apps",
    "extension",
    "build",
    "chrome-mv3-prod",
  );
  const targetDir = join(releaseRoot, releaseNames.extension);
  const targetZip = join(releaseRoot, `${releaseNames.extension}.zip`);

  copyDirectory(sourceDir, targetDir);
  zipDirectory(targetDir, targetZip, {
    keepParent: false,
  });
};

const packageDesktop = () => {
  const bundleConfigMap = {
    darwin: {
      bundle: "dmg",
      directory: "dmg",
      matcher: (entry) => entry.endsWith(".dmg"),
      platform: "macos",
    },
    linux: {
      bundle: "appimage",
      directory: "appimage",
      matcher: (entry) => entry.endsWith(".AppImage"),
      platform: "linux",
    },
    win32: {
      bundle: "nsis",
      directory: "nsis",
      matcher: (entry) => /-setup\.exe$/iu.test(entry) || entry.endsWith(".exe"),
      platform: "windows",
    },
  };

  const bundleConfig = bundleConfigMap[process.platform];

  if (!bundleConfig) {
    throw new Error("当前平台暂不支持桌面端本地打包。");
  }

  run("pnpm", [
    "--filter",
    "@z-dev-toolbox/desktop",
    "exec",
    "tauri",
    "build",
    "--bundles",
    bundleConfig.bundle,
  ]);

  const dmgDir = join(
    repoRoot,
    "apps",
    "desktop",
    "src-tauri",
    "target",
    "release",
    "bundle",
    bundleConfig.directory,
  );
  const sourceFile = findLatestMatchingFile(dmgDir, bundleConfig.matcher);
  const targetFile = join(
    releaseRoot,
    `z-dev-toolbox-desktop-${bundleConfig.platform}-${arch}-v${version}${extname(sourceFile)}`,
  );

  copyFile(sourceFile, targetFile);
};

const handlers = {
  all: [packageWeb, packageExtension, packageDesktop],
  web: [packageWeb],
  extension: [packageExtension],
  desktop: [packageDesktop],
};

if (positionalArgs.length > 1) {
  console.error(`参数过多，仅支持一个打包目标: ${positionalArgs.join(" ")}`);
  process.exit(1);
}

const unknownFlags = cliArgs.filter(
  (arg) => arg.startsWith("-") && arg !== "--replace",
);

if (unknownFlags.length > 0) {
  console.error(`不支持的参数: ${unknownFlags.join(", ")}`);
  process.exit(1);
}

if (!(target in handlers)) {
  console.error(`不支持的打包目标: ${target}`);
  process.exit(1);
}

ensureReleaseRoot();

for (const handler of handlers[target]) {
  handler();
}

console.log(`发布产物已生成: ${releaseRoot}`);
