/**
 * Select Fats feature: the default build mode.
 * User adds fats by percentage; total percentage should sum to 100%.
 */

import { $, setVisibility } from '../../ui/helpers.js';
import { ELEMENT_IDS, UI_MESSAGES, getWeightLabel } from '../../lib/constants.js';
import { toast } from '../../ui/components/toast.js';
import {
    addFatToRecipe,
    removeFatFromRecipe,
    state,
    updateFatPercentage
} from '../../state/state.js';
import { getSettings } from '../../ui/ui.js';
import { updatePropertiesFromFats } from '../../ui/properties.js';
import { renderRecipe } from './render.js';

let deps;

/**
 * @param {Object} injected
 * @param {(getRecipe: () => Array) => (fatId: string) => void} injected.createFatInfoHandler
 * @param {() => void} injected.updateFatSelectWithFilters
 * @param {() => void} injected.renderAdditivesList
 */
export function initSelectFats(injected) {
    deps = injected;
    $(ELEMENT_IDS.addFatBtn)?.addEventListener('click', handleAddFat);
    $(ELEMENT_IDS.useFatsBtn)?.addEventListener('click', handleUseFats);
}

export function calculate() {
    const recipeAsWeights = state.recipe.map(fat => ({
        id: fat.id,
        weight: fat.percentage // total = 100
    }));
    updatePropertiesFromFats(recipeAsWeights, state.fatsDatabase);
    deps.renderAdditivesList();
}

export function renderRecipeList() {
    const container = $(ELEMENT_IDS.recipeFats);
    const useFatsAction = $(ELEMENT_IDS.useFatsAction);
    const settings = getSettings();

    renderRecipe(container, state.recipe, state.fatsDatabase, {
        onPercentageChange: handlePercentageChange,
        onRemove: handleRemoveFat,
        onFatInfo: deps.createFatInfoHandler(() => state.recipe)
    }, settings.recipeWeight, getWeightLabel(settings.unit));

    setVisibility(useFatsAction, state.recipe.length > 0);
}

function handleAddFat() {
    const select = $(ELEMENT_IDS.fatSelect);
    const fatId = select.value;
    if (!fatId) return;

    if (!addFatToRecipe(fatId)) {
        toast.warning(UI_MESSAGES.FAT_ALREADY_EXISTS);
        return;
    }

    renderRecipeList();
    deps.updateFatSelectWithFilters();
    calculate();
}

function handleRemoveFat(index) {
    removeFatFromRecipe(index);
    renderRecipeList();
    deps.updateFatSelectWithFilters();
    calculate();
}

function handlePercentageChange(index, percentage) {
    updateFatPercentage(index, percentage);
    updateRecipeDerivedDisplays(getSettings());
    calculate();
}

/**
 * Update derived display values (per-row weights and totals) without
 * re-rendering. Called when the user is actively typing in an input.
 */
function updateRecipeDerivedDisplays(settings) {
    const container = $(ELEMENT_IDS.recipeFats);
    if (!container) return;

    const recipeWeight = settings.recipeWeight;
    const unit = getWeightLabel(settings.unit);

    state.recipe.forEach((fat, i) => {
        const row = container.querySelector(`.item-row[data-index="${i}"]`);
        if (!row) return;

        const weightSpan = row.querySelector('.weight-cell .fat-weight');
        if (weightSpan) {
            const derivedWeight = (recipeWeight * fat.percentage / 100).toFixed(1);
            weightSpan.textContent = `${derivedWeight} ${unit}`;
        }
    });

    const totalsRow = container.querySelector('.totals-row');
    if (totalsRow) {
        const totalPercentage = state.recipe.reduce((sum, f) => sum + f.percentage, 0);
        const totalWeight = recipeWeight * totalPercentage / 100;
        const spans = totalsRow.querySelectorAll('span');
        if (spans[1]) spans[1].textContent = `${totalWeight.toFixed(1)} ${unit}`;
        if (spans[2]) {
            spans[2].textContent = `${totalPercentage.toFixed(1)}%`;
            spans[2].className = Math.abs(totalPercentage - 100) > 0.1 ? 'percentage-warning' : '';
        }
    }
}

/**
 * Called by the settings listener when recipe weight changes.
 */
export function handleRecipeWeightSettingChange() {
    renderRecipeList();
    calculate();
}

function handleUseFats() {
    if (state.recipe.length === 0) {
        toast.info(UI_MESSAGES.ADD_FAT_FIRST);
        return;
    }
    const additivesSection = $(ELEMENT_IDS.additivesSubcontainer);
    if (additivesSection) {
        additivesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
