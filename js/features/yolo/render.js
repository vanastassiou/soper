/**
 * YOLO mode renderer.
 * Pure HTML generation for the random-recipe row list.
 */

import { renderItemRow } from '../../ui/components/itemRow.js';

/**
 * Build the YOLO recipe row HTML.
 * @param {Array} recipe - [{id, percentage}]
 * @param {Object} fatsDatabase
 * @param {Set} lockedIndices
 * @returns {string} HTML for the row list
 */
export function renderYoloRows(recipe, fatsDatabase, lockedIndices) {
    return recipe.map((item, index) => {
        const fat = fatsDatabase[item.id];
        return renderItemRow({
            id: item.id,
            name: fat?.name || item.id,
            percentage: item.percentage,
            isLocked: lockedIndices.has(index)
        }, index, {
            showWeight: false,
            showPercentage: true,
            lockableField: 'percentage',
            showExcludeButton: true,
            itemType: 'fat'
        });
    }).join('');
}
