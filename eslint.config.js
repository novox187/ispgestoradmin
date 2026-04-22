import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

/** @type {import('eslint').Linter.Config[]} */
export default [
	includeIgnoreFile(gitignorePath),
	{
		ignores: ['src/lib/components/chat/**']
	},
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.{ts,tsx,js,jsx}'],
		languageOptions: { parser: tsParser },
		plugins: { '@typescript-eslint': tsPlugin },
		rules: {
			'no-unused-vars': 'off',
			'no-undef': 'off',
			'no-empty': 'off',
			'no-case-declarations': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js'],
		languageOptions: { parserOptions: { svelteConfig, parser: tsParser } },
		plugins: { '@typescript-eslint': tsPlugin },
		rules: {
			'no-unused-vars': 'off',
			'no-undef': 'off',
			'no-empty': 'off',
			'no-case-declarations': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/no-at-html-tags': 'off',
			'svelte/require-each-key': 'off',
			'svelte/prefer-writable-derived': 'off'
		}
	}
];
