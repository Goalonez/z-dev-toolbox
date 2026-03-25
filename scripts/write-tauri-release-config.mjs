import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

const pubkey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
const outputFile = resolve(
  repoRoot,
  readArg("--output-file", "apps/desktop/src-tauri/tauri.release.conf.json"),
);

if (!pubkey) {
  console.error("缺少环境变量 TAURI_UPDATER_PUBLIC_KEY。");
  process.exit(1);
}

const config = {
  bundle: {
    createUpdaterArtifacts: true,
  },
  plugins: {
    updater: {
      pubkey,
    },
  },
};

mkdirSync(dirname(outputFile), {
  recursive: true,
});
writeFileSync(outputFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`已生成 Tauri release 配置: ${outputFile}`);
