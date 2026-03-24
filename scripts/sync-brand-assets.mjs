import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");
const legacySourcePath = join(repoRoot, "logo.png");
const brandingDir = join(repoRoot, "assets", "branding");
const sourcePath = join(brandingDir, "logo-source.png");
const cropSize = 1600;
const extensionIconSize = 512;
const desktopCornerRadius = 360;
const desktopOuterInset = 128;
const require = createRequire(import.meta.url);

const loadSharp = () => {
  try {
    return require("sharp");
  } catch {
    const pnpmDir = join(repoRoot, "node_modules", ".pnpm");
    const sharpPackageDir = readdirSync(pnpmDir).find((entry) =>
      entry.startsWith("sharp@"),
    );

    if (!sharpPackageDir) {
      throw new Error("未找到 sharp，无法生成品牌图标。");
    }

    return require(join(pnpmDir, sharpPackageDir, "node_modules", "sharp"));
  }
};

const sharp = loadSharp();

const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status === 0) {
    return;
  }

  const details = [result.stdout, result.stderr].filter(Boolean).join("\n");

  throw new Error(
    `命令执行失败: ${command} ${args.join(" ")}\n${details}`.trim(),
  );
};

const ensureDir = (directoryPath) => {
  mkdirSync(directoryPath, { recursive: true });
};

const migrateSourceLogo = () => {
  ensureDir(brandingDir);

  if (!existsSync(sourcePath) && existsSync(legacySourcePath)) {
    renameSync(legacySourcePath, sourcePath);
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`未找到品牌源图：${sourcePath}`);
  }
};

const generatePng = async (input, size, outputPath) => {
  ensureDir(dirname(outputPath));
  await sharp(input)
    .resize(size, size, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .png()
    .toFile(outputPath);
};

const createIconMaster = async () => {
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width ?? cropSize;
  const height = metadata.height ?? cropSize;
  const effectiveCropSize = Math.min(cropSize, width, height);
  const left = Math.floor((width - effectiveCropSize) / 2);
  const top = Math.floor((height - effectiveCropSize) / 2);

  return sharp(sourcePath)
    .extract({
      left,
      top,
      width: effectiveCropSize,
      height: effectiveCropSize,
    })
    .ensureAlpha()
    .png()
    .toBuffer();
};

const createDesktopIconMaster = async (masterIconBuffer) => {
  const roundedRectMask = Buffer.from(
    `<svg width="${cropSize}" height="${cropSize}" viewBox="0 0 ${cropSize} ${cropSize}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${cropSize}" height="${cropSize}" rx="${desktopCornerRadius}" ry="${desktopCornerRadius}" fill="white" />
    </svg>`,
  );
  const glossOverlay = Buffer.from(
    `<svg width="${cropSize}" height="${cropSize}" viewBox="0 0 ${cropSize} ${cropSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.24)" />
          <stop offset="42%" stop-color="rgba(255,255,255,0.06)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect
        x="10"
        y="10"
        width="${cropSize - 20}"
        height="${cropSize - 20}"
        rx="${desktopCornerRadius - 10}"
        ry="${desktopCornerRadius - 10}"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        stroke-width="18"
      />
      <rect
        width="${cropSize}"
        height="${Math.round(cropSize * 0.58)}"
        rx="${desktopCornerRadius}"
        ry="${desktopCornerRadius}"
        fill="url(#gloss)"
      />
    </svg>`,
  );

  const roundedBuffer = await sharp(masterIconBuffer)
    .composite([{ input: roundedRectMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const glossyCardBuffer = await sharp(roundedBuffer)
    .composite([{ input: glossOverlay, blend: "over" }])
    .png()
    .toBuffer();

  const cardSize = cropSize - desktopOuterInset * 2;
  const cardOffset = desktopOuterInset;

  return sharp({
    create: {
      width: cropSize,
      height: cropSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(glossyCardBuffer)
          .resize(cardSize, cardSize, {
            fit: "fill",
            kernel: sharp.kernel.lanczos3,
          })
          .png()
          .toBuffer(),
        left: cardOffset,
        top: cardOffset,
      },
    ])
    .png()
    .toBuffer();
};

const createIco = (pngFiles, outputPath) => {
  const count = pngFiles.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  const payloads = [];
  let offset = 6 + count * 16;

  for (const { size, path } of pngFiles) {
    const data = readFileSync(path);
    const entry = Buffer.alloc(16);

    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);

    entries.push(entry);
    payloads.push(data);
    offset += data.length;
  }

  writeFileSync(outputPath, Buffer.concat([header, ...entries, ...payloads]));
};

const generateWebIcons = async (masterIconBuffer, tempDir) => {
  const webPublicDir = join(repoRoot, "apps", "web", "public");

  ensureDir(webPublicDir);

  const favicon16Path = join(tempDir, "favicon-16x16.png");
  const favicon32Path = join(tempDir, "favicon-32x32.png");
  const favicon48Path = join(tempDir, "favicon-48x48.png");

  await Promise.all([
    generatePng(masterIconBuffer, 16, favicon16Path),
    generatePng(masterIconBuffer, 32, favicon32Path),
    generatePng(masterIconBuffer, 48, favicon48Path),
    generatePng(
      masterIconBuffer,
      180,
      join(webPublicDir, "apple-touch-icon.png"),
    ),
    generatePng(
      masterIconBuffer,
      16,
      join(webPublicDir, "favicon-16x16.png"),
    ),
    generatePng(
      masterIconBuffer,
      32,
      join(webPublicDir, "favicon-32x32.png"),
    ),
  ]);

  createIco(
    [
      { size: 16, path: favicon16Path },
      { size: 32, path: favicon32Path },
      { size: 48, path: favicon48Path },
    ],
    join(webPublicDir, "favicon.ico"),
  );
};

const generateExtensionIcons = async (masterIconBuffer) => {
  const extensionAssetsDir = join(repoRoot, "apps", "extension", "assets");

  await Promise.all([
    generatePng(
      masterIconBuffer,
      extensionIconSize,
      join(extensionAssetsDir, "icon.png"),
    ),
    generatePng(
      masterIconBuffer,
      extensionIconSize,
      join(extensionAssetsDir, "icon.development.png"),
    ),
  ]);
};

const syncExtensionDevCacheIcons = async (masterIconBuffer) => {
  const genAssetsDir = join(repoRoot, "apps", "extension", ".plasmo", "gen-assets");

  if (!existsSync(genAssetsDir)) {
    return;
  }

  const extensionDevSizes = [16, 32, 48, 64, 128];

  await Promise.all(
    extensionDevSizes.map((size) =>
      generatePng(
        masterIconBuffer,
        size,
        join(genAssetsDir, `icon${size}.plasmo.png`),
      ),
    ),
  );
};

const generateDesktopPngIcons = async (masterIconBuffer) => {
  const desktopIconsDir = join(repoRoot, "apps", "desktop", "src-tauri", "icons");

  const desktopIcons = [
    ["32x32.png", 32],
    ["64x64.png", 64],
    ["128x128.png", 128],
    ["128x128@2x.png", 256],
    ["icon.png", 512],
    ["StoreLogo.png", 50],
    ["Square30x30Logo.png", 30],
    ["Square44x44Logo.png", 44],
    ["Square71x71Logo.png", 71],
    ["Square89x89Logo.png", 89],
    ["Square107x107Logo.png", 107],
    ["Square142x142Logo.png", 142],
    ["Square150x150Logo.png", 150],
    ["Square284x284Logo.png", 284],
    ["Square310x310Logo.png", 310],
  ];

  await Promise.all(
    desktopIcons.map(([fileName, size]) =>
      generatePng(masterIconBuffer, size, join(desktopIconsDir, fileName)),
    ),
  );
};

const generateDesktopIco = async (masterIconBuffer, tempDir) => {
  const icoDir = join(tempDir, "ico");
  const icoOutputPath = join(repoRoot, "apps", "desktop", "src-tauri", "icons", "icon.ico");
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];

  ensureDir(icoDir);

  const pngFiles = icoSizes.map((size) => {
    const filePath = join(icoDir, `${size}.png`);
    return { size, path: filePath };
  });

  await Promise.all(
    pngFiles.map(({ size, path }) => generatePng(masterIconBuffer, size, path)),
  );

  createIco(pngFiles, icoOutputPath);
};

const generateDesktopIcns = async (masterIconBuffer, tempDir) => {
  const icnsDir = join(tempDir, "icns");
  const tiffOutputPath = join(icnsDir, "icon.tiff");
  const icnsOutputPath = join(repoRoot, "apps", "desktop", "src-tauri", "icons", "icon.icns");
  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];

  ensureDir(icnsDir);

  const icnsPngPaths = icnsSizes.map((size) => {
    const pngPath = join(icnsDir, `${size}.png`);
    return pngPath;
  });
  await Promise.all(
    icnsSizes.map((size, index) =>
      generatePng(masterIconBuffer, size, icnsPngPaths[index]),
    ),
  );

  run("tiffutil", ["-cat", ...icnsPngPaths, "-out", tiffOutputPath]);
  run("tiff2icns", [tiffOutputPath, icnsOutputPath]);
};

const generateDesktopMobileIcons = async (masterIconBuffer) => {
  const androidTargets = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ];
  const androidFileNames = [
    "ic_launcher.png",
    "ic_launcher_round.png",
    "ic_launcher_foreground.png",
  ];

  await Promise.all(
    androidTargets.flatMap(([directoryName, size]) =>
      androidFileNames.map((fileName) =>
        generatePng(
          masterIconBuffer,
          size,
          join(
            repoRoot,
            "apps",
            "desktop",
            "src-tauri",
            "icons",
            "android",
            directoryName,
            fileName,
          ),
        ),
      ),
    ),
  );

  const iosTargets = [
    ["AppIcon-20x20@1x.png", 20],
    ["AppIcon-20x20@2x.png", 40],
    ["AppIcon-20x20@2x-1.png", 40],
    ["AppIcon-20x20@3x.png", 60],
    ["AppIcon-29x29@1x.png", 29],
    ["AppIcon-29x29@2x.png", 58],
    ["AppIcon-29x29@2x-1.png", 58],
    ["AppIcon-29x29@3x.png", 87],
    ["AppIcon-40x40@1x.png", 40],
    ["AppIcon-40x40@2x.png", 80],
    ["AppIcon-40x40@2x-1.png", 80],
    ["AppIcon-40x40@3x.png", 120],
    ["AppIcon-60x60@2x.png", 120],
    ["AppIcon-60x60@3x.png", 180],
    ["AppIcon-76x76@1x.png", 76],
    ["AppIcon-76x76@2x.png", 152],
    ["AppIcon-83.5x83.5@2x.png", 167],
    ["AppIcon-512@2x.png", 1024],
  ];

  await Promise.all(
    iosTargets.map(([fileName, size]) =>
      generatePng(
        masterIconBuffer,
        size,
        join(repoRoot, "apps", "desktop", "src-tauri", "icons", "ios", fileName),
      ),
    ),
  );
};

const main = async () => {
  migrateSourceLogo();

  const tempDir = mkdtempSync(join(tmpdir(), "z-dev-toolbox-brand-"));

  try {
    const masterIconBuffer = await createIconMaster();
    const desktopIconBuffer = await createDesktopIconMaster(masterIconBuffer);

    await generateWebIcons(masterIconBuffer, tempDir);
    await generateExtensionIcons(masterIconBuffer);
    await syncExtensionDevCacheIcons(masterIconBuffer);
    await generateDesktopPngIcons(desktopIconBuffer);
    await generateDesktopIco(desktopIconBuffer, tempDir);
    await generateDesktopIcns(desktopIconBuffer, tempDir);
    await generateDesktopMobileIcons(masterIconBuffer);

    console.log("已同步品牌图标资源。");
    console.log(`源图位置：${sourcePath}`);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

await main();
