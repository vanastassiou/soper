/**
 * UI rendering functions for the soap recipe builder
 * Handles all DOM manipulation and rendering
 */

import {
    ADDITIVE_WARNING_TYPES,
    CSS_CLASSES,
    DEFAULTS,
    ELEMENT_IDS,
    PROPERTY_ELEMENT_IDS,
    PROPERTY_FATTY_ACIDS,
    PROPERTY_KEYS,
    UI_MESSAGES
} from '../lib/constants.js';

import { checkAdditiveWarnings, getFatSoapProperties } from '../core/calculator.js';
import { resolveReferences } from '../lib/references.js';

import {
    $,
    delegate,
    onActivate,
    parseFloatOr,
    populateSelect,
    positionNearAnchor,
    setupAbortSignal
} from './helpers.js';

import {
    closeCurrentPanel,
    openPanel
} from './panelManager.js';

import {
    attachRowEventHandlers,
    renderEmptyState,
    renderItemRow,
    renderTotalsRow
} from './components/itemRow.js';

// Re-export final recipe functions from submodule
export { renderFinalRecipe, showFinalRecipe } from './finalRecipe.js';

// ============================================
// Fat Select Dropdown
// ============================================

/**
 * Populate fat select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} fatsDatabase - Fat database object
 * @param {Array} excludeIds - IDs to exclude from the list
 * @param {Function} filterFn - Optional filter function (id, data) => boolean
 */
export function populateFatSelect(selectElement, fatsDatabase, excludeIds = [], filterFn = null) {
    populateSelect(selectElement, fatsDatabase, excludeIds, filterFn);
}

// ============================================
// Recipe Rendering
// ============================================

/**
 * Render the recipe fats list (Select fats mode - weight-lockable)
 * @param {HTMLElement} container - Container element
 * @param {Array} recipe - Array of {id, percentage, lockedWeight?}
 * @param {Set} locks - Set of locked indices
 * @param {Object} fatsDatabase - Fat database for name lookups
 * @param {Object} callbacks - {onPercentageChange, onWeightChange, onToggleLock, onRemove, onFatInfo}
 * @param {number} recipeWeight - Total recipe weight from settings
 * @param {string} unit - Unit label (g or oz)
 */
export function renderRecipe(container, recipe, locks, fatsDatabase, callbacks, recipeWeight, unit) {
    const signal = setupAbortSignal(container);

    if (recipe.length === 0) {
        container.innerHTML = renderEmptyState(UI_MESSAGES.NO_FATS_ADDED);
        return;
    }

    const totalPercentage = recipe.reduce((sum, fat) => sum + fat.percentage, 0);
    const totalWeight = recipeWeight * totalPercentage / 100;

    const rows = recipe.map((fat, i) => {
        const fatData = fatsDatabase[fat.id];
        const isLocked = locks.has(i);
        const derivedWeight = recipeWeight * fat.percentage / 100;
        const displayWeight = isLocked && fat.lockedWeight != null
            ? parseFloat(fat.lockedWeight.toFixed(1))
            : parseFloat(derivedWeight.toFixed(1));

        // Format percentage for display when locked (derived from weight)
        const displayPercentage = isLocked
            ? parseFloat(fat.percentage.toFixed(1))
            : fat.percentage;

        return renderItemRow({
            id: fat.id,
            name: fatData?.name || fat.id,
            weight: displayWeight,
            percentage: displayPercentage,
            isLocked
        }, i, {
            inputType: isLocked ? 'weight' : 'percentage',
            showWeight: true,
            showPercentage: true,
            lockableField: 'weight',
            itemType: 'fat',
            unit
        });
    }).join('');

    // Show totals with both weight and percentage
    const percentWarning = Math.abs(totalPercentage - 100) > 0.1 ? 'percentage-warning' : '';
    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span>${totalWeight.toFixed(1)} ${unit}</span>
            <span class="${percentWarning}">${totalPercentage.toFixed(1)}%</span>
            <span></span>
        </div>
    `;

    container.innerHTML = rows + totalsRow;

    // Attach event handlers with abort signal for cleanup
    attachRowEventHandlers(container, {
        onPercentageChange: callbacks.onPercentageChange,
        onWeightChange: callbacks.onWeightChange,
        onToggleLock: callbacks.onToggleLock,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onFatInfo
    }, 'fat', signal);
}

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

/**
 * Update percentages without re-rendering inputs
 * @param {Array} recipe - Recipe array
 * @param {string} unit - Unit string
 */
export function updatePercentages(recipe, unit) {
    const container = $(ELEMENT_IDS.recipeFats);
    if (!container) return;

    const totalWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);

    recipe.forEach((fat, i) => {
        const row = container.querySelector(`.item-row[data-index="${i}"]`);
        if (row) {
            const percentage = totalWeight > 0 ? ((fat.weight / totalWeight) * 100).toFixed(1) : 0;
            const percentSpan = row.querySelector('.item-percentage');
            if (percentSpan) percentSpan.textContent = `${percentage}%`;
        }
    });

    const totalsRow = container.querySelector('.totals-row');
    if (totalsRow) {
        const spans = totalsRow.querySelectorAll('span');
        if (spans[1]) spans[1].textContent = `${totalWeight.toFixed(2)} ${unit}`;
    }
}

// ============================================
// Info Panels
// ============================================

/**
 * Render a single panel-list row: label on the left, value on the right.
 */
function panelListItem(label, value) {
    return `
        <div class="panel-list-item">
            <span class="panel-list-name">${label}</span>
            <span class="panel-list-value">${value}</span>
        </div>
    `;
}

/**
 * Render the four standard soap properties (Hardness, Degreasing, Lather, Moisturizing).
 * Used by both the fat-info and fatty-acid panels.
 */
function renderSoapProperties(props) {
    return [
        ['Hardness', props.hardness],
        ['Degreasing', props.degreasing],
        ['Lather', props.lather],
        ['Moisturizing', props.moisturizing]
    ].map(([label, value]) => `
        <div class="panel-prop-item"><span class="panel-prop-label">${label}</span><span class="panel-prop-value">${value}</span></div>
    `).join('');
}

/**
 * Render references section into a panel
 * @param {HTMLElement} panel - The panel element to append references to
 * @param {Array} references - Array of {sourceId, section, url}
 * @param {Object} sourcesData - Sources database for resolving sourceIds
 */
function renderReferences(panel, references, sourcesData) {
    // Remove existing references section if present
    const existing = panel.querySelector('.panel-references-section');
    if (existing) existing.remove();

    if (!references || references.length === 0) return;

    const resolved = resolveReferences(references, sourcesData);
    const section = document.createElement('div');
    section.className = 'panel-content-section panel-references-section';
    section.innerHTML = `
        <h4 class="panel-section-title">References</h4>
        <div class="panel-references">
            ${resolved.map(ref => `
                <div class="reference-item">
                    <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.source}</a>
                    <span class="reference-section">${ref.section}</span>
                </div>
            `).join('')}
        </div>
    `;
    panel.appendChild(section);
}

/**
 * Show fat info panel
 * @param {string} fatId - Fat id (kebab-case key)
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @param {Object} sourcesData - Sources database for resolving references
 * @param {Function} onFattyAcidClick - Callback when fatty acid is clicked
 */
export function showFatInfo(fatId, fatsDatabase, fattyAcidsData, sourcesData, onFattyAcidClick) {
    if (!fatId || !fatsDatabase[fatId]) return;

    const fat = fatsDatabase[fatId];

    // Name and type
    $('fatPanelName').textContent = fat.name;
    $('fatPanelType').textContent = fat.type || 'fat';

    // Description
    $('fatPanelDescription').textContent = fat.description;

    // Details: SAP and usage as list items with labels
    const sap = fat.details?.sap || fat.sap;
    const usage = fat.details?.usage || fat.usage;

    $('fatPanelDetails').innerHTML =
        panelListItem('NaOH SAP', sap.naoh)
        + panelListItem('KOH SAP', sap.koh)
        + panelListItem('Recommended usage', `${usage.min}–${usage.max}%`);

    // Details: soap properties
    const soapProps = getFatSoapProperties(fat, fattyAcidsData);
    $('fatPanelProperties').innerHTML = soapProps ? renderSoapProperties(soapProps) : '';

    // Fatty acid composition
    const faContainer = $('fatPanelFattyAcids');
    const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
    faContainer.innerHTML = Object.entries(fattyAcids)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => `
            <div class="panel-list-item">
                <button type="button" class="panel-list-name panel-list-name--link" data-acid="${name}">${name}</button>
                <span class="panel-list-value">${value}%</span>
            </div>
        `).join('');

    if (onFattyAcidClick) {
        delegate(faContainer, '.panel-list-name--link', 'click', (_e, el) => {
            onFattyAcidClick(el.dataset.acid);
        });
        delegate(faContainer, '.panel-list-name--link', 'keydown', onActivate((e) => {
            const el = e.target.closest('.panel-list-name--link');
            if (el) onFattyAcidClick(el.dataset.acid);
        }));
    }

    renderReferences($(ELEMENT_IDS.fatInfoPanel), fat.references, sourcesData);

    openPanel(ELEMENT_IDS.fatInfoPanel, ELEMENT_IDS.panelOverlay);
}

/**
 * Close all info panels - uses panelManager to close current panel
 * Since only one panel can be open at a time, this closes whichever is open
 */
export function closeAllInfoPanels() {
    closeCurrentPanel();
}

/**
 * Calculate property contributors for glossary panel
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

    // Name and type
    $('glossaryPanelName').textContent = data.name || data.term;
    $('glossaryPanelType').textContent = data.type || data.category;

    // Description
    $('glossaryPanelDesc').textContent = data.description || data.desc;

    // Details section
    const detailsSection = $('glossaryDetailsSection');
    const detailsEl = $('glossaryPanelDetails');
    const details = data.details?.prose || data.details;
    if (details) {
        detailsEl.innerHTML = details.replace(/\n/g, '<br>');
        detailsSection.style.display = 'block';
    } else {
        detailsSection.style.display = 'none';
    }

    // Contributing fats (for properties)
    const contributorsSection = $('glossaryContributorsSection');
    const contributorsEl = $('glossaryPanelContributors');
    const category = data.type || data.category;

    if (category === 'property' && PROPERTY_FATTY_ACIDS[term] && recipe.length > 0) {
        const contributors = calculatePropertyContributors(recipe, fatsDatabase, PROPERTY_FATTY_ACIDS[term]);

        if (contributors.length > 0) {
            contributorsEl.innerHTML = contributors
                .map(c => panelListItem(c.name, c.value.toFixed(1)))
                .join('');
            contributorsSection.style.display = 'block';
        } else {
            contributorsSection.style.display = 'none';
        }
    } else {
        contributorsSection.style.display = 'none';
    }

    // Related terms
    const relatedSection = $('glossaryRelatedSection');
    const relatedEl = $('glossaryPanelRelated');
    if (data.related?.length > 0) {
        relatedEl.innerHTML = data.related
            .filter(r => glossaryData[r])
            .map(r => `<button type="button" class="panel-tag" data-term="${r}">${glossaryData[r].name || glossaryData[r].term}</button>`)
            .join('');
        relatedSection.style.display = 'block';

        delegate(relatedEl, '.panel-tag', 'click', (_e, el) => {
            if (onTermClick) onTermClick(el.dataset.term);
        });
        delegate(relatedEl, '.panel-tag', 'keydown', onActivate((e) => {
            const el = e.target.closest('.panel-tag');
            if (onTermClick && el) onTermClick(el.dataset.term);
        }));
    } else {
        relatedSection.style.display = 'none';
    }

    renderReferences($('glossaryPanel'), data.references, sourcesData);

    openPanel('glossaryPanel', ELEMENT_IDS.panelOverlay);
}

/**
 * Find recipe sources for a fatty acid
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

    // Name and type
    $('faName').textContent = acid.name;
    const saturation = acid.description?.saturation || acid.saturation;
    $('faType').textContent = `${saturation} fatty acid`;

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

    renderReferences($('fattyAcidPanel'), acid.references, sourcesData);

    openPanel('fattyAcidPanel', ELEMENT_IDS.panelOverlay);
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

// ============================================
// Ingredient Exclusions
// ============================================

/**
 * Render the excluded ingredients list as removable tags
 * @param {Array} excludedIds - Array of ingredient ids
 * @param {Object} databases - Object containing all ingredient databases for name lookups
 * @param {Function} onRemove - Callback when an ingredient is removed
 */
export function renderExcludedIngredients(excludedIds, databases, onRemove) {
    const container = $(ELEMENT_IDS.excludedIngredientsList);
    if (!container) return;

    if (excludedIds.length === 0) {
        container.innerHTML = '<div class="empty-state-small"><p>No ingredients excluded</p></div>';
        return;
    }

    container.innerHTML = excludedIds.map(id => {
        const name = lookupIngredientName(id, databases);
        return `
            <span class="excluded-fat-tag" data-fat="${id}">
                ${name}
                <button class="remove-exclusion" title="Remove">&times;</button>
            </span>
        `;
    }).join('');

    delegate(container, '.remove-exclusion', 'click', (_e, el) => {
        const tag = el.closest('.excluded-fat-tag');
        onRemove(tag.dataset.fat);
    });
}

/**
 * Look up an ingredient name from any database
 * @param {string} id - Ingredient ID
 * @param {Object} databases - Object containing all ingredient databases
 * @returns {string} Ingredient name or ID if not found
 */
function lookupIngredientName(id, databases) {
    for (const db of Object.values(databases)) {
        if (db[id]) return db[id].name;
    }
    return id;
}

/**
 * Populate the exclude ingredient select dropdown with all ingredient types
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} databases - Object containing all ingredient databases
 * @param {Array} excludedIds - Already excluded ingredient ids to filter out
 */
export function populateExcludeIngredientSelect(selectElement, databases, excludedIds = []) {
    // Clear existing options (keep placeholder at index 0)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    const excluded = new Set(excludedIds);

    // Combine and sort all ingredients from all databases
    const allIngredients = [];
    for (const db of Object.values(databases)) {
        for (const [id, data] of Object.entries(db)) {
            if (!excluded.has(id)) {
                allIngredients.push({ id, name: data.name });
            }
        }
    }

    // Sort by name
    allIngredients.sort((a, b) => a.name.localeCompare(b.name));

    // Add options
    allIngredients.forEach(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

// Legacy wrapper for backward compatibility
export function renderExcludedFats(excludedFats, fatsDatabase, onRemove) {
    renderExcludedIngredients(excludedFats, { fats: fatsDatabase }, onRemove);
}

// Legacy wrapper for backward compatibility
export function populateExcludeFatSelect(selectElement, fatsDatabase, excludedFats = []) {
    populateSelect(selectElement, fatsDatabase, excludedFats);
}

// ============================================
// Settings Helpers
// ============================================

/**
 * Get current settings from form
 * @returns {Object} Settings object
 */
export function getSettings() {
    return {
        lyeType: $(ELEMENT_IDS.lyeType)?.value || 'NaOH',
        processType: $(ELEMENT_IDS.processType)?.value || 'cold',
        superfat: parseFloatOr($(ELEMENT_IDS.superfat)?.value, 0),
        waterRatio: parseFloatOr($(ELEMENT_IDS.waterRatio)?.value, 2),
        unit: $(ELEMENT_IDS.unit)?.value || 'metric',
        recipeWeight: parseFloatOr($(ELEMENT_IDS.recipeWeight)?.value, DEFAULTS.BASE_RECIPE_WEIGHT)
    };
}

// ============================================
// Additives
// ============================================

/**
 * Populate additive select dropdown
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {Object} database - Pre-filtered database for the category
 * @param {Array} existingIds - IDs already in recipe to exclude
 * @param {Function|null} filterFn - Optional filter function (id, data) => boolean
 */
export function populateAdditiveSelect(selectElement, database, existingIds = [], filterFn = null) {
    populateSelect(selectElement, database, existingIds, filterFn);
}

/**
 * Render the recipe additives list
 * @param {HTMLElement} container - Container element
 * @param {Array} recipeAdditives - Array of {id, weight}
 * @param {Object} additivesDatabase - Additives database
 * @param {number} totalFatWeight - Total fat weight for percentage calculations
 * @param {string} unit - Unit string (g or oz)
 * @param {Object} callbacks - {onWeightChange, onRemove, onInfo}
 * @returns {Array} Array of warning objects from all additives
 */
export function renderAdditives(container, recipeAdditives, additivesDatabase, totalFatWeight, unit, callbacks) {
    const allWarnings = [];

    if (recipeAdditives.length === 0) {
        container.innerHTML = renderEmptyState(
            UI_MESSAGES.NO_ADDITIVES_ADDED,
            '',
            'additive-empty'
        );
        return allWarnings;
    }

    const totalAdditiveWeight = recipeAdditives.reduce((sum, item) => sum + item.weight, 0);

    const headerRow = `
        <div class="item-row header-row cols-3">
            <span>Additive</span>
            <span>${unit}</span>
            <span></span>
        </div>
    `;

    const rows = recipeAdditives.map((item, i) => {
        const additive = additivesDatabase[item.id];
        if (!additive) return '';

        const percentage = totalFatWeight > 0 ? (item.weight / totalFatWeight) * 100 : 0;
        const warnings = checkAdditiveWarnings(additive, percentage);
        allWarnings.push(...warnings.map(w => ({ ...w, additiveName: additive.name })));

        // Determine warning class (highest severity wins)
        let warningClass = '';
        if (warnings.some(w => w.type === ADDITIVE_WARNING_TYPES.DANGER)) {
            warningClass = 'danger';
        } else if (warnings.some(w => w.type === ADDITIVE_WARNING_TYPES.WARNING)) {
            warningClass = 'warning';
        }

        return renderItemRow({
            id: item.id,
            name: additive.name,
            weight: item.weight,
            percentage: percentage.toFixed(1),
            isLocked: false,
            hasWarning: !!warningClass,
            warningClass
        }, i, {
            inputType: 'weight',
            showWeight: true,
            showPercentage: false,
            lockableField: null,
            unit,
            itemType: 'additive'
        });
    }).join('');

    const totalsRow = `
        <div class="totals-row">
            <span>Total</span>
            <span>${totalAdditiveWeight.toFixed(1)} ${unit}</span>
            <span></span>
        </div>
    `;

    container.innerHTML = headerRow + rows + totalsRow;

    // Store callbacks on container for dynamic lookup
    container._callbacks = {
        onWeightChange: callbacks.onWeightChange,
        onRemove: callbacks.onRemove,
        onInfo: callbacks.onInfo
    };

    // Only attach event handlers once per container
    if (!container.dataset.handlersAttached) {
        attachRowEventHandlers(container, container._callbacks, 'additive');
        container.dataset.handlersAttached = 'true';
    }

    return allWarnings;
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
    const panel = $(ELEMENT_IDS.additiveInfoPanel);

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

    // Name and type
    $('additivePanelName').textContent = additive.name;
    $('additivePanelType').textContent = formatCategory(category, additive.subcategory);

    // Description
    $('additivePanelDescription').textContent = additive.description;

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

    if (safetyItems.length > 0) {
        safetyContainer.innerHTML = safetyItems.join('');
        safetySection.style.display = 'block';
    } else {
        safetySection.style.display = 'none';
    }

    renderReferences(panel, additive.references, sourcesData);

    openPanel(ELEMENT_IDS.additiveInfoPanel, ELEMENT_IDS.panelOverlay);
}

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

