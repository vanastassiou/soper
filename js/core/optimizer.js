/**
 * Recipe optimization algorithms
 * Finds optimal fat combinations to match target fatty acid profiles
 *
 * Algorithm notes:
 * - Uses iterative gradient descent with O(n²) pair comparisons per iteration
 * - Convergence: stops at 100 iterations or error < 0.01
 * - Not globally optimal, but produces good practical results
 */

import {
    PROFILE,
    PROPERTY_CONVERSION,
    PROPERTY_RANGES,
    isValidTarget,
    allPropertiesInRange
} from '../lib/constants.js';
import { hasSignificantEthicalConcerns } from '../lib/dietary.js';

import { calculateProperties, calculateFattyAcidsFromPercentages } from './calculator.js';

// ============================================
// Dietary Filtering
// ============================================

/**
 * Filter ingredients based on dietary requirements
 * Works with any ingredient database (fats, colourants, fragrances, etc.)
 * @param {Object} database - Ingredient database
 * @param {Object} dietaryFilters - {animalBased, sourcingConcerns, commonAllergens, includeExoticFats}
 * @returns {Set} Set of ingredient IDs that should be excluded
 */
export function getDietaryExclusions(database, dietaryFilters = {}) {
    const exclusions = new Set();

    for (const [id, item] of Object.entries(database)) {
        const dietary = item.dietary || {};

        // Exclude items that match the filter criteria
        if (dietaryFilters.animalBased && dietary.animalBased === true) {
            exclusions.add(id);
        } else if (dietaryFilters.sourcingConcerns && hasSignificantEthicalConcerns(item)) {
            exclusions.add(id);
        } else if (dietaryFilters.commonAllergens && dietary.commonAllergen === true) {
            exclusions.add(id);
        }
        // Exotic fats: exclude when NOT checked (opposite of other filters)
        if (!dietaryFilters.includeExoticFats && dietary.isExotic === true) {
            exclusions.add(id);
        }
    }

    return exclusions;
}

// ============================================
// Error & Scoring Functions
// ============================================

/**
 * Calculate error between current and target fatty acid profiles
 * Uses sum of squared differences for specified targets only
 * @param {Object} current - Current fatty acid profile
 * @param {Object} target - Target fatty acid percentages (only specified keys are compared)
 * @returns {number} Sum of squared differences
 */
export function calculateProfileError(current, target) {
    let error = 0;
    for (const acid of Object.keys(target)) {
        if (isValidTarget(target[acid])) {
            const targetVal = parseFloat(target[acid]);
            const currentVal = current[acid] || 0;
            error += Math.pow(targetVal - currentVal, 2);
        }
    }
    return error;
}

/**
 * Score a fat by how well it can help achieve target profile
 * Higher score = more helpful
 * @param {Object} fat - Fat data
 * @param {Object} targetProfile - Target fatty acid percentages
 * @param {Object} currentProfile - Current achieved profile (can be empty)
 * @returns {number} Score (higher is better)
 */
function scoreFatForTarget(fat, targetProfile, currentProfile = {}) {
    let score = 0;
    const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;

    for (const acid of Object.keys(targetProfile)) {
        if (!isValidTarget(targetProfile[acid])) continue;

        const targetVal = parseFloat(targetProfile[acid]);
        const currentVal = currentProfile[acid] || 0;
        const fatVal = fattyAcids[acid] || 0;
        const deficit = targetVal - currentVal;

        // Fat is helpful if it provides what we need more of
        if (deficit > 0 && fatVal > 0) {
            score += Math.min(deficit, fatVal); // Credit for filling the gap
        } else if (deficit < 0 && fatVal < targetVal) {
            score += 5; // Small bonus for not making it worse
        } else if (deficit < 0 && fatVal > targetVal) {
            score -= fatVal - targetVal; // Penalty for overshooting
        }
    }

    return score;
}

// ============================================
// Optimization Algorithm
// ============================================

/**
 * Optimize weights for selected fats to minimize profile error
 * Uses iterative adjustment to find optimal percentages
 *
 * Complexity: O(iterations * n²) where n = number of fats
 *
 * @param {Array} selectedFats - Array of fat ids (kebab-case keys)
 * @param {Object} targetProfile - Target fatty acid percentages
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} constraints - {minFatPercent, maxFatPercent}
 * @returns {Array} Array of {id, percentage} with optimized percentages
 */
export function optimizeWeights(selectedFats, targetProfile, fatsDatabase, constraints = {}) {
    const minPercent = constraints.minFatPercent || PROFILE.MIN_FAT_PERCENT;
    const maxPercent = constraints.maxFatPercent || PROFILE.MAX_FAT_PERCENT;
    const numFats = selectedFats.length;

    if (numFats === 0) return [];
    if (numFats === 1) return [{ id: selectedFats[0], percentage: 100 }];

    // Start with equal distribution
    let recipe = selectedFats.map(id => ({
        id,
        percentage: 100 / numFats
    }));

    // Iterative optimization (gradient descent)
    const stepSize = PROFILE.OPTIMIZER_STEP_SIZE;
    const iterations = PROFILE.OPTIMIZER_ITERATIONS;

    for (let iter = 0; iter < iterations; iter++) {
        const currentFA = calculateFattyAcidsFromPercentages(recipe, fatsDatabase);
        const currentError = calculateProfileError(currentFA, targetProfile);

        if (currentError < PROFILE.CONVERGENCE_THRESHOLD) break;

        // Try adjusting each pair of fats
        let bestRecipe = recipe;
        let bestError = currentError;

        for (let i = 0; i < numFats; i++) {
            for (let j = i + 1; j < numFats; j++) {
                // Try both directions: increase i/decrease j, and vice versa
                const candidates = [
                    createTestRecipe(recipe, i, j, stepSize, minPercent, maxPercent),
                    createTestRecipe(recipe, j, i, stepSize, minPercent, maxPercent)
                ];

                for (const testRecipe of candidates) {
                    const error = calculateProfileError(
                        calculateFattyAcidsFromPercentages(testRecipe, fatsDatabase),
                        targetProfile
                    );

                    if (error < bestError) {
                        bestError = error;
                        bestRecipe = testRecipe;
                    }
                }
            }
        }

        if (bestError >= currentError) break; // No improvement possible
        recipe = bestRecipe;
    }

    // Enforce constraints and normalize
    return normalizeRecipe(recipe, minPercent, maxPercent);
}

/**
 * Create a test recipe with one fat increased and another decreased
 * @param {Array} recipe - Current recipe
 * @param {number} increaseIdx - Index to increase
 * @param {number} decreaseIdx - Index to decrease
 * @param {number} stepSize - Amount to adjust
 * @param {number} minPercent - Minimum percentage
 * @param {number} maxPercent - Maximum percentage
 * @returns {Array} New test recipe
 */
function createTestRecipe(recipe, increaseIdx, decreaseIdx, stepSize, minPercent, maxPercent) {
    const testRecipe = recipe.map((r, idx) => {
        if (idx === increaseIdx) {
            return { ...r, percentage: Math.min(maxPercent, r.percentage + stepSize) };
        }
        if (idx === decreaseIdx) {
            return { ...r, percentage: Math.max(minPercent, r.percentage - stepSize) };
        }
        return { ...r };
    });

    // Normalize to 100%
    const total = testRecipe.reduce((s, r) => s + r.percentage, 0);
    testRecipe.forEach(r => r.percentage = r.percentage / total * 100);

    return testRecipe;
}

/**
 * Normalize recipe percentages to sum to 100%
 * @param {Array} recipe - Recipe to normalize
 * @param {number} minPercent - Minimum percentage
 * @param {number} maxPercent - Maximum percentage
 * @returns {Array} Normalized recipe
 */
function normalizeRecipe(recipe, minPercent, maxPercent) {
    // Enforce constraints
    let result = recipe.map(r => ({
        ...r,
        percentage: Math.max(minPercent, Math.min(maxPercent, r.percentage))
    }));

    // Normalize to 100%
    const total = result.reduce((s, r) => s + r.percentage, 0);
    result.forEach(r => r.percentage = Math.round(r.percentage / total * 100));

    // Fix rounding errors
    const roundedTotal = result.reduce((s, r) => s + r.percentage, 0);
    if (roundedTotal !== 100) {
        const maxIdx = result.reduce((maxI, r, i, arr) =>
            r.percentage > arr[maxI].percentage ? i : maxI, 0);
        result[maxIdx].percentage += (100 - roundedTotal);
    }

    return result;
}

// ============================================
// Profile Matching
// ============================================

/**
 * Filter and score available fats for profile matching
 * @param {Object} fatsDatabase - All available fats
 * @param {Set} excludeFats - Fat IDs to exclude
 * @param {Set} lockedIds - Locked fat IDs (handled separately)
 * @returns {Array} Array of fat objects with id included
 */
function filterAvailableFats(fatsDatabase, excludeFats, lockedIds) {
    return Object.entries(fatsDatabase)
        .filter(([id]) => !excludeFats.has(id) && !lockedIds.has(id))
        .map(([id, data]) => ({ id, ...data }));
}

/**
 * Score and rank fats based on target profile
 * @param {Array} availableFats - Available fat objects
 * @param {Object} targetProfile - Target fatty acid profile
 * @param {Array} selectedFatIds - Already selected fat IDs to exclude
 * @returns {Array} Scored and sorted fat array
 */
function scoreAndRankFats(availableFats, targetProfile, selectedFatIds) {
    return availableFats
        .filter(fat => !selectedFatIds.includes(fat.id))
        .map(fat => ({
            ...fat,
            score: scoreFatForTarget(fat, targetProfile, {})
        }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Find the next best fat to add using improvement scoring
 * @param {Array} scoredFats - Available fats with scores
 * @param {Array} selectedFatIds - Currently selected fat IDs
 * @param {Object} targetProfile - Target fatty acid profile
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} weightOptions - {minFatPercent, maxFatPercent}
 * @returns {{fat: Object|null, improvement: number}} Best fat and its improvement
 */
function findBestFatToAdd(scoredFats, selectedFatIds, targetProfile, fatsDatabase, weightOptions) {
    const currentRecipe = selectedFatIds.map(id => ({
        id,
        percentage: 100 / selectedFatIds.length
    }));
    const currentProfile = selectedFatIds.length > 0
        ? calculateFattyAcidsFromPercentages(currentRecipe, fatsDatabase)
        : {};
    const currentError = selectedFatIds.length > 0
        ? calculateProfileError(currentProfile, targetProfile)
        : Infinity;

    let bestFat = null;
    let bestImprovement = -Infinity;

    for (const fat of scoredFats) {
        if (selectedFatIds.includes(fat.id)) continue;

        const testIds = [...selectedFatIds, fat.id];
        const testRecipe = optimizeWeights(testIds, targetProfile, fatsDatabase, weightOptions);
        const testProfile = calculateFattyAcidsFromPercentages(testRecipe, fatsDatabase);
        const testError = calculateProfileError(testProfile, targetProfile);
        const improvement = currentError - testError;

        if (improvement > bestImprovement) {
            bestImprovement = improvement;
            bestFat = fat;
        }
    }

    return { fat: bestFat, improvement: bestImprovement };
}

/**
 * Greedy fat selection: iteratively add fats that improve profile match
 * @param {Array} scoredFats - Scored and ranked available fats (mutated)
 * @param {Array} selectedFatIds - Initially selected fat IDs (mutated)
 * @param {number} availableSlots - Max fats to select
 * @param {Object} targetProfile - Target fatty acid profile
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} weightOptions - {minFatPercent, maxFatPercent}
 */
function greedySelectFats(scoredFats, selectedFatIds, availableSlots, targetProfile, fatsDatabase, weightOptions) {
    while (selectedFatIds.length < availableSlots && scoredFats.length > 0) {
        const { fat: bestFat, improvement } = findBestFatToAdd(
            scoredFats, selectedFatIds, targetProfile, fatsDatabase, weightOptions
        );

        if (bestFat && improvement > 0) {
            selectedFatIds.push(bestFat.id);
            const idx = scoredFats.findIndex(o => o.id === bestFat.id);
            if (idx !== -1) scoredFats.splice(idx, 1);
        } else {
            break;
        }
    }
}

/**
 * Build final optimized recipe with locked fats first
 * @param {Array} allFatIds - All fat IDs (locked + selected)
 * @param {Array} lockedFats - Array of {id, percentage}
 * @param {Set} lockedIds - Set of locked fat IDs
 * @param {Object} targetProfile - Target fatty acid profile
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} weightOptions - {minFatPercent, maxFatPercent}
 * @returns {Object} {recipe, achieved, achievedProperties, error, matchQuality}
 */
function buildFinalResult(allFatIds, lockedFats, lockedIds, targetProfile, fatsDatabase, weightOptions) {
    const finalRecipe = optimizeWeights(allFatIds, targetProfile, fatsDatabase, weightOptions);

    // Reorder so locked fats come first (preserves lock indices)
    const lockedRecipe = lockedFats.map(lf =>
        finalRecipe.find(f => f.id === lf.id) || lf
    );
    const unlockedRecipe = finalRecipe.filter(f => !lockedIds.has(f.id));
    const orderedRecipe = [...lockedRecipe, ...unlockedRecipe];

    const achievedProfile = calculateFattyAcidsFromPercentages(orderedRecipe, fatsDatabase);
    const finalError = calculateProfileError(achievedProfile, targetProfile);
    const matchQuality = calculateMatchQuality(achievedProfile, targetProfile);

    return {
        recipe: orderedRecipe,
        achieved: achievedProfile,
        achievedProperties: calculateProperties(achievedProfile),
        error: finalError,
        matchQuality
    };
}

/**
 * Find fats that best match target fatty acid profile
 * @param {Object} targetProfile - {oleic: 50, palmitic: 20, ...} - target percentages
 * @param {Object} fatsDatabase - All available fats
 * @param {Object} options - {maxFats, excludeFats, requireFats, lockedFats, minFatPercent, maxFatPercent}
 * @returns {Object} {recipe, achieved, achievedProperties, error, matchQuality}
 */
export function findFatsForProfile(targetProfile, fatsDatabase, options = {}) {
    const maxFats = options.maxFats || PROFILE.DEFAULT_MAX_FATS;
    const excludeFats = new Set(options.excludeFats || []);
    const requireFats = options.requireFats || [];
    const lockedFats = options.lockedFats || [];
    const weightOptions = {
        minFatPercent: options.minFatPercent || PROFILE.MIN_FAT_PERCENT,
        maxFatPercent: options.maxFatPercent || PROFILE.MAX_FAT_PERCENT
    };

    const lockedIds = new Set(lockedFats.map(f => f.id));
    const availableFats = filterAvailableFats(fatsDatabase, excludeFats, lockedIds);

    // Start with required fats (excluding locked ones)
    const selectedFatIds = [...requireFats].filter(id => !lockedIds.has(id));
    const scoredFats = scoreAndRankFats(availableFats, targetProfile, selectedFatIds);

    // Greedy selection
    const availableSlots = maxFats - lockedFats.length;
    greedySelectFats(scoredFats, selectedFatIds, availableSlots, targetProfile, fatsDatabase, weightOptions);

    // Build final result
    const allFatIds = [...lockedFats.map(f => f.id), ...selectedFatIds];
    return buildFinalResult(allFatIds, lockedFats, lockedIds, targetProfile, fatsDatabase, weightOptions);
}

/**
 * Calculate match quality as percentage
 * @param {Object} achieved - Achieved fatty acid profile
 * @param {Object} target - Target profile
 * @returns {number} Match quality 0-100
 */
function calculateMatchQuality(achieved, target) {
    let totalTargets = 0;
    let totalDeviation = 0;

    for (const acid of Object.keys(target)) {
        if (isValidTarget(target[acid])) {
            const targetVal = parseFloat(target[acid]);
            const achievedVal = achieved[acid] || 0;
            totalTargets++;
            totalDeviation += Math.abs(targetVal - achievedVal);
        }
    }

    // 100% if deviation is 0, decreases with deviation
    const avgDeviation = totalTargets > 0 ? totalDeviation / totalTargets : 0;
    return Math.max(0, Math.min(100, Math.round(100 - avgDeviation * PROFILE.MATCH_QUALITY_FACTOR)));
}

// ============================================
// Property-to-Fatty-Acid Conversion
// ============================================

/**
 * Convert property targets to approximate fatty acid targets
 * This is an inverse of calculateProperties() with assumptions
 * @param {Object} propertyTargets - {hardness: 40, degreasing: 18, ...}
 * @returns {Object} Approximate fatty acid targets
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
 * @param {Object} targets - Property targets
 * @returns {string|null} Error message or null if valid
 */
export function validatePropertyTargets(targets) {
    const hardness = targets.hardness;
    const degreasing = targets.degreasing;
    const moisturizing = targets.moisturizing;
    const latherVolume = targets['lather-volume'];
    const latherDensity = targets['lather-density'];

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

// ============================================
// YOLO Recipe Generator
// ============================================

/**
 * Generate a random recipe with properties in acceptable ranges
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} options - {excludeFats, lockedFats (IDs only), minFats, maxFats, maxAttempts}
 * @returns {Object|null} {recipe, properties} or null if no valid recipe found
 */
export function generateRandomRecipe(fatsDatabase, options = {}) {
    const excludeFats = new Set(options.excludeFats || []);
    const lockedFatIds = options.lockedFats || []; // Array of fat IDs (presence locked, not percentage)
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
 * @param {Array} fatIds - Array of fat IDs
 * @param {number} targetTotal - Target total percentage (e.g., 60 if 40% is locked)
 * @returns {Array} Array of {id, percentage}
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

// ============================================
// Cupboard Cleaner - Suggest Fats to Improve Recipe
// ============================================

/**
 * Score a fat by how well it improves out-of-range properties
 * @param {Object} fat - Fat data with fattyAcids
 * @param {Object} currentProperties - Current calculated properties
 * @param {Object} propertyRanges - PROPERTY_RANGES object
 * @returns {number} Score (higher = better improvement potential)
 */
function scoreFatForPropertyImprovement(fat, currentProperties, propertyRanges) {
    let score = 0;
    const fa = fat.details?.fattyAcids || fat.fattyAcids;

    // Check each property and score based on how much this fat could help
    const propertyMap = {
        hardness: ['lauric', 'myristic', 'palmitic', 'stearic'],
        degreasing: ['lauric', 'myristic'],
        moisturizing: ['oleic', 'ricinoleic', 'linoleic', 'linolenic'],
        'lather-volume': ['lauric', 'myristic', 'ricinoleic'],
        'lather-density': ['palmitic', 'stearic', 'ricinoleic']
    };

    for (const [prop, acids] of Object.entries(propertyMap)) {
        const range = propertyRanges[prop];
        if (!range) continue;

        const current = currentProperties[prop] || 0;
        const fatContribution = acids.reduce((sum, acid) => sum + (fa[acid] || 0), 0);

        if (current < range.min) {
            // Need more of this property - fat is helpful if it contributes
            score += Math.min(range.min - current, fatContribution) * 2;
        } else if (current > range.max) {
            // Have too much of this property - fat is helpful if it contributes less
            const overshoot = current - range.max;
            if (fatContribution < overshoot) {
                score += 1; // Small bonus for not making it worse
            } else {
                score -= (fatContribution - overshoot); // Penalty for making it worse
            }
        }
    }

    return score;
}

/**
 * Suggest fats to improve a recipe with fixed base fats
 * @param {Array} baseFats - User's cupboard fats {id, weight}
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} options - {excludeFats, maxSuggestions, lockedSuggestions, allowRatioAdjustments}
 * @returns {Object} {suggestions, currentProperties, improvedProperties, allInRange}
 */
export function suggestFatsForCupboard(baseFats, fatsDatabase, options = {}) {
    const excludeFats = new Set(options.excludeFats || []);
    const maxSuggestions = options.maxSuggestions || 3;
    const lockedSuggestions = options.lockedSuggestions || []; // Array of {id, percentage}
    const allowRatioAdjustments = options.allowRatioAdjustments || false;
    const maxAttempts = options.maxAttempts || 30;

    // Calculate total weight and percentages from base fats
    const totalBaseWeight = baseFats.reduce((sum, f) => sum + f.weight, 0);
    if (totalBaseWeight === 0) {
        return { suggestions: [], currentProperties: {}, improvedProperties: {}, allInRange: false };
    }

    // Convert base fats to percentages
    const baseRecipe = baseFats.map(f => ({
        id: f.id,
        percentage: (f.weight / totalBaseWeight) * 100
    }));

    // Calculate current properties
    const currentFattyAcids = calculateFattyAcidsFromPercentages(baseRecipe, fatsDatabase);
    const currentProperties = calculateProperties(currentFattyAcids);

    // Check if already in range
    if (allPropertiesInRange(currentProperties)) {
        return {
            suggestions: [],
            currentProperties,
            improvedProperties: currentProperties,
            allInRange: true
        };
    }

    // Get available fats for suggestions (excluding base fats and explicit exclusions)
    const baseFatIds = new Set(baseFats.map(f => f.id));
    const lockedIds = new Set(lockedSuggestions.map(f => f.id));
    const availableFats = Object.entries(fatsDatabase)
        .filter(([id]) => !excludeFats.has(id) && !baseFatIds.has(id) && !lockedIds.has(id))
        .map(([id, data]) => ({ id, ...data }));

    // Score fats by how well they improve out-of-range properties
    const scoredFats = availableFats
        .map(fat => ({
            ...fat,
            score: scoreFatForPropertyImprovement(fat, currentProperties, PROPERTY_RANGES)
        }))
        .filter(fat => fat.score > 0) // Only consider fats that could help
        .sort((a, b) => b.score - a.score);

    // Start with locked suggestions
    let selectedSuggestions = [...lockedSuggestions];
    let bestResult = null;

    // Try adding fats greedily
    for (let attempt = 0; attempt < maxAttempts && selectedSuggestions.length < maxSuggestions; attempt++) {
        let bestFat = null;
        let bestScore = -Infinity;
        let bestRecipe = null;
        let bestProperties = null;

        for (const fat of scoredFats) {
            if (selectedSuggestions.some(s => s.id === fat.id)) continue;

            // Try this fat as a suggestion
            const testSuggestions = [...selectedSuggestions, { id: fat.id, percentage: 0 }];

            // Determine the split: base fats get a portion, suggestions get a portion
            // Start with 80% base fats, 20% suggestions, optimize from there
            const combinedRecipe = optimizeCupboardRecipe(
                baseRecipe,
                testSuggestions,
                fatsDatabase,
                allowRatioAdjustments
            );

            const testFattyAcids = calculateFattyAcidsFromPercentages(combinedRecipe, fatsDatabase);
            const testProperties = calculateProperties(testFattyAcids);

            // Score based on how many properties are now in range
            let score = 0;
            for (const prop of ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density']) {
                const range = PROPERTY_RANGES[prop];
                if (testProperties[prop] >= range.min && testProperties[prop] <= range.max) {
                    score += 20;
                } else {
                    // Partial credit for getting closer
                    const currentDist = Math.abs(currentProperties[prop] - (range.min + range.max) / 2);
                    const newDist = Math.abs(testProperties[prop] - (range.min + range.max) / 2);
                    if (newDist < currentDist) {
                        score += 10 * (1 - newDist / currentDist);
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestFat = fat;
                bestRecipe = combinedRecipe;
                bestProperties = testProperties;
            }
        }

        if (bestFat) {
            // Extract the suggestion's percentage from the optimized recipe
            const suggestionEntry = bestRecipe.find(r => r.id === bestFat.id);
            selectedSuggestions.push({
                id: bestFat.id,
                percentage: suggestionEntry?.percentage || 10
            });

            bestResult = {
                recipe: bestRecipe,
                properties: bestProperties
            };

            // Check if we're now in range
            if (allPropertiesInRange(bestProperties)) {
                break;
            }
        } else {
            break; // No more helpful fats found
        }
    }

    if (selectedSuggestions.length === 0) {
        return {
            suggestions: [],
            currentProperties,
            improvedProperties: currentProperties,
            allInRange: false
        };
    }

    // Final optimization to get weights
    const finalRecipe = optimizeCupboardRecipe(
        baseRecipe,
        selectedSuggestions,
        fatsDatabase,
        allowRatioAdjustments
    );

    const finalFattyAcids = calculateFattyAcidsFromPercentages(finalRecipe, fatsDatabase);
    const improvedProperties = calculateProperties(finalFattyAcids);

    // Convert suggestions to weights based on a reasonable addition
    // Assume we add enough to make suggestions ~20-30% of total
    const suggestionTotalPercent = selectedSuggestions.reduce((sum, s) => {
        const entry = finalRecipe.find(r => r.id === s.id);
        return sum + (entry?.percentage || 0);
    }, 0);

    // Calculate weights: suggestions add to the base total
    // If suggestions are 25% of new total, they add 33% of base weight
    const suggestionWeight = totalBaseWeight * (suggestionTotalPercent / (100 - suggestionTotalPercent));

    const suggestions = selectedSuggestions.map(s => {
        const entry = finalRecipe.find(r => r.id === s.id);
        const percentage = entry?.percentage || 0;
        // Weight proportional to percentage within suggestions
        const weight = suggestionTotalPercent > 0
            ? Math.round((percentage / suggestionTotalPercent) * suggestionWeight * 10) / 10
            : 0;
        return { id: s.id, percentage: Math.round(percentage), weight };
    });

    return {
        suggestions,
        currentProperties,
        improvedProperties,
        allInRange: allPropertiesInRange(improvedProperties)
    };
}

/**
 * Optimize a combined recipe of base fats and suggestions
 * @param {Array} baseRecipe - Base fats with percentages
 * @param {Array} suggestions - Suggested fats (percentages will be optimized)
 * @param {Object} fatsDatabase - Fat database
 * @param {boolean} allowRatioAdjustments - Whether to adjust base fat ratios
 * @returns {Array} Optimized combined recipe
 */
function optimizeCupboardRecipe(baseRecipe, suggestions, fatsDatabase, allowRatioAdjustments) {
    // Start with base fats at 75% of total, suggestions at 25%
    const basePortion = 0.75;
    const suggestionPortion = 0.25;

    // Scale base recipe
    let combined = baseRecipe.map(f => ({
        id: f.id,
        percentage: f.percentage * basePortion,
        isBase: true
    }));

    // Add suggestions with equal distribution of remaining portion
    const suggPerFat = suggestionPortion * 100 / suggestions.length;
    for (const s of suggestions) {
        combined.push({
            id: s.id,
            percentage: suggPerFat,
            isBase: false
        });
    }

    // Normalize to 100%
    const total = combined.reduce((sum, r) => sum + r.percentage, 0);
    combined.forEach(r => r.percentage = (r.percentage / total) * 100);

    // Iterative optimization
    const stepSize = 2;
    const iterations = 50;

    for (let iter = 0; iter < iterations; iter++) {
        const currentFA = calculateFattyAcidsFromPercentages(combined, fatsDatabase);
        const currentProps = calculateProperties(currentFA);

        if (allPropertiesInRange(currentProps)) break;

        let improved = false;

        // Try adjusting pairs (only suggestion-suggestion or suggestion-base if allowed)
        for (let i = 0; i < combined.length; i++) {
            for (let j = i + 1; j < combined.length; j++) {
                // Skip if both are base and ratio adjustments not allowed
                if (combined[i].isBase && combined[j].isBase && !allowRatioAdjustments) {
                    continue;
                }

                // Try increasing i, decreasing j
                const test1 = combined.map((r, idx) => {
                    if (idx === i) return { ...r, percentage: Math.min(80, r.percentage + stepSize) };
                    if (idx === j) return { ...r, percentage: Math.max(5, r.percentage - stepSize) };
                    return { ...r };
                });
                const total1 = test1.reduce((s, r) => s + r.percentage, 0);
                test1.forEach(r => r.percentage = (r.percentage / total1) * 100);

                const fa1 = calculateFattyAcidsFromPercentages(test1, fatsDatabase);
                const props1 = calculateProperties(fa1);
                const score1 = scorePropertiesInRange(props1);

                // Try increasing j, decreasing i
                const test2 = combined.map((r, idx) => {
                    if (idx === j) return { ...r, percentage: Math.min(80, r.percentage + stepSize) };
                    if (idx === i) return { ...r, percentage: Math.max(5, r.percentage - stepSize) };
                    return { ...r };
                });
                const total2 = test2.reduce((s, r) => s + r.percentage, 0);
                test2.forEach(r => r.percentage = (r.percentage / total2) * 100);

                const fa2 = calculateFattyAcidsFromPercentages(test2, fatsDatabase);
                const props2 = calculateProperties(fa2);
                const score2 = scorePropertiesInRange(props2);

                const currentScore = scorePropertiesInRange(currentProps);

                if (score1 > currentScore && score1 >= score2) {
                    combined = test1;
                    improved = true;
                    break;
                } else if (score2 > currentScore) {
                    combined = test2;
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }

        if (!improved) break;
    }

    // Round percentages and return without isBase flag
    return combined.map(r => ({
        id: r.id,
        percentage: Math.round(r.percentage * 10) / 10
    }));
}

/**
 * Score how well properties are within ranges (higher = better)
 * @param {Object} properties - Calculated properties
 * @returns {number} Score
 */
function scorePropertiesInRange(properties) {
    let score = 0;

    for (const prop of ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density']) {
        const range = PROPERTY_RANGES[prop];
        const val = properties[prop] || 0;

        if (val >= range.min && val <= range.max) {
            score += 100; // Full points for being in range
        } else {
            // Partial credit based on distance from range
            const dist = val < range.min
                ? range.min - val
                : val - range.max;
            score += Math.max(0, 50 - dist * 2);
        }
    }

    return score;
}
