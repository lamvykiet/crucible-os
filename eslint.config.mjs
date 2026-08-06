import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ổ USB dùng exFAT nên macOS rải file AppleDouble "._foo.ts" cạnh mọi file
    // nguồn. Chúng là dữ liệu nhị phân, ESLint parse ra lỗi "Invalid character".
    "**/._*",
  ]),
]);

export default eslintConfig;
