const path = require("node:path");

const {
  assertMatchstickAsInstalled,
  collectFilesByPattern,
  ensureAssemblyScriptForMatchstick,
  ensureMatchstickBinary,
  getSubgraphRoot,
  runGraphCli,
  runMatchstick,
  validateAbiFiles,
} = require("./lib/subgraph-runtime.cjs");

function fail(message) {
  process.stderr.write(`[subgraph] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {
    coverage: false,
    recompile: false,
    downloadOnly: false,
    datasource: null,
  };

  for (const arg of argv) {
    if (arg === "-c" || arg === "--coverage") {
      parsed.coverage = true;
      continue;
    }
    if (arg === "-r" || arg === "--recompile") {
      parsed.recompile = true;
      continue;
    }
    if (arg === "--download-only") {
      parsed.downloadOnly = true;
      continue;
    }
    if (!arg.startsWith("-") && parsed.datasource === null) {
      parsed.datasource = arg;
      continue;
    }
  }

  return parsed;
}

async function main() {
  const rootDir = getSubgraphRoot();
  const testsDir = path.join(rootDir, "tests");
  const args = parseArgs(process.argv.slice(2));

  const tests = collectFilesByPattern(testsDir, /\.(test|spec)\.ts$/);
  if (tests.length === 0) {
    fail(
      "No subgraph test files found in /tests. Add Matchstick tests before running the monorepo test gate.",
    );
  }

  try {
    validateAbiFiles(rootDir);
    assertMatchstickAsInstalled(rootDir);
    ensureAssemblyScriptForMatchstick(rootDir);
  } catch (error) {
    fail(error.message);
  }

  const codegenResult = runGraphCli(["codegen"], {
    rootDir,
    attempts: 3,
  });
  if ((codegenResult.status ?? 1) !== 0) {
    fail("`graph codegen` failed before tests.");
  }

  let matchstickBinary;
  try {
    matchstickBinary = await ensureMatchstickBinary(rootDir);
  } catch (error) {
    fail(error.message);
  }

  if (args.downloadOnly) {
    process.stdout.write(
      `[subgraph] Matchstick binary ready at ${matchstickBinary}\n`,
    );
    process.exit(0);
  }

  const matchstickArgs = [];
  if (args.coverage) {
    matchstickArgs.push("-c");
  }
  if (args.recompile) {
    matchstickArgs.push("-r");
  }
  if (args.datasource) {
    matchstickArgs.push(args.datasource);
  }

  const result = runMatchstick(matchstickBinary, matchstickArgs, { rootDir });
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  fail(error.message);
});
