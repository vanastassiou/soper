/**
 * Dietary filtering for ingredient databases.
 *
 * Wraps the shared `hasSignificantEthicalConcerns` predicate to turn a set of
 * dietary filter toggles into the set of ingredient IDs that should be excluded.
 */

import { hasSignificantEthicalConcerns } from '../../lib/dietary.js';

/** @typedef {import('../../lib/types.js').Fat} Fat */
/** @typedef {import('../../lib/types.js').FatsDatabase} FatsDatabase */
/** @typedef {import('../../lib/types.js').FattyAcids} FattyAcids */
/** @typedef {import('../../lib/types.js').PropertyValues} PropertyValues */


/**
 * Filter ingredients based on dietary requirements
 * Works with any ingredient database (fats, colourants, fragrances, etc.)
 * @param {FatsDatabase} database - Ingredient database
 * @param {Object<string, any>} dietaryFilters - {animalBased, sourcingConcerns, commonAllergens, includeExoticFats}
 * @returns {Set<string>} Set of ingredient IDs that should be excluded
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
