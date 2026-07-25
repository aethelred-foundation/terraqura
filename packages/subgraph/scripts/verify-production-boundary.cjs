const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const subgraphRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(subgraphRoot, "..", "..");
const packageJsonPath = path.join(subgraphRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const graphCliPackage = "@graphprotocol/graph-cli";
const forbiddenProductionPackages = [graphCliPackage, "decompress"];
const allowedGraphCommands = new Set(["build", "codegen"]);

function fail(message) {
  process.stderr.write(`[subgraph-security] ${message}\n`);
  process.exit(1);
}

if (packageJson.dependencies?.[graphCliPackage]) {
  fail(`${graphCliPackage} must not be a production dependency.`);
}

if (!packageJson.devDependencies?.[graphCliPackage]) {
  fail(`${graphCliPackage} must remain an explicit development dependency.`);
}

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const productionList = spawnSync(
  pnpmCommand,
  [
    "--filter",
    packageJson.name,
    "list",
    "--prod",
    "--depth",
    "Infinity",
    "--json",
  ],
  {
    cwd: workspaceRoot,
    encoding: "utf8",
  },
);

if ((productionList.status ?? 1) !== 0) {
  fail(
    `Unable to inspect the production dependency graph: ${productionList.stderr || "pnpm list failed"}`,
  );
}

for (const packageName of forbiddenProductionPackages) {
  if (productionList.stdout.includes(`"${packageName}"`)) {
    fail(`${packageName} is present in the production dependency graph.`);
  }
}

const wrapperFiles = ["run-build.cjs", "run-codegen.cjs", "run-tests.cjs"].map(
  (fileName) => path.join(subgraphRoot, "scripts", fileName),
);
const invokedGraphCommands = new Set();
const graphInvocationPattern = /runGraphCli\(\s*\[\s*["']([^"']+)["']/gu;

for (const wrapperFile of wrapperFiles) {
  const source = fs.readFileSync(wrapperFile, "utf8");
  let match = graphInvocationPattern.exec(source);
  while (match) {
    invokedGraphCommands.add(match[1]);
    match = graphInvocationPattern.exec(source);
  }
}

if (invokedGraphCommands.size === 0) {
  fail("No Graph CLI wrapper commands were detected.");
}

for (const command of invokedGraphCommands) {
  if (!allowedGraphCommands.has(command)) {
    fail(`Unapproved Graph CLI command detected in wrappers: graph ${command}`);
  }
}

function collectArtifactFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const artifactFiles = collectArtifactFiles(path.join(subgraphRoot, "build"));
const forbiddenArtifactMarkers = ["@graphprotocol/graph-cli", "decompress"];
for (const artifactFile of artifactFiles) {
  const contents = fs.readFileSync(artifactFile);
  for (const marker of forbiddenArtifactMarkers) {
    if (contents.includes(Buffer.from(marker))) {
      fail(
        `Development-tool marker "${marker}" found in shipped artifact ${path.relative(
          subgraphRoot,
          artifactFile,
        )}.`,
      );
    }
  }
}

process.stdout.write(
  `[subgraph-security] Production boundary verified; Graph commands: ${[
    ...invokedGraphCommands,
  ]
    .sort()
    .join(", ")}; artifacts scanned: ${artifactFiles.length}.\n`,
);
