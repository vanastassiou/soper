/**
 * UI rendering functions for the soap recipe builder.
 *
 * This module now holds two cohesive concerns: the results-table property
 * display and the shared help-popup system. The info-panel renderers,
 * ingredient exclusions, and settings extraction moved to focused modules and
 * are re-exported here so existing `import * as ui` consumers keep working.
 */

import {
    CSS_CLASSES,
    PROPERTY_ELEMENT_IDS,
    PROPERTY_KEYS
} from '../lib/constants.js';

import { $, positionNearAnchor } from './helpers.js';

// ---------------------------------------------------------------------------
// Re-exports: panels, exclusions, and settings live in their own modules now.
// (ARCHITECTURE_RISKS Risk 2: split the oversized ui.js along its seams.)
// ---------------------------------------------------------------------------
export { renderFinalRecipe, showFinalRecipe } from './finalRecipe.js';
export { closeAllInfoPanels } from './panels/shared.js';
export { showFatInfo } from './panels/fat.js';
export { showGlossaryInfo } from './panels/glossary.js';
export { showFattyAcidInfo } from './panels/fattyAcid.js';
export { showAdditiveInfo } from './panels/additive.js';
export {
    renderExcludedIngredients,
    populateExcludeIngredientSelect,
    renderExcludedFats,
    populateExcludeFatSelect
} from './exclusions.js';
export { getSettings } from './settings.js';

// ============================================
// Results Display
// ============================================

/**
 * Explanations for out-of-range property values
 */
const RANGE_EXPLANATIONS = {
    hardness: {
        low: 'Soft bar; may need a longer cure time or additives like sodium lactate',
        high: 'Very hard; may be brittle or waxy, so cut soon after unmoulding to avoid cracking'
    },
    degreasing: {
        low: 'Low degreasing; very gentle on skin, but may feel insufficiently effective',
        high: 'High degreasing; good for utility soap, but frequent use may dry skin'
    },
    moisturizing: {
        low: 'Low moisturizing; less conditioning, may feel drying',
        high: 'High moisturizing; very conditioning, but may reduce lather'
    },
    'lather-volume': {
        low: 'Lathering produces less foam',
        high: 'Lathering produces lots of foam, but it may feel less creamy than desired'
    },
    'lather-density': {
        low: 'Lathering produces a stable, lotion-like foam',
        high: 'Lathering produces a dense foam, but lather volume may be reduced'
    },
    iodine: {
        low: 'Low iodine; very stable but may lack moisturizing fats',
        high: 'High iodine; prone to rancidity, so mitigate this by adding antioxidant and cure in cool dark place'
    },
    ins: {
        low: 'Low INS; bar may be soft or slow to trace',
        high: 'High INS; may trace quickly, so use lower temperatures or work quickly'
    }
};

/**
 * Update a property display with in/out of range styling
 * @param {string} key - Property key (e.g., 'hardness')
 * @param {number} value - Property value
 * @param {number} min - Min range
 * @param {number} max - Max range
 */
export function updateProperty(key, value, min, max) {
    const elem = $(PROPERTY_ELEMENT_IDS.prop[key]);
    if (!elem) return;

    const isInRange = value >= min && value <= max;
    const explanations = RANGE_EXPLANATIONS[key];

    elem.classList.remove(CSS_CLASSES.inRange, CSS_CLASSES.outRange);
    elem.classList.add(isInRange ? CSS_CLASSES.inRange : CSS_CLASSES.outRange);

    // Show value with help icon for out-of-range
    if (!isInRange && explanations) {
        const explanation = value < min ? explanations.low : explanations.high;
        elem.innerHTML = `${value.toFixed(0)} <span class="help-tip range-tip" data-range-tip="${explanation}">ⓘ</span>`;
    } else {
        elem.textContent = value.toFixed(0);
    }
}

/**
 * Populate property range cells from PROPERTY_RANGES
 * @param {Object} ranges - PROPERTY_RANGES object
 */
export function populatePropertyRanges(ranges) {
    PROPERTY_KEYS.forEach(prop => {
        const elem = $(PROPERTY_ELEMENT_IDS.range[prop]);
        if (elem && ranges[prop]) {
            elem.textContent = `${ranges[prop].min} - ${ranges[prop].max}`;
        }
    });

    // Also populate profile builder input placeholders
    const profileProperties = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density'];
    profileProperties.forEach(prop => {
        const input = $(PROPERTY_ELEMENT_IDS.target[prop]);
        if (input && ranges[prop]) {
            input.placeholder = `${ranges[prop].min}-${ranges[prop].max}`;
        }
    });
}

// ============================================
// Help Popup System (shared by glossary and tooltips)
// ============================================

/**
 * Initialize unified help popup system for both glossary and tooltips
 * @param {Object} glossaryData - Glossary data (soapmaking knowledge)
 * @param {Object} tooltipsData - Tooltips data (UI help)
 * @param {Function} onOpenPanel - Callback to open glossary panel: (term) => void
 */
export function initHelpPopup(glossaryData, tooltipsData, onOpenPanel) {
    const popup = document.createElement('div');
    popup.className = 'help-popup';
    popup.innerHTML = `
        <div class="help-popup-title"></div>
        <div class="help-popup-body"></div>
        <a href="#" class="help-popup-link"></a>
    `;
    document.body.appendChild(popup);

    let activeTipEl = null;
    let currentLinkAction = null;

    function hidePopup() {
        popup.classList.remove('visible');
        popup.style.display = '';  // Clear inline style from positionNearAnchor
        activeTipEl = null;
        currentLinkAction = null;
    }

    function showPopup(anchorEl, { title, desc, linkText, linkAction }) {
        popup.querySelector('.help-popup-title').textContent = title;
        popup.querySelector('.help-popup-body').textContent = desc;

        const linkEl = popup.querySelector('.help-popup-link');
        if (linkText && linkAction) {
            linkEl.textContent = linkText + ' →';
            linkEl.style.display = 'block';
            currentLinkAction = linkAction;
        } else {
            linkEl.style.display = 'none';
            currentLinkAction = null;
        }

        popup.classList.add('visible');
        positionNearAnchor(popup, anchorEl);
    }

    function showRangeTip(text, anchorEl) {
        showPopup(anchorEl, {
            title: 'Out of range',
            desc: text,
            linkText: null,
            linkAction: null
        });
    }

    document.addEventListener('click', (e) => {
        const glossaryTip = e.target.closest('.help-tip[data-term]');
        const uiTip = e.target.closest('.ui-tip[data-tooltip]');
        const rangeTip = e.target.closest('.help-tip[data-range-tip]');
        const linkEl = e.target.closest('.help-popup-link');
        const inPopup = e.target.closest('.help-popup');

        // Clicking the "More details" / "Learn more" link
        if (linkEl && currentLinkAction) {
            e.preventDefault();
            const callback = currentLinkAction;
            hidePopup();
            callback();
            return;
        }

        // Clicking inside popup - don't dismiss
        if (inPopup) {
            return;
        }

        // Clicking a glossary help tip (ⓘ)
        if (glossaryTip) {
            e.preventDefault();
            if (glossaryTip === activeTipEl) {
                hidePopup();
            } else {
                const term = glossaryTip.dataset.term;
                const data = glossaryData[term];
                if (data) {
                    showPopup(glossaryTip, {
                        title: data.name || data.term,
                        desc: data.description || data.desc,
                        linkText: 'More details',
                        linkAction: () => onOpenPanel(term)
                    });
                    activeTipEl = glossaryTip;
                }
            }
            return;
        }

        // Clicking a UI tooltip (?)
        if (uiTip) {
            e.preventDefault();
            if (uiTip === activeTipEl) {
                hidePopup();
            } else {
                const key = uiTip.dataset.tooltip;
                const data = tooltipsData[key];
                if (data) {
                    const glossaryLink = data.glossaryLink;
                    showPopup(uiTip, {
                        title: data.title,
                        desc: data.desc,
                        linkText: glossaryLink ? 'Learn more' : null,
                        linkAction: glossaryLink ? () => onOpenPanel(glossaryLink) : null
                    });
                    activeTipEl = uiTip;
                }
            }
            return;
        }

        // Clicking a range tip (out of range warning)
        if (rangeTip) {
            e.preventDefault();
            if (rangeTip === activeTipEl) {
                hidePopup();
            } else {
                showRangeTip(rangeTip.dataset.rangeTip, rangeTip);
                activeTipEl = rangeTip;
            }
            return;
        }

        // Any other click dismisses popup
        hidePopup();
    });
}
