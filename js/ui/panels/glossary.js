/**
 * Glossary info panel renderer.
 */

import { PROPERTY_FATTY_ACIDS } from '../../lib/constants.js';
import { $, delegate, onActivate, showSection } from '../helpers.js';
import { setPanelHeader, panelListItem, openInfoPanel } from './shared.js';

/**
 * Calculate property contributors for glossary panel
 * @param {Array} recipe - Current recipe ({id, weight})
 * @param {Object} fatsDatabase - Fat database
 * @param {Array<string>} fattyAcids - Fatty acids that contribute to the property
 * @returns {Array<{name: string, value: number}>}
 */
function calculatePropertyContributors(recipe, fatsDatabase, fattyAcids) {
    const totalWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    if (totalWeight === 0) return [];

    return recipe
        .map(item => {
            const fat = fatsDatabase[item.id];
            if (!fat) return null;
            const fatFA = fat.details?.fattyAcids || fat.fattyAcids;
            const contribution = fattyAcids.reduce((sum, fa) => sum + (fatFA[fa] || 0), 0);
            const weightedContribution = (contribution * item.weight / totalWeight);
            return { name: fat.name, value: weightedContribution };
        })
        .filter(c => c && c.value > 0)
        .sort((a, b) => b.value - a.value);
}

/**
 * Show glossary info panel
 * @param {string} term - Glossary term key
 * @param {Object} glossaryData - Glossary database
 * @param {Array} recipe - Current recipe array
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} sourcesData - Sources database for resolving references
 * @param {Function} onTermClick - Callback when related term is clicked
 */
export function showGlossaryInfo(term, glossaryData, recipe, fatsDatabase, sourcesData, onTermClick) {
    if (!term || !glossaryData[term]) return;

    const data = glossaryData[term];

    setPanelHeader({
        glossaryPanelName: data.name || data.term,
        glossaryPanelType: data.type || data.category,
        glossaryPanelDesc: data.description || data.desc
    });

    // Details section
    const details = data.details?.prose || data.details;
    showSection(
        $('glossaryDetailsSection'),
        details ? details.replace(/\n/g, '<br>') : null,
        $('glossaryPanelDetails')
    );

    // Contributing fats (for properties)
    const category = data.type || data.category;
    const contributors = (category === 'property' && PROPERTY_FATTY_ACIDS[term] && recipe.length > 0)
        ? calculatePropertyContributors(recipe, fatsDatabase, PROPERTY_FATTY_ACIDS[term])
        : [];
    showSection(
        $('glossaryContributorsSection'),
        contributors.length > 0
            ? contributors.map(c => panelListItem(c.name, c.value.toFixed(1))).join('')
            : null,
        $('glossaryPanelContributors')
    );

    // Related terms
    const relatedEl = $('glossaryPanelRelated');
    const relatedItems = (data.related || []).filter(r => glossaryData[r]);
    showSection(
        $('glossaryRelatedSection'),
        relatedItems.length > 0
            ? relatedItems
                .map(r => `<button type="button" class="panel-tag" data-term="${r}">${glossaryData[r].name || glossaryData[r].term}</button>`)
                .join('')
            : null,
        relatedEl
    );

    if (relatedItems.length > 0) {
        delegate(relatedEl, '.panel-tag', 'click', (_e, el) => {
            if (onTermClick) onTermClick(el.dataset.term);
        });
        delegate(relatedEl, '.panel-tag', 'keydown', onActivate((e) => {
            const el = e.target.closest('.panel-tag');
            if (onTermClick && el) onTermClick(el.dataset.term);
        }));
    }

    openInfoPanel('glossaryPanel', data.references, sourcesData);
}
