// @ts-check
import eslint from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

/**
 * Architecture boundaries (see AGENTS.md section 3):
 * - core/, config/ and shared/ never import from modules/.
 * - shared/ is pure: it imports nothing from core/, config/ or modules/.
 * - A module imports another module only through its index.ts (public API).
 */
const boundaryElements = [
  { type: 'config', pattern: 'src/config' },
  { type: 'core', pattern: 'src/core' },
  { type: 'shared', pattern: 'src/shared' },
  { type: 'module', pattern: 'src/modules/*', capture: ['moduleName'] },
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'contract/**',
      'openapi/**',
      '.agents/**',
      '.claude/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.mjs', 'scripts/*.mjs', 'db/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      // Metric attribute types need index signatures, which only type aliases give.
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': 'allow-with-description', 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration through src/config.' },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': boundaryElements,
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { types: ['core', 'config', 'shared'] } },
              disallow: { to: { element: { type: 'module' } } },
              message: 'core/, config/ and shared/ must not import from modules/.',
            },
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: ['core', 'config'] } } },
              message: 'shared/ holds pure helpers and must not import application code.',
            },
            {
              from: { element: { type: 'module' } },
              disallow: {
                to: {
                  element: {
                    type: 'module',
                    captured: { moduleName: '!{{from.element.captured.moduleName}}' },
                    fileInternalPath: '!index.ts',
                  },
                },
              },
              message: 'Import another module only through its index.ts (public API).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/config/**/*.ts', 'test/support/**/*.ts', '*.config.mts'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Supertest bodies and Nest's getHttpServer() are typed `any`.
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly' },
    },
    rules: { 'no-restricted-properties': 'off' },
  },
);
