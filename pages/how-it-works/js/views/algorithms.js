/**
 * Algorithms view - Formulas with category filtering
 */

import { renderEntryCard } from '../../../../js/lib/cards.js';
import { renderReferencesHtml, renderRelatedLinks, renderDetails, renderEmptyState } from '../shared/render.js';

let currentCategory = 'all';

export function renderAlgorithms(data, container, filterNav, category = 'all') {
    const { formulas, glossary, sources } = data;
    currentCategory = category;

    // Render filter nav
    renderFilterNav(filterNav, category);

    // Filter by calculator domain and category
    const entries = Object.entries(formulas)
        .filter(([_, d]) => d.domain?.includes('calculator'))
        .filter(([_, d]) => currentCategory === 'all' || d.category === currentCategory)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (renderEmptyState(container, entries, 'No formulas found in this category.')) return;

    container.innerHTML = entries.map(([key, d]) => renderEntryCard({
        key,
        name: d.name,
        description: d.summary,
        extraContent: `
            <div class="formula-equation">
                <code>${d.formula}</code>
            </div>

            <div class="formula-user-friendly">
                <p>${d.userFriendly}</p>
            </div>

            ${d.recommendedRange ? `
                <div class="formula-range">
                    <span class="range-label">Recommended range:</span>
                    <span class="range-values">${d.recommendedRange.min} - ${d.recommendedRange.max}</span>
                </div>
            ` : ''}

            ${renderDetails('Technical details', 'Hide technical details', buildTechnicalContent(d))}

            ${renderReferencesHtml(d.references, sources)}

            ${d.learnMore ? `
                <div class="entry-learn-more">
                    <a href="${d.learnMore.url}" target="_blank" rel="noopener noreferrer" class="learn-more-link">${d.learnMore.text} →</a>
                </div>
            ` : ''}

            ${renderRelatedLinks(d.related, glossary, { filterDomain: false })}
        `
    })).join('');
}

/**
 * Build technical details content for a formula
 */
function buildTechnicalContent(d) {
    if (!d.variables && !d.example && !d.technical) return null;

    const parts = [];

    if (d.variables) {
        parts.push(`
            <div class="formula-variables">
                <h3 class="formula-section-heading">Variables</h3>
                <dl class="formula-section-box">
                    ${Object.entries(d.variables).map(([varName, desc]) => `
                        <dt>${varName}</dt>
                        <dd>${desc}</dd>
                    `).join('')}
                </dl>
            </div>
        `);
    }

    if (d.example) {
        parts.push(`
            <div class="formula-example">
                <h3 class="formula-section-heading">Example</h3>
                <div class="formula-section-box">
                    <p class="example-scenario">${d.example.scenario}</p>
                    <div class="example-steps">
                        ${d.example.steps.map(step => `<div class="example-step">${step}</div>`).join('')}
                    </div>
                </div>
            </div>
        `);
    }

    if (d.technical) {
        parts.push(`
            <div class="formula-technical">
                <p>${d.technical}</p>
            </div>
        `);
    }

    return parts.join('');
}

function renderFilterNav(filterNav, activeCategory) {
    const categories = [
        { id: 'all', label: 'All' },
        { id: 'core', label: 'Core' },
        { id: 'properties', label: 'Properties' },
        { id: 'optimization', label: 'Optimization' }
    ];

    filterNav.innerHTML = `
        <nav class="page-nav" role="tablist" aria-label="Filter algorithms by category">
            ${categories.map(cat => `
                <button
                    class="page-filter${cat.id === activeCategory ? ' active' : ''}"
                    data-category="${cat.id}"
                    role="tab"
                    aria-selected="${cat.id === activeCategory ? 'true' : 'false'}"
                    aria-controls="content"
                >${cat.label}</button>
            `).join('')}
        </nav>
    `;
}

export function getValidCategory(category) {
    const validCategories = ['all', 'core', 'properties', 'optimization'];
    return validCategories.includes(category) ? category : 'all';
}
