const {
  getSubgraphRoot,
  runGraphCli,
  validateAbiFiles,
} = require("./lib/subgraph-runtime.cjs");

function fail(message) {
  process.stderr.write(`[subgraph] ${message}\n`);
  process.exit(1);
}

function runBuild() {
  const rootDir = getSubgraphRoot();

  try {
    validateAbiFiles(rootDir);
  } catch (error) {
    fail(error.message);
  }

  const codegenResult = runGraphCli(["codegen"], {
    rootDir,
    attempts: 3,
  });
  if ((codegenResult.status ?? 1) !== 0) {
    fail("`graph codegen` failed.");
  }

  const buildResult = runGraphCli(["build"], {
    rootDir,
    attempts: 3,
  });
  if ((buildResult.status ?? 1) !== 0) {
    fail("`graph build` failed.");
  }

  process.stdout.write("[subgraph] Build completed successfully.\n");
}

runBuild();
