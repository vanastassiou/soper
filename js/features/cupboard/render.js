/**
 * Cupboard mode renderers.
 * Moved from js/ui/ui.js as part of the per-feature split.
 */

import { populateSelect, setupAbortSignal } from '../../ui/helpers.js';
import {
    attachRowEventHandlers,
    renderEmptyState,
    renderItemRow,
    renderTotalsRow
} from '../../ui/components/itemRow.js';
import { UI_MESSAGES } from '../../lib/constants.js';

/**
 * Render cupboard fats (weight input, no locks)
 * @param {HTMLElement} container - Container element
 * @param {Array} cupboardFats - Array of {id, weight}
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 */
export function renderCupboardFats(container, cupboardFats, fatsDatabase, unit, callbacks) {
    const signal = setupAbortSignal(container);

    if (cupboardFats.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_CUPBOARD_FATS);
        return;
    }

    const totalWeight = cupboardFats.reduce((sum, fat) => sum + fat.weight, 0);

    const rows = cupboardFats.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            weight: fat.weight,
            percentage: totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0
        }, i, {
            inputType: 'weight',
            showWeight: true,
            showPercentage: true,
            lockableField: null,
            showRemoveButton: true,
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = rows + renderTotalsRow('Total Fats', totalWeight, unit, 0);

    attachRowEventHandlers(container, {
        onWeightChange: callbacks.onWeightChange,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    }, 'fat', signal);
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
    const signal = setupAbortSignal(container);

    if (suggestions.length === 0) {
        container.innerHTML = '';
        return;
    }

    const totalWeight = suggestions.reduce((sum, s) => sum + s.weight, 0);

    const rows = suggestions.map((sugg, i) => {
        const fatData = fatsDatabase[sugg.id];
        return renderItemRow({
            id: sugg.id,
            name: fatData?.name || sugg.id,
            weight: sugg.weight,
            percentage: sugg.percentage,
            isLocked: false
        }, i, {
            inputType: 'weight',
            showWeight: true,
            showPercentage: true,
            lockableField: null,
            showExcludeButton: true,
            unit,
            itemType: 'fat'
        });
    }).join('');

    container.innerHTML = rows + renderTotalsRow('Total suggested', totalWeight, unit, 1);

    attachRowEventHandlers(container, {
        onWeightChange: callbacks.onWeightChange,
        onRemove: callbacks.onRemove,
        onExclude: callbacks.onExclude,
        onInfo: callbacks.onInfo
    }, 'fat', signal);
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
