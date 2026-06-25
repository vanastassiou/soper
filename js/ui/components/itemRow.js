/**
 * Reusable item row component for fats and additives
 * Eliminates duplication between renderRecipe, renderYoloRecipe, and renderAdditives
 */

import { CSS_CLASSES, UI_ICONS } from '../../lib/constants.js';
import { delegate, formatWeight, onActivate, setupAbortSignal } from '../helpers.js';

/**
 * @typedef {Object} RowConfig
 * @property {string} id - Item ID (fat-id or additive-id)
 * @property {string} name - Display name
 * @property {number} [weight] - Weight value
 * @property {number} [percentage] - Percentage value
 * @property {boolean} [isLocked] - Whether the lockable field is locked
 * @property {boolean} [hasWarning] - Whether to show warning icon
 * @property {string} [warningClass] - CSS class for warning styling
 */

/**
 * @typedef {Object} RowOptions
 * @property {'weight'|'percentage'} [inputType='weight'] - Which field user edits
 * @property {boolean} [showWeight=true] - Show weight column
 * @property {boolean} [showPercentage=true] - Show percentage column
 * @property {'weight'|'percentage'|null} [lockableField=null] - Which field can be locked
 * @property {boolean} [showRemoveButton=true] - Show remove button
 * @property {boolean} [showExcludeButton=false] - Show exclude button (for YOLO/Cupboard modes)
 * @property {string} [itemType='fat'] - Type for data attributes ('fat' or 'additive')
 * @property {string} [className=''] - Additional CSS class(es) for the row
 */

/**
 * Render a single item row
 * @param {RowConfig} config - Row configuration
 * @param {number} index - Row index
 * @param {RowOptions} options - Rendering options
 * @returns {string} HTML string for the row
 */
export function renderItemRow(config, index, options = {}) {
    const {
        inputType = 'weight',
        showWeight = true,
        showPercentage = true,
        lockableField = null,
        showRemoveButton = true,
        showExcludeButton = false,
        itemType = 'fat',
        className = ''
    } = options;

    const {
        id,
        name,
        weight = 0,
        percentage = 0,
        isLocked = false,
        hasWarning = false,
        warningClass = ''
    } = config;

    const rowLockedClass = isLocked ? CSS_CLASSES.locked : '';
    const warningIcon = hasWarning ? '<span class="item-warning-icon" title="See recipe notes">⚠️</span>' : '';
    const dataAttr = itemType === 'fat' ? 'data-fat' : 'data-additive';

    // Build row content based on options
    const nameCell = `
        <button type="button" class="item-name clickable" data-action="info" ${dataAttr}="${id}">
            ${name}${warningIcon}
        </button>
    `;

    // Lock button helper
    const renderLockButton = (field) => {
        if (lockableField !== field) return '';
        const lockedClass = isLocked ? CSS_CLASSES.locked : '';
        return `<button class="icon-btn lock-btn ${lockedClass}" data-action="lock" data-index="${index}"
                   title="${isLocked ? 'Unlock ' + field : 'Lock ' + field}"
                   aria-label="${isLocked ? 'Unlock ' + name + ' ' + field : 'Lock ' + name + ' ' + field}"
                   aria-pressed="${isLocked}">
                   ${isLocked ? UI_ICONS.LOCK : UI_ICONS.UNLOCK}
               </button>`;
    };

    // Weight cell - can be input or display depending on inputType
    let weightCell = '';
    if (showWeight) {
        const isWeightInput = inputType === 'weight';
        const lockBtn = renderLockButton('weight');

        if (isWeightInput) {
            weightCell = `<div class="weight-cell">
                   <input type="number" value="${weight}" min="0" step="1" data-action="weight" data-index="${index}" aria-label="${name} weight in grams">
                   <span class="unit-label">g</span>
                   ${lockBtn}
               </div>`;
        } else {
            // Display-only weight (calculated from percentage)
            weightCell = `<div class="weight-cell">
                   <span class="${itemType}-weight" aria-label="${name} weight">${weight} g</span>
                   ${lockBtn}
               </div>`;
        }
    }

    // Percentage cell - can be input or display depending on inputType
    let percentageCell = '';
    if (showPercentage) {
        const isPercentageInput = inputType === 'percentage';
        const disabledAttr = isPercentageInput && isLocked && lockableField === 'percentage' ? 'disabled' : '';
        const lockBtn = renderLockButton('percentage');

        if (isPercentageInput) {
            percentageCell = `<div class="percentage-cell">
                   <input type="number" value="${percentage}" min="0" max="100" step="0.1" data-action="percentage" data-index="${index}" aria-label="${name} percentage" ${disabledAttr}>
                   <span class="unit-label">%</span>
                   ${lockBtn}
               </div>`;
        } else {
            // Display-only percentage
            percentageCell = `<div class="percentage-cell">
                   <span class="item-percentage" aria-label="${name} percentage">${percentage}%</span>
                   ${lockBtn}
               </div>`;
        }
    }

    const excludeCell = showExcludeButton
        ? `<button class="icon-btn exclude-btn" data-action="exclude" data-id="${id}" aria-label="Exclude ${name} from future suggestions">
               ${UI_ICONS.EXCLUDE}
           </button>`
        : '';

    const removeCell = showRemoveButton
        ? `<button class="icon-btn remove-btn" data-action="remove" data-index="${index}" aria-label="Remove ${name}">
               ${UI_ICONS.REMOVE}
           </button>`
        : '';

    // Determine column layout class based on visible columns
    const colCount = 1 + (showWeight ? 1 : 0) + (showPercentage ? 1 : 0) + (showExcludeButton ? 1 : 0) + (showRemoveButton ? 1 : 0);
    const colClass = `cols-${colCount}`;

    const rowClasses = `item-row ${colClass} ${rowLockedClass} ${warningClass} ${className}`.trim().replace(/\s+/g, ' ');

    return `
        <div class="${rowClasses}" data-index="${index}">
            ${nameCell}
            ${weightCell}
            ${percentageCell}
            ${excludeCell}
            ${removeCell}
        </div>
    `;
}

/**
 * Render a totals row
 * @param {string} label - Row label (e.g., "Total Fats")
 * @param {number} total - Total weight in grams
 * @param {number} [emptyCells=2] - Number of empty cells to add
 * @param {string} [className=''] - Additional CSS class
 * @returns {string} HTML string for totals row
 */
export function renderTotalsRow(label, total, emptyCells = 2, className = '') {
    const empty = '<span></span>'.repeat(emptyCells);
    return `
        <div class="totals-row ${className}">
            <span>${label}</span>
            <span>${formatWeight(total)}</span>
            <span>100%</span>
            ${empty}
        </div>
    `;
}

/**
 * Render an empty state message
 * @param {string} message - Primary message
 * @param {string} [subMessage] - Secondary message
 * @param {string} [className=''] - Additional CSS class
 * @returns {string} HTML string for empty state
 */
export function renderEmptyState(message, subMessage = '', className = '') {
    return `
        <div class="${CSS_CLASSES.emptyState} ${className}">
            <p>${message}</p>
            ${subMessage ? `<p>${subMessage}</p>` : ''}
        </div>
    `;
}

/**
 * Attach event handlers to a container with item rows.
 * Pass `signal` to enable cleanup via AbortController.
 * @param {HTMLElement} container - Container element
 * @param {Object} callbacks - Event callbacks
 * @param {Function} [callbacks.onWeightChange] - Weight input handler (index, value)
 * @param {Function} [callbacks.onPercentageChange] - Percentage input handler (index, value)
 * @param {Function} [callbacks.onToggleLock] - Unified lock toggle handler (index)
 * @param {Function} [callbacks.onRemove] - Remove handler (index)
 * @param {Function} [callbacks.onExclude] - Exclude handler (id)
 * @param {Function} [callbacks.onInfo] - Info click handler (id)
 * @param {string} [itemType='fat'] - Item type for selectors
 * @param {AbortSignal} [signal] - Optional AbortSignal for cleanup
 */
export function attachRowEventHandlers(container, callbacks, itemType = 'fat', signal) {
    const nameSelector = '.item-name[data-action="info"]';
    const options = signal ? { signal } : undefined;
    const on = (selector, eventType, handler) =>
        delegate(container, selector, eventType, handler, options);

    if (callbacks.onWeightChange) {
        on('input[data-action="weight"]', 'input', (_e, el) => {
            callbacks.onWeightChange(parseInt(el.dataset.index, 10), el.value);
        });
    }

    if (callbacks.onPercentageChange) {
        on('input[data-action="percentage"]', 'input', (_e, el) => {
            callbacks.onPercentageChange(parseInt(el.dataset.index, 10), el.value);
        });
    }

    if (callbacks.onToggleLock) {
        on('button[data-action="lock"]', 'click', (_e, el) => {
            callbacks.onToggleLock(parseInt(el.dataset.index, 10));
        });
    }

    if (callbacks.onRemove) {
        on('button[data-action="remove"]', 'click', (_e, el) => {
            callbacks.onRemove(parseInt(el.dataset.index, 10));
        });
    }

    if (callbacks.onExclude) {
        on('button[data-action="exclude"]', 'click', (_e, el) => {
            callbacks.onExclude(el.dataset.id);
        });
    }

    if (callbacks.onInfo) {
        const fireInfo = (el) => {
            const id = el.dataset[itemType] || el.dataset.fat || el.dataset.additive;
            callbacks.onInfo(id);
        };
        on(nameSelector, 'click', (_e, el) => fireInfo(el));
        on(nameSelector, 'keydown', onActivate((e) => {
            const el = e.target.closest(nameSelector);
            if (el) fireInfo(el);
        }));
    }
}

/**
 * Render an item list into a container, handling abort-signal lifecycle,
 * empty-state fallback, optional totals row, and event handler attachment.
 *
 * @param {HTMLElement} container - Container element
 * @param {Array} items - Items to render
 * @param {Object} options
 * @param {(item: any, index: number) => string} options.rowFor - Row HTML for one item
 * @param {string} [options.emptyMessage] - Message shown when items is empty.
 *   If omitted, the container is cleared instead of showing an empty state.
 * @param {string} [options.emptyClassName] - Extra class on the empty state.
 * @param {string} [options.header] - HTML prepended before the rows (e.g. column header).
 * @param {string} [options.totals] - HTML appended after the rows (e.g. totals row).
 * @param {Object} [options.callbacks] - Row callbacks; passed to attachRowEventHandlers.
 * @param {string} [options.itemType='fat'] - Item type for event handler resolution.
 */
export function renderList(container, items, options) {
    const {
        rowFor,
        emptyMessage,
        emptyClassName = '',
        header = '',
        totals = '',
        callbacks,
        itemType = 'fat'
    } = options;

    const signal = setupAbortSignal(container);

    if (items.length === 0) {
        container.innerHTML = emptyMessage
            ? renderEmptyState(emptyMessage, '', emptyClassName)
            : '';
        return;
    }

    const rows = items.map((item, i) => rowFor(item, i)).join('');
    container.innerHTML = header + rows + totals;

    if (callbacks) {
        attachRowEventHandlers(container, callbacks, itemType, signal);
    }
}
