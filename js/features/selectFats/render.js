/**
 * Select Fats mode renderers.
 * Moved from js/ui/ui.js as part of the per-feature split.
 */

import { populateSelect, setupAbortSignal } from '../../ui/helpers.js';
import {
    attachRowEventHandlers,
    renderEmptyState,
    renderItemRow
} from '../../ui/components/itemRow.js';
import { UI_MESSAGES } from '../../lib/constants.js';

/**
 * Populate the main fat select dropdown.
 */
export function populateFatSelect(selectElement, fatsDatabase, excludeIds = [], filterFn = null) {
    populateSelect(selectElement, fatsDatabase, excludeIds, filterFn);
}

/**
 * Render the recipe fats list (Select fats mode - weight-lockable).
 * @param {HTMLElement} container
 * @param {Array} recipe - [{id, percentage, lockedWeight?}]
 * @param {Set} locks - Set of locked indices
 * @param {Object} fatsDatabase
 * @param {Object} callbacks - {onPercentageChange, onWeightChange, onToggleLock, onRemove, onFatInfo}
 * @param {number} recipeWeight - Total recipe weight from settings
 * @param {string} unit - Unit label (g or oz)
 */
export function renderRecipe(container, recipe, locks, fatsDatabase, callbacks, recipeWeight, unit) {
    const signal = setupAbortSignal(container);

    if (recipe.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_FATS_ADDED);
        return;
    }

    const totalPercentage = recipe.reduce((sum, fat) => sum + fat.percentage, 0);
    const totalWeight = recipeWeight * totalPercentage / 100;

    const rows = recipe.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        const isLocked = locks.has(i);
        const derivedWeight = recipeWeight * fat.percentage / 100;
        const displayWeight = isLocked && fat.lockedWeight != null
            ? parseFloat(fat.lockedWeight.toFixed(1))
            : parseFloat(derivedWeight.toFixed(1));

        const displayPercentage = isLocked
            ? parseFloat(fat.percentage.toFixed(1))
            : fat.percentage;

        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            weight: displayWeight,
            percentage: displayPercentage,
            isLocked
        }, i, {
            inputType: isLocked ? 'weight' : 'percentage',
            showWeight: true,
            showPercentage: true,
            lockableField: 'weight',
            itemType: 'fat',
            unit
        });
    }).join('');

    const percentWarning = Math.abs(totalPercentage - 100) > 0.1 ? 'percentage-warning' : '';
    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span>${totalWeight.toFixed(1)} ${unit}</span>
            <span class="${percentWarning}">${totalPercentage.toFixed(1)}%</span>
            <span></span>
        </div>
    `;

    container.innerHTML = rows + totalsRow;

    attachRowEventHandlers(container, {
        onPercentageChange: callbacks.onPercentageChange,
        onWeightChange: callbacks.onWeightChange,
        onToggleLock: callbacks.onToggleLock,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onFatInfo
    }, 'fat', signal);
}
