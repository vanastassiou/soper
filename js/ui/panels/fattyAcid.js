/**
 * Fatty-acid info panel renderer.
 */

import { $ } from '../helpers.js';
import { setPanelHeader, panelListItem, renderSoapProperties, openInfoPanel } from './shared.js';

/**
 * Find recipe sources for a fatty acid
 * @param {Array} recipe - Current recipe ({id, ...})
 * @param {Object} fatsDatabase - Fat database
 * @param {string} acidKey - Fatty acid key
 * @returns {Array<{name: string, percent: number}>}
 */
function findRecipeSourcesForAcid(recipe, fatsDatabase, acidKey) {
    return recipe
        .filter(item => {
            const fat = fatsDatabase[item.id];
            const fattyAcids = fat?.details?.fattyAcids || fat?.fattyAcids;
            return fattyAcids?.[acidKey] > 0;
        })
        .map(item => {
            const fat = fatsDatabase[item.id];
            const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
            return {
                name: fat.name,
                percent: fattyAcids[acidKey]
            };
        })
        .sort((a, b) => b.percent - a.percent);
}

/**
 * Show fatty acid info panel
 * @param {string} acidKey - Fatty acid key (e.g., 'lauric')
 * @param {Object} fattyAcidsData - Fatty acids database
 * @param {Array} recipe - Current recipe array
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} sourcesData - Sources database for resolving references
 */
export function showFattyAcidInfo(acidKey, fattyAcidsData, recipe, fatsDatabase, sourcesData) {
    if (!acidKey || !fattyAcidsData[acidKey]) return;

    const acid = fattyAcidsData[acidKey];

    const saturation = acid.description?.saturation || acid.saturation;
    setPanelHeader({
        faName: acid.name,
        faType: `${saturation} fatty acid`
    });

    // Description: chemistry attributes
    const formula = acid.description?.formula || acid.formula;
    const carbonChain = acid.description?.carbonChain || acid.carbonChain;
    const meltingPoint = acid.description?.meltingPoint || acid.meltingPoint;

    $('faChemistry').innerHTML = `
        <div class="panel-detail-item">
            <div class="panel-detail-label">Formula</div>
            <div class="panel-detail-value">${formula}</div>
        </div>
        <div class="panel-detail-item">
            <div class="panel-detail-label">Carbon chain</div>
            <div class="panel-detail-value">${carbonChain}</div>
        </div>
        <div class="panel-detail-item">
            <div class="panel-detail-label">Saturation</div>
            <div class="panel-detail-value">${saturation}</div>
        </div>
        <div class="panel-detail-item">
            <div class="panel-detail-label">Melting point</div>
            <div class="panel-detail-value">${meltingPoint}°C</div>
        </div>
    `;

    // Description: prose
    const prose = acid.description?.prose || acid.description;
    const descEl = $('faDescription');
    if (prose && typeof prose === 'string') {
        descEl.textContent = prose;
        descEl.style.display = 'block';
    } else {
        descEl.style.display = 'none';
    }

    // Details: soap properties
    const props = acid.details?.soapProperties || acid.soapProperties;
    $('faContribution').innerHTML = renderSoapProperties(props);

    // Details: recipe sources
    const recipeSources = findRecipeSourcesForAcid(recipe, fatsDatabase, acidKey);
    const recipeSourcesEl = $('faRecipeSources');

    recipeSourcesEl.innerHTML = recipeSources.length > 0
        ? recipeSources.map(s => panelListItem(s.name, `${s.percent}%`)).join('')
        : '<p class="panel-empty-state">No fats in your recipe contain this fatty acid</p>';

    // Details: common sources
    const commonSources = acid.details?.commonSources || acid.commonSources;
    $('faCommonSources').innerHTML = commonSources
        .map(id => {
            const fat = fatsDatabase[id];
            const name = fat ? fat.name : id;
            return `
                <div class="panel-list-item panel-list-item--dashed">
                    <span class="panel-list-name">${name}</span>
                </div>
            `;
        }).join('');

    openInfoPanel('fattyAcidPanel', acid.references, sourcesData);
}
