import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['api/**'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Folder api/ itu kode SERVER (Vercel serverless function, jalan di
  // Node.js), BUKAN kode browser -- butuh global Node kayak `process`
  // (buat baca env var Service Role Key, dll), bukan global browser
  // kayak `window`/`document`. React Hooks/Fast Refresh rule juga nggak
  // relevan di sini (bukan kode React sama sekali), jadi nggak di-extend.
  {
    files: ['api/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
])
