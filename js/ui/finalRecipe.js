/**
 * Final recipe display rendering
 * Generates prose-format recipe with ingredients and procedure
 */

import { CSS_CLASSES, ELEMENT_IDS, FATTY_ACID_KEYS, FATTY_ACID_NAMES, PROPERTY_RANGES } from '../lib/constants.js';
import { resolveReference } from '../lib/references.js';
import { $ } from './helpers.js';

// ============================================
// Qualitative Summary
// ============================================

/**
 * Generate a qualitative description of soap properties
 * @param {Object} properties - {hardness, degreasing, moisturizing, lather-volume, lather-density, iodine, ins}
 * @param {Array} notes - Recipe notes array from calculator
 * @returns {string} HTML for qualitative summary
 */
const QUALITATIVE_LABELS = {
    hardness:         { low: 'soft',    mid: 'firm',     high: 'very hard' },
    degreasing:       { low: 'gentle',  mid: 'moderate', high: 'strong' },
    'lather-volume':  { low: 'minimal', mid: 'good',     high: 'abundant' },
    'lather-density': { low: 'light',   mid: 'creamy',   high: 'rich' }
};

function buildQualitativeSummary(properties, notes = []) {
    const R = PROPERTY_RANGES;

    // Helper to classify a value relative to its range
    const classify = (value, range) => {
        if (value < range.min) return 'low';
        if (value > range.max) return 'high';
        return 'mid';
    };

    const levels = {};
    const text = {};
    for (const [prop, labels] of Object.entries(QUALITATIVE_LABELS)) {
        levels[prop] = classify(properties[prop], R[prop]);
        text[prop] = labels[levels[prop]];
    }

    const summary =
        `Produces a ${text.hardness} bar with ${text.degreasing} degreasing ability. ` +
        `Lather is ${text['lather-volume']} with a ${text['lather-density']} texture.`;

    const hardnessLevel = levels.hardness;
    const degreasingLevel = levels.degreasing;

    // Collect all warnings - start with calculator-generated notes
    const warnings = notes.map(note => note.text);

    // Add property-based warnings for out-of-range values
    const iodineLevel = classify(properties.iodine, R.iodine);
    if (iodineLevel === 'high') {
        warnings.push('High iodine value means an increased risk of rancidity. Store in a cool, dark place, and consider adding an antioxidant like Vitamin E or rosemary oleoresin extract to help preserve the soap.');
    } else if (iodineLevel === 'low') {
        warnings.push('Low iodine value means excellent shelf stability, but the bar may feel less moisturizing.');
    }

    const insLevel = classify(properties.ins, R.ins);
    if (insLevel === 'high') {
        warnings.push('High INS value may cause the soap to trace very quickly. Work at lower temperatures and have moulds ready.');
    } else if (insLevel === 'low') {
        warnings.push('Low INS value indicates the bar may be slow to trace and remain soft longer. Consider adding sodium lactate to aid hardening.');
    }

    if (hardnessLevel === 'low') {
        warnings.push('This soft bar will benefit from an extended cure time of 6 to 8 weeks.');
    } else if (hardnessLevel === 'high') {
        warnings.push('Cut bars soon after unmoulding (12 to 24 hours) to prevent cracking.');
    }

    if (degreasingLevel === 'high') {
        warnings.push('High degreasing is great for utility soap (e.g. garage, kitchen) but may be drying for frequent facial use.');
    }

    let html = `<p class="qualitative-summary">${summary}</p>`;

    if (warnings.length > 0) {
        html += `<ul class="qualitative-warnings">`;
        warnings.forEach(w => {
            html += `<li>${w}</li>`;
        });
        html += `</ul>`;
    }

    return html;
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format a weight value with unit
 * @param {number} weight - Weight value
 * @param {string} unit - Unit string
 * @returns {string} Formatted weight string
 */
function formatWeight(weight, unit) {
    return `${weight.toFixed(2)} ${unit}`;
}


// ============================================
// Recipe Procedure Templates
// ============================================

/**
 * Convert Celsius to Fahrenheit
 * @param {number} celsius - Temperature in Celsius
 * @returns {number} Temperature in Fahrenheit
 */
function celsiusToFahrenheit(celsius) {
    return Math.round(celsius * 9 / 5 + 32);
}

/**
 * Format temperature for display based on unit system
 * @param {number} lowC - Low temperature in Celsius
 * @param {number} highC - High temperature in Celsius
 * @param {string} unitSystem - 'metric' or 'imperial'
 * @returns {string} Formatted temperature string
 */
function formatTemperatureRange(lowC, highC, unitSystem) {
    if (unitSystem === 'imperial') {
        return `${celsiusToFahrenheit(lowC)}-${celsiusToFahrenheit(highC)}°F`;
    }
    return `${lowC}-${highC}°C`;
}

const COLD_PROCESS_PROCEDURE = [
    {
        title: 'Prepare fats',
        textTemplate: (unit) => `Combine fats in a heat-safe, non-reactive container (avoid aluminum). Heat gently until all solid fats are melted, then let cool to target soaping temperature (typically ${formatTemperatureRange(38, 54, unit)}).`
    },
    {
        title: 'Prepare lye solution',
        text: 'Working in a well-ventilated area, slowly add lye to cold water (NEVER add water to lye) and stir until fully dissolved. The solution will heat up significantly; let it cool to your target temperature.'
    },
    {
        title: 'Combine',
        text: 'Slowly pour lye solution into fats, stirring to combine. Use an immersion blender to blend the mixture until it reaches light trace.'
    },
    {
        title: 'Add additives',
        text: 'Add fragrance, colourants, and other additives. Blend briefly to incorporate.',
        conditional: 'additives'
    },
    {
        title: 'Mould',
        text: 'Pour mixture into prepared moulds and tap them gently to release air bubbles.'
    },
    {
        title: 'Unmould and cure',
        text: 'Let mixture saponify for 24 to 48 hours, then unmould and cut into bars if needed. Cure soap on a rack in a cool, dry place for 4 to 6 weeks before use.'
    }
];

/**
 * Get procedure step text, supporting both static text and templates
 * @param {Object} step - Procedure step
 * @param {string} unitSystem - 'metric' or 'imperial'
 * @returns {string} Step text
 */
function getStepText(step, unitSystem) {
    if (step.textTemplate) {
        return step.textTemplate(unitSystem);
    }
    return step.text;
}

const HOT_PROCESS_PROCEDURE = [
    {
        title: 'Prepare fats',
        text: 'Combine fats in a slow cooker or double boiler. Heat gently until all solid fats are melted.'
    },
    {
        title: 'Prepare lye solution',
        text: 'Working in a well-ventilated area, slowly add lye to cold water (NEVER add water to lye) and stir until fully dissolved. The solution will heat up significantly.'
    },
    {
        title: 'Combine',
        text: 'Slowly pour lye solution into fats, stirring to combine. Use an immersion blender to blend the mixture until it reaches trace.'
    },
    {
        title: 'Cook',
        text: 'Cover and cook on low heat, stirring every 15-20 minutes. The soap will go through various stages (separation, gel, mashed potato texture). Cook until it reaches a translucent, vaseline-like consistency and tests neutral with pH strips (typically 1-3 hours).'
    },
    {
        title: 'Add additives',
        text: 'Remove from heat and let cool slightly. Add fragrance, colourants, and other additives. Stir thoroughly to incorporate.',
        conditional: 'additives'
    },
    {
        title: 'Mould',
        text: 'Working quickly while soap is still pliable, spoon or press mixture into prepared moulds. Tap firmly to remove air pockets.'
    },
    {
        title: 'Unmould',
        text: 'Let soap cool completely and harden (usually overnight), then unmould and cut into bars if needed. Hot process soap is safe to use immediately, though a 1-2 week cure will improve hardness.'
    }
];

// ============================================
// HTML Builders
// ============================================

/**
 * Build ingredients list HTML
 * @param {Object} data - Recipe data
 * @returns {string} HTML for ingredients section
 */
function buildIngredientsList(data) {
    const { recipe, recipeAdditives, fatsDatabase, additivesDatabase, lyeAmount, waterAmount, lyeType, unit } = data;

    let html = '<div class="recipe-section"><h4>Ingredients</h4><ul class="ingredients-list">';

    // Fats
    recipe.forEach(fat => {
        const fatData = fatsDatabase[fat.id];
        const name = fatData ? fatData.name : fat.id;
        html += `<li><span class="ingredient-amount">${formatWeight(fat.weight, unit)}</span> <span class="ingredient-name">${name}</span></li>`;
    });

    // Lye
    const lyeFullName = lyeType === 'NaOH' ? 'Sodium Hydroxide (NaOH)' : 'Potassium Hydroxide (KOH)';
    html += `<li><span class="ingredient-amount">${formatWeight(lyeAmount, unit)}</span> <span class="ingredient-name">${lyeFullName}</span></li>`;

    // Water
    html += `<li><span class="ingredient-amount">${formatWeight(waterAmount, unit)}</span> <span class="ingredient-name">Distilled Water</span></li>`;

    // Additives
    recipeAdditives.forEach(item => {
        const additive = additivesDatabase[item.id];
        const name = additive ? additive.name : item.id;
        html += `<li><span class="ingredient-amount">${formatWeight(item.weight, unit)}</span> <span class="ingredient-name">${name}</span></li>`;
    });

    html += '</ul></div>';
    return html;
}

/**
 * Build procedure list HTML
 * @param {boolean} hasAdditives - Whether recipe has additives
 * @param {string} processType - 'cold' or 'hot'
 * @returns {string} HTML for procedure section
 */
function buildProcedureList(hasAdditives, processType = 'cold', unitSystem = 'metric') {
    const procedure = processType === 'hot' ? HOT_PROCESS_PROCEDURE : COLD_PROCESS_PROCEDURE;
    const processLabel = processType === 'hot' ? 'Hot process' : 'Cold process';

    let html = `<div class="recipe-section"><h4>Procedure <span class="process-type-label">(${processLabel})</span></h4><ol class="procedure-list">`;

    procedure.forEach(step => {
        // Skip conditional steps if condition not met
        if (step.conditional === 'additives' && !hasAdditives) return;

        html += `<li><strong>${step.title}.</strong> ${getStepText(step, unitSystem)}</li>`;
    });

    html += '</ol></div>';
    return html;
}

/**
 * Build recipe summary HTML
 * @param {Object} data - Recipe data
 * @returns {string} HTML for summary section
 */
function buildRecipeSummary(data) {
    const { recipe, recipeAdditives, lyeAmount, waterAmount, lyeType, superfat, waterRatio, unit } = data;
    const totalFatWeight = recipe.reduce((sum, fat) => sum + fat.weight, 0);
    const additivesWeight = recipeAdditives.reduce((sum, item) => sum + item.weight, 0);
    const totalBatch = totalFatWeight + lyeAmount + waterAmount + additivesWeight;

    let html = `
        <div class="recipe-summary">
            <h4>Recipe summary</h4>
            <ul>
                <li>Total fats: ${formatWeight(totalFatWeight, unit)}</li>
                <li>${lyeType}: ${formatWeight(lyeAmount, unit)}</li>
                <li>Water: ${formatWeight(waterAmount, unit)} (${waterRatio}:1 water to lye)</li>`;

    if (recipeAdditives.length > 0) {
        html += `<li>Additives: ${formatWeight(additivesWeight, unit)}</li>`;
    }

    html += `
                <li>Total batch weight: ${formatWeight(totalBatch, unit)}</li>
                <li>Superfat: ${superfat}%</li>
            </ul>
        </div>`;

    return html;
}

/**
 * Build fatty acid profile HTML
 * @param {Object} fattyAcids - Fatty acid percentages
 * @returns {string} HTML for fatty acid profile section
 */
function buildFattyAcidProfile(fattyAcids) {
    // Calculate sat:unsat ratio
    const saturated = (fattyAcids.caprylic || 0) + (fattyAcids.capric || 0) +
        fattyAcids.lauric + fattyAcids.myristic + fattyAcids.palmitic +
        fattyAcids.stearic + (fattyAcids.arachidic || 0) + (fattyAcids.behenic || 0);
    const unsaturated = (fattyAcids.palmitoleic || 0) + fattyAcids.oleic +
        fattyAcids.ricinoleic + fattyAcids.linoleic + fattyAcids.linolenic +
        (fattyAcids.erucic || 0);

    // Build table rows for acids with values > 0
    const rows = FATTY_ACID_KEYS
        .filter(acid => (fattyAcids[acid] || 0) > 0)
        .map(acid => `
            <tr>
                <td><button type="button" class="fa-link" data-acid="${acid}">${FATTY_ACID_NAMES[acid]}</button></td>
                <td class="fa-value">${(fattyAcids[acid] || 0).toFixed(0)}%</td>
            </tr>
        `).join('');

    return `
        <div class="recipe-summary fatty-acid-profile">
            <h4>Fatty acid profile</h4>
            <table class="fa-profile-table">
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <p class="sat-unsat-summary">Saturated : Unsaturated = ${saturated.toFixed(0)} : ${unsaturated.toFixed(0)}</p>
        </div>
    `;
}

// ============================================
// Science Section
// ============================================

/**
 * Classify a value relative to its recommended range
 * @param {number} value - The calculated value
 * @param {Object} range - {min, max}
 * @returns {string} 'below', 'within', or 'above'
 */
function classifyValue(value, range) {
    // Round to match display precision
    const rounded = Math.round(value);
    if (rounded < range.min) return 'below';
    if (rounded > range.max) return 'above';
    return 'within';
}

/**
 * Get human-readable classification text
 * @param {string} classification - 'below', 'within', or 'above'
 * @returns {string} Human-readable text
 */
function getClassificationText(classification) {
    const texts = {
        below: 'below',
        within: 'within',
        above: 'above'
    };
    return texts[classification] || 'within';
}

/**
 * Build a single property explanation for the science section
 * @param {string} propertyKey - Key like 'hardness', 'degreasing'
 * @param {number} value - Calculated value
 * @param {Object} formulas - Formulas database
 * @param {Object} sources - Sources database
 * @returns {string} HTML for the explanation
 */
function buildPropertyExplanation(propertyKey, value, formulas, sources) {
    // Map property keys to formula keys
    const formulaKeyMap = {
        hardness: 'hardness',
        degreasing: 'degreasing',
        moisturizing: 'moisturizing',
        'lather-volume': 'lather-volume',
        'lather-density': 'lather-density',
        iodine: 'iodine-value',
        ins: 'ins-value'
    };

    const formulaKey = formulaKeyMap[propertyKey];
    const formula = formulas?.[formulaKey];
    if (!formula) return '';

    const range = PROPERTY_RANGES[propertyKey];
    const classification = classifyValue(value, range);
    const classText = getClassificationText(classification);

    // Get resolved reference if available
    let citationHtml = '';
    let learnMoreHtml = '';

    if (formula.references && formula.references.length > 0) {
        const resolved = resolveReference(formula.references[0], sources);
        if (resolved.url) {
            citationHtml = `
                <p class="science-citation">
                    Source: <a href="${resolved.url}" target="_blank" rel="noopener">${resolved.source}</a>
                </p>`;
        } else if (resolved.source) {
            citationHtml = `<p class="science-citation">Source: ${resolved.source}</p>`;
        }
    }

    if (formula.learnMore) {
        learnMoreHtml = `
            <p class="science-learn-more">
                Want to learn more? <a href="${formula.learnMore.url}" target="_blank" rel="noopener">${formula.learnMore.text}</a>
            </p>`;
    }

    return `
        <div class="science-explanation">
            <h5>${formula.name}: ${value.toFixed(0)}</h5>
            <p>${formula.userFriendly}</p>
            <p class="science-value-context">
                Your value of <strong>${value.toFixed(0)}</strong> is ${classText} the recommended range of ${range.min}–${range.max}.
            </p>
            ${citationHtml}
            ${learnMoreHtml}
        </div>
    `;
}

/**
 * Build the lye calculation explanation
 * @param {Object} data - Recipe data
 * @param {Object} formulas - Formulas database
 * @param {Object} sources - Sources database
 * @returns {string} HTML for lye explanation
 */
function buildLyeExplanation(data, formulas, sources) {
    const formula = formulas?.['lye-amount'];
    if (!formula) return '';

    const lyeFullName = data.lyeType === 'NaOH' ? 'sodium hydroxide' : 'potassium hydroxide';

    // Get citation
    let citationHtml = '';
    if (formula.references && formula.references.length > 0) {
        const resolved = resolveReference(formula.references[0], sources);
        if (resolved.url) {
            citationHtml = `
                <p class="science-citation">
                    Source: <a href="${resolved.url}" target="_blank" rel="noopener">${resolved.source}</a>
                </p>`;
        }
    }

    let learnMoreHtml = '';
    if (formula.learnMore) {
        learnMoreHtml = `
            <p class="science-learn-more">
                Want to learn more? <a href="${formula.learnMore.url}" target="_blank" rel="noopener">${formula.learnMore.text}</a>
            </p>`;
    }

    return `
        <div class="science-explanation">
            <h5>Lye calculation</h5>
            <p>${formula.userFriendly}</p>
            <p class="science-value-context">
                Your recipe requires <strong>${data.lyeAmount.toFixed(2)} ${data.unit}</strong> of ${lyeFullName} with a <strong>${data.superfat}% superfat</strong>.
            </p>
            ${citationHtml}
            ${learnMoreHtml}
        </div>
    `;
}

/**
 * Build the water ratio explanation
 * @param {Object} data - Recipe data
 * @param {Object} formulas - Formulas database
 * @param {Object} sources - Sources database
 * @returns {string} HTML for water explanation
 */
function buildWaterExplanation(data, formulas, sources) {
    const formula = formulas?.['water-amount'];
    if (!formula) return '';

    // Calculate lye concentration
    const lyeConcentration = (data.lyeAmount / (data.lyeAmount + data.waterAmount) * 100).toFixed(0);

    // Get citation
    let citationHtml = '';
    if (formula.references && formula.references.length > 0) {
        const resolved = resolveReference(formula.references[0], sources);
        if (resolved.url) {
            citationHtml = `
                <p class="science-citation">
                    Source: <a href="${resolved.url}" target="_blank" rel="noopener">${resolved.source}</a>
                </p>`;
        }
    }

    let learnMoreHtml = '';
    if (formula.learnMore) {
        learnMoreHtml = `
            <p class="science-learn-more">
                Want to learn more? <a href="${formula.learnMore.url}" target="_blank" rel="noopener">${formula.learnMore.text}</a>
            </p>`;
    }

    return `
        <div class="science-explanation">
            <h5>Water and lye concentration</h5>
            <p>${formula.userFriendly}</p>
            <p class="science-value-context">
                With a <strong>${data.waterRatio}:1</strong> water-to-lye ratio, your solution is approximately <strong>${lyeConcentration}%</strong> lye concentration.
            </p>
            ${citationHtml}
            ${learnMoreHtml}
        </div>
    `;
}

/**
 * Build all science explanations HTML
 * @param {Object} data - Recipe data
 * @returns {string} HTML for all explanations
 */
function buildScienceExplanations(data) {
    const { properties, formulas, sources } = data;
    if (!formulas || !sources) return '';

    const explanations = [];

    // Core calculations
    explanations.push(buildLyeExplanation(data, formulas, sources));
    explanations.push(buildWaterExplanation(data, formulas, sources));

    // Soap properties
    const propertyOrder = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density', 'iodine', 'ins'];
    propertyOrder.forEach(key => {
        if (properties[key] !== undefined) {
            explanations.push(buildPropertyExplanation(key, properties[key], formulas, sources));
        }
    });

    return explanations.filter(html => html).join('');
}

/**
 * Build the science section with expandable details
 * @param {Object} data - Recipe data
 * @returns {string} HTML for science section
 */
function buildScienceSection(data) {
    return `
        <details class="science-section">
            <summary class="science-toggle">
                <span class="details-toggle">Give me the science!</span>
                <span class="details-hide">Hide the science</span>
            </summary>
            <div class="science-content">
                <h4>The science behind it</h4>
                <div class="recipe-details-row">
                    ${buildRecipeSummary(data)}
                    ${buildFattyAcidProfile(data.fattyAcids)}
                </div>
                <div class="science-explanations">
                    ${buildScienceExplanations(data)}
                </div>
            </div>
        </details>
    `;
}

// ============================================
// Exported Functions
// ============================================

/**
 * Render the final recipe with ingredients and procedure
 * @param {HTMLElement} container - Container element
 * @param {Object} data - Recipe data
 * @param {Array} data.recipe - Recipe array of {id, weight}
 * @param {Array} data.recipeAdditives - Additives array
 * @param {Object} data.fatsDatabase - Fat database
 * @param {Object} data.additivesDatabase - Additives database
 * @param {number} data.lyeAmount - Lye amount
 * @param {number} data.waterAmount - Water amount
 * @param {string} data.lyeType - Lye type (NaOH or KOH)
 * @param {string} data.processType - Process type (cold or hot)
 * @param {number} data.superfat - Superfat percentage
 * @param {number} data.waterRatio - Water to lye ratio
 * @param {string} data.unit - Unit string
 * @param {Object} data.fattyAcids - Fatty acid percentages
 * @param {Object} data.properties - Soap properties {hardness, degreasing, moisturizing, lather-volume, lather-density, iodine, ins}
 * @param {Array} data.notes - Recipe notes array
 */
export function renderFinalRecipe(container, data) {
    const hasAdditives = data.recipeAdditives.length > 0;
    const unitSystem = data.unitSystem || 'metric';

    container.innerHTML = `
        <div class="recipe-prose">
            ${buildQualitativeSummary(data.properties, data.notes)}
            ${buildIngredientsList(data)}
            ${buildProcedureList(hasAdditives, data.processType, unitSystem)}
            ${buildScienceSection(data)}
        </div>
    `;
}

/**
 * Show the final recipe card
 */
export function showFinalRecipe() {
    const card = $(ELEMENT_IDS.finalRecipeCard);
    if (card) {
        card.classList.remove(CSS_CLASSES.hidden);
        card.scrollIntoView({ behavior: 'smooth' });
    }
}
