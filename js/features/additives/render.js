/**
 * Additives renderers.
 * Moved from js/ui/ui.js as part of the per-feature split.
 *
 * showAdditiveInfo stays in ui.js with the other show*Info panels because
 * they share several private helpers (panelListItem, renderReferences).
 */

import { populateSelect } from '../../ui/helpers.js';
import {
    attachRowEventHandlers,
    renderEmptyState,
    renderItemRow
} from '../../ui/components/itemRow.js';
import { checkAdditiveWarnings } from '../../core/calculator.js';
import { ADDITIVE_WARNING_TYPES, UI_MESSAGES } from '../../lib/constants.js';

/**
 * Populate additive select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} database - Pre-filtered database for the category
 * @param {Array} existingIds - IDs already in recipe to exclude
 * @param {Function|null} filterFn - Optional filter function (id, data) => boolean
 */
export function populateAdditiveSelect(selectElement, database, existingIds = [], filterFn = null) {
    populateSelect(selectElement, database, existingIds, filterFn);
}

/**
 * Render the recipe additives list
 * @param {HTMLElement} container - Container element
 * @param {Array} recipeAdditives - Array of {id, weight}
 * @param {Object} additivesDatabase - Additives database
 * @param {number} totalFatWeight - Total fat weight for percentage calculations
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 * @returns {Array} Warning objects from all additives
 */
export function renderAdditives(container, recipeAdditives, additivesDatabase, totalFatWeight, unit, callbacks) {
    const allWarnings = [];

    if (recipeAdditives.length === 0) {
        container.innerHTML = renderEmptyState(
            UI_MESSAGES.NO_ADDITIVES_ADDED,
            '',
            'additive-empty'
        );
        return allWarnings;
    }

    const totalAdditiveWeight = recipeAdditives.reduce((sum, item) => sum + item.weight, 0);

    const headerRow = `
        <div class="item-row header-row cols-3">
            <span>Additive</span>
            <span>${unit}</span>
            <span></span>
        </div>
    `;

    const rows = recipeAdditives.map((item, i) => {
        const additive = additivesDatabase[item.id];
        if (!additive) return '';

        const percentage = totalFatWeight > 0 ? (item.weight / totalFatWeight) * 100 : 0;
        const warnings = checkAdditiveWarnings(additive, percentage);
        allWarnings.push(...warnings.map(w => ({ ...w, additiveName: additive.name })));

        let warningClass = '';
        if (warnings.some(w => w.type === ADDITIVE_WARNING_TYPES.DANGER)) {
            warningClass = 'danger';
        } else if (warnings.some(w => w.type === ADDITIVE_WARNING_TYPES.WARNING)) {
            warningClass = 'warning';
        }

        return renderItemRow({
            id: item.id,
            name: additive.name,
            weight: item.weight,
            percentage: percentage.toFixed(1),
            isLocked: false,
            hasWarning: !!warningClass,
            warningClass
        }, i, {
            inputType: 'weight',
            showWeight: true,
            showPercentage: false,
            lockableField: null,
            unit,
            itemType: 'additive'
        });
    }).join('');

    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span>${totalAdditiveWeight.toFixed(1)} ${unit}</span>
            <span></span>
        </div>
    `;

    container.innerHTML = headerRow + rows + totalsRow;

    container._callbacks = {
        onWeightChange: callbacks.onWeightChange,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    };

    if (!container.dataset.handlersAttached) {
        attachRowEventHandlers(container, container._callbacks, 'additive');
        container.dataset.handlersAttached = 'true';
    }

    return allWarnings;
}
