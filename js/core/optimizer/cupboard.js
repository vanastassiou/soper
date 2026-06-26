/**
 * Cupboard cleaner: given fats the user already owns, suggest additional fats
 * (and percentages) that move the recipe's properties into range.
 */

import { PROPERTY_RANGES, allPropertiesInRange } from '../../lib/constants.js';
import { calculateFattyAcidsFromPercentages, calculateProperties } from '../calculator.js';
import { scoreFatForPropertyImprovement, scorePropertiesInRange } from './scoring.js';

const RANGE_PROPERTIES = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];

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
            for (const prop of RANGE_PROPERTIES) {
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
