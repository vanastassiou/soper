/**
 * Weight optimisation: distribute percentages across a fixed set of fats to
 * minimise fatty-acid profile error.
 *
 * Algorithm: iterative gradient descent with O(n^2) pair swaps per iteration.
 * Stops at PROFILE.OPTIMIZER_ITERATIONS or when error < CONVERGENCE_THRESHOLD.
 * Not globally optimal, but produces good practical results.
 */

import { PROFILE } from '../../lib/constants.js';
import { calculateFattyAcidsFromPercentages } from '../calculator.js';
import { calculateProfileError } from './scoring.js';

/**
 * Optimize weights for selected fats to minimize profile error
 * Complexity: O(iterations * n^2) where n = number of fats
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
