/**
 * Cupboard cleaner feature.
 * User adds fats they already own; optimizer suggests additions that bring
 * properties into range. Final list can be transferred to Select Fats mode.
 */

import { $, setVisibility } from '../../ui/helpers.js';
import { CSS_CLASSES, ELEMENT_IDS, UI_MESSAGES, getWeightLabel } from '../../lib/constants.js';
import { toast } from '../../ui/components/toast.js';
import * as optimizer from '../../core/optimizer.js';
import {
    addCupboardFat,
    addSuggestionExclusion,
    clearCupboardFats,
    removeCupboardFat,
    removeCupboardSuggestion,
    setAllowRatioMode,
    setCupboardSuggestions,
    state,
    toggleCupboardLock,
    updateCupboardFatWeight,
    updateCupboardSuggestionWeight
} from '../../state/state.js';
import { getSettings } from '../../ui/ui.js';
import { updatePropertiesFromFats } from '../../ui/properties.js';
import {
    populateCupboardFatSelect,
    renderCupboardFats,
    renderCupboardSuggestions
} from './render.js';

let deps;

/**
 * @param {Object} injected
 * @param {(getRecipe: () => Array) => (fatId: string) => void} injected.createFatInfoHandler
 * @param {(recipe: Array) => void} injected.onTransferRecipe - called with [{id, percentage}] when user clicks "Use this recipe"
 */
export function initCupboard(injected) {
    deps = injected;

    const cupboardSelect = $(ELEMENT_IDS.cupboardFatSelect);
    if (cupboardSelect) {
        populateCupboardFatSelect(cupboardSelect, state.fatsDatabase, state.cupboardFats.map(f => f.id));
    }

    $(ELEMENT_IDS.addCupboardFatBtn)?.addEventListener('click', handleAddCupboardFat);
    $(ELEMENT_IDS.cupboardCleanerBtn)?.addEventListener('click', handleGetCupboardSuggestions);
    $(ELEMENT_IDS.useCupboardBtn)?.addEventListener('click', handleUseCupboardRecipe);
    $(ELEMENT_IDS.allowRatioSuggestions)?.addEventListener('change', handleRatioModeToggle);

    if (state.cupboardFats.length > 0) renderCupboardFatsList();
    if (state.cupboardSuggestions.length > 0) renderCupboardSuggestionsList();
}

function handleAddCupboardFat() {
    const select = $(ELEMENT_IDS.cupboardFatSelect);
    const fatId = select?.value;
    if (!fatId) return;

    if (!addCupboardFat(fatId)) {
        toast.info(UI_MESSAGES.FAT_ALREADY_EXISTS);
        return;
    }

    select.value = '';
    populateCupboardFatSelect(select, state.fatsDatabase, state.cupboardFats.map(f => f.id));

    renderCupboardFatsList();
}

function handleCupboardWeightChange(index, value) {
    updateCupboardFatWeight(index, value);
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);
}

function handleRemoveCupboardFat(index) {
    removeCupboardFat(index);

    const select = $(ELEMENT_IDS.cupboardFatSelect);
    if (select) {
        populateCupboardFatSelect(select, state.fatsDatabase, state.cupboardFats.map(f => f.id));
    }

    renderCupboardFatsList();
}

function handleGetCupboardSuggestions() {
    if (state.cupboardFats.length === 0) {
        toast.info(UI_MESSAGES.NO_CUPBOARD_FATS);
        return;
    }

    const excludedFats = deps.getCombinedExclusions();

    const result = optimizer.suggestFatsForCupboard(state.cupboardFats, state.fatsDatabase, {
        excludeFats: excludedFats,
        maxSuggestions: 3,
        allowRatioAdjustments: state.allowRatioMode
    });

    if (result.allInRange && result.suggestions.length === 0) {
        toast.success(UI_MESSAGES.CUPBOARD_PROPERTIES_OK);
        updatePropertiesFromFats(state.cupboardFats, state.fatsDatabase);
        return;
    }

    if (result.suggestions.length === 0) {
        toast.warning(UI_MESSAGES.CUPBOARD_SUGGESTION_FAILED);
        return;
    }

    setCupboardSuggestions(result.suggestions);
    renderCupboardSuggestionsList();
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);

    setVisibility($(ELEMENT_IDS.useCupboardAction), true);

    const cupboardBtn = $(ELEMENT_IDS.cupboardCleanerBtn);
    if (cupboardBtn) cupboardBtn.textContent = 'Re-roll';
}

function handleRemoveCupboardSuggestion(index) {
    removeCupboardSuggestion(index);
    renderCupboardSuggestionsList();
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);
}

function handleCupboardSuggestionWeightChange(index, value) {
    updateCupboardSuggestionWeight(index, value);
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);
}

function handleUseCupboardRecipe() {
    if (state.cupboardFats.length === 0) return;

    const allFats = [
        ...state.cupboardFats.map(f => ({ id: f.id, weight: f.weight })),
        ...state.cupboardSuggestions.map(s => ({ id: s.id, weight: s.weight }))
    ];
    const totalWeight = allFats.reduce((sum, f) => sum + f.weight, 0);

    const recipe = allFats.map(f => ({
        id: f.id,
        percentage: totalWeight > 0 ? Math.round((f.weight / totalWeight) * 1000) / 10 : 0
    }));

    clearCupboardFats();
    deps.onTransferRecipe(recipe);
}

function handleRatioModeToggle() {
    const checkbox = $(ELEMENT_IDS.allowRatioSuggestions);
    setAllowRatioMode(checkbox?.checked || false);
}

export function renderCupboardFatsList() {
    const container = $(ELEMENT_IDS.cupboardFats);
    if (!container) return;

    const settings = getSettings();

    renderCupboardFats(container, state.cupboardFats, state.fatsDatabase, getWeightLabel(settings.unit), {
        onWeightChange: handleCupboardWeightChange,
        onRemove: handleRemoveCupboardFat,
        onInfo: deps.createFatInfoHandler(() => state.cupboardFats)
    });

    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);
}

export function renderCupboardSuggestionsList() {
    const container = $(ELEMENT_IDS.cupboardSuggestions);
    if (!container) return;

    const settings = getSettings();

    renderCupboardSuggestions(
        container,
        state.cupboardSuggestions,
        state.fatsDatabase,
        getWeightLabel(settings.unit),
        {
            onWeightChange: handleCupboardSuggestionWeightChange,
            onRemove: handleRemoveCupboardSuggestion,
            onExclude: (fatId) => {
                addSuggestionExclusion(fatId);
                const index = state.cupboardSuggestions.findIndex(f => f.id === fatId);
                if (index !== -1) {
                    removeCupboardSuggestion(index);
                }
                renderCupboardSuggestionsList();
                updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);
            },
            onInfo: deps.createFatInfoHandler(() => state.cupboardSuggestions)
        }
    );

    const useAction = $(ELEMENT_IDS.useCupboardAction);
    if (useAction) {
        useAction.classList.toggle(CSS_CLASSES.hidden, state.cupboardSuggestions.length === 0);
    }
}

/**
 * Reset cupboard state and re-render. Called by the mode router when switching
 * away from cupboard mode after the user confirms losing data.
 */
export function resetCupboardMode() {
    const cupboardSelect = $(ELEMENT_IDS.cupboardFatSelect);
    if (cupboardSelect) {
        populateCupboardFatSelect(cupboardSelect, state.fatsDatabase, []);
    }
    renderCupboardFatsList();
    renderCupboardSuggestionsList();

    const cupboardBtn = $(ELEMENT_IDS.cupboardCleanerBtn);
    if (cupboardBtn) cupboardBtn.textContent = 'Get suggestions';
}
