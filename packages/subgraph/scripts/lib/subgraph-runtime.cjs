const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");
const { spawnSync } = require("node:child_process");

const MATCHSTICK_DEFAULT_VERSION = "0.6.0";
const MATCHSTICK_GITHUB_BASE_URL =
  "https://github.com/LimeChain/matchstick/releases/download";

function getSubgraphRoot() {
  return path.resolve(__dirname, "..", "..");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureRuntimeLayout(rootDir) {
  const runtimeDir = path.join(rootDir, ".runtime");
  const cacheDir = path.join(runtimeDir, "cache");
  const homeDir = path.join(runtimeDir, "home");
  const tmpDir = path.join(runtimeDir, "tmp");
  const toolsDir = path.join(runtimeDir, "tools");

  ensureDir(runtimeDir);
  ensureDir(cacheDir);
  ensureDir(homeDir);
  ensureDir(tmpDir);
  ensureDir(toolsDir);

  return {
    runtimeDir,
    cacheDir,
    homeDir,
    tmpDir,
    toolsDir,
  };
}

function createRuntimeEnv(layout, overrides = {}) {
  return {
    ...process.env,
    HOME: layout.homeDir,
    XDG_CACHE_HOME: layout.cacheDir,
    TMPDIR: layout.tmpDir,
    TMP: layout.tmpDir,
    TEMP: layout.tmpDir,
    NO_UPDATE_NOTIFIER: "1",
    ...overrides,
  };
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function resolveGraphCliRunEntry(rootDir) {
  return require.resolve("@graphprotocol/graph-cli/bin/run", {
    paths: [rootDir],
  });
}

function resolveGraphAbiCodegenFile(rootDir) {
  return require.resolve(
    "@graphprotocol/graph-cli/dist/protocols/ethereum/codegen/abi.js",
    { paths: [rootDir] },
  );
}

function ensureGraphCliCodegenPatched(rootDir) {
  const abiCodegenFile = resolveGraphAbiCodegenFile(rootDir);
  const content = fs.readFileSync(abiCodegenFile, "utf8");

  const hasLegacyImport = content.includes(
    'const sync_request_1 = __importDefault(require("sync-request"));',
  );
  const hasLegacyUsage = content.includes(
    "const resp = (0, sync_request_1.default)('GET', url);",
  );

  if (!hasLegacyImport && !hasLegacyUsage) {
    return;
  }

  const patched = content
    .replace(
      'const sync_request_1 = __importDefault(require("sync-request"));',
      "",
    )
    .replace(
      "const resp = (0, sync_request_1.default)('GET', url);",
      "const syncRequest = require('sync-request');\n                const resp = syncRequest('GET', url);",
    );

  if (patched === content) {
    throw new Error(
      "Unable to apply Graph CLI runtime patch for sync-request lazy loading.",
    );
  }

  fs.writeFileSync(abiCodegenFile, patched);
  process.stdout.write(
    "[subgraph] Applied Graph CLI runtime patch to avoid sync-rpc bind failures.\n",
  );
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
}

function isTransientNetworkError(output) {
  return /(ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up|429|503|502|504|fetch failed|network)/i.test(
    output,
  );
}

function isSyncRpcBindError(output) {
  return /listen EPERM: operation not permitted 0\.0\.0\.0/i.test(output) &&
    /sync-rpc/i.test(output);
}

function runCommandWithRetries(command, args, options = {}) {
  const attempts = options.attempts ?? 1;
  let lastResult = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = runCommand(command, args, options);
    lastResult = result;

    if ((result.status ?? 1) === 0) {
      return result;
    }

    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    const retryable = isTransientNetworkError(output);

    if (isSyncRpcBindError(output)) {
      process.stderr.write(
        "[subgraph] Graph CLI failed with sync-rpc EPERM bind. Ensure pnpm patchedDependencies are applied by running `pnpm install`.\n",
      );
      return result;
    }

    if (attempt < attempts && retryable) {
      process.stderr.write(
        `[subgraph] Command failed (attempt ${attempt}/${attempts}), retrying due to transient network error.\n`,
      );
      continue;
    }

    return result;
  }

  return lastResult;
}

function runGraphCli(args, options = {}) {
  const rootDir = options.rootDir || getSubgraphRoot();
  const layout = ensureRuntimeLayout(rootDir);
  const env = createRuntimeEnv(layout, options.env || {});
  ensureGraphCliCodegenPatched(rootDir);

  const entrypoint = resolveGraphCliRunEntry(rootDir);
  return runCommandWithRetries(process.execPath, [entrypoint, ...args], {
    cwd: rootDir,
    env,
    attempts: options.attempts ?? 1,
  });
}

function collectFilesByPattern(rootDir, filePattern) {
  const results = [];

  if (!fs.existsSync(rootDir)) {
    return results;
  }

  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && filePattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function detectMatchstickPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "darwin") {
    if (arch === "arm64") {
      return "binary-macos-12-m1";
    }
    if (arch === "x64") {
      return "binary-macos-12";
    }
  }

  if (platform === "linux") {
    const osReleasePath = "/etc/os-release";
    let majorVersion = 22;
    if (fs.existsSync(osReleasePath)) {
      const osRelease = fs.readFileSync(osReleasePath, "utf8");
      const match = osRelease.match(/^VERSION_ID="?(\d+)/m);
      if (match && match[1]) {
        majorVersion = Number.parseInt(match[1], 10);
      }
    }

    if (majorVersion >= 22) {
      return "binary-linux-22";
    }
    if (majorVersion >= 20) {
      return "binary-linux-20";
    }
    return "binary-linux-18";
  }

  throw new Error(
    `Unsupported platform for Matchstick binary: ${platform} ${arch}`,
  );
}

function getMatchstickVersion() {
  return process.env.MATCHSTICK_VERSION || MATCHSTICK_DEFAULT_VERSION;
}

function getMatchstickBinaryPath(rootDir) {
  const layout = ensureRuntimeLayout(rootDir);
  const version = getMatchstickVersion();
  const platformBinary = detectMatchstickPlatform();

  return path.join(layout.toolsDir, "matchstick", version, platformBinary);
}

function findLegacyMatchstickBinary(rootDir, version, platformBinary) {
  const pnpmStoreCandidates = [
    path.join(rootDir, "node_modules", ".pnpm"),
    path.resolve(rootDir, "..", "..", "node_modules", ".pnpm"),
  ];

  for (const pnpmStorePath of pnpmStoreCandidates) {
    if (!fs.existsSync(pnpmStorePath)) {
      continue;
    }

    const entries = fs.readdirSync(pnpmStorePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (!entry.name.startsWith("binary-install-raw@")) {
        continue;
      }

      const candidate = path.join(
        pnpmStorePath,
        entry.name,
        "node_modules",
        "binary-install-raw",
        "bin",
        version,
        platformBinary,
      );

      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function normalizeRedirectLocation(baseUrl, location) {
  if (!location) {
    return null;
  }
  if (location.startsWith("http://") || location.startsWith("https://")) {
    return location;
  }
  return new URL(location, baseUrl).toString();
}

function downloadFile(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error(`Too many redirects while downloading ${url}`));
      return;
    }

    const requestModule = url.startsWith("https://") ? https : http;
    const request = requestModule.get(
      url,
      {
        headers: {
          "User-Agent": "terraqura-subgraph-tooling",
        },
      },
      (response) => {
        const statusCode = response.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          response.resume();
          const redirectUrl = normalizeRedirectLocation(
            url,
            response.headers.location || null,
          );
          if (!redirectUrl) {
            reject(
              new Error(`Redirect received without location header for ${url}`),
            );
            return;
          }
          downloadFile(redirectUrl, destination, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(
            new Error(`Download failed (${statusCode}) for ${url}`),
          );
          return;
        }

        ensureDir(path.dirname(destination));
        const tempPath = `${destination}.tmp`;
        const file = fs.createWriteStream(tempPath, { mode: 0o755 });

        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            fs.renameSync(tempPath, destination);
            resolve();
          });
        });
        file.on("error", (error) => {
          try {
            fs.unlinkSync(tempPath);
          } catch {
            // no-op
          }
          reject(error);
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(120000, () => {
      request.destroy(new Error(`Download timed out for ${url}`));
    });
  });
}

async function ensureMatchstickBinary(rootDir) {
  if (process.env.MATCHSTICK_BINARY && fs.existsSync(process.env.MATCHSTICK_BINARY)) {
    return process.env.MATCHSTICK_BINARY;
  }

  const binaryPath = getMatchstickBinaryPath(rootDir);
  if (fs.existsSync(binaryPath)) {
    fs.chmodSync(binaryPath, 0o755);
    return binaryPath;
  }

  if (process.env.SUBGRAPH_OFFLINE === "1") {
    throw new Error(
      "Matchstick binary is missing and SUBGRAPH_OFFLINE=1 is set. Set MATCHSTICK_BINARY to a pre-downloaded binary.",
    );
  }

  const version = getMatchstickVersion();
  const platformBinary = detectMatchstickPlatform();

  const legacyBinary = findLegacyMatchstickBinary(
    rootDir,
    version,
    platformBinary,
  );
  if (legacyBinary) {
    const canReadLegacyBinary = (() => {
      try {
        fs.accessSync(legacyBinary, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    })();

    if (!canReadLegacyBinary) {
      process.stdout.write(
        `[subgraph] Using existing Matchstick binary in-place (${legacyBinary}) because the file is not readable for copy operations.\n`,
      );
      return legacyBinary;
    }

    try {
      ensureDir(path.dirname(binaryPath));
      fs.copyFileSync(legacyBinary, binaryPath);
      fs.chmodSync(binaryPath, 0o755);
      process.stdout.write(
        `[subgraph] Reused existing Matchstick binary from ${legacyBinary}\n`,
      );
      return binaryPath;
    } catch (error) {
      process.stdout.write(
        `[subgraph] Using existing Matchstick binary in-place (${legacyBinary}) because copy failed: ${error.message}\n`,
      );
      return legacyBinary;
    }
  }

  const baseUrl = process.env.MATCHSTICK_BASE_URL || MATCHSTICK_GITHUB_BASE_URL;
  const downloadUrl = `${baseUrl.replace(/\/$/, "")}/${version}/${platformBinary}`;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      process.stdout.write(
        `[subgraph] Downloading Matchstick ${version} (${platformBinary}), attempt ${attempt}/3...\n`,
      );
      await downloadFile(downloadUrl, binaryPath);
      fs.chmodSync(binaryPath, 0o755);
      return binaryPath;
    } catch (error) {
      lastError = error;
      process.stderr.write(
        `[subgraph] Matchstick download attempt ${attempt}/3 failed: ${error.message}\n`,
      );
    }
  }

  throw new Error(
    `Unable to download Matchstick from ${downloadUrl}. ` +
      `Set MATCHSTICK_BINARY to a pre-downloaded executable in offline/air-gapped environments. ` +
      `Last error: ${lastError ? lastError.message : "unknown"}`,
  );
}

function assertMatchstickAsInstalled(rootDir) {
  const packageDir = path.join(rootDir, "node_modules", "matchstick-as");
  const entryTs = path.join(packageDir, "assembly", "index.ts");
  const entryJs = path.join(packageDir, "index.js");

  if (!fs.existsSync(entryTs) && !fs.existsSync(entryJs)) {
    throw new Error(
      "Missing dependency `matchstick-as`. Install with `pnpm --filter @terraqura/subgraph add -D matchstick-as`.",
    );
  }
}

function ensureAssemblyScriptForMatchstick(rootDir) {
  const localNodeModules = path.join(rootDir, "node_modules");
  const expectedPath = path.join(localNodeModules, "assemblyscript");

  if (fs.existsSync(expectedPath)) {
    return;
  }

  let resolvedPackageJsonPath = null;
  const resolveBases = [rootDir, path.resolve(rootDir, "..", "..")];
  for (const base of resolveBases) {
    try {
      resolvedPackageJsonPath = require.resolve("assemblyscript/package.json", {
        paths: [base],
      });
      break;
    } catch {
      // continue
    }
  }

  if (!resolvedPackageJsonPath) {
    const pnpmStoreCandidates = [
      path.join(rootDir, "node_modules", ".pnpm"),
      path.resolve(rootDir, "..", "..", "node_modules", ".pnpm"),
    ];

    let bestPackageJsonPath = null;
    let bestVersion = null;

    for (const storePath of pnpmStoreCandidates) {
      if (!fs.existsSync(storePath)) {
        continue;
      }

      const entries = fs.readdirSync(storePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (!entry.name.startsWith("assemblyscript@")) {
          continue;
        }

        const versionMatch = entry.name.match(/^assemblyscript@(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : "0.0.0";
        const candidatePackageJson = path.join(
          storePath,
          entry.name,
          "node_modules",
          "assemblyscript",
          "package.json",
        );

        if (!fs.existsSync(candidatePackageJson)) {
          continue;
        }

        if (bestVersion === null || version.localeCompare(bestVersion, undefined, { numeric: true }) > 0) {
          bestVersion = version;
          bestPackageJsonPath = candidatePackageJson;
        }
      }
    }

    resolvedPackageJsonPath = bestPackageJsonPath;
  }

  if (!resolvedPackageJsonPath) {
    throw new Error(
      "Missing dependency `assemblyscript` required by Matchstick. Install with `pnpm --filter @terraqura/subgraph add -D assemblyscript`.",
    );
  }

  ensureDir(localNodeModules);
  const packageDir = path.dirname(resolvedPackageJsonPath);

  try {
    fs.symlinkSync(packageDir, expectedPath, "dir");
  } catch (error) {
    throw new Error(
      `Unable to provision local assemblyscript link for Matchstick: ${error.message}`,
    );
  }
}

function runMatchstick(binaryPath, args, options = {}) {
  const rootDir = options.rootDir || getSubgraphRoot();
  const layout = ensureRuntimeLayout(rootDir);
  const env = createRuntimeEnv(layout, options.env || {});

  const result = runCommand(binaryPath, args, {
    cwd: rootDir,
    env,
    attempts: 1,
  });
  return result;
}

function readSubgraphManifestAbiFiles(rootDir) {
  const manifestPath = path.join(rootDir, "subgraph.yaml");
  const manifest = readFileIfExists(manifestPath);
  if (!manifest) {
    throw new Error(`Missing subgraph manifest: ${manifestPath}`);
  }

  const matches = manifest.match(/file:\s+\.\/abis\/([^\s]+)/g) || [];
  const abiFiles = matches.map((entry) => entry.replace(/file:\s+\.\/abis\//, ""));
  return abiFiles;
}

function validateAbiFiles(rootDir) {
  const abiFiles = readSubgraphManifestAbiFiles(rootDir);
  if (abiFiles.length === 0) {
    throw new Error("No ABI file entries found in subgraph.yaml.");
  }

  for (const abiFile of abiFiles) {
    const abiPath = path.join(rootDir, "abis", abiFile);
    if (!fs.existsSync(abiPath)) {
      throw new Error(`Missing ABI file referenced by subgraph.yaml: ${abiPath}`);
    }

    const content = fs.readFileSync(abiPath, "utf8");
    try {
      JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in ABI file ${abiPath}: ${error.message}`);
    }
  }
}

module.exports = {
  assertMatchstickAsInstalled,
  collectFilesByPattern,
  createRuntimeEnv,
  ensureAssemblyScriptForMatchstick,
  ensureGraphCliCodegenPatched,
  ensureMatchstickBinary,
  ensureRuntimeLayout,
  getMatchstickBinaryPath,
  getSubgraphRoot,
  readSubgraphManifestAbiFiles,
  runGraphCli,
  runMatchstick,
  validateAbiFiles,
};
