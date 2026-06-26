/**
 * Ingredient exclusion UI: the excluded-ingredient tag list and the
 * "exclude an ingredient" select population.
 */

import { ELEMENT_IDS } from '../lib/constants.js';
import { $, delegate, populateSelect } from './helpers.js';

/**
 * Look up an ingredient name from any database
 * @param {string} id - Ingredient ID
 * @param {Object} databases - Object containing all ingredient databases
 * @returns {string} Ingredient name or ID if not found
 */
function lookupIngredientName(id, databases) {
    for (const db of Object.values(databases)) {
        if (db[id]) return db[id].name;
    }
    return id;
}

/**
 * Render the excluded ingredients list as removable tags
 * @param {Array} excludedIds - Array of ingredient ids
 * @param {Object} databases - Object containing all ingredient databases for name lookups
 * @param {Function} onRemove - Callback when an ingredient is removed
 */
export function renderExcludedIngredients(excludedIds, databases, onRemove) {
    const container = $(ELEMENT_IDS.excludedIngredientsList);
    if (!container) return;

    if (excludedIds.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No ingredients excluded</p></div>';
        return;
    }

    container.innerHTML = excludedIds.map(id => {
        const name = lookupIngredientName(id, databases);
        return `
            <span class="excluded-fat-tag" data-fat="${id}">
                ${name}
                <button class="remove-exclusion" title="Remove">&times;</button>
            </span>
        `;
    }).join('');

    delegate(container, '.remove-exclusion', 'click', (_e, el) => {
        const tag = el.closest('.excluded-fat-tag');
        onRemove(tag.dataset.fat);
    });
}

/**
 * Populate the exclude ingredient select dropdown with all ingredient types
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} databases - Object containing all ingredient databases
 * @param {Array} excludedIds - Already excluded ingredient ids to filter out
 */
export function populateExcludeIngredientSelect(selectElement, databases, excludedIds = []) {
    // Clear existing options (keep placeholder at index 0)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    const excluded = new Set(excludedIds);

    // Combine and sort all ingredients from all databases
    const allIngredients = [];
    for (const db of Object.values(databases)) {
        for (const [id, data] of Object.entries(db)) {
            if (!excluded.has(id)) {
                allIngredients.push({ id, name: data.name });
            }
        }
    }

    // Sort by name
    allIngredients.sort((a, b) => a.name.localeCompare(b.name));

    // Add options
    allIngredients.forEach(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

// Legacy wrapper for backward compatibility
export function renderExcludedFats(excludedFats, fatsDatabase, onRemove) {
    renderExcludedIngredients(excludedFats, { fats: fatsDatabase }, onRemove);
}

// Legacy wrapper for backward compatibility
export function populateExcludeFatSelect(selectElement, fatsDatabase, excludedFats = []) {
    populateSelect(selectElement, fatsDatabase, excludedFats);
}
