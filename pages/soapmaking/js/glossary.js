/**
 * Glossary page functionality for soapmaking section
 * Displays glossary terms filtered by domain: craft
 */

import { $ } from '../../../js/ui/helpers.js';
import { renderEntryCard } from '../../../js/lib/cards.js';
import { TIMING } from '../../../js/lib/constants.js';
import { renderReferencesHtml } from '../../../js/lib/references.js';
import { setupCategoryFilters } from './filters.js';

let glossaryData = {};
let sourcesData = {};
let currentCategory = 'all';

async function loadGlossary() {
    const [glossaryResponse, sourcesResponse] = await Promise.all([
        fetch('../../../data/glossary.json'),
        fetch('../../../data/sources.json')
    ]);
    glossaryData = await glossaryResponse.json();
    sourcesData = await sourcesResponse.json();
    renderGlossary();
}

function renderGlossary() {
    const container = $('glossaryList');

    // Filter by craft domain and category
    const entries = Object.entries(glossaryData)
        .filter(([_, data]) => data.domain?.includes('craft'))
        .filter(([_, data]) => currentCategory === 'all' || data.type === currentCategory)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No terms found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => renderEntryCard({
        key,
        name: data.name,
        description: data.description,
        extraContent: `
            ${data.details ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">More details</span>
                        <span class="details-hide">Hide details</span>
                    </summary>
                    <div class="entry-details-content">${data.details.replace(/\n/g, '<br>')}</div>
                </details>
            ` : ''}
            ${data.related?.length > 0 ? `
                <div class="entry-related">
                    <span class="entry-related-label">Related:</span>
                    ${data.related
                        .filter(r => glossaryData[r] && glossaryData[r].domain?.includes('craft'))
                        .map(r => `<a href="#${r}" class="entry-related-link" data-term="${r}">${glossaryData[r].name}</a>`)
                        .join('')}
                </div>
            ` : ''}
            ${renderReferencesHtml(data.references, sourcesData)}
        `
    })).join('');

    // Handle related term clicks
    container.querySelectorAll('.entry-related-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const termKey = link.dataset.term;
            const entry = container.querySelector(`[data-key="${termKey}"]`);
            if (entry) {
                entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
                entry.classList.add('highlight');
                setTimeout(() => entry.classList.remove('highlight'), TIMING.HIGHLIGHT_DURATION);
            }
        });
    });
}

currentCategory = setupCategoryFilters({
    validCategories: ['all', 'property', 'concept', 'additive'],
    onChange: (category) => {
        currentCategory = category;
        renderGlossary();
    }
});
loadGlossary();
