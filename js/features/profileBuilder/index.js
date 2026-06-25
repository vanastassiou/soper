/**
 * Profile Builder feature: generate a recipe matching target properties.
 */

import { $ } from '../../ui/helpers.js';
import { ELEMENT_IDS, UI_MESSAGES } from '../../lib/constants.js';
import { toast } from '../../ui/components/toast.js';
import * as optimizer from '../../core/optimizer.js';
import {
    clearPropertiesRecipe,
    getPropertiesLockedFats,
    setPropertiesRecipe,
    state,
    togglePropertiesLock
} from '../../state/state.js';
import {
    getProfileBuilderOptions,
    getPropertyTargets,
    hideProfileResults,
    renderProfileResults
} from './render.js';

export { hideProfileResults } from './render.js';

let deps;
let lastTargetProfile = null;

/**
 * @param {Object} injected
 * @param {(getRecipe: () => Array) => (fatId: string) => void} injected.createFatInfoHandler
 * @param {() => Array<string>} injected.getCombinedExclusions
 * @param {(recipe: Array) => void} injected.onTransferRecipe
 */
export function initProfileBuilder(injected) {
    deps = injected;
    $(ELEMENT_IDS.generateRecipeBtn)?.addEventListener('click', handleGenerateFromProfile);
}

function handleGenerateFromProfile() {
    const propertyTargets = getPropertyTargets();

    const validationError = optimizer.validatePropertyTargets(propertyTargets);
    if (validationError) {
        toast.error(validationError);
        return;
    }

    const targetProfile = optimizer.propertiesToFattyAcidTargets(propertyTargets);

    if (Object.keys(targetProfile).length === 0) {
        toast.info(UI_MESSAGES.ENTER_PROPERTY_TARGET);
        return;
    }

    lastTargetProfile = targetProfile;

    const lockedFats = getPropertiesLockedFats();
    const excludedFats = deps.getCombinedExclusions();
    const options = getProfileBuilderOptions(excludedFats);
    options.lockedFats = lockedFats;

    const result = optimizer.findFatsForProfile(targetProfile, state.fatsDatabase, options);

    if (result.recipe.length === 0) {
        toast.warning(UI_MESSAGES.NO_FAT_COMBINATION);
        return;
    }

    // Preserve locks for locked fats at their new indices in the result
    const newLockedIndices = new Set();
    lockedFats.forEach(lockedFat => {
        const newIndex = result.recipe.findIndex(f => f.id === lockedFat.id);
        if (newIndex !== -1) {
            newLockedIndices.add(newIndex);
        }
    });
    setPropertiesRecipe(result.recipe, newLockedIndices);

    renderResults(result, targetProfile);

    const generateBtn = $(ELEMENT_IDS.generateRecipeBtn);
    if (generateBtn) generateBtn.textContent = 'Re-roll';
}

function renderResults(result, targetProfile) {
    renderProfileResults(result, targetProfile, state.fatsDatabase, state.propertiesLockedIndices, {
        onUseRecipe: (recipe) => {
            const transferred = recipe.map(fat => ({ id: fat.id, percentage: fat.percentage }));
            deps.onTransferRecipe(transferred);
        },
        onFatInfo: deps.createFatInfoHandler(() => state.propertiesRecipe),
        onToggleLock: handleTogglePropertiesLock
    });
}

function handleTogglePropertiesLock(index) {
    togglePropertiesLock(index);
    if (state.propertiesRecipe.length > 0 && lastTargetProfile) {
        const result = {
            recipe: state.propertiesRecipe,
            matchQuality: 100,
            achieved: {}
        };
        renderResults(result, lastTargetProfile);
    }
}

/**
 * Called by the mode router when leaving Profile Builder mode.
 * Resets the generate button text. Caller is responsible for
 * clearPropertiesRecipe() and hideProfileResults().
 */
export function resetProfileBuilder() {
    lastTargetProfile = null;
    const generateBtn = $(ELEMENT_IDS.generateRecipeBtn);
    if (generateBtn) generateBtn.textContent = 'Generate';
}
