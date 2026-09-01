import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'dist/', 'example/', '**/*.d.ts'],
		},
	},
	resolve: {
		alias: {
			'@': '/Users/ewidlund/dev/polar-adapters/packages/polar-betterauth/src',
		},
	},
})