/**
 * Recipe generation: the YOLO random recipe generator and the
 * property-to-fatty-acid target conversion used by the profile builder.
 */

import {
    PROFILE,
    PROPERTY_CONVERSION,
    isValidTarget,
    allPropertiesInRange
} from '../../lib/constants.js';
import { calculateProperties, calculateFattyAcidsFromPercentages } from '../calculator.js';
import { optimizeWeights } from './weights.js';
import { scorePropertiesInRange } from './scoring.js';

/** @typedef {import('../../lib/types.js').Fat} Fat */
/** @typedef {import('../../lib/types.js').FatsDatabase} FatsDatabase */
/** @typedef {import('../../lib/types.js').FattyAcids} FattyAcids */
/** @typedef {import('../../lib/types.js').PropertyValues} PropertyValues */


/**
 * Generate a random recipe with properties in acceptable ranges
 * @param {FatsDatabase} fatsDatabase - Fat database
 * @param {Object<string, any>} options - {excludeFats, lockedFats (IDs only), minFats, maxFats, maxAttempts}
 * @returns {Object|null} {recipe, properties} or null if no valid recipe found
 */
export function generateRandomRecipe(fatsDatabase, options = {}) {
    const excludeFats = new Set(options.excludeFats || []);
    const lockedFatIds = options.lockedFats || []; // Fat IDs whose presence is locked while percentages are regenerated
    const minFats = options.minFats || 3;
    const maxFats = options.maxFats || 5;
    const maxAttempts = options.maxAttempts || 50;

    // Get available fats for random selection (exclude locked fat IDs so they don't get picked again)
    const lockedIds = new Set(lockedFatIds);
    const availableFats = Object.keys(fatsDatabase).filter(id =>
        !excludeFats.has(id) && !lockedIds.has(id)
    );

    const neededFats = Math.max(0, minFats - lockedFatIds.length);
    if (availableFats.length < neededFats) return null;

    // Track best recipe found (even if not perfect)
    let bestResult = null;
    let bestScore = -Infinity;

    // Phase 1: Pure random attempts (fast, gives varied results)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Random number of new fats to add
        const numNewFats = Math.max(neededFats,
            Math.floor(Math.random() * (maxFats - lockedFatIds.length + 1)));

        // Shuffle and pick random fats
        const shuffled = [...availableFats].sort(() => Math.random() - 0.5);
        const selectedFats = shuffled.slice(0, Math.min(numNewFats, shuffled.length));

        // Combine locked fats with new fats - locked come first, all get new percentages
        const allFats = [...lockedFatIds, ...selectedFats];
        const recipe = generateRandomPercentagesScaled(allFats, 100);

        // Calculate fatty acids and properties
        const fattyAcids = calculateFattyAcidsFromPercentages(recipe, fatsDatabase);
        const properties = calculateProperties(fattyAcids);

        // Check if properties are in acceptable ranges - return immediately if perfect
        if (allPropertiesInRange(properties)) {
            return {
                recipe,
                fattyAcids,
                properties
            };
        }

        // Track best result
        const score = scorePropertiesInRange(properties);
        if (score > bestScore) {
            bestScore = score;
            bestResult = { recipe, fattyAcids, properties };
        }
    }

    // Phase 2: Optimized fallback - random fat selection with optimized percentages
    // Target midpoint of property ranges for balanced soap
    const balancedTarget = {
        lauric: 10,      // Contributes to degreasing, lather-volume
        myristic: 5,     // Contributes to degreasing, lather-volume
        palmitic: 20,    // Contributes to hardness, lather-density
        stearic: 8,      // Contributes to hardness, lather-density
        oleic: 40,       // Contributes to moisturizing
        linoleic: 10,    // Contributes to moisturizing
        ricinoleic: 5    // Contributes to lather-volume, lather-density
    };

    const fallbackAttempts = 20;
    for (let attempt = 0; attempt < fallbackAttempts; attempt++) {
        // Random number of new fats
        const numNewFats = Math.max(neededFats,
            Math.floor(Math.random() * (maxFats - lockedFatIds.length + 1)));

        // Shuffle and pick random fats
        const shuffled = [...availableFats].sort(() => Math.random() - 0.5);
        const selectedFatIds = shuffled.slice(0, Math.min(numNewFats, shuffled.length));

        // Use optimizer to find good percentages for all fats (locked + new)
        const allFatIds = [...lockedFatIds, ...selectedFatIds];
        const recipe = optimizeWeights(allFatIds, balancedTarget, fatsDatabase);

        const fattyAcids = calculateFattyAcidsFromPercentages(recipe, fatsDatabase);
        const properties = calculateProperties(fattyAcids);

        // Return immediately if perfect
        if (allPropertiesInRange(properties)) {
            return {
                recipe,
                fattyAcids,
                properties
            };
        }

        // Track best result
        const score = scorePropertiesInRange(properties);
        if (score > bestScore) {
            bestScore = score;
            bestResult = { recipe, fattyAcids, properties };
        }
    }

    // Return best result found (may have some properties out of range)
    return bestResult;
}

/**
 * Generate random percentages for selected fats, scaled to a target total
 * @param {string[]} fatIds - Array of fat IDs
 * @param {number} targetTotal - Target total percentage (e.g., 60 if 40% is locked)
 * @returns {Array<{id: string, percentage: number}>} Array of {id, percentage}
 */
function generateRandomPercentagesScaled(fatIds, targetTotal) {
    if (fatIds.length === 0) return [];

    const minPercent = PROFILE.MIN_FAT_PERCENT;
    const maxPercent = Math.min(PROFILE.MAX_FAT_PERCENT, targetTotal);

    // Generate random weights
    let weights = fatIds.map(() => minPercent + Math.random() * (maxPercent - minPercent));

    // Normalize to target total
    const total = weights.reduce((sum, w) => sum + w, 0);
    let percentages = weights.map(w => Math.round(w / total * targetTotal));

    // Fix rounding to ensure sum is exactly targetTotal
    const roundedTotal = percentages.reduce((sum, p) => sum + p, 0);
    if (roundedTotal !== targetTotal) {
        const maxIdx = percentages.indexOf(Math.max(...percentages));
        percentages[maxIdx] += (targetTotal - roundedTotal);
    }

    // Enforce min/max constraints
    percentages = percentages.map(p => Math.max(minPercent, Math.min(maxPercent, p)));

    return fatIds.map((id, i) => ({ id, percentage: percentages[i] }));
}

/**
 * Convert property targets to approximate fatty acid targets
 * This is an inverse of calculateProperties() with assumptions
 * @param {Object<string, any>} propertyTargets - {hardness: 40, degreasing: 18, ...}
 * @returns {Object<string, any>} Approximate fatty acid targets
 */
export function propertiesToFattyAcidTargets(propertyTargets) {
    const targets = {};
    const C = PROPERTY_CONVERSION;

    // Degreasing = lauric + myristic
    if (isValidTarget(propertyTargets.degreasing)) {
        const degreasing = parseFloat(propertyTargets.degreasing);
        targets.lauric = Math.round(degreasing * C.DEGREASING_LAURIC_RATIO);
        targets.myristic = Math.round(degreasing * C.DEGREASING_MYRISTIC_RATIO);
    }

    // Hardness = lauric + myristic + palmitic + stearic
    if (isValidTarget(propertyTargets.hardness)) {
        const hardness = parseFloat(propertyTargets.hardness);
        const lauricMyristic = (targets.lauric || 0) + (targets.myristic || 0);
        const remaining = hardness - lauricMyristic;
        if (remaining > 0) {
            targets.palmitic = Math.round(remaining * C.HARDNESS_PALMITIC_RATIO);
            targets.stearic = Math.round(remaining * C.HARDNESS_STEARIC_RATIO);
        }
    }

    // Moisturizing = oleic + ricinoleic + linoleic + linolenic
    if (isValidTarget(propertyTargets.moisturizing)) {
        const moisturizing = parseFloat(propertyTargets.moisturizing);
        targets.oleic = Math.round(moisturizing * C.MOISTURIZING_OLEIC_RATIO);
        if (!targets.ricinoleic) {
            targets.ricinoleic = Math.round(moisturizing * C.MOISTURIZING_RICINOLEIC_RATIO);
        }
        targets.linoleic = Math.round(moisturizing * C.MOISTURIZING_LINOLEIC_RATIO);
        targets.linolenic = Math.round(moisturizing * C.MOISTURIZING_LINOLENIC_RATIO);
    }

    // Lather volume = lauric + myristic + ricinoleic
    if (isValidTarget(propertyTargets['lather-volume'])) {
        const latherVolume = parseFloat(propertyTargets['lather-volume']);
        const lauricMyristic = (targets.lauric || 0) + (targets.myristic || 0);
        const ricinoleicNeeded = latherVolume - lauricMyristic;
        if (ricinoleicNeeded > 0) {
            targets.ricinoleic = Math.round(ricinoleicNeeded);
        }
    }

    // Lather density = palmitic + stearic + ricinoleic
    if (isValidTarget(propertyTargets['lather-density'])) {
        const latherDensity = parseFloat(propertyTargets['lather-density']);
        const ricinoleic = targets.ricinoleic || 0;
        const remaining = latherDensity - ricinoleic;
        if (remaining > 0 && !targets.palmitic && !targets.stearic) {
            targets.palmitic = Math.round(remaining * C.HARDNESS_PALMITIC_RATIO);
            targets.stearic = Math.round(remaining * C.HARDNESS_STEARIC_RATIO);
        }
    }

    return targets;
}

/**
 * Validate property targets for logical consistency
 * @param {Object<string, any>} targets - Property targets
 * @returns {string|null} Error message or null if valid
 */
export function validatePropertyTargets(targets) {
    const hardness = targets.hardness;
    const degreasing = targets.degreasing;
    const moisturizing = targets.moisturizing;
    const latherVolume = targets['lather-volume'];

    // Hardness + moisturizing should be ~100
    if (hardness !== undefined && moisturizing !== undefined) {
        const sum = hardness + moisturizing;
        if (sum < 85 || sum > 115) {
            return `Hardness + Moisturizing should be around 100 (you entered ${sum}). These represent saturated + unsaturated fatty acids.`;
        }
    }

    // Degreasing <= Hardness
    if (degreasing !== undefined && hardness !== undefined && degreasing > hardness) {
        return `Degreasing (${degreasing}) cannot exceed Hardness (${hardness}). Degreasing is a subset of the fatty acids that contribute to hardness.`;
    }

    // Lather volume >= Degreasing
    if (latherVolume !== undefined && degreasing !== undefined && latherVolume < degreasing) {
        return `Lather volume (${latherVolume}) should be at least Degreasing (${degreasing}). Lather volume = Degreasing + ricinoleic.`;
    }

    return null;
}
