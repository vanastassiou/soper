/**
 * Select Fats feature: the default build mode.
 * User adds fats by percentage; can lock fats by weight which auto-redistributes
 * the unlocked percentages so the total stays at 100%.
 */

import { $, setVisibility } from '../../ui/helpers.js';
import { ELEMENT_IDS, UI_MESSAGES, getWeightLabel } from '../../lib/constants.js';
import { toast } from '../../ui/components/toast.js';
import {
    addFatToRecipe,
    lockFatWeight,
    removeFatFromRecipe,
    state,
    unlockFatWeight,
    updateFatPercentage,
    updateLockedWeight
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

    renderRecipe(container, state.recipe, state.recipeLocks, state.fatsDatabase, {
        onPercentageChange: handlePercentageChange,
        onWeightChange: handleRecipeWeightCellChange,
        onToggleLock: handleToggleRecipeLock,
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

function handleToggleRecipeLock(index) {
    if (state.recipeLocks.has(index)) {
        unlockFatWeight(index);
    } else {
        const settings = getSettings();
        const weight = settings.recipeWeight * state.recipe[index].percentage / 100;
        lockFatWeight(index, weight);
    }
    redistributeUnlockedPercentages();
    renderRecipeList();
}

function handleRecipeWeightCellChange(index, value) {
    const weight = parseFloat(value) || 0;
    updateLockedWeight(index, weight);
    const settings = getSettings();
    const recipeWeight = settings.recipeWeight;
    const newPercentage = recipeWeight > 0 ? (weight / recipeWeight) * 100 : 0;
    updateFatPercentage(index, newPercentage);

    redistributeUnlockedPercentages();
    updateRecipeDerivedDisplays(settings);
    calculate();
}

/**
 * Scale unlocked fats proportionally so total percentage = 100%.
 * Locked fats' percentages are derived from their weight and stay fixed.
 */
function redistributeUnlockedPercentages() {
    if (state.recipeLocks.size === 0) return;

    const settings = getSettings();
    const recipeWeight = settings.recipeWeight;
    if (recipeWeight <= 0) return;

    let totalLockedPct = 0;
    for (const i of state.recipeLocks) {
        totalLockedPct += state.recipe[i].percentage;
    }

    const remainingPct = 100 - totalLockedPct;

    let totalUnlockedPct = 0;
    state.recipe.forEach((fat, i) => {
        if (!state.recipeLocks.has(i)) totalUnlockedPct += fat.percentage;
    });

    if (totalUnlockedPct === 0 || Math.abs(totalUnlockedPct - remainingPct) < 0.01) return;

    const scale = remainingPct > 0 ? remainingPct / totalUnlockedPct : 0;

    const newRecipe = [...state.recipe];
    newRecipe.forEach((fat, i) => {
        if (!state.recipeLocks.has(i)) {
            newRecipe[i] = { ...fat, percentage: fat.percentage * scale };
        }
    });
    state.recipe = newRecipe;
}

/**
 * Update derived display values (percentage spans, weights, totals) without
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

        const isLocked = state.recipeLocks.has(i);
        if (isLocked) {
            const pctSpan = row.querySelector('.percentage-cell .item-percentage');
            if (pctSpan) pctSpan.textContent = `${fat.percentage.toFixed(1)}%`;
        } else {
            const weightSpan = row.querySelector('.weight-cell .fat-weight');
            if (weightSpan) {
                const derivedWeight = (recipeWeight * fat.percentage / 100).toFixed(1);
                weightSpan.textContent = `${derivedWeight} ${unit}`;
            }
            const pctInput = row.querySelector('input[data-action="percentage"]');
            if (pctInput && pctInput !== document.activeElement) {
                pctInput.value = parseFloat(fat.percentage.toFixed(1));
            }
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
 * Recalculates locked fats' percentages so their weight stays fixed.
 */
export function handleRecipeWeightSettingChange() {
    const settings = getSettings();
    const newRecipeWeight = settings.recipeWeight;

    if (state.recipeLocks.size > 0 && newRecipeWeight > 0) {
        const newRecipe = [...state.recipe];
        for (const lockedIndex of state.recipeLocks) {
            const fat = newRecipe[lockedIndex];
            if (fat?.lockedWeight != null) {
                newRecipe[lockedIndex] = { ...fat, percentage: (fat.lockedWeight / newRecipeWeight) * 100 };
            }
        }
        state.recipe = newRecipe;
        redistributeUnlockedPercentages();
    }

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
