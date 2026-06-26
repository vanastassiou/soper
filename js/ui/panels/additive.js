/**
 * Additive info panel renderer.
 */

import { ELEMENT_IDS } from '../../lib/constants.js';
import { $, showSection } from '../helpers.js';
import { setPanelHeader, panelListItem, openInfoPanel } from './shared.js';

/**
 * Format category for display
 * @param {string} category - Main category
 * @param {string} subcategory - Optional subcategory
 * @returns {string} Formatted category string
 */
function formatCategory(category, subcategory) {
    const categoryNames = {
        'fragrance': 'fragrance',
        'colourant': 'colourant',
        'soap-performance': 'soap performance',
        'skin-care': 'skin care'
    };

    const base = categoryNames[category] || category || 'additive';
    if (subcategory) {
        return `${base} (${subcategory})`;
    }
    return base;
}

/**
 * Show additive info panel
 * @param {string} additiveId - Additive id (kebab-case key)
 * @param {Object} additivesDatabase - Additives database
 * @param {Object} sourcesData - Sources database for resolving references
 */
export function showAdditiveInfo(additiveId, additivesDatabase, sourcesData) {
    if (!additiveId || !additivesDatabase[additiveId]) return;

    const additive = additivesDatabase[additiveId];

    // Infer category/type from item properties (separate files don't have category field)
    let category = additive.type || additive.category;
    if (!category) {
        if (additive.scentNote) {
            category = 'fragrance';
        } else if (additive.color) {
            category = 'colourant';
        } else if (['hardener', 'lather-enhancer', 'antioxidant'].includes(additive.subcategory)) {
            category = 'soap-performance';
        } else if (['emollient', 'exfoliant'].includes(additive.subcategory)) {
            category = 'skin-care';
        }
    }

    setPanelHeader({
        additivePanelName: additive.name,
        additivePanelType: formatCategory(category, additive.subcategory),
        additivePanelDescription: additive.description
    });

    // Details: usage and other attributes as list items
    const usage = additive.details?.usage || additive.usage;
    const detailItems = [];

    detailItems.push(panelListItem('Recommended usage', `${usage.min}–${usage.max}%`));

    const scentNote = additive.details?.scentNote || additive.scentNote;
    if (scentNote) {
        detailItems.push(panelListItem('Scent note', scentNote));
    }

    const density = additive.details?.density || additive.density;
    if (density) {
        detailItems.push(panelListItem('Density', `${density} g/mL`));
    }

    const color = additive.details?.colour || additive.color;
    if (color) {
        detailItems.push(panelListItem('Colour', `<span class="panel-colour-swatch" style="background-color: ${color}"></span>`));
    }

    if (additive.anchoring?.length > 0) {
        const anchorNames = additive.anchoring
            .map(id => additivesDatabase[id]?.name || id)
            .join(', ');
        detailItems.push(panelListItem('Anchors well with', anchorNames));
    }

    $('additivePanelDetails').innerHTML = detailItems.join('');

    // Safety section
    const safetySection = $('additivePanelSafetySection');
    const safetyContainer = $('additivePanelSafety');
    const safety = additive.details?.safety || additive.safety;
    const safetyItems = [];

    if (safety) {
        if (safety.ifraCategory9Limit) {
            safetyItems.push(panelListItem('IFRA Category 9 limit', `${safety.ifraCategory9Limit}%`));
        }
        if (safety.maxConcentration) {
            safetyItems.push(panelListItem('Max concentration', `${safety.maxConcentration}%`));
        }
        if (safety.cosIng) {
            safetyItems.push(panelListItem('CosIng', safety.cosIng));
        }
        if (safety.casNumber) {
            safetyItems.push(panelListItem('CAS', safety.casNumber));
        }
        if (safety.flashPointC) {
            safetyItems.push(panelListItem('Flash point', `${safety.flashPointC}°C`));
        }
    }

    showSection(
        safetySection,
        safetyItems.length > 0 ? safetyItems.join('') : null,
        safetyContainer
    );

    openInfoPanel(ELEMENT_IDS.additiveInfoPanel, additive.references, sourcesData);
}
