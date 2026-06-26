/**
 * Dietary filtering wiring.
 *
 * Reads the dietary-filter checkboxes and manual exclusions from the DOM and
 * turns them into: a predicate for the ingredient selects, the repopulation of
 * the fat select, and the combined exclusion list passed to the optimizer-backed
 * build modes. Extracted from main.js so the composition root stays small
 * (ARCHITECTURE_RISKS Risk 2).
 */

import { ELEMENT_IDS } from '../lib/constants.js';
import { hasSignificantEthicalConcerns } from '../lib/dietary.js';
import * as optimizer from '../core/optimizer.js';
import { state } from '../state/state.js';
import { $ } from '../ui/helpers.js';
import { populateExcludeIngredientSelect } from '../ui/exclusions.js';
import { populateFatSelect } from '../features/selectFats/render.js';

/**
 * Get all ingredient databases for exclusion filtering
 * @returns {Object} Object containing all ingredient databases
 */
export function getAllIngredientDatabases() {
    return {
        fats: state.fatsDatabase,
        fragrances: state.fragrancesDatabase,
        colourants: state.colourantsDatabase,
        soapPerformance: state.soapPerformanceDatabase,
        skinCare: state.skinCareDatabase
    };
}

/**
 * Get the current dietary filter selections from the UI
 * @returns {{animalBased: boolean, sourcingConcerns: boolean, commonAllergens: boolean, includeExoticFats: boolean}}
 */
export function getDietaryFilters() {
    return {
        animalBased: $(ELEMENT_IDS.filterAnimalBased)?.checked || false,
        sourcingConcerns: $(ELEMENT_IDS.filterSourcingConcerns)?.checked || false,
        commonAllergens: $(ELEMENT_IDS.filterCommonAllergens)?.checked || false,
        includeExoticFats: $(ELEMENT_IDS.includeExoticFats)?.checked || false
    };
}

/**
 * Create a filter function based on current dietary filter settings and manual exclusions
 * Applies to all ingredient types (fats, colourants, fragrances, etc.)
 * @returns {Function|null} Filter function or null if no filters active
 */
export function createDietaryFilterFn() {
    const filters = getDietaryFilters();
    const manualExclusions = new Set(state.excludedFats);
    const hasFilters = filters.animalBased || filters.sourcingConcerns || filters.commonAllergens;
    const hasExclusions = manualExclusions.size > 0;
    // Exotic fats are excluded by default (unless includeExoticFats is checked)
    const excludeExotic = !filters.includeExoticFats;

    if (!hasFilters && !hasExclusions && !excludeExotic) {
        return null;
    }

    return (id, data) => {
        // Check manual exclusions first
        if (manualExclusions.has(id)) return false;

        // Check dietary filters
        const dietary = data.dietary || {};
        if (filters.animalBased && dietary.animalBased === true) return false;
        if (filters.sourcingConcerns && hasSignificantEthicalConcerns(data)) return false;
        if (filters.commonAllergens && dietary.commonAllergen === true) return false;
        // Exotic fats: exclude when NOT checked (opposite of other filters)
        if (excludeExotic && dietary.isExotic === true) return false;
        return true;
    };
}

/**
 * Repopulate fat select dropdown with current dietary filters applied
 */
export function updateFatSelectWithFilters() {
    const filterFn = createDietaryFilterFn();
    const existingIds = state.recipe.map(f => f.id);
    populateFatSelect($(ELEMENT_IDS.fatSelect), state.fatsDatabase, existingIds, filterFn);

    // Also update exclude ingredient select
    const allDatabases = getAllIngredientDatabases();
    populateExcludeIngredientSelect($(ELEMENT_IDS.excludeIngredientSelect), allDatabases, state.excludedFats);
}

/**
 * Get combined exclusions from manual exclusions and dietary filters
 * @returns {Array} Array of fat IDs to exclude
 */
export function getCombinedExclusions() {
    const dietaryFilters = getDietaryFilters();
    const dietaryExclusions = optimizer.getDietaryExclusions(state.fatsDatabase, dietaryFilters);
    return [...state.excludedFats, ...state.suggestionExcludedFats, ...dietaryExclusions];
}
