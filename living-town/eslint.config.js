"use strict";
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", "data/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "no-empty": ["error", { allowEmptyCatch: true }], "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }] }
  },
  {
    files: ["public/**/*.js", "shared/**/*.js"],
    languageOptions: { sourceType: "script", globals: { ...globals.browser, ...globals.serviceworker } }
  }
];
