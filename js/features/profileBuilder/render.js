/**
 * Profile Builder renderers and input readers.
 * Moved from js/ui/ui.js as part of the per-feature split.
 */

import { $, parseFloatOr, parseIntOr } from '../../ui/helpers.js';
import { renderItemRow, renderList } from '../../ui/components/itemRow.js';
import {
    CSS_CLASSES,
    ELEMENT_IDS,
    FATTY_ACID_NAMES,
    MATCH_THRESHOLDS,
    PROPERTY_ELEMENT_IDS
} from '../../lib/constants.js';

/**
 * Render profile builder results
 * @param {Object} result - Result from findFatsForProfile
 * @param {Object} targetProfile - Original target profile
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {Set} lockedIndices - Set of locked fat indices
 * @param {Object} callbacks - {onUseRecipe, onFatInfo, onToggleLock}
 */
export function renderProfileResults(result, targetProfile, fatsDatabase, lockedIndices, callbacks) {
    const resultsContainer = $(ELEMENT_IDS.profileResults);
    const suggestedRecipeDiv = $(ELEMENT_IDS.suggestedRecipe);
    const achievedComparisonDiv = $(ELEMENT_IDS.achievedComparison);
    const matchBarFill = $(ELEMENT_IDS.matchBarFill);
    const matchPercent = $(ELEMENT_IDS.matchPercent);
    const useRecipeBtn = $(ELEMENT_IDS.useRecipeBtn);

    resultsContainer.classList.remove(CSS_CLASSES.hidden);

    matchBarFill.style.width = `${result.matchQuality}%`;
    matchPercent.textContent = `${result.matchQuality}%`;

    renderList(suggestedRecipeDiv, result.recipe, {
        callbacks: {
            onInfo: callbacks.onFatInfo,
            onToggleLock: callbacks.onToggleLock
        },
        rowFor: (fat, index) => {
            const fatData = fatsDatabase[fat.id];
            return renderItemRow({
                id: fat.id,
                name: fatData?.name || fat.id,
                percentage: fat.percentage,
                isLocked: lockedIndices.has(index)
            }, index, {
                showWeight: false,
                showPercentage: true,
                lockableField: 'percentage',
                showRemoveButton: false,
                itemType: 'fat'
            });
        }
    });

    const comparisonItems = [];
    for (const [acid, name] of Object.entries(FATTY_ACID_NAMES)) {
        const targetVal = targetProfile[acid];
        if (targetVal === undefined || targetVal === null || targetVal === '') continue;

        const target = parseFloat(targetVal);
        const achieved = result.achieved[acid] || 0;
        const diff = achieved - target;
        const absDiff = Math.abs(diff);

        let statusClass = CSS_CLASSES.good;
        if (absDiff > MATCH_THRESHOLDS.OFF) statusClass = CSS_CLASSES.off;
        else if (absDiff > MATCH_THRESHOLDS.CLOSE) statusClass = CSS_CLASSES.close;

        const diffSign = diff > 0 ? '+' : '';
        const diffClass = diff > 0 ? 'positive' : 'negative';

        comparisonItems.push(`
            <div class="achieved-item ${statusClass}">
                <span class="achieved-acid">${name}</span>
                <span class="achieved-values">
                    <span class="target">${target.toFixed(0)}%</span>
                    <span class="arrow">&rarr;</span>
                    <span class="achieved">${achieved.toFixed(0)}%</span>
                    <span class="diff ${diffClass}">(${diffSign}${diff.toFixed(0)})</span>
                </span>
            </div>
        `);
    }

    achievedComparisonDiv.innerHTML = comparisonItems.join('');
    useRecipeBtn.onclick = () => callbacks.onUseRecipe(result.recipe);
}

export function hideProfileResults() {
    const resultsContainer = $(ELEMENT_IDS.profileResults);
    if (resultsContainer) resultsContainer.classList.add(CSS_CLASSES.hidden);
}

/**
 * Get property targets from the profile builder inputs
 */
export function getPropertyTargets() {
    const targets = {};
    const properties = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];

    properties.forEach(prop => {
        const input = $(PROPERTY_ELEMENT_IDS.target[prop]);
        if (input && input.value !== '') {
            targets[prop] = parseFloatOr(input.value);
        }
    });

    return targets;
}

/**
 * Get profile builder options
 * @param {Array} excludedFats - Array of fat ids to exclude
 */
export function getProfileBuilderOptions(excludedFats = []) {
    const maxFats = parseIntOr($(ELEMENT_IDS.maxFats)?.value, 5);
    const includeCastor = $(ELEMENT_IDS.includeCastor)?.checked || false;

    return {
        maxFats,
        excludeFats: [...excludedFats],
        requireFats: includeCastor ? ['castor-oil'] : []
    };
}
