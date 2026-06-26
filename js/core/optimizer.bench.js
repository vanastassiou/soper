import { bench, describe } from 'vitest';
import { optimizeWeights, findFatsForProfile, generateRandomRecipe } from './optimizer.js';
import { FATS } from '../../tests/fixtures.js';

/**
 * Benchmarks for the optimizer hot paths. The optimizer is O(iterations * n^2)
 * per call and findFatsForProfile invokes optimizeWeights for every candidate,
 * so cost grows quickly with database size. Run `npm run bench` to capture a
 * baseline; future changes show up as deltas here (ARCHITECTURE_RISKS Risk 3).
 */

// Synthesize a larger database (~5x) by cloning the fixtures under new ids.
function scaleDatabase(factor) {
    const out = {};
    for (let i = 0; i < factor; i++) {
        for (const [id, fat] of Object.entries(FATS)) {
            out[`${id}-${i}`] = fat;
        }
    }
    return out;
}

const TARGET = { oleic: 45, lauric: 12, palmitic: 18, stearic: 6 };

describe('optimizeWeights', () => {
    const ids3 = ['olive', 'coconut', 'palm'];
    const ids6 = ['olive', 'coconut', 'palm', 'castor', 'tallow', 'sunflower'];

    bench('3 fats', () => {
        optimizeWeights(ids3, TARGET, FATS);
    });

    bench('6 fats', () => {
        optimizeWeights(ids6, TARGET, FATS);
    });
});

describe('findFatsForProfile', () => {
    const db1x = FATS;
    const db5x = scaleDatabase(5);

    bench('1x database', () => {
        findFatsForProfile(TARGET, db1x, { maxFats: 5 });
    });

    bench('5x database', () => {
        findFatsForProfile(TARGET, db5x, { maxFats: 5 });
    });
});

describe('generateRandomRecipe', () => {
    bench('default attempts', () => {
        generateRandomRecipe(FATS, { minFats: 3, maxFats: 5, maxAttempts: 50 });
    });
});
