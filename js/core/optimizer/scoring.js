/**
 * Optimizer scoring and error functions.
 *
 * Pure functions that score how well a fat or recipe matches a target. Shared
 * by the weight optimiser, profile matcher, recipe generator, and cupboard
 * suggester. This module is the leaf of the optimizer dependency graph: it
 * imports only constants.
 */

import { PROFILE, PROPERTY_RANGES, isValidTarget } from '../../lib/constants.js';

/** @typedef {import('../../lib/types.js').Fat} Fat */
/** @typedef {import('../../lib/types.js').FattyAcids} FattyAcids */
/** @typedef {import('../../lib/types.js').PropertyValues} PropertyValues */

const RANGE_PROPERTIES = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];

/**
 * Calculate error between current and target fatty acid profiles
 * Uses sum of squared differences for specified targets only
 * @param {FattyAcids} current - Current fatty acid profile
 * @param {Object<string, any>} target - Target fatty acid percentages (only specified keys are compared)
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
 * @param {Fat} fat - Fat data
 * @param {Object<string, any>} targetProfile - Target fatty acid percentages
 * @param {FattyAcids} currentProfile - Current achieved profile (can be empty)
 * @returns {number} Score (higher is better)
 */
export function scoreFatForTarget(fat, targetProfile, currentProfile = {}) {
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

/**
 * Calculate match quality as percentage
 * @param {FattyAcids} achieved - Achieved fatty acid profile
 * @param {Object<string, any>} target - Target profile
 * @returns {number} Match quality 0-100
 */
export function calculateMatchQuality(achieved, target) {
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

/**
 * Score a fat by how well it improves out-of-range properties
 * @param {Fat} fat - Fat data with fattyAcids
 * @param {PropertyValues} currentProperties - Current calculated properties
 * @param {Object<string, {min: number, max: number}>} propertyRanges - PROPERTY_RANGES object
 * @returns {number} Score (higher = better improvement potential)
 */
export function scoreFatForPropertyImprovement(fat, currentProperties, propertyRanges) {
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
 * Score how well properties are within ranges (higher = better)
 * @param {PropertyValues} properties - Calculated properties
 * @returns {number} Score
 */
export function scorePropertiesInRange(properties) {
    let score = 0;
    const ranges = /** @type {Object<string, {min: number, max: number}>} */ (PROPERTY_RANGES);

    for (const prop of RANGE_PROPERTIES) {
        const range = ranges[prop];
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
