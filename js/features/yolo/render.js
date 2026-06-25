/**
 * YOLO mode renderer.
 * Builds the rowFor function used by renderList for the random-recipe list.
 */

import { renderItemRow } from '../../ui/components/itemRow.js';

/**
 * Curried row builder for renderList.
 * @param {Object} fatsDatabase
 * @param {Set} lockedIndices
 * @returns {(item: {id: string, percentage: number}, index: number) => string}
 */
export function yoloRowFor(fatsDatabase, lockedIndices) {
    return (item, index) => {
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
    };
}
