/**
 * Processes page functionality
 * Displays soapmaking processes filtered by domain: craft
 */

import { $ } from '../../../js/ui/helpers.js';
import { renderEntryCard } from '../../../js/lib/cards.js';
import { TIMING } from '../../../js/lib/constants.js';
import { renderReferencesHtml } from '../../../js/lib/references.js';

let processesData = {};
let sourcesData = {};
let glossaryData = {};
let equipmentData = {};

async function loadProcesses() {
    const [processesResponse, sourcesResponse, glossaryResponse, equipmentResponse] = await Promise.all([
        fetch('../../../data/processes.json'),
        fetch('../../../data/sources.json'),
        fetch('../../../data/glossary.json'),
        fetch('../../../data/equipment.json')
    ]);
    processesData = await processesResponse.json();
    sourcesData = await sourcesResponse.json();
    glossaryData = await glossaryResponse.json();
    equipmentData = await equipmentResponse.json();
    renderProcesses();
}

function renderProcesses() {
    const container = $('processesList');

    // Filter by craft domain, sort by difficulty
    const entries = Object.entries(processesData)
        .filter(([_, data]) => data.domain?.includes('craft'))
        .sort((a, b) => {
            const order = { beginner: 0, intermediate: 1, advanced: 2 };
            return (order[a[1].difficulty] || 0) - (order[b[1].difficulty] || 0);
        });

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-results">No processes found in this category.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, data]) => renderEntryCard({
        key,
        name: data.name,
        description: data.summary,
        modifier: '--process',
        extraContent: `
            ${data.description ? `
                <div class="process-description">
                    <p>${data.description.replace(/\n\n/g, '</p><p>')}</p>
                </div>
            ` : ''}

            ${data.timing ? `
                <div class="process-timing">
                    ${data.timing.activeTime ? `<span class="timing-item"><strong>Active time:</strong> ${data.timing.activeTime}</span>` : ''}
                    ${data.timing.totalTime ? `<span class="timing-item"><strong>Total time:</strong> ${data.timing.totalTime}</span>` : ''}
                    ${data.timing.cureTime ? `<span class="timing-item"><strong>Cure time:</strong> ${data.timing.cureTime}</span>` : ''}
                </div>
            ` : ''}

            ${data.steps?.length > 0 ? `
                <details class="entry-details" open>
                    <summary>
                        <span class="details-toggle">Steps (${data.steps.length})</span>
                        <span class="details-hide">Hide steps</span>
                    </summary>
                    <div class="entry-details-content">
                        <ol class="process-steps">
                            ${data.steps.map(step => `
                                <li class="process-step">
                                    <h3 class="step-title">${step.title}</h3>
                                    <p class="step-description">${step.description}</p>
                                    ${step.tips?.length > 0 ? `
                                        <ul class="step-tips">
                                            ${step.tips.map(tip => `<li>${tip}</li>`).join('')}
                                        </ul>
                                    ` : ''}
                                    ${step.warnings?.length > 0 ? `
                                        <ul class="step-warnings">
                                            ${step.warnings.map(w => `<li>${w}</li>`).join('')}
                                        </ul>
                                    ` : ''}
                                </li>
                            `).join('')}
                        </ol>
                    </div>
                </details>
            ` : ''}

            ${data.equipment?.length > 0 ? `
                <div class="process-equipment">
                    <h3 class="entry-subheading">Equipment needed</h3>
                    <ul class="equipment-list">
                        ${data.equipment.map(eq => {
                            const eqData = equipmentData[eq];
                            return eqData
                                ? `<li><a href="equipment.html#${eq}" class="equipment-link">${eqData.name}</a></li>`
                                : `<li>${eq}</li>`;
                        }).join('')}
                    </ul>
                </div>
            ` : ''}

            ${data.advantages?.length > 0 || data.disadvantages?.length > 0 ? `
                <div class="process-pros-cons">
                    ${data.advantages?.length > 0 ? `
                        <div class="pros">
                            <h3 class="entry-subheading">Advantages</h3>
                            <ul class="entry-bullet-list entry-bullet-list--positive">
                                ${data.advantages.map(a => `<li>${a}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${data.disadvantages?.length > 0 ? `
                        <div class="cons">
                            <h3 class="entry-subheading">Disadvantages</h3>
                            <ul class="entry-bullet-list entry-bullet-list--negative">
                                ${data.disadvantages.map(d => `<li>${d}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
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
        `
    })).join('');
}

// Initialize
loadProcesses();
