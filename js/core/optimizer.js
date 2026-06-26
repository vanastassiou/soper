/**
 * Recipe optimization algorithms — public barrel.
 *
 * The implementation is split along its natural seams under `optimizer/`:
 *   - scoring.js     error and fat/recipe scoring functions
 *   - weights.js     percentage optimisation for a fixed fat set
 *   - profile.js     greedy fat selection to match a target profile
 *   - generation.js  YOLO random recipes + property→fatty-acid conversion
 *   - cupboard.js    suggest fats to bring an owned set into range
 *   - dietary.js     dietary-filter exclusions
 *
 * Consumers import `* as optimizer` from this module; the split is internal.
 */

export { getDietaryExclusions } from './optimizer/dietary.js';
export { calculateProfileError } from './optimizer/scoring.js';
export { optimizeWeights } from './optimizer/weights.js';
export { findFatsForProfile } from './optimizer/profile.js';
export {
    generateRandomRecipe,
    propertiesToFattyAcidTargets,
    validatePropertyTargets
} from './optimizer/generation.js';
export { suggestFatsForCupboard } from './optimizer/cupboard.js';
