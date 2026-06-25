/**
 * YOLO feature: generate a random soap recipe.
 */

import { $, setVisibility } from '../../ui/helpers.js';
import { DEFAULTS, ELEMENT_IDS, UI_MESSAGES } from '../../lib/constants.js';
import { toast } from '../../ui/components/toast.js';
import { attachRowEventHandlers } from '../../ui/components/itemRow.js';
import * as optimizer from '../../core/optimizer.js';
import {
    addSuggestionExclusion,
    clearYoloRecipe,
    getYoloLockedFats,
    removeYoloFat,
    setYoloRecipe,
    state,
    toggleYoloLock
} from '../../state/state.js';
import { updatePropertiesFromFats } from '../../ui/properties.js';
import { renderYoloRows } from './render.js';

let deps;

/**
 * @param {Object} injected
 * @param {(getRecipe: () => Array) => (fatId: string) => void} injected.createFatInfoHandler
 * @param {() => Array<string>} injected.getCombinedExclusions
 * @param {(recipe: Array) => void} injected.onTransferRecipe
 */
export function initYolo(injected) {
    deps = injected;
    $(ELEMENT_IDS.yoloBtn)?.addEventListener('click', handleYoloGenerate);
    $(ELEMENT_IDS.useYoloRecipeBtn)?.addEventListener('click', handleUseYoloRecipe);
}

function handleYoloGenerate() {
    const lockedFats = getYoloLockedFats();
    const excludedFats = deps.getCombinedExclusions();

    const result = optimizer.generateRandomRecipe(state.fatsDatabase, {
        excludeFats: excludedFats,
        lockedFats,
        minFats: DEFAULTS.YOLO_MIN_FATS,
        maxFats: DEFAULTS.YOLO_MAX_FATS
    });

    if (!result) {
        toast.warning(UI_MESSAGES.YOLO_GENERATION_FAILED);
        return;
    }

    // Locked fats end up at the start of the recipe array; preserve their locks
    const newLockedIndices = new Set();
    for (let i = 0; i < lockedFats.length; i++) {
        newLockedIndices.add(i);
    }
    setYoloRecipe(result.recipe, newLockedIndices);

    renderYoloRecipe();

    const yoloBtn = $(ELEMENT_IDS.yoloBtn);
    if (yoloBtn) yoloBtn.textContent = 'Re-roll';
}

export function renderYoloRecipe() {
    const container = $(ELEMENT_IDS.yoloRecipeFats);
    const useAction = $(ELEMENT_IDS.useYoloRecipeAction);
    if (!container) return;

    if (state.yoloRecipe.length === 0) {
        container.innerHTML = '';
        setVisibility(useAction, false);
        updatePropertiesFromFats([], state.fatsDatabase);
        return;
    }

    const yoloFatsAsWeights = state.yoloRecipe.map(f => ({
        id: f.id,
        weight: f.percentage // total=100
    }));
    updatePropertiesFromFats(yoloFatsAsWeights, state.fatsDatabase);

    setVisibility(useAction, true);

    container.innerHTML = renderYoloRows(state.yoloRecipe, state.fatsDatabase, state.yoloLockedIndices);

    container._callbacks = {
        onToggleLock: (index) => {
            toggleYoloLock(index);
            renderYoloRecipe();
        },
        onRemove: (index) => {
            removeYoloFat(index);
            renderYoloRecipe();
        },
        onExclude: (fatId) => {
            addSuggestionExclusion(fatId);
            const index = state.yoloRecipe.findIndex(f => f.id === fatId);
            if (index !== -1) {
                removeYoloFat(index);
            }
            renderYoloRecipe();
        },
        onInfo: deps.createFatInfoHandler(() => state.yoloRecipe)
    };

    if (!container.dataset.handlersAttached) {
        attachRowEventHandlers(container, container._callbacks, 'fat');
        container.dataset.handlersAttached = 'true';
    }
}

function handleUseYoloRecipe() {
    if (state.yoloRecipe.length === 0) return;

    const recipe = state.yoloRecipe.map(fat => ({
        id: fat.id,
        percentage: fat.percentage
    }));

    clearYoloRecipe();
    deps.onTransferRecipe(recipe);
}

/**
 * Called by the mode router after clearing YOLO state when switching modes.
 */
export function resetYoloMode() {
    renderYoloRecipe();
    const yoloBtn = $(ELEMENT_IDS.yoloBtn);
    if (yoloBtn) yoloBtn.textContent = 'Surprise me!';
}
