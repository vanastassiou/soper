/**
 * Form settings extraction (lye type, superfat, water ratio, recipe weight).
 */

import { DEFAULTS, ELEMENT_IDS } from '../lib/constants.js';
import { $, parseFloatOr } from './helpers.js';

/**
 * Get current settings from form
 * @returns {{lyeType: string, processType: string, superfat: number, waterRatio: number, recipeWeight: number}}
 */
export function getSettings() {
    return {
        lyeType: $(ELEMENT_IDS.lyeType)?.value || 'NaOH',
        processType: $(ELEMENT_IDS.processType)?.value || 'cold',
        superfat: parseFloatOr($(ELEMENT_IDS.superfat)?.value, 0),
        waterRatio: parseFloatOr($(ELEMENT_IDS.waterRatio)?.value, 2),
        recipeWeight: parseFloatOr($(ELEMENT_IDS.recipeWeight)?.value, DEFAULTS.BASE_RECIPE_WEIGHT)
    };
}
