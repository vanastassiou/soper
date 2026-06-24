/**
 * Shared property-display helpers.
 * Used by every build mode (Select Fats, YOLO, Cupboard, Profile) to push
 * computed soap properties into the results panel.
 */

import * as calc from '../core/calculator.js';
import { PROPERTY_KEYS, PROPERTY_RANGES } from '../lib/constants.js';
import { updateProperty } from './ui.js';

/**
 * Update every property cell from a {hardness, degreasing, ...} object.
 */
export function applyPropertyUpdates(properties) {
    PROPERTY_KEYS.forEach(key => {
        const range = PROPERTY_RANGES[key];
        updateProperty(key, properties[key], range.min, range.max);
    });
}

/**
 * Calculate and display properties from a list of {id, weight} fats.
 * Pass an empty array to reset the display.
 */
export function updatePropertiesFromFats(fats, fatsDatabase) {
    if (!fats || fats.length === 0) {
        applyPropertyUpdates(Object.fromEntries(PROPERTY_KEYS.map(k => [k, 0])));
        return;
    }
    const fa = calc.calculateFattyAcids(fats, fatsDatabase);
    const properties = calc.calculateProperties(fa);
    const iodine = calc.calculateIodine(fats, fatsDatabase);
    const ins = calc.calculateINS(fats, fatsDatabase);
    applyPropertyUpdates({ ...properties, iodine, ins });
}
