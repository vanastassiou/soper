import { defineConfig } from 'vitest/config';

// The app ships as raw ES modules with no build step. Vitest (via Vite) loads
// those modules directly, so tests import the production source unchanged.
export default defineConfig({
    test: {
        // Pure logic under test has no DOM dependency; node is faster than jsdom.
        environment: 'node',
        include: ['js/**/*.test.js'],
        coverage: {
            provider: 'v8',
            // Scope coverage to the pure modules the test pyramid targets.
            // UI/DOM modules are intentionally excluded for now (see ARCHITECTURE_RISKS Risk 5).
            include: [
                'js/core/**/*.js',
                'js/lib/dietary.js',
                'js/lib/references.js',
                'js/state/state.js'
            ],
            // Low floor to start; ratchet upward over time per the mitigation plan.
            thresholds: {
                lines: 30,
                functions: 30,
                statements: 30,
                branches: 30
            }
        }
    }
});
