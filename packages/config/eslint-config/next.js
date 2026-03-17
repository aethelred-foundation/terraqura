/** @type {import("eslint").Linter.Config} */
module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "next/core-web-vitals",
  ],
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "only-warn"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  env: {
    es2022: true,
    node: true,
    browser: true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    // React
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unescaped-entities": "off",

    // React Hooks
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // TypeScript
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",

    // Accessibility
    "jsx-a11y/anchor-is-valid": [
      "warn",
      {
        components: ["Link"],
        specialLink: ["hrefLeft", "hrefRight"],
        aspects: ["invalidHref", "preferButton"],
      },
    ],

    // Next.js specific
    "@next/next/no-html-link-for-pages": "off",

    // General
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "warn",
    eqeqeq: ["warn", "always"],
  },
  overrides: [
    {
      files: ["*.tsx"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "off",
      },
    },
  ],
};
