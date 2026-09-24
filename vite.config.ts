import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	// Server code reads process.env directly (so it also works under tsx scripts
	// and in the Docker image); in dev/test, populate it from .env.
	const env = loadEnv(mode, process.cwd(), '');
	Object.assign(process.env, env);

	return {
		plugins: [tailwindcss(), sveltekit()],
		test: {
			include: ['src/**/*.test.ts'],
			globalSetup: ['src/test/global-setup.ts'],
			env: { DATABASE_URL: env.TEST_DATABASE_URL },
			// Tests share one database; run files serially.
			fileParallelism: false
		}
	};
});
