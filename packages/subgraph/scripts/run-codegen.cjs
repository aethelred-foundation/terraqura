const {
  getSubgraphRoot,
  runGraphCli,
  validateAbiFiles,
} = require("./lib/subgraph-runtime.cjs");

function fail(message) {
  process.stderr.write(`[subgraph] ${message}\n`);
  process.exit(1);
}

function runCodegen() {
  const rootDir = getSubgraphRoot();

  try {
    validateAbiFiles(rootDir);
  } catch (error) {
    fail(error.message);
  }

  const result = runGraphCli(["codegen"], {
    rootDir,
    attempts: 3,
  });
  if ((result.status ?? 1) !== 0) {
    fail("`graph codegen` failed.");
  }
}

runCodegen();
