import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const writeMode = process.argv.includes("--write");
const checkMode = process.argv.includes("--check") || !writeMode;

const readJson = (filePath) =>
  JSON.parse(readFileSync(join(repoRoot, filePath), "utf8"));

const writeJson = (filePath, value) => {
  writeFileSync(
    join(repoRoot, filePath),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
};

const rootPackage = readJson("package.json");
const rootVersion = rootPackage.version;

const workspacePackageFiles = [
  "apps/web/package.json",
  "apps/extension/package.json",
  "apps/desktop/package.json",
  "packages/app-shell/package.json",
  "packages/config/package.json",
  "packages/core/package.json",
  "packages/platform/package.json",
  "packages/shared/package.json",
  "packages/state/package.json",
  "packages/storage/package.json",
  "packages/tool-registry/package.json",
  "packages/ui/package.json",
];

const mismatches = [];
const updatedFiles = [];

for (const filePath of workspacePackageFiles) {
  const json = readJson(filePath);

  if (json.version === rootVersion) {
    continue;
  }

  mismatches.push(`${filePath}: ${json.version} -> ${rootVersion}`);

  if (writeMode) {
    json.version = rootVersion;
    writeJson(filePath, json);
    updatedFiles.push(filePath);
  }
}

const tauriConfigPath = "apps/desktop/src-tauri/tauri.conf.json";
const tauriConfig = readJson(tauriConfigPath);

if (tauriConfig.version !== rootVersion) {
  mismatches.push(`${tauriConfigPath}: ${tauriConfig.version} -> ${rootVersion}`);

  if (writeMode) {
    tauriConfig.version = rootVersion;
    writeJson(tauriConfigPath, tauriConfig);
    updatedFiles.push(tauriConfigPath);
  }
}

const cargoTomlPath = join(repoRoot, "apps/desktop/src-tauri/Cargo.toml");
const cargoToml = readFileSync(cargoTomlPath, "utf8");
const nextCargoToml = cargoToml.replace(
  /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/mu,
  `$1${rootVersion}$2`,
);

if (nextCargoToml !== cargoToml) {
  const currentVersionMatch = cargoToml.match(
    /(^\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/mu,
  );
  const currentVersion = currentVersionMatch?.[2] ?? "unknown";

  mismatches.push(
    `apps/desktop/src-tauri/Cargo.toml: ${currentVersion} -> ${rootVersion}`,
  );

  if (writeMode) {
    writeFileSync(cargoTomlPath, nextCargoToml, "utf8");
    updatedFiles.push("apps/desktop/src-tauri/Cargo.toml");
  }
}

if (mismatches.length === 0) {
  console.log(`版本已同步，当前版本 ${rootVersion}。`);
  process.exit(0);
}

if (checkMode && !writeMode) {
  console.error("发现版本不一致，请先执行 `pnpm sync:versions`：");
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  process.exit(1);
}

console.log(`已同步版本到 ${rootVersion}：`);
for (const filePath of updatedFiles) {
  console.log(`- ${filePath}`);
}
