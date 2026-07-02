import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/validate.ts", "src/write-json.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
});
