/**
 * Profile matching: greedily select fats that best match a target fatty acid
 * profile, then optimise their weights.
 */

import { PROFILE } from '../../lib/constants.js';
import { calculateFattyAcidsFromPercentages, calculateProperties } from '../calculator.js';
import { calculateProfileError, calculateMatchQuality, scoreFatForTarget } from './scoring.js';
import { optimizeWeights } from './weights.js';

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
