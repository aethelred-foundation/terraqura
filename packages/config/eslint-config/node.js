/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./index.js"],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // Node.js specific
    "no-process-exit": "warn",
    "@typescript-eslint/no-require-imports": "off",
  },
};
