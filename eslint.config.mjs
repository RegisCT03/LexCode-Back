import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
  // En las pruebas las respuestas JSON se revisan sin tipar.
  { files: ['tests/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
]);
