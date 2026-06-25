/**
 * Pure calculation functions for soapmaking
 * No DOM dependencies to enable independent unit testing
 */

import {
    CALCULATION,
    FATTY_ACID_KEYS,
    initFattyAcids,
    NOTE_ICONS,
    NOTE_THRESHOLDS,
    NOTE_TYPES,
    PROPERTY_RANGES,
    SPECIAL_FATS,
    VOLUME
} from '../lib/constants.js';

// ============================================
// Core calculations
// ============================================

/**
 * Calculate lye required
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with SAP values
 * @param {string} lyeType - 'NaOH' or 'KOH'
 * @param {number} superfat - Superfat percentage (0-20)
 * @returns {number} Lye amount in same units as fat weights
 */
export function calculateLye(recipe, fatsDatabase, lyeType, superfat) {
    const sapKey = lyeType === 'NaOH' ? 'naoh' : 'koh';
    const totalLye = recipe.reduce((sum, r) => {
        const fat = fatsDatabase[r.id];
        const sap = fat?.details?.sap?.[sapKey] ?? fat?.sap?.[sapKey] ?? 0;
        return sum + r.weight * sap;
    }, 0);
    return totalLye * (1 - superfat / 100);
}

/**
 * Calculate water amount based on lye and water ratio
 * @param {number} lyeAmount - Amount of lye
 * @param {number} waterRatio - Water to lye ratio (e.g., 2 for 2:1)
 * @returns {number} Water amount
 */
export function calculateWater(lyeAmount, waterRatio) {
    return lyeAmount * waterRatio;
}

/**
 * Core fatty acid calculation; calculates weighted fatty acid profile
 * @param {Array} recipe - Array of {id, value} objects
 * @param {Object} fatsDatabase - Fat data with fatty acid profiles
 * @param {string} valueKey - Property name for the value ('weight' or 'percentage')
 * @returns {Object} Weighted fatty acid percentages
 */

function calculateFattyAcidsCore(recipe, fatsDatabase, valueKey) {
    const fa = initFattyAcids();
    const total = recipe.reduce((sum, item) => sum + item[valueKey], 0);
    if (total === 0) return fa;

    return recipe.reduce((acc, r) => {
        const fat = fatsDatabase[r.id];
        if (fat) {
            const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
            const fraction = r[valueKey] / total;
            FATTY_ACID_KEYS.forEach(acid => {
                acc[acid] += (fattyAcids?.[acid] ?? 0) * fraction;
            });
        }
        return acc;
    }, fa);
}

/**
 * Calculate fatty acid profile for a recipe using weights
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with fatty acid profiles
 * @returns {Object} Weighted fatty acid percentages
 */
export function calculateFattyAcids(recipe, fatsDatabase) {
    return calculateFattyAcidsCore(recipe, fatsDatabase, 'weight');
}

/**
 * Calculate fatty acid profile for a recipe using percentages
 * @param {Array} recipe - Array of {id, percentage} objects
 * @param {Object} fatsDatabase - Fat data with fatty acid profiles
 * @returns {Object} Weighted fatty acid percentages
 */
export function calculateFattyAcidsFromPercentages(recipe, fatsDatabase) {
    return calculateFattyAcidsCore(recipe, fatsDatabase, 'percentage');
}

/**
 * Calculate weighted average of a fat property across a recipe
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat database
 * @param {string} property - Property name to average (e.g., 'iodine', 'ins')
 * @returns {number} Weighted average value
 */
function calculateWeightedAverage(recipe, fatsDatabase, property) {
    const totalFats = recipe.reduce((sum, r) => sum + r.weight, 0);
    if (totalFats === 0) return 0;

    return recipe.reduce((sum, r) => {
        const fat = fatsDatabase[r.id];
        return sum + (fat?.details?.[property] ?? 0) * (r.weight / totalFats);
    }, 0);
}

/**
 * Calculate iodine value for a recipe
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with iodine values
 * @returns {number} Weighted iodine value
 */
export function calculateIodine(recipe, fatsDatabase) {
    return calculateWeightedAverage(recipe, fatsDatabase, 'iodine');
}

/**
 * Calculate INS value for a recipe
 * @param {Array} recipe - Array of {id, weight} objects
 * @param {Object} fatsDatabase - Fat data with INS values
 * @returns {number} Weighted INS value
 */
export function calculateINS(recipe, fatsDatabase) {
    return calculateWeightedAverage(recipe, fatsDatabase, 'ins');
}

/**
 * Calculate soap properties from fatty acid profile
 * @param {Object} fa - Fatty acid profile
 * @returns {Object} Soap properties (hardness, degreasing, etc.)
 */
export function calculateProperties(fa) {
    return {
        hardness: (fa.caprylic || 0) + (fa.capric || 0) + fa.lauric + fa.myristic + fa.palmitic + fa.stearic + (fa.arachidic || 0) + (fa.behenic || 0),
        degreasing: (fa.caprylic || 0) + (fa.capric || 0) + fa.lauric + fa.myristic,
        moisturizing: (fa.palmitoleic || 0) + fa.oleic + fa.ricinoleic + fa.linoleic + fa.linolenic + (fa.erucic || 0),
        'lather-volume': fa.lauric + fa.myristic + fa.ricinoleic,
        'lather-density': fa.palmitic + fa.stearic + fa.ricinoleic
    };
}

// ============================================
// Fat Property Description Generation
// ============================================

const LEVEL_TO_NUM = {
    'very low': 1,
    'low': 2,
    'moderate': 3,
    'high': 4,
    'very high': 5
};

const NUM_TO_LEVEL = ['', 'very low', 'low', 'moderate', 'high', 'very high'];

/**
 * Calculate weighted soap property values from dominant fatty acids
 * @param {Object} fat - Fat object with fattyAcids percentages
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @returns {{hardness: string, degreasing: string, lather: string, moisturizing: string}|null}
 */
function calculateWeightedSoapProperties(fat, fattyAcidsData) {
    const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
    if (!fattyAcids) return null;

    // Get fatty acids above the dominant threshold
    const dominant = Object.entries(fattyAcids)
        .filter(([_, pct]) => pct >= CALCULATION.DOMINANT_FATTY_ACID_THRESHOLD)
        .sort((a, b) => b[1] - a[1]);

    if (dominant.length === 0) return null;

    // Calculate weighted properties
    let totalWeight = 0;
    let weightedHardness = 0;
    let weightedDegreasing = 0;
    let weightedMoisturizing = 0;
    const latherDescriptions = [];

    dominant.forEach(([acidKey, pct]) => {
        const acidData = fattyAcidsData[acidKey];
        const props = acidData?.details?.soapProperties ?? acidData?.soapProperties;
        if (!props) return;
        totalWeight += pct;

        weightedHardness += (LEVEL_TO_NUM[props.hardness] || 3) * pct;
        weightedDegreasing += (LEVEL_TO_NUM[props.degreasing] || 3) * pct;
        weightedMoisturizing += (LEVEL_TO_NUM[props.moisturizing] || 3) * pct;

        if (props.lather && !latherDescriptions.includes(props.lather)) {
            latherDescriptions.push(props.lather);
        }
    });

    if (totalWeight === 0) return null;

    return {
        hardness: NUM_TO_LEVEL[Math.round(weightedHardness / totalWeight)] || 'moderate',
        degreasing: NUM_TO_LEVEL[Math.round(weightedDegreasing / totalWeight)] || 'moderate',
        lather: latherDescriptions[0] || 'moderate',
        moisturizing: NUM_TO_LEVEL[Math.round(weightedMoisturizing / totalWeight)] || 'moderate'
    };
}

/**
 * Get structured soap properties for a fat
 * @param {Object} fat - Fat object with fattyAcids percentages
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @returns {{hardness: string, degreasing: string, lather: string, moisturizing: string}|null}
 */
export function getFatSoapProperties(fat, fattyAcidsData) {
    return calculateWeightedSoapProperties(fat, fattyAcidsData);
}

/**
 * Generate qualitative soap properties description for a fat
 * @param {Object} fat - Fat object with fattyAcids percentages
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @returns {string} Prose description of soap properties
 */
export function generateFatProperties(fat, fattyAcidsData) {
    const props = calculateWeightedSoapProperties(fat, fattyAcidsData);
    if (!props) {
        const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
        return fattyAcids ? 'Minimal fatty acid contribution.' : '';
    }

    const parts = [];

    // Combine similar levels
    if (props.hardness === props.degreasing) {
        parts.push(`${props.hardness} hardness and degreasing.`);
    } else {
        parts.push(`${props.hardness} hardness. ${props.degreasing} degreasing.`);
    }

    // Add lather description
    if (props.lather !== 'moderate') {
        parts.push(props.lather + ' lather.');
    }

    parts.push(`${props.moisturizing} moisturizing.`);

    return parts.join(' ');
}

// ============================================
// Volume Calculation
// ============================================

/**
 * Calculate estimated volume range of soap batch
 * @param {Array} recipe - [{id, weight}, ...]
 * @param {Object} fatsDatabase - Fat data with density values
 * @param {number} lyeAmount - Lye weight in grams
 * @param {number} waterAmount - Water weight in grams
 * @returns {{min: number, max: number}} Volume range in mL
 */
export function calculateVolume(recipe, fatsDatabase, lyeAmount, waterAmount) {
    const totalFatWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    if (totalFatWeight === 0) return { min: 0, max: 0 };

    // Calculate weighted average fat density
    const avgFatDensity = recipe.reduce((sum, fat) => {
        const data = fatsDatabase[fat.id];
        const density = data?.details?.density ?? data?.density ?? VOLUME.DEFAULT_FAT_DENSITY;
        return sum + (fat.weight / totalFatWeight) * density;
    }, 0);

    // Volume components in mL
    const fatVolumeML = totalFatWeight / avgFatDensity;
    const waterVolumeML = waterAmount / VOLUME.WATER_DENSITY;
    const lyeVolumeML = lyeAmount / VOLUME.NAOH_DENSITY;

    // Base volume with saponification reduction
    const baseVolumeML = (fatVolumeML + waterVolumeML + lyeVolumeML) * VOLUME.SAPONIFICATION_REDUCTION;

    return {
        min: Math.round(baseVolumeML * VOLUME.UNCERTAINTY_MIN),
        max: Math.round(baseVolumeML * VOLUME.UNCERTAINTY_MAX)
    };
}

// ============================================
// Recipe Notes
// ============================================

/**
 * Check hardness and generate note if needed
 */
function checkHardness(properties) {
    const R = PROPERTY_RANGES;

    if (properties.hardness < R.hardness.min) {
        return {
            type: NOTE_TYPES.WARNING,
            icon: NOTE_ICONS.SOFT_BAR,
            text: `Soft bar; may take a longer time to unmould and disappear more quickly down the drain. Sodium lactate or salt can help speed curing time.`
        };
    }
    if (properties.hardness > R.hardness.max) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.HARD_BAR,
            text: `Very hard bar; may be brittle or waxy; if moulding the soap as a loaf that you plan to cut into bars, cut it before curing to lower the chances of cracking.`
        };
    }
    return null;
}

/**
 * Check degreasing and generate note if needed
 */
function checkDegreasing(properties) {
    const T = NOTE_THRESHOLDS;

    if (properties.degreasing > T.HIGH_DEGREASING) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.HIGH_CLEANSING,
            text: `High degreasing ability; excellent for utility soap, but frequent use will dry your skin.`
        };
    }
    if (properties.degreasing < T.LOW_DEGREASING) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.LOW_CLEANSING,
            text: `Low degreasing ability; good for sensitive skin, but not appropriate for high-cleansing needs like kitchen or workshop soaps.`
        };
    }
    return null;
}

/**
 * Check shelf stability (polyunsaturated fatty acids)
 */
function checkShelfStability(_properties, fa) {
    const T = NOTE_THRESHOLDS;
    const polyunsaturated = fa.linoleic + fa.linolenic;

    if (polyunsaturated > T.HIGH_POLYUNSATURATED) {
        return {
            type: NOTE_TYPES.WARNING,
            icon: NOTE_ICONS.SHELF_STABILITY,
            text: `High polyunsaturate content; prone to rancidity (Dreaded Orange Spots). Mitigate by adding an antioxidant (e.g. 0.02% - 0.05% of total fat weight of rosemary oleoresin extract); curing in a cool, dark place; and using within 8 to 12 months.`
        };
    }
    return null;
}

/**
 * Check linolenic acid level
 */
function checkLinolenic(_properties, fa) {
    const T = NOTE_THRESHOLDS;

    if (fa.linolenic > T.HIGH_LINOLENIC) {
        return {
            type: NOTE_TYPES.WARNING,
            icon: NOTE_ICONS.LINOLENIC,
            text: `High linolenic acid content; very unstable and especially prone to rancidity. Either reduce the ratio of high-linolenic fats to under 5% or accept a shorter shelf life.`
        };
    }
    return null;
}

/**
 * Check lather properties
 */
function checkLather(properties) {
    const R = PROPERTY_RANGES;

    if (properties['lather-volume'] < R['lather-volume'].min && properties['lather-density'] < 20) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.LOW_LATHER,
            text: `Low lathering capability; this doesn't affect cleansing ability, but if you want to improve the textural experience on skin, consider adding coconut oil for bubbles or castor oil for lather stability.`
        };
    }
    return null;
}

/**
 * Check moisturizing vs hardness balance
 */
function checkMoisturizingBalance(properties) {
    const T = NOTE_THRESHOLDS;

    if (properties.moisturizing > T.HIGH_MOISTURIZING && properties.hardness < T.LOW_HARDNESS) {
        return {
            type: NOTE_TYPES.INFO,
            icon: NOTE_ICONS.CONDITIONING_BALANCE,
            text: `Highly moisturizing; will feel luxurious but may not last long in the shower. Mitigate by adding hard fats high in palmitic or stearic acid (tallow, lard, palm) or sodium lactate for bar hardness.`
        };
    }
    return null;
}

/**
 * Check for castor oil opportunity
 */
function checkCastorOpportunity(properties, _fa, recipe) {
    const T = NOTE_THRESHOLDS;
    const hasCastor = recipe.some(r => r.id === SPECIAL_FATS.CASTOR);

    if (!hasCastor && properties['lather-volume'] < T.LOW_LATHER_VOLUME) {
        return {
            type: NOTE_TYPES.SUCCESS,
            icon: NOTE_ICONS.TIP,
            text: `Adding 3 - 5% castor oil can significantly boost lather stability without affecting other properties much.`
        };
    }
    return null;
}

/**
 * Check if recipe is well-balanced
 */
function checkGoodBalance(properties, fa) {
    const R = PROPERTY_RANGES;
    const T = NOTE_THRESHOLDS;
    const polyunsaturated = fa.linoleic + fa.linolenic;

    const inRange = (prop) => properties[prop] >= R[prop].min && properties[prop] <= R[prop].max;

    if (inRange('hardness') && inRange('degreasing') && inRange('moisturizing') &&
        polyunsaturated <= T.HIGH_POLYUNSATURATED) {
        return {
            type: NOTE_TYPES.SUCCESS,
            icon: NOTE_ICONS.GOOD,
            text: `Well-balanced recipe with good hardness, degreasing, and moisturizing abilities within recommended ranges.`
        };
    }
    return null;
}

/**
 * Generate recipe notes/warnings based on properties
 * @param {Object} properties - Calculated properties
 * @param {Object} fa - Fatty acid profile
 * @param {Array} recipe - Recipe array
 * @returns {Array} Array of note objects {type, icon, text}
 */
export function getRecipeNotes(properties, fa, recipe) {
    if (recipe.length === 0) return [];

    const noteGenerators = [
        checkHardness,
        checkDegreasing,
        checkShelfStability,
        checkLinolenic,
        checkLather,
        checkMoisturizingBalance,
        checkCastorOpportunity,
        checkGoodBalance
    ];

    return noteGenerators
        .map(gen => gen(properties, fa, recipe))
        .filter(note => note !== null);
}

// ============================================
// Additive Calculations
// ============================================

/**
 * Calculate additive amount based on fat weight
 * @param {Object} additive - Additive data from database
 * @param {number} usagePercent - User-specified usage percentage
 * @param {number} totalFatWeight - Total weight of fats in recipe (grams)
 * @returns {number} Calculated weight in grams
 */
export function calculateAdditiveAmount(additive, usagePercent, totalFatWeight) {
    if (!additive || totalFatWeight <= 0) return 0;

    // Currently all additives use fat-weight basis
    // If batch-weight is needed, extend logic here
    if (additive.usage.basis === 'oil-weight') {
        return totalFatWeight * (usagePercent / 100);
    }

    return 0;
}

/**
 * Check if additive usage exceeds safety limits
 * @param {Object} additive - Additive data
 * @param {number} usagePercent - User-specified usage percentage
 * @returns {Array} Array of warning objects {type, message}
 */
export function checkAdditiveWarnings(additive, usagePercent) {
    const warnings = [];

    if (!additive || !additive.safety) return warnings;

    // Check against max safe concentration
    if (additive.safety.maxConcentration && usagePercent > additive.safety.maxConcentration) {
        warnings.push({
            type: 'danger',
            message: `Exceeds maximum safe concentration (${additive.safety.maxConcentration}%)`
        });
    }

    // Check IFRA limit for essential oils
    if (additive.safety.ifraCategory9Limit && usagePercent > additive.safety.ifraCategory9Limit) {
        warnings.push({
            type: 'warning',
            message: `Exceeds IFRA Category 9 limit (${additive.safety.ifraCategory9Limit}%)`
        });
    }

    // Check against recommended max (info only)
    if (usagePercent > additive.usage.max) {
        warnings.push({
            type: 'info',
            message: `Above recommended maximum (${additive.usage.max}%)`
        });
    }

    return warnings;
}

/**
 * Calculate total additives weight and breakdown
 * @param {Array} recipeAdditives - Array of {id, weight}
 * @param {Object} additivesDatabase - Additives data
 * @param {number} totalFatWeight - Total fat weight (grams)
 * @returns {{totalWeight: number, breakdown: Array}}
 */
export function calculateAdditivesTotal(recipeAdditives, additivesDatabase, totalFatWeight) {
    const breakdown = recipeAdditives.map(item => {
        const additive = additivesDatabase[item.id];
        if (!additive) return null;

        const usagePercent = totalFatWeight > 0 ? (item.weight / totalFatWeight) * 100 : 0;
        return {
            id: item.id,
            name: additive.name,
            category: additive.category,
            usagePercent,
            weight: item.weight,
            warnings: checkAdditiveWarnings(additive, usagePercent)
        };
    }).filter(Boolean);

    const totalWeight = breakdown.reduce((sum, item) => sum + item.weight, 0);
    return { totalWeight, breakdown };
}

/**
 * Calculate additive volume contribution
 * @param {Array} recipeAdditives - Additives in recipe {id, weight}
 * @param {Object} additivesDatabase - Database
 * @returns {number} Volume in mL
 */
export function calculateAdditiveVolume(recipeAdditives, additivesDatabase) {
    return recipeAdditives.reduce((sum, item) => {
        const density = additivesDatabase[item.id]?.density ?? 1.0;
        return sum + item.weight / density;
    }, 0);
}
