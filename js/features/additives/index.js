/**
 * Additives feature: fragrance, colourant, soap-performance, skin-care picker.
 */

import { $, enableTabArrowNavigation } from '../../ui/helpers.js';
import { ADDITIVE_CATEGORIES, ADDITIVE_WARNING_TYPES, ELEMENT_IDS, UI_MESSAGES, getWeightLabel } from '../../lib/constants.js';
import { toast } from '../../ui/components/toast.js';
import {
    addAdditiveToRecipe,
    removeAdditiveFromRecipe,
    state,
    updateAdditiveWeight
} from '../../state/state.js';
import { getSettings, showAdditiveInfo } from '../../ui/ui.js';
import { populateAdditiveSelect, renderAdditives } from './render.js';

let deps;
let currentAdditiveCategory = ADDITIVE_CATEGORIES.FRAGRANCE;

const ADDITIVE_DATABASES = {
    [ADDITIVE_CATEGORIES.FRAGRANCE]: 'fragrancesDatabase',
    [ADDITIVE_CATEGORIES.COLOURANT]: 'colourantsDatabase',
    [ADDITIVE_CATEGORIES.SOAP_PERFORMANCE]: 'soapPerformanceDatabase',
    [ADDITIVE_CATEGORIES.SKIN_CARE]: 'skinCareDatabase'
};

function getAdditiveDatabaseForCategory(category) {
    const dbName = ADDITIVE_DATABASES[category];
    return dbName ? state[dbName] : {};
}

/**
 * Combined database for looking up any additive by ID.
 */
export function getAllAdditivesDatabase() {
    return {
        ...state.fragrancesDatabase,
        ...state.colourantsDatabase,
        ...state.soapPerformanceDatabase,
        ...state.skinCareDatabase
    };
}

/**
 * @param {Object} injected
 * @param {() => Function} injected.createDietaryFilterFn
 * @param {(selector: string, dataAttr: string, value: string) => void} injected.updateTabStates
 * @param {() => void} injected.recalculate - called after add/remove/weight changes
 */
export function initAdditives(injected) {
    deps = injected;

    document.querySelectorAll('.additive-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAdditiveCategory(tab.dataset.category));
    });

    const additiveTablist = document.querySelector('.additive-tabs[role="tablist"]');
    if (additiveTablist) {
        enableTabArrowNavigation(additiveTablist, (tab) => {
            switchAdditiveCategory(tab.dataset.category);
        });
    }

    $(ELEMENT_IDS.addAdditiveBtn)?.addEventListener('click', handleAddAdditive);

    updateAdditiveSelect();
}

function handleAddAdditive() {
    const select = $(ELEMENT_IDS.additiveSelect);
    const additiveId = select.value;

    if (!additiveId) return;
    if (!addAdditiveToRecipe(additiveId)) {
        toast.warning(UI_MESSAGES.ADDITIVE_ALREADY_EXISTS);
        return;
    }

    updateAdditiveSelect();
    deps.recalculate();
    select.value = '';
}

function handleRemoveAdditive(index) {
    removeAdditiveFromRecipe(index);
    updateAdditiveSelect();
    deps.recalculate();
}

function handleAdditiveWeightChange(index, weight) {
    updateAdditiveWeight(index, weight);
    deps.recalculate();
}

function switchAdditiveCategory(category) {
    currentAdditiveCategory = category;
    deps.updateTabStates('.additive-tab', 'category', category);
    updateAdditiveSelect();
}

export function updateAdditiveSelect() {
    const select = $(ELEMENT_IDS.additiveSelect);
    if (!select) return;

    const existingIds = state.recipeAdditives.map(a => a.id);
    const database = getAdditiveDatabaseForCategory(currentAdditiveCategory);
    const filterFn = deps.createDietaryFilterFn();
    populateAdditiveSelect(select, database, existingIds, filterFn);
}

/**
 * Render the additives list and return any warning objects emitted by
 * renderAdditives (used by the final-recipe builder to merge warnings
 * into recipe notes).
 */
export function renderAdditivesList() {
    const container = $(ELEMENT_IDS.recipeAdditives);
    if (!container) return [];

    const settings = getSettings();
    const totalFatWeight = settings.recipeWeight;
    const allAdditives = getAllAdditivesDatabase();

    return renderAdditives(
        container,
        state.recipeAdditives,
        allAdditives,
        totalFatWeight,
        getWeightLabel(settings.unit),
        {
            onWeightChange: handleAdditiveWeightChange,
            onRemove: handleRemoveAdditive,
            onInfo: (additiveId) => showAdditiveInfo(additiveId, allAdditives, state.sourcesData)
        }
    );
}

/**
 * Prepend warning entries onto an existing notes array.
 * @param {Array} notes - Existing recipe notes
 * @param {Array} warnings - Additive warnings returned by renderAdditivesList
 */
export function mergeAdditiveWarningsIntoNotes(notes, warnings) {
    if (!warnings || warnings.length === 0) return notes;

    const warningNotes = warnings.map(warning => {
        let noteType = 'info';
        let icon = '⚠️';

        if (warning.type === ADDITIVE_WARNING_TYPES.DANGER) {
            noteType = 'warning';
            icon = '🚫';
        } else if (warning.type === ADDITIVE_WARNING_TYPES.WARNING) {
            noteType = 'warning';
            icon = '⚠️';
        }

        return {
            type: noteType,
            icon,
            text: `${warning.additiveName}: ${warning.message}`
        };
    });

    return [...warningNotes, ...notes];
}
