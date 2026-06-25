/**
 * Cupboard mode renderers.
 * Moved from js/ui/ui.js as part of the per-feature split.
 */

import { populateSelect } from '../../ui/helpers.js';
import {
    renderItemRow,
    renderList,
    renderTotalsRow
} from '../../ui/components/itemRow.js';
import { UI_MESSAGES } from '../../lib/constants.js';

/**
 * Shared cupboard list renderer. The two public entry points below differ
 * only in which trailing button each row shows, which totals label is used,
 * and which callbacks are passed through.
 */
function renderCupboardList(container, items, fatsDatabase, unit, callbacks, options) {
    const {
        emptyMessage,
        rowOptions,
        totalsLabel,
        totalsPrecision
    } = options;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

    renderList(container, items, {
        emptyMessage,
        callbacks,
        totals: items.length > 0
            ? renderTotalsRow(totalsLabel, totalWeight, unit, totalsPrecision)
            : '',
        rowFor: (item, i) => {
            const fatData = fatsDatabase[item.id];
            const percentage = item.percentage != null
                ? item.percentage
                : (totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(1) : 0);

            return renderItemRow({
                id: item.id,
                name: fatData?.name || item.id,
                weight: item.weight,
                percentage,
                isLocked: false
            }, i, {
                inputType: 'weight',
                showWeight: true,
                showPercentage: true,
                lockableField: null,
                unit,
                itemType: 'fat',
                ...rowOptions
            });
        }
    });
}

/**
 * Render cupboard fats (weight input, no locks)
 * @param {HTMLElement} container - Container element
 * @param {Array} cupboardFats - Array of {id, weight}
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 */
export function renderCupboardFats(container, cupboardFats, fatsDatabase, unit, callbacks) {
    renderCupboardList(container, cupboardFats, fatsDatabase, unit, callbacks, {
        emptyMessage: UI_MESSAGES.NO_CUPBOARD_FATS,
        rowOptions: { showRemoveButton: true },
        totalsLabel: 'Total Fats',
        totalsPrecision: 0
    });
}

/**
 * Render cupboard suggestions (display only, no locks)
 * @param {HTMLElement} container - Container element
 * @param {Array} suggestions - Array of {id, weight, percentage}
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onExclude, onInfo}
 */
export function renderCupboardSuggestions(container, suggestions, fatsDatabase, unit, callbacks) {
    renderCupboardList(container, suggestions, fatsDatabase, unit, callbacks, {
        rowOptions: { showExcludeButton: true },
        totalsLabel: 'Total suggested',
        totalsPrecision: 1
    });
}

/**
 * Populate cupboard fat select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} fatsDatabase - Fat database object
 * @param {Array} existingIds - IDs already in cupboard to exclude
 */
export function populateCupboardFatSelect(selectElement, fatsDatabase, existingIds = []) {
    populateSelect(selectElement, fatsDatabase, existingIds);
}
