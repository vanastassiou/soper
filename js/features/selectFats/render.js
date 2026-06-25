/**
 * Select Fats mode renderers.
 * Moved from js/ui/ui.js as part of the per-feature split.
 */

import { formatWeight, populateSelect, roundWeight } from '../../ui/helpers.js';
import { renderItemRow, renderList } from '../../ui/components/itemRow.js';
import { UI_MESSAGES } from '../../lib/constants.js';

/**
 * Populate the main fat select dropdown.
 */
export function populateFatSelect(selectElement, fatsDatabase, excludeIds = [], filterFn = null) {
    populateSelect(selectElement, fatsDatabase, excludeIds, filterFn);
}

/**
 * Render the recipe fats list (Select fats mode).
 * @param {HTMLElement} container
 * @param {Array} recipe - [{id, percentage}]
 * @param {Object} fatsDatabase
 * @param {Object} callbacks - {onPercentageChange, onRemove, onFatInfo}
 * @param {number} recipeWeight - Total recipe weight from settings (grams)
 */
export function renderRecipe(container, recipe, fatsDatabase, callbacks, recipeWeight) {
    const totalPercentage = recipe.reduce((sum, fat) => sum + fat.percentage, 0);
    const totalWeight = recipeWeight * totalPercentage / 100;
    const percentWarning = Math.abs(totalPercentage - 100) > 0.1 ? 'percentage-warning' : '';
    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span>${formatWeight(totalWeight)}</span>
            <span class="${percentWarning}">${totalPercentage.toFixed(1)}%</span>
            <span></span>
        </div>
    `;

    renderList(container, recipe, {
        emptyMessage: UI_MESSAGES.NO_FATS_ADDED,
        totals: totalsRow,
        callbacks: {
            onPercentageChange: callbacks.onPercentageChange,
            onRemove: callbacks.onRemove,
            onInfo: callbacks.onFatInfo
        },
        rowFor: (fat, i) => {
            const fatData = fatsDatabase[fat.id];
            const derivedWeight = recipeWeight * fat.percentage / 100;

            return renderItemRow({
                id: fat.id,
                name: fatData?.name || fat.id,
                weight: roundWeight(derivedWeight),
                percentage: fat.percentage
            }, i, {
                inputType: 'percentage',
                showWeight: true,
                showPercentage: true,
                itemType: 'fat'
            });
        }
    });
}
