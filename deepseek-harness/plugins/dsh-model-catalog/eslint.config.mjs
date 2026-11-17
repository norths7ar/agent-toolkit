import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

export default defineConfig([
  { ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.tmp/**"] },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  { files: ["client.js"], languageOptions: { globals: globals.browser } },
  prettier,
]);
