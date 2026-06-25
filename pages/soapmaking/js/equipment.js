/**
 * Equipment page functionality
 * Displays soapmaking equipment filtered by domain: craft
 */

import { $ } from '../../../js/ui/helpers.js';
import { renderEntryCard } from '../../../js/lib/cards.js';
import { TIMING } from '../../../js/lib/constants.js';
import { renderReferencesHtml } from '../../../js/lib/references.js';
import { setupCategoryFilters } from './filters.js';

let equipmentData = {};
let sourcesData = {};
let currentCategory = 'all';

async function loadEquipment() {
    const [equipmentResponse, sourcesResponse] = await Promise.all([
        fetch('../../../data/equipment.json'),
        fetch('../../../data/sources.json')
    ]);
    equipmentData = await equipmentResponse.json();
    sourcesData = await sourcesResponse.json();
    renderEquipment();
}

function renderEquipment() {
    const container = $('equipmentList');

    // Filter by craft domain and category
    const entries = Object.entries(equipmentData)
        .filter(([_, data]) => data.domain?.includes('craft'))
        .filter(([_, data]) => currentCategory === 'all' || data.category === currentCategory)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No equipment found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => renderEntryCard({
        key,
        name: data.name,
        description: data.description,
        extraContent: `
            ${data.safetyNotes?.length > 0 ? `
                <div class="entry-safety">
                    <h3 class="entry-subheading">Safety notes</h3>
                    <ul class="entry-bullet-list entry-bullet-list--warning">
                        ${data.safetyNotes.map(n => `<li>${n}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${data.materials?.length > 0 ? `
                <div class="entry-list">
                    <span class="entry-list-label">Materials:</span>
                    <span class="entry-list-items">${data.materials.join(', ')}</span>
                </div>
            ` : ''}
            ${data.details || data.considerations?.length > 0 ? `
                <details class="entry-details">
                    <summary>
                        <span class="details-toggle">More details</span>
                        <span class="details-hide">Hide details</span>
                    </summary>
                    ${data.details ? `<div class="entry-details-content">${data.details.replace(/\n/g, '<br>')}</div>` : ''}
                    ${data.considerations?.length > 0 ? `
                        <div class="entry-considerations">
                            <h3 class="entry-subheading">Considerations</h3>
                            <ul class="entry-bullet-list">
                                ${data.considerations.map(c => `<li>${c}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </details>
            ` : ''}
            ${renderReferencesHtml(data.references, sourcesData)}
        `
    })).join('');
}

currentCategory = setupCategoryFilters({
    validCategories: ['all', 'safety', 'measuring', 'mixing', 'mould'],
    onChange: (category) => {
        currentCategory = category;
        renderEquipment();
    }
});
loadEquipment();
