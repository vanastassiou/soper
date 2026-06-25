/**
 * Ingredients page functionality
 * Combines fats and additives for the soapmaking section
 */

import { $ } from '../../../js/ui/helpers.js';
import { TIMING } from '../../../js/lib/constants.js';
import { renderReferencesHtml } from '../../../js/lib/references.js';
import { setupCategoryFilters } from './filters.js';

let fatsData = {};
let fragrancesData = {};
let colourantsData = {};
let soapPerformanceData = {};
let skinCareData = {};
let sourcesData = {};
let glossaryData = {};
let currentCategory = 'all';

async function loadIngredients() {
    try {
        const [
            fatsResponse, fragrancesResponse, colourantsResponse,
            soapPerformanceResponse, skinCareResponse, sourcesResponse, glossaryResponse
        ] = await Promise.all([
            fetch('../../../data/fats.json'),
            fetch('../../../data/fragrances.json'),
            fetch('../../../data/colourants.json'),
            fetch('../../../data/soap-performance.json'),
            fetch('../../../data/skin-care.json'),
            fetch('../../../data/sources.json'),
            fetch('../../../data/glossary.json')
        ]);

        // Check for failed responses
        const responses = [fatsResponse, fragrancesResponse, colourantsResponse,
            soapPerformanceResponse, skinCareResponse, sourcesResponse, glossaryResponse];
        for (const response of responses) {
            if (!response.ok) {
                throw new Error(`Failed to load ${response.url}: ${response.status}`);
            }
        }

        fatsData = await fatsResponse.json();
        fragrancesData = await fragrancesResponse.json();
        colourantsData = await colourantsResponse.json();
        soapPerformanceData = await soapPerformanceResponse.json();
        skinCareData = await skinCareResponse.json();
        sourcesData = await sourcesResponse.json();
        glossaryData = await glossaryResponse.json();
        renderIngredients();
    } catch (error) {
        console.error('Failed to load ingredients:', error);
        const container = $('ingredientsList');
        if (container) {
            container.innerHTML = `<p class="no-results">Failed to load ingredients. Please try refreshing the page.</p>`;
        }
    }
}

function renderFatCard(key, data) {
    const details = data.details || {};
    const sap = details.sap || {};
    const usage = details.usage || {};
    const fattyAcids = details.fattyAcids || {};

    return `
        <article class="entry-card" data-key="${key}" data-type="fat">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
            </header>
            ${data.description ? `<p class="entry-desc">${data.description}</p>` : ''}

            ${sap.naoh || sap.koh || details.iodine || details.ins || usage.min !== undefined || usage.max !== undefined ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Soap properties</span>
                        <span class="details-hide">Hide properties</span>
                    </summary>
                    <div class="entry-details-content">
                        <dl class="fatty-acid-list">
                            ${sap.naoh ? `<div class="fatty-acid-item"><dt>SAP (NaOH)</dt><dd>${sap.naoh}</dd></div>` : ''}
                            ${sap.koh ? `<div class="fatty-acid-item"><dt>SAP (KOH)</dt><dd>${sap.koh}</dd></div>` : ''}
                            ${details.iodine ? `<div class="fatty-acid-item"><dt>Iodine</dt><dd>${details.iodine}</dd></div>` : ''}
                            ${details.ins ? `<div class="fatty-acid-item"><dt>INS</dt><dd>${details.ins}</dd></div>` : ''}
                            ${usage.min !== undefined || usage.max !== undefined ? `<div class="fatty-acid-item"><dt>Usage</dt><dd>${usage.min || 0}% - ${usage.max || 100}%</dd></div>` : ''}
                        </dl>
                    </div>
                </details>
            ` : ''}

            ${Object.keys(fattyAcids).length > 0 ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Fatty acid profile</span>
                        <span class="details-hide">Hide profile</span>
                    </summary>
                    <div class="entry-details-content">
                        <dl class="fatty-acid-list">
                            ${Object.entries(fattyAcids)
                                .filter(([_, v]) => v > 0)
                                .sort((a, b) => b[1] - a[1])
                                .map(([acid, pct]) => `
                                    <div class="fatty-acid-item">
                                        <dt>${acid}</dt>
                                        <dd>${pct}%</dd>
                                    </div>
                                `).join('')}
                        </dl>
                    </div>
                </details>
            ` : ''}

            ${data.tags?.length > 0 ? `
                <div class="entry-tags">
                    ${data.tags.map(tag => `<span class="entry-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}

            ${renderReferencesHtml(data.references, sourcesData)}
        </article>
    `;
}

function renderAdditiveCard(key, data) {
    const details = data.details || {};
    const usage = details.usage || {};
    const majorConstituents = details.majorConstituents || {};
    const safety = details.safety || {};

    // Build properties list using dl/dt/dd pattern
    const properties = [];
    if (details.sourceSpecies) properties.push(`<div class="fatty-acid-item"><dt>Source</dt><dd>${details.sourceSpecies}</dd></div>`);
    if (details.sourcePart) properties.push(`<div class="fatty-acid-item"><dt>Part</dt><dd>${details.sourcePart}</dd></div>`);
    if (details.extractionMethod) properties.push(`<div class="fatty-acid-item"><dt>Extraction</dt><dd>${details.extractionMethod}</dd></div>`);
    if (details.scentNote) properties.push(`<div class="fatty-acid-item"><dt>Scent note</dt><dd>${details.scentNote}</dd></div>`);
    if (details.subcategory) properties.push(`<div class="fatty-acid-item"><dt>Category</dt><dd>${details.subcategory}</dd></div>`);
    if (details.color) properties.push(`<div class="fatty-acid-item"><dt>Color</dt><dd><span style="background:${details.color};width:1em;height:1em;display:inline-block;vertical-align:middle;border-radius:2px;margin-right:0.5em;"></span>${details.color}</dd></div>`);
    if (details.density) properties.push(`<div class="fatty-acid-item"><dt>Density</dt><dd>${details.density} g/cm³</dd></div>`);
    if (safety.casNumber) properties.push(`<div class="fatty-acid-item"><dt>CAS number</dt><dd>${safety.casNumber}</dd></div>`);
    if (safety.flashPointC) properties.push(`<div class="fatty-acid-item"><dt>Flash point</dt><dd>${safety.flashPointC}°C</dd></div>`);
    if (safety.maxConcentration) properties.push(`<div class="fatty-acid-item"><dt>Max concentration</dt><dd>${safety.maxConcentration}%</dd></div>`);
    if (usage.min !== undefined || usage.max !== undefined) properties.push(`<div class="fatty-acid-item"><dt>Usage</dt><dd>${usage.min || 0}% - ${usage.max || 100}%${usage.basis ? ` (${usage.basis})` : ''}</dd></div>`);

    return `
        <article class="entry-card" data-key="${key}" data-type="additive">
            <header class="entry-header">
                <h2 class="entry-title">${data.name}</h2>
            </header>
            ${data.description ? `<p class="entry-desc">${data.description}</p>` : ''}

            ${properties.length > 0 ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Properties</span>
                        <span class="details-hide">Hide properties</span>
                    </summary>
                    <div class="entry-details-content">
                        <dl class="fatty-acid-list">
                            ${properties.join('')}
                        </dl>
                    </div>
                </details>
            ` : ''}

            ${Object.keys(majorConstituents).length > 0 ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">Major constituents</span>
                        <span class="details-hide">Hide constituents</span>
                    </summary>
                    <div class="entry-details-content">
                        <dl class="fatty-acid-list">
                            ${Object.entries(majorConstituents)
                                .sort((a, b) => (b[1].max || 0) - (a[1].max || 0))
                                .map(([constituent, range]) => `
                                    <div class="fatty-acid-item">
                                        <dt>${constituent.replace(/-/g, ' ')}</dt>
                                        <dd>${range.min || 0}% - ${range.max || 0}%</dd>
                                    </div>
                                `).join('')}
                        </dl>
                    </div>
                </details>
            ` : ''}

            ${data.related?.filter(r => glossaryData[r]).length > 0 ? `
                <div class="entry-related">
                    <span class="entry-related-label">Related:</span>
                    ${data.related
                        .filter(r => glossaryData[r])
                        .map(r => `<a href="glossary.html#${r}" class="entry-related-link">${glossaryData[r].term}</a>`)
                        .join('')}
                </div>
            ` : ''}

            ${renderReferencesHtml(data.references, sourcesData)}
        </article>
    `;
}

function addEntries(entries, data, type) {
    Object.entries(data).forEach(([key, item]) => {
        entries.push({ key, data: item, type, name: item.name });
    });
}

function renderIngredients() {
    const container = $('ingredientsList');

    let entries = [];

    if (currentCategory === 'all' || currentCategory === 'fats') {
        addEntries(entries, fatsData, 'fat');
    }
    if (currentCategory === 'all' || currentCategory === 'fragrances') {
        addEntries(entries, fragrancesData, 'additive');
    }
    if (currentCategory === 'all' || currentCategory === 'colourants') {
        addEntries(entries, colourantsData, 'additive');
    }
    if (currentCategory === 'all' || currentCategory === 'soap-performance') {
        addEntries(entries, soapPerformanceData, 'additive');
    }
    if (currentCategory === 'all' || currentCategory === 'skin-care') {
        addEntries(entries, skinCareData, 'additive');
    }

    // Sort alphabetically
    entries.sort((a, b) => a.name.localeCompare(b.name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No ingredients found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(entry => {
        if (entry.type === 'fat') {
            return renderFatCard(entry.key, entry.data);
        } else {
            return renderAdditiveCard(entry.key, entry.data);
        }
    }).join('');
}

currentCategory = setupCategoryFilters({
    validCategories: ['all', 'fats', 'fragrances', 'colourants', 'soap-performance', 'skin-care'],
    onChange: (category) => {
        currentCategory = category;
        renderIngredients();
    }
});
loadIngredients();
